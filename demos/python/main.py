"""
LeoUpload Python demo server (FastAPI).

Implements the LeoUpload REST protocol:
  POST   /api/upload/init            -> initialize session (returns uploadedChunks for resume)
  POST   /api/upload/chunk           -> upload a single chunk (multipart, MD5-verified)
  GET    /api/upload/progress/{id}   -> query uploaded chunks
  POST   /api/upload/complete/{id}   -> merge chunks, return file URL + checksum
  DELETE /api/upload/{id}            -> cancel and cleanup

Run:
  pip install -r requirements.txt
  uvicorn main:app --reload --port 3003
"""

import asyncio
import hashlib
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="LeoUpload Python Demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
CHUNK_DIR = UPLOAD_DIR / "_chunks"
SESSION_TTL = timedelta(hours=24)

UPLOAD_DIR.mkdir(exist_ok=True)
CHUNK_DIR.mkdir(exist_ok=True)


# ---- Models ----

class InitRequest(BaseModel):
    fileName: str
    fileSize: int
    fileType: str = "application/octet-stream"
    chunkSize: int = 5 * 1024 * 1024
    totalChunks: int
    metadata: dict[str, str] | None = None


class Session:
    def __init__(self, req: InitRequest) -> None:
        self.upload_id = str(uuid.uuid4())
        self.file_name = req.fileName
        self.file_size = req.fileSize
        self.file_type = req.fileType
        self.chunk_size = req.chunkSize
        self.total_chunks = req.totalChunks
        self.metadata = req.metadata
        self.status = "uploading"
        self.created_at = datetime.now(timezone.utc)
        self.expires_at = self.created_at + SESSION_TTL

    def fingerprint(self) -> str:
        return f"{self.file_name}|{self.file_size}|{self.file_type}"

    def public(self) -> dict:
        return {
            "uploadId": self.upload_id,
            "fileName": self.file_name,
            "fileSize": self.file_size,
            "totalChunks": self.total_chunks,
            "chunkSize": self.chunk_size,
            "status": self.status,
            "createdAt": self.created_at.isoformat(),
            "expiresAt": self.expires_at.isoformat(),
        }


sessions: dict[str, Session] = {}


# ---- Helpers ----

def chunk_dir(upload_id: str) -> Path:
    return CHUNK_DIR / upload_id


def uploaded_chunks(upload_id: str) -> list[int]:
    d = chunk_dir(upload_id)
    if not d.exists():
        return []
    return sorted(int(p.name) for p in d.iterdir() if p.name.isdigit())


def get_session(upload_id: str) -> Session:
    session = sessions.get(upload_id)
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    return session


def md5_hex(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


async def cleanup_expired() -> None:
    now = datetime.now(timezone.utc)
    expired = [s for s in sessions.values() if s.expires_at < now]
    for session in expired:
        shutil.rmtree(chunk_dir(session.upload_id), ignore_errors=True)
        sessions.pop(session.upload_id, None)


async def cleanup_loop() -> None:
    while True:
        await asyncio.sleep(3600)
        await cleanup_expired()


@app.on_event("startup")
async def start_cleanup() -> None:
    asyncio.create_task(cleanup_loop())


# ---- Endpoints ----

@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "service": "leoupload-python"}


@app.post("/api/upload/init", status_code=201)
async def init_upload(req: InitRequest) -> dict:
    # Resume support: reuse an existing session for the same file fingerprint
    for session in sessions.values():
        if session.fingerprint() == f"{req.fileName}|{req.fileSize}|{req.fileType}" and session.status == "uploading":
            return {
                "uploadId": session.upload_id,
                "chunkSize": session.chunk_size,
                "uploadedChunks": uploaded_chunks(session.upload_id),
                "expiresAt": session.expires_at.isoformat(),
            }

    session = Session(req)
    sessions[session.upload_id] = session
    chunk_dir(session.upload_id).mkdir(parents=True, exist_ok=True)

    return {
        "uploadId": session.upload_id,
        "chunkSize": session.chunk_size,
        "uploadedChunks": [],
        "expiresAt": session.expires_at.isoformat(),
    }


@app.post("/api/upload/chunk")
async def upload_chunk(
    uploadId: str = Form(...),
    chunkIndex: int = Form(...),
    chunkHash: str = Form(""),
    totalChunks: int = Form(0),
    file: UploadFile = File(...),
) -> dict:
    get_session(uploadId)

    data = await file.read()

    # Verify chunk integrity
    if chunkHash and md5_hex(data) != chunkHash:
        return {
            "uploadId": uploadId,
            "chunkIndex": chunkIndex,
            "received": False,
            "error": "CHUNK_HASH_MISMATCH",
        }

    (chunk_dir(uploadId) / str(chunkIndex)).write_bytes(data)

    return {
        "uploadId": uploadId,
        "chunkIndex": chunkIndex,
        "received": True,
        "writtenBytes": len(data),
    }


@app.get("/api/upload/progress/{upload_id}")
async def progress(upload_id: str) -> dict:
    session = get_session(upload_id)
    return {
        **session.public(),
        "uploadedChunks": uploaded_chunks(upload_id),
    }


@app.post("/api/upload/complete/{upload_id}")
async def complete_upload(upload_id: str, body: dict | None = None) -> dict:
    session = get_session(upload_id)

    if session.status == "cancelled":
        shutil.rmtree(chunk_dir(upload_id), ignore_errors=True)
        raise HTTPException(status_code=410, detail="Upload has been cancelled")

    done = uploaded_chunks(upload_id)
    if len(done) != session.total_chunks:
        raise HTTPException(
            status_code=409,
            detail=f"Not all chunks uploaded: {len(done)}/{session.total_chunks}",
        )

    # Verify per-chunk checksums if provided
    checksums = (body or {}).get("checksums") or {}
    for idx_str, expected in checksums.items():
        actual = md5_hex((chunk_dir(upload_id) / str(idx_str)).read_bytes())
        if actual != expected:
            raise HTTPException(status_code=409, detail=f"Chunk {idx_str} hash mismatch")

    # Merge chunks in order
    output_path = UPLOAD_DIR / session.file_name
    with output_path.open("wb") as out:
        for idx in range(session.total_chunks):
            out.write((chunk_dir(upload_id) / str(idx)).read_bytes())

    checksum = md5_hex(output_path.read_bytes())
    session.status = "completed"

    shutil.rmtree(chunk_dir(upload_id), ignore_errors=True)

    return {
        "uploadId": upload_id,
        "status": "completed",
        "fileUrl": f"/uploads/{session.file_name}",
        "fileSize": session.file_size,
        "checksum": checksum,
    }


@app.delete("/api/upload/{upload_id}")
async def cancel_upload(upload_id: str) -> dict:
    session = sessions.get(upload_id)
    if session:
        session.status = "cancelled"
        # Also remove the merged output if it was already created
        (UPLOAD_DIR / session.file_name).unlink(missing_ok=True)
    shutil.rmtree(chunk_dir(upload_id), ignore_errors=True)
    return {"uploadId": upload_id, "status": "cancelled"}


# Serve merged files
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

//! LeoUpload Rust demo server (axum).
//!
//! Implements the LeoUpload REST protocol:
//!   POST   /api/upload/init            -> initialize session (returns uploadedChunks for resume)
//!   POST   /api/upload/chunk           -> upload a single chunk (multipart, MD5-verified)
//!   GET    /api/upload/progress/{id}   -> query uploaded chunks
//!   POST   /api/upload/complete/{id}   -> merge chunks, return file URL + checksum
//!   DELETE /api/upload/{id}            -> cancel and cleanup
//!
//! Run:
//!   cargo run --release
//! (port 3004, override with PORT env var)

use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use md5::{Digest, Md5};
use serde::Deserialize;
use serde_json::{json, Value};
use tower_http::services::ServeDir;
use uuid::Uuid;

const SESSION_TTL_SECS: u64 = 24 * 60 * 60;

#[derive(Clone)]
struct AppState {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
    upload_dir: PathBuf,
}

struct Session {
    file_name: String,
    file_size: u64,
    file_type: String,
    chunk_size: u64,
    total_chunks: u32,
    status: &'static str,
    created_at: u64,
    expires_at: u64,
}

impl Session {
    fn fingerprint(&self) -> String {
        format!("{}|{}|{}", self.file_name, self.file_size, self.file_type)
    }

    fn public(&self, upload_id: &str) -> Value {
        json!({
            "uploadId": upload_id,
            "fileName": self.file_name,
            "fileSize": self.file_size,
            "totalChunks": self.total_chunks,
            "chunkSize": self.chunk_size,
            "status": self.status,
            "createdAt": iso8601(self.created_at),
            "expiresAt": iso8601(self.expires_at),
        })
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn iso8601(secs: u64) -> String {
    // RFC 3339 timestamp in UTC (accurate to seconds)
    let days = secs / 86400;
    let rem = secs % 86400;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    // Civil-from-days algorithm (Howard Hinnant) for Y-M-D
    let z = days as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let mth = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if mth <= 2 { y + 1 } else { y };
    format!("{y:04}-{mth:02}-{d:02}T{h:02}:{m:02}:{s:02}Z")
}

fn md5_hex(data: &[u8]) -> String {
    let mut hasher = Md5::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

fn chunk_dir(state: &AppState, upload_id: &str) -> PathBuf {
    state.upload_dir.join("_chunks").join(upload_id)
}

fn uploaded_chunks(state: &AppState, upload_id: &str) -> Vec<u32> {
    let mut out: Vec<u32> = std::fs::read_dir(chunk_dir(state, upload_id))
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter_map(|e| e.file_name().to_str().and_then(|n| n.parse::<u32>().ok()))
                .collect()
        })
        .unwrap_or_default();
    out.sort_unstable();
    out
}

fn err_json(status: StatusCode, message: &str) -> Response {
    (status, Json(json!({ "error": message }))).into_response()
}

fn not_found() -> Response {
    err_json(StatusCode::NOT_FOUND, "Upload session not found")
}

// ---- Handlers ----

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InitRequest {
    file_name: String,
    file_size: u64,
    #[serde(default = "default_file_type")]
    file_type: String,
    #[serde(default = "default_chunk_size")]
    chunk_size: u64,
    total_chunks: u32,
    #[serde(default)]
    metadata: Option<Value>,
}

fn default_file_type() -> String {
    "application/octet-stream".into()
}

fn default_chunk_size() -> u64 {
    5 * 1024 * 1024
}

async fn init_upload(State(state): State<AppState>, Json(req): Json<InitRequest>) -> Response {
    let fingerprint = format!("{}|{}|{}", req.file_name, req.file_size, req.file_type);

    // Resume support: reuse an existing uploading session with the same fingerprint
    {
        let sessions = state.sessions.lock().unwrap();
        for (id, s) in sessions.iter() {
            if s.status == "uploading" && s.fingerprint() == fingerprint {
                return Json(json!({
                    "uploadId": id,
                    "chunkSize": s.chunk_size,
                    "uploadedChunks": uploaded_chunks(&state, id),
                    "expiresAt": iso8601(s.expires_at),
                }))
                .into_response();
            }
        }
    }

    let upload_id = Uuid::new_v4().to_string();
    let now = now_secs();
    let session = Session {
        file_name: req.file_name,
        file_size: req.file_size,
        file_type: req.file_type,
        chunk_size: req.chunk_size,
        total_chunks: req.total_chunks,
        status: "uploading",
        created_at: now,
        expires_at: now + SESSION_TTL_SECS,
    };
    let expires_at = session.expires_at;

    std::fs::create_dir_all(chunk_dir(&state, &upload_id)).unwrap();
    state
        .sessions
        .lock()
        .unwrap()
        .insert(upload_id.clone(), session);

    Json(json!({
        "uploadId": upload_id,
        "chunkSize": req.chunk_size,
        "uploadedChunks": [],
        "expiresAt": iso8601(expires_at),
    }))
    .into_response()
}

async fn upload_chunk(State(state): State<AppState>, mut multipart: Multipart) -> Response {
    let mut upload_id = String::new();
    let mut chunk_index: Option<u32> = None;
    let mut chunk_hash = String::new();
    let mut file_bytes: Option<Vec<u8>> = None;

    while let Ok(Some(mut field)) = multipart.next_field().await {
        match field.name() {
            Some("uploadId") => {
                upload_id = field.text().await.unwrap_or_default();
            }
            Some("chunkIndex") => {
                chunk_index = field.text().await.ok().and_then(|t| t.parse().ok());
            }
            Some("chunkHash") => {
                chunk_hash = field.text().await.unwrap_or_default();
            }
            Some("file") => {
                let mut buf = Vec::new();
                while let Ok(Some(chunk)) = field.chunk().await {
                    buf.extend_from_slice(&chunk);
                }
                file_bytes = Some(buf);
            }
            _ => {}
        }
    }

    let (Some(chunk_index), Some(bytes)) = (chunk_index, file_bytes) else {
        return err_json(
            StatusCode::BAD_REQUEST,
            "Missing required fields: uploadId, chunkIndex, file",
        );
    };

    {
        let sessions = state.sessions.lock().unwrap();
        if !sessions.contains_key(&upload_id) {
            return Json(json!({
                "uploadId": upload_id,
                "chunkIndex": chunk_index,
                "received": false,
                "error": "Upload session not found",
            }))
            .into_response();
        }
    }

    // Verify chunk integrity
    if !chunk_hash.is_empty() && md5_hex(&bytes) != chunk_hash {
        return Json(json!({
            "uploadId": upload_id,
            "chunkIndex": chunk_index,
            "received": false,
            "error": "CHUNK_HASH_MISMATCH",
        }))
        .into_response();
    }

    let path = chunk_dir(&state, &upload_id).join(chunk_index.to_string());
    if let Err(e) = std::fs::write(path, &bytes) {
        return err_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
    }

    Json(json!({
        "uploadId": upload_id,
        "chunkIndex": chunk_index,
        "received": true,
        "writtenBytes": bytes.len(),
    }))
    .into_response()
}

async fn progress(State(state): State<AppState>, Path(upload_id): Path<String>) -> Response {
    let mut body = {
        let sessions = state.sessions.lock().unwrap();
        match sessions.get(&upload_id) {
            Some(s) => s.public(&upload_id),
            None => return not_found(),
        }
    };
    body["uploadedChunks"] = json!(uploaded_chunks(&state, &upload_id));
    Json(body).into_response()
}

async fn complete_upload(
    State(state): State<AppState>,
    Path(upload_id): Path<String>,
    body: Option<Json<Value>>,
) -> Response {
    let (file_name, total_chunks, chunk_size) = {
        let sessions = state.sessions.lock().unwrap();
        match sessions.get(&upload_id) {
            Some(s) => (s.file_name.clone(), s.total_chunks, s.chunk_size),
            None => return not_found(),
        }
    };

    let done = uploaded_chunks(&state, &upload_id);
    if done.len() != total_chunks as usize {
        return err_json(
            StatusCode::CONFLICT,
            format!("Not all chunks uploaded: {}/{}", done.len(), total_chunks).as_str(),
        );
    }

    // Verify per-chunk checksums if provided
    if let Some(Json(body)) = &body {
        if let Some(checksums) = body.get("checksums").and_then(|c| c.as_object()) {
            for (idx, expected) in checksums {
                let path = chunk_dir(&state, &upload_id).join(idx.to_string());
                let expected = expected.as_str().unwrap_or_default();
                match std::fs::read(&path) {
                    Ok(bytes) if md5_hex(&bytes) == expected => {}
                    Ok(_) => {
                        return err_json(
                            StatusCode::CONFLICT,
                            format!("Chunk {idx} hash mismatch").as_str(),
                        )
                    }
                    Err(e) => return err_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
                }
            }
        }
    }

    // Merge chunks in order
    let output_path = state.upload_dir.join(&file_name);
    let mut merged = Vec::with_capacity(total_chunks as usize * chunk_size as usize);
    for idx in 0..total_chunks {
        match std::fs::read(chunk_dir(&state, &upload_id).join(idx.to_string())) {
            Ok(bytes) => merged.extend_from_slice(&bytes),
            Err(e) => return err_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
        }
    }
    let checksum = md5_hex(&merged);
    if let Err(e) = std::fs::write(&output_path, &merged) {
        return err_json(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
    }

    if let Some(s) = state.sessions.lock().unwrap().get_mut(&upload_id) {
        s.status = "completed";
    }
    std::fs::remove_dir_all(chunk_dir(&state, &upload_id)).ok();

    Json(json!({
        "uploadId": upload_id,
        "status": "completed",
        "fileUrl": format!("/uploads/{}", file_name),
        "fileSize": merged.len(),
        "checksum": checksum,
    }))
    .into_response()
}

async fn cancel_upload(State(state): State<AppState>, Path(upload_id): Path<String>) -> Response {
    if let Some(s) = state.sessions.lock().unwrap().get_mut(&upload_id) {
        s.status = "cancelled";
        std::fs::remove_file(state.upload_dir.join(&s.file_name)).ok();
    }
    std::fs::remove_dir_all(chunk_dir(&state, &upload_id)).ok();
    Json(json!({ "uploadId": upload_id, "status": "cancelled" })).into_response()
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "service": "leoupload-rust" }))
}

fn cleanup_expired(state: &AppState) {
    let now = now_secs();
    let mut sessions = state.sessions.lock().unwrap();
    let expired: Vec<String> = sessions
        .iter()
        .filter(|(_, s)| s.expires_at < now)
        .map(|(id, _)| id.clone())
        .collect();
    for id in expired {
        std::fs::remove_dir_all(chunk_dir(state, &id)).ok();
        sessions.remove(&id);
    }
}

#[tokio::main]
async fn main() {
    let upload_dir = Path::new("./uploads").to_path_buf();
    std::fs::create_dir_all(upload_dir.join("_chunks")).unwrap();

    let state = AppState {
        sessions: Arc::new(Mutex::new(HashMap::new())),
        upload_dir: upload_dir.clone(),
    };

    // Hourly cleanup of expired sessions
    {
        let state = state.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(3600));
            loop {
                interval.tick().await;
                cleanup_expired(&state);
            }
        });
    }

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/upload/init", post(init_upload))
        .route("/api/upload/chunk", post(upload_chunk))
        .route("/api/upload/progress/:upload_id", get(progress))
        .route("/api/upload/complete/:upload_id", post(complete_upload))
        .route("/api/upload/:upload_id", delete(cancel_upload))
        .nest_service("/uploads", ServeDir::new(&upload_dir))
        .with_state(state);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3004);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("[LeoUpload] Rust demo server running on http://localhost:{port}");
    println!("  POST /api/upload/init");
    println!("  POST /api/upload/chunk");
    println!("  GET  /api/upload/progress/:uploadId");
    println!("  POST /api/upload/complete/:uploadId");
    println!("  DELETE /api/upload/:uploadId");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

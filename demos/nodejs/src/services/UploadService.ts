import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FileStore } from './FileStore.js';

interface InitRequest {
  fileName: string;
  fileSize: number;
  fileType: string;
  chunkSize: number;
  totalChunks: number;
  metadata?: Record<string, string>;
}

interface ChunkRequest {
  uploadId: string;
  chunkIndex: number;
  chunkHash: string;
  totalChunks: number;
  buffer: Buffer;
  originalHash: string;
}

interface UploadSession {
  uploadId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: Set<number>;
  status: 'uploading' | 'completed' | 'cancelled';
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, string>;
}

/**
 * Core upload business logic.
 * Manages sessions and delegates I/O to FileStore.
 */
export class UploadService {
  private store: FileStore;
  private sessions = new Map<string, UploadSession>();
  private sessionTTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(store: FileStore) {
    this.store = store;
    // Periodic cleanup
    setInterval(() => this.cleanupExpired(), 60 * 60 * 1000); // hourly
  }

  async initUpload(req: InitRequest) {
    // Check for existing session by fingerprint
    const fingerprint = this.fingerprint(req);
    const existing = [...this.sessions.values()].find(
      (s) =>
        this.fingerprint({
          fileName: s.fileName,
          fileSize: s.fileSize,
          fileType: s.fileType,
          chunkSize: s.chunkSize,
          totalChunks: s.totalChunks,
        }) === fingerprint && s.status === 'uploading',
    );

    if (existing) {
      const uploadedChunks = await this.store.getUploadedChunks(existing.uploadId);
      return {
        uploadId: existing.uploadId,
        chunkSize: existing.chunkSize,
        uploadedChunks,
        expiresAt: new Date(existing.expiresAt).toISOString(),
      };
    }

    const uploadId = uuidv4();
    const now = Date.now();

    const session: UploadSession = {
      uploadId,
      fileName: req.fileName,
      fileSize: req.fileSize,
      fileType: req.fileType,
      chunkSize: req.chunkSize,
      totalChunks: req.totalChunks,
      uploadedChunks: new Set(),
      status: 'uploading',
      createdAt: now,
      expiresAt: now + this.sessionTTL,
      metadata: req.metadata,
    };

    this.sessions.set(uploadId, session);
    await this.store.createUploadDir(uploadId);
    await this.store.saveMeta(uploadId, session);

    return {
      uploadId,
      chunkSize: req.chunkSize,
      uploadedChunks: [],
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  async uploadChunk(req: ChunkRequest) {
    const session = this.sessions.get(req.uploadId);
    if (!session) {
      return {
        uploadId: req.uploadId,
        chunkIndex: req.chunkIndex,
        received: false,
        error: 'Upload session not found',
      };
    }

    // Verify chunk hash
    const actualHash = createHash('md5').update(new Uint8Array(req.buffer)).digest('hex');
    if (req.originalHash && actualHash !== req.originalHash) {
      return {
        uploadId: req.uploadId,
        chunkIndex: req.chunkIndex,
        received: false,
        error: 'CHUNK_HASH_MISMATCH',
      };
    }

    await this.store.writeChunk(req.uploadId, req.chunkIndex, req.buffer);
    session.uploadedChunks.add(req.chunkIndex);

    return {
      uploadId: req.uploadId,
      chunkIndex: req.chunkIndex,
      received: true,
      writtenBytes: req.buffer.length,
    };
  }

  async getProgress(uploadId: string) {
    const session = this.sessions.get(uploadId);
    if (!session) return null;

    const uploadedChunks = await this.store.getUploadedChunks(uploadId);

    return {
      uploadId,
      fileName: session.fileName,
      fileSize: session.fileSize,
      totalChunks: session.totalChunks,
      uploadedChunks,
      chunkSize: session.chunkSize,
      status: session.status,
      createdAt: new Date(session.createdAt).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  async completeUpload(uploadId: string, checksums?: Record<number, string>) {
    const session = this.sessions.get(uploadId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    const uploadedChunks = await this.store.getUploadedChunks(uploadId);

    // Validate all chunks are present
    if (uploadedChunks.length !== session.totalChunks) {
      throw new Error(
        `Not all chunks uploaded: ${uploadedChunks.length}/${session.totalChunks}`,
      );
    }

    // Validate checksums if provided
    if (checksums) {
      for (const [idx, expectedHash] of Object.entries(checksums)) {
        const chunkPath = await this.store.getChunkPath(uploadId, Number(idx));
        const buffer = await fs.readFile(chunkPath);
        const actualHash = createHash('md5').update(new Uint8Array(buffer)).digest('hex');
        if (actualHash !== expectedHash) {
          throw new Error(`Chunk ${idx} hash mismatch`);
        }
      }
    }

    // Merge chunks
    const outputPath = path.join('uploads', session.fileName);
    await this.store.mergeChunks(uploadId, session.totalChunks, outputPath);

    // Compute full file hash
    const fileBuffer = await fs.readFile(outputPath);
    const checksum = createHash('md5').update(new Uint8Array(fileBuffer)).digest('hex');

    session.status = 'completed';

    // Clean up chunk files
    await this.store.cleanup(uploadId);

    return {
      uploadId,
      status: 'completed' as const,
      fileUrl: `/uploads/${session.fileName}`,
      fileSize: session.fileSize,
      checksum,
    };
  }

  async cancelUpload(uploadId: string) {
    const session = this.sessions.get(uploadId);
    if (session) {
      session.status = 'cancelled';
    }
    await this.store.cleanup(uploadId);
  }

  /**
   * Fingerprint an upload for deduplication.
   */
  private fingerprint(req: {
    fileName: string;
    fileSize: number;
    fileType: string;
    chunkSize: number;
    totalChunks: number;
  }): string {
    const hash = createHash('sha256');
    hash.update(`${req.fileName}|${req.fileSize}|${req.fileType}`);
    return hash.digest('hex');
  }

  private async cleanupExpired() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt < now) {
        await this.store.cleanup(id);
        this.sessions.delete(id);
      }
    }
  }
}

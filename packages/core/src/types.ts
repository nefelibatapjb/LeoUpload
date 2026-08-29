// ============================================================================
// @leoupload/core — Public API Types
// ============================================================================

// ---- Configuration ----

export interface UploadConfig {
  /** Chunk size in bytes. Default: 5 * 1024 * 1024 (5 MB) */
  chunkSize: number;
  /** Maximum concurrent chunk uploads. Default: 3 */
  concurrency: number;
  /** Retry delay sequence in milliseconds. Default: [0, 1000, 3000, 5000, 10000] */
  retryDelays: number[];
  /** Maximum retry attempts per chunk. Default: 5 */
  maxRetries: number;
  /** Hash algorithm for chunk integrity. Default: 'md5' */
  hashAlgorithm: HashAlgorithm;
  /** Whether to use Web Workers for hashing. Default: true */
  useWorker: boolean;
  /** Whether to persist state to IndexedDB/localStorage. Default: true */
  persistEnabled: boolean;
  /** Maximum time (ms) a chunk upload can take before timeout. Default: 120000 */
  chunkTimeout: number;
  /** Protocol endpoint URLs */
  server: ServerEndpoints;
  /** Custom headers attached to every request */
  headers?: Record<string, string>;
  /** Custom metadata sent to /upload/init */
  metadata?: Record<string, string>;
  /** Automatically start uploading. Default: true */
  autoStart?: boolean;
  /**
   * Listen to browser online/offline events: pause automatically when the
   * network drops and resume automatically when it comes back. Default: true
   */
  autoResumeOnReconnect: boolean;
}

export interface ServerEndpoints {
  /** e.g. '/api/upload/init' */
  init: string;
  /** e.g. '/api/upload/chunk' */
  chunk: string;
  /** e.g. '/api/upload/progress' — appended with /:uploadId */
  progress: string;
  /** e.g. '/api/upload/complete' — appended with /:uploadId */
  complete: string;
  /** e.g. '/api/upload' — appended with /:uploadId */
  cancel: string;
}

export type HashAlgorithm = 'md5' | 'sha256';
export type UploadStatus =
  | 'idle'
  | 'hashing'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'error';

// ---- Upload State ----

export interface UploadState {
  status: UploadStatus;
  overallProgress: number; // 0-100
  uploadedBytes: number;
  totalBytes: number;
  chunkProgress: ChunkProgress[];
  uploadId: string | null;
  error: UploadError | null;
}

export interface ChunkProgress {
  index: number;
  start: number;
  end: number;
  hash: string;
  status: ChunkStatus;
  retryCount: number;
}

export type ChunkStatus = 'pending' | 'uploading' | 'done' | 'error';

// ---- Events ----

export interface UploadEventMap {
  progress: ProgressEvent;
  'chunk:start': ChunkEvent;
  'chunk:complete': ChunkCompleteEvent;
  'chunk:error': ChunkErrorEvent;
  'chunk:retry': RetryEvent;
  pause: void;
  resume: void;
  complete: UploadResult;
  error: UploadError;
  cancel: void;
  /** The browser reports the network went offline (window 'offline') */
  offline: void;
  /** The browser reports the network is back (window 'online') */
  online: void;
}

export interface ProgressEvent {
  overallProgress: number;
  uploadedBytes: number;
  totalBytes: number;
  completedChunks: number;
  totalChunks: number;
}

export interface ChunkEvent {
  chunkIndex: number;
  uploadId: string;
}

export interface ChunkCompleteEvent extends ChunkEvent {
  hash: string;
  durationMs: number;
  response: ChunkUploadResponse;
}

export interface ChunkErrorEvent extends ChunkEvent {
  error: UploadError;
  retryAttempt: number;
  willRetry: boolean;
}

export interface RetryEvent {
  chunkIndex: number;
  attempt: number;
  delayMs: number;
  error: UploadError;
}

// ---- Upload Result ----

export interface UploadResult {
  uploadId: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  totalChunks: number;
  durationMs: number;
  checksum: string;
}

// ---- Error Types ----

export type UploadErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'CHUNK_HASH_MISMATCH'
  | 'SERVER_ERROR'
  | 'STORAGE_FULL'
  | 'FILE_NOT_FOUND'
  | 'UPLOAD_EXPIRED'
  | 'INVALID_RESPONSE'
  | 'WORKER_ERROR'
  | 'CANCELLED';

export class UploadError extends Error {
  code: UploadErrorCode;
  statusCode?: number;
  chunkIndex?: number;
  uploadId?: string;
  retryable: boolean;

  constructor(
    message: string,
    code: UploadErrorCode,
    options: {
      statusCode?: number;
      chunkIndex?: number;
      uploadId?: string;
      retryable?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.statusCode = options.statusCode;
    this.chunkIndex = options.chunkIndex;
    this.uploadId = options.uploadId;
    this.retryable = options.retryable ?? false;
  }
}

// ---- Protocol Types ----

export interface InitUploadRequest {
  fileName: string;
  fileSize: number;
  fileType: string;
  chunkSize: number;
  totalChunks: number;
  checksum?: string;
  metadata?: Record<string, string>;
}

export interface InitUploadResponse {
  uploadId: string;
  chunkSize: number;
  uploadedChunks: number[];
  expiresAt: string;
}

export interface ChunkUploadResponse {
  uploadId: string;
  chunkIndex: number;
  received: boolean;
  writtenBytes?: number;
  error?: string;
}

export interface UploadProgressResponse {
  uploadId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  chunkSize: number;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export interface CompleteUploadRequest {
  checksums?: Record<number, string>;
  metadata?: Record<string, string>;
}

export interface CompleteUploadResponse {
  uploadId: string;
  status: 'completed';
  fileUrl: string;
  fileSize: number;
  checksum: string;
}

// ---- Internal Chunk Types ----

export interface Chunk {
  index: number;
  blob: Blob;
  start: number;
  end: number;
}

export interface HashedChunk extends Chunk {
  hash: string;
  retryCount: number;
}

// ---- Persistence Types ----

export interface UploadSession {
  uploadId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  totalChunks: number;
  chunkSize: number;
  completedChunks: number[];
  status: UploadStatus;
  timestamp: number;
  serverInitUrl: string;
}

// ---- Default Configuration ----

export const DEFAULT_CONFIG: UploadConfig = {
  chunkSize: 5 * 1024 * 1024, // 5 MB
  concurrency: 3,
  retryDelays: [0, 1000, 3000, 5000, 10000, 15000],
  maxRetries: 5,
  hashAlgorithm: 'md5',
  useWorker: true,
  persistEnabled: true,
  chunkTimeout: 120000,
  autoStart: true,
  autoResumeOnReconnect: true,
  server: {
    init: '/api/upload/init',
    chunk: '/api/upload/chunk',
    progress: '/api/upload/progress',
    complete: '/api/upload/complete',
    cancel: '/api/upload',
  },
};

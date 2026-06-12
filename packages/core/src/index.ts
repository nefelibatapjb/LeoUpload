// @leoupload/core — Public API
// Barrel exports for tree-shakeable consumption

// Main class
export { LeoUpload } from './LeoUpload';

// Types
export type {
  UploadConfig,
  UploadState,
  UploadStatus,
  UploadResult,
  UploadEventMap,
  UploadErrorCode,
  UploadSession,
  ServerEndpoints,
  HashAlgorithm,
  ChunkProgress,
  ChunkStatus,
  ProgressEvent,
  ChunkEvent,
  ChunkCompleteEvent,
  ChunkErrorEvent,
  RetryEvent,
  InitUploadRequest,
  InitUploadResponse,
  ChunkUploadResponse,
  UploadProgressResponse,
  CompleteUploadRequest,
  CompleteUploadResponse,
} from './types';

export { UploadError, DEFAULT_CONFIG } from './types';

// Sub-modules (for advanced usage)
export { EventEmitter } from './events/EventEmitter';
export { ProtocolClient } from './protocol/ProtocolClient';
export { ChunkManager } from './chunker/ChunkManager';
export { HashWorker } from './hash/HashWorker';
export { UploadQueue } from './queue/UploadQueue';
export { RetryManager, DEFAULT_RETRY_CONFIG } from './retry/RetryManager';
export type { RetryConfig, RetryDecision } from './retry/RetryManager';

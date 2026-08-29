import { createSignal, batch } from 'solid-js';
import {
  LeoUpload,
  type UploadConfig,
  type UploadState,
  type UploadResult,
  type ChunkProgress,
  type UploadError,
} from '@leoupload/core';

export interface UseUploadReturn {
  /** Current upload status */
  status: () => UploadState['status'];
  /** Overall upload progress (0-100) */
  progress: () => number;
  /** Uploaded bytes */
  uploadedBytes: () => number;
  /** Total bytes */
  totalBytes: () => number;
  /** Current error, if any */
  error: () => UploadError | null;
  /** Active upload ID */
  uploadId: () => string | null;
  /** Per-chunk progress */
  chunks: () => ChunkProgress[];
  /** Name of the current file being uploaded */
  fileName: () => string;

  /** Start uploading a file */
  start: (file: File) => Promise<UploadResult>;
  /** Pause the upload */
  pause: () => void;
  /** Resume a paused upload */
  resume: () => Promise<UploadResult>;
  /** Cancel the upload */
  cancel: () => Promise<void>;
}

/**
 * Solid.js primitive for LeoUpload.
 *
 * @example
 * ```tsx
 * const upload = useUpload({ server: { ... } });
 * <progress value={upload.progress()} max={100} />
 * ```
 */
export function useUpload(config: Partial<UploadConfig> = {}): UseUploadReturn {
  const uploader = new LeoUpload(config);

  const [status, setStatus] = createSignal<UploadState['status']>('idle');
  const [progress, setProgress] = createSignal(0);
  const [uploadedBytes, setUploadedBytes] = createSignal(0);
  const [totalBytes, setTotalBytes] = createSignal(0);
  const [error, setError] = createSignal<UploadError | null>(null);
  const [uploadId, setUploadId] = createSignal<string | null>(null);
  const [chunks, setChunks] = createSignal<ChunkProgress[]>([]);
  const [fileName, setFileName] = createSignal('');

  const syncState = () => {
    const s = uploader.state;
    batch(() => {
      setStatus(s.status);
      setChunks([...s.chunkProgress]);
      setUploadId(s.uploadId);
    });
  };

  uploader.on('progress', (e) => {
    batch(() => {
      setStatus((prev) => (prev === 'hashing' ? 'uploading' : prev));
      setProgress(e.overallProgress);
      setUploadedBytes(e.uploadedBytes);
      setTotalBytes(e.totalBytes);
    });
  });

  uploader.on('error', (e) => {
    batch(() => {
      setError(e);
      setStatus('error');
    });
  });

  uploader.on('complete', () => {
    batch(() => {
      setProgress(100);
      setStatus('completed');
    });
    syncState();
  });

  uploader.on('pause', () => {
    setStatus('paused');
    syncState();
  });

  uploader.on('resume', () => {
    setStatus('uploading');
    syncState();
  });

  uploader.on('cancel', () => {
    setStatus('cancelled');
    syncState();
  });

  async function start(file: File): Promise<UploadResult> {
    batch(() => {
      setFileName(file.name);
      setStatus('hashing');
      setError(null);
    });
    try {
      const result = await uploader.start(file);
      syncState();
      return result;
    } catch (err) {
      syncState();
      throw err;
    }
  }

  function pause(): void {
    uploader.pause();
    syncState();
  }

  async function resume(): Promise<UploadResult> {
    const result = await uploader.resume();
    syncState();
    return result;
  }

  async function cancel(): Promise<void> {
    await uploader.cancel();
    syncState();
  }

  return {
    status,
    progress,
    uploadedBytes,
    totalBytes,
    error,
    uploadId,
    chunks,
    fileName,
    start,
    pause,
    resume,
    cancel,
  };
}

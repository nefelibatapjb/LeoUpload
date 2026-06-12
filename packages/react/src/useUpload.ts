import { useRef, useState, useEffect, useCallback } from 'react';
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
  status: UploadState['status'];
  /** Overall upload progress (0-100) */
  progress: number;
  /** Uploaded bytes */
  uploadedBytes: number;
  /** Total bytes */
  totalBytes: number;
  /** Current error, if any */
  error: UploadError | null;
  /** Active upload ID */
  uploadId: string | null;
  /** Per-chunk progress */
  chunks: ChunkProgress[];

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
 * React hook for LeoUpload.
 *
 * @example
 * ```tsx
 * function MyUploader() {
 *   const { status, progress, start, pause, resume } = useUpload({
 *     server: { init: '/api/upload/init', chunk: '/api/upload/chunk', ... }
 *   });
 *
 *   return (
 *     <div>
 *       <progress value={progress} max={100} />
 *       <button onClick={() => start(file)}>Upload</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUpload(config: Partial<UploadConfig> = {}): UseUploadReturn {
  // Stable config reference to avoid re-creating uploader
  const configRef = useRef(config);
  configRef.current = config;

  // Lazy init uploader — stored in ref to survive re-renders
  const uploaderRef = useRef<LeoUpload | null>(null);
  if (!uploaderRef.current) {
    uploaderRef.current = new LeoUpload(configRef.current);
  }
  const uploader = uploaderRef.current;

  // Reactive state
  const [status, setStatus] = useState<UploadState['status']>('idle');
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [error, setError] = useState<UploadError | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<ChunkProgress[]>([]);

  // Sync state helper
  const syncState = useCallback(() => {
    const state = uploader.state;
    setStatus(state.status);
    setChunks([...state.chunkProgress]);
    setUploadId(state.uploadId);
  }, [uploader]);

  // Wire events
  useEffect(() => {
    const unsubProgress = uploader.on('progress', (e) => {
      setProgress(e.overallProgress);
      setUploadedBytes(e.uploadedBytes);
      setTotalBytes(e.totalBytes);
    });

    const unsubError = uploader.on('error', (e) => {
      setError(e);
      setStatus('error');
    });

    const unsubComplete = uploader.on('complete', () => {
      setStatus('completed');
      syncState();
    });

    const unsubPause = uploader.on('pause', () => {
      setStatus('paused');
      syncState();
    });

    const unsubResume = uploader.on('resume', () => {
      setStatus('uploading');
      syncState();
    });

    const unsubCancel = uploader.on('cancel', () => {
      setStatus('cancelled');
      syncState();
    });

    return () => {
      unsubProgress();
      unsubError();
      unsubComplete();
      unsubPause();
      unsubResume();
      unsubCancel();
    };
  }, [uploader, syncState]);

  const start = useCallback(
    async (file: File): Promise<UploadResult> => {
      setStatus('hashing');
      setError(null);
      try {
        const result = await uploader.start(file);
        syncState();
        return result;
      } catch (err) {
        syncState();
        throw err;
      }
    },
    [uploader, syncState],
  );

  const pause = useCallback(() => {
    uploader.pause();
    syncState();
  }, [uploader, syncState]);

  const resume = useCallback(async (): Promise<UploadResult> => {
    const result = await uploader.resume();
    syncState();
    return result;
  }, [uploader, syncState]);

  const cancel = useCallback(async () => {
    await uploader.cancel();
    syncState();
  }, [uploader, syncState]);

  return {
    status,
    progress,
    uploadedBytes,
    totalBytes,
    error,
    uploadId,
    chunks,
    start,
    pause,
    resume,
    cancel,
  };
}

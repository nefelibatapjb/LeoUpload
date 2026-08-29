import { writable } from 'svelte/store';
import {
  LeoUpload,
  type UploadConfig,
  type UploadState,
  type UploadResult,
  type ChunkProgress,
  type UploadError,
} from '@leoupload/core';

export interface UseUploadState {
  status: UploadState['status'];
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  error: UploadError | null;
  uploadId: string | null;
  chunks: ChunkProgress[];
  fileName: string;
}

export interface UseUploadReturn {
  /** Reactive upload state as a Svelte store */
  state: ReturnType<typeof writable<UseUploadState>>;
  /** Start uploading a file */
  start: (file: File) => Promise<UploadResult>;
  /** Pause the upload */
  pause: () => void;
  /** Resume a paused upload */
  resume: () => Promise<UploadResult>;
  /** Cancel the upload */
  cancel: () => Promise<void>;
}

const initialState: UseUploadState = {
  status: 'idle',
  progress: 0,
  uploadedBytes: 0,
  totalBytes: 0,
  error: null,
  uploadId: null,
  chunks: [],
  fileName: '',
};

/**
 * Svelte composable for LeoUpload, backed by a writable store.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useUpload } from '@leoupload/svelte';
 *   const { state, start, pause, resume } = useUpload({ server: { ... } });
 * </script>
 *
 * <progress value={$state.progress} max={100} />
 * <button on:click={() => start(file)}>Upload</button>
 * ```
 */
export function useUpload(config: Partial<UploadConfig> = {}): UseUploadReturn {
  const uploader = new LeoUpload(config);
  const state = writable<UseUploadState>(initialState);

  const syncState = () => {
    const s = uploader.state;
    state.update((prev) => ({
      ...prev,
      status: s.status,
      uploadId: s.uploadId,
      chunks: [...s.chunkProgress],
    }));
  };

  uploader.on('progress', (e) => {
    state.update((prev) => ({
      ...prev,
      status: prev.status === 'hashing' ? 'uploading' : prev.status,
      progress: e.overallProgress,
      uploadedBytes: e.uploadedBytes,
      totalBytes: e.totalBytes,
    }));
  });

  uploader.on('error', (e) => {
    state.update((prev) => ({ ...prev, error: e, status: 'error' }));
  });

  uploader.on('complete', () => {
    state.update((prev) => ({ ...prev, progress: 100, status: 'completed' }));
    syncState();
  });

  uploader.on('pause', () => {
    state.update((prev) => ({ ...prev, status: 'paused' }));
    syncState();
  });

  uploader.on('resume', () => {
    state.update((prev) => ({ ...prev, status: 'uploading' }));
    syncState();
  });

  uploader.on('cancel', () => {
    state.update((prev) => ({ ...prev, status: 'cancelled' }));
    syncState();
  });

  async function start(file: File): Promise<UploadResult> {
    state.update((prev) => ({
      ...prev,
      fileName: file.name,
      status: 'hashing',
      error: null,
    }));
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

  return { state, start, pause, resume, cancel };
}

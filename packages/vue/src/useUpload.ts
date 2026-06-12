import {
  ref,
  readonly,
  onUnmounted,
  type Ref,
  type DeepReadonly,
} from 'vue';
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
  status: DeepReadonly<Ref<UploadState['status']>>;
  /** Overall upload progress (0–100) */
  progress: DeepReadonly<Ref<number>>;
  /** Uploaded bytes */
  uploadedBytes: DeepReadonly<Ref<number>>;
  /** Total bytes */
  totalBytes: DeepReadonly<Ref<number>>;
  /** Current error, if any */
  error: DeepReadonly<Ref<UploadError | null>>;
  /** Active upload ID */
  uploadId: DeepReadonly<Ref<string | null>>;
  /** Per-chunk progress */
  chunks: DeepReadonly<Ref<ChunkProgress[]>>;

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
 * Vue 3 composable for LeoUpload.
 *
 * @example
 * ```vue
 * <script setup>
 * const { status, progress, start, pause, resume } = useUpload({
 *   server: { init: '/api/upload/init', chunk: '/api/upload/chunk', ... }
 * });
 * </script>
 * ```
 */
export function useUpload(config: Partial<UploadConfig> = {}): UseUploadReturn {
  const uploader = new LeoUpload(config);

  // Reactive state
  const status = ref<UploadState['status']>('idle');
  const progress = ref(0);
  const uploadedBytes = ref(0);
  const totalBytes = ref(0);
  const error = ref<UploadError | null>(null);
  const uploadId = ref<string | null>(null);
  const chunks = ref<ChunkProgress[]>([]);

  // Wire events to reactive refs
  const unsubProgress = uploader.on('progress', (e) => {
    progress.value = e.overallProgress;
    uploadedBytes.value = e.uploadedBytes;
    totalBytes.value = e.totalBytes;
  });

  const unsubError = uploader.on('error', (e) => {
    error.value = e;
    status.value = 'error';
  });

  const unsubComplete = uploader.on('complete', () => {
    status.value = 'completed';
  });

  const unsubPause = uploader.on('pause', () => {
    status.value = 'paused';
  });

  const unsubResume = uploader.on('resume', () => {
    status.value = 'uploading';
  });

  const unsubCancel = uploader.on('cancel', () => {
    status.value = 'cancelled';
  });

  // Track state via a polling mechanism or state sync
  // We sync status on key lifecycle events
  const syncState = () => {
    const state = uploader.state;
    status.value = state.status;
    if (state.chunkProgress) {
      chunks.value = [...state.chunkProgress];
    }
  };

  // Cleanup on component unmount
  onUnmounted(() => {
    unsubProgress();
    unsubError();
    unsubComplete();
    unsubPause();
    unsubResume();
    unsubCancel();
    uploader.removeAllListeners();
  });

  const start = async (file: File): Promise<UploadResult> => {
    status.value = 'hashing';
    try {
      const result = await uploader.start(file);
      syncState();
      return result;
    } catch (err) {
      syncState();
      throw err;
    }
  };

  const pause = () => {
    uploader.pause();
    syncState();
  };

  const resume = async (): Promise<UploadResult> => {
    const result = await uploader.resume();
    syncState();
    return result;
  };

  const cancel = async () => {
    await uploader.cancel();
    syncState();
  };

  return {
    status: readonly(status),
    progress: readonly(progress),
    uploadedBytes: readonly(uploadedBytes),
    totalBytes: readonly(totalBytes),
    error: readonly(error),
    uploadId: readonly(uploadId),
    chunks: readonly(chunks),
    start,
    pause,
    resume,
    cancel,
  };
}

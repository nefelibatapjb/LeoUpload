import type { JSX } from 'solid-js';
import type { UploadConfig, UploadState, ChunkProgress, UploadError } from '@leoupload/core';
import { useUpload } from './useUpload';

export interface LeoUploadChildrenProps {
  status: UploadState['status'];
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  error: UploadError | null;
  uploadId: string | null;
  chunks: ChunkProgress[];
  fileName: string;
  start: (file: File) => Promise<unknown>;
  pause: () => void;
  resume: () => Promise<unknown>;
  cancel: () => Promise<void>;
  selectFile: () => void;
}

export interface LeoUploadProps {
  /** LeoUpload configuration */
  config?: Partial<UploadConfig>;
  /** Render prop — children as function with reactive getters */
  children?: (props: LeoUploadChildrenProps) => JSX.Element;
  /** Custom class name */
  className?: string;
}

/**
 * Solid component for LeoUpload.
 *
 * Supports "children as function" (render props) for full UI control,
 * and falls back to a default upload UI when no children are provided.
 *
 * @example
 * ```tsx
 * <LeoUpload config={{ server: {...} }}>
 *   {(p) => (
 *     <div>
 *       <progress value={p.progress} max={100} />
 *       <button onClick={() => p.start(file)}>Upload</button>
 *     </div>
 *   )}
 * </LeoUpload>
 * ```
 */
export function LeoUpload(props: LeoUploadProps): JSX.Element {
  const upload = useUpload(props.config ?? {});

  let fileInput: HTMLInputElement | undefined;

  const selectFile = () => {
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  };

  const handleFileChange = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) upload.start(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) upload.start(file);
  };

  // Getters keep the render-prop values reactive inside children JSX
  const childrenProps = (): LeoUploadChildrenProps => ({
    get status() {
      return upload.status();
    },
    get progress() {
      return upload.progress();
    },
    get uploadedBytes() {
      return upload.uploadedBytes();
    },
    get totalBytes() {
      return upload.totalBytes();
    },
    get error() {
      return upload.error();
    },
    get uploadId() {
      return upload.uploadId();
    },
    get chunks() {
      return upload.chunks();
    },
    get fileName() {
      return upload.fileName();
    },
    start: (file: File) => upload.start(file),
    pause: () => upload.pause(),
    resume: () => upload.resume(),
    cancel: () => upload.cancel(),
    selectFile,
  });

  const hiddenInput = (
    <input
      ref={fileInput}
      type="file"
      style={{ display: 'none' }}
      onChange={handleFileChange}
    />
  );

  if (props.children) {
    return (
      <>
        {hiddenInput}
        {props.children(childrenProps())}
      </>
    );
  }

  return (
    <div class={`leoupload ${props.className ?? ''}`}>
      {hiddenInput}
      <div
        class="leoupload__zone"
        onClick={selectFile}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <button type="button" class="leoupload__btn">
          Select File
        </button>
      </div>

      {upload.status() !== 'idle' && (
        <div class="leoupload__info">
          <progress value={upload.progress()} max={100} class="leoupload__progress" />
          <span class="leoupload__status">
            {upload.status() === 'uploading'
              ? `Uploading ${upload.progress()}%`
              : upload.fileName() || upload.status()}
          </span>
          <div class="leoupload__actions">
            {upload.status() === 'uploading' && <button onClick={() => upload.pause()}>Pause</button>}
            {upload.status() === 'paused' && <button onClick={() => upload.resume()}>Resume</button>}
            {(upload.status() === 'uploading' || upload.status() === 'paused') && (
              <button onClick={() => upload.cancel()}>Cancel</button>
            )}
          </div>
        </div>
      )}

      {upload.error() && <div class="leoupload__error">{upload.error()!.message}</div>}

      <style>{`
        .leoupload { font-family: system-ui, sans-serif; }
        .leoupload__zone {
          border: 2px dashed #ccc; border-radius: 8px; padding: 2rem;
          text-align: center; cursor: pointer; transition: border-color 0.2s;
        }
        .leoupload__zone:hover { border-color: #4a90d9; }
        .leoupload__btn {
          background: #4a90d9; color: #fff; border: none;
          padding: 0.75rem 1.5rem; border-radius: 6px; font-size: 1rem; cursor: pointer;
        }
        .leoupload__info { margin-top: 1rem; }
        .leoupload__progress { width: 100%; height: 8px; border-radius: 4px; }
        .leoupload__status { display: block; margin-top: 0.5rem; font-size: 0.875rem; color: #666; }
        .leoupload__actions { margin-top: 0.5rem; display: flex; gap: 0.5rem; }
        .leoupload__actions button {
          padding: 0.4rem 1rem; border: 1px solid #ccc; border-radius: 4px;
          background: #fff; cursor: pointer; font-size: 0.875rem;
        }
        .leoupload__error { margin-top: 0.5rem; color: #d32f2f; font-size: 0.875rem; }
      `}</style>
    </div>
  );
}

export default LeoUpload;

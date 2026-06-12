import React, { useRef, useCallback, type ReactNode } from 'react';
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
  start: (file: File) => Promise<unknown>;
  pause: () => void;
  resume: () => Promise<unknown>;
  cancel: () => Promise<void>;
  selectFile: () => void;
}

export interface LeoUploadProps {
  /** LeoUpload configuration */
  config?: Partial<UploadConfig>;
  /** Render prop — children as function */
  children?: (props: LeoUploadChildrenProps) => ReactNode;
  /** Custom class name */
  className?: string;
}

/**
 * React component for LeoUpload.
 *
 * Supports "children as function" (render props pattern) for full UI control,
 * and falls back to a default upload UI when no children are provided.
 *
 * @example
 * ```tsx
 * <LeoUpload config={{ server: {...} }}>
 *   {({ status, progress, start, pause }) => (
 *     <div>
 *       <progress value={progress} max={100} />
 *       <button onClick={() => start(file)}>Upload</button>
 *     </div>
 *   )}
 * </LeoUpload>
 * ```
 */
export function LeoUpload({ config, children, className }: LeoUploadProps): React.ReactElement {
  const {
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
  } = useUpload(config);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) start(file);
    },
    [start],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) start(file);
    },
    [start],
  );

  const statusText: Record<string, string> = {
    idle: 'Ready',
    hashing: 'Hashing file...',
    uploading: `Uploading ${progress}%`,
    paused: 'Paused',
    completed: 'Complete!',
    cancelled: 'Cancelled',
    error: 'Error',
  };

  // Render props pattern
  if (children) {
    return (
      <>
        {children({
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
          selectFile,
        })}
      </>
    );
  }

  // Default UI
  return (
    <div className={`leoupload ${className ?? ''}`}>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <div
        className="leoupload__zone"
        onClick={selectFile}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <button type="button" className="leoupload__btn">
          Select File
        </button>
      </div>
      {status !== 'idle' && (
        <div className="leoupload__info">
          <progress value={progress} max={100} className="leoupload__progress" />
          <span className="leoupload__status">{statusText[status] || status}</span>
          <div className="leoupload__actions">
            {status === 'uploading' && <button onClick={pause}>Pause</button>}
            {status === 'paused' && <button onClick={resume}>Resume</button>}
            {(status === 'uploading' || status === 'paused') && (
              <button onClick={cancel}>Cancel</button>
            )}
          </div>
        </div>
      )}
      {error && <div className="leoupload__error">{error.message}</div>}

      <style>{`
        .leoupload { font-family: system-ui, sans-serif; }
        .leoupload__zone {
          border: 2px dashed #ccc;
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.2s;
        }
        .leoupload__zone:hover { border-color: #4a90d9; }
        .leoupload__btn {
          background: #4a90d9;
          color: #fff;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
        }
        .leoupload__info { margin-top: 1rem; }
        .leoupload__progress {
          width: 100%;
          height: 8px;
          border-radius: 4px;
        }
        .leoupload__status {
          display: block;
          margin-top: 0.5rem;
          font-size: 0.875rem;
          color: #666;
        }
        .leoupload__actions {
          margin-top: 0.5rem;
          display: flex;
          gap: 0.5rem;
        }
        .leoupload__actions button {
          padding: 0.4rem 1rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          background: #fff;
          cursor: pointer;
          font-size: 0.875rem;
        }
        .leoupload__error {
          margin-top: 0.5rem;
          color: #d32f2f;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

export default LeoUpload;

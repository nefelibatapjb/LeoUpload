import React, { useState, useCallback, useMemo } from 'react';
import { LeoUpload } from '@leoupload/react';
import type { UploadConfig } from '@leoupload/core';

const STATUS_TEXT: Record<string, (progress: number) => string> = {
  idle: () => '准备就绪',
  hashing: () => '正在计算文件哈希...',
  uploading: (p) => `上传中: ${p}%`,
  paused: () => '已暂停',
  completed: () => '上传完成!',
  cancelled: () => '已取消',
  error: () => '上传出错',
};

export default function App() {
  const [chunkSizeMB, setChunkSizeMB] = useState(5);
  const [concurrency, setConcurrency] = useState(3);
  const [serverPort, setServerPort] = useState(3000);

  const uploadConfig = useMemo<Partial<UploadConfig>>(
    () => ({
      chunkSize: chunkSizeMB * 1024 * 1024,
      concurrency,
      maxRetries: 5,
      server: {
        init: `http://localhost:${serverPort}/api/upload/init`,
        chunk: `http://localhost:${serverPort}/api/upload/chunk`,
        progress: `http://localhost:${serverPort}/api/upload/progress`,
        complete: `http://localhost:${serverPort}/api/upload/complete`,
        cancel: `http://localhost:${serverPort}/api/upload`,
      },
    }),
    [chunkSizeMB, concurrency, serverPort],
  );

  const statusText = useCallback(
    (status: string, progress: number) => {
      const fn = STATUS_TEXT[status];
      return fn ? fn(progress) : status;
    },
    [],
  );

  return (
    <div className="container">
      <h1>LeoUpload React Demo</h1>
      <p className="subtitle">支持断点续传、断开重连、大文件分片上传</p>

      <LeoUpload config={uploadConfig}>
        {({ status, progress, start, pause, resume, cancel, selectFile }) => (
          <div className="upload-demo">
            <div
              className="upload-zone"
              onClick={selectFile}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) start(file);
              }}
            >
              <p>📁 点击选择文件或拖拽到此处</p>
              <p className="small-note">支持大文件，自动分片上传</p>
            </div>

            {status !== 'idle' && (
              <div className="info">
                <progress value={progress} max={100} />
                <span className="status">{statusText(status, progress)}</span>
                <div className="actions">
                  <button
                    className="btn-primary"
                    disabled={
                      status !== 'idle' && status !== 'error' && status !== 'cancelled'
                    }
                    onClick={selectFile}
                  >
                    选择文件
                  </button>
                  <button disabled={status !== 'uploading'} onClick={pause}>
                    暂停
                  </button>
                  <button disabled={status !== 'paused'} onClick={resume}>
                    恢复
                  </button>
                  <button
                    className="btn-danger"
                    disabled={status !== 'uploading' && status !== 'paused'}
                    onClick={cancel}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </LeoUpload>

      <div className="config">
        <h3>配置</h3>
        <label>
          分片大小 (MB):{' '}
          <input
            type="number"
            value={chunkSizeMB}
            min={1}
            onChange={(e) => setChunkSizeMB(Number(e.target.value))}
          />
        </label>
        <label>
          并发数:{' '}
          <input
            type="number"
            value={concurrency}
            min={1}
            max={10}
            onChange={(e) => setConcurrency(Number(e.target.value))}
          />
        </label>
        <label>
          服务器:{' '}
          <select value={serverPort} onChange={(e) => setServerPort(Number(e.target.value))}>
            <option value={3000}>Node.js (port 3000)</option>
            <option value={3001}>Go (port 3001)</option>
            <option value={3002}>Java (port 3002)</option>
          </select>
        </label>
      </div>

      <style>{`
        .container { max-width: 600px; margin: 2rem auto; padding: 1rem; font-family: system-ui, sans-serif; }
        h1 { font-size: 1.5rem; }
        .subtitle { color: #666; margin-bottom: 1.5rem; }
        .upload-zone {
          border: 2px dashed #ccc;
          border-radius: 8px;
          padding: 3rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.2s;
        }
        .upload-zone:hover { border-color: #4a90d9; }
        .small-note { font-size: 0.8rem; color: #999; }
        .info { margin-top: 1rem; }
        progress { width: 100%; height: 10px; border-radius: 5px; }
        .status { display: block; margin-top: 0.5rem; font-size: 0.9rem; color: #666; }
        .actions { margin-top: 0.75rem; display: flex; gap: 0.5rem; }
        .actions button {
          padding: 0.5rem 1.25rem;
          border: 1px solid #ccc;
          border-radius: 6px;
          background: white;
          cursor: pointer;
        }
        .actions button:hover:not(:disabled) { background: #f0f0f0; }
        .actions button:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { background: #4a90d9 !important; color: white !important; border-color: #4a90d9 !important; }
        .btn-danger { color: #d32f2f !important; border-color: #d32f2f !important; }
        .config { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; }
        .config h3 { font-size: 1rem; margin-bottom: 0.5rem; }
        .config label { display: block; margin-bottom: 0.3rem; font-size: 0.85rem; }
        .config input, .config select {
          width: 100%;
          padding: 0.4rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}

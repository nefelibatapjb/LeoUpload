import { createSignal, createMemo, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { UploadConfig, UploadState } from '@leoupload/core';
import { useUpload } from '@leoupload/solid';

const statusTextMap: Record<UploadState['status'], string> = {
  idle: '准备就绪',
  hashing: '正在计算文件哈希...',
  uploading: '上传中',
  paused: '已暂停',
  completed: '上传完成!',
  cancelled: '已取消',
  error: '上传出错',
};

const percentColor = (p: number) =>
  p >= 100 ? '#34d399' : p <= 0 ? '#9ca3af' : '#60a5fa';

function Uploader(props: { config: Partial<UploadConfig> }): JSX.Element {
  const upload = useUpload(props.config);

  let fileInput: HTMLInputElement | undefined;
  const selectFile = () => {
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  };

  const statusText = () => {
    const s = upload.status();
    const name = upload.fileName();
    const base = s === 'uploading' ? `上传中 ${upload.progress()}%` : statusTextMap[s] || s;
    return ['paused', 'completed', 'cancelled', 'error'].includes(s) && name
      ? `${base} — ${name}`
      : base;
  };

  return (
    <div class="upload-demo">
      <input
        ref={fileInput}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) void upload.start(file);
        }}
      />

      <div
        class="upload-zone"
        onClick={selectFile}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('drag-over');
        }}
        onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('drag-over');
          const file = e.dataTransfer?.files?.[0];
          if (file) void upload.start(file);
        }}
      >
        <p>📁 点击选择文件或拖拽到此处</p>
        <p style={{ 'font-size': '0.8rem', color: '#999' }}>支持大文件，自动分片上传</p>
      </div>

      <Show when={upload.status() !== 'idle'}>
        <div class="info">
          <progress value={upload.progress()} max={100} />
          <span class="status" style={{ color: percentColor(upload.progress()) }}>
            {statusText()}
          </span>
          <div class="actions">
            <button disabled={upload.status() !== 'uploading'} onClick={() => upload.pause()}>
              暂停
            </button>
            <button disabled={upload.status() !== 'paused'} onClick={() => void upload.resume()}>
              恢复
            </button>
            <button
              class="btn-danger"
              disabled={upload.status() !== 'uploading' && upload.status() !== 'paused'}
              onClick={() => void upload.cancel()}
            >
              取消
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default function App() {
  const [chunkSizeMB, setChunkSizeMB] = createSignal(5);
  const [concurrency, setConcurrency] = createSignal(3);
  const [serverPort, setServerPort] = createSignal(3000);

  const config = createMemo<Partial<UploadConfig>>(() => ({
    chunkSize: chunkSizeMB() * 1024 * 1024,
    concurrency: concurrency(),
    maxRetries: 5,
    server: {
      init: `http://localhost:${serverPort()}/api/upload/init`,
      chunk: `http://localhost:${serverPort()}/api/upload/chunk`,
      progress: `http://localhost:${serverPort()}/api/upload/progress`,
      complete: `http://localhost:${serverPort()}/api/upload/complete`,
      cancel: `http://localhost:${serverPort()}/api/upload`,
    },
  }));

  return (
    <div class="container">
      <h1>LeoUpload Solid Demo</h1>
      <p class="subtitle">支持断点续传、断开重连、大文件分片上传</p>

      <Show when={config()} keyed>
        {(cfg) => <Uploader config={cfg} />}
      </Show>

      <div class="config">
        <h3>配置</h3>
        <label>
          分片大小 (MB):{' '}
          <input
            type="number"
            min="1"
            value={chunkSizeMB()}
            onInput={(e) => setChunkSizeMB(Number(e.currentTarget.value))}
          />
        </label>
        <label>
          并发数:{' '}
          <input
            type="number"
            min="1"
            max="10"
            value={concurrency()}
            onInput={(e) => setConcurrency(Number(e.currentTarget.value))}
          />
        </label>
        <label>
          服务器:
          <select value={serverPort()} onChange={(e) => setServerPort(Number(e.currentTarget.value))}>
            <option value={3000}>Node.js (port 3000)</option>
            <option value={3001}>Go (port 3001)</option>
            <option value={3002}>Java (port 3002)</option>
            <option value={3003}>Python (port 3003)</option>
            <option value={3004}>Rust (port 3004)</option>
          </select>
        </label>
      </div>
    </div>
  );
}

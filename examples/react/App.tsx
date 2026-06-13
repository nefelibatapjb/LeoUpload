import { useState, useCallback, useMemo } from 'react';
import { LeoUpload } from '@leoupload/react';
import type { UploadConfig } from '@leoupload/core';

const ZONE_HOVER = '#4a90d9';
const ZONE_DRAG = '#34d399';

export default function App() {
  const [chunkSizeMB, setChunkSizeMB] = useState(5);
  const [concurrency, setConcurrency] = useState(3);
  const [serverPort, setServerPort] = useState(3000);
  const [zoneHover, setZoneHover] = useState(false);
  const [zoneDrag, setZoneDrag] = useState(false);

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
    (status: string, progress: number, fileName?: string): string => {
      const map: Record<string, string> = {
        idle: '准备就绪',
        hashing: '正在计算文件哈希...',
        uploading: `上传中: ${progress}%`,
        paused: fileName ? `已暂停 — ${fileName}` : '已暂停',
        completed: fileName ? `上传完成 — ${fileName}` : '上传完成!',
        cancelled: fileName ? `已取消 — ${fileName}` : '已取消',
        error: fileName ? `上传出错 — ${fileName}` : '上传出错',
      };
      return map[status] || status;
    },
    [],
  );

  const percentColor = (p: number) =>
    p >= 100 ? '#34d399' : p <= 0 ? '#9ca3af' : '#60a5fa';

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>LeoUpload React Demo</h1>
      <p style={styles.subtitle}>支持断点续传、断开重连、大文件分片上传</p>

      <LeoUpload config={uploadConfig}>
        {({ status, progress, fileName, start, pause, resume, cancel, selectFile }) => (
          <div>
            <div
              style={{
                ...styles.zone,
                ...(zoneDrag
                  ? { borderColor: ZONE_DRAG, background: '#ecfdf5' }
                  : zoneHover
                    ? { borderColor: ZONE_HOVER, background: '#eff6ff' }
                    : {}),
              }}
              onClick={selectFile}
              onMouseEnter={() => setZoneHover(true)}
              onMouseLeave={() => setZoneHover(false)}
              onDragOver={(e) => {
                e.preventDefault();
                setZoneDrag(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setZoneDrag(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setZoneDrag(false);
                const file = e.dataTransfer.files[0];
                if (file) start(file);
              }}
            >
              <p>📁 点击选择文件或拖拽到此处</p>
              <p style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>
                支持大文件，自动分片上传
              </p>
            </div>

            {status !== 'idle' && (
              <div style={styles.info}>
                <div style={styles.progressWrap}>
                  <div style={styles.progressTrack}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${progress}%`,
                        background: percentColor(progress),
                      }}
                    >
                      {progress > 0 && progress < 100 && (
                        <div style={styles.shimmer} />
                      )}
                    </div>
                  </div>
                  <span style={{ ...styles.percentText, color: percentColor(progress) }}>
                    {progress}%
                  </span>
                </div>

                <span style={styles.status}>{statusText(status, progress, fileName)}</span>

                <div style={styles.actions}>
                  <button
                    style={{
                      ...styles.btn,
                      ...styles.btnPrimary,
                      ...(status !== 'idle' && status !== 'error' && status !== 'cancelled'
                        ? styles.btnDisabled : {}),
                    }}
                    disabled={status !== 'idle' && status !== 'error' && status !== 'cancelled'}
                    onClick={selectFile}
                  >
                    选择文件
                  </button>
                  <button
                    style={{ ...styles.btn, ...(status !== 'uploading' ? styles.btnDisabled : {}) }}
                    disabled={status !== 'uploading'}
                    onClick={pause}
                  >
                    暂停
                  </button>
                  <button
                    style={{ ...styles.btn, ...(status !== 'paused' ? styles.btnDisabled : {}) }}
                    disabled={status !== 'paused'}
                    onClick={resume}
                  >
                    恢复
                  </button>
                  <button
                    style={{
                      ...styles.btn,
                      ...styles.btnDanger,
                      ...(status !== 'uploading' && status !== 'paused' ? styles.btnDisabled : {}),
                    }}
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

      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      <div style={styles.config}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>配置</h3>
        <label style={styles.label}>
          分片大小 (MB):
          <input type="number" value={chunkSizeMB} min={1} max={100}
            onChange={(e) => setChunkSizeMB(Number(e.target.value))} style={styles.input} />
        </label>
        <label style={styles.label}>
          并发数:
          <input type="number" value={concurrency} min={1} max={10}
            onChange={(e) => setConcurrency(Number(e.target.value))} style={styles.input} />
        </label>
        <label style={styles.label}>
          服务器:
          <select value={serverPort} onChange={(e) => setServerPort(Number(e.target.value))}
            style={styles.input}>
            <option value={3000}>Node.js (port 3000)</option>
            <option value={3001}>Go (port 3001)</option>
            <option value={3002}>Java (port 3002)</option>
          </select>
        </label>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 600, margin: '2rem auto', padding: '2rem', fontFamily: 'system-ui, sans-serif',
    background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  h1: { fontSize: '1.5rem', marginBottom: '0.5rem' },
  subtitle: { color: '#666', marginBottom: '1.5rem' },
  zone: {
    border: '2px dashed #ccc', borderRadius: 8, padding: '3rem 2rem',
    textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
  },
  info: { marginTop: '1rem' },
  progressWrap: { display: 'flex', alignItems: 'center', gap: 10, width: '100%' },
  progressTrack: {
    flex: 1, height: 8, background: '#e5e7eb', borderRadius: 100,
    overflow: 'hidden', position: 'relative' as const,
  },
  progressFill: {
    height: '100%', borderRadius: 100,
    transition: 'width 0.45s cubic-bezier(0.25, 0.8, 0.25, 1.2)',
    position: 'relative' as const, overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute' as const, inset: 0,
    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 40%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.35) 60%, transparent 100%)',
    animation: 'shimmer 1.8s ease-in-out infinite',
  },
  percentText: {
    minWidth: '3.2em', fontSize: '0.9rem', fontWeight: 600,
    fontVariantNumeric: 'tabular-nums' as const, transition: 'color 0.35s', userSelect: 'none' as const,
  },
  status: { display: 'block', marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' },
  actions: { marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' as const },
  btn: {
    padding: '0.5rem 1.25rem', border: '1px solid #ccc', borderRadius: 6,
    background: 'white', cursor: 'pointer', fontSize: '0.9rem',
  },
  btnPrimary: { background: '#4a90d9', color: 'white', borderColor: '#4a90d9' },
  btnDanger: { color: '#d32f2f', borderColor: '#d32f2f' },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' as const },
  config: { marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #eee' },
  label: { display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' },
  input: {
    width: '100%', padding: '0.4rem', border: '1px solid #ccc',
    borderRadius: 4, marginBottom: '0.5rem', fontSize: '0.9rem',
  },
};

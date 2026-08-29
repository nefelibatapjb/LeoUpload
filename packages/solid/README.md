# @leoupload/solid

SolidJS wrapper for [LeoUpload](https://github.com/nefelibatapjb/LeoUpload) — a signal-based primitive and a render-props component.

## Install

```bash
pnpm add @leoupload/core @leoupload/solid
```

## Usage

### Option A — `<LeoUpload>` component with render props (recommended)

```tsx
import { LeoUpload } from '@leoupload/solid';
import type { UploadConfig } from '@leoupload/core';

const config: Partial<UploadConfig> = {
  chunkSize: 5 * 1024 * 1024,
  concurrency: 3,
  server: {
    init: '/api/upload/init',
    chunk: '/api/upload/chunk',
    progress: '/api/upload/progress',
    complete: '/api/upload/complete',
    cancel: '/api/upload',
  },
};

<LeoUpload config={config}>
  {(p) => (
    <div>
      <div
        onClick={p.selectFile}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); p.start(e.dataTransfer.files[0]); }}
        style={{ border: '2px dashed #ccc', padding: '2rem', cursor: 'pointer' }}
      >
        📁 Click or drag a file here
      </div>

      {p.status !== 'idle' && (
        <div>
          <progress value={p.progress} max={100} />
          <span>{p.fileName}</span>
          {p.status === 'uploading' && <button onClick={p.pause}>Pause</button>}
          {p.status === 'paused' && <button onClick={p.resume}>Resume</button>}
          {(p.status === 'uploading' || p.status === 'paused') && (
            <button onClick={p.cancel}>Cancel</button>
          )}
        </div>
      )}
    </div>
  )}
</LeoUpload>
```

### Option B — `useUpload` primitive for full control

```tsx
import { useUpload } from '@leoupload/solid';

function Uploader() {
  const upload = useUpload({ server: { /* ... */ } });

  return (
    <div>
      <input type="file" onChange={(e) => upload.start(e.currentTarget.files[0])} />
      <progress value={upload.progress()} max={100} />
      <p>{upload.status()} — {upload.fileName()}</p>
    </div>
  );
}
```

## API

`useUpload(config)` returns signal accessors (`status`, `progress`, `uploadedBytes`, `totalBytes`, `error`, `uploadId`, `chunks`, `fileName`) plus actions (`start`, `pause`, `resume`, `cancel`).

The component's render-prop values are backed by reactive getters, so they update granularly inside children JSX. Exposed: `status`, `progress`, `uploadedBytes`, `totalBytes`, `error`, `fileName`, `start`, `pause`, `resume`, `cancel`, `selectFile`.

Requires solid-js ≥ 1.8. See [core docs](../core/README.md) for full configuration.

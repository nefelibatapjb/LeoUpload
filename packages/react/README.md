# @leoupload/react

[English](#english) | [中文](#中文)

---

## English

React wrapper for LeoUpload — hook and component.

### Quick Start

```bash
pnpm add @leoupload/core @leoupload/react
```

#### Component with Render Props (recommended)

```tsx
import { LeoUpload } from '@leoupload/react';

function App() {
  return (
    <LeoUpload config={config}>
      {({ status, progress, fileName, start, pause, resume, cancel, selectFile }) => (
        <>
          <div onClick={selectFile}>📁 Select File</div>
          <div style={{ width: `${progress}%`, height: 8, background: '#4a90d9', borderRadius: 4 }} />
          {status === 'uploading' && <button onClick={pause}>Pause</button>}
          {status === 'paused' && <button onClick={resume}>Resume</button>}
          {(status === 'uploading' || status === 'paused') && <button onClick={cancel}>Cancel</button>}
        </>
      )}
    </LeoUpload>
  );
}
```

#### Hook

```tsx
import { useUpload } from '@leoupload/react';
const { status, progress, fileName, start, pause, resume, cancel, selectFile } = useUpload(config);
```

### Documentation

Full documentation: [GitHub Repository](https://github.com/nefelibatapjb/LeoUpload)

### License

MIT

---

## 中文

LeoUpload React 封装 — Hook 和组件。

### 快速开始

```bash
pnpm add @leoupload/core @leoupload/react
```

#### 组件 Render Props（推荐）

```tsx
import { LeoUpload } from '@leoupload/react';

function App() {
  return (
    <LeoUpload config={config}>
      {({ status, progress, fileName, start, pause, resume, cancel, selectFile }) => (
        <>
          <div onClick={selectFile}>📁 选择文件</div>
          <div style={{ width: `${progress}%`, height: 8, background: '#4a90d9', borderRadius: 4 }} />
          {status === 'uploading' && <button onClick={pause}>暂停</button>}
          {status === 'paused' && <button onClick={resume}>继续</button>}
          {(status === 'uploading' || status === 'paused') && <button onClick={cancel}>取消</button>}
        </>
      )}
    </LeoUpload>
  );
}
```

#### Hook

```tsx
import { useUpload } from '@leoupload/react';
const { status, progress, fileName, start, pause, resume, cancel, selectFile } = useUpload(config);
```

### 文档

完整文档：[GitHub 仓库](https://github.com/nefelibatapjb/LeoUpload)

### 开源协议

MIT

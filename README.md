# LeoUpload 🚀

[English](#english) | [中文](#中文)

---

## English

High-performance file upload library with **breakpoint resume**, **auto-reconnect retry**, and **custom chunking** for large files. Framework-agnostic core with official Vue 3, React, Svelte, Solid, and Angular wrappers. Backend demos in Node.js, Python, Go, Java, and Rust.

### Features

- ⚡ **Chunked Upload** — custom chunk size, concurrent uploads
- 🔄 **Breakpoint Resume** — survives page reloads and network drops
- 🌐 **Network Aware** — auto-pauses on offline, auto-resumes on reconnect
- 🔁 **Auto-Retry** — exponential backoff with jitter on failures
- 🧵 **Web Workers** — parallel MD5 hashing off the main thread
- 🎯 **Framework-Agnostic** — vanilla JS core, wrappers for Vue 3 / React / Svelte / Solid / Angular
- 📦 **Tree-Shakeable** — ~12 KB gzipped core, ~2 KB wrappers
- 🖥️ **Server Demos** — Node.js, Python, Go, Java, and Rust reference implementations

### Quick Start

```bash
pnpm add @leoupload/core
```

#### Vanilla JS

```ts
import { LeoUpload } from '@leoupload/core';

const uploader = new LeoUpload({
  chunkSize: 5 * 1024 * 1024, // 5 MB
  concurrency: 3,
  server: {
    init: '/api/upload/init',
    chunk: '/api/upload/chunk',
    progress: '/api/upload/progress',
    complete: '/api/upload/complete',
    cancel: '/api/upload',
  },
});

uploader.on('progress', (e) => console.log(`${e.overallProgress}%`));
uploader.on('complete', (r) => console.log('Done:', r.fileUrl));

await uploader.start(file);
```

#### Vue 3

Two ways to use:

**Option A — `<LeoUpload>` component with scoped slots (recommended):**

```vue
<script setup>
import LeoUpload from '@leoupload/vue/LeoUpload.vue';
import ProgressBar from '@leoupload/vue/ProgressBar.vue';

const config = {
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
</script>

<template>
  <LeoUpload :config="config" v-slot="{ status, progress, fileName, start, pause, resume, cancel, selectFile }">
    <div class="drop-zone" @click="selectFile" @dragover.prevent @drop.prevent="(e) => start(e.dataTransfer.files[0])">
      <p>📁 Click or drag a file here</p>
    </div>

    <div v-if="status !== 'idle'">
      <ProgressBar :value="progress" :max="100" />
      <span>{{ fileName }}</span>
      <button v-if="status === 'uploading'" @click="pause">Pause</button>
      <button v-if="status === 'paused'" @click="resume">Resume</button>
      <button v-if="status === 'uploading' || status === 'paused'" @click="cancel">Cancel</button>
    </div>
  </LeoUpload>
</template>
```

**Option B — `useUpload` composable for full control:**

```vue
<script setup>
import { useUpload } from '@leoupload/vue';

const { status, progress, fileName, start, pause, resume, cancel, selectFile } = useUpload({
  server: { /* ... */ },
});
</script>

<template>
  <input type="file" @change="(e) => start((e.target as HTMLInputElement).files?.[0]!)" />
  <progress :value="progress" max="100" />
  <button @click="pause" v-if="status === 'uploading'">Pause</button>
  <button @click="resume" v-if="status === 'paused'">Resume</button>
</template>
```

#### React

Two ways to use:

**Option A — `<LeoUpload>` component with render props (recommended):**

```tsx
import { LeoUpload } from '@leoupload/react';
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

function App() {
  return (
    <LeoUpload config={config}>
      {({ status, progress, fileName, start, pause, resume, cancel, selectFile }) => (
        <div>
          <div
            onClick={selectFile}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); start(e.dataTransfer.files[0]); }}
            style={{ border: '2px dashed #ccc', padding: '2rem', cursor: 'pointer' }}
          >
            <p>📁 Click or drag a file here</p>
          </div>

          {status !== 'idle' && (
            <div>
              <div style={{ width: `${progress}%`, height: 8, background: '#4a90d9', borderRadius: 4 }} />
              <span>{fileName}</span>
              {status === 'uploading' && <button onClick={pause}>Pause</button>}
              {status === 'paused' && <button onClick={resume}>Resume</button>}
              {(status === 'uploading' || status === 'paused') && <button onClick={cancel}>Cancel</button>}
            </div>
          )}
        </div>
      )}
    </LeoUpload>
  );
}
```

**Option B — `useUpload` hook for full control:**

```tsx
import { useUpload } from '@leoupload/react';

function Uploader() {
  const { status, progress, fileName, start, pause, resume, cancel, selectFile } = useUpload({
    server: { /* ... */ },
  });

  return (
    <div>
      <div onClick={selectFile} onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); start(e.dataTransfer.files[0]); }}>
        Drop file here
      </div>
      <progress value={progress} max={100} />
      {status === 'uploading' && <button onClick={pause}>Pause</button>}
      {status === 'paused' && <button onClick={resume}>Resume</button>}
    </div>
  );
}
```

### Other Frameworks

Official wrappers for Svelte, Solid.js, and Angular follow the same API shape (component + composable/hook/service):

```bash
pnpm add @leoupload/svelte   # store-based composable + slot-props component
pnpm add @leoupload/solid    # signal-based primitive + render-props component
pnpm add @leoupload/angular  # signals service + <leo-upload> standalone component
```

See each package's README for full examples: [Svelte](./packages/svelte/README.md) · [Solid](./packages/solid/README.md) · [Angular](./packages/angular/README.md).

### Upload Protocol

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/upload/init` | POST | Initialize upload session |
| `/upload/chunk` | POST | Upload a single chunk (multipart) |
| `/upload/progress/:id` | GET | Query uploaded chunks |
| `/upload/complete/:id` | POST | Merge chunks, return file URL |
| `/upload/:id` | DELETE | Cancel and cleanup |

#### Request / Response Bodies

```ts
// POST /upload/init
interface InitUploadRequest {
  fileName: string;
  fileSize: number;
  fileType: string;          // MIME type
  chunkSize: number;         // bytes per chunk
  totalChunks: number;
  metadata?: Record<string, string>;
}

interface InitUploadResponse {
  uploadId: string;
  chunkSize: number;
  uploadedChunks: number[];  // already-stored chunk indexes (resume support)
  expiresAt: string;         // ISO 8601
}

// POST /upload/chunk (multipart/form-data)
//   fields: uploadId, chunkIndex, chunkHash (client MD5), totalChunks, file
interface ChunkUploadResponse {
  uploadId: string;
  chunkIndex: number;
  received: boolean;         // false (e.g. hash mismatch) → HTTP 409
  writtenBytes?: number;
  error?: string;
}

// POST /upload/complete/:id  body: { checksums?: Record<number, string> }
interface CompleteUploadResponse {
  uploadId: string;
  status: 'completed';
  fileUrl: string;
  fileSize: number;
  checksum: string;          // full-file MD5
}
```

### Events

```ts
uploader.on('progress', (e) => e.overallProgress);  // { overallProgress, uploadedBytes, totalBytes, completedChunks, totalChunks }
uploader.on('chunk:start', (e) => e.chunkIndex);    // { chunkIndex, uploadId }
uploader.on('chunk:complete', (e) => e.durationMs); // { chunkIndex, uploadId, hash, durationMs, response }
uploader.on('chunk:error', (e) => e.willRetry);     // { chunkIndex, uploadId, error, retryAttempt, willRetry }
uploader.on('chunk:retry', (e) => e.delayMs);       // { chunkIndex, attempt, delayMs, error }
uploader.on('offline', () => {});                   // network dropped — upload auto-paused
uploader.on('online', () => {});                    // network restored — upload auto-resumed
uploader.on('pause', () => {});
uploader.on('resume', () => {});
uploader.on('complete', (r) => r.fileUrl);          // UploadResult
uploader.on('error', (e) => e.code);                // UploadError (code, statusCode, retryable)
uploader.on('cancel', () => {});
```

All handlers have `uploader.off(event, handler)` / `uploader.removeAllListeners()` counterparts. `on()` returns an unsubscribe function.

### Running Demo Backends

```bash
# Node.js (port 3000)
cd demos/nodejs && pnpm dev

# Go (port 3001)
cd demos/go && go run cmd/server/main.go

# Java (port 3002)
cd demos/java && mvn spring-boot:run

# Python (port 3003)
cd demos/python && pip install -r requirements.txt && uvicorn main:app --port 3003

# Rust (port 3004)
cd demos/rust && cargo run --release
```

### Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `chunkSize` | 5 MB | Size of each upload chunk |
| `concurrency` | 3 | Max concurrent chunk uploads |
| `maxRetries` | 5 | Max retry attempts per chunk |
| `hashAlgorithm` | `'md5'` | Chunk hash algorithm |
| `useWorker` | `true` | Enable Web Worker hashing |
| `persistEnabled` | `true` | Persist state for resume |
| `autoResumeOnReconnect` | `true` | Auto-pause on offline, auto-resume on reconnect |
| `chunkTimeout` | 120s | Per-chunk upload timeout |

### Packages

| Package | Description | Size |
|---------|-------------|------|
| `@leoupload/core` | Core upload engine | ~12 KB |
| `@leoupload/vue` | Vue 3 composable + component | ~2 KB |
| `@leoupload/react` | React hook + component | ~7 KB |
| `@leoupload/svelte` | Svelte store composable + component | ~2 KB |
| `@leoupload/solid` | Solid primitives + component | ~2 KB |
| `@leoupload/angular` | Angular signals service + component | ~5 KB |

### License

MIT

---

## 中文

高性能文件上传库，支持 **断点续传**、**断开重连自动重传** 和 **大文件自定义分片上传**。核心库框架无关，同时提供 Vue 3、React、Svelte、Solid 和 Angular 官方封装，附带 Node.js / Python / Go / Java / Rust 五种后端演示。

### 功能特性

- ⚡ **自定义分片上传** — 可配置分片大小，多分片并发上传
- 🔄 **断点续传** — 页面刷新或网络中断后可恢复上传
- 🌐 **网络状态感知** — 断网自动暂停，恢复联网自动续传
- 🔁 **自动重试** — 网络异常时指数退避 + 随机抖动自动重连
- 🧵 **Web Worker 哈希** — 在主线程外并行计算 MD5，不阻塞 UI
- 🎯 **框架无关** — 原生 JS 内核，提供 Vue 3 / React / Svelte / Solid / Angular 官方封装
- 📦 **Tree-Shakeable** — 核心约 12 KB，框架封装约 2 KB (gzip)
- 🖥️ **后端演示** — Node.js、Python、Go、Java、Rust 五种参考实现

### 快速开始

```bash
pnpm add @leoupload/core
```

#### 原生 JS

```ts
import { LeoUpload } from '@leoupload/core';

const uploader = new LeoUpload({
  chunkSize: 5 * 1024 * 1024, // 5MB 每片
  concurrency: 3,
  server: {
    init: '/api/upload/init',
    chunk: '/api/upload/chunk',
    progress: '/api/upload/progress',
    complete: '/api/upload/complete',
    cancel: '/api/upload',
  },
});

uploader.on('progress', (e) => console.log(`进度: ${e.overallProgress}%`));
uploader.on('complete', (r) => console.log('上传完成:', r.fileUrl));

await uploader.start(file);
```

#### Vue 3

两种用法：

**方式 A — `<LeoUpload>` 组件 + 插槽（推荐）：**

```vue
<script setup>
import LeoUpload from '@leoupload/vue/LeoUpload.vue';
import ProgressBar from '@leoupload/vue/ProgressBar.vue';

const config = {
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
</script>

<template>
  <LeoUpload :config="config" v-slot="{ status, progress, fileName, start, pause, resume, cancel, selectFile }">
    <div class="drop-zone" @click="selectFile" @dragover.prevent @drop.prevent="(e) => start(e.dataTransfer.files[0])">
      <p>📁 点击选择文件或拖拽到此处</p>
    </div>

    <div v-if="status !== 'idle'">
      <ProgressBar :value="progress" :max="100" />
      <span>{{ fileName }}</span>
      <button v-if="status === 'uploading'" @click="pause">暂停</button>
      <button v-if="status === 'paused'" @click="resume">继续</button>
      <button v-if="status === 'uploading' || status === 'paused'" @click="cancel">取消</button>
    </div>
  </LeoUpload>
</template>
```

**方式 B — `useUpload` Composable 完全自定义：**

```vue
<script setup>
import { useUpload } from '@leoupload/vue';

const { status, progress, fileName, start, pause, resume, cancel, selectFile } = useUpload({
  server: { /* ... */ },
});
</script>

<template>
  <input type="file" @change="(e) => start((e.target as HTMLInputElement).files?.[0]!)" />
  <progress :value="progress" max="100" />
  <button @click="pause" v-if="status === 'uploading'">暂停</button>
  <button @click="resume" v-if="status === 'paused'">继续</button>
</template>
```

#### React

两种用法：

**方式 A — `<LeoUpload>` 组件 Render Props（推荐）：**

```tsx
import { LeoUpload } from '@leoupload/react';
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

function App() {
  return (
    <LeoUpload config={config}>
      {({ status, progress, fileName, start, pause, resume, cancel, selectFile }) => (
        <div>
          <div
            onClick={selectFile}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); start(e.dataTransfer.files[0]); }}
            style={{ border: '2px dashed #ccc', padding: '2rem', cursor: 'pointer' }}
          >
            <p>📁 点击选择文件或拖拽到此处</p>
          </div>

          {status !== 'idle' && (
            <div>
              <div style={{ width: `${progress}%`, height: 8, background: '#4a90d9', borderRadius: 4 }} />
              <span>{fileName}</span>
              {status === 'uploading' && <button onClick={pause}>暂停</button>}
              {status === 'paused' && <button onClick={resume}>继续</button>}
              {(status === 'uploading' || status === 'paused') && <button onClick={cancel}>取消</button>}
            </div>
          )}
        </div>
      )}
    </LeoUpload>
  );
}
```

**方式 B — `useUpload` Hook 完全自定义：**

```tsx
import { useUpload } from '@leoupload/react';

function Uploader() {
  const { status, progress, fileName, start, pause, resume, cancel, selectFile } = useUpload({
    server: { /* ... */ },
  });

  return (
    <div>
      <div onClick={selectFile} onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); start(e.dataTransfer.files[0]); }}>
        拖拽文件到此处
      </div>
      <progress value={progress} max={100} />
      {status === 'uploading' && <button onClick={pause}>暂停</button>}
      {status === 'paused' && <button onClick={resume}>继续</button>}
    </div>
  );
}
```

### 其它框架

Svelte、Solid.js 和 Angular 的官方封装与 React/Vue API 形态一致（组件 + composable/hook/service）：

```bash
pnpm add @leoupload/svelte   # store composable + 插槽组件
pnpm add @leoupload/solid    # signal primitive + render props 组件
pnpm add @leoupload/angular  # signals service + <leo-upload> standalone 组件
```

完整示例见各包 README：[Svelte](./packages/svelte/README.md) · [Solid](./packages/solid/README.md) · [Angular](./packages/angular/README.md)。

### 上传协议

| 端点 | 方法 | 说明 |
|----------|--------|-------------|
| `/upload/init` | POST | 初始化上传会话，返回 uploadId |
| `/upload/chunk` | POST | 上传单个分片 (multipart/form-data) |
| `/upload/progress/:id` | GET | 查询已上传的分片列表 |
| `/upload/complete/:id` | POST | 通知服务端合并分片 |
| `/upload/:id` | DELETE | 取消上传并清理分片 |

#### 请求 / 响应结构

```ts
// POST /upload/init
interface InitUploadRequest {
  fileName: string;
  fileSize: number;
  fileType: string;          // MIME 类型
  chunkSize: number;         // 每个分片大小（字节）
  totalChunks: number;
  metadata?: Record<string, string>;
}

interface InitUploadResponse {
  uploadId: string;
  chunkSize: number;
  uploadedChunks: number[];  // 服务端已存储的分片索引（断点续传）
  expiresAt: string;         // ISO 8601
}

// POST /upload/chunk (multipart/form-data)
//   字段: uploadId, chunkIndex, chunkHash (客户端 MD5), totalChunks, file
interface ChunkUploadResponse {
  uploadId: string;
  chunkIndex: number;
  received: boolean;         // false（如哈希不匹配）→ HTTP 409
  writtenBytes?: number;
  error?: string;
}

// POST /upload/complete/:id  body: { checksums?: Record<number, string> }
interface CompleteUploadResponse {
  uploadId: string;
  status: 'completed';
  fileUrl: string;
  fileSize: number;
  checksum: string;          // 整文件 MD5
}
```

### 事件

```ts
uploader.on('progress', (e) => e.overallProgress);  // { overallProgress, uploadedBytes, totalBytes, completedChunks, totalChunks }
uploader.on('chunk:start', (e) => e.chunkIndex);    // { chunkIndex, uploadId }
uploader.on('chunk:complete', (e) => e.durationMs); // { chunkIndex, uploadId, hash, durationMs, response }
uploader.on('chunk:error', (e) => e.willRetry);     // { chunkIndex, uploadId, error, retryAttempt, willRetry }
uploader.on('chunk:retry', (e) => e.delayMs);       // { chunkIndex, attempt, delayMs, error }
uploader.on('offline', () => {});                   // 断网 — 上传自动暂停
uploader.on('online', () => {});                    // 联网恢复 — 上传自动续传
uploader.on('pause', () => {});
uploader.on('resume', () => {});
uploader.on('complete', (r) => r.fileUrl);          // UploadResult
uploader.on('error', (e) => e.code);                // UploadError（code、statusCode、retryable）
uploader.on('cancel', () => {});
```

对应的取消监听方法：`uploader.off(event, handler)` / `uploader.removeAllListeners()`；`on()` 本身返回取消订阅函数。

### 启动后端演示

```bash
# Node.js (端口 3000)
cd demos/nodejs && pnpm dev

# Go (端口 3001)
cd demos/go && go run cmd/server/main.go

# Java (端口 3002)
cd demos/java && mvn spring-boot:run

# Python (端口 3003)
cd demos/python && pip install -r requirements.txt && uvicorn main:app --port 3003

# Rust (端口 3004)
cd demos/rust && cargo run --release
```

### 配置项

| 配置项 | 默认值 | 说明 |
|--------|---------|-------------|
| `chunkSize` | 5 MB | 每个分片的大小 |
| `concurrency` | 3 | 最大并发上传分片数 |
| `maxRetries` | 5 | 每个分片最大重试次数 |
| `hashAlgorithm` | `'md5'` | 分片哈希算法 |
| `useWorker` | `true` | 是否启用 Web Worker 哈希 |
| `persistEnabled` | `true` | 是否持久化状态以支持断点续传 |
| `autoResumeOnReconnect` | `true` | 断网自动暂停、联网自动恢复 |
| `chunkTimeout` | 120s | 单个分片上传超时时间 |

### 包列表

| 包名 | 说明 | 体积 |
|---------|-------------|------|
| `@leoupload/core` | 核心上传引擎 | ~12 KB |
| `@leoupload/vue` | Vue 3 Composable + 组件 | ~2 KB |
| `@leoupload/react` | React Hook + 组件 | ~7 KB |
| `@leoupload/svelte` | Svelte Store Composable + 组件 | ~2 KB |
| `@leoupload/solid` | Solid Primitives + 组件 | ~2 KB |
| `@leoupload/angular` | Angular Signals Service + 组件 | ~5 KB |

### 开源协议

MIT

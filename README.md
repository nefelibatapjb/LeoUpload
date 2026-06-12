# LeoUpload 🚀

[English](#english) | [中文](#中文)

---

## English

High-performance file upload library with **breakpoint resume**, **auto-reconnect retry**, and **custom chunking** for large files. Framework-agnostic core with official Vue 3 and React wrappers. Backend demos in Node.js, Go, and Java.

### Features

- ⚡ **Chunked Upload** — custom chunk size, concurrent uploads
- 🔄 **Breakpoint Resume** — survives page reloads and network drops
- 🔁 **Auto-Retry** — exponential backoff with jitter on failures
- 🧵 **Web Workers** — parallel MD5 hashing off the main thread
- 🎯 **Framework-Agnostic** — vanilla JS core, Vue 3 composable, React hook
- 📦 **Tree-Shakeable** — ~12 KB gzipped core, ~2 KB wrappers
- 🖥️ **Server Demos** — Node.js, Go, and Java reference implementations

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

```vue
<script setup>
import { useUpload } from '@leoupload/vue';

const { status, progress, start, pause, resume } = useUpload({
  server: { /* ... */ },
});
</script>

<template>
  <progress :value="progress" max="100" />
  <button @click="pause" v-if="status === 'uploading'">Pause</button>
</template>
```

#### React

```tsx
import { useUpload } from '@leoupload/react';

function Uploader() {
  const { status, progress, start, pause } = useUpload({
    server: { /* ... */ },
  });

  return (
    <div>
      <progress value={progress} max={100} />
      {status === 'uploading' && <button onClick={pause}>Pause</button>}
    </div>
  );
}
```

### Upload Protocol

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/upload/init` | POST | Initialize upload session |
| `/upload/chunk` | POST | Upload a single chunk (multipart) |
| `/upload/progress/:id` | GET | Query uploaded chunks |
| `/upload/complete/:id` | POST | Merge chunks, return file URL |
| `/upload/:id` | DELETE | Cancel and cleanup |

### Running Demo Backends

```bash
# Node.js (port 3000)
cd demos/nodejs && pnpm dev

# Go (port 3001)
cd demos/go && go run cmd/server/main.go

# Java (port 3002)
cd demos/java && mvn spring-boot:run
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
| `chunkTimeout` | 120s | Per-chunk upload timeout |

### Packages

| Package | Description | Size |
|---------|-------------|------|
| `@leoupload/core` | Core upload engine | ~12 KB |
| `@leoupload/vue` | Vue 3 composable + component | ~2 KB |
| `@leoupload/react` | React hook + component | ~7 KB |

### License

MIT

---

## 中文

高性能文件上传库，支持 **断点续传**、**断开重连自动重传** 和 **大文件自定义分片上传**。核心库框架无关，同时提供 Vue 3 和 React 官方封装，附带 Node.js / Go / Java 三种后端演示。

### 功能特性

- ⚡ **自定义分片上传** — 可配置分片大小，多分片并发上传
- 🔄 **断点续传** — 页面刷新或网络中断后可恢复上传
- 🔁 **自动重试** — 网络异常时指数退避 + 随机抖动自动重连
- 🧵 **Web Worker 哈希** — 在主线程外并行计算 MD5，不阻塞 UI
- 🎯 **框架无关** — 原生 JS 内核，提供 Vue 3 Composable 和 React Hook
- 📦 **Tree-Shakeable** — 核心约 12 KB，框架封装约 2 KB (gzip)
- 🖥️ **后端演示** — Node.js、Go、Java 三种参考实现

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

```vue
<script setup>
import { useUpload } from '@leoupload/vue';

const { status, progress, start, pause, resume } = useUpload({
  server: { /* ... */ },
});
</script>

<template>
  <progress :value="progress" max="100" />
  <button @click="pause" v-if="status === 'uploading'">暂停</button>
  <button @click="resume" v-if="status === 'paused'">继续</button>
</template>
```

#### React

```tsx
import { useUpload } from '@leoupload/react';

function Uploader() {
  const { status, progress, start, pause, resume } = useUpload({
    server: { /* ... */ },
  });

  return (
    <div>
      <progress value={progress} max={100} />
      {status === 'uploading' && <button onClick={pause}>暂停</button>}
      {status === 'paused' && <button onClick={resume}>继续</button>}
    </div>
  );
}
```

### 上传协议

| 端点 | 方法 | 说明 |
|----------|--------|-------------|
| `/upload/init` | POST | 初始化上传会话，返回 uploadId |
| `/upload/chunk` | POST | 上传单个分片 (multipart/form-data) |
| `/upload/progress/:id` | GET | 查询已上传的分片列表 |
| `/upload/complete/:id` | POST | 通知服务端合并分片 |
| `/upload/:id` | DELETE | 取消上传并清理分片 |

### 启动后端演示

```bash
# Node.js (端口 3000)
cd demos/nodejs && pnpm dev

# Go (端口 3001)
cd demos/go && go run cmd/server/main.go

# Java (端口 3002)
cd demos/java && mvn spring-boot:run
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
| `chunkTimeout` | 120s | 单个分片上传超时时间 |

### 包列表

| 包名 | 说明 | 体积 |
|---------|-------------|------|
| `@leoupload/core` | 核心上传引擎 | ~12 KB |
| `@leoupload/vue` | Vue 3 Composable + 组件 | ~2 KB |
| `@leoupload/react` | React Hook + 组件 | ~7 KB |

### 开源协议

MIT

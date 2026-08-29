# @leoupload/core

[English](#english) | [中文](#中文)

---

## English

High-performance file upload engine — breakpoint resume, auto-reconnect retry, custom chunking for large files.

### Quick Start

```bash
pnpm add @leoupload/core
```

```ts
import { LeoUpload } from '@leoupload/core';

const uploader = new LeoUpload({
  chunkSize: 5 * 1024 * 1024,
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

### Documentation

Full documentation: [GitHub Repository](https://github.com/nefelibatapjb/LeoUpload)

### License

MIT

---

## 中文

高性能文件上传引擎 — 支持断点续传、断开重连自动重传、大文件自定义分片。

### 快速开始

```bash
pnpm add @leoupload/core
```

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

### 文档

完整文档：[GitHub 仓库](https://github.com/nefelibatapjb/LeoUpload)

### 开源协议

MIT

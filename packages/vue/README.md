# @leoupload/vue

[English](#english) | [中文](#中文)

---

## English

Vue 3 wrapper for LeoUpload — composable and component.

### Quick Start

```bash
pnpm add @leoupload/core @leoupload/vue
```

#### Component with Scoped Slots (recommended)

```vue
<script setup>
import LeoUpload from '@leoupload/vue/LeoUpload.vue';
import ProgressBar from '@leoupload/vue/ProgressBar.vue';
</script>

<template>
  <LeoUpload :config="config" v-slot="{ status, progress, fileName, start, pause, resume, cancel, selectFile }">
    <div @click="selectFile">📁 Select File</div>
    <ProgressBar :value="progress" :max="100" />
    <button v-if="status === 'uploading'" @click="pause">Pause</button>
    <button v-if="status === 'paused'" @click="resume">Resume</button>
    <button v-if="status === 'uploading' || status === 'paused'" @click="cancel">Cancel</button>
  </LeoUpload>
</template>
```

#### Composable

```ts
import { useUpload } from '@leoupload/vue';
const { status, progress, fileName, start, pause, resume, cancel, selectFile } = useUpload(config);
```

### Documentation

Full documentation: [GitHub Repository](https://github.com/nefelibatapjb/LeoUpload)

### License

MIT

---

## 中文

LeoUpload Vue 3 封装 — Composable 和组件。

### 快速开始

```bash
pnpm add @leoupload/core @leoupload/vue
```

#### 组件 + 插槽（推荐）

```vue
<script setup>
import LeoUpload from '@leoupload/vue/LeoUpload.vue';
import ProgressBar from '@leoupload/vue/ProgressBar.vue';
</script>

<template>
  <LeoUpload :config="config" v-slot="{ status, progress, fileName, start, pause, resume, cancel, selectFile }">
    <div @click="selectFile">📁 选择文件</div>
    <ProgressBar :value="progress" :max="100" />
    <button v-if="status === 'uploading'" @click="pause">暂停</button>
    <button v-if="status === 'paused'" @click="resume">继续</button>
    <button v-if="status === 'uploading' || status === 'paused'" @click="cancel">取消</button>
  </LeoUpload>
</template>
```

#### Composable

```ts
import { useUpload } from '@leoupload/vue';
const { status, progress, fileName, start, pause, resume, cancel, selectFile } = useUpload(config);
```

### 文档

完整文档：[GitHub 仓库](https://github.com/nefelibatapjb/LeoUpload)

### 开源协议

MIT

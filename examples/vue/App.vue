<template>
  <div class="container">
    <h1>LeoUpload Vue 3 Demo</h1>
    <p class="subtitle">支持断点续传、断开重连、大文件分片上传</p>

    <LeoUpload :config="uploadConfig" v-slot="{ status, progress, fileName, start, pause, resume, cancel, selectFile }">
      <div class="upload-demo">
        <div
          class="upload-zone"
          :class="{ 'drag-over': dragOver }"
          @click="selectFile"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="(e) => { dragOver = false; start(e.dataTransfer.files[0]); }"
        >
          <p>📁 点击选择文件或拖拽到此处</p>
          <p style="font-size:0.8rem;color:#999">支持大文件，自动分片上传</p>
        </div>

        <div v-if="status !== 'idle'" class="info">
          <ProgressBar :value="progress" :max="100" />
          <span class="status">{{ statusText(status, progress, fileName) }}</span>
          <div class="actions">
            <button
              class="btn-primary"
              :disabled="status !== 'idle' && status !== 'error' && status !== 'cancelled'"
              @click="selectFile"
            >
              选择文件
            </button>
            <button :disabled="status !== 'uploading'" @click="pause">暂停</button>
            <button :disabled="status !== 'paused'" @click="resume">恢复</button>
            <button class="btn-danger" :disabled="status !== 'uploading' && status !== 'paused'" @click="cancel">
              取消
            </button>
          </div>
        </div>
      </div>
    </LeoUpload>

    <div class="config">
      <h3>配置</h3>
      <label>分片大小 (MB): <input v-model.number="chunkSizeMB" type="number" min="1"></label>
      <label>并发数: <input v-model.number="concurrency" type="number" min="1" max="10"></label>
      <label>服务器:
        <select v-model="serverPort">
          <option :value="3000">Node.js (port 3000)</option>
          <option :value="3001">Go (port 3001)</option>
          <option :value="3002">Java (port 3002)</option>
        </select>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import LeoUpload from '@leoupload/vue/LeoUpload.vue';
import ProgressBar from '@leoupload/vue/ProgressBar.vue';

const chunkSizeMB = ref(5);
const concurrency = ref(3);
const serverPort = ref(3000);
const dragOver = ref(false);

const uploadConfig = computed(() => ({
  chunkSize: chunkSizeMB.value * 1024 * 1024,
  concurrency: concurrency.value,
  maxRetries: 5,
  server: {
    init: `http://localhost:${serverPort.value}/api/upload/init`,
    chunk: `http://localhost:${serverPort.value}/api/upload/chunk`,
    progress: `http://localhost:${serverPort.value}/api/upload/progress`,
    complete: `http://localhost:${serverPort.value}/api/upload/complete`,
    cancel: `http://localhost:${serverPort.value}/api/upload`,
  },
}));

function statusText(status: string, progress: number, fileName?: string): string {
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
}
</script>

<style scoped>
.container { max-width: 600px; margin: 2rem auto; padding: 1rem; }
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
.upload-zone:hover { border-color: #4a90d9; background: #eff6ff; }
.upload-zone.drag-over { border-color: #34d399; background: #ecfdf5; }
.info { margin-top: 1rem; }
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
</style>

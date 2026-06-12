<template>
  <slot
    :status="status"
    :progress="progress"
    :uploaded-bytes="uploadedBytes"
    :total-bytes="totalBytes"
    :error="error"
    :upload-id="uploadId"
    :chunks="chunks"
    :start="start"
    :pause="pause"
    :resume="resume"
    :cancel="cancel"
    :select-file="selectFile"
  >
    <!-- Default UI when no slot provided -->
    <div v-if="!$slots.default" class="leoupload">
      <div class="leoupload__zone" @click="selectFile" @dragover.prevent @drop.prevent="onDrop">
        <slot name="trigger">
          <button type="button" class="leoupload__btn">Select File</button>
        </slot>
      </div>
      <div v-if="status !== 'idle'" class="leoupload__info">
        <progress :value="progress" max="100" class="leoupload__progress" />
        <span class="leoupload__status">{{ statusText }}</span>
        <div class="leoupload__actions">
          <button v-if="status === 'uploading'" @click="pause">Pause</button>
          <button v-if="status === 'paused'" @click="resume">Resume</button>
          <button v-if="status === 'uploading' || status === 'paused'" @click="cancel">Cancel</button>
        </div>
      </div>
      <div v-if="error" class="leoupload__error">{{ error.message }}</div>
    </div>
  </slot>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { UploadConfig } from '@leoupload/core';
import { useUpload } from './useUpload';

const props = withDefaults(
  defineProps<{
    config?: Partial<UploadConfig>;
  }>(),
  {},
);

const {
  status,
  progress,
  uploadedBytes,
  totalBytes,
  error,
  uploadId,
  chunks,
  start,
  pause,
  resume,
  cancel,
} = useUpload(props.config);

const fileInput = ref<HTMLInputElement | null>(null);

const statusText = computed(() => {
  const map: Record<string, string> = {
    idle: 'Ready',
    hashing: 'Hashing file...',
    uploading: `Uploading ${progress}%`,
    paused: 'Paused',
    completed: 'Complete!',
    cancelled: 'Cancelled',
    error: 'Error',
  };
  return map[status] || status;
});

function selectFile(): void {
  if (!fileInput.value) {
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    input.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) start(file);
    });
    document.body.appendChild(input);
    fileInput.value = input;
  }
  fileInput.value.click();
}

function onDrop(e: DragEvent): void {
  const file = e.dataTransfer?.files?.[0];
  if (file) start(file);
}
</script>

<style scoped>
.leoupload {
  font-family: system-ui, sans-serif;
}
.leoupload__zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
}
.leoupload__zone:hover {
  border-color: #4a90d9;
}
.leoupload__btn {
  background: #4a90d9;
  color: #fff;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
}
.leoupload__info {
  margin-top: 1rem;
}
.leoupload__progress {
  width: 100%;
  height: 8px;
  border-radius: 4px;
}
.leoupload__status {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #666;
}
.leoupload__actions {
  margin-top: 0.5rem;
  display: flex;
  gap: 0.5rem;
}
.leoupload__actions button {
  padding: 0.4rem 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 0.875rem;
}
.leoupload__error {
  margin-top: 0.5rem;
  color: #d32f2f;
  font-size: 0.875rem;
}
</style>

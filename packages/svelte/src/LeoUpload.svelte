<script lang="ts">
  import { useUpload } from './useUpload';
  import type { UploadConfig, UploadError } from '@leoupload/core';

  export let config: Partial<UploadConfig> = {};
  export let className = '';

  const { state, start, pause, resume, cancel } = useUpload(config);

  let fileInput: HTMLInputElement;

  function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) start(file);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) start(file);
  }

  function selectFile() {
    fileInput.value = '';
    fileInput.click();
  }

  $: status = $state.status;
  $: progress = $state.progress;
  $: fileName = $state.fileName;
  $: error = $state.error as UploadError | null;

  const statusText: Record<string, string> = {
    idle: 'Ready',
    hashing: 'Hashing file...',
    uploading: 'Uploading',
    paused: 'Paused',
    completed: 'Complete!',
    cancelled: 'Cancelled',
    error: 'Error',
  };
</script>

<input
  bind:this={fileInput}
  type="file"
  style="display: none"
  on:change={handleFileChange}
/>

<slot
  status={status}
  progress={progress}
  fileName={fileName}
  error={error}
  start={start}
  pause={pause}
  resume={resume}
  cancel={cancel}
  selectFile={selectFile}
>
  <div class="leoupload {className}">
    <div
      class="leoupload__zone"
      role="button"
      tabindex="0"
      on:click={selectFile}
      on:keydown={(e) => e.key === 'Enter' && selectFile()}
      on:dragover|preventDefault
      on:drop={handleDrop}
    >
      <button type="button" class="leoupload__btn">Select File</button>
    </div>

    {#if status !== 'idle'}
      <div class="leoupload__info">
        <progress value={progress} max={100} class="leoupload__progress" />
        <span class="leoupload__status">
          {statusText[status] || status}{fileName ? ` — ${fileName}` : ''}
          {status === 'uploading' ? ` ${progress}%` : ''}
        </span>
        <div class="leoupload__actions">
          {#if status === 'uploading'}
            <button on:click={pause}>Pause</button>
          {/if}
          {#if status === 'paused'}
            <button on:click={resume}>Resume</button>
          {/if}
          {#if status === 'uploading' || status === 'paused'}
            <button on:click={cancel}>Cancel</button>
          {/if}
        </div>
      </div>
    {/if}

    {#if error}
      <div class="leoupload__error">{error.message}</div>
    {/if}
  </div>
</slot>

<style>
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

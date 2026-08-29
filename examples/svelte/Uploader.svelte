<script>
  import { useUpload } from '@leoupload/svelte';

  export let config;

  const { state, start, pause, resume, cancel, } = useUpload(config);

  let dragOver = false;
  let fileInput;

  const selectFile = () => {
    fileInput.value = '';
    fileInput.click();
  };

  const handleFileChange = (e) => {
    const file = e.currentTarget.files?.[0];
    if (file) start(file);
  };

  const statusTextMap = {
    idle: '准备就绪',
    hashing: '正在计算文件哈希...',
    uploading: '上传中',
    paused: '已暂停',
    completed: '上传完成!',
    cancelled: '已取消',
    error: '上传出错',
  };

  const percentColor = (p) =>
    p >= 100 ? '#34d399' : p <= 0 ? '#9ca3af' : '#60a5fa';

  function handleDrop(e) {
    dragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) start(file);
  }
</script>

<div class="upload-demo">
  <input bind:this={fileInput} type="file" style="display: none" on:change={handleFileChange} />
  <div
    class="upload-zone"
    class:drag-over
    role="button"
    tabindex="0"
    on:click={selectFile}
    on:keydown={(e) => e.key === 'Enter' && selectFile()}
    on:dragover|preventDefault={() => (dragOver = true)}
    on:dragleave|preventDefault={() => (dragOver = false)}
    on:drop|preventDefault={handleDrop}
  >
    <p>📁 点击选择文件或拖拽到此处</p>
    <p style="font-size:0.8rem;color:#999">支持大文件，自动分片上传</p>
  </div>

  <div class="info" class:hidden={$state.status === 'idle'}>
    <progress value={$state.progress} max={100} style="color: {percentColor($state.progress)}"></progress>
    <span class="status">
      {statusTextMap[$state.status] || $state.status}
      {$state.status === 'uploading' ? ` ${$state.progress}%` : ''}
      {['paused', 'completed', 'cancelled', 'error'].includes($state.status) && $state.fileName
        ? ` — ${$state.fileName}`
        : ''}
    </span>
    <div class="actions">
      <button disabled={$state.status !== 'uploading'} on:click={pause}>暂停</button>
      <button disabled={$state.status !== 'paused'} on:click={resume}>恢复</button>
      <button
        class="btn-danger"
        disabled={$state.status !== 'uploading' && $state.status !== 'paused'}
        on:click={cancel}
      >
        取消
      </button>
    </div>
  </div>
</div>

<style>
  .upload-demo { margin-top: 1rem; }
  .upload-zone {
    border: 2px dashed #ccc;
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    cursor: pointer;
    background: #fff;
    transition: border-color 0.2s;
  }
  .upload-zone:hover { border-color: #4a90d9; }
  .upload-zone.drag-over { border-color: #4a90d9; background: #eff6ff; }
  .info { margin-top: 1rem; }
  .info.hidden { display: none; }
  progress { width: 100%; height: 8px; }
  .status {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #666;
  }
  .actions { margin-top: 0.75rem; display: flex; gap: 0.5rem; }
  .actions button {
    padding: 0.4rem 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
  }
  .actions button:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-danger { color: #dc2626; border-color: #fca5a5; }
</style>

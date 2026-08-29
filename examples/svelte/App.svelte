<script>
  import Uploader from './Uploader.svelte';

  let chunkSizeMB = 5;
  let concurrency = 3;
  let serverPort = 3000;

  const serverEndpoints = (port) => ({
    init: `http://localhost:${port}/api/upload/init`,
    chunk: `http://localhost:${port}/api/upload/chunk`,
    progress: `http://localhost:${port}/api/upload/progress`,
    complete: `http://localhost:${port}/api/upload/complete`,
    cancel: `http://localhost:${port}/api/upload`,
  });

  $: uploadConfig = {
    chunkSize: chunkSizeMB * 1024 * 1024,
    concurrency,
    maxRetries: 5,
    server: serverEndpoints(serverPort),
  };
</script>

<div class="container">
  <h1>LeoUpload Svelte Demo</h1>
  <p class="subtitle">支持断点续传、断开重连、大文件分片上传</p>

  {#key `${chunkSizeMB}-${concurrency}-${serverPort}`}
    <Uploader config={uploadConfig} />
  {/key}

  <div class="config">
    <h3>配置</h3>
    <label>分片大小 (MB): <input bind:value={chunkSizeMB} type="number" min="1" /></label>
    <label>并发数: <input bind:value={concurrency} type="number" min="1" max="10" /></label>
    <label>服务器:
      <select bind:value={serverPort}>
        <option value={3000}>Node.js (port 3000)</option>
        <option value={3001}>Go (port 3001)</option>
        <option value={3002}>Java (port 3002)</option>
        <option value={3003}>Python (port 3003)</option>
        <option value={3004}>Rust (port 3004)</option>
      </select>
    </label>
  </div>
</div>

<style>
  .container { max-width: 600px; margin: 2rem auto; padding: 1rem; }
  h1 { font-size: 1.5rem; }
  .subtitle { color: #666; margin: 0.5rem 0 1rem; }
  .config {
    margin-top: 2rem;
    padding: 1rem;
    background: #fff;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .config h3 { font-size: 1rem; }
  .config label { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  .config input, .config select { padding: 0.3rem 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
</style>

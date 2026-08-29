# @leoupload/svelte

Svelte wrapper for [LeoUpload](https://github.com/nefelibatapjb/LeoUpload) — a store-based composable and a slot-based component.

## Install

```bash
pnpm add @leoupload/core @leoupload/svelte
```

## Usage

### Option A — `<LeoUpload>` component with slot props (recommended)

```svelte
<script>
  import LeoUpload from '@leoupload/svelte/LeoUpload.svelte';

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

<LeoUpload config={config} let:status let:progress let:fileName let:start let:pause let:resume let:cancel let:selectFile>
  <div class="drop-zone" role="button" tabindex="0" on:click={selectFile}
    on:dragover|preventDefault on:drop|preventDefault={(e) => start(e.dataTransfer.files[0])}>
    📁 Click or drag a file here
  </div>

  {#if status !== 'idle'}
    <progress value={progress} max={100} />
    <span>{fileName}</span>
    {#if status === 'uploading'}<button on:click={pause}>Pause</button>{/if}
    {#if status === 'paused'}<button on:click={resume}>Resume</button>{/if}
    {#if status === 'uploading' || status === 'paused'}<button on:click={cancel}>Cancel</button>{/if}
  {/if}
</LeoUpload>
```

### Option B — `useUpload` composable for full control

```svelte
<script>
  import { useUpload } from '@leoupload/svelte';

  const { state, start, pause, resume, cancel } = useUpload({
    server: { /* ... */ },
  });
</script>

<input type="file" on:change={(e) => start(e.currentTarget.files[0])} />
<progress value={$state.progress} max={100} />
<p>{$state.status} — {$state.fileName}</p>
```

## API

`useUpload(config)` returns:

| Member | Type | Description |
|--------|------|-------------|
| `state` | Svelte store | Reactive `{ status, progress, uploadedBytes, totalBytes, error, uploadId, chunks, fileName }` |
| `start` | `(file: File) => Promise<UploadResult>` | Begin upload |
| `pause` | `() => void` | Pause (in-flight chunks finish) |
| `resume` | `() => Promise<UploadResult>` | Resume a paused upload |
| `cancel` | `() => Promise<void>` | Cancel and clean up |

The component's slot exposes: `status`, `progress`, `uploadedBytes`, `totalBytes`, `error`, `fileName`, `start`, `pause`, `resume`, `cancel`, `selectFile`.

Requires Svelte ≥ 4. See [core docs](../core/README.md) for full configuration.

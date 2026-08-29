# @leoupload/angular

Angular wrapper for [LeoUpload](https://github.com/nefelibatapjb/LeoUpload) — a signals-based service and a standalone component.

## Install

```bash
pnpm add @leoupload/core @leoupload/angular
```

Requires Angular ≥ 16 (signals).

## Usage

### Option A — `<leo-upload>` standalone component

```ts
import { Component } from '@angular/core';
import { LeoUploadComponent } from '@leoupload/angular';
import type { UploadConfig, UploadResult } from '@leoupload/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LeoUploadComponent],
  template: `
    <leo-upload [config]="config" (leoComplete)="onDone($event)">
      <!-- optional custom UI -->
      <ng-template #ui let-svc let-status="status" let-progress="progress">
        <progress [value]="svc.progress()" max="100"></progress>
        <button *ngIf="svc.status() === 'uploading'" (click)="svc.pause()">Pause</button>
        <button *ngIf="svc.status() === 'paused'" (click)="svc.resume()">Resume</button>
      </ng-template>
    </leo-upload>
  `,
})
export class AppComponent {
  config: Partial<UploadConfig> = {
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

  onDone(result: UploadResult) {
    console.log('Uploaded:', result.fileUrl);
  }
}
```

Without a `#ui` template, the component renders a default drop zone + progress UI.

### Option B — `LeoUploadService` for full control

```ts
import { Component, signal } from '@angular/core';
import { LeoUploadService } from '@leoupload/angular';

@Component({
  selector: 'app-uploader',
  standalone: true,
  template: `
    <input type="file" (change)="upload($event)" />
    <progress [value]="svc.progress()" max="100"></progress>
    <p>{{ svc.status() }} — {{ svc.fileName() }}</p>
  `,
})
export class UploaderComponent {
  svc = new LeoUploadService({ server: { /* ... */ } });

  upload(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) void this.svc.start(file);
  }
}
```

## API

`LeoUploadService` exposes signals (`status`, `progress`, `uploadedBytes`, `totalBytes`, `error`, `uploadId`, `chunks`, `fileName`) plus actions (`start`, `pause`, `resume`, `cancel`, `destroy`) and `on(event, handler)` for raw core events.

The component emits `leoComplete` / `leoError` and exposes a `#ui` template context: `$implicit` = service, plus `status`, `progress`, `fileName`, `error`, `start`, `pause`, `resume`, `cancel`, `selectFile`.

See [core docs](../core/README.md) for full configuration.

import { Component, computed, signal } from '@angular/core';
import { LeoUploadComponent } from '@leoupload/angular';
import type { UploadConfig, UploadResult } from '@leoupload/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LeoUploadComponent],
  template: `
    <div class="container">
      <h1>LeoUpload Angular Demo</h1>
      <p class="subtitle">支持断点续传、断开重连、大文件分片上传</p>

      <!-- 配置变更时通过 track 重建 leo-upload（其内部 service 只初始化一次） -->
      @for (key of [configKey()]; track key) {
        <leo-upload [config]="config()" (leoComplete)="onDone($event)">
          <ng-template #ui let-svc>
            <div class="upload-demo">
              <div
                class="upload-zone"
                (click)="svc.selectFile()"
                (dragover)="$event.preventDefault()"
                (drop)="$event.preventDefault(); onDrop($event, svc)"
              >
                <p>📁 点击选择文件或拖拽到此处</p>
                <p style="font-size:0.8rem;color:#999">支持大文件，自动分片上传</p>
              </div>

              @if (svc.status() !== 'idle') {
                <div class="info">
                  <progress [value]="svc.progress()" max="100"></progress>
                  <span class="status">{{ statusText(svc) }}</span>
                  <div class="actions">
                    <button [disabled]="svc.status() !== 'uploading'" (click)="svc.pause()">暂停</button>
                    <button [disabled]="svc.status() !== 'paused'" (click)="svc.resume()">恢复</button>
                    <button
                      class="btn-danger"
                      [disabled]="svc.status() !== 'uploading' && svc.status() !== 'paused'"
                      (click)="svc.cancel()"
                    >
                      取消
                    </button>
                  </div>
                </div>
              }
            </div>
          </ng-template>
        </leo-upload>
      }

      <div class="config">
        <h3>配置</h3>
        <label>
          分片大小 (MB):
          <input type="number" min="1" [value]="chunkSizeMB()" (input)="chunkSizeMB.set(+$any($event.target).value)" />
        </label>
        <label>
          并发数:
          <input type="number" min="1" max="10" [value]="concurrency()" (input)="concurrency.set(+$any($event.target).value)" />
        </label>
        <label>
          服务器:
          <select [value]="serverPort()" (change)="serverPort.set(+$any($event.target).value)">
            <option [value]="3000">Node.js (port 3000)</option>
            <option [value]="3001">Go (port 3001)</option>
            <option [value]="3002">Java (port 3002)</option>
            <option [value]="3003">Python (port 3003)</option>
            <option [value]="3004">Rust (port 3004)</option>
          </select>
        </label>
      </div>
    </div>
  `,
  styles: [
    `
      .container { max-width: 600px; margin: 2rem auto; padding: 1rem; }
      h1 { font-size: 1.5rem; }
      .subtitle { color: #666; margin: 0.5rem 0 1rem; }
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
      .info { margin-top: 1rem; }
      progress { width: 100%; height: 8px; }
      .status { display: block; margin-top: 0.5rem; font-size: 0.875rem; color: #666; }
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
    `,
  ],
})
export class AppComponent {
  readonly chunkSizeMB = signal(5);
  readonly concurrency = signal(3);
  readonly serverPort = signal(3000);

  readonly config = computed<Partial<UploadConfig>>(() => ({
    chunkSize: this.chunkSizeMB() * 1024 * 1024,
    concurrency: this.concurrency(),
    maxRetries: 5,
    server: {
      init: `http://localhost:${this.serverPort()}/api/upload/init`,
      chunk: `http://localhost:${this.serverPort()}/api/upload/chunk`,
      progress: `http://localhost:${this.serverPort()}/api/upload/progress`,
      complete: `http://localhost:${this.serverPort()}/api/upload/complete`,
      cancel: `http://localhost:${this.serverPort()}/api/upload`,
    },
  }));

  readonly configKey = computed(
    () => `${this.chunkSizeMB()}-${this.concurrency()}-${this.serverPort()}`,
  );

  statusText(svc: {
    status: () => string;
    progress: () => number;
    fileName: () => string;
  }): string {
    const s = svc.status();
    const map: Record<string, string> = {
      idle: '准备就绪',
      hashing: '正在计算文件哈希...',
      uploading: `上传中 ${svc.progress()}%`,
      paused: '已暂停',
      completed: '上传完成!',
      cancelled: '已取消',
      error: '上传出错',
    };
    const base = map[s] ?? s;
    return ['paused', 'completed', 'cancelled', 'error'].includes(s) && svc.fileName()
      ? `${base} — ${svc.fileName()}`
      : base;
  }

  onDrop(event: DragEvent, svc: { start: (file: File) => Promise<unknown> }): void {
    const file = event.dataTransfer?.files?.[0];
    if (file) void svc.start(file);
  }

  onDone(result: UploadResult): void {
    console.log('上传完成:', result.fileUrl);
  }
}

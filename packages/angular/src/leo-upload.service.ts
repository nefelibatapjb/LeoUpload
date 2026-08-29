import { signal } from '@angular/core';
import {
  LeoUpload,
  type UploadConfig,
  type UploadEventMap,
  type UploadState,
  type UploadResult,
  type ChunkProgress,
  type UploadError,
} from '@leoupload/core';

/**
 * Angular service wrapping the LeoUpload core with Angular signals.
 *
 * Instantiate directly with a config, or provide it via DI:
 *
 * ```ts
 * providers: [{ provide: LeoUploadService, useFactory: () => new LeoUploadService(config) }]
 * ```
 */
export class LeoUploadService {
  private uploader: LeoUpload;

  readonly status = signal<UploadState['status']>('idle');
  readonly progress = signal(0);
  readonly uploadedBytes = signal(0);
  readonly totalBytes = signal(0);
  readonly error = signal<UploadError | null>(null);
  readonly uploadId = signal<string | null>(null);
  readonly chunks = signal<ChunkProgress[]>([]);
  readonly fileName = signal('');

  constructor(config: Partial<UploadConfig> = {}) {
    this.uploader = new LeoUpload(config);

    this.uploader.on('progress', (e) => {
      if (this.status() === 'hashing') this.status.set('uploading');
      this.progress.set(e.overallProgress);
      this.uploadedBytes.set(e.uploadedBytes);
      this.totalBytes.set(e.totalBytes);
    });

    this.uploader.on('error', (e) => {
      this.error.set(e);
      this.status.set('error');
    });

    this.uploader.on('complete', () => {
      this.progress.set(100);
      this.status.set('completed');
      this.syncState();
    });

    this.uploader.on('pause', () => {
      this.status.set('paused');
      this.syncState();
    });

    this.uploader.on('resume', () => {
      this.status.set('uploading');
      this.syncState();
    });

    this.uploader.on('cancel', () => {
      this.status.set('cancelled');
      this.syncState();
    });
  }

  /** Subscribe to core events directly (e.g. for @Output re-emission). */
  on<K extends keyof UploadEventMap>(
    event: K,
    handler: (data: UploadEventMap[K]) => void,
  ): () => void {
    return this.uploader.on(event, handler);
  }

  async start(file: File): Promise<UploadResult> {
    this.fileName.set(file.name);
    this.status.set('hashing');
    this.error.set(null);
    try {
      const result = await this.uploader.start(file);
      this.syncState();
      return result;
    } catch (err) {
      this.syncState();
      throw err;
    }
  }

  pause(): void {
    this.uploader.pause();
    this.syncState();
  }

  async resume(): Promise<UploadResult> {
    const result = await this.uploader.resume();
    this.syncState();
    return result;
  }

  async cancel(): Promise<void> {
    await this.uploader.cancel();
    this.syncState();
  }

  destroy(): void {
    this.uploader.destroy();
  }

  private syncState(): void {
    const s = this.uploader.state;
    this.status.set(s.status);
    this.uploadId.set(s.uploadId);
    this.chunks.set([...s.chunkProgress]);
  }
}

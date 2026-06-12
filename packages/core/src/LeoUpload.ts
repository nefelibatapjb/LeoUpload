import {
  DEFAULT_CONFIG,
  UploadError,
  type ChunkProgress,
  type HashedChunk,
  type UploadConfig,
  type UploadEventMap,
  type UploadResult,
  type UploadState,
} from './types';
import { EventEmitter } from './events/EventEmitter';
import { ChunkManager } from './chunker/ChunkManager';
import { ProtocolClient } from './protocol/ProtocolClient';
import { UploadQueue } from './queue/UploadQueue';
import type { UploadSession } from './types';

/**
 * The main LeoUpload orchestrator.
 *
 * Composes ChunkManager, UploadQueue, RetryManager, ProtocolClient, and
 * PersistenceManager into a unified upload API with pause/resume/cancel
 * and breakpoint resume support.
 *
 * @example
 * ```ts
 * import { LeoUpload } from '@leoupload/core';
 *
 * const uploader = new LeoUpload({
 *   chunkSize: 10 * 1024 * 1024, // 10MB chunks
 *   concurrency: 5,
 *   server: {
 *     init: '/api/upload/init',
 *     chunk: '/api/upload/chunk',
 *     progress: '/api/upload/progress',
 *     complete: '/api/upload/complete',
 *     cancel: '/api/upload',
 *   },
 * });
 *
 * uploader.on('progress', (e) => {
 *   console.log(`Progress: ${e.overallProgress}%`);
 * });
 *
 * uploader.on('complete', (result) => {
 *   console.log('Upload complete:', result.fileUrl);
 * });
 *
 * // Start uploading
 * const file = document.querySelector('input[type=file]').files[0];
 * await uploader.start(file);
 * ```
 */
export class LeoUpload {
  // ---- Configuration ----
  private config: UploadConfig;

  // ---- Subsystems ----
  private events: EventEmitter<UploadEventMap>;
  private chunkManager: ChunkManager;
  private protocolClient: ProtocolClient;
  private uploadQueue: UploadQueue;

  // ---- State ----
  private state_: UploadState;
  private file: File | null = null;
  private hashedChunks: HashedChunk[] = [];
  private startTime = 0;
  private uploadedChunks = new Set<number>();

  // ---- Static defaults ----
  static defaults: Partial<UploadConfig> = {};

  constructor(config: Partial<UploadConfig> = {}, workerUrl?: string) {
    // Merge config: defaults -> static defaults -> user config
    this.config = {
      ...DEFAULT_CONFIG,
      ...LeoUpload.defaults,
      ...config,
      server: {
        ...DEFAULT_CONFIG.server,
        ...LeoUpload.defaults.server,
        ...config.server,
      },
    };

    // Initialize subsystems
    this.events = new EventEmitter<UploadEventMap>();
    this.chunkManager = new ChunkManager(this.config.useWorker, workerUrl);
    this.protocolClient = new ProtocolClient(
      this.config.server,
      this.config.headers,
      this.config.chunkTimeout,
    );
    this.uploadQueue = new UploadQueue(
      this.protocolClient,
      this.config.concurrency,
      {
        maxRetries: this.config.maxRetries,
        retryableStatuses: [408, 429, 500, 502, 503, 504],
      },
    );

    // Wire up queue events
    this.wireQueueEvents();

    // Initial state
    this.state_ = {
      status: 'idle',
      overallProgress: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      chunkProgress: [],
      uploadId: null,
      error: null,
    };
  }

  // ---- Public: State (read-only) ----

  get state(): Readonly<UploadState> {
    return this.state_;
  }

  // ---- Public: Events ----

  on<K extends keyof UploadEventMap>(
    event: K,
    handler: (data: UploadEventMap[K]) => void,
  ): () => void {
    return this.events.on(event, handler);
  }

  once<K extends keyof UploadEventMap>(
    event: K,
    handler: (data: UploadEventMap[K]) => void,
  ): () => void {
    return this.events.once(event, handler);
  }

  off<K extends keyof UploadEventMap>(
    event: K,
    handler?: (data: UploadEventMap[K]) => void,
  ): void {
    this.events.off(event, handler);
  }

  removeAllListeners(): void {
    this.events.removeAllListeners();
  }

  // ---- Public: Controls ----

  /**
   * Start uploading a file. If autoStart is true (default), hashing and
   * uploading begin immediately. Otherwise, call resume() to start.
   */
  async start(file: File): Promise<UploadResult> {
    if (this.state_.status === 'uploading') {
      throw new UploadError('Upload already in progress', 'INVALID_RESPONSE', {
        retryable: false,
      });
    }

    this.file = file;
    this.startTime = performance.now();
    this.uploadedChunks.clear();
    this.hashedChunks = [];

    this.setState({
      status: 'hashing',
      totalBytes: file.size,
      uploadedBytes: 0,
      overallProgress: 0,
      chunkProgress: [],
      uploadId: null,
      error: null,
    });

    try {
      // Phase 1: Slice and hash
      const chunks = this.chunkManager.slice(file, this.config.chunkSize);
      const totalChunks = chunks.length;

      this.hashedChunks = await this.chunkManager.hashChunks(
        chunks,
        this.config.hashAlgorithm,
        (completed, total) => {
          this.setState({
            overallProgress: Math.round((completed / total) * 10), // Hashing = 0-10%
          });
        },
      );

      // Phase 2: Initialize upload on server
      const initResponse = await this.protocolClient.initUpload({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        chunkSize: this.config.chunkSize,
        totalChunks,
        metadata: this.config.metadata,
      });

      const uploadId = initResponse.uploadId;
      const serverUploaded = new Set(initResponse.uploadedChunks);

      // Build chunk progress array
      const chunkProgress: ChunkProgress[] = this.hashedChunks.map((c) => ({
        index: c.index,
        start: c.start,
        end: c.end,
        hash: c.hash,
        status: serverUploaded.has(c.index) ? 'done' : 'pending',
        retryCount: 0,
      }));

      // Track uploaded bytes from server state
      const uploadedBytes = serverUploaded.size * this.config.chunkSize;
      this.setState({
        status: 'uploading',
        uploadId,
        uploadedBytes,
        overallProgress: Math.round(
          (serverUploaded.size / totalChunks) * 90 + 10,
        ),
        chunkProgress: [...chunkProgress],
      });

      // Mark server-uploaded chunks
      for (const idx of serverUploaded) {
        this.uploadedChunks.add(idx);
      }

      // Phase 3: Upload remaining chunks
      const pendingChunks = this.hashedChunks.filter(
        (c) => !serverUploaded.has(c.index),
      );

      if (pendingChunks.length > 0) {
        // Enqueue all pending chunks
        const uploadPromises = pendingChunks.map((chunk) =>
          this.uploadQueue.enqueue(chunk, uploadId, totalChunks),
        );

        try {
          await Promise.all(uploadPromises);
        } catch (err) {
          // Individual chunk failures are handled by UploadQueue events
          // If we get here, a chunk failed fatally
          const uploadErr = err as UploadError;
          this.setState({ status: 'error', error: uploadErr });
          this.events.emit('error', uploadErr);
          throw uploadErr;
        }
      }

      // Phase 4: Complete upload
      this.setState({ overallProgress: 95 });

      const checksums: Record<number, string> = {};
      for (const chunk of this.hashedChunks) {
        checksums[chunk.index] = chunk.hash;
      }

      const completeResponse = await this.protocolClient.completeUpload(
        uploadId,
        checksums,
      );

      const durationMs = performance.now() - this.startTime;

      const result: UploadResult = {
        uploadId,
        fileName: file.name,
        fileSize: file.size,
        fileUrl: completeResponse.fileUrl,
        totalChunks,
        durationMs,
        checksum: completeResponse.checksum,
      };

      // Phase 5: Emit feedback
      this.updateChunkProgressState(totalChunks);
      this.setState({
        status: 'completed',
        overallProgress: 100,
        chunkProgress: this.state_.chunkProgress,
      });

      this.events.emit('complete', result);
      this.persistCleanup();

      return result;
    } catch (err) {
      const uploadErr =
        err instanceof UploadError
          ? err
          : new UploadError(
              err instanceof Error ? err.message : 'Upload failed',
              'SERVER_ERROR',
              { retryable: false },
            );

      if (this.state_.status !== 'cancelled') {
        this.setState({ status: 'error', error: uploadErr });
        this.events.emit('error', uploadErr);
      }

      throw uploadErr;
    }
  }

  /**
   * Pause the upload. In-flight chunks finish, but new ones are not started.
   */
  pause(): void {
    if (this.state_.status !== 'uploading') return;

    this.uploadQueue.pause();
    this.setState({ status: 'paused' });
    this.events.emit('pause', undefined);
    this.persistState();
  }

  /**
   * Resume a paused upload.
   */
  async resume(): Promise<UploadResult> {
    if (this.state_.status !== 'paused') {
      throw new UploadError('Upload is not paused', 'INVALID_RESPONSE', {
        retryable: false,
      });
    }

    if (!this.file) {
      throw new UploadError('No file to resume', 'FILE_NOT_FOUND', {
        retryable: false,
      });
    }

    this.setState({ status: 'uploading' });
    this.events.emit('resume', undefined);
    this.uploadQueue.resume();

    // Wait for remaining chunks — the queue processes them
    return this.waitForUploadCompletion();
  }

  /**
   * Cancel the upload and clean up.
   */
  async cancel(): Promise<void> {
    if (this.state_.status === 'idle' || this.state_.status === 'completed') {
      return;
    }

    this.setState({ status: 'cancelled' });
    this.uploadQueue.cancel();
    this.events.emit('cancel', undefined);

    // Notify server to clean up
    if (this.state_.uploadId) {
      try {
        await this.protocolClient.cancelUpload(this.state_.uploadId);
      } catch {
        // Best effort — server cleanup is non-critical
      }
    }

    this.persistCleanup();
  }

  /**
   * Release all resources. No further operations are allowed.
   */
  destroy(): void {
    if (this.state_.status === 'uploading' || this.state_.status === 'paused') {
      this.pause();
      this.persistState();
    }

    this.chunkManager.dispose();
    this.events.removeAllListeners();
  }

  // ---- Static Utility Methods ----

  /**
   * Get all pending (unfinished) upload sessions from localStorage.
   */
  static getPendingUploads(): UploadSession[] {
    try {
      const raw = localStorage.getItem('leoupload:sessions');
      if (!raw) return [];
      return JSON.parse(raw) as UploadSession[];
    } catch {
      return [];
    }
  }

  /**
   * Clean up storage (IndexedDB + localStorage) for expired uploads.
   */
  static async cleanupStorage(maxAgeDays = 7): Promise<void> {
    try {
      const sessions = LeoUpload.getPendingUploads();
      const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
      const expired = sessions.filter((s) => s.timestamp < cutoff);

      for (const session of expired) {
        await LeoUpload.cleanupSession(session.uploadId);
      }
    } catch {
      // Non-critical — log but don't throw
      console.warn('[LeoUpload] Storage cleanup failed');
    }
  }

  // ---- Private ----

  private setState(partial: Partial<UploadState>): void {
    this.state_ = { ...this.state_, ...partial };
    // Emit progress when it changes
    if (
      partial.overallProgress !== undefined &&
      this.state_.status === 'uploading'
    ) {
      this.events.emit('progress', {
        overallProgress: this.state_.overallProgress,
        uploadedBytes: this.state_.uploadedBytes,
        totalBytes: this.state_.totalBytes,
        completedChunks: this.uploadedChunks.size,
        totalChunks: this.hashedChunks.length,
      });
    }
  }

  private wireQueueEvents(): void {
    this.uploadQueue.setOnChunkComplete((chunkIndex, response, durationMs) => {
      this.uploadedChunks.add(chunkIndex);

      const chunk = this.hashedChunks[chunkIndex];
      const totalChunks = this.hashedChunks.length;

      // Update state
      const uploadedBytes = this.uploadedChunks.size * this.config.chunkSize;
      const overallProgress = Math.round(
        (this.uploadedChunks.size / totalChunks) * 90 + 10,
      );

      this.updateChunkProgressState(totalChunks);
      this.setState({
        overallProgress,
        uploadedBytes: Math.min(uploadedBytes, this.state_.totalBytes),
        chunkProgress: [...this.state_.chunkProgress],
      });

      // Emit events
      this.events.emit('chunk:complete', {
        chunkIndex,
        uploadId: this.state_.uploadId!,
        hash: chunk?.hash ?? '',
        durationMs,
        response,
      });

      // Persist progress
      if (this.config.persistEnabled) {
        this.persistState();
      }
    });

    this.uploadQueue.setOnChunkError((chunkIndex, error, willRetry) => {
      this.updateChunkProgressState(this.hashedChunks.length);
      this.setState({ chunkProgress: [...this.state_.chunkProgress] });

      this.events.emit('chunk:error', {
        chunkIndex,
        uploadId: this.state_.uploadId!,
        error,
        retryAttempt: error.chunkIndex !== undefined ? 0 : 0,
        willRetry,
      });
    });

    this.uploadQueue.setOnChunkRetry((chunkIndex, attempt, delayMs) => {
      this.events.emit('chunk:retry', {
        chunkIndex,
        attempt,
        delayMs,
        error: new UploadError('Retrying chunk', 'NETWORK_ERROR', {
          chunkIndex,
          retryable: true,
        }),
      });
    });
  }

  private updateChunkProgressState(totalChunks: number): void {
    const progress: ChunkProgress[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const hash = this.hashedChunks[i]?.hash ?? '';
      progress.push({
        index: i,
        start: i * this.config.chunkSize,
        end: Math.min((i + 1) * this.config.chunkSize, this.file?.size ?? 0),
        hash,
        status: this.uploadedChunks.has(i) ? 'done' : 'pending',
        retryCount: 0,
      });
    }
    this.state_.chunkProgress = progress;
  }

  private async waitForUploadCompletion(): Promise<UploadResult> {
    // This is a simplified wait — in practice we'd track the queue state
    // For now, return a constructed result when the queue becomes idle
    return new Promise<UploadResult>((resolve, reject) => {
      const check = () => {
        if (this.state_.status === 'completed') {
          resolve({
            uploadId: this.state_.uploadId!,
            fileName: this.file!.name,
            fileSize: this.file!.size,
            fileUrl: '',
            totalChunks: this.hashedChunks.length,
            durationMs: performance.now() - this.startTime,
            checksum: '',
          });
        } else if (
          this.state_.status === 'error' ||
          this.state_.status === 'cancelled'
        ) {
          reject(this.state_.error ?? new Error('Upload failed'));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  // ---- Persistence Stubs (full implementation in Phase 3) ----

  private persistState(): void {
    if (!this.config.persistEnabled || !this.state_.uploadId || !this.file) return;

    try {
      const sessions = LeoUpload.getPendingUploads();
      const existing = sessions.findIndex(
        (s) => s.uploadId === this.state_.uploadId,
      );

      const session: UploadSession = {
        uploadId: this.state_.uploadId,
        fileName: this.file.name,
        fileSize: this.file.size,
        fileType: this.file.type,
        totalChunks: this.hashedChunks.length,
        chunkSize: this.config.chunkSize,
        completedChunks: [...this.uploadedChunks],
        status: this.state_.status,
        timestamp: Date.now(),
        serverInitUrl: this.config.server.init,
      };

      if (existing >= 0) {
        sessions[existing] = session;
      } else {
        sessions.push(session);
      }

      localStorage.setItem('leoupload:sessions', JSON.stringify(sessions));
    } catch {
      // localStorage may be full or unavailable — non-critical
    }
  }

  private persistCleanup(): void {
    if (!this.state_.uploadId) return;

    try {
      const sessions = LeoUpload.getPendingUploads();
      const filtered = sessions.filter(
        (s) => s.uploadId !== this.state_.uploadId,
      );
      localStorage.setItem('leoupload:sessions', JSON.stringify(filtered));
    } catch {
      // Best effort
    }
  }

  private static async cleanupSession(uploadId: string): Promise<void> {
    try {
      const sessions = LeoUpload.getPendingUploads();
      const filtered = sessions.filter((s) => s.uploadId !== uploadId);
      localStorage.setItem('leoupload:sessions', JSON.stringify(filtered));
    } catch {
      // Best effort
    }
  }
}

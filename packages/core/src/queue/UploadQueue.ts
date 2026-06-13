import { defer, type Deferred } from '../utils/defer';
import { RetryManager, type RetryConfig } from '../retry/RetryManager';
import { ProtocolClient } from '../protocol/ProtocolClient';
import { UploadError } from '../types';
import type { HashedChunk, ChunkUploadResponse } from '../types';
import type { UploadError as UploadErrorType } from '../types';

export interface QueueTask {
  chunk: HashedChunk;
  uploadId: string;
  totalChunks: number;
  deferred: Deferred<ChunkUploadResponse>;
}

export type QueueStatus = 'idle' | 'running' | 'paused' | 'cancelled';

/**
 * A FIFO upload queue with semaphore-based concurrency control.
 *
 * Custom implementation (~60 lines) instead of a p-queue dependency:
 * - Zero external dependencies
 * - Tighter integration with RetryManager
 * - Minimal bundle cost
 */
export class UploadQueue {
  private queue: QueueTask[] = [];
  private inFlight = new Set<QueueTask>();
  private status: QueueStatus = 'idle';
  private concurrency: number;
  private client: ProtocolClient;
  private retryManager: RetryManager;
  private abortController: AbortController | null = null;

  // Callbacks
  private onChunkComplete?: (chunkIndex: number, response: ChunkUploadResponse, durationMs: number) => void;
  private onChunkError?: (chunkIndex: number, error: UploadErrorType, willRetry: boolean) => void;
  private onChunkRetry?: (chunkIndex: number, attempt: number, delayMs: number) => void;

  constructor(
    client: ProtocolClient,
    concurrency: number,
    retryConfig: Partial<RetryConfig> = {},
  ) {
    this.client = client;
    this.concurrency = concurrency;
    this.retryManager = new RetryManager(retryConfig);
  }

  // ---- Event Callbacks ----

  setOnChunkComplete(
    fn: (chunkIndex: number, response: ChunkUploadResponse, durationMs: number) => void,
  ): void {
    this.onChunkComplete = fn;
  }

  setOnChunkError(fn: (chunkIndex: number, error: UploadErrorType, willRetry: boolean) => void): void {
    this.onChunkError = fn;
  }

  setOnChunkRetry(fn: (chunkIndex: number, attempt: number, delayMs: number) => void): void {
    this.onChunkRetry = fn;
  }

  // ---- Queue Operations ----

  /**
   * Enqueue a chunk for upload. Returns a promise that resolves when the chunk
   * is successfully uploaded, or rejects if it fails after all retries.
   */
  enqueue(chunk: HashedChunk, uploadId: string, totalChunks: number): Promise<ChunkUploadResponse> {
    const deferred = defer<ChunkUploadResponse>();

    this.queue.push({
      chunk: { ...chunk, retryCount: 0 },
      uploadId,
      totalChunks,
      deferred,
    });

    // Kick off processing if idle
    if (this.status === 'idle') {
      this.status = 'running';
      this.abortController = new AbortController();
      this.processQueue();
    }

    // If already running with free slots, process
    if (this.status === 'running' && this.inFlight.size < this.concurrency) {
      this.processQueue();
    }

    return deferred.promise;
  }

  /**
   * Reset the queue to idle state for a fresh upload.
   */
  reset(): void {
    this.queue = [];
    this.inFlight.clear();
    this.status = 'idle';
    this.abortController = null;
  }

  /**
   * Pause the queue. In-flight chunks complete, pending chunks are held.
   */
  pause(): void {
    if (this.status !== 'running') return;
    this.status = 'paused';
  }

  /**
   * Resume a paused queue.
   */
  resume(): void {
    if (this.status !== 'paused') return;
    this.status = 'running';
    this.abortController = new AbortController();
    this.processQueue();
  }

  /**
   * Cancel all pending and in-flight work. Rejects all pending promises.
   */
  cancel(): void {
    this.status = 'cancelled';
    this.abortController?.abort();

    const cancelError = new UploadError('Upload cancelled', 'CANCELLED', { retryable: false });

    // Reject all pending tasks
    for (const task of this.queue) {
      task.deferred.reject(cancelError);
    }
    this.queue = [];

    // Reject in-flight tasks
    for (const task of this.inFlight) {
      task.deferred.reject(cancelError);
    }
    this.inFlight.clear();
  }

  /**
   * Dynamically change concurrency.
   */
  setConcurrency(n: number): void {
    this.concurrency = Math.max(1, n);
    if (this.status === 'running') {
      this.processQueue();
    }
  }

  // ---- Counts ----

  get pendingCount(): number {
    return this.queue.length;
  }

  get inFlightCount(): number {
    return this.inFlight.size;
  }

  get currentStatus(): QueueStatus {
    return this.status;
  }

  // ---- Private ----

  private async processQueue(): Promise<void> {
    while (
      this.status === 'running' &&
      this.inFlight.size < this.concurrency &&
      this.queue.length > 0
    ) {
      const task = this.queue.shift()!;
      this.inFlight.add(task);
      // Fire and forget — each task manages its own lifecycle
      this.processTask(task).finally(() => {
        this.inFlight.delete(task);
        // Process next if slots are free
        if (this.status === 'running') {
          this.processQueue();
        }
      });
    }

    // Check if everything is done
    if (
      this.queue.length === 0 &&
      this.inFlight.size === 0 &&
      this.status === 'running'
    ) {
      this.status = 'idle';
    }
  }

  private async processTask(task: QueueTask): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const startTime = performance.now();
        const signal = this.abortController?.signal;

        const response = await this.client.uploadChunk(
          task.uploadId,
          task.chunk.index,
          task.chunk.hash,
          task.totalChunks,
          task.chunk.blob,
          signal,
        );

        const durationMs = performance.now() - startTime;
        this.retryManager.resetChunk(task.chunk.index);
        this.onChunkComplete?.(task.chunk.index, response, durationMs);
        task.deferred.resolve(response);
        return;
      } catch (err) {
        const uploadError = err as UploadErrorType;
        const decision = this.retryManager.shouldRetry(uploadError, task.chunk.index);

        this.onChunkError?.(task.chunk.index, uploadError, decision.retry);

        if (!decision.retry) {
          task.deferred.reject(uploadError);
          return;
        }

        // Notify retry
        const attempt = this.retryManager.getAttempt(task.chunk.index);
        this.onChunkRetry?.(task.chunk.index, attempt, decision.delayMs);

        // Wait before retrying
        if (decision.delayMs > 0) {
          await sleep(decision.delayMs);
        }
        // Loop back to retry
      }
    }
  }
}

// ---- Helpers ----

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

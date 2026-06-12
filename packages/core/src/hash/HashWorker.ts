import type { Chunk, HashedChunk } from '../types';

/**
 * Manages Web Worker instantiation and the message bus for hashing chunks.
 *
 * Strategy:
 * - If a workerUrl is provided (or auto-resolved), spawn a Worker per batch.
 * - ChunkManager partitions across multiple Workers for parallelism.
 * - If Worker is unavailable (SSR, config disabled, old browsers), hashes on
 *   the main thread with idle yield to avoid blocking the UI.
 */
export class HashWorker {
  private workerUrl: string | null = null;
  private enabled: boolean;

  constructor(useWorker: boolean, workerUrl?: string) {
    this.enabled = useWorker && typeof Worker !== 'undefined';
    if (workerUrl) {
      this.workerUrl = workerUrl;
    }
  }

  /**
   * Set a custom Worker script URL.
   * Use this with: import workerUrl from '@leoupload/core/worker';
   */
  setWorkerUrl(url: string): void {
    this.workerUrl = url;
  }

  /**
   * Whether Worker-based hashing is available.
   */
  get isWorkerAvailable(): boolean {
    return this.enabled && this.workerUrl !== null;
  }

  /**
   * Hash a batch of chunks. Callers partition chunks across multiple
   * HashWorker instances for parallel processing.
   */
  async hashChunks(
    chunks: Chunk[],
    _algorithm: 'md5' | 'sha256' = 'md5',
    onProgress?: (completed: number, total: number) => void,
  ): Promise<HashedChunk[]> {
    if (chunks.length === 0) return [];

    if (this.isWorkerAvailable) {
      return this.hashWithWorker(chunks, onProgress);
    }
    return this.hashOnMainThread(chunks, onProgress);
  }

  /**
   * Release worker resources.
   */
  dispose(): void {
    // Workers are one-shot per batch; no persistent worker to clean up.
    // Each hashWithWorker call creates and terminates its own worker.
  }

  // ---- Private: Worker Path ----

  private async hashWithWorker(
    chunks: Chunk[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<HashedChunk[]> {
    // Read all chunk buffers on main thread first
    const buffers: ArrayBuffer[] = await Promise.all(
      chunks.map((c) => c.blob.arrayBuffer()),
    );

    const worker = new Worker(this.workerUrl!);

    try {
      const result = await new Promise<HashedChunk[]>((resolve, reject) => {
        const onMessage = (e: MessageEvent) => {
          const { type } = e.data;
          if (type === 'HASH_PROGRESS') {
            onProgress?.(e.data.completed, e.data.total);
            return;
          }
          if (type === 'HASH_RESULT') {
            cleanup();
            const resultMap = new Map(
              (e.data.results as Array<{ index: number; hash: string }>).map((r) => [
                r.index,
                r.hash,
              ]),
            );
            const hashed: HashedChunk[] = chunks.map((c) => ({
              ...c,
              hash: resultMap.get(c.index) ?? '',
              retryCount: 0,
            }));
            resolve(hashed);
          }
        };

        const onError = (err: ErrorEvent) => {
          cleanup();
          reject(new Error(`[LeoUpload] Worker error: ${err.message}`));
        };

        const cleanup = () => {
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
        };

        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);

        worker.postMessage({
          type: 'HASH_CHUNKS',
          chunks: chunks.map((c, i) => ({
            index: c.index,
            buffer: buffers[i],
          })),
          algorithm: 'md5',
        });
      });

      return result;
    } finally {
      worker.terminate();
    }
  }

  // ---- Private: Main Thread Fallback ----

  private async hashOnMainThread(
    chunks: Chunk[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<HashedChunk[]> {
    const SparkMD5 = await import('spark-md5');
    const Spark = SparkMD5.default;

    const results: HashedChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      // Yield to the event loop every 3 chunks to avoid blocking UI
      if (i % 3 === 0 && i > 0) {
        await new Promise<void>((resolve) => {
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => resolve());
          } else {
            setTimeout(resolve, 0);
          }
        });
      }

      const chunk = chunks[i]!;
      const buffer = await chunk.blob.arrayBuffer();
      const spark = new Spark.ArrayBuffer();
      spark.append(buffer);
      const hash = spark.end() as string;

      results.push({ ...chunk, hash, retryCount: 0 });
      onProgress?.(i + 1, chunks.length);
    }

    return results;
  }
}

import { sliceFile } from '../utils/blob';
import { HashWorker } from '../hash/HashWorker';
import type { Chunk, HashedChunk, HashAlgorithm } from '../types';

/**
 * Manages file slicing and chunk hash computation.
 *
 * For parallel hashing, the chunks are partitioned across multiple HashWorker
 * instances, each running in its own Web Worker. The number of workers is:
 *   Math.min(chunkCount, navigator.hardwareConcurrency || 4)
 */
export class ChunkManager {
  private hashWorkers: HashWorker[] = [];
  private useWorker: boolean;

  constructor(useWorker: boolean, workerUrl?: string) {
    this.useWorker = useWorker;
    // Pre-create worker wrappers — actual Workers are spawned lazily per batch
    const workerCount = this.availableWorkerCount();
    for (let i = 0; i < workerCount; i++) {
      this.hashWorkers.push(new HashWorker(useWorker, workerUrl));
    }
  }

  /**
   * Slice a file into chunks of the given size.
   * This is synchronous and cheap — File.slice() returns Blob references.
   */
  slice(file: File, chunkSize: number): Chunk[] {
    return sliceFile(file, chunkSize);
  }

  /**
   * Hash all chunks, distributing work across available Workers.
   * Reports progress via the onProgress callback.
   */
  async hashChunks(
    chunks: Chunk[],
    algorithm: HashAlgorithm = 'md5',
    onProgress?: (completed: number, total: number) => void,
  ): Promise<HashedChunk[]> {
    if (chunks.length === 0) return [];

    const totalChunks = chunks.length;

    // Split chunks into batches for parallel workers
    const workerCount = Math.min(this.hashWorkers.length, totalChunks);
    const batchSize = Math.ceil(totalChunks / workerCount);
    const batches: Chunk[][] = [];

    for (let i = 0; i < workerCount; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, totalChunks);
      batches.push(chunks.slice(start, end));
    }

    // Track overall progress across all batches
    let completedCount = 0;
    const batchResults: HashedChunk[][] = [];

    const batchPromises = batches.map((batch, i) => {
      const worker = this.hashWorkers[i]!;
      return worker.hashChunks(batch, algorithm, (_completed) => {
        // Per-worker progress — aggregate
        completedCount += 1; // one more chunk done in this batch
        // This is approximate; we use total count from the batch completion
        onProgress?.(
          batchResults.flat().length + completedCount - (batchResults[i]?.length ?? 0),
          totalChunks,
        );
      });
    });

    // Wait for all batches
    const results = await Promise.all(batchPromises);
    for (const r of results) {
      batchResults.push(r);
    }

    // Flatten and sort by chunk index
    const allHashed = batchResults.flat().sort((a, b) => a.index - b.index);
    onProgress?.(allHashed.length, totalChunks);

    return allHashed;
  }

  /**
   * Release all worker resources.
   */
  dispose(): void {
    for (const worker of this.hashWorkers) {
      worker.dispose();
    }
    this.hashWorkers = [];
  }

  // ---- Private ----

  private availableWorkerCount(): number {
    if (!this.useWorker) return 1; // Single "worker" on main thread

    const cpuCores =
      (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;

    // Cap at 4 workers — diminishing returns beyond that for hashing
    return Math.max(1, Math.min(cpuCores, 4));
  }
}

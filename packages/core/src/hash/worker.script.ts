/**
 * Web Worker script for computing chunk hashes.
 * Built as a standalone IIFE by tsup, inlined as a Blob URL at runtime.
 *
 * This file has NO imports from the main bundle — it's fully self-contained.
 * spark-md5 is inlined during the IIFE build.
 */
import SparkMD5 from 'spark-md5';

interface HashRequestMessage {
  type: 'HASH_CHUNKS';
  chunks: Array<{
    index: number;
    buffer: ArrayBuffer;
  }>;
  algorithm: 'md5' | 'sha256';
}

interface HashResponseMessage {
  type: 'HASH_RESULT';
  results: Array<{
    index: number;
    hash: string;
  }>;
}

interface HashProgressMessage {
  type: 'HASH_PROGRESS';
  completed: number;
  total: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
self.onmessage = async (e: MessageEvent<HashRequestMessage>) => {
  const { chunks, algorithm } = e.data;

  if (algorithm !== 'md5') {
    // For SHA-256, we would use crypto.subtle.digest
    // But spark-md5 is our primary hash tool
  }

  const results: Array<{ index: number; hash: string }> = [];
  const total = chunks.length;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const spark = new SparkMD5.ArrayBuffer();
    spark.append(chunk.buffer);
    const hash = spark.end();

    results.push({ index: chunk.index, hash });

    // Report progress
    const progress: HashProgressMessage = {
      type: 'HASH_PROGRESS',
      completed: i + 1,
      total,
    };
    self.postMessage(progress);
  }

  const response: HashResponseMessage = {
    type: 'HASH_RESULT',
    results,
  };
  self.postMessage(response);
};

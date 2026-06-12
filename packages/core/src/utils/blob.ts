import type { Chunk } from '../types';

/**
 * Slice a File into chunks using File.slice() (O(1) memory — returns Blob references).
 */
export function sliceFile(file: File, chunkSize: number): Chunk[] {
  const chunks: Chunk[] = [];
  const totalChunks = Math.ceil(file.size / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    chunks.push({
      index: i,
      blob: file.slice(start, end),
      start,
      end,
    });
  }

  return chunks;
}

/**
 * Compute a fingerprint from file metadata for session deduplication.
 * This is a lightweight client-side fingerprint; server should compute its own.
 */
export function fileFingerprint(fileName: string, fileSize: number, lastModified: number): string {
  return `${fileName}|${fileSize}|${lastModified}`;
}

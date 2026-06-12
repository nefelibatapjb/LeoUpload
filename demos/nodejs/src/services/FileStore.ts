import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createWriteStream } from 'node:fs';

/**
 * Filesystem abstraction for chunk storage and merge.
 */
export class FileStore {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async createUploadDir(uploadId: string): Promise<void> {
    const dir = this.uploadDir(uploadId);
    await fs.mkdir(dir, { recursive: true });
  }

  async writeChunk(uploadId: string, chunkIndex: number, buffer: Buffer): Promise<void> {
    const chunkPath = this.chunkPath(uploadId, chunkIndex);
    await fs.writeFile(chunkPath, new Uint8Array(buffer));
  }

  async getUploadedChunks(uploadId: string): Promise<number[]> {
    const dir = this.uploadDir(uploadId);
    try {
      const files = await fs.readdir(dir);
      const chunks = files
        .filter((f) => f.startsWith('chunk_'))
        .map((f) => {
          const idx = f.replace('chunk_', '').replace('.part', '');
          return Number(idx);
        })
        .filter((n) => !isNaN(n));
      return chunks.sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  async getChunkPath(uploadId: string, chunkIndex: number): Promise<string> {
    return this.chunkPath(uploadId, chunkIndex);
  }

  async mergeChunks(uploadId: string, totalChunks: number, outputPath: string): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const writeStream = createWriteStream(outputPath);

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = this.chunkPath(uploadId, i);
      const buffer = await fs.readFile(chunkPath);
      writeStream.write(buffer);
    }

    return new Promise((resolve, reject) => {
      writeStream.end((err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async saveMeta(uploadId: string, meta: unknown): Promise<void> {
    const metaPath = path.join(this.uploadDir(uploadId), 'meta.json');
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
  }

  async cleanup(uploadId: string): Promise<void> {
    const dir = this.uploadDir(uploadId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Already cleaned up or never existed
    }
  }

  private uploadDir(uploadId: string): string {
    return path.join(this.baseDir, uploadId);
  }

  private chunkPath(uploadId: string, chunkIndex: number): string {
    return path.join(this.uploadDir(uploadId), `chunk_${chunkIndex}.part`);
  }
}

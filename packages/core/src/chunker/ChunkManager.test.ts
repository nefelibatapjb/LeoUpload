import { describe, it, expect } from 'vitest';
import { ChunkManager } from './ChunkManager';

const MB = 1024 * 1024;

function makeFile(size: number, fill = 0): File {
  return new File([new Uint8Array(size).fill(fill)], 'test.bin', {
    type: 'application/octet-stream',
  });
}

describe('ChunkManager.slice', () => {
  it('splits a file into correct chunk boundaries', () => {
    const cm = new ChunkManager(false);
    const chunks = cm.slice(makeFile(10 * MB), 4 * MB);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({ index: 0, start: 0, end: 4 * MB });
    expect(chunks[1]).toMatchObject({ index: 1, start: 4 * MB, end: 8 * MB });
    expect(chunks[2]).toMatchObject({ index: 2, start: 8 * MB, end: 10 * MB });
  });

  it('returns a single chunk when file is smaller than chunkSize', () => {
    const cm = new ChunkManager(false);
    const chunks = cm.slice(makeFile(1024), 4 * MB);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ index: 0, start: 0, end: 1024 });
  });

  it('slices exactly on the boundary for evenly divisible files', () => {
    const cm = new ChunkManager(false);
    const chunks = cm.slice(makeFile(8 * MB), 4 * MB);

    expect(chunks).toHaveLength(2);
    expect(chunks[1]!.end).toBe(8 * MB);
  });
});

describe('ChunkManager.hashChunks (main thread)', () => {
  it('returns one hashed chunk per input, sorted by index', async () => {
    const cm = new ChunkManager(false);
    const chunks = cm.slice(makeFile(10 * MB), 4 * MB);
    const hashed = await cm.hashChunks(chunks);

    expect(hashed).toHaveLength(3);
    expect(hashed.map((c) => c.index)).toEqual([0, 1, 2]);
    for (const c of hashed) {
      expect(c.hash).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it('produces identical hashes for identical content and different hashes across chunks', async () => {
    const cm = new ChunkManager(false);
    const a = await cm.hashChunks(cm.slice(makeFile(8 * MB, 1), 4 * MB));
    const b = await cm.hashChunks(cm.slice(makeFile(8 * MB, 1), 4 * MB));
    const c = await cm.hashChunks(cm.slice(makeFile(8 * MB, 2), 4 * MB));

    expect(a[0]!.hash).toBe(b[0]!.hash);
    expect(a[0]!.hash).not.toBe(c[0]!.hash);
  });

  it('reports progress up to the total chunk count', async () => {
    const cm = new ChunkManager(false);
    const chunks = cm.slice(makeFile(8 * MB), 4 * MB);
    const progress: Array<[number, number]> = [];

    await cm.hashChunks(chunks, 'md5', (completed, total) => {
      progress.push([completed, total]);
    });

    expect(progress.length).toBeGreaterThan(0);
    expect(progress.at(-1)).toEqual([2, 2]);
  });

  it('returns an empty array for empty input', async () => {
    const cm = new ChunkManager(false);
    expect(await cm.hashChunks([])).toEqual([]);
  });
});

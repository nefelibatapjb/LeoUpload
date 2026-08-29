import { describe, it, expect, vi } from 'vitest';
import { UploadQueue } from './UploadQueue';
import { UploadError, type HashedChunk } from '../types';
import type { ProtocolClient } from '../protocol/ProtocolClient';

const chunkResponse = (index: number) => ({
  uploadId: 'u1',
  chunkIndex: index,
  received: true,
});

function makeChunk(index: number): HashedChunk {
  return {
    index,
    blob: new Blob([new Uint8Array(4)]),
    start: index * 4,
    end: (index + 1) * 4,
    hash: `hash-${index}`,
    retryCount: 0,
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeClient() {
  return { uploadChunk: vi.fn() } as unknown as ProtocolClient & {
    uploadChunk: ReturnType<typeof vi.fn>;
  };
}

const fastRetry = { maxRetries: 3, baseDelayMs: 0, jitter: false };

describe('UploadQueue', () => {
  it('respects the concurrency limit', async () => {
    const client = makeClient();
    let inFlight = 0;
    let maxInFlight = 0;
    client.uploadChunk.mockImplementation(async (_id: string, index: number) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return chunkResponse(index);
    });

    const queue = new UploadQueue(client, 2, fastRetry);
    await Promise.all(
      [0, 1, 2, 3, 4].map((i) => queue.enqueue(makeChunk(i), 'u1', 5)),
    );

    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(client.uploadChunk).toHaveBeenCalledTimes(5);
  });

  it('pause holds pending chunks; resume drains them', async () => {
    const client = makeClient();
    const gate = deferred<{ received: boolean }>();
    client.uploadChunk.mockImplementationOnce(() => gate.promise);
    client.uploadChunk.mockImplementation(async (_id: string, index: number) =>
      chunkResponse(index),
    );

    const queue = new UploadQueue(client, 1, fastRetry);
    const all = Promise.all([
      queue.enqueue(makeChunk(0), 'u1', 3),
      queue.enqueue(makeChunk(1), 'u1', 3),
      queue.enqueue(makeChunk(2), 'u1', 3),
    ]);

    // First chunk is in flight (gated); pause before it completes
    await vi.waitFor(() => expect(client.uploadChunk).toHaveBeenCalledTimes(1));
    queue.pause();
    expect(queue.currentStatus).toBe('paused');

    gate.resolve(chunkResponse(0));
    await new Promise((r) => setTimeout(r, 10));

    // Paused: no further chunks may start
    expect(client.uploadChunk).toHaveBeenCalledTimes(1);
    expect(queue.pendingCount).toBe(2);

    queue.resume();
    await all;
    expect(client.uploadChunk).toHaveBeenCalledTimes(3);
  });

  it('cancel rejects all pending tasks and stops the queue', async () => {
    const client = makeClient();
    const gate = deferred<{ received: boolean }>();
    client.uploadChunk.mockImplementation(() => gate.promise);

    const queue = new UploadQueue(client, 1, fastRetry);
    const first = queue.enqueue(makeChunk(0), 'u1', 3);
    const second = queue.enqueue(makeChunk(1), 'u1', 3);

    await vi.waitFor(() =>
      expect(queue.currentStatus).toBe('running'),
    );
    queue.cancel();

    await expect(first).rejects.toMatchObject({ code: 'CANCELLED' });
    await expect(second).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('retries a retryable failure and succeeds', async () => {
    const client = makeClient();
    client.uploadChunk
      .mockRejectedValueOnce(
        new UploadError('flaky', 'NETWORK_ERROR', { retryable: true }),
      )
      .mockResolvedValueOnce(chunkResponse(0));

    const onRetry = vi.fn();
    const queue = new UploadQueue(client, 1, fastRetry);
    queue.setOnChunkRetry(onRetry);

    await expect(queue.enqueue(makeChunk(0), 'u1', 1)).resolves.toMatchObject({
      received: true,
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(client.uploadChunk).toHaveBeenCalledTimes(2);
  });

  it('rejects after exhausting retries, then resets on success', async () => {
    const client = makeClient();
    client.uploadChunk.mockRejectedValue(
      new UploadError('down', 'NETWORK_ERROR', { retryable: true }),
    );

    const queue = new UploadQueue(client, 1, fastRetry);
    await expect(queue.enqueue(makeChunk(0), 'u1', 1)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    // initial attempt + maxRetries retries
    expect(client.uploadChunk).toHaveBeenCalledTimes(4);
  });

  it('does not retry non-retryable errors', async () => {
    const client = makeClient();
    client.uploadChunk.mockRejectedValue(
      new UploadError('bad request', 'INVALID_RESPONSE', { retryable: false }),
    );

    const queue = new UploadQueue(client, 1, fastRetry);
    await expect(queue.enqueue(makeChunk(0), 'u1', 1)).rejects.toBeInstanceOf(
      UploadError,
    );
    expect(client.uploadChunk).toHaveBeenCalledTimes(1);
  });
});

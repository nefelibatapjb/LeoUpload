import { describe, it, expect, vi, afterEach } from 'vitest';
import { LeoUpload } from './LeoUpload';
import { UploadError, type UploadConfig } from './types';

const CHUNK = 4; // bytes — a 10-byte file becomes 3 chunks

function makeFile(size = 10): File {
  return new File([new Uint8Array(size)], 'test.bin', {
    type: 'application/octet-stream',
  });
}

function makeUploader(overrides: Partial<UploadConfig> = {}): LeoUpload {
  return new LeoUpload({
    chunkSize: CHUNK,
    concurrency: 1,
    useWorker: false,
    persistEnabled: false,
    server: {
      init: '/api/upload/init',
      chunk: '/api/upload/chunk',
      progress: '/api/upload/progress',
      complete: '/api/upload/complete',
      cancel: '/api/upload',
    },
    ...overrides,
  });
}

const res = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as Response);

const initBody = (uploadedChunks: number[] = []) => ({
  uploadId: 'u1',
  chunkSize: CHUNK,
  uploadedChunks,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
});

const chunkBody = { uploadId: 'u1', chunkIndex: -1, received: true };

const completeBody = {
  uploadId: 'u1',
  status: 'completed',
  fileUrl: 'https://cdn.example.com/test.bin',
  fileSize: 10,
  checksum: 'deadbeef',
};

interface FetchMock {
  fn: ReturnType<typeof vi.fn>;
  chunkCalls: () => number;
}

function installFetch(handlers: {
  init?: () => Promise<Response>;
  chunk?: (callIndex: number) => Promise<Response>;
  complete?: () => Promise<Response>;
}): FetchMock {
  let chunkCalls = 0;
  const fn = vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes('/init')) {
      return handlers.init?.() ?? res(initBody());
    }
    if (url.includes('/chunk')) {
      const i = chunkCalls++;
      return handlers.chunk?.(i) ?? res({ ...chunkBody, chunkIndex: i });
    }
    if (url.includes('/complete')) {
      return handlers.complete?.() ?? res(completeBody);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fn);
  return { fn, chunkCalls: () => chunkCalls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LeoUpload', () => {
  it('uploads all chunks and completes', async () => {
    const fetchMock = installFetch({});
    const uploader = makeUploader({ concurrency: 3 });
    const chunkComplete = vi.fn();
    const progress = vi.fn();
    uploader.on('chunk:complete', chunkComplete);
    uploader.on('progress', progress);

    const result = await uploader.start(makeFile());

    expect(fetchMock.chunkCalls()).toBe(3);
    expect(result).toMatchObject({
      uploadId: 'u1',
      fileName: 'test.bin',
      fileSize: 10,
      totalChunks: 3,
      fileUrl: completeBody.fileUrl,
      checksum: 'deadbeef',
    });
    expect(uploader.state.status).toBe('completed');
    expect(uploader.state.overallProgress).toBe(100);
    expect(chunkComplete).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenCalled();
  });

  it('skips chunks the server already has (breakpoint resume)', async () => {
    const fetchMock = installFetch({ init: () => res(initBody([0, 1])) });
    const uploader = makeUploader({ concurrency: 3 });

    const result = await uploader.start(makeFile());

    expect(fetchMock.chunkCalls()).toBe(1); // only chunk 2 is uploaded
    expect(result.totalChunks).toBe(3);
    expect(uploader.state.status).toBe('completed');
  });

  it('rejects with an UploadError and emits error when the server fails', async () => {
    installFetch({
      chunk: () => res({ error: 'boom' }, false, 500),
    });
    const uploader = makeUploader({ maxRetries: 1 });
    const onError = vi.fn();
    uploader.on('error', onError);

    await expect(uploader.start(makeFile())).rejects.toBeInstanceOf(UploadError);
    expect(uploader.state.status).toBe('error');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('pauses and resumes: no new chunks start while paused', async () => {
    const gate = deferred();
    installFetch({
      chunk: (i) =>
        i === 0 ? gate.promise.then(() => res({ ...chunkBody, chunkIndex: 0 })) : res({ ...chunkBody, chunkIndex: i }),
    });
    const uploader = makeUploader();
    const onPause = vi.fn();
    const onResume = vi.fn();
    uploader.on('pause', onPause);
    uploader.on('resume', onResume);

    const pending = uploader.start(makeFile());

    await vi.waitFor(() => expect(uploader.state.status).toBe('uploading'));
    uploader.pause();
    expect(uploader.state.status).toBe('paused');
    expect(onPause).toHaveBeenCalledTimes(1);

    gate.resolve();
    await new Promise((r) => setTimeout(r, 10));
    expect(uploader.state.status).toBe('paused'); // still waiting for resume

    const resumed = uploader.resume();
    expect(onResume).toHaveBeenCalledTimes(1);

    await Promise.all([pending, resumed]);
    expect(uploader.state.status).toBe('completed');
  });

  it('auto-pauses on offline and auto-resumes on online', async () => {
    const gate = deferred();
    installFetch({
      chunk: (i) =>
        i === 0 ? gate.promise.then(() => res({ ...chunkBody, chunkIndex: 0 })) : res({ ...chunkBody, chunkIndex: i }),
    });
    const uploader = makeUploader();
    const onOffline = vi.fn();
    const onOnline = vi.fn();
    uploader.on('offline', onOffline);
    uploader.on('online', onOnline);

    const pending = uploader.start(makeFile());

    await vi.waitFor(() => expect(uploader.state.status).toBe('uploading'));

    window.dispatchEvent(new Event('offline'));
    expect(uploader.state.status).toBe('paused');
    expect(onOffline).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('online'));
    expect(onOnline).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(uploader.state.status).toBe('uploading'));

    gate.resolve();
    await pending;
    expect(uploader.state.status).toBe('completed');
  });

  it('does not auto-resume a user-initiated pause when back online', async () => {
    const gate = deferred();
    installFetch({
      chunk: (i) =>
        i === 0 ? gate.promise.then(() => res({ ...chunkBody, chunkIndex: 0 })) : res({ ...chunkBody, chunkIndex: i }),
    });
    const uploader = makeUploader();
    const pending = uploader.start(makeFile());

    await vi.waitFor(() => expect(uploader.state.status).toBe('uploading'));
    uploader.pause();

    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 10));
    expect(uploader.state.status).toBe('paused'); // user pause wins

    gate.resolve();
    uploader.resume();
    await pending;
  });
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

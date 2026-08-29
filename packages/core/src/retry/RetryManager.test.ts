import { describe, it, expect } from 'vitest';
import { RetryManager } from './RetryManager';
import { UploadError } from '../types';

const retryable = () =>
  new UploadError('boom', 'NETWORK_ERROR', { retryable: true });
const fatal = () =>
  new UploadError('nope', 'INVALID_RESPONSE', { retryable: false });

describe('RetryManager', () => {
  it('retries retryable errors and counts attempts per chunk', () => {
    const rm = new RetryManager({ jitter: false });

    expect(rm.shouldRetry(retryable(), 0)).toEqual({ retry: true, delayMs: 1000 });
    expect(rm.getAttempt(0)).toBe(1);
    expect(rm.shouldRetry(retryable(), 0).retry).toBe(true);
    expect(rm.getAttempt(0)).toBe(2);
  });

  it('does not retry non-retryable errors and leaves attempts untouched', () => {
    const rm = new RetryManager();

    expect(rm.shouldRetry(fatal(), 3)).toEqual({ retry: false, delayMs: 0 });
    expect(rm.getAttempt(3)).toBe(0);
  });

  it('gives up after maxRetries attempts', () => {
    const rm = new RetryManager({ maxRetries: 2, jitter: false });

    expect(rm.shouldRetry(retryable(), 0).retry).toBe(true);
    expect(rm.shouldRetry(retryable(), 0).retry).toBe(true);
    expect(rm.shouldRetry(retryable(), 0)).toEqual({ retry: false, delayMs: 0 });
  });

  it('only retries statuses in retryableStatuses', () => {
    const rm = new RetryManager({ retryableStatuses: [503] });
    const err = new UploadError('err', 'SERVER_ERROR', {
      statusCode: 500,
      retryable: true,
    });

    expect(rm.shouldRetry(err, 0).retry).toBe(false);
  });

  it('backoff grows exponentially and is capped at maxDelayMs', () => {
    const rm = new RetryManager({
      baseDelayMs: 100,
      backoffMultiplier: 2,
      maxDelayMs: 400,
      jitter: false,
    });

    expect(rm.computeDelay(0)).toBe(100);
    expect(rm.computeDelay(1)).toBe(200);
    expect(rm.computeDelay(2)).toBe(400);
    expect(rm.computeDelay(10)).toBe(400);
  });

  it('resetChunk clears the attempt counter', () => {
    const rm = new RetryManager({ maxRetries: 1 });

    rm.shouldRetry(retryable(), 5);
    expect(rm.getAttempt(5)).toBe(1);
    rm.resetChunk(5);
    expect(rm.getAttempt(5)).toBe(0);
    expect(rm.shouldRetry(retryable(), 5).retry).toBe(true);
  });

  it('resetAll clears every counter', () => {
    const rm = new RetryManager();
    rm.shouldRetry(retryable(), 0);
    rm.shouldRetry(retryable(), 1);
    rm.resetAll();
    expect(rm.getAttempt(0)).toBe(0);
    expect(rm.getAttempt(1)).toBe(0);
  });
});

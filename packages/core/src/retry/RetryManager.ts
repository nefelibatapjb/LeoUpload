import type { UploadError } from '../types';

export interface RetryConfig {
  /** Maximum retry attempts per chunk. Default: 5 */
  maxRetries: number;
  /** Base delay in milliseconds. Default: 1000 */
  baseDelayMs: number;
  /** Maximum delay cap. Default: 30000 */
  maxDelayMs: number;
  /** Backoff multiplier. Default: 2 */
  backoffMultiplier: number;
  /** Whether to add jitter. Default: true */
  jitter: boolean;
  /** HTTP status codes that are retryable */
  retryableStatuses: number[];
}

export interface RetryDecision {
  retry: boolean;
  delayMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Manages exponential backoff retry logic for failed chunk uploads.
 *
 * Delay formula: min(baseDelay * multiplier^attempt + jitter, maxDelay)
 * Jitter: random(0, delay * 0.1) to avoid thundering herd on reconnect.
 */
export class RetryManager {
  private config: RetryConfig;
  private attempts = new Map<number, number>(); // chunkIndex -> attempt count

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Determine if a failed chunk should be retried, and with what delay.
   */
  shouldRetry(error: UploadError, chunkIndex: number): RetryDecision {
    const currentAttempt = this.attempts.get(chunkIndex) ?? 0;
    const nextAttempt = currentAttempt + 1;

    if (nextAttempt > this.config.maxRetries) {
      return { retry: false, delayMs: 0 };
    }

    if (!error.retryable) {
      return { retry: false, delayMs: 0 };
    }

    // Check if the HTTP status is explicitly retryable
    if (
      error.statusCode &&
      !this.config.retryableStatuses.includes(error.statusCode)
    ) {
      return { retry: false, delayMs: 0 };
    }

    // Record the attempt
    this.attempts.set(chunkIndex, nextAttempt);

    const delayMs = this.computeDelay(currentAttempt);
    return { retry: true, delayMs };
  }

  /**
   * Compute the exponential backoff delay for a given attempt (0-indexed).
   */
  computeDelay(attempt: number): number {
    const exponential = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt);

    let delay = Math.min(exponential, this.config.maxDelayMs);

    // Add jitter: ±10% to avoid thundering herd
    if (this.config.jitter) {
      const jitterAmount = delay * 0.1 * (Math.random() * 2 - 1); // ±10%
      delay = Math.round(delay + jitterAmount);
    }

    return Math.max(0, Math.min(delay, this.config.maxDelayMs));
  }

  /**
   * Reset the retry counter for a specific chunk.
   */
  resetChunk(chunkIndex: number): void {
    this.attempts.delete(chunkIndex);
  }

  /**
   * Reset all retry counters.
   */
  resetAll(): void {
    this.attempts.clear();
  }

  /**
   * Get the current attempt count for a chunk.
   */
  getAttempt(chunkIndex: number): number {
    return this.attempts.get(chunkIndex) ?? 0;
  }
}

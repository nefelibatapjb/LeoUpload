/**
 * Invariant assertion for runtime checks.
 * Throws in development, logs warning in production.
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    // Vite-style env (guarded — import.meta.env is not typed in all builds)
    const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
    if (isDev || typeof process !== 'undefined') {
      throw new Error(`[LeoUpload] ${message}`);
    }
    console.warn(`[LeoUpload] ${message}`);
  }
}

/**
 * Assert that a value is defined (not null | undefined).
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string,
): asserts value is T {
  assert(value != null, message);
}

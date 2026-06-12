/**
 * Invariant assertion for runtime checks.
 * Throws in development, logs warning in production.
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    if (import.meta.env.DEV || typeof process !== 'undefined') {
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

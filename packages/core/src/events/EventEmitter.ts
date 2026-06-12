/**
 * A minimal typed event emitter.
 * No external dependency — ~50 lines, fully tree-shakeable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EventEmitter<T extends Record<string, any>> {
  private handlers = new Map<keyof T, Set<(...args: unknown[]) => void>>();

  /**
   * Register an event handler. Returns an unsubscribe function.
   */
  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as (...args: unknown[]) => void);

    return () => {
      set!.delete(handler as (...args: unknown[]) => void);
    };
  }

  /**
   * Register a one-time event handler. Returns an unsubscribe function.
   */
  once<K extends keyof T>(event: K, handler: (data: T[K]) => void): () => void {
    const wrapper = (data: T[K]) => {
      unsubscribe();
      handler(data);
    };
    const unsubscribe = this.on(event, wrapper);
    return unsubscribe;
  }

  /**
   * Emit an event to all registered handlers.
   */
  emit<K extends keyof T>(event: K, data: T[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;

    for (const handler of set) {
      try {
        handler(data);
      } catch (err) {
        // Don't let one handler's error stop others
        console.error(`[LeoUpload] Error in "${String(event)}" handler:`, err);
      }
    }
  }

  /**
   * Remove a specific handler, or all handlers for an event.
   */
  off<K extends keyof T>(event: K, handler?: (data: T[K]) => void): void {
    if (!handler) {
      this.handlers.delete(event);
      return;
    }
    this.handlers.get(event)?.delete(handler as (...args: unknown[]) => void);
  }

  /**
   * Remove all event listeners.
   */
  removeAllListeners(): void {
    this.handlers.clear();
  }

  /**
   * Return the number of handlers for an event.
   */
  listenerCount<K extends keyof T>(event: K): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

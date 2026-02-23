type Handler<T = unknown> = (payload: T) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<Handler>>();

  on<T>(event: string, handler: Handler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const set = this.handlers.get(event)!;
    set.add(handler as Handler);
    return () => set.delete(handler as Handler);
  }

  async emit<T>(event: string, payload: T): Promise<void> {
    const set = this.handlers.get(event);
    if (!set) return;

    const promises: Promise<void>[] = [];
    for (const handler of set) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          promises.push(result.catch((err) => {
            console.error(`EventBus handler error for "${event}":`, err);
          }));
        }
      } catch (err) {
        console.error(`EventBus handler error for "${event}":`, err);
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }
}

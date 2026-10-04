type Handler = (payload?: any) => void;

/** Tiny global event bus. Event names are namespaced strings, e.g. 'state:changed'. */
class Bus {
  private handlers = new Map<string, Set<Handler>>();
  on(event: string, fn: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }
  once(event: string, fn: Handler): () => void {
    const off = this.on(event, payload => { off(); fn(payload); });
    return off;
  }
  emit(event: string, payload?: unknown): void {
    this.handlers.get(event)?.forEach(fn => fn(payload));
  }
}

export const events = new Bus();

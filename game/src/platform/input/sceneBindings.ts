/** Minimal emitter contract keeps lifecycle ownership independent of Phaser. */
export interface BindingEmitter {
  on(event: string, handler: (...args: any[]) => void, context?: unknown): unknown;
  once(event: string, handler: (...args: any[]) => void, context?: unknown): unknown;
  off(event: string, handler: (...args: any[]) => void, context?: unknown): unknown;
}

/** Own only registered callbacks; disposal never clears another component's listeners. */
export class SceneBindings {
  private cleanups: Array<() => void> = [];
  private disposed = false;
  private readonly onShutdown = () => this.dispose();
  constructor(private readonly lifecycle: BindingEmitter) {
    lifecycle.once('shutdown', this.onShutdown);
    lifecycle.once('destroy', this.onShutdown);
  }
  add(cleanup: () => void): void {
    if (this.disposed) cleanup(); else this.cleanups.push(cleanup);
  }
  on(emitter: BindingEmitter, event: string, handler: (...args: any[]) => void, context?: unknown): void {
    if (this.disposed) return;
    emitter.on(event, handler, context);
    this.add(() => emitter.off(event, handler, context));
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.lifecycle.off('shutdown', this.onShutdown);
    this.lifecycle.off('destroy', this.onShutdown);
    const cleanups = this.cleanups.splice(0).reverse();
    for (const cleanup of cleanups) cleanup();
  }
}

import { describe, expect, it, vi } from 'vitest';
import { SceneBindings, type BindingEmitter } from "./sceneBindings";

class Emitter implements BindingEmitter {
  private listeners = new Map<string, Array<{ handler: (...args: any[]) => void; context?: unknown; once?: boolean }>>();
  on(event: string, handler: (...args: any[]) => void, context?: unknown) { this.add(event, handler, context, false); }
  once(event: string, handler: (...args: any[]) => void, context?: unknown) { this.add(event, handler, context, true); }
  off(event: string, handler: (...args: any[]) => void, context?: unknown) {
    this.listeners.set(event, (this.listeners.get(event) ?? []).filter(listener => listener.handler !== handler || listener.context !== context));
  }
  emit(event: string) {
    for (const listener of [...this.listeners.get(event) ?? []]) {
      if (listener.once) this.off(event, listener.handler, listener.context);
      listener.handler.call(listener.context);
    }
  }
  private add(event: string, handler: (...args: any[]) => void, context: unknown, once: boolean) {
    this.listeners.set(event, [...this.listeners.get(event) ?? [], { handler, context, once }]);
  }
}

describe('scene-owned event bindings', () => {
  it('removes only owned callbacks and subscriptions once on shutdown or destruction', () => {
    const lifecycle = new Emitter(), input = new Emitter(), bindings = new SceneBindings(lifecycle);
    const own = vi.fn(), other = vi.fn(), unsubscribe = vi.fn();
    input.on('pointerdown', other); bindings.on(input, 'pointerdown', own); bindings.add(unsubscribe);
    input.emit('pointerdown'); expect(own).toHaveBeenCalledOnce();
    lifecycle.emit('shutdown'); lifecycle.emit('destroy'); bindings.dispose(); input.emit('pointerdown');
    expect(own).toHaveBeenCalledOnce(); expect(other).toHaveBeenCalledTimes(2); expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('can restart with the same emitter without retaining the previous scene listener', () => {
    const lifecycle = new Emitter(), keyboard = new Emitter();
    const use = vi.fn(), first = new SceneBindings(lifecycle);
    first.on(keyboard, 'down', use); lifecycle.emit('shutdown');
    const next = new SceneBindings(lifecycle); next.on(keyboard, 'down', use);
    keyboard.emit('down'); expect(use).toHaveBeenCalledOnce();
    lifecycle.emit('destroy'); keyboard.emit('down'); expect(use).toHaveBeenCalledOnce();
  });
});

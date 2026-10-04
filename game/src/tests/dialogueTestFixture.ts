import type Phaser from 'phaser';
import { vi } from 'vitest';

/** A scene-clock fixture: timers tick only when the test advances that clock. */
export function dialogueSceneFixture() {
  const objects: any[] = [];
  const add = (...args: any[]) => {
    const object: any = { visible: true, active: true, width: 96, height: 20, handlers: {}, args };
    for (const method of ['setOrigin', 'setInteractive', 'setDepth', 'setScrollFactor', 'setStrokeStyle', 'setScale', 'setAlpha', 'setTexture', 'setCrop', 'setDisplaySize']) object[method] = vi.fn(() => object);
    object.setText = vi.fn((text: string) => { object.value = text; object.height = Math.max(20, Math.ceil(text.length / 60) * 20); return object; });
    object.setPosition = vi.fn((x: number, y: number) => { object.x = x; object.y = y; return object; });
    object.setSize = vi.fn((width: number, height: number) => { object.width = width; object.height = height; return object; });
    object.setVisible = vi.fn((visible: boolean) => { object.visible = visible; return object; });
    object.on = (event: string, callback: () => void) => { object.handlers[event] = callback; return object; };
    object.destroy = vi.fn(() => { object.active = false; });
    objects.push(object);
    return object;
  };
  const data = new Map<string, unknown>();
  const timers: any[] = [];
  const listeners = new Map<string, Set<() => void>>();
  const scene = {
    add: { rectangle: add, image: add, zone: add, container: add, text: add },
    textures: { exists: () => true, get: () => ({ getSourceImage: () => ({ width: 640, height: 360 }) }) },
    data: {
      get: (key: string) => data.get(key),
      set: (key: string | Record<string, unknown>, value?: unknown) => {
        if (typeof key === 'string') data.set(key, value);
        else Object.entries(key).forEach(([k, v]) => data.set(k, v));
      },
    },
    events: {
      on: (event: string, callback: () => void) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event)!.add(callback); },
      once: (event: string, callback: () => void) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event)!.add(callback); },
      off: (event: string, callback: () => void) => listeners.get(event)?.delete(callback),
    },
    time: { addEvent: (config: any) => { const timer = { ...config, removed: false, remove: vi.fn(() => { timer.removed = true; }) }; timers.push(timer); return timer; } },
  } as unknown as Phaser.Scene;
  return { scene, data, objects, timers, listeners,
    tick: () => { for (const timer of [...timers]) if (!timer.removed) timer.callback(); },
    emit: (event: string) => { for (const listener of [...(listeners.get(event) ?? [])]) listener(); },
  };
}

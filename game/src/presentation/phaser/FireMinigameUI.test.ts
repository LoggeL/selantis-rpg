import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: {} }));
vi.mock('./Hud', () => ({ FONT: 'monospace' }));
import { FireMinigameUI } from './FireMinigameUI';
import { createFireMinigame } from '../../modules/camp/fireMinigame';
import { updateSettings } from '../../platform/settings';

class ObjectStub {
  x = 0; y = 0; angle = 0; alpha = 1; scaleX = 1; scaleY = 1; visible = true;
  width = 0; height = 0; text = ''; color = '';
  children: ObjectStub[] = [];
  handlers = new Map<string, (...args: any[]) => void>();
  destroy = vi.fn(() => this.children.forEach(child => child.destroy()));
  constructor(public kind: string, args: any[]) {
    this.x = args[0] ?? 0; this.y = args[1] ?? 0;
    if (kind === 'text') this.text = args[2];
    if (kind === 'rectangle' || kind === 'ellipse') { this.width = args[2]; this.height = args[3]; }
    if (kind === 'container') this.children = args[2] ?? [];
  }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setScale(x: number, y = x) { this.scaleX = x; this.scaleY = y; return this; }
  setDisplaySize(w: number, h: number) { this.width = w; this.height = h; return this; }
  setSize(w: number, h: number) { return this.setDisplaySize(w, h); }
  setAlpha(alpha: number) { this.alpha = alpha; return this; }
  setAngle(angle: number) { this.angle = angle; return this; }
  setVisible(visible: boolean) { this.visible = visible; return this; }
  setText(text: string) { this.text = text; return this; }
  setColor(color: string) { this.color = color; return this; }
  setFillStyle() { return this; } setStrokeStyle() { return this; }
  setOrigin() { return this; } setInteractive() { return this; }
  setCrop() { return this; } setTint() { return this; } setDepth() { return this; } setScrollFactor() { return this; }
  fillStyle() { return this; } fillRect() { return this; }
  lineStyle() { return this; } lineBetween() { return this; }
  on(event: string, callback: (...args: any[]) => void) { this.handlers.set(event, callback); return this; }
}

function view() {
  const objects: ObjectStub[] = [];
  const events = new Map<string, () => void>();
  const scene: any = {
    add: Object.fromEntries(['rectangle', 'ellipse', 'image', 'text', 'graphics', 'container'].map(kind => [kind, (...args: any[]) => {
      const object = new ObjectStub(kind, args); objects.push(object); return object;
    }])),
    events: { once: (event: string, cb: () => void) => events.set(event, cb), off: vi.fn((event: string) => events.delete(event)) },
    tweens: { add: vi.fn(), killTweensOf: vi.fn() },
  };
  const stroke = vi.fn(), cancel = vi.fn();
  const ui = new FireMinigameUI(scene, stroke, cancel);
  return { ui, scene, stroke, cancel, objects, events };
}

beforeEach(() => updateSettings({ particles: true, reducedMotion: false }));

describe('fire close-up presentation lifetime and motion preferences', () => {
  it('keeps the earned heat and flame readable with motion reduced, and cancels running stroke tweens', () => {
    const { ui, objects, scene } = view();
    const state = { ...createFireMinigame(false), heat: 5, elapsedMs: 370 };
    ui.update(state); ui.result('hit');
    expect(scene.tweens.add).toHaveBeenCalled();
    state.reducedMotion = true; ui.update(state);
    const flame = objects.filter(o => o.kind === 'image').at(-1)!;
    const still = { width: flame.width, height: flame.height, alpha: flame.alpha };
    expect(still.alpha).toBeGreaterThan(0);
    expect(objects.some(o => o.text === 'Glut 5 / 6')).toBe(true);
    expect(scene.tweens.killTweensOf).toHaveBeenCalled();
    state.elapsedMs += 900; ui.update(state);
    expect({ width: flame.width, height: flame.height, alpha: flame.alpha }).toEqual(still);
    const calls = scene.tweens.add.mock.calls.length;
    ui.result('hit'); expect(scene.tweens.add).toHaveBeenCalledTimes(calls);
  });

  it('disables optional smoke and sparks while keeping the flame, without allocating effects each frame', () => {
    const { ui, objects } = view();
    const state = { ...createFireMinigame(false), heat: 5, elapsedMs: 370 };
    ui.update(state);
    const before = objects.length;
    updateSettings({ particles: false }); ui.update(state);
    // The five trailing ellipses are the smoke pool; glow ellipses still convey heat.
    expect(objects.filter(o => o.kind === 'ellipse').slice(-5).every(o => o.alpha === 0)).toBe(true);
    expect(objects.filter(o => o.kind === 'image').at(-1)!.alpha).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) { state.elapsedMs += 100; ui.update(state); }
    expect(objects).toHaveLength(before);
    expect(objects.filter(o => o.kind === 'rectangle' && o.width <= 2 && o.height === 2).every(o => o.alpha === 0)).toBe(true);
  });

  it('destroys once on shutdown, kills owned tweens and ignores late inputs and updates', () => {
    const { ui, scene, objects, events, stroke } = view();
    const state = createFireMinigame(false); ui.update(state); ui.result('hit');
    const root = objects.at(-1)!;
    const action = objects.find(o => o.kind === 'rectangle' && o.x === 0)!;
    const stopPropagation = vi.fn();
    action.handlers.get('pointerdown')!({}, 0, 0, { stopPropagation });
    expect(stroke).toHaveBeenCalledOnce();
    events.get('shutdown')!(); ui.destroy();
    expect(root.destroy).toHaveBeenCalledOnce();
    expect(scene.events.off).toHaveBeenCalledWith('shutdown', expect.any(Function));
    expect(events.size).toBe(0);
    const count = scene.tweens.add.mock.calls.length;
    ui.update({ ...state, heat: 6, finished: true }); ui.result('complete');
    action.handlers.get('pointerdown')!({}, 0, 0, { stopPropagation });
    expect(stroke).toHaveBeenCalledOnce(); expect(scene.tweens.add).toHaveBeenCalledTimes(count);
  });

  it('prevents repeated pointer strokes and pause requests once the fire is lit', () => {
    const { ui, objects, stroke, cancel } = view();
    ui.update({ ...createFireMinigame(true), heat: 6, finished: true });
    for (const object of objects.filter(o => o.handlers.has('pointerdown'))) {
      object.handlers.get('pointerdown')!({}, 0, 0, { stopPropagation: vi.fn() });
    }
    expect(stroke).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled();
    expect(objects.some(o => o.text.includes('Die Glut greift'))).toBe(true);
  });
});

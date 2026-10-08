import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorldCtx } from '../../world';
import type { Modal } from '../../ui/context';
vi.mock('../../art/manifest', () => ({ manifest: () => ({}), assetUrl: (s: string) => s }));

const env = vi.hoisted(() => ({
  overlay: null as Modal | null, modal: null as Modal | null, focused: true, hidden: false,
  ui: { wait: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)) }, set: vi.fn(), close: vi.fn(),
}));
vi.mock('../../core/G', () => ({ G: { get ui() { return env.ui; }, state: { set: env.set } } }));
vi.mock('../../ui/context', () => ({ ctx: {
  reducedMotion: true,
  top: () => env.overlay ?? env.modal,
  open(modal: Modal) { env.modal = modal; return () => { env.close(); if (env.modal === modal) env.modal = null; }; },
} }));
vi.mock('./shared', () => ({ bg: () => {}, sfx: () => {}, lia: () => {} }));
vi.mock('phaser', () => ({ default: { Math: { DegToRad: (n: number) => n * Math.PI / 180 } } }));
import { ausweichDrill } from './training';

interface Probe { armed: boolean; side: string; k: number; ok: number }

function setup() {
  const handlers = new Map<string, Set<() => void>>();
  const addListener = (name: string, fn: () => void) => {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name)!.add(fn);
  };
  const removeListener = (name: string, fn: () => void) => { handlers.get(name)?.delete(fn); };
  const event = (name: string) => { for (const fn of handlers.get(name) ?? []) fn(); };
  const buttons = ['left', 'duck', 'right'].map(d => ({
    dataset: { d }, classList: { add: vi.fn(), remove: vi.fn() },
    pointer: () => {},
    addEventListener(_name: string, fn: (event: { preventDefault(): void }) => void) { this.pointer = () => fn({ preventDefault() {} }); },
  }));
  const classList = () => ({ add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: () => false });
  const node = () => ({ textContent: '', className: '', offsetWidth: 0, offsetHeight: 0,
    classList: classList(), style: { setProperty: vi.fn() }, getContext: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 360 }),
    querySelectorAll: () => [], setAttribute: vi.fn(),
  });
  const score = node();
  const cue = node();
  const elements = new Map<string, ReturnType<typeof node>>();
  const panel = {
    innerHTML: '', remove: vi.fn(), isConnected: true, offsetWidth: 0, classList: classList(), style: { setProperty: vi.fn() },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 360 }),
    querySelector(selector: string) {
      if (selector === '.k4-score') return score;
      if (selector === '.k4-cue') return cue;
      const button = buttons.find(b => selector.includes(`"${b.dataset.d}"`));
      if (button) return button;
      if (!elements.has(selector)) elements.set(selector, node());
      return elements.get(selector);
    },
    querySelectorAll(selector: string) { return selector === '.k4-pips span' ? Array.from({ length: 5 }, node) : buttons; },
  };
  Object.assign(env.ui, { panel: () => panel });
  const fakeWindow = {
    __k4drill: undefined as Probe | undefined,
    addEventListener: addListener, removeEventListener: removeListener, setTimeout,
  };
  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  vi.stubGlobal('document', {
    getElementById: () => true, hasFocus: () => env.focused, get hidden() { return env.hidden; },
    addEventListener: addListener, removeEventListener: removeListener, setTimeout,
  });
  const gfx: Record<string, unknown> = { active: true };
  for (const name of ['setDepth', 'clear', 'lineStyle', 'beginPath', 'arc', 'strokePath', 'fillStyle', 'fillCircle']) gfx[name] = () => gfx;
  gfx.destroy = () => { gfx.active = false; };
  let scenePaused = false;
  const control = {
    isActive: () => !scenePaused,
    pause: vi.fn(() => { scenePaused = true; }),
    resume: vi.fn(() => { scenePaused = false; }),
  };
  const player = { x: 10, y: 20, face: vi.fn(), play: vi.fn(async () => {}), teleport: vi.fn() };
  const foltan = { face: vi.fn(), play: vi.fn(async () => {}) };
  const world = {
    alive: true, player, actor: () => foltan,
    scene: { add: { graphics: () => gfx }, scene: control, events: { once: vi.fn() } },
    fx: { burst: vi.fn() }, camera: { shake: vi.fn() }, bark: vi.fn(),
  };
  return {
    world, foltan, control, buttons, panel, score, event,
    probe: () => ({ ...fakeWindow.__k4drill! }),
    key(code: string) { env.modal?.onKey?.({ code, repeat: false, preventDefault() {} } as KeyboardEvent); },
  };
}

beforeEach(() => {
  env.overlay = null; env.modal = null; env.focused = true; env.hidden = false;
  env.set.mockClear(); env.close.mockClear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('dodge drill pause', () => {
  it('freezes a live strike, rejects paused inputs and resumes with its remaining windup', async () => {
    const t = setup();
    const finished = ausweichDrill(t.world as unknown as WorldCtx, 1);
    await vi.advanceTimersByTimeAsync(1200);
    env.overlay = { id: 'menu' };
    await vi.advanceTimersByTimeAsync(32);
    const paused = t.probe();
    t.key('ArrowLeft');
    t.buttons[0].pointer();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(t.probe()).toEqual(paused);
    expect(t.foltan.play).not.toHaveBeenCalled();
    expect(env.set).not.toHaveBeenCalled();
    expect(t.control.pause).toHaveBeenCalledOnce();
    env.overlay = null;
    await vi.advanceTimersByTimeAsync(16);
    expect(t.probe().k).toBe(paused.k);
    expect(t.control.resume).toHaveBeenCalledOnce();
    t.key('ArrowRight');
    await vi.advanceTimersByTimeAsync(400);
    expect(t.foltan.play).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await finished).toBe(0);
    expect(t.probe().ok).toBe(1);
    expect(env.set).toHaveBeenCalledWith('k4-treffer', 0);
    expect(t.panel.remove).toHaveBeenCalledOnce();
    expect(env.close).toHaveBeenCalledOnce();
  });

  it('also pauses the gap between strikes instead of starting a new attack behind the menu', async () => {
    const t = setup();
    const finished = ausweichDrill(t.world as unknown as WorldCtx, 1);
    await vi.advanceTimersByTimeAsync(2300);
    expect(t.foltan.play).toHaveBeenCalledOnce();
    expect(t.probe().armed).toBe(false);
    env.overlay = { id: 'menu' };
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.probe().armed).toBe(false);
    expect(t.foltan.play).toHaveBeenCalledOnce();
    expect(env.set).not.toHaveBeenCalled();
    env.overlay = null;
    await vi.advanceTimersByTimeAsync(300);
    expect(t.probe().armed).toBe(false);
    await vi.advanceTimersByTimeAsync(400);
    expect(t.probe().armed).toBe(true);
    t.key('ArrowLeft');
    await vi.advanceTimersByTimeAsync(2300);
    expect(await finished).toBe(1);
    expect(t.probe().ok).toBe(1);
  });

  it.each(['journal', 'bag'])('keeps the drill paused when the menu hands off to %s', async overlay => {
    const t = setup();
    const finished = ausweichDrill(t.world as unknown as WorldCtx, 1);
    expect(env.modal).toMatchObject({ id: 'k4-drill', allowMenu: true, allowJournal: true });
    await vi.advanceTimersByTimeAsync(1200);
    env.overlay = { id: 'menu' };
    await vi.advanceTimersByTimeAsync(32);
    const paused = t.probe();
    env.overlay = { id: overlay };
    t.key('ArrowLeft'); t.buttons[0].pointer();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.probe()).toEqual(paused);
    expect(t.control.resume).not.toHaveBeenCalled();
    expect(t.foltan.play).not.toHaveBeenCalled();
    expect(env.set).not.toHaveBeenCalled();
    env.overlay = null;
    await vi.advanceTimersByTimeAsync(16);
    expect(t.probe().k).toBe(paused.k);
    t.key('ArrowRight');
    await vi.advanceTimersByTimeAsync(3500);
    expect(await finished).toBe(0);
    expect(t.control.resume).toHaveBeenCalledOnce();
  });

  it.each(['settings', 'chapters'])('holds feedback and windup throughout the menu %s page', async _page => {
    const t = setup();
    const finished = ausweichDrill(t.world as unknown as WorldCtx, 1);
    await vi.advanceTimersByTimeAsync(1200);
    t.buttons[2].pointer();
    await vi.advanceTimersByTimeAsync(48);
    env.overlay = { id: 'menu' }; // Settings and chapter selection retain the menu modal.
    await vi.advanceTimersByTimeAsync(32);
    const paused = t.probe();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.probe()).toEqual(paused);
    expect(t.buttons[2].classList.remove).not.toHaveBeenCalled();
    expect(t.foltan.play).not.toHaveBeenCalled();
    env.overlay = null;
    await vi.advanceTimersByTimeAsync(16);
    expect(t.probe().k).toBe(paused.k);
    await vi.advanceTimersByTimeAsync(3500);
    expect(await finished).toBe(0);
    expect(t.buttons[2].classList.remove).toHaveBeenCalledWith('is-ok');
  });

  it.each(['focus', 'visibility'])('freezes on %s loss even when no timer ticks before returning', async reason => {
    const t = setup();
    const finished = ausweichDrill(t.world as unknown as WorldCtx, 1);
    await vi.advanceTimersByTimeAsync(1200);
    const paused = t.probe();
    if (reason === 'focus') { env.focused = false; t.event('blur'); }
    else { env.hidden = true; t.event('visibilitychange'); }
    t.key('ArrowLeft'); t.buttons[0].pointer();
    // Model a throttled background tab: wall time advances without any timer callback.
    vi.setSystemTime(Date.now() + 30_000);
    vi.advanceTimersByTime(30_000);
    expect(t.probe()).toEqual(paused);
    expect(t.foltan.play).not.toHaveBeenCalled();
    if (reason === 'focus') { env.focused = true; t.event('focus'); }
    else { env.hidden = false; t.event('visibilitychange'); }
    await vi.advanceTimersByTimeAsync(16);
    expect(t.probe().k).toBeLessThan(paused.k + 0.02);
    t.key('ArrowRight');
    await vi.advanceTimersByTimeAsync(3500);
    expect(await finished).toBe(0);
    expect(t.control.pause).toHaveBeenCalledOnce();
    expect(t.control.resume).toHaveBeenCalledOnce();
  });
});

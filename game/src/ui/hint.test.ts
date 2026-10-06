import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoiceOutcome, VoicePlayback } from '../audio/voiceover';
import { BubbleUi } from './hint';

vi.mock('./dom', () => ({ el: (_tag: string, cls?: string, text?: string) => node(cls, text), blip: vi.fn(), icon: vi.fn() }));
vi.mock('../core/input', () => ({ virtualInput: {} }));
vi.mock('../core/viewport', () => ({ canvasToPage: (x: number, y: number) => ({ x, y }) }));
vi.mock('./context', () => ({ ctx: { onLayout() {}, epoch: 1, layers: { world: null as unknown } } }));
import { ctx } from './context';

// Exercise the real BubbleUi/revealSpeech lifecycle without a browser dependency.
interface FakeNode {
  children: FakeNode[]; parent: FakeNode | null; connected?: boolean; textContent: string;
  readonly firstElementChild: FakeNode | null; readonly isConnected: boolean; readonly offsetWidth: number;
  style: { visibility: string; transform: string; setProperty(name: string, value: string): void };
  classList: { add(...classes: string[]): void; remove(...classes: string[]): void; contains(cls: string): boolean };
  appendChild(child: FakeNode): FakeNode; prepend(child: FakeNode): void; remove(): void;
}
function node(cls = '', text = ''): FakeNode {
  const classes = new Set(cls.split(' ').filter(Boolean));
  let content = text;
  const result: FakeNode = {
    children: [], parent: null,
    get firstElementChild() { return result.children[0] ?? null; },
    get isConnected() { return result.connected ?? result.parent?.isConnected ?? false; },
    get offsetWidth() { return 80; },
    get textContent() { return content; },
    set textContent(value: string) { content = value; result.children.forEach(child => { child.parent = null; }); result.children.length = 0; },
    style: { visibility: '', transform: '', setProperty() {} },
    classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name) },
    appendChild(child) { child.remove(); child.parent = result; result.children.push(child); return child; },
    prepend(child) { child.remove(); child.parent = result; result.children.unshift(child); },
    remove() {
      const parent = result.parent;
      if (parent) parent.children.splice(parent.children.indexOf(result), 1);
      result.parent = null;
    },
  };
  return result;
}
function frames() {
  let next = 0;
  const pending = new Map<number, FrameRequestCallback>();
  return {
    request: (callback: FrameRequestCallback) => { pending.set(++next, callback); return next; },
    cancel: (id: number) => { pending.delete(id); },
    tick: () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(0)); },
  };
}
function media() {
  let time = 0;
  let outcome: VoiceOutcome = 'playing';
  let settle!: () => void;
  const finish = (next: VoiceOutcome) => { if (outcome !== 'playing') return; outcome = next; settle(); };
  const playback: VoicePlayback = {
    done: new Promise<void>(resolve => { settle = resolve; }), started: true,
    get currentTime() { return time; }, get outcome() { return outcome; },
    spokenText: 'Warm. Wie', wordCues: [{ start: .5, end: 1 }, { start: 4, end: 4.5 }],
    stop: () => finish('stopped'),
  };
  return { playback, clock: (value: number) => { time = value; }, finish };
}
const flatten = (n: FakeNode): FakeNode[] => [n, ...n.children.flatMap(flatten)];
let world: FakeNode;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', globalThis);
  world = node(); world.connected = true;
  ctx.layers.world = world as unknown as HTMLElement;
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('recorded speech bubbles', () => {
  it('removes an interrupted bark immediately without exposing words the new dialogue prevented it from saying', async () => {
    const raf = frames(), audio = media();
    vi.stubGlobal('requestAnimationFrame', raf.request); vi.stubGlobal('cancelAnimationFrame', raf.cancel);
    const bubbles = new BubbleUi();
    bubbles.bubble('Warm. Wie', () => ({ x: 320, y: 100 }), 2600, audio.playback);
    const bubble = world.children[0];
    const chars = flatten(bubble).filter(n => n.classList.contains('tc'));
    audio.clock(.5); raf.tick();
    expect(chars.filter(n => n.classList.contains('on')).map(n => n.textContent).join('')).toBe('Warm.');
    audio.playback.stop(); await audio.playback.done; await Promise.resolve();
    expect(world.children).toHaveLength(0);
    expect(chars.find(n => n.textContent === 'i')!.classList.contains('on')).toBe(false);
    audio.clock(10); raf.tick(); vi.advanceTimersByTime(3000);
    expect(world.children).toHaveLength(0);
    expect(chars.find(n => n.textContent === 'i')!.classList.contains('on')).toBe(false);
    bubbles.clear();
  });
  it('keeps a failed recording readable as full text for the normal caption lifetime', async () => {
    const raf = frames(), audio = media();
    vi.stubGlobal('requestAnimationFrame', raf.request); vi.stubGlobal('cancelAnimationFrame', raf.cancel);
    const bubbles = new BubbleUi();
    bubbles.bubble('Warm. Wie', () => ({ x: 320, y: 100 }), 1800, audio.playback);
    audio.finish('failed'); await audio.playback.done; await Promise.resolve();
    expect(world.children).toHaveLength(1);
    expect(flatten(world.children[0]).map(n => n.textContent).join('')).toBe('Warm. Wie');
    vi.advanceTimersByTime(1799); expect(world.children).toHaveLength(1);
    vi.advanceTimersByTime(1); expect(world.children[0].classList.contains('is-out')).toBe(true);
    vi.advanceTimersByTime(260); expect(world.children).toHaveLength(0);
    bubbles.clear();
  });
});

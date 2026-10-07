import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frames, media, TestNode, visibleCharacters } from './voice-ui.testHelpers';
import type { Modal } from '../../ui/context';
import type { WorldCtx } from '../../world';

vi.mock('../../core/G', () => ({ G: { events: { on: (_event: string, fn: () => void) => { departures.add(fn); return () => departures.delete(fn); } } } }));
vi.mock('../../ui/context', () => ({ ctx: {
  epoch: 1, root: null, stale: () => false, never: () => new Promise(() => {}),
  open: (modal: Modal) => { currentModal = modal; return vi.fn(() => { closed++; currentModal = null; }); },
}, isConfirm: (event: KeyboardEvent) => event.key === 'Enter' }));
vi.mock('./shared', () => ({ ui: () => ({ panel: (cls: string) => body.appendChild(new TestNode('DIV', cls)) }), sfx: vi.fn() }));
vi.mock('../../ui/dom', () => ({ el: (tag: string, cls?: string, text?: string) => new TestNode(tag.toUpperCase(), cls, text), blip: vi.fn() }));
vi.mock('../../audio/voiceover', async importOriginal => ({
  ...await importOriginal<typeof import('../../audio/voiceover')>(),
  voiceover: { preload: vi.fn(async () => {}), play: vi.fn(), stop: vi.fn() },
}));
import { voiceover } from '../../audio/voiceover';
import { ctx } from '../../ui/context';
import { aimStaff } from './stabtraining-zielen';
import { AIM_START, nextInDirection, PRACTICE_CALLS } from './stabtraining-ziele';

const CALL = PRACTICE_CALLS[2].call;
let body: TestNode;
let raf: ReturnType<typeof frames>;
let currentModal: Modal | null;
let closed = 0;
let departures: Set<() => void>;
let world: WorldCtx;
let ring: { destroy: ReturnType<typeof vi.fn>; setPosition: ReturnType<typeof vi.fn> };
let marker: { remove: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
const flush = async () => { await vi.advanceTimersByTimeAsync(0); };
const key = (value: string, repeat = false) => currentModal?.onKey?.({ key: value, repeat } as KeyboardEvent);
const words = () => body.querySelector<TestNode>('.e2-zielen-words')!;
const click = (selector: string) => body.querySelector<TestNode>(selector)!.dispatch('click');
const begin = async () => { const result = aimStaff(world, CALL); await flush(); raf.tick(); return { result }; };

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  vi.stubGlobal('performance', { now: () => Date.now() });
  body = new TestNode(); body.connected = true;
  const head = new TestNode(); head.connected = true;
  vi.stubGlobal('document', { head, createElement: (tag: string) => new TestNode(tag.toUpperCase()), createTextNode: (text: string) => new TestNode('#TEXT', '', text) });
  raf = frames(); vi.stubGlobal('requestAnimationFrame', raf.request); vi.stubGlobal('cancelAnimationFrame', raf.cancel);
  currentModal = null; closed = 0; departures = new Set(); ctx.epoch = 1; ctx.root = body as unknown as HTMLElement;
  ring = { destroy: vi.fn(), setPosition: vi.fn() };
  Object.assign(ring, { setDepth: vi.fn(), lineStyle: vi.fn(), strokeEllipse: vi.fn() });
  marker = { remove: vi.fn(), set: vi.fn() };
  world = {
    alive: true, player: { face: vi.fn() }, fx: { burst: vi.fn() }, lighting: { add: vi.fn(() => marker) },
    scene: { add: { graphics: () => ring }, tweens: { add: vi.fn() } },
  } as unknown as WorldCtx;
  vi.mocked(voiceover.preload).mockResolvedValue(undefined);
  vi.mocked(voiceover.play).mockReturnValue(null);
});
afterEach(() => { departures.forEach(fn => fn()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('recorded Ignatius target calls', () => {
  it('starts one foreground call inside the input modal, with only the original words spoken', async () => {
    const audio = media(CALL);
    vi.mocked(voiceover.play).mockImplementation(() => { expect(currentModal?.id).toBe('e2-zielen'); return audio.playback; });
    await begin();
    expect(voiceover.stop).toHaveBeenCalledTimes(1);
    expect(voiceover.play).toHaveBeenCalledWith('bark', 'e2-ignatius', CALL, undefined, undefined, true);
    expect(body.textContent).toContain('Stabimpuls'); expect(body.textContent).toContain('Pfeile / WASD zielen');
    expect(visibleCharacters(words())).toBe('');
    audio.clock(.5); raf.tick(); expect(visibleCharacters(words())).toBe('Der');
    await vi.advanceTimersByTimeAsync(10000); raf.tick(); expect(visibleCharacters(words())).toBe('Der');
    expect(audio.playback.stop).not.toHaveBeenCalled();
  });
  it('allows targeting and firing while a call is still playing, then cancels its media and reveal', async () => {
    const audio = media(CALL); vi.mocked(voiceover.play).mockReturnValue(audio.playback);
    const { result } = await begin(); click('.left');
    expect(marker.set).toHaveBeenCalledTimes(1);
    click('.fire'); expect(await result).toBe(nextInDirection(AIM_START, -1, 0)); await flush(); raf.tick();
    expect(audio.playback.stop).toHaveBeenCalledTimes(1); expect(body.children).toHaveLength(0);
    expect(marker.remove).toHaveBeenCalledTimes(1); expect(ring.destroy).toHaveBeenCalledTimes(1);
    expect(departures.size).toBe(0); expect(raf.count()).toBe(0); expect(closed).toBe(1);
  });
  it('stops the call and all aiming resources when Lia lowers the staff', async () => {
    const audio = media(CALL); vi.mocked(voiceover.play).mockReturnValue(audio.playback);
    const { result } = await begin(); click('.back'); expect(await result).toBe(null);
    expect(audio.playback.stop).toHaveBeenCalledTimes(1); expect(body.children).toHaveLength(0);
    expect(marker.remove).toHaveBeenCalledTimes(1); expect(ring.destroy).toHaveBeenCalledTimes(1);
  });
  it('shows the complete target description without voice and keeps keyboard controls usable', async () => {
    const { result } = await begin(); expect(words().textContent).toBe(CALL);
    key('ArrowUp'); key('Enter', true); expect(body.children).toHaveLength(1);
    key('Enter'); expect(await result).toBe(nextInDirection(AIM_START, 0, -1));
    expect(voiceover.play).toHaveBeenCalledTimes(1);
  });
  it('keeps a failed recording readable and does not disable the exercise', async () => {
    const audio = media(CALL); vi.mocked(voiceover.play).mockReturnValue(audio.playback);
    const { result } = await begin(); audio.finish('failed'); await flush();
    expect(words().textContent).toBe(CALL); key('Enter'); expect(await result).toBe(AIM_START);
  });
  it('makes the remaining caption visible after muting, without leaving targeting', async () => {
    const audio = media(CALL); vi.mocked(voiceover.play).mockReturnValue(audio.playback);
    await begin(); audio.playback.stop(); await flush();
    expect(visibleCharacters(words())).toBe(CALL); expect(currentModal?.id).toBe('e2-zielen');
    expect(marker.remove).not.toHaveBeenCalled();
  });
  it('removes a departed scene without resolving an old shot selection', async () => {
    const audio = media(CALL); vi.mocked(voiceover.play).mockReturnValue(audio.playback);
    const { result } = await begin(); let resolved = false; void result.then(() => { resolved = true; });
    departures.forEach(fn => fn()); await flush(); raf.tick();
    expect(audio.playback.stop).toHaveBeenCalledTimes(1); expect(body.children).toHaveLength(0);
    expect(marker.remove).toHaveBeenCalledTimes(1); expect(ring.destroy).toHaveBeenCalledTimes(1);
    expect(departures.size).toBe(0); expect(raf.count()).toBe(0); expect(closed).toBe(1);
    await vi.advanceTimersByTimeAsync(20000); expect(resolved).toBe(false);
  });
  it('also disposes on reset before a scene:goto event is emitted', async () => {
    const audio = media(CALL); vi.mocked(voiceover.play).mockReturnValue(audio.playback);
    await begin(); ctx.epoch++; raf.tick(); await flush();
    expect(audio.playback.stop).toHaveBeenCalledTimes(1); expect(body.children).toHaveLength(0);
    expect(marker.remove).toHaveBeenCalledTimes(1); expect(ring.destroy).toHaveBeenCalledTimes(1);
    expect(raf.count()).toBe(0);
  });
  it('does not draw or start a late call after the world dies while the manifest loads', async () => {
    let loaded!: () => void;
    vi.mocked(voiceover.preload).mockReturnValue(new Promise(resolve => { loaded = resolve; }));
    void aimStaff(world, CALL); (world as { alive: boolean }).alive = false; loaded(); await flush();
    expect(body.children).toHaveLength(0); expect(voiceover.play).not.toHaveBeenCalled();
    expect(world.lighting.add).not.toHaveBeenCalled();
  });
});

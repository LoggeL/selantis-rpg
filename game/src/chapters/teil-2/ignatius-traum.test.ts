import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frames, media, TestNode, visibleCharacters } from './voice-ui.testHelpers';
import type { Modal } from '../../ui/context';

vi.mock('../../core/G', () => ({ G: { events: { on: (_event: string, fn: () => void) => { departures.add(fn); return () => departures.delete(fn); } }, audio: { sfx: vi.fn() } } }));
vi.mock('../../ui/context', () => ({ ctx: {
  epoch: 1, stale: () => false, never: () => new Promise(() => {}),
  open: (modal: Modal) => { currentModal = modal; return vi.fn(() => { closed++; currentModal = null; }); },
}, isConfirm: (event: KeyboardEvent) => event.key === 'Enter' }));
vi.mock('./shared', () => ({ ui: () => ({ panel: (cls: string) => body.appendChild(new TestNode('DIV', cls)) }) }));
vi.mock('../../ui/dom', () => ({ el: (tag: string, cls?: string, text?: string) => new TestNode(tag.toUpperCase(), cls, text), blip: vi.fn() }));
vi.mock('../../audio/voiceover', async importOriginal => ({
  ...await importOriginal<typeof import('../../audio/voiceover')>(),
  voiceover: { preload: vi.fn(async () => {}), play: vi.fn(), stop: vi.fn() },
}));
import { voiceover } from '../../audio/voiceover';
import { ctx } from '../../ui/context';
import { playDream, type DreamLine } from './ignatius-traum';

let body: TestNode;
let raf: ReturnType<typeof frames>;
let currentModal: Modal | null;
let closed = 0;
let departures: Set<() => void>;
const flush = async () => { await vi.advanceTimersByTimeAsync(0); };
const press = () => currentModal?.onKey?.({ key: 'Enter', repeat: false } as KeyboardEvent);
const text = () => body.querySelector<TestNode>('.e2-traum-text')!;
const begin = async (speaker: DreamLine['speaker'] = 'e2-kyra') => {
  const result = playDream([{ who: 'Kyra und Flick, im Traum', text: 'Lia …!', speaker }]);
  await flush(); await vi.advanceTimersByTimeAsync(1200); raf.tick();
  return { result };
};

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  vi.stubGlobal('performance', { now: () => Date.now() });
  body = new TestNode(); body.connected = true;
  const head = new TestNode(); head.connected = true;
  vi.stubGlobal('document', { head, createElement: (tag: string) => new TestNode(tag.toUpperCase()), createTextNode: (text: string) => new TestNode('#TEXT', '', text) });
  raf = frames(); vi.stubGlobal('requestAnimationFrame', raf.request); vi.stubGlobal('cancelAnimationFrame', raf.cancel);
  currentModal = null; closed = 0; departures = new Set(); ctx.epoch = 1;
  vi.mocked(voiceover.preload).mockResolvedValue(undefined);
  vi.mocked(voiceover.play).mockReturnValue(null);
});
afterEach(() => { departures.forEach(fn => fn()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('recorded dream voices', () => {
  it('reveals the caption only when the playback clock reaches each word cue', async () => {
    const audio = media('Lia …!'); vi.mocked(voiceover.play).mockReturnValue(audio.playback);
    await begin();
    expect(voiceover.play).toHaveBeenCalledWith('say', 'e2-kyra', 'Lia …!');
    expect(visibleCharacters(text())).toBe('');
    audio.clock(.5); raf.tick(); expect(visibleCharacters(text())).toBe('Lia');
    await vi.advanceTimersByTimeAsync(10000); raf.tick();
    expect(visibleCharacters(text())).toBe('Lia');
    expect(audio.playback.stop).not.toHaveBeenCalled();
    audio.clock(2.5); raf.tick(); expect(visibleCharacters(text())).toBe('Lia…!');
  });
  it('first continue reveals the whole caption; a fresh second continue stops and advances', async () => {
    const audio = media('Lia …!'); vi.mocked(voiceover.play).mockReturnValue(audio.playback);
    const { result } = await begin(['e2-kyra', 'e2-flick']);
    press(); expect(visibleCharacters(text())).toBe('Lia …!');
    expect(audio.playback.stop).not.toHaveBeenCalled();
    press(); expect(audio.playback.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(140); press(); await flush();
    expect(audio.playback.stop).toHaveBeenCalledTimes(1);
    expect(voiceover.play).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(900); await result;
    expect(body.children).toHaveLength(0); expect(closed).toBe(1);
  });
  it('plays Kyra and Flick consecutively beneath one shared dream caption', async () => {
    const kyra = media('Lia …!'), flick = media('Lia …!');
    vi.mocked(voiceover.play).mockReturnValueOnce(kyra.playback).mockReturnValueOnce(flick.playback);
    const { result } = await begin(['e2-kyra', 'e2-flick']);
    expect(voiceover.play).toHaveBeenCalledTimes(1);
    const caption = text(); kyra.finish('ended'); await flush();
    expect(voiceover.play).toHaveBeenNthCalledWith(2, 'say', 'e2-flick', 'Lia …!');
    expect(kyra.playback.outcome).toBe('ended'); expect(flick.playback.outcome).toBe('playing');
    expect(text()).toBe(caption);
    expect(body.querySelector<TestNode>('.e2-traum-who')!.textContent).toBe('Kyra und Flick, im Traum');
    expect(visibleCharacters(caption)).toBe('Lia …!');
    await vi.advanceTimersByTimeAsync(8000);
    expect(body.children).toHaveLength(1); expect(flick.playback.stop).not.toHaveBeenCalled();
    flick.finish('ended'); await flush();
    await vi.advanceTimersByTimeAsync(1500); await result;
    expect(body.children).toHaveLength(0);
  });
  it('keeps a missing or muted recording readable through the ordinary typewriter', async () => {
    const { result } = await begin();
    expect(text().textContent).toBe('Lia …!'); expect(visibleCharacters(text())).toBe('L');
    await vi.advanceTimersByTimeAsync(900); raf.tick(); expect(visibleCharacters(text())).toBe('Lia …!');
    await vi.advanceTimersByTimeAsync(2500); await result;
    expect(body.children).toHaveLength(0);
  });
  it('turns a failed recording into readable fallback without waiting for more audio', async () => {
    const audio = media('Lia …!'); vi.mocked(voiceover.play).mockReturnValue(audio.playback);
    await begin(); audio.finish('failed'); await flush();
    await vi.advanceTimersByTimeAsync(900); raf.tick(); expect(visibleCharacters(text())).toBe('Lia …!');
  });
  it('cancels frames and playback on a scene change without resuming the departed story', async () => {
    const audio = media('Lia …!'); vi.mocked(voiceover.play).mockReturnValue(audio.playback);
    const { result } = await begin(['e2-kyra', 'e2-flick']);
    let resolved = false; void result.then(() => { resolved = true; });
    departures.forEach(fn => fn()); await flush(); raf.tick();
    expect(audio.playback.stop).toHaveBeenCalledTimes(1);
    expect(body.children).toHaveLength(0); expect(departures.size).toBe(0);
    expect(raf.count()).toBe(0); expect(closed).toBe(1);
    await vi.advanceTimersByTimeAsync(20000);
    expect(resolved).toBe(false); expect(voiceover.play).toHaveBeenCalledTimes(1);
  });
  it('also cleans up when reset or title changes the UI epoch before scene:goto', async () => {
    const audio = media('Lia …!'); vi.mocked(voiceover.play).mockReturnValue(audio.playback);
    await begin(); ctx.epoch++; raf.tick(); await flush();
    expect(audio.playback.stop).toHaveBeenCalledTimes(1); expect(body.children).toHaveLength(0);
    expect(departures.size).toBe(0); expect(raf.count()).toBe(0);
  });
  it('cannot start late audio after departure during manifest loading', async () => {
    let loaded!: () => void;
    vi.mocked(voiceover.preload).mockReturnValue(new Promise(resolve => { loaded = resolve; }));
    void playDream([{ who: 'Kyra, im Traum', text: 'Lia …!', speaker: 'e2-kyra' }]);
    ctx.epoch++; loaded(); await flush();
    expect(body.children).toHaveLength(0); expect(voiceover.play).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { settings } from '../core/settings';
import type { VoiceOutcome, VoicePlayback } from '../audio/voiceover';
import { SpeechReveal, speechDisplayWordGroups, validSpeechCues } from './speechReveal';
import { revealSpeech, speechWordCharacterIndices, Typewriter } from './typewriter';

vi.mock('./dom', () => ({ el: (_tag: string, cls?: string, text?: string) => node(cls, text), blip: vi.fn() }));
// Small DOM adapter exercises rendered markup/drop-cap groups without introducing a browser dependency.
interface FakeNode {
  children: FakeNode[]; parent: FakeNode | null; style: object; textContent: string;
  classList: { add(...classes: string[]): void; remove(...classes: string[]): void; contains(cls: string): boolean };
  appendChild(child: FakeNode): FakeNode; prepend(child: FakeNode): void;
}
function node(cls = '', text = ''): FakeNode {
  const classes = new Set(cls.split(' ').filter(Boolean));
  const children: FakeNode[] = [];
  let content = text;
  const result: FakeNode = {
    children, parent: null as FakeNode | null, style: {},
    classList: { add: (...c: string[]) => c.forEach(x => classes.add(x)), remove: (...c: string[]) => c.forEach(x => classes.delete(x)), contains: (c: string) => classes.has(c) },
    appendChild(child: FakeNode) { child.parent = result; children.push(child); return child; },
    prepend(child: FakeNode) {
      if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
      child.parent = result; children.unshift(child);
    },
    get textContent(): string { return content; },
    set textContent(value: string) { content = value; children.length = 0; },
  };
  return result;
}
function media(initiallyStarted = true) {
  let started = initiallyStarted;
  let time = 0;
  let outcome: VoiceOutcome = 'playing';
  let settle!: () => void;
  const playback: VoicePlayback = {
    done: new Promise<void>(resolve => { settle = resolve; }),
    get currentTime() { return time; },
    get started() { return started; },
    wordCues: [{ start: .5, end: 1 }, { start: 4, end: 4.5 }],
    get outcome() { return outcome; },
    stop: () => { outcome = 'stopped'; settle(); },
  };
  return { playback, start: () => { started = true; }, clock: (value: number) => { time = value; }, finish: (value: VoiceOutcome) => { outcome = value; settle(); } };
}
function frames() {
  let id = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const request = vi.fn((callback: FrameRequestCallback) => { callbacks.set(++id, callback); return id; });
  const cancel = vi.fn((handle: number) => { callbacks.delete(handle); });
  const tick = () => { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(999999)); };
  return { request, cancel, tick, pending: () => callbacks.size };
}
afterEach(() => { vi.unstubAllGlobals(); settings.textSpeed = 45; });

describe('speech alignment', () => {
  it('maps only exact omitted parenthetical display controls to adjacent spoken words', () => {
    expect(speechDisplayWordGroups('Ducken, hat er gesagt. (Shift halten)', 'Ducken, hat er gesagt.')).toEqual([[0], [1], [2], [3, 4, 5]]);
    expect(speechDisplayWordGroups('Steinkreis (E) ansehen', 'Steinkreis ansehen')).toEqual([[0, 1], [2]]);
    expect(speechDisplayWordGroups('Die Nacht ist kalt.', 'Die Nacht ist warm.')).toBeNull();
    expect(speechDisplayWordGroups('Drücke Shift und gehe.', 'Drücke und gehe.')).toBeNull();
  });
  it('preserves outside periods and commas when a control ends within their original display token', () => {
    const display = 'Flicks Spuren findest du im Spurenblick (Q halten). Langsam: Deine Beine wollen noch nicht so recht.';
    const spoken = 'Flicks Spuren findest du im Spurenblick. Langsam: Deine Beine wollen noch nicht so recht.';
    expect(speechDisplayWordGroups(display, spoken)).toEqual([
      [0], [1], [2], [3], [4], [5, 6, 7], [8], [9], [10], [11], [12], [13], [14], [15],
    ]);
    expect(speechDisplayWordGroups('Duck dich (C halten), dann lauf.', 'Duck dich, dann lauf.')).toEqual([[0], [1, 2, 3], [4], [5]]);
  });
  it('attaches a leading control to the first spoken word without changing any surviving characters', () => {
    expect(speechDisplayWordGroups('(Q halten) Flicks Spuren.', 'Flicks Spuren.')).toEqual([[0, 1, 2], [3]]);
    expect(speechDisplayWordGroups('Warte\\*wirklich\\* (Q).', 'Warte\\*wirklich\\*.')).toEqual([[0, 1]]);
  });
  it('rejects changed outside punctuation, source words and a retained unrelated parenthetical', () => {
    expect(speechDisplayWordGroups('Warte (Q halten)! Dann gehe.', 'Warte. Dann gehe.')).toBeNull();
    expect(speechDisplayWordGroups('Duck dich (C halten), dann lauf.', 'Duck dich dann lauf.')).toBeNull();
    expect(speechDisplayWordGroups('(Q halten) Flicks Spuren.', 'Kyras Spuren.')).toBeNull();
    expect(speechDisplayWordGroups('Warte (wirklich!), dann gehe. (Q)', 'Warte (wirklich!), dann gehe.')).toBeNull();
  });
  it('reveals the complete actual control caption and its outside period at the Spurenblick cue', () => {
    const text = 'Flicks Spuren findest du im Spurenblick (Q halten). Langsam: Deine Beine wollen noch nicht so recht.';
    const spoken = 'Flicks Spuren findest du im Spurenblick. Langsam: Deine Beine wollen noch nicht so recht.';
    const raf = frames(), audio = media(), host = node();
    vi.stubGlobal('requestAnimationFrame', raf.request); vi.stubGlobal('cancelAnimationFrame', raf.cancel);
    const playback = { ...audio.playback, spokenText: spoken,
      get currentTime() { return audio.playback.currentTime; },
      wordCues: spoken.split(' ').map((_, index) => ({ start: index + .5, end: index + .9 })),
    };
    const fallback = vi.fn(() => ({ done: true, complete() {} }));
    const reveal = revealSpeech(host as unknown as HTMLElement, text, playback, fallback, vi.fn(), () => true);
    const flatten = (n: FakeNode): FakeNode[] => [n, ...n.children.flatMap(flatten)];
    const chars = flatten(host).filter(n => n.classList.contains('tc'));
    const visible = () => chars.filter(n => n.classList.contains('on')).map(n => n.textContent).join('');
    audio.clock(5.49); raf.tick();
    expect(visible()).toBe('FlicksSpurenfindestduim');
    audio.clock(5.5); raf.tick();
    expect(visible()).toBe('FlicksSpurenfindestduimSpurenblick(Qhalten).');
    for (let i = 0; i < 10; i++) raf.tick();
    expect(visible()).not.toContain('Langsam');
    audio.clock(6.5); raf.tick();
    expect(visible()).toBe('FlicksSpurenfindestduimSpurenblick(Qhalten).Langsam:');
    expect(fallback).not.toHaveBeenCalled();
    reveal.cancel?.(); expect(raf.pending()).toBe(0);
  });
  it('calls native global frame functions without passing the reveal instance as their receiver', () => {
    const raf = frames(), audio = media(), showWord = vi.fn();
    vi.stubGlobal('requestAnimationFrame', function (this: unknown, callback: FrameRequestCallback) {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal native receiver');
      return raf.request(callback);
    });
    vi.stubGlobal('cancelAnimationFrame', function (this: unknown, id: number) {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal native receiver');
      raf.cancel(id);
    });
    const reveal = new SpeechReveal({ playback: audio.playback, cues: audio.playback.wordCues!,
      showWord, showAll: vi.fn(), onDone: vi.fn(), fallback: vi.fn(), stopped: vi.fn() });
    audio.clock(.5); raf.tick(); expect(showWord).toHaveBeenCalledWith(0);
    reveal.complete(); expect(raf.pending()).toBe(0);
  });
  it('validates full word coverage and ordered real timestamps rather than duration guesses', () => {
    expect(validSpeechCues('*Warm.*\n Wie', [{ start: .5, end: 1 }, { start: 4, end: 4.5 }])).toBe(true);
    expect(validSpeechCues('Warm. Wie', undefined)).toBe(false);
    expect(validSpeechCues('Warm. Wie', [{ start: 0, end: 1 }])).toBe(false);
    expect(validSpeechCues('Warm. Wie', [{ start: 2, end: 3 }, { start: 1, end: 2 }])).toBe(false);
    expect(validSpeechCues('Warm.', [{ start: 0, end: Number.NaN }])).toBe(false);
  });
  it('keeps split markup within one spoken word and treats line breaks as whitespace', () => {
    expect(speechWordCharacterIndices('W*ar*m.\nWie ~Licht~')).toEqual([[0, 1, 2, 3, 4], [5, 6, 7], [9, 10, 11, 12, 13]]);
  });
  it('follows media time across a large pause, independent of RAF or wall time', async () => {
    const audio = media(), raf = frames();
    const showWord = vi.fn(), showAll = vi.fn(), onDone = vi.fn();
    const reveal = new SpeechReveal({ playback: audio.playback, cues: audio.playback.wordCues!, showWord, showAll, onDone, fallback: vi.fn(), stopped: vi.fn(), requestFrame: raf.request, cancelFrame: raf.cancel });
    raf.tick(); expect(showWord).not.toHaveBeenCalled();
    audio.clock(.5); raf.tick(); expect(showWord.mock.calls).toEqual([[0]]);
    for (let n = 0; n < 20; n++) raf.tick(); // paused/buffering clock, even though RAF keeps running
    expect(showWord.mock.calls).toEqual([[0]]);
    audio.clock(3.99); raf.tick(); expect(showWord.mock.calls).toEqual([[0]]);
    audio.clock(4); raf.tick(); expect(showWord.mock.calls).toEqual([[0], [1]]);
    expect(reveal.done).toBe(false);
    audio.finish('ended'); await audio.playback.done; await Promise.resolve();
    expect(showAll).toHaveBeenCalledOnce(); expect(onDone).toHaveBeenCalledOnce(); expect(raf.pending()).toBe(0);
  });
  it('keeps cue zero invisible while autoplay is pending, then reveals only after actual start', () => {
    const audio = media(false), raf = frames(), showWord = vi.fn();
    const reveal = new SpeechReveal({ playback: audio.playback, cues: [{ start: 0, end: 1 }, { start: 4, end: 5 }], showWord, showAll: vi.fn(), onDone: vi.fn(), fallback: vi.fn(), stopped: vi.fn(), requestFrame: raf.request, cancelFrame: raf.cancel });
    for (let n = 0; n < 30; n++) raf.tick();
    expect(showWord).not.toHaveBeenCalled();
    audio.start(); raf.tick(); expect(showWord.mock.calls).toEqual([[0]]);
    reveal.cancel(); expect(raf.pending()).toBe(0);
  });
  it('first skip reveals all and cancels synchronizing without stopping the audio', async () => {
    const audio = media(), raf = frames(); const showAll = vi.fn(), fallback = vi.fn();
    const reveal = new SpeechReveal({ playback: audio.playback, cues: audio.playback.wordCues!, showWord: vi.fn(), showAll, onDone: vi.fn(), fallback, stopped: vi.fn(), requestFrame: raf.request, cancelFrame: raf.cancel });
    reveal.complete(); reveal.complete();
    expect(showAll).toHaveBeenCalledOnce(); expect(audio.playback.outcome).toBe('playing'); expect(raf.pending()).toBe(0);
    audio.finish('failed'); await audio.playback.done; await Promise.resolve(); expect(fallback).not.toHaveBeenCalled();
  });
  it('failures and scene stops remove the synchronization frame and cannot update a cancelled reveal', async () => {
    for (const outcome of ['failed', 'stopped'] as const) {
      const audio = media(), raf = frames(); const fallback = vi.fn(), stopped = vi.fn();
      new SpeechReveal({ playback: audio.playback, cues: audio.playback.wordCues!, showWord: vi.fn(), showAll: vi.fn(), onDone: vi.fn(), fallback, stopped, requestFrame: raf.request, cancelFrame: raf.cancel });
      audio.finish(outcome); await audio.playback.done; await Promise.resolve();
      expect(raf.pending()).toBe(0); expect(outcome === 'failed' ? fallback : stopped).toHaveBeenCalledOnce();
    }
    const audio = media(), raf = frames(), showWord = vi.fn(), fallback = vi.fn();
    const reveal = new SpeechReveal({ playback: audio.playback, cues: audio.playback.wordCues!, showWord, showAll: vi.fn(), onDone: vi.fn(), fallback, stopped: vi.fn(), requestFrame: raf.request, cancelFrame: raf.cancel });
    reveal.cancel(); audio.clock(100); raf.tick(); audio.finish('failed'); await audio.playback.done; await Promise.resolve();
    expect(showWord).not.toHaveBeenCalled(); expect(fallback).not.toHaveBeenCalled();
  });
  it('overrides text speed Sofort and keeps drop cap plus styled remainder hidden until their shared first cue', () => {
    const raf = frames(), audio = media(), host = node();
    vi.stubGlobal('requestAnimationFrame', raf.request); vi.stubGlobal('cancelAnimationFrame', raf.cancel);
    settings.textSpeed = 0;
    const fallback = vi.fn(() => new Typewriter(host as unknown as HTMLElement, 'W*arm.* Wie'));
    const reveal = revealSpeech(host as unknown as HTMLElement, 'W*arm.* Wie', audio.playback, fallback, vi.fn(), () => true, true);
    const flattened = (n: FakeNode): FakeNode[] => [n, ...n.children.flatMap(flattened)];
    const chars = flattened(host).filter(n => n.classList.contains('tc'));
    expect(chars.some(n => n.classList.contains('on'))).toBe(false);
    expect(fallback).not.toHaveBeenCalled(); expect(reveal.done).toBe(false);
    expect(host.children[0].classList.contains('drop-cap')).toBe(true);
    audio.clock(.49); raf.tick(); expect(chars.some(n => n.classList.contains('on'))).toBe(false);
    audio.clock(.5); raf.tick(); expect(chars.filter(n => n.classList.contains('on')).map(n => n.textContent).join('')).toBe('Warm.');
    expect(chars.find(n => n.textContent === 'i')!.classList.contains('on')).toBe(false);
    reveal.cancel?.(); expect(raf.pending()).toBe(0);
  });
  it('falls back on missing timing, autoplay rejection and muted playback without hanging', async () => {
    const raf = frames(); vi.stubGlobal('requestAnimationFrame', raf.request); vi.stubGlobal('cancelAnimationFrame', raf.cancel);
    const fallback = vi.fn(() => ({ done: true, complete: vi.fn() }));
    const host = node() as unknown as HTMLElement;
    const missing = { ...media().playback, wordCues: undefined };
    expect(revealSpeech(host, 'Warm. Wie', missing, fallback, vi.fn(), () => true).done).toBe(true);
    expect(revealSpeech(host, 'Warm. Wie', null, fallback, vi.fn(), () => true).done).toBe(true);
    const audio = media();
    const reveal = revealSpeech(host, 'Warm. Wie', audio.playback, fallback, vi.fn(), () => true);
    audio.finish('failed'); await audio.playback.done; await Promise.resolve();
    expect(reveal.done).toBe(true); expect(fallback).toHaveBeenCalledTimes(3); expect(raf.pending()).toBe(0);
  });
});

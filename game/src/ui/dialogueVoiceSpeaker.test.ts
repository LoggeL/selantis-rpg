import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceover } from '../audio/voiceover';
import { DialogueUi } from './dialogue';

const gate = vi.hoisted(() => ({ press: undefined as (() => void) | undefined }));

vi.mock('../core/G', () => ({ G: { settings: { textSpeed: 35 } } }));
vi.mock('./context', () => ({
  ctx: { epoch: 1, stale: () => false, onLayout() {}, layers: { dialog: { appendChild() {} } } },
  isConfirm: () => false,
}));
vi.mock('./dom', () => ({ el: () => node(), dialogueFocus() {}, sfx() {} }));
vi.mock('./typewriter', () => ({
  renderChars: () => [], Typewriter: class {},
  revealSpeech: (_element: unknown, _text: string, _recording: unknown, _fallback: unknown, done: () => void) => {
    done(); return { done: true, complete() {} };
  },
}));
vi.mock('./advance', () => ({
  advanceGate: (_id: string, press: () => void) => { gate.press = press; return { close() {} }; },
}));

// These tests exercise DialogueUi's actual speaker routing; the DOM/typewriter lifecycle has separate tests.
function node() {
  return {
    isConnected: true, parentElement: null,
    classList: { add() {}, remove() {}, toggle() {} },
    style: { setProperty() {} },
    append() {}, appendChild() {}, setAttribute() {}, remove() {},
    innerHTML: '', textContent: '',
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('requestAnimationFrame', () => 1);
  gate.press = undefined;
  vi.spyOn(voiceover, 'preload').mockResolvedValue();
  vi.spyOn(voiceover, 'play').mockReturnValue(null);
  vi.spyOn(voiceover, 'playerSpeaker').mockReturnValue('kyra');
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('thought speaker routing', () => {
  it('uses the explicitly supplied current actor instead of the scene fallback', async () => {
    const ui = new DialogueUi();
    const done = ui.think('Der Ring im Boden wackelt.', { speaker: 'e2-elnon-gefangen' });
    await Promise.resolve(); await Promise.resolve();
    expect(voiceover.play).toHaveBeenCalledWith('think', 'e2-elnon-gefangen', 'Der Ring im Boden wackelt.');
    expect(voiceover.playerSpeaker).not.toHaveBeenCalled();
    vi.advanceTimersByTime(160); gate.press?.();
    await done;
  });

  it('preserves the scene player fallback for plain UI calls without a world speaker', async () => {
    const ui = new DialogueUi();
    const done = ui.think('Was für ein Ort.');
    await Promise.resolve(); await Promise.resolve();
    expect(voiceover.play).toHaveBeenCalledWith('think', 'kyra', 'Was für ein Ort.');
    expect(voiceover.playerSpeaker).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(160); gate.press?.();
    await done;
  });
});

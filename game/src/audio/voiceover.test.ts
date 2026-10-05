import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeVoiceText, quotedChoiceText, VoiceIndex, Voiceover, type VoiceManifest } from './voiceover';

const manifest: VoiceManifest = {
  model: 'test', aliases: { elder: 'valentus' }, clips: [{
    id: 'one', kind: 'say', speaker: 'valentus', text: 'Warm. Wie ein Herzschlag.',
    audio: 'audio/prolog/clips/one.mp3', seconds: 2,
    runtime_keys: [
      { kind: 'say', speaker: 'valentus', text: 'Warm. Wie ein Herzschlag.' },
      { kind: 'choice', speaker: 'valentus', text: 'Warm.' },
      { kind: 'bark', speaker: 'valentus', text: 'Warm.' },
    ],
  }],
};
class FakeAudio extends EventTarget {
  volume = 1;
  preload = '';
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();
  remove = vi.fn();
}
function fixture() {
  const audios: FakeAudio[] = [];
  let volume = .9;
  const engine = new Voiceover({
    audio: () => { const audio = new FakeAudio(); audios.push(audio); return audio as unknown as HTMLAudioElement; },
    fetchManifest: async () => manifest,
    volume: () => volume, now: () => 10000,
  });
  return { engine, audios, setVolume: (v: number) => { volume = v; engine.refreshVolume(); } };
}
afterEach(() => vi.useRealTimers());

describe('voice runtime lookup', () => {
  it('uses the actual UI markup parser and whitespace rules without deleting literal characters', () => {
    expect(normalizeVoiceText('*Warm.*\n Wie ein ~Herzschlag.~')).toBe('Warm. Wie ein Herzschlag.');
    expect(normalizeVoiceText('5 * 3')).toBe('5 * 3');
    expect(normalizeVoiceText('\\*ja\\*')).toBe('*ja*');
    const index = new VoiceIndex(manifest);
    expect(index.find('say', 'elder', '*Warm.*  Wie ein Herzschlag.')?.id).toBe('one');
    expect(index.find('think', 'valentus', 'Warm. Wie ein Herzschlag.')).toBeUndefined();
    expect(index.find('say', 'gira', 'Warm. Wie ein Herzschlag.')).toBeUndefined();
  });
  it('speaks only quoted selected words and leaves menu labels silent', () => {
    expect(quotedChoiceText('„Warm.“ (antworten)')).toBe('Warm.');
    expect(quotedChoiceText('"Warm."')).toBe('Warm.');
    expect(quotedChoiceText('Ins Haus gehen')).toBeNull();
  });
  it('does not accept remote or traversing audio URLs', () => {
    for (const audio of ['https://elsewhere/one.mp3', 'audio/prolog/../private.mp3']) {
      expect(new VoiceIndex({ ...manifest, clips: [{ ...manifest.clips[0], audio }] }).find('say', 'valentus', manifest.clips[0].text)).toBeUndefined();
    }
  });
});

describe('voice playback lifecycle', () => {
  it('preloads once and gates playback to prolog scenes', async () => {
    const { engine, audios } = fixture();
    await engine.preload();
    expect(engine.play('say', 'valentus', manifest.clips[0].text)).toBeNull();
    engine.scene('prolog-rat');
    const line = engine.play('say', 'valentus', manifest.clips[0].text)!;
    expect(audios[0].volume).toBe(.9);
    engine.scene('wiese');
    await line.done;
    expect(audios[0].pause).toHaveBeenCalledOnce();
    expect(audios[0].remove).toHaveBeenCalledOnce();
    expect(engine.play('say', 'valentus', manifest.clips[0].text)).toBeNull();
  });
  it('exposes actual playback start only after native play resolves and never restarts a skipped pending clip', async () => {
    let begin!: () => void;
    const pending = new Promise<void>(resolve => { begin = resolve; });
    const audio = new FakeAudio(); audio.play.mockReturnValueOnce(pending);
    const engine = new Voiceover({ audio: () => audio as unknown as HTMLAudioElement, fetchManifest: async () => manifest, volume: () => .9, now: () => 1 });
    await engine.preload(); engine.scene('prolog-rat');
    const playback = engine.play('say', 'valentus', manifest.clips[0].text)!;
    expect(playback.started).toBe(false);
    playback.stop(); begin(); await playback.done; await Promise.resolve();
    expect(playback.started).toBe(false); expect(playback.outcome).toBe('stopped');
    const next = engine.play('say', 'valentus', manifest.clips[0].text)!;
    await Promise.resolve(); expect(next.started).toBe(true);
    audio.dispatchEvent(new Event('ended')); await next.done; expect(next.outcome).toBe('ended');
  });
  it('stops even when the next line has no recording; barks cannot interrupt dialogue', async () => {
    const { engine, audios } = fixture(); await engine.preload(); engine.scene('prolog-rat');
    const line = engine.play('say', 'valentus', manifest.clips[0].text)!;
    expect(engine.play('bark', 'valentus', 'Warm.')).toBeNull();
    expect(engine.play('say', 'valentus', 'Missing.')).toBeNull();
    await line.done;
    expect(audios).toHaveLength(1);
  });
  it('settles errors, autoplay refusal, skipping and stalled files without blocking a choice', async () => {
    vi.useFakeTimers();
    const { engine, audios } = fixture(); await engine.preload(); engine.scene('prolog-rat');
    const failed = engine.play('choice', 'valentus', 'Warm.')!;
    audios[0].dispatchEvent(new Event('error')); await failed.done;
    const skipped = engine.play('choice', 'valentus', 'Warm.')!;
    skipped.stop(); skipped.stop(); await skipped.done;
    expect(audios[1].pause).toHaveBeenCalledOnce();
    expect(audios[1].remove).toHaveBeenCalledOnce();
    const stalled = engine.play('choice', 'valentus', 'Warm.')!;
    await vi.advanceTimersByTimeAsync(10000); await stalled.done;
    expect(audios[2].pause).toHaveBeenCalledOnce();
    const fallback = vi.fn();
    const blocked = new Voiceover({ audio: () => {
      const audio = new FakeAudio(); audio.play.mockRejectedValueOnce(new Error('autoplay'));
      return audio as unknown as HTMLAudioElement;
    }, fetchManifest: async () => manifest, volume: () => .9, now: () => 1 });
    await blocked.preload(); blocked.scene('prolog-rat');
    await blocked.play('choice', 'valentus', 'Warm.', fallback)!.done;
    expect(fallback).toHaveBeenCalledOnce();
  });
  it('applies live voice volume independently and limits repeated ambient barks', async () => {
    const { engine, audios, setVolume } = fixture(); await engine.preload(); engine.scene('prolog-rat');
    const bark = engine.play('bark', 'valentus', 'Warm.')!;
    setVolume(.3); expect(audios[0].volume).toBe(.3);
    bark.stop(); await bark.done;
    expect(engine.play('bark', 'valentus', 'Warm.')).toBeNull();
    setVolume(0); expect(engine.play('say', 'valentus', manifest.clips[0].text)).toBeNull();
  });
  it('unavailable manifests keep ordinary dialogue available', async () => {
    const engine = new Voiceover({ audio: () => { throw new Error('not reached'); }, fetchManifest: async () => { throw new Error('404'); }, volume: () => .9, now: () => 1 });
    engine.scene('prolog-rat'); await engine.preload();
    expect(engine.play('choice', 'valentus', 'Warm.')).toBeNull();
  });
});

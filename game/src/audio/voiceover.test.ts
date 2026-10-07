import { CapturedMediaRoutingError } from './recordedMediaRouting';
import recordedProlog from '../../public/audio/prolog/manifest.json';
import frozenStory from '../../../docs/voice-production/story-lines.json';
import frozenPart2 from '../../../docs/voice-production/teil-2/lines.json';
import { afterEach, describe, expect, it, vi } from 'vitest';
import part2SharedSource from '../chapters/teil-2/shared.ts?raw';
import { normalizeVoiceText, part2VoiceScenes, quotedChoiceText, voiceBankForScene, VoiceIndex, Voiceover, type VoiceManifest } from './voiceover';

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

describe('isolated Teil-II voice bank', () => {
  it('resolves every actual frozen Teil-II Source route with the real runtime selectors', () => {
    const clips = frozenPart2.lines.map(line => ({ ...line, audio: `audio/teil-2/${line.id}.mp3`, seconds: 1 }));
    const index = new VoiceIndex({ model: frozenPart2.model, aliases: frozenPart2.aliases,
      scene_players: frozenPart2.scene_players, clips } as unknown as VoiceManifest, 'teil-2');
    expect(frozenPart2.lines).toHaveLength(1401);
    expect(frozenPart2.runtime_lookup).toHaveLength(1408);
    for (const route of frozenPart2.runtime_lookup) {
      const kind = route.kind as 'say' | 'think' | 'narrate' | 'bark' | 'choice';
      expect(index.find(kind, route.speaker, route.text, route.scene,
        route.mood === 'neutral' ? undefined : route.mood)?.id,
      `${route.kind}/${route.scene}/${route.speaker}/${route.mood}`).toBe(route.asset_id);
    }
    expect(index.player('e2-aufbruch')).toBeUndefined();
  });
  it('covers the exact registered scene list and does not route arbitrary e2 names into the bank', () => {
    const declaration = part2SharedSource.match(/export const E2_SCENES = \[([\s\S]*?)\] as const;/)?.[1];
    const registered = [...(declaration ?? '').matchAll(/'(e2-[a-z-]+)'/g)].map(match => match[1]);
    expect(registered).toHaveLength(18);
    expect(part2VoiceScenes).toEqual(registered);
    for (const scene of registered) expect(voiceBankForScene(scene)).toBe('teil-2');
    expect(voiceBankForScene('e2-unregistered')).toBe('story');
    expect(voiceBankForScene('prolog-rat')).toBe('prolog');
    expect(voiceBankForScene('wiese')).toBe('story');
  });
  it('uses the dedicated bank, preserves player aliases, and never borrows missing takes from Story', async () => {
    const part2: VoiceManifest = { model: 'test', aliases: { 'e2-lia': 'lia' }, scene_players: { 'e2-taverne': 'lia' },
      clips: [{ ...manifest.clips[0], id: 'part2-one', speaker: 'lia', audio: 'audio/teil-2/part2-one.mp3',
        runtime_keys: [{ kind: 'say', speaker: 'lia', text: 'Weiter.', scene: 'e2-taverne' }] }] };
    const story: VoiceManifest = { model: 'test', aliases: {}, clips: [{ ...part2.clips[0], id: 'old-story',
      audio: 'audio/story/old-story.mp3', runtime_keys: [{ kind: 'say', speaker: 'lia', text: 'Nur im alten Buch.' }] }] };
    const fetchManifest = vi.fn(async (bank: string) => bank === 'teil-2' ? part2 : story);
    const urls: string[] = [];
    const engine = new Voiceover({ audio: url => { urls.push(url); return new FakeAudio() as unknown as HTMLAudioElement; },
      fetchManifest, volume: () => .9, now: () => 1 });
    await engine.preload('story'); await engine.preload('teil-2');
    engine.scene('e2-taverne');
    expect(engine.playerSpeaker()).toBe('lia');
    const playing = engine.play('say', 'e2-lia', 'Weiter.')!;
    expect(playing).not.toBeNull(); expect(urls).toEqual(['/audio/teil-2/part2-one.mp3']);
    expect(engine.play('say', 'lia', 'Nur im alten Buch.')).toBeNull();
    await playing.done;
    expect(fetchManifest).toHaveBeenCalledTimes(2);
    expect(new VoiceIndex(story, 'teil-2').find('say', 'lia', 'Nur im alten Buch.')).toBeUndefined();
  });
  it('uses the current world player for mixed Teil-II scenes while retaining Story/Prolog players', async () => {
    let current = 'e2-flick';
    const resolve = vi.fn((_scene: string): string | undefined => current);
    const banks: Record<string, VoiceManifest> = {
      'teil-2': { model: 'test', aliases: {}, scene_players: { 'e2-taverne': 'lia' }, clips: [] },
      story: { model: 'test', aliases: {}, scene_players: { kyra: 'kyra' }, clips: [] },
      prolog: manifest,
    };
    const engine = new Voiceover({ audio: () => new FakeAudio() as unknown as HTMLAudioElement,
      fetchManifest: async bank => banks[bank], playerSpeaker: resolve, volume: () => .9, now: () => 1 });
    await engine.preload('teil-2'); await engine.preload('story'); await engine.preload('prolog');
    engine.scene('e2-aufbruch'); expect(engine.playerSpeaker()).toBe('e2-flick');
    current = 'e2-lia'; expect(engine.playerSpeaker()).toBe('e2-lia');
    expect(resolve).toHaveBeenLastCalledWith('e2-aufbruch');
    resolve.mockReturnValue(undefined);
    expect(engine.playerSpeaker()).toBe('');
    engine.scene('kyra'); expect(engine.playerSpeaker()).toBe('kyra');
    engine.scene('prolog-rat'); expect(engine.playerSpeaker()).toBe('valentus');
    expect(resolve).toHaveBeenCalledTimes(3);
  });
});

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
  it('keeps a paused recording alive beyond its watchdog and resumes with only the remaining deadline', async () => {
    vi.useFakeTimers();
    const audio = new FakeAudio();
    const engine = new Voiceover({ audio: () => audio as unknown as HTMLAudioElement, fetchManifest: async () => manifest, volume: () => .9, now: () => Date.now() });
    await engine.preload(); engine.scene('prolog-rat');
    const playback = engine.play('say', 'valentus', manifest.clips[0].text)!;
    await vi.advanceTimersByTimeAsync(4000);
    engine.setPaused(true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(playback.outcome).toBe('playing');
    expect(audio.pause).toHaveBeenCalledOnce();
    engine.setPaused(false);
    expect(audio.play).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5999);
    expect(playback.outcome).toBe('playing');
    await vi.advanceTimersByTimeAsync(1);
    await playback.done;
    expect(playback.outcome).toBe('failed');
  });
  it('holds a new recording behind a menu and does not restart it after mute or a scene change', async () => {
    const { engine, audios, setVolume } = fixture();
    await engine.preload(); engine.scene('prolog-rat'); engine.setPaused(true);
    const muted = engine.play('say', 'valentus', manifest.clips[0].text)!;
    expect(audios[0].play).not.toHaveBeenCalled();
    expect(muted.started).toBe(false);
    setVolume(0); await muted.done; engine.setPaused(false);
    expect(audios[0].play).not.toHaveBeenCalled();
    setVolume(.9); engine.setPaused(true);
    const oldScene = engine.play('say', 'valentus', manifest.clips[0].text)!;
    engine.scene('prolog-flucht'); await oldScene.done; engine.setPaused(false);
    expect(audios[1].play).not.toHaveBeenCalled();
    expect(oldScene.outcome).toBe('stopped');
  });
  it('ignores a pending native play abort caused by pause and handles a real resume refusal', async () => {
    let refuse!: (error: Error) => void;
    const audio = new FakeAudio();
    audio.play.mockReturnValueOnce(new Promise<void>((_, reject) => { refuse = reject; }));
    const fallback = vi.fn();
    const engine = new Voiceover({ audio: () => audio as unknown as HTMLAudioElement, fetchManifest: async () => manifest, volume: () => .9, now: () => Date.now() });
    await engine.preload(); engine.scene('prolog-rat');
    const playback = engine.play('say', 'valentus', manifest.clips[0].text, fallback)!;
    engine.setPaused(true); engine.setPaused(false);
    refuse(new Error('AbortError')); await Promise.resolve(); await Promise.resolve();
    expect(playback.outcome).toBe('playing'); expect(playback.started).toBe(true);
    expect(fallback).not.toHaveBeenCalled();
    engine.setPaused(true); audio.play.mockRejectedValueOnce(new Error('NotAllowedError'));
    engine.setPaused(false); await playback.done;
    expect(playback.outcome).toBe('failed'); expect(fallback).toHaveBeenCalledOnce();
  });
  it('unavailable manifests keep ordinary dialogue available', async () => {
    const engine = new Voiceover({ audio: () => { throw new Error('not reached'); }, fetchManifest: async () => { throw new Error('404'); }, volume: () => .9, now: () => 1 });
    engine.scene('prolog-rat'); await engine.preload();
    expect(engine.play('choice', 'valentus', 'Warm.')).toBeNull();
  });
});


describe('story bank and authored routing', () => {
  const clip = (id: string, speaker: string, scene?: string, mood?: string) => ({
    ...manifest.clips[0], id, speaker, audio: `audio/story/clips/${id}.mp3`,
    runtime_keys: [{ kind: 'say' as const, speaker, text: 'Weiter.', scene, mood }],
  });
  it('matches authored scene and mood, keeps the exact generic fallback and rejects ambiguous variants', () => {
    const index = new VoiceIndex({ model: 'test', aliases: {}, clips: [clip('generic', 'lia'), clip('sad', 'lia', 'eber', 'sad'), clip('fear', 'lia', 'eber', 'scared')] }, 'story');
    expect(index.find('say', 'lia', 'Weiter.', 'eber', 'sad')?.id).toBe('sad');
    expect(index.find('say', 'lia', 'Weiter.', 'eber', 'scared')?.id).toBe('fear');
    expect(index.find('say', 'lia', 'Weiter.', 'other')?.id).toBe('generic');
    const ambiguous = new VoiceIndex({ model: 'test', aliases: {}, clips: [clip('one', 'lia', 'eber'), clip('two', 'lia', 'eber')] }, 'story');
    expect(ambiguous.find('say', 'lia', 'Weiter.', 'eber')).toBeUndefined();
  });
  it('separates adult Baris from the prolog alias and derives Lia/Kyra from authoritative scene players', async () => {
    const audios: FakeAudio[] = [];
    const prolog = { model: 'test', aliases: { baris: 'baris-young' }, clips: [{ ...clip('young', 'baris-young'), audio: 'audio/prolog/clips/young.mp3' }] };
    const story = { model: 'test', aliases: { 'lia-cloak': 'lia' }, scene_players: { eber: 'lia', kyra: 'kyra' }, clips: [clip('adult', 'baris')] };
    const fetchManifest = vi.fn(async (bank: string) => bank === 'prolog' ? prolog : story);
    const engine = new Voiceover({ audio: () => { const audio = new FakeAudio(); audios.push(audio); return audio as unknown as HTMLAudioElement; }, fetchManifest, volume: () => .9, now: () => 1 });
    await engine.preload('prolog'); await engine.preload('story'); await engine.preload('story');
    expect(fetchManifest).toHaveBeenCalledTimes(2);
    engine.scene('prolog-rat'); expect(engine.playerSpeaker()).toBe('valentus');
    const young = engine.play('say', 'baris', 'Weiter.')!; expect(young).not.toBeNull();
    engine.scene('eber'); await young.done; expect(engine.playerSpeaker()).toBe('lia');
    expect(engine.play('say', 'baris', 'Weiter.')).not.toBeNull();
    expect(engine.play('say', 'baris-young', 'Weiter.')).toBeNull();
    engine.scene('kyra'); expect(engine.playerSpeaker()).toBe('kyra');
    engine.scene('unknown'); expect(engine.playerSpeaker()).toBe('');
  });
  it('scripted voice bubbles bypass ambient cooldown but never displace dialogue', async () => {
    const { engine } = fixture(); await engine.preload(); engine.scene('prolog-rat');
    const first = engine.play('bark', 'valentus', 'Warm.', undefined, undefined, true)!;
    first.stop(); await first.done;
    const second = engine.play('bark', 'valentus', 'Warm.', undefined, undefined, true)!;
    expect(second).not.toBeNull();
    const dialogue = engine.play('say', 'valentus', manifest.clips[0].text)!;
    await second.done;
    expect(engine.play('bark', 'valentus', 'Warm.', undefined, undefined, true)).toBeNull();
    dialogue.stop();
  });
});


describe('frozen production inventory compatibility', () => {
  it('treats an omitted UI mood as neutral, preserving explicit authored moods', () => {
    const make = (id: string, mood: string) => ({
      ...manifest.clips[0], id, audio: `audio/story/clips/${id}.mp3`,
      runtime_keys: [{ kind: 'say' as const, speaker: 'lia', text: 'Weiter.', scene: 'eber', mood }],
    });
    const index = new VoiceIndex({ model: 'test', aliases: {}, clips: [make('neutral', 'neutral'), make('pained', 'pained')] }, 'story');
    expect(index.find('say', 'lia', 'Weiter.', 'eber')?.id).toBe('neutral');
    expect(index.find('say', 'lia', 'Weiter.', 'eber', 'pained')?.id).toBe('pained');
    const neutralOnly = new VoiceIndex({ model: 'test', aliases: {}, clips: [make('neutral', 'neutral')] }, 'story');
    expect(neutralOnly.find('say', 'lia', 'Weiter.', 'eber', 'pained')).toBeUndefined();
  });
  it('resolves every frozen runtime key and all scoped runtime aliases using real authored selectors', () => {
    const clips = frozenStory.lines.map(line => ({
      ...line, audio: `audio/story/clips/${line.id}.mp3`, seconds: 1,
    }));
    const index = new VoiceIndex({ model: frozenStory.model, aliases: frozenStory.aliases,
      scene_players: frozenStory.scene_players, clips } as unknown as VoiceManifest, 'story');
    expect(frozenStory.lines).toHaveLength(1576);
    expect(frozenStory.runtime_lookup).toHaveLength(1770);
    expect(Object.keys(frozenStory.aliases)).toHaveLength(67);
    for (const route of frozenStory.runtime_lookup) {
      const mood = route.mood === 'neutral' ? undefined : route.mood;
      const kind = route.kind as 'say' | 'think' | 'narrate' | 'bark' | 'choice';
      expect(index.find(kind, route.speaker, route.text, route.scene, mood)?.id,
        `${route.kind}/${route.scene}/${route.speaker}/${route.mood}`).toBe(route.asset_id);
      for (const [alias, canonical] of Object.entries(frozenStory.aliases)) {
        if (canonical === route.speaker) expect(index.find(kind, alias, route.text, route.scene, mood)?.id, alias).toBe(route.asset_id);
      }
    }
    expect(frozenStory.aliases['lia-cloak']).toBe('lia');
    expect(frozenStory.aliases['kyra-bound']).toBe('kyra');
    expect(frozenStory.aliases.baris).not.toBe('baris-young');
  });
});


describe('recorded prolog bank compatibility', () => {
  it('resolves all actual 188 clip mappings and preserves one word cue per spoken word', () => {
    const index = new VoiceIndex(recordedProlog as VoiceManifest, 'prolog');
    expect(recordedProlog.clips).toHaveLength(188);
    for (const clip of recordedProlog.clips) {
      expect(clip.word_cues, clip.id).toHaveLength(normalizeVoiceText(clip.text).split(' ').filter(Boolean).length);
      for (const runtime of clip.runtime_keys) {
        expect(index.find(runtime.kind as 'say' | 'think' | 'narrate' | 'bark' | 'choice', runtime.speaker, runtime.text)?.id,
          `${clip.id}/${runtime.kind}/${runtime.speaker}`).toBe(clip.id);
      }
    }
  });
  it('uses the real prolog Baris-young alias without leaking it into adult story Baris', () => {
    expect(recordedProlog.aliases.baris).toBe('baris-young');
    expect(frozenStory.aliases.baris).toBe('baris');
    const youngIndex = new VoiceIndex(recordedProlog as VoiceManifest, 'prolog');
    const young = recordedProlog.clips.find(clip => clip.speaker === 'baris-young')!;
    const youngKey = young.runtime_keys[0];
    expect(youngIndex.find(youngKey.kind as 'say' | 'think' | 'narrate' | 'bark' | 'choice', 'baris', youngKey.text)?.speaker).toBe('baris-young');
    const adultLine = frozenStory.lines.find(line => line.speaker === 'baris')!;
    const storyIndex = new VoiceIndex({ model: frozenStory.model, aliases: frozenStory.aliases,
      clips: [{ ...adultLine, seconds: 1, audio: `audio/story/clips/${adultLine.id}.mp3` }] } as unknown as VoiceManifest, 'story');
    const adultKey = adultLine.runtime_keys[0];
    expect(storyIndex.find(adultKey.kind as 'say' | 'think' | 'narrate' | 'bark' | 'choice', 'baris', adultKey.text, adultKey.scene, adultKey.mood)?.speaker).toBe('baris');
  });
});

describe('foreground recorded voice direction', () => {
  it('updates a moving pan only after actual playback starts and stops the frame/route without seeking media', async () => {
    let begin!: () => void;
    const audio = new FakeAudio(); audio.play.mockReturnValueOnce(new Promise(resolve => { begin = resolve; }));
    Object.assign(audio, { currentTime: 2.5 });
    const route = { setPan: vi.fn(), disconnect: vi.fn() };
    let frame!: FrameRequestCallback;
    const requestFrame = vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; });
    const cancelFrame = vi.fn();
    let pan = -.8;
    const engine = new Voiceover({ audio: () => audio as unknown as HTMLAudioElement,
      fetchManifest: async () => manifest, volume: () => .6, now: () => 1,
      routeMedia: () => route, requestFrame, cancelFrame });
    await engine.preload(); engine.scene('prolog-rat');
    const playback = engine.play('bark', 'valentus', 'Warm.', undefined, undefined, true, () => pan)!;
    expect(requestFrame).not.toHaveBeenCalled(); expect(route.setPan).not.toHaveBeenCalled();
    begin(); await Promise.resolve(); frame(0); expect(route.setPan).toHaveBeenLastCalledWith(-.8);
    pan = .6; frame(16); expect(route.setPan).toHaveBeenLastCalledWith(.6);
    expect(playback.currentTime).toBe(2.5); expect(audio.volume).toBe(.6);
    playback.stop(); await playback.done;
    expect(route.disconnect).toHaveBeenCalledOnce(); expect(cancelFrame).toHaveBeenCalledWith(1);
    frame(32); expect(route.setPan).toHaveBeenCalledTimes(2);
  });
  it('keeps native playback when routing is absent and never schedules a spatial frame', async () => {
    const { engine, audios } = fixture(); await engine.preload(); engine.scene('prolog-rat');
    const playback = engine.play('bark', 'valentus', 'Warm.', undefined, undefined, true, () => -1)!;
    await Promise.resolve(); expect(audios[0].play).toHaveBeenCalledOnce(); expect(playback.started).toBe(true);
    playback.stop(); await playback.done;
  });
});


describe('recording content cache version', () => {
  it('uses the full validated lowercase SHA so approved retakes change media URL while manifest paths stay stable', async () => {
    const sha256 = 'a'.repeat(64);
    const revised = { ...manifest, clips: [{ ...manifest.clips[0], sha256 }] };
    const audio = vi.fn(() => new FakeAudio() as unknown as HTMLAudioElement);
    const engine = new Voiceover({ audio, fetchManifest: async () => revised, volume: () => .9, now: () => 1 });
    await engine.preload(); engine.scene('prolog-rat');
    engine.play('say', 'valentus', manifest.clips[0].text)!.stop();
    expect(audio).toHaveBeenCalledWith(`/audio/prolog/clips/one.mp3?v=${sha256}`);
    expect(revised.clips[0].audio).toBe('audio/prolog/clips/one.mp3');
  });
  it('keeps the plain URL for missing, malformed, uppercase or injection-like hashes', async () => {
    for (const sha256 of [undefined, '', 'a'.repeat(63), 'A'.repeat(64), 'a'.repeat(64) + '&token=private', '../other.mp3', '?v=x']) {
      const audio = vi.fn(() => new FakeAudio() as unknown as HTMLAudioElement);
      const engine = new Voiceover({ audio, fetchManifest: async () => ({ ...manifest, clips: [{ ...manifest.clips[0], sha256 }] }), volume: () => .9, now: () => 1 });
      await engine.preload(); engine.scene('prolog-rat');
      engine.play('say', 'valentus', manifest.clips[0].text)!.stop();
      expect(audio).toHaveBeenCalledWith('/audio/prolog/clips/one.mp3');
    }
  });
});


describe('optional routing failure isolation', () => {
  it('settles stop and native media cleanup even when optional direction/cleanup hooks throw', async () => {
    const audio = new FakeAudio(); let frame!: FrameRequestCallback;
    const route = { setPan: vi.fn(() => { throw new Error('unavailable direction'); }), disconnect: vi.fn(() => { throw new Error('detached graph'); }) };
    const engine = new Voiceover({ audio: () => audio as unknown as HTMLAudioElement, fetchManifest: async () => manifest,
      volume: () => .9, now: () => 1, routeMedia: () => route,
      requestFrame: callback => { frame = callback; return 1; }, cancelFrame: vi.fn() });
    await engine.preload(); engine.scene('prolog-rat');
    const playback = engine.play('bark', 'valentus', 'Warm.', undefined, undefined, true, () => -1)!;
    await Promise.resolve(); expect(() => frame(0)).not.toThrow();
    expect(() => playback.stop()).not.toThrow(); await playback.done;
    expect(playback.outcome).toBe('stopped'); expect(audio.pause).toHaveBeenCalledOnce(); expect(audio.remove).toHaveBeenCalledOnce();
  });
});


describe('manifest and captured-route recovery', () => {
  it('releases a failed manifest once for a later explicit preload, coalescing concurrent calls without automatic retries', async () => {
    let reject!: (error: Error) => void;
    const first = new Promise<VoiceManifest>((_, fail) => { reject = fail; });
    const fetchManifest = vi.fn().mockReturnValueOnce(first).mockResolvedValue(manifest);
    const engine = new Voiceover({ audio: () => new FakeAudio() as unknown as HTMLAudioElement, fetchManifest, volume: () => .9, now: () => 1 });
    const load = engine.preload(); expect(engine.preload()).toBe(load); expect(fetchManifest).toHaveBeenCalledOnce();
    reject(new Error('transient timeout')); await load; await Promise.resolve();
    expect(fetchManifest).toHaveBeenCalledOnce();
    const retry = engine.preload(); expect(engine.preload()).toBe(retry); await retry;
    expect(fetchManifest).toHaveBeenCalledTimes(2);
    await engine.preload(); expect(fetchManifest).toHaveBeenCalledTimes(2);
    engine.scene('prolog-rat'); expect(engine.play('say', 'valentus', manifest.clips[0].text)).not.toBeNull(); engine.stop();
  });
  it('fails and cleans captured media instead of silently running a redirected element as native playback', async () => {
    const audio = new FakeAudio(); const fallback = vi.fn();
    const engine = new Voiceover({ audio: () => audio as unknown as HTMLAudioElement, fetchManifest: async () => manifest,
      volume: () => .9, now: () => 1, routeMedia: () => { throw new CapturedMediaRoutingError(); } });
    await engine.preload(); engine.scene('prolog-rat');
    const playback = engine.play('bark', 'valentus', 'Warm.', fallback, undefined, true, () => -1)!;
    expect(playback.outcome).toBe('failed'); await playback.done;
    expect(audio.play).not.toHaveBeenCalled(); expect(audio.pause).toHaveBeenCalledOnce(); expect(audio.remove).toHaveBeenCalledOnce();
    expect(fallback).toHaveBeenCalledOnce(); expect(playback.started).toBe(false);
  });
});

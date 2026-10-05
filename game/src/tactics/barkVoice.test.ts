import { rescueBattle } from '../chapters/kapitel-5/rettung';
import { describe, expect, it, vi } from 'vitest';
import prolog from '../../public/audio/prolog/manifest.json';
import story from '../../../docs/voice-production/story-lines.json';
import { VoiceIndex, Voiceover, type VoiceManifest } from '../audio/voiceover';
import { presentTacticalBark } from './barkVoice';

describe('tactical recorded bark binding', () => {
  it('routes actual rescue unit definitions through the story bank under registry scene rettung, not battle/map ID', async () => {
    const clips = story.lines.map(line => ({ ...line, seconds: 1, audio: `audio/story/${line.id}.mp3` }));
    const urls: string[] = [];
    const engine = new Voiceover({ audio: url => {
      urls.push(url); return Object.assign(new EventTarget(), { play: async () => {}, pause() {}, volume: 1, preload: '', removeAttribute() {}, load() {} }) as unknown as HTMLAudioElement;
    }, fetchManifest: async () => ({ model: story.model, aliases: story.aliases, scene_players: story.scene_players, clips } as unknown as VoiceManifest), volume: () => .9, now: () => 10000 });
    const battle = rescueBattle(1, true);
    expect(battle.id).toBe('k5-rettung');
    await engine.preload('story');
    const routed: string[] = [];
    for (const unit of battle.units) {
      const row = story.runtime_lookup.find(row => row.kind === 'bark' && row.scene === 'rettung' && row.speaker === unit.id);
      if (!row) continue;
      engine.scene('rettung');
      let voiced = false;
      presentTacticalBark({ bubble: (text, _anchor, _ms, opts) => {
        const voice = engine.play('bark', opts!.speaker!, text);
        voiced = Boolean(voice); voice?.stop(); return () => {};
      } }, unit, row.text, () => ({ x: 320, y: 100 }), 2200);
      expect(voiced, `${unit.id}/${unit.name}/${row.scene}/${row.mood}`).toBe(true);
      expect(urls.at(-1)).toBe(`/audio/story/${row.asset_id}.mp3`);
      routed.push(unit.id);
    }
    expect(routed).toEqual(expect.arrayContaining(['lia', 'flick', 'algard', 'maedchen', 'schuetze']));
    expect(engine.playerSpeaker()).toBe('lia');
  });
  it('proves actual Lia/Kyra barks and adult Baris dialogue while keeping absent Dunkelschatten assets explicit', () => {
    const index = new VoiceIndex({ model: story.model, aliases: story.aliases,
      clips: story.lines.map(line => ({ ...line, seconds: 1, audio: `audio/story/${line.id}.mp3` })) } as unknown as VoiceManifest, 'story');
    for (const speaker of ['lia', 'kyra', 'baris']) {
      const expectedKind = speaker === 'lia' || speaker === 'kyra' ? 'bark' : 'say';
      const line = story.lines.find(line => line.speaker === speaker && line.kind === expectedKind)!;
      expect(line, speaker).toBeDefined();
      const key = line.runtime_keys[0];
      expect(index.find(key.kind as 'say' | 'bark', key.speaker, key.text, key.scene, key.mood === 'neutral' ? undefined : key.mood)?.id, speaker).toBe(line.id);
    }
    expect(story.aliases['saenger-1']).toBe('dunkelschatten');
    expect(story.aliases['saenger-2']).toBe('dunkelschatten');
    expect(story.lines.filter(line => line.speaker === 'dunkelschatten')).toHaveLength(0);
    for (const speaker of ['baris', 'dunkelschatten']) expect(story.lines.filter(line => line.speaker === speaker && line.kind === 'bark')).toHaveLength(0);
  });
  it('passes authored battle ID, original text, moving anchor and original lifetime without changing combat flow', () => {
    const index = new VoiceIndex(prolog as VoiceManifest, 'prolog');
    const actorIds = ['baris', 'verwundeter-1', 'verwundeter-2'];
    const anchor = vi.fn(() => ({ x: 123, y: 80 }));
    for (const actor of actorIds) {
      const clip = prolog.clips.find(clip => clip.kind === 'bark' && clip.runtime_keys.some(key => key.speaker === actor))!;
      const bubble = vi.fn((_text, _anchor, _ms, opts) => {
        expect(index.find('bark', opts.speaker, clip.text)?.id).toBe(clip.id);
        return Object.assign(() => {}, { voiced: true, voiceDone: new Promise<void>(() => {}) });
      });
      expect(presentTacticalBark({ bubble }, { id: actor }, clip.text, anchor, 2200)).toBeUndefined();
      expect(bubble).toHaveBeenCalledWith(clip.text, anchor, 2200, { speaker: actor });
    }
  });
  it('resolves every frozen story bark route under its authoritative scene/mood and runtime actor aliases', () => {
    const index = new VoiceIndex({ model: story.model, aliases: story.aliases,
      clips: story.lines.map(line => ({ ...line, seconds: 1, audio: `audio/story/${line.id}.mp3` })) } as unknown as VoiceManifest, 'story');
    const barks = story.runtime_lookup.filter(key => key.kind === 'bark');
    expect(barks.length).toBeGreaterThanOrEqual(203);
    for (const key of barks) {
      const bubble = vi.fn((_text, _anchor, _ms, opts) => {
        expect(index.find('bark', opts.speaker, key.text, key.scene, key.mood === 'neutral' ? undefined : key.mood)?.id).toBe(key.asset_id);
        return () => {};
      });
      presentTacticalBark({ bubble }, { id: key.speaker }, key.text, () => ({ x: 10, y: 10 }), 2200);
      expect(bubble).toHaveBeenCalledOnce();
    }
  });
  it('the UI voice path remains nonblocking and completion/error/stop settles while important dialogue retains priority', async () => {
    const audios: (EventTarget & { play: () => Promise<void>; pause: () => void; volume: number; preload: string; removeAttribute: () => void; load: () => void })[] = [];
    const engine = new Voiceover({ audio: () => {
      const audio = Object.assign(new EventTarget(), { play: async () => {}, pause: vi.fn(), volume: 1, preload: '', removeAttribute: vi.fn(), load: vi.fn() });
      audios.push(audio); return audio as unknown as HTMLAudioElement;
    }, fetchManifest: async () => prolog as VoiceManifest, volume: () => .9, now: () => 10000 });
    await engine.preload(); engine.scene('prolog-schlacht');
    const text = 'Der Alte gehört mir!';
    const clips: ReturnType<Voiceover['play']>[] = [];
    const bubble = vi.fn((line, _anchor, _ms, opts) => {
      const voice = engine.play('bark', opts.speaker, line); clips.push(voice);
      return Object.assign(() => voice?.stop(), { voiced: Boolean(voice), voiceDone: voice?.done });
    });
    presentTacticalBark({ bubble }, { id: 'baris' }, text, () => ({ x: 0, y: 10 }), 100);
    expect(clips[0]).not.toBeNull();
    expect(clips[0]!.outcome).toBe('playing'); // Visual timeout never directly cuts the recording.
    audios[0].dispatchEvent(new Event('error')); await clips[0]!.done;
    expect(clips[0]!.outcome).toBe('failed');
    engine.scene('prolog-schlacht');
    presentTacticalBark({ bubble }, { id: 'baris' }, text, () => ({ x: 0, y: 10 }), 100);
    engine.stop(); await clips[1]!.done; expect(clips[1]!.outcome).toBe('stopped');
    const dialogue = prolog.clips.find(clip => clip.kind === 'say')!;
    engine.play('say', dialogue.speaker, dialogue.text);
    presentTacticalBark({ bubble }, { id: 'baris' }, text, () => ({ x: 0, y: 10 }), 100);
    expect(clips[2]).toBeNull(); engine.stop();
  });
});

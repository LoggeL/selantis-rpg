import { stripMarkup } from '../ui/text';

export type VoiceKind = 'say' | 'think' | 'narrate' | 'bark' | 'choice';
export type VoiceBank = 'prolog' | 'story';
export interface VoiceKey { kind: VoiceKind; speaker: string; text: string; scene?: string; mood?: string }
export interface WordCue { start: number; end: number }
export type VoiceOutcome = 'playing' | 'ended' | 'failed' | 'stopped';
export interface VoiceClip extends VoiceKey { word_cues?: WordCue[]; id: string; audio: string; seconds: number; runtime_keys: VoiceKey[] }
export interface VoiceManifest { model: string; aliases: Record<string, string>; scene_players?: Record<string, string>; clips: VoiceClip[] }
export interface VoicePlayback { done: Promise<void>; readonly currentTime: number; readonly started: boolean; readonly wordCues?: readonly WordCue[]; readonly spokenText?: string; readonly outcome: VoiceOutcome; stop(): void }

/** Choice labels may include actions around a quoted response; only the words are spoken. */
export function quotedChoiceText(text: string): string | null {
  const matches = [...text.matchAll(/[„"]([^“”"]+)[“”"]/gu)];
  return matches.length ? matches.map(match => match[1]).join(' ') : null;
}

export const normalizeVoiceText = (text: string): string => stripMarkup(text).replace(/\s+/gu, ' ').trim();
const key = (kind: VoiceKind, speaker: string, text: string) => JSON.stringify([kind, speaker, normalizeVoiceText(text)]);

/** Explicit runtime keys prevent a repeated sentence from borrowing another speaker's take. */
export class VoiceIndex {
  private clips = new Map<string, Array<{ clip: VoiceClip; runtime: VoiceKey }>>();
  constructor(private manifest: VoiceManifest, bank: VoiceBank = 'prolog') {
    for (const clip of manifest.clips) {
      if (!new RegExp(`^/?audio/${bank}/[A-Za-z0-9_./-]+\\.(mp3|wav|ogg)$`).test(clip.audio) || clip.audio.includes('..')) continue;
      if (!Number.isFinite(clip.seconds) || clip.seconds <= 0) continue;
      for (const runtime of clip.runtime_keys ?? []) {
        const k = key(runtime.kind, this.speaker(runtime.speaker), runtime.text);
        const candidates = this.clips.get(k) ?? [];
        candidates.push({ clip, runtime });
        this.clips.set(k, candidates);
      }
    }
  }
  private speaker(id: string): string { return this.manifest.aliases?.[id] ?? id; }
  player(scene: string): string | undefined { return this.manifest.scene_players?.[scene]; }
  find(kind: VoiceKind, speaker: string, text: string, scene?: string, mood?: string): VoiceClip | undefined {
    const candidates = this.clips.get(key(kind, this.speaker(speaker), text)) ?? [];
    let found: VoiceClip | undefined;
    let score = -1;
    let ambiguous = false;
    for (const candidate of candidates) {
      const route = candidate.runtime;
      const scoped = Boolean(route.scene && route.scene !== '*');
      if (scoped && route.scene !== scene) continue;
      if (route.mood && route.mood !== (mood ?? 'neutral')) continue;
      const rank = (scoped ? 2 : 0) + (route.mood ? 1 : 0);
      if (rank > score) { found = candidate.clip; score = rank; ambiguous = false; }
      else if (rank === score && found?.id !== candidate.clip.id) ambiguous = true;
    }
    return ambiguous ? undefined : found;
  }
}

interface Dependencies {
  audio: (url: string) => HTMLAudioElement;
  fetchManifest: (bank: VoiceBank) => Promise<VoiceManifest>;
  volume: () => number;
  now: () => number;
  visible?: () => boolean;
}

/** One voice at a time; all exits settle, even when play(), loading or decoding fails. */
export class Voiceover {
  private indexes = new Map<VoiceBank, VoiceIndex>();
  private loading = new Map<VoiceBank, Promise<void>>();
  private bank: VoiceBank = 'prolog';
  private currentScene = '';
  private active?: { playback: VoicePlayback; audio: HTMLAudioElement; bark: boolean };
  private enabled = false;
  private lastBark = -Infinity;
  constructor(private deps: Dependencies) {}

  preload(bank: VoiceBank = this.bank): Promise<void> {
    const existing = this.loading.get(bank);
    if (existing) return existing;
    const pending = this.deps.fetchManifest(bank).then(manifest => {
      this.indexes.set(bank, new VoiceIndex(manifest, bank));
    }).catch(() => { /* Each absent bank independently keeps the ordinary text path. */ });
    this.loading.set(bank, pending);
    return pending;
  }
  scene(id: string): void {
    this.stop();
    this.currentScene = id;
    this.bank = /^prolog-(rat|schlacht|flucht|zuflucht)$/.test(id) ? 'prolog' : 'story';
    this.enabled = Boolean(id);
    this.lastBark = -Infinity;
    if (this.enabled) void this.preload();
  }
  playerSpeaker(): string {
    return this.indexes.get(this.bank)?.player(this.currentScene) ?? (this.bank === 'prolog' ? 'valentus' : '');
  }
  stop(): void { this.active?.playback.stop(); }
  refreshVolume(): void {
    if (this.active) {
      this.active.audio.volume = this.volume();
      if (this.volume() <= 0) this.active.playback.stop();
    }
  }
  private volume(): number {
    const value = this.deps.volume();
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  }
  play(kind: VoiceKind, speaker: string, text: string, fallback?: () => void, mood?: string, foregroundBark = false): VoicePlayback | null {
    if (!this.enabled || this.volume() <= 0 || this.deps.visible?.() === false) return null;
    const bark = kind === 'bark';
    if (!bark) this.stop();
    const clip = this.indexes.get(this.bank)?.find(kind, speaker, text, this.currentScene, mood);
    if (!clip || (bark && (
      (this.active && (!foregroundBark || !this.active.bark))
      || (!foregroundBark && this.deps.now() - this.lastBark < 6000)
    ))) return null;
    this.stop();
    let audio: HTMLAudioElement;
    try { audio = this.deps.audio('/' + clip.audio.replace(/^\//, '')); }
    catch { fallback?.(); return null; }
    audio.volume = this.volume();
    audio.preload = 'auto';
    let resolve!: () => void;
    const done = new Promise<void>(r => { resolve = r; });
    let settled = false;
    let outcome: VoiceOutcome = 'playing';
    let started = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (reason: VoiceOutcome) => {
      if (settled) return;
      settled = true;
      outcome = reason;
      clearTimeout(timer);
      audio.removeEventListener('ended', ended);
      audio.removeEventListener('error', error);
      try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch { /* Already detached media. */ }
      audio.remove?.();
      if (this.active?.audio === audio) this.active = undefined;
      if (reason === 'failed') fallback?.();
      resolve();
    };
    const ended = () => finish('ended');
    const error = () => finish('failed');
    const playback: VoicePlayback = {
      done, stop: () => finish('stopped'),
      get currentTime() { return audio.currentTime; },
      get started() { return started; },
      get wordCues() { return clip.word_cues; },
      get spokenText() { return clip.text; },
      get outcome() { return outcome; },
    };
    this.active = { playback, audio, bark };
    if (bark) this.lastBark = this.deps.now();
    audio.addEventListener('ended', ended);
    audio.addEventListener('error', error);
    timer = setTimeout(error, Math.min(120000, clip.seconds * 1000 + 8000));
    try { void audio.play().then(() => { if (!settled) started = true; }, () => { if (!settled) finish('failed'); }); }
    catch { finish('failed'); }
    return settled ? null : playback;
  }
}

async function fetchManifest(bank: VoiceBank): Promise<VoiceManifest> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`/audio/${bank}/manifest.json`, { signal: controller.signal });
    if (!response.ok) throw new Error('Voice manifest unavailable');
    return await response.json() as VoiceManifest;
  } finally { clearTimeout(timer); }
}

export const voiceover = new Voiceover({
  audio: url => {
    const audio = new Audio(url);
    audio.hidden = true;
    audio.dataset.recordedVoice = 'true';
    document.body.appendChild(audio);
    return audio;
  }, fetchManifest,
  volume: () => voiceVolume(), now: () => performance.now(),
  visible: () => typeof document === 'undefined' || !document.hidden,
});
// Set at UI mount so this module remains independently testable without loading the game facade.
let voiceVolume = () => 0.9;
export function bindVoiceVolume(get: () => number): void { voiceVolume = get; }

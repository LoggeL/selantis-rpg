import { stripMarkup } from '../ui/text';

export type VoiceKind = 'say' | 'think' | 'narrate' | 'bark' | 'choice';
export interface VoiceKey { kind: VoiceKind; speaker: string; text: string }
export interface WordCue { start: number; end: number }
export type VoiceOutcome = 'playing' | 'ended' | 'failed' | 'stopped';
export interface VoiceClip extends VoiceKey { word_cues?: WordCue[]; id: string; audio: string; seconds: number; runtime_keys: VoiceKey[] }
export interface VoiceManifest { model: string; aliases: Record<string, string>; clips: VoiceClip[] }
export interface VoicePlayback { done: Promise<void>; readonly currentTime: number; readonly started: boolean; readonly wordCues?: readonly WordCue[]; readonly outcome: VoiceOutcome; stop(): void }

/** Choice labels may include actions around a quoted response; only the words are spoken. */
export function quotedChoiceText(text: string): string | null {
  const matches = [...text.matchAll(/[„"]([^“”"]+)[“”"]/gu)];
  return matches.length ? matches.map(match => match[1]).join(' ') : null;
}

export const normalizeVoiceText = (text: string): string => stripMarkup(text).replace(/\s+/gu, ' ').trim();
const key = (kind: VoiceKind, speaker: string, text: string) => JSON.stringify([kind, speaker, normalizeVoiceText(text)]);

/** Explicit runtime keys prevent a repeated sentence from borrowing another speaker's take. */
export class VoiceIndex {
  private clips = new Map<string, VoiceClip>();
  constructor(private manifest: VoiceManifest) {
    for (const clip of manifest.clips) {
      if (!/^\/?audio\/prolog\/[A-Za-z0-9_./-]+\.(mp3|wav|ogg)$/.test(clip.audio) || clip.audio.includes('..')) continue;
      if (!Number.isFinite(clip.seconds) || clip.seconds <= 0) continue;
      for (const runtime of clip.runtime_keys ?? []) {
        const k = key(runtime.kind, this.speaker(runtime.speaker), runtime.text);
        // Generator supplies one take per runtime key; repeated keys retain the first mapping.
        if (!this.clips.has(k)) this.clips.set(k, clip);
      }
    }
  }
  private speaker(id: string): string { return this.manifest.aliases?.[id] ?? id; }
  find(kind: VoiceKind, speaker: string, text: string): VoiceClip | undefined {
    return this.clips.get(key(kind, this.speaker(speaker), text));
  }
}

interface Dependencies {
  audio: (url: string) => HTMLAudioElement;
  fetchManifest: () => Promise<VoiceManifest>;
  volume: () => number;
  now: () => number;
  visible?: () => boolean;
}

/** One voice at a time; all exits settle, even when play(), loading or decoding fails. */
export class Voiceover {
  private index?: VoiceIndex;
  private loading?: Promise<void>;
  private active?: { playback: VoicePlayback; audio: HTMLAudioElement; bark: boolean };
  private enabled = false;
  private lastBark = -Infinity;
  constructor(private deps: Dependencies) {}

  preload(): Promise<void> {
    return this.loading ??= this.deps.fetchManifest().then(manifest => {
      this.index = new VoiceIndex(manifest);
    }).catch(() => { /* Missing manifest keeps the ordinary text/blip path. */ });
  }
  scene(id: string): void {
    this.stop();
    this.enabled = /^prolog-(rat|schlacht|flucht|zuflucht)$/.test(id);
    this.lastBark = -Infinity;
    if (this.enabled) void this.preload();
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
  play(kind: VoiceKind, speaker: string, text: string, fallback?: () => void): VoicePlayback | null {
    if (!this.enabled || this.volume() <= 0 || this.deps.visible?.() === false) return null;
    const bark = kind === 'bark';
    if (!bark) this.stop();
    const clip = this.index?.find(kind, speaker, text);
    if (!clip || (bark && (this.active || this.deps.now() - this.lastBark < 6000))) return null;
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

async function fetchManifest(): Promise<VoiceManifest> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch('/audio/prolog/manifest.json', { signal: controller.signal });
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

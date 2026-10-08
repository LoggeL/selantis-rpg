// „Das Leben als Waffenknecht“ — the drunken soldiers' song at Baris' camp (novel p. 67/71), played procedurally:
// a barrel drum (thud) on every beat, a slightly out-of-tune lute (triangle blips) and rough voices (sawtooth blips).
// The stake minigame uses the same clock: only the bawled refrain (LOUD_LINES) covers the rattle of the chain.
import { G } from '../../core/G';

export const VERSES: readonly (readonly string[])[] = [
  [
    'Auf dem blut’gen Schlachtenfeld,', 'starb unser Kamerad als Held.',
    'Erschlagen, zerteilt und durchbohrt,', 'trug ihn der Gevatter fort.',
    'Der Sieg war hart erkämpft und teuer,', 'bezwung’n der Feind, das Ungeheuer.',
    'Ihr lieben Leut, ihr höret recht:', 'Das ist das Leben als Waffenknecht!',
  ],
  [
    'Die Weiber soll’n im Kreise springen,', 'dazu soll’n die Pfeifen klingen.',
    'Den Roten wollen wir genießen,', 'zünftig unsren Sieg begießen.',
    'Morgen schon könnten wir sterben,', 'drum lasst uns nicht den Spaß verderben.',
    'Ihr lieben Leut, ihr höret recht:', 'Das ist das Leben als Waffenknecht!',
  ],
];

const N = { A3: 220, C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, Bb4: 466.2, C5: 523.3 };
/** Eight eighth-notes per line (4 beats). */
const LINE_TUNES: readonly (readonly number[])[] = [
  [N.D4, N.D4, N.F4, N.A4, N.A4, N.G4, N.F4, N.E4],
  [N.D4, N.F4, N.G4, N.A4, N.Bb4, N.A4, N.G4, N.F4],
  [N.A4, N.A4, N.C5, N.A4, N.G4, N.F4, N.G4, N.A4],
  [N.F4, N.E4, N.D4, N.E4, N.F4, N.E4, N.D4, N.D4],
];
/** Which tune each of the eight lines of a verse uses. */
const VERSE_TUNES = [0, 1, 0, 3, 2, 1, 2, 3];
export const BEATS_PER_LINE = 4;
/** The refrain lines the men bawl at the top of their voices – the only cover for a rattling chain. */
export const LOUD_LINES: readonly number[] = [6, 7];
/** Silent beats between two verses (the men drink). */
export const REST_BEATS = 4;
export const BEAT_MS = 660;
export const BEATS_PER_VERSE = VERSE_TUNES.length * BEATS_PER_LINE + REST_BEATS;

export interface BeatInfo {
  /** Running beat counter since the song started. */
  index: number;
  verse: number;
  /** Line within the verse, -1 during the rest between verses. */
  line: number;
  /** True during the rest between verses (no drum). */
  rest: boolean;
  /** True on a bawled refrain line (loud enough to cover the chain). */
  loud: boolean;
  /** performance.now() of this beat. */
  at: number;
}

/** Position of beat `index` within the song (pure, tested). */
export function beatPosition(index: number): { verse: number; line: number; beatInLine: number; rest: boolean } {
  const inVerse = index % BEATS_PER_VERSE;
  const verse = Math.floor(index / BEATS_PER_VERSE) % VERSES.length;
  if (inVerse >= VERSE_TUNES.length * BEATS_PER_LINE) return { verse, line: -1, beatInLine: inVerse - VERSE_TUNES.length * BEATS_PER_LINE, rest: true };
  return { verse, line: Math.floor(inVerse / BEATS_PER_LINE), beatInLine: inVerse % BEATS_PER_LINE, rest: false };
}

export interface Song {
  stop(): void;
  /** Called on every beat (also rest beats). Returns an unsubscriber. */
  onBeat(fn: (b: BeatInfo) => void): () => void;
  /** Called when a sung line starts. Returns an unsubscriber. */
  onLine(fn: (text: string, verse: number, line: number) => void): () => void;
  /** Time (performance.now) of the next beat and of the last one. */
  readonly nextBeatAt: number;
  readonly lastBeat: BeatInfo | null;
  /** Louder/softer (0..1.5), e.g. quieter while far away. */
  volume: number;
}

/** Starts the song (loops through the verses until stop()). `startVerse` picks the first verse. */
export function startSong(opts: { volume?: number; startVerse?: number } = {}): Song {
  const beatFns = new Set<(b: BeatInfo) => void>();
  const lineFns = new Set<(text: string, verse: number, line: number) => void>();
  let index = (opts.startVerse ?? 0) * BEATS_PER_VERSE;
  let stopped = false;
  let next = performance.now() + 120;
  let last: BeatInfo | null = null;
  const timers = new Set<number>();
  const later = (ms: number, fn: () => void) => {
    const t = window.setTimeout(() => { timers.delete(t); if (!stopped) fn(); }, ms);
    timers.add(t);
  };
  let offGoto = () => {};
  const song: Song = {
    volume: opts.volume ?? 1,
    stop() { stopped = true; offGoto(); timers.forEach(t => clearTimeout(t)); timers.clear(); beatFns.clear(); lineFns.clear(); },
    onBeat(fn) { beatFns.add(fn); return () => beatFns.delete(fn); },
    onLine(fn) { lineFns.add(fn); return () => lineFns.delete(fn); },
    get nextBeatAt() { return next; },
    get lastBeat() { return last; },
  };

  const play = (fn: () => void) => { try { fn(); } catch { /* audio optional */ } };
  const scene = G.currentScene;
  const tick = () => {
    if (stopped) return;
    if (G.currentScene !== scene) { song.stop(); return; } // left to the title or elsewhere
    const pos = beatPosition(index);
    const loud = !pos.rest && LOUD_LINES.includes(pos.line);
    const info: BeatInfo = { index, verse: pos.verse, line: pos.line, rest: pos.rest, loud, at: next };
    last = info;
    // The refrain is bawled: drum and voices much louder.
    const v = song.volume * (loud ? 1.45 : 1);
    if (!pos.rest && v > 0) {
      // barrel drum: heavy on 1 and 3, lighter on 2 and 4
      play(() => G.audio.sfx('thud', { volume: (pos.beatInLine % 2 === 0 ? 0.55 : 0.32) * v, pitch: pos.beatInLine % 2 === 0 ? 0.8 : 1.05, key: 'k3-drum' }));
      const tune = LINE_TUNES[VERSE_TUNES[pos.line]];
      for (let half = 0; half < 2; half++) {
        const note = tune[pos.beatInLine * 2 + half];
        later(half * (BEAT_MS / 2), () => {
          const sour = Math.random() < 0.12 ? 1.06 : 1; // „alles etwas schief“
          play(() => G.audio.blip(note * sour, 'triangle', { volume: 0.55 * v }));
          later(18, () => play(() => G.audio.blip((note / 2) * (1 + (Math.random() - 0.5) * 0.05), 'sawtooth', { volume: 0.45 * v })));
        });
      }
      if (pos.beatInLine === 0) {
        const text = VERSES[pos.verse][pos.line];
        lineFns.forEach(fn => fn(text, pos.verse, pos.line));
      }
    }
    beatFns.forEach(fn => fn(info));
    index++;
    next += BEAT_MS;
    later(Math.max(0, next - performance.now()), tick);
  };
  later(Math.max(0, next - performance.now()), tick);
  // Never outlive the scene (warp, title, next scene).
  offGoto = G.events.on('scene:goto', () => song.stop());
  return song;
}

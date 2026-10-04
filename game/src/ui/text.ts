/**
 * Pure text helpers for the UI (no DOM): markup parsing and typewriter timing.
 *
 * Markup for chapter authors (works in say/narrate/think/choices):
 *   *betont*      → italic emphasis
 *   ~Urmacht~     → turquoise magic glow (only for the Urmacht motif!)
 *   \n            → line break
 */
export type SegmentStyle = 'plain' | 'em' | 'magic' | 'br';
export interface Segment { text: string; style: SegmentStyle; }

export function parseMarkup(input: string): Segment[] {
  const out: Segment[] = [];
  let style: SegmentStyle = 'plain';
  let buf = '';
  const flush = () => { if (buf) out.push({ text: buf, style }); buf = ''; };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '\\' && i + 1 < input.length && '*~'.includes(input[i + 1])) { buf += input[++i]; continue; }
    if (c === '*' && (style === 'plain' || style === 'em')) {
      // Only treat as a marker when a closing marker exists (lone asterisks stay literal).
      if (style === 'plain' && input.indexOf('*', i + 1) < 0) { buf += c; continue; }
      flush(); style = style === 'em' ? 'plain' : 'em'; continue;
    }
    if (c === '~' && (style === 'plain' || style === 'magic')) {
      if (style === 'plain' && input.indexOf('~', i + 1) < 0) { buf += c; continue; }
      flush(); style = style === 'magic' ? 'plain' : 'magic'; continue;
    }
    if (c === '\n') { flush(); out.push({ text: '\n', style: 'br' }); continue; }
    buf += c;
  }
  flush();
  return out;
}

/** Plain visible text without markup. */
export function stripMarkup(input: string): string {
  return parseMarkup(input).map(s => (s.style === 'br' ? ' ' : s.text)).join('');
}

const PAUSES: Record<string, number> = {
  ',': 110, ';': 170, ':': 170, '.': 270, '!': 270, '?': 270, '…': 340, '–': 180, '—': 180,
};
const CLOSERS = new Set(['"', '“', '”', '‘', '’', '«', '»', ')', ']', "'"]);

/**
 * Cumulative reveal times (ms) for each character of `chars` at `cps` characters per second.
 * Adds natural pauses after punctuation that is followed by whitespace/closing quote/end.
 * cps <= 0 means instant (all zero).
 */
export function revealSchedule(chars: string[], cps: number): number[] {
  if (cps <= 0) return chars.map(() => 0);
  const step = 1000 / cps;
  const factor = Math.min(1.6, Math.max(0.5, 45 / cps));
  const times: number[] = [];
  let t = 0;
  for (let i = 0; i < chars.length; i++) {
    times.push(t);
    const c = chars[i];
    t += c === ' ' ? step * 0.6 : step;
    const pause = PAUSES[c];
    if (pause !== undefined && i < chars.length - 1) {
      let j = i + 1;
      while (j < chars.length && CLOSERS.has(chars[j])) j++;
      const next = chars[j];
      // "..." — only pause after the last dot of a run.
      if (c === '.' && next === '.') continue;
      if (next === undefined || next === ' ' || next === '\n' || CLOSERS.has(chars[i + 1] ?? '')) t += pause * factor;
    }
  }
  return times;
}

/** Whether a revealed character should trigger a voice blip (letters/digits, every other one). */
export function shouldBlip(char: string, letterIndex: number): boolean {
  return /[\p{L}\p{N}]/u.test(char) && letterIndex % 2 === 0;
}

/** Converts 1..3999 to a roman numeral; non-numbers are returned unchanged ('Prolog'). */
export function toRoman(value: number | string): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0 || n >= 4000) return String(value);
  const table: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let rest = n, out = '';
  for (const [v, s] of table) while (rest >= v) { out += s; rest -= v; }
  return out;
}

/** Default auto-hide duration for a speech bubble with this text. */
export function bubbleDuration(text: string): number {
  return Math.round(Math.min(7000, 1400 + stripMarkup(text).length * 55));
}

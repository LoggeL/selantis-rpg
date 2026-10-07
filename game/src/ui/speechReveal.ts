import { normalizeVoiceText, type VoicePlayback, type WordCue } from '../audio/voiceover';

/** Never approximate a missing alignment with total audio duration. */
export function validSpeechCues(text: string, cues?: readonly WordCue[]): cues is readonly WordCue[] {
  const words = normalizeVoiceText(text).split(' ').filter(Boolean);
  if (!Array.isArray(cues) || !words.length || cues.length !== words.length) return false;
  let previous = -Infinity;
  return cues.every(cue => {
    if (!cue || typeof cue !== 'object') return false;
    const valid = Number.isFinite(cue.start) && Number.isFinite(cue.end)
      && cue.start >= 0 && cue.end >= cue.start && cue.start >= previous;
    previous = cue.start;
    return valid;
  });
}

/** Inventory-approved display variants retain omitted parenthetical controls beside the nearest word. */
export function speechDisplayWordGroups(displayText: string, spokenText: string): number[][] | null {
  const display = normalizeVoiceText(displayText);
  const spoken = normalizeVoiceText(spokenText);
  const tokens = [...display.matchAll(/\S+/gu)];
  if (display === spoken) return tokens.map((_, i) => [i]);
  const parentheticals = [...display.matchAll(/\([^()]*\)/gu)];
  if (!parentheticals.length) return null;
  const omitted = new Set<number>();
  for (const match of parentheticals) {
    let start = match.index!;
    // Deleting only the parentheses must not leave a space before their outside suffix punctuation.
    while (start > 0 && /\s/u.test(display[start - 1])) start--;
    for (let index = start; index < match.index! + match[0].length; index++) omitted.add(index);
  }
  let remaining = '';
  const sourceOffsets: number[] = [];
  for (let index = 0; index < display.length; index++) {
    if (omitted.has(index)) continue;
    remaining += display[index];
    sourceOffsets.push(index);
  }
  // Keep every outside character, including a period attached to the final parenthetical token.
  // The text was already stripped of markup; only whitespace is normalized again here.
  if (remaining.replace(/\s+/gu, ' ').trim() !== spoken) return null;
  const sourceTokens = new Map<number, number>();
  tokens.forEach((token, tokenIndex) => {
    for (let index = token.index!; index < token.index! + token[0].length; index++) sourceTokens.set(index, tokenIndex);
  });
  const groups = [...remaining.matchAll(/\S+/gu)].map(word => {
    const group = new Set<number>();
    for (let index = word.index!; index < word.index! + word[0].length; index++) group.add(sourceTokens.get(sourceOffsets[index])!);
    return [...group];
  });
  if (!groups.length) return null;
  const owners = new Map<number, number>();
  for (let group = 0; group < groups.length; group++) for (const token of groups[group]) {
    if (owners.has(token) && owners.get(token) !== group) return null;
    owners.set(token, group);
  }
  let preceding = 0;
  for (let token = 0; token < tokens.length; token++) {
    const owner = owners.get(token);
    if (owner === undefined) groups[preceding].push(token);
    else preceding = owner;
  }
  return groups.map(group => group.sort((a, b) => a - b));
}

interface RevealOptions {
  playback: VoicePlayback;
  cues: readonly WordCue[];
  showWord: (index: number) => void;
  showAll: () => void;
  onDone: () => void;
  fallback: () => void;
  stopped: () => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}

/** Driven exclusively by media time: buffering, pauses and autoplay waits cannot reveal future words. */
export class SpeechReveal {
  done = false;
  private shown = 0;
  private frame = 0;
  private closed = false;
  private request: (callback: FrameRequestCallback) => number;
  private cancelFrame: (id: number) => void;
  constructor(private opts: RevealOptions) {
    // Call browser scheduling functions in their native window context rather
    // than as methods of this reveal instance (native APIs reject that receiver).
    this.request = opts.requestFrame ?? (callback => requestAnimationFrame(callback));
    this.cancelFrame = opts.cancelFrame ?? (id => cancelAnimationFrame(id));
    this.frame = this.request(this.tick);
    void opts.playback.done.then(() => {
      if (this.closed) return;
      if (opts.playback.outcome === 'ended') this.complete();
      else {
        this.cancel();
        if (opts.playback.outcome === 'failed') opts.fallback();
        else opts.stopped();
      }
    });
  }
  private tick = () => {
    if (this.closed) return;
    const time = this.opts.playback.started ? this.opts.playback.currentTime : -Infinity;
    while (this.shown < this.opts.cues.length && this.opts.cues[this.shown].start <= time) {
      this.opts.showWord(this.shown++);
    }
    this.frame = this.request(this.tick);
  };
  complete(): void {
    if (this.closed) return;
    this.cancel();
    this.opts.showAll();
    this.opts.onDone();
  }
  cancel(): void {
    this.closed = true;
    this.done = true;
    this.cancelFrame(this.frame);
  }
}

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
  const omitted = [...display.matchAll(/\([^()]*\)/gu)].map(match => [match.index!, match.index! + match[0].length]);
  if (!omitted.length) return null;
  const kept = tokens.map((token, index) => ({ text: token[0], index, start: token.index! }))
    .filter(token => !omitted.some(([start, end]) => token.start >= start && token.start < end));
  // No substitutions, spoken words, or punctuation may disappear outside the exact parenthetical.
  if (kept.map(token => token.text).join(' ') !== spoken || !kept.length) return null;
  const groups = kept.map(token => [token.index]);
  for (let index = 0; index < tokens.length; index++) {
    if (kept.some(token => token.index === index)) continue;
    let target = -1;
    kept.forEach((token, i) => { if (token.index < index) target = i; });
    if (target < 0) target = 0;
    groups[target].push(index);
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

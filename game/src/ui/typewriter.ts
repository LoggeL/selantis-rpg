import { settings } from '../core/settings';
import { blip, el } from './dom';
import { parseMarkup, revealSchedule, shouldBlip } from './text';

const STYLE_CLASS = { plain: '', em: 'tx-em', magic: 'tx-magic', br: '' } as const;

/**
 * Renders marked-up text into `host` as per-character spans (hidden), grouped in no-wrap words so the
 * layout never jumps while typing. Returns the character spans in reading order.
 */
export function renderChars(host: HTMLElement, text: string): HTMLSpanElement[] {
  host.textContent = '';
  const chars: HTMLSpanElement[] = [];
  for (const seg of parseMarkup(text)) {
    if (seg.style === 'br') { host.appendChild(el('br')); continue; }
    const wrap = seg.style === 'plain' ? host : host.appendChild(el('span', STYLE_CLASS[seg.style]));
    // Split into words and spaces; each word is a nowrap span holding its characters.
    for (const token of seg.text.split(/(\s+)/)) {
      if (!token) continue;
      if (/^\s+$/.test(token)) {
        for (const c of token) { const s = el('span', 'tc', c === ' ' ? ' ' : c); wrap.appendChild(s); chars.push(s); }
        continue;
      }
      const word = el('span', 'tw');
      for (const c of token) { const s = el('span', 'tc', c); word.appendChild(s); chars.push(s); }
      wrap.appendChild(word);
    }
  }
  return chars;
}

export interface TypeOptions {
  voice?: { pitch: number; wave?: OscillatorType };
  /** Override characters per second (default settings.textSpeed). */
  cps?: number;
  onDone?: () => void;
}

/** Typewriter over pre-rendered character spans. complete() reveals everything at once. */
export class Typewriter {
  done = false;
  private chars: HTMLSpanElement[];
  private times: number[];
  private shown = 0;
  private letters = 0;
  private start = 0;
  private raf = 0;
  private lastBlip = 0;

  constructor(host: HTMLElement, text: string, private opts: TypeOptions = {}) {
    this.chars = renderChars(host, text);
    const cps = opts.cps ?? settings.textSpeed;
    this.times = revealSchedule(this.chars.map(c => c.textContent ?? ''), cps);
    if (cps <= 0 || this.chars.length === 0) { this.complete(); return; }
    this.start = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    if (this.done) return;
    const elapsed = now - this.start;
    while (this.shown < this.chars.length && this.times[this.shown] <= elapsed) {
      const span = this.chars[this.shown++];
      span.classList.add('on');
      const c = span.textContent ?? '';
      if (/[\p{L}\p{N}]/u.test(c)) {
        if (this.opts.voice && this.opts.voice.pitch > 0 && shouldBlip(c, this.letters) && now - this.lastBlip > 42) {
          this.lastBlip = now;
          blip(this.opts.voice.pitch * (0.96 + Math.random() * 0.08), this.opts.voice.wave);
        }
        this.letters++;
      }
    }
    if (this.shown >= this.chars.length) { this.complete(); return; }
    this.raf = requestAnimationFrame(this.tick);
  };

  complete(): void {
    if (this.done) return;
    this.done = true;
    cancelAnimationFrame(this.raf);
    for (const c of this.chars) c.classList.add('on');
    this.opts.onDone?.();
  }

  cancel(): void { this.done = true; cancelAnimationFrame(this.raf); }
}

/**
 * Word-by-word fade reveal (book narration). Returns a handle with complete(); onDone fires when all words are visible.
 */
export function revealWords(host: HTMLElement, text: string, onDone: () => void, msPerWord = 70, dropCap = false): { complete(): void; readonly done: boolean } {
  host.textContent = '';
  const words: HTMLSpanElement[] = [];
  if (dropCap) {
    // Book style: the first letter becomes an illuminated initial (::first-letter cannot reach inline-blocks).
    const m = /^(\s*[„“"'(]*)(\p{L})/u.exec(text);
    if (m) {
      const cap = el('span', 'rw drop-cap', m[2]);
      host.appendChild(cap);
      words.push(cap);
      text = m[1] + text.slice(m[0].length);
    }
  }
  for (const seg of parseMarkup(text)) {
    if (seg.style === 'br') { host.appendChild(el('br')); continue; }
    const wrap = seg.style === 'plain' ? host : host.appendChild(el('span', STYLE_CLASS[seg.style]));
    for (const token of seg.text.split(/(\s+)/)) {
      if (!token) continue;
      if (/^\s+$/.test(token)) { wrap.appendChild(document.createTextNode(token)); continue; }
      const w = el('span', 'rw', token);
      wrap.appendChild(w);
      words.push(w);
    }
  }
  const speed = settings.textSpeed <= 0 ? 0 : msPerWord * Math.min(1.8, Math.max(0.4, 45 / settings.textSpeed));
  let done = false;
  let timer = 0;
  const finish = () => { if (done) return; done = true; clearTimeout(timer); host.classList.add('rw-all'); onDone(); };
  words.forEach((w, i) => { w.style.animationDelay = `${Math.round(i * speed)}ms`; });
  host.classList.add('rw-host');
  if (speed === 0 || !words.length) finish();
  else timer = window.setTimeout(finish, words.length * speed + 380);
  return { complete: finish, get done() { return done; } };
}

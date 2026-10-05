import type { VoicePlayback } from '../audio/voiceover';
import { revealSpeech, type TextReveal } from './typewriter';
import { virtualInput } from '../core/input';
import { canvasToPage } from '../core/viewport';
import { ctx } from './context';
import { el, icon } from './dom';
import { bubbleDuration, parseMarkup } from './text';

type Hint = { verb: string; key?: string; x: number; y: number };

/** Big interaction hint (key cap or touch hand + verb) anchored above a canvas point. */
export class HintUi {
  private node = el('div', 'hint');
  private cap = el('div', 'hint-key ch-key');
  private verb = el('div', 'hint-verb');
  private last: Hint | null = null;
  private hideTimer = 0;
  private box = el('div', 'hint-box');
  private boxHalf = 0;
  /** Listeners (touch action button shows the verb too). */
  onChange: (h: Hint | null) => void = () => {};

  constructor() {
    const box = this.box;
    box.append(this.cap, this.verb);
    this.node.appendChild(box);
    // Touch: the hint itself is a button — tapping what you see triggers the action.
    box.addEventListener('pointerdown', e => {
      if (!this.last || !ctx.root.classList.contains('is-touch')) return;
      e.preventDefault(); e.stopPropagation();
      virtualInput.actionPressed = true;
      box.classList.remove('is-press');
      void box.offsetWidth;
      box.classList.add('is-press');
    });
    ctx.onLayout(() => { this.boxHalf = 0; this.place(); });
  }

  mount(): void { ctx.layers.world.appendChild(this.node); }

  hint(h: Hint | null): void {
    const prev = this.last;
    if (h && prev && h.verb === prev.verb && h.key === prev.key && Math.abs(h.x - prev.x) < 0.25 && Math.abs(h.y - prev.y) < 0.25) return;
    this.last = h ? { ...h } : null;
    if (!h) {
      if (!prev) return;
      this.node.classList.remove('on');
      clearTimeout(this.hideTimer);
      this.hideTimer = window.setTimeout(() => { if (!this.last) this.node.style.visibility = 'hidden'; }, 220);
      this.onChange(null);
      return;
    }
    clearTimeout(this.hideTimer);
    const touch = ctx.root.classList.contains('is-touch');
    if (!prev || prev.verb !== h.verb || prev.key !== h.key) {
      this.cap.textContent = '';
      if (touch && !h.key) this.cap.appendChild(icon('hand'));
      else this.cap.textContent = (h.key ?? 'E').toUpperCase();
      this.cap.classList.toggle('is-wide', (h.key ?? 'E').length > 2);
      this.verb.textContent = h.verb;
      this.boxHalf = 0;
      this.onChange(h);
    }
    this.node.style.visibility = 'visible';
    this.place();
    if (!prev) {
      this.node.classList.remove('on');
      void this.node.offsetWidth;
      this.node.classList.add('on');
    }
  }

  /** Touch: a tap at client (x, y) on the visible hint triggers the action. Returns true when it hit. */
  tapAt(x: number, y: number): boolean {
    if (!this.last || !this.node.classList.contains('on') || ctx.busy()) return false;
    const r = this.box.getBoundingClientRect();
    const pad = 14;
    if (x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) return false;
    virtualInput.actionPressed = true;
    this.box.classList.remove('is-press');
    void this.box.offsetWidth;
    this.box.classList.add('is-press');
    return true;
  }

  private place(): void {
    const h = this.last;
    if (!h) return;
    const p = canvasToPage(h.x, h.y);
    // Keep the whole hint on screen (objects near the screen edge).
    if (!this.boxHalf) this.boxHalf = this.box.offsetWidth / 2;
    const half = this.boxHalf;
    const x = Math.min(window.innerWidth - half - 8, Math.max(half + 8, p.x));
    this.node.style.transform = `translate(${Math.round(x)}px, ${Math.round(p.y)}px)`;
  }
}

interface BubbleEntry { node: HTMLElement; anchor: () => { x: number; y: number } | null; half: number; remove(): void; voiced: boolean; }

/** Speech bubbles anchored to moving canvas points (followed every frame). */
export class BubbleUi {
  private live = new Set<BubbleEntry>();
  private raf = 0;

  constructor() {
    ctx.onLayout(() => { for (const e of this.live) e.half = -1; });
  }

  bubble(text: string, anchor: () => { x: number; y: number } | null, ms?: number, voice: VoicePlayback | null = null): () => void {
    const node = el('div', 'bubble');
    const inner = el('div', 'bubble-text');
    const renderPlain = (): TextReveal => {
      inner.textContent = '';
      for (const seg of parseMarkup(text)) {
        if (seg.style === 'br') inner.appendChild(el('br'));
        else inner.appendChild(el('span', seg.style === 'plain' ? '' : seg.style === 'em' ? 'tx-em' : 'tx-magic', seg.text));
      }
      return { done: true, complete() {} };
    };
    node.appendChild(inner);
    ctx.layers.world.appendChild(node);
    let removed = false;
    let timer = 0;
    const token = ctx.epoch;
    const reveal = revealSpeech(inner, text, voice, renderPlain, () => {},
      () => !removed && token === ctx.epoch && inner.isConnected);
    const remove = () => {
      if (removed) return;
      removed = true;
      clearTimeout(timer);
      reveal.cancel?.();
      voice?.stop();
      node.classList.remove('on');
      node.classList.add('is-out');
      setTimeout(() => { this.live.delete(entry); node.remove(); }, 260);
    };
    const entry: BubbleEntry = { node, anchor, half: -1, remove, voiced: Boolean(voice) };
    this.live.add(entry);
    this.follow(entry);
    requestAnimationFrame(() => { if (!removed) node.classList.add('on'); });
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
    if (voice) {
      void voice.done.then(() => {
        if (!removed) timer = window.setTimeout(remove, voice.outcome === 'ended' ? 600 : (ms ?? bubbleDuration(text)));
      });
    } else timer = window.setTimeout(remove, ms ?? bubbleDuration(text));
    return remove;
  }

  private follow(entry: BubbleEntry): void {
    let pos: { x: number; y: number } | null = null;
    try { pos = entry.anchor(); } catch { pos = null; }
    if (!pos) { entry.node.style.visibility = 'hidden'; if (entry.voiced) entry.remove(); return; }
    entry.node.style.visibility = '';
    const p = canvasToPage(pos.x, pos.y);
    // Keep bubbles on screen horizontally.
    // Width is measured once (and after layout changes), never per frame: no forced layout in the loop.
    if (entry.half < 0) entry.half = ((entry.node.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0) / 2;
    const half = entry.half;
    const x = Math.min(window.innerWidth - half - 6, Math.max(half + 6, p.x));
    entry.node.style.setProperty('--tail', `${Math.round(p.x - x)}px`);
    entry.node.style.transform = `translate(${Math.round(x)}px, ${Math.round(p.y)}px)`;
  }

  private tick = () => {
    for (const entry of this.live) this.follow(entry);
    this.raf = this.live.size ? requestAnimationFrame(this.tick) : 0;
  };

  clear(): void {
    for (const e of this.live) { e.remove(); e.node.remove(); }
    this.live.clear();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

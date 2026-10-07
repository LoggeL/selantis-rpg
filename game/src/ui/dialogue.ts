import { quotedChoiceText, voiceover } from '../audio/voiceover';
import { speaker as speakerDef } from '../core/catalog';
import { G } from '../core/G';
import type { SpeakerDef } from '../core/types';
import { advanceGate } from './advance';
import type { ChoiceOption } from './api';
import { ctx, isConfirm } from './context';
import { dialogueFocus, el, sfx } from './dom';
import { NavList, type NavItem } from './nav';
import { renderChars, revealSpeech, Typewriter } from './typewriter';

const portraitCache = new Map<string, string>();

/** Bottom dock (flex column): choices stack above the dialogue box automatically. */
let dockEl: HTMLElement | null = null;
export function dock(): HTMLElement {
  if (!dockEl) dockEl = el('div', 'dlg-dock');
  if (!dockEl.isConnected) ctx.layers.dialog.appendChild(dockEl);
  return dockEl;
}

/** Portrait URL via the art API (cached). Returns '' when unavailable. */
export function portraitUrl(id: string, mood?: string): string {
  const key = `${id}|${mood ?? 'neutral'}`;
  let url = portraitCache.get(key);
  if (url === undefined) {
    try { url = G.art?.portrait(id, mood) ?? ''; } catch { url = ''; }
    portraitCache.set(key, url);
  }
  return url;
}
/** Drops cached portraits (e.g. after the art layer regenerated them). */
export function clearPortraitCache(): void { portraitCache.clear(); loaded.clear(); }

/** Decoded portrait images by URL: a mood change shows the new face without a blank frame. */
const loaded = new Map<string, Promise<HTMLImageElement | null>>();
function loadPortrait(url: string): Promise<HTMLImageElement | null> {
  let p = loaded.get(url);
  if (!p) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    p = img.decode().then(() => img, () => (img.complete && img.naturalWidth ? img : null));
    loaded.set(url, p);
  }
  return p;
}
const MOODS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'determined', 'hurt', 'thinking', 'scared'];
const warmed = new Set<string>();
/** Loads the other moods of a speaker in the background once they first speak. */
function warmMoods(portraitId: string): void {
  if (warmed.has(portraitId)) return;
  warmed.add(portraitId);
  const idle = (fn: () => void) => ((window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 400)))(fn);
  idle(() => { for (const m of MOODS) { const u = portraitUrl(portraitId, m); if (u) void loadPortrait(u); } });
}
/** Painted portraits (Codex, 256x256) are scaled smoothly; small pixel portraits (fallbacks) stay crisp. */
const isPainted = (img: HTMLImageElement | null) => Boolean(img && img.naturalWidth >= 128);

/**
 * The dialogue box (bottom). One persistent element reused across consecutive lines, so a conversation
 * does not flicker; it hides shortly after the last line unless another line or choices follow.
 *
 * Portrait: two stacked images. A new speaker cuts in with a small pop; a new mood of the same speaker
 * cross-fades (with a tiny breath), so expressions change softly. Missing images fall back to the
 * neutral portrait, then to a hooded silhouette.
 */
class DialogueBox {
  readonly el: HTMLElement;
  private frame: HTMLElement;
  private inner: HTMLElement;
  private imgs: [HTMLImageElement, HTMLImageElement];
  private front = 0;
  private wanted = '';
  private name: HTMLElement;
  private text: HTMLElement;
  private more: HTMLElement;
  private visible = false;
  private hideTimer = 0;
  private currentSpeaker = '';
  private natural = 256;

  constructor() {
    this.el = el('div', 'dlg ch-panel');
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-live', 'polite');
    this.frame = el('div', 'dlg-portrait');
    this.inner = el('div', 'dlg-portrait-inner');
    const mk = () => { const i = el('img', 'dlg-por'); i.alt = ''; i.draggable = false; return i; };
    this.imgs = [mk(), mk()];
    const sil = el('div', 'dlg-por-sil');
    sil.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 9c-9 0-15 7-15.5 16-.3 5 1.3 9.5 4.3 12.6C12 40.5 7 47 6 56h52c-1-9-6-15.5-14.8-18.4 3-3.1 4.6-7.6 4.3-12.6C47 16 41 9 32 9z" fill="currentColor"/><path d="M19.5 24c2-6.5 7-10 12.5-10s10.5 3.5 12.5 10c-3.5-3-8-4.5-12.5-4.5S23 21 19.5 24z" fill="#000" opacity=".25"/></svg>';
    this.inner.append(sil, ...this.imgs);
    this.frame.appendChild(this.inner);
    this.name = el('div', 'dlg-name');
    this.text = el('div', 'dlg-text');
    this.more = el('div', 'dlg-more');
    this.more.innerHTML = '<svg viewBox="0 0 12 12"><path d="M2 3.5h8L6 9z" fill="currentColor"/></svg>';
    const body = el('div', 'dlg-body');
    body.append(this.name, this.text);
    this.el.append(this.frame, body, this.more);
  }

  show(): void {
    clearTimeout(this.hideTimer);
    if (!this.el.isConnected || this.el.parentElement !== dock()) dock().appendChild(this.el);
    if (!this.visible) {
      this.visible = true;
      this.el.classList.remove('is-out');
      this.el.classList.add('is-in');
      dialogueFocus(true);
    }
  }

  /** Schedules hiding (cancelled when another line follows right away). */
  scheduleHide(ms = 90): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.hideNow(), ms);
  }

  hideNow(): void {
    clearTimeout(this.hideTimer);
    if (!this.visible) return;
    this.visible = false;
    this.currentSpeaker = '';
    this.el.classList.remove('is-in');
    this.el.classList.add('is-out');
    dialogueFocus(false);
    const node = this.el;
    setTimeout(() => { if (!this.visible) node.remove(); }, 260);
  }

  get isVisible(): boolean { return this.visible; }
  get pendingHide(): boolean { return this.visible; }

  setSpeaker(id: string, def: SpeakerDef, opts: { portrait?: string; mood?: string }): void {
    const narrator = id === 'narrator';
    this.el.classList.toggle('is-narrator', narrator);
    this.el.style.setProperty('--accent', def.color ?? '#d8b25a');
    this.name.textContent = narrator ? '' : def.name;
    this.name.hidden = narrator || !def.name;
    const portraitId = opts.portrait ?? def.portrait ?? id;
    const url = narrator ? '' : portraitUrl(portraitId, opts.mood);
    this.frame.hidden = !url;
    this.el.classList.toggle('has-portrait', Boolean(url));
    const newSpeaker = this.currentSpeaker !== id;
    this.currentSpeaker = id;
    if (!url) { this.wanted = ''; return; }
    if (newSpeaker) {
      this.frame.classList.remove('pop');
      void this.frame.offsetWidth;
      this.frame.classList.add('pop');
    }
    this.setPortrait(url, portraitId, newSpeaker);
    warmMoods(portraitId);
  }

  private setPortrait(url: string, portraitId: string, cut: boolean): void {
    const front = this.imgs[this.front];
    if (this.wanted === url && front.classList.contains('on')) return;
    this.wanted = url;
    if (cut) {
      // A different face must never flash in: hide the old one right away.
      for (const i of this.imgs) { i.classList.remove('on'); i.classList.add('no-fade'); }
    }
    void loadPortrait(url).then(async img => {
      if (this.wanted !== url) return;
      if (!img) {
        // Broken mood image: try the neutral portrait, then the silhouette.
        const neutral = portraitUrl(portraitId);
        const alt = neutral && neutral !== url ? await loadPortrait(neutral) : null;
        if (this.wanted !== url) return;
        if (!alt) { this.frame.classList.add('is-missing'); for (const i of this.imgs) i.classList.remove('on'); return; }
        img = alt;
      }
      this.frame.classList.remove('is-missing');
      const back = this.imgs[1 - this.front];
      const prev = this.imgs[this.front];
      back.src = img.src;
      back.classList.toggle('px', !isPainted(img));
      this.natural = img.naturalWidth || 64;
      this.sizePortrait();
      back.classList.toggle('no-fade', cut);
      back.classList.remove('breath');
      if (!cut && prev.classList.contains('on')) { void back.offsetWidth; back.classList.add('breath'); }
      back.classList.add('on');
      prev.classList.remove('on');
      this.front = 1 - this.front;
      if (cut) requestAnimationFrame(() => { for (const i of this.imgs) i.classList.remove('no-fade'); });
    });
  }

  sizePortrait(): void {
    const n = this.natural;
    const small = Math.min(window.innerWidth, window.innerHeight) < 560;
    let size: number;
    if (n >= 128) {
      // Painted: a fixed size in em, smooth scaling.
      const em = ctx.portrait ? 5.2 : small ? 5 : 7.2;
      size = Math.round(ctx.fontPx * em);
    } else {
      const target = ctx.portrait ? 4.6 : small ? 4.2 : 6.4;
      size = n * ctx.pixelScale(n, target);
    }
    this.inner.style.width = `${size}px`;
    this.inner.style.height = `${size}px`;
  }

  get textEl(): HTMLElement { return this.text; }
  setMore(on: boolean): void { this.more.classList.toggle('on', on); }
  setThinking(on: boolean): void { this.el.classList.toggle('is-choosing', on); }
}

export class DialogueUi {
  private box = new DialogueBox();

  constructor() {
    ctx.onLayout(() => this.box.sizePortrait());
  }

  /** Dialogue line with typewriter. First press completes the line, second continues. */
  async say(id: string, text: string, opts: { portrait?: string; mood?: string } = {}): Promise<void> {
    if (ctx.stale()) return ctx.never();
    const token = ctx.epoch;
    await voiceover.preload();
    if (ctx.stale() || token !== ctx.epoch) return ctx.never();
    const def = speakerDef(id);
    const box = this.box;
    box.show();
    box.setThinking(false);
    box.setSpeaker(id, def, opts);
    box.setMore(false);
    return new Promise<void>(resolve => {
      let completedAt = 0;
      const typeOptions = {
        voice: id === 'narrator' ? undefined : def.voice,
        onDone: () => { completedAt = performance.now(); box.setMore(true); },
      };
      const originalVoice = typeOptions.voice;
      const recording = voiceover.play('say', id, text, () => { typeOptions.voice = originalVoice; }, opts.mood);
      if (recording) typeOptions.voice = undefined;
      const tw = revealSpeech(box.textEl, text, recording,
        () => new Typewriter(box.textEl, text, typeOptions), typeOptions.onDone,
        () => token === ctx.epoch && !ctx.stale() && box.textEl.isConnected);
      const gate = advanceGate(`say:${id}`, () => {
        if (!tw.done) { tw.complete(); return; }
        if (performance.now() - completedAt < 140) return; // a mashed double press does not skip unseen text
        gate.close();
        recording?.stop();
        sfx('ui-move', { volume: 0.25, pitch: 1.4 });
        box.setMore(false);
        box.scheduleHide();
        resolve();
      });
    });
  }

  /** Player's thought: italic, no box chrome, soft and quiet (no blips). */
  async think(text: string, opts: { speaker?: string } = {}): Promise<void> {
    if (ctx.stale()) return ctx.never();
    const token = ctx.epoch;
    await voiceover.preload();
    if (ctx.stale() || token !== ctx.epoch) return ctx.never();
    this.box.hideNow();
    const recording = voiceover.play('think', opts.speaker ?? voiceover.playerSpeaker(), text);
    const wrap = el('div', 'thought');
    const inner = el('div', 'thought-text');
    wrap.appendChild(el('div', 'thought-orn', '❧'));
    const more = el('div', 'dlg-more');
    more.innerHTML = '<svg viewBox="0 0 12 12"><path d="M2 3.5h8L6 9z" fill="currentColor"/></svg>';
    wrap.append(inner, more);
    dock().appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('is-in'));
    return new Promise<void>(resolve => {
      let completedAt = 0;
      const onDone = () => { completedAt = performance.now(); more.classList.add('on'); };
      const tw = revealSpeech(inner, text, recording,
        () => new Typewriter(inner, text, { cps: Math.max(0, G.settings.textSpeed * 0.8), onDone }),
        onDone, () => token === ctx.epoch && !ctx.stale() && inner.isConnected);
      const gate = advanceGate('think', () => {
        if (!tw.done) { tw.complete(); return; }
        if (performance.now() - completedAt < 140) return;
        gate.close();
        recording?.stop();
        wrap.classList.remove('is-in');
        wrap.classList.add('is-out');
        setTimeout(() => wrap.remove(), 320);
        resolve();
      });
    });
  }

  /** Choice list. With a prompt the prompt line is typed first; without one, a just-finished line stays visible. */
  async choose(options: (string | ChoiceOption)[], opts: { speaker?: string; prompt?: string } = {}): Promise<number> {
    if (ctx.stale()) return ctx.never();
    const loadEpoch = ctx.epoch;
    await voiceover.preload();
    if (ctx.stale() || loadEpoch !== ctx.epoch) return ctx.never();
    voiceover.stop();
    const choiceEpoch = ctx.epoch;
    // Copies: the caller's option objects are never modified.
    const list: ChoiceOption[] = options.map(o => (typeof o === 'string' ? { text: o } : { ...o }));
    if (!list.some(o => !o.disabled)) list.forEach(o => { o.disabled = false; }); // never soft-lock
    const box = this.box;
    let tw: Typewriter | undefined;
    if (opts.prompt) {
      const id = opts.speaker ?? 'narrator';
      box.show();
      box.setSpeaker(id, speakerDef(id), {});
      tw = new Typewriter(box.textEl, opts.prompt, { voice: id === 'narrator' ? undefined : speakerDef(id).voice });
    } else if (box.isVisible) {
      box.show(); // keep the previous line as context
    }
    if (box.isVisible) { box.setMore(false); box.setThinking(true); }

    const panel = el('div', 'choices ch-panel');
    panel.setAttribute('role', 'listbox');
    if (!box.isVisible) panel.classList.add('is-solo');
    const items: NavItem[] = [];
    let resolveFn!: (i: number) => void;
    const promise = new Promise<number>(r => { resolveFn = r; });
    let picked = false;

    const pick = (i: number) => {
      if (picked) return;
      if (list[i]?.disabled) { sfx('ui-cancel', { volume: 0.5 }); return; }
      if (tw && !tw.done) tw.complete();
      picked = true;
      sfx('ui-confirm', { volume: 0.7 });
      items[i].el.classList.add('is-picked');
      closeModal();
      setTimeout(() => {
        panel.classList.add('is-out');
        setTimeout(() => panel.remove(), 220);
        box.setThinking(false);
        box.scheduleHide();
        void this.speakChoice(list[i].text, opts.speaker ?? voiceover.playerSpeaker()).then(() => {
          if (ctx.epoch === choiceEpoch && !ctx.stale()) resolveFn(i);
        });
      }, ctx.reducedMotion ? 60 : 230);
    };

    list.forEach((opt, i) => {
      const row = el('button', 'choice');
      row.type = 'button';
      row.setAttribute('role', 'option');
      const num = el('span', 'choice-key ch-key', String(i + 1));
      const label = el('span', 'choice-text');
      renderChars(label, opt.text).forEach(c => c.classList.add('on'));
      row.append(num, label);
      if (opt.tag) row.appendChild(el('span', 'choice-tag', opt.tag));
      if (opt.disabled) {
        row.classList.add('is-disabled');
        row.setAttribute('aria-disabled', 'true');
        if (opt.reason) row.appendChild(el('span', 'choice-reason', opt.reason));
      }
      row.style.animationDelay = `${60 + i * 55}ms`;
      panel.appendChild(row);
      items.push({ el: row, disabled: opt.disabled, activate: () => pick(i) });
    });
    // Nothing can be picked before every row has finished animating in (and never within 350 ms):
    // mashing through the previous line must not choose an option the player has not seen.
    const openedAt = performance.now();
    let armAt = openedAt + (ctx.reducedMotion ? 350 : Math.max(350, 60 + list.length * 55 + 220));
    const nav = new NavList(items, { armAt });
    const d = dock();
    if (box.el.parentElement === d) d.insertBefore(panel, box.el); else d.appendChild(panel);
    // Keys already held when the list opened only count after they were released once.
    const heldAtOpen = new Set([...ctx.held]);
    const closeModal = ctx.open({
      id: 'choose',
      allowMenu: true,
      onKey: e => {
        if (e.repeat || heldAtOpen.has(e.code)) return true;
        const digit = /^(Digit|Numpad)([1-9])$/.exec(e.code)?.[2] ?? (/^[1-9]$/.test(e.key) ? e.key : null);
        const early = performance.now() < armAt;
        if (tw && !tw.done && isConfirm(e)) { tw.complete(); return true; }
        // Still mashing from the previous line: every early press pushes the arming further out, so only
        // a deliberate press after a short pause picks.
        if (early && (isConfirm(e) || digit)) { armAt = Math.max(armAt, performance.now() + 450); nav.arm(armAt); return true; }
        if (digit) {
          const n = Number(digit);
          if (n <= list.length) { nav.select(n - 1, false); pick(n - 1); }
          return true;
        }
        return nav.key(e);
      },
      onKeyUp: e => { heldAtOpen.delete(e.code); return false; },
    });
    return promise;
  }

  /** Only the selected quoted spoken response has a recording, and it can always be skipped. */
  private async speakChoice(text: string, speaker: string): Promise<void> {
    const spoken = quotedChoiceText(text);
    if (ctx.stale() || !spoken) return;
    const recording = voiceover.play('choice', speaker, spoken);
    if (!recording) return;
    const gate = advanceGate('choice:voice', () => recording.stop(), { graceMs: 200 });
    try { await recording.done; } finally { gate.close(); }
  }

  /** Immediately removes all dialogue chrome (reset). */
  clear(): void {
    voiceover.stop();
    this.box.hideNow();
    ctx.layers.dialog.querySelectorAll('.choices, .thought, .ui-catcher, .hold').forEach(n => n.remove());
  }
}

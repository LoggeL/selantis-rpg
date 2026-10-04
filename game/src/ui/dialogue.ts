import { speaker as speakerDef } from '../core/catalog';
import { G } from '../core/G';
import type { SpeakerDef } from '../core/types';
import { advanceGate } from './advance';
import type { ChoiceOption } from './api';
import { ctx, isConfirm } from './context';
import { dialogueFocus, el, sfx } from './dom';
import { NavList, type NavItem } from './nav';
import { renderChars, Typewriter } from './typewriter';

const portraitCache = new Map<string, string>();

/** Bottom dock (flex column): choices stack above the dialogue box automatically. */
let dockEl: HTMLElement | null = null;
export function dock(): HTMLElement {
  if (!dockEl) dockEl = el('div', 'dlg-dock');
  if (!dockEl.isConnected) ctx.layers.dialog.appendChild(dockEl);
  return dockEl;
}

/** Portrait data URL via the art API (cached). Returns '' when unavailable. */
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
export function clearPortraitCache(): void { portraitCache.clear(); }

/**
 * The dialogue box (bottom). One persistent element reused across consecutive lines, so a conversation
 * does not flicker; it hides shortly after the last line unless another line or choices follow.
 */
class DialogueBox {
  readonly el: HTMLElement;
  private frame: HTMLElement;
  private img: HTMLImageElement;
  private name: HTMLElement;
  private text: HTMLElement;
  private more: HTMLElement;
  private visible = false;
  private hideTimer = 0;
  private currentSpeaker = '';

  constructor() {
    this.el = el('div', 'dlg ch-panel');
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-live', 'polite');
    this.frame = el('div', 'dlg-portrait');
    const inner = el('div', 'dlg-portrait-inner');
    this.img = el('img', 'px');
    this.img.alt = '';
    this.img.draggable = false;
    inner.appendChild(this.img);
    this.frame.appendChild(inner);
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
    const url = narrator ? '' : portraitUrl(opts.portrait ?? def.portrait ?? id, opts.mood);
    this.frame.hidden = !url;
    this.el.classList.toggle('has-portrait', Boolean(url));
    if (url) {
      if (this.img.src !== url) {
        this.img.onload = () => this.sizePortrait();
        this.img.src = url;
        if (this.img.complete) this.sizePortrait();
      }
      if (this.currentSpeaker !== id) {
        this.frame.classList.remove('pop');
        void this.frame.offsetWidth;
        this.frame.classList.add('pop');
      }
    }
    this.currentSpeaker = id;
  }

  sizePortrait(): void {
    const n = this.img.naturalWidth || 64;
    const small = Math.min(window.innerWidth, window.innerHeight) < 560;
    const target = ctx.portrait ? 4.6 : small ? 4.2 : 6.4;
    const scale = ctx.pixelScale(n, target);
    this.img.style.width = `${n * scale}px`;
    this.img.style.height = `${(this.img.naturalHeight || n) * scale}px`;
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
  say(id: string, text: string, opts: { portrait?: string; mood?: string } = {}): Promise<void> {
    if (ctx.stale()) return ctx.never();
    const def = speakerDef(id);
    const box = this.box;
    box.show();
    box.setThinking(false);
    box.setSpeaker(id, def, opts);
    box.setMore(false);
    return new Promise<void>(resolve => {
      let completedAt = 0;
      const tw = new Typewriter(box.textEl, text, {
        voice: id === 'narrator' ? undefined : def.voice,
        onDone: () => { completedAt = performance.now(); box.setMore(true); },
      });
      const gate = advanceGate(`say:${id}`, () => {
        if (!tw.done) { tw.complete(); return; }
        if (performance.now() - completedAt < 140) return; // a mashed double press does not skip unseen text
        gate.close();
        sfx('ui-move', { volume: 0.25, pitch: 1.4 });
        box.setMore(false);
        box.scheduleHide();
        resolve();
      });
    });
  }

  /** Player's thought: italic, no box chrome, soft and quiet (no blips). */
  think(text: string): Promise<void> {
    if (ctx.stale()) return ctx.never();
    this.box.hideNow();
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
      const tw = new Typewriter(inner, text, { cps: Math.max(0, G.settings.textSpeed * 0.8), onDone: () => { completedAt = performance.now(); more.classList.add('on'); } });
      const gate = advanceGate('think', () => {
        if (!tw.done) { tw.complete(); return; }
        if (performance.now() - completedAt < 140) return;
        gate.close();
        wrap.classList.remove('is-in');
        wrap.classList.add('is-out');
        setTimeout(() => wrap.remove(), 320);
        resolve();
      });
    });
  }

  /** Choice list. With a prompt the prompt line is typed first; without one, a just-finished line stays visible. */
  choose(options: (string | ChoiceOption)[], opts: { speaker?: string; prompt?: string } = {}): Promise<number> {
    if (ctx.stale()) return ctx.never();
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
        resolveFn(i);
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

  /** Immediately removes all dialogue chrome (reset). */
  clear(): void {
    this.box.hideNow();
    ctx.layers.dialog.querySelectorAll('.choices, .thought, .ui-catcher, .hold').forEach(n => n.remove());
  }
}

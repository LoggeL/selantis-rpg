import { events } from '../core/events';
import { G } from '../core/G';
import { canvasToPage, GAME_H, GAME_W } from '../core/viewport';
import { ctx, type HudMode } from './context';
import { el, icon, sfx } from './dom';

/** Gameplay HUD: objective note (top-left), objective edge pointer, icon buttons (top-right). */
export class HudUi {
  private root = el('div', 'hud');
  private obj = el('div', 'hud-obj');
  private objText = el('div', 'hud-obj-text');
  private pointer = el('div', 'hud-pointer');
  private pointerPos: { x: number; y: number } | null = null;
  private current: string | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(actions: { journal: () => void; bag: () => void; menu: () => void }) {
    const label = el('div', 'hud-obj-label');
    label.append(icon('quill', 'ch-ico hud-obj-ico'), el('span', '', 'Ziel'));
    this.obj.append(label, this.objText);
    this.obj.addEventListener('click', () => actions.journal());

    const buttons = el('div', 'hud-buttons');
    const mk = (name: 'journal' | 'bag' | 'menu', title: string, key: string, fn: () => void) => {
      const b = el('button', `hud-btn hud-btn-${name}`);
      b.type = 'button';
      b.title = `${title} (${key})`;
      b.setAttribute('aria-label', title);
      b.append(icon(name), el('span', 'hud-btn-key', key));
      b.addEventListener('click', e => { e.stopPropagation(); (e.currentTarget as HTMLElement).blur(); fn(); });
      b.addEventListener('pointerdown', e => e.stopPropagation());
      return b;
    };
    buttons.append(mk('journal', 'Tagebuch', 'J', actions.journal), mk('bag', 'Tasche', 'I', actions.bag), mk('menu', 'Menü', 'Esc', actions.menu));
    this.pointer.innerHTML = '<svg viewBox="0 0 32 32"><path d="M29 16 6 4l5 12-5 12z" fill="currentColor"/><path d="M29 16 6 4l5 12" fill="#fff" opacity=".35"/></svg>';
    this.root.append(this.obj, buttons, this.pointer);
    this.obj.hidden = true;

    events.on('objective:set', (p: { text: string }) => this.objective(p.text));
    events.on('objective:done', () => this.completeCurrent());
    events.on('state:changed', (p: { kind: string }) => {
      if (p?.kind === 'load' || p?.kind === 'reset') this.objective(G.state.activeObjective()?.text ?? null, true);
    });
    ctx.onLayout(() => this.placePointer());
  }

  mount(): void { ctx.layers.hud.appendChild(this.root); }

  setMode(mode: HudMode): void {
    const r = ctx.root;
    for (const m of ['explore', 'battle', 'cinematic', 'none']) r.classList.toggle(`hud-${m}`, m === mode);
    // The visible Esc label already explains this control; a native tooltip would cover battle controls.
    const menu = this.root.querySelector<HTMLButtonElement>('.hud-btn-menu')!;
    if (mode === 'battle') menu.removeAttribute('title');
    else menu.title = 'Menü (Esc)';
  }

  /** Sets the objective text with a write-in animation; null hides. Calls are serialised. */
  objective(text: string | null, instant = false): void {
    if (text === this.current) return;
    this.current = text;
    this.queue = this.queue.then(() => this.apply(text, instant));
  }

  private async apply(text: string | null, instant: boolean): Promise<void> {
    const o = this.obj;
    if (!o.hidden && !instant) {
      o.classList.add('is-leaving');
      await new Promise(r => setTimeout(r, ctx.reducedMotion ? 60 : 320));
      o.classList.remove('is-leaving', 'is-done');
    }
    o.classList.remove('is-done');
    if (!text) { o.hidden = true; return; }
    this.objText.textContent = text;
    o.hidden = false;
    o.classList.remove('is-writing');
    void o.offsetWidth;
    if (!instant) {
      o.classList.add('is-writing');
      sfx('write', { volume: 0.5 });
    }
  }

  /** Strikes the current objective, then shows the next open one (or hides). */
  private completeCurrent(): void {
    this.queue = this.queue.then(async () => {
      if (this.obj.hidden) return;
      this.obj.classList.add('is-done');
      await new Promise(r => setTimeout(r, ctx.reducedMotion ? 300 : 1300));
    });
    const next = G.state.activeObjective()?.text ?? null;
    this.current = '__done__';
    this.objective(next);
  }

  // ------------------------------------------------------------- pointer

  objectivePointer(pos: { x: number; y: number } | null): void {
    this.pointerPos = pos;
    this.placePointer();
  }

  private placePointer(): void {
    const p = this.pointerPos;
    if (!p) { this.pointer.classList.remove('on'); return; }
    const cx = GAME_W / 2, cy = GAME_H / 2;
    const dx = p.x - cx, dy = p.y - cy;
    // Only for goals off screen: a subtle arrow at the edge. On-screen goals need no pointer.
    const inside = p.x >= 0 && p.x <= GAME_W && p.y >= 0 && p.y <= GAME_H;
    this.pointer.classList.toggle('on', !inside);
    if (inside) return;
    const angle = Math.atan2(dy, dx);
    // Clamp to an inset rectangle along the ray from the centre.
    const mx = GAME_W / 2 - 22, my = GAME_H / 2 - 22;
    const t = Math.min(mx / Math.max(1e-6, Math.abs(dx)), my / Math.max(1e-6, Math.abs(dy)), 1);
    const x = cx + dx * t;
    const y = cy + dy * t;
    const page = canvasToPage(x, y);
    this.pointer.style.transform = `translate(${page.x}px, ${page.y}px) translate(-50%, -50%) rotate(${angle}rad)`;
  }
}

import { events } from '../core/events';
import { inputLock, isTouch } from '../core/input';
import { settings } from '../core/settings';
import { canvasRect, GAME_H, GAME_W } from '../core/viewport';
import { blurActive, el } from './dom';

/** Stacking layers inside #ui (bottom → top). */
export const LAYERS = ['hud', 'world', 'touch', 'letterbox', 'plate', 'toast', 'fade', 'dialog', 'card', 'title', 'overlay', 'debug'] as const;
export type LayerName = typeof LAYERS[number];

export interface Modal {
  id: string;
  /** Return true when the key was handled (it is then swallowed and never reaches Phaser). */
  onKey?(e: KeyboardEvent): boolean;
  onKeyUp?(e: KeyboardEvent): boolean;
  /** Global hotkeys allowed while this modal is on top (e.g. Esc opens the menu during dialogue). */
  allowMenu?: boolean;
  allowJournal?: boolean;
  /** Does not count for busy() (e.g. the title screen counts, a plate counts; debug overlay counts). */
  passive?: boolean;
}

export type HudMode = 'explore' | 'battle' | 'cinematic' | 'none';

/** Keys that confirm/advance. A modal closing while one is still held keeps the input lock until release. */
export const CONFIRM_CODES = new Set(['KeyE', 'Space', 'Enter', 'NumpadEnter']);
export const isConfirm = (e: KeyboardEvent) => CONFIRM_CODES.has(e.code) || e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E';

/** Shared UI runtime: layers, modal stack, keyboard routing, input lock bookkeeping and layout metrics. */
export class UiContext {
  root!: HTMLElement;
  readonly layers = {} as Record<LayerName, HTMLElement>;
  hudMode: HudMode = 'none';
  /** Called for keys no modal handled. Return true when handled. */
  globalKeys: (e: KeyboardEvent) => boolean = () => false;

  private stack: Modal[] = [];
  private locks = 0;
  private pendingRelease = 0;
  /** Bumped by clearModals() so delayed lock releases from before a reset are ignored. */
  private generation = 0;
  readonly held = new Set<string>();
  /**
   * Scene epoch: bumped by reset() and when the title opens. Awaitables started in an older epoch never
   * resolve, so a story script that was sleeping when the player left stops at its next UI call.
   */
  epoch = 0;
  /** True between a transition's reset and the next scene:goto (old scripts must not draw meanwhile). */
  transitioning = false;
  private layoutFns = new Set<() => void>();

  /** Layout metrics (CSS px). hud = rect used for HUD chrome (stage in landscape, window in portrait). */
  stage = { x: 0, y: 0, w: GAME_W, h: GAME_H, scale: 1 };
  hud = { x: 0, y: 0, w: 0, h: 0 };
  portrait = false;
  fontPx = 18;

  mount(root: HTMLElement): void {
    this.root = root;
    root.classList.add('chronik');
    for (const name of LAYERS) {
      const layer = el('div', `ui-layer ui-layer-${name}`);
      layer.dataset.layer = name;
      root.appendChild(layer);
      this.layers[name] = layer;
    }
    window.addEventListener('keydown', e => this.onKeyDown(e), true);
    window.addEventListener('keyup', e => this.onKeyUp(e), true);
    window.addEventListener('blur', () => this.held.clear());
    window.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 120));
    document.addEventListener('fullscreenchange', () => setTimeout(() => this.layout(), 60));
    events.on('settings:changed', () => this.applySettings());
    this.applySettings();
    root.classList.toggle('is-touch', isTouch || new URLSearchParams(location.search).has('touch'));
    // The canvas appears after Phaser boots and is resized by the Scale manager: watch it.
    const watch = () => {
      const canvas = document.querySelector('#game canvas');
      if (canvas && 'ResizeObserver' in window) new ResizeObserver(() => this.layout()).observe(canvas);
      else if (!canvas) { requestAnimationFrame(watch); return; }
      this.layout();
    };
    watch();
    this.layout();
  }

  applySettings(): void {
    this.root?.classList.toggle('reduced-motion', settings.reducedMotion);
  }

  get reducedMotion(): boolean { return settings.reducedMotion; }

  onLayout(fn: () => void): () => void { this.layoutFns.add(fn); return () => this.layoutFns.delete(fn); }

  layout(): void {
    if (!this.root) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = canvasRect();
    let x: number, y: number, w: number, h: number;
    if (r && r.width > 0) ({ left: x, top: y, width: w, height: h } = r);
    else {
      const s = Math.min(vw / GAME_W, vh / GAME_H);
      w = GAME_W * s; h = GAME_H * s; x = (vw - w) / 2; y = (vh - h) / 2;
    }
    this.stage = { x, y, w, h, scale: w / GAME_W };
    this.portrait = vh > vw * 1.05;
    // In portrait the canvas is a thin band: HUD chrome uses the whole window (black bars become UI space).
    this.hud = this.portrait ? { x: 0, y: 0, w: vw, h: vh } : { x: Math.max(0, x), y: Math.max(0, y), w: Math.min(vw, w), h: Math.min(vh, h) };
    const base = this.portrait ? vw : Math.min(this.hud.w, this.hud.h * 16 / 9);
    this.fontPx = Math.round(Math.min(24, Math.max(15, 9.5 + base * 0.0066)) * 10) / 10;
    const s = this.root.style;
    s.setProperty('--sx', `${x}px`); s.setProperty('--sy', `${y}px`); s.setProperty('--sw', `${w}px`); s.setProperty('--sh', `${h}px`);
    s.setProperty('--hx', `${this.hud.x}px`); s.setProperty('--hy', `${this.hud.y}px`); s.setProperty('--hw', `${this.hud.w}px`); s.setProperty('--hh', `${this.hud.h}px`);
    s.setProperty('--vw', `${vw}px`); s.setProperty('--vh', `${vh}px`);
    s.fontSize = `${this.fontPx}px`;
    s.setProperty('--isc', String(this.pixelScale(16, 2.3)));
    s.setProperty('--isc-big', String(this.pixelScale(16, 3.6)));
    this.root.classList.toggle('is-portrait', this.portrait);
    this.root.classList.toggle('is-small', Math.min(vw, vh) < 560);
    for (const fn of this.layoutFns) fn();
  }

  /** Integer pixel scale for pixel art of `natural` px so it is about `targetEm` font-em tall. */
  pixelScale(natural: number, targetEm: number): number {
    return Math.max(1, Math.round((this.fontPx * targetEm) / Math.max(1, natural)));
  }

  // ---------------------------------------------------------------- modal stack

  /** Pushes a modal (locks gameplay input). Returns an idempotent close function. */
  open(modal: Modal): () => void {
    this.stack.push(modal);
    this.syncModalClass();
    this.locks++;
    inputLock.push();
    blurActive();
    let closed = false;
    return () => {
      if (closed) return;
      closed = true;
      const i = this.stack.indexOf(modal);
      if (i < 0) return; // already dropped by clearModals() (its lock was released there)
      this.stack.splice(i, 1);
      this.syncModalClass();
      this.releaseLock();
    };
  }

  /** Releases one lock, but only after confirm keys are released (no carry-over into gameplay). */
  private releaseLock(): void {
    const gen = this.generation;
    const release = () => { if (gen === this.generation && this.locks > 0) { this.locks--; inputLock.pop(); } };
    const anyHeld = [...this.held].some(code => CONFIRM_CODES.has(code));
    if (!anyHeld) { setTimeout(release, 40); return; }
    this.pendingRelease++;
    const started = performance.now();
    const check = () => {
      const still = [...this.held].some(code => CONFIRM_CODES.has(code));
      if (!still || performance.now() - started > 900) { this.pendingRelease--; release(); return; }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  private syncModalClass(): void {
    this.root?.classList.toggle('is-modal', this.busy());
    this.root?.setAttribute('data-modal', this.top()?.id ?? '');
  }

  /** Story UI must not open now: the title is up or a scene transition is in progress. */
  stale(): boolean { return this.transitioning || this.has('title'); }

  /** Promise that never settles (returned to calls from scripts of a scene the player already left). */
  never<T>(): Promise<T> { return new Promise<T>(() => {}); }

  top(): Modal | undefined { return this.stack[this.stack.length - 1]; }
  has(id: string): boolean { return this.stack.some(m => m.id === id); }
  busy(): boolean { return this.stack.some(m => !m.passive); }

  /** Drops every modal and our input locks (used by reset when leaving to the title / warping). */
  clearModals(): void {
    this.stack.length = 0;
    this.generation++;
    this.syncModalClass();
    while (this.locks > 0) { this.locks--; inputLock.pop(); }
  }

  // ---------------------------------------------------------------- keyboard routing

  private onKeyDown(e: KeyboardEvent): void {
    this.held.add(e.code);
    const top = this.top();
    const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'text';
    if (typing && e.key !== 'Escape' && e.key !== 'Enter' && !e.key.startsWith('Arrow')) return;
    if (top?.onKey && top.onKey(e)) { this.swallow(e); return; }
    if (e.key === 'Tab') e.preventDefault(); // never move browser focus
    if ((!top || top.allowMenu || top.allowJournal || e.key === 'F2') && this.globalKeys(e)) { this.swallow(e); return; }
    if (top && (isConfirm(e) || e.key.startsWith('Arrow'))) this.swallow(e); // modal owns confirm keys
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.held.delete(e.code);
    const top = this.top();
    if (top?.onKeyUp && top.onKeyUp(e)) { e.preventDefault(); e.stopImmediatePropagation(); }
    else if (top && e.key === ' ') e.preventDefault();
  }

  private swallow(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopImmediatePropagation();
    blurActive();
  }
}

export const ctx = new UiContext();

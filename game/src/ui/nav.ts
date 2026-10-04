import { isConfirm } from './context';
import { sfx } from './dom';

export interface NavItem {
  el: HTMLElement;
  disabled?: boolean;
  activate?(): void;
  /** Left/right adjust (sliders, toggles). */
  left?(): void;
  right?(): void;
}

export interface NavOptions {
  columns?: number;
  wrap?: boolean;
  onSelect?: (i: number) => void;
  sound?: boolean;
  /**
   * performance.now() timestamp before which pointer presses are ignored (rows still animating in).
   * Default: the moment the list was created.
   */
  armAt?: number;
  /** Initially selected index (default: first enabled). */
  start?: number;
}

/**
 * Keyboard + pointer navigation for a vertical (or grid) list: arrows/WASD move, Enter/Space/E activate,
 * hover selects, click activates. The selected element gets the class `is-sel`.
 *
 * Pointer safety: a row only activates on click when its own pointerdown happened on that row after the
 * list was armed. A tap that ended the previous dialogue line (whose follow-up click lands on a row that
 * appeared under the finger) therefore never picks anything.
 */
export class NavList {
  index = -1;
  private armAt: number;
  private bound = new WeakSet<HTMLElement>();
  private downOn: HTMLElement | null = null;

  constructor(public items: NavItem[], private opts: NavOptions = {}) {
    this.armAt = opts.armAt ?? performance.now();
    this.bindAll();
    this.selectInitial(opts.start);
  }

  /** Delays pointer activation until `at` (performance.now() based). */
  arm(at: number): void { this.armAt = at; }

  private selectInitial(start?: number): void {
    if (start !== undefined && this.items[start] && !this.items[start].disabled) { this.select(start, false); return; }
    const first = this.items.findIndex(it => !it.disabled);
    if (first >= 0) this.select(first, false);
  }

  private bindAll(): void {
    this.items.forEach(item => {
      if (this.bound.has(item.el)) return;
      this.bound.add(item.el);
      this.bind(item.el);
    });
  }

  private bind(node: HTMLElement): void {
    const indexOf = () => this.items.findIndex(it => it.el === node);
    node.addEventListener('pointerenter', e => {
      const i = indexOf();
      if ((e as PointerEvent).pointerType === 'mouse' && i >= 0 && !this.items[i].disabled && !node.hidden) this.select(i, false);
    });
    node.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this.downOn = performance.now() >= this.armAt ? node : null;
    });
    node.addEventListener('click', e => {
      e.stopPropagation();
      const i = indexOf();
      const armed = this.downOn === node;
      this.downOn = null;
      if (i < 0 || !armed) return;
      const item = this.items[i];
      if (item.disabled) { sfx('ui-cancel', { volume: 0.5 }); return; }
      this.select(i, false);
      item.activate?.();
    });
  }

  setItems(items: NavItem[], start?: number): void {
    this.items[this.index]?.el.classList.remove('is-sel');
    this.items = items;
    this.bindAll();
    this.index = -1;
    this.selectInitial(start);
  }

  select(i: number, sound = true): void {
    if (i === this.index || !this.items[i]) return;
    this.items[this.index]?.el.classList.remove('is-sel');
    this.index = i;
    this.items[i].el.classList.add('is-sel');
    this.items[i].el.scrollIntoView?.({ block: 'nearest' });
    if (sound && this.opts.sound !== false) sfx('ui-move', { volume: 0.45 });
    this.opts.onSelect?.(i);
  }

  private move(delta: number): void {
    const n = this.items.length;
    if (!n) return;
    let i = this.index;
    for (let k = 0; k < n; k++) {
      i += delta;
      if (i < 0 || i >= n) {
        if (this.opts.wrap === false) return;
        i = (i + n) % n;
      }
      if (!this.items[i].disabled && !this.items[i].el.hidden) { this.select(i); return; }
    }
  }

  key(e: KeyboardEvent): boolean {
    const cols = this.opts.columns ?? 1;
    const k = e.key;
    const item = this.items[this.index];
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { this.move(-cols); return true; }
    if (k === 'ArrowDown' || k === 's' || k === 'S') { this.move(cols); return true; }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
      if (item?.left) { item.left(); return true; }
      if (cols > 1) { this.move(-1); return true; }
      return false;
    }
    if (k === 'ArrowRight' || k === 'd' || k === 'D') {
      if (item?.right) { item.right(); return true; }
      if (cols > 1) { this.move(1); return true; }
      return false;
    }
    if (isConfirm(e) && !e.repeat) {
      if (item && !item.disabled) item.activate?.();
      return true;
    }
    return false;
  }
}

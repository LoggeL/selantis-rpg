import type { Dir } from '../../core/types';
import type { Facing, Point } from '../rules/types';

/** Iso tile footprint (2:1 diamond) and the pixel height of one height level. */
export const TW = 32;
export const TH = 16;
export const LEVEL = 8;
/** Thickness of the ground slab below height 0 (diorama look). */
export const BASE = 10;

/**
 * Camera rotation in 90° steps. All grid → screen conversion goes through this view so rules stay
 * untouched: rotation only changes which grid cell ends up where on screen.
 */
export class IsoView {
  rot = 0;
  constructor(readonly cols: number, readonly rows: number) {}

  /** Grid cell → rotated cell. */
  toRot(x: number, y: number): Point {
    const C = this.cols, R = this.rows;
    switch (this.rot & 3) {
      case 0: return { x, y };
      case 1: return { x: R - 1 - y, y: x };
      case 2: return { x: C - 1 - x, y: R - 1 - y };
      default: return { x: y, y: C - 1 - x };
    }
  }
  /** Rotated cell → grid cell. */
  fromRot(rx: number, ry: number): Point {
    const C = this.cols, R = this.rows;
    switch (this.rot & 3) {
      case 0: return { x: rx, y: ry };
      case 1: return { x: ry, y: R - 1 - rx };
      case 2: return { x: C - 1 - rx, y: R - 1 - ry };
      default: return { x: C - 1 - ry, y: rx };
    }
  }
  get rcols(): number { return this.rot & 1 ? this.rows : this.cols; }
  get rrows(): number { return this.rot & 1 ? this.cols : this.rows; }

  /** Screen position of the TOP VERTEX of a tile's top face at height h (fractional cells allowed). */
  top(x: number, y: number, h: number): Point {
    const r = this.toRotF(x, y);
    return { x: (r.x - r.y) * (TW / 2), y: (r.x + r.y) * (TH / 2) - h * LEVEL };
  }
  /** Screen position of the CENTER of a tile's top face. */
  center(x: number, y: number, h: number): Point {
    const t = this.top(x, y, h);
    return { x: t.x, y: t.y + TH / 2 };
  }
  /** Painter's order key: larger = in front. */
  depthKey(x: number, y: number): number {
    const r = this.toRotF(x, y);
    return r.x + r.y;
  }
  /** Fractional rotation (for tweened positions between cells). */
  toRotF(x: number, y: number): Point {
    const C = this.cols - 1, R = this.rows - 1;
    switch (this.rot & 3) {
      case 0: return { x, y };
      case 1: return { x: R - y, y: x };
      case 2: return { x: C - x, y: R - y };
      default: return { x: y, y: C - x };
    }
  }

  /** Grid facing → rotated direction vector. */
  rotDir(f: Facing): Point {
    const v = { n: { x: 0, y: -1 }, e: { x: 1, y: 0 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 } }[f];
    let { x, y } = v;
    for (let i = 0; i < (this.rot & 3); i++) { const nx = -y; y = x; x = nx; }
    return { x, y };
  }
  /** Screen-space unit vector for a grid facing (iso diagonal). */
  screenDir(f: Facing): Point {
    const d = this.rotDir(f);
    return { x: (d.x - d.y) * (TW / 2), y: (d.x + d.y) * (TH / 2) };
  }
  /**
   * Sprite direction for a grid facing. Screen down-right → 'right', down-left → 'down',
   * up-right → 'up', up-left → 'left': four distinct poses so facing always reads.
   */
  spriteDir(f: Facing): Dir {
    const d = this.rotDir(f);
    if (d.x > 0) return 'right';   // +rc: screen down-right
    if (d.y > 0) return 'down';    // +rr: screen down-left
    if (d.y < 0) return 'up';      // −rr: screen up-right
    return 'left';                 // −rc: screen up-left
  }
  /** Grid facing for a screen arrow key (up = screen up-right, …), so keyboard follows the view. */
  facingForScreen(key: 'up' | 'down' | 'left' | 'right'): Facing {
    const want = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } }[key];
    for (const f of ['n', 'e', 's', 'w'] as Facing[]) {
      const d = this.rotDir(f);
      if (d.x === want.x && d.y === want.y) return f;
    }
    return 'n';
  }
}

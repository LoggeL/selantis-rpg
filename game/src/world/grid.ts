import type { TerrainId } from '../art/api';
import { BLOCKING_TERRAIN, SIGHT_BLOCKING_TERRAIN } from './ascii';

/** Fine collision cell size in px (a 16px tile = 4x4 cells). */
export const CELL = 4;

/**
 * Fine collision + sight grid derived from terrain and prop footprints.
 * `solid` blocks movement, `sight` blocks guard vision. Pure (no Phaser) so it can be unit tested.
 */
export class CollisionGrid {
  readonly cols: number;
  readonly rows: number;
  readonly solid: Uint8Array;
  readonly sight: Uint8Array;
  /** Increments on every change (pathfinding caches depend on it). */
  version = 0;

  constructor(readonly width: number, readonly height: number) {
    this.cols = Math.ceil(width / CELL);
    this.rows = Math.ceil(height / CELL);
    this.solid = new Uint8Array(this.cols * this.rows);
    this.sight = new Uint8Array(this.cols * this.rows);
  }

  static fromTerrain(terrain: TerrainId[][], tile = 16): CollisionGrid {
    const rows = terrain.length, cols = terrain[0]?.length ?? 0;
    const g = new CollisionGrid(cols * tile, rows * tile);
    for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
      const t = terrain[ty][tx];
      const move = BLOCKING_TERRAIN.has(t), see = SIGHT_BLOCKING_TERRAIN.has(t);
      if (move || see) g.markRect(tx * tile, ty * tile, tile, tile, move, see, 1);
    }
    return g;
  }

  /** Marks cells whose CENTER lies inside the px rect (value 1 = block, 0 = clear). */
  markRect(x: number, y: number, w: number, h: number, move: boolean, see: boolean, value: 0 | 1): void {
    let c0 = Math.ceil((x - CELL / 2) / CELL - 1e-9), c1 = Math.ceil((x + w - CELL / 2) / CELL - 1e-9) - 1;
    let r0 = Math.ceil((y - CELL / 2) / CELL - 1e-9), r1 = Math.ceil((y + h - CELL / 2) / CELL - 1e-9) - 1;
    // Tiny rects still mark the cell containing their center.
    if (c1 < c0) c0 = c1 = Math.floor((x + w / 2) / CELL);
    if (r1 < r0) r0 = r1 = Math.floor((y + h / 2) / CELL);
    c0 = Math.max(0, c0); r0 = Math.max(0, r0);
    c1 = Math.min(this.cols - 1, c1); r1 = Math.min(this.rows - 1, r1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * this.cols + c;
      if (move) this.solid[i] = value;
      if (see) this.sight[i] = value;
    }
    this.version++;
  }

  blockRect(x: number, y: number, w: number, h: number, opts: { move?: boolean; sight?: boolean } = {}): void {
    this.markRect(x, y, w, h, opts.move ?? true, opts.sight ?? true, 1);
  }

  clearRect(x: number, y: number, w: number, h: number, opts: { move?: boolean; sight?: boolean } = {}): void {
    this.markRect(x, y, w, h, opts.move ?? true, opts.sight ?? true, 0);
  }

  inBounds(c: number, r: number): boolean { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  solidCell(c: number, r: number): boolean { return !this.inBounds(c, r) || this.solid[r * this.cols + c] === 1; }
  sightCell(c: number, r: number): boolean { return !this.inBounds(c, r) || this.sight[r * this.cols + c] === 1; }
  solidAt(x: number, y: number): boolean { return this.solidCell(Math.floor(x / CELL), Math.floor(y / CELL)); }
  sightAt(x: number, y: number): boolean { return this.sightCell(Math.floor(x / CELL), Math.floor(y / CELL)); }

  /** True if an axis-aligned box centered at (cx, cy) with half extents hw/hh touches no solid cell. */
  boxFree(cx: number, cy: number, hw: number, hh: number): boolean {
    const c0 = Math.floor((cx - hw) / CELL), c1 = Math.floor((cx + hw - 0.001) / CELL);
    const r0 = Math.floor((cy - hh) / CELL), r1 = Math.floor((cy + hh - 0.001) / CELL);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.solidCell(c, r)) return false;
    return true;
  }
}

/** The player/NPC foot collision box (half extents). Scales with the world scale (painted maps: bigger figures). */
export let FOOT_HW = 3.5;
export let FOOT_HH = 2;
export function setFootScale(k: number): void { FOOT_HW = Math.round(3.5 * k * 2) / 2; FOOT_HH = Math.round(2 * k * 2) / 2; }

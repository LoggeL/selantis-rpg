import type { TerrainId } from '../art/api';
import type { BlockDef, MapDef, OccluderDef, Polygon, SurfaceDef, WalkArea } from './api';
import { terrainSpeed } from './ascii';
import { CELL, CollisionGrid } from './grid';
import { polyBounds, rasterizePoly } from './poly';

/**
 * Painted-map geometry → the engine's fine collision/sight grid (4 px cells) plus a surface grid. Pure (no Phaser),
 * shared by the world scene and scripts/map_tool.mjs.
 */

export const normWalk = (def: MapDef): WalkArea[] => (def.walk ?? []).map(w => (isPoly(w) ? { poly: w } : w));
export const normBlocks = (def: MapDef): BlockDef[] => (def.block ?? []).map(b => (isPoly(b) ? { poly: b } : b));
export const normOccluders = (def: MapDef): (OccluderDef & { baseline: number })[] =>
  (def.occluders ?? []).map(o => {
    const d: OccluderDef = isPoly(o) ? { poly: o } : o;
    const b = polyBounds(d.poly);
    return { ...d, baseline: d.baseline ?? b.y + b.h };
  });

export function isPoly(v: unknown): v is Polygon {
  return Array.isArray(v) && (v.length === 0 || Array.isArray(v[0]));
}

/** Per-cell ground material of a painted map. */
export class SurfaceGrid {
  readonly cols: number;
  readonly rows: number;
  /** Index into `defs` + 1 (0 = default surface). */
  readonly idx: Uint8Array;
  constructor(readonly width: number, readonly height: number, readonly defs: SurfaceDef[], readonly fallback: TerrainId, readonly hideKinds: ReadonlySet<TerrainId>) {
    this.cols = Math.ceil(width / CELL);
    this.rows = Math.ceil(height / CELL);
    this.idx = new Uint8Array(this.cols * this.rows);
    defs.forEach((s, i) => rasterizePoly(s.poly, CELL, this.cols, this.rows, (r, c0, c1) => this.idx.fill(Math.min(255, i + 1), r * this.cols + c0, r * this.cols + c1 + 1)));
  }

  private def(x: number, y: number): SurfaceDef | undefined {
    const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return undefined;
    const i = this.idx[r * this.cols + c];
    return i ? this.defs[i - 1] : undefined;
  }

  kindAt(x: number, y: number): TerrainId { return this.def(x, y)?.kind ?? this.fallback; }
  speedAt(x: number, y: number): number { const d = this.def(x, y); return d?.speed ?? terrainSpeed(d?.kind ?? this.fallback); }
  hideAt(x: number, y: number): boolean { const d = this.def(x, y); return d ? d.hide ?? this.hideKinds.has(d.kind) : this.hideKinds.has(this.fallback); }
}

/** Builds the collision + sight grid of a painted map: blocked outside `walk`, holes and blocks cut in. */
export function buildPaintedGrid(def: MapDef, width: number, height: number): CollisionGrid {
  const g = new CollisionGrid(width, height);
  const cols = g.cols, rows = g.rows;
  g.solid.fill(1);
  const set = (arr: Uint8Array, v: 0 | 1) => (r: number, c0: number, c1: number) => arr.fill(v, r * cols + c0, r * cols + c1 + 1);
  const walk = normWalk(def);
  for (const w of walk) rasterizePoly(w.poly, CELL, cols, rows, set(g.solid, 0));
  for (const w of walk) for (const h of w.holes ?? []) rasterizePoly(h, CELL, cols, rows, set(g.solid, 1));
  for (const b of normBlocks(def)) {
    if (b.move !== false) rasterizePoly(b.poly, CELL, cols, rows, set(g.solid, 1));
    if (b.sight !== false) rasterizePoly(b.poly, CELL, cols, rows, set(g.sight, 1));
  }
  g.version++;
  return g;
}

export function buildSurfaceGrid(def: MapDef, width: number, height: number): SurfaceGrid {
  return new SurfaceGrid(width, height, def.surfaces ?? [], def.surface ?? 'grass', new Set(def.hideTerrain ?? ['wheat']));
}

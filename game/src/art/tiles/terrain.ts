import type { TerrainId } from '../api';
import { NoiseField } from '../rng';

/** Pure terrain logic (no DOM): ids, classes, neighbour masks and the warped pixel map. */

export const TERRAINS: readonly TerrainId[] = [
  'grass', 'meadow', 'darkgrass', 'forest',
  'dirt', 'path', 'road', 'mud', 'sand',
  'wheat', 'crops', 'stubble',
  'water', 'shallow',
  'stone', 'cobble', 'wood', 'rug', 'carpet',
  'cliff', 'void',
];
export const TERRAIN_INDEX: Record<TerrainId, number> = Object.fromEntries(TERRAINS.map((t, i) => [t, i])) as Record<TerrainId, number>;

/** Natural terrains blend with organic, noise-warped borders; the rest keep crisp tile edges. */
const NATURAL = new Set<TerrainId>(['grass', 'meadow', 'darkgrass', 'forest', 'dirt', 'path', 'road', 'mud', 'sand', 'water', 'shallow']);
export const isNatural = (t: TerrainId) => NATURAL.has(t);
export const isWater = (t: TerrainId) => t === 'water' || t === 'shallow';
export const isGreen = (t: TerrainId) => t === 'grass' || t === 'meadow' || t === 'darkgrass' || t === 'forest';
export const isField = (t: TerrainId) => t === 'wheat' || t === 'crops' || t === 'stubble';
export const isFloor = (t: TerrainId) => t === 'stone' || t === 'cobble' || t === 'wood' || t === 'rug' || t === 'carpet';

/** Visual height used to decide which side of a border casts / receives the edge shading. */
export const HEIGHT: Record<TerrainId, number> = {
  water: 0, shallow: 1, mud: 2, sand: 2, dirt: 2, path: 2, road: 2, cobble: 2, stone: 2,
  wood: 2, rug: 3, carpet: 3, stubble: 3, crops: 3, grass: 4, meadow: 4, darkgrass: 4, forest: 4,
  wheat: 4, cliff: 6, void: -1,
};

export const N = 1, E = 2, S = 4, W = 8, NE = 16, SE = 32, SW = 64, NW = 128;

/** Reads terrain with clamped coordinates (map edges extend outward). */
export function terrainAt(grid: TerrainId[][], col: number, row: number): TerrainId {
  const r = Math.max(0, Math.min(grid.length - 1, row));
  const line = grid[r] ?? [];
  const c = Math.max(0, Math.min(line.length - 1, col));
  return line[c] ?? 'void';
}

/** 8-neighbour bitmask of cells for which `same` holds (out-of-bounds counts as same). */
export function neighborMask(grid: TerrainId[][], col: number, row: number, same: (t: TerrainId) => boolean): number {
  const rows = grid.length, cols = grid[0]?.length ?? 0;
  const test = (c: number, r: number) => (c < 0 || r < 0 || r >= rows || c >= cols) ? true : same(grid[r][c]);
  let m = 0;
  if (test(col, row - 1)) m |= N;
  if (test(col + 1, row)) m |= E;
  if (test(col, row + 1)) m |= S;
  if (test(col - 1, row)) m |= W;
  if (test(col + 1, row - 1)) m |= NE;
  if (test(col + 1, row + 1)) m |= SE;
  if (test(col - 1, row + 1)) m |= SW;
  if (test(col - 1, row - 1)) m |= NW;
  return m;
}

/** Blob-autotile normalisation: a corner only counts when both adjacent edges are set (→ 47 cases). */
export function reduceCorners(mask: number): number {
  let m = mask & (N | E | S | W);
  if ((mask & NE) && (mask & N) && (mask & E)) m |= NE;
  if ((mask & SE) && (mask & S) && (mask & E)) m |= SE;
  if ((mask & SW) && (mask & S) && (mask & W)) m |= SW;
  if ((mask & NW) && (mask & N) && (mask & W)) m |= NW;
  return m;
}

/** True if any of the 8 neighbours has a different terrain. */
export function isBorderTile(grid: TerrainId[][], col: number, row: number): boolean {
  const t = terrainAt(grid, col, row);
  return reduceCorners(neighborMask(grid, col, row, o => o === t)) !== 255;
}

/** Amplitude (px) of the organic border warp. */
export const WARP = 2.6;
/** Gaussian sigma (px) of the soft-majority field that rounds natural borders. */
export const SOFT_SIGMA = 6.5;

let kernelCache: { tile: number; table: Float32Array } | null = null;
/** weights[(ly * tile + lx) * 25 + (j + 2) * 5 + (i + 2)] for the 5x5 tiles around a pixel. */
function kernel(tile: number): Float32Array {
  if (kernelCache?.tile === tile) return kernelCache.table;
  const table = new Float32Array(tile * tile * 25);
  const s2 = 2 * SOFT_SIGMA * SOFT_SIGMA;
  for (let ly = 0; ly < tile; ly++) for (let lx = 0; lx < tile; lx++) {
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const dx = (i + 0.5) * tile - (lx + 0.5), dy = (j + 0.5) * tile - (ly + 0.5);
      table[(ly * tile + lx) * 25 + (j + 2) * 5 + (i + 2)] = Math.exp(-(dx * dx + dy * dy) / s2);
    }
  }
  kernelCache = { tile, table };
  return table;
}

/**
 * Pixel-resolution terrain map. Natural ↔ natural borders come from a Gaussian "soft majority" of the
 * surrounding tiles (rounds staircase corners into smooth curves) sampled at a noise-warped position,
 * so paths, ponds and grass edges look hand-drawn instead of tile-aligned. Other terrains stay crisp.
 */
export function buildPixelMap(grid: TerrainId[][], seed: number, tile = 16): Uint8Array {
  const rows = grid.length, cols = grid[0]?.length ?? 0;
  const W = cols * tile, H = rows * tile;
  const out = new Uint8Array(W * H);
  const near = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!isBorderTile(grid, c, r)) continue;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const rr = r + j, cc = c + i;
      if (rr >= 0 && cc >= 0 && rr < rows && cc < cols) near[rr * cols + cc] = 1;
    }
  }
  const K = kernel(tile);
  const nx1 = new NoiseField(W, H, 9, seed), nx2 = new NoiseField(W, H, 3, seed + 7);
  const ny1 = new NoiseField(W, H, 9, seed + 31), ny2 = new NoiseField(W, H, 3, seed + 37);
  // per-tile 5x5 neighbourhood of natural terrain indices (-1 = not natural)
  const nb = new Int8Array(cols * rows * 25);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const tt = terrainAt(grid, c + i, r + j);
      nb[(r * cols + c) * 25 + (j + 2) * 5 + (i + 2)] = isNatural(tt) ? TERRAIN_INDEX[tt] : -1;
    }
  }
  const weights = new Float32Array(TERRAINS.length);
  const touched: number[] = [];
  for (let y = 0; y < H; y++) {
    const row = (y / tile) | 0;
    for (let x = 0; x < W; x++) {
      const col = (x / tile) | 0;
      const t0 = grid[row][col];
      let ti = TERRAIN_INDEX[t0];
      if (near[row * cols + col] && isNatural(t0)) {
        const dx = (nx1.sample(x, y) - 0.5) * 2 * WARP + (nx2.sample(x, y) - 0.5) * 1.4;
        const dy = (ny1.sample(x, y) - 0.5) * 2 * WARP + (ny2.sample(x, y) - 0.5) * 1.4;
        const sx = Math.max(0, Math.min(W - 1, Math.round(x + dx)));
        const sy = Math.max(0, Math.min(H - 1, Math.round(y + dy)));
        const sc = (sx / tile) | 0, sr = (sy / tile) | 0;
        const base = ((sy - sr * tile) * tile + (sx - sc * tile)) * 25;
        const nbase = (sr * cols + sc) * 25;
        let best = -1, bestW = -1;
        for (let k = 0; k < 25; k++) {
          const tk = nb[nbase + k];
          if (tk < 0) continue;
          if (weights[tk] === 0) touched.push(tk);
          weights[tk] += K[base + k];
        }
        for (const k of touched) { if (weights[k] > bestW) { bestW = weights[k]; best = k; } weights[k] = 0; }
        touched.length = 0;
        if (best >= 0) ti = best;
      }
      out[y * W + x] = ti;
    }
  }
  return out;
}

/** Offsets within radius r sorted by distance (for nearest-different-terrain searches). */
export function sortedOffsets(r: number): [number, number, number][] {
  const list: [number, number, number][] = [];
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x === 0 && y === 0) continue;
    const d = Math.sqrt(x * x + y * y);
    if (d <= r + 0.01) list.push([x, y, d]);
  }
  return list.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
}

export interface EdgeInfo { dist: number; other: number; ox: number; oy: number }

/** Nearest pixel of a different terrain within the offset list, or null. */
export function nearestOther(map: Uint8Array, W: number, H: number, x: number, y: number, offsets: [number, number, number][]): EdgeInfo | null {
  const t = map[y * W + x];
  for (const [ox, oy, d] of offsets) {
    const xx = x + ox, yy = y + oy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    const o = map[yy * W + xx];
    if (o !== t) return { dist: d, other: o, ox, oy };
  }
  return null;
}

/**
 * Two-pass chamfer distance (3-4 metric / 3 ≈ px) from every pixel where `inside` is true to the
 * nearest pixel where it is false. Pixels outside get 0. Capped at `cap`.
 */
export function chamferDistance(W: number, H: number, inside: (i: number) => boolean, cap = 64): Float32Array {
  const INF = cap * 3;
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = inside(i) ? INF : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (d[i] === 0) continue;
    let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 3);
    if (y > 0) {
      v = Math.min(v, d[i - W] + 3);
      if (x > 0) v = Math.min(v, d[i - W - 1] + 4);
      if (x < W - 1) v = Math.min(v, d[i - W + 1] + 4);
    }
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (d[i] === 0) continue;
    let v = d[i];
    if (x < W - 1) v = Math.min(v, d[i + 1] + 3);
    if (y < H - 1) {
      v = Math.min(v, d[i + W] + 3);
      if (x < W - 1) v = Math.min(v, d[i + W + 1] + 4);
      if (x > 0) v = Math.min(v, d[i + W - 1] + 4);
    }
    d[i] = v;
  }
  for (let i = 0; i < W * H; i++) d[i] = Math.min(cap, d[i] / 3);
  return d;
}

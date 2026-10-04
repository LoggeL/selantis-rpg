import type Phaser from 'phaser';
import type { GroundSpec, TerrainId } from '../api';
import { TILE } from '../api';
import { RAMPS, mix, nightGrade, shift } from '../palette';
import { Px } from '../px';
import { bayer, fbm, hash2, valueNoise } from '../rng';
import {
  E, HEIGHT, N, S, TERRAINS, TERRAIN_INDEX, W, buildPixelMap, chamferDistance, isBorderTile, isField, isFloor, isGreen,
  isWater, nearestOther, neighborMask, sortedOffsets, terrainAt,
} from './terrain';

type R = readonly number[];
const T = TERRAINS;
const TI = TERRAIN_INDEX;

/** Dithered ramp lookup: f is a fractional ramp index. */
function rp(r: R, f: number, x: number, y: number, dither = 0.6): number {
  const i = Math.round(f + (bayer(x, y) - 0.5) * dither);
  return r[Math.max(0, Math.min(r.length - 1, i))];
}

/** Banded lookup: mostly flat colour areas, dithered only in a narrow band at the thresholds. */
function band(r: R, base: number, n: number, x: number, y: number, lo = 0.36, hi = 0.64, w = 0.05): number {
  const b = bayer(x, y) - 0.5;
  const v = n + b * w * 2;
  let i = base;
  if (v < lo) i = base - 1;
  if (v < lo - 0.16) i = base - 2;
  if (v > hi) i = base + 1;
  return r[Math.max(0, Math.min(r.length - 1, i))];
}

interface Ctx {
  seed: number;
  grid: TerrainId[][];
  cols: number;
  rows: number;
  W: number;
  H: number;
  map: Uint8Array;
  waterDist: Float32Array;
}

// ---------------------------------------------------------------------------------------------
// Base textures per terrain
// ---------------------------------------------------------------------------------------------

function baseColor(t: TerrainId, x: number, y: number, c: Ctx): number {
  const s = c.seed;
  switch (t) {
    case 'grass': {
      const n = fbm(x, y, 26, s, 3) * 0.8 + valueNoise(x, y, 6, s + 9) * 0.2;
      return band(RAMPS.grass, 3, n, x, y, 0.3, 0.68);
    }
    case 'meadow': {
      const n = fbm(x, y, 20, s + 1, 3) * 0.7 + valueNoise(x, y, 4, s + 19) * 0.3;
      const g = band(RAMPS.grass, 4, n, x, y, 0.36, 0.7);
      return valueNoise(x, y, 30, s + 77) > 0.62 ? mix(g, RAMPS.meadow[3], 0.35) : g;
    }
    case 'darkgrass': {
      const n = fbm(x, y, 22, s + 2, 3) * 0.8 + valueNoise(x, y, 5, s + 29) * 0.2;
      return band(RAMPS.grass, 2, n, x, y, 0.3, 0.7);
    }
    case 'forest': {
      const n = fbm(x, y, 18, s + 3, 3);
      const litter = fbm(x, y, 6, s + 41, 2);
      if (litter > 0.7) return litter > 0.75 ? 0x3a3a24 : rp([RAMPS.forest[2], 0x3a3a24], 0.5, x, y, 1);
      return band(RAMPS.forest, 2, n, x, y, 0.32, 0.7);
    }
    case 'dirt': {
      const n = fbm(x, y, 16, s + 4, 3) * 0.85 + hash2(x, y, s) * 0.15;
      return band(RAMPS.earth, 3, n, x, y, 0.24, 0.7);
    }
    case 'path': {
      const n = fbm(x, y, 18, s + 5, 3) * 0.85 + hash2(x, y, s + 1) * 0.15;
      return band(RAMPS.earth, 4, n, x, y, 0.2, 0.72);
    }
    case 'road': {
      const n = fbm(x, y, 20, s + 6, 3) * 0.85 + hash2(x, y, s + 2) * 0.15;
      return band(RAMPS.sand, 2, n, x, y, 0.32, 0.7);
    }
    case 'mud': {
      const n = fbm(x, y, 12, s + 7, 3);
      const puddle = valueNoise(x, y, 10, s + 51);
      if (puddle > 0.68) return puddle > 0.74 && hash2(x, y, s) > 0.92 ? RAMPS.mud[4] : RAMPS.mud[1];
      return band(RAMPS.mud, 2, n, x, y, 0.38, 0.66);
    }
    case 'sand': {
      const ripple = Math.sin((y + valueNoise(x, y, 14, s + 8) * 9) * 0.9) > 0.82;
      const n = fbm(x, y, 16, s + 8, 2);
      return ripple ? RAMPS.sand[2] : band(RAMPS.sand, 3, n, x, y, 0.3, 0.72);
    }
    case 'wheat': {
      const n = hash2(x, y, s + 9);
      return (y & 3) === 0 ? RAMPS.earth[2] : n > 0.5 ? RAMPS.straw[1] : RAMPS.earth[3];
    }
    case 'crops': {
      const ly = y & 7;
      if (ly === 0 || ly === 1) return RAMPS.earth[1 + (hash2(x, y, s) > 0.7 ? 1 : 0)];
      if (ly === 2) return RAMPS.earth[2];
      return band(RAMPS.earth, 3, fbm(x, y, 8, s + 10, 2), x, y, 0.3, 0.75);
    }
    case 'stubble': {
      const n = fbm(x, y, 12, s + 11, 2);
      const base = band([RAMPS.earth[3], RAMPS.straw[1], RAMPS.straw[2], RAMPS.straw[3]], 2, n, x, y, 0.3, 0.74);
      const ly = y % 5;
      const stub = hash2(x, Math.floor(y / 5), s + 12) > 0.45 && (x % 2 === 0);
      if (ly === 2 && stub) return RAMPS.straw[4];
      if (ly === 3 && stub) return RAMPS.straw[0];
      if (ly === 4 && hash2(x, y, s) > 0.8) return RAMPS.earth[2];
      return base;
    }
    case 'water': {
      const d = c.waterDist[y * c.W + x];
      const depth = Math.min(1, d / 14);
      const streak = valueNoise(x * 0.35, y * 1.4, 4, s + 12);
      let f = 4.4 - depth * 2.3 + (streak - 0.5) * 0.6;
      if (d > 3 && hash2(x, y, s + 13) > 0.996) f += 1.6;
      return rp(RAMPS.water, f, x, y, 0.35);
    }
    case 'shallow': {
      const n = fbm(x, y, 10, s + 14, 2);
      const ripple = Math.sin(x * 0.4 + valueNoise(x, y, 9, s + 15) * 7 + y * 0.25) > 0.92;
      if (ripple) return RAMPS.water[6];
      const bed = n > 0.62 ? 0x9fd0d6 : n < 0.36 ? 0x6fb3c8 : 0x86c3d0;
      return hash2(x, y, s + 16) > 0.985 ? 0x5a9cb4 : bed;
    }
    case 'stone': return flagstone(x, y, s);
    case 'cobble': return cobble(x, y, s);
    case 'wood': return planks(x, y, s);
    case 'rug': return rug(x, y, c, 'rug');
    case 'carpet': return rug(x, y, c, 'carpet');
    case 'cliff': return cliff(x, y, c);
    case 'void': return RAMPS.night[0];
  }
}

function flagstone(x: number, y: number, s: number): number {
  const rowH = 8;
  const row = Math.floor(y / rowH);
  const off = Math.floor(hash2(row, 0, s + 20) * 12);
  const xx = x + off;
  // variable widths: boundaries every 10..14px
  let start = 0, idx = 0, wdt = 0;
  {
    let pos = -16;
    let k = 0;
    for (;;) {
      const wv = 9 + Math.floor(hash2(row, k, s + 21) * 6);
      if (xx < pos + wv + 16) { start = pos + 16; wdt = wv; idx = k; break; }
      pos += wv; k++;
      if (k > 400) break;
    }
  }
  const lx = xx - start, ly = y - row * rowH;
  const tone = hash2(row, idx, s + 22);
  const r = tone > 0.7 ? RAMPS.warmstone : RAMPS.stone;
  const base = tone > 0.85 ? 3 : tone < 0.25 ? 3 : 4;
  if (lx === 0 || ly === 0) return r === RAMPS.stone ? RAMPS.stone[1] : RAMPS.warmstone[1];
  if (lx === 1 || ly === 1) return r[base + 1];
  if (lx === wdt - 1 || ly === rowH - 1) return r[base - 1];
  const speck = hash2(x, y, s + 23);
  if (speck > 0.94) return r[base - 1];
  if (speck < 0.03) return r[base + 1];
  return r[base];
}

function cobble(x: number, y: number, s: number): number {
  const cell = 6;
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
  let best = 1e9, second = 1e9, bx = 0, by = 0, bid = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const px = cx * cell + 1 + hash2(cx, cy, s + 30) * (cell - 2);
    const py = cy * cell + 1 + hash2(cx, cy, s + 31) * (cell - 2);
    const d = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2;
    if (d < best) { second = best; best = d; bx = px; by = py; bid = cx * 7919 + cy; }
    else if (d < second) second = d;
  }
  const edge = Math.sqrt(second) - Math.sqrt(best);
  if (edge < 0.9) return RAMPS.warmstone[1];
  const r = hash2(bid, 0, s + 32) > 0.6 ? RAMPS.warmstone : RAMPS.stone;
  const dx = x + 0.5 - bx, dy = y + 0.5 - by;
  const lit = -(dx * 0.6 + dy * 0.8);
  let i = 3 + (hash2(bid, 1, s) > 0.5 ? 0 : 1);
  if (lit > 1.2) i++;
  if (lit < -1.4 || edge < 1.6) i--;
  return r[Math.max(1, Math.min(r.length - 1, i))];
}

function planks(x: number, y: number, s: number): number {
  const ph = 6;
  const row = Math.floor(y / ph), ly = y - row * ph;
  const len = 48;
  const off = Math.floor(hash2(row, 3, s + 40) * len);
  const pi = Math.floor((x + off) / len), lx = (x + off) - pi * len;
  const r = RAMPS.wood;
  if (ly === ph - 1) return r[1];
  if (lx === 0) return r[1];
  const tone = hash2(row, pi, s + 41);
  const base = tone > 0.72 ? 4 : tone > 0.18 ? 3 : 2;
  if ((lx === 2 || lx === len - 3) && (ly === 1 || ly === 3)) return r[1]; // nails
  if (ly === 0) return r[Math.min(5, base + 1)];
  if (ly === ph - 2) return r[base - 1];
  const grain = valueNoise(x * 0.18, y * 1.6, 3, s + 42 + row * 3);
  if (grain > 0.74) return r[base - 1];
  if (grain < 0.16) return r[Math.min(5, base + 1)];
  return r[base];
}

function rug(x: number, y: number, c: Ctx, kind: 'rug' | 'carpet'): number {
  const col = (x / TILE) | 0, row = (y / TILE) | 0;
  const m = neighborMask(c.grid, col, row, t => t === kind);
  const lx = x - col * TILE, ly = y - row * TILE;
  const big = 99;
  const e = Math.min(m & W ? big : lx, m & E ? big : TILE - 1 - lx, m & N ? big : ly, m & S ? big : TILE - 1 - ly);
  const field = kind === 'rug' ? RAMPS.red : RAMPS.blue;
  const trim = RAMPS.gold;
  if (e === 0) return field[0];
  if (e === 1) return trim[2];
  if (e === 2) return trim[3];
  if (e === 3) return field[1];
  if (e === 4) return (x + y) % 4 === 0 ? trim[2] : field[2];
  // diamond lattice with gold knots, every 12 px
  const a = ((x + y) % 12 + 12) % 12, b = ((x - y) % 12 + 12) % 12;
  if (kind === 'rug') {
    if (a === 6 && b === 6) return trim[3];
    if ((a === 6 && (b === 5 || b === 7)) || (b === 6 && (a === 5 || a === 7))) return trim[2];
    if (a === 0 || b === 0) return field[2];
    return field[3];
  }
  if (a === 6 && b === 6) return trim[3];
  if (a === 0 || b === 0) return field[3];
  return field[2];
}

function cliff(x: number, y: number, c: Ctx): number {
  const col = (x / TILE) | 0, row = (y / TILE) | 0;
  const ly = y - row * TILE;
  const up = terrainAt(c.grid, col, row - 1) === 'cliff';
  const down = terrainAt(c.grid, col, row + 1) === 'cliff';
  const r = RAMPS.warmstone;
  const s = c.seed;
  if (!up) {
    const lip = 3 + Math.floor(valueNoise(x, 0, 3, s + 63) * 2.5);
    if (ly < lip) return ly === 0 ? RAMPS.grass[4] : ly === lip - 1 ? RAMPS.grass[1] : RAMPS.grass[3];
    if (ly === lip && hash2(x, y, s) > 0.5) return RAMPS.grass[2];
  }
  // stacked rock slabs: horizontally stretched cells
  const sh = 6;
  const band_ = Math.floor((y + 2) / sh), by = (y + 2) - band_ * sh;
  const off = Math.floor(hash2(band_, 0, s + 64) * 20);
  const sw = 9 + Math.floor(hash2(band_, 1, s + 64) * 7);
  const cell = Math.floor((x + off) / sw), bx = (x + off) - cell * sw;
  const tone = hash2(band_, cell, s + 65);
  let i = tone > 0.6 ? 3 : 2;
  if (by === 0) i = i + 2;
  else if (by === 1) i = i + 1;
  else if (by === sh - 1) i = 0;
  if (bx === 0) i = Math.min(i, 1);
  else if (bx === 1 && by > 0 && by < sh - 1) i = Math.min(5, i + 1);
  if (hash2(x, y, s + 66) > 0.95) i = Math.max(0, i - 1);
  if (!down && ly > TILE - 4) i = Math.max(0, Math.min(i, ly > TILE - 2 ? 0 : 1));
  return r[Math.max(0, Math.min(r.length - 1, i))];
}

// ---------------------------------------------------------------------------------------------
// Edges between terrains
// ---------------------------------------------------------------------------------------------

const EDGE_OFFSETS = sortedOffsets(4);

function edgeColor(t: TerrainId, o: TerrainId, dist: number, ox: number, oy: number, base: number, x: number, y: number, c: Ctx): number {
  const s = c.seed;
  const ht = HEIGHT[t], ho = HEIGHT[o];
  // --- water side of a shoreline
  if (t === 'water' && !isWater(o)) {
    const bankAbove = oy < 0 && Math.abs(oy) >= Math.abs(ox) * 0.6;
    if (bankAbove) {
      if (dist <= 1.5) return RAMPS.earth[1];
      if (dist <= 2.5) return RAMPS.water[1];
      if (dist <= 3.5) return RAMPS.water[6];
      return base;
    }
    if (dist <= 1.2) return RAMPS.water[7];
    if (dist <= 2.3) return hash2(x, y, s + 70) > 0.35 ? RAMPS.water[6] : RAMPS.water[5];
    if (dist <= 3.5) return RAMPS.water[5];
    return base;
  }
  if (t === 'water' && o === 'shallow') {
    if (dist <= 4 && bayer(x, y) > dist / 4.2) return dist < 1.5 ? RAMPS.water[5] : RAMPS.water[4];
    return base;
  }
  if (t === 'shallow' && !isWater(o)) {
    if (dist <= 1.2) return RAMPS.water[7];
    if (dist <= 2.2) return mix(base, RAMPS.water[6], 0.5);
    return base;
  }
  if (t === 'shallow' && o === 'water') {
    if (dist <= 3 && bayer(x, y) > 0.3 + dist / 4) return RAMPS.water[5];
    return base;
  }
  // --- land side of a shoreline: damp, darker rim
  if (!isWater(t) && isWater(o)) {
    if (dist <= 1.2) return shift(base, -0.5);
    if (dist <= 2.2) return shift(base, -0.22);
    return base;
  }
  // --- cliffs cast a shadow below them
  if (o === 'cliff' && oy < 0) {
    if (dist <= 3.5) return shift(base, dist <= 1.5 ? -0.5 : -0.3);
    return base;
  }
  // --- fields: a thin furrow line at the edge
  if (isField(t) && !isField(o)) {
    if (dist <= 1.2) return RAMPS.earth[1];
    if (dist <= 2.2) return RAMPS.earth[2];
    return base;
  }
  // --- lower terrain next to higher (path next to grass): grass overhang + shadow
  if (ht < ho && isGreen(o)) {
    const lit = ox > 0 || oy > 0; // higher side is right/below: the lip catches light
    if (dist <= 1.2) {
      if (hash2(x, y, s + 71) > 0.55) return o === 'forest' ? RAMPS.forest[3] : RAMPS.grass[lit ? 4 : 3];
      return shift(base, -0.42);
    }
    if (dist <= 2.2) return lit ? shift(base, -0.12) : shift(base, -0.3);
    if (dist <= 3.2 && !lit) return shift(base, -0.12);
    return base;
  }
  if (ht < ho) {
    if (dist <= 1.2) return shift(base, -0.32);
    if (dist <= 2.2) return shift(base, -0.14);
    return base;
  }
  // --- higher green next to lower ground: turf edge (dark when facing down/right, bright tips when facing up)
  if (isGreen(t) && ht > ho) {
    const facingDown = oy > 0 || ox > 0;
    if (dist <= 1.2) return facingDown ? shift(base, -0.5) : shift(base, 0.35);
    if (dist <= 2.2 && facingDown) return shift(base, -0.18);
    return base;
  }
  // --- green ↔ green: soft dithered blend
  if (isGreen(t) && isGreen(o)) {
    if (dist <= 2.5 && bayer(x, y) > 0.5 + dist * 0.12) return baseColor(o, x, y, c);
    return base;
  }
  // --- ground ↔ ground (dirt/path/road/sand/mud): dithered mix
  if (isFloor(t) || isFloor(o) || o === 'cliff' || t === 'cliff' || o === 'void') {
    if (dist <= 1.2 && ht <= ho) return shift(base, -0.45);
    return base;
  }
  if (dist <= 2.2 && ht === ho && !isField(o) && !isField(t) && bayer(x, y) > 0.55 + dist * 0.12) return baseColor(o, x, y, c);
  return base;
}

// ---------------------------------------------------------------------------------------------
// Decorations: tufts, flowers, pebbles, leaves
// ---------------------------------------------------------------------------------------------

type Stamp = [number, number, number][];

function tuft(r: R, i: number): Stamp {
  const hi = r[Math.min(r.length - 1, i + 2)], mid = r[i + 1], lo = r[Math.max(0, i - 2)];
  return [[0, -2, hi], [2, -2, hi], [1, -1, mid], [0, -1, mid], [2, -1, mid], [-1, -1, hi], [3, -1, hi], [0, 0, lo], [1, 0, lo], [2, 0, lo]];
}

function flower(petal: number, center: number, shade: number): Stamp {
  return [[0, -1, petal], [-1, 0, petal], [1, 0, petal], [0, 1, shade], [0, 0, center], [1, 1, RAMPS.grass[1]]];
}

function pebble(r: R): Stamp {
  return [[0, 0, r[4]], [1, 0, r[3]], [0, 1, r[2]], [1, 1, r[2]], [2, 1, r[1]], [0, 2, RAMPS.earth[1]], [1, 2, RAMPS.earth[1]]];
}

function decorate(px: Px, c: Ctx, edgeDist: Float32Array): void {
  const s = c.seed;
  const ok = (x: number, y: number, t: number) =>
    x >= 0 && y >= 0 && x < c.W && y < c.H && c.map[y * c.W + x] === t && edgeDist[y * c.W + x] > 2.5;
  const stamp = (x: number, y: number, st: Stamp, t: number) => {
    for (const [dx, dy] of st) if (!ok(x + dx, y + dy, t)) return;
    for (const [dx, dy, col] of st) px.set(x + dx, y + dy, col);
  };
  for (let row = 0; row < c.rows; row++) for (let col = 0; col < c.cols; col++) {
    const t = c.grid[row][col];
    const ti = TI[t];
    const h = (k: number) => hash2(col * 13 + k, row * 7 - k, s + 90);
    const at = (k: number): [number, number] => [col * TILE + 2 + Math.floor(h(k) * 12), row * TILE + 3 + Math.floor(h(k + 50) * 11)];
    // blade strokes
    if (t === 'grass' || t === 'meadow' || t === 'darkgrass') {
      const r = RAMPS.grass;
      for (let y = row * TILE; y < row * TILE + TILE; y++) for (let x = col * TILE; x < col * TILE + TILE; x++) {
        const v = hash2(x, y, s + 91);
        if (v < (t === 'meadow' ? 0.07 : 0.055) && ok(x, y, ti) && ok(x, y + 1, ti)) {
          const top = px.get(x, y);
          px.set(x, y, shift(top, 0.32));
          px.set(x, y + 1, shift(top, -0.28));
        }
      }
      const tufts = t === 'meadow' ? 2 : 1;
      for (let k = 0; k < tufts; k++) if (h(k) > 0.35) { const [x, y] = at(k); stamp(x, y, tuft(r, t === 'darkgrass' ? 1 : t === 'meadow' ? 3 : 2), ti); }
      const flowers = t === 'meadow' ? 3 : t === 'grass' ? 1 : 0;
      for (let k = 0; k < flowers; k++) {
        const [x, y] = at(k + 10);
        const patch = valueNoise(x, y, 40, s + 93);
        if (h(k + 10) < (t === 'meadow' ? 0.35 : 0.1) + (1 - patch) * 0.9) continue;
        const kind = h(k + 20);
        const st = kind < 0.3 ? flower(0xfffaf0, RAMPS.yellow[3], RAMPS.cream[2])
          : kind < 0.55 ? flower(RAMPS.yellow[3], RAMPS.orange[3], RAMPS.yellow[1])
            : kind < 0.8 ? flower(RAMPS.cornflower[3], RAMPS.cornflower[4], RAMPS.cornflower[1])
              : flower(RAMPS.pink[3], RAMPS.yellow[4], RAMPS.pink[1]);
        stamp(x, y, st, ti);
      }
    } else if (t === 'forest') {
      for (let k = 0; k < 3; k++) {
        if (h(k) < 0.3) continue;
        const [x, y] = at(k);
        const leafR = h(k + 5) > 0.5 ? RAMPS.rust : h(k + 5) > 0.25 ? RAMPS.olive : RAMPS.straw;
        stamp(x, y, [[0, 0, leafR[3]], [1, 0, leafR[2]], [1, 1, leafR[1]], [0, 1, RAMPS.forest[0]]], ti);
      }
      if (h(30) > 0.8) { const [x, y] = at(30); stamp(x, y, [[0, 0, RAMPS.wood[3]], [1, 0, RAMPS.wood[2]], [2, 1, RAMPS.wood[2]], [3, 1, RAMPS.wood[1]], [1, 1, RAMPS.forest[0]]], ti); }
      if (h(31) > 0.93) { const [x, y] = at(31); stamp(x, y, [[0, 0, RAMPS.red[4]], [1, 0, RAMPS.red[3]], [-1, 0, RAMPS.red[3]], [0, -1, 0xfffaf0], [0, 1, RAMPS.cream[3]], [1, 1, RAMPS.forest[0]]], ti); }
      if (h(32) > 0.55) { const [x, y] = at(32); stamp(x, y, tuft(RAMPS.forest, 1), ti); }
    } else if (t === 'dirt' || t === 'path' || t === 'road' || t === 'mud') {
      const n = t === 'road' ? 2 : 1;
      for (let k = 0; k < n; k++) {
        if (h(k) < (t === 'mud' ? 0.75 : 0.45)) continue;
        const [x, y] = at(k);
        stamp(x, y, pebble(h(k + 3) > 0.5 ? RAMPS.stone : RAMPS.warmstone), ti);
      }
      if (t !== 'mud' && h(40) > 0.7) { const [x, y] = at(40); stamp(x, y, [[0, 0, RAMPS.earth[t === 'dirt' ? 5 : 6]], [1, 0, RAMPS.earth[5]], [0, 1, RAMPS.earth[2]]], ti); }
    } else if (t === 'sand' || t === 'shallow') {
      if (h(0) > 0.7) { const [x, y] = at(0); stamp(x, y, pebble(RAMPS.warmstone), ti); }
    } else if (t === 'crops') {
      // leafy vegetables on every ridge
      for (let ry = 0; ry < 2; ry++) for (let k = 0; k < 3; k++) {
        const x = col * TILE + 2 + k * 5 + Math.floor(h(k + ry * 3) * 2);
        const y = row * TILE + ry * 8 + 5;
        const g = RAMPS.green;
        const cab = h(k + ry * 7 + 60) > 0.5;
        if (cab) {
          px.shadeBlob(x + 0.5, y + 0.5, 2.2, 1.8, g, { lo: 2, hi: 5, dither: 0.3 });
          px.set(x, y - 1, g[5]);
          px.set(x - 1, y + 2, RAMPS.earth[1]); px.set(x, y + 2, RAMPS.earth[1]); px.set(x + 1, y + 2, RAMPS.earth[1]);
        } else {
          px.set(x, y, g[4]); px.set(x - 1, y - 1, g[5]); px.set(x + 1, y - 1, g[4]); px.set(x, y - 2, g[5]);
          px.set(x - 1, y + 1, g[2]); px.set(x + 1, y + 1, g[2]); px.set(x, y + 1, g[3]);
          px.set(x, y + 2, RAMPS.earth[1]);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------

export interface GroundRender {
  px: Px;
  ctx: Ctx;
  edgeDist: Float32Array;
}

export function renderGround(spec: GroundSpec): GroundRender {
  const { cols, rows, seed } = spec;
  const grid = spec.terrain;
  const W = cols * TILE, H = rows * TILE;
  const t0 = performance.now();
  const map = buildPixelMap(grid, seed, TILE);
  const tMap = performance.now();
  const waterIdx = TI.water, shallowIdx = TI.shallow;
  const waterDist = chamferDistance(W, H, i => map[i] === waterIdx || map[i] === shallowIdx, 24);
  const ctx: Ctx = { seed, grid, cols, rows, W, H, map, waterDist };
  const px = new Px(W, H);
  const edgeDist = new Float32Array(W * H).fill(99);
  const border = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    // a tile is "near a border" if it or any neighbour is a border tile (soft borders reach into neighbours)
    if (!isBorderTile(grid, c, r)) continue;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const rr = r + j, cc = c + i;
      if (rr >= 0 && cc >= 0 && rr < rows && cc < cols) border[rr * cols + cc] = 1;
    }
  }
  for (let y = 0; y < H; y++) {
    const row = (y / TILE) | 0;
    for (let x = 0; x < W; x++) {
      const col = (x / TILE) | 0;
      const i = y * W + x;
      const t = T[map[i]];
      let colr = baseColor(t, x, y, ctx);
      if (border[row * cols + col]) {
        const e = nearestOther(map, W, H, x, y, EDGE_OFFSETS);
        if (e) {
          edgeDist[i] = e.dist;
          colr = edgeColor(t, T[e.other], e.dist, e.ox, e.oy, colr, x, y, ctx);
        }
      }
      px.d[i] = Px.pack(colr);
    }
  }
  const tEdge = performance.now();
  decorate(px, ctx, edgeDist);
  if (typeof window !== 'undefined' && (window as unknown as { __artProfile?: boolean }).__artProfile) console.info('[art] ground phases', { map: Math.round(tMap - t0), pixels: Math.round(tEdge - tMap), deco: Math.round(performance.now() - tEdge) });
  if (spec.palette === 'night') px.map(nightGrade);
  return { px, ctx, edgeDist };
}

// ---------------------------------------------------------------------------------------------
// Animated overlays: water shimmer + shore foam, swaying wheat
// ---------------------------------------------------------------------------------------------

export const WATER_FRAMES = 8;
export const WHEAT_FRAMES = 8;
const WHEAT_H = 22; // overlay is taller than a tile so heads poke above the field edge

interface Overlay { frames: Px[]; x: number; y: number; phase: number }

function waterOverlay(c: Ctx, col: number, row: number, night: boolean, shared: boolean): Px[] {
  const frames: Px[] = [];
  const s = c.seed;
  const glints: { x: number; y: number; len: number; ph: number }[] = [];
  const key = shared ? (Math.floor(hash2(col, row, s + 100) * 6)) : col * 9973 + row;
  const gr = (k: number) => hash2(key, k, s + 101);
  const nG = 2 + Math.floor(gr(0) * 3);
  for (let k = 0; k < nG; k++) glints.push({ x: Math.floor(gr(k + 1) * 12), y: 1 + Math.floor(gr(k + 11) * 14), len: 2 + Math.floor(gr(k + 21) * 3), ph: Math.floor(gr(k + 31) * WATER_FRAMES) });
  const g = (col_: number) => (night ? nightGrade(col_) : col_);
  for (let f = 0; f < WATER_FRAMES; f++) {
    const p = new Px(TILE, TILE);
    for (const gl of glints) {
      const life = (f - gl.ph + WATER_FRAMES) % WATER_FRAMES;
      if (life > 3) continue;
      const a = [0.35, 0.8, 0.55, 0.2][life];
      for (let i = 0; i < gl.len - (life === 3 ? 1 : 0); i++) {
        const x = gl.x + i + (life >> 1), y = gl.y;
        const wx = col * TILE + x, wy = row * TILE + y;
        if (x >= TILE || wx >= c.W || wy >= c.H) continue;
        if (c.map[wy * c.W + wx] !== TI.water) continue;
        if (c.waterDist[wy * c.W + wx] < 3.5) continue;
        p.blend(x, y, g(RAMPS.water[i === 0 || i === gl.len - 1 ? 6 : 7]), a);
      }
    }
    if (!shared) {
      // pulsing foam line along the shore
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        const wx = col * TILE + x, wy = row * TILE + y;
        const i = wy * c.W + wx;
        const t = c.map[i];
        if (t !== TI.water && t !== TI.shallow) continue;
        const d = c.waterDist[i];
        if (d > 5) continue;
        const ph = valueNoise(wx, wy, 18, s + 102) * Math.PI * 2;
        const reach = 1.4 + (Math.sin((f / WATER_FRAMES) * Math.PI * 2 + ph) + 1) * 1.3;
        if (Math.abs(d - reach) < 0.55) p.blend(x, y, g(RAMPS.water[7]), 0.75);
        else if (d < reach && hash2(wx, wy, s + f) > 0.55) p.blend(x, y, g(RAMPS.water[7]), 0.3);
      }
    }
    frames.push(p);
  }
  return frames;
}

function wheatOverlay(c: Ctx, col: number, row: number, variant: number, night: boolean, topEdge: boolean, bottomEdge: boolean): Px[] {
  const s = c.seed;
  const frames: Px[] = [];
  const stalks: { x: number; base: number; h: number; ph: number; tone: number }[] = [];
  const vr = (k: number) => hash2(variant, k, s + 110);
  let k = 0;
  for (let rr = 0; rr < 3; rr++) {
    const base = 6 + rr * 5 + 6; // within overlay coords (overlay y = tile y + 6)
    if (bottomEdge && rr === 2) continue;
    for (let x = 0; x < TILE; x += 2) {
      const jx = x + Math.floor(vr(k++) * 2);
      if (jx > TILE - 1) continue;
      stalks.push({ x: jx, base: base + Math.floor(vr(k++) * 2), h: 7 + Math.floor(vr(k++) * 3), ph: vr(k++) * 0.6, tone: vr(k++) });
    }
  }
  stalks.sort((a, b) => a.base - b.base);
  const g = (col_: number) => (night ? nightGrade(col_) : col_);
  const st = RAMPS.straw;
  for (let f = 0; f < WHEAT_FRAMES; f++) {
    const p = new Px(TILE, WHEAT_H);
    const wave = Math.sin((f / WHEAT_FRAMES) * Math.PI * 2);
    for (const sk of stalks) {
      const sway = Math.round((wave + sk.ph) * 1.1);
      const topY = sk.base - sk.h;
      // stem
      for (let y = sk.base; y > topY + 2; y--) {
        const t = (sk.base - y) / sk.h;
        const xx = sk.x + Math.round(sway * t * t);
        p.set(xx, y, g(y > sk.base - 2 ? st[1] : st[2]));
      }
      // head (grain cluster, 2 wide 4 tall) lit from the left
      const hx = sk.x + sway, hy = topY;
      const light = sk.tone > 0.5 ? st[4] : st[3];
      p.set(hx, hy, g(light)); p.set(hx, hy + 1, g(light)); p.set(hx + 1, hy + 1, g(st[3]));
      p.set(hx, hy + 2, g(st[3])); p.set(hx + 1, hy + 2, g(st[2])); p.set(hx, hy + 3, g(st[2])); p.set(hx + 1, hy + 3, g(st[1]));
      if (sk.tone > 0.8) p.set(hx, hy - 1, g(st[5]));
      if (sk.tone < 0.025) { const fc = sk.ph > 0.3 ? RAMPS.red : RAMPS.cornflower; p.set(hx, hy + 4, g(fc[3])); p.set(hx + 1, hy + 4, g(fc[2])); p.set(hx, hy + 5, g(fc[1])); }
    }
    frames.push(p);
  }
  return frames;
}

// ---------------------------------------------------------------------------------------------
// Phaser integration
// ---------------------------------------------------------------------------------------------

let groundCounter = 0;
const CHUNK = 1024;

function packAtlas(scene: Phaser.Scene, keyBase: string, entries: Px[][], fw: number, fh: number): Phaser.Textures.Frame[][][] {
  // returns frames[atlasEntry][frame]
  const result: Phaser.Textures.Frame[][][] = [];
  const nFrames = entries[0]?.length ?? 0;
  if (!nFrames) return result;
  const perRow = Math.max(1, Math.floor(2048 / (fw * nFrames)));
  const maxRows = Math.floor(4096 / fh);
  const perAtlas = perRow * maxRows;
  const out: Phaser.Textures.Frame[][] = [];
  for (let a = 0; a * perAtlas < entries.length; a++) {
    const slice = entries.slice(a * perAtlas, (a + 1) * perAtlas);
    const rowsUsed = Math.ceil(slice.length / perRow);
    const big = new Px(Math.min(slice.length, perRow) * fw * nFrames, rowsUsed * fh);
    slice.forEach((frames, i) => {
      const ex = (i % perRow) * fw * nFrames, ey = Math.floor(i / perRow) * fh;
      frames.forEach((fr, f) => big.blit(fr, ex + f * fw, ey));
    });
    const key = `${keyBase}-${a}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.addCanvas(key, big.toCanvas())!;
    slice.forEach((frames, i) => {
      const ex = (i % perRow) * fw * nFrames, ey = Math.floor(i / perRow) * fh;
      out.push(frames.map((_, f) => tex.add(`${i}:${f}`, 0, ex + f * fw, ey, fw, fh)!));
    });
  }
  result.push(out);
  return result;
}

export function buildGroundObject(scene: Phaser.Scene, spec: GroundSpec): Phaser.GameObjects.Container {
  const t0 = performance.now();
  const id = `ground-${++groundCounter}-${spec.seed}`;
  const { px, ctx } = renderGround(spec);
  const night = spec.palette === 'night';
  const container = scene.add.container(0, 0);
  const keys: string[] = [];
  // static chunks
  for (let cy = 0; cy < ctx.H; cy += CHUNK) for (let cx = 0; cx < ctx.W; cx += CHUNK) {
    const w = Math.min(CHUNK, ctx.W - cx), h = Math.min(CHUNK, ctx.H - cy);
    const chunk = new Px(w, h);
    for (let y = 0; y < h; y++) chunk.d.set(px.d.subarray((cy + y) * ctx.W + cx, (cy + y) * ctx.W + cx + w), y * w);
    const key = `${id}-c${cx}-${cy}`;
    scene.textures.addCanvas(key, chunk.toCanvas());
    keys.push(key);
    container.add(scene.add.image(cx, cy, key).setOrigin(0, 0));
  }
  // animated overlays
  const water: Overlay[] = [];
  const sharedWater: Px[][] = [];
  const sharedIdx: number[] = [];
  const wheat: Overlay[] = [];
  const wheatVariants = new Map<string, Px[]>();
  for (let row = 0; row < ctx.rows; row++) for (let col = 0; col < ctx.cols; col++) {
    let hasWater = false, nearShore = false;
    for (let y = row * TILE; y < row * TILE + TILE && !nearShore; y++) for (let x = col * TILE; x < col * TILE + TILE; x++) {
      const i = y * ctx.W + x, t = ctx.map[i];
      if (t === TI.water || t === TI.shallow) { hasWater = true; if (ctx.waterDist[i] <= 5) { nearShore = true; break; } }
    }
    if (hasWater) {
      if (nearShore) water.push({ frames: waterOverlay(ctx, col, row, night, false), x: col * TILE, y: row * TILE, phase: 0 });
      else {
        const v = Math.floor(hash2(col, row, ctx.seed + 100) * 6);
        if (!sharedWater[v]) sharedWater[v] = waterOverlay(ctx, col, row, night, true);
        sharedIdx.push(v, col, row);
      }
    }
    if (ctx.grid[row][col] === 'wheat') {
      const top = terrainAt(ctx.grid, col, row - 1) !== 'wheat';
      const bottom = terrainAt(ctx.grid, col, row + 1) !== 'wheat';
      const variant = Math.floor(hash2(col, row, ctx.seed + 120) * 5);
      const vk = `${variant}-${top ? 1 : 0}-${bottom ? 1 : 0}`;
      if (!wheatVariants.has(vk)) wheatVariants.set(vk, wheatOverlay(ctx, col, row, variant, night, top, bottom));
      const phase = Math.floor((col * 0.8 + row * 0.35)) % WHEAT_FRAMES;
      wheat.push({ frames: wheatVariants.get(vk)!, x: col * TILE, y: row * TILE - 6, phase: (WHEAT_FRAMES * 4 - phase) % WHEAT_FRAMES });
    }
  }
  const animated: { img: Phaser.GameObjects.Image; frames: Phaser.Textures.Frame[]; phase: number }[] = [];
  // water
  {
    const entries: Px[][] = [];
    const sharedStart = water.length;
    for (const o of water) entries.push(o.frames);
    const sharedKeys = [...sharedWater.keys()].filter(k => sharedWater[k]);
    const sharedMap = new Map<number, number>();
    for (const k of sharedKeys) { sharedMap.set(k, entries.length); entries.push(sharedWater[k]); }
    if (entries.length) {
      const [frames] = packAtlas(scene, `${id}-water`, entries, TILE, TILE);
      for (let a = 0; a < frames.length; a++) keys.push(`${id}-water-${a}`);
      water.forEach((o, i) => {
        const img = scene.add.image(o.x, o.y, frames[i][0].texture.key, frames[i][0].name).setOrigin(0, 0);
        container.add(img);
        animated.push({ img, frames: frames[i], phase: 0 });
      });
      for (let i = 0; i < sharedIdx.length; i += 3) {
        const [v, col, row] = [sharedIdx[i], sharedIdx[i + 1], sharedIdx[i + 2]];
        const fi = sharedMap.get(v)!;
        const img = scene.add.image(col * TILE, row * TILE, frames[fi][0].texture.key, frames[fi][0].name).setOrigin(0, 0);
        container.add(img);
        animated.push({ img, frames: frames[fi], phase: Math.floor(hash2(col, row, 5) * WATER_FRAMES) });
      }
      void sharedStart;
    }
  }
  // wheat (drawn last so heads overlap the row above)
  if (wheat.length) {
    const variants = [...wheatVariants.values()];
    const [frames] = packAtlas(scene, `${id}-wheat`, variants, TILE, WHEAT_H);
    keys.push(`${id}-wheat-0`);
    const idxOf = new Map(variants.map((v, i) => [v, i]));
    wheat.sort((a, b) => a.y - b.y);
    for (const o of wheat) {
      const fr = frames[idxOf.get(o.frames)!];
      const img = scene.add.image(o.x, o.y, fr[0].texture.key, fr[0].name).setOrigin(0, 0);
      container.add(img);
      animated.push({ img, frames: fr, phase: o.phase });
    }
  }
  let tick = 0;
  const timer = animated.length
    ? scene.time.addEvent({
      delay: 150, loop: true, callback: () => {
        tick++;
        for (const a of animated) a.img.setFrame(a.frames[(tick + a.phase) % a.frames.length]);
      },
    })
    : null;
  container.once('destroy', () => {
    timer?.remove(false);
    // textures are per-ground; free them with the container
    const tm = scene.textures;
    setTimeout(() => keys.forEach(k => { if (tm.exists(k)) tm.remove(k); }), 0);
  });
  container.setData('groundMs', performance.now() - t0);
  container.setData('pixelMap', ctx.map);
  return container;
}

/** Deterministic random helpers for procedural art. No Math.random() anywhere in art/. */

/** mulberry32 – tiny, fast, good enough for art. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash → 32 bit unsigned. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Integer hash of 2D coordinates + seed → [0, 1). Stateless, used for per-pixel/per-tile noise. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smooth value noise in [0, 1). `scale` = feature size in pixels. */
export function valueNoise(x: number, y: number, scale: number, seed = 0): number {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = smooth(fx - x0), ty = smooth(fy - y0);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

/** Fractal value noise (2-3 octaves) in [0, 1). */
export function fbm(x: number, y: number, scale: number, seed = 0, octaves = 3): number {
  let amp = 1, sum = 0, norm = 0, s = scale;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x, y, s, seed + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    s /= 2;
  }
  return sum / norm;
}

/** Convenience wrapper with typed helpers. */
export class Rng {
  private next: () => number;
  constructor(seed: number | string) {
    this.next = mulberry32(typeof seed === 'string' ? hashString(seed) : seed);
  }
  float(): number { return this.next(); }
  range(min: number, max: number): number { return min + (max - min) * this.next(); }
  int(min: number, max: number): number { return Math.floor(this.range(min, max + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(list: readonly T[]): T { return list[Math.floor(this.next() * list.length)]; }
  sign(): 1 | -1 { return this.next() < 0.5 ? -1 : 1; }
}

/** 4x4 Bayer matrix normalised to (0, 1). Used for ordered dithering in shading. */
export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map(row => row.map(v => (v + 0.5) / 16));

export function bayer(x: number, y: number): number {
  return BAYER4[y & 3][x & 3];
}

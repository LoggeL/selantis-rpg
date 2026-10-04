import { TILE } from '../art/api';
import type { Dir } from '../core/types';
import type { Area, At } from './api';

export interface Vec { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

/** Converts an At (tiles by default, tile CENTER) to pixels. */
export function toPx(at: At): Vec {
  if (Array.isArray(at)) return { x: at[0] * TILE + TILE / 2, y: at[1] * TILE + TILE / 2 };
  const o = at as { x: number; y: number; px?: boolean };
  return o.px ? { x: o.x, y: o.y } : { x: o.x * TILE + TILE / 2, y: o.y * TILE + TILE / 2 };
}

export function isAt(v: unknown): v is At {
  return Array.isArray(v) ? v.length === 2 && typeof v[0] === 'number' : typeof v === 'object' && v !== null && 'x' in v && 'y' in v;
}

/** Converts an Area (tiles by default) to a pixel rect. */
export function areaPx(a: Area): Rect {
  return a.px ? { x: a.x, y: a.y, w: a.w, h: a.h } : { x: a.x * TILE, y: a.y * TILE, w: a.w * TILE, h: a.h * TILE };
}

export function pxToTile(x: number, y: number): Vec { return { x: (x - TILE / 2) / TILE, y: (y - TILE / 2) / TILE }; }

export function inRect(r: Rect, x: number, y: number): boolean { return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; }

export function dist(ax: number, ay: number, bx: number, by: number): number { return Math.hypot(bx - ax, by - ay); }

/** 4-way facing from a vector, with hysteresis towards the current direction (prevents flicker on diagonals). */
export function dirFromVector(dx: number, dy: number, current?: Dir): Dir {
  if (dx === 0 && dy === 0) return current ?? 'down';
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const bias = 1.25;
  if (current === 'left' || current === 'right') {
    if (ax * bias >= ay) return dx < 0 ? 'left' : 'right';
  } else if (current === 'up' || current === 'down') {
    if (ay * bias >= ax) return dy < 0 ? 'up' : 'down';
  }
  return ax > ay ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
}

export function dirVector(d: Dir): Vec {
  switch (d) {
    case 'up': return { x: 0, y: -1 };
    case 'down': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    default: return { x: 1, y: 0 };
  }
}

export function dirAngle(d: Dir): number { const v = dirVector(d); return Math.atan2(v.y, v.x); }

/** Deterministic hash -> [0,1). */
export function hash01(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Small seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Frame-rate independent exponential smoothing factor. */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

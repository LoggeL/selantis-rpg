import { RAMPS, shift } from '../palette';
import type { Px } from '../px';
import { Rng, hash2 } from '../rng';
import { type PropDef, type R, cylinder, foliage, greywood, leaves, rock, tone, trunk, wood } from './core';

const G = RAMPS.grass;
const LV = leaves;
const appleLeaves = [0x1f3b2a, 0x2b5530, 0x3f7a36, 0x5a9a40, 0x7cb84e, 0xa6d064] as R;
const bushLeaves = [0x1a3326, 0x24492c, 0x336534, 0x4a823c, 0x68a04a, 0x8cbc58] as R;
const hideLeaves = [0x10241e, 0x173527, 0x21472d, 0x305d34, 0x447a3c, 0x5e964a] as R;

function branchLines(p: Px, x: number, y: number, a: number, len: number, th: number, r: R, rng: Rng, depth: number): void {
  const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
  const steps = Math.ceil(len);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x + (x2 - x) * t, py = y + (y2 - y) * t;
    const w = Math.max(1, Math.round(th * (1 - t * 0.5)));
    for (let k = 0; k < w; k++) {
      const c = k === 0 ? r[4] : k === w - 1 ? r[1] : r[2];
      p.set(Math.round(px) + k - Math.floor(w / 2), Math.round(py), c);
    }
  }
  if (depth <= 0 || len < 3) return;
  const n = depth > 1 ? 2 : rng.int(1, 2);
  for (let i = 0; i < n; i++) {
    const na = a + (i === 0 ? -1 : 1) * rng.range(0.35, 0.8);
    branchLines(p, x2, y2, na, len * rng.range(0.55, 0.75), Math.max(1, th - 1), r, rng, depth - 1);
  }
}

function grassBlades(p: Px, f: number, frames: number, n: number, baseY: number, w: number, r: R, rng: Rng, hMin: number, hMax: number): void {
  const blades: { x: number; h: number; lean: number; ph: number; c: number }[] = [];
  for (let i = 0; i < n; i++) blades.push({ x: rng.range(2, w - 3), h: rng.range(hMin, hMax), lean: rng.range(-2.5, 2.5), ph: rng.range(0, 1.2), c: rng.int(2, r.length - 1) });
  blades.sort((a, b) => a.h - b.h).reverse();
  for (const b of blades) {
    const sway = Math.sin((f / frames) * Math.PI * 2 + b.ph) * 1.4;
    for (let i = 0; i <= b.h; i++) {
      const t = i / b.h;
      const x = Math.round(b.x + (b.lean + sway) * t * t);
      const y = baseY - i;
      const c = t < 0.25 ? r[1] : t > 0.8 ? r[Math.min(r.length - 1, b.c + 1)] : r[b.c];
      p.set(x, y, c);
      if (t < 0.4) p.set(x + 1, y, r[Math.max(0, b.c - 1)]);
    }
  }
}

export const NATURE: Record<string, PropDef> = {
  'tree-oak': {
    w: 52, h: 60, ox: 26, oy: 55, variants: 3, sway: true,
    footprint: { x: -5, y: -4, w: 10, h: 6 },
    shadow: [27, 55, 17, 5, 0.34],
    draw({ p, r, v }) {
      trunk(p, 26, 30, 55, 8, wood, 3 + v, 3);
      // a branch fork peeking out under the crown
      for (let i = 0; i < 5; i++) { p.set(22 - i, 34 - i, wood[2]); p.set(30 + i, 33 - i, wood[1]); }
      foliage(p, 26, 22, 22 + v, 18 - (v % 2), LV, r, { clusters: 40, cr: [4, 7], seed: 11 + v });
      crownShadow(p, 26, 38, 8);
    },
  },
  'tree-apple': {
    w: 46, h: 52, ox: 23, oy: 48, variants: 2, sway: true,
    footprint: { x: -4, y: -4, w: 8, h: 5 },
    shadow: [24, 48, 15, 4.5, 0.34],
    draw({ p, r, v }) {
      trunk(p, 23, 27, 48, 6, wood, 5 + v, 2);
      foliage(p, 23, 20, 19, 16, appleLeaves, r, { clusters: 32, cr: [3.5, 6], seed: 21 + v });
      crownShadow(p, 23, 34, 6);
      // apples (only where foliage is)
      for (let i = 0; i < 14; i++) {
        const x = Math.round(r.range(8, 38)), y = Math.round(r.range(8, 32));
        if (p.get(x, y) < 0 || p.get(x + 1, y + 1) < 0) continue;
        p.set(x, y, RAMPS.red[4]); p.set(x + 1, y, RAMPS.red[3]); p.set(x, y + 1, RAMPS.red[3]); p.set(x + 1, y + 1, RAMPS.red[2]);
        p.set(x, y - 1 < 0 ? y : y, RAMPS.red[5]);
      }
      if (v === 1) { p.set(14, 47, RAMPS.red[3]); p.set(15, 47, RAMPS.red[2]); p.set(31, 49, RAMPS.red[3]); p.set(32, 49, RAMPS.red[2]); }
    },
  },
  'tree-pine': {
    w: 36, h: 64, ox: 18, oy: 60, variants: 2, sway: true,
    footprint: { x: -4, y: -4, w: 8, h: 5 },
    shadow: [19, 60, 12, 4, 0.34],
    draw({ p, v }) {
      const pr = RAMPS.pine;
      trunk(p, 18, 46, 60, 5, wood, 7, 1);
      const tiers = 5;
      for (let k = 0; k < tiers; k++) {
        const bottom = 54 - k * 10 + (v && k === 2 ? 1 : 0);
        const hw = 16 - k * 2.6;
        const hgt = 14;
        for (let y = bottom - hgt; y <= bottom + 1; y++) {
          const t = Math.max(0, (y - (bottom - hgt)) / hgt);
          const half = hw * Math.pow(t, 0.85);
          for (let x = Math.floor(18 - half); x <= Math.ceil(18 + half); x++) {
            // jagged lower edge
            const jag = (hash2(x, k, 31 + v) > 0.5 ? 1 : 0) + ((x + k) % 3 === 0 ? 1 : 0);
            if (y > bottom - 1 + jag) continue;
            const nx = (x + 0.5 - 18) / Math.max(1, half);
            const light = -nx * 0.55 + (1 - t) * 0.35 + 0.05;
            p.set(x, y, tone(pr, light, x, y, 0, 4, 0.5));
          }
        }
        // shadow cast by this tier on the one below
        for (let x = Math.floor(18 - hw); x <= Math.ceil(18 + hw); x++) {
          const yb = bottom + 2;
          const c = p.get(x, yb);
          if (c >= 0) p.set(x, yb, pr[0]);
        }
      }
      p.set(18, 4, pr[4]); p.set(18, 5, pr[3]);
    },
  },
  'tree-dead': {
    w: 40, h: 52, ox: 20, oy: 48, variants: 2,
    footprint: { x: -3, y: -3, w: 6, h: 4 },
    shadow: [21, 48, 10, 3, 0.3],
    draw({ p, r }) {
      trunk(p, 20, 24, 48, 5, greywood, 9, 2);
      branchLines(p, 20, 26, -Math.PI / 2 - 0.5, 11, 3, greywood, r, 3);
      branchLines(p, 20, 28, -Math.PI / 2 + 0.6, 10, 3, greywood, r, 3);
      branchLines(p, 20, 24, -Math.PI / 2, 9, 3, greywood, r, 2);
      // knot hole
      p.set(19, 36, greywood[0]); p.set(20, 36, greywood[0]); p.set(19, 37, greywood[1]);
    },
  },
  'tree-big': {
    w: 96, h: 100, ox: 48, oy: 94, sway: true,
    footprint: { x: -10, y: -6, w: 20, h: 8 },
    shadow: [50, 93, 34, 8, 0.36],
    draw({ p, r }) {
      // roots spreading on the ground
      const rootR = wood;
      for (const [dx, len] of [[-1, 18], [1, 16], [-1, 10], [1, 9]] as const) {
        for (let i = 0; i < len; i++) {
          const x = 48 + dx * (6 + i), y = 92 + Math.round(Math.sin(i * 0.35) * 1.5) - (i < 4 ? 1 : 0);
          const th = Math.max(1, 3 - Math.floor(i / 6));
          for (let k = 0; k < th; k++) p.set(x, y - k, k === th - 1 ? rootR[4] : rootR[2]);
        }
      }
      trunk(p, 48, 50, 94, 16, wood, 13, 5);
      // bark furrows + a cosy hollow
      for (let y = 58; y < 92; y += 1) { if (hash2(y, 1, 5) > 0.4) p.set(42 + (y % 5 === 0 ? 1 : 0), y, wood[1]); if (hash2(y, 2, 5) > 0.5) p.set(53, y, wood[1]); }
      p.ellipse(49, 78, 3, 4.5, darkHollow); p.ellipse(49, 79, 2, 3, 0x120a0c);
      for (let i = 0; i < 8; i++) { p.set(36 - i, 56 - i, wood[2]); p.set(36 - i, 55 - i, wood[3]); p.set(60 + i, 55 - i, wood[1]); p.set(60 + i, 54 - i, wood[2]); }
      foliage(p, 48, 34, 44, 30, LV, r, { clusters: 80, cr: [5, 9], seed: 41 });
      crownShadow(p, 48, 62, 18);
    },
  },
  'bush': {
    w: 26, h: 22, ox: 13, oy: 19, variants: 3, sway: true,
    footprint: { x: -8, y: -4, w: 16, h: 5 },
    shadow: [13, 19, 11, 3.5, 0.3],
    draw({ p, r, v }) { foliage(p, 13, 12, 11 - (v === 2 ? 1 : 0), 8, bushLeaves, r, { clusters: 12, cr: [3, 5], seed: 51 + v, flatBottom: 19 }); },
  },
  'bush-berry': {
    w: 26, h: 22, ox: 13, oy: 19, variants: 2, sway: true,
    footprint: { x: -8, y: -4, w: 16, h: 5 },
    shadow: [13, 19, 11, 3.5, 0.3],
    draw({ p, r, v }) {
      foliage(p, 13, 12, 11, 8, bushLeaves, r, { clusters: 12, cr: [3, 5], seed: 61 + v, flatBottom: 19 });
      const berry = v === 0 ? RAMPS.red : RAMPS.violet;
      for (let i = 0; i < 9; i++) {
        const x = Math.round(r.range(5, 20)), y = Math.round(r.range(6, 16));
        if (p.get(x, y) < 0) continue;
        p.set(x, y, berry[4]); p.set(x + 1, y, berry[3]); p.set(x, y + 1, berry[2]);
        if (r.chance(0.5)) { p.set(x + 2, y + 1, berry[3]); p.set(x + 2, y + 2, berry[1]); }
      }
    },
  },
  'bush-hide': {
    w: 36, h: 30, ox: 18, oy: 27, sway: true,
    footprint: null,
    shadow: [18, 27, 16, 4, 0.34],
    draw({ p, r }) {
      foliage(p, 18, 16, 16, 12, hideLeaves, r, { clusters: 22, cr: [3.5, 6], seed: 71, flatBottom: 27 });
      // fern fronds at the base
      for (const [bx, dir] of [[5, -1], [30, 1], [12, -1], [24, 1]] as const) {
        for (let i = 0; i < 6; i++) { p.set(bx + dir * i, 26 - Math.floor(i / 2), hideLeaves[3]); if (i % 2) p.set(bx + dir * i, 25 - Math.floor(i / 2), hideLeaves[4]); }
      }
    },
  },
  'tall-grass': {
    w: 18, h: 20, ox: 9, oy: 18, frames: 4, fps: 5, variants: 2,
    footprint: null,
    draw({ p, r, f, frames }) { grassBlades(p, f, frames, 13, 18, 18, G, r, 7, 14); },
  },
  'reeds': {
    w: 18, h: 26, ox: 9, oy: 24, frames: 4, fps: 4,
    footprint: null,
    draw({ p, r, f, frames }) {
      const reed = [0x2a3a1e, 0x3e5426, 0x56702e, 0x74903c, 0x9cb456, 0xc4d47a];
      grassBlades(p, f, frames, 10, 24, 18, reed, r, 10, 20);
      // cattails
      for (let i = 0; i < 3; i++) {
        const x = 4 + i * 5 + Math.round(Math.sin((f / frames) * Math.PI * 2 + i) * 1);
        const y = 4 + i * 2 + (i === 1 ? -2 : 0);
        for (let k = 0; k < 5; k++) { p.set(x, y + k, k === 0 ? RAMPS.earth[4] : RAMPS.earth[2]); p.set(x + 1, y + k, RAMPS.earth[1]); }
        p.set(x, y - 1, reed[4]); p.set(x, y + 5, reed[2]); p.set(x, y + 6, reed[2]);
      }
    },
  },
  'flowers-blue': {
    w: 18, h: 16, ox: 9, oy: 14, sway: true, variants: 2, footprint: null, noOutline: true,
    draw({ p, r }) {
      const cf = RAMPS.cornflower;
      for (let i = 0; i < 7; i++) {
        const x = Math.round(r.range(3, 15)), top = Math.round(r.range(3, 9));
        for (let y = top + 2; y <= 14; y++) p.set(x + (y < 9 && i % 2 ? 1 : 0), y, y > 11 ? G[1] : G[3]);
        // star-shaped cornflower head
        p.set(x, top, cf[3]); p.set(x - 1, top, cf[2]); p.set(x + 1, top, cf[3]); p.set(x, top - 1, cf[4]);
        p.set(x, top + 1, cf[1]); p.set(x - 1, top - 1, cf[4]); p.set(x + 1, top + 1, cf[2]);
        if (r.chance(0.5)) p.set(x + 1, top - 1, cf[4]);
      }
      for (let i = 0; i < 5; i++) { const x = Math.round(r.range(3, 15)); p.set(x, 13, G[4]); p.set(x, 12, G[3]); }
    },
  },
  'flowers-mixed': {
    w: 18, h: 16, ox: 9, oy: 14, sway: true, variants: 3, footprint: null, noOutline: true,
    draw({ p, r }) {
      const heads: R[] = [RAMPS.yellow, RAMPS.pink, RAMPS.white, RAMPS.cornflower, RAMPS.red];
      for (let i = 0; i < 8; i++) {
        const x = Math.round(r.range(3, 15)), top = Math.round(r.range(4, 10));
        for (let y = top + 1; y <= 14; y++) p.set(x, y, y > 11 ? G[1] : G[3]);
        const h = r.pick(heads);
        p.set(x, top, h[3]); p.set(x - 1, top, h[2]); p.set(x + 1, top, h[2]); p.set(x, top - 1, h[4]); p.set(x, top + 1, h[1]);
        if (h !== RAMPS.yellow) p.set(x, top, RAMPS.yellow[3]);
      }
      for (let i = 0; i < 4; i++) { const x = Math.round(r.range(3, 15)); p.set(x, 13, G[4]); p.set(x + 1, 12, G[3]); }
    },
  },
  'rock': {
    w: 18, h: 14, ox: 9, oy: 12, variants: 3,
    footprint: { x: -6, y: -4, w: 12, h: 5 },
    shadow: [10, 12, 8, 2.5, 0.3],
    draw({ p, r, v }) { rock(p, 9, 8, 7, 4.5, v === 2 ? RAMPS.warmstone : RAMPS.stone, r, 81 + v); },
  },
  'rock-big': {
    w: 36, h: 28, ox: 18, oy: 25, variants: 2,
    footprint: { x: -14, y: -9, w: 28, h: 10 },
    shadow: [19, 25, 16, 4, 0.32],
    draw({ p, r, v }) { rock(p, 18, 15, 15, 10, v ? RAMPS.warmstone : RAMPS.stone, r, 91 + v); },
  },
  'stump': {
    w: 20, h: 18, ox: 10, oy: 15,
    footprint: { x: -6, y: -4, w: 12, h: 5 },
    shadow: [11, 15, 9, 3, 0.3],
    draw({ p }) {
      // roots
      p.set(3, 15, wood[2]); p.set(4, 14, wood[3]); p.set(16, 15, wood[1]); p.set(15, 14, wood[2]);
      cylinder(p, 10, 7, 6.5, 3, 6, wood, { topRamp: RAMPS.straw });
      // growth rings
      p.ellipse(10, 7, 4.5, 2, RAMPS.straw[3]); p.ellipse(10, 7, 3, 1.3, RAMPS.straw[4]); p.ellipse(10, 7, 1.5, 0.7, RAMPS.straw[2]);
      p.set(13, 8, RAMPS.straw[1]); p.set(12, 9, RAMPS.straw[1]);
    },
  },
  'log': {
    w: 36, h: 16, ox: 18, oy: 13,
    footprint: { x: -15, y: -6, w: 30, h: 6 },
    shadow: [18, 13, 16, 3, 0.3],
    draw({ p }) {
      for (let x = 4; x < 31; x++) for (let y = 3; y < 12; y++) {
        const ny = (y + 0.5 - 7.5) / 4.5;
        let c = tone(wood, -ny * 0.75 + 0.15, x, y, 1, 5, 0.3);
        if (hash2(x, y, 3) > 0.86 && y > 4) c = wood[1];
        p.set(x, y, c);
      }
      // end cap with rings
      p.ellipse(31, 7.5, 3, 4.5, RAMPS.straw[3]); p.ellipse(31, 7.5, 2, 3, RAMPS.straw[4]); p.ellipse(31, 7.5, 1, 1.5, RAMPS.straw[2]);
      // moss
      for (let x = 8; x < 20; x++) if (hash2(x, 1, 9) > 0.35) p.set(x, 3, G[4]);
      for (let x = 9; x < 17; x++) if (hash2(x, 2, 9) > 0.5) p.set(x, 4, G[3]);
    },
  },
  'lilypad': {
    w: 16, h: 10, ox: 8, oy: 7, variants: 3, footprint: null, noOutline: false,
    draw({ p, v }) {
      const pad = [0x1a3a2a, 0x24502e, 0x34703a, 0x4c9044, 0x6cb052];
      p.ellipse(7, 5, 6, 3.5, pad[2]);
      p.ellipse(6, 4.3, 4, 2.2, pad[3]);
      // notch
      p.clear(7, 5); p.clear(8, 5); p.clear(9, 5); p.clear(10, 5); p.clear(8, 4);
      p.set(4, 3, pad[4]); p.set(5, 3, pad[4]);
      if (v === 1) { p.set(5, 4, RAMPS.pink[4]); p.set(4, 4, RAMPS.pink[3]); p.set(6, 4, RAMPS.pink[3]); p.set(5, 3, 0xffffff); p.set(5, 5, RAMPS.pink[2]); }
      if (v === 2) { p.ellipse(12, 7, 2.5, 1.5, pad[2]); p.set(11, 6, pad[4]); }
    },
  },
  'stones-pile': {
    w: 18, h: 12, ox: 9, oy: 10, footprint: { x: -6, y: -3, w: 12, h: 4 },
    shadow: [9, 10, 8, 2, 0.28],
    draw({ p, r }) {
      rock(p, 6, 7, 4, 3, RAMPS.stone, r, 5);
      rock(p, 12, 7.5, 4, 2.8, RAMPS.warmstone, r, 6);
      rock(p, 9, 4.5, 3.5, 2.6, RAMPS.stone, r, 7);
    },
  },
  'twigs': {
    w: 16, h: 10, ox: 8, oy: 8, footprint: null,
    draw({ p }) {
      const lines: [number, number, number, number][] = [[2, 7, 13, 4], [3, 4, 12, 7], [5, 8, 11, 2], [1, 6, 9, 6]];
      lines.forEach(([a, b, c, d], i) => p.line(a, b, c, d, i % 2 ? wood[2] : wood[4]));
      p.set(7, 4, wood[1]); p.set(12, 6, G[3]);
    },
  },
  'bird-nest': {
    w: 14, h: 10, ox: 7, oy: 8, variants: 2, footprint: null,
    draw({ p, v }) {
      p.ellipse(7, 6, 6, 3, RAMPS.straw[1]);
      p.ellipse(7, 5.5, 4.5, 2, RAMPS.earth[1]);
      for (let x = 1; x < 13; x++) { p.set(x, 6 + (x % 2), x % 3 ? RAMPS.straw[2] : RAMPS.straw[3]); p.set(x, 8, RAMPS.straw[0]); }
      p.set(2, 4, RAMPS.straw[3]); p.set(11, 4, RAMPS.straw[2]); p.set(12, 5, RAMPS.straw[3]);
      if (v === 0) {
        for (const ex of [5, 8]) { p.set(ex, 5, 0xbfe3e8); p.set(ex + 1, 5, 0x9ccad4); p.set(ex, 4, 0xe8fbff); p.set(ex + 1, 4, 0xbfe3e8); }
      } else {
        // a fluffy nestling
        p.ellipse(7, 4.5, 2.5, 2, RAMPS.ash[3]); p.set(6, 3, RAMPS.ash[4]); p.set(8, 4, 0x141018); p.set(9, 4, RAMPS.yellow[3]); p.set(10, 4, RAMPS.yellow[2]);
      }
    },
  },
};

const darkHollow = 0x24161a;

/** Darkens the trunk right under a crown (the crown shades it). */
function crownShadow(p: Px, cx: number, y: number, w: number): void {
  for (let yy = y; yy < y + 4; yy++) for (let x = cx - w; x <= cx + w; x++) {
    const c = p.get(x, yy);
    if (c >= 0 && WOODSET.has(c)) p.set(x, yy, yy < y + 2 ? wood[1] : wood[2]);
  }
}
const WOODSET = new Set<number>(wood);
void shift;

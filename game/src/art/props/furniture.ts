import { RAMPS } from '../palette';
import type { Px } from '../px';
import { hash2 } from '../rng';
import { type PropDef, type R, box, cylinder, darkwood, flame, glowUnder, planks, tone, wood } from './core';

const stone = RAMPS.warmstone;
const iron = RAMPS.iron;
const quilt: R[] = [[0x4a1c24, 0x6e2a2c, 0x92403a, 0xae5a48, 0xc8785e], RAMPS.linen, [0x30391c, 0x465426, 0x5e7032, 0x768a44, 0x90a45a], RAMPS.linen];
const bookColors: R[] = [RAMPS.red, RAMPS.blue, RAMPS.green, RAMPS.straw, RAMPS.violet, RAMPS.leather, RAMPS.teal];

function legs(p: Px, xs: number[], top: number, bottom: number, r: R = wood): void {
  for (const x of xs) for (let y = top; y <= bottom; y++) { p.set(x, y, r[3]); p.set(x + 1, y, r[1]); }
}

function books(p: Px, x0: number, y0: number, w: number, h: number, seed: number): void {
  let x = x0;
  let k = 0;
  while (x < x0 + w) {
    const bw = 2 + Math.floor(hash2(k, 0, seed) * 2);
    const bh = h - Math.floor(hash2(k, 1, seed) * 3);
    const r = bookColors[Math.floor(hash2(k, 2, seed) * bookColors.length)];
    const lean = hash2(k, 3, seed) > 0.9;
    for (let xx = 0; xx < bw && x + xx < x0 + w; xx++) {
      for (let yy = h - bh; yy < h; yy++) {
        let c = r[xx === 0 ? 4 : xx === bw - 1 ? 2 : 3];
        if (yy === h - bh + 1 || yy === h - 3) c = RAMPS.gold[3];
        p.set(x + xx + (lean && yy < h - bh / 2 ? 1 : 0), y0 + yy, c);
      }
    }
    x += bw + (hash2(k, 4, seed) > 0.85 ? 1 : 0);
    k++;
  }
}

function fireplaceBody(p: Px): void {
  // chimney breast
  for (let y = 0; y < 44; y++) for (let x = 4; x < 40; x++) {
    const row = Math.floor(y / 4), lx = (x + (row % 2) * 4) % 8;
    let c = stone[x < 14 ? 4 : x > 32 ? 2 : 3];
    if (hash2(Math.floor((x + (row % 2) * 4) / 8), row, 4) > 0.75) c = stone[x < 14 ? 3 : 2];
    if (y % 4 === 3 || lx === 0) c = stone[1];
    else if (y % 4 === 0) c = stone[5];
    p.set(x, y, c);
  }
  // mantel shelf
  for (let x = 1; x < 43; x++) { p.set(x, 18, darkwood[4]); p.set(x, 19, darkwood[3]); p.set(x, 20, darkwood[1]); }
  // hearth opening
  p.rect(10, 24, 24, 18, 0x120c0c);
  for (let x = 10; x < 34; x++) { p.set(x, 24, stone[1]); }
  for (let y = 24; y < 42; y++) { p.set(10, y, stone[1]); p.set(33, y, stone[2]); }
  // arch stones
  for (let x = 9; x < 35; x++) { p.set(x, 22, stone[5]); p.set(x, 23, stone[3]); }
  // soot gradient
  for (let y = 25; y < 32; y++) for (let x = 11; x < 33; x++) p.set(x, y, y < 28 ? 0x0a0808 : 0x1a1210);
  // logs
  for (let x = 13; x < 31; x++) { p.set(x, 39, wood[3]); p.set(x, 40, wood[1]); }
  for (let i = 0; i < 12; i++) { p.set(14 + i, 38 - Math.floor(i / 4), wood[4]); p.set(30 - i, 38 - Math.floor(i / 4), wood[2]); }
  // hearth floor
  for (let x = 6; x < 38; x++) { p.set(x, 42, stone[5]); p.set(x, 43, stone[3]); p.set(x, 44, stone[1]); }
  // things on the mantel: jug, candle stub, little box
  cylinder(p, 9, 13, 2, 1, 4, RAMPS.cream);
  p.rect(30, 14, 5, 4, darkwood[3]); p.rect(30, 14, 5, 1, darkwood[5]);
  p.rect(20, 12, 2, 6, RAMPS.cream[4]);
}

export const FURNITURE: Record<string, PropDef> = {
  'bench': {
    w: 30, h: 16, ox: 15, oy: 14, variants: 2,
    footprint: { x: -14, y: -5, w: 28, h: 5 },
    anchors: { sit: { x: 0, y: -4 } },
    shadow: [15, 14, 14, 2, 0.28],
    draw({ p, v }) {
      if (v === 1) { // with backrest
        planks(p, 1, 0, 28, 4, wood, false, 2, 3);
        legs(p, [2, 26], 4, 7);
      }
      box(p, 1, 6, 28, 4, 2, wood, darkwood, { grain: true });
      legs(p, [3, 25], 12, 14);
    },
  },
  'table': {
    w: 34, h: 26, ox: 17, oy: 24, variants: 2,
    footprint: { x: -16, y: -12, w: 32, h: 12 },
    shadow: [17, 24, 16, 2.5, 0.3],
    draw({ p, v }) {
      planks(p, 1, 2, 32, 13, wood, false, 4, 5);
      for (let x = 1; x < 33; x++) { p.set(x, 2, wood[5]); p.set(x, 15, darkwood[4]); p.set(x, 16, darkwood[3]); p.set(x, 17, darkwood[1]); }
      legs(p, [3, 29], 18, 24, darkwood);
      if (v === 1) {
        // bread, mug and a plate
        p.ellipse(10, 8, 4, 2.5, RAMPS.cream[3]); p.ellipse(10, 7.6, 2.5, 1.4, RAMPS.straw[3]); p.set(9, 7, RAMPS.straw[4]);
        cylinder(p, 22, 6, 2, 1, 4, RAMPS.earth, { open: true, inner: RAMPS.earth[1] });
        p.set(25, 7, RAMPS.earth[4]); p.set(25, 8, RAMPS.earth[3]);
      }
    },
  },
  'table-round': {
    w: 32, h: 26, ox: 16, oy: 24,
    footprint: { x: -13, y: -9, w: 26, h: 9 },
    shadow: [16, 24, 13, 2.5, 0.3],
    draw({ p }) {
      legs(p, [15], 14, 23, darkwood);
      for (let x = 11; x < 21; x++) { p.set(x, 23, darkwood[3]); p.set(x, 24, darkwood[1]); }
      // rim (front edge) then top
      p.ellipse(16, 11, 15, 8, darkwood[2]);
      p.ellipse(16, 9.5, 15, 7.5, wood[3]);
      for (let y = 2; y < 18; y++) for (let x = 1; x < 31; x++) {
        if (p.get(x, y) !== wood[3]) continue;
        const k = Math.floor(x / 4), lx = x % 4;
        let i = 3 + (hash2(k, 0, 7) > 0.6 ? 1 : 0);
        if (lx === 0) i = 2;
        if (y < 5 && x < 14) i = Math.min(5, i + 1);
        p.set(x, y, wood[i]);
      }
      p.ellipse(16, 9.5, 2, 1, RAMPS.cream[4]); p.set(17, 9, RAMPS.yellow[3]);
    },
  },
  'chair': {
    w: 14, h: 22, ox: 7, oy: 20, variants: 3,
    footprint: { x: -5, y: -4, w: 10, h: 4 },
    anchors: { sit: { x: 0, y: -4 } },
    shadow: [7, 20, 6, 1.5, 0.28],
    draw({ p, v }) {
      if (v === 0) { // facing down: backrest behind
        legs(p, [2, 10], 2, 12);
        planks(p, 2, 1, 10, 6, wood, true, 2, 7);
        box(p, 1, 11, 12, 4, 2, wood, darkwood);
        legs(p, [2, 10], 16, 20, darkwood);
      } else if (v === 1) { // facing up: backrest in front
        box(p, 1, 9, 12, 4, 2, wood, darkwood);
        legs(p, [2, 10], 14, 20, darkwood);
        planks(p, 2, 6, 10, 9, wood, true, 2, 8);
      } else { // side view (facing right)
        legs(p, [2], 2, 20, darkwood);
        box(p, 2, 11, 10, 3, 2, wood, darkwood);
        legs(p, [10], 16, 20, darkwood);
      }
    },
  },
  'stool': {
    w: 12, h: 12, ox: 6, oy: 11,
    footprint: { x: -4, y: -3, w: 8, h: 3 },
    shadow: [6, 11, 5, 1.4, 0.28],
    draw({ p }) {
      legs(p, [2, 8], 5, 10, darkwood);
      p.ellipse(6, 4, 5, 2.4, darkwood[2]);
      p.ellipse(6, 3.4, 5, 2.2, wood[4]);
      p.set(4, 3, wood[5]); p.set(5, 2, wood[5]);
    },
  },
  'counter': {
    w: 52, h: 28, ox: 26, oy: 26,
    footprint: { x: -26, y: -14, w: 52, h: 14 },
    shadow: [26, 26, 26, 2, 0.3],
    draw({ p }) {
      // polished dark top
      for (let y = 0; y < 8; y++) for (let x = 0; x < 52; x++) {
        let c = darkwood[y === 0 ? 5 : 4];
        if ((x + y * 3) % 17 === 0 && y > 1) c = darkwood[5];
        if (y === 7) c = darkwood[2];
        p.set(x, y, c);
      }
      // front with raised panels
      for (let y = 8; y < 26; y++) for (let x = 0; x < 52; x++) {
        const lx = x % 13;
        let c = wood[2];
        if (lx === 0) c = darkwood[1];
        else if (lx >= 2 && lx <= 11 && y >= 11 && y <= 22) {
          c = wood[3];
          if (y === 11 || lx === 2) c = wood[4];
          if (y === 22 || lx === 11) c = wood[1];
        }
        if (y === 8) c = wood[5];
        if (y === 25) c = darkwood[1];
        p.set(x, y, c);
      }
      // mugs and a jug on top
      for (const mx of [6, 13, 40]) { cylinder(p, mx, 2, 2, 1, 3, RAMPS.straw, { open: true, inner: 0xfff1c4 }); p.set(mx + 3, 3, RAMPS.straw[3]); }
      cylinder(p, 28, 1, 3, 1.2, 4, RAMPS.cream, { open: true, inner: RAMPS.earth[1] });
    },
  },
  'post': {
    w: 12, h: 46, ox: 6, oy: 44,
    footprint: { x: -4, y: -4, w: 8, h: 4 },
    shadow: [6, 44, 6, 2, 0.3],
    draw({ p }) {
      for (let y = 4; y < 42; y++) for (let x = 2; x < 10; x++) {
        let c = darkwood[x < 4 ? 4 : x < 7 ? 3 : 2];
        if (x === 9) c = darkwood[1];
        if (hash2(x, y >> 2, 3) > 0.85) c = darkwood[Math.max(1, darkwood.indexOf(c as never) - 1)] ?? c;
        p.set(x, y, c);
      }
      // capital + base blocks
      box(p, 0, 0, 12, 2, 3, darkwood, darkwood);
      box(p, 1, 40, 10, 1, 4, stone, stone);
      // rope fibres hint (story clue spot)
      p.set(3, 24, RAMPS.straw[3]); p.set(4, 25, RAMPS.straw[2]);
    },
  },
  'fireplace': {
    w: 44, h: 46, ox: 22, oy: 45, frames: 6, fps: 9,
    footprint: { x: -20, y: -10, w: 40, h: 10 },
    light: { radius: 72, color: 0xffa040, flicker: true, offsetY: -12 },
    anchors: { fire: { x: 0, y: -10 } },
    draw() { /* body drawn in post so the outline does not cut the fire */ },
    post({ p, f, frames }) {
      fireplaceBody(p);
      flame(p, 22, 38, 14, 13, f, frames, 5);
      for (let x = 12; x < 32; x++) if (hash2(x, f, 2) > 0.6) p.set(x, 41, RAMPS.fire[hash2(x, f, 3) > 0.5 ? 2 : 1]);
    },
  },
  'bed': {
    w: 28, h: 38, ox: 14, oy: 36, variants: 2,
    footprint: { x: -13, y: -30, w: 26, h: 30 },
    anchors: { lie: { x: 0, y: -18 } },
    shadow: [14, 36, 13, 2, 0.3],
    draw({ p, v }) {
      // headboard
      box(p, 1, 0, 26, 2, 6, darkwood, darkwood);
      // mattress/sheet
      p.rect(2, 7, 24, 26, RAMPS.cream[4]);
      // pillow
      p.rect(5, 8, 18, 6, RAMPS.cream[5]); p.rect(5, 13, 18, 1, RAMPS.cream[2]); p.set(5, 8, RAMPS.cream[3]); p.set(22, 8, RAMPS.cream[3]);
      // quilt (patchwork)
      for (let y = 16; y < 33; y++) for (let x = 2; x < 26; x++) {
        const q = quilt[(Math.floor(x / 6) + Math.floor((y - 16) / 6) + v) % quilt.length];
        let c = q[3];
        if ((x % 6 === 0) || ((y - 16) % 6 === 0)) c = q[1];
        if (y === 16) c = RAMPS.cream[4];
        p.set(x, y, c);
      }
      // footboard
      box(p, 1, 32, 26, 1, 4, darkwood, darkwood);
    },
  },
  'cradle': {
    w: 24, h: 20, ox: 12, oy: 18, variants: 1,
    footprint: { x: -10, y: -6, w: 20, h: 6 },
    shadow: [12, 18, 11, 2, 0.28],
    draw: c => cradle(c.p, false),
  },
  'cradle-twins': {
    w: 24, h: 20, ox: 12, oy: 18,
    footprint: { x: -10, y: -6, w: 20, h: 6 },
    shadow: [12, 18, 11, 2, 0.28],
    draw: c => cradle(c.p, true),
  },
  'shelf': {
    w: 30, h: 32, ox: 15, oy: 31,
    footprint: { x: -14, y: -6, w: 28, h: 6 },
    draw({ p }) {
      for (let y = 0; y < 31; y++) for (let x = 0; x < 30; x++) {
        let c = darkwood[2];
        if (x === 0 || x === 29) c = darkwood[x ? 1 : 4];
        p.set(x, y, c);
      }
      for (const sy of [9, 19, 29]) for (let x = 1; x < 29; x++) { p.set(x, sy, wood[4]); p.set(x, sy + 1, darkwood[1]); }
      // jars, pots, herbs
      cylinder(p, 6, 4, 2.5, 1, 4, RAMPS.cream); p.rect(5, 2, 3, 1, RAMPS.earth[3]);
      cylinder(p, 13, 5, 2, 1, 3, RAMPS.teal, { topRamp: RAMPS.teal });
      cylinder(p, 21, 3, 3, 1.2, 5, RAMPS.rust);
      cylinder(p, 7, 14, 3, 1.2, 4, RAMPS.earth);
      for (let i = 0; i < 4; i++) { p.set(16 + i * 2, 12, RAMPS.green[3]); p.set(16 + i * 2, 13, RAMPS.green[2]); p.set(17 + i * 2, 14, RAMPS.green[4]); p.vline(16 + i * 2, 14, 18, RAMPS.straw[2]); }
      p.rect(4, 22, 8, 6, RAMPS.cream[4]); p.rect(4, 22, 8, 1, RAMPS.cream[5]); // folded cloth
      cylinder(p, 20, 23, 3, 1.2, 4, RAMPS.straw, { open: true, inner: RAMPS.straw[1] });
    },
  },
  'bookshelf': {
    w: 30, h: 38, ox: 15, oy: 37, variants: 2,
    footprint: { x: -14, y: -6, w: 28, h: 6 },
    draw({ p, v }) {
      for (let y = 0; y < 37; y++) for (let x = 0; x < 30; x++) {
        let c = darkwood[1];
        if (x <= 1) c = darkwood[4]; else if (x >= 28) c = darkwood[2];
        if (y <= 1) c = darkwood[5];
        p.set(x, y, c);
      }
      for (const [sy, h] of [[3, 9], [14, 9], [25, 9]] as const) {
        books(p, 2, sy, 26, h, 3 + sy + v * 11);
        for (let x = 1; x < 29; x++) { p.set(x, sy + h, wood[4]); p.set(x, sy + h + 1, darkwood[2]); }
      }
    },
  },
  'bookstack': {
    w: 14, h: 12, ox: 7, oy: 11,
    footprint: null,
    shadow: [7, 11, 6, 1.4, 0.28],
    draw({ p }) {
      const stack: [number, R, number][] = [[9, RAMPS.red, 11], [7, RAMPS.blue, 10], [5, RAMPS.green, 11], [3, RAMPS.leather, 9]];
      for (const [y, r, w] of stack) {
        const x0 = 7 - Math.floor(w / 2) + (y % 4 === 1 ? 1 : 0);
        for (let x = x0; x < x0 + w; x++) { p.set(x, y, RAMPS.cream[4]); p.set(x, y + 1, r[3]); }
        p.set(x0, y, r[3]); p.set(x0, y + 1, r[2]); p.set(x0 + 2, y + 1, RAMPS.gold[3]);
      }
      p.set(9, 2, RAMPS.red[4]); p.set(9, 1, RAMPS.red[3]); // ribbon bookmark
    },
  },
  'candle': {
    w: 8, h: 14, ox: 4, oy: 13, frames: 4, fps: 8,
    footprint: null,
    light: { radius: 26, color: 0xffd27a, flicker: true, offsetY: -9 },
    draw({ p }) {
      p.ellipse(4, 12, 3.5, 1.5, RAMPS.iron[3]);
      for (let y = 6; y < 12; y++) { p.set(3, y, RAMPS.cream[5]); p.set(4, y, RAMPS.cream[4]); }
      p.set(5, 7, RAMPS.cream[4]); p.set(5, 8, RAMPS.cream[3]);
    },
    post({ p, f }) {
      const sway = [0, 1, 0, -1][f];
      p.set(4, 5, 0x2a1a14);
      p.set(4 + (sway > 0 ? 1 : 0), 4, RAMPS.fire[3]); p.set(4, 3, RAMPS.fire[4]); p.set(4 + sway, 2, RAMPS.fire[3]);
      if (f % 2 === 0) p.set(4, 1, RAMPS.fire[2]);
      glowUnder(p, 4.5, 3.5, 4, 0xffd27a, 0.35);
    },
  },
  'lantern': {
    w: 12, h: 18, ox: 6, oy: 17, frames: 4, fps: 6,
    footprint: null,
    light: { radius: 44, color: 0xffc46a, flicker: true, offsetY: -9 },
    draw({ p }) {
      // ring + cap
      p.set(5, 0, iron[4]); p.set(6, 0, iron[3]); p.set(4, 1, iron[3]); p.set(7, 1, iron[2]);
      box(p, 2, 2, 8, 1, 2, iron, iron);
      // cage
      for (let y = 5; y < 14; y++) { p.set(2, y, iron[4]); p.set(9, y, iron[2]); p.set(5, y, iron[3]); }
      box(p, 2, 14, 8, 1, 2, iron, iron);
    },
    post({ p, f }) {
      const g = [0xfff2c0, 0xfcd270, 0xf0a038];
      for (let y = 5; y < 14; y++) for (const x of [3, 4, 6, 7, 8]) p.set(x, y, y < 8 ? g[0] : y < 11 ? g[1] : g[2]);
      p.set(4, 9 + (f % 2), 0xffffff);
      glowUnder(p, 6, 9, 7, 0xffc46a, 0.28);
    },
  },
  'torch': {
    w: 10, h: 24, ox: 5, oy: 23, frames: 6, fps: 10,
    footprint: { x: -1, y: -2, w: 2, h: 2 },
    light: { radius: 56, color: 0xffa040, flicker: true, offsetY: -18 },
    draw({ p }) {
      for (let y = 9; y < 23; y++) { p.set(4, y, wood[3]); p.set(5, y, wood[1]); }
      // wrapped head
      p.rect(3, 8, 4, 3, RAMPS.earth[1]); p.set(3, 9, RAMPS.earth[3]);
    },
    post({ p, f, frames }) { flame(p, 5, 9, 6, 8, f, frames, 13); },
  },
  'keg': {
    w: 20, h: 18, ox: 10, oy: 17,
    footprint: { x: -9, y: -5, w: 18, h: 5 },
    shadow: [10, 17, 9, 1.8, 0.3],
    draw({ p }) {
      // stand
      for (const x of [3, 15]) { p.set(x, 14, darkwood[3]); p.set(x, 15, darkwood[2]); p.set(x, 16, darkwood[1]); p.set(x + 1, 16, darkwood[1]); }
      // barrel lying on its side
      for (let y = 2; y < 14; y++) for (let x = 3; x < 18; x++) {
        const ny = (y + 0.5 - 8) / 6;
        let c = tone(wood, -ny * 0.7 + 0.15, x, y, 1, 5, 0.3);
        if (x === 6 || x === 14) c = iron[3];
        if (x === 7 || x === 15) c = iron[1];
        p.set(x, y, c);
      }
      p.ellipse(3, 8, 2.5, 6, wood[4]); p.ellipse(3, 8, 1.5, 4.5, wood[3]);
      // tap
      p.set(1, 11, RAMPS.gold[3]); p.set(0, 11, RAMPS.gold[2]); p.set(0, 12, RAMPS.gold[1]);
    },
  },
  'door': {
    w: 16, h: 26, ox: 8, oy: 25, variants: 2,
    footprint: null,
    draw({ p, v }) {
      p.rect(0, 0, 16, 26, darkwood[1]);
      for (let x = 1; x < 15; x++) p.set(x, 0, darkwood[4]);
      planks(p, 2, 2, 12, 22, v ? darkwood : wood, true, 3, 17 + v);
      p.set(2, 2, darkwood[1]); p.set(13, 2, darkwood[1]);
      for (const by of [5, 19]) for (let x = 2; x < 14; x++) p.set(x, by, iron[3]);
      p.set(11, 13, RAMPS.gold[4]); p.set(11, 14, RAMPS.gold[2]);
      for (let x = 0; x < 16; x++) { p.set(x, 24, stone[4]); p.set(x, 25, stone[2]); }
    },
  },
  'window': {
    w: 16, h: 16, ox: 8, oy: 15, variants: 2,
    footprint: null,
    light: undefined,
    draw({ p, v }) {
      p.rect(1, 1, 14, 13, darkwood[1]);
      for (let y = 2; y < 13; y++) for (let x = 2; x < 14; x++) {
        const night = v === 1;
        let c = night ? (y < 7 ? 0x2a3460 : 0x1c2448) : ((x + y) % 7 < 2 ? 0xbcd8ea : y < 5 ? 0x7ea0c0 : 0x4a6488);
        if (night && hash2(x, y, 3) > 0.94) c = 0xe6eaf2;
        p.set(x, y, c);
      }
      for (let y = 2; y < 13; y++) p.set(7, y, darkwood[3]);
      for (let x = 2; x < 14; x++) p.set(x, 7, darkwood[3]);
      for (let x = 0; x < 16; x++) { p.set(x, 13, wood[4]); p.set(x, 14, wood[2]); }
    },
  },
};

function cradle(p: Px, twins: boolean): void {
  // rockers
  for (let x = 1; x < 23; x++) { const y = 17 - Math.round(Math.abs(x - 11.5) < 8 ? 0 : (Math.abs(x - 11.5) - 8) * 0.8); p.set(x, y, darkwood[3]); p.set(x, y + 1, darkwood[1]); }
  // basket body (3/4 view): back wall, inside, front wall
  box(p, 2, 3, 20, 7, 6, wood, wood);
  // blanket inside
  p.rect(3, 4, 18, 6, RAMPS.cream[3]);
  for (let x = 3; x < 21; x++) { p.set(x, 8, RAMPS.sky[3]); p.set(x, 9, RAMPS.sky[2]); p.set(x, 7, RAMPS.sky[4]); }
  // posts at the head end
  for (const x of [2, 21]) { p.set(x, 1, wood[5]); p.set(x, 2, wood[4]); }
  if (twins) {
    // two sleeping babies: round heads, closed eyes, tiny tufts of hair
    for (const [hx, hair] of [[8, RAMPS.ginger[3]], [15, RAMPS.nut[3]]] as const) {
      p.ellipse(hx, 5.5, 2.6, 2.3, RAMPS.skin[4]);
      p.set(hx - 2, 5, RAMPS.skin[3]); p.set(hx + 2, 6, RAMPS.skin[3]);
      p.set(hx - 1, 4, hair); p.set(hx, 3, hair); p.set(hx + 1, 4, hair);
      p.set(hx - 1, 6, RAMPS.skin[1]); p.set(hx + 1, 6, RAMPS.skin[1]);
      p.set(hx - 2, 7, RAMPS.pink[4]);
    }
  } else {
    p.ellipse(11.5, 5.5, 3, 2, RAMPS.cream[4]); // pillow
  }
}

import { RAMPS, mix } from '../palette';
import type { Px } from '../px';
import { hash2, valueNoise } from '../rng';
import { type PropDef, type R, box, darkwood, flame, glowUnder, rock, tone, wood } from './core';

const canvas = [0x4e4236, 0x75664f, 0x9c8b6c, 0xc0ae8a, 0xdccca6, 0xf0e4c4] as R;
const blackCanvas = [0x0c0b10, 0x16141c, 0x221f2a, 0x302c3a, 0x423d4e, 0x5a546a] as R;
const iron = RAMPS.iron;
const stone = RAMPS.stone;
const steel = RAMPS.steel;

/** Waving cloth: column x is shifted by a travelling sine; returns vertical offset. */
function wave(x: number, f: number, frames: number, amp = 1.2): number {
  return Math.round(Math.sin((x * 0.6) - (f / frames) * Math.PI * 2) * amp * Math.min(1, x / 4));
}

function banner(p: Px, f: number, frames: number, paint: (x: number, y: number) => number): void {
  // pole
  for (let y = 2; y < 42; y++) { p.set(2, y, wood[4]); p.set(3, y, wood[2]); }
  p.set(2, 1, RAMPS.gold[4]); p.set(3, 1, RAMPS.gold[2]); p.set(2, 0, RAMPS.gold[3]);
  // crossbar
  for (let x = 2; x < 17; x++) { p.set(x, 4, wood[3]); }
  for (let x = 0; x < 13; x++) {
    const dy = wave(x, f, frames);
    const len = 22 - (x > 9 ? (x - 9) * 2 : 0); // swallow-tail-ish bottom
    for (let y = 0; y < len; y++) {
      let c = paint(x, y);
      // fold shading from the wave
      const slope = wave(x + 1, f, frames) - dy;
      if (slope > 0) c = mix(c, 0x14101c, 0.25);
      else if (slope < 0) c = mix(c, 0xffffff, 0.12);
      p.set(4 + x, 5 + y + dy, c);
    }
  }
}

function logPost(p: Px, x: number, top: number, bottom: number, w = 3): void {
  for (let y = top; y <= bottom; y++) for (let k = 0; k < w; k++) p.set(x + k, y, wood[k === 0 ? 4 : k === w - 1 ? 1 : 3]);
}

export const CAMP: Record<string, PropDef> = {
  'tent': {
    w: 42, h: 36, ox: 21, oy: 33, variants: 2,
    footprint: { x: -18, y: -14, w: 36, h: 14 },
    anchors: { door: { x: 0, y: 2 } },
    shadow: [22, 33, 20, 3, 0.3],
    draw({ p, v }) {
      const c = v === 1 ? [0x3e3a28, 0x5a5636, 0x787444, 0x989454, 0xb4b06a, 0xcac680] as R : canvas;
      // slopes
      p.poly([[21, 1], [21, 9], [2, 31], [2, 24]], c[3]);
      p.poly([[21, 1], [40, 24], [40, 31], [21, 9]], c[1]);
      for (let y = 0; y < 34; y++) for (let x = 0; x < 42; x++) {
        const col = p.get(x, y);
        if (col !== c[3] && col !== c[1]) continue;
        const left = col === c[3];
        const seam = ((y + (left ? x : -x) * 1.1) % 7 + 7) % 7 < 1;
        p.set(x, y, seam ? c[left ? 2 : 0] : col);
      }
      // front gable
      p.poly([[21, 9], [6, 32], [36, 32]], c[4]);
      for (let y = 10; y < 32; y++) { const half = (y - 9) * 0.66; p.set(Math.round(21 - half), y, c[5]); p.set(Math.round(21 + half), y, c[2]); }
      // entrance with tied-back flaps
      p.poly([[21, 15], [15, 32], [27, 32]], 0x1a1412);
      p.poly([[21, 15], [16, 32], [18, 32]], c[3]);
      p.poly([[21, 15], [26, 32], [24, 32]], c[2]);
      p.set(17, 24, RAMPS.earth[2]); p.set(25, 24, RAMPS.earth[2]);
      // ridge pole tips
      p.set(21, 0, wood[4]); p.set(21, 8, wood[4]); p.set(21, 7, wood[3]);
      // guy ropes + pegs
      p.line(4, 26, 0, 33, RAMPS.straw[2]); p.line(38, 26, 41, 33, RAMPS.straw[1]);
      p.set(0, 34, wood[2]); p.set(41, 34, wood[1]);
    },
  },
  'tent-big-black': {
    w: 66, h: 56, ox: 33, oy: 53,
    footprint: { x: -30, y: -24, w: 60, h: 24 },
    anchors: { door: { x: 0, y: 2 } },
    shadow: [34, 53, 32, 3.5, 0.32],
    draw({ p }) {
      const c = blackCanvas;
      // walls
      for (let y = 28; y < 53; y++) for (let x = 4; x < 62; x++) {
        const k = Math.floor((x - 4) / 7), lx = (x - 4) % 7;
        let i = x < 20 ? 3 : x > 48 ? 1 : 2;
        if (lx === 0) i = 0; else if (lx === 1) i = Math.min(5, i + 1);
        if (hash2(k, 0, 4) > 0.7) i = Math.max(0, i - 1);
        p.set(x, y, c[i]);
      }
      // conical roof
      for (let y = 4; y < 30; y++) {
        const t = (y - 4) / 26;
        const half = 4 + t * 30;
        for (let x = Math.round(33 - half); x <= Math.round(33 + half); x++) {
          const nx = (x - 33) / half;
          let i = nx < -0.35 ? 4 : nx < 0.25 ? 3 : 2;
          if (Math.abs(((x - 33) / (t + 0.15)) % 9) < 1) i = 1; // seams converging on the pole
          p.set(x, y, c[i]);
        }
      }
      // white scalloped valance
      for (let x = 2; x < 64; x++) {
        const sc = (x % 6) < 3 ? 1 : 0;
        p.set(x, 29, RAMPS.white[3]); p.set(x, 30, RAMPS.white[2]); if (sc) p.set(x, 31, RAMPS.white[1]);
        p.set(x, 28, c[0]);
      }
      // entrance
      p.poly([[33, 34], [24, 53], [42, 53]], 0x0a0808);
      p.poly([[33, 34], [24, 53], [27, 53]], c[3]);
      p.poly([[33, 34], [42, 53], [39, 53]], c[1]);
      // warm light inside
      for (let y = 44; y < 53; y++) for (let x = 29; x < 38; x++) if (p.get(x, y) === 0x0a0808 && (x + y) % 2 === 0) p.set(x, y, 0x3a1a0c);
      // pole + pennant (black/white)
      for (let y = 0; y < 6; y++) p.set(33, y, wood[3]);
      for (let x = 34; x < 42; x++) for (let y = 0; y < 4 - Math.floor((x - 34) / 3); y++) p.set(x, y + 1, (x < 38) !== (y < 2) ? RAMPS.white[3] : blackCanvas[1]);
      // stakes & ropes
      p.line(6, 32, 1, 54, RAMPS.straw[1]); p.line(60, 32, 65, 54, RAMPS.straw[1]);
    },
  },
  'palisade-h': {
    w: 16, h: 38, ox: 8, oy: 36,
    footprint: { x: -8, y: -6, w: 16, h: 6 },
    draw({ p }) {
      const logs = [[0, 5, 34], [4, 4, 36], [8, 5, 33], [12, 4, 35]] as const;
      for (const [x0, w, hgt] of logs) {
        const top = 36 - hgt;
        for (let y = top; y < 36; y++) {
          const t = y - top;
          const half = t < 4 ? (t / 4) * (w / 2) : w / 2;
          for (let x = Math.round(x0 + w / 2 - half); x < Math.round(x0 + w / 2 + half); x++) {
            const nx = (x + 0.5 - (x0 + w / 2)) / (w / 2);
            let col = tone(wood, -nx * 0.7 + 0.15, x, y, 1, 5, 0.3);
            if (valueNoise(x * 3, y * 0.4, 2, x0) > 0.75) col = wood[Math.max(0, wood.indexOf(col) - 1)];
            if (t < 2) col = RAMPS.straw[3];
            p.set(x, y, col);
          }
        }
      }
      // binding beams
      for (const y of [10, 28]) for (let x = 0; x < 16; x++) { p.set(x, y, darkwood[4]); p.set(x, y + 1, darkwood[2]); }
    },
  },
  'palisade-v': {
    w: 10, h: 38, ox: 5, oy: 36,
    footprint: { x: -4, y: -16, w: 8, h: 16 },
    draw({ p }) {
      for (let y = 2; y < 36; y++) {
        const t = y - 2;
        const half = t < 4 ? (t / 4) * 3 : 3;
        for (let x = Math.round(5 - half); x < Math.round(5 + half); x++) {
          const nx = (x + 0.5 - 5) / 3;
          p.set(x, y, t < 2 ? RAMPS.straw[3] : tone(wood, -nx * 0.7 + 0.15, x, y, 1, 5, 0.3));
        }
      }
      for (const y of [10, 28]) for (let x = 1; x < 9; x++) { p.set(x, y, darkwood[4]); p.set(x, y + 1, darkwood[2]); }
    },
  },
  'watchtower': {
    w: 44, h: 80, ox: 22, oy: 77,
    footprint: { x: -18, y: -10, w: 36, h: 10 },
    shadow: [23, 77, 20, 3.5, 0.32],
    draw({ p }) {
      // legs
      logPost(p, 6, 30, 77, 3); logPost(p, 35, 30, 77, 3);
      logPost(p, 11, 34, 72, 2); logPost(p, 31, 34, 72, 2);
      // cross bracing
      p.line(8, 40, 35, 74, wood[2]); p.line(35, 40, 8, 74, wood[3]);
      p.line(8, 40, 35, 40, wood[3]);
      // ladder
      for (let y = 34; y < 77; y++) { p.set(18, y, wood[4]); p.set(24, y, wood[2]); }
      for (let y = 36; y < 77; y += 4) for (let x = 19; x < 24; x++) p.set(x, y, wood[3]);
      // platform
      box(p, 3, 26, 38, 4, 3, wood, darkwood, { grain: true });
      // railing
      for (let x = 3; x < 41; x++) { p.set(x, 17, wood[4]); p.set(x, 18, wood[2]); }
      for (const x of [4, 13, 22, 31, 39]) for (let y = 17; y < 27; y++) { p.set(x, y, wood[4]); p.set(x + 1, y, wood[2]); }
      // roof posts + roof
      for (const x of [5, 38]) for (let y = 8; y < 18; y++) { p.set(x, y, wood[3]); }
      for (let y = 0; y < 10; y++) {
        const half = 6 + y * 1.9;
        for (let x = Math.round(22 - half); x < Math.round(22 + half); x++) {
          const left = x < 22;
          const thatch = valueNoise(x * 0.8, y * 2, 2, 5) > 0.6;
          p.set(x, y + 1, RAMPS.straw[(left ? 3 : 1) + (thatch ? 1 : 0)]);
        }
      }
      for (let x = 3; x < 41; x++) if (x % 2) p.set(x, 11, RAMPS.straw[0]);
    },
  },
  'campfire': {
    w: 26, h: 24, ox: 13, oy: 20, frames: 6, fps: 10,
    footprint: { x: -8, y: -5, w: 16, h: 6 },
    light: { radius: 80, color: 0xffa040, flicker: true, offsetY: -6 },
    anchors: { fire: { x: 0, y: -4 } },
    draw({ p, r }) {
      // stone ring (back stones)
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const x = 13 + Math.cos(a) * 9, y = 17 + Math.sin(a) * 4.2;
        rock(p, x, y, 2.4, 1.8, k % 3 ? stone : RAMPS.warmstone, r, k);
      }
      // ash + crossed logs
      p.ellipse(13, 17, 6, 2.6, 0x2a2224);
      for (let i = 0; i < 12; i++) { p.set(7 + i, 18 - Math.floor(i / 3), wood[3]); p.set(7 + i, 19 - Math.floor(i / 3), wood[1]); }
      for (let i = 0; i < 12; i++) { p.set(19 - i, 18 - Math.floor(i / 3), wood[4]); p.set(19 - i, 19 - Math.floor(i / 3), wood[2]); }
    },
    post({ p, f, frames }) {
      glowUnder(p, 13, 15, 12, 0xffa040, 0.22);
      flame(p, 13, 16, 10, 14, f, frames, 17);
      for (let x = 9; x < 18; x++) if (hash2(x, f, 5) > 0.55) p.set(x, 17, RAMPS.fire[hash2(x, f, 6) > 0.5 ? 2 : 1]);
    },
  },
  'firering': {
    w: 26, h: 16, ox: 13, oy: 13,
    footprint: { x: -8, y: -5, w: 16, h: 6 },
    draw({ p, r }) {
      p.ellipse(13, 9, 7, 3, 0x2e2628);
      p.ellipse(12, 8.5, 4, 1.6, 0x463c3c);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        rock(p, 13 + Math.cos(a) * 9, 9 + Math.sin(a) * 4.2, 2.4, 1.8, k % 3 ? stone : RAMPS.warmstone, r, k + 20);
      }
      p.line(9, 9, 15, 7, 0x1a1214); p.line(11, 10, 17, 9, 0x231a1a);
    },
  },
  'cloak-spread': {
    w: 32, h: 22, ox: 16, oy: 18, footprint: null,
    draw({ p }) {
      const g = [0x14261e, 0x1e3a2a, 0x2a5236, 0x386a42, 0x4c8450, 0x68a062] as R;
      p.poly([[3, 6], [29, 4], [31, 19], [1, 20]], g[3]);
      // folds
      for (let y = 4; y < 21; y++) for (let x = 0; x < 32; x++) {
        if (p.get(x, y) !== g[3]) continue;
        const fold = Math.sin(x * 0.55 + y * 0.15);
        p.set(x, y, fold > 0.75 ? g[4] : fold < -0.75 ? g[2] : g[3]);
      }
      // hood bunched at the top left
      p.ellipse(7, 6, 5, 3, g[2]); p.ellipse(6, 5.5, 3, 1.6, g[4]);
      // brass clasp
      p.set(12, 6, RAMPS.gold[4]); p.set(13, 6, RAMPS.gold[2]);
      for (let x = 2; x < 31; x++) if (x % 3 === 0) p.set(x, 20, g[1]);
    },
  },
  'anvil': {
    w: 22, h: 18, ox: 11, oy: 16,
    footprint: { x: -7, y: -4, w: 14, h: 4 },
    shadow: [11, 16, 8, 2, 0.3],
    draw({ p }) {
      // stump
      for (let y = 9; y < 16; y++) for (let x = 6; x < 16; x++) p.set(x, y, tone(wood, -((x - 11) / 5) * 0.7 + 0.1, x, y, 1, 5, 0.3));
      p.ellipse(11, 9, 5, 1.5, RAMPS.straw[3]);
      // anvil body
      for (let x = 1; x < 21; x++) { p.set(x, 3, iron[5]); p.set(x, 4, iron[4]); p.set(x, 5, iron[2]); }
      for (let i = 0; i < 4; i++) { p.set(i, 4 + (i > 1 ? 1 : 0), iron[3]); }
      p.rect(8, 6, 6, 3, iron[2]); p.rect(8, 6, 2, 3, iron[3]);
      p.rect(6, 8, 10, 1, iron[1]);
      p.set(5, 3, 0xffffff);
      // hammer
      p.line(15, 2, 20, 0, wood[3]); p.rect(14, 1, 3, 2, iron[3]);
    },
  },
  'forge': {
    w: 46, h: 42, ox: 23, oy: 40, frames: 6, fps: 8,
    footprint: { x: -21, y: -12, w: 42, h: 12 },
    light: { radius: 70, color: 0xff7a30, flicker: true, offsetY: -14 },
    draw({ p }) {
      // hood + chimney
      for (let y = 0; y < 14; y++) for (let x = 16; x < 30; x++) p.set(x, y, RAMPS.warmstone[x < 20 ? 4 : x > 26 ? 2 : 3]);
      for (let y = 12; y < 22; y++) { const half = 7 + (y - 12) * 1.2; for (let x = Math.round(23 - half); x < Math.round(23 + half); x++) p.set(x, y, RAMPS.warmstone[x < 23 - half / 2 ? 4 : x > 23 + half / 2 ? 2 : 3]); }
      // stone base
      for (let y = 22; y < 40; y++) for (let x = 6; x < 40; x++) {
        const row = Math.floor(y / 4), lx = (x + (row % 2) * 4) % 8;
        let c = RAMPS.warmstone[x < 14 ? 4 : x > 32 ? 2 : 3];
        if (y % 4 === 3 || lx === 0) c = RAMPS.warmstone[1];
        p.set(x, y, c);
      }
      // coal bed
      p.rect(10, 22, 26, 5, 0x1a1010);
      // bellows on the left
      p.poly([[0, 30], [8, 26], [8, 36]], RAMPS.leather[3]);
      for (let y = 28; y < 35; y++) p.set(4, y, RAMPS.leather[1]);
      p.line(0, 30, -1, 30, wood[3]);
      // quench bucket
      p.rect(36, 32, 8, 7, wood[2]); p.rect(36, 32, 8, 1, wood[4]); p.rect(37, 33, 6, 1, RAMPS.water[2]);
    },
    post({ p, f, frames }) {
      for (let x = 11; x < 35; x++) for (let y = 23; y < 27; y++) {
        const h = valueNoise(x, y + f * 0.7, 2.5, 9) + (y - 23) * 0.06;
        p.set(x, y, h > 0.7 ? RAMPS.fire[4] : h > 0.5 ? RAMPS.fire[3] : h > 0.3 ? RAMPS.fire[2] : RAMPS.fire[1]);
      }
      flame(p, 23, 23, 12, 7, f, frames, 21);
      glowUnder(p, 23, 20, 16, 0xff7a30, 0.18);
    },
  },
  'weapon-rack': {
    w: 32, h: 30, ox: 16, oy: 28,
    footprint: { x: -14, y: -5, w: 28, h: 5 },
    shadow: [16, 28, 14, 2, 0.3],
    draw({ p }) {
      // spears
      for (const x of [6, 10, 14]) { for (let y = 3; y < 27; y++) { p.set(x, y, wood[4]); p.set(x + 1, y, wood[2]); } p.set(x, 0, steel[5]); p.set(x, 1, steel[4]); p.set(x + 1, 1, steel[2]); p.set(x, 2, steel[3]); p.set(x + 1, 2, steel[2]); }
      // sword
      for (let y = 4; y < 22; y++) { p.set(19, y, steel[5]); p.set(20, y, steel[3]); }
      p.rect(17, 21, 6, 1, RAMPS.gold[3]); p.rect(19, 22, 2, 3, RAMPS.leather[3]); p.set(19, 25, RAMPS.gold[3]);
      // axe
      for (let y = 6; y < 26; y++) { p.set(25, y, wood[3]); p.set(26, y, wood[1]); }
      p.poly([[22, 6], [27, 5], [29, 12], [24, 11]], steel[3]); p.set(28, 6, steel[5]); p.set(29, 8, steel[5]);
      // frame
      for (let x = 2; x < 30; x++) { p.set(x, 8, darkwood[4]); p.set(x, 9, darkwood[2]); p.set(x, 24, darkwood[4]); p.set(x, 25, darkwood[2]); }
      for (const x of [2, 29]) for (let y = 7; y < 28; y++) { p.set(x, y, darkwood[3]); p.set(x + 1, y, darkwood[1]); }
    },
  },
  'training-dummy': {
    w: 20, h: 32, ox: 10, oy: 30,
    footprint: { x: -3, y: -3, w: 6, h: 3 },
    shadow: [10, 30, 6, 1.8, 0.3],
    draw({ p }) {
      for (let y = 8; y < 31; y++) { p.set(9, y, wood[4]); p.set(10, y, wood[2]); }
      // arms
      for (let x = 2; x < 18; x++) { p.set(x, 12, wood[4]); p.set(x, 13, wood[2]); }
      // straw body
      for (let y = 11; y < 24; y++) for (let x = 5; x < 15; x++) {
        const nx = (x + 0.5 - 10) / 5;
        let c = tone(RAMPS.straw, -nx * 0.6 + 0.1, x, y, 0, 5, 0.4);
        if (valueNoise(x * 0.8, y * 2.2, 2, 3) > 0.7) c = RAMPS.straw[1];
        p.set(x, y, c);
      }
      for (const y of [14, 20]) for (let x = 5; x < 15; x++) p.set(x, y, RAMPS.earth[2]);
      // sack head with painted face
      p.ellipse(10, 6, 4, 4, RAMPS.linen[3]); p.ellipse(9, 5, 2, 2, RAMPS.linen[4]);
      p.set(8, 6, RAMPS.earth[1]); p.set(11, 6, RAMPS.earth[1]); p.hline(8, 11, 8, RAMPS.red[2]);
      // target circle on the chest
      p.set(10, 17, RAMPS.red[3]); p.set(9, 17, RAMPS.red[2]); p.set(10, 16, RAMPS.red[2]); p.set(11, 17, RAMPS.red[2]); p.set(10, 18, RAMPS.red[2]);
    },
  },
  'banner-shadow': {
    w: 18, h: 44, ox: 3, oy: 42, frames: 4, fps: 5,
    footprint: { x: -1, y: -2, w: 2, h: 2 },
    draw({ p, f, frames }) {
      banner(p, f, frames, (x, y) => ((x < 6) !== (y < 11) ? RAMPS.white[3] : RAMPS.black[1]));
    },
  },
  'banner-falcon': {
    w: 18, h: 44, ox: 3, oy: 42, frames: 4, fps: 5,
    footprint: { x: -1, y: -2, w: 2, h: 2 },
    draw({ p, f, frames }) {
      // blue field, yellow border, stylised yellow falcon with spread wings
      const falcon = ['......', '.y..y.', 'yy..yy', 'yyyyyy', '.yyyy.', '..yy..', '..yy..', '.y..y.'];
      banner(p, f, frames, (x, y) => {
        if (x === 0 || y === 0 || y === 1) return RAMPS.yellow[3];
        const fx = x - 3, fy = y - 6;
        if (fx >= 0 && fy >= 0 && fy < falcon.length && fx < 6 && falcon[fy][fx] === 'y') return RAMPS.yellow[4];
        return RAMPS.blue[y > 16 ? 2 : 3];
      });
    },
  },
  'brazier': {
    w: 16, h: 26, ox: 8, oy: 24, frames: 6, fps: 10,
    footprint: { x: -4, y: -3, w: 8, h: 3 },
    light: { radius: 64, color: 0xffa040, flicker: true, offsetY: -16 },
    draw({ p }) {
      // tripod legs
      p.line(4, 24, 7, 13, iron[3]); p.line(12, 24, 9, 13, iron[2]); p.line(8, 24, 8, 13, iron[4]);
      // bowl
      for (let y = 9; y < 14; y++) { const half = 7 - (y - 9) * 0.9; for (let x = Math.round(8 - half); x < Math.round(8 + half); x++) p.set(x, y, iron[x < 6 ? 4 : x > 10 ? 1 : 2]); }
      p.ellipse(8, 9, 7, 1.6, iron[5]);
      p.ellipse(8, 9.2, 5.5, 1, 0x2a1210);
    },
    post({ p, f, frames }) {
      flame(p, 8, 9, 9, 11, f, frames, 31);
      glowUnder(p, 8, 7, 9, 0xffa040, 0.2);
    },
  },
};

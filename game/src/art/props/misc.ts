import { RAMPS } from '../palette';
import type { Px } from '../px';
import { hash2, valueNoise } from '../rng';
import { type PropDef, type R, darkwood, rock, tone, wood } from './core';

const ruin = [0x2a2c30, 0x3e4046, 0x56585e, 0x72737a, 0x8e8f94, 0xb0b0b2] as R;
const marble = [0x4a4c58, 0x6c6e7c, 0x9294a2, 0xb8bac4, 0xd8dae0, 0xf2f2f4] as R;
const steel = RAMPS.steel;

/** Coursed masonry with moss and broken top edge. `topAt(x)` = first row of the wall at column x. */
function masonry(p: Px, x0: number, x1: number, bottom: number, topAt: (x: number) => number, r: R, seed: number): void {
  for (let x = x0; x <= x1; x++) {
    const top = topAt(x);
    for (let y = top; y <= bottom; y++) {
      const row = Math.floor((bottom - y) / 4);
      const lx = (x + (row % 2) * 5) % 10;
      let i = 3 + (hash2(Math.floor((x + (row % 2) * 5) / 10), row, seed) > 0.6 ? 1 : 0);
      if ((bottom - y) % 4 === 3 || lx === 0) i = 1;
      else if ((bottom - y) % 4 === 2) i = Math.min(5, i + 1);
      if (y === top) i = 5;
      if (x === x1) i = Math.min(i, 2);
      if (hash2(x, y, seed + 1) > 0.94) i = Math.max(0, i - 1);
      p.set(x, y, r[i]);
    }
  }
  // moss & ivy
  for (let x = x0; x <= x1; x++) {
    const top = topAt(x);
    for (let y = top; y < top + 3; y++) if (valueNoise(x, y, 3, seed + 3) > 0.5) p.set(x, y, RAMPS.grass[valueNoise(x, y, 2, seed) > 0.5 ? 4 : 3]);
    if (valueNoise(x, 0, 4, seed + 4) > 0.68) {
      const len = 4 + Math.floor(hash2(x, 1, seed) * 8);
      for (let y = top + 2; y < Math.min(bottom, top + len); y++) p.set(x + ((y >> 1) % 2), y, RAMPS.green[(y % 3) ? 3 : 4]);
    }
  }
}

function signBoard(p: Px, x: number, y: number, w: number, dir: 1 | -1): void {
  for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < w; xx++) {
    const tip = dir === 1 ? w - 1 - xx : xx;
    if (tip < Math.abs(2 - yy)) continue;
    let c = wood[yy === 0 ? 5 : yy === 4 ? 2 : 4];
    if (yy === 2 && xx > 2 && xx < w - 3 && (xx % 3)) c = darkwood[2]; // illegible carved letters
    p.set(x + xx, y + yy, c);
  }
}

export const MISC: Record<string, PropDef> = {
  'ruin-wall': {
    w: 50, h: 38, ox: 25, oy: 36, variants: 2,
    footprint: { x: -24, y: -8, w: 48, h: 8 },
    shadow: [25, 36, 24, 2.5, 0.3],
    draw({ p, r, v }) {
      const tops = (x: number) => Math.round(6 + valueNoise(x, 0, 6, 11 + v) * 14 + (x > 30 && v ? 8 : 0));
      masonry(p, 1, 48, 35, tops, ruin, 7 + v);
      // fallen blocks
      rock(p, 44, 34, 3.5, 2, ruin, r, 3);
      p.rect(5, 31, 5, 4, ruin[3]); p.rect(5, 31, 5, 1, ruin[5]);
    },
  },
  'ruin-arch': {
    w: 50, h: 60, ox: 25, oy: 58,
    footprint: { x: -24, y: -6, w: 48, h: 6 },
    shadow: [25, 58, 24, 2.5, 0.3],
    draw({ p }) {
      // left & right piers
      masonry(p, 2, 11, 57, x => (x < 6 ? 12 : 10), ruin, 21);
      masonry(p, 38, 47, 57, x => (x > 44 ? 26 : 24), ruin, 22);
      // arch (broken on the right)
      for (let a = 0; a <= 120; a++) {
        const t = (Math.PI * a) / 180;
        for (let rr = 0; rr < 6; rr++) {
          const R0 = 18 + rr;
          const x = Math.round(25 - Math.cos(t) * R0), y = Math.round(28 - Math.sin(t) * R0 * 0.9);
          const seg = Math.floor(a / 12);
          let c = ruin[3 + (seg % 2)];
          if (a % 12 === 0) c = ruin[1];
          if (rr === 5) c = ruin[5];
          if (rr === 0) c = ruin[2];
          p.set(x, y, c);
        }
      }
      // keystone-ish rubble on the ground
      p.rect(28, 54, 6, 4, ruin[3]); p.rect(28, 54, 6, 1, ruin[5]); p.rect(35, 56, 3, 2, ruin[2]);
    },
  },
  'ruin-pillar': {
    w: 18, h: 44, ox: 9, oy: 42, variants: 2,
    footprint: { x: -6, y: -5, w: 12, h: 5 },
    shadow: [9, 42, 8, 2, 0.3],
    draw({ p, v }) {
      const top = v ? 16 : 6;
      // base
      for (let x = 1; x < 17; x++) for (let y = 37; y < 42; y++) p.set(x, y, marble[y === 37 ? 5 : x < 5 ? 4 : x > 13 ? 2 : 3]);
      // fluted shaft
      for (let y = top; y < 37; y++) for (let x = 3; x < 15; x++) {
        const nx = (x + 0.5 - 9) / 6;
        let c = tone(marble, -nx * 0.7 + 0.2, x, y, 1, 5, 0.25);
        if ((x - 3) % 3 === 2) c = marble[Math.max(1, marble.indexOf(c) - 1)];
        p.set(x, y, c);
      }
      // jagged broken top
      for (let x = 3; x < 15; x++) { const cut = Math.round(hash2(x, v, 3) * 3); for (let y = top; y < top + cut; y++) p.clear(x, y); p.set(x, top + cut, marble[5]); }
      // crack
      for (let y = top + 6; y < top + 16; y++) p.set(8 + (y % 3 === 0 ? 1 : 0), y, marble[1]);
      if (!v) for (let x = 2; x < 16; x++) p.set(x, top - 1, marble[4]);
    },
  },
  'signpost': {
    w: 24, h: 32, ox: 12, oy: 30, variants: 2,
    footprint: { x: -2, y: -2, w: 4, h: 2 },
    shadow: [12, 30, 4, 1.4, 0.3],
    draw({ p, v }) {
      for (let y = 2; y < 31; y++) { p.set(11, y, wood[4]); p.set(12, y, wood[2]); }
      p.set(11, 1, wood[5]); p.set(12, 1, wood[3]);
      signBoard(p, 13, 4, 11, 1);
      if (v === 0) signBoard(p, 0, 11, 11, -1);
      // grass tuft at the foot
      p.set(9, 30, RAMPS.grass[3]); p.set(10, 29, RAMPS.grass[4]); p.set(14, 30, RAMPS.grass[3]);
    },
  },
  'grave-cairn': {
    w: 26, h: 20, ox: 13, oy: 17, variants: 2,
    footprint: { x: -10, y: -6, w: 20, h: 6 },
    shadow: [13, 17, 12, 2.5, 0.3],
    draw({ p, r, v }) {
      const st = [[5, 15, 3.5, 2.4], [12, 16, 4, 2.6], [19, 15, 3.5, 2.4], [8, 12, 3.4, 2.4], [16, 12, 3.4, 2.4], [12, 8.5, 3.2, 2.4], [12, 5, 2.4, 2]] as const;
      st.forEach(([x, y, rx, ry], i) => rock(p, x, y, rx, ry, i % 2 ? RAMPS.stone : RAMPS.warmstone, r, i + 50));
      if (v === 1) {
        // cornflowers laid on the cairn
        const cf = RAMPS.cornflower;
        for (const [x, y] of [[9, 15], [11, 16], [13, 15], [15, 16]] as const) {
          p.set(x, y, cf[3]); p.set(x + 1, y, cf[2]); p.set(x, y - 1, cf[4]);
          p.set(x - 1, y + 1, RAMPS.grass[3]); p.set(x - 2, y + 2, RAMPS.grass[2]);
        }
      }
    },
  },
  'council-seat': {
    w: 26, h: 34, ox: 13, oy: 32, variants: 4,
    footprint: { x: -10, y: -8, w: 20, h: 8 },
    anchors: { sit: { x: 0, y: -6 } },
    shadow: [13, 32, 12, 2, 0.3],
    draw({ p, v }) {
      const trim = [RAMPS.gold, RAMPS.cornflower, RAMPS.red, RAMPS.green][v];
      const cushion = [RAMPS.blue, RAMPS.blue, RAMPS.red, RAMPS.green][v];
      // high carved back
      for (let y = 0; y < 22; y++) {
        const half = y < 4 ? 6 + y : 10;
        for (let x = Math.round(13 - half); x < Math.round(13 + half); x++) {
          const nx = (x + 0.5 - 13) / half;
          let c = tone(marble, -nx * 0.5 + 0.2 - y * 0.01, x, y, 1, 5, 0.25);
          if (Math.abs(x - 13) === 6 && y > 4) c = marble[1];
          p.set(x, y, c);
        }
      }
      // pointed crest + sigil
      p.set(13, 0, trim[4]); p.set(12, 1, trim[3]); p.set(13, 1, trim[4]); p.set(14, 1, trim[2]);
      p.set(13, 8, trim[4]); p.set(12, 9, trim[3]); p.set(14, 9, trim[3]); p.set(13, 10, trim[2]); p.set(13, 9, trim[4]);
      // arms + seat
      for (let y = 16; y < 30; y++) for (const x0 of [1, 21]) for (let x = x0; x < x0 + 4; x++) p.set(x, y, marble[x0 === 1 ? (x === 1 ? 4 : 3) : (x === 24 ? 1 : 2)]);
      for (let y = 18; y < 23; y++) for (let x = 5; x < 21; x++) p.set(x, y, cushion[y === 18 ? 4 : y > 21 ? 1 : 3]);
      for (let y = 23; y < 31; y++) for (let x = 5; x < 21; x++) p.set(x, y, marble[y === 23 ? 5 : 2]);
      for (let x = 1; x < 25; x++) { p.set(x, 15, trim[3]); p.set(x, 30, marble[1]); p.set(x, 31, marble[0]); }
    },
  },
  'council-table': {
    w: 62, h: 42, ox: 31, oy: 40,
    footprint: { x: -28, y: -16, w: 56, h: 16 },
    shadow: [31, 40, 30, 3, 0.32],
    draw({ p }) {
      // thick round stone table in 3/4 view
      p.ellipse(31, 22, 30, 15, marble[1]);
      for (let x = 1; x < 61; x++) {
        const nx = (x + 0.5 - 31) / 30;
        const e = Math.sqrt(Math.max(0, 1 - nx * nx)) * 14;
        for (let y = Math.round(18 + e); y <= Math.round(25 + e); y++) p.set(x, y, tone(marble, -nx * 0.6, x, y, 1, 3, 0.3));
      }
      p.ellipse(31, 18, 30, 14, marble[4]);
      p.ellipse(31, 18, 27, 12, marble[3]);
      // inlaid gold ring + eight-pointed star sigil
      for (let a = 0; a < 200; a++) { const t = (a / 200) * Math.PI * 2; p.set(Math.round(31 + Math.cos(t) * 22), Math.round(18 + Math.sin(t) * 9.6), RAMPS.gold[3]); }
      for (let k = 0; k < 8; k++) {
        const t = (k / 8) * Math.PI * 2;
        const len = k % 2 ? 9 : 16;
        for (let i = 0; i < len; i++) {
          const x = Math.round(31 + Math.cos(t) * i), y = Math.round(18 + Math.sin(t) * i * 0.45);
          p.set(x, y, i < 3 ? RAMPS.urmacht[4] : k % 2 ? RAMPS.gold[2] : RAMPS.gold[4]);
        }
      }
      p.ellipse(31, 18, 3, 1.5, RAMPS.urmacht[3]); p.set(30, 18, RAMPS.urmacht[5]);
      // highlight on the rim
      for (let x = 8; x < 26; x++) p.set(x, 7 + Math.round(((x - 17) / 9) ** 2 * 2), marble[5]);
    },
  },
  'fallen-banner': {
    w: 36, h: 16, ox: 18, oy: 13, footprint: null,
    draw({ p }) {
      p.line(1, 12, 33, 3, wood[3]); p.line(1, 13, 33, 4, wood[1]);
      p.set(34, 2, RAMPS.gold[4]); p.set(35, 2, RAMPS.gold[2]);
      // torn blue-white cloth with white raptor wing
      for (let x = 8; x < 30; x++) {
        const y0 = 13 - Math.round((x - 1) * 0.28);
        const len = 6 + Math.round(Math.sin(x * 0.9) * 1.5) - (x > 24 ? x - 24 : 0);
        for (let y = 0; y < len; y++) {
          let c = (x + y) % 9 < 5 ? RAMPS.blue[3] : RAMPS.white[3];
          if (y === len - 1) c = RAMPS.blue[1];
          if (x > 14 && x < 20 && y > 1 && y < 4) c = RAMPS.white[4];
          p.set(x, y0 + y + 1, c);
        }
      }
      p.set(22, 11, 0x5a1a1a); p.set(23, 11, 0x5a1a1a); // dirt stain
    },
  },
  'broken-spear': {
    w: 24, h: 12, ox: 12, oy: 9, footprint: null,
    draw({ p }) {
      p.line(1, 9, 10, 6, wood[3]); p.line(1, 10, 10, 7, wood[1]);
      p.line(13, 8, 19, 4, wood[4]); p.line(13, 9, 19, 5, wood[2]);
      // splinters
      p.set(11, 6, RAMPS.straw[3]); p.set(12, 8, RAMPS.straw[3]);
      // head
      p.poly([[19, 3], [23, 1], [21, 5]], steel[4]); p.set(22, 1, steel[6]); p.set(20, 5, steel[2]);
    },
  },
  'shield-on-ground': {
    w: 18, h: 13, ox: 9, oy: 10, variants: 2, footprint: null,
    shadow: [9, 10, 8, 2.5, 0.3],
    draw({ p, v }) {
      p.ellipse(9, 6, 8, 4.5, v ? RAMPS.blue[3] : RAMPS.black[2]);
      for (let y = 1; y < 11; y++) for (let x = 1; x < 17; x++) {
        const c = p.get(x, y);
        if (c < 0) continue;
        if (v === 0 && ((x < 9) !== (y < 6))) p.set(x, y, RAMPS.white[3]);
        if (v === 1 && Math.abs(x - 9) < 2) p.set(x, y, RAMPS.white[3]);
      }
      // rim + boss
      for (let a = 0; a < 60; a++) { const t = (a / 60) * Math.PI * 2; p.set(Math.round(9 + Math.cos(t) * 7.6), Math.round(6 + Math.sin(t) * 4.2), a > 25 && a < 50 ? steel[2] : steel[4]); }
      p.set(9, 6, steel[5]); p.set(10, 6, steel[3]); p.set(9, 7, steel[2]);
      p.line(12, 3, 14, 5, 0x2a1a1a); // dent
    },
  },
};

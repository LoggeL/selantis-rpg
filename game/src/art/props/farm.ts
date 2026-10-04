import { RAMPS, mix } from '../palette';
import type { Px } from '../px';
import { hash2, valueNoise } from '../rng';
import { type DrawCtx, type PropDef, type R, box, cylinder, darkwood, planks, tone, wood } from './core';

const plaster = [0x6e6058, 0x9a8b7c, 0xc8b9a2, 0xe6dac2, 0xf6eedc] as R;
const beam = darkwood;
const roofTile = [0x2e1414, 0x4e1e1a, 0x74301f, 0x9a4428, 0xbc5e34, 0xd8824c] as R;
const shingle = [0x221a1e, 0x362a2c, 0x4c3c38, 0x665046, 0x82685a, 0x9e8470] as R;
const barnWall = [0x2a1212, 0x4a1c18, 0x6e2a20, 0x8e3a28, 0xae5034, 0xc66a44] as R;
const stone = RAMPS.warmstone;
const glassDay = [0x1c2438, 0x2c3c5c, 0x4a6488, 0x7ea0c0, 0xbcd8ea] as R;
const glow = [0x7a3a10, 0xc0681c, 0xf0a038, 0xfcd270, 0xfff2c0] as R;
const shutterBlue = [0x14223a, 0x1e3456, 0x2c4c78, 0x40689a, 0x5c88b8] as R;
const shutterGreen = [0x14261e, 0x1e3a2a, 0x2c5438, 0x3e6e46, 0x58905a] as R;

// ------------------------------------------------------------------------------------------
// Building parts
// ------------------------------------------------------------------------------------------

/** Rows of clay tiles with scalloped edges, lit from the left. */
function tileRoof(p: Px, x0: number, y0: number, w: number, h: number, r: R, seed: number, rowH = 4, tileW = 5): void {
  for (let y = y0; y < y0 + h; y++) {
    const row = Math.floor((y - y0) / rowH), ly = (y - y0) - row * rowH;
    const off = (row % 2) * Math.floor(tileW / 2);
    for (let x = x0; x < x0 + w; x++) {
      const lx = ((x - x0 + off) % tileW + tileW) % tileW;
      const across = (x - x0) / w; // 0 = left (lit) … 1 = right (shade)
      let i = across < 0.3 ? 4 : across < 0.75 ? 3 : 2;
      if (hash2(Math.floor((x - x0 + off) / tileW), row, seed) > 0.8) i -= 1;
      if (ly === rowH - 1) i = lx === 0 || lx === tileW - 1 ? 0 : 1; // shadow under the tile lip
      else if (ly === 0) i += 1;
      else if (lx === 0) i -= 1;
      if (ly === rowH - 2 && (lx === 0 || lx === tileW - 1)) i = 1;
      p.set(x, y, r[Math.max(0, Math.min(r.length - 1, i))]);
    }
  }
}

/** Half-timbered wall: plaster panels framed by dark beams with diagonal braces. */
function timberWall(p: Px, x0: number, y0: number, w: number, h: number, seed: number, bays: number[], lowerBraces = true): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const n = valueNoise(x, y, 4, seed);
    let c = n > 0.66 ? plaster[4] : n < 0.28 ? plaster[2] : plaster[3];
    if (hash2(x, y, seed) > 0.97) c = plaster[2];
    p.set(x, y, c);
  }
  const bm = (x: number, y: number, light: boolean) => p.set(x, y, light ? beam[4] : beam[2]);
  // sill, mid rail and top plate
  for (let x = x0; x < x0 + w; x++) {
    bm(x, y0, true); bm(x, y0 + 1, false);
    bm(x, y0 + h - 2, true); bm(x, y0 + h - 1, false);
    const mid = y0 + Math.floor(h * 0.5);
    bm(x, mid, true); bm(x, mid + 1, false);
  }
  // posts
  for (const bx of bays) for (let y = y0; y < y0 + h; y++) { bm(x0 + bx, y, true); bm(x0 + bx + 1, y, false); }
  // braces in the lower panels (K-bracing)
  const mid = y0 + Math.floor(h * 0.5);
  for (let i = 0; i + 1 < bays.length; i++) {
    const a = x0 + bays[i] + 2, b = x0 + bays[i + 1] - 1;
    if (!lowerBraces || b - a < 6 || hash2(i, 0, seed) > 0.6) continue;
    const toRight = i % 2 === 0;
    for (let y = mid + 2; y < y0 + h - 2; y++) {
      const t = (y - (mid + 2)) / Math.max(1, (y0 + h - 3) - (mid + 2));
      const x = Math.round(toRight ? a + t * (b - a) : b - t * (b - a));
      bm(x, y, true); bm(x + 1, y, false);
    }
  }
  // upper panels: crossed braces in some bays
  for (let i = 0; i + 1 < bays.length; i++) {
    const a = x0 + bays[i] + 2, b = x0 + bays[i + 1] - 1;
    if (b - a < 6) continue;
    for (let y = y0 + 2; y < mid; y++) {
      const t = (y - (y0 + 2)) / Math.max(1, mid - 1 - (y0 + 2));
      bm(Math.round(a + t * (b - a)), y, true);
      bm(Math.round(b - t * (b - a)), y, false);
    }
  }
}

function stonePlinth(p: Px, x0: number, y0: number, w: number, h: number, seed: number): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const row = Math.floor((y - y0) / 3);
    const lx = (x - x0 + row * 3) % 7;
    let c = stone[3 + (hash2(Math.floor((x - x0 + row * 3) / 7), row, seed) > 0.5 ? 1 : 0)];
    if ((y - y0) % 3 === 2 || lx === 0) c = stone[1];
    else if ((y - y0) % 3 === 0) c = stone[5];
    p.set(x, y, c);
  }
}

function windowFrame(p: Px, x: number, y: number, w: number, h: number, lit: boolean, shutters: R | null, flowers = true): void {
  // frame
  p.rect(x - 1, y - 1, w + 2, h + 2, beam[1]);
  const g = lit ? glow : glassDay;
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const diag = (xx + yy) % 6 < 2 && !lit;
    let c = lit ? (yy < h / 2 ? g[3] : g[2]) : (diag ? g[3] : yy < 2 ? g[1] : g[2]);
    if (lit && hash2(xx, yy, 3) > 0.85) c = g[4];
    p.set(x + xx, y + yy, c);
  }
  // mullions
  const mx = x + Math.floor(w / 2), my = y + Math.floor(h / 2);
  for (let yy = 0; yy < h; yy++) p.set(mx, y + yy, beam[3]);
  for (let xx = 0; xx < w; xx++) p.set(x + xx, my, beam[3]);
  // sill
  for (let xx = -2; xx < w + 2; xx++) { p.set(x + xx, y + h + 1, beam[4]); p.set(x + xx, y + h + 2, beam[1]); }
  if (shutters) {
    for (const sx of [x - 5, x + w + 1]) {
      for (let yy = -1; yy < h + 1; yy++) for (let xx = 0; xx < 4; xx++) {
        let c = shutters[xx === 0 ? 4 : xx === 3 ? 1 : 3];
        if (yy === -1 || yy === h) c = shutters[2];
        if ((yy + 1) % 3 === 0 && xx > 0 && xx < 3) c = shutters[2];
        p.set(sx + xx, y + yy, c);
      }
    }
  }
  if (flowers) {
    // flower box
    for (let xx = -1; xx < w + 1; xx++) { p.set(x + xx, y + h + 3, wood[3]); p.set(x + xx, y + h + 4, wood[2]); p.set(x + xx, y + h + 5, wood[1]); }
    for (let xx = -1; xx < w + 1; xx++) {
      const f = hash2(xx, y, 7);
      p.set(x + xx, y + h + 2, f > 0.5 ? RAMPS.grass[3] : RAMPS.grass[2]);
      if (f > 0.62) p.set(x + xx, y + h + 1, f > 0.82 ? RAMPS.red[4] : RAMPS.pink[3]);
    }
  }
}

function door(p: Px, x: number, y: number, w: number, h: number, r: R = wood): void {
  // stone step + frame
  p.rect(x - 2, y - 2, w + 4, h + 2, beam[1]);
  p.rect(x - 1, y - 1, w + 2, 1, beam[3]);
  planks(p, x, y, w, h, r, true, 3, 9);
  // arch-ish top
  p.set(x, y, beam[1]); p.set(x + w - 1, y, beam[1]);
  // iron bands + handle
  for (const by of [y + 3, y + h - 4]) for (let xx = 0; xx < w; xx++) p.set(x + xx, by, RAMPS.iron[3]);
  p.set(x + w - 3, y + Math.floor(h / 2), RAMPS.gold[3]); p.set(x + w - 3, y + Math.floor(h / 2) + 1, RAMPS.gold[1]);
  for (let xx = -3; xx < w + 3; xx++) { p.set(x + xx, y + h, stone[4]); p.set(x + xx, y + h + 1, stone[2]); }
}

function chimney(p: Px, x: number, y: number, w: number, h: number): void {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const row = Math.floor(yy / 3);
    const lx = (xx + row * 2) % 5;
    let c = stone[xx < w / 2 ? 4 : 3];
    if (yy % 3 === 2 || lx === 0) c = stone[1];
    p.set(x + xx, y + yy, c);
  }
  p.rect(x - 1, y - 2, w + 2, 2, stone[5]);
  p.rect(x, y, w, 1, stone[0]);
  p.rect(x + 1, y - 2, w - 2, 1, 0x18100e);
}

function house(c: DrawCtx, lit: boolean): void {
  const { p } = c;
  const W = 88;
  const wallTop = 54, wallH = 30;
  // walls
  timberWall(p, 6, wallTop, W - 12, wallH, 5, [0, 27, 47, 74], false);
  stonePlinth(p, 5, wallTop + wallH, W - 10, 4, 7);
  // roof (overhanging eaves)
  tileRoof(p, 2, 10, W - 4, 44, roofTile, 11);
  // ridge cap
  for (let x = 2; x < W - 2; x++) { p.set(x, 8, roofTile[3]); p.set(x, 9, roofTile[1]); p.set(x, 7, roofTile[4]); }
  // eave board + shadow on wall
  for (let x = 2; x < W - 2; x++) { p.set(x, 54, beam[3]); p.set(x, 55, beam[1]); }
  for (let x = 6; x < W - 6; x++) { p.set(x, 56, mix(p.get(x, 56), 0x1a1220, 0.5)); p.set(x, 57, mix(p.get(x, 57), 0x1a1220, 0.25)); }
  // roof side edges (bargeboards)
  for (let y = 7; y < 56; y++) { p.set(2, y, beam[3]); p.set(3, y, beam[2]); p.set(W - 3, y, beam[1]); p.set(W - 4, y, beam[2]); }
  chimney(p, 64, 0, 8, 16);
  // little dormer window in the roof
  p.rect(20, 22, 14, 12, roofTile[1]);
  windowFrame(p, 23, 25, 8, 6, lit, null, false);
  for (let x = 18; x < 36; x++) { p.set(x, 21, roofTile[4]); p.set(x, 20, roofTile[3]); }
  door(p, 38, 66, 12, 18);
  windowFrame(p, 14, 63, 10, 9, lit, shutterBlue);
  windowFrame(p, 62, 63, 10, 9, lit, shutterBlue);
  // moss and a few odd tiles on the roof
  for (let i = 0; i < 18; i++) { const x = 6 + Math.floor(hash2(i, 1, 9) * 76), y = 14 + Math.floor(hash2(i, 2, 9) * 36); if (p.get(x, y) >= 0 && !(x > 18 && x < 37 && y > 18 && y < 35) && !(x > 62 && x < 74 && y < 18)) { p.set(x, y, RAMPS.olive[3]); p.set(x + 1, y, RAMPS.olive[2]); } }
  if (lit) {
    // warm light spill on the ground under the windows
    for (const wx of [19, 67]) for (let y = 84; y < 92; y++) for (let x = wx - 6; x < wx + 6; x++) if (p.alpha(x, y) === 0 && (x + y) % 2 === 0) p.blend(x, y, glow[3], 0.25);
  }
}

function barn(c: DrawCtx): void {
  const { p } = c;
  // roof slopes (front-gable seen from above)
  const apexX = 52, apexY = 30;
  p.poly([[apexX, 0], [apexX, apexY], [0, 70], [0, 40]], shingle[3]);
  p.poly([[apexX, 0], [104, 40], [104, 70], [apexX, apexY]], shingle[2]);
  // shingle rows
  for (let y = 0; y < 72; y++) for (let x = 0; x < 104; x++) {
    const col = p.get(x, y);
    if (col !== shingle[3] && col !== shingle[2]) continue;
    const left = x < apexX;
    const along = left ? (y - (apexY - (apexX - x) * (40 / 52))) : (y - (apexY - (x - apexX) * (40 / 52)));
    const row = Math.floor((y + (left ? x : -x) * 0.77) / 4);
    const lr = ((y + (left ? x : -x) * 0.77) % 4 + 4) % 4;
    let i = left ? 4 : 2;
    if (lr < 1) i = left ? 2 : 1;
    if (hash2(Math.floor(x / 4), row, 21) > 0.8) i -= 1;
    void along;
    p.set(x, y, shingle[Math.max(0, i)]);
  }
  // ridge line
  for (let y = 0; y < apexY; y++) { p.set(apexX - 1, y, shingle[5]); p.set(apexX, y, shingle[1]); }
  // front wall
  planks(p, 6, 64, 92, 34, barnWall, true, 4, 23);
  // gable triangle
  for (let y = 32; y < 64; y++) {
    const half = ((y - 32) / 32) * 44;
    for (let x = Math.round(apexX - half); x < Math.round(apexX + half); x++) {
      const k = Math.floor(x / 4), lx = x - k * 4;
      let i = 3 + (hash2(k, 0, 22) > 0.6 ? 1 : 0);
      if (lx === 0) i = 1; else if (lx === 1) i++;
      p.set(x, y, barnWall[Math.min(5, i)]);
    }
  }
  // bargeboards along the gable
  for (let y = 30; y < 66; y++) {
    const half = ((y - 30) / 34) * 50;
    const xl = Math.round(apexX - half), xr = Math.round(apexX + half);
    p.set(xl, y, beam[4]); p.set(xl + 1, y, beam[2]); p.set(xr, y, beam[1]); p.set(xr - 1, y, beam[2]);
  }
  // eave line
  for (let x = 4; x < 100; x++) { p.set(x, 64, beam[3]); p.set(x, 65, beam[1]); p.set(x, 66, mix(p.get(x, 66), 0x1a1220, 0.45)); }
  // hayloft door with hay
  p.rect(44, 42, 16, 14, beam[1]);
  p.rect(45, 43, 14, 12, 0x1c1210);
  for (let x = 45; x < 59; x++) for (let y = 49; y < 55; y++) if (hash2(x, y, 3) > 0.25) p.set(x, y, RAMPS.straw[2 + Math.floor(hash2(x, y, 4) * 3)]);
  for (let x = 43; x < 61; x++) p.set(x, 41, beam[4]);
  // big double door with X braces (white trim)
  const dx = 34, dy = 70, dw = 36, dh = 28;
  p.rect(dx - 2, dy - 2, dw + 4, dh + 2, beam[1]);
  planks(p, dx, dy, dw, dh, barnWall, true, 3, 24);
  const trim = RAMPS.cream;
  for (const [ax, bw] of [[dx, dw / 2], [dx + dw / 2, dw / 2]] as const) {
    for (let i = 0; i < bw; i++) {
      const t = i / (bw - 1);
      p.set(Math.round(ax + i), Math.round(dy + t * (dh - 1)), trim[3]);
      p.set(Math.round(ax + i), Math.round(dy + (1 - t) * (dh - 1)), trim[3]);
    }
    for (let y = dy; y < dy + dh; y++) { p.set(ax, y, trim[4]); p.set(ax + bw - 1, y, trim[2]); }
    for (let x = ax; x < ax + bw; x++) { p.set(x, dy, trim[4]); p.set(x, dy + dh - 1, trim[2]); }
  }
  // stone foundation
  stonePlinth(p, 5, 98, 94, 3, 9);
  // hay bale by the wall
  for (let x = 10; x < 24; x++) for (let y = 88; y < 98; y++) p.set(x, y, (y === 88) ? RAMPS.straw[4] : (x + y * 2) % 5 === 0 ? RAMPS.straw[1] : RAMPS.straw[y < 92 ? 3 : 2]);
  for (let y = 88; y < 98; y++) { p.set(14, y, RAMPS.earth[2]); p.set(20, y, RAMPS.earth[2]); }
}

function fenceRail(p: Px, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x++) { p.set(x, y, wood[4]); p.set(x, y + 1, wood[2]); }
}
function fencePost(p: Px, x: number, top: number, bottom: number): void {
  for (let y = top; y <= bottom; y++) { p.set(x, y, wood[4]); p.set(x + 1, y, wood[3]); p.set(x + 2, y, wood[1]); }
  p.set(x, top, wood[5]); p.set(x + 1, top, wood[4]); p.set(x + 1, top - 1, wood[3]);
}

export const FARM: Record<string, PropDef> = {
  'house-farm': {
    w: 88, h: 92, ox: 44, oy: 88, shadow: [45, 88, 44, 4, 0.3],
    footprint: { x: -40, y: -64, w: 80, h: 64 },
    anchors: { door: { x: 0, y: 2 }, smoke: { x: 24, y: -90 } },
    draw: c => house(c, false),
  },
  'house-farm-night': {
    w: 88, h: 92, ox: 44, oy: 88, shadow: [45, 88, 44, 4, 0.3],
    footprint: { x: -40, y: -64, w: 80, h: 64 },
    anchors: { door: { x: 0, y: 2 }, smoke: { x: 24, y: -90 } },
    light: { radius: 54, color: 0xffc46a, flicker: true, offsetY: -14 },
    lights: [
      { x: -25, y: -20, radius: 34, color: 0xffc46a, flicker: true },
      { x: 23, y: -20, radius: 34, color: 0xffc46a, flicker: true },
      { x: -17, y: -59, radius: 22, color: 0xffc46a },
    ],
    draw: c => house(c, true),
  },
  'barn': {
    w: 104, h: 104, ox: 52, oy: 101, shadow: [53, 101, 50, 4, 0.3],
    footprint: { x: -48, y: -72, w: 96, h: 72 },
    anchors: { door: { x: 0, y: 2 } },
    draw: barn,
  },
  'well': {
    w: 30, h: 40, ox: 15, oy: 36,
    footprint: { x: -11, y: -9, w: 22, h: 10 },
    shadow: [16, 36, 13, 3.5, 0.3],
    draw({ p }) {
      // posts
      for (const x of [4, 24]) for (let y = 6; y < 30; y++) { p.set(x, y, wood[4]); p.set(x + 1, y, wood[2]); }
      // stone ring
      for (let x = 3; x < 27; x++) {
        const nx = (x + 0.5 - 15) / 12;
        const e = Math.sqrt(Math.max(0, 1 - nx * nx)) * 5;
        for (let y = Math.round(22 - e); y <= Math.round(32 + e); y++) {
          const row = Math.floor((y - 17) / 3), lx = (x + row * 3) % 6;
          let c = tone(stone, -nx * 0.6 + 0.2, x, y, 2, 5, 0.3);
          if ((y - 17) % 3 === 2 || lx === 0) c = stone[1];
          p.set(x, y, c);
        }
      }
      p.ellipse(15, 22, 12, 5, stone[4]);
      p.ellipse(15, 22.5, 9.5, 3.5, 0x101828);
      p.ellipse(15, 23.5, 7, 2, RAMPS.water[1]);
      p.set(12, 23, RAMPS.water[4]); p.set(13, 23, RAMPS.water[3]);
      // roof
      for (let y = 0; y < 8; y++) {
        const half = 4 + y * 1.6;
        for (let x = Math.round(15 - half); x < Math.round(15 + half); x++) {
          const left = x < 15;
          p.set(x, y + 1, (y % 2 === 0) ? roofTile[left ? 4 : 2] : roofTile[left ? 3 : 1]);
        }
      }
      // crank beam, rope and bucket
      for (let x = 4; x < 27; x++) { p.set(x, 11, wood[3]); p.set(x, 12, wood[1]); }
      for (let y = 13; y < 19; y++) p.set(15, y, RAMPS.straw[3]);
      cylinder(p, 15, 18, 2.5, 1.2, 3, wood, { open: true, bands: [1], bandRamp: RAMPS.iron });
      p.set(27, 11, RAMPS.iron[4]); p.set(28, 12, RAMPS.iron[3]); p.set(28, 13, RAMPS.iron[2]);
    },
  },
  'pigpen': {
    w: 56, h: 42, ox: 28, oy: 39,
    footprint: { x: -27, y: -34, w: 54, h: 35 },
    draw({ p }) {
      // muddy ground inside
      for (let y = 8; y < 38; y++) for (let x = 3; x < 53; x++) {
        const n = valueNoise(x, y, 5, 3);
        let c = n > 0.6 ? RAMPS.mud[3] : n < 0.3 ? RAMPS.mud[1] : RAMPS.mud[2];
        if (n > 0.72 && hash2(x, y, 1) > 0.7) c = RAMPS.mud[4];
        p.set(x, y, c);
      }
      // trough
      box(p, 34, 12, 14, 3, 4, wood, darkwood);
      for (let x = 35; x < 47; x++) p.set(x, 13, RAMPS.straw[3]);
      // fences: back rail, sides, front with rails
      for (const y of [6, 9]) fenceRail(p, 2, 53, y);
      for (const y of [32, 35]) fenceRail(p, 2, 53, y);
      for (let y = 4; y < 38; y++) { p.set(2, y, wood[3]); p.set(3, y, wood[1]); p.set(52, y, wood[3]); p.set(53, y, wood[1]); }
      for (const x of [1, 14, 27, 40, 52]) { fencePost(p, x, 3, 11); fencePost(p, x, 29, 38); }
    },
  },
  'haystack': {
    w: 32, h: 28, ox: 16, oy: 25,
    footprint: { x: -13, y: -8, w: 26, h: 9 },
    shadow: [16, 25, 15, 3.5, 0.32],
    draw({ p }) {
      for (let y = 2; y < 26; y++) for (let x = 1; x < 31; x++) {
        const nx = (x + 0.5 - 16) / 15, ny = (y + 0.5 - 18) / 16;
        if (nx * nx + (ny < 0 ? ny * ny : 0) > 1 || y > 25) continue;
        if (ny < 0 && nx * nx + ny * ny > 1) continue;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - (ny < 0 ? ny * ny : 0)));
        let c = tone(RAMPS.straw, -nx * 0.5 - (ny < 0 ? ny : 0) * 0.5 + nz * 0.3, x, y, 0, 5, 0.4);
        const strand = valueNoise(x * 0.7, y * 2.5, 2, 7);
        if (strand > 0.7) c = RAMPS.straw[Math.max(0, RAMPS.straw.indexOf(c as never) - 1)] ?? c;
        p.set(x, y, c);
      }
      // loose straws
      for (let i = 0; i < 6; i++) { const x = 4 + i * 4; p.set(x, 25, RAMPS.straw[3]); p.set(x + 1, 26, RAMPS.straw[2]); }
      p.set(16, 1, RAMPS.straw[4]); p.set(17, 0, RAMPS.straw[3]);
    },
  },
  'cart': {
    w: 46, h: 32, ox: 23, oy: 29,
    footprint: { x: -18, y: -10, w: 36, h: 11 },
    shadow: [24, 29, 20, 3.5, 0.32],
    draw({ p }) {
      // shafts
      for (let x = 0; x < 12; x++) { p.set(x, 17 + Math.floor(x / 6), wood[4]); p.set(x, 18 + Math.floor(x / 6), wood[2]); p.set(x, 21 + Math.floor(x / 6), wood[3]); p.set(x, 22 + Math.floor(x / 6), wood[1]); }
      // bed
      box(p, 10, 6, 32, 9, 9, wood, darkwood, { grain: true, seed: 4 });
      // side boards rim
      for (let x = 10; x < 42; x++) { p.set(x, 5, wood[5]); }
      // cargo: sacks
      for (const [sx, sy] of [[14, 3], [22, 2], [30, 4]] as const) { p.ellipse(sx + 3, sy + 4, 4, 3.5, RAMPS.linen[2]); p.ellipse(sx + 2, sy + 3, 2.5, 2, RAMPS.linen[3]); p.set(sx + 3, sy, RAMPS.linen[1]); }
      // wheel
      const wx = 26, wy = 24;
      for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2; p.set(Math.round(wx + Math.cos(t) * 6.5), Math.round(wy + Math.sin(t) * 6.5), a < 40 && a > 8 ? wood[1] : wood[4]); p.set(Math.round(wx + Math.cos(t) * 5.5), Math.round(wy + Math.sin(t) * 5.5), wood[2]); }
      for (let k = 0; k < 4; k++) { const t = (k / 4) * Math.PI; p.line(wx - Math.cos(t) * 5, wy - Math.sin(t) * 5, wx + Math.cos(t) * 5, wy + Math.sin(t) * 5, wood[3]); }
      p.set(wx, wy, RAMPS.iron[4]); p.set(wx + 1, wy, RAMPS.iron[2]);
    },
  },
  'barrel': {
    w: 16, h: 20, ox: 8, oy: 17, variants: 2,
    footprint: { x: -6, y: -4, w: 12, h: 5 },
    shadow: [8, 17, 7, 2.5, 0.3],
    draw({ p, v }) {
      cylinder(p, 8, 4, 6, 2.5, 11, wood, { bands: [1, 9], bandRamp: RAMPS.iron, topRamp: wood });
      // bulge: slightly wider middle
      for (let y = 8; y < 13; y++) { p.set(1, y, wood[2]); p.set(14, y, wood[0]); }
      // staves
      for (let y = 5; y < 17; y++) { p.paint(5, y, wood[2]); p.paint(10, y, wood[1]); }
      p.ellipse(8, 4, 4.5, 1.6, wood[4]);
      if (v === 1) { p.ellipse(8, 4, 4.5, 1.6, RAMPS.water[3]); p.set(6, 4, RAMPS.water[5]); }
    },
  },
  'crate': {
    w: 16, h: 18, ox: 8, oy: 16, variants: 2,
    footprint: { x: -7, y: -7, w: 14, h: 8 },
    shadow: [8, 16, 8, 2, 0.3],
    draw({ p, v }) {
      box(p, 1, 1, 14, 5, 10, v ? RAMPS.straw : wood, v ? RAMPS.wood : wood);
      // front planks + X brace
      for (let x = 1; x < 15; x++) { p.set(x, 6, wood[5]); p.set(x, 15, wood[1]); }
      for (let i = 0; i < 9; i++) { p.set(2 + Math.round(i * 1.4), 7 + i, wood[4]); p.set(13 - Math.round(i * 1.4), 7 + i, wood[2]); }
      for (let y = 6; y < 16; y++) { p.set(1, y, wood[4]); p.set(14, y, wood[1]); }
      for (let x = 2; x < 14; x++) p.set(x, 3, wood[3]);
    },
  },
  'sack': {
    w: 14, h: 16, ox: 7, oy: 14, variants: 2,
    footprint: { x: -5, y: -3, w: 10, h: 4 },
    shadow: [7, 14, 6, 2, 0.3],
    draw({ p, v }) {
      const r = RAMPS.linen;
      for (let y = 4; y < 15; y++) for (let x = 1; x < 13; x++) {
        const nx = (x + 0.5 - 7) / 6, ny = (y + 0.5 - 10) / 5.5;
        if (nx * nx + ny * ny * 0.8 > 1) continue;
        p.set(x, y, tone(r, -nx * 0.6 - ny * 0.4 + 0.2, x, y, 0, 4, 0.4));
      }
      // tied neck
      p.rect(5, 2, 4, 3, r[2]); p.set(5, 2, r[3]); p.rect(4, 4, 6, 1, RAMPS.earth[2]);
      p.set(6, 1, r[3]); p.set(8, 1, r[2]);
      if (v === 1) { p.set(5, 9, RAMPS.earth[2]); p.set(6, 9, RAMPS.earth[2]); p.set(8, 10, RAMPS.earth[2]); }
    },
  },
  'bucket': {
    w: 12, h: 12, ox: 6, oy: 10,
    footprint: { x: -4, y: -2, w: 8, h: 3 },
    shadow: [6, 10, 5, 1.6, 0.3],
    draw({ p }) {
      cylinder(p, 6, 4, 4, 1.6, 5, wood, { open: true, bands: [1, 4], bandRamp: RAMPS.iron, inner: RAMPS.water[2] });
      p.set(4, 4, RAMPS.water[4]);
      // handle
      p.set(2, 2, RAMPS.iron[3]); p.set(3, 1, RAMPS.iron[4]); for (let x = 4; x < 9; x++) p.set(x, 0, RAMPS.iron[4]); p.set(9, 1, RAMPS.iron[2]); p.set(10, 2, RAMPS.iron[2]);
    },
  },
  'fence-h': {
    w: 16, h: 16, ox: 8, oy: 14, variants: 2,
    footprint: { x: -8, y: -3, w: 16, h: 4 },
    draw({ p, v }) {
      fenceRail(p, 0, 15, 5); fenceRail(p, 0, 15, 9);
      fencePost(p, 1, 2, 14);
      if (v) { p.set(9, 6, wood[1]); p.set(10, 6, RAMPS.grass[3]); }
      p.shadow(8, 14, 8, 1.2, 0.22);
    },
  },
  'fence-v': {
    w: 8, h: 24, ox: 4, oy: 22,
    footprint: { x: -2, y: -16, w: 4, h: 17 },
    draw({ p }) {
      for (let y = 0; y < 22; y++) { p.set(3, y, wood[4]); p.set(4, y, wood[2]); }
      fencePost(p, 2, 10, 22);
    },
  },
  'fence-post': {
    w: 8, h: 16, ox: 4, oy: 14,
    footprint: { x: -2, y: -2, w: 4, h: 3 },
    shadow: [4, 14, 3, 1, 0.25],
    draw({ p }) { fencePost(p, 2, 2, 14); },
  },
  'gate': {
    w: 34, h: 20, ox: 17, oy: 18, variants: 2,
    footprint: { x: -17, y: -3, w: 34, h: 4 },
    draw({ p, v }) {
      fencePost(p, 0, 1, 18); fencePost(p, 31, 1, 18);
      if (v === 0) {
        // closed gate: frame + diagonal brace
        fenceRail(p, 3, 30, 4); fenceRail(p, 3, 30, 13);
        for (let y = 4; y < 15; y++) { p.set(4, y, wood[4]); p.set(29, y, wood[2]); p.set(16, y, wood[3]); }
        for (let i = 0; i < 12; i++) { p.set(5 + i, 13 - Math.round(i * 0.8), wood[4]); p.set(17 + i, 13 - Math.round(i * 0.8), wood[4]); }
        p.set(28, 8, RAMPS.iron[4]); p.set(28, 9, RAMPS.iron[2]);
      } else {
        // open gate swung inward
        for (let y = 3; y < 15; y++) { p.set(4, y, wood[4]); p.set(5, y, wood[2]); }
      }
    },
  },
  'stairs': {
    w: 16, h: 16, ox: 8, oy: 16, footprint: null, noOutline: true,
    draw({ p }) {
      for (let s = 0; s < 4; s++) {
        const y = s * 4;
        for (let x = 0; x < 16; x++) {
          p.set(x, y, stone[5]); p.set(x, y + 1, stone[4]); p.set(x, y + 2, stone[3]); p.set(x, y + 3, stone[1]);
        }
      }
      for (let y = 0; y < 16; y++) { p.set(0, y, stone[2]); p.set(15, y, stone[1]); }
    },
  },
  'bridge-h': {
    w: 48, h: 26, ox: 24, oy: 22, footprint: null,
    draw({ p }) {
      // planks running across
      for (let x = 0; x < 48; x++) for (let y = 6; y < 20; y++) {
        const k = Math.floor(x / 4), lx = x % 4;
        let i = 3 + (hash2(k, 0, 5) > 0.6 ? 1 : 0);
        if (lx === 0) i = 1; else if (lx === 1) i++;
        if (y === 19) i = 1;
        p.set(x, y, wood[Math.min(5, i)]);
      }
      // rails + posts
      for (const y of [3, 20]) for (let x = 0; x < 48; x++) { p.set(x, y, wood[4]); p.set(x, y + 1, wood[2]); }
      for (const x of [1, 23, 45]) { fencePost(p, x, 0, 6); fencePost(p, x, 18, 24); }
      // supports visible underneath
      for (const x of [8, 38]) for (let y = 21; y < 26; y++) { p.set(x, y, darkwood[2]); p.set(x + 1, y, darkwood[1]); }
    },
  },
};

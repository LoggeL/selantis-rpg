import type { Dir } from '../../core/types';
import { RAMPS, color as namedColor, mix, ramp, shift } from '../palette';
import { Px } from '../px';
import { hash2 } from '../rng';
import type { Metrics, Pose, WeaponKind } from './rig';
import type { Preset } from './specs';

/** Every ramp is normalised to 6 steps: 0 darkest … 5 highlight, 3 = base. */
export type Six = [number, number, number, number, number, number];

export function six(name: string): Six {
  const r = ramp(name);
  if (r.length === 6) return [...r] as Six;
  const out: number[] = [];
  for (let i = 0; i < 6; i++) out.push(r[Math.round((i / 5) * (r.length - 1))]);
  return out as Six;
}

export interface Pal {
  skin: Six; hair: Six; top: Six; trim: Six; bottom: Six; cloak: Six; cloakTrim: Six;
  head: Six; beard: Six; eye: number; magic: Six; leather: Six; steel: Six; wood: Six;
}

export function palette(spec: Preset): Pal {
  const x = spec.x ?? {};
  return {
    skin: six(spec.skin),
    hair: six(spec.hair?.color ?? 'nut'),
    top: six(spec.top?.color ?? 'linen'),
    trim: six(spec.top?.trim ?? spec.top?.color ?? 'linen'),
    bottom: six(spec.bottom?.color ?? 'mud'),
    cloak: six(spec.cloak?.color ?? 'green'),
    cloakTrim: six(spec.cloak?.trim ?? spec.cloak?.color ?? 'green'),
    head: six(spec.head?.color ?? 'leather'),
    beard: six(spec.beard?.color ?? spec.hair?.color ?? 'nut'),
    eye: six(x.eyes ?? 'brown')[1],
    magic: six(x.magic ?? 'urmacht'),
    leather: six('leather'),
    steel: six('steel'),
    wood: six('wood'),
  };
}

const INK = 0x1c1418;

interface Ctx {
  p: Px;
  m: Metrics;
  pal: Pal;
  spec: Preset;
  pose: Pose;
  dir: 'down' | 'up' | 'right';
  /** Light comes from screen-left in this drawing (false when drawing a frame that will be mirrored). */
  L: boolean;
  flags: Set<string>;
  weapon: WeaponKind;
  cx: number;
  shoulderY: number;
  hipY: number;
  headX: number;
  headY: number;
  cloakIsCoat?: boolean;
}

// ------------------------------------------------------------------------------------------
// Shading helpers
// ------------------------------------------------------------------------------------------

/** Column shade: lit edge brighter, far edge darker. */
function col(c: Ctx, r: Six, x: number, x0: number, x1: number, b = 3): number {
  const litEdge = c.L ? x0 : x1, darkEdge = c.L ? x1 : x0;
  if (x === litEdge && x1 > x0) return r[Math.min(5, b + 1)];
  if (x === darkEdge && x1 > x0) return r[Math.max(0, b - 1)];
  return r[b];
}

function thickLine(p: Px, x0: number, y0: number, x1: number, y1: number, w: number, color: (x: number, y: number, k: number) => number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const horizontal = Math.abs(x1 - x0) > Math.abs(y1 - y0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    for (let k = 0; k < w; k++) {
      const xx = horizontal ? x : x + k;
      const yy = horizontal ? y + k : y;
      p.set(xx, yy, color(xx, yy, k));
    }
  }
}

// ------------------------------------------------------------------------------------------
// Head templates
// ------------------------------------------------------------------------------------------

const HEAD_FRONT: Record<number, string[]> = {
  8: ['.######.', '########', '########', '########', '########', '########', '.######.', '..####..'],
  10: ['..######..', '.########.', '##########', '##########', '##########', '##########', '##########', '.########.', '..######..', '...####...'],
};
const HEAD_SIDE: Record<number, string[]> = {
  8: ['.#####..', '#######.', '########', '########', '#########', '########', '.######.', '..####..'],
  10: ['..######..', '.########.', '#########.', '##########', '##########', '###########', '##########', '.#########', '..#######.', '...#####..'],
};

function headMask(c: Ctx): string[] {
  return (c.dir === 'right' ? HEAD_SIDE : HEAD_FRONT)[c.m.headW];
}

function drawHead(c: Ctx): void {
  const { p, pal } = c;
  const mask = headMask(c);
  const H = mask.length, Wd = mask[0].length;
  for (let y = 0; y < H; y++) for (let x = 0; x < mask[y].length; x++) {
    if (mask[y][x] !== '#') continue;
    let i = 4;
    const right = c.L ? x >= Wd - 2 : x <= 1;
    const left = c.L ? x <= 0 : x >= Wd - 1;
    if (right) i = 3;
    if (left) i = 4;
    if (y >= H - 2) i = 3;
    if (c.dir === 'right') {
      // profile: back of the head darker, face lit
      if (x <= 1) i = 3;
      if (x === Wd) i = 3; // nose
    }
    p.set(c.headX + x, c.headY + y, pal.skin[i]);
  }
  // nose tip in profile
  if (c.dir === 'right') p.set(c.headX + Wd, c.headY + (c.m.headW === 8 ? 4 : 5), pal.skin[3]);
}

function eyeRows(c: Ctx): number { return c.m.headW === 8 ? 4 : 5; }

function drawFace(c: Ctx): void {
  if (c.dir === 'up' || c.flags.has('faceless')) return;
  const { p, pal, pose } = c;
  const ey = c.headY + eyeRows(c);
  const W = c.m.headW;
  const eyesX = c.dir === 'down' ? (W === 8 ? [2, 5] : [2, 7]) : [W === 8 ? 5 : 7];
  const closed = pose.eyes === 'closed' && !c.flags.has('noblink');
  const blind = c.flags.has('blind-eye');
  eyesX.forEach((ex, k) => {
    const x = c.headX + ex;
    // the blind eye is on the character's right side: screen-left in front view
    const isBlind = blind && ((c.dir === 'down' && k === 0) || (c.dir === 'right'));
    if (isBlind) { p.set(x, ey, pal.skin[2]); p.set(x, ey + 1, 0xc8c4c0); return; }
    if (closed || pose.eyes === 'hurt') {
      p.set(x, ey + 1, pal.skin[1]);
      if (pose.eyes === 'hurt') p.set(x + (k === 0 ? -1 : 1) * (c.dir === 'down' ? 1 : 0), ey, pal.skin[2]);
    } else {
      p.set(x, ey, INK);
      p.set(x, ey + 1, pose.eyes === 'wide' ? 0xffffff : mix(pal.eye, INK, 0.3));
    }
  });
  // cheeks, freckles, blush
  const cheekY = ey + 2;
  if (c.flags.has('blush') || c.flags.has('freckles-light')) {
    if (c.dir === 'down') { p.set(c.headX + 1, cheekY, mix(pal.skin[4], RAMPS.pink[3], c.flags.has('blush') ? 0.6 : 0.3)); p.set(c.headX + W - 2, cheekY, mix(pal.skin[4], RAMPS.pink[3], c.flags.has('blush') ? 0.6 : 0.3)); }
    else p.set(c.headX + W - 3, cheekY, mix(pal.skin[4], RAMPS.pink[3], 0.45));
  }
  if (c.flags.has('freckles')) {
    if (c.dir === 'down') { p.set(c.headX + 1, cheekY - 1, pal.skin[2]); p.set(c.headX + W - 2, cheekY - 1, pal.skin[2]); }
    else p.set(c.headX + W - 3, cheekY - 1, pal.skin[2]);
  }
  // scars / burns (character's right = screen-left in front view, visible side in profile)
  const rightSide = c.dir === 'down' ? [0, 1, 2] : [W - 4, W - 3, W - 2];
  const leftSide = c.dir === 'down' ? [W - 3, W - 2, W - 1] : [];
  if (c.flags.has('scar-right')) {
    const xs = rightSide;
    p.set(c.headX + xs[1], ey + 1, RAMPS.red[3]); p.set(c.headX + xs[2] - (c.dir === 'down' ? 1 : 0), ey + 2, RAMPS.red[2]);
  }
  for (const [flag, xs] of [['burn-right', rightSide], ['burn-left', leftSide]] as const) {
    if (!c.flags.has(flag)) continue;
    for (const xx of xs) for (let yy = ey - 2; yy <= ey + 3; yy++) {
      if (p.get(c.headX + xx, yy) === -1) continue;
      const v = hash2(xx, yy, 7);
      const cur = p.get(c.headX + xx, yy);
      if (cur === INK) continue;
      p.set(c.headX + xx, yy, v > 0.55 ? mix(RAMPS.red[3], pal.skin[3], 0.35) : v > 0.25 ? mix(RAMPS.red[2], pal.skin[2], 0.4) : pal.skin[2]);
    }
  }
  if (c.flags.has('bruise') && c.dir === 'down') p.set(c.headX + W - 3, ey - 1, RAMPS.red[3]);
  if (pose.mouth) {
    const mx = c.dir === 'down' ? c.headX + Math.floor(W / 2) - 1 : c.headX + W - 2;
    p.set(mx, ey + 3, RAMPS.red[1]);
    if (c.dir === 'down') p.set(mx + 1, ey + 3, RAMPS.red[1]);
  }
}

// ------------------------------------------------------------------------------------------
// Hair
// ------------------------------------------------------------------------------------------

interface HairDef {
  top: number; side: number; back: number; width: number;
  bangs: 'none' | 'short' | 'parted' | 'full' | 'messy' | 'curly';
  curly?: boolean; messy?: boolean; stringy?: boolean; bald?: boolean; buzz?: boolean;
  tie?: 'updo' | 'ponytail' | 'braid' | 'bun-high' | 'ribbon' | 'braids';
}

export const HAIR: Record<string, HairDef> = {
  'bald': { top: 0, side: 0, back: 0, width: 0, bangs: 'none', bald: true },
  'buzz': { top: 0, side: 3, back: 5, width: 0, bangs: 'none', buzz: true },
  'short': { top: 1, side: 3, back: 6, width: 0, bangs: 'short' },
  'short-messy': { top: 2, side: 4, back: 7, width: 1, bangs: 'messy', messy: true },
  'shoulder': { top: 1, side: 10, back: 11, width: 1, bangs: 'parted' },
  'long': { top: 1, side: 13, back: 15, width: 1, bangs: 'parted' },
  'long-tied': { top: 1, side: 5, back: 7, width: 0, bangs: 'parted', tie: 'ponytail' },
  'long-curly': { top: 2, side: 13, back: 15, width: 2, bangs: 'curly', curly: true },
  'curly-up': { top: 2, side: 6, back: 7, width: 1, bangs: 'curly', curly: true, tie: 'updo' },
  'curly-ribbon': { top: 2, side: 8, back: 8, width: 1, bangs: 'curly', curly: true, tie: 'ribbon' },
  'stringy': { top: 1, side: 11, back: 12, width: 1, bangs: 'parted', stringy: true },
  'braid-long': { top: 1, side: 3, back: 6, width: 0, bangs: 'none', tie: 'braid' },
  'bun': { top: 1, side: 4, back: 6, width: 0, bangs: 'parted', tie: 'bun-high' },
  'braids': { top: 1, side: 4, back: 6, width: 0, bangs: 'parted', tie: 'braids' },
};

function hairDef(c: Ctx): HairDef {
  const s = c.spec.hair?.style ?? 'short';
  const d = HAIR[s] ?? HAIR.short;
  if (c.m.headW === 10) return { ...d, side: Math.round(d.side * 1.25), back: Math.round(d.back * 1.25) };
  return d;
}

/** Hair colour for a pixel (rx, ry relative to the skin box). */
function hairTone(c: Ctx, d: HairDef, rx: number, ry: number, edge = false): number {
  const r = c.pal.hair;
  const W = c.m.headW, H = c.m.headH;
  const u = c.L ? rx : W - 1 - rx; // distance from the lit side
  if (c.flags.has('streak') && rx >= 2 && rx <= 3 && ry <= 2 && c.dir !== 'up') return RAMPS.silver[ry < 1 ? 5 : 4];
  let i = 3;
  // crown: lit on the light side, glossy arc
  if (ry <= 1 && u <= W * 0.55) i = 4;
  if ((ry === 0 && u >= 1 && u <= 3) || (ry === -1 && u >= 2 && u <= 3)) i = 5;
  // shade on the far side and toward the ends
  if (u >= W - 2 + Math.min(1, d.width)) i = 2;
  if (ry >= H && u > W * 0.4) i = 2;
  if (d.curly) {
    // small curl shapes on a staggered grid: highlight with a shadow beneath
    const gx = ((rx + ((ry >> 1) & 1) * 2) % 4 + 4) % 4;
    if (ry > 0 && ry % 2 === 0 && gx === 0) i = Math.min(5, i + 1);
    else if (ry > 0 && ry % 2 === 1 && gx === 0) i = Math.max(1, i - 1);
  } else if (d.stringy) {
    if (ry > 1 && rx % 2 === 0) i = Math.max(1, i - 1);
  } else if (ry > 3 && ((rx % 3) + 3) % 3 === 1) {
    i = Math.max(1, i - 1);
  }
  if (edge) i = Math.max(1, i - 1);
  return r[i];
}

function bangDepth(d: HairDef, rx: number, W: number): number {
  switch (d.bangs) {
    case 'none': return 1;
    case 'short': return rx === 0 || rx === W - 1 ? 3 : 2;
    case 'parted': {
      const mid = W / 2;
      const dist = Math.abs(rx + 0.5 - mid);
      return dist < 1 ? 1 : dist < 2 ? 2 : 3;
    }
    case 'full': return 3;
    case 'messy': return [3, 2, 3, 2, 3, 3, 2, 3, 2, 3][rx % 10];
    case 'curly': return [3, 2, 2, 3, 2, 2, 3, 3, 2, 3][rx % 10];
  }
}

/** Hair parts behind the head/body (long hair in front view, hanging hair in side view). */
function drawHairBack(c: Ctx): void {
  const d = hairDef(c);
  if (d.bald || d.buzz) return;
  const { p } = c;
  const W = c.m.headW;
  const hx = c.headX, hy = c.headY;
  if (c.dir === 'down') {
    if (d.side <= W - 1) return;
    for (let ry = 2; ry <= d.side; ry++) for (let rx = -d.width - 1; rx <= W + d.width; rx++) {
      // curly / straight bottom edge
      const bottom = d.side - (d.curly ? (rx % 2 === 0 ? 1 : 0) : (rx === -d.width - 1 || rx === W + d.width ? 1 : 0));
      if (ry > bottom) continue;
      if ((rx === -d.width - 1 || rx === W + d.width) && ry < 4) continue;
      p.set(hx + rx, hy + ry, hairTone(c, d, rx, ry, true));
    }
  } else if (c.dir === 'right') {
    const sway = Math.round(c.pose.hair * 0.6);
    if (d.back > W - 2) {
      for (let ry = 2; ry <= d.back; ry++) {
        const t = (ry - 2) / Math.max(1, d.back - 2);
        const off = -Math.round(sway * t);
        const x0 = -d.width - 1 + off, x1 = 3 + (ry < W ? 0 : -1);
        for (let rx = x0; rx <= x1; rx++) {
          if (ry === d.back && d.curly && rx % 2) continue;
          p.set(hx + rx, hy + ry, hairTone(c, d, rx, ry, rx === x0));
        }
      }
    }
  }
}

function drawHairFront(c: Ctx): void {
  const d = hairDef(c);
  const { p, pal } = c;
  const W = c.m.headW, H = c.m.headH;
  const hx = c.headX, hy = c.headY;
  if (c.flags.has('hood-up')) return;
  if (d.bald) {
    // scalp sheen
    if (c.dir !== 'right') { p.set(hx + 2, hy, pal.skin[5]); p.set(hx + 3, hy, pal.skin[5]); }
    else { p.set(hx + 3, hy, pal.skin[5]); }
    return;
  }
  if (d.buzz) {
    for (let ry = 0; ry < 3; ry++) for (let rx = 0; rx < W; rx++) {
      if (c.dir === 'right' && rx > 5 && ry > 0) continue;
      if (p.get(hx + rx, hy + ry) < 0) continue;
      if (c.dir === 'down' && ry === 2 && rx > 1 && rx < W - 2) continue;
      p.set(hx + rx, hy + ry, (rx + ry) % 2 ? pal.hair[2] : pal.hair[3]);
    }
    if (c.dir === 'up') for (let ry = 3; ry < H - 2; ry++) for (let rx = 0; rx < W; rx++) if (p.get(hx + rx, hy + ry) >= 0) p.set(hx + rx, hy + ry, (rx + ry) % 2 ? pal.hair[2] : pal.hair[3]);
    return;
  }
  const set = (rx: number, ry: number, edge = false) => p.set(hx + rx, hy + ry, hairTone(c, d, rx, ry, edge));
  if (c.dir === 'down' || c.dir === 'up') {
    // crown cap above the skin
    for (let ry = -d.top; ry < 0; ry++) {
      const inset = ry === -d.top ? 2 : ry === -d.top + 1 && d.top > 1 ? 1 : 0;
      for (let rx = -d.width + inset; rx < W + d.width - inset; rx++) {
        if (d.messy && ry === -d.top && rx % 3 === 1) continue;
        set(rx, ry);
      }
      if (d.messy && ry === -d.top) { set(1, ry - 1); set(W - 3, ry - 1); }
    }
    if (c.dir === 'down') {
      for (let rx = -d.width; rx < W + d.width; rx++) {
        const inside = rx >= 0 && rx < W;
        const depth = inside ? bangDepth(d, rx, W) : Math.max(d.side, 3);
        const framing = inside && (rx === 0 || rx === W - 1) && d.side >= 6 ? Math.min(d.side, H - 2) : 0;
        const rows = Math.max(depth, framing);
        for (let ry = 0; ry < rows; ry++) set(rx, ry, !inside || ry === rows - 1);
      }
      // curls framing the face (Lia's updo leaves loose curls)
      if (d.tie === 'updo' || d.curly) {
        for (const rx of [-d.width, W - 1 + d.width]) for (let ry = 2; ry <= d.side; ry++) if ((ry + rx) % 3 !== 0) set(rx, ry, true);
      }
    } else {
      for (let ry = 0; ry <= Math.max(H - 2, Math.min(d.back, H + 4)); ry++) {
        for (let rx = -d.width; rx < W + d.width; rx++) {
          if (ry >= H - 1 && (rx < 0 || rx >= W) && ry > d.back - 1) continue;
          if (ry > d.back) continue;
          if (d.curly && ry === d.back && rx % 2) continue;
          set(rx, ry, rx === -d.width || rx === W + d.width - 1);
        }
      }
      // long hair over the back
      if (d.back > H + 4) {
        for (let ry = H + 4; ry <= d.back; ry++) for (let rx = -d.width; rx < W + d.width; rx++) {
          const sway = Math.round(c.pose.hair * 0.4 * ((ry - H) / (d.back - H)));
          if (d.curly && ry === d.back && rx % 2) continue;
          set(rx + sway, ry, rx === -d.width || rx === W + d.width - 1);
        }
      }
    }
  } else {
    // profile, facing right
    for (let ry = -d.top; ry <= 0; ry++) {
      const inset = ry === -d.top ? 2 : 0;
      for (let rx = -d.width + inset; rx < W - (ry === -d.top ? 2 : 1); rx++) {
        if (d.messy && ry === -d.top && rx % 3 === 1) continue;
        set(rx, ry);
      }
    }
    // back of the skull + sideburn
    const backRows = Math.min(Math.max(d.side, 4), H - 2);
    for (let ry = 1; ry <= backRows; ry++) for (let rx = -d.width; rx <= (ry < 3 ? 3 : 2); rx++) set(rx, ry, rx === -d.width);
    // bangs at the front
    const bang = d.bangs === 'none' ? 1 : d.bangs === 'short' ? 2 : 2;
    for (let ry = 1; ry <= bang; ry++) for (let rx = 4; rx < W - (ry === bang ? 2 : 1); rx++) set(rx, ry, ry === bang);
    if (d.bangs === 'messy' || d.bangs === 'curly') set(W - 2, 2, true);
  }
  // ties
  const hr = pal.hair;
  if (d.tie === 'updo') {
    if (c.dir === 'up') { p.ellipse(hx + W / 2, hy + 2, 2.6, 2.2, hr[3]); p.set(hx + W / 2 - 1, hy + 1, hr[5]); p.set(hx + W / 2 + 1, hy + 3, hr[2]); }
    if (c.dir === 'right') { p.ellipse(hx - d.width - 0.5, hy + 1.5, 2.2, 2.2, hr[3]); p.set(hx - d.width - 1, hy + 1, hr[4]); }
    if (c.dir === 'down') { p.set(hx - d.width - 1, hy - 1, hr[3]); p.set(hx + W + d.width, hy - 1, hr[2]); }
  }
  if (d.tie === 'bun-high') {
    const bx = c.dir === 'right' ? hx + 1 : hx + W / 2;
    p.ellipse(bx, hy - d.top - 1.5, 2.2, 1.8, hr[3]); p.set(Math.round(bx) - 1, hy - d.top - 2, hr[4]);
  }
  if (d.tie === 'ponytail' || d.tie === 'ribbon' || d.tie === 'braid') {
    const len = d.tie === 'braid' ? H + 5 : d.tie === 'ribbon' ? H + 2 : H + 3;
    const sway = Math.round(c.pose.hair * 0.7);
    if (c.dir === 'up') {
      for (let ry = 2; ry < len; ry++) {
        const off = Math.round(sway * (ry / len));
        const wdt = d.tie === 'braid' ? 2 : ry > len - 3 ? 2 : 3;
        for (let k = 0; k < wdt; k++) {
          let cc = hr[k === 0 ? 4 : 3];
          if (d.tie === 'braid' && (ry + k) % 2 === 0) cc = hr[2];
          p.set(hx + Math.floor(W / 2) - 1 + k + off, hy + ry, cc);
        }
      }
      if (d.tie === 'ribbon') for (let k = -1; k < 4; k++) p.set(hx + Math.floor(W / 2) - 1 + k, hy + 3, k === -1 || k === 3 ? RAMPS.olive[3] : RAMPS.olive[4]);
    } else if (c.dir === 'right') {
      for (let ry = 2; ry < len; ry++) {
        const off = -Math.round((sway + 1) * (ry / len));
        for (let k = 0; k < 2; k++) {
          let cc = hr[k === 0 ? 3 : 2];
          if (d.tie === 'braid' && (ry + k) % 2 === 0) cc = hr[1];
          p.set(hx - d.width - 1 - k + off + (ry < 4 ? 1 : 0), hy + ry, cc);
        }
      }
      if (d.tie === 'ribbon') { p.set(hx - d.width - 1, hy + 3, RAMPS.olive[4]); p.set(hx - d.width - 2, hy + 3, RAMPS.olive[3]); p.set(hx - d.width - 2, hy + 4, RAMPS.olive[2]); }
    }
  }
  if (d.tie === 'braids' && c.dir === 'down') {
    for (const rx of [-1, W]) for (let ry = 3; ry < H + 4; ry++) p.set(hx + rx, hy + ry, (ry % 2) ? hr[3] : hr[2]);
  }
}

function drawEars(c: Ctx): void {
  const { p, pal } = c;
  const d = hairDef(c);
  const W = c.m.headW;
  const ey = c.headY + eyeRows(c);
  const elf = c.spec.ears === 'elf';
  if (c.flags.has('hood-up') && !elf) return;
  const covered = d.side >= 5 && !d.tie && !d.bald;
  if (c.dir === 'down') {
    for (const [x, dx] of [[c.headX - 1, -1], [c.headX + W, 1]] as const) {
      if (elf) {
        p.set(x, ey, pal.skin[3]); p.set(x + dx, ey - 1, pal.skin[3]); p.set(x + dx * 2, ey - 2, pal.skin[4]);
        p.set(x, ey - 1, pal.skin[4]);
      } else if (!covered) p.set(x, ey, pal.skin[3]);
    }
  } else if (c.dir === 'right') {
    const x = c.headX + 3;
    if (elf) { p.set(x, ey, pal.skin[3]); p.set(x - 1, ey - 1, pal.skin[3]); p.set(x - 2, ey - 2, pal.skin[4]); p.set(x, ey - 1, pal.skin[2]); }
    else if (!covered) { p.set(x, ey, pal.skin[2]); p.set(x, ey + 1, pal.skin[3]); }
  } else {
    for (const x of [c.headX - 1, c.headX + W]) {
      if (elf) { p.set(x, ey, pal.skin[2]); p.set(x + (x < c.headX ? -1 : 1), ey - 1, pal.skin[3]); }
      else if (!covered) p.set(x, ey, pal.skin[2]);
    }
  }
}

// ------------------------------------------------------------------------------------------
// Beard & head gear
// ------------------------------------------------------------------------------------------

function drawBeard(c: Ctx): void {
  const st = c.spec.beard?.style ?? (c.flags.has('stubble') ? 'stubble' : '');
  if (!st || c.dir === 'up') return;
  const { p, pal } = c;
  const r = pal.beard;
  const W = c.m.headW, H = c.m.headH;
  const hx = c.headX, hy = c.headY;
  const ey = eyeRows(c);
  const set = (rx: number, ry: number, i: number) => p.set(hx + rx, hy + ry, r[i]);
  const front = c.dir === 'down';
  const xs = (a: number, b: number) => { const out: number[] = []; for (let x = a; x <= b; x++) out.push(x); return out; };
  const cols = front ? xs(0, W - 1) : xs(3, W);
  if (st === 'stubble') {
    for (let ry = ey + 2; ry < H; ry++) for (const rx of cols) if ((rx + ry) % 2 === 0 && p.get(hx + rx, hy + ry) >= 0) p.set(hx + rx, hy + ry, mix(p.get(hx + rx, hy + ry), r[2], 0.55));
    return;
  }
  const extend = st === 'bushy' ? 3 : st === 'long' || st === 'braided' ? (W === 8 ? 5 : 7) : st === 'full' ? 1 : st === 'goatee' ? 1 : 0;
  const startRow = ey + 2;
  for (let ry = startRow; ry < H + extend; ry++) {
    for (const rx of cols) {
      const inFace = p.get(hx + rx, hy + ry) >= 0 || ry >= H;
      if (!inFace && ry < H) continue;
      if (st === 'goatee' && front && (rx < W / 2 - 1 || rx > W / 2) && ry > ey + 2) continue;
      if (st === 'goatee' && !front && rx < W - 3 && ry > ey + 2) continue;
      if (st === 'short' && ry >= H) continue;
      if (ry >= H) {
        // below the chin: taper
        const t = ry - H;
        const half = front ? Math.max(1, (W / 2) - t - (st === 'bushy' ? -1 : 1)) : 2;
        if (front && Math.abs(rx + 0.5 - W / 2) > half) continue;
        if (!front && (rx < W - 3 - (st === 'bushy' ? 2 : 0) || rx > W - 1)) continue;
      }
      // mouth gap row
      if (front && ry === ey + 3 && rx >= W / 2 - 1 && rx <= W / 2 && st !== 'bushy') { p.set(hx + rx, hy + ry, mix(r[1], RAMPS.red[1], 0.4)); continue; }
      const u = c.L ? rx : W - 1 - rx;
      let i = u < W * 0.4 ? 4 : u > W * 0.7 ? 2 : 3;
      if ((rx + ry) % 3 === 0) i = Math.max(1, i - 1);
      if (st === 'braided' && ry >= H && (ry - H) % 2 === 1) i = 1;
      set(rx, ry, i);
    }
  }
  if (st === 'bushy' && front) { for (let ry = ey + 1; ry < H + 1; ry++) { set(-1, ry, 2); set(W, ry, 2); } }
  if (st === 'braided') { const bx = front ? W / 2 - 1 : W - 2; set(bx, H + extend - 2, 5); p.set(hx + bx + 1, hy + H + extend - 2, RAMPS.gold[3]); }
}

function drawHeadgear(c: Ctx): void {
  const st = c.spec.head?.style;
  if (!st) return;
  const { p, pal } = c;
  const r = pal.head;
  const W = c.m.headW, H = c.m.headH;
  const hx = c.headX, hy = c.headY;
  const side = c.dir === 'right';
  const set = (rx: number, ry: number, i: number) => p.set(hx + rx, hy + ry, r[Math.max(0, Math.min(5, i))]);
  const u = (rx: number) => (c.L ? rx : W - 1 - rx);
  const sh = (rx: number) => (u(rx) < 3 ? 4 : u(rx) > W - 3 ? 2 : 3);
  switch (st) {
    case 'beret': {
      for (let ry = -2; ry <= 1; ry++) for (let rx = -1; rx <= W; rx++) {
        if (ry === -2 && (rx < 1 || rx > W - 3)) continue;
        set(rx + (side ? -1 : 1), ry, ry === 1 ? 1 : sh(rx));
      }
      set(side ? W - 2 : W / 2, -3, 3);
      break;
    }
    case 'cap': {
      for (let ry = -2; ry <= 2; ry++) for (let rx = -1; rx <= W; rx++) {
        if (ry === -2 && (rx < 1 || rx > W - 2)) continue;
        if (ry === 2 && !side && rx > 0 && rx < W - 1) continue;
        if (side && ry >= 1 && rx > 5) continue;
        set(rx, ry, ry >= 1 ? 2 : sh(rx));
      }
      // soft fold
      for (let rx = 0; rx < W; rx++) if (!side || rx < 6) set(rx, 1, 5 - (u(rx) > W / 2 ? 2 : 0));
      break;
    }
    case 'hood': case 'hood-deep': case 'hood-mask': {
      const deep = st !== 'hood';
      for (let ry = -2; ry < H + 2; ry++) for (let rx = -2; rx <= W + 1; rx++) {
        if (ry === -2 && (rx < 0 || rx > W - 1)) continue;
        if (ry === -1 && (rx < -1 || rx > W)) continue;
        // face opening
        const open = side ? (rx >= W - (deep ? 2 : 4) && ry >= 1) : (rx >= 1 && rx <= W - 2 && ry >= (deep ? 1 : 2));
        if (open && c.dir !== 'up') continue;
        if (ry >= H && (rx < 0 || rx > W - 1)) continue;
        set(rx, ry, ry >= H ? 1 : sh(rx) - (ry > H - 2 ? 1 : 0));
      }
      if (deep && c.dir !== 'up') {
        // face fully in shadow
        for (let ry = 1; ry < H; ry++) for (let rx = 0; rx <= W; rx++) {
          const inOpen = side ? (rx >= W - 2) : (rx >= 1 && rx <= W - 2);
          if (!inOpen) continue;
          if (p.get(hx + rx, hy + ry) === -1 && ry > H - 2) continue;
          p.set(hx + rx, hy + ry, ry < 3 ? 0x07060a : 0x0e0c12);
        }
        if (st === 'hood-mask') {
          for (let ry = 2; ry < H - 1; ry++) for (let rx = side ? W - 2 : 2; rx <= (side ? W : W - 3); rx++) p.set(hx + rx, hy + ry, ry === 2 ? 0xe8e2d0 : 0xcfc6b0);
          const ey = hy + eyeRows(c);
          if (side) p.set(hx + W - 1, ey, 0x0a0808);
          else { p.set(hx + 3, ey, 0x0a0808); p.set(hx + W - 4, ey, 0x0a0808); }
        }
      }
      break;
    }
    case 'helmet': {
      for (let ry = -2; ry <= 2; ry++) for (let rx = -1; rx <= W; rx++) {
        if (ry === -2 && (rx < 1 || rx > W - 2)) continue;
        if (side && ry >= 1 && rx > W - 1) continue;
        set(rx, ry, ry === 2 ? 1 : sh(rx) + (ry === -1 && u(rx) < 4 ? 1 : 0));
      }
      // brim
      for (let rx = -2; rx <= W + 1; rx++) set(rx, 2, rx % 2 ? 2 : 3);
      set(side ? 2 : W / 2 - 1, -2, 5);
      break;
    }
    case 'helm-paladin': {
      for (let ry = -2; ry <= H - 3; ry++) for (let rx = -1; rx <= W; rx++) {
        if (ry === -2 && (rx < 1 || rx > W - 2)) continue;
        const open = side ? (rx >= W - 3 && ry >= 2) : (rx >= 2 && rx <= W - 3 && ry >= 2 && ry <= H - 4);
        if (open && c.dir !== 'up') continue;
        set(rx, ry, sh(rx));
      }
      for (let ry = -3; ry <= 0; ry++) p.set(hx + (side ? 2 : W / 2), hy + ry, RAMPS.gold[ry === -3 ? 4 : 3]);
      break;
    }
    case 'coif': {
      for (let ry = -1; ry < H + 1; ry++) for (let rx = -1; rx <= W; rx++) {
        const open = side ? (rx >= W - 3 && ry >= 2) : (rx >= 1 && rx <= W - 2 && ry >= 2 && ry <= H - 2);
        if (open && c.dir !== 'up') continue;
        if (ry === -1 && (rx < 1 || rx > W - 2)) continue;
        set(rx, ry, (rx + ry) % 2 ? 2 : 4);
      }
      break;
    }
    case 'headscarf': {
      for (let ry = -2; ry <= 2; ry++) for (let rx = -1; rx <= W; rx++) {
        if (ry === -2 && (rx < 1 || rx > W - 2)) continue;
        if (!side && ry >= 1 && rx > 0 && rx < W - 1) continue;
        if (side && ry >= 1 && rx > 3) continue;
        set(rx, ry, sh(rx));
      }
      if (c.dir !== 'down') { const bx = side ? -2 : W / 2 - 1; set(bx, 3, 3); set(bx + 1, 3, 2); set(bx, 4, 2); }
      break;
    }
    case 'hat': {
      for (let rx = -3; rx <= W + 2; rx++) set(rx, 0, rx % 3 ? 2 : 1);
      for (let ry = -4; ry < 0; ry++) for (let rx = 0; rx < W; rx++) { if (ry === -4 && (rx < 1 || rx > W - 2)) continue; set(rx, ry, sh(rx)); }
      // feather
      p.set(hx + (side ? 0 : W - 1), hy - 5, RAMPS.red[4]); p.set(hx + (side ? -1 : W), hy - 6, RAMPS.red[3]); p.set(hx + (side ? -2 : W + 1), hy - 7, RAMPS.red[4]);
      break;
    }
    case 'jester': {
      for (let ry = -3; ry <= 1; ry++) for (let rx = -1; rx <= W; rx++) {
        if (ry === -3 && (rx < 1 || rx > W - 2)) continue;
        const left = rx < W / 2;
        p.set(hx + rx, hy + ry, left ? r[ry === 1 ? 2 : 4] : RAMPS.yellow[ry === 1 ? 2 : 3]);
      }
      p.set(hx - 2, hy - 2, r[3]); p.set(hx - 3, hy - 1, RAMPS.gold[4]);
      p.set(hx + W + 1, hy - 2, RAMPS.yellow[3]); p.set(hx + W + 2, hy - 1, RAMPS.gold[4]);
      break;
    }
  }
}

// ------------------------------------------------------------------------------------------
// Body
// ------------------------------------------------------------------------------------------

type TopStyle = string;

function topStyle(c: Ctx): TopStyle { return c.spec.top?.style ?? 'shirt'; }

function isLongGarment(c: Ctx): boolean {
  const s = topStyle(c);
  return s === 'dress' || s === 'robe' || s === 'rags';
}

function torsoBounds(c: Ctx): { x0: number; x1: number } {
  const w = c.dir === 'right' ? c.m.sideW : c.m.torsoW;
  const lean = c.dir === 'right' ? c.pose.lean : 0;
  const x0 = c.cx - Math.floor(w / 2) + lean;
  return { x0, x1: x0 + w - 1 };
}

function shoeColor(c: Ctx): Six {
  if (c.flags.has('barefoot')) return c.pal.skin;
  if (c.flags.has('clogs')) return six('straw');
  if (c.flags.has('laced-shoes')) return six('leather');
  return c.pal.leather;
}

function legColor(c: Ctx): Six {
  const b = c.spec.bottom?.style ?? 'pants';
  if (b === 'skirt' || b === 'none' || isLongGarment(c)) return c.flags.has('barefoot') || c.flags.has('clogs') || c.flags.has('laced-shoes') ? c.pal.skin : c.pal.leather;
  return c.pal.bottom;
}

function drawLegs(c: Ctx): void {
  const { p, m, pose } = c;
  const legC = legColor(c);
  const shoe = shoeColor(c);
  const boots = c.flags.has('boots');
  const top = c.hipY + 1;
  if (c.dir === 'right') {
    const hx = c.cx - 1;
    const legs: [typeof pose.footF, boolean][] = [[pose.footF, false], [pose.footN, true]];
    for (const [foot, near] of legs) {
      const fx = hx + Math.round(foot.x * m.s);
      const fy = m.ground + foot.y;
      const bend = (foot.y < 0 ? 1 : 0) + Math.floor(pose.crouch / 2);
      const kx = Math.round((hx + fx) / 2) + bend, ky = Math.round((top + fy) / 2);
      const w = Math.max(2, m.legW - 1);
      const shade = (x: number, y: number, k: number) => {
        let i = near ? (k === 0 ? 4 : 3) : 2;
        if (boots && y >= fy - 2) return c.pal.leather[near ? (k === 0 ? 3 : 2) : 1];
        if (!near) i = 2;
        return legC[i];
      };
      thickLine(p, hx, top, kx, ky, w, shade);
      thickLine(p, kx, ky, fx, fy - 1, w, shade);
      // shoe pointing forward
      for (let k = 0; k < 3 + (m.legW > 3 ? 1 : 0); k++) p.set(fx - 1 + k, fy, shoe[near ? (k === 2 ? 4 : 3) : 2]);
      p.set(fx - 1, fy - 1, shoe[near ? 3 : 2]);
      if (c.flags.has('laced-shoes')) p.set(fx, fy - 1, RAMPS.cream[3]);
    }
    return;
  }
  // front / back views
  const gap = m.legGap;
  const lx0 = c.cx - Math.ceil(gap / 2) - m.legW, rx0 = c.cx + Math.floor(gap / 2);
  const nearIsLeft = c.dir === 'down';
  const legsFB: [number, typeof pose.footN][] = [[lx0, nearIsLeft ? pose.footN : pose.footF], [rx0, nearIsLeft ? pose.footF : pose.footN]];
  for (const [x0, foot] of legsFB) {
    const lift = Math.min(0, foot.y) - (pose.crouch > 2 ? 0 : 0);
    const fy = m.ground + lift;
    for (let y = top; y < fy; y++) for (let k = 0; k < m.legW; k++) {
      const x = x0 + k;
      let cc = col(c, legC, x, x0, x0 + m.legW - 1, 3);
      if (boots && y >= fy - 2) cc = col(c, c.pal.leather, x, x0, x0 + m.legW - 1, 2);
      p.set(x, y, cc);
    }
    for (let k = 0; k < m.legW; k++) p.set(x0 + k, fy, col(c, shoe, x0 + k, x0, x0 + m.legW - 1, c.dir === 'down' ? 3 : 2));
    if (c.flags.has('laced-shoes')) p.set(x0 + (m.legW > 1 ? 1 : 0), fy - 1, RAMPS.cream[3]);
    if (c.flags.has('clogs') && c.dir === 'down') p.set(x0, fy, six('straw')[4]);
  }
}

/** Long garments (dress, robe), skirts and coat tails over the legs. */
function drawLowerGarment(c: Ctx): void {
  const { p, m, pose, pal } = c;
  const st = topStyle(c);
  const b = c.spec.bottom?.style ?? 'pants';
  const top = c.hipY + 1;
  const { x0, x1 } = torsoBounds(c);
  let r: Six | null = null, bottomRow = top, flare = 1;
  if (st === 'dress' || st === 'robe' || st === 'rags') { r = pal.top; bottomRow = m.ground - 1; flare = st === 'robe' ? 1 : 2; }
  else if (b === 'skirt') { r = pal.bottom; bottomRow = top + Math.round((m.ground - top) * 0.6); flare = 1; }
  else if (st === 'tunic' || st === 'tabard' || st === 'motley') { r = st === 'tabard' ? pal.top : pal.top; bottomRow = top + 1; flare = 0; }
  else if (st === 'coat') { r = pal.top; bottomRow = top + Math.round((m.ground - top) * 0.6); flare = 1; }
  if (c.cloakIsCoat) { r = pal.cloak; bottomRow = top + Math.round((m.ground - top) * 0.55); flare = 1; }
  if (!r) return;
  const rows = bottomRow - top + 1;
  if (c.dir === 'right') {
    const back = Math.min(pose.footF.x, pose.footN.x), front = Math.max(pose.footF.x, pose.footN.x);
    for (let i = 0; i < rows; i++) {
      const y = top + i;
      const t = i / Math.max(1, rows - 1);
      const k = st === 'dress' || st === 'robe' || st === 'rags' ? 0.6 : 0.3;
      const xa = x0 - Math.round(flare * t) + Math.round(Math.min(0, back) * m.s * t * k);
      const xb = x1 + Math.round(flare * t) + Math.round(Math.max(0, front) * m.s * t * k);
      for (let x = xa; x <= xb; x++) {
        let cc = col(c, r as Six, x, xa, xb, 3);
        if (i === rows - 1) cc = r[2];
        if (st === 'robe' && c.spec.top?.trim && i === rows - 1) cc = pal.trim[3];
        if (st === 'rags' && i === rows - 1 && (x % 2)) continue;
        p.set(x, y, cc);
      }
    }
    return;
  }
  const liftL = Math.min(0, (c.dir === 'down' ? pose.footN : pose.footF).y);
  const liftR = Math.min(0, (c.dir === 'down' ? pose.footF : pose.footN).y);
  for (let i = 0; i < rows; i++) {
    const y = top + i;
    const t = i / Math.max(1, rows - 1);
    const xa = x0 - Math.round(flare * t), xb = x1 + Math.round(flare * t);
    for (let x = xa; x <= xb; x++) {
      // the hem rises over a lifted foot
      const lift = x < c.cx ? liftL : liftR;
      if (i === rows - 1 && lift < 0) continue;
      let cc = col(c, r, x, xa, xb, 3);
      if (i === rows - 1) cc = r[2];
      // coat opening in the front
      if ((st === 'coat' || c.cloakIsCoat) && c.dir === 'down' && x >= c.cx - 1 && x <= c.cx) continue;
      if (st === 'robe' && c.dir === 'down' && x >= c.cx - 1 && x <= c.cx) cc = pal.trim[x < c.cx ? 4 : 3];
      if (st === 'robe' && i === rows - 1) cc = pal.trim[3];
      if (st === 'tabard') cc = tabardColor(c, x, y, x0, x1);
      if (st === 'rags' && i === rows - 1 && (x % 2)) continue;
      if (st === 'motley') cc = ((x + y) % 4 < 2) ? pal.top[3] : pal.trim[3];
      p.set(x, y, cc);
    }
  }
}

function tabardColor(c: Ctx, x: number, y: number, x0: number, x1: number): number {
  const { pal } = c;
  const mid = c.cx;
  const midY = c.shoulderY + Math.floor((c.hipY - c.shoulderY) / 2) + 1;
  // Dunkelschatten: black-white quartered. Others: field colour with a trim cross.
  const black = c.spec.top?.color === 'black';
  if (black) {
    const q = (x < mid) !== (y < midY);
    return q ? pal.trim[x === x0 ? 4 : 3] : pal.top[x === x1 ? 1 : 2];
  }
  if (x === mid - 1 || x === mid) return pal.trim[x === mid - 1 ? 4 : 3];
  return col(c, pal.top, x, x0, x1, 3);
}

function drawTorso(c: Ctx): void {
  const { p, pal, m } = c;
  const st = topStyle(c);
  const { x0, x1 } = torsoBounds(c);
  const belly = c.flags.has('belly');
  const y0 = c.shoulderY, y1 = c.hipY;
  for (let y = y0; y <= y1; y++) {
    const row = y - y0;
    let xa = x0, xb = x1;
    if (row === 0) { xa++; xb--; }
    if (belly && row >= 2 && row <= 5) { xa -= 1; xb += c.dir === 'right' ? 1 : 1; }
    for (let x = xa; x <= xb; x++) {
      let cc = col(c, pal.top, x, xa, xb, 3);
      const front = c.dir !== 'up';
      switch (st) {
        case 'blouse': {
          cc = col(c, pal.top, x, xa, xb, 4);
          if (front && row <= 1 && c.dir === 'down' && (x === c.cx - 1 || x === c.cx)) cc = pal.skin[row === 0 ? 3 : 4];
          if (row === 1 && c.dir === 'down' && (x === c.cx - 2 || x === c.cx + 1)) cc = pal.top[5];
          break;
        }
        case 'shirt': case 'tunic': {
          if (front && row === 0 && c.dir === 'down' && (x === c.cx - 1 || x === c.cx)) cc = pal.skin[3];
          if (st === 'tunic' && c.spec.top?.trim && c.dir === 'down' && (x === c.cx - 1 || x === c.cx) && row > 0) cc = pal.trim[x === c.cx - 1 ? 4 : 3];
          break;
        }
        case 'vest': {
          const inner = c.dir === 'down' ? (x >= c.cx - 1 && x <= c.cx) : c.dir === 'right' ? x >= x1 - 1 : false;
          cc = inner ? col(c, pal.trim, x, xa, xb, 4) : col(c, pal.top, x, xa, xb, 3);
          if (inner && row === 0) cc = pal.skin[3];
          break;
        }
        case 'dress': {
          cc = col(c, pal.top, x, xa, xb, 3);
          if (c.dir === 'down' && row === 0 && (x === c.cx - 1 || x === c.cx)) cc = pal.skin[3];
          if (row === Math.floor((y1 - y0) * 0.6)) cc = pal.top[2];
          break;
        }
        case 'robe': {
          if (c.dir === 'down' && (x === c.cx - 1 || x === c.cx)) cc = pal.trim[x === c.cx - 1 ? 4 : 3];
          if (c.dir === 'down' && row === 0 && x >= c.cx - 1 && x <= c.cx) cc = pal.skin[3];
          if (c.dir === 'right' && x === x1) cc = pal.trim[3];
          break;
        }
        case 'coat': {
          const inner = c.dir === 'down' && (x >= c.cx - 1 && x <= c.cx);
          cc = inner ? six('linen')[row === 0 ? 4 : 3] : col(c, pal.top, x, xa, xb, 3);
          if (c.dir === 'down' && (x === c.cx - 2 || x === c.cx + 1)) cc = pal.top[2];
          break;
        }
        case 'tabard': {
          cc = c.dir === 'right' ? tabardSide(c, x, y, xa, xb) : tabardColor(c, x, y, xa, xb);
          if (row === 0 && c.dir === 'down' && x >= c.cx - 1 && x <= c.cx) cc = mailColor(c, x, y);
          break;
        }
        case 'plate': {
          const band = row % 3 === 2;
          cc = col(c, pal.top, x, xa, xb, band ? 2 : 3);
          const u = c.L ? x - xa : xb - x;
          if (u === 1 && !band) cc = pal.top[5];
          if (c.dir === 'down' && x === c.cx - 1 && row > 0 && !band) cc = pal.top[4];
          break;
        }
        case 'mail': {
          cc = mailColor(c, x, y);
          if (c.spec.top?.trim && c.dir === 'down' && row >= 2 && (x === c.cx - 1 || x === c.cx)) cc = pal.trim[3];
          break;
        }
        case 'leather': {
          cc = col(c, pal.top, x, xa, xb, 3);
          if ((x + row) % 4 === 0 && row > 0) cc = pal.top[2];
          if (c.dir === 'down' && (x === c.cx - 1) && row > 0) cc = pal.trim[3];
          break;
        }
        case 'motley': {
          cc = ((x + y) % 4 < 2) ? col(c, pal.top, x, xa, xb, 3) : col(c, pal.trim, x, xa, xb, 3);
          break;
        }
        case 'rags': {
          cc = col(c, pal.top, x, xa, xb, 3);
          if (hash2(x, y, 3) > 0.8) cc = pal.trim[2];
          break;
        }
      }
      if (row === y1 - y0 && st !== 'robe' && st !== 'dress') cc = shift(cc, -0.15);
      p.set(x, y, cc);
    }
  }
  // belt
  if ((c.flags.has('belt') || st === 'tunic' || st === 'tabard') && st !== 'robe') {
    const by = y0 + Math.round((y1 - y0) * 0.72);
    for (let x = x0; x <= x1; x++) p.set(x, by, c.pal.leather[x === x0 ? 3 : 2]);
    if (c.dir === 'down') p.set(c.cx - 1, by, RAMPS.gold[3]);
  }
  // sashes
  const sash = c.flags.has('sash-blue') ? six('blue') : c.flags.has('sash-gold') ? six('gold') : null;
  if (sash && c.dir !== 'right') {
    for (let y = y0 + 1; y <= y1; y++) {
      const x = c.dir === 'down' ? x0 + (y - y0) : x1 - (y - y0);
      if (x >= x0 && x <= x1) { p.set(x, y, sash[4]); p.set(x + 1 <= x1 ? x + 1 : x, y, sash[3]); }
    }
  }
  if (sash && c.dir === 'right') { const by = y0 + Math.round((y1 - y0) * 0.72); for (let x = x0; x <= x1; x++) p.set(x, by, sash[3]); }
  // apron
  if (c.flags.has('apron') && c.dir !== 'up') {
    const a = six('cream');
    const ay = y0 + Math.round((y1 - y0) * 0.45);
    const ax0 = c.dir === 'down' ? x0 + 1 : x1 - 1, ax1 = c.dir === 'down' ? x1 - 1 : x1 + 1;
    for (let y = ay; y <= Math.min(m.ground - 2, c.hipY + 4); y++) for (let x = ax0; x <= ax1; x++) p.set(x, y, col(c, a, x, ax0, ax1, 4));
    if (c.dir === 'down') { for (let y = y0; y < ay; y++) { p.set(x0 + 1, y, a[4]); p.set(x1 - 1, y, a[3]); } }
  }
  // necklace / brooch
  if (c.flags.has('necklace') && c.dir === 'down') { p.set(c.cx - 1, y0 + 1, RAMPS.gold[4]); p.set(c.cx, y0 + 1, RAMPS.cornflower[3]); }
  if (c.flags.has('brooch') && c.dir !== 'up') p.set(c.dir === 'down' ? c.cx - 2 : x1 - 1, y0 + 2, RAMPS.gold[4]);
  // wound under the right ribs (character's right = screen-left in front view)
  if (c.flags.has('wounded') && c.dir !== 'up') {
    const wx = c.dir === 'down' ? x0 + 1 : x1 - 2, wy = y0 + Math.round((y1 - y0) * 0.55);
    p.set(wx, wy, RAMPS.red[2]); p.set(wx + 1, wy, RAMPS.red[3]); p.set(wx, wy + 1, RAMPS.red[1]);
  }
  // pauldrons
  if (c.flags.has('pauldrons')) {
    const r = pal.top;
    const xs = c.dir === 'right' ? [[x0 + 1, x1]] : [[x0 - 2, x0 + 1], [x1 - 1, x1 + 2]];
    for (const [a, b] of xs) for (let y = y0 - 1; y <= y0 + 1; y++) for (let x = a; x <= b; x++) p.set(x, y, col(c, r, x, a, b, y === y0 - 1 ? 4 : 3));
  }
  // satchel strap & bag
  if (c.flags.has('satchel')) {
    const lr = c.pal.leather;
    if (c.dir === 'down') { for (let y = y0; y <= y1; y++) { const x = x1 - (y - y0) + 1; if (x >= x0) p.set(x, y, lr[2]); } }
    if (c.dir === 'up') { for (let y = y0; y <= y1; y++) { const x = x0 + (y - y0) - 1; if (x <= x1) p.set(x, y, lr[2]); } }
  }
  // quiver strap (front) — quiver itself drawn on the back layer
  if (c.flags.has('quiver') && c.dir === 'down') for (let y = y0; y <= y1 - 1; y++) { const x = x0 + (y - y0); if (x <= x1) p.set(x, y, c.pal.leather[2]); }
}

function tabardSide(c: Ctx, x: number, y: number, xa: number, xb: number): number {
  const black = c.spec.top?.color === 'black';
  if (x <= xa + 1) return mailColor(c, x, y);
  if (black) return y < c.shoulderY + (c.hipY - c.shoulderY) / 2 ? c.pal.trim[3] : c.pal.top[2];
  return col(c, c.pal.top, x, xa, xb, 3);
}

function mailColor(c: Ctx, x: number, y: number): number {
  const s = c.pal.steel;
  return (x + y) % 2 ? s[2] : s[3 + ((x * 3 + y) % 5 === 0 ? 1 : 0)];
}

/** Sleeve colour for an arm. */
function sleeve(c: Ctx): Six {
  const st = topStyle(c);
  if (c.cloakIsCoat) return c.pal.cloak;
  if (st === 'vest') return c.pal.trim;
  if (st === 'tabard' || c.flags.has('mail-sleeves')) return c.pal.steel;
  if (st === 'plate') return c.pal.top;
  return c.pal.top;
}

function handColor(c: Ctx): Six {
  return c.flags.has('gloves') ? six('black') : c.pal.skin;
}

function shoulderPoint(c: Ctx, near: boolean): { x: number; y: number } {
  const { x0, x1 } = torsoBounds(c);
  if (c.dir === 'right') return { x: c.cx + c.pose.lean - (near ? 0 : 1), y: c.shoulderY + 1 };
  const leftIsNear = c.dir === 'down';
  const left = { x: x0 - c.m.armW, y: c.shoulderY + 1 };
  const right = { x: x1 + 1, y: c.shoulderY + 1 };
  return near === leftIsNear ? left : right;
}

function handPoint(c: Ctx, near: boolean): { x: number; y: number } {
  const sp = shoulderPoint(c, near);
  const h = near ? c.pose.handN : c.pose.handF;
  const m = c.m;
  if (c.dir === 'right') return { x: sp.x + Math.round(h.x * m.s), y: sp.y + m.armLen + Math.round(h.y * m.s) };
  // front/back: forward reach pulls the hand inward
  const isLeft = sp.x < c.cx;
  const inward = h.x > 1 ? Math.min(m.armW + 1, h.x - 1) : 0;
  const out = h.y < -5 ? 1 : 0;
  return { x: sp.x + (isLeft ? inward - out : -inward + out), y: sp.y + m.armLen + Math.round(h.y * m.s) + (h.x < -1 ? 0 : 0) };
}

function drawArm(c: Ctx, near: boolean): void {
  if (c.pose.behind) return;
  const { p, m } = c;
  const sp = shoulderPoint(c, near);
  const hp = handPoint(c, near);
  const sl = sleeve(c);
  const hand = handColor(c);
  const darker = c.dir === 'right' && !near;
  const st = topStyle(c);
  const bell = st === 'robe';
  const short = st === 'blouse' ? false : false;
  void short;
  if (c.dir === 'right') {
    const ex = Math.round((sp.x + hp.x) / 2) - (hp.y < sp.y + 2 ? 1 : 0), ey = Math.round((sp.y + hp.y) / 2) + (Math.abs(hp.x - sp.x) > 2 ? 1 : 0);
    const w = m.armW;
    const shade = (_x: number, _y: number, k: number) => sl[darker ? 1 : k === 0 ? (c.L ? 4 : 2) : (c.L ? 2 : 4)];
    if (near) {
      // dark seam behind the near arm so it reads against the torso
      const back = c.L ? -1 : w;
      const seam = () => sl[1];
      thickLine(p, sp.x + back, sp.y + 1, ex + back, ey, 1, seam);
      thickLine(p, ex + back, ey, hp.x + back, hp.y - 1, 1, seam);
    }
    thickLine(p, sp.x, sp.y, ex, ey, w, shade);
    thickLine(p, ex, ey, hp.x, hp.y - 1, w, shade);
    if (bell) p.set(hp.x - 1, hp.y - 1, sl[darker ? 1 : 2]);
    if (c.flags.has('bracers')) p.set(ex + Math.sign(hp.x - ex), ey + 1, c.pal.leather[darker ? 1 : 3]);
    for (let k = 0; k < Math.max(1, m.armW - 1); k++) p.set(hp.x + k, hp.y, hand[darker ? 2 : 4]);
    p.set(hp.x, hp.y + (m.armW > 2 ? 1 : 0), hand[darker ? 2 : 3]);
    return;
  }
  // front/back: arm column from shoulder to hand
  const w = m.armW;
  const steps = Math.max(1, hp.y - sp.y);
  const isLeftArm = sp.x < c.cx;
  const armTone = (xx: number, x: number) => {
    const inner = isLeftArm ? x + w - 1 : x;
    if (xx === inner) return sl[2];
    return col(c, sl, xx, x, x + w - 1, 3);
  };
  for (let i = 0; i <= steps; i++) {
    const y = sp.y + Math.min(i, hp.y - sp.y);
    const x = Math.round(sp.x + (hp.x - sp.x) * (i / steps));
    for (let k = 0; k < w; k++) {
      const xx = x + k;
      p.set(xx, y, armTone(xx, x));
    }
  }
  if (hp.y < sp.y) {
    // raised arm: draw upward
    for (let y = hp.y; y <= sp.y; y++) for (let k = 0; k < w; k++) p.set(hp.x + k, y, armTone(hp.x + k, hp.x));
  }
  if (bell) for (let k = -1; k <= w; k++) p.set(hp.x + k, hp.y - 1, sl[2]);
  if (c.flags.has('bracers')) for (let k = 0; k < w; k++) p.set(hp.x + k, hp.y - 1, c.pal.leather[3]);
  for (let k = 0; k < w; k++) p.set(hp.x + k, hp.y, col(c, hand, hp.x + k, hp.x, hp.x + w - 1, 4));
  if (m.armW > 2) for (let k = 0; k < w; k++) p.set(hp.x + k, hp.y + 1, hand[3]);
}

function drawBoundArms(c: Ctx): void {
  if (!c.pose.behind) return;
  const { p } = c;
  const { x0, x1 } = torsoBounds(c);
  const sl = sleeve(c);
  const y = c.shoulderY + 1;
  if (c.dir === 'down') {
    // upper arms visible at the sides, bent back
    for (let k = 0; k < 4; k++) { p.set(x0 - 1, y + k, sl[3]); p.set(x1 + 1, y + k, sl[2]); }
  } else if (c.dir === 'up') {
    for (let k = 0; k < 4; k++) { p.set(x0 - 1, y + k, sl[3]); p.set(x1 + 1, y + k, sl[2]); }
    const hy = c.shoulderY + Math.round((c.hipY - c.shoulderY) * 0.75);
    for (let x = x0 + 1; x <= x1 - 1; x++) p.set(x, hy, c.pal.skin[3]);
    // rope
    for (let x = x0 + 2; x <= x1 - 2; x++) p.set(x, hy + 1, RAMPS.straw[2]);
  } else {
    for (let k = 0; k < 4; k++) p.set(x0 - 1 + (k > 2 ? -1 : 0), y + k, sl[3]);
    p.set(x0 - 2, y + 4, c.pal.skin[3]); p.set(x0 - 2, y + 5, RAMPS.straw[2]);
  }
  void x1;
}

// ------------------------------------------------------------------------------------------
// Cloak
// ------------------------------------------------------------------------------------------

function cloakKind(c: Ctx): string | null { return c.spec.cloak?.style ?? null; }

function drawCloakBack(c: Ctx): void {
  const k = cloakKind(c);
  if (!k || c.cloakIsCoat && c.dir !== 'up') return;
  const { p, m, pal } = c;
  const { x0, x1 } = torsoBounds(c);
  const r = pal.cloak;
  const len = k === 'cape' ? Math.round((m.ground - c.shoulderY) * 0.7) : m.ground - c.shoulderY - 1;
  const bottom = c.shoulderY + len;
  if (c.dir === 'down') {
    // cloak hangs behind: visible at the sides from the shoulders down
    for (let y = c.shoulderY; y <= bottom; y++) {
      const t = (y - c.shoulderY) / len;
      const spread = 1 + Math.round(t * 2);
      for (let x = x0 - m.armW - spread + 1; x <= x1 + m.armW + spread - 1; x++) {
        if (y === bottom && k === 'worn' && x % 2) continue;
        p.set(x, y, col(c, r, x, x0 - m.armW - spread + 1, x1 + m.armW + spread - 1, 2));
      }
    }
  } else if (c.dir === 'right') {
    const sway = c.pose.cloak;
    for (let y = c.shoulderY; y <= bottom; y++) {
      const t = (y - c.shoulderY) / len;
      const back = x0 - 1 - Math.round(t * (1 + sway));
      for (let x = back; x <= x0 + 1; x++) {
        if (y === bottom && k === 'worn' && x % 2) continue;
        p.set(x, y, r[x === back ? 2 : 3]);
      }
    }
  }
}

function drawCloakFront(c: Ctx): void {
  const k = cloakKind(c);
  if (!k) return;
  const { p, m, pal } = c;
  const { x0, x1 } = torsoBounds(c);
  const r = pal.cloak;
  const len = k === 'cape' ? Math.round((m.ground - c.shoulderY) * 0.7) : k === 'hunter' ? Math.round((m.ground - c.shoulderY) * 0.72) : m.ground - c.shoulderY - 1;
  const bottom = c.shoulderY + len;
  const hooded = k === 'hooded' || k === 'worn' || k === 'hunter';
  if (c.dir === 'up') {
    // cloak covers the whole back
    for (let y = c.shoulderY - 1; y <= bottom; y++) {
      const t = (y - c.shoulderY) / len;
      const spread = Math.round(t * 2) + (y < c.shoulderY + 1 ? -1 : 0);
      const xa = x0 - m.armW - spread + (k === 'hunter' ? 1 : 0), xb = x1 + m.armW + spread - (k === 'hunter' ? 1 : 0);
      for (let x = xa; x <= xb; x++) {
        if (y === bottom && (k === 'worn' || k === 'hunter') && (x + y) % 2) continue;
        let cc = col(c, r, x, xa, xb, 3);
        const fold = (x - c.cx + 40) % 4 === 0 && y > c.shoulderY + 2;
        if (fold) cc = r[2];
        if (k === 'worn' && hash2(x, y, 5) > 0.88) cc = c.pal.cloakTrim[3];
        p.set(x, y, cc);
      }
    }
    if (hooded) {
      // hood lying on the back of the shoulders
      for (let y = c.shoulderY - 1; y <= c.shoulderY + 2; y++) for (let x = c.cx - 3; x <= c.cx + 2; x++) p.set(x, y, r[y === c.shoulderY + 2 ? 2 : y === c.shoulderY - 1 ? 4 : 3]);
    }
    return;
  }
  if (c.dir === 'down') {
    // cloak edges over the shoulders + clasp; hood bunched behind the neck
    for (let y = c.shoulderY; y <= c.shoulderY + 1; y++) for (let x = x0 - m.armW; x <= x1 + m.armW; x++) {
      if (x > x0 + 1 && x < x1 - 1 && y === c.shoulderY + 1) continue;
      p.set(x, y, col(c, r, x, x0 - m.armW, x1 + m.armW, 3));
    }
    if (hooded) for (let x = c.cx - 3; x <= c.cx + 2; x++) p.set(x, c.shoulderY - 1, r[x < c.cx ? 4 : 3]);
    if (!c.cloakIsCoat) { p.set(c.cx - 2, c.shoulderY + 1, RAMPS.gold[4]); p.set(c.cx + 1, c.shoulderY + 1, RAMPS.gold[3]); }
    // front panels of the cloak along the sides (over the arms when hanging)
    for (let y = c.shoulderY + 2; y <= bottom; y++) {
      const spread = Math.round(((y - c.shoulderY) / len) * 1.5);
      for (const x of [x0 - m.armW - spread, x1 + m.armW + spread]) p.set(x, y, r[x < c.cx ? 3 : 2]);
    }
    return;
  }
  // side view: hood behind the head, shoulder cover
  if (hooded) for (let y = c.shoulderY - 2; y <= c.shoulderY + 1; y++) for (let x = c.headX - 1; x <= c.headX + 2; x++) p.set(x, y, r[y === c.shoulderY - 2 ? 4 : 3]);
  for (let x = x0; x <= x1; x++) p.set(x, c.shoulderY, r[4]);
}

// ------------------------------------------------------------------------------------------
// Back items: quiver, satchel bag, shield
// ------------------------------------------------------------------------------------------

function drawQuiverBack(c: Ctx, front: boolean): void {
  if (!c.flags.has('quiver')) return;
  const { p } = c;
  const lr = c.pal.leather;
  const { x0, x1 } = torsoBounds(c);
  if (c.dir === 'up' && front) {
    for (let i = 0; i < 8; i++) { const x = x0 + 1 + Math.floor(i / 2), y = c.shoulderY - 2 + i; p.set(x, y, lr[3]); p.set(x + 1, y, lr[2]); }
    p.set(x0, c.shoulderY - 3, RAMPS.cream[4]); p.set(x0 + 1, c.shoulderY - 4, RAMPS.red[3]); p.set(x0 - 1, c.shoulderY - 3, RAMPS.cream[3]);
  } else if (c.dir === 'down' && !front) {
    p.set(x1 + 1, c.shoulderY - 2, RAMPS.cream[4]); p.set(x1 + 2, c.shoulderY - 3, RAMPS.red[3]); p.set(x1, c.shoulderY - 2, RAMPS.cream[3]);
  } else if (c.dir === 'right' && !front) {
    for (let i = 0; i < 7; i++) { p.set(x0 - 2 + Math.floor(i / 3), c.shoulderY - 1 + i, lr[3]); p.set(x0 - 1 + Math.floor(i / 3), c.shoulderY - 1 + i, lr[2]); }
    p.set(x0 - 3, c.shoulderY - 2, RAMPS.cream[4]); p.set(x0 - 2, c.shoulderY - 3, RAMPS.red[3]);
  }
}

function drawSatchelBag(c: Ctx): void {
  if (!c.flags.has('satchel')) return;
  const { p } = c;
  const lr = c.pal.leather;
  const { x0, x1 } = torsoBounds(c);
  const by = c.hipY - 1;
  const bx = c.dir === 'down' ? x0 - 3 : c.dir === 'up' ? x1 + 1 : x0 - 1;
  for (let y = by; y < by + 4; y++) for (let x = bx; x < bx + 4; x++) p.set(x, y, col(c, lr, x, bx, bx + 3, y === by ? 4 : 3));
  p.set(bx + 1, by + 1, RAMPS.gold[3]);
}

function drawShield(c: Ctx): void {
  const sh = c.spec.shield;
  if (!sh || c.pose.weaponHidden) return;
  const { p } = c;
  const far = handPoint(c, false);
  const r = c.dir === 'right' ? 3 : 3.5;
  const cx = c.dir === 'right' ? far.x + 1 : far.x + (far.x < c.cx ? -1 : 2);
  const cy = far.y - 2;
  const dark = sh === 'shadow';
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
    let cc = dark ? ((x < cx) !== (y < cy) ? RAMPS.white[3] : RAMPS.black[2]) : (Math.abs(x + 0.5 - cx) < 1 ? RAMPS.gold[3] : RAMPS.white[3]);
    if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > (r - 1) * (r - 1)) cc = RAMPS.steel[3];
    p.set(x, y, cc);
  }
}

// ------------------------------------------------------------------------------------------
// Weapons & items
// ------------------------------------------------------------------------------------------

function drawWeapon(c: Ctx, angle: number | undefined, hand: { x: number; y: number }, kind: WeaponKind, near: boolean): void {
  if (angle === undefined || kind === 'none') return;
  if (kind === 'crossbow' && c.dir !== 'right' && !c.pose.arrow) return;
  const { p, m } = c;
  const s = m.s;
  const st = RAMPS.steel, wd = RAMPS.wood;
  // in front/back views use a foreshortened angle (point down/up)
  let a = angle;
  if (c.dir !== 'right') a = angle < -1 ? -Math.PI / 2 : angle > 0.4 ? Math.PI / 2 : (angle < 0 ? -Math.PI / 2 : Math.PI / 2);
  const dx = Math.cos(a), dy = Math.sin(a);
  const at = (t: number) => ({ x: Math.round(hand.x + dx * t), y: Math.round(hand.y + dy * t) });
  const line = (t0: number, t1: number, cfn: (t: number) => number) => {
    const n = Math.max(1, Math.ceil(Math.abs(t1 - t0)));
    for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * (i / n); const q = at(t); p.set(q.x, q.y, cfn(t)); }
  };
  const perp = (t: number, k: number, cc: number) => { const q = at(t); p.set(Math.round(q.x - dy * k), Math.round(q.y + dx * k), cc); };
  const dim = !near && c.dir === 'right';
  switch (kind) {
    case 'sword': case 'twin-swords': case 'scimitar': case 'dagger': {
      const len = (kind === 'dagger' ? 3 : kind === 'twin-swords' ? 5 : 7) * s;
      line(-2, -1, () => RAMPS.leather[3]);
      perp(0, -1, RAMPS.gold[3]); perp(0, 1, RAMPS.gold[2]); perp(0, 0, RAMPS.gold[4]);
      line(1, len, t => {
        if (kind === 'scimitar') { const q = at(t); const bend = Math.round(((t / len) ** 2) * 2); p.set(q.x - Math.round(dy * bend), q.y + Math.round(dx * bend), st[t > len - 1 ? 6 : 5]); return st[3]; }
        return dim ? st[3] : t > len - 1 ? st[6] : st[5];
      });
      if (kind !== 'scimitar') line(1, len - 1, t => (dim ? st[2] : st[3]));
      // second blade column for thickness when vertical-ish
      if (Math.abs(dx) < 0.5 && kind !== 'dagger') for (let t = 1; t < len - 1; t++) { const q = at(t); p.set(q.x + 1, q.y, st[dim ? 2 : 3]); }
      break;
    }
    case 'axe': {
      const len = 9 * s;
      line(-3, len, () => (dim ? wd[1] : wd[3]));
      // head: a wedge perpendicular at the end (blade facing forward/down)
      const headT = len - 1;
      for (let k = 1; k <= Math.round(3 * s); k++) for (let t = headT - Math.round(2 * s); t <= headT + 1; t++) {
        const q = at(t);
        const xx = Math.round(q.x - dy * k * (c.dir === 'right' ? 1 : 1)), yy = Math.round(q.y + dx * k);
        p.set(xx, yy, k === Math.round(3 * s) ? st[6] : t === headT + 1 ? st[3] : st[4]);
      }
      break;
    }
    case 'club': {
      const len = 7 * s;
      line(-2, len, t => (t > len - 3 ? wd[4] : wd[2]));
      for (let t = len - 3; t <= len; t++) perp(t, 1, wd[2]);
      perp(len - 1, -1, RAMPS.iron[3]);
      break;
    }
    case 'spear': case 'staff': {
      const len = 9 * s, back = 6 * s;
      line(-back, len, () => (dim ? wd[2] : wd[4]));
      if (kind === 'spear') { const tip = at(len + 1), tip2 = at(len + 2); p.set(tip.x, tip.y, st[5]); p.set(tip2.x, tip2.y, st[6]); perp(len, 1, st[3]); perp(len, -1, st[4]); }
      break;
    }
    case 'bow': {
      // vertical bow arc held at the hand, curving toward facing direction
      const h = Math.round(6 * s);
      const fwd = c.dir === 'right' ? 1 : 0;
      const pull = Math.round((c.pose.bowDraw ?? 0) * 3);
      for (let i = -h; i <= h; i++) {
        const bend = Math.round((1 - (i / h) ** 2) * 2);
        const x = hand.x + (c.dir === 'right' ? bend : 0) * fwd, y = hand.y + i;
        p.set(x, y, Math.abs(i) > h - 2 ? wd[2] : wd[4]);
        if (c.dir !== 'right') p.set(x + 1, y, wd[2]);
      }
      // string
      for (let i = -h + 1; i < h; i++) {
        const x = hand.x - (c.dir === 'right' ? Math.round((1 - Math.abs(i) / h) * pull) : 0);
        if (c.dir === 'right') p.set(x, hand.y + i, RAMPS.cream[3]);
      }
      if (c.pose.arrow && c.dir === 'right') for (let k = -pull - 1; k < 5; k++) p.set(hand.x + k, hand.y, k > 3 ? st[5] : wd[3]);
      break;
    }
    case 'crossbow': {
      const len = 6;
      line(-2, len, () => wd[3]);
      const end = len;
      for (let k = -3; k <= 3; k++) perp(end, k, Math.abs(k) === 3 ? wd[2] : wd[4]);
      if (c.pose.arrow) line(1, len + 1, () => st[4]);
      break;
    }
    case 'lute': {
      const q = at(1);
      p.ellipse(q.x + 0.5, q.y + 1.5, 2.5, 2, wd[4]); p.set(q.x, q.y + 1, wd[1]);
      line(2, 6, () => wd[2]);
      break;
    }
  }
}

function drawItem(c: Ctx): void {
  const it = c.pose.item;
  if (!it) return;
  const { p } = c;
  const hn = handPoint(c, true), hf = handPoint(c, false);
  const x = Math.min(hn.x, hf.x), y = Math.min(hn.y, hf.y);
  if (it === 'bundle') {
    const cx = c.dir === 'right' ? hn.x + 1 : c.cx - 1;
    p.ellipse(cx, y - 1, 2.5, 2, RAMPS.stone[3]); p.set(cx - 1, y - 2, RAMPS.stone[5]);
    return;
  }
  const cover = RAMPS.red;
  const page = RAMPS.cream;
  if (c.dir === 'right') {
    const bx = hn.x - 1, by = hn.y - 3;
    for (let yy = 0; yy < 4; yy++) { p.set(bx, by + yy, cover[2]); p.set(bx + 1, by + yy, page[4]); p.set(bx + 2, by + yy, page[3]); }
    if (it === 'book-flip') p.set(bx + 2, by - 1, page[5]);
  } else if (c.dir === 'down') {
    const bx = c.cx - 3, by = y - 2;
    for (let xx = 0; xx < 6; xx++) for (let yy = 0; yy < 3; yy++) p.set(bx + xx, by + yy, yy === 2 ? cover[2] : xx === 2 || xx === 3 ? page[3] : page[4]);
    if (it === 'book-flip') { p.set(bx + 3, by - 1, page[5]); p.set(bx + 4, by - 1, page[4]); }
    void x;
  } else {
    const bx = c.cx - 3, by = y - 2;
    for (let xx = 0; xx < 6; xx++) for (let yy = 0; yy < 3; yy++) p.set(bx + xx, by + yy, cover[yy === 0 ? 3 : 2]);
  }
}

// ------------------------------------------------------------------------------------------
// Composition
// ------------------------------------------------------------------------------------------

export interface FrameOptions { flipLight?: boolean }

/** Near-hand position of the last drawn standing frame (for the magic glow). */
let lastHand = { x: -1, y: -1 };

function drawStanding(spec: Preset, m: Metrics, pose: Pose, dir: 'down' | 'up' | 'right', L: boolean, pal: Pal, flags: Set<string>, weapon: WeaponKind): Px {
  const p = new Px(m.fw, m.fh);
  const cx = m.cx;
  const sitting = pose.special === 'sit' || pose.special === 'sitread';
  const kneeling = pose.special === 'kneel';
  const sitDrop = sitting ? Math.round(5 * m.s) : 0;
  const upper = pose.crouch + pose.bob + sitDrop;
  const c: Ctx = {
    p, m, pal, spec, pose, dir, L, flags, weapon, cx,
    shoulderY: m.shoulder + upper,
    hipY: m.legTop - 1 + pose.crouch + pose.bob + sitDrop,
    headX: cx - m.headW / 2 + (dir === 'right' ? pose.lean + pose.headX : (pose.shake ?? 0)),
    headY: m.headTop + upper + pose.headY,
  };
  c.cloakIsCoat = spec.cloak?.style === 'hunter';
  if (flags.has('hood-up')) { /* reserved */ }
  if (flags.has('hunch')) c.headX += dir === 'right' ? 1 : 0;

  const weaponNear = weapon === 'twin-swords' ? 'sword' as WeaponKind : weapon;
  const drawNearWeapon = () => { if (!pose.weaponHidden && weapon !== 'bow') drawWeapon(c, pose.weapon, handPoint(c, true), weaponNear === 'sword' && weapon === 'twin-swords' ? 'twin-swords' : weapon, true); };
  const drawFarWeapon = () => {
    if (pose.weaponHidden) return;
    if (weapon === 'twin-swords') drawWeapon(c, pose.weaponF, handPoint(c, false), 'twin-swords', false);
    if (weapon === 'bow') drawWeapon(c, pose.weaponF ?? -Math.PI / 2, handPoint(c, pose.weaponF !== undefined ? false : true), 'bow', pose.weaponF !== undefined);
  };

  const legsLayer = () => {
    if (sitting) drawSitLegs(c);
    else if (kneeling) drawKneelLegs(c);
    else drawLegs(c);
    drawLowerGarment(c);
  };

  if (dir === 'down') {
    drawCloakBack(c);
    drawQuiverBack(c, false);
    drawHairBack(c);
    if (weapon === 'bow' && pose.weaponF === undefined) { /* bow carried in hand: drawn later */ }
    legsLayer();
    drawTorso(c);
    drawBoundArms(c);
    drawArm(c, false);
    drawArm(c, true);
    drawSatchelBag(c);
    drawCloakFront(c);
    drawHead(c);
    drawFace(c);
    drawEars(c);
    drawBeard(c);
    drawHairFront(c);
    drawHeadgear(c);
    drawItem(c);
    drawShield(c);
    drawFarWeapon();
    drawNearWeapon();
  } else if (dir === 'up') {
    drawFarWeapon();
    drawNearWeapon();
    drawItem(c);
    legsLayer();
    drawArm(c, false);
    drawArm(c, true);
    drawTorso(c);
    drawBoundArms(c);
    drawHead(c);
    drawEars(c);
    drawHairFront(c);
    drawHeadgear(c);
    drawCloakFront(c);
    drawSatchelBag(c);
    drawQuiverBack(c, true);
    drawShield(c);
  } else {
    drawFarWeapon();
    drawArm(c, false);
    drawCloakBack(c);
    legsLayer();
    drawTorso(c);
    drawBoundArms(c);
    drawQuiverBack(c, false);
    drawHairBack(c);
    drawCloakFront(c);
    drawHead(c);
    drawFace(c);
    drawEars(c);
    drawBeard(c);
    drawHairFront(c);
    drawHeadgear(c);
    drawSatchelBag(c);
    drawItem(c);
    drawArm(c, true);
    drawShield(c);
    drawNearWeapon();
  }
  lastHand = handPoint(c, true);
  return p;
}

function drawSitLegs(c: Ctx): void {
  const { p, m } = c;
  const legC = legColor(c);
  const shoe = shoeColor(c);
  const y = c.hipY + 1;
  const long = isLongGarment(c) || c.spec.bottom?.style === 'skirt';
  const r = long ? (isLongGarment(c) ? c.pal.top : c.pal.bottom) : legC;
  if (c.dir === 'right') {
    // thighs forward, shins down
    const { x1 } = torsoBounds(c);
    for (let x = c.cx - 2; x <= x1 + 3; x++) { p.set(x, y, r[4]); p.set(x, y + 1, r[2]); }
    for (let yy = y + 2; yy < m.ground; yy++) { p.set(x1 + 2, yy, legC[3]); p.set(x1 + 3, yy, legC[2]); }
    for (let k = 0; k < 3; k++) p.set(x1 + 2 + k, m.ground, shoe[3]);
  } else {
    const { x0, x1 } = torsoBounds(c);
    for (let yy = y; yy <= y + 2; yy++) for (let x = x0; x <= x1; x++) p.set(x, yy, col(c, r, x, x0, x1, yy === y + 2 ? 2 : 3));
    if (c.dir === 'down') {
      for (const lx of [c.cx - m.legW - 1, c.cx + 1]) { for (let yy = y + 3; yy < m.ground; yy++) for (let k = 0; k < m.legW; k++) p.set(lx + k, yy, legC[3]); for (let k = 0; k < m.legW; k++) p.set(lx + k, m.ground, shoe[3]); }
    }
  }
}

function drawKneelLegs(c: Ctx): void {
  const { p, m } = c;
  const legC = legColor(c);
  const shoe = shoeColor(c);
  const y = c.hipY + 1;
  if (c.dir === 'right') {
    // near leg: foot planted forward, knee up; far leg: knee on the ground
    const hx = c.cx - 1;
    thickLine(p, hx, y, hx + 3, y + 1, 2, () => legC[3]);
    thickLine(p, hx + 3, y + 1, hx + 3, m.ground - 1, 2, () => legC[3]);
    for (let k = 0; k < 3; k++) p.set(hx + 2 + k, m.ground, shoe[3]);
    thickLine(p, hx, y, hx - 1, m.ground - 1, 2, () => legC[2]);
    for (let x = hx - 4; x <= hx - 1; x++) p.set(x, m.ground, legC[2]);
  } else {
    const { x0, x1 } = torsoBounds(c);
    for (let yy = y; yy <= m.ground; yy++) for (let x = x0; x <= x1; x++) {
      if (x >= c.cx - 1 && x <= c.cx && yy > y + 1) continue;
      p.set(x, yy, yy === m.ground ? shoe[2] : col(c, legC, x, x0, x1, 3));
    }
  }
  drawLowerGarment(c);
}

/** Renders one frame (all directions; left is drawn as mirrored right with mirrored lighting). */
export function renderFrame(spec: Preset, m: Metrics, pose: Pose, dir: Dir, weapon: WeaponKind): Px {
  const pal = palette(spec);
  const flags = new Set(spec.extra ?? []);
  if (spec.body === 'huge') flags.add('noblink');
  if (pose.special === 'lie') return renderLying(spec, m, pose, dir, pal, flags, weapon);
  let p: Px;
  if (dir === 'left') { p = drawStanding(spec, m, pose, 'right', false, pal, flags, weapon).flipped(); lastHand = { x: m.fw - 1 - lastHand.x, y: lastHand.y }; }
  else p = drawStanding(spec, m, pose, dir, true, pal, flags, weapon);
  finish(p, spec, pose, flags, pal, m);
  return p;
}

function renderLying(spec: Preset, m: Metrics, pose: Pose, dir: Dir, pal: Pal, flags: Set<string>, weapon: WeaponKind): Px {
  const stand: Pose = { ...pose, special: undefined, bob: 0, crouch: 0, handN: { x: 0, y: 0 }, handF: { x: 0, y: 0 }, weaponHidden: true };
  const up = drawStanding(spec, m, stand, 'down', true, pal, flags, weapon);
  const out = new Px(m.fw, m.fh);
  // rotate 90° (head to the left), place on the ground; breathing raises the chest by one pixel
  const headLeft = dir !== 'left';
  let minY = m.fh, maxY = 0;
  for (let y = 0; y < m.fh; y++) for (let x = 0; x < m.fw; x++) if (up.alpha(x, y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const len = maxY - minY + 1;
  const ox = Math.floor((m.fw - len) / 2);
  for (let y = 0; y < m.fh; y++) for (let x = 0; x < m.fw; x++) {
    const v = up.get(x, y);
    if (v < 0) continue;
    const along = y - minY;
    const tx = headLeft ? ox + along : m.fw - 1 - (ox + along);
    const ty = m.ground - (m.fw - 1 - x) + Math.floor(m.fw / 2) - Math.floor(m.torsoW / 2) - 2 - (pose.bob && along > m.headH && along < m.headH + 6 ? 1 : 0);
    out.set(tx, ty, v);
  }
  finish(out, spec, pose, flags, pal, m);
  return out;
}

function finish(p: Px, spec: Preset, pose: Pose, flags: Set<string>, pal: Pal, m: Metrics): void {
  p.outline({ amount: 0.9 });
  // hand magic glow (after outline so it stays luminous)
  if (pose.glow) {
    const mg = pal.magic;
    const hx = lastHand.x, hy = lastHand.y;
    if (hx >= 0) {
      const r = 1 + pose.glow * 2.5;
      for (let y = Math.floor(hy - r); y <= hy + r; y++) for (let x = Math.floor(hx - r); x <= hx + r; x++) {
        const d = Math.hypot(x - hx, y - hy);
        if (d > r) continue;
        if (d < r * 0.4) p.set(x, y, mg[5]);
        else if (p.alpha(x, y) === 0) p.blend(x, y, mg[4], 0.55 * pose.glow);
      }
    }
  }
  if (flags.has('red-eyes') || flags.has('smoke') || spec.head?.style === 'hood-deep') {
    // glowing eyes in the hood shadow (red for conspirators, cold violet for the Master)
    const eyeC = flags.has('red-eyes') ? 0xff3a2a : 0xb884ec;
    let found = 0;
    for (let y = 0; y < m.fh && found < 1; y++) for (let x = 0; x < m.fw; x++) {
      if (p.get(x, y) === 0x0e0c12 && p.get(x + 3, y) === 0x0e0c12 && p.get(x, y - 1) === 0x0e0c12 && flags.has('red-eyes')) { p.set(x, y, eyeC); p.set(x + 3, y, eyeC); found++; break; }
    }
  }
  if (flags.has('smoke')) {
    // dark smoke wisps curling at the hem
    for (let k = 0; k < 6; k++) {
      const x = Math.round(m.cx - 6 + hash2(k, 1, pose.bob + 3) * 12), y = m.ground - Math.round(hash2(k, 2, pose.bob + 3) * 5);
      if (p.alpha(x, y) === 0) p.blend(x, y, 0x241830, 0.6);
      if (p.alpha(x + 1, y - 1) === 0) p.blend(x + 1, y - 1, 0x3a2650, 0.4);
    }
  }
  void namedColor;
}

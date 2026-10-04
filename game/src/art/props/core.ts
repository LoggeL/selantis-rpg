import { RAMPS, shift } from '../palette';
import { Px } from '../px';
import { Rng, bayer, hash2, valueNoise } from '../rng';

export type R = readonly number[];

export interface DrawCtx {
  p: Px;
  r: Rng;
  /** Visual variant (0..variants-1). */
  v: number;
  /** Animation frame (0..frames-1). */
  f: number;
  frames: number;
}

export interface PropDef {
  w: number;
  h: number;
  /** Origin in px from top-left; default bottom-centre (w/2, h-2). */
  ox?: number;
  oy?: number;
  footprint?: { x: number; y: number; w: number; h: number } | null;
  sway?: boolean;
  light?: { radius: number; color: number; flicker?: boolean; offsetY?: number };
  lights?: { x: number; y: number; radius: number; color: number; flicker?: boolean }[];
  anchors?: Record<string, { x: number; y: number }>;
  frames?: number;
  fps?: number;
  variants?: number;
  /** Skip the automatic coloured outline. */
  noOutline?: boolean;
  /** Ground shadow (drawn under the prop after outlining): [cx, cy, rx, ry, alpha]. */
  shadow?: [number, number, number, number, number?];
  draw(c: DrawCtx): void;
  /** Drawn after outlining (flames, glows, translucent bits). */
  post?(c: DrawCtx): void;
}

// ------------------------------------------------------------------------------------------
// Shading primitives (light from the top-left)
// ------------------------------------------------------------------------------------------

const L: [number, number, number] = [-0.55, -0.65, 0.52];

function lam(nx: number, ny: number, nz: number): number {
  return nx * L[0] + ny * L[1] + nz * L[2];
}

/** Index into ramp from a lighting value with ordered dithering. */
export function tone(r: R, light: number, x: number, y: number, lo = 0, hi = r.length - 1, dither = 0.45): number {
  const t = Math.max(0, Math.min(1, (light + 0.25) / 1.15));
  const f = lo + t * (hi - lo) + (bayer(x, y) - 0.5) * dither;
  return r[Math.max(lo, Math.min(hi, Math.round(f)))];
}

/**
 * Leafy crown made of bumpy clusters inside an ellipse. Combines the crown's overall roundness with
 * each cluster's own bump, draws occlusion lines where clumps overlap and sprinkles leaf highlights,
 * so it reads as clumps of foliage rather than a smooth blob.
 */
export function foliage(p: Px, cx: number, cy: number, rx: number, ry: number, r: R, rng: Rng,
  opts: { clusters?: number; cr?: [number, number]; lo?: number; hi?: number; speck?: number; seed?: number; flatBottom?: number } = {}): { x: number; y: number; rad: number }[] {
  const n = opts.clusters ?? Math.round((rx * ry) / 14);
  const [cr0, cr1] = opts.cr ?? [3.5, 6.5];
  const lo = opts.lo ?? 0, hi = opts.hi ?? r.length - 1;
  const cl: { x: number; y: number; rad: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const edge = i < n * 0.6;
    const d = edge ? rng.range(0.72, 0.95) : Math.sqrt(rng.float()) * 0.7;
    const rad = rng.range(cr0, cr1);
    cl.push({ x: cx + Math.cos(a) * (rx - rad * 0.6) * d, y: cy + Math.sin(a) * (ry - rad * 0.6) * d, rad });
  }
  cl.push({ x: cx, y: cy, rad: Math.min(rx, ry) * 0.75 });
  const x0 = Math.floor(cx - rx - cr1), x1 = Math.ceil(cx + rx + cr1);
  const y0 = Math.floor(cy - ry - cr1), y1 = Math.ceil(cy + ry + cr1);
  const W = x1 - x0 + 1, H = y1 - y0 + 1;
  const ids = new Int16Array(W * H).fill(-1);
  const lights = new Float32Array(W * H);
  const seed = opts.seed ?? 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (opts.flatBottom !== undefined && y > opts.flatBottom) continue;
    let best = -1e9, bi = -1, bnx = 0, bny = 0, bnz = 0;
    for (let k = 0; k < cl.length; k++) {
      const c = cl[k];
      const dx = (x + 0.5 - c.x) / c.rad, dy = (y + 0.5 - c.y) / c.rad;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      // clumps lower on the crown sit "in front" (top-down 3/4 view)
      const hgt = Math.sqrt(1 - d) * c.rad + (c.y - cy) * 0.35;
      if (hgt > best) { best = hgt; bi = k; bnx = dx; bny = dy; bnz = Math.sqrt(1 - d); }
    }
    if (bi < 0) continue;
    const gx = (x + 0.5 - cx) / rx, gy = (y + 0.5 - cy) / ry;
    const gz = Math.sqrt(Math.max(0, 1 - gx * gx - gy * gy));
    const i = (y - y0) * W + (x - x0);
    ids[i] = bi;
    lights[i] = lam(gx, gy, gz) * 0.62 + lam(bnx, bny, bnz) * 0.6 - 0.08;
  }
  const idAt = (x: number, y: number) => (x < x0 || y < y0 || x > x1 || y > y1) ? -1 : ids[(y - y0) * W + (x - x0)];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y - y0) * W + (x - x0);
    const id = ids[i];
    if (id < 0) continue;
    let light = lights[i];
    const up = idAt(x, y - 1), left = idAt(x - 1, y), up2 = idAt(x, y - 2);
    // occlusion: this clump is overlapped by the clump right above it
    if (up >= 0 && up !== id) light -= 0.55;
    else if (up2 >= 0 && up2 !== id) light -= 0.22;
    else if (left >= 0 && left !== id) light -= 0.2;
    let c = tone(r, light, x, y, lo, hi, 0.35);
    // leaf texture: little bright dashes on the lit side, dark notches in the shade
    const hv = hash2(x >> 1, y, seed);
    const k = r.indexOf(c);
    if (light > 0.35 && hv < 0.16 && k < hi) c = r[k + 1];
    else if (light < 0.15 && hv > 0.86 && k > lo) c = r[k - 1];
    p.set(x, y, c);
  }
  return cl;
}

/** Shaded vertical trunk with flared roots and bark streaks. */
export function trunk(p: Px, cx: number, yTop: number, yBase: number, w: number, r: R, seed = 1, flare = 2): void {
  for (let y = yTop; y <= yBase; y++) {
    const t = (y - yTop) / Math.max(1, yBase - yTop);
    const ww = w + (t > 0.7 ? Math.round((t - 0.7) / 0.3 * flare * 2) : 0);
    const x0 = Math.round(cx - ww / 2);
    for (let x = x0; x < x0 + ww; x++) {
      const nx = ((x + 0.5) - cx) / (ww / 2);
      const light = lam(nx, 0, Math.sqrt(Math.max(0, 1 - nx * nx)));
      let c = tone(r, light, x, y, 1, r.length - 2, 0.3);
      const streak = valueNoise(x * 2.5, y * 0.3, 2, seed);
      if (streak > 0.68) c = r[Math.max(0, r.indexOf(c) - 1)];
      else if (streak < 0.12) c = r[Math.min(r.length - 1, r.indexOf(c) + 1)];
      p.set(x, y, c);
    }
  }
}

/** Upright cylinder (barrel, well, bucket): body + elliptical top. */
export function cylinder(p: Px, cx: number, top: number, rx: number, ry: number, h: number, r: R,
  opts: { topRamp?: R; open?: boolean; bands?: number[]; bandRamp?: R; inner?: number } = {}): void {
  const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx) - 1;
  for (let x = x0; x <= x1; x++) {
    const nx = (x + 0.5 - cx) / rx;
    if (Math.abs(nx) > 1) continue;
    const e = Math.sqrt(1 - nx * nx) * ry;
    const light = lam(nx, 0.1, Math.sqrt(1 - nx * nx));
    for (let y = Math.round(top); y <= Math.round(top + h + e); y++) {
      let c = tone(r, light, x, y, 0, r.length - 1, 0.35);
      if (opts.bands && opts.bandRamp) {
        for (const b of opts.bands) {
          const by = Math.round(top + b + e * 0.85);
          if (y === by || y === by + 1) c = tone(opts.bandRamp, light, x, y, 0, opts.bandRamp.length - 1, 0.2);
        }
      }
      p.set(x, y, c);
    }
  }
  const tr = opts.topRamp ?? r;
  p.ellipse(cx, top, rx, ry, tr[Math.min(tr.length - 1, tr.length - 2)]);
  if (opts.open) {
    p.ellipse(cx, top + 0.5, rx - 1.5, ry - 1, opts.inner ?? tr[0]);
  } else {
    // light catches the top-left of the lid
    p.ellipse(cx - rx * 0.25, top - ry * 0.2, rx * 0.55, ry * 0.45, tr[tr.length - 1]);
  }
}

/** 3/4-view box: top face (lighter) + front face. */
export function box(p: Px, x: number, y: number, w: number, topH: number, frontH: number, top: R, front: R, opts: { grain?: boolean; seed?: number } = {}): void {
  for (let yy = 0; yy < topH; yy++) for (let xx = 0; xx < w; xx++) {
    let c = top[top.length - 2];
    if (yy === 0 || xx === 0) c = top[top.length - 1];
    if (xx === w - 1) c = top[top.length - 3];
    if (opts.grain && valueNoise((x + xx) * 0.3, (y + yy) * 2, 2, opts.seed ?? 3) > 0.72) c = top[top.length - 3];
    p.set(x + xx, y + yy, c);
  }
  for (let yy = 0; yy < frontH; yy++) for (let xx = 0; xx < w; xx++) {
    let c = front[front.length - 3];
    if (yy === 0) c = front[front.length - 1];
    else if (xx === 0) c = front[front.length - 2];
    else if (xx === w - 1 || yy === frontH - 1) c = front[front.length - 4] ?? front[0];
    if (opts.grain && valueNoise((x + xx) * 0.3, (y + yy) * 2, 2, (opts.seed ?? 3) + 1) > 0.74) c = front[Math.max(0, front.length - 4)];
    p.set(x + xx, y + topH + yy, c);
  }
}

/** Shaded rock lump. */
export function rock(p: Px, cx: number, cy: number, rx: number, ry: number, r: R, rng: Rng, seed = 1): void {
  // a few overlapping blobs for an irregular silhouette
  const blobs = [[0, 0, 1, 1], [rng.range(-0.4, -0.2), rng.range(0, 0.2), 0.7, 0.75], [rng.range(0.2, 0.4), rng.range(0.05, 0.25), 0.65, 0.7]];
  for (const [bx, by, sx, sy] of blobs) {
    const ex = cx + bx * rx, ey = cy + by * ry, erx = rx * sx, ery = ry * sy;
    for (let y = Math.floor(ey - ery); y <= Math.ceil(ey + ery); y++) for (let x = Math.floor(ex - erx); x <= Math.ceil(ex + erx); x++) {
      const nx = (x + 0.5 - ex) / erx, ny = (y + 0.5 - ey) / ery;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      // faceted: quantise the normal a bit so rocks look chiselled
      const qx = Math.round(nx * 2.5) / 2.5, qy = Math.round(ny * 2.5) / 2.5;
      const light = lam(qx, qy, Math.sqrt(Math.max(0, 1 - qx * qx - qy * qy)));
      let c = tone(r, light, x, y, 1, r.length - 1, 0.25);
      if (hash2(x, y, seed) > 0.93) c = shift(c, -0.25);
      if (p.alpha(x, y) === 0 || ny < 0.2) p.set(x, y, c);
    }
  }
  // crack
  const cxk = Math.round(cx + rng.range(-rx * 0.3, rx * 0.3));
  for (let i = 0; i < Math.max(2, ry * 0.6); i++) p.paint(cxk + (i % 3 === 2 ? 1 : 0), Math.round(cy - ry * 0.4 + i), r[1]);
  // moss on top occasionally
  if (rng.chance(0.5)) {
    for (let x = Math.floor(cx - rx * 0.6); x < cx + rx * 0.3; x++) {
      for (let y = Math.floor(cy - ry); y < cy - ry * 0.35; y++) {
        if (p.get(x, y) >= 0 && valueNoise(x, y, 3, seed + 9) > 0.55) p.set(x, y, valueNoise(x, y, 2, seed) > 0.6 ? RAMPS.grass[4] : RAMPS.grass[3]);
      }
    }
  }
}

/** Horizontal plank slab (bench seat, table top...). */
export function planks(p: Px, x: number, y: number, w: number, h: number, r: R, vertical = false, plankW = 4, seed = 1): void {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const along = vertical ? yy : xx, across = vertical ? xx : yy;
    const k = Math.floor(across / plankW);
    const la = across - k * plankW;
    let i = 3 + (hash2(k, 0, seed) > 0.6 ? 1 : 0);
    if (la === 0) i = 1;
    else if (la === 1) i += 1;
    else if (la === plankW - 1) i -= 1;
    if (valueNoise(along * 0.25 + k * 7, across * 1.5, 2, seed) > 0.75) i -= 1;
    p.set(x + xx, y + yy, r[Math.max(0, Math.min(r.length - 1, i))]);
  }
}

export const wood = RAMPS.wood;
export const darkwood = [0x1c1216, 0x2e1c1c, 0x46291f, 0x5e3a28, 0x7a4e32, 0x966840] as R;
export const greywood = [0x2a2426, 0x433a38, 0x5e5450, 0x7c706a, 0x9a8e86, 0xbab0a6] as R;
export const leaves = [0x12241e, 0x1a3826, 0x26502c, 0x376a32, 0x4f863a, 0x6fa548, 0x98c45c] as R;

/**
 * Animated flame: teardrop body with noise tongues rising over time. `f/frames` loops seamlessly.
 * Bands: deep red outline → orange → yellow → pale core.
 */
export function flame(p: Px, cx: number, baseY: number, w: number, h: number, f: number, frames: number, seed = 1, palette: R = RAMPS.fire): void {
  const t = f / frames;
  const x0 = Math.floor(cx - w / 2 - 1), x1 = Math.ceil(cx + w / 2 + 1);
  const y0 = Math.floor(baseY - h - 2);
  for (let y = y0; y <= baseY; y++) for (let x = x0; x <= x1; x++) {
    const v = (baseY - y) / h; // 0 at base, 1 at tip
    const nx = (x + 0.5 - cx) / (w / 2);
    // looping noise: sample two phases and blend so frame N == frame 0
    const n1 = valueNoise(x * 1.0, y + t * h * 2, 3, seed);
    const n2 = valueNoise(x * 1.0, y + (t - 1) * h * 2, 3, seed);
    const n = n1 * (1 - t) + n2 * t;
    const width = Math.pow(Math.max(0, 1 - v), 0.65) * (1 - v * 0.15);
    const field = width - Math.abs(nx) + (n - 0.5) * 0.9 * (0.3 + v);
    if (field <= 0) continue;
    const heat = field * 1.6 + (1 - v) * 0.5;
    const idx = heat > 1.35 ? 4 : heat > 0.95 ? 3 : heat > 0.5 ? 2 : heat > 0.2 ? 1 : 0;
    p.set(x, y, palette[idx]);
  }
  // sparks
  for (let k = 0; k < 3; k++) {
    const life = (t + hash2(k, 0, seed)) % 1;
    const sx = Math.round(cx + (hash2(k, 1, seed) - 0.5) * w + Math.sin(life * 6 + k) * 1.5);
    const sy = Math.round(baseY - h * 0.7 - life * h * 0.9);
    if (life < 0.8) p.set(sx, sy, palette[life < 0.4 ? 4 : 3]);
  }
}

/** Soft additive-looking glow baked as translucent pixels (only into empty pixels). */
export function glowUnder(p: Px, cx: number, cy: number, r: number, c: number, a = 0.35): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    if (p.alpha(x, y) !== 0) continue;
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
    if (d > 1) continue;
    const step = d < 0.45 ? 1 : d < 0.75 ? 0.55 : 0.25;
    if (step < 0.5 && (x + y) % 2) continue;
    p.blend(x, y, c, a * step);
  }
}

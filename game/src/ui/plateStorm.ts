/**
 * Storm grade for a painted plate: the sky turns dark slate violet (strongest at the top, weaker over the land),
 * while violet lightning stays bright and casts a soft glow into the darkened sky. Works on raw RGBA pixels, so the
 * painted plate itself is reused and no second painting has to match it.
 */
export function stormGrade(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const n = w * h;
  // Lightning: bright violet strokes (brightness gate). Dark violet, like the robe tendrils, keeps part of its colour.
  const bolt = new Float32Array(n), magic = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2];
    magic[i] = smooth(0, 45, Math.min(r, b) - g);    // violet needs red as well as blue: the blue sky stays out
    bolt[i] = magic[i] * smooth(130, 210, Math.max(r, b));
  }
  // White bolt cores sit inside the violet rim: bright pixels close to a stroke belong to the bolt, clouds do not.
  const near = blur(dilate(bolt, w, h, 3), w, h, 1);
  const glow = blur(blur(bolt, w, h, 10), w, h, 10);
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    const sky = 1 - smooth(0.4, 0.78, y / h);
    const dim = 0.64 - 0.32 * sky;          // brightness factor: 0.32 at the top, 0.64 over the land
    const grey = 0.4 + 0.45 * sky;          // how far colours fall towards the storm tint
    for (let x = 0; x < w; x++) {
      const i = y * w + x, p = i * 4;
      const r = src[p], g = src[p + 1], b = src[p + 2];
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      const keep = Math.max(bolt[i], near[i] * smooth(160, 225, lum), magic[i] * 0.45);
      const lit = Math.min(1, glow[i] * 3) * (0.35 + 0.65 * sky);
      for (let c = 0; c < 3; c++) {
        const o = src[p + c];
        const storm = (o + (lum * TINT[c] - o) * grey) * dim + GLOW[c] * lit;
        out[p + c] = storm + (o - storm) * keep;
      }
      out[p + 3] = src[p + 3];
    }
  }
  return out;
}

const TINT = [0.8, 0.74, 1.12];
const GLOW = [90, 36, 150];

function smooth(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Separable square max filter. */
function dilate(m: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(m.length), out = new Float32Array(m.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) v = Math.max(v, m[y * w + k]);
    tmp[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) v = Math.max(v, tmp[k * w + x]);
    out[y * w + x] = v;
  }
  return out;
}

/** Separable box blur (running sums). */
function blur(m: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(m.length), out = new Float32Array(m.length);
  const pass = (src: Float32Array, dst: Float32Array, len: number, lines: number, at: (line: number, k: number) => number) => {
    for (let l = 0; l < lines; l++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[at(l, Math.min(len - 1, Math.max(0, k)))];
      for (let k = 0; k < len; k++) {
        dst[at(l, k)] = sum / (2 * r + 1);
        sum += src[at(l, Math.min(len - 1, k + r + 1))] - src[at(l, Math.max(0, k - r))];
      }
    }
  };
  pass(m, tmp, w, h, (y, x) => y * w + x);
  pass(tmp, out, h, w, (x, y) => y * w + x);
  return out;
}

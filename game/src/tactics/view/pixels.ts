/** Minimal pixel buffer for crisp procedural art (tactics-local). Colours are 0xRRGGBB. */
export class Pix {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;
  constructor(w: number, h: number) { this.w = w; this.h = h; this.data = new Uint8ClampedArray(w * h * 4); }

  set(x: number, y: number, c: number, a = 1): void {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (a >= 1) {
      this.data[i] = (c >> 16) & 255; this.data[i + 1] = (c >> 8) & 255; this.data[i + 2] = c & 255; this.data[i + 3] = 255;
      return;
    }
    const da = this.data[i + 3] / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    const m = (s: number, d: number) => (s * a + d * da * (1 - a)) / oa;
    this.data[i] = m((c >> 16) & 255, this.data[i]);
    this.data[i + 1] = m((c >> 8) & 255, this.data[i + 1]);
    this.data[i + 2] = m(c & 255, this.data[i + 2]);
    this.data[i + 3] = oa * 255;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    const i = (y * this.w + x) * 4;
    if (this.data[i + 3] === 0) return -1;
    return (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2];
  }
  alpha(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }
  rect(x: number, y: number, w: number, h: number, c: number, a = 1): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c, a);
  }
  /** Filled ellipse. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number | ((x: number, y: number, nx: number, ny: number) => number | null), a = 1): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const col = typeof c === 'number' ? c : c(x, y, nx, ny);
        if (col !== null) this.set(x, y, col, a);
      }
    }
  }
  /** Adds a 1px dark outline around opaque pixels (silhouette). */
  outline(c: number, a = 1): void {
    const src = new Uint8ClampedArray(this.data);
    const op = (x: number, y: number) => x >= 0 && y >= 0 && x < this.w && y < this.h && src[(y * this.w + x) * 4 + 3] > 0;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (op(x, y)) continue;
      if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) this.set(x, y, c, a);
    }
  }
  blit(src: Pix, dx: number, dy: number): void {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      const a = src.data[i + 3];
      if (!a) continue;
      this.set(dx + x, dy + y, (src.data[i] << 16) | (src.data[i + 1] << 8) | src.data[i + 2], a / 255);
    }
  }
  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(this.data), this.w, this.h), 0, 0);
    return c;
  }
}

/** Deterministic hash → 0..1 for (x, y, salt). */
export function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Small seeded RNG for art. */
export function artRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered dither threshold 0..1 for a pixel. */
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

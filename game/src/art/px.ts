import { bayer } from './rng';
import { b8, g8, luminance, mix, r8, rgb, shift } from './palette';

/**
 * Pixel buffer for crisp procedural pixel art. Colours are 0xRRGGBB numbers; internally stored as
 * little-endian ABGR so the buffer can be blitted straight into ImageData. 0 = fully transparent.
 */
export class Px {
  readonly w: number;
  readonly h: number;
  readonly d: Uint32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.d = new Uint32Array(w * h);
  }

  static pack(c: number, a = 255): number {
    return ((a << 24) | ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255)) >>> 0;
  }
  static unpack(v: number): number {
    return ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, c: number, a = 255): void {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = Px.pack(c, a);
  }

  /** Alpha-composites colour c with opacity a (0..1) over the pixel. */
  blend(x: number, y: number, c: number, a: number): void {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = y * this.w + x;
    const v = this.d[i];
    const da = (v >>> 24) / 255;
    if (da === 0) { this.d[i] = Px.pack(c, Math.round(a * 255)); return; }
    const oa = a + da * (1 - a);
    const dc = Px.unpack(v);
    const mixc = (s: number, dd: number) => (s * a + dd * da * (1 - a)) / oa;
    this.d[i] = Px.pack(rgb(mixc(r8(c), r8(dc)), mixc(g8(c), g8(dc)), mixc(b8(c), b8(dc))), Math.round(oa * 255));
  }

  /** Colour at (x,y) or -1 when transparent / outside. */
  get(x: number, y: number): number {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    const v = this.d[y * this.w + x];
    return v >>> 24 === 0 ? -1 : Px.unpack(v);
  }
  alpha(x: number, y: number): number {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[y * this.w + x] >>> 24;
  }
  solid(x: number, y: number): boolean { return this.alpha(x, y) > 127; }
  clear(x: number, y: number): void { if (this.inside(x | 0, y | 0)) this.d[(y | 0) * this.w + (x | 0)] = 0; }

  /** Only paints where something already is (useful for texturing a shape). */
  paint(x: number, y: number, c: number): void {
    if (this.alpha(x, y) > 0) this.set(x, y, c, this.alpha(x, y));
  }

  rect(x: number, y: number, w: number, h: number, c: number, a = 255): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c, a);
  }
  hline(x0: number, x1: number, y: number, c: number): void {
    if (x1 < x0) [x0, x1] = [x1, x0];
    for (let x = x0; x <= x1; x++) this.set(x, y, c);
  }
  vline(x: number, y0: number, y1: number, c: number): void {
    if (y1 < y0) [y0, y1] = [y1, y0];
    for (let y = y0; y <= y1; y++) this.set(x, y, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** Filled ellipse with float centre/radii (pixel centres tested). */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number, a = 255): void {
    const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) this.set(x, y, c, a);
    }
  }
  disc(cx: number, cy: number, r: number, c: number): void { this.ellipse(cx, cy, r, r, c); }

  /** Soft translucent ellipse (ground shadows). */
  shadow(cx: number, cy: number, rx: number, ry: number, a = 0.32, c = 0x14101c): void {
    const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d <= 1) this.blend(x, y, c, d > 0.62 ? a * 0.6 : a);
    }
  }

  /** Ground shadow painted only into empty pixels (so outlines stay intact). */
  shadowUnder(cx: number, cy: number, rx: number, ry: number, a = 0.3, c = 0x14101c): void {
    const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (this.alpha(x, y) !== 0) continue;
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d <= 1) this.blend(x, y, c, d > 0.6 ? a * 0.55 : a);
    }
  }

  /** Scanline polygon fill. */
  poly(pts: [number, number][], c: number): void {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, c);
      }
    }
  }

  /**
   * Lambert-shaded ellipse ("blob") using a ramp and ordered dithering. Light from top-left.
   * `lo`/`hi` limit the ramp range used. `flat` > 0 flattens the sphere (more uniform mid-tones).
   */
  shadeBlob(cx: number, cy: number, rx: number, ry: number, ramp: readonly number[],
    opts: { lo?: number; hi?: number; dither?: number; light?: [number, number]; flat?: number; onlyEmpty?: boolean } = {}): void {
    const lo = opts.lo ?? 0, hi = opts.hi ?? ramp.length - 1;
    const [lx, ly] = opts.light ?? [-0.55, -0.7];
    const lz = Math.sqrt(Math.max(0, 1 - lx * lx - ly * ly));
    const dither = opts.dither ?? 0.5;
    const flat = opts.flat ?? 0;
    const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      if (opts.onlyEmpty && this.alpha(x, y) > 0) continue;
      const nz = Math.sqrt(1 - d);
      let lam = nx * lx + ny * ly + nz * lz;
      lam = lam * (1 - flat) + 0.55 * flat;
      const t = Math.max(0, Math.min(1, (lam + 0.15) / 1.05));
      const f = lo + t * (hi - lo) + (bayer(x, y) - 0.5) * dither;
      this.set(x, y, ramp[Math.max(lo, Math.min(hi, Math.round(f)))]);
    }
  }

  /**
   * Coloured outline: every transparent pixel touching an opaque one gets a darkened version of that
   * neighbour (or `fixed`). `diagonal` also tests diagonals (thicker corners).
   */
  outline(opts: { fixed?: number; amount?: number; diagonal?: boolean; skip?: (x: number, y: number) => boolean } = {}): void {
    const { w, h, d } = this;
    const add: [number, number, number][] = [];
    const amount = opts.amount ?? 0.78;
    const dirs = opts.diagonal ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[y * w + x] >>> 24 > 40) continue;
      if (opts.skip?.(x, y)) continue;
      for (const [dx, dy] of dirs) {
        const c = this.get(x + dx, y + dy);
        if (c >= 0 && this.alpha(x + dx, y + dy) > 200) {
          add.push([x, y, opts.fixed ?? outlineOf(c, amount)]);
          break;
        }
      }
    }
    for (const [x, y, c] of add) this.set(x, y, c);
  }

  /** Copies src onto this buffer (opaque pixels only, alpha respected). */
  blit(src: Px, dx: number, dy: number, flipX = false, sx = 0, sy = 0, sw = src.w, sh = src.h): void {
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const v = src.d[(sy + y) * src.w + (sx + x)];
      const a = v >>> 24;
      if (a === 0) continue;
      const tx = dx + (flipX ? sw - 1 - x : x), ty = dy + y;
      if (a === 255) { if (this.inside(tx, ty)) this.d[ty * this.w + tx] = v; }
      else this.blend(tx, ty, Px.unpack(v), a / 255);
    }
  }

  clone(): Px {
    const p = new Px(this.w, this.h);
    p.d.set(this.d);
    return p;
  }

  flipped(): Px {
    const p = new Px(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[y * this.w + (this.w - 1 - x)] = this.d[y * this.w + x];
    return p;
  }

  /** Recolours every opaque pixel through fn. */
  map(fn: (c: number, x: number, y: number) => number): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x, v = this.d[i];
      if (v >>> 24 === 0) continue;
      this.d[i] = Px.pack(fn(Px.unpack(v), x, y), v >>> 24);
    }
  }

  toImageData(): ImageData {
    const img = new ImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.d);
    return img;
  }

  toCanvas(scale = 1): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w * scale;
    c.height = this.h * scale;
    const g = c.getContext('2d')!;
    if (scale === 1) g.putImageData(this.toImageData(), 0, 0);
    else {
      const tmp = this.toCanvas(1);
      g.imageSmoothingEnabled = false;
      g.drawImage(tmp, 0, 0, c.width, c.height);
    }
    return c;
  }

  /** Draws this buffer into a 2D context at (x, y). */
  drawTo(g: CanvasRenderingContext2D, x: number, y: number): void {
    const tmp = this.toCanvas();
    g.drawImage(tmp, x, y);
  }
}

/** Dark, hue-keeping outline colour for a neighbour colour. */
export function outlineOf(c: number, amount = 0.78): number {
  const d = shift(c, -amount);
  return luminance(d) > 0.16 ? mix(d, 0x1a1220, 0.45) : mix(d, 0x1a1220, 0.2);
}

/** Parses a string pixel map with a legend into a Px. '.' and ' ' are transparent. */
export function fromMap(rows: string[], legend: Record<string, number>): Px {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const p = new Px(w, h);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const c = legend[ch];
      if (c !== undefined) p.set(x, y, c);
    }
  });
  return p;
}

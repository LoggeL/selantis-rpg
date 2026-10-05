import type Phaser from 'phaser';
import { mix, pal } from './palette';
import { bayer, hash } from './pixels';

/**
 * Painted battlefield textures (Codex-generated seamless 256x256 pixel-art tiles in public/assets/tactics/).
 * The terrain renderer samples them in world space so neighbouring tiles continue each other instead of
 * repeating a block. Missing files fall back to a small generated texture from the palette.
 */
export type TexId = 'grass' | 'drygrass' | 'forest' | 'dirt' | 'stone' | 'sand' | 'water' | 'mud' | 'cliff' | 'cliffgrass' | 'wall';
export const TEX_IDS: TexId[] = ['grass', 'drygrass', 'forest', 'dirt', 'stone', 'sand', 'water', 'mud', 'cliff', 'cliffgrass', 'wall'];

export interface Tex {
  size: number;
  data: Uint8ClampedArray;
  /** Average colour (for edge fills). */
  avg: [number, number, number];
  painted: boolean;
}

const cache = new Map<TexId, Tex>();
export const texKey = (id: TexId) => `tac-tex-${id}`;

/** Reads the loaded Phaser texture into a sampling buffer (cached), or builds the fallback. */
export function getTex(scene: Phaser.Scene, id: TexId): Tex {
  const hit = cache.get(id);
  if (hit) return hit;
  let tex: Tex | null = null;
  const key = texKey(id);
  if (scene.textures.exists(key)) {
    const img = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const n = img.width;
    if (n > 0 && n === img.height && (n & (n - 1)) === 0) {
      const c = document.createElement('canvas');
      c.width = n; c.height = n;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      tex = finish(n, g.getImageData(0, 0, n, n).data, true);
    }
  }
  tex ??= fallback(id);
  cache.set(id, tex);
  return tex;
}

function finish(size: number, data: Uint8ClampedArray, painted: boolean): Tex {
  let r = 0, g = 0, b = 0;
  const n = size * size;
  for (let i = 0; i < n * 4; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  return { size, data, avg: [r / n, g / n, b / n], painted };
}

/** Value noise in [0,1] with smooth interpolation, seeded. */
export function vnoise(x: number, y: number, s: number, salt: number): number {
  const xi = Math.floor(x / s), yi = Math.floor(y / s);
  const fx = x / s - xi, fy = y / s - yi;
  const a = hash(xi, yi, salt), b = hash(xi + 1, yi, salt), c = hash(xi, yi + 1, salt), d = hash(xi + 1, yi + 1, salt);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Generated stand-in so battles render before/without the painted files. */
function fallback(id: TexId): Tex {
  const N = 64;
  const data = new Uint8ClampedArray(N * N * 4);
  const ramp: Record<TexId, [string, number[]]> = {
    grass: ['grass', [2, 3, 4]], drygrass: ['meadow', [1, 2, 3]], forest: ['grass', [1, 1, 2]], dirt: ['earth', [2, 3, 4]],
    stone: ['warmstone', [2, 3, 4]], sand: ['sand', [2, 3, 4]], water: ['water', [2, 3, 4]], mud: ['mud', [1, 2, 3]],
    cliff: ['earth', [1, 2, 3]], cliffgrass: ['earth', [2, 3, 3]], wall: ['stone', [2, 3, 4]],
  };
  const [name, steps] = ramp[id];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    // tileable noise: sample on a torus by mixing wrapped coordinates
    const n = (vnoise(x, y, 8, 3) + vnoise((x + N / 2) % N, (y + N / 2) % N, 8, 3)) / 2 + (bayer(x, y) - 0.5) * 0.2;
    const c = n < 0.42 ? pal(name, steps[0]) : n < 0.62 ? pal(name, steps[1]) : pal(name, steps[2]);
    const i = (y * N + x) * 4;
    data[i] = (c >> 16) & 255; data[i + 1] = (c >> 8) & 255; data[i + 2] = c & 255; data[i + 3] = 255;
  }
  return finish(N, data, false);
}

/** Nearest sample with wrap; writes rgb into out. Texture coordinates are in texels. */
export function sample(t: Tex, u: number, v: number, out: number[]): void {
  const m = t.size - 1;
  const i = (((Math.floor(v) & m) * t.size) + (Math.floor(u) & m)) * 4;
  out[0] = t.data[i]; out[1] = t.data[i + 1]; out[2] = t.data[i + 2];
}

/** Two-tap vertical sample (the iso squash halves the vertical texel density, this avoids shimmering). */
export function sample2(t: Tex, u: number, v: number, du: number, dv: number, out: number[]): void {
  const m = t.size - 1;
  const i = (((Math.floor(v) & m) * t.size) + (Math.floor(u) & m)) * 4;
  const j = (((Math.floor(v + dv) & m) * t.size) + (Math.floor(u + du) & m)) * 4;
  out[0] = (t.data[i] + t.data[j]) >> 1; out[1] = (t.data[i + 1] + t.data[j + 1]) >> 1; out[2] = (t.data[i + 2] + t.data[j + 2]) >> 1;
}

export const rgbOf = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
export { mix };

import { describe, expect, it } from 'vitest';
import { stormGrade } from './plateStorm';

// 40x40 picture: blue sky with a bright violet bolt at the top left (its glow stays clear of x=25), a white cloud on the right, green land below.
function picture(): Uint8ClampedArray {
  const w = 40, h = 40, px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const rgb = y >= 30 ? [80, 140, 60] : x === 2 && y < 12 ? [190, 120, 255] : x >= 30 && y < 12 ? [240, 240, 245] : [70, 110, 220];
    px.set([...rgb, 255], (y * w + x) * 4);
  }
  return px;
}
const lum = (px: Uint8ClampedArray, x: number, y: number) => { const p = (y * 40 + x) * 4; return 0.3 * px[p] + 0.59 * px[p + 1] + 0.11 * px[p + 2]; };

describe('stormGrade', () => {
  const src = picture();
  const out = stormGrade(src, 40, 40);

  it('darkens the sky most and the land less', () => {
    expect(lum(out, 25, 2) / lum(src, 25, 2)).toBeLessThan(0.45);
    expect(lum(out, 20, 38) / lum(src, 20, 38)).toBeGreaterThan(0.55);
  });

  it('keeps the violet lightning bright but darkens white clouds', () => {
    expect(lum(out, 2, 5)).toBeGreaterThan(lum(src, 2, 5) * 0.95);
    expect(lum(out, 35, 5)).toBeLessThan(lum(src, 35, 5) * 0.5);
  });

  it('keeps alpha', () => {
    expect(out[3]).toBe(255);
  });
});

import { describe, expect, it } from 'vitest';
import { fitGameScale } from './viewport';

describe('phone canvas fit', () => {
  it.each([[304, 280], [374, 460], [414, 520], [458, 290], [568, 302], [120, 80]])('fits all of a 640×360 scene into %i×%i', (width, height) => {
    const scale = fitGameScale(width, height);
    expect(scale).toBeGreaterThan(0);
    expect(scale * 640).toBeLessThanOrEqual(width);
    expect(scale * 360).toBeLessThanOrEqual(height);
  });
  it('keeps integer pixel scaling when the desktop has enough space', () => {
    expect(fitGameScale(1536, 864)).toBe(2);
    expect(fitGameScale(640, 360)).toBe(1);
  });
  it('does not resize into a temporarily hidden area', () => {
    expect(fitGameScale(0, 360)).toBe(0);
    expect(fitGameScale(640, Number.NaN)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { areaPx, dirFromVector, hash01, isAt, pxToTile, toPx } from './geom';

describe('geom', () => {
  it('converts tile positions to tile centres', () => {
    expect(toPx([0, 0])).toEqual({ x: 8, y: 8 });
    expect(toPx({ x: 2.5, y: 1 })).toEqual({ x: 48, y: 24 });
    expect(toPx({ x: 5, y: 7, px: true })).toEqual({ x: 5, y: 7 });
    expect(pxToTile(48, 24)).toEqual({ x: 2.5, y: 1 });
  });
  it('converts areas', () => {
    expect(areaPx({ x: 1, y: 2, w: 3, h: 1 })).toEqual({ x: 16, y: 32, w: 48, h: 16 });
    expect(areaPx({ x: 1, y: 2, w: 3, h: 1, px: true })).toEqual({ x: 1, y: 2, w: 3, h: 1 });
  });
  it('picks 4-way facing with hysteresis', () => {
    expect(dirFromVector(1, 0)).toBe('right');
    expect(dirFromVector(0, -1)).toBe('up');
    // near-diagonal keeps the current axis
    expect(dirFromVector(1, 1.1, 'right')).toBe('right');
    expect(dirFromVector(1.1, 1, 'down')).toBe('down');
    expect(dirFromVector(0, 0, 'left')).toBe('left');
  });
  it('recognises At values and hashes deterministically', () => {
    expect(isAt([1, 2])).toBe(true);
    expect(isAt({ x: 1, y: 2 })).toBe(true);
    expect(isAt('kyra')).toBe(false);
    expect(hash01(3, 4)).toBe(hash01(3, 4));
    expect(hash01(3, 4)).toBeGreaterThanOrEqual(0);
    expect(hash01(3, 4)).toBeLessThan(1);
  });
});

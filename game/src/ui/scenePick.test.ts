import { describe, expect, it } from 'vitest';
import { driftSpots } from './scenePick';

describe('scene pick layout', () => {
  it.each([3, 4, 6, 8, 9])('spreads %i drifting cards without overlap', n => {
    const spots = driftSpots(n);
    expect(spots).toHaveLength(n);
    for (const s of spots) { expect(s.x).toBeGreaterThanOrEqual(0.14); expect(s.x).toBeLessThanOrEqual(0.86); expect(s.y).toBeGreaterThan(0.1); expect(s.y).toBeLessThan(0.9); }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = spots[i], b = spots[j];
      // Cards are wide and short: they must differ clearly in x or in y.
      expect(Math.abs(a.x - b.x) > 0.22 || Math.abs(a.y - b.y) > 0.2, `${i}/${j}`).toBe(true);
    }
  });
});

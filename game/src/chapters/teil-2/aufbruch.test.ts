import { describe, expect, it } from 'vitest';
import { pointInPoly } from '../../world/poly';
import { HANG_CLUES, HANG_LINEN, HANG_SPOT, HANG_TOP, HANG_WALK } from './aufbruch-hang';
import { BOOK2_CREDITS } from './aufbruch-credits';

const walkable = (x: number, y: number) => HANG_WALK.some(p => pointInPoly(x, y, p));

describe('e2-herbsthang geometry', () => {
  it('keeps every named spot and every clue on walkable ground', () => {
    for (const [id, [x, y]] of Object.entries(HANG_SPOT)) expect(walkable(x, y), id).toBe(true);
    for (const [id, [x, y]] of Object.entries(HANG_CLUES)) expect(walkable(x, y), id).toBe(true);
  });

  it('lets the top trigger touch the path and keeps the linen above the rest spot', () => {
    const cx = HANG_TOP.reduce((s, p) => s + p[0], 0) / HANG_TOP.length;
    const cy = HANG_TOP.reduce((s, p) => s + p[1], 0) / HANG_TOP.length;
    expect(walkable(cx, cy)).toBe(true);
    const linenBottom = Math.max(...HANG_LINEN.map(p => p[1]));
    expect(linenBottom).toBeLessThan(HANG_SPOT.rest[1]);
    // The pale shape passes behind (north of) the resting Lia.
    expect(HANG_SPOT.passFrom[1]).toBeLessThan(HANG_SPOT.rest[1]);
    expect(HANG_SPOT.passTo[1]).toBeLessThan(HANG_SPOT.rest[1]);
  });
});

describe('book two credits', () => {
  it('names the end of the second book, Ignatius and Vamir, and points to the third book', () => {
    expect(BOOK2_CREDITS).toContain('Ende des zweiten Buches');
    expect(BOOK2_CREDITS).toContain('Ignatius');
    expect(BOOK2_CREDITS).toContain('und Vamir');
    expect(BOOK2_CREDITS).toContain('dritten Buch');
    expect(BOOK2_CREDITS).not.toMatch(/Triss|Elhon|Vardis|Tolos/);
  });
});

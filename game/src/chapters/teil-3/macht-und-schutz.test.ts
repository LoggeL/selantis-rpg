import { afterEach, describe, expect, it, vi } from 'vitest';
import { G } from '../../core/G';
import type { ActorHandle } from '../../world';
import { figureScale } from '../../world/presentation';
import { buildPaintedGrid, normBlocks } from '../../world/navgrid';
import { distToPoly, pointInPoly, polyCentroid } from '../../world/poly';
import { STAFF } from '../common/bookContract';
import {
  BOWL_STILL, BOWL_THOUGHTS, IGNATIUS_ASKS, VERHANDLUNG_ANSWERS, VERHANDLUNG_TONES,
} from './macht-und-schutz-regeln';
import { hasOwnStaff, liaLook, prepareE3, staffPlace } from './shared';

vi.mock('../../world', () => ({ defineMap: (map: unknown) => map, startWorld: vi.fn() }));
import { doctorCandleAnchor, pruefungMap } from './macht-und-schutz';

function bowlGeometry() {
  const bowl = pruefungMap.interactables!.find(i => i.id === 'schale')!;
  const lean = pruefungMap.hidingSpots!.find(h => h.id === 'schale-beugen')!;
  if (!Array.isArray(bowl.standAt) || !bowl.poly || !lean.poly || bowl.radius === undefined) throw new Error('The bowl needs its real stand, hotspot, lean area and interaction radius.');
  const [x, y] = bowl.standAt;
  // The controller may finish up to 3 px from its goal. Sample the centre and a 3 px arrival circle.
  const arrivals = [[x, y], ...Array.from({ length: 32 }, (_, i) => [x + 3 * Math.cos(i * Math.PI / 16), y + 3 * Math.sin(i * Math.PI / 16)])];
  return { bowl, lean, arrivals };
}

afterEach(() => G.state.reset());

describe('e3-macht-und-schutz: the bowl', () => {
  it('keeps the real interaction stand and its arrival tolerance inside the leaning hiding spot', () => {
    const { lean, arrivals } = bowlGeometry();
    for (const [x, y] of arrivals) expect(pointInPoly(x, y, lean.poly!), `arrival ${x},${y}`).toBe(true);
  });

  it('allows an 8×4 half-foot at every arrival without colliding with the washstand or basket', () => {
    const { arrivals } = bowlGeometry();
    const grid = buildPaintedGrid(pruefungMap, 640, 360);
    for (const [x, y] of arrivals) expect(grid.boxFree(x, y, 8, 4), `arrival ${x},${y}`).toBe(true);
    // The gap must remain usable while both pieces of furniture retain their collision.
    for (const id of ['waschtisch', 'waschkorb']) {
      const block = normBlocks(pruefungMap).find(b => b.id === id);
      if (!block) throw new Error(`Missing furniture collision: ${id}`);
      const centre = polyCentroid(block.poly);
      expect(grid.solidAt(centre.x, centre.y), id).toBe(true);
    }
  });

  it('keeps the bowl in interaction range after arrival, including the 3 px tolerance', () => {
    const { bowl, arrivals } = bowlGeometry();
    for (const [x, y] of arrivals) expect(distToPoly(x, y, bowl.poly!), `arrival ${x},${y}`).toBeLessThanOrEqual(bowl.radius!);
  });

  it('lets calm thoughts leave the water still and only fear make it leap', () => {
    expect(BOWL_THOUGHTS.filter(b => b.effect === 'still').length).toBe(BOWL_STILL.length);
    expect(BOWL_THOUGHTS.some(b => b.effect === 'leap')).toBe(true);
    // The first option is calm, so a player who picks the top line still gets the doctor's boredom first.
    expect(BOWL_THOUGHTS[0].effect).toBe('still');
    for (const b of BOWL_THOUGHTS) {
      expect(b.text.length, b.id).toBeLessThanOrEqual(80);
      expect(b.thought.length, b.id).toBeLessThanOrEqual(140);
    }
  });
});

describe('e3-macht-und-schutz: the candle', () => {
  it('attaches the flame to the actual scaled sprite while preserving its ground sorting depth', () => {
    const doc = {
      x: 100, y: 200, dir: 'right',
      sprite: { x: 100, y: 194, scaleX: 2.2, scaleY: 2.2, flipX: false, depth: 204 },
    } as unknown as Pick<ActorHandle, 'x' | 'y' | 'dir' | 'sprite'>;
    const anchor = doctorCandleAnchor(doc);
    expect(anchor.at[0]).toBeCloseTo(106.6);
    expect(anchor.at[1]).toBeCloseTo(147.8);
    expect(anchor.depth).toBe(204); // A hop moves the sprite, not its ground depth.
    Object.assign(doc.sprite!, { x: 120, y: 210, scaleX: 1.5, scaleY: 1.2, flipX: true, depth: 214 });
    expect(doctorCandleAnchor(doc)).toEqual({ at: [115.5, 184.8], depth: 214 });
  });

  it.each([
    ['down', -8, -18], ['left', -4, -20], ['right', 3, -21], ['up', 6, -20],
  ] as const)('uses the visible %s hand from the actual walk sheet when no sprite is available', (dir, dx, dy) => {
    expect(doctorCandleAnchor({ x: 100, y: 200, dir, sprite: undefined })).toEqual({ at: [100 + dx, 200 + dy], depth: 200 });
  });
});

describe('e3-macht-und-schutz: the negotiation', () => {
  it('offers three tones that all carry the consent claim and the hall, in short lines', () => {
    expect([...VERHANDLUNG_TONES]).toEqual(['kalt', 'bittend', 'klug']);
    for (const t of VERHANDLUNG_TONES) {
      const a = VERHANDLUNG_ANSWERS[t];
      expect(a.length, t).toBeLessThanOrEqual(140);
      expect(a, t).toMatch(/Ohne mein Ja/);
      expect(a, t).toMatch(/Saal/);
      expect(a.startsWith('„') && a.endsWith('“'), t).toBe(true);
    }
    for (const a of IGNATIUS_ASKS) expect(a.length).toBeLessThanOrEqual(140);
  });
});

describe('e3-macht-und-schutz: direct entry', () => {
  it('starts bound, without staff, with the staff in the armoury and Schattentöter returned', () => {
    prepareE3('e3-macht-und-schutz');
    expect(G.state.is('e3-schutz-ausgeloest')).toBe(true);
    expect(hasOwnStaff()).toBe(false);
    expect(G.state.has(STAFF.borrowed)).toBe(false);
    expect(staffPlace()).toBe('waffenkammer');
    expect(liaLook()).not.toBe('e3-lia-eigenstab');
  });

  it('enters e3-falscher-glaube with the documented negotiation result', () => {
    prepareE3('e3-falscher-glaube');
    expect(G.state.is('e3-untersucht')).toBe(true);
    expect(G.state.is('e3-verhandelt')).toBe(true);
    expect(VERHANDLUNG_TONES).toContain(G.state.flag('e3-verhandlung-ton'));
  });
});

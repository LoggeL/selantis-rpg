import { describe, expect, it } from 'vitest';
import { pointInPoly } from '../../world/poly';
import { BEFORE_DAIS, HALL_BLOCKS, HALL_CANDLES, HALL_SPOT, HALL_WALK, hallCandleLights } from './schutzreaktion-saal';

const onFloor = (p: readonly [number, number]) =>
  HALL_WALK.some(w => pointInPoly(p[0], p[1], w)) && !HALL_BLOCKS.some(b => pointInPoly(p[0], p[1], b.poly));

describe('e3-schutzreaktion hall', () => {
  it('puts everyone who walks or gets pushed on the open floor; only the high chair is off it', () => {
    for (const k of ['door', 'lia', 'mentor', 'holder', 'mentorGuard', 'captain', 'sideLeft', 'sideRight', 'table'] as const) {
      expect(onFloor(HALL_SPOT[k]), k).toBe(true);
    }
    expect(onFloor(HALL_SPOT.chair)).toBe(false);
    // Knock-back targets of the blast (schutzreaktion.ts).
    for (const p of [[234, 262], [250, 150], [470, 196], [430, 270], [470, 140]] as const) expect(onFloor(p), String(p)).toBe(true);
  });

  it('starts the interrogation in front of the dais, not at the door', () => {
    expect(pointInPoly(HALL_SPOT.lia[0], HALL_SPOT.lia[1], BEFORE_DAIS)).toBe(true);
    expect(pointInPoly(HALL_SPOT.door[0], HALL_SPOT.door[1], BEFORE_DAIS)).toBe(false);
  });

  it('has one light per painted candle, each with its own id (they go out one by one)', () => {
    const lights = hallCandleLights();
    expect(lights).toHaveLength(HALL_CANDLES.length);
    expect(new Set(lights.map(l => l.id)).size).toBe(lights.length);
    for (const l of lights) expect(l.kind).toBe('candle');
  });
});

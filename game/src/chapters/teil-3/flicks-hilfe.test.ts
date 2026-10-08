import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { pointInPoly } from '../../world/poly';
import { CAMP_BLOCKS } from './falle-lager';
import {
  keepAway, NIGHT_CAMERA, NIGHT_SPOT, NIGHT_WALK, PATH_EXIT, PROOF_OPTIONS, ROPE_TURNS, TONE_OPTIONS, vouchLines, WOLF_NEAR, WOLF_STAGES,
} from './flicks-hilfe-wege';
import { HALL_SPOT, HALL_WALK } from './schutzreaktion-saal';
import { hasOwnStaff, prepareE3, staffPlace } from './shared';

afterEach(() => G.state.reset());

const walkable = (at: readonly [number, number]) =>
  NIGHT_WALK.some(p => pointInPoly(at[0], at[1], p)) && !CAMP_BLOCKS.some(b => pointInPoly(at[0], at[1], b.poly));

describe('the camp at night (e3-falsches-lager-nacht)', () => {
  it('keeps the post, the brand, the ruts and the way out on open ground, west of where the wagon stood', () => {
    for (const [id, at] of Object.entries(NIGHT_SPOT)) {
      expect(walkable(at), id).toBe(true);
      expect(at[0], id).toBeLessThan(NIGHT_CAMERA.x + NIGHT_CAMERA.w);
    }
    expect(pointInPoly(NIGHT_SPOT.pathOut[0], NIGHT_SPOT.pathOut[1], PATH_EXIT)).toBe(true);
    // Nothing of the night camp reaches the painted wagon (x ≥ 985).
    for (const p of NIGHT_WALK) for (const [x] of p) expect(x).toBeLessThan(985);
    expect(NIGHT_CAMERA.x + NIGHT_CAMERA.w).toBeLessThanOrEqual(1000);
  });
});

describe('the wolves', () => {
  it('gather in more pairs and closer with every turn of the rope', () => {
    expect(WOLF_STAGES.length).toBe(ROPE_TURNS);
    for (let i = 1; i < WOLF_STAGES.length; i++) expect(WOLF_STAGES[i].length).toBeGreaterThanOrEqual(WOLF_STAGES[i - 1].length);
    const dist = (s: readonly (readonly [number, number])[]) => Math.min(...s.map(p => Math.hypot(p[0] - NIGHT_SPOT.post[0], p[1] - NIGHT_SPOT.post[1])));
    expect(dist(WOLF_STAGES[2])).toBeLessThan(dist(WOLF_STAGES[0]));
  });

  it('keep their distance from Flick, further while she holds a brand', () => {
    const flick: [number, number] = [600, 400];
    const near = keepAway([610, 400], flick, [610, 380], WOLF_NEAR.brand);
    expect(Math.hypot(near[0] - flick[0], near[1] - flick[1])).toBeCloseTo(WOLF_NEAR.brand, 0);
    const far = keepAway([900, 200], flick, [890, 200], WOLF_NEAR.bare, 4);
    expect(far[0]).toBeCloseTo(896, 0);
    expect(WOLF_NEAR.brand).toBeGreaterThan(WOLF_NEAR.bare);
    const same = keepAway(flick, flick, flick, 50);
    expect(Math.hypot(same[0] - flick[0], same[1] - flick[1])).toBeCloseTo(50, 0);
  });
});

describe('the hall', () => {
  it('offers three tones and three proofs, each with its own reaction, and Ignatius always vouches', () => {
    expect(TONE_OPTIONS.map(o => o.key)).toEqual(['spott', 'ehrlich', 'ignatius']);
    expect(PROOF_OPTIONS.map(o => o.key)).toEqual(['striemen', 'weg', 'geduld']);
    for (const o of [...TONE_OPTIONS, ...PROOF_OPTIONS]) {
      expect(o.lines[0].who).toBe('e2-flick');
      expect(o.lines.some(l => l.who === 'e3-grossmeister')).toBe(true);
    }
    for (const t of ['spott', 'ehrlich', 'ignatius'] as const) expect(vouchLines(t)[0].who).toBe('e2-ignatius');
  });

  it('keeps lines and choices within one box, and Flick stays an elf', () => {
    const lines = [...TONE_OPTIONS, ...PROOF_OPTIONS].flatMap(o => [o.text, ...o.lines.map(l => l.text)]).concat(vouchLines('spott').map(l => l.text));
    for (const t of lines) expect(t.length, t).toBeLessThanOrEqual(140);
    expect(lines.join(' ')).not.toMatch(/Elbe|Halbelf/);
  });

  it('stands Flick on the hall floor in front of the dais', () => {
    expect(HALL_WALK.some(p => pointInPoly(HALL_SPOT.lia[0] + 10, HALL_SPOT.lia[1], p))).toBe(true);
  });
});

describe('the staff on its way', () => {
  it('is in the armoury when Flick reaches Trapas and with Flick afterwards; Lia never holds it meanwhile', () => {
    prepareE3('e3-flicks-hilfe');
    expect(staffPlace()).toBe('waffenkammer');
    expect(hasOwnStaff()).toBe(false);
    G.state.reset();
    prepareE3('e3-hoffnung-und-weigerung');
    expect(staffPlace()).toBe('flick');
    expect(hasOwnStaff()).toBe(false);
    expect(G.state.is('e3-flick-gemeldet')).toBe(true);
    expect(G.state.is('e3-orden-rueckt-aus')).toBe(true);
  });
});

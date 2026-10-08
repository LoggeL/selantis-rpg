import { describe, expect, it } from 'vitest';
import { BEAT_NOISE, BEAT_YOUNG, beatGoods, clampPoints, rescueSetup, verdict } from './bluff';
import { dodgeWindow } from './dodge';
import { corridor, ellipse, inside } from './geom';

describe('kapitel-5 bluff', () => {
  it('offers item options only for what Lia carries', () => {
    const none = beatGoods(() => false).map(o => o.tag);
    expect(none).toEqual([undefined, undefined]);
    const all = beatGoods(() => true);
    expect(all.map(o => o.tag)).toEqual(['Kräuterlexikon', 'Honig-Apfelkuchen', 'Käse', 'Alana-Buch', undefined]);
    expect(all.find(o => o.tag === 'Käse')?.take).toBe('cheese');
  });

  it('every beat has a good and a bad answer', () => {
    for (const beat of [BEAT_YOUNG, BEAT_NOISE, beatGoods(() => true)]) {
      expect(beat.some(o => o.delta > 0)).toBe(true);
      expect(beat.some(o => o.delta < 0)).toBe(true);
      for (const o of beat) for (const [, text] of o.reply) expect(text.length).toBeLessThanOrEqual(140);
    }
  });

  it('clamps points and has a verdict for each level', () => {
    expect(clampPoints(-2)).toBe(0);
    expect(clampPoints(7)).toBe(3);
    for (let p = 0; p <= 3; p++) expect(verdict(p).length).toBeGreaterThan(10);
  });

  it('rescue setup follows the distraction points and the dagger', () => {
    const bad = rescueSetup(0, false);
    expect(bad.guardsSkipFirst).toBe(false);
    expect(bad.flick).toEqual({ x: 9, y: 2 });
    expect(bad.liaExtra).toEqual([]);
    expect(bad.flickAbilities).toContain('k5-schneiden');
    const mid = rescueSetup(2, true);
    expect(mid.guardsSkipFirst).toBe(true);
    expect(mid.flick).toEqual({ x: 8, y: 4 });
    expect(mid.liaExtra).toEqual(['k5-schneiden']);
    const best = rescueSetup(3, true);
    expect(best.firstCutDone).toBe(true);
    expect(best.flickAbilities).toContain('k5-losschneiden');
    expect(best.liaExtra).toEqual(['k5-losschneiden']);
  });
});

describe('kapitel-5 dodge timing', () => {
  it('has an early, a good and a late zone', () => {
    expect(dodgeWindow(0.3)).toBe('early');
    expect(dodgeWindow(0.8)).toBe('good');
    expect(dodgeWindow(1.0)).toBe('good');
    expect(dodgeWindow(1.3)).toBe('late');
  });
});

describe('kapitel-5 geometry helpers', () => {
  it('corridor encloses its centre line and not points far away', () => {
    const line = [[0, 0], [100, 0], [200, 50]] as const;
    const poly = corridor(line, 10);
    expect(poly).toHaveLength(6);
    expect(inside(50, 0, poly)).toBe(true);
    expect(inside(150, 25, poly)).toBe(true);
    expect(inside(50, 30, poly)).toBe(false);
  });

  it('ellipse polygon contains its centre', () => {
    const e = ellipse(10, 10, 5, 3, 16);
    expect(e).toHaveLength(16);
    expect(inside(10, 10, e)).toBe(true);
    expect(inside(20, 10, e)).toBe(false);
  });
});

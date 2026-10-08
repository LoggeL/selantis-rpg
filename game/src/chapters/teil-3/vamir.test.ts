import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { pointInPoly } from '../../world/poly';
import { STAFF } from '../common/bookContract';
import { duelSetupFromState } from './vamir-duell-battle';
import { LATE_STAGGER_BARKS } from './vamir-schwaeche';
import { OPENING_THOUGHTS, SCHATTENTOETER_FOUND, TABLEAU, TRAIL, TRAIL_IDS, VOICES, nextFind, pickUpSchattentoeter, trailFlag, trailFound } from './vamir-spur';
import { HIDE_ZONE, WALDPFAD_BLOCKS, WALDPFAD_SPOT, WALDPFAD_WALK } from './waldpfad';
import { hasOwnStaff, liaSpeedFactor, poisoned, prepareE3 } from './shared';

afterEach(() => G.state.reset());

const walkable = (at: readonly [number, number]) =>
  WALDPFAD_WALK.some(p => pointInPoly(at[0], at[1], p)) && !WALDPFAD_BLOCKS.some(b => pointInPoly(at[0], at[1], b.poly));

describe('the forest path (e3-waldpfad)', () => {
  it('keeps every stand point, the trail and the bank on open ground', () => {
    for (const [id, at] of Object.entries(WALDPFAD_SPOT)) expect(walkable(at), id).toBe(true);
    for (const t of TRAIL) expect(walkable(t.at), t.id).toBe(true);
  });

  it('keeps the trail on the lower path, out of view of the bank (camera half height 180 px above the bottom)', () => {
    for (const t of TRAIL) expect(t.at[1], t.id).toBeGreaterThanOrEqual(540);
    expect(WALDPFAD_SPOT.ignatius[1]).toBeLessThan(540 - 180);
    expect(WALDPFAD_SPOT.vamir[1]).toBeLessThan(540 - 180);
  });

  it('starts the confrontation only behind the bush', () => {
    expect(pointInPoly(WALDPFAD_SPOT.hide[0], WALDPFAD_SPOT.hide[1], HIDE_ZONE)).toBe(true);
    expect(pointInPoly(WALDPFAD_SPOT.start[0], WALDPFAD_SPOT.start[1], HIDE_ZONE)).toBe(false);
    for (const t of TRAIL) expect(pointInPoly(t.at[0], t.at[1], HIDE_ZONE), t.id).toBe(false);
  });
});

describe('the trail', () => {
  it('leads through the three finds in path order', () => {
    expect(TRAIL_IDS).toEqual(['brand', 'stab', 'spur']);
    expect(nextFind(new Set())!.id).toBe('brand');
    expect(nextFind(new Set(['brand']))!.id).toBe('stab');
    expect(nextFind(new Set(['brand', 'stab']))!.id).toBe('spur');
    expect(nextFind(new Set(TRAIL_IDS))).toBeUndefined();
    G.state.set(trailFlag('stab'));
    expect([...trailFound()]).toEqual(['stab']);
  });

  it('gives Schattentöter exactly once, even when the find is read again after a reload', () => {
    prepareE3('e3-vamir');
    expect(G.state.has(STAFF.borrowed)).toBe(false);
    expect(pickUpSchattentoeter()).toBe(true);
    expect(pickUpSchattentoeter()).toBe(false);
    expect(G.state.count(STAFF.borrowed)).toBe(1);
    expect(G.state.is(SCHATTENTOETER_FOUND)).toBe(true);
  });

  it('keeps every line within one dialogue box and the barks short', () => {
    for (const t of [...TRAIL.map(f => f.thought), ...VOICES.map(v => v.text), ...TABLEAU.map(v => v.text), ...OPENING_THOUGHTS]) {
      expect(t.length, t).toBeLessThanOrEqual(140);
    }
    for (const b of LATE_STAGGER_BARKS) expect(b.length, b).toBeLessThanOrEqual(40);
  });
});

describe('the direct entry into e3-vamir and the duel kit', () => {
  it('starts poisoned (slow) with her own staff, after the ritual', () => {
    prepareE3('e3-vamir');
    expect(poisoned()).toBe(true);
    expect(liaSpeedFactor()).toBeLessThan(1);
    expect(hasOwnStaff()).toBe(true);
    expect(G.state.is('e3-ritual-gebrochen')).toBe(true);
    expect(G.state.is('e3-vamir-besiegt')).toBe(false);
    const kit = duelSetupFromState();
    expect(kit).toMatchObject({ ownStaff: true, poisoned: true, schattentoeter: false, won: false });
  });

  it('lets the found Schattentöter bring the Stabimpuls into the duel (the rule reads the inventory)', () => {
    prepareE3('e3-vamir');
    pickUpSchattentoeter();
    expect(duelSetupFromState().schattentoeter).toBe(G.state.knows('e2-stabimpuls'));
  });

  it('hands the later scenes the found Schattentöter once and the defeated Vamir', () => {
    prepareE3('e3-ignatius-abschied');
    expect(G.state.count(STAFF.borrowed)).toBe(1);
    expect(G.state.is('e3-vamir-besiegt')).toBe(true);
    expect(hasOwnStaff()).toBe(true);
  });
});

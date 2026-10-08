import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { pointInPoly } from '../../world/poly';
import {
  CAMP_BLOCKS, CAMP_HOTSPOT, CAMP_SPOT, CAMP_WALK, FIND_IDS, FIND_THOUGHTS, FINDS, FINDS_FOR_TRAP, findCount, KYRA_DEFLECT, KYRA_URGE,
  lastWords,
} from './falle-lager';
import { hasOwnStaff, liaLook, poisoned, prepareE3, staffPlace } from './shared';

afterEach(() => G.state.reset());

const walkable = (at: readonly [number, number]) =>
  CAMP_WALK.some(p => pointInPoly(at[0], at[1], p)) && !CAMP_BLOCKS.some(b => pointInPoly(at[0], at[1], b.poly));

describe('the false camp (e3-falsches-lager)', () => {
  it('keeps the path, the fire seats, the trap positions and the stand points on open ground', () => {
    for (const id of ['path', 'pathTop', 'liaFire', 'kyraFire', 'barisTrap', 'manWestTrap', 'manEastTrap', 'cage', 'post', 'vamirFire', 'kyraEvening', 'barisEvening', 'barisAtPost'] as const) {
      expect(walkable(CAMP_SPOT[id] as readonly [number, number]), id).toBe(true);
    }
    for (const at of CAMP_SPOT.menFire) expect(walkable(at), String(at)).toBe(true);
    for (const at of [CAMP_HOTSPOT.wagonStand, CAMP_HOTSPOT.tentNorthStand, CAMP_HOTSPOT.tentEastStand]) expect(walkable(at), String(at)).toBe(true);
  });

  it('places the Spurenblick finds on open ground and the hidden ambushers off the walkable camp', () => {
    expect(walkable(FINDS.stiefel.at)).toBe(true);
    expect(walkable(FINDS.fetzen.at)).toBe(true);
    // Baris waits behind the east tent: inside its footprint, above its baseline (drawn behind the canvas).
    const tent = CAMP_BLOCKS.find(b => b.id === 'zelt-ost')!.poly;
    expect(pointInPoly(CAMP_SPOT.barisHide[0], CAMP_SPOT.barisHide[1], tent)).toBe(true);
    for (const at of [CAMP_SPOT.manWestHide, CAMP_SPOT.manEastHide]) expect(walkable(at), String(at)).toBe(false);
  });
});

describe('the finds', () => {
  it('has three finds, each with its own journal clue, and a thought for every count', () => {
    expect(FIND_IDS.length).toBe(FINDS_FOR_TRAP);
    expect(new Set(FIND_IDS.map(id => FINDS[id].clue)).size).toBe(3);
    for (const id of FIND_IDS) expect(FINDS[id].clue.startsWith('e3-')).toBe(true);
    expect(FIND_THOUGHTS.length).toBe(FINDS_FOR_TRAP + 1);
    expect(FIND_THOUGHTS[FINDS_FOR_TRAP]).toMatch(/kein Lager für Rebellen/);
  });

  it('clamps the stored count and lets Lia see more the more she found', () => {
    expect(findCount(undefined)).toBe(0);
    expect(findCount('2')).toBe(2);
    expect(findCount(9)).toBe(3);
    expect(findCount(-1)).toBe(0);
    expect(lastWords(0).text).not.toMatch(/Rebellenlager/);
    expect(lastWords(1).text).toMatch(/stimmt hier nicht/);
    expect(lastWords(3).text).toMatch(/kein Rebellenlager/);
  });

  it('keeps all lines within one dialogue box and barks short', () => {
    for (const t of [...FIND_THOUGHTS, ...KYRA_DEFLECT, ...FIND_IDS.map(id => FINDS[id].look), ...[0, 1, 3].map(n => lastWords(n).text)]) {
      expect(t.length, t).toBeLessThanOrEqual(140);
    }
    for (const b of KYRA_URGE) expect(b.length, b).toBeLessThanOrEqual(40);
  });
});

describe('the direct entry into e3-falle', () => {
  it('starts poisoned, without the own staff (it hangs in the armoury) and in the travel cloak', () => {
    prepareE3('e3-falle');
    expect(poisoned()).toBe(true);
    expect(hasOwnStaff()).toBe(false);
    expect(staffPlace()).toBe('waffenkammer');
    expect(G.state.is('e3-gefangen')).toBe(false);
    expect(liaLook()).not.toBe('e3-lia-eigenstab');
  });
});

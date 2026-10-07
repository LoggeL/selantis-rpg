import { describe, expect, it } from 'vitest';
import { KEY_SIGHT_PX, OBSERVATIONS, observationAt, roundPhases, SHACKLE_OPTIONS, unwatched } from './zellengespraeche-routine';

describe('wardens routine in the cells (e2-zellengespraeche)', () => {
  it('shows the key bunch only while the key warden passes close by', () => {
    expect(observationAt('runde', KEY_SIGHT_PX - 1)).toBe('schluessel');
    expect(observationAt('runde', KEY_SIGHT_PX + 40)).toBeNull();
    expect(observationAt('treppe', 400)).toBe('doesen');
    expect(observationAt('zu-zweit', 999)).toBe('zu-zweit');
  });

  it('makes every observation reachable within two rounds', () => {
    const seen = new Set<string>();
    for (const round of [0, 1]) for (const phase of roundPhases(round)) {
      const o = observationAt(phase, phase === 'runde' ? 40 : 500);
      if (o) seen.add(o);
    }
    expect([...seen].sort()).toEqual([...OBSERVATIONS].sort());
  });

  it('leaves the cell unwatched only while the key warden is away from the cells', () => {
    expect(unwatched('runde')).toBe(false);
    expect(unwatched('treppe')).toBe(true);
    expect(unwatched('zu-zweit')).toBe(true);
    expect(roundPhases(0).some(unwatched)).toBe(true);
  });

  it('offers exactly one way that would lock the shackle again', () => {
    expect(SHACKLE_OPTIONS.filter(o => !o.ok).map(o => o.id)).toEqual(['zu']);
    expect(SHACKLE_OPTIONS.filter(o => o.ok).length).toBe(2);
  });
});

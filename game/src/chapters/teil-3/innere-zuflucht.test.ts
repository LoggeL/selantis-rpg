import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { pointInPoly } from '../../world/poly';
import {
  AFTER_VOICES, CAMP_CUT, INNER_BLOCKS, INNER_SPOT, INNER_WALK, MEMORIES, MEMORY_IDS, memoryObjective, openMemories, OUTSIDE_VOICES,
  UNDER_THE_OAK,
} from './innere-zuflucht-welt';
import { prepareE3 } from './shared';

afterEach(() => G.state.reset());

const walkable = (at: readonly [number, number]) =>
  INNER_WALK.some(p => pointInPoly(at[0], at[1], p)) && !INNER_BLOCKS.some(b => pointInPoly(at[0], at[1], b.poly));

describe('the inner meadow (e3-innenwelt)', () => {
  it('keeps the start, the seat under the oak and every memory stand point on the meadow', () => {
    expect(walkable(INNER_SPOT.start)).toBe(true);
    expect(walkable(INNER_SPOT.oakSeat)).toBe(true);
    for (const id of MEMORY_IDS) {
      expect(walkable(MEMORIES[id].stand), id).toBe(true);
      if (MEMORIES[id].figure) expect(walkable(MEMORIES[id].figure!.at), id).toBe(true);
    }
  });

  it('starts with the middle of the meadow free of fog and lifts one patch per memory', () => {
    for (const id of MEMORY_IDS) {
      const f = MEMORIES[id].fog;
      const inside = Math.abs(INNER_SPOT.start[0] - f.at[0]) < f.w / 2 && Math.abs(INNER_SPOT.start[1] - f.at[1]) < f.h / 2;
      expect(inside, id).toBe(false);
      // The bright place lies under its own fog patch.
      expect(Math.abs(MEMORIES[id].at[0] - f.at[0]) < f.w / 2 && Math.abs(MEMORIES[id].at[1] - f.at[1]) < f.h / 2, id).toBe(true);
    }
  });
});

describe('memories and voices', () => {
  it('counts down the open memories in any order', () => {
    const done = new Set<typeof MEMORY_IDS[number]>();
    expect(openMemories(done)).toEqual(['buch', 'holz', 'mutter']);
    done.add('mutter');
    expect(openMemories(done)).toEqual(['buch', 'holz']);
    expect(memoryObjective(0)).toMatch(/Helles/);
    expect(memoryObjective(3)).toMatch(/Eiche/);
  });

  it('remembers book one: the Alana book, Kyra with firewood, mother teaching her to read', () => {
    expect(MEMORIES.buch.lines.some(l => l.text.includes('Alana'))).toBe(true);
    expect(MEMORIES.holz.figure?.preset).toBe('kyra');
    expect(MEMORIES.mutter.figure?.preset).toBe('mother');
    expect(MEMORIES.mutter.lines.some(l => l.who === 'mutter')).toBe(true);
  });

  it('lets voices from outside in twice (after the first two memories), each followed by a thought', () => {
    expect(OUTSIDE_VOICES.length).toBe(MEMORY_IDS.length - 1);
    expect(AFTER_VOICES.length).toBe(OUTSIDE_VOICES.length);
    // Nobody is named in the muffled voices (Lia cannot see who speaks).
    for (const l of OUTSIDE_VOICES.flat()) expect(l.who).not.toMatch(/Baris|Vamir|Kyra/);
  });

  it('keeps every line short enough for one box', () => {
    const all = [
      ...MEMORY_IDS.flatMap(id => MEMORIES[id].lines.map(l => l.text)), ...OUTSIDE_VOICES.flat().map(l => l.text), ...AFTER_VOICES,
      ...UNDER_THE_OAK.map(l => l.text), ...CAMP_CUT.speech.map(l => l.text), ...CAMP_CUT.rescue.map(l => l.text), ...CAMP_CUT.stone.map(l => l.text), ...CAMP_CUT.parting.map(l => l.text),
    ];
    for (const t of all) expect(t.length, t).toBeLessThanOrEqual(140);
  });

  it('uses only the established names in the camp cut (no „Elbe“, no „Vardis“)', () => {
    const all = [...CAMP_CUT.speech, ...CAMP_CUT.rescue, ...CAMP_CUT.stone, ...CAMP_CUT.parting].map(l => l.text).join(' ');
    expect(all).not.toMatch(/Elbe|Vardis/);
  });
});

describe('the direct entry', () => {
  it('starts the refuge caught and poisoned, and ends it with e3-zuflucht-1 for the next scene', () => {
    prepareE3('e3-innere-zuflucht');
    expect(G.state.is('e3-gefangen')).toBe(true);
    expect(G.state.is('e3-zuflucht-1')).toBe(false);
    G.state.reset();
    prepareE3('e3-flicks-hilfe');
    expect(G.state.is('e3-zuflucht-1')).toBe(true);
  });
});

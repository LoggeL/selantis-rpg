import { describe, expect, it } from 'vitest';
import { consumeCampMeal } from './campMeal';
import type { WorldState } from '../world/quests';

const camp = (proviant: number | undefined, flags: Record<string, boolean> = { campfireLit: true }): WorldState => ({
  flags: { ...flags }, inv: proviant === undefined ? {} : { proviant }, picked: {},
});

describe('a confirmed camp meal', () => {
  it('uses one carried ration and records the meal only once', () => {
    const world = camp(3);
    expect(consumeCampMeal(world)).toBe('ate');
    expect(world.inv.proviant).toBe(2);
    expect(world.flags).toMatchObject({ journeyAte: true, journeyProviantPortionUsed: true });
    const afterMeal = structuredClone(world);
    expect(consumeCampMeal(world)).toBe('already-ate');
    expect(world).toEqual(afterMeal);
  });

  it('removes the last ration from the inventory', () => {
    const world = camp(1);
    expect(consumeCampMeal(world)).toBe('ate');
    expect(world.inv).not.toHaveProperty('proviant');
  });

  it('keeps provisions and progress unchanged before the fire is lit', () => {
    const world = camp(2, {}), before = structuredClone(world);
    expect(consumeCampMeal(world)).toBe('fire-unlit');
    expect(world).toEqual(before);
  });

  it.each([undefined, 0, -1, 0.5, NaN, Infinity])('refuses absent or insufficient provisions (%s)', amount => {
    const world = camp(amount), before = structuredClone(world);
    expect(consumeCampMeal(world)).toBe('no-provisions');
    expect(world).toEqual(before);
  });
});

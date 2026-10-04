import { describe, expect, it } from 'vitest';
import { createCampaignState, type CampaignState } from "../campaign/state";
import { campStep, executeCampAction, restoreCamp, type CampAction } from "./progression";

const prepared = (): CampaignState => ({ ...createCampaignState(), inv: { reisezeug: 1, proviant: 2 } });
const preparation: CampAction[] = ['spread-cloak', 'gather-stones', 'build-firepit', 'gather-twigs', 'light-fire', 'eat', 'rest', 'introduce-companions'];

describe('camp progression authority', () => {
  it('replays preparation safely across reconstructed scene adapters and consumes resources once', () => {
    const world = prepared();
    const observed = [campStep(world)];
    for (const action of preparation) {
      expect(executeCampAction(world, action).accepted).toBe(true);
      observed.push(campStep(world));
      const snapshot = structuredClone(world);
      expect(executeCampAction(world, action)).toMatchObject({ accepted: false, reason: 'already-complete' });
      expect(world).toEqual(snapshot);
    }
    expect(observed).toEqual(['cloak', 'stones', 'ring', 'twigs', 'fire', 'meal', 'sleep', 'waking', 'star']);
    expect(world.inv).toEqual({ reisezeug: 1, proviant: 1 });
    expect(world.flags.journeyProviantPortionUsed).toBe(true);
    expect(executeCampAction(world, 'recover-cloak').accepted).toBe(true);
    expect(world.flags.criosObserved).toBeUndefined();
    const morning = structuredClone(world);
    expect(executeCampAction(world, 'recover-cloak').accepted).toBe(false);
    expect(world).toEqual(morning);
  });

  it('rejects out-of-order actions without changing inventory or flags', () => {
    for (const action of preparation.slice(1)) {
      const world = prepared(), before = structuredClone(world);
      expect(executeCampAction(world, action)).toMatchObject({ accepted: false, reason: 'wrong-step' });
      expect(world).toEqual(before);
    }
  });

  it.each([0, -1, 0.5, NaN, Infinity])('rejects malformed meal inventory atomically (%s)', proviant => {
    const world = prepared();
    world.flags.campfireLit = true; world.inv.proviant = proviant;
    const before = structuredClone(world);
    expect(executeCampAction(world, 'eat').accepted).toBe(false);
    expect(world).toEqual(before);
  });

  it('validates resources again when a delayed fire completion arrives', () => {
    const world = prepared();
    for (const action of preparation.slice(0, 4)) executeCampAction(world, action);
    delete world.inv.zunderholz;
    const before = structuredClone(world);
    expect(executeCampAction(world, 'light-fire')).toMatchObject({ accepted: false, reason: 'missing-wood' });
    expect(world).toEqual(before);
    expect(campStep(world)).toBe('fire');
  });

  it('requires a fire and meal before resting, then permits optional Crios reflection', () => {
    const world = prepared(); world.flags.journeyAte = true;
    expect(executeCampAction(world, 'rest')).toMatchObject({ accepted: false, reason: 'fire-unlit' });
    world.flags.campfireLit = true;
    expect(executeCampAction(world, 'rest').accepted).toBe(true);
    expect(executeCampAction(world, 'introduce-companions').accepted).toBe(true);
    expect(executeCampAction(world, 'observe-crios').accepted).toBe(true);
    expect(campStep(world)).toBe('complete');
    expect(executeCampAction(world, 'recover-cloak').accepted).toBe(true);
  });

  it('restores legacy fireplaces without granting or consuming any inventory', () => {
    const world = prepared(); world.flags.campfireLit = true;
    const inventory = structuredClone(world.inv);
    restoreCamp(world); restoreCamp(world);
    expect(world.inv).toEqual(inventory);
    expect(world.flags).toMatchObject({ journeyStonesGathered: true, journeyFirepitBuilt: true });
    expect(campStep(world)).toBe('meal');
  });
});

import { describe, expect, it } from 'vitest';
import { liaCloakOnGround, resolveLiaAppearance } from './appearance';
import { prepareWarp } from './debugState';
import type { WorldState } from './world/quests';

describe('Lia carries her belongings through the story', () => {
  it('drops the opening book at her father\'s death and changes clothes independently of book packing', () => {
    const flags: Record<string, boolean> = {};
    expect(resolveLiaAppearance({ flags })).toMatchObject({ texture: 'lia-walk', bookUnderArm: true });
    flags.parentDeath = true;
    expect(resolveLiaAppearance({ flags })).toMatchObject({ texture: 'lia-farm-walk', bookUnderArm: false });
    flags.packedClothes = true;
    expect(resolveLiaAppearance({ flags })).toMatchObject({ texture: 'lia-travel-walk', bookUnderArm: false });
    flags.packedBooks = true;
    expect(resolveLiaAppearance({ flags })).toMatchObject({ texture: 'lia-travel-walk', bookUnderArm: false });
    expect(resolveLiaAppearance({ flags: { raidWitnessed: true, packedBooks: true } })).toMatchObject({ texture: 'lia-farm-walk', bookUnderArm: false });
  });

  it.each(['house', 'hof', 'felder', 'road-east'])('preserves the packed model when reentering %s', areaId => {
    const flags = { packedBooks: true, packedClothes: true };
    expect(resolveLiaAppearance({ flags, areaId, direction: 'w', moving: true }).animation).toBe('lia-travel-walk-w');
    expect(resolveLiaAppearance({ flags, areaId, direction: 'w' }).animation).toBe('lia-travel-idle-w');
  });

  it('accepts an older departure checkpoint without forcing the opening book back into her hand', () => {
    expect(resolveLiaAppearance({ flags: { departureReady: true }, areaId: 'felder' }).profile).toBe('lia-travel');
  });

  it('resets later appearance flags when jumping back to an earlier development checkpoint', () => {
    const st: WorldState = { flags: { parentDeath: true, journeyCloakRecovered: true }, inv: {}, picked: {} };
    prepareWarp(st, 'lia');
    expect(resolveLiaAppearance({ flags: st.flags }).profile).toBe('lia');
    prepareWarp(st, 'strangers');
    expect(resolveLiaAppearance({ flags: st.flags, areaId: 'first-camp' })).toMatchObject({ cloakOnGround: true, cloakWorn: false });
    prepareWarp(st, 'companions-road');
    expect(resolveLiaAppearance({ flags: st.flags, areaId: 'companion-morning' })).toMatchObject({ cloakOnGround: false, cloakWorn: true });
  });

  it('takes the cloak off to make her bed and keeps it there during sleep and the night encounter', () => {
    const flags = { departureReady: true, journeyCampReached: true, journeyCloakSpread: false };
    expect(resolveLiaAppearance({ flags, areaId: 'first-camp' }).texture).toBe('lia-cloak-walk');
    flags.journeyCloakSpread = true;
    for (const areaId of ['first-camp', 'road-east', 'felder']) {
      expect(resolveLiaAppearance({ flags, areaId })).toMatchObject({ profile: 'lia-travel', cloakWorn: false, cloakOnGround: true });
    }
    for (const pose of ['lia-sleep', 'lia-wake']) {
      expect(resolveLiaAppearance({ flags, areaId: 'first-camp', pose })).toMatchObject({ animation: pose, cloakWorn: false });
    }
  });

  it('recovers the bedroll for the next day, including old saves and return visits', () => {
    for (const checkpoint of ['journeyCloakRecovered', 'companionMorningStarted']) {
      const flags = { departureReady: true, journeyCloakSpread: true, [checkpoint]: true };
      for (const areaId of ['companion-morning', 'companion-afternoon', 'first-camp', 'hof']) {
        expect(resolveLiaAppearance({ flags, areaId })).toMatchObject({ profile: 'lia-cloak', cloakWorn: true, cloakOnGround: false });
      }
      expect(liaCloakOnGround(flags)).toBe(false);
    }
  });

  it('retains crouching and authored poses without changing the persistent flags', () => {
    const flags = Object.freeze({ packedBooks: true, packedClothes: true });
    expect(resolveLiaAppearance({ flags, direction: 'w', moving: true, crouched: true })).toMatchObject({ animation: 'lia-crouch-walk-w', flipX: false });
    expect(resolveLiaAppearance({ flags, direction: 'w', pose: 'lia-grieve', crouched: true })).toMatchObject({ animation: 'lia-grieve', flipX: false });
    expect(flags).toEqual({ packedBooks: true, packedClothes: true });
  });
});

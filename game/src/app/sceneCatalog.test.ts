import { describe, expect, it } from 'vitest';
import { campaignCheckpoint } from "../modules/campaign/checkpoints";
import { createCampaignState } from "../modules/campaign/state";
import { DEBUG_STARTUPS, SCENE_CATALOG, isSceneKey, isStartupSceneKey, resolveStartup } from "./sceneCatalog";

describe('validated app startup', () => {
  it('falls back to the title for unknown, internal, and inherited object names', () => {
    for (const name of ['', 'unknown', 'boot', 'Settings', 'constructor', '__proto__', 'world:unknown']) {
      expect(resolveStartup(`?scene=${name}`)).toEqual({ scene: 'title', data: {}, direct: false });
    }
    expect(resolveStartup('')).toEqual({ scene: 'title', data: {}, direct: false });
    expect(isSceneKey('boot')).toBe(true);
    expect(isStartupSceneKey('boot')).toBe(false);
  });

  it('preserves direct scenes and supplies validated map data', () => {
    for (const scene of Object.keys(SCENE_CATALOG).filter(isStartupSceneKey)) {
      expect(resolveStartup(`?scene=${scene}`).scene).toBe(scene);
    }
    expect(resolveStartup('?scene=world&map=waldrand')).toMatchObject({ scene: 'world', data: { map: 'waldrand' }, checkpoint: 'world:waldrand' });
    expect(resolveStartup('?scene=world&map=missing')).toMatchObject({ data: { map: 'wiese' }, checkpoint: 'world:wiese' });
    expect(resolveStartup('?scene=journey')).toMatchObject({ scene: 'journey', checkpoint: 'road' });
  });

  it('routes every debug entry to the same canonical campaign destination', () => {
    for (const [id] of DEBUG_STARTUPS) {
      const route = resolveStartup(new URLSearchParams({ scene: id }));
      const expected = campaignCheckpoint(createCampaignState(), id).destination;
      expect({ scene: route.scene, data: route.data }).toEqual(expected);
      expect(route.checkpoint).toBe(id);
      expect(route.direct).toBe(true);
    }
  });
});

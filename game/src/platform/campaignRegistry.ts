import { createCampaignState, type CampaignState } from "../modules/campaign/state";

/** Structural interface keeps the domain independent of Phaser. */
export interface CampaignRegistry { get(key: string): unknown; set(key: string, value: unknown): unknown }
export function state(registry: CampaignRegistry): CampaignState {
  let world = registry.get('world') as CampaignState | undefined;
  if (!world) { world = createCampaignState(); registry.set('world', world); }
  return world;
}

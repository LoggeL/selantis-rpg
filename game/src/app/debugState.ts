import type { WorldState } from "../modules/campaign/state";
import { isItemId } from "../modules/inventory/catalog";
import { isCampaignFlag } from "../modules/campaign/flags";
import { applyCampaignCommand, setCampaignFlag } from "../modules/campaign/commands";
export { FLAG_GROUPS, FLAGS } from "../modules/campaign/flags";
export { ITEM_DEBUG_NAMES as ITEMS } from "../modules/inventory/catalog";
export { CAMPAIGN_CHECKPOINTS as WARPS, prepareCampaignCheckpoint as prepareWarp } from "../modules/campaign/checkpoints";

/** Debug editing deliberately permits contradictory known flags. */
export function editFlag(st: WorldState, key: string, value: boolean): boolean {
  return isCampaignFlag(key) && typeof value === 'boolean' && setCampaignFlag(st, key, value);
}
export function editItem(st: WorldState, key: string, value: number): boolean {
  return isItemId(key) && Number.isInteger(value) && value >= 0 && value <= 999
    && applyCampaignCommand(st, { type: 'set-item', item: key, count: value });
}
type InputScene = { input: { enabled: boolean; keyboard?: { enabled: boolean; resetKeys(): unknown } | null } };
export class DebugPause {
  private held = new Map<InputScene, { input: boolean; keyboard?: boolean }>();
  hold(scene: InputScene) {
    if (this.held.has(scene)) return;
    this.held.set(scene, { input: scene.input.enabled, keyboard: scene.input.keyboard?.enabled });
    scene.input.keyboard?.resetKeys();
    scene.input.enabled = false;
    if (scene.input.keyboard) scene.input.keyboard.enabled = false;
  }
  release(scene: InputScene) {
    const saved = this.held.get(scene);
    if (!saved) return;
    this.held.delete(scene);
    scene.input.keyboard?.resetKeys();
    scene.input.enabled = saved.input;
    if (scene.input.keyboard && saved.keyboard !== undefined) scene.input.keyboard.enabled = saved.keyboard;
  }
  forget(scene: InputScene) { this.held.delete(scene); }
}

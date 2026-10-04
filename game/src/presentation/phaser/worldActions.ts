import { sfx } from "../../app/audio";
import type { Prop } from "../../modules/exploration/mapTypes";
import { ITEM_NAMES, type ItemId } from "../../modules/inventory/catalog";
import { homecomingObjective } from "../../modules/campaign/homecoming";
import type { WorldState } from "../../modules/campaign/state";
import { canReturnCampaignChick, completeCampaignChickReturn, shakeCampaignTree, type RandomInteger } from "../../modules/campaign/worldActions";
export { ITEM_NAMES } from "../../modules/inventory/catalog";
export { state } from "../../platform/campaignRegistry";
export type { WorldState } from "../../modules/campaign/state";

/** Was die Szene den Quests zur Verfügung stellt. */
export interface WorldApi {
  mapId: string;
  st: WorldState;
  thought(text: string, ms?: number): void;
  give(item: ItemId, n?: number): void;
  take(item: ItemId, n?: number): void;
  dropPickup(item: ItemId, from: { x: number; y: number }, to: { x: number; y: number }, id: string): void;
  shakeAt(x: number, y: number): void;
  showNest(withChick: boolean): void;
  beginChickReturn(prop: Prop, complete: () => void): void;
  refreshObjective(): void;
  refreshInventory?(): void;
  randomInteger?: RandomInteger;
}

/** Aktuelles Ziel oben rechts. */
export function objectiveText(st: WorldState, map = 'wiese'): string {
  return homecomingObjective(st, map);
}

/** Handlungen an Props. Gibt true zurück, wenn die Handlung etwas getan hat. */
export function runAction(prop: Prop, api: WorldApi): boolean {
  const { st } = api;
  const key = `${api.mapId}:${prop.id}`;
  switch (prop.action) {
    case 'shakeTree': {
      const drops = shakeCampaignTree(st, key, prop.id, prop.at, api.randomInteger ?? ((min, max) => min + Math.floor(Math.random() * (max - min + 1))));
      if (!drops) return false;
      sfx.rustle();
      api.shakeAt(prop.at[0], prop.at[1] - 50);
      for (const drop of drops) api.dropPickup(drop.item, drop.from, drop.to, drop.id);
      api.thought('Einmal kräftig gerüttelt, schon fällt das Obst.');
      return true;
    }
    case 'returnChick': {
      if (st.flags.chickReturned) { api.thought('Da piept es wieder im Nest. Gut so.'); return true; }
      if (!canReturnCampaignChick(st)) return false;
      api.beginChickReturn(prop, () => {
        // A paused climb still carries the bird; only reaching the nest earns the reward.
        if (!completeCampaignChickReturn(st)) return;
        api.refreshInventory?.();
        api.showNest(true);
        sfx.bird(); sfx.bird();
        api.thought('Vorsichtig zurück ins Nest. Da, die Mutter kommt schon.', 3000);
        api.dropPickup('feder', { x: prop.at[0] + 10, y: prop.at[1] - 70 }, { x: prop.at[0] + 18, y: prop.at[1] + 10 }, 'dank-feder');
        api.refreshObjective();
      });
      return true;
    }
  }
  return false;
}

/** Text beim Aufsammeln. */
export function pickupText(item: ItemId): string {
  switch (item) {
    case 'apfel': return 'Ein Apfel für unterwegs.';
    case 'kornblume': return 'Eine Kornblume. Die wächst hier überall.';
    case 'kupfer': return 'Ein Kupferstück! Hat Vater das auf dem Weg zum Markt verloren?';
    case 'feder': return 'Eine Feder. Fast, als wollte sie sich bedanken.';
    case 'kueken': return 'Ganz ruhig, Kleines. Dein Nest ist oben in der Eiche am Waldrand. Ich bring dich hin.';
    default: return ITEM_NAMES[item];
  }
}

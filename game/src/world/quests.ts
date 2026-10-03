import Phaser from 'phaser';
import { sfx } from '../audio';
import type { ItemId, Prop } from './maps';

/** Spielzustand der offenen Welt – liegt in der Registry, überlebt Kartenwechsel. */
export interface WorldState {
  inv: Partial<Record<ItemId, number>>;
  picked: Record<string, true>;
  flags: Record<string, boolean>;
}

export function state(reg: Phaser.Data.DataManager): WorldState {
  let s = reg.get('world') as WorldState | undefined;
  if (!s) { s = { inv: {}, picked: {}, flags: {} }; reg.set('world', s); }
  return s;
}

export const APPLES_NEEDED = 3;

export const ITEM_NAMES: Record<ItemId, string> = {
  apfel: 'Fallobst', feder: 'Feder', kupfer: 'Kupferstück', kornblume: 'Kornblume', kueken: 'Vogeljunges',
};

/** Was die Szene den Quests zur Verfügung stellt. */
export interface WorldApi {
  mapId: string;
  st: WorldState;
  thought(text: string, ms?: number): void;
  give(item: ItemId, n?: number): void;
  take(item: ItemId, n?: number): void;
  dropPickup(item: ItemId, from: { x: number; y: number }, to: { x: number; y: number }, id: string): void;
  shakeAt(x: number, y: number): void;
  feedPigs(): void;
  showNest(withChick: boolean): void;
  refreshObjective(): void;
}

/** Aktuelles Ziel oben rechts. */
export function objectiveText(st: WorldState): string {
  const apples = st.inv.apfel ?? 0;
  if (st.flags.pigsFed) return st.inv.kueken ? 'Das Vogeljunge zurück ins Nest setzen.' : 'Versprochen ist versprochen. Ab nach Hause.';
  if (st.inv.kueken) return 'Das Vogeljunge zurück ins Nest setzen.';
  if (apples >= APPLES_NEEDED) return 'Genug Fallobst – die Schweine am Hof füttern.';
  return `Versprochen: die Schweine füttern. Fallobst (${apples}/${APPLES_NEEDED})`;
}

/** Handlungen an Props. Gibt true zurück, wenn die Handlung etwas getan hat. */
export function runAction(prop: Prop, api: WorldApi): boolean {
  const { st } = api;
  const key = `${api.mapId}:${prop.id}`;
  switch (prop.action) {
    case 'shakeTree': {
      if (st.flags[`${key}:shaken`]) return false;
      st.flags[`${key}:shaken`] = true;
      sfx.rustle();
      api.shakeAt(prop.at[0], prop.at[1] - 50);
      const n = 2;
      for (let i = 0; i < n; i++) {
        const to = { x: prop.at[0] + (i ? 16 : -14) + Phaser.Math.Between(-4, 4), y: prop.at[1] + Phaser.Math.Between(6, 14) };
        api.dropPickup('apfel', { x: to.x, y: prop.at[1] - 60 }, to, `${prop.id}-apfel-${i}`);
      }
      api.thought('Ein kräftiger Schubs – und es regnet Fallobst!');
      return true;
    }
    case 'feedPigs': {
      if (st.flags.pigsFed) { api.thought('Satt und zufrieden. Versprochen ist versprochen.'); return true; }
      const apples = st.inv.apfel ?? 0;
      if (apples < APPLES_NEEDED) {
        api.thought(apples ? `Noch nicht genug. ${APPLES_NEEDED - apples} Äpfel mehr – auf den Feldern liegt Fallobst.` : 'Ich hab’s Kyra versprochen. Aber womit? Auf den Feldern liegt bestimmt Fallobst.', 3000);
        return true;
      }
      api.take('apfel', APPLES_NEEDED);
      st.flags.pigsFed = true;
      api.feedPigs();
      api.thought('So, ihr Vielfraße. Versprochen ist versprochen.', 3000);
      api.refreshObjective();
      return true;
    }
    case 'returnChick': {
      if (st.flags.chickReturned) { api.thought('Da piept es wieder im Nest. Gut so.'); return true; }
      if (!st.inv.kueken) return false;
      api.take('kueken', 1);
      st.flags.chickReturned = true;
      api.showNest(true);
      sfx.bird(); sfx.bird();
      api.thought('Vorsichtig zurück ins Nest. Da, die Mutter kommt schon.', 3000);
      api.dropPickup('feder', { x: prop.at[0] + 10, y: prop.at[1] - 70 }, { x: prop.at[0] + 18, y: prop.at[1] + 10 }, 'dank-feder');
      api.refreshObjective();
      return true;
    }
  }
  return false;
}

/** Text beim Aufsammeln. */
export function pickupText(item: ItemId, st: WorldState): string {
  const n = st.inv[item] ?? 0;
  switch (item) {
    case 'apfel': return st.flags.pigsFed ? 'Ein Apfel für unterwegs.' : n >= APPLES_NEEDED ? 'Genug für die Schweine.' : `Fallobst. Noch ${APPLES_NEEDED - n}.`;
    case 'kornblume': return n >= 3 ? 'Ein kleiner Strauß Kornblumen. Für Mutter.' : 'Eine Kornblume. Mutter mag die.';
    case 'kupfer': return 'Ein Kupferstück! Hat Vater das auf dem Weg zum Markt verloren?';
    case 'feder': return 'Eine Feder. Fast, als hätte sie Danke gesagt.';
    case 'kueken': return 'Ganz vorsichtig … Du bist aus dem Nest gefallen, was?';
  }
}

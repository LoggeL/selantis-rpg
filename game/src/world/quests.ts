import Phaser from 'phaser';
import { sfx } from '../audio';
import type { ItemId, Prop } from './maps';
import { homecomingObjective } from '../story/homecoming';

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

export const ITEM_NAMES: Record<ItemId, string> = {
  apfel: 'Fallobst', feder: 'Feder', kupfer: 'Kupferstück', kornblume: 'Kornblume', kueken: 'Vogeljunges',
  proviant: 'Reiseproviant', wasserschlauch: 'Wasserschlauch', dolch: 'Familientolch', silber: 'Silbermünze',
  steine: 'Steine', zunderholz: 'Laub und Zweige',
  reisezeug: 'Mantel, Decke und Schuhe', heilzeug: 'Tinktur und Leinen', 'buch-kraeuter': 'Cronibus Kräuterlexikon', 'buch-alana': 'Alanas Geschichte',
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
  showNest(withChick: boolean): void;
  beginChickReturn(prop: Prop, complete: () => void): void;
  refreshObjective(): void;
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
      if (st.flags[`${key}:shaken`]) return false;
      st.flags[`${key}:shaken`] = true;
      sfx.rustle();
      api.shakeAt(prop.at[0], prop.at[1] - 50);
      const n = 2;
      for (let i = 0; i < n; i++) {
        const to = { x: prop.at[0] + (i ? 16 : -14) + Phaser.Math.Between(-4, 4), y: prop.at[1] + Phaser.Math.Between(6, 14) };
        api.dropPickup('apfel', { x: to.x, y: prop.at[1] - 60 }, to, `${prop.id}-apfel-${i}`);
      }
      api.thought('Einmal kräftig gerüttelt, schon fällt das Obst.');
      return true;
    }
    case 'returnChick': {
      if (st.flags.chickReturned) { api.thought('Da piept es wieder im Nest. Gut so.'); return true; }
      if (!st.inv.kueken) return false;
      api.beginChickReturn(prop, () => {
        // A paused climb still carries the bird; only reaching the nest earns the reward.
        if (st.flags.chickReturned || !st.inv.kueken) return;
        st.flags.chickReturned = true;
        api.take('kueken', 1);
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

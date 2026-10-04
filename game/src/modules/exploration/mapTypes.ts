// Open-World-Karten rund um Lias Hof (Roman S. 6–13). Jede Karte ist ein 640x360-Bildschirm,
// definiert in einer eigenen Datei unter ./maps/.
// Koordinaten in Weltpixeln des Kartenbilds. Begehbar ist, was in `walk` liegt und nicht in `block`.
import type { ItemId } from '../inventory/catalog';
export type { ItemId } from '../inventory/catalog';

export type Pt = [number, number];
export type Dir = 's' | 'w' | 'e' | 'n';

export interface Exit {
  /** Auslösebereich [x, y, w, h], am Bildrand */
  rect: [number, number, number, number];
  /** Zielkarte; man kommt dort an deren `entries[<diese Karte>]` an */
  to: string;
  /** Optionales Szenenziel für den Übergang aus den verbundenen Weltkarten. */
  scene?: string;
  label?: string;
}

export interface Entry {
  /** Ankunftspunkt (Fußpunkt), knapp innerhalb der begehbaren Fläche, NICHT im Ausgangsrechteck */
  at: Pt;
  facing: Dir;
}

export interface Prop {
  id: string;
  at: Pt;
  radius: number;
  /** Gedankenzeilen, nacheinander bei wiederholtem Untersuchen */
  lines: string[];
  /** Optionale Handlung (siehe world/quests.ts), z. B. 'shakeTree', 'returnChick' */
  action?: string;
  /** Einmalige optionale Ortsentdeckung, als Spieladaption. */
  discovery?: string;
}

export interface Pickup {
  /** eindeutig pro Karte; bereits Aufgesammeltes bleibt verschwunden */
  id: string;
  item: ItemId;
  at: Pt;
}

export type CritterKind = 'butterfly' | 'bird' | 'hare' | 'chicken' | 'pig';

export interface CritterDef {
  kind: CritterKind;
  at: Pt;
  /** Bereich [x, y, w, h], in dem das Tier sich bewegt (Standard: um `at` herum) */
  area?: [number, number, number, number];
  /** Für den Hasen: Bau, in dem er nach mehrmaligem Fliehen verschwindet */
  burrow?: Pt;
}

export interface Jump {
  /** Zwei Absprungpunkte auf beiden Seiten eines Hindernisses; E springt zum jeweils anderen */
  a: Pt;
  b: Pt;
  radius: number;
  hint: string;
}

export interface Trigger {
  id: string;
  rect: [number, number, number, number];
}

export interface MapDef {
  id: string;
  name: string;
  bg: string;
  /** Startpunkt, wenn man die Karte direkt betritt (Debug, Szenenwechsel) */
  start: Pt;
  walk: Pt[][];
  block: Pt[][];
  exits: Exit[];
  /** Ankunftspunkte, Schlüssel = Karte, von der man kommt */
  entries: Record<string, Entry>;
  props: Prop[];
  triggers?: Trigger[];
  jumps?: Jump[];
  pickups?: Pickup[];
  critters?: CritterDef[];
}

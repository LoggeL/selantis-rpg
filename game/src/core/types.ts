import type { CharacterProgress } from '../tactics/rules/progression';
export type FlagValue = boolean | number | string;
export type Dir = 'down' | 'up' | 'left' | 'right';

export interface Objective {
  id: string;
  text: string;
  done: boolean;
  /** Scene in which the objective was first noted (journal). Missing in older saves and for warp-prepared objectives. */
  scene?: string;
  /** When it was first noted / completed (epoch ms, journal „vor … Minuten“). Missing in older saves. */
  setAt?: number;
  doneAt?: number;
}

export interface SaveData {
  version: 1;
  chapter: string;
  scene: string;
  params?: Record<string, unknown>;
  flags: Record<string, FlagValue>;
  inventory: Record<string, number>;
  objectives: Objective[];
  memories: string[];
  lore: string[];
  clues: string[];
  abilities: string[];
  party: string[];
  characters: Record<string, CharacterProgress>;
  /** Accumulated play time in seconds (counted while a game runs and the tab is visible; folded in on every save). */
  playtimeSec: number;
  savedAt: string;
}

/** Speaker metadata for dialogue (name, portrait, voice blip). */
export interface SpeakerDef {
  id: string;
  name: string;
  /** Portrait preset id for G.art.portrait() (defaults to the speaker id). */
  portrait?: string;
  /** Voice for typewriter blips. pitch in Hz-ish base (80..600). */
  voice?: { pitch: number; wave?: OscillatorType };
  /** Accent color for the name band (CSS color). */
  color?: string;
}

export interface ItemDef { id: string; name: string; icon: string; description: string; /** Lia's personal comment. */ comment?: string; }
export interface LoreDef { id: string; title: string; text: string; }
export interface MemoryDef { id: string; title: string; text: string; }
export interface ClueDef { id: string; title: string; text: string; }
export interface AbilityDef { id: string; name: string; key?: string; description: string; }

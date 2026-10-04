import type { AbilityDef, ClueDef, ItemDef, LoreDef, MemoryDef, SpeakerDef } from './types';

/** Content catalogs. Chapters register their own entries at import time. */
export const speakers = new Map<string, SpeakerDef>();
export const items = new Map<string, ItemDef>();
export const lore = new Map<string, LoreDef>();
export const memories = new Map<string, MemoryDef>();
export const clues = new Map<string, ClueDef>();
export const abilities = new Map<string, AbilityDef>();

function register<T extends { id: string }>(map: Map<string, T>, list: T[]): void {
  for (const entry of list) map.set(entry.id, entry);
}
export const registerSpeakers = (list: SpeakerDef[]) => register(speakers, list);
export const registerItems = (list: ItemDef[]) => register(items, list);
export const registerLore = (list: LoreDef[]) => register(lore, list);
export const registerMemories = (list: MemoryDef[]) => register(memories, list);
export const registerClues = (list: ClueDef[]) => register(clues, list);
export const registerAbilities = (list: AbilityDef[]) => register(abilities, list);

export function speaker(id: string): SpeakerDef {
  return speakers.get(id) ?? { id, name: id };
}

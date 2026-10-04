import { createStatsRules, type StatsCatalog } from "./stats";
import { createPartyStateRules } from "./model";
import { createCharacterSheetRules, type CharacterSheetCatalog } from "./characterSheet";

/** Bind authored character data once; all stats, health and sheet selectors share that catalog. */
export function createCharacterRules(catalog: StatsCatalog & CharacterSheetCatalog) {
  const stats = createStatsRules(catalog);
  return { ...stats, ...createPartyStateRules(stats), ...createCharacterSheetRules(catalog, stats) };
}

import { CHARACTER_IDENTITIES, PARTY_COMBAT_PROFILES, TACTICAL_STATS } from "../content/characters/profiles";
import { DUNKELHAIN } from "../content/encounters/dunkelhain";
import { createCharacterRules } from "../modules/party/characterRules";

/** Concrete prologue binding. Core modules never select a chapter's authored data. */
export const characterRules = createCharacterRules({
  partyProfiles: PARTY_COMBAT_PROFILES, combatProfiles: TACTICAL_STATS,
  identities: CHARACTER_IDENTITIES, abilities: DUNKELHAIN.abilities,
  fallbackMovement: TACTICAL_STATS.valentus.move,
});
export const { createPartyMember, resolveBattleUnitStats, resolvePartyUnitStats, validatePartyState,
  transitionPartyHealth, carriedItems, partyRoster, characterSnapshot } = characterRules;
export { PARTY_COMBAT_PROFILES, TACTICAL_STATS };

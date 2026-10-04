import { characterRules } from "./characterRules";
import { createPartyRegistryAdapter } from "../platform/partyRegistry";

export const { migratePartyState, partyState, changePartyHealth, healPartyMember } = createPartyRegistryAdapter(characterRules);

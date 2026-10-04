import { availableParty, isRecord, PARTY_IDS, type PartyCharacterId, type PartyFlags, type PartyMemberState, type PartyState } from "../modules/party/model";
import type { createCharacterRules } from "../modules/party/characterRules";
export type PartyRegistry = { get(key: string): unknown; set(key: string, value: unknown): unknown };

export function createPartyRegistryAdapter({ createPartyMember, transitionPartyHealth, validatePartyState }: Pick<ReturnType<typeof createCharacterRules>, 'createPartyMember' | 'transitionPartyHealth' | 'validatePartyState'>) {
  /** Registry migration alone knows the health-only prototype format. */
  function migratePartyState(value: unknown, flags: PartyFlags = {}): PartyState {
    if (!isRecord(value) || value.version !== 1 || !isRecord(value.members)) return validatePartyState(undefined, flags);
    const members = { ...value.members };
    for (const id of PARTY_IDS) {
      const legacy = members[id];
      if (!isRecord(legacy) || isRecord(legacy.combat)) continue;
      const baseline = createPartyMember(id);
      const injured = typeof legacy.hp !== 'number' || !Number.isFinite(legacy.hp) || typeof legacy.maxHp !== 'number' || !Number.isFinite(legacy.maxHp) || legacy.maxHp < 1 || legacy.hp < legacy.maxHp;
      members[id] = { ...baseline, hp: injured ? legacy.hp : baseline.maxHp };
    }
    return validatePartyState({ version: 1, members }, flags);
  }

  /** Keep existing registry references stable for scene adapters while domain transitions remain pure. */
  function storeParty(registry: PartyRegistry, raw: unknown, next: PartyState): PartyState {
    if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.members)) { registry.set('party', next); return next; }
    for (const key of Object.keys(raw.members)) if (!PARTY_IDS.includes(key as PartyCharacterId)) delete raw.members[key];
    for (const id of PARTY_IDS) {
      const member = next.members[id];
      if (!member) { delete raw.members[id]; continue; }
      const current = raw.members[id];
      if (isRecord(current)) Object.assign(current, member);
      else raw.members[id] = member;
    }
    return raw as PartyState;
  }

  function partyState(registry: PartyRegistry, flags: PartyFlags = {}): PartyState {
    const current = registry.get('party');
    return storeParty(registry, current, migratePartyState(current, flags));
  }
  function changePartyHealth(registry: PartyRegistry, id: PartyCharacterId, delta: number): PartyMemberState | undefined {
    const world = registry.get('world');
    const flags = isRecord(world) && isRecord(world.flags) ? world.flags as PartyFlags : {};
    if (!Number.isFinite(delta) || !availableParty(flags).includes(id)) return undefined;
    const current = partyState(registry, flags), next = transitionPartyHealth(current, id, delta, flags)!;
    return storeParty(registry, current, next).members[id];
  }
  function healPartyMember(registry: PartyRegistry, id: PartyCharacterId) { return changePartyHealth(registry, id, Number.MAX_SAFE_INTEGER); }

  return { migratePartyState, partyState, changePartyHealth, healPartyMember };
}

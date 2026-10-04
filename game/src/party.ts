import type { WorldState } from './world/quests';
import { createPartyMember, type PartyCharacterId, type PartyMemberState } from './combatStats';

export type { PartyCharacterId, PartyMemberState } from './combatStats';
export type PartyState = { version: 1; members: Partial<Record<PartyCharacterId, PartyMemberState>> };
type Registry = { get(key: string): unknown; set(key: string, value: unknown): unknown };

export function availableParty(flags: WorldState['flags'] = {}): PartyCharacterId[] {
  return flags.metFoltanAzar && flags.journeyRopesReleased ? ['lia', 'foltan', 'azar'] : ['lia'];
}

/** Exploration health lives in the game registry across rooms and chapter changes. */
export function partyState(registry: Registry, flags: WorldState['flags'] = {}): PartyState {
  let party = registry.get('party') as PartyState | undefined;
  if (!party || party.version !== 1 || !party.members) { party = { version: 1, members: {} }; registry.set('party', party); }
  for (const id of availableParty(flags)) {
    const member = party.members[id];
    if (!member) { party.members[id] = createPartyMember(id); continue; }
    // Enrich health-only state from the previous prototype without restoring
    // an injured member. Healthy legacy companions start at their new baseline.
    if (!member.combat) {
      const baseline = createPartyMember(id), injured = member.hp < member.maxHp;
      member.maxHp = baseline.maxHp;
      member.hp = injured ? Math.max(0, Math.min(member.hp, member.maxHp)) : member.maxHp;
      member.combat = baseline.combat;
    }
  }
  return party;
}

/** Positive deltas heal; negative deltas damage the persisted health read by the sheet. */
export function changePartyHealth(registry: Registry, id: PartyCharacterId, delta: number): PartyMemberState | undefined {
  if (!Number.isFinite(delta)) return undefined;
  const world = registry.get('world') as WorldState | undefined;
  if (!availableParty(world?.flags).includes(id)) return undefined;
  const member = partyState(registry, world?.flags).members[id]!;
  member.hp = Math.max(0, Math.min(member.maxHp, member.hp + Math.trunc(delta)));
  return member;
}
export function healPartyMember(registry: Registry, id: PartyCharacterId) {
  return changePartyHealth(registry, id, Number.MAX_SAFE_INTEGER);
}

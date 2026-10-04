import { COMBAT_FIELDS, type StatsRules, type PartyCharacterId, type PartyMemberState } from "./stats";
export type { PartyCharacterId, PartyMemberState } from './stats';
export type PartyState = { version: 1; members: Partial<Record<PartyCharacterId, PartyMemberState>> };
export type PartyFlags = Readonly<Record<string, boolean | undefined>>;
export const PARTY_IDS: readonly PartyCharacterId[] = ['lia', 'foltan', 'azar'];
export function availableParty(flags: PartyFlags = {}): PartyCharacterId[] {
  return flags.metFoltanAzar ? [...PARTY_IDS] : ['lia'];
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createPartyStateRules({ createPartyMember }: Pick<StatsRules, 'createPartyMember'>) {
  /** Canonical state is copied and validated. Invalid health never heals a present member. */
  function validatePartyState(value: unknown, flags: PartyFlags = {}): PartyState {
    const raw = isRecord(value) && value.version === 1 && isRecord(value.members) ? value.members : {};
    const members: PartyState['members'] = {};
    for (const id of PARTY_IDS) {
      const entry = raw[id];
      if (!isRecord(entry)) { if (availableParty(flags).includes(id)) members[id] = createPartyMember(id); continue; }
      const baseline = createPartyMember(id);
      const maxHp = typeof entry.maxHp === 'number' && Number.isFinite(entry.maxHp) && entry.maxHp >= 1 ? Math.trunc(entry.maxHp) : baseline.maxHp;
      const hp = typeof entry.hp === 'number' && Number.isFinite(entry.hp) ? Math.max(0, Math.min(maxHp, Math.trunc(entry.hp))) : 0;
      const combat = baseline.combat;
      if (isRecord(entry.combat)) for (const field of COMBAT_FIELDS) {
        const stat = entry.combat[field];
        if (typeof stat === 'number' && Number.isFinite(stat) && stat >= 0) combat[field] = stat;
      }
      members[id] = { hp, maxHp, combat };
    }
    return { version: 1, members };
  }

  /** Pure transition: positive deltas heal, negative deltas damage, unavailable members cannot change. */
  function transitionPartyHealth(party: PartyState, id: PartyCharacterId, delta: number, flags: PartyFlags = {}): PartyState | undefined {
    if (!Number.isFinite(delta) || !availableParty(flags).includes(id)) return undefined;
    const state = validatePartyState(party, flags), member = state.members[id]!;
    member.hp = Math.max(0, Math.min(member.maxHp, member.hp + Math.trunc(delta)));
    return state;
  }

  return { validatePartyState, transitionPartyHealth };
}

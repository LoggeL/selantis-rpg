export type PartyCharacterId = 'lia' | 'foltan' | 'azar' | 'flick' | 'kyra';
export type CombatStats = {
  attack: number; defense: number; speed: number; move: number; attackRange: number;
  magicAttack?: number;
};
export type PartyMemberState = { hp: number; maxHp: number; combat: CombatStats };
export type CombatKind = string;
export type CombatDescriptor = { kind: CombatKind } & Partial<CombatStats>;
export const COMBAT_FIELDS = ['attack', 'defense', 'speed', 'move', 'attackRange', 'magicAttack'] as const;

export type StatsCatalog = {
  partyProfiles: Record<PartyCharacterId, { maxHp: number; combat: CombatStats }>;
  combatProfiles: Record<string, CombatStats>;
};
export function createStatsRules(catalog: StatsCatalog) {
  const PARTY_COMBAT_PROFILES = catalog.partyProfiles, TACTICAL_STATS = catalog.combatProfiles;
  function createPartyMember(id: PartyCharacterId): PartyMemberState {
    const profile = PARTY_COMBAT_PROFILES[id];
    return { hp: profile.maxHp, maxHp: profile.maxHp, combat: { ...profile.combat } };
  }

  /** Structural descriptors let battles share defaults without importing their grid or scene. */
  function resolveBattleUnitStats(unit: CombatDescriptor): CombatStats {
    const base: CombatStats | undefined = Object.hasOwn(PARTY_COMBAT_PROFILES, unit.kind)
      ? PARTY_COMBAT_PROFILES[unit.kind as PartyCharacterId].combat
      : Object.hasOwn(TACTICAL_STATS, unit.kind) ? TACTICAL_STATS[unit.kind] : undefined;
    if (!base) throw new Error(`Unknown combat kind: ${unit.kind}`);
    const stats = { ...base };
    for (const field of COMBAT_FIELDS) {
      const value = unit[field];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) stats[field] = value;
    }
    return stats;
  }

  function resolvePartyUnitStats(member: PartyMemberState): CombatStats { return { ...member.combat }; }

  return { createPartyMember, resolveBattleUnitStats, resolvePartyUnitStats };
}
export type StatsRules = ReturnType<typeof createStatsRules>;

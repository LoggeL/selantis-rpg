import { BEAM_DAMAGE, BEAM_LENGTH, GRID, MOVE_RANGE, type Unit } from './battle/grid';

export type PartyCharacterId = 'lia' | 'foltan' | 'azar';
export type CombatStats = {
  attack: number; defense: number; speed: number; move: number; attackRange: number;
  magicAttack?: number;
};
export type PartyMemberState = { hp: number; maxHp: number; combat: CombatStats };
export type CombatKind = Unit['kind'] | PartyCharacterId;

/** Prototype balance: Lia scouts, Foltan holds a balanced line, Azar hits hard. */
export const PARTY_COMBAT_PROFILES: Record<PartyCharacterId, { maxHp: number; combat: CombatStats }> = {
  lia: { maxHp: 100, combat: { attack: 14, defense: 6, speed: 9, move: 5, attackRange: 1 } },
  foltan: { maxHp: 140, combat: { attack: 28, defense: 14, speed: 7, move: 4, attackRange: 1 } },
  azar: { maxHp: 180, combat: { attack: 36, defense: 18, speed: 5, move: 3, attackRange: 1 } },
};

/** Preserve the already qualified opening combat. No unused MP pool is invented. */
export const TACTICAL_STATS = {
  valentus: { speed: 8, attack: BEAM_DAMAGE, defense: 20, move: MOVE_RANGE, attackRange: BEAM_LENGTH, magicAttack: BEAM_DAMAGE },
  warrior: { speed: 6, attack: 24, defense: 4, move: 2, attackRange: 1 },
  axe: { speed: 5, attack: 30, defense: 3, move: 2, attackRange: 1 },
  crossbow: { speed: 7, attack: 26, defense: 2, move: 2, attackRange: Math.max(GRID.cols, GRID.rows) - 1 },
  boy: { speed: 4, attack: 0, defense: 0, move: 3, attackRange: 0 },
  falke: { speed: 7, attack: 40, defense: 6, move: 4, attackRange: 1 },
} satisfies Record<Unit['kind'], CombatStats>;

export function createPartyMember(id: PartyCharacterId): PartyMemberState {
  const profile = PARTY_COMBAT_PROFILES[id];
  return { hp: profile.maxHp, maxHp: profile.maxHp, combat: { ...profile.combat } };
}

/** One default source for scene units and party combat state, with live overrides. */
export function resolveBattleUnitStats(unit: { kind: CombatKind } & Partial<CombatStats>): CombatStats {
  const base: CombatStats = unit.kind in PARTY_COMBAT_PROFILES
    ? PARTY_COMBAT_PROFILES[unit.kind as PartyCharacterId].combat
    : TACTICAL_STATS[unit.kind as Unit['kind']];
  const stats = { ...base };
  for (const field of ['attack', 'defense', 'speed', 'move', 'attackRange', 'magicAttack'] as const) {
    const value = unit[field];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) stats[field] = value;
  }
  return stats;
}

/** Both a character sheet and a future party fight read the persisted values. */
export function resolvePartyUnitStats(member: PartyMemberState): CombatStats { return { ...member.combat }; }

import type { CombatStats, PartyCharacterId } from "../../modules/party/stats";
import { DUNKELHAIN } from "../encounters/dunkelhain";

export const CHARACTER_IDENTITIES: Record<string, { name: string; portrait: string }> = {
  valentus: { name: 'Valentus', portrait: 'valentus' }, boy: { name: 'Der Junge', portrait: 'boy' },
  falke: { name: 'Falke', portrait: 'falke' }, lia: { name: 'Lia', portrait: 'lia' },
  foltan: { name: 'Foltan', portrait: 'foltan' }, azar: { name: 'Azar', portrait: 'azar' },
};

/** Prototype balance: Lia scouts, Foltan holds a balanced line, Azar hits hard. */
export const PARTY_COMBAT_PROFILES: Record<PartyCharacterId, { maxHp: number; combat: CombatStats }> = {
  lia: { maxHp: 100, combat: { attack: 14, defense: 6, speed: 9, move: 5, attackRange: 1 } },
  foltan: { maxHp: 140, combat: { attack: 28, defense: 14, speed: 7, move: 4, attackRange: 1 } },
  azar: { maxHp: 180, combat: { attack: 36, defense: 18, speed: 5, move: 3, attackRange: 1 } },
};

const beam = DUNKELHAIN.abilities.find(ability => ability.id === 'beam')!;
/** Opening combat balance reads the same authored spell values as the encounter. */
export const TACTICAL_STATS = {
  valentus: { speed: 8, attack: beam.damage, defense: 20, move: 4, attackRange: beam.range, magicAttack: beam.damage },
  warrior: { speed: 6, attack: 24, defense: 4, move: 2, attackRange: 1 },
  axe: { speed: 5, attack: 30, defense: 3, move: 2, attackRange: 1 },
  crossbow: { speed: 7, attack: 26, defense: 2, move: 2, attackRange: Math.max(DUNKELHAIN.board.cols, DUNKELHAIN.board.rows) - 1 },
  boy: { speed: 4, attack: 0, defense: 0, move: 3, attackRange: 0 },
  falke: { speed: 7, attack: 40, defense: 6, move: 4, attackRange: 1 },
} satisfies Record<string, CombatStats>;

import { statsAtLevel } from '../../tactics/rules/progression';
import type { CombatStats, UnitSpec } from '../../tactics/rules/types';

/** Campaign starting levels and level-one attributes, shared by story battles and demos. */
export const BATTLE_CHARACTERS = {
  valentus: { level: 20, stats: { maxHp: 30, maxMp: 24, atk: 3, def: 2, speed: 6 } },
  falke: { level: 7, stats: { maxHp: 26, maxMp: 4, atk: 3, def: 2, speed: 7 } },
  foltan: { level: 6, stats: { maxHp: 22, maxMp: 4, atk: 3, def: 1, speed: 5 } },
  azar: { level: 3, stats: { maxHp: 20, maxMp: 8, atk: 1, def: 1, speed: 4 } },
  flick: { level: 8, stats: { maxHp: 18, maxMp: 6, atk: 3, def: 1, speed: 8 } },
  lia: { level: 2, stats: { maxHp: 14, maxMp: 18, atk: 1, def: 0, speed: 6 } },
  kyra: { level: 1, stats: { maxHp: 12, maxMp: 10, atk: 2, def: 0, speed: 6 } },
  'baris-young': { level: 14, stats: { maxHp: 24, maxMp: 2, atk: 4, def: 2, speed: 3 } },
  baris: { level: 16, stats: { maxHp: 24, maxMp: 2, atk: 4, def: 2, speed: 5 } },
  orwen: { level: 10, stats: { maxHp: 20, maxMp: 6, atk: 3, def: 2, speed: 4 } },
  algard: { level: 5, stats: { maxHp: 14, maxMp: 4, atk: 2, def: 1, speed: 4 } },
  maedchen: { level: 4, stats: { maxHp: 12, maxMp: 4, atk: 2, def: 1, speed: 5 } },
  paladin: { level: 8, stats: { maxHp: 22, maxMp: 8, atk: 2, def: 2, speed: 2 } },
  'shadow-sword': { level: 4, stats: { maxHp: 13, maxMp: 4, atk: 2, def: 1, speed: 4 } },
  'shadow-spear': { level: 4, stats: { maxHp: 14, maxMp: 4, atk: 2, def: 1, speed: 4 } },
  'shadow-crossbow': { level: 4, stats: { maxHp: 10, maxMp: 4, atk: 3, def: 0, speed: 4 } },
  'shadow-club': { level: 4, stats: { maxHp: 15, maxMp: 2, atk: 3, def: 1, speed: 3 } },
} satisfies Record<string, { level: number; stats: CombatStats }>;

export type BattleCharacter = keyof typeof BATTLE_CHARACTERS;

export function characterStats(id: BattleCharacter, hpFraction?: number): Pick<UnitSpec, 'level' | 'baseStats' | 'hp'> {
  const character = BATTLE_CHARACTERS[id];
  const baseStats = { ...character.stats };
  const hp = hpFraction === undefined ? undefined
    : Math.max(1, Math.round(statsAtLevel(baseStats, character.level).maxHp * Math.max(0, Math.min(1, hpFraction))));
  return {
    level: character.level, baseStats,
    ...(hp === undefined ? {} : { hp }),
  };
}

export function shadowStats(preset?: string): ReturnType<typeof characterStats> {
  const id = preset === 'shadow-crossbow' || preset === 'shadow-spear' || preset === 'shadow-club' ? preset : 'shadow-sword';
  return characterStats(id);
}

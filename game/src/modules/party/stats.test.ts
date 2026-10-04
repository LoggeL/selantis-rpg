import { describe, expect, it } from 'vitest';
import { createStatsRules, type CombatStats } from './stats';

const combat: CombatStats = { attack: 11, defense: 3, speed: 2, move: 2, attackRange: 3 };
const rulesFor = (combatProfiles: Record<string, CombatStats>) => createStatsRules({
  partyProfiles: {
    lia: { maxHp: 55, combat }, foltan: { maxHp: 66, combat }, azar: { maxHp: 77, combat }, flick: { maxHp: 88, combat }, kyra: { maxHp: 99, combat },
  },
  combatProfiles,
});

describe('authored combat stat lookup', () => {
  it.each(['toString', 'constructor', '__proto__', 'hasOwnProperty', 'missing'])('rejects unauthored kind %s even with complete live overrides', kind => {
    const rules = rulesFor({ guardian: combat });
    expect(() => rules.resolveBattleUnitStats({ kind, ...combat })).toThrow(`Unknown combat kind: ${kind}`);
  });

  it('rejects a combat profile inherited from a catalog prototype', () => {
    const profiles = Object.create({ guardian: combat }) as Record<string, CombatStats>;
    expect(() => rulesFor(profiles).resolveBattleUnitStats({ kind: 'guardian' })).toThrow('Unknown combat kind: guardian');
  });

  it('preserves valid live overrides and catalog defaults without changing authored stats', () => {
    const profiles = { guardian: { ...combat, magicAttack: 12 } };
    const rules = rulesFor(profiles);
    expect(rules.resolveBattleUnitStats({ kind: 'guardian', attack: 19, move: 0, defense: -1, speed: NaN })).toEqual({
      ...combat, attack: 19, move: 0, magicAttack: 12,
    });
    expect(profiles.guardian).toEqual({ ...combat, magicAttack: 12 });
    expect(rules.resolveBattleUnitStats({ kind: 'lia', defense: 9 })).toEqual({ ...combat, defense: 9 });
  });

  it('accepts an explicitly authored own key that also exists on Object.prototype', () => {
    const rules = rulesFor({ toString: combat });
    expect(rules.resolveBattleUnitStats({ kind: 'toString', defense: 9 })).toEqual({ ...combat, defense: 9 });
  });
});

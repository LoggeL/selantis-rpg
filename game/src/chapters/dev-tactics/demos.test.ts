import { describe, expect, it } from 'vitest';
import { Battle } from '../../tactics/rules/battle';
import { Grid } from '../../tactics/rules/grid';
import { evaluate } from '../../tactics/rules/objectives';
import { executePlan, planTurn } from '../../tactics/rules/ai';
import type { BattleDef } from '../../tactics/api';
import { dunkelhainBattle, rescueBattle, sandboxBattle } from './index';

function build(def: BattleDef, seed = 1) {
  const grid = Grid.parse(def.map.height, def.map.terrain, def.map.legend);
  const units = def.units.map(u => ({ ...u, ai: u.team === 'player' ? 'melee' as const : u.ai, statuses: u.statuses ? { ...u.statuses } : undefined }));
  const b = new Battle({ grid, units, abilities: def.abilities, seed });
  b.startPhase('player');
  return b;
}

describe('demo battles', () => {
  it('parse and place every unit legally (including waves)', () => {
    for (const def of [dunkelhainBattle, rescueBattle, sandboxBattle]) {
      const b = build(def);
      for (const w of def.waves ?? []) for (const u of w.units) expect(b.grid.standable(u.x, u.y)).toBe(true);
      expect(b.units.length).toBe(def.units.length);
    }
  });
  it('Dunkelhain resolves under AI-vs-AI play within the round limit', () => {
    for (const seed of [1, 2, 3]) {
      const def = dunkelhainBattle;
      const b = build(def, seed);
      let out = null;
      for (let i = 0; i < 40 && !out; i++) {
        for (const w of def.waves ?? []) if (w.round === b.round && b.phase === 'player' && !b.findUnit(w.units[0].id)) for (const u of w.units) b.spawn(u);
        for (const u of b.pending()) executePlan(b, planTurn(b, u.id));
        out = evaluate(b, def.objective.win, def.objective.lose) ?? (b.endPhase(), evaluate(b, def.objective.win, def.objective.lose));
      }
      expect(out).not.toBe(null);
    }
  });
});

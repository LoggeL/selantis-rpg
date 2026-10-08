import { afterEach, describe, expect, it, vi } from 'vitest';
import { G } from '../../core/G';
import { makeUnit } from '../../tactics/rules/battle';
import type { BattleCtx } from '../../tactics/api';
import { DESPAIR_BARKS, LIA_STAGES, VERZWEIFLUNG, despairBark, despairTrigger, liaAbilities, liaCombatHint, liaUnit, withLiaHooks } from './liaKit';

afterEach(() => G.state.reset());

describe('Lia battle kit', () => {
  it('always gives her Vaters Dolch as basic attack and the Verzweiflung trait', () => {
    G.state.reset();
    for (const stage of Object.keys(LIA_STAGES) as (keyof typeof LIA_STAGES)[]) {
      const u = makeUnit(liaUnit(stage, { x: 0, y: 0 }));
      expect(u.attack, stage).toBe('dolch');
      expect(u.weapon, stage).toBe('vatersdolch');
      expect(u.level, stage).toBe(LIA_STAGES[stage].level);
      expect(u.traits, stage).toEqual([VERZWEIFLUNG]);
    }
  });

  it('builds the specials from what she knows and carries', () => {
    G.state.reset();
    expect(liaAbilities()).toEqual(['steinwurf']);
    G.state.give('tincture');
    expect(liaAbilities()).toEqual(['steinwurf', 'versorgen']);
    G.state.learn('ausweichen'); G.state.learn('ablenken');
    expect(liaAbilities()).toEqual(['ausweichen', 'ablenken', 'steinwurf', 'versorgen']);
    G.state.learn('lichtstoss');
    expect(liaAbilities()).toEqual(['lichtstoss', 'ausweichen', 'ablenken', 'steinwurf', 'versorgen']);
    G.state.give('e2-schattentoeter');
    expect(liaAbilities()[0]).toBe('e2-stabimpuls');
    // The raid: the light is silent, even with Lichtstoß known and the staff in her pack.
    expect(liaAbilities({ light: false })).toEqual(['ausweichen', 'ablenken', 'steinwurf', 'versorgen']);
    expect(liaAbilities({ extra: ['k5-schneiden'], state: { lichtstoss: false, staff: false } }).at(-1)).toBe('k5-schneiden');
  });

  it('starts at a fraction of her level HP when asked', () => {
    const u = makeUnit(liaUnit('e2-ueberfall', { x: 0, y: 0 }, { hpFraction: 0.5 }));
    expect(u).toMatchObject({ level: 5, maxHp: 28, hp: 14 });
  });

  it('barks once per battle when her despair wakes, with a fixed line per battle', () => {
    expect(despairBark('k2-wegelagerer')).toBe(despairBark('k2-wegelagerer'));
    expect(DESPAIR_BARKS).toContain(despairBark('e2-ueberfall'));
    const lia = makeUnit(liaUnit('k2-wegelagerer', { x: 0, y: 0 }));
    const bark = vi.fn();
    const ctx = { unit: () => lia, bark, def: { id: 'k2-wegelagerer' } } as unknown as BattleCtx;
    const t = despairTrigger();
    expect(t.when(ctx)).toBe(false);
    lia.hp = 8;
    expect(t.when(ctx)).toBe(true);
    void t.run(ctx);
    expect(bark).toHaveBeenCalledWith('lia', despairBark('k2-wegelagerer'), 2200);
    expect(t.once ?? true).toBe(true);
    expect(withLiaHooks({}).triggers).toHaveLength(1);
    expect(withLiaHooks({}, { bark: false }).triggers).toBeUndefined();
  });

  it('shows the dagger and Verzweiflung tutorial only once in the campaign', async () => {
    G.state.reset();
    const hint = vi.fn(async () => {});
    const ctx = { hint } as unknown as BattleCtx;
    await liaCombatHint(ctx);
    await liaCombatHint(ctx);
    expect(hint).toHaveBeenCalledOnce();
    expect(String((hint.mock.calls[0] as unknown[])[0])).toMatch(/Vaters Dolch.*Verzweiflung/);
  });
});

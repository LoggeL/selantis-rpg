import { afterEach, describe, expect, it, vi } from 'vitest';
import { G } from '../../core/G';
import type { AudioApi } from '../../audio/api';
import type { UiApi } from '../../ui/api';
import { BattleController, type Presenter } from '../../tactics/controller';
import type { BattleEvent } from '../../tactics/rules/types';
import { STAFF } from '../common/bookContract';
import { LIA_STAGES, VERZWEIFLUNG, liaBudget } from '../common/liaKit';
import { STABSTRAHL } from './battle-shared';
import {
  BREAKS_TO_FINISH, DUEL_FLAGS, DUEL_WON, IGNATIUS_AT, KALTER_STOSS, LIA_START, SHIELD_DEF, TELEPORT_SPOTS, VAMIR_DEF, VAMIR_START, duel,
  duelAbilities, duelBattle, duelProgression, duelSetupFromState, finisherDue, stabstrahlHitVamir, teleportRound, teleportSpot,
  type DuelSetup,
} from './vamir-duell-battle';
import { POISON_FACTOR } from './shared';

const BASE: DuelSetup = { ownStaff: true, schattentoeter: false, lichtstoss: true, poisoned: true, won: false };
const originalAudio = G.audio;
afterEach(() => { G.audio = originalAudio; G.state.reset(); });

function controller(setup: DuelSetup = BASE) {
  G.audio = { sfx: vi.fn() } as unknown as AudioApi;
  const def = duelBattle(setup);
  const presenter = {
    tableau: vi.fn(async () => {}), magicBurst: vi.fn(async () => {}), play: vi.fn(async () => {}), refresh: vi.fn(), focus: vi.fn(async () => {}),
    pose: vi.fn(), bark: vi.fn(), shake: vi.fn(), banner: vi.fn(async () => {}), setObjective: vi.fn(), wait: vi.fn(async () => {}),
    showHint: vi.fn(async () => {}), clearHint: vi.fn(),
  } as unknown as Presenter;
  const ui = { say: vi.fn(async () => {}), plate: vi.fn(async () => {}), closePlate: vi.fn(async () => {}) } as unknown as UiApi;
  const ctrl = new BattleController(def, presenter, ui, () => {});
  return { def, ctrl, ctx: ctrl.ctx, presenter };
}
const hit = (target: string): BattleEvent[] => [{ type: 'strike', unit: 'lia', target, hit: true, damage: 6, hp: 1, relation: 'front', index: 0, heightDiff: 0 }];

describe('e3-vamir-duell (forest path)', () => {
  it('stands everyone and every teleport spot on standable tiles; Ignatius lies down and cannot be controlled', async () => {
    const { def, ctrl, ctx } = controller();
    const grid = ctrl.battle.grid;
    for (const p of [LIA_START, IGNATIUS_AT, VAMIR_START, ...TELEPORT_SPOTS]) expect(grid.standable(p.x, p.y), `${p.x},${p.y}`).toBe(true);
    expect(def.units.find(u => u.id === 'ignatius')!.team).toBe('ally');
    await def.hooks!.onStart!(ctx);
    expect(ctrl.battle.unit('ignatius').down).toBe('wounded');
    expect(ctrl.battle.unit('vamir').nonLethal).toBe(false);
    expect(def.objective.lose).toEqual([{ type: 'unitDown', units: ['lia'] }]);
  });

  it('offers Stabstrahl only with the own staff, Stabimpuls only with Schattentöter (liaKit order, staff appended)', () => {
    expect(duelAbilities(BASE)).toEqual(['lichtstoss', 'steinwurf', STABSTRAHL.id]);
    expect(duelAbilities({ ...BASE, ownStaff: false })).toEqual(['lichtstoss', 'steinwurf']);
    expect(duelAbilities({ ...BASE, ownStaff: false, schattentoeter: true, lichtstoss: false })).toEqual(['e2-stabimpuls', 'steinwurf']);
    G.state.learn('ausweichen'); G.state.give('tincture');
    expect(duelAbilities({ ...BASE, lichtstoss: false })).toEqual(['ausweichen', 'steinwurf', 'versorgen', STABSTRAHL.id]);
    G.state.give(STAFF.own);
    expect(duelSetupFromState().ownStaff).toBe(true);
    G.state.take(STAFF.own);
    G.state.set('e3-stab-zurueck'); // a flag alone is no staff
    expect(duelSetupFromState().ownStaff).toBe(false);
    expect(duelBattle({ ...BASE, ownStaff: false }).units.find(u => u.id === 'lia')!.abilities).not.toContain(STABSTRAHL.id);
  });

  it('weakens the poisoned Lia to 60 % HP and MP', async () => {
    const healthy = controller({ ...BASE, poisoned: false });
    await healthy.def.hooks!.onStart!(healthy.ctx);
    const sick = controller();
    await sick.def.hooks!.onStart!(sick.ctx);
    const full = healthy.ctrl.battle.unit('lia'), lia = sick.ctrl.battle.unit('lia');
    expect(lia.maxHp).toBe(Math.floor(full.maxHp * POISON_FACTOR));
    expect(lia.hp).toBe(lia.maxHp);
    expect(lia.mp).toBe(Math.floor(full.maxMp * POISON_FACTOR));
  });

  it('builds Lia with the liaKit and gives Vamir a violet basic attack that ignores facing', async () => {
    const { def, ctrl, ctx } = controller();
    const b = ctrl.battle, lia = b.unit('lia'), vamir = b.unit('vamir');
    expect(lia.attack).toBe('dolch');
    expect(lia.traits).toEqual([VERZWEIFLUNG]);
    expect(lia.level).toBe(LIA_STAGES['e3-vamir-duell'].level);
    expect(b.unit('ignatius').attack).toBeNull();
    expect(vamir.attack).toBe(KALTER_STOSS.id);
    expect(def.hooks!.triggers!.some(t => t.id === 'lia-verzweiflung')).toBe(true);
    await def.hooks!.onStart!(ctx);
    // noFlank: the same chance from the front and from behind (FFTA facing only for plain physical blows).
    lia.facing = 'w';
    const back = b.previewTarget(vamir, b.ability(KALTER_STOSS.id), lia).chance;
    lia.facing = 'e';
    const front = b.previewTarget(vamir, b.ability(KALTER_STOSS.id), lia).chance;
    expect(back).toBe(front);
    expect(b.previewTarget(vamir, b.ability(KALTER_STOSS.id), lia).damage).toBe(KALTER_STOSS.fixedDamage);
  });

  it('pays EXP and AP only on the first win', async () => {
    expect(duelProgression(false).budgets!.lia).toEqual(liaBudget('e3-vamir-duell'));
    const again = duelBattle({ ...BASE, won: true }).progression!;
    expect([again.actionExp, again.actionAp, again.victoryExp, again.victoryAp]).toEqual([0, 0, 0, 0]);
    expect(again.budgets!.lia).toEqual({ exp: 0, ap: 0 });
    const { def, ctx } = controller();
    await def.onWin!(ctx);
    expect(G.state.is(DUEL_WON)).toBe(true);
    expect(duelSetupFromState().won).toBe(true);
  });

  it('raises the violet shield: only the Stabstrahl gets through', async () => {
    const { def, ctx, ctrl } = controller();
    await def.hooks!.onStart!(ctx);
    const b = ctrl.battle, lia = b.unit('lia'), vamir = b.unit('vamir');
    expect(vamir.def).toBe(SHIELD_DEF);
    expect(b.previewTarget(lia, b.ability('lichtstoss'), vamir).damage).toBe(1);
    expect(b.previewTarget(lia, b.ability(STABSTRAHL.id), vamir).damage).toBe(STABSTRAHL.fixedDamage);
    // Without the staff there is no shield at all (nothing could break it).
    const bare = controller({ ...BASE, ownStaff: false });
    await bare.def.hooks!.onStart!(bare.ctx);
    expect(bare.ctrl.battle.unit('vamir').def).toBe(VAMIR_DEF);
    expect(duel(bare.ctx).shieldUsed).toBe(false);
  });

  it('breaks the shield on a Stabstrahl hit and calls the Urmacht after the third break', async () => {
    const { def, ctx, ctrl } = controller();
    await def.hooks!.onStart!(ctx);
    const lia = ctrl.battle.unit('lia'), vamir = ctrl.battle.unit('vamir');
    expect(stabstrahlHitVamir(STABSTRAHL.id, hit('vamir'))).toBe(true);
    expect(stabstrahlHitVamir('lichtstoss', hit('vamir'))).toBe(false);
    await def.hooks!.onAction!(ctx, { unit: lia, ability: 'lichtstoss', events: hit('vamir') });
    expect(duel(ctx).breaks).toBe(0);
    await def.hooks!.onAction!(ctx, { unit: lia, ability: STABSTRAHL.id, events: hit('vamir') });
    expect(duel(ctx)).toMatchObject({ breaks: 1, shield: false });
    expect(vamir.def).toBe(VAMIR_DEF);
    // A second beam on the open Vamir breaks nothing.
    await def.hooks!.onAction!(ctx, { unit: lia, ability: STABSTRAHL.id, events: hit('vamir') });
    expect(duel(ctx).breaks).toBe(1);
    const urmacht = def.hooks!.triggers!.find(t => t.id === 'e3-urmacht')!;
    for (let i = 2; i <= BREAKS_TO_FINISH; i++) {
      expect(urmacht.when(ctx)).toBe(false);
      ctx.unit('vamir')!.def = SHIELD_DEF; duel(ctx).shield = true;
      await def.hooks!.onAction!(ctx, { unit: lia, ability: STABSTRAHL.id, events: hit('vamir') });
    }
    expect(urmacht.when(ctx)).toBe(true);
    expect(finisherDue({ hp: 20, maxHp: 48 }, 0)).toBe(false);
    expect(finisherDue({ hp: 14, maxHp: 48 }, 0)).toBe(true);
    expect(finisherDue({ hp: 48, maxHp: 48 }, BREAKS_TO_FINISH)).toBe(true);
  });

  it('lets Vamir jump every second round, keeping his HP and raising the shield again', async () => {
    expect([1, 2, 3, 4].map(teleportRound)).toEqual([false, true, false, true]);
    const { def, ctx, ctrl } = controller();
    await def.hooks!.onStart!(ctx);
    const v0 = ctrl.battle.unit('vamir');
    await def.hooks!.onAction!(ctx, { unit: ctrl.battle.unit('lia'), ability: STABSTRAHL.id, events: hit('vamir') });
    v0.hp = 30;
    await def.hooks!.onRound!(ctx, 2, 'enemy');
    const v = ctrl.battle.unit('vamir');
    expect([v.x, v.y]).not.toEqual([VAMIR_START.x, VAMIR_START.y]);
    expect(TELEPORT_SPOTS.some(p => p.x === v.x && p.y === v.y)).toBe(true);
    expect(v.hp).toBe(30);
    expect(v.def).toBe(SHIELD_DEF);
    // The jump replaces his move only: he still strikes this turn.
    expect(v.moved).toBe(true);
    expect(v.acted).toBe(false);
    expect(duel(ctx).shield).toBe(true);
    const spot = teleportSpot(2, LIA_START, VAMIR_START, TELEPORT_SPOTS, () => false)!;
    const d = Math.abs(spot.x - LIA_START.x) + Math.abs(spot.y - LIA_START.y);
    expect(d).toBeGreaterThanOrEqual(3);
    expect(d).toBeLessThanOrEqual(4);
    expect(teleportSpot(2, LIA_START, VAMIR_START, TELEPORT_SPOTS, () => true)).toBeUndefined();
  });

  it('ends with the scripted Urmacht: Vamir dissolves and the battle is won', async () => {
    const { def, ctx, ctrl, presenter } = controller();
    await def.hooks!.onStart!(ctx);
    const urmacht = def.hooks!.triggers!.find(t => t.id === 'e3-urmacht')!;
    ctrl.battle.unit('vamir').hp = 10;
    expect(urmacht.when(ctx)).toBe(true);
    await urmacht.run(ctx);
    expect(presenter.magicBurst).toHaveBeenCalledWith('lia', 'vamir');
    expect(ctx.hasFlag(DUEL_FLAGS.finisher)).toBe(true);
    expect(ctrl.battle.unit('vamir').x).toBeLessThan(-50);
    expect(ctrl.outcomeNow()).toBe('win');
    expect(urmacht.when(ctx)).toBe(false);
  });
});

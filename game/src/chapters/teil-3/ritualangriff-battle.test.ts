import { afterEach, describe, expect, it, vi } from 'vitest';
import { G } from '../../core/G';
import type { AudioApi } from '../../audio/api';
import type { UiApi } from '../../ui/api';
import { BattleController, type Presenter } from '../../tactics/controller';
import { distanceField } from '../../tactics/rules/movement';
import { key } from '../../tactics/rules/grid';
import type { Unit } from '../../tactics/rules/types';
import { STAFF } from '../common/bookContract';
import { LIA_STAGES, VERZWEIFLUNG, liaBudget } from '../common/liaKit';
import { STABSTRAHL, poisonedPools } from './battle-shared';
import {
  CHARGE_LIMIT, DESERTERS, KYRA_RECOVER, MARCHER, RITUAL_FLAGS, RITUAL_WON, STANDS, STAFF_RETURNED, STONE, UMSTOSSEN, kyraUnit, nextCharge,
  ritualLia,
  ritualBattle, ritualProgression, ritualRunning, ritualSetupFromState, run, standToTopple, standingStands, syncStands,
  type RitualSetup, type RitualWeg,
} from './ritualangriff-battle';
import { POISON_FACTOR } from './shared';

const BASE: RitualSetup = { ownStaff: false, schattentoeter: false, lichtstoss: true, poisoned: true, weg: 'hohlweg', won: false };
const originalAudio = G.audio;
afterEach(() => { G.audio = originalAudio; G.state.reset(); });

function controller(setup: RitualSetup = BASE) {
  G.audio = { sfx: vi.fn() } as unknown as AudioApi;
  const def = ritualBattle(setup);
  const presenter = {
    tableau: vi.fn(async () => {}), magicBurst: vi.fn(async () => {}), play: vi.fn(async () => {}), refresh: vi.fn(), focus: vi.fn(async () => {}),
    pose: vi.fn(), bark: vi.fn(), shake: vi.fn(), banner: vi.fn(async () => {}), setObjective: vi.fn(), wait: vi.fn(async () => {}),
    showHint: vi.fn(async () => {}), clearHint: vi.fn(),
  } as unknown as Presenter;
  const ui = { say: vi.fn(async () => {}), plate: vi.fn(async () => {}), closePlate: vi.fn(async () => {}) } as unknown as UiApi;
  const ctrl = new BattleController(def, presenter, ui, () => {});
  return { def, ctrl, ctx: ctrl.ctx, presenter };
}
const trigger = (def: ReturnType<typeof ritualBattle>, id: string) => def.hooks!.triggers!.find(t => t.id === id)!;
const freeLia = (lia: Unit) => { delete lia.statuses.bound; lia.team = 'player'; };

describe('e3-ritualangriff (ritual on the hill)', () => {
  it.each(['hohlweg', 'felsen', 'offen'] as RitualWeg[])('places everyone on standable tiles and lets Flick reach the stone (%s)', weg => {
    const { def, ctrl } = controller({ ...BASE, weg });
    const grid = ctrl.battle.grid;
    for (const u of def.units) expect(grid.standable(u.x, u.y), u.id).toBe(true);
    expect(STANDS).toHaveLength(10);
    for (const s of STANDS) {
      expect(grid.standable(s.x, s.y), `stand ${s.x},${s.y}`).toBe(false);
      expect(def.map.props!.some(p => p.x === s.x && p.y === s.y && p.prop === 'stake')).toBe(true);
    }
    const sides = [{ x: STONE.x - 1, y: STONE.y }, { x: STONE.x + 1, y: STONE.y }, { x: STONE.x, y: STONE.y - 1 }, { x: STONE.x, y: STONE.y + 1 }];
    for (const t of sides) expect(grid.standable(t.x, t.y)).toBe(true);
    const flick = def.units.find(u => u.id === 'flick')!;
    const field = distanceField(grid, sides, 3);
    expect(field.get(key(flick.x, flick.y))).toBeDefined();
    expect(field.get(key(flick.x, flick.y))!).toBeLessThanOrEqual(14);
  });

  it('starts Lia bound on the stone, spared, with Stabstrahl only when she really holds her staff', () => {
    const { ctrl } = controller();
    const lia = ctrl.battle.unit('lia');
    expect([lia.x, lia.y]).toEqual([STONE.x, STONE.y]);
    expect(ctrl.battle.has(lia, 'bound')).toBe(true);
    expect(lia.freedTeam).toBe('player');
    expect(lia.tags).toContain('spared');
    expect(lia.abilities).not.toContain(STABSTRAHL.id);
    expect(lia.abilities).not.toContain('e2-stabimpuls');
    expect(ritualLia({ ...BASE, ownStaff: true }).abilities.at(-1)).toBe(STABSTRAHL.id); // appended (liaKit extra)
    expect(ritualLia({ ...BASE, schattentoeter: true }).abilities).toContain('e2-stabimpuls');
    expect(ritualLia({ ...BASE, lichtstoss: false }).abilities).not.toContain('lichtstoss');
  });

  it('builds Lia with the liaKit: Vaters Dolch, Verzweiflung, the Teil-III level floor and the poison as HP share', () => {
    const { ctrl, def } = controller();
    const lia = ctrl.battle.unit('lia');
    expect(lia.attack).toBe('dolch');
    expect(lia.weapon).toBe('vatersdolch');
    expect(lia.traits).toEqual([VERZWEIFLUNG]);
    expect(lia.level).toBe(LIA_STAGES['e3-ritualangriff'].level);
    expect(LIA_STAGES['e3-ritualangriff'].level).toBeGreaterThan(LIA_STAGES['e2-uebungskampf'].level);
    expect(def.units.find(u => u.id === 'lia')!.hpFraction).toBe(POISON_FACTOR);
    expect(ritualLia({ ...BASE, poisoned: false }).hpFraction).toBeUndefined();
    expect(def.hooks!.triggers!.some(t => t.id === 'lia-verzweiflung')).toBe(true);
  });

  it('gives every fighter a basic attack, except Ignatius, who only covers, and Kyra once she is herself again', () => {
    const { ctrl } = controller();
    const b = ctrl.battle;
    expect(b.unit('ignatius').attack).toBeNull();
    expect(b.unit('flick').attack).toBe('bogen');
    expect(b.unit('paladin-1').attack).toBe('schwerthieb');
    expect(b.unit('baris').attack).toBe('axthieb');
    expect(b.unit('kyra').attack).toBe('schwerthieb');
    for (const id of ['ds-1', 'ds-2', 'ds-3', 'ds-4']) expect(b.unit(id).attack, id).not.toBeNull();
    expect(kyraUnit(true).attack).toBe(false);
  });

  it('reads staff, Schattentöter, poison, ascent and the once-only flag from the campaign state', () => {
    expect(ritualSetupFromState()).toMatchObject({ ownStaff: false, schattentoeter: false, poisoned: false, weg: 'hohlweg', won: false });
    G.state.give(STAFF.own);
    G.state.give(STAFF.borrowed);
    G.state.set('e3-vergiftet');
    G.state.set('e3-ritual-weg', 'felsen');
    G.state.set(RITUAL_WON);
    expect(ritualSetupFromState()).toMatchObject({ ownStaff: true, schattentoeter: false, poisoned: true, weg: 'felsen', won: true });
    G.state.learn('e2-stabimpuls');
    expect(ritualSetupFromState().schattentoeter).toBe(true);
    G.state.take(STAFF.own);
    G.state.set('e3-gift-abklingend');
    G.state.set('e3-ritual-weg', 'quatsch');
    expect(ritualSetupFromState()).toMatchObject({ ownStaff: false, poisoned: false, weg: 'hohlweg' });
  });

  it('weakens the poisoned Lia to 60 % HP and MP at the start', async () => {
    const healthy = controller({ ...BASE, poisoned: false });
    await healthy.def.hooks!.onStart!(healthy.ctx);
    const full = healthy.ctrl.battle.unit('lia');
    const sick = controller();
    await sick.def.hooks!.onStart!(sick.ctx);
    const lia = sick.ctrl.battle.unit('lia');
    expect(lia.maxHp).toBe(Math.floor(full.maxHp * POISON_FACTOR));
    expect(lia.maxMp).toBe(Math.floor(full.maxMp * POISON_FACTOR));
    expect(lia.hp).toBe(lia.maxHp);
    expect(lia.mp).toBe(lia.maxMp);
    expect(poisonedPools({ maxHp: 20, maxMp: 10, hp: 20, mp: 3 })).toEqual({ maxHp: 12, maxMp: 6, hp: 12, mp: 3 });
  });

  it('pays EXP and AP only on the first win', () => {
    const first = ritualProgression(false);
    expect(first.budgets!.flick.exp).toBeGreaterThan(0);
    expect(first.budgets!.lia).toEqual(liaBudget('e3-ritualangriff'));
    const again = ritualBattle({ ...BASE, won: true }).progression!;
    expect([again.actionExp, again.defeatExp, again.actionAp, again.victoryExp, again.victoryAp]).toEqual([0, 0, 0, 0, 0]);
    for (const b of Object.values(again.budgets!)) expect(b).toEqual({ exp: 0, ap: 0 });
  });

  it('charges one per enemy round, loses one per stand, never below zero or above the limit', () => {
    expect(nextCharge(0, 'round')).toBe(1);
    expect(nextCharge(3, 'round', false)).toBe(3);
    expect(nextCharge(CHARGE_LIMIT, 'round')).toBe(CHARGE_LIMIT);
    expect(nextCharge(2, 'topple')).toBe(1);
    expect(nextCharge(0, 'topple')).toBe(0);
    expect(ritualRunning(true, 10)).toBe(true);
    expect(ritualRunning(false, 10)).toBe(false);
    expect(ritualRunning(true, 0)).toBe(false);
    const at = { x: 5, y: 3 }; // gap between the stands (4,3) and (6,3)
    expect(standToTopple(at, 'e', STANDS)).toEqual({ x: 6, y: 3 });
    expect(standToTopple(at, 'w', STANDS)).toEqual({ x: 4, y: 3 });
    expect(standToTopple(at, 's', STANDS)).toEqual({ x: 4, y: 3 });
    expect(standToTopple({ x: 1, y: 1 }, 'n', STANDS)).toBeUndefined();
  });

  it('offers „Ständer umstoßen“ only next to a standing stand and lowers the charge', async () => {
    const { def, ctx, ctrl } = controller();
    for (let r = 1; r <= 3; r++) await def.hooks!.onRound!(ctx, r, 'enemy');
    expect(run(ctx).charge).toBe(3);
    const flick = ctrl.battle.unit('flick');
    syncStands(ctx);
    expect(flick.abilities).not.toContain(UMSTOSSEN.id);
    Object.assign(flick, { x: 5, y: 3, facing: 'e' });
    syncStands(ctx);
    expect(flick.abilities).toContain(UMSTOSSEN.id);
    await def.hooks!.onAction!(ctx, { unit: flick, ability: UMSTOSSEN.id, events: [] });
    expect(run(ctx).charge).toBe(2);
    expect(run(ctx).toppled).toEqual([{ x: 6, y: 3 }]);
    expect(ctrl.battle.grid.standable(6, 3)).toBe(true); // the fallen stand opens the ring
    expect(flick.abilities).toContain(UMSTOSSEN.id); // (4,3) still stands next to her
    await def.hooks!.onAction!(ctx, { unit: flick, ability: UMSTOSSEN.id, events: [] });
    expect(standingStands(run(ctx))).toHaveLength(8);
    expect(flick.abilities).not.toContain(UMSTOSSEN.id);
    // Allies (AI) never get the action.
    const pal = ctrl.battle.unit('paladin-1');
    Object.assign(pal, { x: 7, y: 2 });
    syncStands(ctx);
    expect(pal.abilities).not.toContain(UMSTOSSEN.id);
  });

  it('loses when the charge reaches the limit, with the ritual defeat text', async () => {
    const { def, ctx, ctrl } = controller();
    await def.hooks!.onStart!(ctx);
    for (let r = 1; r < CHARGE_LIMIT; r++) await def.hooks!.onRound!(ctx, r, 'enemy');
    expect(ctrl.outcomeNow()).toBeNull();
    await def.hooks!.onRound!(ctx, CHARGE_LIMIT, 'enemy');
    expect(ctx.hasFlag(RITUAL_FLAGS.lose)).toBe(true);
    expect(ctrl.outcomeNow()).toBe('lose');
    expect(def.defeatText).toContain('Ritual');
  });

  it('stops the ritual and sends Vamir and Ignatius away once Lia is free', async () => {
    const { def, ctx, ctrl } = controller();
    await def.hooks!.onRound!(ctx, 1, 'enemy');
    const lia = ctrl.battle.unit('lia');
    freeLia(lia);
    await def.hooks!.onFree!(ctx, lia, ctrl.battle.unit('flick'));
    expect(run(ctx).liaFree).toBe(true);
    expect(ctx.hasFlag(RITUAL_FLAGS.vamirGone)).toBe(true);
    expect(ctrl.battle.unit('ignatius').x).toBeLessThan(-50);
    for (const id of DESERTERS) expect(ctrl.battle.unit(id).x).toBeLessThan(-50);
    expect(ctrl.battle.unit('baris').x).toBeGreaterThan(-50);
    await def.hooks!.onRound!(ctx, 2, 'enemy');
    expect(run(ctx).charge).toBe(1);
  });

  it('lets the marching paladin cut Lia loose next to the stone; then Baris goes for Flick', async () => {
    const { def, ctx, ctrl } = controller();
    await def.hooks!.onStart!(ctx);
    expect(ctrl.battle.aiOverrides.get(MARCHER)?.goal).toBeDefined();
    expect(ctrl.battle.aiOverrides.get('baris')).toBeUndefined();
    const pal = ctrl.battle.unit(MARCHER);
    Object.assign(pal, { x: 3, y: 4 });
    await def.hooks!.onMove!(ctx, pal, { x: 3, y: 4 });
    expect(ctrl.battle.has(ctrl.battle.unit('lia'), 'bound')).toBe(true);
    Object.assign(pal, { x: STONE.x - 1, y: STONE.y });
    await def.hooks!.onMove!(ctx, pal, { x: STONE.x - 1, y: STONE.y });
    const lia = ctrl.battle.unit('lia');
    expect(ctrl.battle.has(lia, 'bound')).toBe(false);
    expect(lia.team).toBe('player');
    expect(lia.abilities).not.toContain(STABSTRAHL.id); // the staff is still with Flick
    expect(run(ctx).liaFree).toBe(true);
    expect(ctrl.battle.aiOverrides.get('baris')?.target).toBe('flick');
    expect(ctrl.battle.aiOverrides.get(MARCHER)).toBeUndefined();
  });

  it('hands Lia her own staff when Flick stands next to her: inventory, flag and Stabstrahl', async () => {
    const { def, ctx, ctrl } = controller();
    await def.hooks!.onStart!(ctx);
    const poisonedMax = ctrl.battle.unit('lia').maxHp;
    const due = trigger(def, 'e3-stabrueckgabe');
    expect(due.when(ctx)).toBe(false);
    const lia = ctrl.battle.unit('lia');
    freeLia(lia);
    run(ctx).liaFree = true;
    Object.assign(ctrl.battle.unit('flick'), { x: STONE.x - 1, y: STONE.y });
    expect(due.when(ctx)).toBe(true);
    expect(G.state.has(STAFF.own)).toBe(false);
    await due.run(ctx);
    expect(G.state.has(STAFF.own)).toBe(true);
    expect(G.state.count(STAFF.own)).toBe(1);
    expect(G.state.is(STAFF_RETURNED)).toBe(true);
    expect(G.state.flag('e3-stab-ort')).toBe('lia');
    const after = ctrl.battle.unit('lia');
    expect(after.team).toBe('player');
    expect(after.abilities).toContain(STABSTRAHL.id);
    expect(after.maxHp).toBe(poisonedMax); // poison survives the new look
    expect([after.x, after.y]).toEqual([STONE.x, STONE.y]);
    expect(due.when(ctx)).toBe(false);
    // The win only counts the staff once.
    await def.onWin!(ctx);
    expect(G.state.count(STAFF.own)).toBe(1);
    expect(G.state.is(RITUAL_WON)).toBe(true);
  });

  it('breaks Kyra’s ban when Baris goes down: she switches to the allies and cannot die', async () => {
    const { def, ctx, ctrl } = controller();
    expect(ctrl.battle.unit('kyra').team).toBe('enemy');
    expect(ctrl.battle.unit('baris').nonLethal).toBe(true);
    const baris = ctrl.battle.unit('baris');
    ctrl.battle.knockOut(baris);
    expect(baris.down).toBe('wounded');
    await def.hooks!.onUnitDown!(ctx, baris, 'wounded');
    const kyra = ctrl.battle.unit('kyra');
    expect(kyra.team).toBe('ally');
    expect(kyra.nonLethal).toBe(true);
    expect(kyra.down).toBe(false);
    expect(ctrl.unitDefs.get('kyra')!.preset).toBe('kyra');
    expect(ctx.hasFlag(RITUAL_FLAGS.kyraFree)).toBe(true);
    expect(run(ctx).barisDown).toBe(true);
  });

  it('lets the banned Kyra stagger up again instead of staying down', async () => {
    const { def, ctx, ctrl } = controller();
    const kyra = ctrl.battle.unit('kyra');
    ctrl.battle.knockOut(kyra);
    await def.hooks!.onUnitDown!(ctx, kyra, 'wounded');
    const again = ctrl.battle.unit('kyra');
    expect(again.down).toBe(false);
    expect(again.team).toBe('enemy');
    expect(again.hp).toBe(Math.round(again.maxHp * KYRA_RECOVER));
    expect(def.objective.lose!.some(c => c.type === 'unitDown' && c.units.includes('kyra'))).toBe(false);
  });

  it('wins only when Baris is down and Lia is free; Flick’s fall loses', async () => {
    const { def, ctx, ctrl } = controller();
    const win = trigger(def, 'e3-ritual-sieg');
    run(ctx).barisDown = true;
    expect(win.when(ctx)).toBe(false);
    run(ctx).liaFree = true;
    expect(win.when(ctx)).toBe(true);
    await win.run(ctx);
    expect(ctrl.outcomeNow()).toBe('win');
    const other = controller();
    other.ctrl.battle.knockOut(other.ctrl.battle.unit('flick'));
    expect(other.ctrl.outcomeNow()).toBe('lose');
  });
});

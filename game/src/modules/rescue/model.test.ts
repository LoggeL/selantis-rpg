import { describe, expect, it } from 'vitest';
import { RESCUE } from '../../content/encounters/rescue';
import { RescueModel } from './model';

function next(model: RescueModel) { expect(model.beginEnemyTurn()).toBe(true); return model.resolveEnemyTurn(); }
function opening(model: RescueModel) {
  expect(model.move({ x: 4, y: 3 }, 'lia')).toBe(true);
  expect(model.use('guard', 'lia')).toBe(true);
  expect(model.use('kyra', 'flick')).toBe(true);
  next(model);
}

describe('tactical rescue rules', () => {
  it('has independent move/action budgets, blocks ruin and occupied fields, and rejects a second move', () => {
    const model = new RescueModel(RESCUE);
    expect(model.move({ x: 4, y: 1 })).toBe(false);
    expect(model.move({ x: 6, y: 1 })).toBe(false);
    expect(model.state.budgets.lia).toEqual({ moved: false, acted: false });
    expect(model.move({ x: 4, y: 3 })).toBe(true);
    expect(model.move({ x: 5, y: 3 })).toBe(false);
    expect(model.use('guard')).toBe(true);
    expect(model.state.budgets.lia).toEqual({ moved: true, acted: true });
    expect(model.state.budgets.flick).toEqual({ moved: false, acted: false });
    expect(model.use('captain')).toBe(false);
  });
  it('requires adjacency for Flick to free Kyra; Lia can only warn her', () => {
    const model = new RescueModel(RESCUE);
    expect(model.use('kyra', 'lia')).toBe(false);
    expect(model.move({ x: 6, y: 0 }, 'flick')).toBe(true);
    expect(model.use('kyra', 'flick')).toBe(false);
    expect(model.state.freed).toBe(false);
    expect(model.state.budgets.flick.acted).toBe(false);
  });
  it('distraction actually consumes the enemy turn and refreshes budgets only on the next round', () => {
    const model = new RescueModel(RESCUE); opening(model);
    expect(model.unit('lia').hp).toBe(36);
    expect(model.unit('guard').cell).toEqual({ x: 6, y: 3 });
    expect(model.state.round).toBe(2);
    expect(model.state.budgets.lia).toEqual({ moved: false, acted: false });
    expect(model.state.distracted).toEqual([]);
  });
  it('guard reduces a real attack and moving after guarding removes the stance', () => {
    const guarded = new RescueModel(RESCUE);
    expect(guarded.guard('flick')).toBe(true);
    const events = next(guarded);
    expect(events.find(event => event.target === 'flick')).toMatchObject({ damage: 4 });
    const moved = new RescueModel(RESCUE); expect(moved.guard('flick')).toBe(true); expect(moved.move({ x: 6, y: 2 }, 'flick')).toBe(true);
    expect(moved.state.guarding).toEqual([]); next(moved); expect(moved.unit('flick').hp).toBe(30);
  });
  it('a real three-round rescue needs freeing, warning, movement and adjacent protection', () => {
    const model = new RescueModel(RESCUE); opening(model);
    expect(model.state.phase).toBe('player');
    expect(model.move({ x: 6, y: 2 }, 'lia')).toBe(true); expect(model.use('kyra', 'lia')).toBe(true);
    expect(model.move({ x: 8, y: 0 }, 'flick')).toBe(true); expect(model.use('captain', 'flick')).toBe(true);
    next(model); expect(model.unit('kyra').hp).toBe(18); expect(model.unit('captain').hp).toBe(30);
    expect(model.move({ x: 6, y: 1 }, 'lia')).toBe(true); expect(model.guard('lia')).toBe(true);
    expect(model.move({ x: 8, y: 1 }, 'flick')).toBe(true); expect(model.use('guard', 'flick')).toBe(true); const protectedEvents = next(model);
    expect(protectedEvents.find(event => event.actor === 'captain' && event.damage)).toMatchObject({ target: 'lia', damage: 5 });
    expect(model.state.phase).toBe('won'); expect(model.unit('kyra').hp).toBe(18);
    expect(model.unit('guard').hp).toBe(16); expect(model.state.units.every(unit => unit.hp > 0)).toBe(true);
    expect(model.move({ x: 5, y: 1 }, 'lia')).toBe(false);
  });
  it('an adjacent guarding Lia intercepts the captain strike and keeps Kyra unharmed', () => {
    const cells = { lia: { x: 6, y: 1 }, flick: { x: 8, y: 1 }, captain: { x: 6, y: 2 }, guard: { x: 0, y: 5 } };
    const model = new RescueModel({ ...RESCUE, units: RESCUE.units.map(unit => ({ ...unit, cell: cells[unit.id as keyof typeof cells] ?? unit.cell })) });
    expect(model.guard('lia')).toBe(true); expect(model.use('kyra', 'flick')).toBe(true);
    const events = next(model);
    expect(events.find(event => event.actor === 'captain' && event.damage)).toMatchObject({ target: 'lia', damage: 5 });
    expect(model.unit('kyra').hp).toBe(24); expect(model.unit('lia').hp).toBe(31); expect(model.state.phase).toBe('won');
  });
  it('freeing alone does not win, failure is terminal, and a new attempt restores mission health', () => {
    const model = new RescueModel(RESCUE); expect(model.use('kyra', 'flick')).toBe(true);
    next(model); expect(model.state.phase).toBe('player'); next(model); next(model);
    expect(model.state.phase).toBe('failed'); expect(model.unit('kyra').hp).toBe(0);
    expect(model.beginEnemyTurn()).toBe(false); expect(model.guard()).toBe(false);
    const retry = new RescueModel(RESCUE); expect(retry.unit('kyra').hp).toBe(24); expect(retry.state.freed).toBe(false);
  });
  it('Flick respects sightline obstructions and defeated enemies withdraw without a death outcome', () => {
    const model = new RescueModel(RESCUE);
    expect(model.move({ x: 3, y: 3 }, 'lia')).toBe(true);
    // Authored variant puts a ruin directly in Flick's sightline.
    const blocked = new RescueModel({ ...RESCUE, board: { ...RESCUE.board, blocked: [...RESCUE.board.blocked, { x: 6, y: 2 }] } });
    expect(blocked.use('guard', 'flick')).toBe(false); expect(blocked.state.budgets.flick.acted).toBe(false);
    const retreat = new RescueModel({ ...RESCUE, units: RESCUE.units.map(unit => ({ ...unit, maxHp: unit.id === 'guard' ? 12 : unit.maxHp })) });
    expect(retreat.use('guard', 'flick')).toBe(true); expect(retreat.unit('guard')).toMatchObject({ hp: 0, withdrawn: true });
    expect(retreat.intents().some(intent => intent.enemy === 'guard')).toBe(false);
    expect(retreat.state.message).toContain('Kein Todesstoß');
  });
});

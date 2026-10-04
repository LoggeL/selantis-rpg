import { describe, expect, it } from 'vitest';
import { DUNKELHAIN } from "../../content/encounters/dunkelhain";
import { resolveBattleUnitStats } from "../../app/characterRules";
import { BattleModel, type BattleCommand, type BattleEffect } from "./model";
import type { EncounterDefinition } from "./encounter";

function opening(beat = 1) {
  const model = new BattleModel(DUNKELHAIN, resolveBattleUnitStats);
  model.spawn(DUNKELHAIN.player);
  for (let id = 1; id <= beat; id++) {
    const definition = model.startBeat(id)!;
    definition.spawns.forEach(unit => model.spawn(unit));
  }
  model.startPlayerTurn(); return model;
}
function execute(model: BattleModel, command: BattleCommand): BattleEffect[] {
  const result = model.dispatch(command);
  if (!result.ok) throw new Error(result.reason);
  return result.effects;
}
function settle(model: BattleModel, effects: BattleEffect[]) { return effects.flatMap(effect => model.settle(effect.id)); }

describe('authoritative battle commands', () => {
  it('rejects arrival input, blocked movement and empty or allied spells without spending budget', () => {
    const model = opening(2);
    model.state.phase = 'arrival';
    expect(model.dispatch({ type: 'move', to: { x: 4, y: 4 } })).toEqual({ ok: false, reason: 'phase' });
    model.state.phase = 'plan';
    expect(model.dispatch({ type: 'move', to: { x: 1, y: 1 } })).toEqual({ ok: false, reason: 'blocked' });
    expect(model.dispatch({ type: 'cast', ability: 'beam', target: { x: -1, y: 0 } })).toEqual({ ok: false, reason: 'empty' });
    model.player.cell = { x: 3, y: 3 };
    expect(model.dispatch({ type: 'cast', ability: 'beam', target: { x: 1, y: 0 } })).toEqual({ ok: false, reason: 'ally' });
    expect(model.state.turn).toEqual({ moved: false, acted: false });
  });
  it.each(['move-first', 'act-first'])('uses one move and one action in either order: %s', order => {
    const model = opening();
    const move = () => { const effects = execute(model, { type: 'move', to: { x: 4, y: 4 } }); settle(model, effects); model.finishAction(); };
    const act = () => { const effects = execute(model, { type: 'cast', ability: 'beam', target: { x: 1, y: 0 } }); settle(model, effects); model.finishAction(); };
    // Keep the beat alive after the first attack so movement remains available.
    model.unit('w1').hp = 250; model.unit('w2').hp = 250;
    if (order === 'move-first') { move(); act(); } else { act(); move(); }
    expect(model.state.turn).toEqual({ moved: true, acted: true });
    expect(model.state.phase).toBe('facing');
    expect(model.player.cell).toEqual({ x: 4, y: 4 });
  });
  it('reserves a spell then applies its impact exactly once', () => {
    const model = opening();
    const effects = execute(model, { type: 'cast', ability: 'beam', target: { x: 1, y: 0 } });
    expect(() => model.settle(effects[1].id)).toThrow('planned order');
    expect(model.unit('w1').hp).toBe(60);
    expect(model.state.phase).toBe('busy');
    expect(model.dispatch({ type: 'wait' })).toEqual({ ok: false, reason: 'phase' });
    const hits = settle(model, effects);
    expect(hits.map(hit => hit.target)).toEqual(['w1', 'w2']);
    expect(model.unit('w1').alive).toBe(false);
    expect(settle(model, effects)).toEqual([]);
    model.finishAction();
    expect(model.beatComplete()).toBe(true);
    expect(model.state.phase).toBe('facing');
  });
  it('wave effects preserve distant-first push ordering, wall damage, and nonlethal axe outcome', () => {
    const model = opening(2);
    model.player.cell = { x: 5, y: 4 };
    model.unit('w1').alive = false; model.unit('w2').alive = false;
    const effects = execute(model, { type: 'cast', ability: 'wave', target: { x: 7, y: 3 } });
    expect(effects.map(effect => effect.unit)).toEqual(['axe']);
    expect(model.unit('axe').cell).toEqual({ x: 7, y: 3 });
    const hits = settle(model, effects);
    expect(model.unit('axe').cell).toEqual({ x: 9, y: 3 });
    expect(hits[0]).toMatchObject({ wounded: true, hp: 1, amount: 80 });
    expect(model.unit('boy').hp).toBe(20);
    expect(model.unit('axe').alive).toBe(true);
    expect(model.beatComplete()).toBe(true);
  });
  it('phases enemies by injected speed and guard/facing changes real tutorial damage', () => {
    const model = opening();
    model.unit('w1').cell = { x: 4, y: 4 }; model.unit('w2').cell = { x: 3, y: 5 };
    model.player.hp = 8; model.computeIntents();
    execute(model, { type: 'wait' }); execute(model, { type: 'face', facing: 'e' }); execute(model, { type: 'end-turn' });
    expect(model.enemyTurns).toEqual(['w2', 'w1']);
    expect(model.dispatch({ type: 'resolve-enemy', id: 'w1' })).toEqual({ ok: false, reason: 'phase' });
    const first = execute(model, { type: 'resolve-enemy', id: 'w2' });
    expect(model.dispatch({ type: 'resolve-enemy', id: 'w1' })).toEqual({ ok: false, reason: 'pending' });
    expect(settle(model, first)[0]).toMatchObject({ damage: 7, hp: 1, protected: true });
    const second = execute(model, { type: 'resolve-enemy', id: 'w1' });
    expect(second[0]).toMatchObject({ amount: 5 });
    expect(settle(model, second)[0]).toMatchObject({ damage: 0, hp: 1, protected: true });
    expect(model.dispatch({ type: 'resolve-enemy', id: 'w2' })).toEqual({ ok: false, reason: 'phase' });
  });
  it('describes and resolves both narrative rescue branches outside Phaser', () => {
    const model = opening(2);
    model.unit('w1').alive = false; model.unit('w2').alive = false; model.computeIntents();
    execute(model, { type: 'wait' }); execute(model, { type: 'end-turn' });
    const axe = execute(model, { type: 'resolve-enemy', id: 'axe' });
    expect(axe[0]).toMatchObject({ kind: 'rescue', event: 'axe-rescue' });
    settle(model, axe);
    expect(model.unit('axe')).toMatchObject({ hp: 1, alive: true, wounded: true });
    expect(model.unit('boy').hp).toBe(20);
    model.startBeat(3)!.spawns.forEach(unit => model.spawn(unit)); model.startPlayerTurn();
    execute(model, { type: 'wait' }); execute(model, { type: 'end-turn' });
    const bolt = execute(model, { type: 'resolve-enemy', id: 'xbow' });
    expect(bolt[0]).toMatchObject({ kind: 'bolt', target: 'boy' });
    settle(model, bolt);
    expect(model.unit('falke').alive).toBe(false);
    expect(model.unit('boy').hp).toBe(20);
    expect(model.beatComplete()).toBe(true);
  });
  it('intercepts a bolt with the player and preserves the rescue actor', () => {
    const model = opening(3);
    model.unit('w1').alive = false; model.unit('w2').alive = false; model.unit('axe').wounded = true;
    model.player.cell = { x: 8, y: 5 }; model.computeIntents();
    execute(model, { type: 'wait' }); execute(model, { type: 'end-turn' });
    const bolt = execute(model, { type: 'resolve-enemy', id: 'xbow' });
    expect(bolt[0]).toMatchObject({ kind: 'bolt', target: 'valentus' });
    expect(settle(model, bolt)[0].target).toBe('valentus');
    expect(model.state.units.some(unit => unit.id === 'falke')).toBe(false);
    expect(model.beatComplete()).toBe(true);
  });
});

describe('reuse with another encounter', () => {
  it('executes alternate actors, a smaller board, authored skill cost/damage and lethal enemy rules', () => {
    const encounter: EncounterDefinition = {
      id: 'training-yard', board: { cols: 4, rows: 3, blocked: [{ x: 1, y: 0 }] }, layout: { originX: 0, originY: 0, size: 16 },
      player: { id: 'scout', kind: 'valentus', side: 'valentus', cell: { x: 0, y: 1 }, hp: 15, alive: true },
      tutorialProtection: false, nonlethal: [], narrative: undefined,
      abilities: [{ id: 'spark', targeting: 'line', range: 2, damage: 7, cost: 'act', protectsAllies: true, display: { name: 'Funke', icon: 'beam', key: 'Q', color: 0xffaa00 } }],
      enemies: { sentinel: { strategy: 'melee', target: 'scout', intent: 'strike' } },
      beats: [{ id: 1, spawns: [{ id: 'sentinel', kind: 'warrior', side: 'enemy', cell: { x: 2, y: 1 }, hp: 20, alive: true }], complete: { defeated: ['sentinel'] } }],
    };
    const model = new BattleModel(encounter, unit => ({ attack: unit.id === 'scout' ? 7 : 100, defense: 0, speed: 2, move: 1, attackRange: 1 }));
    model.spawn(encounter.player); model.startBeat(1)!.spawns.forEach(unit => model.spawn(unit)); model.startPlayerTurn();
    expect(model.movementPaths().has('1,0')).toBe(false);
    expect(model.preview('spark', { x: 1, y: 0 })!.cells).toHaveLength(2);
    settle(model, execute(model, { type: 'cast', ability: 'spark', target: { x: 1, y: 0 } })); model.finishAction();
    expect(model.unit('sentinel').hp).toBe(13);
    settle(model, execute(model, { type: 'move', to: { x: 1, y: 1 } })); model.finishAction();
    execute(model, { type: 'face', facing: 'e' }); execute(model, { type: 'end-turn' });
    const hits = settle(model, execute(model, { type: 'resolve-enemy', id: 'sentinel' }));
    expect(hits[0]).toMatchObject({ hp: 0, defeated: true, protected: false });
    expect(model.player.alive).toBe(false);
    expect(model.state.phase).toBe('end');
    model.startPlayerTurn();
    expect(model.dispatch({ type: 'wait' })).toEqual({ ok: false, reason: 'phase' });
  });
});

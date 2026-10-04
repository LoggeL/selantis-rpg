import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, BlendModes: { ADD: 1 } } }));
vi.mock("../../../app/audio", () => ({ sfx: { select: vi.fn(), step: vi.fn(), beam: vi.fn(), wave: vi.fn(), thud: vi.fn() } }));
import { BattleScene } from "./BattleScene";
import { cellCenter, type Unit } from "../battleBoard";
import { BattleModel, type BattleCommand } from '../../../modules/combat/model';
import { DUNKELHAIN } from '../../../content/encounters/dunkelhain';
import { getSettings, updateSettings } from '../../../app/settings';
import { resolveBattleUnitStats } from '../../../app/characterRules';

const unit = (id: string, side: Unit['side'], x: number, speed?: number): Unit => ({ id, side, cell: { x, y: 4 }, kind: side === 'enemy' ? 'warrior' : 'valentus', hp: 100, alive: true, speed });
function battle(withWarriors = true) {
  const scene: any = new BattleScene();
  scene.model = new BattleModel(DUNKELHAIN, resolveBattleUnitStats);
  scene.model.spawn(DUNKELHAIN.player);
  scene.model.startBeat(1);
  if (withWarriors) for (const definition of DUNKELHAIN.beats[0].spawns) scene.model.spawn({ ...definition, hp: 200 });
  scene.model.startPlayerTurn();
  scene.data = { set: vi.fn() }; scene.registry = { set: vi.fn() };
  scene.hud = { hint: vi.fn(), thought: vi.fn(), select: vi.fn(), setAbilitiesVisible: vi.fn(), setAbilitiesDisabled: vi.fn() };
  scene.previewG = { clear: vi.fn() };
  scene.sprites.set('valentus', { play: vi.fn() });
  scene.time = { delayedCall: (_ms: number, fn: () => void) => fn() };
  scene.drawIntents = vi.fn(); scene.drawGoal = vi.fn(); scene.showPlan = vi.fn(); scene.drawFacing = vi.fn();
  return scene;
}
function command(scene: any, command: BattleCommand) {
  const result = (scene.model as BattleModel).dispatch(command);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  return result.effects.flatMap(effect => scene.model.settle(effect.id));
}
function cast(scene: any) {
  return command(scene, { type: 'cast', ability: 'beam', target: { x: 1, y: 0 } });
}
function move(scene: any, x: number) {
  command(scene, { type: 'move', to: { x, y: 4 } }); scene.model.finishAction();
}

describe('scene tactical turn lifecycle', () => {
  it('keeps remaining movement after acting, prevents second spell, and publishes actual slots', () => {
    const scene = battle(); cast(scene);
    scene.afterPlayerAction();
    expect(scene.phase).toBe('plan');
    expect(scene.movementPaths().has('7,4')).toBe(true);
    scene.enterBeam(); expect(scene.phase).toBe('plan');
    scene.enterWave(); expect(scene.phase).toBe('plan');
    expect(scene.registry.set).toHaveBeenCalledWith('battle:state', expect.objectContaining({ moved: false, acted: true }));
    expect(scene.data.set).toHaveBeenCalledWith('mobile:controls', expect.objectContaining({ actions: { ENTER: 'Feld wählen', SPACE: 'Zug beenden' } }));
  });
  it('rejects another movement and preserves a spent move when cancelling selection', () => {
    const scene = battle(); move(scene, 6);
    scene.moveValentus = vi.fn();
    scene.chooseMovement({ x: 7, y: 4 });
    scene.previewBeam = vi.fn(); scene.enterBeam(); scene.cancel();
    expect(scene.moveValentus).not.toHaveBeenCalled();
    expect(scene.unit('valentus').cell).toEqual({ x: 6, y: 4 });
    expect([...scene.movementPaths().keys()]).toEqual(['6,4']);
    expect(scene.moved).toBe(true);
  });
  it('requires facing confirmation even after the final enemy falls', () => {
    const scene = battle(); move(scene, 4);
    scene.unit('valentus').magicAttack = 200; cast(scene);
    scene.nextBeat = vi.fn(); scene.enemyPhase = vi.fn();
    scene.afterPlayerAction();
    expect(scene.phase).toBe('facing');
    expect(scene.nextBeat).not.toHaveBeenCalled();
    scene.commitTurn();
    expect(scene.nextBeat).toHaveBeenCalledOnce();
    expect(scene.enemyPhase).not.toHaveBeenCalled();
  });
  it('spends unused slots as frontal guard, but cannot guard after casting', () => {
    const scene = battle(); scene.doWait();
    expect(scene.phase).toBe('facing');
    expect(scene.turn).toEqual({ moved: true, acted: true });
    expect(scene.guarding).toBe(true);
    const afterCast = battle(); cast(afterCast); afterCast.model.finishAction(); afterCast.doWait();
    expect(afterCast.phase).toBe('facing');
    expect(afterCast.guarding).toBe(false);
  });
  it('resolves displayed speed order and finishes the enemy phase once', () => {
    const scene = battle();
    scene.doWait(); command(scene, { type: 'end-turn' });
    const resolved: string[] = [];
    const resolve = (BattleScene.prototype as any).resolveIntent;
    scene.sprites.set('w1', { play: vi.fn() }); scene.sprites.set('w2', { play: vi.fn() });
    scene.tweens = { add: (config: any) => config.onComplete?.() };
    scene.resolveIntent = (id: string, done: () => void) => { resolved.push(id); resolve.call(scene, id, done); };
    const done = vi.fn(); scene.enemyPhase(done);
    expect(resolved).toEqual(['w2', 'w1']);
    expect(done).toHaveBeenCalledOnce();
  });
  it('uses live move and spell-range overrides in actual targeting and publishes the same values', () => {
    const scene = battle(), valentus = scene.unit('valentus');
    Object.assign(valentus, { move: 2, attackRange: 3, magicAttack: 64, defense: 17 });
    expect(scene.movementPaths().has('5,4')).toBe(true);
    expect(scene.movementPaths().has('6,4')).toBe(false);
    const aim = cellCenter({ x: 4, y: 4 });
    expect(scene.beamFromPointer({ worldX: aim.x, worldY: aim.y }).cells).toEqual([{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }]);
    scene.refreshTacticalStatus();
    const snapshot = scene.registry.set.mock.calls.findLast(([key]: [string]) => key === 'battle:state')[1];
    expect(snapshot.units.find((u: Unit) => u.id === 'valentus')).toMatchObject({ move: 2, attackRange: 3, magicAttack: 64, defense: 17 });
  });
  it('enemy intent planning consumes the same movement and range state as the snapshot', () => {
    const scene = battle();
    Object.assign(scene.unit('w1'), { cell: { x: 5, y: 4 }, attackRange: 2 });
    Object.assign(scene.unit('w2'), { move: 1 });
    (BattleScene.prototype as any).computeIntents.call(scene);
    expect(scene.intents.get('w1')).toEqual({ kind: 'strike', target: 'valentus' });
    expect(scene.intents.get('w2').path).toEqual([{ x: 9, y: 4 }]);
  });
  it.each(['beam', 'wave'] as const)('settles %s only at its animation impact and releases the pending action afterwards', ability => {
    const previous = getSettings(); updateSettings({ reducedMotion: true });
    try {
      const scene = battle();
      const timers: Array<{ delay: number; callback: () => void }> = [];
      const tweens: Array<{ duration: number; onComplete?: () => void }> = [];
      scene.time = { delayedCall: (delay: number, callback: () => void) => timers.push({ delay, callback }) };
      scene.tweens = { add: (tween: any) => tweens.push(tween) };
      const ring: any = {};
      for (const method of ['setStrokeStyle', 'setDepth', 'setBlendMode', 'destroy']) ring[method] = vi.fn(() => ring);
      scene.add = { circle: () => ring };
      scene.sprites.set('w1', { play: vi.fn() }); scene.sprites.set('w2', { play: vi.fn() });
      scene.beamFx = vi.fn(); scene.previewBeam = vi.fn(); scene.previewWave = vi.fn();
      scene.shake = vi.fn(); scene.clearIntent = vi.fn(); scene.presentDamage = vi.fn();
      const target = cellCenter({ x: ability === 'beam' ? 4 : 7, y: 4 });
      scene[ability === 'beam' ? 'enterBeam' : 'enterWave']();
      scene[ability === 'beam' ? 'confirmBeam' : 'confirmWave']({ worldX: target.x, worldY: target.y });
      expect(scene.phase).toBe('busy');
      expect(scene.unit('w1').hp).toBe(200);
      expect(() => scene.model.finishAction()).toThrow('Unsettled battle effects');
      timers.find(timer => timer.delay === (ability === 'beam' ? 180 : 200))!.callback();
      if (ability === 'wave') {
        expect(scene.unit('w1').hp).toBe(200);
        tweens.find(tween => tween.duration === 360)!.onComplete!();
      }
      expect(scene.unit('w1').hp).toBe(ability === 'beam' ? 100 : 80);
      expect(scene.presentDamage).toHaveBeenCalled();
      timers.find(timer => timer.delay === (ability === 'beam' ? 1100 : 1200))!.callback();
      expect(scene.phase).toBe('plan');
      expect(scene.acted).toBe(true);
      expect(scene.moved).toBe(false);
    } finally { updateSettings(previous); }
  });
  it.each(['beam', 'wave', 'falke'])('leaves the axe fighter alive and wounded after lethal %s damage', source => {
    const scene = battle(false);
    scene.model.startBeat(2);
    const axe = scene.model.spawn({ ...unit('axe', 'enemy', 7), kind: 'axe', hp: 60 });
    scene.model.spawn({ id: 'boy', kind: 'boy', side: 'ally', cell: { x: 7, y: 3 }, hp: 20, alive: true });
    scene.model.startPlayerTurn();
    const sprite: any = {};
    for (const method of ['play', 'setAlpha', 'setVisible', 'setTintFill', 'clearTint']) sprite[method] = vi.fn(() => sprite);
    scene.sprites.set('axe', sprite);
    const effect: any = {};
    for (const method of ['setOrigin', 'setDepth', 'setStrokeStyle']) effect[method] = vi.fn(() => effect);
    scene.add = { text: vi.fn(() => effect), ellipse: vi.fn(() => effect) };
    scene.tweens = { add: vi.fn() };
    scene.clearIntent = vi.fn(); scene.kill = vi.fn();
    let hits;
    if (source === 'falke') {
      command(scene, { type: 'wait' }); command(scene, { type: 'end-turn' });
      hits = command(scene, { type: 'resolve-enemy', id: 'axe' });
    } else {
      hits = command(scene, { type: 'cast', ability: source, target: source === 'beam' ? { x: 1, y: 0 } : { x: 7, y: 4 } });
    }
    scene.presentDamage(hits);
    expect(axe).toMatchObject({ alive: true, wounded: true, hp: 1 });
    expect(sprite.play).toHaveBeenCalledWith('axe-land');
    expect(scene.kill).not.toHaveBeenCalled();
    expect(scene.data.set).toHaveBeenCalledWith('battle:axeOutcome', 'wounded');
    expect(scene.model.intents.has('axe')).toBe(false);
    scene.model.startPlayerTurn();
    // A fresh command also excludes the wounded actor from targeting and enemy turns.
    if (source === 'falke') {
      command(scene, { type: 'wait' }); command(scene, { type: 'end-turn' });
      expect(scene.model.dispatch({ type: 'resolve-enemy', id: 'axe' }).ok).toBe(false);
    } else expect(scene.model.dispatch({ type: 'cast', ability: source, target: source === 'beam' ? { x: 1, y: 0 } : { x: 7, y: 4 } })).toEqual({ ok: false, reason: 'empty' });
    expect(axe).toMatchObject({ alive: true, wounded: true, hp: 1 });
  });
});

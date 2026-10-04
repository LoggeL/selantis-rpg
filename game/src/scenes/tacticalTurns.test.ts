import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, BlendModes: { ADD: 1 } } }));
vi.mock('../audio', () => ({ sfx: { select: vi.fn(), step: vi.fn() } }));
import { BattleScene } from './BattleScene';
import { cellCenter, type Unit } from '../battle/grid';

const unit = (id: string, side: Unit['side'], x: number, speed?: number): Unit => ({ id, side, cell: { x, y: 4 }, kind: side === 'enemy' ? 'warrior' : 'valentus', hp: 100, alive: true, speed });
function battle() {
  const scene: any = new BattleScene();
  scene.phase = 'plan'; scene.beat = 1;
  scene.units = [unit('valentus', 'valentus', 3), unit('w1', 'enemy', 8, 6), unit('w2', 'enemy', 10, 7)];
  scene.data = { set: vi.fn() }; scene.registry = { set: vi.fn() };
  scene.hud = { hint: vi.fn(), thought: vi.fn(), select: vi.fn(), setAbilitiesVisible: vi.fn(), setAbilitiesDisabled: vi.fn() };
  scene.previewG = { clear: vi.fn() };
  scene.sprites.set('valentus', { play: vi.fn() });
  scene.time = { delayedCall: (_ms: number, fn: () => void) => fn() };
  scene.computeIntents = vi.fn(); scene.drawIntents = vi.fn(); scene.drawGoal = vi.fn(); scene.showPlan = vi.fn(); scene.drawFacing = vi.fn();
  return scene;
}

describe('scene tactical turn lifecycle', () => {
  it('keeps remaining movement after acting, prevents second spell, and publishes actual slots', () => {
    const scene = battle(); scene.turn = { moved: false, acted: true };
    scene.afterPlayerAction();
    expect(scene.phase).toBe('plan');
    expect(scene.movementPaths().has('7,4')).toBe(true);
    scene.enterBeam(); expect(scene.phase).toBe('plan');
    scene.enterWave(); expect(scene.phase).toBe('plan');
    expect(scene.registry.set).toHaveBeenCalledWith('battle:state', expect.objectContaining({ moved: false, acted: true }));
    expect(scene.data.set).toHaveBeenCalledWith('mobile:controls', expect.objectContaining({ actions: { ENTER: 'Feld wählen', SPACE: 'Zug beenden' } }));
  });
  it('rejects another movement and preserves a spent move when cancelling selection', () => {
    const scene = battle(); scene.turn = { moved: true, acted: false }; scene.unit('valentus').cell = { x: 6, y: 4 };
    scene.moveValentus = vi.fn();
    scene.chooseMovement({ x: 7, y: 4 });
    scene.cancel();
    expect(scene.moveValentus).not.toHaveBeenCalled();
    expect(scene.unit('valentus').cell).toEqual({ x: 6, y: 4 });
    expect([...scene.movementPaths().keys()]).toEqual(['6,4']);
    expect(scene.moved).toBe(true);
  });
  it('requires facing confirmation even after the final enemy falls', () => {
    const scene = battle(); scene.turn = { moved: true, acted: true };
    scene.units.filter((u: Unit) => u.side === 'enemy').forEach((u: Unit) => { u.alive = false; });
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
    const afterCast = battle(); afterCast.turn = { moved: false, acted: true }; afterCast.doWait();
    expect(afterCast.phase).toBe('facing');
    expect(afterCast.guarding).toBe(false);
  });
  it('resolves displayed speed order and finishes the enemy phase once', () => {
    const scene = battle(); scene.intents.set('w1', { kind: 'advance', path: [], strike: false }); scene.intents.set('w2', { kind: 'advance', path: [], strike: false });
    const resolved: string[] = [];
    scene.resolveIntent = (id: string, done: () => void) => { resolved.push(id); done(); };
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
  it.each(['beam', 'wave', 'falke'])('leaves the axe fighter alive and wounded after lethal %s damage', source => {
    const scene = battle();
    const axe = { ...unit('axe', 'enemy', 7), kind: 'axe', hp: 60 } as Unit;
    scene.units.push(axe);
    const sprite: any = {};
    for (const method of ['play', 'setAlpha', 'setVisible', 'setTintFill', 'clearTint']) sprite[method] = vi.fn(() => sprite);
    scene.sprites.set('axe', sprite);
    const effect: any = {};
    for (const method of ['setOrigin', 'setDepth', 'setStrokeStyle']) effect[method] = vi.fn(() => effect);
    scene.add = { text: vi.fn(() => effect), ellipse: vi.fn(() => effect) };
    scene.tweens = { add: vi.fn() };
    scene.clearIntent = vi.fn(); scene.kill = vi.fn();
    scene.damage(axe, 999, source);
    expect(axe).toMatchObject({ alive: true, wounded: true, hp: 1 });
    expect(sprite.play).toHaveBeenCalledWith('axe-land');
    expect(scene.kill).not.toHaveBeenCalled();
    expect(scene.data.set).toHaveBeenCalledWith('battle:axeOutcome', 'wounded');
    scene.damage(axe, 999, source);
    expect(axe).toMatchObject({ alive: true, wounded: true, hp: 1 });
  });
});

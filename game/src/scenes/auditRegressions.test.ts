import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, BlendModes: { ADD: 1 } } }));
vi.mock('../audio', () => ({ sfx: { thud: vi.fn(), hit: vi.fn(), select: vi.fn(), beam: vi.fn(), wave: vi.fn() } }));
import { BattleScene } from './BattleScene';
import { WorldScene } from './WorldScene';
import { StoryScene } from '../story/StoryScene';
import { RefugeScene } from './RefugeScene';
import { cellFoot, freeCell, GRID, inside, isRock, unitAt, wavePushes, type Unit } from '../battle/grid';
import { updateSettings } from '../settings';

// Exercise real scene methods; only renderer/timer boundaries are substituted.
const object = () => { const o: any = {}; for (const name of ['setAlpha', 'setDisplaySize', 'setOrigin', 'setDepth', 'setPosition', 'play', 'setTint', 'setBlendMode', 'setStrokeStyle', 'lineStyle', 'lineBetween']) o[name] = vi.fn(() => o); return o; };
const unit = (id: string, x: number, y: number): Unit => ({ id, kind: 'valentus', side: 'valentus', cell: { x, y }, hp: 100, alive: true });
function battle() { const s: any = new BattleScene(); s.add = { sprite: object, image: object }; s.cameras = { main: { shake: vi.fn() } }; s.tweens = { add: vi.fn() }; return s; }
beforeEach(() => updateSettings({ reducedMotion: false }));

describe.each([['world', WorldScene, 'interact'], ['story', StoryScene, 'useSpot']] as const)('%s inventory modal', (_name, Scene, method) => {
  it('blocks interaction while open and allows it again after closing', () => {
    const s: any = new Scene(); const onUse = vi.fn();
    const spot = { id: 'apple', lines: ['apple'], at: [0, 0], radius: 10, onUse };
    s.inventory = { isOpen: true }; s.spots = [spot]; s.lia = { x: 0, y: 0 };
    s.clearRoute = vi.fn(); s.idleLia = vi.fn(); s.nearJump = () => undefined;
    s.map = { id: 'test', props: [spot] }; s.hud = { thought: onUse }; s.events = { emit: vi.fn() };
    s[method](spot); expect(onUse).not.toHaveBeenCalled();
    s.inventory.isOpen = false; s[method](spot); expect(onUse).toHaveBeenCalledOnce();
  });
});

describe('refuge awakening', () => {
  it('omits warping lens effects under reduced motion, including the fade-out', () => {
    updateSettings({ reducedMotion: true });
    const s: any = new RefugeScene(); const callbacks: Array<() => void> = [];
    const cam = { postFX: { addBlur: vi.fn(() => ({})), addPixelate: vi.fn(() => ({})), addBarrel: vi.fn(() => ({})) }, fadeIn: vi.fn(), fadeOut: vi.fn() };
    s.cameras = { main: cam }; s.world = { add: vi.fn() }; s.add = { image: object, rectangle: object };
    s.glowTexture = () => 'glow'; s.time = { addEvent: vi.fn(), now: 0 }; s.tweens = { addCounter: vi.fn(), add: vi.fn() };
    s.at = (ms: number, fn: () => void) => { if (ms === 7900) callbacks.push(fn); };
    s.eyesOpen(); callbacks.forEach(fn => fn());
    expect(cam.postFX.addBarrel).not.toHaveBeenCalled();
    expect(cam.fadeOut).toHaveBeenCalled();
  });
});

describe.each(['beam', 'wave'] as const)('refuge %s echo', kind => {
  it('suppresses camera shake when reduced motion is enabled', () => {
    updateSettings({ reducedMotion: true });
    const s: any = new RefugeScene(); const callbacks: Array<() => void> = [];
    const cam = { resetFX: vi.fn(), postFX: { addBarrel: vi.fn(() => ({})) }, shake: vi.fn() };
    s.cameras = { main: cam }; s.registry = { get: () => ({ kind, from: { x: 3, y: 4 }, dir: { x: 1, y: 0 } }) };
    s.world = { add: vi.fn() }; s.add = { image: object, circle: object, rectangle: object, graphics: object };
    s.tweens = { add: vi.fn() }; s.at = (ms: number, fn: () => void) => { if (ms === 140) callbacks.push(fn); };
    s.echo(); callbacks.forEach(fn => fn());
    expect(cam.shake).not.toHaveBeenCalled();
    expect(cam.postFX.addBarrel).not.toHaveBeenCalled();
    updateSettings({ reducedMotion: false }); s.echo(); callbacks.at(-1)!();
    expect(cam.shake).toHaveBeenCalledOnce();
    expect(cam.postFX.addBarrel).toHaveBeenCalledOnce();
  });
});

describe('battle occupancy', () => {
  it('keeps valid preferred cells, ignores dead units, and rejects a full grid', () => {
    expect(freeCell([], { x: 6, y: 3 })).toEqual({ x: 6, y: 3 });
    const dead = unit('dead', 6, 3); dead.alive = false;
    expect(freeCell([dead], dead.cell)).toEqual(dead.cell);
    expect(isRock(freeCell([], { x: 1, y: 1 }))).toBe(false);
    expect(inside(freeCell([], { x: -1, y: -1 }))).toBe(true);
    const full: Unit[] = [];
    for (let y = 0; y < GRID.rows; y++) for (let x = 0; x < GRID.cols; x++) full.push(unit(`${x},${y}`, x, y));
    expect(() => freeCell(full, { x: 6, y: 3 })).toThrow('No free battle cell');
  });
  it('uses the selected free cell for enemy entry animation too', () => {
    const s = battle(); s.units = [unit('valentus', 7, 3)];
    s.spawnEnemy('axe', 'axe', { x: 7, y: 3 }, 60);
    const axe = s.unit('axe'), f = cellFoot(axe.cell);
    expect(unitAt(s.units, axe.cell)?.id).toBe('axe');
    expect(s.tweens.add.mock.calls[0][0]).toMatchObject({ x: f.x });
  });
  it('stops an enemy at a newly occupied path cell instead of skipping through it', () => {
    const s = battle(); const enemy = unit('w1', 8, 4); enemy.kind = 'warrior'; enemy.side = 'enemy';
    s.units = [enemy, unit('valentus', 7, 4)]; s.sprites.set('w1', object());
    s.intents.set('w1', { kind: 'advance', path: [{ x: 7, y: 4 }, { x: 6, y: 4 }], strike: false });
    const done = vi.fn(); s.resolveIntent('w1', done);
    expect(enemy.cell).toEqual({ x: 8, y: 4 });
    expect(s.tweens.add).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledOnce();
  });
  it('lands the boy in a free cell when Valentus occupies the scripted landing', () => {
    const s = battle(); s.units = [unit('valentus', 6, 3)];
    for (const [id, x] of [['w1', 8], ['w2', 10]] as const) {
      const warrior = unit(id, x, 4); warrior.kind = 'warrior'; warrior.side = 'enemy'; warrior.hp = 60; s.units.push(warrior);
    }
    for (const push of wavePushes(s.units, { x: 9, y: 4 }, s.units[0].cell)) {
      push.unit.cell = push.end; push.unit.hp -= 80; push.unit.alive = push.unit.hp > 0;
    }
    const done = vi.fn(); s.spawnBoyFalling(done);
    const boy = s.unit('boy');
    expect(unitAt(s.units, boy.cell)?.id).toBe('boy');
    expect(inside(boy.cell) && !isRock(boy.cell)).toBe(true);
    const f = cellFoot(boy.cell);
    expect(s.tweens.add.mock.calls[0][0]).toMatchObject({ x: f.x, y: f.y });
    s.tweens.add.mock.calls[0][0].onComplete(); expect(done).toHaveBeenCalledOnce();
  });
});

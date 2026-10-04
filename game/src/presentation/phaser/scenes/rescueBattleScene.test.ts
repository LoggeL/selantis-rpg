import { expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { RescueBattleScene } from './RescueBattleScene';

it('returns to the chapter only after shutdown, without resolving success on launch or an abort prompt', () => {
  const scene: any = new RescueBattleScene(); const complete = vi.fn(); const shutdown: Array<() => void> = [];
  scene.events = { once: (event: string, callback: () => void) => { if (event === 'shutdown') shutdown.push(callback); } };
  scene.scene = { stop: vi.fn(), start: vi.fn() }; scene.render = vi.fn(); scene.init({ onComplete: complete });
  scene.cancel(); expect(scene.exitRequested).toBe(true); expect(complete).not.toHaveBeenCalled();
  scene.cancel(); expect(scene.exitRequested).toBe(false); expect(complete).not.toHaveBeenCalled();
  scene.cancel(); scene.switchAlly(); expect(scene.scene.stop).toHaveBeenCalledOnce(); expect(complete).not.toHaveBeenCalled();
  shutdown.forEach(callback => callback()); expect(complete).toHaveBeenCalledWith(false);
});
it('retries a failed mission with fresh ephemeral health and does not reuse an spent turn', () => {
  const scene: any = new RescueBattleScene(); scene.render = vi.fn(); scene.sprites = new Map();
  scene.model.use('kyra', 'flick');
  for (let i = 0; i < 3; i++) { scene.model.beginEnemyTurn(); scene.model.resolveEnemyTurn(); }
  expect(scene.model.state.phase).toBe('failed'); scene.switchAlly();
  expect(scene.model.state).toMatchObject({ phase: 'player', round: 1, freed: false, budgets: { flick: { moved: false, acted: false } } });
  expect(scene.model.unit('kyra').hp).toBe(24);
});

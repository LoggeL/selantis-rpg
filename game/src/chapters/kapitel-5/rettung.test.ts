import { afterEach, describe, expect, it, vi } from 'vitest';
import { G } from '../../core/G';
import type { AudioApi } from '../../audio/api';
import type { UiApi } from '../../ui/api';
import { BattleController, type Presenter } from '../../tactics/controller';
import { rescueBattle } from './rettung';

const originalAudio = G.audio;
afterEach(() => { G.audio = originalAudio; G.state.reset(); });

describe('Lias Urmacht scene', () => {
  it.each([false, true])('finishes the engine explosion before opening the art (Flick already down: %s)', async alreadyDown => {
    G.audio = { sfx: vi.fn() } as unknown as AudioApi;
    const def = rescueBattle(2, true);
    let release!: () => void;
    const explosion = new Promise<void>(resolve => { release = resolve; });
    const tableau = vi.fn(async () => {});
    const magicBurst = vi.fn(() => explosion);
    const plate = vi.fn(async () => {});
    const presenter = {
      tableau, magicBurst, play: vi.fn(async () => {}), refresh: vi.fn(), focus: vi.fn(async () => {}),
      pose: vi.fn(), bark: vi.fn(), shake: vi.fn(), banner: vi.fn(async () => {}), setObjective: vi.fn(),
    } as unknown as Presenter;
    const ui = { say: vi.fn(async () => {}), plate, closePlate: vi.fn(async () => {}) } as unknown as UiApi;
    const controller = new BattleController(def, presenter, ui, () => {});
    const ctx = controller.ctx;
    // The normal round hook brings in Baris, then triggers the climax on its next player round.
    await def.hooks!.onRound!(ctx, 5, 'player');
    if (alreadyDown) { ctx.unit('flick')!.down = 'wounded'; ctx.unit('flick')!.hp = 0; }
    const scene = def.hooks!.onRound!(ctx, 6, 'player');
    await vi.waitFor(() => expect(magicBurst).toHaveBeenCalledWith('lia', 'baris'));
    expect(tableau).toHaveBeenCalledOnce();
    const [actors, lead] = tableau.mock.calls[0] as unknown as [Array<{ unit: string; at: { x: number; y: number } }>, string];
    expect(lead).toBe('lia');
    expect(actors.map(a => a.unit)).toEqual(expect.arrayContaining(['lia', 'kyra', 'flick', 'baris', 'orwen', 'algard', 'maedchen', 'schuetze']));
    expect(new Set(actors.map(a => `${a.at.x},${a.at.y}`)).size).toBe(actors.length);
    for (const a of actors) expect(ctx.battle.grid.standable(a.at.x, a.at.y)).toBe(true);
    expect(ctx.unit('flick')!.down).toBe('wounded');
    expect(plate).not.toHaveBeenCalled();
    expect(ctx.hasFlag('k5-urmacht')).toBe(false);
    release();
    await scene;
    expect(plate).toHaveBeenCalledWith('k5-urmacht', expect.any(Object));
    expect(ctx.hasFlag('k5-urmacht-exploded')).toBe(true);
    expect(ctx.hasFlag('k5-urmacht')).toBe(true);
    expect(G.state.is('k5-kyra-spaet-befreit')).toBe(true);
  });
});

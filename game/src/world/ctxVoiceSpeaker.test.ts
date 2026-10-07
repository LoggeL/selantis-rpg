import { beforeEach, describe, expect, it, vi } from 'vitest';
import { G } from '../core/G';
import { defineChapter } from '../core/registry';
import type { UiApi } from '../ui/api';
import type { WorldScene } from './WorldScene';
import { createCtx } from './ctx';

vi.mock('../core/G', () => ({ G: { ui: {}, currentScene: '' } }));

defineChapter({ id: 'teil-2', order: 6, numeral: 'II', title: 'Teil II', scenes: [
  { id: 'e2-aufbruch', title: 'Aufbruch', start() {} },
  { id: 'e2-kontrolle', title: 'Kontrolle', start() {} },
] });

beforeEach(() => {
  G.currentScene = 'e2-aufbruch';
  G.ui = {
    think: vi.fn().mockResolvedValue(undefined),
    choose: vi.fn().mockResolvedValue(0),
  } as unknown as UiApi;
});

function scene(speaker: string) {
  return { alive: true, player: { speaker }, pending: new Set(), openDialogs: 0 };
}

describe('world dialogue player identity', () => {
  it('voices thoughts with the actual current actor after a map switches Flick to Lia', async () => {
    const world = scene('e2-flick-gefangen');
    const ctx = createCtx(world as unknown as WorldScene);
    await ctx.think('Die Schnur ist dünn.');
    expect(G.ui.think).toHaveBeenLastCalledWith('Die Schnur ist dünn.', { speaker: 'e2-flick-gefangen' });
    world.player = { speaker: 'e2-lia-stab' };
    await ctx.think('Meine Beine sagen: Pause.');
    expect(G.ui.think).toHaveBeenLastCalledWith('Meine Beine sagen: Pause.', { speaker: 'e2-lia-stab' });
    expect(world.openDialogs).toBe(0);
    expect(world.pending.size).toBe(0);
  });

  it('voices selected responses with Elnon while preserving caller options', async () => {
    G.currentScene = 'e2-kontrolle';
    const world = scene('e2-elnon-gefangen');
    const ctx = createCtx(world as unknown as WorldScene);
    const opts = { prompt: 'Was versuchen?' };
    const options = ['„Der Ring hält.“'];
    await expect(ctx.choose(options, opts)).resolves.toBe(0);
    expect(G.ui.choose).toHaveBeenCalledWith(options, { prompt: 'Was versuchen?', speaker: 'e2-elnon-gefangen' });
    expect(opts).toEqual({ prompt: 'Was versuchen?' });
  });

  it('honors an explicit choice speaker instead of the player and reads a later player switch', async () => {
    const world = scene('e2-flick-gefangen');
    const ctx = createCtx(world as unknown as WorldScene);
    const options = ['„Ich gehe jetzt.“'];
    await ctx.choose(options, { speaker: 'kyra', prompt: 'Eine Antwort' });
    expect(G.ui.choose).toHaveBeenLastCalledWith(options, { speaker: 'kyra', prompt: 'Eine Antwort' });
    world.player = { speaker: 'e2-lia-stab' };
    await ctx.choose(options);
    expect(G.ui.choose).toHaveBeenLastCalledWith(options, { speaker: 'e2-lia-stab' });
  });

  it('preserves established bank routing outside registered Teil II scenes', async () => {
    const world = scene('valentus-cloak');
    const ctx = createCtx(world as unknown as WorldScene);
    G.currentScene = 'prolog-flucht';
    await ctx.think('Das Wasser hat meine Spur geschluckt.');
    expect(G.ui.think).toHaveBeenLastCalledWith('Das Wasser hat meine Spur geschluckt.');
    const options = ['„Ich danke euch.“'];
    await ctx.choose(options);
    expect(G.ui.choose).toHaveBeenLastCalledWith(options, undefined);
    G.currentScene = 'e2-unregistered';
    await ctx.think('Keine registrierte Teil-II-Szene.');
    expect(G.ui.think).toHaveBeenLastCalledWith('Keine registrierte Teil-II-Szene.');
  });
});

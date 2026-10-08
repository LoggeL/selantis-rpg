import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { G } from '../../core/G';
import { events } from '../../core/events';
import type { UiApi } from '../../ui/api';
import type { WorldCtx } from '../../world/api';

vi.mock('../../world', () => ({ defineMap: (map: unknown) => map, startWorld: vi.fn() }));
vi.mock('./book', () => ({ registerBookPlates: vi.fn() }));
import { ratMap } from './rat';
import { zufluchtMap } from './zuflucht';

const originalUi = G.ui, originalGoto = G.goto;
beforeEach(() => G.state.reset());
afterEach(() => { G.ui = originalUi; G.goto = originalGoto; G.state.reset(); });

function context(): WorldCtx {
  const actor = {
    exists: true, face: vi.fn(), hold: vi.fn(), hide: vi.fn(), show: vi.fn(), teleport: vi.fn(),
    walkPath: vi.fn(async () => {}), walkTo: vi.fn(async () => {}), play: vi.fn(async () => {}),
    emote: vi.fn(async () => {}),
  };
  G.ui = {
    wait: vi.fn(async () => {}), storyAction: vi.fn(async () => {}), scenePick: vi.fn(async () => ({ picks: [{ round: 0, id: 'still', ok: true }], mistakes: 0 })), prefetchPlate: vi.fn(),
    plate: vi.fn(async () => {}), say: vi.fn(async () => {}), closePlate: vi.fn(async () => {}),
    fade: vi.fn(async () => {}), narrate: vi.fn(async () => {}), caption: vi.fn(async () => {}), bubble: vi.fn(),
  } as unknown as UiApi;
  return {
    alive: false, actor: () => actor, player: actor,
    say: vi.fn(async () => {}), think: vi.fn(async () => {}), choose: vi.fn(async () => 0),
    cutscene: async (run: () => Promise<void>) => run(),
    setObjective: (id: string, text: string) => G.state.objective(id, text),
    completeObjective: (id: string) => G.state.complete(id),
    camera: { shake: vi.fn(), pan: vi.fn(async () => {}) }, fx: { burst: vi.fn() },
    lighting: { add: () => ({ fadeTo: vi.fn(async () => {}), remove: vi.fn() }) },
    scene: { time: { addEvent: () => ({ remove: vi.fn() }) } },
  } as unknown as WorldCtx;
}

describe('prologue objective progression', () => {
  it('finishes the council at 4/4, including the completion notification', async () => {
    const w = context();
    const completed = vi.fn();
    const off = events.on('objective:done', completed);
    try {
      G.state.objective('prolog-anhoeren', 'Höre die Ratsmitglieder an (0/4).');
      for (const id of ['ignatius', 'aelteste', 'hagere', 'wortfuehrer']) {
        await ratMap.npcs!.find(npc => npc.id === id)!.talk!(w, w.actor(id));
      }
      expect(G.state.data.objectives.find(o => o.id === 'prolog-anhoeren')).toMatchObject({ done: true, text: 'Höre die Ratsmitglieder an (4/4).' });
      expect(completed).toHaveBeenCalledWith({ id: 'prolog-anhoeren', text: 'Höre die Ratsmitglieder an (4/4).' });
      expect(G.state.activeObjective()?.id).toBe('prolog-abstimmen');
    } finally { off(); }
  });

  it('keeps both cradle interactions within reach from the automatic stand position', () => {
    const cradle = zufluchtMap.interactables!.find(i => i.id === 'wiege-ansehen')!;
    if (!Array.isArray(cradle.standAt) || !Array.isArray(cradle.at)) throw new Error('The cradle needs concrete map positions.');
    const distance = Math.hypot(cradle.standAt![0] - cradle.at![0], cradle.standAt![1] - cradle.at![1]);
    expect(distance).toBeLessThan(cradle.radius! - 2);
    expect(zufluchtMap.spawns!.wiege.at).toEqual(cradle.standAt);
  });

  it('closes the gift before handing the story over to Kapitel I', async () => {
    const w = context();
    G.state.objective('prolog-kinder', 'Sieh nach den Kindern.');
    const interact = zufluchtMap.interactables!.find(i => i.id === 'wiege-ansehen')!.onInteract!;
    await interact(w);
    expect(G.state.activeObjective()?.id).toBe('prolog-geschenk');
    G.goto = vi.fn(async () => {
      expect(G.state.is('prolog-geschenk')).toBe(true);
      expect(G.state.data.objectives.find(o => o.id === 'prolog-geschenk')?.done).toBe(true);
      expect(G.state.activeObjective()).toBeUndefined();
    });
    await interact(w);
    expect(G.ui.scenePick).toHaveBeenCalledWith(expect.objectContaining({ label: 'Wem gebe ich sie?' }));
    expect(G.goto).toHaveBeenCalledWith('wiese');
  });
});

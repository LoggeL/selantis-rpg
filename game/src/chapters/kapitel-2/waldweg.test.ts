import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { G } from '../../core/G';
import type { UiApi } from '../../ui/api';
import type { WorldCtx } from '../../world/api';

const { gotoNext } = vi.hoisted(() => ({ gotoNext: vi.fn(async () => {}) }));
vi.mock('../../world', () => ({ defineMap: (map: unknown) => map }));
vi.mock('./lager', () => ({ addCampfire: vi.fn(), LAGER_OCCLUDERS: [], LAGER_WALK: [], SPOT: { bed: [0, 0], ring: [0, 0] } }));
vi.mock('./shared', () => ({ bg: (p: Promise<unknown>) => { void p; }, gotoNext, sfx: vi.fn(), sleep: vi.fn(async () => {}) }));
vi.mock('../common/encounters', () => ({ forestEncounter: vi.fn(), playEncounter: vi.fn(), saveEncounterReturn: vi.fn() }));
import { lagerMorgen, waldweg } from './waldweg';

const originalUi = G.ui;
beforeEach(() => { G.state.reset(); gotoNext.mockClear(); });
afterEach(() => { G.ui = originalUi; G.state.reset(); });

function context(): WorldCtx {
  const actor = {
    exists: true, y: 274, face: vi.fn(), setIdle: vi.fn(), teleport: vi.fn(), hide: vi.fn(), show: vi.fn(),
    say: vi.fn(async () => {}), emote: vi.fn(async () => {}), walkTo: vi.fn(async () => {}),
  };
  G.ui = { fade: vi.fn(async () => {}), narrate: vi.fn(async () => {}) } as unknown as UiApi;
  return {
    alive: false, actor: () => actor, player: actor, companions: { ids: [], add: vi.fn(), remove: vi.fn() },
    choose: vi.fn(async () => 0), say: vi.fn(async () => {}), think: vi.fn(async () => {}), bark: vi.fn(),
    cutscene: async (run: () => Promise<void>) => run(),
    setObjective: (id: string, text: string) => G.state.objective(id, text),
    completeObjective: (id: string) => G.state.complete(id),
    setObjectiveTarget: vi.fn(),
    camera: { pan: vi.fn(async () => {}), zoom: vi.fn(async () => {}) },
  } as unknown as WorldCtx;
}

describe('Kapitel-II journey objectives', () => {
  it('finishes each leg and gives the stepping stones their own open goal', async () => {
    const w = context();
    G.state.objective('k2-osten', 'Folge der Straße nach Osten.');
    G.state.complete('k2-osten');
    G.state.objective('k2-morgen-essen', 'Frühstücke mit Azar.');
    await lagerMorgen.npcs!.find(n => n.id === 'azar')!.talk!(w, w.actor('azar'));
    expect(G.state.activeObjective()?.id).toBe('k2-aufbruch');
    await waldweg.onEnter!(w);
    expect(G.state.data.objectives.find(o => o.id === 'k2-aufbruch')?.done).toBe(true);
    expect(G.state.activeObjective()?.id).toBe('k2-waldweg');
    await waldweg.triggers!.find(t => t.id === 'rast')!.onEnter!(w);
    expect(G.state.data.objectives.find(o => o.id === 'k2-waldweg')?.done).toBe(true);
    await waldweg.interactables!.find(i => i.id === 'rastplatz')!.onInteract!(w);
    expect(G.state.activeObjective()).toMatchObject({ id: 'k2-trittsteine', done: false });
    expect(G.state.data.objectives.find(o => o.id === 'k2-osten')).toMatchObject({ done: true, text: 'Folge der Straße nach Osten.' });
    await waldweg.triggers!.find(t => t.id === 'osten')!.onEnter!(w);
    expect(G.state.is('k2-waldweg-fertig')).toBe(true);
    expect(G.state.activeObjective()).toBeUndefined();
    expect(gotoNext).toHaveBeenCalledWith('eber');
  });

  it('keeps the forest goal open when the east exit is attempted before the rest', async () => {
    const w = context();
    await waldweg.onEnter!(w);
    await waldweg.triggers!.find(t => t.id === 'osten')!.onEnter!(w);
    expect(G.state.activeObjective()?.id).toBe('k2-waldweg');
    expect(G.state.is('k2-waldweg-fertig')).toBe(false);
    expect(gotoNext).not.toHaveBeenCalled();
  });

  it('restores the current forest marker after resuming without reopening previous legs', async () => {
    const w = context();
    G.state.set('k2-waldweg-start');
    G.state.set('k2-rast-fertig');
    G.state.objective('k2-osten', 'Folge der Straße nach Osten.');
    G.state.complete('k2-osten');
    G.state.objective('k2-trittsteine', 'Weiter nach Osten, über die Trittsteine.');
    const before = structuredClone(G.state.data.objectives);
    await waldweg.onEnter!(w);
    expect(w.setObjectiveTarget).toHaveBeenCalledWith([1270, 274]);
    expect(G.state.data.objectives).toEqual(before);
    expect(G.state.activeObjective()?.id).toBe('k2-trittsteine');
  });
});

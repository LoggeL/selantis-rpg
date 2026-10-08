import { afterEach, describe, expect, it, vi } from 'vitest';
import { G } from '../../core/G';
import type { ActorHandle, At, BlockDef, MapDef, Polygon, StartWorldOptions, WalkArea, WorldCtx } from '../../world/api';
import type { UiApi } from '../../ui/api';
import { startWorld } from '../../world';
import { CollisionGrid } from '../../world/grid';
import { findPath } from '../../world/pathfind';
import { pointInPoly } from '../../world/poly';

// Load the actual scene/map data without starting Phaser or mounting the clue-board UI.
vi.mock('../../world', () => ({ defineMap: (def: MapDef) => def, startWorld: vi.fn() }));
vi.mock('../kapitel-3/panels', () => ({ openClueBoard: vi.fn() }));
import { eberAbend, scene, TAVERN_DOOR } from './taverne';
import { ROUTE_CLUES, sourcesFound } from './taverne-route';

const originalUi = G.ui;
afterEach(() => { G.state.reset(); G.ui = originalUi; vi.mocked(startWorld).mockClear(); });

const xy = (at: At | { anchor: string; prop?: string }): readonly [number, number] => {
  if (Array.isArray(at)) return [at[0], at[1]];
  if ('x' in at && 'y' in at) return [at.x, at.y];
  throw new Error('These tavern placements must use explicit map coordinates.');
};
const poly = (area: Polygon | WalkArea | BlockDef): Polygon => Array.isArray(area) ? area : (area as WalkArea | BlockDef).poly;
const free = (x: number, y: number) => (eberAbend.walk ?? []).some(p => pointInPoly(x, y, poly(p)))
  && !(eberAbend.block ?? []).some(p => pointInPoly(x, y, poly(p)));

describe('tavern departure marker (ST-005)', () => {
  it('keeps the complete click stopping radius inside the enabled departure trigger', () => {
    const exit = eberAbend.triggers!.find(t => t.id === 'ausgang')!;
    const blocked = eberAbend.triggers!.find(t => t.id === 'tuer-zu')!;
    expect(exit.poly).toEqual(blocked.poly);
    expect(exit.when?.()).toBe(false);
    G.state.set('e2-route-klar');
    expect(exit.when?.()).toBe(true);
    expect(blocked.when?.()).toBe(false);
    // Include a full 3 px circle, even though steering normally stops strictly below 3 px.
    for (let i = 0; i < 72; i++) {
      const a = i * Math.PI / 36;
      const x = TAVERN_DOOR[0] + Math.cos(a) * 3;
      const y = TAVERN_DOOR[1] + Math.sin(a) * 3;
      expect(pointInPoly(x, y, exit.poly!), `stopping angle ${i}`).toBe(true);
      expect(free(x, y)).toBe(true);
    }
  });

  it('finds a foot-box-safe mouse path from the reproduced stranded position into the exit', () => {
    const grid = new CollisionGrid(640, 360);
    for (let y = 2; y < 360; y += 4) for (let x = 2; x < 640; x += 4) {
      if (!free(x, y)) grid.blockRect(x - 2, y - 2, 4, 4);
    }
    const path = findPath(grid, { x: 283.5369, y: 333.0696 }, { x: TAVERN_DOOR[0], y: TAVERN_DOOR[1] }, { hw: 6, hh: 4 });
    expect(path?.length).toBeGreaterThan(0);
    const end = path!.at(-1)!;
    expect(pointInPoly(end.x, end.y, eberAbend.triggers!.find(t => t.id === 'ausgang')!.poly!)).toBe(true);
  });
});

describe('cameo furniture placement (ART-005)', () => {
  it('supports both guests at one seat height with matching wood and warm table lighting', () => {
    const guests = ['e2-logge', 'e2-sebastian'].map(id => eberAbend.npcs!.find(n => n.id === id)!);
    const stools = ['hocker-logge', 'hocker-sebastian'].map(id => eberAbend.props!.find(p => p.id === id)!);
    const table = eberAbend.props!.find(p => p.id === 'tisch-gaeste')!;
    expect(xy(guests[0].at)[1]).toBe(xy(guests[1].at)[1]);
    expect(xy(stools[0].at)[1]).toBe(xy(stools[1].at)[1]);
    for (let i = 0; i < 2; i++) {
      expect(xy(stools[i].at)[0]).toBe(xy(guests[i].at)[0]);
      expect(xy(stools[i].at)[1]).toBeLessThan(xy(guests[i].at)[1]);
      expect(stools[i].scale).toBe(table.scale);
      expect(stools[i].tint).toBe(table.tint);
    }
    const candle = eberAbend.props!.find(p => p.id === 'kerze-gaeste')!;
    expect(candle.light).toMatchObject({ kind: 'candle', always: true });
    expect(xy(candle.at)[1] + (candle.depthOffset ?? 0)).toBeGreaterThan(xy(table.at)[1]);
    const cat = eberAbend.props!.find(p => p.id === 'e2-logge-katze')!;
    expect(xy(cat.at)[1] + (cat.depthOffset ?? 0)).toBeGreaterThan(xy(table.at)[1]);
    const pet = eberAbend.interactables!.find(p => p.id === 'e2-logge-katze')!;
    const [cx, cy] = xy(cat.at), [px, py] = xy(pet.standAt!);
    expect(Math.hypot(cx - px, cy - py)).toBeLessThan(pet.radius!);
    expect(free(px, py)).toBe(true);
  });
});

describe('completed source objective (ST-019)', () => {
  it.each([
    ['craupor', ROUTE_CLUES.craupor],
    ['jaeger', ROUTE_CLUES.rinde],
    ['schankmaid', ROUTE_CLUES.eiche],
  ])('records 3/3 when %s supplies the last clue, preserving unrelated journal entries', async (npcId, lastClue) => {
    for (const clue of Object.values(ROUTE_CLUES)) if (clue !== lastClue) G.state.addClue(clue);
    G.state.give('cheese');
    G.state.objective('older-open', 'Ein anderes offenes Ziel.');
    G.state.objective('older-done', 'Ein bereits erledigtes Ziel.');
    G.state.complete('older-done');
    G.state.objective('e2-zugang', 'Finde heraus, wie man heute zum Lager der Bruderschaft kommt (2/3).');
    const unrelated = structuredClone(G.state.data.objectives.slice(0, 2));
    G.ui = { fade: vi.fn(async () => {}), chapterCard: vi.fn(async () => {}) } as unknown as UiApi;
    await scene.start();
    const script = (vi.mocked(startWorld).mock.calls.at(-1)![0] as StartWorldOptions).script!;
    const routeReady = new Error('The source objective has completed; route selection is outside this test.');
    const actor = {
      hold: vi.fn(), face: vi.fn(), teleport: vi.fn(), setIdle: vi.fn(),
      emote: vi.fn(async () => {}), walkTo: vi.fn(async () => {}), say: vi.fn(async () => {}),
    } as unknown as ActorHandle;
    let world: WorldCtx;
    const setObjective = vi.fn((id: string, text: string) => {
      G.state.objective(id, text);
      if (id === 'e2-weg') throw routeReady;
    });
    const completeObjective = vi.fn((id: string) => G.state.complete(id));
    const lastSource = eberAbend.npcs!.find(n => n.id === npcId)!;
    let lastSourceCalled = false;
    world = {
      player: actor, actor: () => actor, companions: { add: vi.fn() },
      cutscene: async (fn: () => Promise<unknown>) => fn(),
      narrate: vi.fn(async () => {}), say: vi.fn(async () => {}), think: vi.fn(async () => {}),
      choose: vi.fn(async () => 0), bark: vi.fn(), setObjective, completeObjective,
      wait: async (ms: number) => {
        if (ms === 200 && G.state.is('e2-taverne-intro') && !lastSourceCalled) {
          lastSourceCalled = true;
          await lastSource.talk!(world, actor);
        }
      },
    } as unknown as WorldCtx;
    await expect(script(world)).rejects.toBe(routeReady);
    expect(lastSourceCalled).toBe(true);
    expect(sourcesFound(G.state.data.clues)).toBe(3);
    expect(G.state.data.objectives.find(o => o.id === 'e2-zugang')).toMatchObject({
      id: 'e2-zugang', text: 'Finde heraus, wie man heute zum Lager der Bruderschaft kommt (3/3).', done: true,
    });
    const finalUpdate = setObjective.mock.calls.findIndex(([id, text]) => id === 'e2-zugang' && text.includes('(3/3)'));
    expect(finalUpdate).toBeGreaterThan(-1);
    expect(setObjective.mock.invocationCallOrder[finalUpdate]).toBeLessThan(completeObjective.mock.invocationCallOrder[0]);
    expect(G.state.data.objectives.slice(0, 2)).toEqual(unrelated);
  });
});

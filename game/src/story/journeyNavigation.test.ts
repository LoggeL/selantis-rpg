import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));
vi.mock('../audio', () => ({ setSceneMusic: vi.fn(), sfx: { select: vi.fn() } }));
import { JourneyScene } from '../scenes/JourneyScene';
import { ROAD_EAST_AREA } from './areas/journey';
import { clearWalkingLine, findWalkingPath, inPoly } from '../world/navigation';
import type { Pt } from './types';

const walkable = (x: number, y: number) => {
  const ok = (px: number, py: number) => ROAD_EAST_AREA.walk.some(poly => inPoly(px, py, poly));
  return ok(x, y) && ok(x - 5, y) && ok(x + 5, y) && ok(x, y - 3);
};

afterEach(() => vi.unstubAllGlobals());

describe('painted road north trail', () => {
  it('admits full-width feet along the painted trail without opening the adjacent fields', () => {
    for (const point of [[414, 14], [401, 38], [390, 70], [390, 105], [385, 135], [372, 162], [370, 185]] as Pt[]) {
      expect(walkable(...point), `trail feet at ${point}`).toBe(true);
    }
    for (const point of [[330, 70], [440, 100], [350, 110], [420, 145]] as Pt[]) {
      expect(walkable(...point), `field feet at ${point}`).toBe(false);
    }
  });

  it('connects north arrival, every road objective and the north return with collision-safe segments', () => {
    const origins = [ROAD_EAST_AREA.start, ...ROAD_EAST_AREA.targets.map(target => target.at)];
    for (const origin of origins) {
      expect(walkable(...origin)).toBe(true);
      for (const target of ROAD_EAST_AREA.targets) {
        const route = findWalkingPath(origin, target.at, walkable, 0);
        expect(route.length, `${origin} to ${target.id}`).toBeGreaterThan(0);
        let previous = origin;
        for (const next of route) {
          expect(clearWalkingLine(previous, next, walkable), `${previous} to ${next}`).toBe(true);
          previous = next;
        }
        expect(previous).toEqual(target.at);
      }
    }
  });
});

describe('road return state', () => {
  function road(flags: Record<string, boolean> = {}) {
    const scene: any = new JourneyScene();
    const world = { inv: {}, picked: {}, flags };
    scene.registry = { get: () => world };
    scene.data = { set: vi.fn() };
    scene.scene = { start: vi.fn() };
    scene.setObjective = vi.fn(); scene.setSpots = vi.fn(); scene.say = vi.fn(); scene.enterCamp = vi.fn();
    scene.roadSpots();
    return { scene, world, spots: scene.setSpots.mock.calls.at(-1)[0] as any[] };
  }

  it('lets Lia return before drinking or choosing east and retains inventory and progress', () => {
    const { scene, world, spots } = road({ streamVisited: true, journeyEastChosen: true });
    world.inv = { proviant: 1, kupfer: 22 };
    const before = structuredClone(world);
    const back = spots.find(spot => spot.id === 'farm-return');
    expect(back.enabled()).toBe(true);
    back.onUse();
    expect(scene.scene.start).toHaveBeenCalledWith('world', { map: 'felder', from: 'journey' });
    expect(world).toEqual(before);
    expect(road().spots.find(spot => spot.id === 'farm-return').enabled()).toBe(true);
    expect(road().spots.find(spot => spot.id === 'east').enabled()).toBe(false);
  });

  it('returns from fields onto the road even when a camp resume flag already exists', () => {
    vi.stubGlobal('window', { location: { search: '' } });
    const { scene } = road({ journeyCampReached: true, streamVisited: true, journeyEastChosen: true });
    scene.input = { on: vi.fn(), off: vi.fn() }; scene.events = { once: vi.fn() };
    scene.begin = vi.fn(); scene.setupCamp = vi.fn(); scene.passingTravelers = vi.fn();
    scene.create({ from: 'felder' });
    expect(scene.begin).toHaveBeenCalledWith(ROAD_EAST_AREA);
    expect(scene.setupCamp).not.toHaveBeenCalled();
    expect(scene.setObjective).toHaveBeenLastCalledWith('Nach Osten bis zum Wald gehen.');
  });
});

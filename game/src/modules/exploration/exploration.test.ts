import { describe, expect, it } from 'vitest';
import { MAPS } from "../../content/maps/index";
import { clearWalkingLine, isMapWalkable, NavigationContext, type Pt } from "./navigation";
import { accumulateStuckTime, directionTo, resolveWalkingStep } from "./movement";
import { advanceWalkingRoute, findInteractionPath } from "./route";

const rectangle = (left: number, top: number, right: number, bottom: number): Pt[] => [[left, top], [right, top], [right, bottom], [left, bottom]];

describe('reusable navigation contexts', () => {
  it('routes outside the original 640 by 360 stage with configured cell size and origin', () => {
    const surface = { walk: [rectangle(100, 200, 1300, 800)], block: [rectangle(780, 200, 840, 640)] };
    const walkable = (x: number, y: number) => isMapWalkable(surface, x, y);
    const context = new NavigationContext(walkable, { width: 1200, height: 600, cellSize: 12, origin: [100, 200] });
    const from: Pt = [700, 500], goal: Pt = [1100, 500];
    expect(clearWalkingLine(from, goal, walkable)).toBe(false);
    const path = context.findPath(from, goal);
    expect(path.length).toBeGreaterThan(1);
    expect(path.at(-1)).toEqual(goal);
    let last = from;
    for (const point of path) { expect(clearWalkingLine(last, point, walkable)).toBe(true); last = point; }
  });

  it('reuses only static lattice data and preserves the exact paths of uncached polygon queries', () => {
    const map = MAPS.felder, walkable = (x: number, y: number) => isMapWalkable(map, x, y);
    const cached = new NavigationContext(walkable), dynamic = new NavigationContext(walkable, { cacheStatic: false });
    const lattice = cached.validPoints();
    expect(cached.validPoints()).toBe(lattice);
    expect(dynamic.validPoints()).not.toBe(dynamic.validPoints());
    for (const from of [map.start, ...Object.values(map.entries).map(entry => entry.at)]) {
      for (const goal of map.props.map(prop => prop.at)) expect(cached.findPath(from, goal)).toEqual(dynamic.findPath(from, goal));
    }
    // Endpoints and long segments still use exact foot/polygon checks rather than cell rounding.
    expect(cached.walkable(300, 215)).toBe(walkable(300, 215));
  });

  it('finds an interaction approach on the reachable side of a disconnected circle', () => {
    const context = new NavigationContext((x, y) => x >= 0 && x < 80 && y > 0 && y < 100 || x > 100 && x < 200 && y > 0 && y < 100,
      { width: 200, height: 100 });
    const from: Pt = [20, 50], target: Pt = [105, 50];
    expect(context.findPath(from, target, 35)).toEqual([]);
    const path = findInteractionPath(context, from, target, 35);
    expect(path.length).toBeGreaterThan(0);
    expect(path.at(-1)![0]).toBeLessThan(80);
    expect(Math.hypot(path.at(-1)![0] - target[0], path.at(-1)![1] - target[1])).toBeLessThanOrEqual(35);
  });

  it('rejects malformed bounds rather than allocating an invalid lattice', () => {
    expect(() => new NavigationContext(() => true, { cellSize: 0 })).toThrow();
    expect(() => new NavigationContext(() => true, { width: Infinity })).toThrow();
  });
});

describe('movement and route arrival policies', () => {
  it('normalizes diagonals, caps frame time and stops at a route destination', () => {
    const result = resolveWalkingStep({ x: 10, y: 10 }, { x: 1, y: 1 }, 72, 500, () => true, {}, { x: 11, y: 11 });
    expect(result.x).toBe(11); expect(result.y).toBe(11);
    expect(result.moved).toBeCloseTo(Math.SQRT2);
    expect(resolveWalkingStep({ x: 0, y: 0 }, { x: 1, y: 0 }, 72, 500, () => true).step).toBe(3.6);
  });

  it('preserves scene-specific corner sliding and prevents routed story movement tunneling', () => {
    const wall = (x: number, y: number) => x <= 1 || y <= 1;
    const keyboard = resolveWalkingStep({ x: 1, y: 1 }, { x: 1, y: 1 }, 72, 50, wall, { collision: 'segment' });
    expect(keyboard.x).toBeGreaterThan(1); expect(keyboard.y).toBe(1);
    const routed = resolveWalkingStep({ x: 1, y: 1 }, { x: 1, y: 1 }, 72, 50, wall, { collision: 'segment', slide: false });
    expect(routed.moved).toBe(0);
    const thinBlocker = (x: number) => x < 1 || x > 2;
    expect(resolveWalkingStep({ x: 0, y: 0 }, { x: 1, y: 0 }, 72, 50, thinBlocker, { collision: 'segment', slide: false }).moved).toBe(0);
  });

  it('retains the meadow horizontal diagonal facing policy and world/story vertical policy', () => {
    const from = { x: 0, y: 0 }, input = { x: 1, y: 1 };
    expect(resolveWalkingStep(from, input, 72, 16, () => true).facing).toBe('s');
    expect(resolveWalkingStep(from, input, 72, 16, () => true, { horizontalTie: true }).facing).toBe('e');
  });

  it('advances immutable route heads and keeps stuck timing separate from scene interaction', () => {
    const path: Pt[] = [[10, 10], [20, 20]];
    expect(advanceWalkingRoute(path)).toEqual({ destination: [10, 10], remaining: [[20, 20]] });
    expect(path).toHaveLength(2);
    expect(advanceWalkingRoute([])).toEqual({ destination: undefined, remaining: [] });
    expect(directionTo({ x: 10, y: 10 }, { x: 11, y: 10 }, 2)).toBeUndefined();
    expect(accumulateStuckTime(200, 0, 3.6, 50, 0.3)).toBe(250);
    expect(accumulateStuckTime(200, 3.6, 3.6, 50, 0.3)).toBe(0);
  });
});

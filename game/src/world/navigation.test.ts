import { describe, expect, it } from 'vitest';
import { MAPS, type Pt } from './maps';
import { clearWalkingLine, findWalkingPath, isMapWalkable } from './navigation';

describe('Weltwege', () => {
  it('erreicht jeden Kartenausgang vom Start ohne durch Blocker zu laufen', () => {
    for (const map of Object.values(MAPS)) {
      const canWalk = (x: number, y: number) => isMapWalkable(map, x, y);
      for (const exit of map.exits) {
        const [x, y, width, height] = exit.rect;
        const endpoints: Pt[] = [];
        for (let px = x; px <= x + width; px += 1) {
          for (let py = y; py <= y + height; py += 1) if (canWalk(px, py)) endpoints.push([px, py]);
        }
        const goal = endpoints[Math.floor(endpoints.length / 2)];
        expect(goal, `${map.id} → ${exit.to}: begehbarer Ausgang`).toBeDefined();
        const route = findWalkingPath(map.start, goal, canWalk);
        expect(route.length, `${map.id} → ${exit.to}: zusammenhängender Weg`).toBeGreaterThan(0);
        let last = map.start;
        for (const point of route) { expect(clearWalkingLine(last, point, canWalk)).toBe(true); last = point; }
      }
    }
  });

  it('setzt jede Rückkehr auf einen begehbaren Punkt außerhalb des Ausgangs', () => {
    for (const map of Object.values(MAPS)) {
      for (const exit of map.exits) {
        const target = MAPS[exit.to], entry = target.entries[map.id];
        expect(entry, `${map.id} → ${exit.to}: Ankunft`).toBeDefined();
        expect(isMapWalkable(target, ...entry.at), `${exit.to}: ${entry.at}`).toBe(true);
        const returnExit = target.exits.find(e => e.to === map.id)!;
        const [x, y, width, height] = returnExit.rect;
        expect(entry.at[0] >= x && entry.at[0] <= x + width && entry.at[1] >= y && entry.at[1] <= y + height).toBe(false);
      }
    }
  });

  it('umgeht eine Bank und lehnt einen vollständig versperrten Weg ab', () => {
    const map = MAPS.felder, canWalk = (x: number, y: number) => isMapWalkable(map, x, y);
    const from: Pt = [250, 218], goal: Pt = [350, 218];
    expect(clearWalkingLine(from, goal, canWalk)).toBe(false);
    const route = findWalkingPath(from, goal, canWalk);
    expect(route.length).toBeGreaterThan(1);
    expect(route.at(-1)).toEqual(goal);
    expect(findWalkingPath([20, 100], [100, 100], (x, y) => y > 90 && y < 110 && (x < 40 || x > 80))).toEqual([]);
  });

  it('erreicht den Kartenrand auch bei einem Klick knapp außerhalb der Fußbreite', () => {
    const map = MAPS.wiese;
    const route = findWalkingPath(map.start, [635, 118], (x, y) => isMapWalkable(map, x, y));
    expect(route.at(-1)![0]).toBeGreaterThanOrEqual(632);
    expect(route.at(-1)![1]).toBeGreaterThanOrEqual(100);
    expect(route.at(-1)![1]).toBeLessThanOrEqual(136);
  });
});

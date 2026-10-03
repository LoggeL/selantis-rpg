import { describe, expect, it } from 'vitest';
import { clearWalkingLine, findWalkingPath, inPoly } from '../world/navigation';
import { RAID_APPROACH_AREA, RAID_AREA } from './areas/raid';
import { FARM_DAWN_AREA, FARM_INTERIOR_AREA } from './areas/aftermath';
import { FIRST_CAMP_AREA, ROAD_EAST_AREA } from './areas/journey';
import type { Pt, StoryArea, StoryTarget } from './types';

const AREAS = [RAID_APPROACH_AREA, RAID_AREA, FARM_DAWN_AREA, FARM_INTERIOR_AREA, ROAD_EAST_AREA, FIRST_CAMP_AREA];

/** StoryScene.walkable uses exactly these four foot samples. */
function feetWalkable(area: StoryArea) {
  const ok = (x: number, y: number) => area.walk.some(poly => inPoly(x, y, poly)) && !area.block.some(poly => inPoly(x, y, poly));
  return (x: number, y: number) => ok(x, y) && ok(x - 5, y) && ok(x + 5, y) && ok(x, y - 3);
}

const distance = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Match StoryScene.onPointerDown, including its disconnected-circle fallback. */
function clickPath(area: StoryArea, from: Pt, target: StoryTarget): Pt[] {
  const walkable = feetWalkable(area);
  if (distance(from, target.at) <= target.radius) return [from];
  let path = findWalkingPath(from, target.at, walkable, target.radius);
  if (path.length && distance(path.at(-1)!, target.at) <= target.radius) return path;
  const toward = Math.atan2(from[1] - target.at[1], from[0] - target.at[0]);
  for (const radius of [target.radius * 0.85, target.radius * 0.55, target.radius * 0.25]) {
    for (let i = 0; i < 32; i++) {
      const angle = toward + i * Math.PI / 16;
      const approach: Pt = [target.at[0] + Math.cos(angle) * radius, target.at[1] + Math.sin(angle) * radius];
      if (!walkable(...approach)) continue;
      path = findWalkingPath(from, approach, walkable, 0);
      if (path.length) return path;
    }
  }
  return [];
}

/** Stop at inRange, using normal frames and the runtime's 50ms delta cap. */
function arrival(area: StoryArea, from: Pt, target: StoryTarget, dtMs = 50): Pt {
  const walkable = feetWalkable(area), path = clickPath(area, from, target);
  expect(walkable(...from), `${area.id}: Ursprung ${from}`).toBe(true);
  expect(path.length, `${area.id}: ${from} → ${target.id}`).toBeGreaterThan(0);
  let point: Pt = [...from];
  // Verify every planned segment as well as the physical movement to arrival.
  let last = from;
  for (const next of path) {
    expect(walkable(...next), `${target.id}: Wegpunkt ${next}`).toBe(true);
    expect(clearWalkingLine(last, next, walkable), `${target.id}: ${last} → ${next}`).toBe(true);
    last = next;
  }
  for (const destination of path) {
    for (let frame = 0; frame < 1000; frame++) {
      if (distance(point, target.at) <= target.radius) {
        expect(walkable(...point), `${target.id}: Fußpunkt bei der Interaktion`).toBe(true);
        return point;
      }
      const length = distance(point, destination);
      if (length < 1) {
        expect(clearWalkingLine(point, destination, walkable), `${target.id}: letzter Schritt zum Wegpunkt`).toBe(true);
        point = [...destination];
        break;
      }
      const step = Math.min(72 * dtMs / 1000, length);
      const next: Pt = [point[0] + (destination[0] - point[0]) / length * step, point[1] + (destination[1] - point[1]) / length * step];
      expect(clearWalkingLine(point, next, walkable), `${area.id}: ${from} → ${target.id}, Weg ${JSON.stringify(path)}, Bewegung ${point} → ${next}`).toBe(true);
      point = next;
    }
  }
  expect(distance(point, target.at), `${area.id}: tatsächliche Interaktionsreichweite ${target.id}`).toBeLessThanOrEqual(target.radius);
  return point;
}

/** Unlock/reset points hard-coded in RaidScene, AftermathScene and JourneyScene. */
const phaseEntries: Record<string, [string, Pt][]> = {
  'raid-farm': [['nach Abzug der Reiter', [104, 185]]],
  'farm-dawn': [['aus dem Haus', [273, 198]]],
  'first-camp': [
    ['nach dem Aufwachen', [225, 265]],
    ['gefesselt am Stamm', [470, 190]],
    ['nach dem Lösen der Fesseln', [454, 210]],
  ],
};

describe.each(AREAS)('Geschichtsziele auf $id', area => {
  it('hat einen begehbaren Start und eindeutige Ziel-IDs', () => {
    expect(feetWalkable(area)(...area.start)).toBe(true);
    expect(area.targets.length).toBeGreaterThan(0);
    expect(new Set(area.targets.map(target => target.id)).size).toBe(area.targets.length);
  });

  it.each(area.targets.flatMap(target => [16, 50].map(dtMs => ({ id: target.id, target, dtMs }))))('erreicht $id mit $dtMs ms ab Start, allen anderen Zielankünften und Phasenwechseln', ({ target: destination, dtMs }) => {
    // The controller stops at the first point inside the radius, often before
    // reaching the target center. Use those actual endpoints as next origins.
    const origins: [string, Pt][] = [
      ['Start', area.start],
      ...area.targets.map(source => [`nach ${source.id}`, arrival(area, area.start, source, dtMs)] as [string, Pt]),
      ...(phaseEntries[area.id] ?? []),
    ];
    for (const [label, from] of origins) {
      const end = arrival(area, from, destination, dtMs);
      expect(distance(end, destination.at), `${area.id}: ${label} → ${destination.id}`).toBeLessThanOrEqual(destination.radius);
    }
  });
});

describe('Erreichbarkeit der Geschichtsphasen', () => {
  it('beschränkt Lia vor dem Abzug auf die Deckung und öffnet danach den Weg zu den Eltern', () => {
    expect(RAID_APPROACH_AREA.targets.map(target => target.id)).toEqual(['hide']);
    expect(feetWalkable(RAID_APPROACH_AREA)(...RAID_AREA.targets.find(target => target.id === 'parents')!.at)).toBe(false);
    const hide = RAID_APPROACH_AREA.targets[0];
    arrival(RAID_APPROACH_AREA, RAID_APPROACH_AREA.start, hide);
    const parents = RAID_AREA.targets.find(target => target.id === 'parents')!;
    arrival(RAID_AREA, [104, 185], parents);
  });

  it('geht vom Verbinden der Ferse über Kleidung und Vorräte zum Hof und zur Straße', () => {
    const byId = (area: StoryArea, id: string) => area.targets.find(target => target.id === id)!;
    let point = FARM_INTERIOR_AREA.start;
    for (const id of ['medicine', 'clothing', 'food', 'water', 'cupboard', 'books', 'exit-door']) {
      point = arrival(FARM_INTERIOR_AREA, point, byId(FARM_INTERIOR_AREA, id));
    }
    point = [273, 198];
    for (const id of ['pig-gate', 'east-departure']) point = arrival(FARM_DAWN_AREA, point, byId(FARM_DAWN_AREA, id));
  });

  it('erreicht die Straßenziele und alle nacheinander freigeschalteten Lagerziele', () => {
    const byId = (area: StoryArea, id: string) => area.targets.find(target => target.id === id)!;
    let point = ROAD_EAST_AREA.start;
    for (const id of ['stream', 'fork', 'east']) point = arrival(ROAD_EAST_AREA, point, byId(ROAD_EAST_AREA, id));
    point = FIRST_CAMP_AREA.start;
    // Cloak, twigs, fire, meal, foot, sleep; wake-up restores Lia to bedroll.
    for (const id of ['bedroll', 'twigs', 'fire', 'fire', 'bedroll', 'bedroll']) point = arrival(FIRST_CAMP_AREA, point, byId(FIRST_CAMP_AREA, id));
    point = arrival(FIRST_CAMP_AREA, [225, 265], byId(FIRST_CAMP_AREA, 'road'));
    // Capture places Lia inside the trunk target, so its seven dialogue uses
    // remain possible while locked. Releasing the ropes then unlocks the star.
    expect(distance([470, 190], byId(FIRST_CAMP_AREA, 'trunk').at)).toBeLessThanOrEqual(byId(FIRST_CAMP_AREA, 'trunk').radius);
    arrival(FIRST_CAMP_AREA, [454, 210], byId(FIRST_CAMP_AREA, 'star'));
    expect(feetWalkable(FIRST_CAMP_AREA)(...point)).toBe(true);
  });
});

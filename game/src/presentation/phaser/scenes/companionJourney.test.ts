import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));
vi.mock("../../../app/audio", () => ({ setSceneMusic: vi.fn(), sfx: {} }));
import { CompanionJourneyScene } from "./CompanionJourneyScene";
import { COMPANION_AFTERNOON_AREA, COMPANION_MORNING_AREA } from "../../../content/areas/companionJourney";
import { MIDDAY_REST_LINES, companionFeetWalkable, companionPhase } from "../../../app/companions";
import { clearWalkingLine, findWalkingPath } from "../../../modules/exploration/navigation";
import type { Pt, StoryArea } from "../../../modules/narrative/types";
import { StoryScene } from "../StoryScene";

afterEach(() => vi.restoreAllMocks());

function walkingActor(x: number, y: number) {
  const actor: any = {
    x, y, active: true,
    anims: { currentAnim: undefined, stop: vi.fn() },
    setPosition(nx: number, ny: number) { this.x = nx; this.y = ny; return this; },
    setAngle: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(),
  };
  actor.play = vi.fn((key: string) => { actor.anims.currentAnim = { key }; return actor; });
  return actor;
}

function walkingFixture(area: StoryArea = COMPANION_MORNING_AREA) {
  vi.spyOn(StoryScene.prototype, 'update').mockImplementation(() => {});
  const scene: any = new CompanionJourneyScene();
  Object.defineProperty(scene, 'areaCurrent', { get: () => area });
  scene.anims = { exists: () => true };
  scene.areaRoot = { sort: vi.fn() };
  scene.lia = walkingActor(...area.start);
  scene.foltan = walkingActor(area.start[0] + 22, area.start[1]);
  scene.azar = walkingActor(area.start[0] - 14, area.start[1]);
  scene.previousLia = area.start;
  scene.trail = [[scene.azar.x, scene.azar.y], area.start];
  return scene;
}

describe('companion forest feet', () => {
  it.each([COMPANION_MORNING_AREA, COMPANION_AFTERNOON_AREA])('keeps both companions with Lia through all bends in $id', area => {
    const scene = walkingFixture(area);
    const walkable = (x: number, y: number) => companionFeetWalkable(area, x, y);
    const end = area.targets.find(target => target.id === 'continue' || target.id === 'evening')!.at;
    const path = findWalkingPath(area.start, end, walkable, 0);
    for (const waypoint of path) {
      while (Math.hypot(waypoint[0] - scene.lia.x, waypoint[1] - scene.lia.y) > 0.01) {
        const distance = Math.hypot(waypoint[0] - scene.lia.x, waypoint[1] - scene.lia.y), step = Math.min(distance, 1.2);
        scene.lia.setPosition(scene.lia.x + (waypoint[0] - scene.lia.x) / distance * step, scene.lia.y + (waypoint[1] - scene.lia.y) / distance * step);
        scene.update(0, 1000 / 60);
        for (const companion of [scene.foltan, scene.azar]) {
          expect(walkable(companion.x, companion.y)).toBe(true);
          expect(Math.hypot(companion.x - scene.lia.x, companion.y - scene.lia.y)).toBeLessThan(60);
        }
      }
    }
  });

  it('animates actual displacement, allows catchup, then stays idle facing the last travel direction', () => {
    const scene = walkingFixture();
    scene.lia.setPosition(175, 220);
    scene.previousLia = [177, 220];
    scene.foltan.setPosition(165, 220);
    scene.azar.setPosition(185, 220);
    scene.trail = [[185, 220], [175, 220]];
    scene.update(0, 50);
    expect(scene.foltan.play).toHaveBeenLastCalledWith('foltan-walk-w', true);
    expect(scene.azar.play).toHaveBeenLastCalledWith('azar-idle-e', true);
    const initialFoltanX = scene.foltan.x;
    scene.update(50, 50);
    expect(scene.foltan.x).toBeLessThan(initialFoltanX);
    for (let i = 0; i < 30; i++) scene.update(100 + i * 50, 50);
    expect(scene.foltan.x).toBeCloseTo(150);
    expect(scene.foltan.play).toHaveBeenLastCalledWith('foltan-idle-w', true);
    expect(scene.foltan.anims.stop).toHaveBeenCalled();
    const settledX = scene.foltan.x;
    for (let i = 0; i < 20; i++) scene.update(2000 + i * 50, 50);
    expect(scene.foltan.x).toBe(settledX);
    expect(scene.foltan.setAngle).toHaveBeenLastCalledWith(0);
  });

  it('faces the dominant actual movement and stops both walking cycles during a conversation', () => {
    const scene = walkingFixture();
    scene.foltan.setPosition(190, 221);
    scene.animateTraveler(scene.foltan, 'foltan', [190, 223]);
    expect(scene.foltan.play).toHaveBeenLastCalledWith('foltan-walk-n', true);
    scene.azar.setPosition(180, 225);
    scene.animateTraveler(scene.azar, 'azar', [180, 222]);
    expect(scene.azar.play).toHaveBeenLastCalledWith('azar-walk-s', true);
    scene.talking = true;
    scene.update(0, 50);
    expect(scene.foltan.play).toHaveBeenLastCalledWith('foltan-idle-n', true);
    expect(scene.azar.play).toHaveBeenLastCalledWith('azar-idle-s', true);
    expect(scene.foltan.anims.stop).toHaveBeenCalled();
    expect(scene.azar.anims.stop).toHaveBeenCalled();
  });
  it.each([COMPANION_MORNING_AREA, COMPANION_AFTERNOON_AREA])('connects every target in $id along the painted path', area => {
    const walkable = (x: number, y: number) => companionFeetWalkable(area, x, y);
    for (const origin of [area.start, ...area.targets.map(target => target.at)]) {
      expect(walkable(...origin), `${area.id} feet ${origin}`).toBe(true);
      for (const target of area.targets) {
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
    expect(walkable(310, 100)).toBe(false);
    expect(walkable(310, 290)).toBe(false);
  });
});

function sceneFixture(flags: Record<string, boolean> = {}) {
  const scene: any = new CompanionJourneyScene();
  const st = { inv: { proviant: 1, wasserschlauch: 1, kupfer: 22 }, picked: { flower: true as const }, flags };
  scene.registry = { get: () => st }; scene.data = { set: vi.fn() };
  let area: StoryArea = COMPANION_MORNING_AREA;
  Object.defineProperty(scene, 'areaCurrent', { get: () => area });
  scene.changeArea = vi.fn((next: StoryArea) => { area = next; });
  for (const method of ['setObjective', 'setSpots', 'setLocked', 'setCloseupText', 'hideCloseup', 'say', 'goTo', 'setupTravelers']) scene[method] = vi.fn();
  let continuation = () => {};
  scene.setCloseupContinue = vi.fn((next: () => void) => { continuation = next; });
  scene.foltan = walkingActor(350, 210); scene.azar = walkingActor(270, 224);
  scene.anims = { exists: () => true }; scene.areaRoot = { sort: vi.fn() };
  scene.lia = { x: 320, y: 214 };
  return { scene, st, next: () => continuation() };
}

describe('the next day preserves the journey', () => {
  it('requires the complete noon conversation before continuing and changes no supplies or previous flags', () => {
    const { scene, st, next } = sceneFixture({ departureReady: true, metFoltanAzar: true, criosObserved: true, farewellParentsComplete: true });
    const before = structuredClone(st);
    scene.useTravelSpot('continue');
    expect(scene.changeArea).not.toHaveBeenCalled();
    scene.useTravelSpot('rest');
    expect(scene.setLocked).toHaveBeenCalledWith(true);
    expect(st.flags.companionRestTaken).toBeUndefined();
    for (let i = 0; i < MIDDAY_REST_LINES.length - 1; i++) next();
    expect(st.flags.companionRestTaken).toBeUndefined();
    next();
    expect(st.flags.companionRestTaken).toBe(true);
    expect(scene.setLocked).toHaveBeenLastCalledWith(false);
    expect(st.inv).toEqual(before.inv); expect(st.picked).toEqual(before.picked);
    expect(st.flags).toMatchObject(before.flags);
    scene.useTravelSpot('continue');
    expect(scene.changeArea).toHaveBeenCalledWith(COMPANION_AFTERNOON_AREA);
    expect(scene.phase).toBe('afternoon');
  });

  it('keeps return routes usable and does not repeat the completed rest', () => {
    const { scene, st } = sceneFixture({ companionRestTaken: true });
    scene.useTravelSpot('rest');
    expect(scene.setCloseupText).not.toHaveBeenCalled();
    scene.useTravelSpot('rest-return');
    expect(scene.changeArea.mock.calls[0][0]).toMatchObject({ id: 'companion-morning', start: [586, 159] });
    expect(companionFeetWalkable(COMPANION_MORNING_AREA, 586, 159)).toBe(true);
    scene.useTravelSpot('camp-return');
    expect(scene.goTo).toHaveBeenCalledWith('journey');
    expect(st.flags.companionRestTaken).toBe(true);
  });

  it('finishes the readable evening travel before handing off to the inn and preserves the campaign', () => {
    const { scene, st, next } = sceneFixture({ companionRestTaken: true, metFoltanAzar: true, criosObserved: true });
    const before = structuredClone(st);
    expect(companionPhase(st)).toBe('afternoon');
    scene.useTravelSpot('evening');
    expect(scene.setLocked).toHaveBeenCalledWith(true);
    expect(scene.setCloseupText).toHaveBeenCalledTimes(1);
    expect(st.flags.companionDayComplete).toBeUndefined();
    expect(scene.goTo).not.toHaveBeenCalled();
    next();
    expect(scene.setCloseupText).toHaveBeenCalledTimes(2);
    expect(st.flags.companionDayComplete).toBeUndefined();
    expect(scene.goTo).not.toHaveBeenCalled();
    next();
    expect(companionPhase(st)).toBe('evening');
    expect(scene.goTo).toHaveBeenCalledExactlyOnceWith('golden-boar');
    expect(scene.hideCloseup).toHaveBeenCalledOnce();
    expect(st.inv).toEqual(before.inv); expect(st.picked).toEqual(before.picked);
    expect(st.flags).toEqual({ ...before.flags, companionDayComplete: true });
    next(); next();
    expect(scene.goTo).toHaveBeenCalledOnce();
    expect(st.flags).toEqual({ ...before.flags, companionDayComplete: true });
  });

  it('keeps breakfast a remembered shared meal rather than a second inventory grant', () => {
    const { scene, st } = sceneFixture();
    const before = structuredClone(st.inv);
    scene.useTravelSpot('breakfast'); scene.useTravelSpot('breakfast');
    expect(st.flags.companionBreakfastRemembered).toBe(true);
    expect(st.inv).toEqual(before);
  });
});

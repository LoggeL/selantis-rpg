import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../audio', () => ({ sfx: { select: vi.fn() } }));
import { eastwardTravelGate, mapForTravel, travelObjective, FIELD_RETURN } from './travel';
import { MAPS, type Pt } from '../world/maps';
import { clearWalkingLine, findWalkingPath, isMapWalkable } from '../world/navigation';
import { WorldScene } from '../scenes/WorldScene';
import { AftermathScene } from '../scenes/AftermathScene';
import type { WorldState } from '../world/quests';

const fresh = (): WorldState => ({ inv: {}, picked: {}, flags: {} });

describe('Der zusammenhängende Weg nach Osten', () => {
  it('begründet die Grenze mit dem Abendbrot und öffnet den selben Abzweig erst nach dem Packen', () => {
    const st = fresh();
    expect(eastwardTravelGate(st)).toMatch(/Abendbrot/);
    st.flags.homeArrived = true;
    expect(eastwardTravelGate(st)).toMatch(/Abendbrot/);
    st.flags.raidWitnessed = true;
    expect(eastwardTravelGate(st)).toMatch(/packen/);
    st.flags.departureReady = true;
    expect(eastwardTravelGate(st)).toBeUndefined();
    expect(travelObjective(st, 'felder')).toMatch(/Hufspuren.*Osten/);
  });

  it('zeigt erst nach dem Überfall untersuchbare Hufspuren an erreichbaren Fußpunkten', () => {
    const st = fresh();
    expect(mapForTravel(MAPS.felder, st).props.filter(p => p.id.startsWith('hufspuren'))).toEqual([]);
    st.flags.raidWitnessed = true;
    const map = mapForTravel(MAPS.felder, st);
    const tracks = map.props.filter(p => p.id.startsWith('hufspuren'));
    expect(tracks).toHaveLength(2);
    expect(tracks.every(track => track.lines.join(' ').includes('Osten'))).toBe(true);
    for (const entry of Object.values(map.entries)) for (const track of tracks) {
      const canWalk = (x: number, y: number) => isMapWalkable(map, x, y);
      const path = findWalkingPath(entry.at, track.at, canWalk, track.radius);
      expect(path.length).toBeGreaterThan(0);
      let last = entry.at;
      for (const point of path) { expect(clearWalkingLine(last, point, canWalk)).toBe(true); last = point; }
      expect(Math.hypot(last[0] - track.at[0], last[1] - track.at[1])).toBeLessThan(track.radius);
    }
  });

  it('hält Hof, Felder, Wiese und Hohlweg in beiden Richtungen verbunden', () => {
    const route = ['hof', 'felder', 'wiese', 'hohlweg', 'hof'];
    for (let i = 0; i < route.length - 1; i++) {
      const from = MAPS[route[i]], to = MAPS[route[i + 1]];
      expect(from.exits.some(exit => exit.to === to.id)).toBe(true);
      expect(to.exits.some(exit => exit.to === from.id)).toBe(true);
      expect(isMapWalkable(to, ...to.entries[from.id].at)).toBe(true);
    }
    const map = MAPS[FIELD_RETURN.map];
    const origin = map.entries[FIELD_RETURN.from].at;
    for (const exit of map.exits) {
      const goal: Pt = [exit.rect[0] + exit.rect[2] / 2, exit.rect[1] + exit.rect[3] / 2];
      const canWalk = (x: number, y: number) => isMapWalkable(map, x, y);
      expect(findWalkingPath(origin, goal, canWalk, 2).length, `Rückkehr → ${exit.to}`).toBeGreaterThan(0);
    }
  });

  it('startet bei Rückkehr zum Hof die Reisevorbereitung statt erneut den Überfall', () => {
    const s: any = new WorldScene(), st = fresh();
    st.flags.raidWitnessed = true;
    st.flags.parentsLost = true;
    s.registry = { get: (key: string) => key === 'world' ? st : {}, set: vi.fn() };
    s.scene = { start: vi.fn() };
    s.create({ map: 'hof', from: 'felder' });
    expect(s.scene.start).toHaveBeenCalledExactlyOnceWith('aftermath', { from: 'felder', at: MAPS.hof.entries.felder.at });
    expect(st.flags.parentsLost).toBe(true);
  });

  it('lässt die Felder schon vor dem Packen betreten und wahrt sämtliche Packzustände bei Rückkehr', () => {
    const s: any = new AftermathScene(), st = fresh();
    st.flags.packedFood = true;
    s.st = st;
    s.scene = { start: vi.fn() };
    s.refreshProgress = () => { st.flags.departureReady = false; };
    s.depart();
    expect(s.scene.start).toHaveBeenCalledExactlyOnceWith('world', { map: 'felder', from: 'hof' });
    expect(st.flags.packedFood).toBe(true);
    expect(st.flags.aftermathComplete).toBeUndefined();
  });

  it('sperrt nur den Fernweg, hält Hinweise ohne Wiederholschleife und nimmt nach Freigabe denselben Ausgang', () => {
    const s: any = new WorldScene(), st = fresh();
    s.map = MAPS.felder; s.st = st;
    s.lia = { x: 635, y: 286, anims: { stop: vi.fn() } };
    s.clearTarget = vi.fn(); s.hud = { thought: vi.fn() };
    s.scene = { start: vi.fn(), restart: vi.fn() };
    let finish: () => void = () => {};
    s.cameras = { main: { fadeOut: vi.fn(), once: (_event: string, callback: () => void) => { finish = callback; } } };
    s.checkExits(); s.checkExits();
    expect(s.hud.thought).toHaveBeenCalledTimes(1);
    expect(s.scene.start).not.toHaveBeenCalled();
    s.lia.x = 620; s.checkExits(); s.lia.x = 635; s.checkExits();
    expect(s.hud.thought).toHaveBeenCalledTimes(2);
    st.flags.raidWitnessed = true; st.flags.departureReady = true;
    s.checkExits(); finish();
    expect(s.scene.start).toHaveBeenCalledExactlyOnceWith('journey', { from: 'felder' });
    expect(s.scene.restart).not.toHaveBeenCalled();
  });
});

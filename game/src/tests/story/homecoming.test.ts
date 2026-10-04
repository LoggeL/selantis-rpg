import { HOME_PATH_ENTRY } from '../../content/chapters/homecoming/dialogue';
import { describe, expect, it } from 'vitest';
import { MAPS } from "../../content/maps/index";
import type { WorldState } from "../../modules/campaign/state";
import { completeHomecoming, homecomingObjective, homewardExit } from "../../modules/campaign/homecoming";
import { findWalkingPath, isMapWalkable } from "../../modules/exploration/navigation";

const fresh = (): WorldState => ({ inv: {}, picked: {}, flags: {} });

describe('Lias Heimweg', () => {
  it('setzt Lia nach dem Titel an einen begehbaren Einstieg mit durchgehendem Weg zum Hof', () => {
    const map = MAPS[HOME_PATH_ENTRY.map];
    const entry = map.entries[HOME_PATH_ENTRY.from];
    const walkable = (x: number, y: number) => isMapWalkable(map, x, y);
    expect(walkable(...entry.at)).toBe(true);
    const exit = map.exits.find(e => e.to === homewardExit(map.id))!;
    const [x, y, w, h] = exit.rect;
    const end = findWalkingPath(entry.at, [x + w / 2, y + h / 2], walkable).at(-1)!;
    expect(end[0]).toBeGreaterThanOrEqual(x);
    expect(end[0]).toBeLessThanOrEqual(x + w);
    expect(end[1]).toBeGreaterThanOrEqual(y);
    expect(end[1]).toBeLessThanOrEqual(y + h);
  });
  it('behält ein einziges Hauptziel bei, auch nach optionalen Funden und abgeschlossenen Begegnungen', () => {
    const st = fresh();
    const original = homecomingObjective(st);
    for (const inv of [{ apfel: 1 }, { apfel: 3, kornblume: 3 }, { kueken: 1 }, { feder: 1 }]) {
      st.inv = inv;
      st.flags.chickReturned = true;
      st.flags.pigsFed = true; // An old state must not reintroduce the previous quest.
      expect(homecomingObjective(st)).toBe(original);
    }
  });

  it('führt jede Karte über vorhandene Ausgänge nach Hause, auch nach einem Umweg', () => {
    const st = fresh();
    for (const start of Object.keys(MAPS)) {
      let map = start;
      const visited = new Set<string>();
      while (map !== 'hof') {
        expect(visited.has(map), `Kein Kreis ab ${start}`).toBe(false);
        visited.add(map);
        const next = homewardExit(map);
        expect(MAPS[map].exits.some(exit => exit.to === next)).toBe(true);
        expect(homecomingObjective(st, map)).toMatch(/^Nach Hause/);
        map = next!;
      }
      expect(homewardExit('hof')).toBeUndefined();
      expect(homecomingObjective(st, 'hof')).toContain('in der Böschung verstecken');
    }
  });

  it('schließt bei Ankunft auf dem Hof ohne Sammelpflicht ab und bleibt über Kartenwechsel abgeschlossen', () => {
    const st = fresh();
    expect(completeHomecoming(st)).toBe(true);
    expect(st.inv).toEqual({});
    expect(completeHomecoming(st)).toBe(false);
    for (const map of Object.keys(MAPS)) expect(homecomingObjective(st, map)).toBe('Nach Hause · abgeschlossen');
  });

});

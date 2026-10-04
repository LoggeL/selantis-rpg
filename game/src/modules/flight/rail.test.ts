import { describe, expect, it } from 'vitest';
import { flightSpeed, measureRail, nearestRailDistance, pointOnRail, railDistanceAt, railTargetDirection, stepAlongRail } from "./rail";
import { advanceStationHold, completeFlightStation } from "./stations";
import { FLIGHT_PATH, FLIGHT_STATIONS } from "../../content/chapters/flight/route";

const rail = measureRail([{ x: 0, y: 0 }, { x: 30, y: 40 }, { x: 130, y: 40 }]);

describe('injected flight rail', () => {
  it('measures distance, interpolates position and preserves direction at segment boundaries', () => {
    expect(rail.total).toBe(150); expect(railDistanceAt(rail, 1)).toBe(50);
    expect(pointOnRail(rail, 25)).toEqual({ p: { x: 15, y: 20 }, dir: { x: 0.6, y: 0.8 } });
    expect(pointOnRail(rail, 50).dir).toEqual({ x: 0.6, y: 0.8 });
    expect(pointOnRail(rail, 75)).toEqual({ p: { x: 55, y: 40 }, dir: { x: 1, y: 0 } });
    expect(pointOnRail(rail, -20).p).toEqual({ x: 0, y: 0 });
    expect(pointOnRail(rail, 200).p).toEqual({ x: 130, y: 40 });
  });

  it('includes mandatory endpoints even when the four-pixel cadence cannot sample them', () => {
    expect(nearestRailDistance(rail, 80, 40, 0, 99.3)).toBe(99.3);
    expect(nearestRailDistance(rail, 0, 0, 54, 99.3)).toBe(54);
  });

  it('keeps a near target active and clamps both travel directions exactly', () => {
    expect(railTargetDirection(98.8, 100)).toEqual({ target: 100, dot: 1 });
    expect(railTargetDirection(99.999, 100).target).toBe(100);
    expect(railTargetDirection(100, 100)).toEqual({ target: undefined, dot: 0 });
    expect(stepAlongRail({ distance: 98.8, dot: 1, speed: 62, deltaMs: 80, target: 100, stationAt: 100, safeFloor: 0, total: 150 })).toBe(100);
    expect(stepAlongRail({ distance: 90, dot: -1, speed: 62, deltaMs: 80, target: 88, safeFloor: 0, total: 150 })).toBe(88);
    expect(stepAlongRail({ distance: 90, dot: -1, speed: 62, deltaMs: 80, target: 0, safeFloor: 88, total: 150 })).toBe(88);
  });

  it('retains the authored station and running speed sequence', () => {
    const authoredRail = measureRail(FLIGHT_PATH);
    expect(FLIGHT_STATIONS.map(station => station.kind)).toEqual(['stumble', 'jump', 'climb', 'brace', 'slip']);
    expect(FLIGHT_STATIONS.map(station => station.pointIndex)).toEqual([5, 14, 17, 21, 24]);
    expect(pointOnRail(authoredRail, railDistanceAt(authoredRail, 5)).p).toEqual(FLIGHT_PATH[5]);
    expect(flightSpeed(0, rail.total)).toBe(62);
    expect(flightSpeed(rail.total * 0.7, rail.total)).toBe(42);
    expect(flightSpeed(rail.total, rail.total)).toBeCloseTo(26);
  });
});

describe('flight station progression', () => {
  it('freezes a released climb, caps a held climb and opens the destination floor on completion', () => {
    const station = { at: 100, kind: 'climb' as const, holdMs: 1800, to: 180 };
    expect(advanceStationHold(station, 900, false, 80)).toEqual({ holding: 900, progress: 0.5, distance: 140, complete: false });
    expect(advanceStationHold(station, 1790, true, 80)).toEqual({ holding: 1800, progress: 1, distance: 180, complete: true });
    expect(completeFlightStation({ distance: 180, safeFloor: 50, nextStation: 2 }, station)).toEqual({ distance: 180, safeFloor: 180, nextStation: 3 });
  });

  it('keeps brace feet fixed and advances mandatory stumble only after completion', () => {
    const brace = { at: 220, kind: 'brace' as const, holdMs: 1200 };
    expect(advanceStationHold(brace, 600, true, 80).distance).toBe(220);
    expect(completeFlightStation({ distance: 100, safeFloor: 0, nextStation: 0 }, { at: 100, kind: 'stumble' })).toEqual({ distance: 100, safeFloor: 0, nextStation: 1 });
  });
});

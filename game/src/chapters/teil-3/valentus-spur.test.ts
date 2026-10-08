import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { STAFF } from '../common/bookContract';
import { enterBook3 } from './shared';
import { CENTERLINE, nextStation, pointAlong, polylineLength, projectAlong, SCATTER, STATIONS, trailPoints } from './valentus-spur';

afterEach(() => G.state.reset());

describe('e3-valentus trail', () => {
  it('passes the three places in path order, all before the gap into the clearing', () => {
    const along = STATIONS.map(s => s.along);
    expect([...along].sort((a, b) => a - b)).toEqual(along);
    expect(along[2]).toBeLessThan(polylineLength(CENTERLINE));
    for (const s of STATIONS) expect(SCATTER[s.id]).toHaveLength(5);
  });

  it('leads to the first unread place, whatever was read before', () => {
    expect(nextStation(new Set())?.id).toBe('stumpf');
    expect(nextStation(new Set(['stumpf']))?.id).toBe('fels');
    expect(nextStation(new Set(['fels']))?.id).toBe('stumpf');
    expect(nextStation(new Set(['stumpf', 'fels', 'felsblock']))).toBeUndefined();
  });

  it('lines the light points up from Lia towards the place and ends on it', () => {
    const fels = STATIONS[1];
    const lia = pointAlong(CENTERLINE, 100);
    const pts = trailPoints(fels, projectAlong(CENTERLINE, lia), new Set(['stumpf']), 5);
    expect(pts).toHaveLength(5);
    expect(pts[4]).toEqual(fels.at);
    // Never behind the place she already read.
    expect(projectAlong(CENTERLINE, pts[0])).toBeGreaterThanOrEqual(STATIONS[0].along - 1);
    for (let i = 1; i < 4; i++) expect(projectAlong(CENTERLINE, pts[i])).toBeGreaterThan(projectAlong(CENTERLINE, pts[i - 1]));
  });

  it('gathers the points around the place once Lia is level with it', () => {
    const stumpf = STATIONS[0];
    const pts = trailPoints(stumpf, stumpf.along + 40, new Set(), 5);
    for (const [x, y] of pts) expect(Math.hypot(x - stumpf.at[0], y - stumpf.at[1])).toBeLessThan(25);
  });
});

describe('e3-valentus regular entry', () => {
  it('keeps a grown Teil-II state: no reset of items, abilities, levels or choices', () => {
    G.state.give(STAFF.borrowed);
    G.state.give('honey-cake', 3);
    G.state.learn('lichtstoss');
    G.state.set('e2-finished');
    G.state.set('e2-abschied', 'brief');
    G.state.setParty(['kyra']);
    G.state.objective('e2-hang-weg', 'Weiter, den Pfad hinauf.');
    const before = JSON.parse(JSON.stringify(G.state.data));
    enterBook3();
    enterBook3();
    expect(G.state.data.inventory).toEqual(before.inventory);
    expect(G.state.data.abilities).toEqual(before.abilities);
    expect(G.state.data.characters).toEqual(before.characters);
    expect(G.state.flag('e2-abschied')).toBe('brief');
    expect(G.state.data.party).toEqual([]);
    expect(G.state.data.objectives.every(o => o.done)).toBe(true);
    expect(G.state.flag('e3-eingang')).toBe('teil-2');
  });
});

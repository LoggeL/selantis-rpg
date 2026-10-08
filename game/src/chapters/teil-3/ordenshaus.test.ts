import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import type { BlockDef } from '../../world';
import { pointInPoly } from '../../world/poly';
import {
  GZ_BLOCKS, GZ_CANDLE_LOOP, GZ_DOOR_AT, GZ_OBJECT_SPOTS, GZ_SPAWNS, GZ_SPOT, GZ_WALK, NIGHT_GUARDS, OH_BLOCKS, OH_SHADOWS,
  OH_SPAWNS, OH_SPOT, OH_WALK, STUDY_LISTEN, STUDY_SHADOWS,
} from './ordenshaus';
import { prepareE3, staffPlace } from './shared';

type Pt = readonly [number, number];
const free = (walk: readonly (readonly Pt[])[], blocks: BlockDef[], [x, y]: Pt) =>
  walk.some(p => pointInPoly(x, y, p)) && !blocks.some(b => pointInPoly(x, y, b.poly));
const centre = (poly: readonly Pt[]): Pt => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];

afterEach(() => G.state.reset());

describe('guest room geometry (e3-gastzimmer)', () => {
  it('keeps every standing spot walkable and every object spot off the free floor', () => {
    const objects = new Set<string>(GZ_OBJECT_SPOTS);
    for (const [id, at] of Object.entries(GZ_SPOT)) expect(free(GZ_WALK, GZ_BLOCKS, at), id).toBe(!objects.has(id));
    for (const [id, sp] of Object.entries(GZ_SPAWNS)) expect(free(GZ_WALK, GZ_BLOCKS, sp.at as Pt), id).toBe(true);
    expect(free(GZ_WALK, GZ_BLOCKS, GZ_DOOR_AT)).toBe(true);
  });

  it('lets the doctor walk his candle loop on free floor', () => {
    for (const at of GZ_CANDLE_LOOP) expect(free(GZ_WALK, GZ_BLOCKS, at), String(at)).toBe(true);
  });
});

describe('upper floor geometry (e3-ordenshaus)', () => {
  it('keeps every named spot and spawn walkable', () => {
    for (const [id, at] of Object.entries(OH_SPOT)) expect(free(OH_WALK, OH_BLOCKS, at), id).toBe(true);
    for (const [id, sp] of Object.entries(OH_SPAWNS)) expect(free(OH_WALK, OH_BLOCKS, sp.at as Pt), id).toBe(true);
  });

  it('puts every night shadow and every guard waypoint on free floor', () => {
    for (const h of OH_SHADOWS) expect(free(OH_WALK, OH_BLOCKS, centre(h.poly!)), h.id).toBe(true);
    for (const g of NIGHT_GUARDS) for (const wp of g.path) {
      const at = (Array.isArray(wp) ? wp : (wp as { at: Pt }).at) as Pt;
      expect(free(OH_WALK, OH_BLOCKS, at), `${g.id} ${String(at)}`).toBe(true);
    }
  });

  it('places the listening spot at the study door between the two shadows', () => {
    expect(pointInPoly(OH_SPOT.studyDoor[0], OH_SPOT.studyDoor[1], STUDY_LISTEN)).toBe(true);
    expect(pointInPoly(OH_SPOT.shadowLeft[0], OH_SPOT.shadowLeft[1], STUDY_SHADOWS[0])).toBe(true);
    expect(pointInPoly(OH_SPOT.shadowRight[0], OH_SPOT.shadowRight[1], STUDY_SHADOWS[1])).toBe(true);
    for (const s of STUDY_SHADOWS) expect(pointInPoly(OH_SPOT.studyDoor[0], OH_SPOT.studyDoor[1], s)).toBe(false);
  });

  it('connects the lower passage with the corridor over the stairs', () => {
    for (const at of [OH_SPOT.liaDoor, OH_SPOT.lowerEast, OH_SPOT.ledge, OH_SPOT.stairFoot, [934, 600] as Pt, OH_SPOT.stairTop, [934, 470] as Pt]) {
      expect(free(OH_WALK, OH_BLOCKS, at), String(at)).toBe(true);
    }
    // The wall between the corridor and the lower passage is not walkable.
    expect(free(OH_WALK, OH_BLOCKS, [300, 560])).toBe(false);
  });
});

describe('the staff in the armoury', () => {
  it('hangs there only from the arrest until Flick gets it', () => {
    prepareE3('e3-macht-und-schutz');
    expect(staffPlace()).toBe('waffenkammer');
    G.state.reset();
    prepareE3('e3-hoffnung-und-weigerung');
    expect(staffPlace()).toBe('flick');
  });
});

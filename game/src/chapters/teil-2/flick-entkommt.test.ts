import { describe, expect, it } from 'vitest';
import type { BlockDef } from '../../world';
import { pointInPoly } from '../../world/poly';
import { scuffleBeats } from './flick-entkommt-moment';
import {
  ALARM_FROM, ESCAPE_CHECKPOINTS, ESCAPE_EXIT, ESCAPE_GUARDS, ESCAPE_HIDING, ESCAPE_SPAWNS, KEYS_AT, NICHE, SCUFFLE,
} from './flick-entkommt-weg';
import { KERKER_BLOCKS, kerkerWalk } from './gewoelbe';

type Pt = readonly [number, number];
const free = (walk: readonly (readonly Pt[])[], blocks: BlockDef[], [x, y]: Pt) =>
  walk.some(p => pointInPoly(x, y, p)) && !blocks.some(b => pointInPoly(x, y, b.poly));
const centre = (poly: readonly Pt[]): Pt => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];

describe('„Was du gesehen hast“ (e2-flick-entkommt)', () => {
  it('each beat has exactly one idea that works, and the first one follows how the shackle was hidden', () => {
    for (const shackle of ['stroh', 'aermel', undefined]) {
      const beats = scuffleBeats(shackle);
      expect(beats.map(b => b.id)).toEqual(['losreissen', 'zuschlagen']);
      for (const b of beats) expect(b.ideas.filter(i => i.ok)).toHaveLength(1);
    }
    expect(scuffleBeats('aermel')[0].ideas.find(i => i.ok)?.tag).toBe('Ärmel');
    expect(scuffleBeats('stroh')[0].ideas.find(i => i.ok)?.tag).toBe('Stroh');
  });
});

describe('escape route geometry (e2-kerker-alarm)', () => {
  const walk = kerkerWalk({ cells: [0, 2], open: [0, 2] });
  const fetchWalk = kerkerWalk({ cells: [0], open: [0] });

  it('keeps every spawn, checkpoint and the exit on free floor', () => {
    for (const [id, sp] of Object.entries(ESCAPE_SPAWNS)) expect(free(walk, KERKER_BLOCKS, sp.at as Pt), id).toBe(true);
    for (const c of ESCAPE_CHECKPOINTS) {
      expect(ESCAPE_SPAWNS[c.spawn], c.spawn).toBeDefined();
      const at = ESCAPE_SPAWNS[c.spawn].at as Pt;
      expect(pointInPoly(at[0], at[1], c.area), c.spawn).toBe(true);
    }
    expect(free(walk, KERKER_BLOCKS, centre(ESCAPE_EXIT))).toBe(true);
    expect(free(walk, KERKER_BLOCKS, ALARM_FROM)).toBe(true);
  });

  it('puts every hiding spot on walkable floor and the niche clear of the crates', () => {
    for (const h of ESCAPE_HIDING) expect(free(walk, KERKER_BLOCKS, centre(h.poly as Pt[])), h.id).toBe(true);
    for (const p of NICHE) expect(free(walk, KERKER_BLOCKS, [p[0] - 1, p[1] - 1] as Pt), String(p)).toBe(true);
  });

  it('keeps every guard waypoint walkable', () => {
    for (const g of ESCAPE_GUARDS) for (const wp of g.path) {
      const at = ('at' in (wp as object) ? (wp as { at: Pt }).at : wp) as Pt;
      expect(free(walk, KERKER_BLOCKS, at), `${g.id} ${String(at)}`).toBe(true);
    }
  });

  it('stages the scuffle and the key bunch in the open corridor', () => {
    expect(free(fetchWalk, KERKER_BLOCKS, SCUFFLE)).toBe(true);
    expect(free(fetchWalk, KERKER_BLOCKS, KEYS_AT)).toBe(true);
  });
});

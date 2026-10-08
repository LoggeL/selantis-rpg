import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import type { BlockDef } from '../../world';
import { pointInPoly } from '../../world/poly';
import { openQuestions, REPORT_END, REPORT_QUESTIONS, type ReportKey, STAFF_ANSWERS, staffTalkNeeded } from './kyras-fluchtweg-bericht';
import {
  BANK, CELLAR_BLOCKS, CELLAR_GUARD, CELLAR_SHADOWS, CELLAR_SPAWNS, CELLAR_SPOT, CELLAR_WALK, KANAL_BLOCKS, KANAL_ROUTE,
  KANAL_SPAWNS, KANAL_SPOT, KANAL_WALK, KYRA_STEPS, SHADOW_CHECKPOINT, WELL_RING,
} from './kyras-fluchtweg-keller';
import { hasOwnStaff, prepareE3, staffPlace } from './shared';

type Pt = readonly [number, number];
const free = (walk: readonly (readonly Pt[])[], blocks: BlockDef[], [x, y]: Pt) =>
  walk.some(p => pointInPoly(x, y, p)) && !blocks.some(b => pointInPoly(x, y, b.poly));
const centre = (poly: readonly Pt[]): Pt => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];

afterEach(() => G.state.reset());

describe('the cellar (e3-keller-gewoelbe)', () => {
  it('keeps spots, spawns, Kyra\'s steps and the guard\'s round on free floor', () => {
    for (const [id, at] of Object.entries(CELLAR_SPOT)) expect(free(CELLAR_WALK, CELLAR_BLOCKS, at), id).toBe(true);
    for (const [id, sp] of Object.entries(CELLAR_SPAWNS)) expect(free(CELLAR_WALK, CELLAR_BLOCKS, sp.at as Pt), id).toBe(true);
    for (const at of KYRA_STEPS) expect(free(CELLAR_WALK, CELLAR_BLOCKS, at), String(at)).toBe(true);
    for (const wp of CELLAR_GUARD.path) expect(free(CELLAR_WALK, CELLAR_BLOCKS, (wp as { at: Pt }).at), String(wp)).toBe(true);
  });

  it('puts every shadow on free floor with a checkpoint spawn inside it, in route order towards the well', () => {
    for (const s of CELLAR_SHADOWS) {
      expect(free(CELLAR_WALK, CELLAR_BLOCKS, centre(s.poly)), s.id).toBe(true);
      const sp = CELLAR_SPAWNS[SHADOW_CHECKPOINT[s.id]];
      expect(sp, s.id).toBeDefined();
      expect(pointInPoly((sp.at as Pt)[0], (sp.at as Pt)[1], s.poly), s.id).toBe(true);
    }
    expect(CELLAR_SHADOWS.at(-1)!.id).toBe('schatten-brunnen');
    expect(pointInPoly(CELLAR_SPOT.wellRim[0], CELLAR_SPOT.wellRim[1], CELLAR_SHADOWS.at(-1)!.poly)).toBe(true);
  });

  it('blocks the well ring itself (the shaft is the way down, not a floor)', () => {
    expect(free(CELLAR_WALK, CELLAR_BLOCKS, [205, 318])).toBe(false);
    expect(pointInPoly(205, 318, WELL_RING)).toBe(true);
  });
});

describe('the channel and the bank (e3-keller-kanal)', () => {
  it('keeps the way from the shaft through the water to the resting place walkable', () => {
    for (const [id, at] of Object.entries(KANAL_SPOT)) expect(free(KANAL_WALK, KANAL_BLOCKS, at), id).toBe(true);
    for (const [id, sp] of Object.entries(KANAL_SPAWNS)) expect(free(KANAL_WALK, KANAL_BLOCKS, sp.at as Pt), id).toBe(true);
    for (const at of KANAL_ROUTE) expect(free(KANAL_WALK, KANAL_BLOCKS, at), String(at)).toBe(true);
    expect(pointInPoly(KANAL_SPOT.rest[0], KANAL_SPOT.rest[1], BANK)).toBe(true);
    // The cellar is not part of the channel map.
    expect(free(KANAL_WALK, KANAL_BLOCKS, CELLAR_SPOT.stairs)).toBe(false);
  });
});

describe('the staff stays behind', () => {
  it('asks only while the staff really hangs in the armoury, and every answer gives in', () => {
    prepareE3('e3-kyras-fluchtweg');
    expect(staffPlace()).toBe('waffenkammer');
    expect(hasOwnStaff()).toBe(false);
    expect(staffTalkNeeded(staffPlace(), hasOwnStaff())).toBe(true);
    expect(staffTalkNeeded('flick', false)).toBe(false);
    expect(staffTalkNeeded('lia', true)).toBe(false);
    expect(new Set(STAFF_ANSWERS.map(a => a.tone)).size).toBe(3);
  });

  it('leaves the documented state for the next scene (left behind, report as unconfirmed clue)', () => {
    prepareE3('e3-waldgegner');
    expect(G.state.is('e3-geflohen')).toBe(true);
    expect(G.state.is('e3-stab-zurueckgelassen')).toBe(true);
    expect(G.state.data.clues).toContain('e3-kyras-bericht');
    expect(hasOwnStaff()).toBe(false);
    expect(staffPlace()).toBe('waffenkammer');
  });
});

describe('Kyra\'s report', () => {
  it('offers the three questions in any order until all are asked', () => {
    const asked = new Set<ReportKey>();
    expect(openQuestions(asked).map(q => q.key)).toEqual(['flucht', 'flick', 'elnon']);
    asked.add('elnon');
    expect(openQuestions(asked).map(q => q.key)).toEqual(['flucht', 'flick']);
    asked.add('flucht'); asked.add('flick');
    expect(openQuestions(asked)).toEqual([]);
  });

  it('lets Kyra tell the Elnon lie with the faint hint and never ask anything back', () => {
    const elnon = REPORT_QUESTIONS.find(q => q.key === 'elnon')!;
    expect(elnon.lines.some(l => l.who === 'kyra-cold')).toBe(true);
    const kyraLines = [...REPORT_QUESTIONS.flatMap(q => q.lines), ...REPORT_END].filter(l => l.who !== 'lia');
    expect(kyraLines.some(l => l.text.includes('?') && !l.text.includes('vergessen'))).toBe(false);
  });

  it('keeps every line short enough for one dialogue box', () => {
    const all = [...REPORT_QUESTIONS.flatMap(q => q.lines), ...REPORT_END, ...STAFF_ANSWERS.flatMap(a => [a.lia, a.kyra])];
    for (const l of all) expect(l.text.length, l.text).toBeLessThanOrEqual(140);
  });
});

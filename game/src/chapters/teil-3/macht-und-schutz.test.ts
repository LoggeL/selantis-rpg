import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { STAFF } from '../common/bookContract';
import {
  FOLLOW, followVerdict, IGNATIUS_ASKS, STILL, stepFollow, stepStill, VERHANDLUNG_ANSWERS, VERHANDLUNG_TONES,
} from './macht-und-schutz-regeln';
import { hasOwnStaff, liaLook, prepareE3, staffPlace } from './shared';

afterEach(() => G.state.reset());

describe('e3-macht-und-schutz: the bowl', () => {
  it('fills only while Lia leans over the bowl and holds still', () => {
    let p = 0;
    for (let t = 0; t < STILL.needSec - 0.2; t += 0.1) p = stepStill(p, 0.1, true, 0);
    expect(p).toBeLessThan(1);
    for (let t = 0; t < 0.4; t += 0.1) p = stepStill(p, 0.1, true, 0);
    expect(p).toBe(1);
    expect(stepStill(0.5, 0.1, false, 0)).toBeLessThan(0.5);
  });

  it('loses most of the progress on a fidget', () => {
    expect(stepStill(0.8, 0.1, true, STILL.tolerance + 2)).toBeCloseTo(0.8 * STILL.keepOnMove);
    expect(stepStill(0.8, 0.1, true, STILL.tolerance / 2)).toBeGreaterThan(0.8);
  });
});

describe('e3-macht-und-schutz: the candle', () => {
  it('counts only time close to the flame, and complains far away', () => {
    expect(followVerdict(FOLLOW.near)).toBe('close');
    expect(followVerdict(FOLLOW.near + 1)).toBe('ok');
    expect(followVerdict(FOLLOW.far + 1)).toBe('far');
    expect(stepFollow(0.3, 1, 30)).toBeCloseTo(0.3 + 1 / FOLLOW.needSec);
    expect(stepFollow(0.3, 1, 90)).toBe(0.3);
    expect(stepFollow(0.3, 1, 300)).toBeLessThan(0.3);
    let p = 0;
    for (let t = 0; t < FOLLOW.needSec + 0.2; t += 0.1) p = stepFollow(p, 0.1, 20);
    expect(p).toBe(1);
  });
});

describe('e3-macht-und-schutz: the negotiation', () => {
  it('offers three tones that all carry the consent claim and the hall, in short lines', () => {
    expect([...VERHANDLUNG_TONES]).toEqual(['kalt', 'bittend', 'klug']);
    for (const t of VERHANDLUNG_TONES) {
      const a = VERHANDLUNG_ANSWERS[t];
      expect(a.length, t).toBeLessThanOrEqual(140);
      expect(a, t).toMatch(/Ohne mein Ja/);
      expect(a, t).toMatch(/Saal/);
      expect(a.startsWith('„') && a.endsWith('“'), t).toBe(true);
    }
    for (const a of IGNATIUS_ASKS) expect(a.length).toBeLessThanOrEqual(140);
  });
});

describe('e3-macht-und-schutz: direct entry', () => {
  it('starts bound, without staff, with the staff in the armoury and Schattentöter returned', () => {
    prepareE3('e3-macht-und-schutz');
    expect(G.state.is('e3-schutz-ausgeloest')).toBe(true);
    expect(hasOwnStaff()).toBe(false);
    expect(G.state.has(STAFF.borrowed)).toBe(false);
    expect(staffPlace()).toBe('waffenkammer');
    expect(liaLook()).not.toBe('e3-lia-eigenstab');
  });

  it('enters e3-falscher-glaube with the documented negotiation result', () => {
    prepareE3('e3-falscher-glaube');
    expect(G.state.is('e3-untersucht')).toBe(true);
    expect(G.state.is('e3-verhandelt')).toBe(true);
    expect(VERHANDLUNG_TONES).toContain(G.state.flag('e3-verhandlung-ton'));
  });
});

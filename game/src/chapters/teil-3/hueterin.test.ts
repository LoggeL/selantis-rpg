import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { pointInPoly } from '../../world/poly';
import { STAFF } from '../common/bookContract';
import {
  ANSWER, ANSWER_CHOICES, ANSWER_TONES, ARRIVAL_CARD, CLOSING, CROWD_BARKS, DOCTOR, FIBULA, HEALER, HEALER_KYRA, HEALER_REST, HUETERIN_FLAGS,
  HUETERIN_SPOT, LAY_DOWN, MERCHANT, OPENING, SPEECH, STAIRS_ZONE, canLayDown, endCeremony, grantFibula, layDownSchattentoeter, type Line,
} from './hueterin-platz';
import { TRAPAS_BLOCKS, TRAPAS_WALK } from './paladine-orte';
import { liaSpeedFactor, poisoned, prepareE3 } from './shared';

afterEach(() => G.state.reset());

const walkable = (at: readonly [number, number]) =>
  TRAPAS_WALK.some(p => pointInPoly(at[0], at[1], p)) && !TRAPAS_BLOCKS.some(b => pointInPoly(at[0], at[1], b.poly));

describe('the square before the ceremony', () => {
  it('puts every person and stand point on open ground', () => {
    for (const [id, at] of Object.entries(HUETERIN_SPOT)) {
      if (id === 'crowd') continue;
      expect(walkable(at as [number, number]), id).toBe(true);
    }
    for (const at of HUETERIN_SPOT.crowd) expect(walkable(at), String(at)).toBe(true);
    expect(pointInPoly(HUETERIN_SPOT.liaCeremony[0], HUETERIN_SPOT.liaCeremony[1], STAIRS_ZONE)).toBe(true);
    expect(pointInPoly(HUETERIN_SPOT.start[0], HUETERIN_SPOT.start[1], STAIRS_ZONE)).toBe(false);
  });

  it('keeps all lines within one dialogue box and the barks short', () => {
    const lines: readonly Line[] = [
      ...OPENING, ...HEALER, ...HEALER_KYRA, ...HEALER_REST, ...DOCTOR, ...MERCHANT, ...LAY_DOWN, ...SPEECH,
      ...ANSWER_TONES.flatMap(t => ANSWER[t]), ...FIBULA, ...CLOSING,
    ];
    for (const l of lines) expect(l.text.length, l.text).toBeLessThanOrEqual(140);
    expect(ARRIVAL_CARD.length).toBeLessThanOrEqual(140);
    for (const b of CROWD_BARKS) expect(b.length, b).toBeLessThanOrEqual(40);
    for (const c of ANSWER_CHOICES) expect(c.length, c).toBeLessThanOrEqual(80);
  });

  it('turns the order to protection and names Lia Hüterin without making her rule anyone', () => {
    expect(SPEECH.some(l => /vor die Menschen/.test(l.text))).toBe(true);
    expect(SPEECH.some(l => /Hüterin der Urmacht/.test(l.text))).toBe(true);
    expect(SPEECH.some(l => /Ignatius/.test(l.text))).toBe(true);
    for (const l of [...SPEECH, ...ANSWER_TONES.flatMap(t => ANSWER[t])]) expect(l.text).not.toMatch(/herrsch|Königin|befehle/i);
    expect(ANSWER_TONES.length).toBe(3);
  });

  it('leaves the Doktor and the relics open and never names Mother’s family', () => {
    expect(DOCTOR.some(l => /ohne Erfolg/.test(l.text))).toBe(true);
    for (const l of MERCHANT) expect(l.text).not.toMatch(/Familie [A-Z]/);
  });
});

describe('the state of the scene', () => {
  it('starts still poisoned (the healer can only advise rest)', () => {
    prepareE3('e3-hueterin');
    expect(poisoned()).toBe(true);
    expect(liaSpeedFactor()).toBeLessThan(1);
    expect(G.state.data.party).toEqual(['kyra', 'flick']);
    expect(G.state.has('e3-ordensfibel')).toBe(false);
  });

  it('grants the fibula exactly once, also across a reload of the ceremony', () => {
    prepareE3('e3-hueterin');
    expect(grantFibula()).toBe(true);
    endCeremony('fest');
    endCeremony('fest');
    expect(G.state.count('e3-ordensfibel')).toBe(1);
  });

  it('ends with the contract flags: Hüterin, poison fading, the order’s new task', () => {
    prepareE3('e3-hueterin');
    endCeremony('trocken');
    expect(G.state.is(HUETERIN_FLAGS.done)).toBe(true);
    expect(G.state.flag(HUETERIN_FLAGS.task)).toBe('schutz');
    expect(poisoned()).toBe(false);
    expect(liaSpeedFactor()).toBe(1);
    expect(G.state.flag('e3-hueterin-antwort')).toBe('trocken');
  });

  it('lets Lia lay Schattentöter down once, only while she carries it', () => {
    prepareE3('e3-hueterin');
    expect(G.state.count(STAFF.borrowed)).toBe(1);
    expect(canLayDown()).toBe(true);
    expect(layDownSchattentoeter()).toBe(true);
    expect(G.state.has(STAFF.borrowed)).toBe(false);
    expect(canLayDown()).toBe(false);
    expect(layDownSchattentoeter()).toBe(false);
    G.state.give(STAFF.borrowed);
    expect(canLayDown()).toBe(false);
    expect(G.state.has(STAFF.own)).toBe(true);
  });
});

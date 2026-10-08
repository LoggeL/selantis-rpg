import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { STAFF } from '../common/bookContract';
import {
  AFTER_DEATH, APOLOGY, ARRIVAL, CARE_CHOICES, FAREWELL_FLAGS, FINAL, FORGIVE, FORGIVE_CHOICES, FORGIVE_TONES, HAND, LAST, LAST_CHOICES,
  LETTING_GO, PROGRESS, SCHATTENTOETER, TINCTURE, WAKE, carriesSchattentoeter, endFarewell, tinctureOffered, type Line,
} from './ignatius-abschied-texte';
import { poisoned, prepareE3 } from './shared';

afterEach(() => G.state.reset());

const ALL: readonly Line[] = [
  ...WAKE, ...TINCTURE, ...HAND, ...PROGRESS, ...APOLOGY, ...FORGIVE_TONES.flatMap(t => FORGIVE[t]), ...LETTING_GO, ...LAST.flat(), ...SCHATTENTOETER,
  ...FINAL, ...ARRIVAL,
];

describe('the farewell texts', () => {
  it('fit one dialogue box each and keep the choices short', () => {
    for (const l of ALL) expect(l.text.length, l.text).toBeLessThanOrEqual(140);
    for (const t of AFTER_DEATH) expect(t.length, t).toBeLessThanOrEqual(140);
    for (const c of [...CARE_CHOICES, ...FORGIVE_CHOICES, ...LAST_CHOICES]) expect(c.length, c).toBeLessThanOrEqual(80);
  });

  it('offers three ways to forgive and every one of them forgives', () => {
    expect(FORGIVE_CHOICES.length).toBe(3);
    expect(FORGIVE_TONES).toEqual(['gut', 'frage', 'wut']);
    expect(FORGIVE.gut.some(l => l.who === 'lia' && /nichts nach/.test(l.text))).toBe(true);
    expect(FORGIVE.frage.some(l => l.who === 'lia' && /vergeben/.test(l.text))).toBe(true);
    expect(FORGIVE.wut.some(l => l.who === 'lia' && /vergeben/.test(l.text))).toBe(true);
    expect(LAST.length).toBe(LAST_CHOICES.length);
  });

  it('names Gwynn as long dead and never calls Ignatius her father', () => {
    expect(APOLOGY.some(l => /Gwynn lebt nicht mehr/.test(l.text))).toBe(true);
    for (const l of ALL) expect(l.text, l.text).not.toMatch(/\bVater\b|Tochter\b/);
  });

  it('does not reuse the film lines of the death scene', () => {
    const film = [/Kleine Zauberin/i, /Training/i, /längst tot und ich konnte/i, /in Frieden zu ihr/i, /nur eine Hülle/i, /nie allein/i, /Ich verzeih euch/i];
    for (const l of ALL) for (const re of film) expect(l.text, l.text).not.toMatch(re);
  });
});

describe('the tincture and the end state', () => {
  it('offers the tincture only when Lia carries one, and the attempt uses nothing up', () => {
    expect(tinctureOffered()).toBe(false);
    G.state.give('tincture');
    expect(tinctureOffered()).toBe(true);
    endFarewell('frage');
    expect(G.state.count('tincture')).toBe(1);
  });

  it('ends with Ignatius dead, reconciled and the sisters’ friends as the party', () => {
    prepareE3('e3-ignatius-abschied');
    expect(poisoned()).toBe(true);
    expect(G.state.data.party).toEqual([]);
    endFarewell('wut');
    expect(G.state.is(FAREWELL_FLAGS.dead)).toBe(true);
    expect(G.state.is(FAREWELL_FLAGS.reconciled)).toBe(true);
    expect(G.state.data.party).toEqual(['kyra', 'flick']);
    expect(G.state.flag('e3-abschied-ton')).toBe('wut');
    endFarewell('wut');
    expect(G.state.data.party).toEqual(['kyra', 'flick']);
  });

  it('asks for Schattentöter only while Lia carries it', () => {
    expect(carriesSchattentoeter()).toBe(false);
    G.state.give(STAFF.borrowed);
    expect(carriesSchattentoeter()).toBe(true);
  });
});

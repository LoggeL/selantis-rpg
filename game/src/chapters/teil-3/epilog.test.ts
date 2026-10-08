import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { pointInPoly } from '../../world/poly';
import { BOOK3_CREDITS } from './epilog-credits';
import {
  APPLE_LINES, BANTER_ANSWERS, BANTER_CHOICES, BANTER_OPEN, ELNON, ELNON_ANSWERS, ELNON_CHOICES, ELNON_END, elnonAnswer, ENDING, EP,
  FINISHED_LINE, FLICK_ANSWERS, FLICK_CHOICES, FLICK_IN, LEAVE_ZONE, NEST_LINES, OPENING, resetEpilog, SCHUTZ, SNEAK, SOMMER,
  SOMMER_ANSWERS, SOMMER_CHOICES, SOMMER_END, WIESE_SPOT, type Line,
} from './epilog-weg';
import { hasOwnStaff, poisoned, prepareE3 } from './shared';

afterEach(() => G.state.reset());

describe('the meadow of the first scene (k1-wiese, autumn)', () => {
  it('lets the three leave along the path where Kyra went home in the summer', () => {
    expect(pointInPoly(WIESE_SPOT.away[0], WIESE_SPOT.away[1], LEAVE_ZONE)).toBe(true);
    // The two apparitions stand in front of the oak (south of its trunk, k1-wiese block „eiche“ ends at y 452).
    expect(Math.min(WIESE_SPOT.valentus[1], WIESE_SPOT.ignatius[1])).toBeGreaterThan(452);
  });

  it('starts every visit fresh', () => {
    for (const f of Object.values(EP)) G.state.set(f);
    resetEpilog();
    for (const f of Object.values(EP)) expect(G.state.is(f), f).toBe(false);
  });

  it('mirrors the three answers of the first scene', () => {
    expect(BANTER_CHOICES).toEqual([
      '„Ich wollte gleich nachkommen. Ehrlich.“',
      '„Aber Alana war gerade an der besten Stelle!“',
      '„Holz sammeln kannst du eben besser. Jeder hat seine Talente.“',
    ]);
    expect(BANTER_ANSWERS.length).toBe(BANTER_CHOICES.length);
    expect(FLICK_ANSWERS.length).toBe(FLICK_CHOICES.length);
  });
});

describe('the talks', () => {
  const lines: readonly Line[] = [
    ...OPENING, ...SNEAK, ...BANTER_OPEN, ...BANTER_ANSWERS.flat(), ...SOMMER, ...SOMMER_ANSWERS.flat(), ...SOMMER_END, ...FLICK_IN,
    ...FLICK_ANSWERS.flat(), ...SCHUTZ, ...ELNON, ...ELNON_ANSWERS.flat(), ...ELNON_END, ...NEST_LINES, ...APPLE_LINES, ...ENDING,
  ];

  it('fit one dialogue box each', () => {
    for (const l of lines) expect(l.text.length, l.text).toBeLessThanOrEqual(140);
    expect(FINISHED_LINE.length).toBeLessThanOrEqual(140);
    for (const c of [...BANTER_CHOICES, ...SOMMER_CHOICES, ...FLICK_CHOICES, ...ELNON_CHOICES]) expect(c.length, c).toBeLessThanOrEqual(80);
    expect(SOMMER_ANSWERS.length).toBe(SOMMER_CHOICES.length);
    expect(ELNON_ANSWERS.length).toBe(ELNON_CHOICES.length);
  });

  it('lets Lia learn of Elnon’s death here and comfort Kyra in every answer', () => {
    expect(ELNON.some(l => l.who === 'kyra' && /tot/.test(l.text))).toBe(true);
    expect(ELNON.some(l => l.who === 'kyra' && /gelogen/.test(l.text))).toBe(true);
    for (const a of ELNON_ANSWERS) expect(a.some(l => l.who === 'lia' && /nicht dein Wille/.test(l.text))).toBe(true);
  });

  it('only recalls the push at the stone when Lia tried to hug Kyra there', () => {
    const pushed = (stone: number | undefined) => elnonAnswer(1, stone).some(l => /weggeschoben/.test(l.text));
    expect(pushed(2)).toBe(true);
    for (const stone of [0, 1, undefined]) expect(pushed(stone)).toBe(false);
    expect(elnonAnswer(0, 0)).toBe(ELNON_ANSWERS[0]);
    for (const l of elnonAnswer(1, 0)) expect(l.text.length).toBeLessThanOrEqual(140);
  });

  it('names the Bruderschaft figures and gives Kyra a source for the south', () => {
    const end = ELNON_END.map(l => l.text).join(' ');
    expect(end).toMatch(/Foltan/);
    expect(end).toMatch(/Azar/);
    expect(end).toMatch(/Baris hat in der Halle/);
  });

  it('says the parents would be proud in every answer of the first talk', () => {
    for (const a of SOMMER_ANSWERS) expect(a.some(l => l.who === 'kyra' && /stolz/i.test(l.text))).toBe(true);
  });

  it('does not reuse the film lines of the epilogue', () => {
    const film = [/vor einem Jahr/i, /verrückt gehalten/i, /sehen uns zu/i, /unheimlich stolz/i, /aus den Augen verliere/i, /Leibwächterin/i, /Da seid ihr ja/i];
    for (const l of lines) for (const re of film) expect(l.text, l.text).not.toMatch(re);
  });

  it('only uses “Elf” for Flick’s kind, never “Elbe”', () => {
    for (const l of lines) expect(l.text).not.toMatch(/Elbe/);
  });
});

describe('the end of the book', () => {
  it('rolls credits that end the third book', () => {
    expect(BOOK3_CREDITS).toMatch(/Ende des dritten Buches/);
    expect(BOOK3_CREDITS).toMatch(/Falscher Glaube/);
    expect(BOOK3_CREDITS).not.toMatch(/Vardis/);
  });

  it('starts the epilogue cured of the worst, with her staff, the fibula and both friends', () => {
    prepareE3('e3-epilog');
    expect(poisoned()).toBe(false);
    expect(hasOwnStaff()).toBe(true);
    expect(G.state.has('e3-ordensfibel')).toBe(true);
    expect(G.state.data.party).toEqual(['kyra', 'flick']);
    expect(G.state.is('e3-finished')).toBe(false);
  });
});

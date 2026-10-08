import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { pointInPoly } from '../../world/poly';
import { BOOK3_CREDITS } from './epilog-credits';
import {
  ELNON, ELNON_ANSWERS, ELNON_CHOICES, ELNON_END, END_ZONE, ENDING, FELDWEG_SPOT, FELDWEG_WALK, FINISHED_LINE, OPENING, SCHUTZ, SOMMER,
  SOMMER_ANSWERS, SOMMER_CHOICES, SOMMER_END, TALK_ORDER, TALK_ZONES, TRACK, TREE, TREE_BLOCK, nextTalk, talkFlag, talksDone, type Line,
} from './epilog-weg';
import { hasOwnStaff, poisoned, prepareE3 } from './shared';

afterEach(() => G.state.reset());

const inWalk = (at: readonly [number, number]) => FELDWEG_WALK.some(p => pointInPoly(at[0], at[1], p)) && !pointInPoly(at[0], at[1], TREE_BLOCK);

describe('the field track (e3-feldweg)', () => {
  it('keeps the track, the tree spot and the apparition’s place walkable', () => {
    for (const at of TRACK.slice(1, -1)) expect(inWalk(at), String(at)).toBe(true);
    for (const id of ['start', 'tree', 'valentus'] as const) expect(inWalk(FELDWEG_SPOT[id]), id).toBe(true);
  });

  it('lays the talk zones across the track in walking order, before the end of the walk', () => {
    expect(TALK_ZONES.map(z => z.id)).toEqual([...TALK_ORDER]);
    const cut = (poly: readonly (readonly [number, number])[]) => TRACK.some(at => pointInPoly(at[0], at[1], poly))
      || TRACK.slice(1).some((b, i) => { const a = TRACK[i]; return pointInPoly((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, poly); });
    for (const z of TALK_ZONES) expect(cut(z.poly), z.id).toBe(true);
    expect(cut(END_ZONE)).toBe(true);
    const ys = TALK_ZONES.map(z => Math.min(...z.poly.map(p => p[1])));
    expect([...ys].sort((a, b) => b - a)).toEqual(ys);
    expect(Math.min(...END_ZONE.map(p => p[1]))).toBeLessThan(Math.min(...ys));
  });

  it('never skips a talk', () => {
    expect(nextTalk()).toBe('sommer');
    G.state.set(talkFlag('sommer'));
    expect(nextTalk()).toBe('elnon');
    G.state.set(talkFlag('elnon'));
    G.state.set(talkFlag('schutz'));
    expect(talksDone()).toBe(true);
    expect(nextTalk()).toBeUndefined();
  });
});

describe('the talks', () => {
  const lines: readonly Line[] = [
    ...OPENING, ...SOMMER, ...SOMMER_ANSWERS.flat(), ...SOMMER_END, ...ELNON, ...ELNON_ANSWERS.flat(), ...ELNON_END, ...SCHUTZ, ...TREE, ...ENDING,
  ];

  it('fit one dialogue box each', () => {
    for (const l of lines) expect(l.text.length, l.text).toBeLessThanOrEqual(140);
    expect(FINISHED_LINE.length).toBeLessThanOrEqual(140);
    for (const c of [...SOMMER_CHOICES, ...ELNON_CHOICES]) expect(c.length, c).toBeLessThanOrEqual(80);
    expect(SOMMER_ANSWERS.length).toBe(SOMMER_CHOICES.length);
    expect(ELNON_ANSWERS.length).toBe(ELNON_CHOICES.length);
  });

  it('lets Lia learn of Elnon’s death here and comfort Kyra in every answer', () => {
    expect(ELNON.some(l => l.who === 'kyra' && /tot/.test(l.text))).toBe(true);
    expect(ELNON.some(l => l.who === 'kyra' && /gelogen/.test(l.text))).toBe(true);
    for (const a of ELNON_ANSWERS) expect(a.some(l => l.who === 'lia' && /nicht dein Wille/.test(l.text))).toBe(true);
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

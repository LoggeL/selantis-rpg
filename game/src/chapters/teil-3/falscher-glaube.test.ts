import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import {
  AFTER_BARGAIN, BACK_IN_BED, BARGAIN_LINE, BOOK_PASSAGES, canListen, STUDY_SECTIONS, unreadPassages,
} from './falscher-glaube-gespraech';
import { prepareE3 } from './shared';

afterEach(() => G.state.reset());

const allText = (): string[] => [
  ...STUDY_SECTIONS.flat().map(l => l.text),
  ...AFTER_BARGAIN, ...BACK_IN_BED,
  ...BOOK_PASSAGES.flatMap(p => [p.pick, p.book, p.thought]),
];

describe('e3-falscher-glaube: the conversation behind the study door', () => {
  it('has three sections in the documented order', () => {
    expect(STUDY_SECTIONS).toHaveLength(3);
    const joined = STUDY_SECTIONS.map(s => s.map(l => l.text).join(' '));
    expect(joined[0]).toMatch(/Aros/);
    expect(joined[0]).toMatch(/Wohl der Menschen/);
    expect(joined[1]).toMatch(/Keine Göttin/);
    expect(joined[1]).toMatch(/Tausende/);
    expect(joined[1]).toMatch(/Wald/);
    expect(joined[2]).toMatch(/Gwynn/);
    expect(joined[2]).toMatch(/Fahnenflucht/);
  });

  it('makes the bargain unmistakable: Ignatius offers Lia for Gwynn', () => {
    expect(BARGAIN_LINE.who).toBe('e2-ignatius');
    const i = STUDY_SECTIONS[2].indexOf(BARGAIN_LINE);
    expect(STUDY_SECTIONS[2][i - 1].text).toMatch(/Gwynn holen/);
    expect(BARGAIN_LINE.text).toMatch(/gehört das Mädchen Euch/);
    expect(STUDY_SECTIONS[2][i + 1].who).toBe('e3-grossmeister');
  });

  it('keeps every box short, uses German quotes and none of the forbidden names', () => {
    for (const t of allText()) {
      expect(t.length, t).toBeLessThanOrEqual(140);
      expect(t, t).not.toMatch(/Vardis|Elbe|Xenonia|"/);
    }
  });
});

describe('e3-falscher-glaube: the doctor’s book', () => {
  it('has three places to read, none of them a list of objects', () => {
    expect(BOOK_PASSAGES.map(p => p.key)).toEqual(['anfang', 'ersten', 'seite']);
    for (const p of BOOK_PASSAGES) expect(p.book).not.toMatch(/Horn|Schale|Reif|Krone|Ring /);
    const read = new Set<string>();
    expect(unreadPassages(read)).toHaveLength(3);
    read.add('ersten');
    expect(unreadPassages(read).map(p => p.key)).toEqual(['anfang', 'seite']);
  });
});

describe('e3-falscher-glaube: listening rule', () => {
  it('starts a section only at the door with the guard far away, after a pass from the second on', () => {
    expect(canListen({ atDoor: true, guardFar: true, passedSinceLast: false, section: 0 })).toBe(true);
    expect(canListen({ atDoor: false, guardFar: true, passedSinceLast: true, section: 1 })).toBe(false);
    expect(canListen({ atDoor: true, guardFar: false, passedSinceLast: true, section: 1 })).toBe(false);
    expect(canListen({ atDoor: true, guardFar: true, passedSinceLast: false, section: 1 })).toBe(false);
    expect(canListen({ atDoor: true, guardFar: true, passedSinceLast: true, section: 2 })).toBe(true);
  });
});

describe('e3-falscher-glaube: direct entry and hand-over', () => {
  it('starts with Lia unbound, staff still in the armoury, not yet having eavesdropped', () => {
    prepareE3('e3-falscher-glaube');
    expect(G.state.is('e3-gelauscht')).toBe(false);
    expect(G.state.flag('e3-stab-ort')).toBe('waffenkammer');
  });

  it('hands the documented result to e3-kyras-fluchtweg', () => {
    prepareE3('e3-kyras-fluchtweg');
    expect(G.state.is('e3-gelauscht')).toBe(true);
    expect(G.state.data.clues).toEqual(expect.arrayContaining(['e3-hinweis-gwynn']));
  });
});

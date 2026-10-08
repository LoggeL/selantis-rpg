import { describe, expect, it } from 'vitest';
import type { ChapterEntry } from '../core/registry';
import { buildBooks, defaultSelection, groupsOf, WORKSHOP } from './chapterBooks';

const scene = (id: string) => ({ id, title: id, start: () => {} });
const chapter = (o: Partial<ChapterEntry> & Pick<ChapterEntry, 'id' | 'order'>, ids: string[]): ChapterEntry =>
  ({ numeral: o.id, title: o.id, ...o, scenes: ids.map(scene) });

const prolog = chapter({ id: 'prolog', order: 0 }, ['p1', 'p2']);
const k1 = chapter({ id: 'kapitel-1', order: 1 }, ['a', 'b']);
const t2 = chapter({ id: 'teil-2', order: 6, book: 2, sections: [
  { numeral: '1', title: 'Eins', scenes: ['x1', 'x2'] },
  { numeral: '2', title: 'Zwei', scenes: ['x3'] },
] }, ['x1', 'x2', 'x3', 'x4']);
const dev = chapter({ id: 'dev', order: 900, hidden: true }, ['d']);

describe('chapter select books', () => {
  it('puts prolog and chapters without a book into book one, dev chapters into the workshop at the end', () => {
    const books = buildBooks([prolog, k1, t2, dev]);
    expect(books.map(b => b.id)).toEqual([1, 2, WORKSHOP]);
    expect(books[0].groups.map(g => g.key)).toEqual(['prolog', 'kapitel-1']);
    expect(books[0].info.label).toBe('Erstes Buch');
  });

  it('splits a chapter into its sections and appends scenes no section lists to the last one', () => {
    const groups = groupsOf(t2);
    expect(groups.map(g => g.key)).toEqual(['teil-2#1', 'teil-2#2']);
    expect(groups[1].scenes.map(s => s.id)).toEqual(['x3', 'x4']);
    expect(groups[0].chapter).toBe(t2);
  });

  it('opens at the saved scene if reached, else at the latest reached scene, else at the first group', () => {
    const books = buildBooks([prolog, k1, t2]);
    const reached = new Set(['p1', 'p2', 'a', 'x1']);
    const open = (id: string) => reached.has(id);
    expect(defaultSelection(books, open, 'a')).toEqual({ book: 1, group: 'kapitel-1' });
    expect(defaultSelection(books, open)).toEqual({ book: 2, group: 'teil-2#1' });
    expect(defaultSelection(books, open, 'x3')).toEqual({ book: 2, group: 'teil-2#1' });
    expect(defaultSelection(books, () => false)).toEqual({ book: 1, group: 'prolog' });
  });
});

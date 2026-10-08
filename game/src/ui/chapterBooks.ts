// Chapter select model: the registered chapters grouped into the three books of the chronicle, long chapters split
// into their sections. Pure data (no DOM), so the grouping and the default selection are unit-tested.
import type { ChapterEntry, SceneEntry } from '../core/registry';

export interface BookInfo { label: string; title: string }

/** The books of the chronicle; dev chapters go to the workshop (only with includeHidden). */
export const BOOKS: Record<number, BookInfo> = {
  1: { label: 'Erstes Buch', title: 'Das Buch der Schwestern' },
  2: { label: 'Zweites Buch', title: 'Letzte Hoffnung' },
  3: { label: 'Drittes Buch', title: 'Falscher Glaube' },
};
export const WORKSHOP = 0;
const WORKSHOP_INFO: BookInfo = { label: 'Werkstatt', title: 'Dev-Kapitel' };

/** Plate id of a group's illustration: `chap-<chapter>` or `chap-<chapter>-<section>` (assets/cut, spoiler-free). */
export function artId(groupKey: string): string {
  return `chap-${groupKey.replace('#', '-')}`;
}

/** Painted map backgrounds shown until a group's own illustration exists (places only, no events). */
export const FALLBACK_ART: Record<string, string> = {
  prolog: 'prolog-rat', 'kapitel-1': 'k1-wiese', 'kapitel-2': 'k2-strasse', 'kapitel-3': 'k3-eber', 'kapitel-4': 'k4-lager',
  'kapitel-5': 'k5-regenwald',
  'teil-2#1': 'k4-waldpfad', 'teil-2#2': 'k4-lager', 'teil-2#3': 'e2-ignatius-lager', 'teil-2#4': 'e2-herbsthang',
  'teil-3#1': 'e3-lichtwald', 'teil-3#2': 'e3-landstrasse', 'teil-3#3': 'e3-keller', 'teil-3#4': 'e3-innenwelt',
  'teil-3#5': 'e3-ritualhuegel', 'teil-3#6': 'e3-feldweg',
};

/** One entry of the list: a whole chapter or one section of a long chapter. */
export interface ChapterGroup {
  key: string;
  chapter: ChapterEntry;
  numeral: string;
  title: string;
  subtitle?: string;
  scenes: SceneEntry[];
}

export interface Book {
  id: number;
  info: BookInfo;
  groups: ChapterGroup[];
}

/** Book of a chapter: its own `book`, the workshop for dev chapters, otherwise book one (prolog, chapters I–V). */
export function bookOf(chapter: ChapterEntry): number {
  if (chapter.hidden) return WORKSHOP;
  return chapter.book ?? 1;
}

/** The chapter's entries: its sections (scenes by id; scenes no section names are appended to the last one) or itself. */
export function groupsOf(chapter: ChapterEntry): ChapterGroup[] {
  const whole: ChapterGroup = { key: chapter.id, chapter, numeral: chapter.numeral, title: chapter.title, subtitle: chapter.subtitle, scenes: chapter.scenes };
  if (!chapter.sections?.length) return [whole];
  const byId = new Map(chapter.scenes.map(s => [s.id, s] as const));
  const used = new Set<string>();
  const groups = chapter.sections.map((sec, i): ChapterGroup => {
    const scenes = sec.scenes.map(id => byId.get(id)).filter((s): s is SceneEntry => Boolean(s) && !used.has(s!.id));
    for (const s of scenes) used.add(s.id);
    return { key: `${chapter.id}#${i + 1}`, chapter, numeral: sec.numeral, title: sec.title, subtitle: sec.subtitle, scenes };
  });
  const rest = chapter.scenes.filter(s => !used.has(s.id));
  if (rest.length) groups[groups.length - 1].scenes = [...groups[groups.length - 1].scenes, ...rest];
  return groups.filter(g => g.scenes.length);
}

/** Chapters grouped into books, in book order; books without chapters are left out. */
export function buildBooks(chapters: readonly ChapterEntry[]): Book[] {
  const books = new Map<number, Book>();
  for (const chapter of chapters) {
    const id = bookOf(chapter);
    let book = books.get(id);
    if (!book) { book = { id, info: id === WORKSHOP ? WORKSHOP_INFO : (BOOKS[id] ?? { label: `Buch ${id}`, title: '' }), groups: [] }; books.set(id, book); }
    book.groups.push(...groupsOf(chapter));
  }
  // Story books first (1, 2, 3 …), the workshop last.
  return [...books.values()].sort((a, b) => (a.id === WORKSHOP ? 1e9 : a.id) - (b.id === WORKSHOP ? 1e9 : b.id));
}

/**
 * Where the select opens: the group of `current` (e.g. the saved scene) if it is open, otherwise the group of the
 * latest reached scene in story order, otherwise the first group of the first book.
 */
export function defaultSelection(books: Book[], open: (sceneId: string) => boolean, current?: string): { book: number; group: string } | null {
  let found: { book: number; group: string } | null = null;
  for (const book of books) {
    if (book.id === WORKSHOP) continue;
    for (const g of book.groups) {
      for (const s of g.scenes) {
        if (!open(s.id)) continue;
        if (s.id === current) return { book: book.id, group: g.key };
        found = { book: book.id, group: g.key };
      }
    }
  }
  if (found) return found;
  const first = books[0]?.groups[0];
  return first ? { book: books[0].id, group: first.key } : null;
}

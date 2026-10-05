// Packing puzzle rules (pure, tested): the leather bag from the hook beside the oven has room for a few extras
// next to the fixed provisions. What Lia packs changes later options (DESIGN.md §7.4 `trauer`).

/** Always packed (the contract for Kapitel II+): provisions, clothing, Father's secret compartment, Mother's tincture. */
export const FIXED: { id: string; n: number }[] = [
  { id: 'bread', n: 2 }, { id: 'cheese', n: 1 }, { id: 'bacon', n: 1 }, { id: 'waterskin', n: 1 },
  { id: 'blanket', n: 1 }, { id: 'cloak', n: 1 }, { id: 'coins', n: 1 }, { id: 'tincture', n: 1 }, { id: 'dagger', n: 1 },
];

/** Free room for extras (bread, cheese, bacon and the rest already take most of the bag). */
export const CAPACITY = 4;

export interface Extra {
  id: string;
  /** Room it takes. */
  size: number;
  /** Lia's reasoning shown on the card. */
  note: string;
  /** Where it is when not in reach yet (shown greyed out). */
  missing?: string;
}

export const EXTRAS: Extra[] = [
  { id: 'book-herbs', size: 2, note: 'Mutters dickes Kräuterlexikon. Schwer – aber wer weiß, was mir unterwegs zustößt.' },
  { id: 'book-alana', size: 2, note: 'Ich muss wissen, wie es mit Alana und Riccard ausgeht.', missing: 'Liegt noch irgendwo in der Böschung …' },
  { id: 'tinder', size: 1, note: 'Trockene Späne und Zunderschwamm. Ohne Zunder wird Feuermachen mühsam.' },
  { id: 'honey-cake', size: 1, note: 'Vaters letzter Honig-Apfelkuchen.', missing: 'Hab ich nicht.' },
  { id: 'apple', size: 1, note: 'Ein Apfel von der Wiese.', missing: 'Hab ich nicht.' },
];

export type Selection = Record<string, number>;

/** Room used by a selection. */
export function used(sel: Selection): number {
  let n = 0;
  for (const e of EXTRAS) n += (sel[e.id] ?? 0) * e.size;
  return n;
}

/** How many of an extra Lia owns (apples can be several). */
export type Owned = (id: string) => number;

/** True if one more of `id` fits and is available. */
export function canAdd(sel: Selection, id: string, owned: Owned): boolean {
  const e = EXTRAS.find(x => x.id === id);
  if (!e) return false;
  if ((sel[id] ?? 0) >= owned(id)) return false;
  return used(sel) + e.size <= CAPACITY;
}

export function add(sel: Selection, id: string, owned: Owned): Selection {
  return canAdd(sel, id, owned) ? { ...sel, [id]: (sel[id] ?? 0) + 1 } : sel;
}

export function remove(sel: Selection, id: string): Selection {
  const n = (sel[id] ?? 0) - 1;
  const next = { ...sel };
  if (n > 0) next[id] = n; else delete next[id];
  return next;
}

/**
 * Inventory changes when the bag is closed: fixed items are ensured, unpacked extras are left behind
 * (removed from the inventory), packed ones stay. Returns { give, take } as item → count.
 */
export function settle(sel: Selection, owned: Owned, has: (id: string) => number): { give: Record<string, number>; take: Record<string, number> } {
  const give: Record<string, number> = {};
  const take: Record<string, number> = {};
  for (const f of FIXED) {
    const missing = f.n - has(f.id);
    if (missing > 0) give[f.id] = missing;
  }
  for (const e of EXTRAS) {
    const keep = Math.min(sel[e.id] ?? 0, owned(e.id));
    const drop = has(e.id) - keep;
    if (drop > 0) take[e.id] = drop;
  }
  return { give, take };
}

/** Lia's verdict on the finished bag: hints at the consequences without spelling out game rules. */
export function verdict(sel: Selection): string[] {
  const lines: string[] = [];
  if (!sel.tinder) lines.push('Kein Zunder … Ich werde schon irgendwie Feuer machen. In Büchern klappt das immer.');
  if (sel['book-herbs']) lines.push('Mutters Lexikon wiegt eine Tonne. Aber ihre Handschrift ist darin.');
  if (sel['book-alana']) lines.push('Alana kommt mit. Ich lese es zu Ende, das hab ich mir versprochen.');
  if (!sel['book-herbs'] && !sel['book-alana']) lines.push('Ohne ein einziges Buch. Wer hätte das gedacht.');
  return lines;
}

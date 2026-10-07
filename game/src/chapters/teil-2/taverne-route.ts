// e2-taverne: the route deduction at the table (pure logic, tested in taverne-route.test.ts).
// Three sources in the Goldener Eber each give one piece of today's way to the Brotherhood's camp; the table choice
// is judged against what Lia actually heard. Wrong picks are corrected by Flick without any penalty.

/** Clue ids of the three sources (registered in taverne.ts). */
export const ROUTE_CLUES = {
  craupor: 'e2-hinweis-craupor',
  rinde: 'e2-hinweis-rinde',
  eiche: 'e2-hinweis-eiche',
} as const;

export type RouteClue = typeof ROUTE_CLUES[keyof typeof ROUTE_CLUES];
export type RouteId = 'handelsstrasse' | 'augenbinde' | 'norden' | 'sueden';
export type RouteVerdict = 'richtig' | 'luecke' | 'unbelegt' | 'binde' | 'widerspruch';

export interface RouteOption {
  id: RouteId;
  text: string;
  /** Clues that support this option (shown as a tag when Lia has them). */
  supports: RouteClue[];
}

export const ROUTES: readonly RouteOption[] = [
  { id: 'handelsstrasse', text: '„Die Handelsstraße nach Westen. Da kommen alle Neuigkeiten her.“', supports: [] },
  { id: 'augenbinde', text: '„Den Weg, den Foltan mich damals geführt hat.“', supports: [] },
  { id: 'norden', text: '„Nach Norden zur umgestürzten Eiche, dann am Bach den Kerben nach.“', supports: [ROUTE_CLUES.eiche, ROUTE_CLUES.rinde] },
  { id: 'sueden', text: '„Am Bach entlang nach Süden. Bäche führen immer irgendwohin.“', supports: [] },
];

/** Short names of the sources for choice tags. */
const SOURCE: Record<RouteClue, string> = {
  [ROUTE_CLUES.craupor]: 'Craupor',
  [ROUTE_CLUES.rinde]: 'Fallensteller',
  [ROUTE_CLUES.eiche]: 'Schankmaid',
};

/** How many of the three sources Lia has heard. */
export function sourcesFound(clues: readonly string[]): number {
  return Object.values(ROUTE_CLUES).filter(c => clues.includes(c)).length;
}

/** Tag text for a choice: the sources Lia heard that back this route (undefined when none). */
export function routeTag(option: RouteOption, clues: readonly string[]): string | undefined {
  const names = option.supports.filter(c => clues.includes(c)).map(c => SOURCE[c]);
  return names.length ? names.join(' · ') : undefined;
}

/**
 * Judges a route pick. Only the northern route is right, and only when Lia knows both of its halves (the oak from the
 * barmaid, the bark marks from the trapper); otherwise she would be guessing. Each wrong pick names why.
 */
export function judgeRoute(id: RouteId, clues: readonly string[]): RouteVerdict {
  switch (id) {
    case 'norden':
      return clues.includes(ROUTE_CLUES.eiche) && clues.includes(ROUTE_CLUES.rinde) ? 'richtig' : 'luecke';
    case 'augenbinde': return 'binde';
    case 'sueden': return clues.includes(ROUTE_CLUES.eiche) ? 'widerspruch' : 'unbelegt';
    default: return 'unbelegt';
  }
}

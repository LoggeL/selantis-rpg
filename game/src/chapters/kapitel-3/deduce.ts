// Pure logic of the clue board in the Golden Boar (Lia combines two clues into a deduction). Tested in deduce.test.ts.

export interface Deduction {
  /** Resulting clue id (journal). */
  id: string;
  /** The two clue ids that have to be combined (order does not matter). */
  pair: readonly [string, string];
  /** Lia's line when it clicks. */
  line: string;
}

export const DEDUCTIONS: readonly Deduction[] = [
  { id: 'k3-schluss-pfeiler', pair: ['k3-seilfasern', 'k3-zwerg'], line: 'Das Mädchen am Pfeiler … die Fasern in Sitzhöhe. Kyra hat genau hier gesessen. Gefesselt.' },
  { id: 'k3-schluss-stall', pair: ['k3-kette', 'k3-haarband'], line: 'Die Kette. Und ihr Haarband daneben. Sie haben sie im Stall angekettet wie ein Tier.' },
  { id: 'k3-schluss-hauptmann', pair: ['k3-schminke', 'k3-wette'], line: 'Schminke für den Hauptmann, Wetten auf ihr Leben. Sie brauchen sie lebend. Noch.' },
];

/** Final conclusion, unlocked automatically once all three deductions are made. */
export const FINAL = 'k3-schluss-lebt';

/** Clues that take part in the board (the "Fünf Mann" fragment and the sack are supporting evidence only). */
export const BOARD_CLUES = ['k3-seilfasern', 'k3-zwerg', 'k3-kette', 'k3-haarband', 'k3-schminke', 'k3-wette'] as const;

/** The deduction made by combining a and b, or null when they do not belong together. */
export function combine(a: string, b: string): Deduction | null {
  if (a === b) return null;
  return DEDUCTIONS.find(d => (d.pair[0] === a && d.pair[1] === b) || (d.pair[0] === b && d.pair[1] === a)) ?? null;
}

/** Deductions still possible with the clues found so far (both parts present, result not yet known). */
export function available(found: readonly string[]): Deduction[] {
  return DEDUCTIONS.filter(d => !found.includes(d.id) && d.pair.every(p => found.includes(p)));
}

/** True when every deduction is made (the final conclusion follows). */
export function complete(found: readonly string[]): boolean {
  return DEDUCTIONS.every(d => found.includes(d.id));
}

/**
 * Lia has evidence that contradicts Foltan's „Craupor weiß nichts.“: the ribbon (the hard proof) plus at least one
 * deduction that places Kyra in the inn — or the overheard „Fünf Mann“ at the counter.
 */
export function contradictsFoltan(found: readonly string[], hasRibbon: boolean): boolean {
  const placed = found.includes('k3-schluss-pfeiler') || found.includes('k3-schluss-stall') || found.includes(FINAL);
  return (hasRibbon && placed) || found.includes('k3-fuenf');
}

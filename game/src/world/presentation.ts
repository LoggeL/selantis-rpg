/** Figure sizes calibrated against usable furniture in the painted backgrounds.
 * These change only rendering, never speeds, guard ranges or the navigation grid.
 * A map's explicit spriteScale remains authoritative.
 */
const FIGURE_SCALE: Readonly<Record<string, number>> = {
  'prolog-zuflucht': 1.35,
  'prolog-rat': 1.5,
  'k1-stube': 2.4,
  'k1-hof': 1.25,
  'k2-waldweg': 1.3,
  'k3-eber': 1.25,
  'k3-stall': 1.6,
  'k4-lager': 1.4,
  'e2-ignatius-lager': 1.5,
  'e2-kerker': 1.6,
  'e2-halle': 1.6,
  'e3-gastzimmer': 2.2,
  'e3-ordenssaal': 1.6,
  'e3-ordenshaus': 1.7,
  'e3-keller': 1.5,
  'e3-falsches-lager': 1.55,
  'e3-waldpfad': 1.1,
};

export function figureScale(background: string | undefined): number {
  return background ? FIGURE_SCALE[background] ?? 1 : 1;
}

/** A narrow silhouette edge keeps people readable in the detailed autumn foliage. */
export function needsFigureEdge(background: string | undefined): boolean {
  return background === 'k5-faehrte' || background === 'e3-waldpfad';
}

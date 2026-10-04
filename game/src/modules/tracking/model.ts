export type ClueId = 'hooves' | 'bark' | 'ground';
export type RouteId = 'back' | 'forward';
export type TrackingState = {
  phase: 'inspect' | 'failed' | 'solved' | 'cancelled';
  examined: ClueId[];
  selected: RouteId | null;
  attempts: number;
  feedback: string;
  detail: string;
};
/** The clues are a gameplay adaptation, not additional film testimony. */
export const TRACKING_CLUES = [
  { id: 'hooves' as const, title: 'Hufabdrücke', at: [43, 64],
    detail: 'Die schmalen Spitzen der Hufabdrücke zeigen zum hellen Weg rechts. Hinter der Wurzel setzt sich dieselbe Spur fort.' },
  { id: 'bark' as const, title: 'Rindenspur', at: [49, 34],
    detail: 'An der rechten Seite der Wurzel ist frische Rinde abgeschabt. Darunter liegt heller Abrieb, noch nicht vom Regen verteilt.' },
  { id: 'ground' as const, title: 'Boden am Waldrand', at: [22, 55],
    detail: 'Links am Waldrand ist die feuchte Erde glatt. Hier hat niemand eine neue Hufspur hinterlassen.' },
] as const;
export const TRACKING_ROUTES = [
  { id: 'back' as const, label: 'Links am Waldrand suchen' },
  { id: 'forward' as const, label: 'Rechts hinter der Wurzel folgen' },
] as const;

export class TrackingModel {
  private current: TrackingState = { phase: 'inspect', examined: [], selected: null, attempts: 0,
    feedback: 'Untersuche die Spur und die Wurzel. Welcher Weg passt zu beiden?', detail: '' };
  get state(): Readonly<TrackingState> { return this.current; }
  snapshot(): TrackingState { return { ...this.current, examined: [...this.current.examined] }; }
  inspect(id: ClueId): void {
    if (this.current.phase === 'solved' || this.current.phase === 'cancelled') return;
    const clue = TRACKING_CLUES.find(clue => clue.id === id)!;
    if (!this.current.examined.includes(id)) this.current.examined.push(id);
    this.current.detail = clue.detail;
  }
  select(id: RouteId): void {
    if (this.current.phase !== 'inspect') return;
    this.current.selected = id;
  }
  choose(id: RouteId): boolean {
    if (this.current.phase !== 'inspect') return false;
    this.current.selected = id;
    if (!this.current.examined.includes('hooves') || !this.current.examined.includes('bark')) {
      this.current.feedback = 'Das wäre geraten. Prüfe zuerst die Hufabdrücke und die Rindenspur.';
      return false;
    }
    this.current.attempts++;
    if (id === 'back') {
      this.current.phase = 'failed';
      this.current.feedback = 'Hier verliert sich die Spur. Die Hufspitzen und der frische Rindenabrieb weisen zur anderen Seite. Zurück zur Wurzel.';
      return false;
    }
    this.current.phase = 'solved';
    this.current.feedback = 'Die Hufabdrücke und der frische Abrieb passen zusammen. Hinter der Wurzel ist die Spur wieder zu erkennen.';
    return true;
  }
  retry(): void {
    if (this.current.phase !== 'failed') return;
    this.current.phase = 'inspect'; this.current.selected = null;
    this.current.feedback = 'Die untersuchten Spuren bleiben bekannt. Vergleiche sie und wähle den Weg erneut.';
  }
  cancel(): void { if (this.current.phase !== 'solved') this.current.phase = 'cancelled'; }
}

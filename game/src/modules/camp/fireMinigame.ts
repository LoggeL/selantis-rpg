export const FIRE_HEAT_REQUIRED = 6;
export const FIRE_MARKER_PERIOD_MS = 3200;

export interface FireMinigameState {
  reducedMotion: boolean;
  elapsedMs: number;
  heat: number;
  strokes: number;
  hits: number;
  misses: number;
  finished: boolean;
}

export function createFireMinigame(reducedMotion: boolean): FireMinigameState {
  return { reducedMotion, elapsedMs: 0, heat: 0, strokes: 0, hits: 0, misses: 0, finished: false };
}

export function tickFireMinigame(state: FireMinigameState, deltaMs: number): void {
  if (state.finished || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
  state.elapsedMs += deltaMs;
}

export function fireMarkerPosition(state: FireMinigameState): number {
  if (state.reducedMotion) return 0.5;
  const phase = (state.elapsedMs % FIRE_MARKER_PERIOD_MS) / FIRE_MARKER_PERIOD_MS;
  return phase <= 0.5 ? phase * 2 : (1 - phase) * 2;
}

export function fireHitBand(_state: FireMinigameState): readonly [number, number] {
  return [0.31, 0.69];
}

/** The scene must require release between strokes, so held keys never auto-repeat. */
export function strokeFireMinigame(state: FireMinigameState): 'hit' | 'miss' | 'complete' {
  if (state.finished) return 'complete';
  state.strokes++;
  const marker = fireMarkerPosition(state);
  const [start, end] = fireHitBand(state);
  if (marker < start || marker > end) {
    state.misses++;
    state.heat = Math.max(0, state.heat - 1);
    return 'miss';
  }
  state.hits++;
  state.heat = Math.min(FIRE_HEAT_REQUIRED, state.heat + 1);
  state.finished = state.heat === FIRE_HEAT_REQUIRED;
  return state.finished ? 'complete' : 'hit';
}

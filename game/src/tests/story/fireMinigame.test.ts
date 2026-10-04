import { describe, expect, it } from 'vitest';
import { createFireMinigame, fireHitBand, fireMarkerPosition, FIRE_HEAT_REQUIRED, FIRE_MARKER_PERIOD_MS, strokeFireMinigame, tickFireMinigame } from "../../modules/camp/fireMinigame";

describe('Feuer mit Feuerstein und Zunder', () => {
  it('bewegt den Marker gleichmäßig hin und zurück, unabhängig von Bildrate und Zyklus', () => {
    const state = createFireMinigame(false);
    expect(fireMarkerPosition(state)).toBe(0);
    tickFireMinigame(state, 800);
    expect(fireMarkerPosition(state)).toBe(0.5);
    tickFireMinigame(state, 800);
    expect(fireMarkerPosition(state)).toBe(1);
    tickFireMinigame(state, 800);
    expect(fireMarkerPosition(state)).toBe(0.5);
    tickFireMinigame(state, FIRE_MARKER_PERIOD_MS * 12 + 800);
    expect(fireMarkerPosition(state)).toBe(0);
  });

  it('gibt auf beiden Durchläufen mindestens 600 Millisekunden zum Treffen', () => {
    const state = createFireMinigame(false);
    const [start, end] = fireHitBand(state);
    expect((end - start) * FIRE_MARKER_PERIOD_MS / 2).toBeGreaterThanOrEqual(600);
    for (const elapsedMs of [497, 800, 1103, 2097, 2400, 2703]) {
      state.elapsedMs = elapsedMs;
      expect(strokeFireMinigame(state)).toBe(state.hits === FIRE_HEAT_REQUIRED ? 'complete' : 'hit');
    }
    expect(state.finished).toBe(true);
  });

  it('nimmt bei einem Fehlversuch nur einen Funken zurück und bleibt mindestens bei null', () => {
    const state = createFireMinigame(false);
    expect(strokeFireMinigame(state)).toBe('miss');
    expect(state.heat).toBe(0);
    tickFireMinigame(state, 800);
    strokeFireMinigame(state);
    strokeFireMinigame(state);
    expect(state.heat).toBe(2);
    tickFireMinigame(state, 800);
    expect(strokeFireMinigame(state)).toBe('miss');
    expect(state.heat).toBe(1);
    expect(state).toMatchObject({ hits: 2, misses: 2, strokes: 4, finished: false });
  });

  it('zündet erst nach sechs Treffern und lässt einen abgeschlossenen Versuch unverändert', () => {
    const state = createFireMinigame(false);
    tickFireMinigame(state, 800);
    for (let i = 0; i < FIRE_HEAT_REQUIRED - 1; i++) {
      expect(strokeFireMinigame(state)).toBe('hit');
      expect(state.finished).toBe(false);
    }
    expect(strokeFireMinigame(state)).toBe('complete');
    const completed = { ...state };
    tickFireMinigame(state, 1000);
    expect(strokeFireMinigame(state)).toBe('complete');
    expect(state).toEqual(completed);
  });

  it('verliert weder durch Abwarten noch durch pausierte oder ungültige Zeitschritte Wärme', () => {
    const state = createFireMinigame(false);
    tickFireMinigame(state, 800);
    strokeFireMinigame(state);
    tickFireMinigame(state, FIRE_MARKER_PERIOD_MS * 100);
    expect(state.heat).toBe(1);
    const waiting = { ...state };
    for (const delta of [0, -16, NaN, Infinity]) tickFireMinigame(state, delta);
    expect(state).toEqual(waiting);
    expect(state.finished).toBe(false);
  });

  it('hält bei reduzierter Bewegung den Marker im Ziel und zählt sechs bewusste Schläge', () => {
    const state = createFireMinigame(true);
    for (let i = 1; i <= FIRE_HEAT_REQUIRED; i++) {
      tickFireMinigame(state, i * 1234);
      expect(fireMarkerPosition(state)).toBe(0.5);
      expect(strokeFireMinigame(state)).toBe(i === FIRE_HEAT_REQUIRED ? 'complete' : 'hit');
    }
    expect(state).toMatchObject({ heat: 6, hits: 6, misses: 0, strokes: 6, finished: true });
  });
});

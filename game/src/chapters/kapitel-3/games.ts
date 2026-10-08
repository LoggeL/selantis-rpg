// Pure rules of the Kapitel III stake minigame „Der Pflock“ (kyra), tested in games.test.ts: rock the stake in time
// with the soldiers' drum; off-beat tugs make noise.

// ------------------------------------------------------------------------------------------------ Der Pflock

export interface StakeState {
  /** How loose the stake is 0..1 (1 = pulled out). */
  loose: number;
  /** Noise 0..1; at 1 a soldier looks over. */
  noise: number;
  /** Seconds left while a soldier is looking (pressing now is caught). */
  watch: number;
  /** Hits in a row (bonus). */
  combo: number;
}

export const stakeStart = (): StakeState => ({ loose: 0, noise: 0, watch: 0, combo: 0 });

/** Timing window (ms) around a drum beat that counts as „on the beat“. */
export const BEAT_WINDOW_MS = 170;

/** Distance (ms) from `at` to the closest drum beat (last or next). */
export function beatOffset(at: number, lastBeatAt: number, nextBeatAt: number): number {
  return Math.min(Math.abs(at - lastBeatAt), Math.abs(nextBeatAt - at));
}

export type TugResult = 'hit' | 'miss' | 'rest' | 'caught';

/**
 * A tug at time `at`. `rest` = the soldiers are drinking (no drum covers the noise).
 * Returns the new state and what happened.
 */
export function stakeTug(s: StakeState, at: number, lastBeatAt: number, nextBeatAt: number, rest: boolean): { state: StakeState; result: TugResult } {
  if (s.watch > 0) return { state: { ...s, loose: Math.max(0, s.loose - 0.22), combo: 0, noise: 0.5, watch: 0 }, result: 'caught' };
  if (rest) return { state: { ...s, noise: Math.min(1, s.noise + 0.45), combo: 0 }, result: 'rest' };
  if (beatOffset(at, lastBeatAt, nextBeatAt) <= BEAT_WINDOW_MS) {
    const combo = s.combo + 1;
    const gain = 0.065 + Math.min(combo, 6) * 0.006;
    return { state: { ...s, loose: Math.min(1, s.loose + gain), combo, noise: Math.max(0, s.noise - 0.04) }, result: 'hit' };
  }
  return { state: { ...s, noise: Math.min(1, s.noise + 0.3), combo: 0 }, result: 'miss' };
}

/** Time passes: noise fades, a soldier starts/stops watching. Returns 'look' when a soldier turns round. */
export function stakeStep(s: StakeState, dt: number): { state: StakeState; event: 'look' | 'away' | null } {
  if (s.watch > 0) {
    const watch = Math.max(0, s.watch - dt);
    return { state: { ...s, watch, noise: watch === 0 ? 0.35 : s.noise }, event: watch === 0 ? 'away' : null };
  }
  if (s.noise >= 1) return { state: { ...s, watch: 2.2, combo: 0 }, event: 'look' };
  return { state: { ...s, noise: Math.max(0, s.noise - dt * 0.07) }, event: null };
}

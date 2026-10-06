// Pure rules of the two Kapitel III minigames (tested in games.test.ts):
//  * „Sanft pusten“ (leselager): adjust airflow over Azar's glowing tinder; keep it inside the glow zone.
//  * „Der Pflock“ (kyra): rock the stake in time with the soldiers' drum; off-beat tugs make noise.

// ------------------------------------------------------------------------------------------------ Sanft pusten

export interface BlowConfig {
  /** Breath zone (0..1) in which the ember grows. */
  lo: number;
  hi: number;
  /** Seconds of breath inside the zone until the tinder catches. */
  needSec: number;
}

/** With Lia's own dry tinder the zone is wider and the flame catches faster. */
export function blowConfig(withTinder: boolean): BlowConfig {
  return withTinder ? { lo: 0.3, hi: 0.82, needSec: 2.2 } : { lo: 0.42, hi: 0.74, needSec: 3.2 };
}

export interface BlowState {
  /** Current breath strength 0..1. */
  breath: number;
  /** Ember progress 0..1 (1 = flame). */
  ember: number;
  /** Seconds the breath has been above the zone (too strong). */
  over: number;
  /** Zone drift from the wind (added to lo/hi). */
  drift: number;
  time: number;
}

export const blowStart = (): BlowState => ({ breath: 0, ember: 0, over: 0, drift: 0, time: 0 });

export type BlowEvent = 'puff' | 'catch' | null;

/** Directional airflow adjustment. With no adjustment the breath slowly weakens. */
export function blowStep(s: BlowState, dt: number, adjustment: number, cfg: BlowConfig): { state: BlowState; event: BlowEvent } {
  const time = s.time + dt;
  const drift = Math.sin(time * 0.9) * 0.06 + Math.sin(time * 2.3) * 0.025; // gusts move the zone a little
  const breath = Math.max(0, Math.min(1, s.breath + (adjustment === 0 ? -0.065 : adjustment * 0.7) * dt));
  const lo = cfg.lo + drift, hi = cfg.hi + drift;
  let ember = s.ember;
  let over = breath > hi ? s.over + dt : 0;
  let event: BlowEvent = null;
  if (breath >= lo && breath <= hi) ember += dt / cfg.needSec;
  else if (breath < lo) ember -= dt * 0.08;
  if (over > 0.35) { // blown out: the glow dies down, smoke
    ember = Math.max(0, ember - 0.35);
    over = 0;
    event = 'puff';
    return { state: { breath: 0.15, ember, over, drift, time }, event };
  }
  ember = Math.max(0, Math.min(1, ember));
  if (ember >= 1) event = 'catch';
  return { state: { breath, ember, over, drift, time }, event };
}

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

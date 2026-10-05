// Pure rules of the fire-drilling timing minigame (erstes-lager). No DOM, no Phaser: tested in feuerLogic.test.ts.
//
// A needle sweeps back and forth over a track (0..1). Pressing while it is inside the bright zone adds heat, a
// press outside is a slip. Heat cools down over time. Full heat = ember = fire. Three slips end the attempt.
// Without tinder the zone is narrower, the needle faster and the heat cools quicker (DESIGN §7.4: harder).
// After the third failed attempt a secret turquoise spark lights the fire anyway (Urmacht hint, Adaption).

export interface FireConfig {
  /** Width of the bright zone as a fraction of the track. */
  zone: number;
  /** Needle speed in track widths per second. */
  speed: number;
  /** Heat gained per good press (0..100). */
  gain: number;
  /** Heat lost per second. */
  cool: number;
  /** Heat lost per slip. */
  slipLoss: number;
  /** Slips that end an attempt. */
  maxSlips: number;
  /** Failed attempts after which the spark jumps over. */
  sparkAfter: number;
}

export function fireConfig(tinder: boolean): FireConfig {
  return tinder
    ? { zone: 0.24, speed: 0.85, gain: 26, cool: 3, slipLoss: 8, maxSlips: 3, sparkAfter: 3 }
    : { zone: 0.13, speed: 1.2, gain: 17, cool: 6, slipLoss: 12, maxSlips: 3, sparkAfter: 3 };
}

export interface FireState {
  /** Needle position 0..1. */
  pos: number;
  /** +1 moving right, -1 moving left. */
  dir: 1 | -1;
  /** Zone centre 0..1. */
  zoneAt: number;
  heat: number;
  slips: number;
  /** Failed attempts so far. */
  failed: number;
  /** Good presses in the current attempt. */
  hits: number;
}

export type PressResult = 'hit' | 'slip' | 'ember' | 'failed' | 'spark';

export function newFire(): FireState {
  return { pos: 0, dir: 1, zoneAt: 0.5, heat: 0, slips: 0, failed: 0, hits: 0 };
}

/** Starts a new attempt (keeps the failed-attempt counter). */
export function resetAttempt(s: FireState): void {
  s.pos = 0; s.dir = 1; s.heat = 0; s.slips = 0; s.hits = 0; s.zoneAt = 0.5;
}

/** Zone width shrinks a little while the heat rises (the ember gets fiddly). */
export function zoneWidth(s: FireState, c: FireConfig): number {
  return c.zone * (1 - 0.25 * Math.min(1, s.heat / 100));
}

export function inZone(s: FireState, c: FireConfig): boolean {
  return Math.abs(s.pos - s.zoneAt) <= zoneWidth(s, c) / 2;
}

/** Advances the needle and cools the heat. Speed rises slightly with heat. */
export function tick(s: FireState, c: FireConfig, dt: number): void {
  const v = c.speed * (1 + 0.35 * Math.min(1, s.heat / 100));
  let p = s.pos + s.dir * v * dt;
  // Bounce at both ends (possibly more than once for big dt).
  for (let i = 0; i < 4 && (p < 0 || p > 1); i++) {
    if (p > 1) { p = 2 - p; s.dir = -1; } else if (p < 0) { p = -p; s.dir = 1; }
  }
  s.pos = Math.min(1, Math.max(0, p));
  s.heat = Math.max(0, s.heat - c.cool * dt);
}

/**
 * Applies a press. `rnd` (0..1) places the next zone. Returns what happened:
 * hit (more heat), ember (heat full: success), slip, failed (attempt over), spark (attempt over and the secret
 * spark lights the fire).
 */
export function press(s: FireState, c: FireConfig, rnd: number): PressResult {
  if (inZone(s, c)) {
    s.heat = Math.min(100, s.heat + c.gain);
    s.hits++;
    const w = zoneWidth(s, c);
    // Next zone: somewhere else on the track, fully inside it.
    const lo = w / 2 + 0.04, hi = 1 - w / 2 - 0.04;
    let next = lo + rnd * (hi - lo);
    if (Math.abs(next - s.zoneAt) < 0.18) next = next > 0.5 ? next - 0.3 : next + 0.3;
    s.zoneAt = Math.min(hi, Math.max(lo, next));
    return s.heat >= 100 ? 'ember' : 'hit';
  }
  s.slips++;
  s.heat = Math.max(0, s.heat - c.slipLoss);
  if (s.slips < c.maxSlips) return 'slip';
  s.failed++;
  return s.failed >= c.sparkAfter ? 'spark' : 'failed';
}

// Pure rules of Foltan's dodge drill (training.ts), unit-tested in drillLogic.test.ts.

export type StrikeSide = 'left' | 'right' | 'high';
export type Dodge = 'left' | 'right' | 'duck';

/** Active drill time. Neither edge of a paused interval counts towards the next strike. */
export class DrillClock {
  elapsed = 0;
  constructor(private last: number, private paused = false) {}

  tick(now: number, paused: boolean): number {
    if (!paused && !this.paused) this.elapsed += Math.max(0, now - this.last);
    this.last = now;
    this.paused = paused;
    return this.elapsed;
  }
}

/** The answer that avoids a strike from `side` (pure, unit-tested). */
export function dodgeFor(side: StrikeSide): Dodge {
  return side === 'left' ? 'right' : side === 'right' ? 'left' : 'duck';
}

export interface Strike { side: StrikeSide; feint?: StrikeSide; windup: number }

/**
 * Foltan's habits: a combination he repeats without noticing. Lia is no fighter, but she reads: once she has seen
 * a combination, she knows where the next blow comes from before it starts. When she has read him three times he
 * changes the combination. The first combination is shown slowly once; after that every blow is too fast to react
 * to comfortably – only anticipation helps.
 */
export const HABITS: readonly (readonly StrikeSide[])[] = [['left', 'right', 'high'], ['high', 'left', 'high', 'right']];
export const READS_PER_HABIT = 3;
export const SHOW_WINDUP = 1350;
export const FAST_WINDUP = 400;
/** Safety net: the drill always ends. */
export const MAX_STRIKES = 40;

export interface DrillState { habit: number; slot: number; showing: boolean; reads: number; strikes: number; done: boolean }
export const drillStart = (): DrillState => ({ habit: 0, slot: 0, showing: true, reads: 0, strikes: 0, done: false });

export function nextStrike(s: DrillState): Strike & { phase: 'show' | 'fast' } {
  return { side: HABITS[s.habit][s.slot], windup: s.showing ? SHOW_WINDUP : FAST_WINDUP, phase: s.showing ? 'show' : 'fast' };
}

/** After a blow: advance in the combination; fast dodges count as reads; enough reads switch the habit or end. */
export function afterStrike(s: DrillState, success: boolean): { state: DrillState; event: 'speedup' | 'switch' | 'done' | null } {
  const len = HABITS[s.habit].length;
  let { habit, showing } = s;
  let slot = (s.slot + 1) % len;
  let reads = s.reads + (!s.showing && success ? 1 : 0);
  const strikes = s.strikes + 1;
  let event: 'speedup' | 'switch' | 'done' | null = null;
  if (showing && slot === 0) { showing = false; event = 'speedup'; }
  if (reads >= READS_PER_HABIT) {
    if (habit + 1 >= HABITS.length) return { state: { ...s, slot, reads, strikes, showing, done: true }, event: 'done' };
    habit++; slot = 0; reads = 0; event = 'switch';
  }
  const done = strikes >= MAX_STRIKES;
  return { state: { habit, slot, showing, reads, strikes, done }, event: done ? 'done' : event };
}

/** Result of one strike: the first committed answer decides (a feint flips the side after it was shown). */
export function judge(strike: Strike, answer: Dodge | null): boolean {
  const finalSide = strike.feint ?? strike.side;
  return answer !== null && answer === dodgeFor(finalSide);
}

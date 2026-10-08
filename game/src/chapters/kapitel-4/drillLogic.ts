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

/** The drill's strike list: a fixed teaching opening, then a seeded mix with feints; wind-up shrinks with progress. */
export function strikePlan(count: number, seed = 7): Strike[] {
  const opening: Omit<Strike, 'windup'>[] = [
    { side: 'left' }, { side: 'right' }, { side: 'high' }, { side: 'left', feint: 'right' }, { side: 'high' }, { side: 'right', feint: 'high' },
  ];
  const sides: StrikeSide[] = ['left', 'right', 'high'];
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out: Strike[] = [];
  for (let i = 0; i < count; i++) {
    const base = opening[i] ?? (() => {
      const side = sides[Math.floor(rnd() * 3)];
      const feint = rnd() < 0.35 ? sides.filter(x => x !== side)[Math.floor(rnd() * 2)] : undefined;
      return { side, feint };
    })();
    out.push({ ...base, windup: Math.max(780, 1350 - i * 55) });
  }
  return out;
}

/** Result of one strike: the first committed answer decides (a feint flips the side after it was shown). */
export function judge(strike: Strike, answer: Dodge | null): boolean {
  const finalSide = strike.feint ?? strike.side;
  return answer !== null && answer === dodgeFor(finalSide);
}

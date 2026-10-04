import type { Battle } from './battle';
import type { Point, Team } from './types';

export type WinCondition =
  /** Every enemy is down (dead or kampfunfähig). */
  | { type: 'defeatAll' }
  /** These specific units are down. */
  | { type: 'defeat'; units: string[] }
  /** N full rounds have passed. */
  | { type: 'survive'; rounds: number }
  /** Any unit of `team` (default player) — or the given unit — stands on one of the tiles. */
  | { type: 'reach'; tiles: Point[]; unit?: string; team?: Team }
  /** The escorted unit (not bound, not down) stands on one of the tiles. */
  | { type: 'escort'; unit: string; tiles: Point[] }
  /** A script flag was set (ctx.flag('...')). */
  | { type: 'flag'; flag: string };

export type LoseCondition =
  /** Every player unit is down. Always active. */
  | { type: 'allDown' }
  /** Any of these units goes down (protect objective). */
  | { type: 'unitDown'; units: string[] }
  /** Not won after N rounds. */
  | { type: 'timeout'; rounds: number }
  /** An enemy reaches one of these tiles. */
  | { type: 'enemyReach'; tiles: Point[] }
  | { type: 'flag'; flag: string };

export type Outcome = 'win' | 'lose' | null;

const onTiles = (p: Point, tiles: Point[]) => tiles.some(t => t.x === p.x && t.y === p.y);

export function winMet(b: Battle, c: WinCondition): boolean {
  switch (c.type) {
    case 'defeatAll': return b.living('enemy').length === 0;
    case 'defeat': return c.units.every(id => { const u = b.findUnit(id); return !u || !!u.down; });
    case 'survive': return b.completedRounds >= c.rounds;
    case 'reach':
      if (c.unit) { const u = b.findUnit(c.unit); return !!u && !u.down && onTiles(u, c.tiles); }
      return b.living(c.team ?? 'player').some(u => onTiles(u, c.tiles));
    case 'escort': { const u = b.findUnit(c.unit); return !!u && !u.down && !b.has(u, 'bound') && onTiles(u, c.tiles); }
    case 'flag': return b.flags.has(c.flag);
  }
}

export function loseMet(b: Battle, c: LoseCondition): boolean {
  switch (c.type) {
    case 'allDown': return b.living('player').length === 0;
    case 'unitDown': return c.units.some(id => { const u = b.findUnit(id); return !!u && !!u.down; });
    case 'timeout': return b.completedRounds >= c.rounds;
    case 'enemyReach': return b.living('enemy').some(u => onTiles(u, c.tiles));
    case 'flag': return b.flags.has(c.flag);
  }
}

/** Lose conditions are checked first: losing a protected unit is never redeemed by a simultaneous win. */
export function evaluate(b: Battle, win: WinCondition[], lose: LoseCondition[] = []): Outcome {
  const loses: LoseCondition[] = [{ type: 'allDown' }, ...lose];
  if (loses.some(c => loseMet(b, c))) return 'lose';
  if (win.some(c => winMet(b, c))) return 'win';
  return null;
}

/** Progress text for survive goals, e.g. „Runde 2/5“. */
export function surviveProgress(b: Battle, win: WinCondition[]): { done: number; total: number } | null {
  const s = win.find(c => c.type === 'survive') as Extract<WinCondition, { type: 'survive' }> | undefined;
  return s ? { done: Math.min(b.completedRounds, s.rounds), total: s.rounds } : null;
}

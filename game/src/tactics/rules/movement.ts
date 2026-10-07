import { DIRS, FACINGS, Grid, key } from './grid';
import type { Point, Team, Unit } from './types';

export interface ReachNode extends Point { cost: number; prev: string | null; }
export type ReachMap = Map<string, ReachNode>;

export interface MoveRules {
  move: number;
  jump: number;
  team: Team;
}

/** Height a unit may descend in one step (one more than it can climb). */
export const dropLimit = (jump: number) => jump + 1;

/** Extra move points per height level climbed or descended (FFTA: slopes slow down both ways). */
export const HEIGHT_STEP_COST = 1;

/**
 * Cost to step from a to b, or Infinity when impossible: terrain cost plus HEIGHT_STEP_COST per level
 * up or down. Never more than `jump` up or `dropLimit(jump)` down.
 */
export function stepCost(grid: Grid, a: Point, b: Point, jump: number): number {
  const tb = grid.tile(b.x, b.y);
  if (!tb || !grid.standable(b.x, b.y)) return Infinity;
  const dh = tb.h - grid.height(a.x, a.y);
  if (dh > jump) return Infinity;
  if (-dh > dropLimit(jump)) return Infinity;
  return grid.info(b.x, b.y).cost + Math.abs(dh) * HEIGHT_STEP_COST;
}

/** Who may pass a cell: allies (same side) can be passed but not ended on, enemies block. */
export function sameSide(a: Team, b: Team): boolean {
  if (a === b) return true;
  return (a === 'player' && b === 'ally') || (a === 'ally' && b === 'player');
}

/**
 * Dijkstra over the grid. Returns every cell the unit may END its move on (including its start),
 * with path back-links. `units` are all units on the field (down 'wounded' ones block, 'dead' ones do not).
 */
export function reachable(grid: Grid, unit: Pick<Unit, 'x' | 'y' | 'move' | 'jump' | 'team' | 'id'>, units: readonly Unit[], budget = unit.move): ReachMap {
  const occupied = new Map<string, Unit>();
  for (const u of units) if (u.id !== unit.id && u.down !== 'dead') occupied.set(key(u.x, u.y), u);

  const all = new Map<string, ReachNode>();
  const startKey = key(unit.x, unit.y);
  all.set(startKey, { x: unit.x, y: unit.y, cost: 0, prev: null });
  const open: ReachNode[] = [all.get(startKey)!];
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const cur = open.shift()!;
    const curKey = key(cur.x, cur.y);
    if (all.get(curKey)!.cost < cur.cost) continue;
    for (const f of FACINGS) {
      const nx = cur.x + DIRS[f].x, ny = cur.y + DIRS[f].y;
      const c = stepCost(grid, cur, { x: nx, y: ny }, unit.jump);
      if (!isFinite(c)) continue;
      const cost = cur.cost + c;
      if (cost > budget) continue;
      const nk = key(nx, ny);
      const occ = occupied.get(nk);
      if (occ && (occ.down || !sameSide(unit.team, occ.team))) continue; // enemies and fallen bodies block
      const prev = all.get(nk);
      if (prev && prev.cost <= cost) continue;
      const node = { x: nx, y: ny, cost, prev: curKey };
      all.set(nk, node);
      open.push(node);
    }
  }
  // Cannot end on a cell occupied by anyone else.
  const result: ReachMap = new Map();
  for (const [k, n] of all) if (!occupied.has(k)) result.set(k, n);
  // Keep back-links intact for paths through allies.
  (result as ReachMap & { _all?: ReachMap })._all = all;
  return result;
}

/** Reconstructs the path (start excluded, target included) to a cell in a reach map. */
export function pathTo(reach: ReachMap, target: Point): Point[] {
  const all = (reach as ReachMap & { _all?: ReachMap })._all ?? reach;
  const path: Point[] = [];
  let node = all.get(key(target.x, target.y));
  if (!node || !reach.has(key(target.x, target.y))) return [];
  while (node && node.prev) {
    path.unshift({ x: node.x, y: node.y });
    node = all.get(node.prev);
  }
  return path;
}

/**
 * Distance field (movement cost) from a set of goal cells, ignoring move budgets and unit blocking
 * except for `blockers`. Used by the AI to approach targets along climbable paths.
 */
export function distanceField(grid: Grid, goals: Point[], jump: number, blockers: Set<string> = new Set()): Map<string, number> {
  const dist = new Map<string, number>();
  const open: { x: number; y: number; d: number }[] = [];
  for (const g of goals) { dist.set(key(g.x, g.y), 0); open.push({ x: g.x, y: g.y, d: 0 }); }
  while (open.length) {
    open.sort((a, b) => a.d - b.d);
    const cur = open.shift()!;
    if ((dist.get(key(cur.x, cur.y)) ?? Infinity) < cur.d) continue;
    for (const f of FACINGS) {
      const nx = cur.x + DIRS[f].x, ny = cur.y + DIRS[f].y;
      const nk = key(nx, ny);
      if (blockers.has(nk)) continue;
      // Reverse step: from neighbor (n) to cur, the walker climbs cur.h - n.h.
      const c = stepCost(grid, { x: nx, y: ny }, cur, jump);
      if (!isFinite(c) || !grid.standable(nx, ny)) continue;
      const d = cur.d + c;
      if (d < (dist.get(nk) ?? Infinity)) { dist.set(nk, d); open.push({ x: nx, y: ny, d }); }
    }
  }
  return dist;
}

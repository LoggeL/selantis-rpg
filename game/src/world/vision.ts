import type { CollisionGrid } from './grid';
import type { Vec } from './geom';

/** Smallest signed difference b - a in radians (-PI..PI). */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Rotates angle `a` towards `b` by at most `maxStep` radians. */
export function rotateTowards(a: number, b: number, maxStep: number): number {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

/** Whether p is inside a cone (origin, facing angle, half angle, range). Ignores occlusion. */
export function inCone(origin: Vec, facing: number, halfAngle: number, range: number, p: Vec): boolean {
  const dx = p.x - origin.x, dy = p.y - origin.y;
  const d = Math.hypot(dx, dy);
  if (d > range) return false;
  if (d < 0.0001) return true;
  return Math.abs(angleDiff(facing, Math.atan2(dy, dx))) <= halfAngle;
}

/** Distance along a ray until a sight-blocking cell is hit (or maxDist). */
export function raycast(grid: CollisionGrid, ox: number, oy: number, angle: number, maxDist: number, step = 2): number {
  const cx = Math.cos(angle), cy = Math.sin(angle);
  // Start a little outside the origin so a guard standing next to a wall still sees forward.
  for (let d = step; d <= maxDist; d += step) {
    if (grid.sightAt(ox + cx * d, oy + cy * d)) return Math.max(0, d - step / 2);
  }
  return maxDist;
}

/** Unobstructed line between a and b (sight grid). */
export function lineOfSight(grid: CollisionGrid, a: Vec, b: Vec, step = 2): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d < step) return true;
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  return raycast(grid, a.x, a.y, ang, d - 1, step) >= d - 1;
}

/** Polygon (origin first) of a vision cone clipped by sight-blocking cells. */
export function conePolygon(grid: CollisionGrid, origin: Vec, facing: number, halfAngle: number, range: number, rays = 28): Vec[] {
  const pts: Vec[] = [{ x: origin.x, y: origin.y }];
  for (let i = 0; i <= rays; i++) {
    const a = facing - halfAngle + (2 * halfAngle * i) / rays;
    const d = raycast(grid, origin.x, origin.y, a, range);
    pts.push({ x: origin.x + Math.cos(a) * d, y: origin.y + Math.sin(a) * d });
  }
  return pts;
}

export interface SightQuery {
  origin: Vec;
  facing: number;
  halfAngle: number;
  range: number;
  target: Vec;
  /** Target crouches (shorter detection range). */
  sneaking?: boolean;
  running?: boolean;
  /** Target is in a hiding spot while crouching: never visible. */
  hidden?: boolean;
  /** Within this distance a non-sneaking target is noticed regardless of facing (px). */
  closeSense?: number;
  /** Height of the target's chest above the feet (px, default 8). */
  chest?: number;
}

export interface SightResult { visible: boolean; /** 1 = right in front, 0 = at the edge of range */ closeness: number; distance: number }

/** Detection range multiplier for movement style. */
export function rangeFactor(sneaking?: boolean, running?: boolean): number {
  return sneaking ? 0.55 : running ? 1.2 : 1;
}

/** Full visibility test: hiding, effective range, cone, close sense and occlusion. */
export function canSee(grid: CollisionGrid, q: SightQuery): SightResult {
  const distance = Math.hypot(q.target.x - q.origin.x, q.target.y - q.origin.y);
  const range = q.range * rangeFactor(q.sneaking, q.running);
  const none = { visible: false, closeness: 0, distance };
  if (q.hidden) return none;
  if (distance > range) return none;
  const close = !q.sneaking && distance <= (q.closeSense ?? 14);
  if (!close && !inCone(q.origin, q.facing, q.halfAngle, range, q.target)) return none;
  // Check sight to the target's chest (a bit above the feet) and the feet; either counts.
  const chest = { x: q.target.x, y: q.target.y - (q.chest ?? 8) };
  if (!lineOfSight(grid, q.origin, q.target) && !lineOfSight(grid, q.origin, chest)) return none;
  return { visible: true, closeness: Math.max(0, Math.min(1, 1 - distance / range)), distance };
}

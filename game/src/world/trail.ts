import type { Vec } from './geom';

/**
 * Breadcrumb trail of the leader's positions, newest first. Followers ask for the point `d` px behind the
 * leader measured ALONG the walked path, so they never cut corners through walls.
 */
export class Trail {
  private pts: Vec[] = [];
  constructor(private minStep = 3, private maxLength = 400) {}

  get points(): readonly Vec[] { return this.pts; }

  reset(x: number, y: number, dirX = 0, dirY = 1, length = 60): void {
    // Seed a straight trail behind the leader so followers start in a sensible spot.
    this.pts = [];
    const n = Math.ceil(length / this.minStep);
    for (let i = 0; i <= n; i++) this.pts.push({ x: x - dirX * i * this.minStep, y: y - dirY * i * this.minStep });
  }

  /** Records the leader position; ignored if it moved less than minStep. */
  push(x: number, y: number): void {
    const head = this.pts[0];
    if (head && Math.hypot(head.x - x, head.y - y) < this.minStep) return;
    this.pts.unshift({ x, y });
    // Trim by length.
    let len = 0;
    for (let i = 1; i < this.pts.length; i++) {
      len += Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].y - this.pts[i - 1].y);
      if (len > this.maxLength) { this.pts.length = i + 1; break; }
    }
  }

  /** Point `distance` px behind (x, y) along the trail. Falls back to the oldest point. */
  pointBehind(x: number, y: number, distance: number): Vec {
    let prev: Vec = { x, y };
    let left = distance;
    for (const p of this.pts) {
      const seg = Math.hypot(p.x - prev.x, p.y - prev.y);
      if (seg >= left && seg > 0) {
        const t = left / seg;
        return { x: prev.x + (p.x - prev.x) * t, y: prev.y + (p.y - prev.y) * t };
      }
      left -= seg;
      prev = p;
    }
    return { x: prev.x, y: prev.y };
  }

  /** Total trail length in px. */
  length(): number {
    let len = 0;
    for (let i = 1; i < this.pts.length; i++) len += Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].y - this.pts[i - 1].y);
    return len;
  }
}

/**
 * Follower speed: catches up when lagging behind its slot, slows when close, stops inside `stopRadius`.
 */
export function followerSpeed(distToSlot: number, leaderSpeed: number, walkSpeed: number, stopRadius = 2): number {
  if (distToSlot <= stopRadius) return 0;
  const catchUp = Math.min(2.2, 0.6 + distToSlot / 24);
  return Math.max(walkSpeed * 0.5, Math.max(leaderSpeed, walkSpeed * 0.8) * catchUp);
}

/** Follower spacing along the trail (px) for follower index i. */
export function followDistance(i: number): number { return 24 + i * 20; }

/**
 * Standing formation: when the leader stops, followers step beside (not behind) it so the three sprites do not
 * stack into one column. side = +1 right of the facing direction, -1 left.
 */
export function formationSlot(x: number, y: number, facing: Vec, side: 1 | -1, i: number): Vec {
  const fl = Math.hypot(facing.x, facing.y) || 1;
  const fx = facing.x / fl, fy = facing.y / fl;
  // perpendicular (right-hand side of the facing direction in screen coords)
  const rx = -fy, ry = fx;
  const sideDist = 14 + i * 6;
  const back = 6 + i * 14;
  // Vertical facing needs less back offset (sprites are taller than wide); keep feet clear of each other.
  return { x: x + rx * side * sideDist - fx * back, y: y + ry * side * sideDist * 0.8 - fy * back };
}

/** Which side of the leader (relative to its facing) a point lies on. */
export function sideOf(x: number, y: number, facing: Vec, px: number, py: number): 1 | -1 {
  const cross = facing.x * (py - y) - facing.y * (px - x);
  return cross >= 0 ? 1 : -1;
}

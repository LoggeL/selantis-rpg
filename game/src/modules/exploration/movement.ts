import { clearWalkingLine, type Walkable } from "./navigation";

export type Position = { x: number; y: number };
export type Direction = 'n' | 's' | 'e' | 'w';
export type MovementPolicy = {
  collision?: 'endpoint' | 'segment';
  slide?: boolean;
  slideAngles?: readonly number[];
  horizontalTie?: boolean;
};
export type MovementResult = Position & { moved: number; step: number; facing: Direction };

export function facingFor(dx: number, dy: number, horizontalTie = false): Direction {
  return (horizontalTie ? Math.abs(dx) >= Math.abs(dy) : Math.abs(dx) > Math.abs(dy)) ? dx > 0 ? 'e' : 'w' : dy > 0 ? 's' : 'n';
}

/** Pure movement with scene-specific collision and edge-sliding policies. */
export function resolveWalkingStep(from: Position, input: Position, speed: number, dt: number, walkable: Walkable, policy: MovementPolicy = {}, target?: Position): MovementResult {
  const length = Math.hypot(input.x, input.y);
  let step = speed * Math.max(0, Math.min(dt, 50)) / 1000;
  if (target) step = Math.min(step, Math.hypot(target.x - from.x, target.y - from.y));
  const facing = facingFor(input.x, input.y, policy.horizontalTie);
  if (!length) return { ...from, moved: 0, step: 0, facing };
  const nx = from.x + input.x / length * step, ny = from.y + input.y / length * step;
  const allowed = (x: number, y: number) => policy.collision === 'segment' ? clearWalkingLine([from.x, from.y], [x, y], walkable) : walkable(x, y);
  let result = { ...from };
  if (allowed(nx, ny)) result = { x: nx, y: ny };
  else if (policy.slide !== false) {
    if (input.x && allowed(nx, from.y)) result = { x: nx, y: from.y };
    else if (input.y && allowed(from.x, ny)) result = { x: from.x, y: ny };
    else {
      const angle = Math.atan2(input.y, input.x);
      for (const offset of policy.slideAngles ?? []) {
        const x = from.x + Math.cos(angle + offset) * step, y = from.y + Math.sin(angle + offset) * step;
        if (allowed(x, y)) { result = { x, y }; break; }
      }
    }
  }
  return { ...result, moved: Math.hypot(result.x - from.x, result.y - from.y), step, facing };
}

export function accumulateStuckTime(previous: number, moved: number, step: number, dt: number, minimumFraction: number): number {
  return moved < step * minimumFraction ? previous + dt : 0;
}

export function directionTo(from: Position, target: Position, arrivalRadius: number): Position | undefined {
  const x = target.x - from.x, y = target.y - from.y, distance = Math.hypot(x, y);
  return distance < arrivalRadius ? undefined : { x: x / distance, y: y / distance };
}

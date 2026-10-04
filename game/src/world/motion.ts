/**
 * Velocity integration with acceleration and deceleration (separate rates), used by the player controller.
 * Input (ix, iy) is a direction with length 0..1 (analog stick or normalized keys).
 */
export function stepVelocity(
  vx: number, vy: number, ix: number, iy: number, maxSpeed: number, accel: number, decel: number, dt: number,
): { vx: number; vy: number } {
  const len = Math.hypot(ix, iy);
  const tx = len > 0 ? (ix / Math.max(1, len)) * maxSpeed : 0;
  const ty = len > 0 ? (iy / Math.max(1, len)) * maxSpeed : 0;
  const dx = tx - vx, dy = ty - vy;
  const d = Math.hypot(dx, dy);
  if (d < 0.0001) return { vx: tx, vy: ty };
  // Accelerate when the target is "ahead", brake otherwise (also when turning sharply).
  const dot = vx * tx + vy * ty;
  const rate = len > 0 && dot >= 0 ? accel : decel;
  const step = Math.min(d, rate * dt);
  return { vx: vx + (dx / d) * step, vy: vy + (dy / d) * step };
}

/** Normalizes keyboard input so diagonals are not faster. */
export function normalizeInput(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  return len > 1 ? { x: x / len, y: y / len } : { x, y };
}

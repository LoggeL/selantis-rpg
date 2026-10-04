export type RailPoint = { x: number; y: number };
export type RailGeometry = { points: readonly RailPoint[]; lengths: readonly number[]; total: number };
export type RailPosition = { p: RailPoint; dir: RailPoint };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** An injected authored path, measured once and reused for movement and picking. */
export function measureRail(points: readonly RailPoint[]): RailGeometry {
  if (points.length < 2) throw new Error('A flight rail needs at least two points.');
  const lengths = points.slice(1).map((point, index) => {
    const dx = point.x - points[index].x, dy = point.y - points[index].y;
    return Math.sqrt(dx * dx + dy * dy);
  });
  if (lengths.some(length => length === 0)) throw new Error('A flight rail cannot contain a zero-length segment.');
  return { points, lengths, total: lengths.reduce((sum, length) => sum + length, 0) };
}

export function railDistanceAt(rail: RailGeometry, pointIndex: number): number {
  return rail.lengths.slice(0, pointIndex).reduce((sum, length) => sum + length, 0);
}

export function pointOnRail(rail: RailGeometry, distance: number): RailPosition {
  let accumulated = 0;
  for (let index = 0; index < rail.lengths.length; index++) {
    const length = rail.lengths[index];
    if (distance <= accumulated + length || index === rail.lengths.length - 1) {
      const t = clamp((distance - accumulated) / length, 0, 1);
      const from = rail.points[index], to = rail.points[index + 1];
      return {
        p: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
        dir: { x: (to.x - from.x) / length, y: (to.y - from.y) / length },
      };
    }
    accumulated += length;
  }
  return { p: rail.points[rail.points.length - 1], dir: { x: 1, y: 0 } };
}

/** Keep the authored four-pixel picking cadence and include the mandatory endpoint. */
export function nearestRailDistance(rail: RailGeometry, x: number, y: number, safeFloor: number, end: number): number {
  const endpoint = pointOnRail(rail, end).p;
  let best = Math.max(safeFloor, end), bestSquared = (endpoint.x - x) ** 2 + (endpoint.y - y) ** 2;
  for (let distance = safeFloor; distance <= end; distance += 4) {
    const { p } = pointOnRail(rail, distance);
    const squared = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (squared < bestSquared) { bestSquared = squared; best = distance; }
  }
  return best;
}

/** A click must reach its target before arrival effects decide the station outcome. */
export function railTargetDirection(distance: number, target: number): { target?: number; dot: number } {
  const diff = target - distance;
  if (Math.abs(diff) < 0.001) return { target: undefined, dot: 0 };
  return { target, dot: Math.sign(diff) };
}

export function stepAlongRail(options: {
  distance: number; dot: number; speed: number; deltaMs: number;
  target?: number; stationAt?: number; safeFloor: number; total: number;
}): number {
  let next = options.distance + Math.sign(options.dot) * options.speed * options.deltaMs / 1000;
  if (options.target !== undefined) next = options.dot > 0 ? Math.min(next, options.target) : Math.max(next, options.target);
  if (options.stationAt !== undefined && next >= options.stationAt) next = options.stationAt;
  return clamp(next, options.safeFloor, options.total);
}

/** Rennen, Laufen, Gehen follow the same distance fractions on any injected rail. */
export function flightSpeed(distance: number, total: number): number {
  const fraction = distance / total;
  if (fraction < 0.35) return 62;
  if (fraction < 0.7) return 62 + (42 - 62) * ((fraction - 0.35) / 0.35);
  return 42 + (26 - 42) * ((fraction - 0.7) / 0.3);
}

import type { MapDef, Pt } from './maps';

export function inPoly(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Fußbreite berücksichtigen, auch an Kartenrändern und schmalen Wegen. */
export function isMapWalkable(map: MapDef, x: number, y: number): boolean {
  const ok = (px: number, py: number) => map.walk.some(p => inPoly(px, py, p)) && !map.block.some(p => inPoly(px, py, p));
  return ok(x, y) && ok(x - 5, y) && ok(x + 5, y) && ok(x, y - 3);
}

export function clearWalkingLine(a: Pt, b: Pt, walkable: (x: number, y: number) => boolean): boolean {
  // A long planned segment must not miss the narrow foot collision at a
  // blocker corner that the shorter per-frame movement subsequently detects.
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!walkable(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
  }
  return true;
}

/** Kurze Klickwege um Bank, Stamm und Büsche. Keine Teleportation durch Hindernisse. */
export function findWalkingPath(from: Pt, goal: Pt, walkable: (x: number, y: number) => boolean, approachRadius = 24): Pt[] {
  // Klicks auf einen Stamm, eine Bank oder knapp außerhalb der Fußbreite landen
  // am nächsten erreichbaren Rand, nicht beliebig früh vor dem Gegenstand.
  if (!walkable(...goal)) {
    let approach: Pt | undefined;
    const towards = Math.atan2(from[1] - goal[1], from[0] - goal[0]);
    for (let radius = 1; radius <= approachRadius && !approach; radius++) {
      for (let i = 0; i < 24; i++) {
        const angle = towards + i * Math.PI / 12;
        const p: Pt = [goal[0] + Math.cos(angle) * radius, goal[1] + Math.sin(angle) * radius];
        if (walkable(...p)) { approach = p; break; }
      }
    }
    if (!approach) return [];
    goal = approach;
  }
  if (clearWalkingLine(from, goal, walkable)) return [goal];
  const step = 10, cols = 64, rows = 36;
  const point = (i: number): Pt => [(i % cols) * step + 5, Math.floor(i / cols) * step + 5];
  const valid = Array.from({ length: cols * rows }, (_, i) => walkable(...point(i)));
  const parents = new Int32Array(valid.length).fill(-2);
  const queue: number[] = [];
  for (let i = 0; i < valid.length; i++) {
    const p = point(i);
    if (valid[i] && Math.hypot(p[0] - from[0], p[1] - from[1]) <= 22 && clearWalkingLine(from, p, walkable)) {
      parents[i] = -1;
      queue.push(i);
    }
  }
  let found = -1;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const i = queue[cursor], p = point(i), distance = Math.hypot(p[0] - goal[0], p[1] - goal[1]);
    if (distance <= 16 && clearWalkingLine(p, goal, walkable)) { found = i; break; }
    const col = i % cols, row = Math.floor(i / cols);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = col + dx, ny = row + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const next = ny * cols + nx;
      if (!valid[next] || parents[next] !== -2 || !clearWalkingLine(p, point(next), walkable)) continue;
      parents[next] = i;
      queue.push(next);
    }
  }
  if (found < 0) return [];
  const path: Pt[] = [];
  for (let i = found; i >= 0; i = parents[i]) path.push(point(i));
  path.reverse();
  path.push(goal);
  const smooth: Pt[] = [];
  let anchor = from;
  for (let i = 0; i < path.length;) {
    let farthest = i;
    for (let j = i + 1; j < path.length; j++) {
      if (!clearWalkingLine(anchor, path[j], walkable)) break;
      farthest = j;
    }
    smooth.push(path[farthest]);
    anchor = path[farthest];
    i = farthest + 1;
  }
  return smooth;
}

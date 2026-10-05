// Kapitel V: small pure geometry helpers for authoring trail maps (unit-tested in geom.test.ts).

export type Pt = readonly [number, number];

/**
 * A walkable corridor along a polyline: offsets the line by ±halfWidth (mitred at the joints, mitre length capped)
 * and returns the closed outline (left side forward, right side backward). Used for forest trails on painted maps.
 */
export function corridor(points: readonly Pt[], halfWidth: number): [number, number][] {
  if (points.length < 2) throw new Error('corridor needs at least two points');
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  const n = points.length;
  const dirAt = (i: number): [number, number] => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [dx / len, dy / len];
  };
  for (let i = 0; i < n; i++) {
    const [dx, dy] = dirAt(i);
    // Mitre: scale the normal so the corridor keeps its width in bends (capped at 2×).
    let scale = 1;
    if (i > 0 && i < n - 1) {
      const a = points[i - 1], b = points[i], c = points[i + 1];
      const d1 = norm(b[0] - a[0], b[1] - a[1]), d2 = norm(c[0] - b[0], c[1] - b[1]);
      const cos = d1[0] * d2[0] + d1[1] * d2[1];
      scale = Math.min(2, 1 / Math.max(0.5, Math.sqrt((1 + cos) / 2)));
    }
    const nx = -dy * halfWidth * scale, ny = dx * halfWidth * scale;
    const [x, y] = points[i];
    left.push([Math.round(x + nx), Math.round(y + ny)]);
    right.push([Math.round(x - nx), Math.round(y - ny)]);
  }
  return [...left, ...right.reverse()];
}

function norm(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/** Ellipse outline as a polygon (fire rings, stones). */
export function ellipse(cx: number, cy: number, rx: number, ry: number, steps = 12): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    out.push([Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry)]);
  }
  return out;
}

/** Point-in-polygon (even-odd), for tests and script checks. */
export function inside(x: number, y: number, poly: readonly Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

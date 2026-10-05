/**
 * Polygon helpers for painted maps (pure, no Phaser; used by the engine, the debug overlay and scripts/map_tool.mjs).
 * A polygon is a list of [x, y] points in map pixels; it is closed implicitly.
 */

export type Pt = readonly [number, number];
export type Poly = readonly Pt[];

export interface Box { x: number; y: number; w: number; h: number }

/** Even-odd point-in-polygon test. */
export function pointInPoly(x: number, y: number, poly: Poly): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polyBounds(poly: Poly): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  if (!poly.length) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Area-weighted centroid (falls back to the vertex mean for degenerate polygons). */
export function polyCentroid(poly: Poly): { x: number; y: number } {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    a += f; cx += (poly[j][0] + poly[i][0]) * f; cy += (poly[j][1] + poly[i][1]) * f;
  }
  if (Math.abs(a) < 1e-6) {
    const n = Math.max(1, poly.length);
    return { x: poly.reduce((s, p) => s + p[0], 0) / n, y: poly.reduce((s, p) => s + p[1], 0) / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

/** Distance from a point to the polygon (0 inside). */
export function distToPoly(x: number, y: number, poly: Poly): number {
  if (pointInPoly(x, y, poly)) return 0;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) best = Math.min(best, distToSegment(x, y, poly[j], poly[i]));
  return best;
}

/** Closest point on the polygon outline (or the point itself when inside). */
export function closestOnPoly(x: number, y: number, poly: Poly): { x: number; y: number } {
  if (pointInPoly(x, y, poly)) return { x, y };
  let best = Infinity, bx = x, by = y;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p = projectSegment(x, y, poly[j], poly[i]);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < best) { best = d; bx = p.x; by = p.y; }
  }
  return { x: bx, y: by };
}

function projectSegment(x: number, y: number, a: Pt, b: Pt): { x: number; y: number } {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
  return { x: a[0] + dx * t, y: a[1] + dy * t };
}

export function distToSegment(x: number, y: number, a: Pt, b: Pt): number {
  const p = projectSegment(x, y, a, b);
  return Math.hypot(p.x - x, p.y - y);
}

/**
 * Scanline rasterization: calls fill(row, c0, c1) for every run of cells (inclusive) whose CENTER lies inside the
 * polygon. Cells are `cell` px squares; cols/rows clip the output.
 */
export function rasterizePoly(poly: Poly, cell: number, cols: number, rows: number, fill: (r: number, c0: number, c1: number) => void): void {
  if (poly.length < 3) return;
  const b = polyBounds(poly);
  const r0 = Math.max(0, Math.floor(b.y / cell)), r1 = Math.min(rows - 1, Math.ceil((b.y + b.h) / cell));
  const xs: number[] = [];
  for (let r = r0; r <= r1; r++) {
    const y = r * cell + cell / 2;
    xs.length = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const yi = poly[i][1], yj = poly[j][1];
      if ((yi > y) !== (yj > y)) xs.push(poly[i][0] + ((y - yi) / (yj - yi)) * (poly[j][0] - poly[i][0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      // cells with center cx in [xs[k], xs[k+1])
      const c0 = Math.max(0, Math.ceil(xs[k] / cell - 0.5)), c1 = Math.min(cols - 1, Math.ceil(xs[k + 1] / cell - 0.5) - 1);
      if (c1 >= c0) fill(r, c0, c1);
    }
  }
}

/** Circle as a polygon (for point + radius hotspots in tools). */
export function circlePoly(x: number, y: number, r: number, n = 16): Poly {
  return Array.from({ length: n }, (_, i) => [x + Math.cos((i / n) * Math.PI * 2) * r, y + Math.sin((i / n) * Math.PI * 2) * r] as Pt);
}

/** Axis-aligned rectangle as a polygon. */
export function rectPoly(x: number, y: number, w: number, h: number): Poly {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

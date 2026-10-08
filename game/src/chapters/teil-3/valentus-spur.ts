// The trail of e3-valentus (pure rules, tested in valentus-spur.test.ts). Turquoise light points hang scattered on the
// trees beside the forest path. Only in Spurenblick do they line up along the path towards the next of three places
// where they gather (stump, rocks, the big rock at the clearing). Lia reads the three places; then Valentus appears.

export type Pt = readonly [number, number];

/** Centre line of the earth path in e3-lichtwald, from the bottom-left entry up to the gap into the clearing. */
export const CENTERLINE: readonly Pt[] = [
  [34, 700], [66, 646], [104, 604], [164, 568], [236, 540], [312, 510], [384, 478], [444, 446], [494, 410],
  [520, 376], [512, 346], [540, 352], [566, 354],
];

export type StationId = 'stumpf' | 'fels' | 'felsblock';

export interface Station {
  id: StationId;
  /** Where the clue lies (map px, reachable from the path). */
  at: Pt;
  /** Position along the centre line (px from the entry) up to which the light points lead. */
  along: number;
}

/** Length of a polyline in px. */
export function polylineLength(line: readonly Pt[]): number {
  let d = 0;
  for (let i = 1; i < line.length; i++) d += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  return d;
}

/** The point `d` px along a polyline (clamped to its ends). */
export function pointAlong(line: readonly Pt[], d: number): Pt {
  if (d <= 0) return line[0];
  let left = d;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (left <= seg) {
      const k = seg === 0 ? 0 : left / seg;
      return [ax + (bx - ax) * k, ay + (by - ay) * k];
    }
    left -= seg;
  }
  return line[line.length - 1];
}

/** How far along the polyline the point nearest to `p` lies (px from the start). */
export function projectAlong(line: readonly Pt[], p: Pt): number {
  let best = Infinity, bestAlong = 0, walked = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const k = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2));
    const qx = ax + dx * k, qy = ay + dy * k;
    const dist = Math.hypot(p[0] - qx, p[1] - qy);
    if (dist < best) { best = dist; bestAlong = walked + Math.sqrt(len2) * k; }
    walked += Math.sqrt(len2);
  }
  return bestAlong;
}

/** The three gathering places, in the order the path passes them. */
export const STATIONS: readonly Station[] = [
  { id: 'stumpf', at: [378, 486], along: projectAlong(CENTERLINE, [378, 486]) },
  { id: 'fels', at: [470, 374], along: projectAlong(CENTERLINE, [470, 374]) },
  { id: 'felsblock', at: [506, 292], along: polylineLength(CENTERLINE) - 30 },
];

/** The next place the light points lead to: the first one along the path that Lia has not read yet. */
export function nextStation(found: ReadonlySet<string>): Station | undefined {
  return STATIONS.find(s => !found.has(s.id));
}

/**
 * Where `n` light points hover while the Spurenblick lines them up: evenly spaced along the path from Lia (or the last
 * place she read, whichever is further on) to `station`, ending right at it. Lia past the station: they gather there.
 */
export function trailPoints(station: Station, playerAlong: number, found: ReadonlySet<string>, n: number): Pt[] {
  const prev = STATIONS.filter(s => found.has(s.id) && s.along < station.along).reduce((m, s) => Math.max(m, s.along), 0);
  const from = Math.max(prev, playerAlong + 24);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    if (from >= station.along) {
      // Already level with it: a small ring around the place.
      const a = (i / n) * Math.PI * 2;
      pts.push([station.at[0] + Math.cos(a) * 14, station.at[1] - 8 + Math.sin(a) * 6]);
      continue;
    }
    const k = n === 1 ? 1 : i / (n - 1);
    pts.push(pointAlong(CENTERLINE, from + (station.along - from) * k));
  }
  // The last point always sits on the place itself, so the line ends where the clue lies.
  if (from < station.along && pts.length) pts[pts.length - 1] = station.at;
  return pts;
}

/**
 * Resting places of the light points on the trees and bushes beside the path (map px), five per station. Without the
 * Spurenblick they hang there faintly, like dew that should not glow.
 */
export const SCATTER: Readonly<Record<StationId, readonly Pt[]>> = {
  stumpf: [[46, 470], [150, 452], [236, 410], [292, 612], [318, 560]],
  fels: [[330, 420], [300, 360], [404, 330], [520, 486], [560, 430]],
  felsblock: [[420, 290], [470, 236], [566, 250], [416, 226], [610, 300]],
};

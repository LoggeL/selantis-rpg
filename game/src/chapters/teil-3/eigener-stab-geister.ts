// The three light spirits of e3-eigener-stab (pure rules, tested in eigener-stab-geister.test.ts). They drift over the
// clearing. Running scares them off (and scatters those already following); walking up to one close, or sneaking up
// from a little further away, makes it follow Lia. Followers that reach the zone below the willow settle into its
// branches for good. Positions are map px; the scene draws them (code-drawn light, no character art).

export type Pt = readonly [number, number];
export type SpiritMode = 'drift' | 'follow' | 'flee' | 'rest';

export interface Spirit {
  id: number;
  x: number;
  y: number;
  /** Centre of the slow drift (moves to where it fled). */
  ax: number;
  ay: number;
  mode: SpiritMode;
  /** Seconds left of the flight. */
  flee: number;
  fx: number;
  fy: number;
  /** Order in which it joined Lia (its place around her head), -1 when not following. */
  slot: number;
  /** Index of its resting place in the willow, -1 until it rests. */
  rest: number;
}

export interface SpiritRules {
  /** Player speed (px/s) above which Lia counts as running (engine: walk 112, run 189, sneak 60 at world scale 1.75). */
  runSpeed: number;
  /** Player speed below which she counts as careful (sneaking or standing). */
  gentleSpeed: number;
  /** Distance at which a drifting spirit joins Lia while she walks / while she is careful. */
  catchWalk: number;
  catchGentle: number;
  /** Running within this distance makes a drifting spirit flee. */
  scareRadius: number;
  fleeDistance: number;
  fleeSeconds: number;
  /** Zone below the willow where followers settle, and the three resting places in its branches. */
  zone: { at: Pt; radius: number };
  restAt: readonly Pt[];
  /** Spirits stay inside this ellipse (the clearing). */
  oval: { cx: number; cy: number; rx: number; ry: number };
}

export type SpiritEvent = { kind: 'caught' | 'scared' | 'settled'; id: number };

export function makeSpirits(anchors: readonly Pt[]): Spirit[] {
  return anchors.map(([x, y], id) => ({ id, x, y, ax: x, ay: y, mode: 'drift', flee: 0, fx: x, fy: y, slot: -1, rest: -1 }));
}

/** Clamps a point into the ellipse (keeps the direction from the centre). */
export function clampToOval(x: number, y: number, o: SpiritRules['oval']): Pt {
  const nx = (x - o.cx) / o.rx, ny = (y - o.cy) / o.ry;
  const r = Math.hypot(nx, ny);
  if (r <= 1) return [x, y];
  return [o.cx + (nx / r) * o.rx, o.cy + (ny / r) * o.ry];
}

/** Where follower number `slot` hovers around Lia's head. */
export function followPoint(px: number, py: number, slot: number, time: number): Pt {
  const a = time * 1.6 + slot * ((Math.PI * 2) / 3);
  return [px + Math.cos(a) * 20, py - 50 + Math.sin(a) * 7];
}

const approach = (s: Spirit, tx: number, ty: number, k: number) => { s.x += (tx - s.x) * k; s.y += (ty - s.y) * k; };

/**
 * One step of the spirits. `speed` is Lia's measured speed in px/s, `time` the scene time in s (drift and orbit
 * phase), `rng` returns 0..1 (sideways jitter of a flight). Mutates the spirits; returns what happened.
 */
export function stepSpirits(
  spirits: Spirit[], player: Pt, speed: number, dt: number, time: number, rules: SpiritRules, rng: () => number = Math.random,
): SpiritEvent[] {
  const events: SpiritEvent[] = [];
  const running = speed > rules.runSpeed;
  const careful = speed < rules.gentleSpeed;
  const [px, py] = player;
  const inZone = Math.hypot(px - rules.zone.at[0], py - rules.zone.at[1]) <= rules.zone.radius;
  const scatter = (s: Spirit) => {
    let dx = s.x - px, dy = s.y - py;
    const d = Math.hypot(dx, dy);
    if (d < 1) { const a = rng() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); } else { dx /= d; dy /= d; }
    const side = (rng() - 0.5) * 0.9;
    const [tx, ty] = clampToOval(s.x + (dx - dy * side) * rules.fleeDistance, s.y + (dy + dx * side) * rules.fleeDistance, rules.oval);
    s.mode = 'flee';
    s.flee = rules.fleeSeconds;
    s.fx = tx; s.fy = ty;
    s.slot = -1;
  };
  for (const s of spirits) {
    if (s.mode === 'rest') {
      const [rx, ry] = rules.restAt[s.rest];
      approach(s, rx + Math.sin(time * 1.1 + s.id) * 3, ry + Math.cos(time * 1.4 + s.id) * 2, Math.min(1, dt * 2.5));
      continue;
    }
    if (s.mode === 'flee') {
      approach(s, s.fx, s.fy, Math.min(1, dt * 4));
      s.flee -= dt;
      if (s.flee <= 0) { s.mode = 'drift'; s.ax = s.fx; s.ay = s.fy; }
      continue;
    }
    if (s.mode === 'follow') {
      if (running) { scatter(s); events.push({ kind: 'scared', id: s.id }); continue; }
      if (inZone) {
        const taken = new Set(spirits.filter(o => o.mode === 'rest').map(o => o.rest));
        s.rest = rules.restAt.findIndex((_, i) => !taken.has(i));
        s.mode = 'rest';
        s.slot = -1;
        events.push({ kind: 'settled', id: s.id });
        continue;
      }
      const [tx, ty] = followPoint(px, py, s.slot, time);
      approach(s, tx, ty, Math.min(1, dt * 3.2));
      continue;
    }
    // drift
    const d = Math.hypot(s.x - px, s.y - (py - 30));
    if (running && d < rules.scareRadius) { scatter(s); events.push({ kind: 'scared', id: s.id }); continue; }
    if (!running && d < (careful ? rules.catchGentle : rules.catchWalk)) {
      const used = new Set(spirits.filter(o => o.mode === 'follow').map(o => o.slot));
      s.mode = 'follow';
      s.slot = spirits.findIndex((_, i) => !used.has(i));
      events.push({ kind: 'caught', id: s.id });
      continue;
    }
    approach(s, s.ax + Math.sin(time * 0.9 + s.id * 2.1) * 16, s.ay + Math.cos(time * 1.3 + s.id) * 9, Math.min(1, dt * 1.5));
  }
  return events;
}

export const allResting = (spirits: readonly Spirit[]): boolean => spirits.every(s => s.mode === 'rest');

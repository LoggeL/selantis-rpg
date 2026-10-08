// First test of Lia's own staff in e3-eigener-stab (pure rules, tested in eigener-stab-ziele.test.ts). Three withered
// seed pods hang among the willow's branches; she knocks them off with the Stabstrahl. The three light spirits now
// resting in the branches and the brook right beside the willow must not be hit (Teil II's practice ground had a nest,
// a lantern and a bucket). Every miss is only a comment and a new try.
import { WILLOW_REST } from './lichtwald';

export type AimKind = 'target' | 'forbidden' | 'neutral';

export interface AimObject {
  id: string;
  kind: AimKind;
  /** Where the beam lands (map px). */
  at: readonly [number, number];
}

/** Painted spots on e3-lichtwald.png: three dry catkin clusters, the resting spirits, the brook, the trunk. */
export const WILLOW_OBJECTS: readonly AimObject[] = [
  { id: 'kapsel-links', kind: 'target', at: [690, 236] },
  { id: 'kapsel-mitte', kind: 'target', at: [886, 214] },
  { id: 'kapsel-rechts', kind: 'target', at: [1004, 240] },
  { id: 'geist-links', kind: 'forbidden', at: WILLOW_REST[0] },
  { id: 'geist-mitte', kind: 'forbidden', at: WILLOW_REST[1] },
  { id: 'geist-rechts', kind: 'forbidden', at: WILLOW_REST[2] },
  { id: 'bach', kind: 'forbidden', at: [1074, 270] },
  { id: 'stamm', kind: 'neutral', at: [834, 196] },
];

export const POD_IDS = WILLOW_OBJECTS.filter(o => o.kind === 'target').map(o => o.id);

/** The aim starts on the trunk (no hint towards any pod). */
export const AIM_START = 'stamm';

export type AimResult = 'hit' | 'again' | 'forbidden' | 'neutral';

/** Evaluates one beam at `id` when the pods in `hit` are already down. */
export function evaluateBeam(hit: readonly string[], id: string): AimResult {
  const obj = WILLOW_OBJECTS.find(o => o.id === id);
  if (!obj) throw new Error(`Unknown willow object ${id}`);
  if (obj.kind === 'forbidden') return 'forbidden';
  if (obj.kind === 'neutral') return 'neutral';
  return hit.includes(id) ? 'again' : 'hit';
}

export const allPodsDown = (hit: readonly string[]): boolean => POD_IDS.every(id => hit.includes(id));

/**
 * Spatial aiming: from the current object, the nearest object in the pressed direction (screen axes, y down).
 * Objects more than 75° off the direction are ignored; nothing there keeps the current object.
 */
export function nextInDirection(currentId: string, dx: number, dy: number, objects: readonly AimObject[] = WILLOW_OBJECTS): string {
  const cur = objects.find(o => o.id === currentId);
  if (!cur) return objects[0].id;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  let best: { id: string; score: number } | null = null;
  for (const o of objects) {
    if (o.id === cur.id) continue;
    const vx = o.at[0] - cur.at[0], vy = o.at[1] - cur.at[1];
    const d = Math.hypot(vx, vy);
    if (d === 0) continue;
    const cos = (vx * ux + vy * uy) / d;
    if (cos < 0.26) continue;
    const score = d * (1 + 2.2 * (1 - cos));
    if (!best || score < best.score) best = { id: o.id, score };
  }
  return best?.id ?? cur.id;
}

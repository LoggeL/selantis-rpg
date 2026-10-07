// Target practice of e2-stabtraining (pure rules, tested in stabtraining.test.ts). Ignatius calls a target by a
// description; Lia walks close to the painted object and fires the staff impulse at it. Decision over power: the
// bird nest, Ignatius' lantern and the water bucket stand right next to the called targets. Every miss is only a
// comment and a new try; mistakes are counted for his verdict, never punished.

export type ShotKind = 'target' | 'forbidden';

export interface PracticeObject {
  id: string;
  kind: ShotKind;
  /** Where the impulse lands (map px). */
  at: readonly [number, number];
}

/** Painted objects of the practice ground (e2-ignatius-lager.png) plus the three props placed for the exercise. */
export const PRACTICE_OBJECTS: readonly PracticeObject[] = [
  { id: 'ziel-stumpf-hinten', kind: 'target', at: [337, 184] },
  { id: 'ziel-stumpf-mitte', kind: 'target', at: [290, 234] },
  { id: 'ziel-stumpf-vorn', kind: 'target', at: [228, 306] },
  { id: 'ziel-scheibe-links', kind: 'target', at: [203, 150] },
  { id: 'ziel-scheibe-rechts', kind: 'target', at: [253, 133] },
  { id: 'ziel-scheibe-pfosten', kind: 'target', at: [72, 243] },
  { id: 'nest', kind: 'forbidden', at: [181, 214] },
  { id: 'laterne', kind: 'forbidden', at: [133, 262] },
  { id: 'eimer', kind: 'forbidden', at: [258, 312] },
];

/** Ignatius' calls in order: each called target stands next to one thing that must not be hit. */
export const PRACTICE_CALLS: readonly { target: string; call: string }[] = [
  { target: 'ziel-stumpf-hinten', call: 'Der Stumpf ganz hinten rechts. Der höchste von allen.' },
  { target: 'ziel-scheibe-links', call: 'Die linke Scheibe am Querbalken. Nicht die Meisen darunter.' },
  { target: 'ziel-stumpf-vorn', call: 'Der vordere Stumpf. Der gleich neben meinem Eimer.' },
  { target: 'ziel-scheibe-pfosten', call: 'Die kleine Scheibe am linken Pfosten. Meine Laterne steht direkt daneben.' },
];

export type ShotResult = 'hit' | 'wrong-target' | 'forbidden' | 'done';

/** Evaluates one shot at `objectId` while call number `callIndex` is open. */
export function evaluateShot(callIndex: number, objectId: string): ShotResult {
  if (callIndex >= PRACTICE_CALLS.length) return 'done';
  const obj = PRACTICE_OBJECTS.find(o => o.id === objectId);
  if (!obj) throw new Error(`Unknown practice object ${objectId}`);
  if (obj.kind === 'forbidden') return 'forbidden';
  return PRACTICE_CALLS[callIndex].target === objectId ? 'hit' : 'wrong-target';
}

/** Where the aim starts: the stump in the middle of the ground (no hint towards any call). */
export const AIM_START = 'ziel-stumpf-mitte';

/**
 * Spatial aiming: from the current object, the nearest object in the pressed direction (screen axes, y down).
 * Objects more than 75° off the direction are ignored; nothing there keeps the current object.
 */
export function nextInDirection(currentId: string, dx: number, dy: number, objects: readonly PracticeObject[] = PRACTICE_OBJECTS): string {
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

/** Ignatius' verdict after the last call, from the number of misses (wrong targets and forbidden hits). */
export function practiceVerdict(misses: number): 'flawless' | 'good' | 'hasty' {
  if (misses <= 0) return 'flawless';
  return misses <= 2 ? 'good' : 'hasty';
}

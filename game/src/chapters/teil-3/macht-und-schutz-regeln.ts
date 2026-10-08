// Pure rules of „e3-macht-und-schutz“ (docs/teil-3/umsetzung.md §3): the doctor's three instruments and the
// negotiation. No engine imports, so the rules are unit-tested (macht-und-schutz.test.ts).
//  - Bowl: Lia leans over the water (crouched in the hotspot) and holds still. Moving resets most of the progress.
//  - Candle: Lia follows the doctor's flame around the room. Close counts, far away earns a warning and loses a bit.
//  - Negotiation: three tones, one shared outcome (bonds off, staffs stay in the armoury, Lia stays).

/** Holding still over the bowl. */
export const STILL = {
  /** Seconds of stillness the water needs. */
  needSec: 2.4,
  /** Feet movement per tick (px) that still counts as „still“. */
  tolerance: 1.2,
  /** Fraction of the progress kept after a fidget. */
  keepOnMove: 0.35,
} as const;

/** Progress 0..1 of the bowl test after one tick. Only leaning over (crouched) and not moving fills it. */
export function stepStill(progress: number, dt: number, leaning: boolean, movedPx: number): number {
  if (!leaning) return Math.max(0, progress - dt * 0.15);
  if (movedPx > STILL.tolerance) return progress * STILL.keepOnMove;
  return Math.min(1, progress + dt / STILL.needSec);
}

/** Following the candle. */
export const FOLLOW = {
  /** Within this distance (px) of the doctor the flame is close enough. */
  near: 58,
  /** Beyond this distance the doctor complains. */
  far: 120,
  /** Seconds of watching the flame from close by. */
  needSec: 7,
} as const;

export type FollowVerdict = 'close' | 'ok' | 'far';

export function followVerdict(dist: number): FollowVerdict {
  if (dist <= FOLLOW.near) return 'close';
  if (dist <= FOLLOW.far) return 'ok';
  return 'far';
}

/** Progress 0..1 of the candle test after one tick. */
export function stepFollow(progress: number, dt: number, dist: number): number {
  const v = followVerdict(dist);
  if (v === 'close') return Math.min(1, progress + dt / FOLLOW.needSec);
  if (v === 'far') return Math.max(0, progress - dt * 0.05);
  return progress;
}

/** Lia's tone in the negotiation (e3-verhandlung-ton). */
export const VERHANDLUNG_TONES = ['kalt', 'bittend', 'klug'] as const;
export type VerhandlungTone = typeof VERHANDLUNG_TONES[number];

/**
 * Lia's three answers to „a few lives against thousands“. Each carries the same claim in its own tone: nobody gets the
 * power without her consent, and the Großmeister has seen what happens otherwise (umsetzung.md §3).
 */
export const VERHANDLUNG_ANSWERS: Record<VerhandlungTone, string> = {
  kalt: '„Ohne mein Ja bekommt keiner diese Kraft. Wie mein Nein aussieht, habt Ihr im Saal gesehen.“',
  bittend: '„Bitte. Ohne mein Ja geht es nicht. Und was im Saal passiert ist, will ich nie wieder.“',
  klug: '„Ohne mein Ja nützt Euch die Kraft nichts. Zwingen habt Ihr im Saal ja schon ausprobiert.“',
};

/** Lia's three ways of asking the guard where Ignatius sleeps (all of them get the answer). */
export const IGNATIUS_ASKS: readonly string[] = [
  '„Nur ob es ihm gut geht. Mehr will ich gar nicht wissen.“',
  '„Ich verrate keinem, dass Ihr es mir gesagt habt. Versprochen.“',
  '„Ihr habt ihn gefesselt durch die halbe Stadt geführt. Da könnt Ihr mir sagen, wo er schläft.“',
];

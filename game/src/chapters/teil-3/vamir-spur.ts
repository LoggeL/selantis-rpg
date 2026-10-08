// e3-vamir: the trail on the forest path (pure rules and texts, tested in vamir.test.ts). Three Spurenblick finds lie
// on the lower path, in the order Lia reaches them walking up: a violet burn mark, Ignatius' lost Schattentöter,
// boot prints that leave the path for the bank. Lia picks Schattentöter up (once; inventory is the truth): she carries
// it to him, and in e3-hueterin she may lay it down in the order house. Then she hears Vamir.
import { G } from '../../core/G';
import { STAFF } from '../common/bookContract';
import { grantOnce } from './shared';
import { WALDPFAD_SPOT } from './waldpfad';

export type TrailId = 'brand' | 'stab' | 'spur';

export interface TrailFind {
  id: TrailId;
  at: readonly [number, number];
  kind: 'mark' | 'glint' | 'footprint';
  angle?: number;
  /** Lia's thought when she inspects it (≤ 140 characters). */
  thought: string;
}

export const TRAIL: readonly TrailFind[] = [
  {
    id: 'brand', at: WALDPFAD_SPOT.brand, kind: 'mark',
    thought: 'Ein Brandfleck im Laub, aber nichts ist verkohlt. Die Blätter sind mit Reif überzogen. Im Herbst, am Nachmittag.',
  },
  {
    id: 'stab', at: WALDPFAD_SPOT.stab, kind: 'glint',
    thought: 'Schattentöter. Einfach liegen gelassen, mitten im Weg. Ignatius lässt den nie liegen. Nicht freiwillig.',
  },
  {
    id: 'spur', at: WALDPFAD_SPOT.spur, kind: 'footprint', angle: -130,
    thought: 'Seine Stiefel. Daneben schleift etwas. Die Spur verlässt den Weg und geht die Böschung hinauf.',
  },
];

export const TRAIL_IDS: readonly TrailId[] = TRAIL.map(t => t.id);

/** Scene flag of one find (reset whenever the trail part starts). */
export const trailFlag = (id: TrailId): string => `e3-va-${id}`;

/** The next find Lia has not read yet, in the order along the path. */
export function nextFind(found: ReadonlySet<TrailId>): TrailFind | undefined {
  return TRAIL.find(t => !found.has(t.id));
}

export function trailFound(): Set<TrailId> {
  return new Set(TRAIL_IDS.filter(id => G.state.is(trailFlag(id))));
}

/** Once-only flag for picking up Schattentöter on the path. */
export const SCHATTENTOETER_FOUND = 'e3-schattentoeter-gefunden';

/** Lia picks up Ignatius' Schattentöter (exactly once, even after a reload). */
export function pickUpSchattentoeter(): boolean {
  return grantOnce(SCHATTENTOETER_FOUND, () => {
    if (!G.state.has(STAFF.borrowed)) G.state.give(STAFF.borrowed);
  });
}

/** What Lia hears from up the bank before she sees anything (Vamir, then Ignatius). */
export const VOICES: readonly { who: 'vamir' | 'ignatius'; text: string }[] = [
  { who: 'vamir', text: 'Weiter, alter Mann. Du warst schon schneller, als wir beide noch im selben Saal saßen.' },
  { who: 'ignatius', text: 'Und du warst schon einmal lauter. Früher hast du wenigstens gebrüllt, bevor du zugeschlagen hast.' },
];

/** The confrontation seen from behind the bush (Vamir over the kneeling Ignatius). */
export const TABLEAU: readonly { who: 'vamir' | 'ignatius' | 'lia-think'; text: string }[] = [
  { who: 'vamir', text: 'Knie ruhig. Es steht dir. Sechzehn Jahre im Wald, und keiner hat dich vermisst.' },
  { who: 'ignatius', text: 'Das Mädchen kriegst du nicht. Nicht heute. Und nicht, solange ich noch einen Atemzug habe.' },
  { who: 'vamir', text: 'Dann kümmern wir uns um den Atemzug.' },
  { who: 'lia-think', text: 'Er hebt die Hand. Der Stab. Ich muss den Stab hochkriegen, schneller, warum sind meine Arme so schwer …' },
];

/** Thoughts on the lower path before the trail starts. */
export const OPENING_THOUGHTS: readonly string[] = [
  'Oben auf dem Hügel war es laut. Hier hört man nur mein Herz und das Laub.',
  'Ignatius ist vorausgerannt. Mit seinen Knien. Flick hätte ihn längst eingeholt.',
];

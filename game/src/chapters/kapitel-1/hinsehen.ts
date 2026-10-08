// „Hinsehen“ (ueberfall, the sunken lane): the riders pass Lia's hiding place in groups. She cannot see them while
// she is pressed into the roots, but she can hear them: when the hooves are right above her she must stay down; when
// the next group is still far off she may look up – once – and what she looks at stays with her. The saddlebags and
// the riders' plain black and white later become arguments in Kapitel II (strasse.ts); Kyra's look is her own.
// Pure data and rules, tested in hinsehen.test.ts; staged by ueberfall.ts through G.ui.scenePick.
import type { PickCard } from '../../ui/scenePick';

export type Look = 'kyra' | 'taschen' | 'zeichen';
export interface Pass { cue: 'nah' | 'fern'; sound: string }

export const PASSES: readonly Pass[] = [
  { cue: 'nah', sound: 'Hufschlag, ganz nah. Erde rieselt von der Böschung auf meinen Rücken.' },
  { cue: 'fern', sound: 'Die erste Gruppe ist vorbei. Die nächste höre ich erst am Waldrand. Ein paar Atemzüge Zeit.' },
  { cue: 'nah', sound: 'Wieder nah. Ein Pferd schnaubt direkt über mir, ein Stiefel schleift an den Zweigen.' },
  { cue: 'fern', sound: 'Die letzten zwei lassen sich Zeit. Einer singt, schief und laut. Sie sind noch weit.' },
];

export const DUCK = 'ducken';
const LOOKS: readonly (PickCard & { id: Look })[] = [
  { id: 'kyra', text: 'Nach Kyra sehen' },
  { id: 'taschen', text: 'Die Satteltaschen ansehen' },
  { id: 'zeichen', text: 'Auf Umhänge und Schilde sehen' },
];

/** What Lia sees when she looks up at the right moment. */
export const SEEN: Record<Look, string> = {
  kyra: 'Kyra. Gefesselt vor dem Grauhaarigen im Sattel. Sie dreht den Kopf, genau zu mir. Sie weiß, dass ich hier bin.',
  taschen: 'Die Satteltaschen sind prall, Decken obendrauf geschnürt. Proviant für Wochen, nicht für einen Ritt bis zur nächsten Stadt.',
  zeichen: 'Schwarz und Weiß, sonst nichts. Kein Wappen, kein Zeichen, nicht mal ein Stofffetzen in Farbe. Die wollen nicht erkannt werden.',
};
/** Looking up while the hooves are right above her. */
export const TOO_CLOSE = 'Ich heb den Kopf, und ein Pferd scheut. Der Reiter fährt herum. Runter, runter! Ich presse mich in die Wurzeln.';
export const DUCKED_FAR = 'Ich bleib unten. Ich seh nichts. Aber sie sehen mich auch nicht.';
export const DUCKED_NEAR = 'Gesicht in die Erde. Sie donnern vorbei, eine Armlänge über mir.';

/** Flag per look, read in Kapitel II. */
export const LOOK_FLAG: Record<Look, string> = { kyra: 'k1-gesehen-kyra', taschen: 'k1-gesehen-proviant', zeichen: 'k1-gesehen-zeichen' };

/** Cards for one pass: duck first, then the looks Lia has not used yet. */
export function passCards(seen: readonly string[]): PickCard[] {
  return [{ id: DUCK, text: 'Unten bleiben' }, ...LOOKS.map(l => (seen.includes(l.id) ? { ...l, disabled: true, reason: 'Schon gesehen.' } : l))];
}

/** Judges one pick for a pass (pure). */
export function judgePass(pass: Pass, pick: string): { ok: boolean; line: string; look?: Look } {
  if (pick === DUCK) return { ok: true, line: pass.cue === 'nah' ? DUCKED_NEAR : DUCKED_FAR };
  if (pass.cue === 'nah') return { ok: false, line: TOO_CLOSE };
  const look = pick as Look;
  return { ok: true, line: SEEN[look], look };
}

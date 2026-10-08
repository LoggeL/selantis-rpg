// „Wem gebe ich sie?“ (prolog-zuflucht): Valentus holds the Urmacht over the cradle of the twins and has to give it to
// one of them – the quiet one who watches him, or the one who screams at the world. Whichever he picks, the light
// splits in its fall and sinks into both. A choice that turns out not to be one; the flag remembers which child he
// reached for (a later callback can use it). Pure data, tested in wiege.test.ts; staged by zuflucht.ts.
import type { PickCard } from '../../ui/scenePick';

export type Twin = 'still' | 'laut';
export const TWINS: readonly (PickCard & { id: Twin })[] = [
  { id: 'still', text: 'Dem stillen Kind, das mich mit großen Augen ansieht' },
  { id: 'laut', text: 'Dem Kind, das schreit, als wolle es die ganze Welt verklagen' },
];
export const CHOICE_FLAG = 'prolog-wiege-wahl';

/** What happens when he lowers his hand (both answers are right; the light decides for itself). */
export function lightSplits(twin: Twin): string {
  return twin === 'still'
    ? 'Ich senke die Hand über das stille Kind. Das Licht fließt hinab – und teilt sich mitten im Fall. Die andere Hälfte sinkt in die Schreihälsin. Sie verstummt.'
    : 'Ich senke die Hand über das schreiende Kind. Das Licht fließt hinab – und teilt sich mitten im Fall. Die andere Hälfte sinkt in das stille. Es lächelt.';
}
export const AFTERTHOUGHT = 'Als hätte es nie eine Wahl gegeben. Zwei Hälften. Zwei Kinder. Möge keine von beiden je allein sein müssen.';

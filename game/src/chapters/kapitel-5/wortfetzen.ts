// „Wortfetzen“ (schattenlager): Lia listens from the shadows while Baris gives his orders. Close to the fire she hears
// whole sentences but sits in reach of the torch; behind the bush she stays dark and only catches scraps. Back with
// Flick she has to put together what she heard (how many stay, where the two ride). Getting both right makes her
// bluff more convincing: one extra distraction point (bluffScene.ts, flag 'k5-gelauscht-genau').
// Pure data and rules, tested in wortfetzen.test.ts; staged by schattenlager.ts through G.ui.scenePick.
import type { PickCard, PickLine } from '../../ui/scenePick';

export type Spot = 'nah' | 'fern';
export interface Moment { cue: string; prompt: string; torch?: boolean; near: PickLine; far: PickLine }

export const SPOTS: readonly (PickCard & { id: Spot })[] = [
  { id: 'nah', text: 'Näher ran, hinter den dicken Stamm am Feuer' },
  { id: 'fern', text: 'Im Schatten hinter dem Busch bleiben' },
];

export const MOMENTS: readonly Moment[] = [
  {
    cue: 'befehl', prompt: 'Der Hüne beugt sich zu Orwen und redet leise. Das Feuer knackt dazwischen.',
    near: { speaker: 'baris', text: '„Orwen. Wir sehen uns den Weg zur Grotte an. Heute noch.“' },
    far: { text: '„… Orwen … den Weg … Grotte …“ Den Rest frisst das Feuer.' },
  },
  {
    cue: 'fackel', torch: true, prompt: 'Eine Wache geht mit der Fackel ums Lager. Der Lichtschein wandert auf den dicken Stamm zu.',
    near: { text: 'Das Licht streift meine Schuhspitzen. Ich zieh die Füße ein. Gerade noch.' },
    far: { text: 'Im Busch ist es dunkel wie in einem Sack. Die Fackel zieht vorbei.' },
  },
  {
    cue: 'abschied', prompt: 'Der Hüne geht zu den Pferden. Im Weggehen ruft er den dreien am Feuer etwas zu.',
    near: { speaker: 'baris', text: '„Ihr drei bleibt bei ihr. Und keiner rührt sie an.“' },
    far: { text: '„… ihr drei … bei ihr …“ Dann Hufschlag.' },
  },
];

/** Judges a hiding spot for a moment: next to the fire is wrong only while the torch comes. */
export function judgeSpot(m: Moment, spot: string): { ok: boolean; line: PickLine } {
  if (spot === 'nah') return { ok: !m.torch, line: m.near };
  return { ok: true, line: m.far };
}

export interface Question { id: string; prompt: string; answers: (PickCard & { ok: boolean; reply: string })[] }

/** Flick asks; Lia puts together what she heard. */
export const QUESTIONS: readonly Question[] = [
  {
    id: 'wie-viele', prompt: 'Und was haben die geredet? Wie viele bleiben bei ihr?',
    answers: [
      { id: 'fuenf', text: '„Fünf. Mit dem Hünen und dem Grauhaarigen.“', ok: false,
        reply: 'Die zwei sind eben weggeritten. Das hab sogar ich von hier gesehen. Noch mal.' },
      { id: 'drei', text: '„Drei. Der Hüne hat es ihnen zugerufen.“', ok: true,
        reply: 'Drei. Damit kann man arbeiten.' },
      { id: 'alle', text: '„Alle. Die gehen nirgendwohin.“', ok: false,
        reply: 'Alle? Da fehlen schon zwei Pferde. Noch mal.' },
    ],
  },
  {
    id: 'wohin', prompt: 'Und wohin reiten die zwei?',
    answers: [
      { id: 'meister', text: '„Zu ihrem Meister. Bericht erstatten.“', ok: false,
        reply: 'Hat er das gesagt, oder klingt es nur so, wie es in deinen Büchern klingen würde?' },
      { id: 'portas', text: '„Nach Portas, Vorräte holen.“', ok: false,
        reply: 'Mitten in der Nacht? Ohne Wagen? Bestimmt nicht.' },
      { id: 'grotte', text: '„Zu einer Grotte. Sie sehen sich den Weg dorthin an.“', ok: true,
        reply: 'Eine Grotte. Davon hab ich hier noch nie gehört. Merk ich mir.' },
    ],
  },
];

export const LISTENED_FLAG = 'k5-gelauscht-genau';

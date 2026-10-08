// „Feuer nach Büchern“ (erstes-lager): Lia builds her first fire from what she gathered and from what she has read –
// some of it true, some of it adventure-novel nonsense. Four steps (the bed, the twigs, the wind, the drill); a wrong
// idea costs a little smoke and Lia's dry comment. Without tinder the leaves only smoulder once more. After three
// failures the secret turquoise spark lights the fire anyway (Urmacht hint: the player sees it, Lia does not).
// Pure data and rules, tested in feuerAufbau.test.ts; staged by lager.ts through G.ui.scenePick.
import type { PickCard } from '../../ui/scenePick';

export interface FireIdea extends PickCard { ok: boolean; line: string; needsTinder?: boolean }
export interface FireStep { id: string; prompt: string; ideas: FireIdea[] }

export const FIRE_STEPS: readonly FireStep[] = [
  {
    id: 'bett', prompt: 'Was kommt ganz nach unten, ins Herz der Feuerstelle?',
    ideas: [
      { id: 'zunder', text: 'Den trockenen Zunder aus der Küche', needsTinder: true, ok: true,
        line: 'Zunder nach unten. Mutter hat ihn immer im Topf über dem Herd getrocknet. Danke, Mutter.' },
      { id: 'aeste', text: 'Die dicksten Äste, damit es lange brennt', ok: false,
        line: 'In den Abenteuerbüchern fängt ein Baumstamm Feuer, wenn der Held nur finster genug schaut. Ich schaue finster. Nichts.' },
      { id: 'laub', text: 'Eine Handvoll trockenes Laub, zerrieben', ok: true,
        line: 'Zerriebenes Laub. Kein Zunder, aber es knistert wenigstens, wenn man es anfasst.' },
      { id: 'moos', text: 'Das weiche Moos vom Waldrand', ok: false,
        line: 'Weich, grün und nass. Das Moos qualmt, als hätte es eine Meinung über mich.' },
    ],
  },
  {
    id: 'reisig', prompt: 'Wie lege ich das Reisig darüber?',
    ideas: [
      { id: 'stapel', text: 'Fest zusammengedrückt, damit nichts verrutscht', ok: false,
        line: 'Fest gedrückt, und schon erstickt. Feuer braucht Luft. Das hätte ich wissen müssen, ich atme ja auch.' },
      { id: 'zelt', text: 'Locker gegeneinander gelehnt, wie ein kleines Zelt', ok: true,
        line: 'Locker gegeneinander, wie ein Zelt. Dazwischen bleibt Platz für Luft.' },
      { id: 'floss', text: 'Ordentlich quer übereinander, wie ein Floß', ok: false,
        line: 'Ordentlich wie ein Floß. Sehr hübsch. Brennt nicht.' },
    ],
  },
  {
    id: 'wind', prompt: 'Ein paar Blätter treiben über die Lichtung, alle nach Osten. Wohin mit der offenen Seite?',
    ideas: [
      { id: 'westen', text: 'Nach Westen, dem Wind entgegen', ok: false,
        line: 'Dem Wind entgegen. Er pustet mir die Glut aus der Hand und die Asche ins Gesicht.' },
      { id: 'rundum', text: 'Rundum offen, dann kommt Luft von allen Seiten', ok: false,
        line: 'Luft von allen Seiten. Und Wind auch. Die Späne fliegen mir um die Ohren.' },
      { id: 'osten', text: 'Nach Osten, den großen Stein als Schild nach Westen', ok: true,
        line: 'Der Stein nach Westen, gegen den Wind, die Öffnung nach Osten. Da kann die Glut atmen, ohne wegzufliegen.' },
    ],
  },
  {
    id: 'bohren', prompt: 'Der Bohrstab in der Kerbe. Wie drehe ich ihn?',
    ideas: [
      { id: 'schnell', text: 'So schnell es geht, dann ist es schneller vorbei', ok: false,
        line: 'Schnell, schneller, abgerutscht. Der Stab springt aus der Kerbe, und die Hitze ist weg.' },
      { id: 'zauberwort', text: 'Erst Alanas Zauberwort sagen, wie im Buch', ok: false,
        line: 'Ich sag Alanas Zauberwort. Laut. Der Wald antwortet nicht. Gut, dass mich keiner hört.' },
      { id: 'gleichmaessig', text: 'Lang und gleichmäßig, auch wenn die Arme brennen', ok: true,
        line: 'Lang und gleichmäßig. Die Arme brennen, die Spitze wird heiß, dann riecht es nach Rauch.' },
    ],
  },
];

/** Failures after which the turquoise spark jumps over. */
export const SPARK_AFTER = 3;
/** Without tinder, a well-built fire smoulders out once more. */
export const NO_TINDER_LINE = 'Laub ist eben kein Zunder. Erst Qualm, ein Glimmen … und wieder nichts. Noch einmal.';

/** The ideas Lia has at hand: Mother's tinder only if she packed it. */
export function ideasFor(step: FireStep, tinder: boolean): FireIdea[] {
  return step.ideas.map(i => (i.needsTinder && !tinder ? { ...i, disabled: true, reason: 'Liegt noch zu Hause in der Küche.' } : i));
}

/** How the fire catches: by the build's mistakes (plus one without tinder). */
export function fireOutcome(mistakes: number, tinder: boolean): 'ember' | 'spark' {
  return mistakes + (tinder ? 0 : 1) >= SPARK_AFTER ? 'spark' : 'ember';
}

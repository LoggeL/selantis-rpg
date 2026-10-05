// Kapitel V: the bluff at the guards' fire (schattenlager) and how long the distraction holds (rettung).
// Pure data + rules, unit-tested in bluff.test.ts. Points 0..3 (flag 'k5-ablenkung').

export type Line = readonly [speaker: string, text: string, mood?: string];

export interface BluffOption {
  text: string;
  /** Small tag shown next to the option (the item that makes it possible). */
  tag?: string;
  /** Change of the distraction points. */
  delta: number;
  /** Reaction lines after the choice. */
  reply: Line[];
  /** Item handed over (taken from the bag). */
  take?: string;
}

/** Beat 1: „Du bist aber noch viel zu jung.“ */
export const BEAT_YOUNG: BluffOption[] = [
  { text: '„Frühreif.“', delta: 1, reply: [['algard', 'Frühreif! Hahaha! Die gefällt mir.', 'neutral'], ['maedchen', 'Mir nicht.', 'angry']] },
  { text: '„Ich bin sechzehn! Fast siebzehn.“', delta: 0, reply: [['algard', 'Sechzehn. Und schon so vorlaut.']] },
  { text: '„Meine Mutter wartet am Waldrand.“', delta: -1, reply: [['maedchen', 'Am Waldrand? Dann holen wir sie doch dazu.', 'angry'], ['k5-lia', 'Nein! Sie … ist schüchtern.', 'scared']] },
];

/** Beat 2: „Du hast aber gar nichts zum Verkaufen dabei?“ — options depend on the bag. */
export function beatGoods(has: (item: string) => boolean): BluffOption[] {
  const out: BluffOption[] = [];
  if (has('book-herbs')) out.push({
    text: '„Kräuter. Ich kenne jedes einzelne aus Cronibus’ Lexikon.“', tag: 'Kräuterlexikon', delta: 1,
    reply: [['algard', 'Kräuter, ja? Hast du was gegen Kopfweh?'], ['k5-lia', 'Speikraut. Kauen, nicht schlucken. Und nicht so viel trinken.', 'happy'], ['algard', 'Hörst du, Mädchen? Die Kleine weiß was.']],
  });
  if (has('honey-cake')) out.push({
    text: '„Honig-Apfelkuchen! Probiert mal.“', tag: 'Honig-Apfelkuchen', delta: 1, take: 'honey-cake',
    reply: [['algard', 'Mmh … Bei allen Zehn. So was hab ich seit Jahren nicht gegessen.'], ['maedchen', 'Gib her, ich will auch!']],
  });
  if (has('cheese')) out.push({
    text: '„Käse vom Hof meiner Eltern.“', tag: 'Käse', delta: 1, take: 'cheese',
    reply: [['algard', 'Käse! Endlich was anderes als Dörrfleisch.'], ['maedchen', 'Der riecht wie deine Stiefel, Algard.']],
  });
  out.push(has('book-alana')
    ? { text: '„Geschichten. Für ein Kupferstück lese ich euch vor.“', tag: 'Alana-Buch', delta: 1,
      reply: [['maedchen', 'Vorlesen? Du kannst lesen?', 'neutral'], ['k5-lia', '„Und Alana hob die Hand, und das Licht gehorchte ihr …“'], ['algard', 'Weiter! Was passiert dann?']] }
    : { text: '„Geschichten. Ich erzähle sie euch für ein Kupferstück.“', delta: 0,
      reply: [['algard', 'Geschichten haben wir selber. Meistens schlechte.']] });
  out.push({ text: '„Das … geht euch nichts an.“', delta: -1, reply: [['maedchen', 'Ach nein? Und was ist in dem Beutel?', 'angry']] });
  return out;
}

/** Beat 3: a noise at the tree. Lia must keep their eyes on her. */
export const BEAT_NOISE: BluffOption[] = [
  { text: '„Ich hab gehört, euer Hauptmann sucht ein neues Dienstmädchen?“', delta: 1,
    reply: [['algard', 'Hahaha! Das letzte hat er … na, sagen wir, es war nicht lange im Dienst.'], ['maedchen', 'Die da hält keinen Tag durch. Ich wette drei Silberne.']] },
  { text: '(Ohnmacht vortäuschen.) „Mir ist … so schwindlig …“', delta: 1,
    reply: [['maedchen', 'He! He, nicht umfallen! Algard, Wasser!'], ['algard', 'Wasser? Ich hab nur Wein.']] },
  { text: '„Da ist nichts. Nur der Wind.“', delta: -1,
    reply: [['maedchen', 'Seit wann weiß ein Marktmädchen, was hinter meinem Rücken ist?', 'angry']] },
];

export const clampPoints = (n: number): number => Math.max(0, Math.min(3, Math.round(n)));

/** German verdict shown after the bluff. */
export function verdict(points: number): string {
  return ['Die Wachen trauen dir kein Wort.', 'Die Wachen sind abgelenkt, aber misstrauisch.', 'Die Wachen hängen dir an den Lippen.', 'Die Wachen haben Kyra völlig vergessen.'][clampPoints(points)];
}

export interface RescueSetup {
  /** Flick's start tile (next to the tree, or still in the grass). */
  flick: { x: number; y: number };
  /** Guards stare at Lia and lose their first enemy phase. */
  guardsSkipFirst: boolean;
  /** Flick already cut the first strand of the rope before the fight starts. */
  firstCutDone: boolean;
  /** Lia's abilities in the rescue battle. */
  lia: string[];
  /** Flick's abilities. */
  flickAbilities: string[];
}

/** Battle setup from the bluff points and whether Lia carries her father's dagger. */
export function rescueSetup(points: number, hasDagger: boolean): RescueSetup {
  const p = clampPoints(points);
  const cut = p >= 3 ? 'k5-losschneiden' : 'k5-schneiden';
  return {
    flick: p >= 1 ? { x: 8, y: 4 } : { x: 9, y: 2 },
    guardsSkipFirst: p >= 2,
    firstCutDone: p >= 3,
    lia: ['ausweichen', 'ablenken', 'steinwurf', ...(hasDagger ? ['dolch', cut] : [])],
    flickAbilities: ['bogen', 'messer', cut],
  };
}

// „e2-urmacht“: Lia finishes the Xenovia story herself. Pure data and tag rules (urmacht-wissen.test.ts): which
// answers are right, which book-one knowledge marks them (lore, memories, items), and the reply to every wrong answer.

/** What Lia carries from book one (a snapshot of G.state). */
export interface BookOneKnowledge {
  lore: readonly string[];
  memories: readonly string[];
  /** Item ids currently in the bag. */
  items: readonly string[];
}

export interface XenoviaOption {
  id: string;
  text: string;
  correct: boolean;
  /** Reply to a wrong answer (who says it and what); the step is asked again without this option. */
  wrong?: { by: 'mentor' | 'lia'; text: string; mood?: string };
}

export interface XenoviaStep {
  id: 'meeresgrund' | 'fest' | 'gebaeck';
  /** The stranger's question that Lia answers. */
  question: string;
  options: XenoviaOption[];
}

/** Lore entries from book one that tell the Xenovia story (prolog book, the jugglers, the festival). */
export const XENOVIA_LORE = ['lore-xenovia', 'k2-lore-xenovia', 'k3-lore-verbannungsfest'] as const;
/** Memories of the festival Lia was always too young for. */
export const FEST_MEMORIES = ['k1-mem-fest', 'k2-mem-fest', 'k3-mem-fest'] as const;

export const XENOVIA_STEPS: XenoviaStep[] = [
  {
    id: 'meeresgrund',
    question: 'Und Xenovia selbst? Was taten die Zehn mit ihr?',
    options: [
      { id: 'meer', text: '„Sie verbannten sie auf den Meeresgrund.“', correct: true },
      {
        id: 'stern', text: '„Sie machten einen Stern aus ihr. Crios.“', correct: false,
        wrong: { by: 'mentor', text: 'Crios war ein Adler und hat beim Stürzen geholfen. Wer hat dir das erzählt, ein Gaukler?', mood: 'happy' },
      },
      {
        id: 'berg', text: '„Sie mauerten sie in einen Berg ein.“', correct: false,
        wrong: { by: 'mentor', text: 'Eingemauert wurde etwas anderes. Dazu komme ich gleich. Wohin mit der Göttin?', mood: 'thinking' },
      },
    ],
  },
  {
    id: 'fest',
    question: 'Und was macht das Volk heute daraus?',
    options: [
      {
        id: 'fasten', text: '„Einen Fastentag. Bis zum Abend isst keiner was.“', correct: false,
        wrong: { by: 'mentor', text: 'Fasten? In Trapas? Da würde der halbe Markt vor Kummer eingehen.', mood: 'happy' },
      },
      { id: 'fest', text: '„Jeden Sommer das Verbannungsfest in Trapas.“', correct: true },
      {
        id: 'vergessen', text: '„Gar nichts. Die Leute haben es vergessen.“', correct: false,
        wrong: { by: 'mentor', text: 'Vergessen ist das Letzte, was sie damit tun. Sie feiern es jedes Jahr lauter.' },
      },
    ],
  },
  {
    id: 'gebaeck',
    question: 'Und was isst man dort, wenn man alt genug ist?',
    options: [
      {
        id: 'kuchen', text: '„Honig-Apfelkuchen.“', correct: false,
        wrong: { by: 'lia', text: 'Nein. Das ist nur mein Lieblingskuchen. Ich hab Hunger, glaube ich.', mood: 'thinking' },
      },
      {
        id: 'fisch', text: '„Fisch. Wegen des Meeres.“', correct: false,
        wrong: { by: 'mentor', text: 'Logisch gedacht und trotzdem falsch. In Trapas mögen sie es süß.' },
      },
      { id: 'kette', text: '„Kettengebäck. Für die Ketten, die zerbrochen sind.“', correct: true },
    ],
  },
];

/** Small tag shown next to an answer when Lia's book-one knowledge supports it (none for wrong answers). */
export function xenoviaTag(step: XenoviaStep['id'], option: XenoviaOption, k: BookOneKnowledge): string | undefined {
  if (!option.correct) return undefined;
  const lore = (ids: readonly string[]) => ids.some(id => k.lore.includes(id));
  if (step === 'meeresgrund') return lore(XENOVIA_LORE) ? 'Wissen: Xenovia' : undefined;
  if (step === 'fest') {
    if (k.lore.includes('k3-lore-verbannungsfest')) return 'Wissen: Verbannungsfest';
    return FEST_MEMORIES.some(id => k.memories.includes(id)) ? 'Erinnerung: das Fest' : undefined;
  }
  if (k.items.includes('chain-pastry')) return 'Kettengebäck';
  return lore(['k2-lore-xenovia', 'k3-lore-verbannungsfest', 'lore-xenovia']) ? 'Wissen: Verbannungsfest' : undefined;
}

/** Whether Lia remembers being too young for the festival (changes her line after the festival answer). */
export function remembersFestival(k: BookOneKnowledge): boolean {
  return FEST_MEMORIES.some(id => k.memories.includes(id));
}

/** The stranger's verdict after the three steps, by the number of answers right at the first try. */
export function xenoviaVerdict(firstTry: number): string {
  if (firstTry >= 3) return 'Fehlerfrei. In Trapas hätten sie dich auf einen Wagen gestellt und vorlesen lassen.';
  if (firstTry === 2) return 'Beinahe fehlerfrei. Den Rest hätte dir jedes Kind in Trapas zugeflüstert.';
  return 'Die Gaukler erzählen es bunter, du erzählst es ehrlicher. Das ist mehr wert.';
}

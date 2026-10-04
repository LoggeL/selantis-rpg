export type CampDialogueTopic = 'kyra' | 'road' | 'watch';
export type CampDialogueChoiceId = CampDialogueTopic | 'back';

export type CampDialogueChoice = {
  id: CampDialogueChoiceId;
  label: string;
};

/** Optional first-night conversation. Original adaptation, not novel quotations. */
export const CAMP_DIALOGUE_CHOICES: readonly CampDialogueChoice[] = [
  { id: 'kyra', label: 'Über Kyra' },
  { id: 'road', label: 'Über den Weg' },
  { id: 'watch', label: 'Über die Wache' },
  { id: 'back', label: 'Zurück' },
];

export const CAMP_DIALOGUE_PROMPT = 'Foltan: Du bist noch wach. Möchtest du etwas fragen?';
export const CAMP_DIALOGUE_TUTORIAL = 'Wähle ein Gesprächsthema. Nach der Antwort kannst du weiterfragen oder mit Zurück zum Lager gehen.';

const BRANCHES: Record<CampDialogueTopic, readonly string[]> = {
  kyra: [
    'Lia: Ich kann nicht einfach hier liegen, während Kyra irgendwo bei diesen Männern ist.',
    'Foltan: Ich verstehe, dass du weiterwillst. Aber im Dunkeln würdest du ihre Spur verlieren. Ruh dich aus. Morgen gehen wir gemeinsam weiter.',
    'Lia: Dann weck mich, sobald es hell wird.',
  ],
  road: [
    'Lia: Wo führt ihr mich morgen hin?',
    'Foltan: Zu unserem Lager. Wir werden die Straße verlassen und durch den Wald gehen. Dort können wir nachfragen, ob jemand deine Schwester gesehen hat.',
    'Lia: Ich komme mit. Aber ich will erfahren, was ihr herausfindet.',
  ],
  watch: [
    'Lia: Wirst du die ganze Nacht wach bleiben?',
    'Foltan: Vorerst schon. Wenn ich müde werde, wecke ich Azar. Du brauchst Schlaf.',
    'Lia: Gut. Wenn du etwas hörst, weckst du mich auch.',
  ],
};

/** An empty branch means leave the menu; the scene must never auto-select a topic. */
export function campDialogueBranch(choice: CampDialogueChoiceId): readonly string[] {
  return choice === 'back' ? [] : BRANCHES[choice];
}

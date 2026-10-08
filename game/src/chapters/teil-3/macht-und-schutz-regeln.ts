// Pure rules of „e3-macht-und-schutz“ (docs/teil-3/umsetzung.md §3): the doctor's bowl and the
// negotiation. No engine imports, so the rules are unit-tested (macht-und-schutz.test.ts).
//  - Bowl: what Lia thinks of over the water („Woran denkst du?“): calm memories leave it still, fear makes it leap.
//  - Negotiation: three tones, one shared outcome (bonds off, staffs stay in the armoury, Lia stays).

/** The bowl: what Lia thinks of with her hands over the water. Calm thoughts leave it still; fear makes it leap. */
export type BowlThoughtId = 'kueche' | 'buch' | 'reiter' | 'kyra';
export interface BowlThought { id: BowlThoughtId; text: string; thought: string; effect: 'still' | 'leap' }
export const BOWL_THOUGHTS: readonly BowlThought[] = [
  { id: 'kueche', text: 'An Mutters Küche, wenn das Brot im Ofen ist.', thought: 'Warmes Brot, Mehl auf dem Tisch, Mutter summt falsch. Das Wasser liegt da wie Glas.', effect: 'still' },
  { id: 'buch', text: 'An Alana, Seite vierzig, mit dem Honigfleck.', thought: 'Alana hebt die Hand, und das Licht gehorcht. Das Wasser rührt sich nicht. Es liest wohl nicht gern.', effect: 'still' },
  { id: 'reiter', text: 'An die Nacht, als die Reiter auf den Hof kamen.', thought: 'Fackeln. Das Schreien. Vater im Hof. Meine Hände zittern über der Schale, und das Wasser …', effect: 'leap' },
  { id: 'kyra', text: 'An Kyra. Irgendwo da draußen, in Vamirs Händen.', thought: 'Kyra, allein, bei ihm. Und ich sitze hier mit Kissen. Etwas in mir zieht sich zusammen, und das Wasser …', effect: 'leap' },
];
/** The doctor's answers to calm water (in order). */
export const BOWL_STILL: readonly string[] = [
  'Glatt wie ein Spiegel. Hübsch. Und vollkommen nutzlos. Denk an etwas anderes.',
  'Wieder nichts. Ich sehe mein Gesicht darin, und das kenne ich schon. Etwas, das dir Angst macht. Na los.',
];

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

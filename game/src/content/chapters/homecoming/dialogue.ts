/** Condensed adaptation of the sisters' conversation, Roman PDF pp. 9-10. */
export const SISTER_CONVERSATION_SEQUENCE = [
  { narrativeId: 'homecoming.sisters.late-promise', line: 'Kyra: „Ich komme gleich nach“, hast du gesagt. Das war vor zwei Stunden!' },
  { narrativeId: 'homecoming.sisters.lost-time', line: 'Lia: Schon so spät? Herrje. Tut mir leid, es war gerade so spannend.' },
  { narrativeId: 'homecoming.sisters.wood-alone', line: 'Kyra: Bei dir ist es immer gerade spannend. Das ganze Holz hab ich allein gesammelt.' },
  { narrativeId: 'homecoming.sisters.book-adventures', line: 'Lia: Hier ist es eben so öde. In meinem Buch gibt es mutige Helden und schöne Königstöchter.' },
  { narrativeId: 'homecoming.sisters.danger-since-dunkelhain', line: 'Kyra: Sei froh drum. Seit Dunkelhain ziehen Dunkelschatten und Räuber durchs Land. Ein Wunder, dass sie uns bisher verschont haben.' },
  { narrativeId: 'homecoming.sisters.boring-home', line: 'Lia: Siehst du? Selbst denen ist es hier zu langweilig.' },
  { narrativeId: 'homecoming.sisters.rebuke', line: 'Kyra: Lia!' },
  { narrativeId: 'homecoming.sisters.feed-pigs', line: 'Lia: Ja, schon gut. Dafür füttere ich heute Abend die Schweine. Versprochen.' },
  { narrativeId: 'homecoming.sisters.supper', line: 'Kyra: Das hoffe ich für dich. Kommst du mit? Gleich gibt es Abendbrot, und Mutter macht sich sonst Sorgen.' },
  { narrativeId: 'homecoming.sisters.stay-longer', line: 'Lia: Geh ruhig schon vor. Ich bleibe noch kurz und …' },
  { narrativeId: 'homecoming.sisters.keep-promise', line: 'Kyra: … liest. Hätte ich mir denken können. Aber denk an die Schweine!' },
  { narrativeId: 'homecoming.sisters.one-more-chapter', line: 'Lia: Noch ein Kapitel. Darauf kannst du dich verlassen.' },
] as const;

/** String lines retained for the existing scene dialogue interface. */
export const SISTER_CONVERSATION = SISTER_CONVERSATION_SEQUENCE.map(beat => beat.line);

// Lia has already entered the sunken lane before the chapter title. Use the
// next map's validated entry, not her coordinates in the illustrated meadow.
export const HOME_PATH_ENTRY = { narrativeId: 'homecoming.home-path-entry', map: 'hohlweg', from: 'wiese' } as const;

export type GriefBeat = { id: string; narrativeId: string; line: string; label?: string };

/** Condensed narration from Roman PDF pp. 17-18, held for reader input. */
export const RAID_GRIEF_BEATS: readonly GriefBeat[] = [
  { id: 'collapse', narrativeId: 'aftermath.raid.collapse', line: 'Erst als die Reiter verschwunden sind, kommt Lia aus ihrem Versteck. Auf dem Weg zum Hof sinkt sie auf die Knie.' },
  { id: 'tears', narrativeId: 'aftermath.raid.tears', line: 'Lia weint. Minutenlang. Noch nie hat sie so weinen müssen. Die Zeit ist ihr egal.', label: 'Noch einen Moment' },
  { id: 'rise', narrativeId: 'aftermath.raid.rise', line: 'Schließlich wischt Lia sich mit dem Ärmel ihrer Bluse das Gesicht ab. Langsam steht sie auf. Sie muss zu ihren Eltern.', label: 'Aufstehen' },
];

export const PARENTS_GRIEF_BEATS: readonly GriefBeat[] = [
  { id: 'parents-aftermath', narrativeId: 'aftermath.parents.parents-aftermath', line: 'Vorsichtig tritt Lia zu ihren Eltern. Sie liegen eng beieinander. Wieder werden ihre Augen feucht.', label: 'Bei ihnen bleiben' },
  { id: 'questions', narrativeId: 'aftermath.parents.questions', line: 'Lia (Gedanke): Warum? Warum ihr? Warum Kyra? Was habt ihr denn getan?' },
  { id: 'uncertainty', narrativeId: 'aftermath.parents.uncertainty', line: 'Lia (Gedanke): Wie soll ich sie denn retten? Ich war noch nie länger als einen Tag von zu Hause weg.' },
  { id: 'vow', narrativeId: 'aftermath.parents.vow', line: 'Lia (Gedanke): Aber ich muss sie retten. Kyra ist die einzige Familie, die ich noch habe.', label: 'Bleiben' },
];

export const AFTERMATH_GRIEF_BEATS: readonly (GriefBeat & { phase: 'night' | 'dawn' })[] = [
  { id: 'night-stones', narrativeId: 'aftermath.grief.night-stones', phase: 'night', line: 'Die Nacht vergeht. Lia trägt kleine Felsen und große Steine zum Haus. Ihre Eltern sollen ein Grab bekommen.' },
  { id: 'night-wounds', narrativeId: 'aftermath.grief.night-wounds', phase: 'night', line: 'Ihre Hände sind blutig. In den Holzschuhen hat sie sich die Füße wundgelaufen. Trotzdem trägt sie weiter Stein um Stein.', label: 'Noch bleiben' },
  { id: 'night-thoughts', narrativeId: 'aftermath.grief.night-thoughts', phase: 'night', line: 'Beim Steinetragen denkt Lia darüber nach, wie es weitergehen soll. Wie kann sie Kyra retten? Die ganze Nacht sucht sie nach einer Antwort. Sie findet keine.' },
  { id: 'dawn-graves', narrativeId: 'aftermath.grief.dawn-graves', phase: 'dawn', line: 'Die Sonne taucht den Himmel in rötliches Licht. Lia kniet vor den beiden Steingräbern. Sie ist erschöpft. Da ist wieder diese Leere.', label: 'Bei ihnen bleiben' },
  { id: 'dawn-farewell', narrativeId: 'aftermath.grief.dawn-farewell', phase: 'dawn', line: 'Lia erhebt sich langsam, ohne den Blick von den Gräbern zu wenden. Danke, sagt sie in Gedanken.', label: 'Noch einen Moment' },
  { id: 'dawn-preparation', narrativeId: 'aftermath.grief.dawn-preparation', phase: 'dawn', line: 'Der Hof ist ihr fremd geworden. Lia sieht zur Tür. Sie will Kyra suchen, aber sie kann nicht unvorbereitet aufbrechen.', label: 'Zum Hof' },
];

/** Condensed Roman pp. 13-17; choreography is implemented by the scene adapter. */
export type RaidCueId = 'bringKyra' | 'intimidateFather' | 'inspectHands' | 'killFather' | 'bindKyra' | 'threatenMother' | 'killMother' | 'depart';
export type RaidSpeakerId = 'lia' | 'father' | 'mother' | 'leader' | 'kyra' | 'captor' | 'hooded';
export interface RaidObservationBeat {
  narrativeId: string;
  id: string;
  line: string;
  shot?: string;
  shotOptions?: { fit: 'contain' };
  shotAfterAction?: boolean;
  courtyard?: boolean;
  actor?: RaidSpeakerId;
  cue?: RaidCueId;
}

export const RAID_OBSERVATION_BEATS: readonly RaidObservationBeat[] = [
      { narrativeId: 'homecoming.raid.cover', id: 'cover', line: 'Lia (Gedanke): Schwarz-weiße Wappenröcke … Das müssen Dunkelschatten sein.', shot: 'cinematic-raid-cover', actor: 'lia' },
      // The novel reports this claim in the leader's next question; make it explicit
      // before Kyra appears so the parents' attempt to protect her is readable.
      { narrativeId: 'homecoming.raid.parents-alone', id: 'parents-alone', line: 'Vater: Wir sind allein.', shot: 'cinematic-raid-confrontation', shotOptions: { fit: 'contain' }, actor: 'father' },
      { narrativeId: 'homecoming.raid.parents-protect', id: 'parents-protect', line: 'Lia (Gedanke): Allein? Kyra ist doch vorgegangen … Sie verstecken sie.', actor: 'lia' },
      { narrativeId: 'homecoming.raid.kyra-found', id: 'kyra-found', line: 'Narbiger: Seht mal, wen ich gefunden habe.', courtyard: true,
        shot: 'cinematic-raid-kyra-found', shotOptions: { fit: 'contain' }, shotAfterAction: true, actor: 'captor',
        cue: 'bringKyra' },
      { narrativeId: 'homecoming.raid.question', id: 'question', line: 'Grauhaariger: Ihr sagtet, ihr seid allein. Und wer ist das?', actor: 'leader' },
      { narrativeId: 'homecoming.raid.father-denial', id: 'father-denial', line: 'Vater: Ich kenne sie nicht. Sie ist nur ein neugieriges Kind. Lasst sie laufen.', actor: 'father' },
      { narrativeId: 'homecoming.raid.intimidation', id: 'intimidation', line: 'Grauhaariger: Wie oft hab ich solche Lügen schon gehört. Ihr Bauern seid doch alle gleich.', actor: 'leader',
        cue: 'intimidateFather' },
      { narrativeId: 'homecoming.raid.father-plea', id: 'father-plea', line: 'Vater: Bitte lasst sie gehen!', actor: 'father' },
      { narrativeId: 'homecoming.raid.threat', id: 'threat', line: 'Kapuzenmann: Sollen wir sie vor ihren Eltern auspeitschen?', actor: 'hooded' },
      { narrativeId: 'homecoming.raid.hands', id: 'hands', line: 'Grauhaariger: Nein. Zeig deine Hände!', actor: 'leader',
        cue: 'inspectHands' },
      { narrativeId: 'homecoming.raid.captivity', id: 'captivity', line: 'Grauhaariger: Hornhaut. Du kannst arbeiten. Der Hauptmann braucht eine neue Dienstmagd.', actor: 'leader' },
      { narrativeId: 'homecoming.raid.father-protest', id: 'father-protest', line: 'Vater: Lasst sie in Ruhe!', actor: 'father' },
      { narrativeId: 'homecoming.raid.father-stab', id: 'father-stab', line: 'Der Grauhaarige stößt Vater den Dolch in die Brust.', shot: 'cinematic-raid-father-stab', shotOptions: { fit: 'contain' }, cue: 'killFather' },
      { narrativeId: 'homecoming.raid.father-death', id: 'father-death', line: 'Vater bricht zusammen. Er rührt sich nicht mehr.', shot: 'cinematic-raid-father-death', shotOptions: { fit: 'contain' } },
      { narrativeId: 'homecoming.raid.kyra-bound', id: 'kyra-bound', line: 'Sie fesseln Kyras Hände hinter dem Rücken.', shot: 'cinematic-raid-kyra', shotAfterAction: true,
        cue: 'bindKyra' },
      { narrativeId: 'homecoming.raid.mother-threat', id: 'mother-threat', line: 'Grauhaariger: Weint nicht, meine Liebe. Wenn ihr euch so allein fühlt, folgt ihm doch ins Jenseits.', actor: 'leader',
        cue: 'threatenMother' },
      { narrativeId: 'homecoming.raid.mother-stab', id: 'mother-stab', line: 'Mit demselben Dolch sticht er auch Mutter nieder.', shot: 'cinematic-raid-mother-stab', shotOptions: { fit: 'contain' }, cue: 'killMother' },
      { narrativeId: 'homecoming.raid.mother-fall', id: 'mother-fall', line: 'Mutter fällt neben Vater.', shot: 'cinematic-raid-mother-death', shotOptions: { fit: 'contain' } },
      { narrativeId: 'homecoming.raid.mother-last-word', id: 'mother-last-word', line: 'Mutter: Kyra ...', actor: 'mother' },
      { narrativeId: 'homecoming.raid.mother-death', id: 'mother-death', line: 'Dann stirbt sie.' },
      { narrativeId: 'homecoming.raid.kyra-vow', id: 'kyra-vow', line: 'Kyra: Ich werde euch töten! Das schwöre ich bei allen Göttern!', actor: 'kyra' },
      { narrativeId: 'homecoming.raid.captor-order', id: 'captor-order', line: 'Grauhaariger: Das wollen viele Mädchen. Stell dich hinten an. – Verwahrt sie gut. Der Hauptmann wird sich über unser Geschenk freuen.', actor: 'leader' },
      { narrativeId: 'homecoming.raid.departure', id: 'departure', line: 'Sie nehmen Kyra mit.', shot: 'cinematic-raid-departure', cue: 'depart' },
    ];

import type { MapDef } from '../maps';

// Roman S. 13: Der Hof am Ende des Hohlwegs. Das Bauernhaus ist deutlich kleiner als die Scheune rechts daneben,
// hinter dem Haus das Gatter mit den Schweinen, direkt dahinter ein Wäldchen.
// Der Hohlweg kommt von links auf den Hofplatz, der Feldweg führt oben rechts zu den Feldern.
export const hof: MapDef = {
  id: 'hof',
  name: 'Der Hof',
  bg: 'bg-map-hof',
  start: [40, 188],
  walk: [
    [
      // Hohlweg links, Oberkante entlang Böschung und Hauskante
      [0, 166], [30, 169], [60, 174], [95, 178], [120, 181], [150, 181], [166, 179], [176, 177],
      [240, 177], [262, 175], [292, 175], [318, 177],
      // Büsche und Scheunenfront
      [334, 183], [352, 191], [372, 196], [392, 193], [412, 191], [470, 191], [484, 193],
      // hinter dem Karren hoch zum Feldweg (Karren selbst ist Blocker)
      [552, 176], [559, 176],
      // Feldweg nach oben rechts
      [556, 160], [552, 140], [549, 120], [551, 100], [556, 82], [564, 62], [574, 42], [581, 22], [582, 0],
      [617, 0], [616, 20], [612, 42], [606, 62], [599, 82], [595, 100], [598, 120], [604, 140], [610, 160], [614, 178], [614, 194],
      // rechts: Gebüsch hinter Zaun und Trog, Feld unten rechts
      [612, 230], [600, 254], [585, 270], [560, 279], [520, 286],
      // Unterkante: Wiesenrand vor Büschen und Feld
      [480, 290], [440, 291], [400, 289], [360, 291], [320, 289], [280, 287], [240, 284], [210, 279], [190, 268],
      [170, 255], [150, 244], [130, 234], [100, 224], [70, 215], [40, 208], [15, 203], [0, 202],
    ],
  ],
  block: [
    // Bauernhaus mit Holzstapel
    [[176, 88], [322, 88], [322, 173], [176, 173]],
    // Scheune
    [[318, 40], [530, 40], [530, 172], [500, 187], [392, 188], [318, 170]],
    // Schweinegatter und Wäldchen hinter dem Haus
    [[0, 0], [320, 0], [320, 98], [170, 98], [100, 120], [0, 120]],
    // Karren
    [[480, 192], [496, 172], [550, 160], [566, 163], [566, 182], [548, 192], [546, 202], [518, 204], [495, 199]],
    // Zaun beim Trog
    [[565, 198], [612, 196], [612, 228], [565, 228]],
    // Trog
    [[526, 216], [592, 216], [592, 243], [526, 243]],
  ],
  exits: [
    { rect: [0, 164, 6, 40], to: 'hohlweg' },
    { rect: [582, 0, 36, 10], to: 'felder' },
  ],
  entries: {
    hohlweg: { at: [16, 186], facing: 'e' },
    felder: { at: [596, 40], facing: 's' },
  },
  triggers: [
    // Vor der Haustür: wer ans Haus herangeht, sieht, was geschehen ist (Ende der Demo)
    { id: 'hof-ankunft', rect: [172, 176, 158, 62] },
  ],
  props: [
    { id: 'schweine', at: [154, 198], radius: 20, action: 'feedPigs', lines: ["Die Schweine. Ich hab's Kyra versprochen. Gleich nach dem Abendbrot."] },
    { id: 'scheune', at: [402, 202], radius: 22, lines: ['Unsere Scheune. Viel größer als das Haus.', 'Es riecht nach Heu und warmem Holz.'] },
    {
      id: 'karren', at: [508, 210], radius: 24,
      lines: [
        'Vaters Karren. Damit fährt er frühmorgens nach Trapas auf den Markt.',
        'Erst in der Abenddämmerung kommt er wieder. Manchmal mit Apfelkuchen.',
      ],
    },
    { id: 'trog', at: [556, 250], radius: 22, lines: ['Der Trog. Hier hol ich nachher das Wasser für die Schweine.'] },
  ],
  critters: [
    { kind: 'pig', at: [176, 74] }, { kind: 'pig', at: [226, 80] },
    { kind: 'chicken', at: [380, 268], area: [330, 245, 150, 50] },
    { kind: 'chicken', at: [440, 280], area: [330, 245, 150, 50] },
    { kind: 'chicken', at: [295, 285], area: [260, 270, 90, 30] },
  ],
  pickups: [{ id: 'kornblume', item: 'kornblume', at: [140, 233] }],
};

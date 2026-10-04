import type { MapDef } from "../../modules/exploration/mapTypes";

// Roman S. 7: Kyra stößt sich am Stamm, der quer über dem Weg liegt, den Zeh – kurz darauf tritt sie
// aus dem Wald auf die Wiese hinaus. Der Waldweg kommt von links und führt rechts auf die Wiese.
const STAMM = [
  'Hier hat sich Kyra bestimmt wieder den Zeh gestoßen. Sie flucht dann immer so schön.',
  'Der Stamm liegt schon ewig quer über dem Weg. Außen herum ist es leichter.',
];

export const waldrand: MapDef = {
  id: 'waldrand',
  name: 'Der Waldrand',
  bg: 'bg-map-waldrand',
  start: [300, 188],
  walk: [
    [
      // oberer Rand: Stammfüße und Büsche der hinteren Baumreihe, die große Eiche, Böschung
      [0, 86], [14, 82], [52, 82], [76, 86], [100, 94], [130, 100], [190, 102], [205, 94], [230, 80], [285, 80],
      [292, 92], [300, 100], [306, 128], [330, 134], [350, 140], [372, 156], [388, 164], [392, 176], [454, 178],
      [470, 186], [518, 188], [524, 200], [560, 204], [600, 205], [640, 206],
      // rechter Rand (Weg hinaus), dann Buschwerk unten rechts und Kornfeld
      [640, 242], [600, 246], [560, 244], [520, 238], [490, 226], [470, 215], [440, 212], [400, 212], [370, 216],
      [350, 222], [340, 240], [338, 270], [345, 300], [340, 330],
      // unterer Rand: Büsche und Farn, oberhalb des Reisighaufens
      [300, 322], [240, 322], [215, 310], [200, 292], [170, 282], [150, 268], [110, 256], [78, 256],
      // linker Rand: Baum und Büsche
      [66, 238], [46, 218], [40, 190], [60, 185], [82, 180], [75, 145], [50, 135], [30, 110], [0, 108],
    ],
  ],
  block: [
    // umgestürzter Stamm quer über dem Weg (an beiden Enden zu umgehen)
    [[148, 156], [172, 146], [255, 118], [266, 124], [262, 142], [215, 175], [205, 205], [175, 212], [150, 200]],
    // Farnbusch auf der Lichtung
    [[238, 240], [290, 238], [296, 272], [234, 274]],
    // Stein
    [[236, 296], [258, 294], [260, 306], [236, 308]],
  ],
  exits: [{ rect: [632, 206, 8, 36], to: 'wiese' }],
  entries: {
    wiese: { at: [618, 224], facing: 'w' },
  },
  jumps: [
    // Über den umgestürzten Stamm springen statt außen herum
    { a: [146, 130], b: [224, 196], radius: 20, hint: 'E / Klick: über den Stamm springen' },
  ],
  props: [
    { id: 'stamm', at: [214, 192], radius: 30, lines: STAMM },
    { id: 'stamm-west', at: [146, 160], radius: 26, lines: STAMM },
    {
      id: 'reisig', at: [112, 268], radius: 28, discovery: 'Kyras Holz entdeckt', lines: [
        'Reisig und Feuerholz. Kyra hat heute alles allein gesammelt – während ich gelesen habe.',
        'Ich schulde ihr was. Heute Abend füttere ich die Schweine. Versprochen ist versprochen.',
      ],
    },
    {
      id: 'eiche', at: [420, 184], radius: 26, action: 'returnChick', lines: [
        'Die alte Eiche am Waldrand. In ihrem Schatten ist es angenehm kühl.',
        'Kühl ist schön. Kalt nicht.',
      ],
    },
  ],
  critters: [
    { kind: 'bird', at: [300, 250], area: [250, 220, 120, 60] }, { kind: 'butterfly', at: [290, 200] },
  ],
  pickups: [{ id: 'kueken', item: 'kueken', at: [448, 200] }],
};

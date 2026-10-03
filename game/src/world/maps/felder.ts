import type { MapDef } from '../maps';

// Roman S. 6–12: die weiten Wiesen und Felder der Eltern – Weizen, Rübenacker, Obstbäume, eine Bank am Feldweg.
// Der Feldweg kommt links herein (zur Wiese) und biegt rechts unten zum Hof ab.
export const felder: MapDef = {
  id: 'felder',
  name: 'Die Felder',
  bg: 'bg-map-felder',
  start: [220, 248],
  walk: [
    // Wiese, Feldraine und Feldweg; oben begrenzt vom Weizen, rechts vom Rübenacker samt Büschen und Apfelbaum.
    [
      [0, 152], [58, 152], [60, 160], [94, 160], [100, 158], [140, 158], [146, 152], [282, 150],
      [284, 168], [344, 170], [346, 182], [368, 182], [372, 176], [376, 210], [440, 210], [500, 218],
      [504, 250], [640, 250], [640, 360], [0, 360],
    ],
  ],
  block: [
    // Bank am Feldweg
    [[272, 200], [332, 200], [332, 233], [272, 233]],
    // Büsche unten links
    [[0, 300], [24, 284], [60, 274], [96, 282], [104, 312], [80, 330], [44, 340], [40, 360], [0, 360]],
    [[134, 288], [160, 280], [196, 286], [202, 312], [170, 318], [136, 310]],
    // Busch am Weg rechts unten
    [[430, 298], [470, 296], [476, 326], [432, 330]],
  ],
  exits: [
    { rect: [0, 196, 8, 84], to: 'wiese' },
    { rect: [462, 352, 96, 8], to: 'hof' },
  ],
  entries: {
    wiese: { at: [18, 246], facing: 'e' },
    hof: { at: [510, 336], facing: 'n' },
  },
  props: [
    {
      id: 'apfelbaum', at: [357, 188], radius: 22, action: 'shakeTree',
      lines: [
        'Kyra mag den Frühling am liebsten, wenn die Obstbäume voller Blüten sind.',
        'Ich mag lieber den Sommer. Da kann man draußen lesen, bis die Sonne untergeht.',
        'Manchmal bringt Vater vom Markt in Trapas honiggesüßten Apfelkuchen mit. Hmm …',
      ],
    },
    {
      id: 'bank', at: [302, 218], radius: 26, discovery: 'Blick über die Felder',
      lines: [
        'Die Bank am Feldweg. Von hier aus sieht man die ganzen Felder.',
        'Hier sitzt selten jemand. Einen Knecht können sich Vater und Mutter nicht leisten.',
      ],
    },
    {
      id: 'weizen', at: [200, 154], radius: 22,
      lines: [
        'Der Weizen ist ganz trocken. Seit Tagen hat es nicht geregnet.',
        'Vater bangt um seine Ernte. Hoffentlich regnet es bald.',
      ],
    },
    {
      id: 'rueben', at: [462, 214], radius: 22,
      lines: [
        'Mohrrüben, Reihe um Reihe.',
        'Mutter stammt aus einer reichen Händlerfamilie in Trapas. Für Vater hat sie das alles aufgegeben.',
        'Jetzt wühlt sie hier auf dem Feld nach Mohrrüben. Wenn das mal nicht wahre Liebe ist.',
      ],
    },
  ],
  critters: [
    { kind: 'hare', at: [210, 286], area: [60, 180, 500, 150], burrow: [30, 318] },
    { kind: 'butterfly', at: [250, 190] }, { kind: 'butterfly', at: [430, 240] },
  ],
  pickups: [
    { id: 'fallobst-links', item: 'apfel', at: [96, 174] },
    { id: 'fallobst-rechts', item: 'apfel', at: [540, 262] },
    { id: 'kornblume', item: 'kornblume', at: [240, 300] },
  ],
};

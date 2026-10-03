import type { MapDef } from '../maps';

// Roman S. 12–13: Lia läuft die Böschung hinunter auf den ausgehöhlten Feldweg, der schnurstracks nach Hause führt.
// Der Weg kommt oben links von der Wiese ins Bild, biegt unter der Erdwand nach Osten und öffnet sich rechts zum Hof.
export const hohlweg: MapDef = {
  id: 'hohlweg',
  name: 'Der Hohlweg',
  bg: 'bg-map-hohlweg',
  start: [330, 222],
  walk: [
    [
      // Wandseite (rechts bzw. oben am Weg), von oben links nach rechts
      [104, 0], [106, 40], [114, 64], [128, 84], [150, 104], [176, 124], [204, 142], [240, 172], [300, 192],
      [360, 203], [420, 208], [460, 210], [500, 200], [530, 184], [560, 162], [590, 150], [612, 144], [640, 140],
      // Feldseite (links bzw. unten am Weg), zurück nach oben links
      [640, 163], [618, 163], [600, 176], [580, 194], [556, 208], [530, 226], [500, 240], [460, 249], [420, 251],
      [380, 250], [340, 246], [300, 238], [270, 225], [240, 211], [210, 198], [180, 180], [158, 166], [136, 150],
      [120, 134], [104, 118], [88, 102], [76, 86], [70, 60], [68, 0],
    ],
  ],
  block: [],
  exits: [
    { rect: [66, 0, 42, 8], to: 'wiese' },
    { rect: [632, 138, 8, 30], to: 'hof' },
  ],
  entries: {
    wiese: { at: [87, 32], facing: 's' },
    hof: { at: [618, 155], facing: 'w' },
  },
  props: [
    {
      id: 'boeschung', at: [112, 112], radius: 22,
      lines: ['Hier wär ich vorhin beinahe hingefallen. Holzschuhe und Böschungen vertragen sich nicht.', 'Gerade noch auf den Beinen geblieben. Kyra hätte sich kaputtgelacht.'],
    },
    {
      id: 'erde', at: [300, 216], radius: 28,
      lines: ['Der Boden ist noch ganz warm. Ich spür\'s sogar durch die Holzschuhe.', 'Im Winter friert man sich hier die Zehen ab. Sommer ist einfach schöner.', 'Der Weg führt schnurstracks nach Hause. Den find ich im Schlaf.'],
    },
    {
      id: 'erdwand', at: [450, 216], radius: 22,
      lines: ['Die Erdhügel und Sträucher halten die Abendsonne ab. Schön schattig hier.', 'Ein gutes Plätzchen zum Lesen. Ob Alana ihren Balduin wiedersieht?'],
    },
  ],
  critters: [{ kind: 'bird', at: [251, 210], area: [210, 200, 100, 20] }],
  pickups: [{ id: 'kupfer', item: 'kupfer', at: [382, 226] }],
};

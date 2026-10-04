import type { MapDef } from "../../modules/exploration/mapTypes";

export const wiese: MapDef = {
  id: 'wiese',
  name: 'Die Wiese am Baum',
  bg: 'bg-lia',
  start: [262, 200],
  walk: [
    [[6, 92], [140, 84], [190, 120], [330, 126], [430, 116], [540, 138], [500, 212], [455, 292], [440, 330], [505, 360], [60, 360], [40, 300], [6, 282]],
    [[575, 112], [640, 100], [640, 136], [616, 142], [600, 192], [586, 262], [572, 330], [588, 360], [500, 360], [520, 300], [545, 230], [568, 160]],
    // Offener unterer Wiesenrand verbindet die Lichtung mit dem Feldweg.
    [[430, 302], [474, 312], [508, 318], [540, 312], [544, 332], [520, 354], [480, 352], [446, 330]],
  ],
  block: [
    [[230, 118], [296, 118], [304, 176], [222, 178]],
    [[104, 112], [176, 112], [178, 150], [104, 152]],
  ],
  exits: [
    { rect: [0, 90, 14, 190], to: 'waldrand' },
    { rect: [632, 100, 8, 36], to: 'felder' },
    { rect: [500, 352, 88, 8], to: 'hohlweg' },
  ],
  entries: {
    waldrand: { at: [22, 200], facing: 'e' },
    felder: { at: [612, 120], facing: 'w' },
    hohlweg: { at: [548, 336], facing: 'n' },
  },
  props: [
    { id: 'baum', at: [262, 186], radius: 26, discovery: 'Lias Leseplatz', lines: ['Der alte Baum. Hier findet mich Kyra nie.', 'Na ja. Meistens nie.'] },
    { id: 'gras', at: [380, 250], radius: 30, lines: ['Das Gras ist ganz trocken. Seit Tagen kein Regen – Vater macht sich Sorgen um die Ernte.'] },
  ],
  critters: [
    { kind: 'butterfly', at: [200, 250] }, { kind: 'butterfly', at: [380, 228] }, { kind: 'butterfly', at: [120, 200] },
    { kind: 'bird', at: [330, 300], area: [260, 260, 160, 60] }, { kind: 'bird', at: [160, 316], area: [100, 280, 140, 60] },
  ],
  pickups: [{ id: 'kornblume', item: 'kornblume', at: [418, 300] }],
};

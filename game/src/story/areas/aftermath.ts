import type { Pt } from '../../world/maps';
import type { StoryArea } from '../types';

// Roman S. 18-22: dieselbe Hofgeographie am Morgen nach dem Überfall.
// Beide Gräber sind bereits fertig, die Nacht liegt hinter Lia.
export const FARM_DAWN_AREA: StoryArea = {
  id: 'farm-dawn',
  name: 'Der Hof im Morgenlicht',
  bg: 'bg-farm-dawn',
  start: [253, 273] as Pt,
  walk: [[
    [0, 166], [30, 169], [60, 174], [95, 178], [120, 181], [150, 181], [166, 179], [176, 177],
    [240, 177], [262, 175], [292, 175], [318, 177], [334, 183], [352, 191], [372, 196],
    [392, 193], [412, 191], [470, 191], [484, 193], [552, 176], [559, 176],
    [556, 160], [552, 140], [549, 120], [551, 100], [556, 82], [564, 62], [574, 42], [581, 22], [582, 0],
    [617, 0], [616, 20], [612, 42], [606, 62], [599, 82], [595, 100], [598, 120], [604, 140], [610, 160], [614, 178], [614, 194],
    [612, 230], [600, 254], [585, 270], [560, 279], [520, 286], [480, 290], [440, 291],
    [400, 289], [360, 291], [320, 289], [280, 287], [240, 284], [210, 279], [190, 268],
    [170, 255], [150, 244], [130, 234], [100, 224], [70, 215], [40, 208], [15, 203], [0, 202],
  ], [
    // Schmaler Gang links am Haus zum sichtbaren Gatter hinter dem Haus.
    [135, 196], [169, 196], [170, 108], [149, 104], [136, 121],
  ]] as Pt[][],
  block: [
    [[176, 88], [322, 88], [322, 173], [176, 173]],
    [[318, 40], [530, 40], [530, 172], [500, 187], [392, 188], [318, 170]],
    [[0, 0], [320, 0], [320, 98], [170, 98], [100, 120], [0, 120]],
    [[480, 192], [496, 172], [550, 160], [566, 163], [566, 182], [548, 192], [546, 202], [518, 204], [495, 199]],
    [[565, 198], [612, 196], [612, 228], [565, 228]],
    [[526, 216], [592, 216], [592, 243], [526, 243]],
    // Kleine Steinhaufen, seitlich und davor zugänglich.
    [[202, 238], [238, 238], [238, 256], [202, 256]],
    [[264, 236], [299, 236], [299, 257], [264, 257]],
  ] as Pt[][],
  targets: [
    { id: 'grave-mother', at: [220, 247] as Pt, radius: 28, label: 'Bei Mutter' },
    { id: 'grave-father', at: [283, 247] as Pt, radius: 28, label: 'Bei Vater' },
    { id: 'door', at: [273, 182] as Pt, radius: 18, label: 'Haus betreten' },
    { id: 'pig-gate', at: [154, 108] as Pt, radius: 26, label: 'Schweine freilassen' },
    // Bildlinks schließt der Hohlweg an. Die Himmelsrichtung folgt dem Roman,
    // nicht der Bildschirmachse: die Entführer ritten diesen Weg nach Osten.
    { id: 'east-departure', at: [20, 188] as Pt, radius: 24, label: 'Hohlweg nach Osten' },
  ],
};

// Anker auf den sichtbaren Gegenständen. Die Radien erlauben den Zugriff vom
// freien Boden vor den Möbeln, ohne auf oder durch die Tische zu laufen.
export const FARM_INTERIOR_AREA: StoryArea = {
  id: 'farm-interior',
  name: 'Das leere Haus',
  bg: 'bg-farm-interior',
  start: [300, 282] as Pt,
  walk: [[[70, 120], [580, 120], [580, 330], [70, 330]]] as Pt[][],
  block: [
    // Lebensmitteltheke, Wasserschlauchtisch und Küchenschrank rechts.
    [[377, 120], [485, 120], [485, 179], [377, 179]],
    // Hinter Wasserschlauchtisch und Schrank bleibt kein begehbarer Spalt.
    [[495, 120], [580, 120], [580, 166], [495, 166]],
    [[524, 157], [580, 157], [580, 232], [524, 232]],
    // Medizintisch, Reisekleider und Büchertisch.
    [[82, 132], [139, 132], [139, 165], [82, 165]],
    [[90, 185], [130, 185], [130, 235], [90, 235]],
    [[251, 142], [327, 142], [327, 203], [251, 203]],
  ] as Pt[][],
  targets: [
    { id: 'food', at: [431, 138] as Pt, radius: 56, label: 'Proviant einpacken' },
    { id: 'cupboard', at: [551, 201] as Pt, radius: 46, label: 'Geheimfach öffnen' },
    { id: 'water', at: [518, 140] as Pt, radius: 44, label: 'Wasserschlauch mitnehmen' },
    { id: 'medicine', at: [110, 145] as Pt, radius: 35, label: 'Ferse verbinden' },
    { id: 'clothing', at: [110, 216] as Pt, radius: 35, label: 'Reisefertig machen' },
    { id: 'books', at: [289, 163] as Pt, radius: 53, label: 'Bücher einpacken' },
    { id: 'exit-door', at: [310, 306] as Pt, radius: 24, label: 'Zum Hof' },
  ],
};

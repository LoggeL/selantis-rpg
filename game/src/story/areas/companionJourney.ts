import type { Pt, StoryArea } from '../types';

/** Foot edges follow companion-forest-trail.png, not the generation prompt. */
const TRAIL: Pt[] = [
  [0, 167], [55, 170], [105, 181], [160, 188], [210, 193],
  [250, 178], [274, 154], [296, 157], [336, 164], [365, 180],
  [420, 183], [475, 161], [520, 144], [570, 132], [640, 119],
  [640, 161], [600, 178], [560, 195], [510, 210], [455, 218],
  [405, 234], [353, 249], [300, 252], [247, 248], [198, 236],
  [150, 223], [107, 209], [70, 193], [0, 201],
];

export const COMPANION_MORNING_AREA: StoryArea = {
  id: 'companion-morning', name: 'Mit Foltan und Azar durch den Wald', bg: 'bg-companion-forest-trail',
  start: [40, 185], walk: [TRAIL], block: [],
  targets: [
    { id: 'breakfast', at: [100, 198], radius: 24, label: 'Azar nach dem Frühstück fragen' },
    { id: 'moss', at: [315, 178], radius: 23, label: 'Moos am Baum ansehen' },
    { id: 'rest', at: [320, 214], radius: 23, label: 'Mittagsrast im Moos' },
    { id: 'continue', at: [604, 154], radius: 22, label: 'Foltan weiter durch den Wald folgen' },
    { id: 'camp-return', at: [22, 183], radius: 16, label: 'Zum ersten Lager zurück' },
  ],
};

/** A second stretch reuses the forest painting mirrored, with warmer light. */
export const COMPANION_AFTERNOON_AREA: StoryArea = {
  id: 'companion-afternoon', name: 'Der Waldweg am Nachmittag', bg: 'bg-companion-forest-trail',
  start: [38, 154], walk: [TRAIL.map(([x, y]) => [640 - x, y] as Pt)], block: [],
  targets: [
    { id: 'rest-return', at: [22, 148], radius: 16, label: 'Zur Mooslichtung zurück' },
    { id: 'foltan', at: [326, 204], radius: 25, label: 'Foltan nach dem weiteren Weg fragen' },
    { id: 'evening', at: [600, 185], radius: 22, label: 'Den Waldweg bis zum Abend weitergehen' },
  ],
};

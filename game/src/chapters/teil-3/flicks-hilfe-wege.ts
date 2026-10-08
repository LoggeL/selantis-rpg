// „e3-flicks-hilfe“: the false camp at night (the same painted clearing as e3-falle, falle-lager.ts) seen from Flick's
// post, and the persuasion in the order's hall. The cage wagon has left: the camera and the walkable ground stop just
// west of where it stood (its painted shape stays outside the picture), and its ruts lead off to the east.
// Pure data and small rules (no engine imports); flicks-hilfe.test.ts checks geometry, the wolves and the choices.
import type { Polygon } from '../../world';
import { CAMP_SPOT } from './falle-lager';

type Spot = readonly [number, number];
type P = [number, number][];

/** The clearing at night, cut off at x 975 (the wagon is gone; the camera bounds end at x 1000). */
export const NIGHT_WALK: P[] = [[
  [212, 250], [250, 224], [330, 214], [520, 208], [560, 196], [690, 196], [700, 224], [905, 228], [960, 236], [975, 240],
  [975, 432], [900, 444], [800, 470], [766, 560], [760, 720], [636, 720], [622, 580], [592, 556], [470, 548], [380, 528],
  [250, 508], [226, 470], [212, 360],
]];
/** Camera bounds (map px): the eastern edge hides where the wagon stood. */
export const NIGHT_CAMERA = { x: 340, y: 120, w: 660, h: 600 } as const;

export const NIGHT_SPOT = {
  /** Flick, with her back to the post and the shackle. */
  post: CAMP_SPOT.post,
  /** Where she takes a brand from the embers. */
  brand: [604, 412],
  /** The wagon's ruts and the horses' prints, leading east out of the picture. */
  ruts: [952, 336],
  /** Down the path: out of the camp. */
  pathOut: [698, 690],
} as const satisfies Record<string, Spot>;

export const PATH_EXIT: Polygon = [[636, 672], [762, 672], [760, 720], [636, 720]];

// ---------------------------------------------------------------------------------------------------------------
// Wolves: only eyes at the edge of the light and sounds
// ---------------------------------------------------------------------------------------------------------------

/** Where the eyes show while Flick is still tied, by how far she has worked the rope (0, 1, 2 turns). */
export const WOLF_STAGES: readonly (readonly Spot[])[] = [
  [[640, 600]],
  [[790, 520], [470, 532]],
  [[850, 452], [560, 500], [700, 560]],
];
/** Where they wait once she is free (in the dark between the tents and at the palisade). */
export const WOLF_LURK: readonly Spot[] = [[600, 214], [890, 244], [240, 290]];
/** How close the eyes come to Flick with and without a burning brand (map px). */
export const WOLF_NEAR = { brand: 120, bare: 58 } as const;

/**
 * The eyes keep their distance: pulled `step` px towards the lurking spot, but never closer to Flick than `min`
 * (pushed straight away from her if they are). Returns the new position.
 */
export function keepAway(eye: Spot, flick: Spot, lurk: Spot, min: number, step = 4): [number, number] {
  let x = eye[0], y = eye[1];
  const lx = lurk[0] - x, ly = lurk[1] - y, ld = Math.hypot(lx, ly);
  if (ld > 0.5) { const k = Math.min(step, ld) / ld; x += lx * k; y += ly * k; }
  const dx = x - flick[0], dy = y - flick[1], d = Math.hypot(dx, dy);
  if (d < min) {
    if (d < 0.01) return [flick[0], flick[1] - min];
    const k = min / d;
    x = flick[0] + dx * k; y = flick[1] + dy * k;
  }
  return [x, y];
}

/** Turns in the rope until her hands are free. */
export const ROPE_TURNS = 3;

// ---------------------------------------------------------------------------------------------------------------
// The hall: how Flick convinces the Großmeister
// ---------------------------------------------------------------------------------------------------------------

export type FlickTone = 'spott' | 'ehrlich' | 'ignatius';
export type FlickProof = 'striemen' | 'weg' | 'geduld';

export interface HallLine { who: string; text: string; mood?: string }
export interface HallOption<K extends string> { key: K; text: string; lines: HallLine[] }

/** Round 1 – „Why should I believe you?“ Three tones, each answered by the Großmeister (and Ignatius). */
export const TONE_OPTIONS: readonly HallOption<FlickTone>[] = [
  {
    key: 'spott', text: '„Klar. Vamir schickt seine Spione immer mit Striemen an den Handgelenken und Dreck bis zu den Knien.“',
    lines: [
      { who: 'e2-flick', text: 'Klar. Vamir schickt seine Spione immer mit Striemen an den Handgelenken und Dreck bis zu den Knien.', mood: 'smirk' },
      { who: 'e3-grossmeister', text: 'Spar dir den Spott für die Wölfe, Elfe. Hier drin macht er dich nur verdächtiger.', mood: 'angry' },
    ],
  },
  {
    key: 'ehrlich', text: '„Ich heiße Flick. Ich hab sie im Regen kennengelernt, als sie allein ihre Schwester gesucht hat. Ich lass sie nicht da.“',
    lines: [
      { who: 'e2-flick', text: 'Ich heiße Flick. Ich hab sie im Regen kennengelernt, als sie allein ihre Schwester gesucht hat.', mood: 'determined' },
      { who: 'e2-flick', text: 'Einmal hat sie mich vor Baris’ Axt gerettet, ohne zu wissen, wie. Ich lass sie nicht da. Mit oder ohne Euch.', mood: 'determined' },
      { who: 'e3-grossmeister', text: 'Das klingt ehrlich. Ehrlich klingen konnten die besten Lügner, die mir je gegenüberstanden, auch.', mood: 'thinking' },
    ],
  },
  {
    key: 'ignatius', text: '(Zu dem alten Mann am Tisch:) „Ihr seid Ignatius? Dann sagt ihm, wer ich bin. Sie hat Euch doch von mir erzählt.“',
    lines: [
      { who: 'e2-flick', text: 'Ihr seid Ignatius, oder? Dann sagt ihm, wer ich bin. Sie hat Euch bestimmt von mir erzählt.', mood: 'determined' },
      { who: 'e2-ignatius', text: 'Eine Elfe mit losem Mundwerk, die sie „Leseratte“ nennt und rechts nicht richtig zupacken kann.', mood: 'thinking' },
      { who: 'e2-ignatius', text: 'Lia hat von dir erzählt, ja. Meistens dann, wenn sie eigentlich üben sollte. Flick.', mood: 'happy' },
      { who: 'e3-grossmeister', text: 'Ein Fahnenflüchtiger bürgt für eine Fremde. Ihr verzeiht, wenn mich das nicht beruhigt.', mood: 'grim' },
    ],
  },
];

/** Round 2 – „Why should I send my men into a forest a stranger shows me?“ */
export const PROOF_OPTIONS: readonly HallOption<FlickProof>[] = [
  {
    key: 'striemen', text: '(Die Handgelenke zeigen.) „Das ist von heute. Der Pfosten steht noch da, schaut ihn Euch an.“',
    lines: [
      { who: 'e2-flick', text: 'Seht her. Das ist von heute. Der Pfosten steht noch da, mit einer Schelle dran. Schaut ihn Euch an.', mood: 'angry' },
      { who: 'e3-grossmeister', text: 'Frische Striemen. Hm. Wer sich verkleidet, schneidet sich selten so tief.', mood: 'thinking' },
    ],
  },
  {
    key: 'weg', text: '„Drei Zelte, ein Feuer ohne Wache, ein Käfigwagen unter grauer Plane. Die Spur geht nach Osten. Ich finde sie auch nachts.“',
    lines: [
      { who: 'e2-flick', text: 'Drei Zelte, ein Feuer ohne Wache, ein Käfigwagen unter grauer Plane. Zwei Pferde, ein Rad eiert.', mood: 'determined' },
      { who: 'e2-flick', text: 'Die Spur geht nach Osten. Ich finde sie auch im Dunkeln. Das ist das Einzige, was ich richtig gut kann.', mood: 'determined' },
      { who: 'e3-grossmeister', text: 'Du zählst wie ein Kundschafter. Das hätte ich einer wie dir nicht zugetraut.', mood: 'thinking' },
    ],
  },
  {
    key: 'geduld', text: '„Weil sie da draußen in einem Käfig liegt, während Ihr hier sitzt und rechnet!“',
    lines: [
      { who: 'e2-flick', text: 'Weil sie da draußen in einem Käfig liegt, während Ihr hier sitzt und rechnet!', mood: 'angry' },
      { who: 'e3-hauptmann', text: 'Zügle deine Zunge vor dem Großmeister.' },
      { who: 'e3-grossmeister', text: 'Lass sie. Sie hat nicht ganz unrecht, und das ärgert mich mehr als ihr Ton.', mood: 'grim' },
    ],
  },
];

/** Ignatius vouches (always; a little differently if Flick already spoke to him). */
export function vouchLines(tone: FlickTone): HallLine[] {
  const first: HallLine = tone === 'ignatius'
    ? { who: 'e2-ignatius', text: 'Großmeister. Ich habe für sie gesprochen, und ich bürge für sie. Mit allem, was Ihr mir noch glaubt.', mood: 'determined' }
    : { who: 'e2-ignatius', text: 'Großmeister. Lia hat mir von dieser Elfe erzählt. Ich bürge für sie, mit allem, was Ihr mir noch glaubt.', mood: 'determined' };
  return [
    first,
    { who: 'e2-ignatius', text: 'Was zugegeben nicht viel ist. Aber wenn Vamir das Mädchen hat, fehlt ihm nur noch Zeit. Gebt ihm keine.', mood: 'grim' },
  ];
}

/** Kept result of the hall: how Flick convinced him (first choice) and what she showed (second). */
export const FH_RESULT = { tone: 'e3-flick-ton', proof: 'e3-flick-beweis' } as const;

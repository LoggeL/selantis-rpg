import { RAMPS, mix, ramp as paletteRamp, shift } from './palette';
import { Px, outlineOf } from './px';
import { Rng, bayer, hash2, hashString } from './rng';
import { PRESETS, PORTRAIT_IDS, type Preset } from './characters/specs';

/**
 * 64x64 pixel portraits (busts) built from the same character specs as the sprites.
 * Original designs only (DESIGN.md §2 actor privacy): proportions, faces and hair are our own.
 */

export const PORTRAIT_MOODS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'determined', 'hurt', 'thinking', 'scared'] as const;
export type Mood = typeof PORTRAIT_MOODS[number];

const S = 64;
type Six = number[];

function six(name: string): Six {
  const r = paletteRamp(name);
  if (r.length === 6) return [...r];
  const out: number[] = [];
  for (let i = 0; i < 6; i++) out.push(r[Math.round((i / 5) * (r.length - 1))]);
  return out;
}

interface Face {
  W: number;            // half width at the cheeks
  jaw: 'soft' | 'square' | 'round' | 'gaunt' | 'heavy';
  eyeW: number; eyeH: number;
  brow: 'thin' | 'soft' | 'heavy';
  lips: boolean;
  lashes: boolean;
  nose: 'small' | 'straight' | 'big';
  age: 'young' | 'adult' | 'old';
  top: number; chin: number;
  shoulders: number;    // half width of the shoulders
  neck: number;         // half width of the neck
}

/** Per-character face shapes (original designs). */
const FACES: Record<string, Partial<Face>> = {
  'lia': { W: 12, jaw: 'soft', eyeW: 6, eyeH: 4, brow: 'soft', lips: true, lashes: true, nose: 'small', age: 'young', shoulders: 17, neck: 5 },
  'kyra': { W: 12, jaw: 'soft', eyeW: 6, eyeH: 4, brow: 'soft', lips: true, lashes: true, nose: 'small', age: 'young', shoulders: 17, neck: 5 },
  'mother': { W: 12, jaw: 'soft', eyeW: 6, eyeH: 4, brow: 'thin', lips: true, lashes: true, nose: 'straight', age: 'adult', shoulders: 17, neck: 5 },
  'barmaid': { W: 12, jaw: 'round', eyeW: 6, eyeH: 4, brow: 'thin', lips: true, lashes: true, nose: 'small', age: 'young', shoulders: 17, neck: 5 },
  'flick': { W: 12, jaw: 'soft', eyeW: 6, eyeH: 4, brow: 'thin', lips: false, lashes: true, nose: 'small', age: 'young', shoulders: 17, neck: 5 },
  'valentus': { W: 13, jaw: 'square', eyeW: 5, eyeH: 3, brow: 'heavy', nose: 'straight', age: 'old' },
  'father': { W: 14, jaw: 'square', eyeW: 5, eyeH: 3, brow: 'heavy', nose: 'big', age: 'adult', shoulders: 22, neck: 7 },
  'foltan': { W: 13, jaw: 'square', eyeW: 5, eyeH: 3, brow: 'thin', nose: 'straight', age: 'adult' },
  'azar': { W: 15, jaw: 'round', eyeW: 5, eyeH: 3, brow: 'heavy', nose: 'big', age: 'adult', shoulders: 24, neck: 8 },
  'craupor': { W: 11, jaw: 'gaunt', eyeW: 5, eyeH: 3, brow: 'thin', nose: 'big', age: 'adult', shoulders: 17, neck: 5 },
  'elnon': { W: 12, jaw: 'square', eyeW: 5, eyeH: 3, brow: 'thin', nose: 'straight', age: 'adult', shoulders: 21 },
  'alastir': { W: 12, jaw: 'soft', eyeW: 5, eyeH: 3, brow: 'thin', nose: 'straight', age: 'adult', shoulders: 19 },
  'orwen': { W: 12, jaw: 'gaunt', eyeW: 5, eyeH: 3, brow: 'thin', nose: 'big', age: 'old' },
  'baris': { W: 16, jaw: 'heavy', eyeW: 5, eyeH: 3, brow: 'heavy', nose: 'big', age: 'adult', shoulders: 29, neck: 10 },
  'baris-young': { W: 14, jaw: 'square', eyeW: 5, eyeH: 3, brow: 'heavy', nose: 'big', age: 'young', shoulders: 24, neck: 8 },
  'algard': { W: 13, jaw: 'square', eyeW: 5, eyeH: 3, brow: 'heavy', nose: 'big', age: 'adult' },
  'maedchen': { W: 13, jaw: 'round', eyeW: 5, eyeH: 3, brow: 'thin', nose: 'small', age: 'young' },
  'harro': { W: 13, jaw: 'round', eyeW: 5, eyeH: 3, brow: 'heavy', nose: 'big', age: 'adult' },
  'ignatius': { W: 13, jaw: 'square', eyeW: 5, eyeH: 3, brow: 'heavy', nose: 'big', age: 'old' },
  'merchant': { W: 14, jaw: 'round', eyeW: 5, eyeH: 3, brow: 'thin', nose: 'big', age: 'adult', shoulders: 23 },
  'dwarf': { W: 15, jaw: 'square', eyeW: 5, eyeH: 3, brow: 'heavy', nose: 'big', age: 'adult', shoulders: 24, neck: 8 },
  'bard': { W: 12, jaw: 'soft', eyeW: 5, eyeH: 4, brow: 'thin', nose: 'small', age: 'young' },
  'juggler': { W: 12, jaw: 'soft', eyeW: 6, eyeH: 4, brow: 'soft', nose: 'small', age: 'young' },
  'council-mage': { W: 13, jaw: 'square', eyeW: 5, eyeH: 3, brow: 'heavy', nose: 'straight', age: 'old' },
  'falke-soldier': { W: 13, jaw: 'square', eyeW: 5, eyeH: 3, brow: 'thin', nose: 'straight', age: 'young' },
  'paladin': { W: 13, jaw: 'square', eyeW: 5, eyeH: 3, brow: 'thin', nose: 'straight', age: 'adult' },
};

function faceFor(id: string, spec: Preset): Face {
  const base = id.replace(/-(cloak|bound|scarred|barefoot)$/, '');
  const f = FACES[id] ?? FACES[base] ?? {};
  const broad = spec.body === 'broad' || spec.body === 'huge';
  return {
    W: 13, jaw: 'square', eyeW: 5, eyeH: 3, brow: 'soft', lips: false, lashes: false, nose: 'straight', age: spec.x?.age ?? 'adult',
    top: 10, chin: 46, shoulders: broad ? 24 : 20, neck: broad ? 8 : 6,
    ...f,
  };
}

interface P {
  p: Px;
  id: string;
  spec: Preset;
  face: Face;
  mood: Mood;
  flags: Set<string>;
  skin: Six; hair: Six; brow: Six; eye: Six; top: Six; trim: Six; cloak: Six; head: Six; beard: Six;
  cx: number;
  eyeY: number;
  noseY: number;
  mouthY: number;
}

/** Face half-width at row y. */
function hw(c: P, y: number): number {
  const { top, chin, W, jaw } = c.face;
  const t = (y + 0.5 - top) / (chin - top);
  if (t < 0 || t > 1) return 0;
  if (t < 0.48) {
    const u = (0.48 - t) / 0.48;
    return W * Math.sqrt(Math.max(0, 1 - u * u * 0.96));
  }
  const u = (t - 0.48) / 0.52;
  const [chinW, ex] = jaw === 'soft' ? [0.3, 1.7] : jaw === 'square' ? [0.46, 2.6] : jaw === 'round' ? [0.42, 1.5] : jaw === 'gaunt' ? [0.3, 1.25] : [0.56, 3.2];
  let w = W * (1 - (1 - chinW) * Math.pow(u, ex));
  if (u > 0.93) w -= (u - 0.93) * 30;
  return Math.max(0, w);
}

function inFace(c: P, x: number, y: number): boolean {
  const w = hw(c, y);
  return Math.abs(x + 0.5 - c.cx) <= w;
}

// ------------------------------------------------------------------------------------------
// Background, shoulders, neck
// ------------------------------------------------------------------------------------------

function background(p: Px, accent: number): void {
  const base = 0x161c2a;
  const glow = mix(0x2a3450, accent, 0.18);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x + 0.5 - 30, y + 0.5 - 26) / 44;
    const t = Math.max(0, 1 - d);
    const f = t * 3 + (bayer(x, y) - 0.5) * 0.9;
    const c = f > 2.1 ? glow : f > 1.2 ? mix(base, glow, 0.6) : f > 0.5 ? mix(base, glow, 0.3) : base;
    p.set(x, y, c);
  }
}

function shoulders(c: P): void {
  const { p, face } = c;
  const st = c.spec.top?.style ?? 'shirt';
  const y0 = face.chin + 3;
  const sw = face.shoulders;
  const r = c.top;
  for (let y = y0; y < S; y++) {
    const t = Math.min(1, (y - y0) / 9);
    const half = face.neck + 2 + (sw - face.neck - 2) * Math.sqrt(t);
    for (let x = Math.floor(c.cx - half); x <= Math.ceil(c.cx + half); x++) {
      const nx = (x + 0.5 - c.cx) / half;
      let i = nx < -0.45 ? 4 : nx > 0.5 ? 2 : 3;
      if (y > S - 4) i = Math.max(1, i - 1);
      p.set(x, y, r[i]);
    }
  }
  // garment details
  const cx = c.cx;
  const neckline = (depth: number, color: (x: number, y: number) => number) => {
    for (let y = y0 - 1; y < y0 + depth; y++) {
      const half = c.face.neck - 1 - Math.round((y - y0) * 0.6);
      for (let x = cx - half; x < cx + half; x++) p.set(x, y, color(x, y));
    }
  };
  const skinNeck = (x: number, y: number) => c.skin[x < cx ? 4 : 3 - (y < y0 + 1 ? 1 : 0)];
  switch (st) {
    case 'blouse': {
      neckline(5, skinNeck);
      // ruffled collar
      for (let x = cx - c.face.neck - 2; x <= cx + c.face.neck + 1; x++) { p.set(x, y0, r[5]); if (x % 2) p.set(x, y0 + 1, r[4]); }
      for (let y = y0 + 5; y < S; y += 3) { p.set(cx - 1, y, r[2]); }
      // puffed sleeves hint
      for (let y = y0 + 6; y < S; y++) { p.set(cx - c.face.shoulders + 2, y, r[2]); p.set(cx + c.face.shoulders - 3, y, r[1]); }
      break;
    }
    case 'dress': {
      neckline(4, skinNeck);
      for (let x = cx - c.face.neck - 1; x <= cx + c.face.neck; x++) p.set(x, y0 + 3, c.trim[x < cx ? 4 : 3]);
      break;
    }
    case 'robe': {
      // V-neck with trim, inner tunic
      for (let y = y0 - 1; y < S; y++) {
        const half = Math.max(0, 5 - Math.round((y - y0) * 0.5));
        for (let x = cx - half; x < cx + half; x++) p.set(x, y, y < y0 + 3 ? skinNeck(x, y) : c.top[1]);
        p.set(cx - half - 1, y, c.trim[4]); p.set(cx - half - 2, y, c.trim[3]);
        p.set(cx + half, y, c.trim[3]); p.set(cx + half + 1, y, c.trim[2]);
      }
      if (c.flags.has('sash-blue') || c.flags.has('sash-gold')) {
        const sr = c.flags.has('sash-blue') ? six('blue') : six('gold');
        for (let k = 0; k < 14; k++) for (let t = 0; t < 3; t++) p.set(cx - 18 + k + t, y0 + 4 + k, sr[t === 0 ? 4 : 3]);
      }
      break;
    }
    case 'tabard': {
      // mail at the neck, tabard field below
      for (let y = y0 - 1; y < y0 + 4; y++) for (let x = cx - c.face.neck - 2; x <= cx + c.face.neck + 1; x++) p.set(x, y, (x + y) % 2 ? RAMPS.steel[3] : RAMPS.steel[4]);
      const black = c.spec.top?.color === 'black';
      for (let y = y0 + 4; y < S; y++) for (let x = cx - 11; x <= cx + 10; x++) {
        let cc = black ? (x < cx ? RAMPS.white[3] : RAMPS.black[2]) : c.top[x < cx - 4 ? 4 : 3];
        if (!black && (x === cx - 1 || x === cx)) cc = c.trim[x === cx - 1 ? 4 : 3];
        p.set(x, y, cc);
      }
      // mail shoulders
      for (let y = y0 + 4; y < S; y++) for (const x0 of [cx - c.face.shoulders, cx + 11]) for (let x = x0; x < x0 + c.face.shoulders - 11; x++) if (p.alpha(x, y)) p.set(x, y, (x + y) % 2 ? RAMPS.steel[2] : RAMPS.steel[3]);
      break;
    }
    case 'plate': {
      for (let y = y0; y < S; y++) for (let x = cx - c.face.shoulders; x <= cx + c.face.shoulders; x++) {
        if (!p.alpha(x, y)) continue;
        const nx = (x + 0.5 - cx) / c.face.shoulders;
        let i = nx < -0.5 ? 4 : nx > 0.45 ? 1 : 2;
        if ((y - y0) % 5 === 4) i = 0;
        if (Math.abs(nx) < 0.06) i = 4;
        p.set(x, y, r[Math.max(0, i)]);
      }
      // gorget + pauldron rims
      for (let x = cx - c.face.neck - 2; x <= cx + c.face.neck + 1; x++) { p.set(x, y0, r[4]); p.set(x, y0 + 1, r[2]); }
      for (let x = cx - c.face.shoulders; x < cx - c.face.shoulders + 9; x++) p.set(x, y0 + 7 + Math.round((x - cx + c.face.shoulders) * 0.15), r[5]);
      for (let x = cx + c.face.shoulders - 9; x <= cx + c.face.shoulders; x++) p.set(x, y0 + 7 + Math.round((cx + c.face.shoulders - x) * 0.15), r[3]);
      if (c.spec.top?.trim === 'gold') for (let y = y0 + 2; y < S; y++) p.set(cx - 1, y, RAMPS.gold[3]);
      break;
    }
    case 'coat': {
      neckline(3, skinNeck);
      // high collar & lapels, shirt inside
      for (let y = y0; y < S; y++) { const half = 3 + Math.round((y - y0) * 0.35); for (let x = cx - half; x < cx + half; x++) p.set(x, y, RAMPS.cream[y < y0 + 2 ? 4 : 3]); }
      for (let y = y0 - 3; y < y0 + 5; y++) { p.set(cx - c.face.neck - 2, y, r[4]); p.set(cx - c.face.neck - 1, y, r[3]); p.set(cx + c.face.neck, y, r[2]); p.set(cx + c.face.neck + 1, y, r[1]); }
      if (c.flags.has('brooch')) { p.set(cx - 9, y0 + 6, RAMPS.gold[4]); p.set(cx - 8, y0 + 6, RAMPS.gold[3]); p.set(cx - 9, y0 + 7, RAMPS.gold[2]); p.set(cx - 8, y0 + 7, RAMPS.gold[3]); p.set(cx - 9, y0 + 5, RAMPS.gold[5]); }
      if (c.spec.top?.trim === 'gold') for (let y = y0 + 2; y < S; y++) { p.set(cx - 4 - Math.round((y - y0) * 0.35), y, RAMPS.gold[3]); }
      break;
    }
    case 'vest': {
      neckline(3, skinNeck);
      const shirt = c.trim;
      for (let y = y0; y < S; y++) { const half = 3 + Math.round((y - y0) * 0.3); for (let x = cx - half; x < cx + half; x++) p.set(x, y, shirt[y < y0 + 1 ? 5 : 4]); }
      for (let y = y0 + 1; y < y0 + 3; y++) { p.set(cx - 4, y, shirt[5]); p.set(cx + 3, y, shirt[3]); }
      break;
    }
    case 'tunic': case 'shirt': case 'leather': case 'motley': case 'mail': default: {
      neckline(3, skinNeck);
      if (st === 'tunic' && c.spec.top?.trim) for (let x = cx - c.face.neck - 1; x <= cx + c.face.neck; x++) { p.set(x, y0 + 2, c.trim[x < cx ? 4 : 3]); }
      if (st === 'mail') for (let y = y0 + 2; y < S; y++) for (let x = cx - c.face.shoulders; x <= cx + c.face.shoulders; x++) if (p.alpha(x, y)) p.set(x, y, (x + y) % 2 ? RAMPS.steel[2] : RAMPS.steel[3]);
      if (st === 'motley') for (let y = y0 + 2; y < S; y++) for (let x = cx - c.face.shoulders; x <= cx + c.face.shoulders; x++) if (p.alpha(x, y) && ((Math.floor((x - cx) / 5) + Math.floor(y / 5)) % 2)) p.set(x, y, c.trim[3]);
      if (st === 'leather') for (let y = y0 + 3; y < S; y += 3) for (let x = cx - 8; x < cx + 8; x += 4) p.set(x, y, c.top[1]);
      break;
    }
  }
  // cloaks over the shoulders
  const ck = c.spec.cloak?.style;
  if (ck) {
    const cr = c.cloak;
    for (let y = y0 + 1; y < S; y++) {
      const t = Math.min(1, (y - y0) / 9);
      const half = face.neck + 3 + (sw - face.neck - 1) * Math.sqrt(t);
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        const nx = (x + 0.5 - cx) / half;
        if (Math.abs(nx) < 0.55 && y > y0 + 3 && ck !== 'hunter') continue;
        if (ck === 'hunter' && Math.abs(nx) < 0.38 && y > y0 + 2) continue;
        let i = nx < -0.5 ? 4 : nx > 0.4 ? 2 : 3;
        if (ck === 'worn' && hash2(x, y, 3) > 0.9) i = 1;
        p.set(x, y, cr[i]);
      }
    }
    // hood bunched around the neck
    if (ck === 'hooded' || ck === 'worn' || ck === 'hunter') {
      for (let x = cx - face.neck - 5; x <= cx + face.neck + 4; x++) for (let y = y0 - 3; y < y0 + 2; y++) {
        const nx = (x + 0.5 - cx) / (face.neck + 5);
        if (Math.abs(nx) < 0.62 && y > y0 - 2) continue;
        p.set(x, y, cr[nx < 0 ? 4 : 2]);
      }
    }
    if (ck !== 'hunter') { p.set(cx - 7, y0 + 3, RAMPS.gold[4]); p.set(cx - 6, y0 + 3, RAMPS.gold[3]); p.set(cx + 5, y0 + 3, RAMPS.gold[3]); p.set(cx + 6, y0 + 3, RAMPS.gold[2]); }
  }
  if (c.flags.has('apron')) for (let y = y0 + 6; y < S; y++) for (let x = cx - 7; x < cx + 7; x++) p.set(x, y, RAMPS.cream[x < cx - 3 ? 5 : 4]);
  if (c.flags.has('necklace')) {
    for (let k = -5; k <= 5; k++) p.set(cx + k, y0 + 1 + Math.round((k * k) / 12), RAMPS.gold[k < 0 ? 4 : 3]);
    p.set(cx - 1, y0 + 4, RAMPS.cornflower[3]); p.set(cx, y0 + 4, RAMPS.cornflower[2]); p.set(cx - 1, y0 + 3, RAMPS.cornflower[4]);
  }
  if (c.flags.has('quiver')) for (let k = 0; k < 16; k++) { p.set(cx - 16 + k, y0 + 2 + Math.round(k * 0.9), RAMPS.leather[3]); p.set(cx - 15 + k, y0 + 2 + Math.round(k * 0.9), RAMPS.leather[2]); }
  if (c.flags.has('satchel')) for (let k = 0; k < 16; k++) { p.set(cx + 14 - k, y0 + 2 + Math.round(k * 0.9), RAMPS.leather[3]); p.set(cx + 13 - k, y0 + 2 + Math.round(k * 0.9), RAMPS.leather[2]); }
  if (c.flags.has('pauldrons') && st !== 'plate') for (const s of [-1, 1]) for (let x = 0; x < 9; x++) for (let y = 0; y < 4; y++) p.set(cx + s * (face.shoulders - x), y0 + 5 + y, c.top[s < 0 ? 4 : 2]);
  // neck
  for (let y = face.chin - 4; y < y0 + 1; y++) for (let x = cx - face.neck; x < cx + face.neck; x++) {
    if (p.alpha(x, y) && y >= y0 - 1) continue;
    const shadeTop = y < face.chin + 2;
    p.set(x, y, shadeTop ? c.skin[2] : c.skin[x < cx - 2 ? 4 : x > cx + 2 ? 2 : 3]);
  }
}

// ------------------------------------------------------------------------------------------
// Hair
// ------------------------------------------------------------------------------------------

interface HairShape {
  vol: number;        // extra width beyond the face
  crown: number;      // rows above the face top
  sideEnd: number;    // y where the side hair ends (relative to chin, negative = above)
  backEnd: number;    // y where the back hair ends (relative to chin)
  bangs: 'parted' | 'fringe' | 'side' | 'curly' | 'messy' | 'back' | 'none';
  curly?: boolean;
  stringy?: boolean;
  tie?: 'updo' | 'ponytail' | 'braid' | 'bun' | 'ribbon' | 'braids';
}

const HAIR: Record<string, HairShape | null> = {
  'bald': null,
  'buzz': { vol: 0, crown: 1, sideEnd: -26, backEnd: -20, bangs: 'none' },
  'short': { vol: 2, crown: 3, sideEnd: -18, backEnd: -10, bangs: 'side' },
  'short-messy': { vol: 3, crown: 4, sideEnd: -16, backEnd: -8, bangs: 'messy' },
  'shoulder': { vol: 3, crown: 3, sideEnd: 8, backEnd: 10, bangs: 'parted' },
  'long': { vol: 3, crown: 3, sideEnd: 16, backEnd: 18, bangs: 'parted' },
  'long-tied': { vol: 2, crown: 3, sideEnd: -8, backEnd: 4, bangs: 'parted', tie: 'ponytail' },
  'long-curly': { vol: 6, crown: 5, sideEnd: 18, backEnd: 18, bangs: 'curly', curly: true },
  'curly-up': { vol: 5, crown: 6, sideEnd: -2, backEnd: 0, bangs: 'curly', curly: true, tie: 'updo' },
  'curly-ribbon': { vol: 5, crown: 5, sideEnd: 6, backEnd: 10, bangs: 'curly', curly: true, tie: 'ribbon' },
  'stringy': { vol: 2, crown: 2, sideEnd: 10, backEnd: 12, bangs: 'parted', stringy: true },
  'braid-long': { vol: 1, crown: 3, sideEnd: -12, backEnd: -6, bangs: 'back', tie: 'braid' },
  'bun': { vol: 2, crown: 3, sideEnd: -10, backEnd: -6, bangs: 'parted', tie: 'bun' },
  'braids': { vol: 2, crown: 3, sideEnd: -8, backEnd: -4, bangs: 'parted', tie: 'braids' },
};

function hairShape(c: P): HairShape | null {
  const s = c.spec.hair?.style ?? 'short';
  return s in HAIR ? HAIR[s] : HAIR.short;
}

/** Shaded mass of curls: circles shaded like foliage clumps. */
function curlMass(p: Px, circles: { x: number; y: number; r: number }[], r: Six, clip?: (x: number, y: number) => boolean): void {
  if (!circles.length) return;
  let x0 = 99, x1 = -99, y0 = 99, y1 = -99;
  for (const c of circles) { x0 = Math.min(x0, c.x - c.r); x1 = Math.max(x1, c.x + c.r); y0 = Math.min(y0, c.y - c.r); y1 = Math.max(y1, c.y + c.r); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
  const ids = new Map<number, number>();
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (clip && !clip(x, y)) continue;
    let best = -1e9, bi = -1, lnx = 0, lny = 0, lnz = 0;
    circles.forEach((cc, k) => {
      const dx = (x + 0.5 - cc.x) / cc.r, dy = (y + 0.5 - cc.y) / cc.r;
      const d = dx * dx + dy * dy;
      if (d > 1) return;
      const h = Math.sqrt(1 - d) * cc.r + (cc.y - cy) * 0.15;
      if (h > best) { best = h; bi = k; lnx = dx; lny = dy; lnz = Math.sqrt(1 - d); }
    });
    if (bi < 0) continue;
    ids.set(y * 1000 + x, bi);
    const gx = (x + 0.5 - cx) / rx, gy = (y + 0.5 - cy) / ry;
    const light = (-0.55 * gx - 0.6 * gy) * 0.45 + (-0.55 * lnx - 0.65 * lny + 0.5 * lnz) * 0.75;
    const up = ids.get((y - 1) * 1000 + x);
    let l = light;
    if (up !== undefined && up !== bi) l -= 0.5;
    const f = 1.4 + l * 2.6 + (bayer(x, y) - 0.5) * 0.4;
    p.set(x, y, r[Math.max(1, Math.min(5, Math.round(f)))]);
  }
}

/** Hair behind the head (back layer). */
function hairBack(c: P): void {
  const h = hairShape(c);
  if (!h) return;
  const { p, face } = c;
  const cx = c.cx;
  const end = face.chin + h.backEnd;
  if (end <= face.top + 12 && !h.curly) return;
  const rng = new Rng(hashString(c.id + 'hb'));
  if (h.curly) {
    const circles: { x: number; y: number; r: number }[] = [];
    const n = 26;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const side = i % 2 ? 1 : -1;
      const y = face.top + 6 + t * (Math.max(end, face.top + 22) - face.top - 6);
      const spread = face.W + h.vol - 1 + Math.sin(t * 3) * 1.5;
      circles.push({ x: cx + side * (spread - rng.range(0, 3)), y, r: rng.range(3.5, 5.5) });
    }
    curlMass(p, circles, c.hair);
    return;
  }
  for (let y = face.top + 4; y <= end; y++) {
    const t = (y - face.top) / Math.max(1, end - face.top);
    // hugs the head, widens a little at the shoulders, wavy ends
    const half = face.W + h.vol - 1 + Math.round(Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.5) * 2);
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const tip = end - Math.round(Math.abs(Math.sin(x * 0.7)) * 3);
      if (y > tip) continue;
      const nx = (x + 0.5 - cx) / half;
      let i = nx < -0.6 ? 2 : nx > 0.4 ? 1 : 2;
      if (h.stringy && x % 2 === 0) i = Math.max(0, i - 1);
      else if (x % 3 === 0) i = Math.max(0, i - 1);
      p.set(x, y, c.hair[i]);
    }
  }
}

/** Long side locks framing the face and falling over the shoulders (drawn after the shoulders). */
function hairLocks(c: P): void {
  const h = hairShape(c);
  if (!h || h.curly || h.sideEnd < -4) return;
  if (c.spec.head?.style === 'hood-deep' || c.spec.head?.style === 'hood-mask' || c.spec.head?.style === 'hood') return;
  const { p, face } = c;
  const cx = c.cx;
  const end = face.chin + h.sideEnd;
  const thick = h.stringy ? 4 : 5;
  for (const s of [-1, 1]) {
    for (let y = face.top + 6; y <= end; y++) {
      const t = (y - face.top - 6) / Math.max(1, end - face.top - 6);
      // inner edge follows the cheek, then the neck; outer edge flares over the shoulder
      const inner = y < face.chin - 2 ? hw(c, y) - (y < c.eyeY ? 2 : 1) : face.neck + 1 + Math.round((y - face.chin) * 0.25);
      const outer = Math.max(inner + 2, inner + thick + Math.round(t * 2) - (y > end - 3 ? end - y === 0 ? 3 : 1 : 0));
      for (let k = Math.floor(inner); k <= outer; k++) {
        const x = s < 0 ? Math.round(cx - k - 1) : Math.round(cx + k);
        const tip = end - Math.round(Math.abs(Math.sin(k * 1.3 + s)) * 2);
        if (y > tip) continue;
        const u = (k - inner) / Math.max(1, outer - inner); // 0 at the face → 1 outside
        let i = s < 0 ? (u > 0.6 ? 4 : 3) : (u > 0.6 ? 2 : 3);
        if (u < 0.2) i -= 1;                 // shadow next to the cheek
        if ((k + (y >> 2)) % 3 === 0) i -= 1; // strands
        if (h.stringy && k % 2 === 0) i -= 1;
        p.set(x, y, c.hair[Math.max(1, Math.min(5, i))]);
      }
    }
  }
}

/** Hair over the head (crown, bangs, side locks). */
function hairFront(c: P): void {
  const h = hairShape(c);
  const { p, face } = c;
  const cx = c.cx;
  const hr = c.hair;
  if (!h) {
    // bald: shiny scalp
    for (let y = face.top; y < face.top + 8; y++) for (let x = cx - 8; x < cx; x++) {
      if (!inFace(c, x, y)) continue;
      if ((x - (cx - 5)) ** 2 + (y - (face.top + 3)) ** 2 < 6) p.set(x, y, c.skin[5]);
    }
    return;
  }
  if (c.spec.head?.style === 'hood-deep' || c.spec.head?.style === 'hood-mask') return;
  const top = face.top - h.crown;
  const hairline = (x: number): number => {
    const dx = x + 0.5 - cx;
    const ax = Math.abs(dx);
    const brow = c.eyeY - 6;
    switch (h.bangs) {
      case 'none': return face.top + 3;
      case 'back': return face.top + 3 + Math.round((ax / face.W) * 2);
      case 'side': return Math.round(face.top + 5 + (dx < 0 ? 2 : -1) + (ax > face.W - 3 ? 6 : 0));
      case 'parted': {
        // centre parting, hair sweeping down to the temples
        const part = dx > -1.5 && dx < 0.5;
        return Math.round(part ? face.top + 3 : face.top + 4 + (ax / face.W) * 6 + (ax > face.W - 4 ? 8 : 0));
      }
      case 'fringe': return brow + (Math.floor(x / 2) % 2);
      case 'messy': return Math.round(brow - 3 + [0, 3, 1, 4, 0, 2, 4, 1][((x % 8) + 8) % 8] - (ax > face.W - 3 ? -6 : 0));
      case 'curly': return Math.round(face.top + 6 + Math.sin(x * 0.9) * 2 + (ax > face.W - 4 ? 10 : 0));
    }
  };
  if (h.curly) {
    const rng = new Rng(hashString(c.id + 'hf'));
    const circles: { x: number; y: number; r: number }[] = [];
    // crown arc
    for (let i = 0; i < 11; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      circles.push({ x: cx + Math.cos(a) * (face.W + h.vol - 4), y: face.top + 7 + Math.sin(a) * (h.crown + 7), r: rng.range(4, 6) });
    }
    // fringe curls
    for (let i = 0; i < 6; i++) circles.push({ x: cx - face.W + 3 + i * ((face.W * 2 - 6) / 5), y: face.top + 4 + (i % 2) * 2, r: rng.range(3, 4.2) });
    // locks framing the face down to the side end
    const sideEnd = face.chin + h.sideEnd;
    for (const s of [-1, 1]) for (let y = face.top + 8; y <= sideEnd; y += 4) circles.push({ x: cx + s * (face.W + rng.range(-1, 1.5)), y, r: rng.range(3, 4) });
    curlMass(p, circles, hr, (x, y) => !(inFace(c, x, y) && y > hairline(x) && y > face.top + 4));
  } else {
    for (let y = top; y <= Math.max(face.chin + h.sideEnd, face.top + 6); y++) {
      for (let x = cx - face.W - h.vol; x <= cx + face.W + h.vol; x++) {
        const dx = x + 0.5 - cx;
        // skull silhouette
        const rx = face.W + h.vol, ry = (face.chin - face.top) * 0.55 + h.crown;
        const sy = (y + 0.5 - (face.top + ry - h.crown)) / ry;
        const inSkull = (dx / rx) ** 2 + Math.min(0, sy) ** 2 * (sy < 0 ? 1 : 0) <= 1 && (sy < 0 ? (dx / rx) ** 2 + sy * sy <= 1 : true);
        if (!inSkull) continue;
        const face_ = inFace(c, x, y);
        const sideEnd = face.chin + h.sideEnd;
        if (face_ && y >= hairline(x)) continue;          // forehead / face
        if (!face_ && y > sideEnd) continue;               // below side locks
        if (!face_ && y > face.top + 8 && h.sideEnd > -4) continue; // long hair continues as separate locks
        if (!face_ && y > face.top + 6 && Math.abs(dx) < hw(c, y) + 1 && y > sideEnd - 2) continue;
        // shading: glossy arc on the crown, shadow to the right and under the bangs
        const nx = dx / rx;
        let i = nx < -0.35 ? 4 : nx > 0.45 ? 2 : 3;
        const arc = y - (top + 3 + Math.round((dx / rx) ** 2 * 3));
        if (arc >= 0 && arc <= 1 && nx > -0.75 && nx < 0.25 && !(x % 3 === 0 && arc === 1)) i = 5;
        if (face_ && y >= hairline(x) - 1) i = Math.max(1, i - 1);
        if (h.stringy && x % 2 === 0 && y > face.top + 2) i = Math.max(1, i - 1);
        else if (y > top + 5 && x % 4 === 1) i = Math.max(1, i - 1);
        if (h.bangs === 'messy' && y < top + 2 && (x % 3 === 0)) continue;
        p.set(x, y, hr[i]);
      }
    }
    if (h.bangs === 'messy') {
      // tufts sticking up
      for (const [tx, ty] of [[-6, -1], [-1, -2], [4, -1], [8, 0]] as const) { p.set(cx + tx, top + ty, hr[3]); p.set(cx + tx + 1, top + ty + 1, hr[4]); }
    }
  }
  // Flick's light streak
  if (c.flags.has('streak')) for (let y = top + 1; y < face.top + 9; y++) { const x = cx - 6 + Math.round((y - top) * 0.45); p.set(x, y, RAMPS.silver[3]); p.set(x + 1, y, RAMPS.silver[y < top + 4 ? 5 : 4]); p.set(x + 2, y, RAMPS.silver[2]); }
  // ties
  if (h.tie === 'updo') {
    curlMass(p, [{ x: cx + 4, y: top - 1, r: 5 }, { x: cx - 3, y: top, r: 4.5 }, { x: cx + 9, y: top + 3, r: 3.5 }], hr);
  }
  if (h.tie === 'bun') { curlMass(p, [{ x: cx, y: top - 3, r: 5 }], hr); }
  if (h.tie === 'ribbon') {
    for (let x = cx + face.W - 2; x < cx + face.W + 5; x++) for (let y = face.top + 2; y < face.top + 5; y++) p.set(x, y, RAMPS.olive[y === face.top + 2 ? 4 : 3]);
    p.set(cx + face.W + 5, face.top + 6, RAMPS.olive[2]); p.set(cx + face.W + 4, face.top + 7, RAMPS.olive[3]);
  }
  if (h.tie === 'braid' || h.tie === 'ponytail') {
    // braid / tail falling over the right shoulder
    for (let y = face.top + 14; y < S; y++) {
      const x = cx + face.W - 1 + Math.round(Math.sin(y * 0.15) * 1.5);
      for (let k = 0; k < 4; k++) {
        let cc = hr[k === 0 ? 4 : k === 3 ? 1 : 3];
        if (h.tie === 'braid' && ((y + k) % 3 === 0)) cc = hr[1];
        p.set(x + k, y, cc);
      }
    }
    if (h.tie === 'ponytail') for (let k = 0; k < 4; k++) p.set(cx + face.W - 1 + k, face.top + 14, RAMPS.straw[2]);
  }
  if (h.tie === 'braids') for (const s of [-1, 1]) for (let y = face.top + 12; y < S - 2; y++) for (let k = 0; k < 3; k++) p.set(cx + s * (face.W + 1) + k - 1, y, (y + k) % 3 === 0 ? hr[1] : hr[3]);
}

// ------------------------------------------------------------------------------------------
// Head, face features
// ------------------------------------------------------------------------------------------

function head(c: P): void {
  const { p, face } = c;
  const cx = c.cx;
  const gaunt = face.jaw === 'gaunt' || c.flags.has('gaunt');
  for (let y = face.top; y <= face.chin; y++) {
    const w = hw(c, y);
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
      if (!inFace(c, x, y)) continue;
      const nx = (x + 0.5 - cx) / Math.max(1, w);
      const t = (y - face.top) / (face.chin - face.top);
      let i = 4;
      if (nx > 0.42) i = 3;
      if (nx > 0.78) i = 2;
      if (nx < -0.88 && t > 0.3) i = 3;
      if (t > 0.88) i = Math.min(i, 3);
      if (gaunt && t > 0.55 && t < 0.8 && Math.abs(nx) > 0.5) i = Math.min(i, nx > 0 ? 2 : 3);
      p.set(x, y, c.skin[i]);
    }
  }
  // soft dither between light and mid tones on the cheek
  for (let y = face.top + 8; y < face.chin - 4; y++) {
    const w = hw(c, y);
    const xb = Math.round(cx + w * 0.42);
    if ((xb + y) % 2 === 0) p.set(xb, y, c.skin[3]);
  }
  // ears
  const elf = c.spec.ears === 'elf';
  for (const s of [-1, 1]) {
    const ex = Math.round(cx + s * (hw(c, c.eyeY + 2) + 0.5));
    const ey = c.eyeY;
    if (elf) {
      continue;
    } else {
      for (let y = ey - 1; y < ey + 6; y++) for (let k = 0; k < 3; k++) {
        if ((y === ey - 1 || y === ey + 5) && k === 2) continue;
        p.set(ex + s * k, y, c.skin[k === 1 ? 2 : s < 0 ? 4 : 3]);
      }
    }
  }
}

interface EyeMood { open: number; dx: number; dy: number; happy?: boolean; wince?: boolean; small?: boolean }

const EYE: Record<Mood, EyeMood> = {
  neutral: { open: 1, dx: 0, dy: 0 },
  happy: { open: 0.5, dx: 0, dy: 0, happy: true },
  sad: { open: 0.65, dx: 0, dy: 1 },
  angry: { open: 0.6, dx: 0, dy: 0 },
  surprised: { open: 1.3, dx: 0, dy: 0, small: true },
  determined: { open: 0.75, dx: 0, dy: 0 },
  hurt: { open: 0.7, dx: 0, dy: 0, wince: true },
  thinking: { open: 0.85, dx: 1, dy: -1 },
  scared: { open: 1.25, dx: 0, dy: 0, small: true },
};

function eyes(c: P): void {
  const { p, face, mood } = c;
  if (c.flags.has('faceless')) return;
  const em = EYE[mood];
  const lash = c.brow[0];
  const ew = face.eyeW, eh = face.eyeH;
  for (const s of [-1, 1]) {
    const exc = c.cx + s * (ew + (face.W > 13 ? 2 : 1)) - (s > 0 ? 1 : 0);
    const x0 = Math.round(exc - ew / 2), x1 = x0 + ew - 1;
    const y0 = c.eyeY - 1;
    const blind = c.flags.has('blind-eye') && s < 0; // character's right eye = screen left
    const wince = em.wince && s > 0;
    if (em.happy || wince) {
      // closed, curved lids  ^ ^  (happy) or squeezed (wince)
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / (ew - 1);
        const yy = em.happy ? y0 + 1 - Math.round(Math.sin(t * Math.PI) * 1.5) : y0 + 1 + Math.round(Math.abs(t - 0.5) * 2) * (s);
        p.set(x, yy, lash);
        if (face.lashes && x === (s < 0 ? x0 : x1)) p.set(x + s, yy - 1, lash);
      }
      continue;
    }
    const rows = Math.max(1, Math.round(eh * em.open));
    const top = y0 + (eh - rows);
    // sclera
    for (let y = top; y < y0 + eh; y++) for (let x = x0; x <= x1; x++) {
      const corner = (x === x0 || x === x1) && (y === top || y === y0 + eh - 1) && rows > 2;
      if (corner) continue;
      p.set(x, y, blind ? 0xcfcac4 : y === top ? 0xd8d4d0 : 0xf6f2ec);
    }
    if (!blind) {
      // iris + pupil + highlight
      const iw = em.small ? 2 : ew >= 6 ? 3 : 2;
      const ix = Math.round(exc - iw / 2 + em.dx + (s < 0 ? 0 : 0));
      for (let y = top; y < y0 + eh; y++) for (let x = ix; x < ix + iw; x++) {
        const yy = y + Math.max(0, em.dy);
        if (yy >= y0 + eh) continue;
        let col = c.eye[y === top ? 1 : 3];
        if (em.small) col = c.eye[2];
        p.set(x, yy, col);
      }
      const py = Math.min(y0 + eh - 1, top + Math.max(0, em.dy) + (rows > 2 ? 1 : 0));
      p.set(ix + (iw > 2 ? 1 : 0), py, 0x120c12);
      if (!em.small && iw > 2) p.set(ix + 1, py + 1 < y0 + eh ? py + 1 : py, c.eye[1]);
      p.set(ix, top + Math.max(0, em.dy) - (rows > 2 ? 0 : 0), 0xffffff);
    }
    // upper lid / lashes
    for (let x = x0 - (s < 0 ? 1 : 0); x <= x1 + (s > 0 ? 1 : 0); x++) p.set(x, top - 1, lash);
    if (face.lashes) { p.set(s < 0 ? x0 - 2 : x1 + 2, top - 2, lash); p.set(s < 0 ? x0 - 1 : x1 + 1, top - 2, lash); }
    // lower lid hint
    for (let x = x0 + 1; x < x1; x++) p.set(x, y0 + eh, c.skin[3]);
    if (face.age === 'old') { p.set(s < 0 ? x0 - 1 : x1 + 1, y0 + eh, c.skin[2]); p.set(x0 + 1, y0 + eh + 1, c.skin[3]); p.set(x1 - 1, y0 + eh + 1, c.skin[3]); }
    if (blind) { for (let k = -2; k < eh + 3; k++) p.set(exc + Math.round(k * 0.3), y0 + k, mix(RAMPS.red[3], c.skin[2], 0.3)); }
  }
}

const BROW: Record<Mood, [number, number, number]> = {
  // inner offset, outer offset, arch
  neutral: [0, 0, 1], happy: [-1, -1, 1], sad: [-2, 1, 0], angry: [2, -1, 0], surprised: [-3, -2, 1],
  determined: [1, -1, 0], hurt: [1, 1, 0], thinking: [0, 0, 1], scared: [-3, 0, 0],
};

function brows(c: P): void {
  const { p, face, mood } = c;
  if (c.flags.has('faceless')) return;
  const [inner, outer, arch] = BROW[mood];
  const len = face.eyeW + 2;
  const th = face.brow === 'heavy' ? 2 : face.brow === 'soft' ? 2 : 1;
  for (const s of [-1, 1]) {
    const exc = c.cx + s * (face.eyeW + (face.W > 13 ? 2 : 1)) - (s > 0 ? 1 : 0);
    let inn = inner, out = outer;
    if (mood === 'thinking') { inn = s < 0 ? -2 : 1; out = s < 0 ? -2 : 0; }
    if (mood === 'hurt' && s > 0) { inn = 2; out = 0; }
    const y = c.eyeY - 5 - (face.eyeH > 3 ? 0 : 0);
    for (let k = 0; k < len; k++) {
      const t = k / (len - 1); // 0 inner → 1 outer
      const x = s < 0 ? Math.round(exc + len / 2 - 1 - k) : Math.round(exc - len / 2 + 1 + k);
      const yy = Math.round(y + inn * (1 - t) + out * t - Math.sin(t * Math.PI) * arch * 0.9);
      const thick = face.brow === 'soft' ? (t < 0.75 ? 2 : 1) : th;
      for (let q = 0; q < thick; q++) p.set(x, yy + q, q === 0 ? c.brow[1] : c.brow[2]);
    }
  }
}

function nose(c: P): void {
  const { p, face } = c;
  if (c.flags.has('faceless')) return;
  const cx = c.cx, ny = c.noseY;
  const big = face.nose === 'big', small = face.nose === 'small';
  // bridge highlight & side shadow
  for (let y = c.eyeY + 1; y < ny - 1; y++) { p.set(cx - 1, y, c.skin[5]); if (!small) p.set(cx + 1, y, c.skin[3]); }
  // tip
  p.set(cx - 1, ny - 1, c.skin[5]);
  p.set(cx, ny - 1, c.skin[4]);
  if (big) { p.set(cx - 2, ny - 1, c.skin[4]); p.set(cx + 1, ny - 1, c.skin[3]); }
  // nostrils & shadow under the nose
  p.set(cx - 2 - (big ? 1 : 0), ny, c.skin[2]);
  p.set(cx + 1 + (big ? 1 : 0), ny, c.skin[1]);
  p.set(cx, ny, c.skin[2]);
  p.set(cx + 1, ny + 1, c.skin[3]);
  if (face.age === 'old') { p.set(cx - 5, ny + 1, c.skin[3]); p.set(cx - 5, ny + 2, c.skin[3]); p.set(cx + 4, ny + 1, c.skin[2]); p.set(cx + 4, ny + 2, c.skin[2]); }
}

function mouth(c: P): void {
  const { p, face, mood } = c;
  if (c.flags.has('faceless')) return;
  const cx = c.cx, my = c.mouthY;
  const lipDark = mix(c.skin[1], RAMPS.red[2], 0.45);
  const lip = face.lips ? mix(c.skin[3], RAMPS.red[4], 0.45) : c.skin[3];
  const teeth = c.flags.has('gaunt') ? 0xd8c890 : 0xf4f0e6;
  const set = (x: number, y: number, col: number) => p.set(cx + x, my + y, col);
  switch (mood) {
    case 'neutral': for (let x = -2; x <= 2; x++) set(x, 0, lipDark); set(-1, 1, lip); set(0, 1, lip); break;
    case 'happy':
      set(-3, -1, lipDark); set(3, -1, lipDark);
      for (let x = -2; x <= 2; x++) set(x, 0, 0x4a1820);
      for (let x = -2; x <= 2; x++) set(x, 0, x === -2 || x === 2 ? lipDark : 0x4a1820);
      for (let x = -1; x <= 1; x++) set(x, 1, 0x7a2a30);
      for (let x = -1; x <= 1; x++) set(x, 0, teeth);
      set(0, 2, lip);
      break;
    case 'sad': set(-3, 1, lipDark); for (let x = -2; x <= 2; x++) set(x, 0, lipDark); set(3, 1, lipDark); set(0, 1, lip); break;
    case 'angry':
      for (let x = -3; x <= 3; x++) { set(x, -1, lipDark); set(x, 1, lipDark); }
      for (let x = -2; x <= 2; x++) set(x, 0, teeth);
      set(-3, 0, lipDark); set(3, 0, lipDark); set(0, 0, mix(teeth, 0x000000, 0.2));
      break;
    case 'surprised': for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) set(x, y, (Math.abs(x) + Math.abs(y) === 2) ? lipDark : 0x3a1218); set(0, 1, 0x8a3a40); break;
    case 'determined': for (let x = -2; x <= 2; x++) set(x, 0, lipDark); set(-3, 1, lipDark); set(3, 1, lipDark); break;
    case 'hurt':
      for (let x = -3; x <= 2; x++) set(x, x < 0 ? 0 : -1, lipDark);
      for (let x = -2; x <= 1; x++) set(x, x < 0 ? 1 : 0, teeth);
      set(2, 0, lipDark);
      break;
    case 'thinking': for (let x = -1; x <= 2; x++) set(x, 0, lipDark); set(3, -1, lipDark); break;
    case 'scared':
      for (let x = -2; x <= 2; x++) set(x, x % 2 ? -1 : 0, lipDark);
      for (let x = -1; x <= 1; x++) set(x, 1, 0x3a1218);
      break;
  }
}

function beard(c: P): void {
  const st = c.spec.beard?.style ?? (c.flags.has('stubble') ? 'stubble' : '');
  if (!st) return;
  const { p, face } = c;
  const cx = c.cx;
  const br = c.beard;
  if (st === 'stubble') {
    for (let y = c.noseY + 1; y <= face.chin; y++) for (let x = cx - 14; x <= cx + 14; x++) {
      if (!inFace(c, x, y) || (x + y) % 2) continue;
      if (Math.abs(x - cx) < 3 && y < c.mouthY + 2 && y > c.noseY + 1) continue;
      const col = p.get(x, y);
      if (col >= 0 && y > c.eyeY + 6) p.set(x, y, mix(col, br[1], 0.45));
    }
    return;
  }
  const below = st === 'bushy' ? 9 : st === 'long' ? 16 : st === 'braided' ? 14 : st === 'full' ? 4 : st === 'goatee' ? 4 : 1;
  const startY = st === 'bushy' ? c.noseY - 2 : c.noseY + 1;
  const rng = new Rng(hashString(c.id + 'beard'));
  for (let y = startY; y <= face.chin + below; y++) {
    for (let x = cx - face.W - 2; x <= cx + face.W + 2; x++) {
      const inF = inFace(c, x, y);
      const dx = x + 0.5 - cx;
      let ok = false;
      if (st === 'goatee') ok = (Math.abs(dx) < 4 && y > c.mouthY) || (y >= c.mouthY - 2 && y <= c.mouthY - 1 && Math.abs(dx) < 5);
      else if (st === 'short') ok = inF && (y > c.mouthY - 2 || Math.abs(dx) > hw(c, y) - 3) && y > c.noseY + 2;
      else if (st === 'full') ok = (inF && (y >= c.mouthY - 2 || Math.abs(dx) > hw(c, y) - 4)) || (y > face.chin && Math.abs(dx) < face.W * 0.7 - (y - face.chin) * 1.5);
      else if (st === 'bushy') ok = (inF && (y >= c.mouthY - 3 || Math.abs(dx) > hw(c, y) - 5)) || (y > face.chin && Math.abs(dx) < face.W + 1 - (y - face.chin) * 1.2) || (!inF && y < face.chin && Math.abs(dx) < face.W + 2 && y > c.eyeY + 3);
      else if (st === 'long' || st === 'braided') ok = (inF && (y >= c.mouthY - 2 || Math.abs(dx) > hw(c, y) - 4)) || (y > face.chin && Math.abs(dx) < Math.max(2, face.W * 0.65 - (y - face.chin) * 0.45));
      if (!ok) continue;
      // keep the mouth visible
      if (Math.abs(dx) < 4 && Math.abs(y - c.mouthY) <= 1 && st !== 'bushy') continue;
      if (st === 'bushy' && Math.abs(dx) < 3 && Math.abs(y - c.mouthY) <= 0) continue;
      const nx = dx / (face.W + 2);
      let i = nx < -0.35 ? 4 : nx > 0.4 ? 2 : 3;
      if ((x * 3 + y * 7) % 5 === 0) i = Math.max(1, i - 1);
      if (y === face.chin + below) i = Math.max(1, i - 1);
      if (st === 'braided' && y > face.chin + 4 && (y % 3 === 0)) i = 1;
      p.set(x, y, br[i]);
    }
  }
  // moustache over the mouth corners
  if (st !== 'stubble') for (let x = -4; x <= 4; x++) p.set(cx + x, c.mouthY - 1 - (Math.abs(x) < 2 ? 0 : 0), br[x < 0 ? 3 : 2]);
  if (st === 'braided') { p.set(cx - 1, face.chin + below - 2, RAMPS.gold[4]); p.set(cx, face.chin + below - 2, RAMPS.gold[3]); }
  void rng;
}

function headgear(c: P): void {
  const st = c.spec.head?.style;
  if (!st) return;
  const { p, face } = c;
  const cx = c.cx;
  const r = c.head;
  const W = face.W;
  const shade = (x: number) => { const nx = (x + 0.5 - cx) / (W + 4); return nx < -0.4 ? 4 : nx > 0.45 ? 2 : 3; };
  switch (st) {
    case 'beret': {
      for (let y = face.top - 6; y <= face.top + 4; y++) for (let x = cx - W - 3; x <= cx + W + 5; x++) {
        const nx = (x + 0.5 - (cx + 2)) / (W + 4), ny = (y + 0.5 - (face.top - 1)) / 5.5;
        if (nx * nx + ny * ny > 1) continue;
        p.set(x, y, r[y > face.top + 2 ? 1 : shade(x)]);
      }
      for (let x = cx - W; x <= cx + W; x++) p.set(x, face.top + 4, r[1]);
      p.set(cx + 2, face.top - 7, r[3]);
      break;
    }
    case 'cap': {
      for (let y = face.top - 6; y <= face.top + 6; y++) for (let x = cx - W - 2; x <= cx + W + 2; x++) {
        const nx = (x + 0.5 - cx) / (W + 2), ny = (y + 0.5 - (face.top + 1)) / 7;
        if (nx * nx + ny * ny > 1 || (y > face.top + 3 && Math.abs(nx) < 0.75)) continue;
        p.set(x, y, r[shade(x)]);
      }
      for (let x = cx - W; x <= cx + W; x++) { p.set(x, face.top + 3, r[5]); p.set(x, face.top + 4, r[2]); }
      break;
    }
    case 'hood': case 'hood-deep': case 'hood-mask': {
      const deep = st !== 'hood';
      for (let y = face.top - 7; y < S; y++) for (let x = cx - W - 7; x <= cx + W + 7; x++) {
        const nx = (x + 0.5 - cx) / (W + 7), ny = (y + 0.5 - (face.top + 12)) / 21;
        const inHood = y < face.top + 12 ? nx * nx + ny * ny <= 1 : Math.abs(nx) <= 1 - (y - face.top - 12) * 0.004;
        if (!inHood) continue;
        const arch = y < face.top + 5 ? Math.round((face.top + 5 - y) * 1.3) : y > face.chin - 4 ? Math.round((y - face.chin + 4) * 1.5) : 0;
        const open = deep ? Math.abs(x + 0.5 - cx) < W - 1 - arch && y > face.top - 2 && y < face.chin + 3 : inFace(c, x, y) && y > face.top + 2;
        if (open) {
          if (deep) p.set(x, y, y < face.top + 8 ? 0x050408 : 0x0c0a10);
          continue;
        }
        if (!deep && y > face.chin + 2 && Math.abs(nx) < 0.5) continue;
        p.set(x, y, r[shade(x) - (y > face.chin ? 1 : 0)]);
      }
      if (deep) {
        // eyes glinting in the shadow (violet for the Master, red for conspirators)
        const eyeC = c.flags.has('red-eyes') ? [0xff4030, 0xff9a80] : [0x9a5ae0, 0xe2c4ff];
        for (const s of [-1, 1]) { p.set(cx + s * 5 - (s > 0 ? 1 : 0), c.eyeY, eyeC[0]); p.set(cx + s * 5 - (s > 0 ? 1 : 0) + s, c.eyeY, eyeC[0]); p.set(cx + s * 5 - (s > 0 ? 1 : 0), c.eyeY - 1, eyeC[1]); }
      }
      break;
    }
    case 'helmet': {
      for (let y = face.top - 6; y <= face.top + 7; y++) for (let x = cx - W - 3; x <= cx + W + 3; x++) {
        const nx = (x + 0.5 - cx) / (W + 3), ny = (y + 0.5 - (face.top + 4)) / 10;
        if (nx * nx + ny * ny > 1 && y < face.top + 5) continue;
        if (y >= face.top + 5 && Math.abs(nx) > 1) continue;
        p.set(x, y, r[shade(x) + (y < face.top - 2 && nx < 0 ? 1 : 0)]);
      }
      for (let x = cx - W - 5; x <= cx + W + 5; x++) { p.set(x, face.top + 6, r[4]); p.set(x, face.top + 7, r[1]); }
      break;
    }
    case 'helm-paladin': {
      for (let y = face.top - 7; y <= face.chin - 4; y++) for (let x = cx - W - 2; x <= cx + W + 2; x++) {
        const nx = (x + 0.5 - cx) / (W + 2), ny = (y + 0.5 - (face.top + 6)) / 13;
        if (nx * nx + ny * ny > 1 && y < face.top + 6) continue;
        if (Math.abs(nx) > 1) continue;
        const open = inFace(c, x, y) && y > face.top + 6 && Math.abs(x + 0.5 - cx) < W - 3;
        if (open) continue;
        p.set(x, y, r[shade(x)]);
      }
      for (let y = face.top - 10; y < face.top + 6; y++) p.set(cx, y, RAMPS.gold[y < face.top - 7 ? 5 : 3]);
      break;
    }
    case 'hat': {
      for (let x = cx - W - 9; x <= cx + W + 9; x++) { p.set(x, face.top + 2, r[3]); p.set(x, face.top + 3, r[1]); }
      for (let y = face.top - 9; y < face.top + 2; y++) for (let x = cx - W + 1; x <= cx + W - 1; x++) p.set(x, y, r[shade(x)]);
      for (let x = cx - W + 1; x <= cx + W - 1; x++) p.set(x, face.top, RAMPS.gold[3]);
      for (let k = 0; k < 10; k++) { p.set(cx + W - 2 + Math.round(k * 0.6), face.top - 2 - k, RAMPS.red[4]); p.set(cx + W - 1 + Math.round(k * 0.6), face.top - 2 - k, RAMPS.red[3]); }
      break;
    }
    case 'jester': {
      for (let y = face.top - 6; y <= face.top + 4; y++) for (let x = cx - W - 2; x <= cx + W + 2; x++) {
        const nx = (x + 0.5 - cx) / (W + 2), ny = (y + 0.5 - (face.top + 2)) / 8;
        if (nx * nx + ny * ny > 1) continue;
        p.set(x, y, x < cx ? r[shade(x)] : RAMPS.yellow[shade(x)]);
      }
      for (let k = 0; k < 8; k++) { p.set(cx - W - 2 - k, face.top - 4 + Math.round(k * 0.5), r[3]); p.set(cx + W + 2 + k, face.top - 4 + Math.round(k * 0.5), RAMPS.yellow[3]); }
      p.set(cx - W - 10, face.top, RAMPS.gold[4]); p.set(cx + W + 10, face.top, RAMPS.gold[4]);
      break;
    }
    case 'headscarf': {
      for (let y = face.top - 6; y <= face.top + 5; y++) for (let x = cx - W - 3; x <= cx + W + 3; x++) {
        const nx = (x + 0.5 - cx) / (W + 3), ny = (y + 0.5 - (face.top + 1)) / 7;
        if (nx * nx + ny * ny > 1 || (y > face.top + 2 && Math.abs(nx) < 0.8)) continue;
        p.set(x, y, r[shade(x)]);
      }
      break;
    }
    case 'coif': {
      for (let y = face.top - 5; y < S; y++) for (let x = cx - W - 5; x <= cx + W + 5; x++) {
        const nx = (x + 0.5 - cx) / (W + 5);
        if (Math.abs(nx) > 1) continue;
        if (y < face.top + 6 && nx * nx + ((y + 0.5 - (face.top + 6)) / 11) ** 2 > 1) continue;
        if (inFace(c, x, y) && y > face.top + 4 && y < face.chin - 1) continue;
        p.set(x, y, (x + y) % 2 ? RAMPS.steel[2] : RAMPS.steel[4]);
      }
      break;
    }
  }
}

function extras(c: P): void {
  const { p, face, mood, flags } = c;
  if (flags.has('faceless')) return;
  const cx = c.cx;
  // freckles
  if (flags.has('freckles') || flags.has('freckles-light')) {
    const dots: [number, number][] = flags.has('freckles') ? [[-8, 4], [-6, 5], [-9, 6], [-5, 3], [6, 4], [8, 5], [5, 6], [7, 3], [-2, 2], [1, 2]] : [[-7, 4], [-5, 5], [6, 4], [8, 5]];
    for (const [dx, dy] of dots) p.set(cx + dx, c.eyeY + dy, c.skin[2]);
  }
  // blush
  if (flags.has('blush') || mood === 'happy' || (face.age === 'young' && face.lips) || (mood === 'surprised' && face.lips)) {
    const a = flags.has('blush') ? 0.55 : 0.3;
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const x = cx + s * 8 + k - 2, y = c.eyeY + 4 + (k % 2); p.set(x, y, mix(p.get(x, y), RAMPS.pink[3], a)); }
  }
  // scars and burns: the character's right side is screen-left
  if (flags.has('scar-right')) for (let k = 0; k < 7; k++) { p.set(cx - 9 + Math.round(k * 0.4), c.eyeY + 2 + k, mix(RAMPS.red[3], c.skin[3], 0.3)); p.set(cx - 8 + Math.round(k * 0.4), c.eyeY + 2 + k, c.skin[5]); }
  const burn = (side: -1 | 1) => {
    for (let y = c.eyeY - 7; y <= face.chin - 3; y++) for (let x = cx; x !== cx + side * 16; x += side) {
      if (!inFace(c, x, y)) continue;
      const dx = Math.abs(x - cx);
      if (dx < 2 + hash2(y, 1, 3) * 2) continue;
      const v = hash2(x, y, 11);
      const cur = p.get(x, y);
      if (cur === 0x120c12 || cur === 0xffffff) continue;
      const n = hash2(x >> 1, y >> 1, 5);
      const scarC = n > 0.7 ? mix(RAMPS.red[3], c.skin[3], 0.55) : v > 0.55 ? mix(RAMPS.pink[3], c.skin[4], 0.6) : v > 0.2 ? mix(RAMPS.red[2], c.skin[3], 0.7) : c.skin[2];
      p.set(x, y, scarC);
    }
  };
  if (flags.has('burn-left')) burn(1);
  if (flags.has('burn-right')) burn(-1);
  if (flags.has('bruise')) {
    // cut over the left brow with a trickle of blood (Kyra after the raid)
    for (let k = 0; k < 4; k++) p.set(cx + 6 + k, c.eyeY - 5 - (k % 2), RAMPS.red[2]);
    for (let k = 0; k < 4; k++) p.set(cx + 8, c.eyeY - 3 + k, k % 2 ? RAMPS.red[2] : RAMPS.red[3]);
    for (let k = 0; k < 3; k++) p.set(cx - 9 + k, c.eyeY + 5, mix(p.get(cx - 9 + k, c.eyeY + 5), RAMPS.violet[2], 0.35));
  }
  if (flags.has('wounded')) {
    // pale, sweating
    p.set(cx + 10, face.top + 9, 0xd8f0ff); p.set(cx + 10, face.top + 10, 0x9cc8e8);
  }
  if (face.age === 'old') {
    // forehead lines & crow's feet
    for (let k = -4; k <= 4; k++) { p.set(cx + k, c.eyeY - 9, c.skin[3]); }
    for (let k = -3; k <= 3; k++) if (k % 2) p.set(cx + k, c.eyeY - 11, c.skin[3]);
  }
  // mood decorations
  if (mood === 'sad') { for (let k = 0; k < 3; k++) p.set(cx - 9, c.eyeY + 3 + k, k === 2 ? 0xd8f4ff : 0x8cc8ec); }
  if (mood === 'scared' || mood === 'hurt') {
    const sx = cx + face.W - 2, sy = face.top + 8;
    p.set(sx, sy, 0xe8f8ff); p.set(sx, sy + 1, 0xb8e0f4); p.set(sx - 1, sy + 1, 0xd8f0ff); p.set(sx, sy + 2, 0x7ab4dc); p.set(sx - 1, sy + 2, 0xb8e0f4);
  }
  if (mood === 'angry') {
    // cross-popping anger mark
    const ax = cx + face.W - 1, ay = face.top + 3;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [3, 0], [4, 0], [4, 1], [0, 3], [0, 4], [1, 4], [4, 3], [4, 4], [3, 4]] as const) p.set(ax + dx, ay + dy, RAMPS.red[4]);
  }
  if (mood === 'scared') for (let y = face.top + 4; y < c.eyeY - 6; y++) if (y % 2 === 0) for (let x = cx - 6; x <= cx + 6; x += 3) p.set(x, y, mix(p.get(x, y), RAMPS.blue[3], 0.35));
}

/** Long pointed elf ears poking through the hair. */
function elfEars(c: P): void {
  if (c.spec.ears !== 'elf') return;
  const { p } = c;
  for (const s of [-1, 1]) {
    const ex = Math.round(c.cx + s * (hw(c, c.eyeY + 2) - 0.5)) - (s > 0 ? 1 : 0);
    const ey = c.eyeY + 5;
    for (let k = 0; k < 11; k++) {
      const x = ex + s * Math.round(k * 0.75), y = ey - k;
      const th = Math.max(1, 4 - Math.floor(k / 3));
      for (let t = 0; t < th; t++) {
        const lit = s < 0;
        let col = c.skin[t === 0 ? (lit ? 4 : 3) : t === th - 1 ? 2 : 3];
        if (t === 1 && k > 1 && k < 8) col = c.skin[2]; // inner ear shadow
        p.set(x, y + t, col);
      }
    }
  }
}

function rimLight(p: Px, accent: number): void {
  const rim = mix(0xdfe8ff, accent, 0.35);
  const out: [number, number][] = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (!p.alpha(x, y)) continue;
    // pixels whose right or upper-right neighbour is empty catch the rim light
    if (!p.alpha(x + 1, y) || (!p.alpha(x + 1, y - 1) && !p.alpha(x, y - 1))) out.push([x, y]);
  }
  for (const [x, y] of out) p.set(x, y, mix(p.get(x, y), rim, 0.45));
}

function vamirSmoke(p: Px): void {
  for (let k = 0; k < 40; k++) {
    const x = Math.round(hash2(k, 1, 77) * 64), y = 40 + Math.round(hash2(k, 2, 77) * 24);
    for (let r = 0; r < 3; r++) if (!p.alpha(x + r, y - r)) p.blend(x + r, y - r, 0x2a1a3a, 0.5);
  }
}

// ------------------------------------------------------------------------------------------
// Assembly
// ------------------------------------------------------------------------------------------

function buildPortrait(id: string, mood: Mood): Px {
  const known = PORTRAIT_IDS.includes(id) && PRESETS[id];
  const spec: Preset = known ? PRESETS[id] : silhouetteSpec();
  const face = faceFor(id, spec);
  const flags = new Set(spec.extra ?? []);
  const eyeY = Math.round(face.top + (face.chin - face.top) * 0.53);
  const c: P = {
    p: new Px(S, S), id, spec, face, mood, flags,
    skin: six(spec.skin), hair: six(spec.hair?.color ?? 'nut'),
    brow: six(spec.hair?.style === 'bald' ? (spec.beard?.color ?? spec.hair?.color ?? 'nut') : (spec.hair?.color ?? 'nut')).map(v => shift(v, -0.25)),
    eye: six(spec.x?.eyes ?? 'brown'),
    top: six(spec.top?.color ?? 'linen'), trim: six(spec.top?.trim ?? spec.top?.color ?? 'linen'),
    cloak: six(spec.cloak?.color ?? 'green'), head: six(spec.head?.color ?? 'leather'),
    beard: six(spec.beard?.color ?? spec.hair?.color ?? 'nut'),
    cx: 32, eyeY, noseY: eyeY + 7, mouthY: eyeY + 11,
  };
  if (spec.hair?.color === 'silver' || spec.hair?.color === 'ash') c.brow = six('grey').map(v => shift(v, -0.15));
  // wounded / scared faces are paler
  if (flags.has('wounded')) c.skin = c.skin.map(v => mix(v, 0xd8d0d0, 0.25));
  if (!known) {
    const fig = new Px(S, S);
    c.p = fig;
    c.top = six('#2a2c38'); c.head = six('#2a2c38');
    shoulders(c);
    headgear(c);
    fig.outline({ fixed: 0x0a0a10 });
    rimLight(fig, 0x8090c0);
    const out = new Px(S, S);
    background(out, 0x3a4060);
    out.blit(fig, 0, 0);
    return out;
  }
  hairBack(c);
  shoulders(c);
  hairLocks(c);
  head(c);
  eyes(c);
  brows(c);
  nose(c);
  mouth(c);
  beard(c);
  hairFront(c);
  elfEars(c);
  headgear(c);
  extras(c);
  c.p.outline({ amount: 0.9 });
  const accent = paletteRamp(spec.x?.accent ?? 'gold');
  rimLight(c.p, accent[Math.floor(accent.length / 2)]);
  if (flags.has('smoke')) vamirSmoke(c.p);
  const out = new Px(S, S);
  background(out, accent[Math.floor(accent.length / 2)]);
  out.blit(c.p, 0, 0);
  // subtle frame vignette
  for (let i = 0; i < S; i++) for (const [x, y] of [[i, 0], [i, S - 1], [0, i], [S - 1, i]] as const) out.set(x, y, mix(out.get(x, y), 0x0a0c14, 0.5));
  void outlineOf;
  return out;
}

function silhouetteSpec(): Preset {
  return { skin: 'skin', head: { style: 'hood', color: '#2a2c38' }, top: { style: 'shirt', color: '#2a2c38' }, hair: { style: 'bald', color: 'black' } };
}

const canvasCache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();

export function normaliseMood(mood?: string): Mood {
  return (PORTRAIT_MOODS as readonly string[]).includes(mood ?? '') ? mood as Mood : 'neutral';
}

export function portraitPx(id: string, mood?: string): Px {
  return buildPortrait(id, normaliseMood(mood));
}

export function portraitCanvas(id: string, mood?: string): HTMLCanvasElement {
  const key = `${id}:${normaliseMood(mood)}`;
  let c = canvasCache.get(key);
  if (!c) { c = portraitPx(id, mood).toCanvas(); canvasCache.set(key, c); }
  return c;
}

export function portraitDataUrl(id: string, mood?: string): string {
  const key = `${id}:${normaliseMood(mood)}`;
  let u = urlCache.get(key);
  if (!u) { u = portraitCanvas(id, mood).toDataURL('image/png'); urlCache.set(key, u); }
  return u;
}

export function portraitIds(): string[] { return [...PORTRAIT_IDS]; }

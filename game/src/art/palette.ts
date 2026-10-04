/**
 * The one fixed Selantis palette. Every ramp runs dark → light and is hue-shifted
 * (shadows drift toward violet/blue, highlights toward warm yellow) for a cozy 16-bit look.
 */

export type Ramp = readonly number[];

export const RAMPS = {
  ink: [0x140f18, 0x221a26, 0x342838],
  earth: [0x24171a, 0x3d2622, 0x5e3a2b, 0x82543a, 0xa8754d, 0xc99a68, 0xe6c28f],
  wood: [0x2a1a1c, 0x472b24, 0x6b412c, 0x8e5c38, 0xb37d4a, 0xd4a46a],
  straw: [0x6e4b25, 0x9a7034, 0xc49a44, 0xe2c062, 0xf3dc8e, 0xfff1c4],
  gold: [0x5a3a14, 0x93661f, 0xc9963a, 0xe8c262, 0xfbeaa6],
  forest: [0x0f2020, 0x173327, 0x21452d, 0x2e5a33],
  grass: [0x1f3b2a, 0x2b5530, 0x3d7135, 0x558e3c, 0x74ad47, 0x9cc95a],
  meadow: [0x4c6a26, 0x6b8a2e, 0x8eab3c, 0xb3c95a, 0xd8e48a],
  pine: [0x10262a, 0x183a3a, 0x24524a, 0x346e5a, 0x4d8c6a],
  water: [0x141f3d, 0x1b315c, 0x22487e, 0x2d64a0, 0x3f86bc, 0x69abd2, 0xa6d8e6, 0xe4faff],
  night: [0x0d0e1c, 0x171a30, 0x252847, 0x383a63, 0x56548a, 0x7c72aa],
  stone: [0x22232c, 0x363846, 0x4e5160, 0x6a6d7c, 0x8c8f9c, 0xb2b4bd, 0xd9dadf],
  warmstone: [0x2f2726, 0x4a3e3a, 0x67584f, 0x87766a, 0xa8978a, 0xcbbcad],
  red: [0x2e0f1a, 0x531a24, 0x812a2c, 0xb23e34, 0xd8613f, 0xf0956a],
  rust: [0x3a1a14, 0x63301e, 0x8f4a26, 0xb86a34, 0xd99550],
  fire: [0x8a2414, 0xc8501c, 0xec8a2c, 0xf8c64e, 0xfff2a8],
  skin: [0x4a2a26, 0x7a463a, 0xb06f55, 0xd9a07a, 0xf2c9a2, 0xfde5c8],
  skinTan: [0x3e2420, 0x643a2c, 0x92583c, 0xbc8456, 0xdcaa78, 0xf0cc9c],
  skinDark: [0x241414, 0x3e2420, 0x5e3628, 0x82503a, 0xa47054, 0xc49272],
  skinPale: [0x5a3a3e, 0x8e5e5c, 0xc0908a, 0xe2bcae, 0xf6dccf, 0xfff0e6],
  strawberry: [0x5a2a1a, 0x8e4822, 0xbc6c2e, 0xd99242, 0xedb862, 0xf8dc9c],
  greybrown: [0x2a221e, 0x463a32, 0x66564a, 0x847262, 0xa4927e, 0xc4b4a0],
  grey: [0x2a2c34, 0x464a54, 0x666a74, 0x8a8e96, 0xb0b2b8, 0xd6d8dc],
  amber: [0x4a2a0c, 0x7a4a14, 0xb07420, 0xd89a34, 0xf0c060, 0xfce0a0],
  brown: [0x24140e, 0x3e2416, 0x5e3a22, 0x80542e, 0xa4743e, 0xc49458],
  ginger: [0x4a1c14, 0x7c3218, 0xb04e22, 0xd8762e, 0xefa04a, 0xfacb7e],
  copper: [0x3a1a18, 0x60281c, 0x8e3e22, 0xb65a30, 0xd27e48, 0xe8a26a],
  nut: [0x2a1814, 0x45281a, 0x643c22, 0x87562e, 0xa8743e, 0xc79458],
  ash: [0x2c2b32, 0x4a4950, 0x6c6b72, 0x929198, 0xbab9be, 0xe2e1e4],
  silver: [0x40445a, 0x6a7088, 0x98a0b4, 0xc4cad8, 0xe6eaf2, 0xffffff],
  coal: [0x0e0d12, 0x18161e, 0x24212c, 0x34303e, 0x4a4556, 0x625c70],
  blue: [0x111834, 0x1c2a5a, 0x2a4288, 0x3d62b4, 0x5e8ad6, 0x8eb4ec],
  sky: [0x2a3c6a, 0x46649a, 0x6e92c4, 0x9cbee0, 0xc8e0f2, 0xeef8ff],
  cream: [0x5e5248, 0x8a7c6c, 0xb4a690, 0xd6ccb4, 0xece4d0, 0xfffaf0],
  linen: [0x6a5a48, 0x938068, 0xbaa688, 0xd8c8a8, 0xeee2c6],
  olive: [0x1e2414, 0x30391c, 0x465426, 0x5e7032, 0x7a8c44, 0x9cab5c],
  green: [0x10231c, 0x1a3a26, 0x265634, 0x367444, 0x4e9456, 0x72b46a],
  teal: [0x0e2a2e, 0x15464a, 0x1f6664, 0x2f8a82, 0x4cb0a2],
  steel: [0x1a1d26, 0x2c313e, 0x454c5c, 0x646d80, 0x8e98aa, 0xc2cad6, 0xeef2f8],
  iron: [0x121318, 0x1d1f27, 0x2b2e39, 0x3d414f, 0x555a6a, 0x737a8c],
  urmacht: [0x0c4a52, 0x138078, 0x25b4a4, 0x49e0c8, 0x9cf8e6, 0xe8fffa],
  violet: [0x1a0c2e, 0x34165a, 0x5a2a8e, 0x8a4ac4, 0xb884ec, 0xe2c4ff],
  pink: [0x5a1a34, 0x922c50, 0xc8486e, 0xec7c98, 0xfab6c4],
  cornflower: [0x1a2470, 0x2a3eae, 0x3e62e0, 0x6e92f6, 0xa8c4ff],
  yellow: [0x7a5414, 0xb4841c, 0xe0b42c, 0xf6dc52, 0xfff4a0],
  orange: [0x5e2410, 0x9a3e14, 0xd06420, 0xf09038, 0xfcc070],
  white: [0x8a8c9a, 0xb4b8c4, 0xd8dce4, 0xf0f2f6, 0xffffff],
  black: [0x0c0b10, 0x16141c, 0x221f2a, 0x302c3a, 0x423d4e],
  leather: [0x2a1810, 0x47281a, 0x6a3e24, 0x8e5a34, 0xb07a48],
  mud: [0x231a16, 0x382a20, 0x50402c, 0x6a5638, 0x857048],
  sand: [0x7e6440, 0xa88a58, 0xcdb078, 0xe6d09a, 0xf6e8c0],
} satisfies Record<string, number[]>;

export type RampName = keyof typeof RAMPS;

/** Named single colors (many are aliases into ramps). */
export const COLORS: Record<string, number> = {
  outline: 0x1a1220,
  shadow: 0x101418,
  urmacht: 0x49e0c8,
  urmachtLight: 0x9cf8e6,
  vamir: 0x8a4ac4,
  gold: 0xd8b25a,
  parchment: 0xefe3c8,
  ink: 0x2b2119,
  danger: 0xd4573b,
  fire: 0xf8c64e,
  candle: 0xffd27a,
  lantern: 0xffc46a,
  moon: 0xc8d8ff,
  night: 0x171a30,
  water: 0x2d64a0,
  grass: 0x558e3c,
  white: 0xffffff,
  black: 0x000000,
  turquoise: 0x49e0c8,
  blood: 0x8a1a22,
  falconBlue: 0x3d62b4,
  falconYellow: 0xe0b42c,
  shadowBlack: 0x18161e,
  shadowWhite: 0xd8dce4,
  steel: 0x8e98aa,
  skin: 0xd9a07a,
};
for (const [name, ramp] of Object.entries(RAMPS)) {
  COLORS[name] ??= ramp[Math.floor(ramp.length / 2)];
  ramp.forEach((c, i) => { COLORS[`${name}${i}`] = c; });
}

export function color(name: string): number {
  if (name in COLORS) return COLORS[name];
  const parsed = parseHex(name);
  return parsed ?? 0xff00ff;
}

export function parseHex(s: string): number | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(s.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
  return parseInt(h, 16);
}

export const r8 = (c: number) => (c >> 16) & 255;
export const g8 = (c: number) => (c >> 8) & 255;
export const b8 = (c: number) => c & 255;
export const rgb = (r: number, g: number, b: number) =>
  ((clamp8(r) << 16) | (clamp8(g) << 8) | clamp8(b)) >>> 0;
const clamp8 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** Perceived luminance 0..1. */
export function luminance(c: number): number {
  return (0.2126 * r8(c) + 0.7152 * g8(c) + 0.0722 * b8(c)) / 255;
}

export function mix(a: number, b: number, t: number): number {
  return rgb(r8(a) + (r8(b) - r8(a)) * t, g8(a) + (g8(b) - g8(a)) * t, b8(a) + (b8(b) - b8(a)) * t);
}

export function toHex(c: number): string {
  return `#${(c >>> 0).toString(16).padStart(6, '0')}`;
}

function rgbToHsl(c: number): [number, number, number] {
  const r = r8(c) / 255, g = g8(c) / 255, b = b8(c) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): number {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgb((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** Hue-shifted lighten (t>0) / darken (t<0), the pixel-art way. */
export function shift(c: number, t: number): number {
  const [h, s, l] = rgbToHsl(c);
  if (t >= 0) {
    // toward warm yellow (60°)
    const dh = ((60 - h + 540) % 360) - 180;
    return hslToRgb(h + dh * 0.18 * t, Math.max(0, s - 0.05 * t), Math.min(0.97, l + (1 - l) * 0.55 * t));
  }
  const k = -t;
  // toward cool violet (250°)
  const dh = ((250 - h + 540) % 360) - 180;
  return hslToRgb(h + dh * 0.2 * k, Math.min(1, s + 0.08 * k), l * (1 - 0.5 * k));
}

/** Builds a 6-step ramp around any base colour (index 3 ≈ base). */
export function makeRamp(base: number): number[] {
  return [shift(base, -0.85), shift(base, -0.6), shift(base, -0.3), base, shift(base, 0.35), shift(base, 0.7)];
}

const rampCache = new Map<string, number[]>();
/**
 * Resolves a palette ramp name, a named colour or a hex string into a ramp (dark → light).
 * Unknown named colours resolve via makeRamp so custom specs still look shaded.
 */
export function ramp(nameOrHex: string): number[] {
  const cached = rampCache.get(nameOrHex);
  if (cached) return cached;
  let out: number[];
  if (nameOrHex in RAMPS) out = [...RAMPS[nameOrHex as RampName]];
  else out = makeRamp(color(nameOrHex));
  rampCache.set(nameOrHex, out);
  return out;
}

/** Picks a ramp entry by relative position 0..1 (0 = darkest). */
export function rampAt(r: readonly number[], t: number): number {
  const i = Math.max(0, Math.min(r.length - 1, Math.round(t * (r.length - 1))));
  return r[i];
}

/** Night grading used for GroundSpec.palette = 'night' (cool, darker, a bit desaturated). */
export function nightGrade(c: number): number {
  const l = luminance(c);
  const cool = rgb(r8(c) * 0.42 + 8, g8(c) * 0.52 + 12, b8(c) * 0.7 + 34);
  return mix(cool, rgb(40 * l, 50 * l, 90 * l + 20), 0.25);
}

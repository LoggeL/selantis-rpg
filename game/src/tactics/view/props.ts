import type Phaser from 'phaser';
import { G } from '../../core/G';
import { mix, pal } from './palette';
import { Pix, artRng, bayer } from './pixels';

export interface IsoProp {
  key: string;
  /** Frame names for animated props (fire, banners). */
  frames?: string[];
  fps?: number;
  w: number;
  h: number;
  /** Ground contact point inside the texture (placed at the tile centre). */
  ox: number;
  oy: number;
  /** Tall props fade when something behind them is focused. */
  tall?: boolean;
  /** Draw in front of a unit standing on the same tile (bushes hide feet). */
  overUnit?: boolean;
  light?: { color: number; radius: number };
}

type Painter = (p: Pix, rnd: () => number, frame: number) => void;
interface Recipe { w: number; h: number; ox: number; oy: number; frames?: number; fps?: number; tall?: boolean; overUnit?: boolean; light?: IsoProp['light']; paint: Painter }

const OUT = () => pal('ink', 0);

/** Leafy clump made of shaded blobs with a light rim from the top-left. */
function foliage(p: Pix, rnd: () => number, cx: number, cy: number, rx: number, ry: number, ramp: string, base = 2): void {
  p.ellipse(cx, cy, rx, ry, (x, y, nx, ny) => {
    const light = -nx * 0.55 - ny * 0.75 + (rnd() - 0.5) * 0.5;
    const d = bayer(x, y) - 0.5;
    const t = light + d * 0.35;
    const idx = t > 0.62 ? base + 2 : t > 0.12 ? base + 1 : t > -0.45 ? base : base - 1;
    return pal(ramp, idx);
  });
}

const RECIPES: Record<string, Recipe> = {
  bush: {
    w: 24, h: 18, ox: 12, oy: 15, overUnit: true,
    paint(p, rnd) {
      p.ellipse(12, 15, 10, 3, pal('ink', 0), 0.35);
      foliage(p, rnd, 7, 11, 6, 5, 'grass', 1);
      foliage(p, rnd, 16, 11, 6, 5, 'grass', 1);
      foliage(p, rnd, 11.5, 7.5, 7, 5.5, 'grass', 2);
      for (let i = 0; i < 9; i++) {
        const x = 4 + Math.floor(rnd() * 16), y = 4 + Math.floor(rnd() * 9);
        if (p.alpha(x, y)) p.set(x, y, pal('grass', 5));
      }
      if (rnd() < 0.6) for (let i = 0; i < 3; i++) { const x = 6 + Math.floor(rnd() * 12), y = 8 + Math.floor(rnd() * 5); if (p.alpha(x, y)) p.set(x, y, pal('red', 4)); }
      p.outline(OUT(), 0.85);
    },
  },
  rock: {
    w: 24, h: 20, ox: 12, oy: 16,
    paint(p, rnd) {
      p.ellipse(12, 16, 10, 3.2, pal('ink', 0), 0.4);
      const lobes = [[12, 11, 9, 7], [8, 13, 5.5, 4.5], [16.5, 13, 5, 4]];
      for (const [cx, cy, rx, ry] of lobes) {
        p.ellipse(cx, cy, rx, ry, (x, y, nx, ny) => {
          const facet = Math.round((-nx * 0.7 - ny * 0.9) * 2.2 + (rnd() - 0.5) * 0.4);
          const idx = Math.max(1, Math.min(5, 3 + facet));
          return pal('stone', idx);
        });
      }
      for (let i = 0; i < 3; i++) {
        let x = 7 + Math.floor(rnd() * 10), y = 7 + Math.floor(rnd() * 5);
        for (let k = 0; k < 4; k++) { if (p.alpha(x, y)) p.set(x, y, pal('stone', 1)); x += rnd() < 0.5 ? 1 : 0; y += 1; }
      }
      for (let i = 0; i < 10; i++) { const x = 5 + Math.floor(rnd() * 13), y = 4 + Math.floor(rnd() * 4); if (p.alpha(x, y) && p.alpha(x, y - 1) === 0) p.set(x, y, pal('grass', 3)); }
      p.outline(OUT(), 0.9);
    },
  },
  'tree-pine': {
    w: 28, h: 46, ox: 14, oy: 43, tall: true,
    paint(p, rnd) {
      p.ellipse(14, 43, 11, 3.2, pal('ink', 0), 0.38);
      p.rect(13, 32, 3, 11, pal('wood', 2)); p.rect(13, 32, 1, 11, pal('wood', 3));
      const tiers = [[14, 33, 12, 6], [14, 26, 10, 6], [14, 19, 8, 5.5], [14, 12, 6, 5], [14, 6, 3.5, 4]];
      for (const [cx, cy, rx, ry] of tiers) {
        p.ellipse(cx, cy, rx, ry, (x, y, nx, ny) => {
          if (ny < -0.2 && Math.abs(nx) > (ny + 1.2) * 0.8) return null; // pointed tiers
          const t = -nx * 0.6 - ny * 0.6 + (rnd() - 0.5) * 0.45 + (bayer(x, y) - 0.5) * 0.3;
          return pal('pine', t > 0.55 ? 4 : t > 0 ? 3 : t > -0.5 ? 2 : 1);
        });
      }
      p.outline(OUT(), 0.9);
    },
  },
  'tree-oak': {
    w: 32, h: 44, ox: 16, oy: 41, tall: true,
    paint(p, rnd) {
      p.ellipse(16, 41, 12, 3.4, pal('ink', 0), 0.38);
      p.rect(14, 26, 4, 15, pal('wood', 2)); p.rect(14, 26, 1, 15, pal('wood', 3)); p.rect(17, 26, 1, 15, pal('wood', 1));
      p.set(13, 40, pal('wood', 2)); p.set(18, 40, pal('wood', 1));
      foliage(p, rnd, 10, 22, 8, 7, 'grass', 1);
      foliage(p, rnd, 22, 22, 8, 7, 'grass', 1);
      foliage(p, rnd, 16, 14, 11, 9, 'grass', 2);
      foliage(p, rnd, 11, 11, 6, 5, 'grass', 2);
      for (let i = 0; i < 14; i++) { const x = 6 + Math.floor(rnd() * 20), y = 6 + Math.floor(rnd() * 16); if (p.alpha(x, y)) p.set(x, y, pal('grass', 5)); }
      p.outline(OUT(), 0.9);
    },
  },
  'tree-dead': {
    w: 28, h: 40, ox: 14, oy: 37, tall: true,
    paint(p) {
      p.ellipse(14, 37, 9, 2.6, pal('ink', 0), 0.35);
      const br = (x: number, y: number, dx: number, n: number, c: number) => { for (let i = 0; i < n; i++) { p.set(x, y, c); y--; if (i % 2) x += dx; } };
      p.rect(13, 18, 3, 19, pal('ash', 2)); p.rect(13, 18, 1, 19, pal('ash', 3));
      br(13, 22, -1, 10, pal('ash', 2)); br(15, 20, 1, 12, pal('ash', 1)); br(14, 18, 0, 10, pal('ash', 2)); br(9, 16, -1, 5, pal('ash', 2)); br(20, 13, 1, 5, pal('ash', 1));
      p.outline(OUT(), 0.9);
    },
  },
  ruin: {
    w: 30, h: 40, ox: 15, oy: 33, tall: true,
    paint(p, rnd) {
      // An iso stone pillar/wall stub on the tile footprint, broken top.
      const H = 20 + Math.floor(rnd() * 6);
      const topEdge = (x: number) => 8 + Math.floor(Math.min(x, 23 - x) / 2);
      const cut: number[] = [];
      for (let x = 0; x < 24; x++) cut.push(Math.floor(rnd() * 3) + (x > 6 && x < 15 && rnd() < 0.6 ? 4 : 0));
      const ox = 3, oy = 33 - 12 - H;
      for (let x = 0; x < 24; x++) {
        const left = x < 12;
        const s = left ? x : 23 - x;
        for (let d = cut[x]; d < H + 4; d++) {
          const y = oy + topEdge(x) - 4 + d;
          const by = d % 5, bx = (s + (Math.floor(d / 5) % 2) * 3) % 6;
          let c = pal('stone', left ? 4 : 2);
          if (by === 4 || bx === 0) c = pal('stone', left ? 2 : 1);
          if (d === cut[x]) c = pal('stone', left ? 5 : 3);
          if (rnd() < 0.06) c = pal('grass', left ? 3 : 2);
          if (d > H + 1) c = mix(c, pal('ink', 0), 0.4);
          p.set(ox + x, y, c);
        }
      }
      for (let i = 0; i < 6; i++) { const x = ox + 2 + Math.floor(rnd() * 20); const y = oy + 2 + Math.floor(rnd() * 6) + cut[x - ox]; if (p.alpha(x, y)) p.set(x, y, pal('grass', 3)); }
      p.outline(OUT(), 0.9);
    },
  },
  fire: {
    w: 20, h: 26, ox: 10, oy: 22, frames: 4, fps: 9, light: { color: 0xffa040, radius: 34 },
    paint(p, rnd, f) {
      p.ellipse(10, 22, 7, 2.2, pal('ink', 0), 0.35);
      const tongues = 5;
      for (let i = 0; i < tongues; i++) {
        const bx = 4 + i * 3 + ((f + i) % 2);
        const hgt = 9 + ((i * 7 + f * 5) % 9);
        for (let y = 0; y < hgt; y++) {
          const w = Math.max(0, Math.round((1 - y / hgt) * 2.6));
          for (let x = -w; x <= w; x++) {
            const t = y / hgt;
            const c = t < 0.25 ? pal('fire', 4) : t < 0.5 ? pal('fire', 3) : t < 0.8 ? pal('fire', 2) : pal('fire', 1);
            const sway = Math.round(Math.sin((y + f * 2 + i) * 0.7) * (t * 1.5));
            p.set(bx + x + sway, 21 - y, Math.abs(x) === w && w > 0 ? pal('fire', 1) : c);
          }
        }
      }
      for (let i = 0; i < 3; i++) p.set(3 + Math.floor(rnd() * 14), 2 + Math.floor(rnd() * 8), pal('fire', 4));
    },
  },
  campfire: {
    w: 22, h: 24, ox: 11, oy: 19, frames: 4, fps: 8, light: { color: 0xffa040, radius: 44 },
    paint(p, rnd, f) {
      p.ellipse(11, 19, 9, 3, pal('ink', 0), 0.35);
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; p.ellipse(11 + Math.cos(a) * 7, 18 + Math.sin(a) * 2.6, 1.6, 1.2, pal('stone', 3 + (i % 2))); }
      p.rect(6, 17, 10, 2, pal('wood', 2)); p.rect(8, 16, 7, 1, pal('wood', 3));
      for (let i = 0; i < 4; i++) {
        const bx = 8 + i * 2 + ((f + i) % 2), hgt = 6 + ((i * 5 + f * 3) % 7);
        for (let y = 0; y < hgt; y++) {
          const t = y / hgt, w = Math.max(0, Math.round((1 - t) * 1.8));
          for (let x = -w; x <= w; x++) p.set(bx + x + Math.round(Math.sin(y + f + i) * t), 16 - y, t < 0.3 ? pal('fire', 4) : t < 0.6 ? pal('fire', 3) : pal('fire', 2));
        }
      }
      if (rnd() < 0.8) p.set(6 + Math.floor(rnd() * 10), 3 + Math.floor(rnd() * 5), pal('fire', 3));
    },
  },
  'banner-light': {
    w: 18, h: 38, ox: 4, oy: 35, frames: 2, fps: 3, tall: true,
    paint(p, _r, f) {
      p.ellipse(4, 35, 3, 1.2, pal('ink', 0), 0.4);
      p.rect(3, 4, 1, 32, pal('wood', 3)); p.rect(4, 4, 1, 32, pal('wood', 1));
      p.set(3, 3, pal('gold', 4)); p.set(4, 3, pal('gold', 2));
      for (let y = 0; y < 15; y++) for (let x = 0; x < 11; x++) {
        const wave = Math.round(Math.sin((x + f * 3) * 0.55) * 1.2);
        const yy = 5 + y + wave;
        if (y === 14 && x % 4 === 3) continue;
        let c = x < 5 ? pal('blue', 3) : pal('white', 3);
        if (y < 2 || y > 12) c = pal('white', 2);
        // white raptor silhouette
        const bird = (x >= 3 && x <= 7 && y === 6) || (x >= 4 && x <= 6 && y === 7) || (x === 5 && (y === 8 || y === 5)) || ((x === 2 || x === 8) && y === 5);
        if (bird) c = pal('white', 4);
        p.set(5 + x, yy, mix(c, 0x000000, x > 8 ? 0.15 : 0));
      }
      p.outline(OUT(), 0.85);
    },
  },
  'banner-dark': {
    w: 18, h: 38, ox: 4, oy: 35, frames: 2, fps: 3, tall: true,
    paint(p, _r, f) {
      p.ellipse(4, 35, 3, 1.2, pal('ink', 0), 0.4);
      p.rect(3, 4, 1, 32, pal('wood', 2)); p.rect(4, 4, 1, 32, pal('wood', 0));
      p.set(3, 3, pal('steel', 5)); p.set(4, 3, pal('steel', 3));
      for (let y = 0; y < 15; y++) for (let x = 0; x < 11; x++) {
        const wave = Math.round(Math.sin((x + f * 3 + 1) * 0.55) * 1.2);
        if (y === 14 && x % 3 === 1) continue;
        const q = (x < 5) !== (y < 7);
        p.set(5 + x, 5 + y + wave, q ? pal('white', 3) : pal('black', 2));
      }
      p.outline(OUT(), 0.85);
    },
  },
  stake: {
    w: 12, h: 26, ox: 6, oy: 23, tall: true,
    paint(p) {
      p.ellipse(6, 23, 4, 1.4, pal('ink', 0), 0.4);
      p.rect(5, 4, 3, 19, pal('wood', 2)); p.rect(5, 4, 1, 19, pal('wood', 3));
      p.set(6, 3, pal('wood', 3));
      p.rect(4, 12, 5, 1, pal('straw', 2)); p.rect(4, 14, 5, 1, pal('straw', 1));
      p.outline(OUT(), 0.85);
    },
  },
  crate: {
    w: 20, h: 20, ox: 10, oy: 17,
    paint(p) {
      p.ellipse(10, 17, 8, 2.4, pal('ink', 0), 0.35);
      p.rect(3, 6, 14, 10, pal('wood', 3)); p.rect(10, 6, 7, 10, pal('wood', 2));
      p.rect(3, 4, 14, 3, pal('wood', 4));
      p.rect(3, 10, 14, 1, pal('wood', 1)); p.rect(10, 6, 1, 10, pal('wood', 1));
      p.outline(OUT(), 0.85);
    },
  },
  stump: {
    w: 18, h: 14, ox: 9, oy: 11,
    paint(p) {
      p.ellipse(9, 11, 7, 2, pal('ink', 0), 0.35);
      p.rect(4, 5, 10, 6, pal('wood', 2)); p.rect(4, 5, 4, 6, pal('wood', 3));
      p.ellipse(9, 5, 5, 2, pal('wood', 4)); p.ellipse(9, 5, 2.5, 1, pal('wood', 3));
      p.outline(OUT(), 0.85);
    },
  },
};

const built = new Map<string, IsoProp>();

/** Ensures a tactics prop texture (procedural iso pixel art) and returns its info. */
export function isoProp(scene: Phaser.Scene, id: string, variant = 0): IsoProp {
  const r = RECIPES[id] ?? RECIPES.rock;
  const key = `tac-prop-${id}-${variant}`;
  const cached = built.get(key);
  if (cached && scene.textures.exists(key)) return cached;
  const frames = r.frames ?? 1;
  const strip = new Pix(r.w * frames, r.h);
  for (let f = 0; f < frames; f++) {
    const p = new Pix(r.w, r.h);
    r.paint(p, artRng(variant * 7919 + f * 13 + id.length * 101), f);
    strip.blit(p, f * r.w, 0);
  }
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.addCanvas(key, strip.toCanvas())!;
    for (let f = 0; f < frames; f++) tex.add(`f${f}`, 0, f * r.w, 0, r.w, r.h);
  }
  const info: IsoProp = {
    key, w: r.w, h: r.h, ox: r.ox, oy: r.oy, tall: r.tall, overUnit: r.overUnit, light: r.light,
    frames: frames > 1 ? Array.from({ length: frames }, (_, f) => `f${f}`) : undefined, fps: r.fps,
  };
  built.set(key, info);
  return info;
}

export const isoPropIds = () => Object.keys(RECIPES);

/**
 * Optionally uses the shared art layer's prop (e.g. a tree) when it exists and is not a placeholder.
 * Returns null when the tactics-native prop should be used.
 */
export function sharedProp(scene: Phaser.Scene, id: string, variant = 0): IsoProp | null {
  try {
    if (!G.art.propIds().includes(id)) return null;
    const info = G.art.prop(scene, id, variant);
    if (info.key.includes('stub') || info.width < 20) return null;
    return { key: info.key, w: info.width, h: info.height, ox: info.originX, oy: info.originY, tall: info.height > 32 };
  } catch { return null; }
}

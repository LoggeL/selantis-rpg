import type Phaser from 'phaser';
import { G } from '../../core/G';
import { isoPropKey, tacticsManifest } from './assets';
import { pal } from './palette';
import { Pix, artRng } from './pixels';

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
  /** Display scale (procedural fallbacks drawn for the old 32 px tiles are shown at 1.5x). */
  scale?: number;
  /** Painted campfire: the scene adds animated flames on top. */
  flame?: boolean;
  /** Animation key from the shared art layer (G.art props). */
  anim?: string;
}

type Painter = (p: Pix, rnd: () => number, frame: number) => void;
interface Recipe { w: number; h: number; ox: number; oy: number; frames?: number; fps?: number; tall?: boolean; overUnit?: boolean; light?: IsoProp['light']; paint: Painter }

const OUT = () => pal('ink', 0);

/** Flickering flame tongues (an effect, so it stays code-drawn). */
function flames(p: Pix, f: number, cx: number, base: number, count: number, maxH: number, k: number): void {
  for (let i = 0; i < count; i++) {
    const bx = cx - Math.floor(count * 1.5 * k) + Math.round(i * 3 * k) + ((f + i) % 2);
    const hgt = Math.round((maxH * 0.55 + ((i * 7 + f * 5) % Math.ceil(maxH * 0.5))) * (1 - Math.abs(i - (count - 1) / 2) / count * 0.6));
    for (let y = 0; y < hgt; y++) {
      const t = y / hgt;
      const w = Math.max(0, Math.round((1 - t) * 3 * k));
      for (let x = -w; x <= w; x++) {
        const c = t < 0.22 ? pal('fire', 4) : t < 0.48 ? pal('fire', 3) : t < 0.78 ? pal('fire', 2) : pal('fire', 1);
        const sway = Math.round(Math.sin((y + f * 2 + i) * 0.6) * (t * 2));
        p.set(bx + x + sway, base - y, Math.abs(x) === w && w > 0 ? pal('fire', 1) : c, t > 0.85 ? 0.7 : 1);
      }
    }
  }
}

/**
 * Code-drawn props: only effects (fire, flames). Everything else is painted (PAINTED below, Codex art in
 * public/assets/props/iso-*.png); a missing painting shows a neutral placeholder block.
 */
const RECIPES: Record<string, Recipe> = {
  fire: {
    w: 30, h: 40, ox: 15, oy: 35, frames: 4, fps: 9, light: { color: 0xffa040, radius: 52 },
    paint(p, rnd, f) {
      p.ellipse(15, 35, 11, 3.2, pal('ink', 0), 0.35);
      flames(p, f, 15, 34, 7, 22, 1);
      for (let i = 0; i < 4; i++) p.set(4 + Math.floor(rnd() * 22), 2 + Math.floor(rnd() * 12), pal('fire', 4));
    },
  },
  flames: {
    w: 22, h: 28, ox: 11, oy: 24, frames: 4, fps: 9, light: { color: 0xffa040, radius: 60 },
    paint(p, rnd, f) {
      flames(p, f, 11, 24, 4, 16, 0.8);
      if (rnd() < 0.8) p.set(4 + Math.floor(rnd() * 14), 2 + Math.floor(rnd() * 6), pal('fire', 4));
    },
  },
  placeholder: {
    w: 20, h: 20, ox: 10, oy: 17,
    paint(p) {
      p.ellipse(10, 17, 8, 2.5, pal('ink', 0), 0.35);
      p.rect(4, 5, 12, 12, pal('stone', 2));
      p.rect(5, 6, 10, 2, pal('stone', 3));
      p.outline(OUT(), 0.9);
    },
  },
};

const built = new Map<string, IsoProp>();

/** Tactics prop id → painted iso prop (Codex art in public/assets/props/iso-*.png). */
const PAINTED: Record<string, { asset: string; tall?: boolean; overUnit?: boolean; flame?: boolean; n?: number; oy?: number; foot?: boolean }> = {
  'tree-oak': { asset: 'iso-tree', tall: true, oy: 3 },
  'tree-pine': { asset: 'iso-pine', tall: true, oy: 3 },
  'tree-dead': { asset: 'iso-deadtree', tall: true, oy: 3 },
  bush: { asset: 'iso-bush', overUnit: true, oy: 3 },
  rock: { asset: 'iso-rock', oy: 4 },
  ruin: { asset: 'iso-ruin', tall: true, oy: 5 },
  'banner-light': { asset: 'iso-banner-light', tall: true, oy: 2, foot: true },
  'banner-dark': { asset: 'iso-banner-dark', tall: true, oy: 2, foot: true },
  stump: { asset: 'iso-stump', oy: 3 },
  crate: { asset: 'iso-crate', n: 0, oy: 3 },
  barrel: { asset: 'iso-crate', n: 1, oy: 3 },
  stake: { asset: 'iso-stake', tall: true, oy: 2, foot: true },
  campfire: { asset: 'iso-campfire', flame: true, oy: 4 },
};

/** Painted iso prop if its art exists, else null. */
export function paintedProp(scene: Phaser.Scene, id: string, variant = 0): IsoProp | null {
  const p = PAINTED[id];
  if (!p) return null;
  const vars = tacticsManifest().props[p.asset];
  if (!vars?.length) return null;
  const v = p.n !== undefined ? vars.find(e => e.n === p.n) ?? vars[0] : vars[Math.abs(variant) % vars.length];
  const key = isoPropKey(p.asset, v.n);
  if (!scene.textures.exists(key)) return null;
  return {
    key, w: v.w, h: v.h, ox: p.foot && v.ax !== undefined ? v.ax : Math.round(v.w / 2), oy: v.h - (p.oy ?? 2), tall: p.tall, overUnit: p.overUnit, flame: p.flame,
    light: p.flame ? { color: 0xffa040, radius: 60 } : undefined,
  };
}

/** Ensures a tactics prop texture (painted art when available; code-drawn only for fire/flames) and returns its info. */
export function isoProp(scene: Phaser.Scene, id: string, variant = 0): IsoProp {
  const painted = paintedProp(scene, id, variant);
  if (painted) return painted;
  const r = RECIPES[id] ?? RECIPES.placeholder;
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
    scale: id === 'fire' || id === 'flames' ? 1 : 1.5,
  };
  built.set(key, info);
  return info;
}

export const isoPropIds = () => [...Object.keys(PAINTED), 'fire', 'flames'];

/**
 * Optionally uses the shared art layer's prop (e.g. a tree) when it exists and is not a placeholder.
 * Returns null when the tactics-native prop should be used.
 */
export function sharedProp(scene: Phaser.Scene, id: string, variant = 0): IsoProp | null {
  try {
    if (!G.art.hasAsset('prop', id)) return null;
    const info = G.art.prop(scene, id, variant);
    if (info.key.includes('stub') || info.width < 20) return null;
    return {
      key: info.key, w: info.width, h: info.height, ox: info.originX, oy: info.originY, tall: info.height > 48, anim: info.anim,
      light: info.light ? { color: info.light.color, radius: info.light.radius } : undefined,
    };
  } catch { return null; }
}

/** Painted asset ids of the shared art layer a battle map may use as decoration (loaded via G.art.preload). */
export const isTacticsPropId = (id: string) => id === 'fire' || id === 'flames' || id in PAINTED;

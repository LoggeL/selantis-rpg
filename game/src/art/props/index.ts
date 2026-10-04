import type Phaser from 'phaser';
import type { PropInfo } from '../api';
import { Px } from '../px';
import { Rng, hashString } from '../rng';
import type { PropDef } from './core';
import { NATURE } from './nature';
import { FARM } from './farm';
import { FURNITURE } from './furniture';
import { CAMP } from './camp';
import { MISC } from './misc';

export const PROPS: Record<string, PropDef> = { ...NATURE, ...FARM, ...FURNITURE, ...CAMP, ...MISC };

export function propIds(): string[] { return Object.keys(PROPS); }

/** Renders all frames of a prop variant into Px buffers (pure, testable without Phaser). */
export function renderProp(id: string, variant = 0): { def: PropDef; frames: Px[] } {
  const def = PROPS[id];
  if (!def) throw new Error(`Unknown prop ${id}`);
  const v = Math.abs(variant) % (def.variants ?? 1);
  const n = def.frames ?? 1;
  const frames: Px[] = [];
  for (let f = 0; f < n; f++) {
    const p = new Px(def.w, def.h);
    // same seed for every frame so only the animated parts change
    const ctx = { p, r: new Rng(hashString(`${id}:${v}`)), v, f, frames: n };
    def.draw(ctx);
    if (!def.noOutline) p.outline();
    if (def.post) { ctx.r = new Rng(hashString(`${id}:${v}:post`)); def.post(ctx); }
    if (def.shadow) {
      const [cx, cy, rx, ry, a] = def.shadow;
      p.shadowUnder(cx, cy, rx, ry, a ?? 0.3);
    }
    frames.push(p);
  }
  return { def, frames };
}

const infoCache = new Map<string, PropInfo>();

export function ensureProp(scene: Phaser.Scene, id: string, variant = 0): PropInfo {
  const def = PROPS[id];
  if (!def) {
    console.warn(`[art] unknown prop "${id}", using rock`);
    return ensureProp(scene, 'rock', 0);
  }
  const v = Math.abs(variant) % (def.variants ?? 1);
  const key = `prop:${id}:${v}`;
  const cached = infoCache.get(key);
  if (cached && scene.textures.exists(key)) return cached;
  const { frames } = renderProp(id, v);
  const n = frames.length;
  const info: PropInfo = {
    key,
    width: def.w,
    height: def.h,
    originX: def.ox ?? Math.floor(def.w / 2),
    originY: def.oy ?? def.h - 2,
    footprint: def.footprint === undefined ? { x: -Math.floor(def.w / 2) + 1, y: -4, w: def.w - 2, h: 5 } : def.footprint,
    sway: def.sway,
    light: def.light,
    lights: def.lights,
    anchors: def.anchors,
  };
  if (!scene.textures.exists(key)) {
    if (n === 1) scene.textures.addCanvas(key, frames[0].toCanvas());
    else {
      const sheet = new Px(def.w * n, def.h);
      frames.forEach((fr, i) => sheet.blit(fr, i * def.w, 0));
      scene.textures.addSpriteSheet(key, sheet.toCanvas() as unknown as HTMLImageElement, { frameWidth: def.w, frameHeight: def.h });
    }
  }
  if (n > 1) {
    const anim = `${key}:anim`;
    if (!scene.anims.exists(anim)) {
      scene.anims.create({ key: anim, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: def.fps ?? 8, repeat: -1 });
    }
    info.anim = anim;
  }
  infoCache.set(key, info);
  return info;
}

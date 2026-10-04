import Phaser from 'phaser';
import type { PropInfo } from '../art/api';
import { G } from '../core/G';
import type { PropDef } from './api';
import type { Rect, Vec } from './geom';

export interface PropHost {
  readonly scene: Phaser.Scene;
  addWorld<T extends Phaser.GameObjects.GameObject>(obj: T): T;
}

const fallbackInfo = (scene: Phaser.Scene, id: string): PropInfo => {
  const key = 'w-prop-missing';
  if (!scene.textures.exists(key)) {
    const c = document.createElement('canvas'); c.width = 12; c.height = 12;
    const g = c.getContext('2d')!;
    g.fillStyle = '#b04a8a'; g.fillRect(1, 1, 10, 10); g.fillStyle = '#ffffff'; g.fillRect(5, 3, 2, 4); g.fillRect(5, 8, 2, 2);
    scene.textures.addCanvas(key, c);
  }
  console.warn(`[world] prop '${id}' not available from art`);
  return { key, width: 12, height: 12, originX: 6, originY: 12, footprint: null };
};

/** Looks up art prop info, tolerating unknown ids (warns once and shows a marker). */
export function propInfo(scene: Phaser.Scene, id: string, variant?: number): PropInfo {
  try {
    const info = G.art.prop(scene, id, variant);
    if (info && scene.textures.exists(info.key)) return info;
  } catch { /* fall through */ }
  return fallbackInfo(scene, id);
}

/**
 * A placed prop. Swaying props are rendered as three horizontal slices (static base, middle, top) that shift by
 * whole pixels with the wind, which reads as gentle canopy motion and stays crisp in pixel art.
 */
export class PropObj {
  readonly info: PropInfo;
  readonly parts: (Phaser.GameObjects.Image | Phaser.GameObjects.Sprite)[] = [];
  readonly sway: boolean;
  readonly depth: number;
  private phase: number;
  private shakeT = 0;
  visible = true;

  constructor(readonly host: PropHost, readonly def: PropDef, readonly id: string, readonly x: number, readonly y: number, variant: number | undefined) {
    const scene = host.scene;
    this.info = propInfo(scene, def.prop, def.variant ?? variant);
    const info = this.info;
    this.phase = (x * 0.037 + y * 0.051) % (Math.PI * 2);
    this.depth = def.above ? 60000 + y : y + (def.depthOffset ?? 0);
    const ox = info.originX / info.width, oy = info.originY / info.height;
    this.sway = (def.sway ?? info.sway ?? false) && !info.anim && info.height >= 14;
    if (info.anim && scene.anims.exists(info.anim)) {
      const s = host.addWorld(scene.add.sprite(x, y, info.key).setOrigin(ox, oy));
      // Desynchronise identical animated props (trees swaying, fires) with a position-based start frame.
      const frames = scene.anims.get(info.anim)?.frames.length ?? 1;
      s.play({ key: info.anim, startFrame: Math.floor(((x * 7 + y * 13) % 97) / 97 * frames) % Math.max(1, frames) });
      this.parts.push(s);
    } else if (this.sway) {
      // slices: [0, a) top, [a, b) middle, [b, h) base
      const h = info.height;
      const a = Math.round(h * 0.42), b = Math.round(h * 0.7);
      for (const [y0, y1] of [[b, h], [a, b], [0, a]]) {
        const img = host.addWorld(scene.add.image(x, y, info.key).setOrigin(ox, oy));
        img.setCrop(0, y0, info.width, y1 - y0);
        this.parts.push(img);
      }
    } else {
      this.parts.push(host.addWorld(scene.add.image(x, y, info.key).setOrigin(ox, oy)));
    }
    this.parts.forEach((p, i) => {
      p.setDepth(this.depth + i * 0.001);
      if (def.flipX) p.setFlipX(true);
      if (def.tint !== undefined) p.setTint(def.tint);
      if (def.alpha !== undefined) p.setAlpha(def.alpha);
    });
  }

  get image(): Phaser.GameObjects.Image | Phaser.GameObjects.Sprite { return this.parts[0]; }

  /** Collision footprint in world px (null = none). Respects flipX. */
  footprint(): Rect | null {
    const fp = this.info.footprint;
    if (!fp) return null;
    const x = this.def.flipX ? -fp.x - fp.w : fp.x;
    return { x: this.x + x, y: this.y + fp.y, w: fp.w, h: fp.h };
  }

  /** Full image bounds in world px. */
  bounds(): Rect {
    const i = this.info;
    const left = this.def.flipX ? this.x - (i.width - i.originX) : this.x - i.originX;
    return { x: left, y: this.y - i.originY, w: i.width, h: i.height };
  }

  /** Area where a crouching player counts as hidden (lower part of the image). */
  hideArea(): Rect {
    const b = this.bounds();
    const top = b.y + b.h * 0.3;
    return { x: b.x + 1, y: top, w: Math.max(4, b.w - 2), h: this.y + 5 - top };
  }

  get top(): Vec { const b = this.bounds(); return { x: this.x, y: b.y }; }

  shake(strength = 1): void { this.shakeT = Math.max(this.shakeT, strength); }

  setVisible(on: boolean): void { this.visible = on; for (const p of this.parts) p.setVisible(on); }

  setAlpha(a: number): void { const base = this.def.alpha ?? 1; for (const p of this.parts) p.setAlpha(base * a); }

  update(t: number, dt: number, wind: number): void {
    if (!this.sway && this.shakeT <= 0) return;
    const shake = this.shakeT > 0 ? Math.sin(t * 38) * 1.6 * this.shakeT : 0;
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt * 2.2);
    const gust = 0.55 + wind * 1.5;
    const s = Math.sin(t * 1.5 + this.phase) * 0.7 + Math.sin(t * 2.7 + this.phase * 1.7) * 0.3;
    if (this.sway) {
      const top = Math.round(s * gust + shake);
      const mid = Math.round(Math.sin(t * 1.5 + this.phase - 0.5) * gust * 0.45 + shake * 0.6);
      const base = Math.round(shake * 0.35);
      this.parts[0].x = this.x + base;
      this.parts[1].x = this.x + mid;
      this.parts[2].x = this.x + top;
    } else {
      for (const p of this.parts) p.x = this.x + Math.round(shake);
    }
  }

  destroy(): void { for (const p of this.parts) p.destroy(); }
}

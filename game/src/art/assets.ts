import type Phaser from 'phaser';
import { assetUrl } from './manifest';

/**
 * Image loading + "upgradable" canvas textures.
 *
 * Every asset texture is a Phaser CanvasTexture with the final geometry and frames. It starts with placeholder
 * art and is redrawn in place (refresh()) as soon as the painted PNG has loaded. That keeps character()/prop()/
 * background() synchronous and correct even before preload() resolved: sprites created early simply switch
 * to the painted art once it arrives. preload() awaits the same promises.
 */

const images = new Map<string, Promise<HTMLImageElement | null>>();

export function loadImage(file: string): Promise<HTMLImageElement | null> {
  const url = assetUrl(file);
  let p = images.get(url);
  if (!p) {
    p = new Promise(resolve => {
      if (typeof Image === 'undefined') { resolve(null); return; }
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => { console.warn(`[art] could not load ${url}`); resolve(null); };
      img.src = url;
    });
    images.set(url, p);
  }
  return p;
}

export interface FrameGrid { w: number; h: number; count: number; cols: number }

const upgrades = new Map<string, Promise<void>>();

/** Promise that resolves when the texture `key` shows its painted source (or failed to load). */
export function whenReady(key: string): Promise<void> {
  return upgrades.get(key) ?? Promise.resolve();
}

/**
 * Creates (once) a canvas texture `key` of size w×h with the given frame grid, draws `placeholder` into it and,
 * if `file` is given, replaces the content with the loaded image (optionally mirrored per frame).
 */
export function upgradableTexture(textures: Phaser.Textures.TextureManager, key: string, w: number, h: number,
  grid: FrameGrid | null, placeholder: HTMLCanvasElement | null, file?: string, flip = false): Phaser.Textures.Texture {
  if (textures.exists(key)) return textures.get(key);
  const tex = textures.createCanvas(key, w, h)!;
  if (grid) {
    for (let i = 0; i < grid.count; i++) {
      tex.add(i, 0, (i % grid.cols) * grid.w, Math.floor(i / grid.cols) * grid.h, grid.w, grid.h);
    }
  }
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  if (placeholder) ctx.drawImage(placeholder, 0, 0);
  tex.refresh();
  if (file) {
    upgrades.set(key, loadImage(file).then(img => {
      if (!img || !textures.exists(key)) return;
      ctx.clearRect(0, 0, w, h);
      if (flip && grid) {
        for (let i = 0; i < grid.count; i++) {
          const fx = (i % grid.cols) * grid.w;
          const fy = Math.floor(i / grid.cols) * grid.h;
          ctx.save();
          ctx.translate(fx + grid.w, fy);
          ctx.scale(-1, 1);
          ctx.drawImage(img, fx, fy, grid.w, grid.h, 0, 0, grid.w, grid.h);
          ctx.restore();
        }
      } else if (flip) {
        ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, h); ctx.restore();
      } else {
        ctx.drawImage(img, 0, 0, w, h);
      }
      tex.refresh();
    }));
  }
  return tex;
}

/** Warms the browser cache for DOM-shown images (plates, portraits). */
export function warm(file: string): Promise<void> {
  return loadImage(file).then(() => undefined);
}

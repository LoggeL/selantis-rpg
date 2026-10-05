import type Phaser from 'phaser';
import { GAME_H, GAME_W } from '../../core/viewport';
import { skyKey } from './assets';

export type Backdrop = 'dusk' | 'night' | 'day' | 'forest';

/** Global tint applied to the battlefield per backdrop (multiplied). */
export const BACKDROP_TINT: Record<Backdrop, number> = {
  dusk: 0xffe6d2,
  night: 0x8f9ed6,
  day: 0xffffff,
  forest: 0xc4d2bc,
};

/**
 * Static sky + horizon behind the diorama (screen space): the painted backdrop (Codex art,
 * public/assets/tactics/sky-<kind>.png) when loaded, else a plain gradient.
 */
export function buildBackdrop(scene: Phaser.Scene, kind: Backdrop): Phaser.GameObjects.Image {
  if (scene.textures.exists(skyKey(kind))) {
    return scene.add.image(GAME_W / 2, GAME_H / 2, skyKey(kind)).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(-100000)
      .setDisplaySize(GAME_W, GAME_H);
  }
  // Fallback while/if the painting is missing: a plain vertical gradient in the backdrop's mood.
  const key = `tac-backdrop-${kind}`;
  if (!scene.textures.exists(key)) {
    const c = document.createElement('canvas');
    c.width = GAME_W; c.height = GAME_H;
    const g = c.getContext('2d')!;
    const stops: Record<Backdrop, string[]> = {
      dusk: ['#171a30', '#383a63', '#a0503c', '#ec8a2c'], night: ['#0d0e1c', '#171a30', '#252847', '#0d0e1c'],
      forest: ['#171a30', '#1f3a3a', '#24524a', '#0d0e1c'], day: ['#3f86bc', '#69abd2', '#a6d8e6', '#556b3a'],
    };
    const grad = g.createLinearGradient(0, 0, 0, GAME_H);
    stops[kind].forEach((col, i, all) => grad.addColorStop(i / (all.length - 1), col));
    g.fillStyle = grad;
    g.fillRect(0, 0, GAME_W, GAME_H);
    scene.textures.addCanvas(key, c);
  }
  return scene.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(0).setDepth(-100000);
}

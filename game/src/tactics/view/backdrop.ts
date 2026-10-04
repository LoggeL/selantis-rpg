import type Phaser from 'phaser';
import { GAME_H, GAME_W } from '../../core/viewport';
import { mix, pal } from './palette';
import { Pix, artRng, bayer } from './pixels';

export type Backdrop = 'dusk' | 'night' | 'day' | 'forest';

/** Global tint applied to the battlefield per backdrop (multiplied). */
export const BACKDROP_TINT: Record<Backdrop, number> = {
  dusk: 0xffe6d2,
  night: 0xa9b6e8,
  day: 0xffffff,
  forest: 0xd6e2cf,
};

/** Paints a static parallax-free sky + horizon behind the diorama (screen space). */
export function buildBackdrop(scene: Phaser.Scene, kind: Backdrop): Phaser.GameObjects.Image {
  const key = `tac-backdrop-${kind}`;
  if (!scene.textures.exists(key)) {
    const p = new Pix(GAME_W, GAME_H);
    const rnd = artRng(kind.length * 97 + 5);
    const sky: [number, number][] = kind === 'dusk'
      ? [[0, pal('night', 1)], [0.35, pal('night', 3)], [0.62, mix(pal('violet', 3), pal('red', 4), 0.45)], [0.8, pal('orange', 3)], [1, pal('fire', 3)]]
      : kind === 'night'
        ? [[0, pal('night', 0)], [0.5, pal('night', 1)], [1, pal('night', 3)]]
        : kind === 'forest'
          ? [[0, pal('night', 1)], [0.5, mix(pal('night', 2), pal('pine', 2), 0.5)], [1, mix(pal('pine', 2), pal('night', 3), 0.3)]]
          : [[0, pal('sky', 2)], [0.6, pal('sky', 3)], [1, pal('sky', 4)]];
    const at = (t: number) => {
      for (let i = 1; i < sky.length; i++) if (t <= sky[i][0]) {
        const [t0, c0] = sky[i - 1], [t1, c1] = sky[i];
        return mix(c0, c1, (t - t0) / (t1 - t0));
      }
      return sky[sky.length - 1][1];
    };
    const horizon = GAME_H * 0.62;
    for (let y = 0; y < GAME_H; y++) {
      for (let x = 0; x < GAME_W; x++) {
        const t = Math.min(1, y / horizon);
        // banded dithering between two neighbouring sky steps for a pixel-art gradient
        const q = 14;
        const tq = Math.floor(t * q) / q, tn = Math.min(1, tq + 1 / q);
        const f = (t - tq) * q;
        p.set(x, y, f > bayer(x, y) ? at(tn) : at(tq));
      }
    }
    if (kind === 'night' || kind === 'forest' || kind === 'dusk') {
      for (let i = 0; i < (kind === 'dusk' ? 40 : 110); i++) {
        const x = Math.floor(rnd() * GAME_W), y = Math.floor(rnd() * horizon * (kind === 'dusk' ? 0.45 : 0.85));
        p.set(x, y, rnd() < 0.2 ? 0xffffff : pal('night', 5), 0.5 + rnd() * 0.5);
      }
    }
    if (kind === 'dusk') {
      // Low sun glow and smoke columns of the lost battle.
      p.ellipse(GAME_W * 0.78, horizon + 6, 46, 18, pal('fire', 4), 0.18);
      p.ellipse(GAME_W * 0.78, horizon + 4, 18, 9, pal('fire', 4), 0.45);
      for (const sx of [0.12, 0.3, 0.88]) {
        let x = GAME_W * sx;
        for (let y = horizon + 6; y > 30; y -= 2) {
          x += Math.sin(y * 0.05 + sx * 10) * 0.9 + 0.35;
          const w = 3 + (horizon - y) * 0.06;
          p.ellipse(x, y, w, 2.4, mix(pal('night', 2), pal('ash', 2), 0.4), 0.18 + (y / horizon) * 0.12);
        }
      }
    }
    // Layered horizon silhouettes.
    const layers = kind === 'forest' || kind === 'night'
      ? [{ base: horizon - 30, amp: 10, col: mix(pal('night', 2), pal('pine', 1), 0.4), trees: true }, { base: horizon - 6, amp: 8, col: mix(pal('night', 1), pal('pine', 0), 0.5), trees: true }]
      : [{ base: horizon - 20, amp: 14, col: mix(at(0.75), pal('night', 2), 0.55), trees: false }, { base: horizon - 2, amp: 9, col: mix(pal('night', 2), pal('violet', 1), 0.35), trees: true }];
    for (const L of layers) {
      const phase = rnd() * 10;
      for (let x = 0; x < GAME_W; x++) {
        let top = L.base - Math.sin(x * 0.013 + phase) * L.amp - Math.sin(x * 0.041 + phase * 2) * L.amp * 0.35;
        if (L.trees) {
          const tx = x % 9;
          const tall = (Math.floor(x / 9) * 7919) % 5;
          top -= Math.max(0, 6 + tall - Math.abs(tx - 4) * (2 + (tall % 2))) ;
        }
        for (let y = Math.max(0, Math.floor(top)); y < GAME_H; y++) p.set(x, y, L.col);
      }
    }
    // Lower area fades into deep night so the diorama floats.
    for (let y = Math.floor(horizon); y < GAME_H; y++) for (let x = 0; x < GAME_W; x++) {
      const t = (y - horizon) / (GAME_H - horizon);
      if (bayer(x, y) < t * 0.9) p.set(x, y, pal('night', 0));
    }
    scene.textures.addCanvas(key, p.toCanvas());
  }
  return scene.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(0).setDepth(-100000);
}

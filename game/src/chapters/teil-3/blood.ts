// Teil III: blood where the story is about violence (docs/teil-3/umsetzung.md, Vorrang (1)): a hard red hit flash with
// shake, sound and droplets, and a dark pool that spreads under a body that falls. Same idea as the planned
// chapters/common/blood.ts, kept local because that file is not on main yet; everything is drawn in code (no prop).
// Use it for the few moments the plot is about (Vamir's blow on Ignatius, the men seizing Lia in the trap), never as
// decoration and never for torture. The battle side (tactics scene) lives in battle-shared.battleBlood.
import type Phaser from 'phaser';
import type { WorldCtx } from '../../world';
import { sfx } from './shared';

/** Fresh blood (flash, droplets) and the dark red of a pool on the ground. */
export const BLOOD_RED = 0x8a1a22;
export const BLOOD_DARK = 0x4a0d12;

type Pt = readonly [number, number];
type WorldScene = Phaser.Scene & { addWorld?<T extends Phaser.GameObjects.GameObject>(o: T): T };

/** Just above the actors' contact shadows (world/actor.ts SHADOW_DEPTH −200), below every figure. */
const POOL_DEPTH = -190;

function scene(w: WorldCtx): WorldScene | null {
  try { return w.alive ? w.scene as WorldScene : null; } catch { return null; }
}

/** Droplet directions: a fixed fan, so a reload shows the same picture. */
const FAN: readonly [number, number][] = [
  [-1, -0.9], [0.7, -1.2], [1.3, -0.6], [-1.4, -0.4], [0.2, -1.5], [-0.5, -1.3], [1.1, -1.0], [-0.9, -1.1], [0.5, -0.7], [-0.2, -0.9],
];

export interface BloodHitOptions {
  /** 0.5 a hard shove or blow, 1 a hit that knocks someone down. */
  strength?: number;
  /** Droplets (0 = flash, shake and sound only). Defaults to 6 + 6 × strength. */
  drops?: number;
  /** Floor y the droplets fall to (map px); defaults to 26 px below `at`. */
  floorY?: number;
  /** Hit sound (default 'hit-heavy'); false for none. */
  sound?: false | 'hit' | 'hit-heavy';
}

/**
 * A hard hit at `at` (chest height, map px): a dark red full-screen flash, a camera shake, the hit sound and a few
 * droplets that arc out and fall to the floor, where they stay as small dark specks.
 */
export function bloodHit(w: WorldCtx, at: Pt, opts: BloodHitOptions = {}): void {
  const strength = opts.strength ?? 1;
  try {
    w.lighting.flash(BLOOD_RED, Math.round(160 + 120 * strength));
    w.camera.shake(Math.round(180 + 140 * strength), 0.003 + 0.004 * strength);
    w.camera.punch(0.05 * strength);
  } catch { /* camera optional */ }
  if (opts.sound !== false) sfx(opts.sound ?? 'hit-heavy', { volume: 0.55 + 0.3 * strength });
  const s = scene(w);
  if (!s) return;
  const n = Math.max(0, Math.round(opts.drops ?? 6 + 6 * strength));
  const floor = opts.floorY ?? at[1] + 26;
  for (let i = 0; i < n; i++) {
    const [dx, dy] = FAN[i % FAN.length];
    const r = i % 3 === 0 ? 1.8 : 1.2;
    const reach = 14 + 10 * strength + (i % 4) * 3;
    const drop = s.add.circle(at[0], at[1], r, i % 2 ? BLOOD_RED : BLOOD_DARK, 1).setDepth(floor + 2);
    s.addWorld?.(drop);
    const tx = at[0] + dx * reach, apex = at[1] + dy * reach * 0.7;
    const landY = floor + (i % 5) * 2 - 4;
    // Up and out, then down to the floor (two tweens: a short arc without physics).
    s.tweens.add({
      targets: drop, x: tx, y: apex, duration: 160 + (i % 3) * 30, ease: 'Quad.easeOut',
      onComplete: () => {
        s.tweens.add({
          targets: drop, x: tx + dx * 4, y: landY, duration: 240 + (i % 4) * 40, ease: 'Quad.easeIn',
          onComplete: () => { drop.setScale(1.6, 0.7).setDepth(POOL_DEPTH + 1).setAlpha(0.85); },
        });
      },
    });
  }
}

export interface BloodPoolOptions {
  /** Final size (1 ≈ a body-length stain under a lying figure). */
  scale?: number;
  /** Spreading time in ms (0 = at once). */
  ms?: number;
}

/**
 * A dark pool spreading on the floor at `at` (map px, where the body lies). Irregular, built from a few overlapping
 * ellipses; it stays until the map visit ends.
 */
export function bloodPool(w: WorldCtx, at: Pt, opts: BloodPoolOptions = {}): void {
  const s = scene(w);
  if (!s) return;
  const scale = opts.scale ?? 1;
  const g = s.add.graphics().setDepth(POOL_DEPTH).setPosition(at[0], at[1]);
  s.addWorld?.(g);
  g.fillStyle(BLOOD_DARK, 0.95);
  g.fillEllipse(0, 0, 44, 15);
  g.fillEllipse(-14, 3, 22, 10);
  g.fillEllipse(15, -2, 20, 9);
  g.fillStyle(BLOOD_RED, 0.55);
  g.fillEllipse(-3, -1, 24, 7);
  const ms = opts.ms ?? 0;
  if (ms <= 0) { g.setScale(scale); return; }
  g.setScale(scale * 0.12).setAlpha(0.7);
  s.tweens.add({ targets: g, scaleX: scale, scaleY: scale, alpha: 1, duration: ms, ease: 'Sine.easeOut' });
}

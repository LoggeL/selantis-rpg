// Turquoise apparitions and light points for Teil III (code-drawn effects only, no new character art).
//  - apparition(): Valentus as the existing 'valentus' figure, tinted turquoise, translucent and slightly floating, with
//    a soft halo, a small Urmacht light and the odd rising mote. Like the pale figure on e2-herbsthang (teil-2/
//    aufbruch.ts) it draws on top of the world scene; here it restyles a real NPC so he can walk, face and talk.
//  - lightPoints(): small glowing points (the trail of e3-valentus, the light spirits of e3-eigener-stab).
// Turquoise belongs to the Urmacht and to Valentus' apparition only (umsetzung.md §1).
import type Phaser from 'phaser';
import type { WorldCtx } from '../../world';
import { AMBER, TURQUOISE } from './shared';

type WorldSceneLike = Phaser.Scene & {
  addWorld?<T extends Phaser.GameObjects.GameObject>(o: T): T;
  addOverlay?<T extends Phaser.GameObjects.GameObject>(o: T): T;
  /** The engine's actor registry (read defensively: only the ground shadow is touched). */
  actors?: Map<string, { shadow?: Phaser.GameObjects.Image }>;
};

/** Multiplied into the sprite: keeps the drawing readable, turns the colours pale sea-glass. */
const APPARITION_TINT = 0xb4fff6;
const ADD = 1; // Phaser.BlendModes.ADD

export interface Apparition {
  readonly alpha: number;
  /** Fades the figure (and its halo and light) to `alpha` over `ms`. */
  fadeTo(alpha: number, ms: number): Promise<void>;
  /** A last burst of motes, then gone (alpha 0; the NPC stays and can be despawned). */
  dissolve(ms?: number): Promise<void>;
  dispose(): void;
}

/**
 * Restyles the NPC `id` as a limited apparition. Starts invisible unless `alpha` is given. Everything is undone when
 * the world scene shuts down.
 */
export interface ApparitionStyle {
  /** Glow, halo and light colour (default turquoise: Valentus and the Urmacht only). */
  color?: number;
  /** Multiplied into the sprite. */
  tint?: number;
  /** Rising motes. */
  motes?: 'urmacht' | 'sparkle';
}

/** Ignatius after his death: the same apparition in his warm amber, never turquoise. */
export const AMBER_GHOST: ApparitionStyle = { color: AMBER, tint: 0xffe6bc, motes: 'sparkle' };

export function apparition(w: WorldCtx, id: string, alpha = 0, style: ApparitionStyle = {}): Apparition {
  const color = style.color ?? TURQUOISE, tint = style.tint ?? APPARITION_TINT, motes = style.motes ?? 'urmacht';
  const scene = w.scene as WorldSceneLike;
  const actor = w.actor(id);
  let cur = alpha, from = alpha, to = alpha, elapsed = 0, dur = 0;
  let settle: (() => void) | null = null;
  let time = 0, moteAcc = 0, disposed = false;
  const halo = scene.add.image(actor.x, actor.y, 'w-glow').setBlendMode(ADD).setTint(color).setAlpha(0).setScale(1.25, 1.6);
  scene.addWorld?.(halo);
  // An additive turquoise copy of the current frame over the figure: the light seems to come from inside him.
  let glowCopy: Phaser.GameObjects.Image | null = null;
  const light = w.lighting.add({ id: `e3-schein-${id}`, at: [actor.x, actor.y - 24], kind: 'urmacht', color, radius: 52, intensity: 0, always: true });

  const onPost = (_t: number, delta: number) => {
    const dt = Math.min(0.1, delta / 1000);
    time += dt;
    if (dur > 0) {
      elapsed += delta;
      const k = Math.min(1, elapsed / dur);
      cur = from + (to - from) * k;
      if (k >= 1) { dur = 0; const s = settle; settle = null; s?.(); }
    }
    const sprite = actor.exists ? actor.sprite : undefined;
    if (!sprite) { halo.setAlpha(0); glowCopy?.setAlpha(0); return; }
    const lift = 4 + Math.sin(time * 1.7) * 2.5;
    const pulse = 0.86 + 0.14 * Math.sin(time * 2.6);
    sprite.setTint(tint);
    sprite.setAlpha(cur * pulse * (sprite.visible ? 1 : 0));
    sprite.y = actor.y - lift;
    if (!glowCopy) {
      glowCopy = scene.add.image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name).setBlendMode(ADD).setTintFill(color);
      scene.addWorld?.(glowCopy);
    }
    glowCopy.setTexture(sprite.texture.key, sprite.frame.name).setOrigin(sprite.originX, sprite.originY)
      .setScale(sprite.scaleX, sprite.scaleY).setFlipX(sprite.flipX).setPosition(sprite.x, sprite.y)
      .setDepth(sprite.depth + 0.1).setVisible(sprite.visible).setAlpha(0.3 * cur * pulse);
    scene.actors?.get(id)?.shadow?.setAlpha(0.12 * cur);
    halo.setPosition(actor.x, actor.y - 24 - lift).setDepth(sprite.depth - 0.5).setAlpha(0.32 * cur);
    light.set({ at: [actor.x, actor.y - 26], intensity: 0.85 * cur });
    moteAcc += dt * 4 * cur;
    if (moteAcc >= 1) {
      moteAcc = 0;
      w.fx.burst([actor.x + (Math.random() - 0.5) * 18, actor.y - 8 - Math.random() * 40], motes, 1);
    }
  };
  scene.events.on('postupdate', onPost);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scene.events.off('postupdate', onPost);
    halo.destroy();
    glowCopy?.destroy();
    try { light.remove(); } catch { /* scene gone */ }
    const sprite = actor.exists ? actor.sprite : undefined;
    sprite?.clearTint();
  };
  scene.events.once('shutdown', dispose);

  const fadeTo = (alpha: number, ms: number) => new Promise<void>(resolve => {
    settle?.();
    from = cur; to = alpha; elapsed = 0; dur = Math.max(1, ms);
    settle = resolve;
  });

  return {
    get alpha() { return cur; },
    fadeTo,
    async dissolve(ms = 1400) {
      w.fx.burst([actor.x, actor.y - 30], motes, 18);
      w.fx.burst([actor.x, actor.y - 10], motes, 10);
      await fadeTo(0, ms);
    },
    dispose,
  };
}

export interface LightPoints {
  /** Places point i at (x, y) with brightness a (0..1). */
  set(i: number, x: number, y: number, a: number): void;
  readonly count: number;
  dispose(): void;
}

/**
 * `n` small turquoise points: a bright core and an additive halo each. On the overlay camera when the scene has one
 * (so the Spurenblick's grey filter does not dim them), above the scenery.
 */
export function lightPoints(w: WorldCtx, n: number, size = 1): LightPoints {
  const scene = w.scene as WorldSceneLike;
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    if (scene.addOverlay) return scene.addOverlay(o);
    return scene.addWorld ? scene.addWorld(o) : o;
  };
  const pts = Array.from({ length: n }, () => ({
    halo: add(scene.add.image(0, 0, 'w-glow').setBlendMode(ADD).setTint(TURQUOISE).setDepth(4400).setScale(0.42 * size).setAlpha(0)),
    core: add(scene.add.image(0, 0, 'w-mote').setBlendMode(ADD).setTint(0xd8fff8).setDepth(4401).setScale(size).setAlpha(0)),
  }));
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const p of pts) { p.halo.destroy(); p.core.destroy(); }
  };
  scene.events.once('shutdown', dispose);
  return {
    count: n,
    set(i, x, y, a) {
      const p = pts[i];
      if (!p || disposed) return;
      p.halo.setPosition(x, y).setAlpha(Math.min(1, 0.8 * a));
      p.core.setPosition(x, y).setAlpha(a);
    },
    dispose,
  };
}

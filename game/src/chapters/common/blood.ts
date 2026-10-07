// Blood in story cutscenes (docs/teil-2/umsetzung.md §1 „Gewalt“): a dark red hit flash with droplets, and a pool that
// spreads on the floor under a body. The pool is the Codex prop `blutlache` (scripts/art/props.py); without the asset
// only flash and droplets show. Violence serves the story: use it for the moments the plot is about, not as decoration.
import { G } from '../../core/G';
import type { WorldCtx } from '../../world';

export const BLOOD_PROP = 'blutlache';
export const BLOOD_RED = 0x8a1a22;

type Pt = readonly [number, number];

/** Loads the pool texture early, so it never shows the placeholder frame when it appears. */
export function preloadBlood(w: WorldCtx): void {
  if (G.art.hasAsset('prop', BLOOD_PROP)) void G.art.preload(w.scene, { props: [BLOOD_PROP] }).catch(() => { /* optional */ });
}

/** A blade or club hits a body at `at` (chest/head height in map px): red flash, droplets, camera shake. */
export function bloodHit(w: WorldCtx, at: Pt, strength = 1): void {
  w.lighting.flash(BLOOD_RED, Math.round(140 + 90 * strength));
  w.camera.shake(Math.round(160 + 120 * strength), 0.002 + 0.003 * strength);
  w.fx.burst([at[0], at[1]], 'blood', Math.round(6 + 8 * strength));
}

/**
 * A pool of blood centred on `at` (floor, map px). `scale` is the final size (1 ≈ a stab wound under a torso),
 * `ms` > 0 lets it spread slowly. It stays until the map visit ends (not remembered by the map).
 */
export function bloodPool(w: WorldCtx, at: Pt, opts: { id?: string; scale?: number; ms?: number } = {}): void {
  if (!G.art.hasAsset('prop', BLOOD_PROP)) return;
  const prop = w.addProp({ id: opts.id, prop: BLOOD_PROP, at: [at[0], at[1]], collide: false, blocksView: false, depthOffset: -48 });
  const img = prop.image;
  if (!img) return;
  const scale = opts.scale ?? 1;
  img.setOrigin(0.5, 0.5);
  const ms = opts.ms ?? 0;
  if (ms <= 0) { img.setScale(scale); return; }
  img.setScale(scale * 0.15).setAlpha(0.75);
  w.scene.tweens.add({ targets: img, scale, alpha: 1, duration: ms, ease: 'Sine.easeOut' });
}

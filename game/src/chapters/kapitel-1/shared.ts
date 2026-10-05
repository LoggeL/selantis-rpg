// Kapitel I helpers: scene-safe UI access, audio shortcuts, carried props and the state each scene expects on a warp.
import type Phaser from 'phaser';
import type { AmbienceLayer, SfxName, SfxOptions } from '../../audio/api';
import { G } from '../../core/G';
import { findScene } from '../../core/registry';
import type { UiApiExt } from '../../ui';
import type { WorldCtx } from '../../world';

export const ui = (): UiApiExt => G.ui as UiApiExt;

/** Audio is optional (locked before the first input, muted in tests): never let it break a script. */
export function sfx(name: SfxName, opts?: SfxOptions): void {
  try { G.audio.sfx(name, opts); } catch { /* audio optional */ }
}
export function ambience(layers: AmbienceLayer[], fadeMs = 1600): void {
  try { G.audio.ambience(layers, { fadeMs }); } catch { /* audio optional */ }
}
export function music(mood: Parameters<typeof G.audio.music>[0]): void {
  try { G.audio.music(mood); } catch { /* audio optional */ }
}

/**
 * Draws a prop in an actor's hands while it walks (a stone in Lia's arms, Kyra's firewood).
 * Returns a remover. Position, scale and depth follow the actor, including when facing away.
 */
export async function carry(w: WorldCtx, actorId: string, propId: string, dy = -14, scale = 1): Promise<() => void> {
  const scene = w.scene;
  await G.art.preload(scene, { props: [propId] });
  if (!w.alive) return () => {};
  const info = G.art.prop(scene, propId);
  const img = scene.add.image(0, 0, info.key).setOrigin(info.originX / info.width, info.originY / info.height);
  const actor = w.actor(actorId);
  const update = () => {
    const s = actor.sprite;
    if (!s || !img.active) return;
    const dx = actor.dir === 'left' ? -5 : actor.dir === 'right' ? 5 : 0;
    img.setPosition(Math.round(s.x + dx * s.scaleX), Math.round(s.y + dy * s.scaleY));
    img.setScale(scale * s.scaleX, scale * s.scaleY);
    img.setDepth(s.depth + (actor.dir === 'up' ? -0.6 : 0.6));
    img.setAlpha(s.alpha);
    img.setVisible(s.visible);
  };
  update();
  scene.events.on('update', update);
  const remove = () => { scene.events.off('update', update); if (img.active) img.destroy(); };
  scene.events.once('shutdown', remove);
  return remove;
}

/** A soft red-black veil over the canvas for the hardest beats (shown with the DOM fade so it stays tasteful). */
export async function veil(ms = 700): Promise<void> {
  await G.ui.fade('out', ms, '#1a0606');
}

/** Goes to a scene of another chapter when it exists, otherwise back to the title (chapters are built in parallel). */
export async function gotoOrTitle(id: string): Promise<void> {
  if (findScene(id)) { await G.goto(id); return; }
  console.warn(`[kapitel-1] scene ${id} is not available yet`);
  await G.ui.narrate('Fortsetzung folgt …', { style: 'card' });
  const m = await import('../../scenes/BootScene');
  await m.showTitle();
}

/** Canvas-space position of a map point (for DOM bubbles). */
export function toCanvas(scene: Phaser.Scene, x: number, y: number): { x: number; y: number } {
  const cam = scene.cameras.main;
  return { x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom };
}

// ---------------------------------------------------------------------------------------------------------------
// State a direct warp (?scene=…) needs, cumulative in story order.
// ---------------------------------------------------------------------------------------------------------------

export function stateWiese(): void {
  G.state.setParty([]);
}

export function stateHeimweg(): void {
  stateWiese();
  G.state.give('book-alana');
  G.state.set('k1-buch-aufgehoben');
  G.state.set('k1-versprochen');
  G.state.addLore('lore-alana');
  G.state.addLore('lore-nach-dunkelhain');
  G.state.objective('k1-heim', 'Geh nach Hause und füttere die Schweine.');
}

export function stateUeberfall(): void {
  stateHeimweg();
  G.state.learn('spurenblick');
  G.state.set('k1-heimweg-route', 'hohlweg');
  G.state.addClue('k1-hufspuren');
  G.state.complete('k1-heim');
}

export function stateTrauer(): void {
  stateUeberfall();
  G.state.learn('schleichen');
  G.state.take('book-alana');
  G.state.set('k1-buch-verloren');
  G.state.addLore('lore-dunkelschatten');
}

/**
 * Evening dimmer: a screen-fixed multiply veil over the world (code-drawn effect), for the light that sinks
 * „dramatisch“ as Lia nears the farm. Engine 'dusk' only warms the image; this adds the falling darkness.
 */
export function dimmer(w: WorldCtx, alpha: number, ms = 0): void {
  const scene = w.scene;
  type Veil = Phaser.GameObjects.Rectangle;
  let veil = scene.data?.get('k1-dimmer') as Veil | undefined;
  if (!veil || !veil.active) {
    veil = scene.add.rectangle(-1500, -1500, 4000, 4000, 0x3a2a5a, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(8000).setAlpha(0);
    veil.setBlendMode(2 /* MULTIPLY */); // world camera only: the overlay camera ignores objects created in the world scene
    scene.data.set('k1-dimmer', veil);
    scene.events.once('shutdown', () => { scene.data?.remove('k1-dimmer'); });
  }
  // Multiply with a dark violet: alpha 0 = no change. Fill alpha is the strength.
  veil.setFillStyle(0x3a2a5a, 1);
  if (ms <= 0) veil.setAlpha(alpha);
  else scene.tweens.add({ targets: veil, alpha, duration: ms, ease: 'Sine.easeInOut' });
}

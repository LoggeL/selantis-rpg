// The look and sound of Lia's inner refuge (code-drawn effects only, no new art): it must read as consciousness, not
// as a place one travels to (umsetzung.md §3, handoff: „deutlich erkennbare Bewusstseinsebene“).
//  - innerFog(): a breathing lavender vignette and soft fog drifting along the screen edges (overlay camera), dense fog
//    patches over the parts of the meadow not yet remembered (world, lifted one by one), soft warm lights for the
//    bright places, a slow muffled heartbeat instead of music.
//  - rememberedFigure(): a remembered person as a pale, warm, translucent figure that fades in and out.
//  - outsideVoices(): voices from outside, without a picture: blurred lines drifting in at the top of the screen over
//    the meadow (DOM, like Teil II's dream panel, but transparent), timed; a key press or tap hurries them.
// Never turquoise (that belongs to the Urmacht and Valentus) and never violet (Vamir): lavender-grey and warm white.
import type Phaser from 'phaser';
import { G } from '../../core/G';
import { GAME_H, GAME_W } from '../../core/viewport';
import { ctx } from '../../ui/context';
import type { ActorHandle, WorldCtx } from '../../world';
import type { OutsideLine } from './innere-zuflucht-welt';
import { ui } from './shared';

type WorldSceneLike = Phaser.Scene & {
  addWorld?<T extends Phaser.GameObjects.GameObject>(o: T): T;
  addOverlay?<T extends Phaser.GameObjects.GameObject>(o: T): T;
};

const FOG_TINT = 0xd6cbec;
const EDGE_TINT = 0xb9acd6;
const WARM = 0xfff1cf;
const ADD = 1; // Phaser.BlendModes.ADD

/** A soft white blob (radial gradient) generated once; tinted for fog. */
const SOFT = 'e3-nebel-weich';
function ensureSoftBlob(scene: Phaser.Scene): void {
  if (scene.textures.exists(SOFT) || typeof document === 'undefined') return;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  scene.textures.addCanvas(SOFT, c);
}

/** Blobs of one fog patch: offset (fraction of half the patch size) and size (fraction of the patch). */
const PATCH_BLOBS: readonly (readonly [number, number, number])[] = [
  [0, 0, 0.95], [-0.45, -0.2, 0.7], [0.45, 0.15, 0.7], [-0.2, 0.4, 0.65], [0.25, -0.4, 0.6], [0.55, -0.35, 0.5], [-0.55, 0.35, 0.5],
];
/** Blobs along the screen border (screen px, size). */
const EDGE_BLOBS: readonly (readonly [number, number, number])[] = [
  [40, 20, 220], [200, -10, 220], [380, -14, 220], [560, 10, 220], [650, 120, 200], [660, 260, 200], [560, 370, 230],
  [370, 380, 230], [180, 376, 230], [10, 300, 200], [-10, 150, 200],
];

export interface FogPatch { id: string; at: readonly [number, number]; w: number; h: number }

export interface InnerFog {
  /** The edges close in (voices from outside) or open again. */
  press(on: boolean): void;
  /** Lifts one fog patch (the meadow grows). */
  lift(id: string, ms?: number): Promise<void>;
  /** Shows or hides the warm glow of one bright place. */
  glow(id: string, on: boolean): void;
  dispose(): void;
}

/**
 * Builds the inner-refuge effects for the current map visit. `patches` start dense; `glows` mark the bright places
 * (same ids). Everything is removed when the world scene shuts down.
 */
export function innerFog(w: WorldCtx, patches: FogPatch[], glows: Record<string, readonly [number, number]>): InnerFog {
  const scene = w.scene as WorldSceneLike;
  const overlay = <T extends Phaser.GameObjects.GameObject>(o: T): T => (scene.addOverlay ? scene.addOverlay(o) : o);
  const world = <T extends Phaser.GameObjects.GameObject>(o: T): T => (scene.addWorld ? scene.addWorld(o) : o);

  ensureSoftBlob(scene);
  // Screen edges: the breathing vignette and soft fog blobs drifting along the border.
  const vignette = overlay(scene.add.image(GAME_W / 2, GAME_H / 2, 'w-vignette').setScrollFactor(0).setDepth(9300)
    .setDisplaySize(GAME_W * 1.02, GAME_H * 1.02).setTint(EDGE_TINT).setAlpha(0.72));
  const edge = EDGE_BLOBS.map(([x, y, size]) => ({
    img: overlay(scene.add.image(x, y, SOFT).setScrollFactor(0).setDepth(9290).setTint(FOG_TINT).setDisplaySize(size, size * 0.7).setAlpha(0.6)),
    x, y,
  }));

  // Fog over the parts of the meadow that are not remembered yet (world space, over the figures): a cluster of soft
  // blobs per patch, no hard edges.
  const fog = new Map<string, Phaser.GameObjects.Image[]>();
  for (const p of patches) {
    const layers = PATCH_BLOBS.map(([fx, fy, fs], i) => world(scene.add.image(p.at[0] + fx * p.w * 0.5, p.at[1] + fy * p.h * 0.5, SOFT)
      .setDisplaySize(p.w * fs, p.h * fs * 1.1).setTint(FOG_TINT).setDepth(2000 + i * 0.01).setAlpha(0.82)));
    fog.set(p.id, layers);
  }

  // The bright places: a soft warm halo and a light, above the fog.
  const halos = new Map<string, { img: Phaser.GameObjects.Image; light: ReturnType<WorldCtx['lighting']['add']>; on: boolean }>();
  for (const [id, at] of Object.entries(glows)) {
    const img = world(scene.add.image(at[0], at[1] - 10, 'w-glow').setBlendMode(ADD).setTint(WARM).setDepth(2100).setScale(0.9).setAlpha(0));
    const light = w.lighting.add({ id: `e3-zf-glow-${id}`, at: [at[0], at[1] - 10], kind: 'plain', color: WARM, radius: 46, intensity: 0, always: true });
    halos.set(id, { img, light, on: false });
  }

  let pressed = 0, t = 0, disposed = false;
  const onPost = (_time: number, delta: number) => {
    const dt = Math.min(0.1, delta / 1000);
    t += dt;
    const target = 0.72 + 0.06 * Math.sin(t * 0.9) + pressed * 0.22;
    vignette.setAlpha(vignette.alpha + (Math.min(1, target) - vignette.alpha) * Math.min(1, dt * 3));
    edge.forEach((e, i) => {
      e.img.setPosition(e.x + Math.sin(t * 0.25 + i) * 10, e.y + Math.cos(t * 0.2 + i * 1.7) * 6);
      e.img.setAlpha(0.5 + pressed * 0.35 + 0.08 * Math.sin(t * 0.6 + i));
    });
    for (const [, layers] of fog) layers.forEach((l, i) => { l.x += Math.sin(t * 0.4 + i * 2) * dt * 1.5; });
    for (const [, h] of halos) {
      const a = h.on ? 0.55 + 0.25 * Math.sin(t * 2.2) : 0;
      h.img.setAlpha(h.img.alpha + (a - h.img.alpha) * Math.min(1, dt * 4));
    }
  };
  scene.events.on('postupdate', onPost);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scene.events.off('postupdate', onPost);
    vignette.destroy();
    for (const e of edge) e.img.destroy();
    for (const [, layers] of fog) for (const l of layers) l.destroy();
    for (const [, h] of halos) { h.img.destroy(); try { h.light.remove(); } catch { /* scene gone */ } }
  };
  scene.events.once('shutdown', dispose);

  return {
    press(on) { pressed = on ? 1 : 0; },
    lift(id, ms = 1800) {
      const layers = fog.get(id);
      if (!layers) return Promise.resolve();
      return new Promise<void>(resolve => {
        scene.tweens.add({ targets: layers, alpha: 0, duration: ms, ease: 'Sine.easeInOut', onComplete: () => resolve() });
        for (const l of layers) scene.tweens.add({ targets: l, scaleX: l.scaleX * 1.35, scaleY: l.scaleY * 1.25, duration: ms });
      });
    },
    glow(id, on) {
      const h = halos.get(id);
      if (!h) return;
      h.on = on;
      void h.light.fadeTo(on ? 0.8 : 0, 700);
    },
    dispose,
  };
}

/**
 * A remembered person: the NPC `id` drawn pale and warm, slightly translucent; fades in now and out with the
 * returned function. Restyled every frame (the engine sets alpha and tint of actors itself).
 */
export function rememberedFigure(w: WorldCtx, a: ActorHandle): { fadeOut(ms?: number): Promise<void> } {
  const scene = w.scene;
  let cur = 0, to = 0.85, rate = 0.85 / 0.7;
  const onPost = (_time: number, delta: number) => {
    const sprite = a.exists ? a.sprite : undefined;
    if (!sprite) return;
    const dt = Math.min(0.1, delta / 1000);
    cur += Math.sign(to - cur) * Math.min(Math.abs(to - cur), dt * rate);
    sprite.setTint(WARM);
    sprite.setAlpha(cur * (0.9 + 0.1 * Math.sin(scene.time.now / 400)));
  };
  scene.events.on('postupdate', onPost);
  const stop = () => scene.events.off('postupdate', onPost);
  scene.events.once('shutdown', stop);
  return {
    fadeOut(ms = 1200) {
      to = 0; rate = Math.max(0.05, cur) / (ms / 1000);
      return w.wait(ms + 100).then(() => { stop(); a.hide(); });
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Voices from outside
// ---------------------------------------------------------------------------------------------------------------

let styled = false;
function ensureStyles(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const style = document.createElement('style');
  style.id = 'e3-stimmen-styles';
  style.textContent = `
.e3-stimmen { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 7%; gap: 0.6em;
  cursor: pointer; background: linear-gradient(to bottom, rgba(24, 16, 40, 0.78) 0%, rgba(24, 16, 40, 0.5) 30%, rgba(24, 16, 40, 0) 55%);
  opacity: 0; transition: opacity 1s; }
.e3-stimmen.is-in { opacity: 1; }
.e3-stimmen.is-out { opacity: 0; transition-duration: 0.8s; }
.e3-stimmen-tag { font-family: var(--f-label); letter-spacing: 0.28em; font-size: 0.72em; color: rgba(235, 228, 250, 0.85); text-transform: uppercase; }
.e3-stimmen-line { max-width: 30em; text-align: center; opacity: 0; filter: blur(0.3em); transform: translateY(-0.4em);
  transition: opacity 1s, filter 1.2s, transform 1.2s; }
.e3-stimmen-line.is-in { opacity: 1; filter: blur(0.02em); transform: none; animation: e3-stimmen-sway 4.2s ease-in-out infinite; }
.e3-stimmen-line.is-gone { opacity: 0.55; filter: blur(0.06em); }
.e3-stimmen-who { display: block; font-family: var(--f-label); font-size: 0.7em; letter-spacing: 0.14em; color: rgba(225, 215, 245, 0.85); }
.e3-stimmen-text { font-family: var(--f-body); font-style: italic; font-size: 1.15em; color: #f6f1fd;
  text-shadow: 0 0 0.35em rgba(20, 12, 34, 1), 0 0.06em 0.12em rgba(20, 12, 34, 1); }
@keyframes e3-stimmen-sway { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(0.3em); } }
#ui.reduced-motion .e3-stimmen-line.is-in { animation: none; }
`;
  document.head.appendChild(style);
}

/** Plays muffled voices over the meadow; resolves when they faded. Never resolves for a scene already left. */
export async function outsideVoices(lines: readonly OutsideLine[]): Promise<void> {
  ensureStyles();
  if (ctx.stale()) return new Promise(() => {});
  const root = ui().panel('e3-stimmen');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Stimmen von draußen');
  root.innerHTML = '<div class="e3-stimmen-tag">Von draußen, gedämpft</div>';
  let hurry: (() => void) | null = null;
  const skip = () => { hurry?.(); };
  root.addEventListener('pointerdown', e => { e.preventDefault(); skip(); });
  const close = ctx.open({ id: 'e3-stimmen', allowMenu: false, onKey: e => { if (!e.repeat) skip(); return true; } });
  const beat = (ms: number) => new Promise<void>(resolve => {
    const token = ui().token();
    const timer = setTimeout(() => { hurry = null; if (ui().alive(token)) resolve(); }, ms);
    hurry = () => { clearTimeout(timer); hurry = null; resolve(); };
  });
  try {
    requestAnimationFrame(() => root.classList.add('is-in'));
    await beat(900);
    let prev: HTMLElement | null = null;
    for (const l of lines) {
      const el = document.createElement('div');
      el.className = 'e3-stimmen-line';
      const who = document.createElement('span');
      who.className = 'e3-stimmen-who';
      who.textContent = l.who;
      const text = document.createElement('span');
      text.className = 'e3-stimmen-text';
      text.textContent = `„${l.text}“`;
      el.append(who, text);
      root.appendChild(el);
      prev?.classList.add('is-gone');
      prev = el;
      requestAnimationFrame(() => el.classList.add('is-in'));
      // A muffled murmur instead of the usual dialogue blips: low, far, a few syllables.
      for (let i = 0; i < 4; i++) {
        try { G.audio.blip(95 + Math.random() * 30, 'sine', { volume: 0.25 }); } catch { /* audio optional */ }
        await beat(110);
      }
      await beat(1500 + l.text.length * 38);
    }
    root.classList.add('is-out');
    await beat(800);
  } finally {
    close();
    root.remove();
  }
}

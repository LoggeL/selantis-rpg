// The blindfold walk (augenbinde, part 2): a dark screen, only sounds. Voices are placed in stereo by where the
// speaker stands relative to Lia, and every sound draws faint rings in the darkness at its direction, so the walk
// also works without headphones. Lia moves freely on the forest path map underneath; bumping into the undergrowth,
// stepping into the brook or forgetting to duck under the fallen trunk all answer with sound and a jolt.
import Phaser from 'phaser';
import { G } from '../../core/G';
import type { UiApiExt } from '../../ui';
import type { WorldCtx } from '../../world';
import { internals, moveIntent, sfx } from './shared';

const W = 640, H = 360;

export const RING = {
  azar: 0xe0b45a,
  foltan: 0x7f9fd4,
  stranger: 0xd6d0c0,
  water: 0x9cc0e6,
  leaves: 0x8db36a,
  pain: 0xd4573b,
} as const;

interface Ring { x: number; y: number; r: number; max: number; color: number; life: number; age: number; width: number }

export interface VoiceOpts { pitch: number; wave?: OscillatorType; color: number; name: string; ms?: number }

/** Darkness, rings and positional voices for one world visit. */
export class Blindfold {
  private dark: Phaser.GameObjects.Rectangle;
  private cloth: Phaser.GameObjects.Image;
  private gfx: Phaser.GameObjects.Graphics;
  private rings: Ring[] = [];
  private level = 1;
  private readonly token: number;
  private lastPos = { x: 0, y: 0 };
  private stuckT = 0;
  private bumpCooldown = 0;
  private alive = true;
  /** Called when Lia pushes against an obstacle for a moment (once per cooldown). */
  onBump: (() => void) | null = null;

  constructor(private w: WorldCtx) {
    const scene = w.scene;
    const ov = internals(w);
    this.token = (G.ui as UiApiExt).token();
    this.dark = ov.addOverlay(scene.add.rectangle(W / 2, H / 2, W * 3, H * 3, 0x050507, 1).setScrollFactor(0).setDepth(99990));
    this.cloth = ov.addOverlay(scene.add.image(W / 2, H / 2, clothTexture(scene)).setScrollFactor(0).setDepth(99991).setAlpha(0.9));
    this.gfx = ov.addOverlay(scene.add.graphics().setScrollFactor(0).setDepth(99995));
    scene.events.on('update', this.update, this);
    scene.events.once('shutdown', () => this.destroy());
    const p = ov.player;
    if (p) this.lastPos = { x: p.x, y: p.y };
  }

  get covered(): boolean { return this.level > 0.5; }

  /** Fades the blindfold (1 = dark, 0 = sight). */
  set(level: number, ms = 0): Promise<void> {
    this.level = level;
    if (!ms) { this.dark.setAlpha(level); this.cloth.setAlpha(level * 0.9); return Promise.resolve(); }
    return new Promise(resolve => {
      this.w.scene.tweens.add({ targets: this.dark, alpha: level, duration: ms });
      this.w.scene.tweens.add({ targets: this.cloth, alpha: level * 0.9, duration: ms, onComplete: () => resolve() });
    });
  }

  /** Screen position of a world point, clamped into the visible frame (direction indicator). */
  screenOf(x: number, y: number): { x: number; y: number } {
    const s = internals(this.w).toScreen(x, y);
    return { x: Phaser.Math.Clamp(s.x, 46, W - 46), y: Phaser.Math.Clamp(s.y, 44, H - 70) };
  }

  /** Stereo position -1..1 and loudness 0..1 of a world point relative to Lia. */
  ear(x: number, y: number): { pan: number; vol: number; dist: number } {
    const p = internals(this.w).player ?? { x, y };
    const dx = x - p.x, dy = y - p.y;
    const dist = Math.hypot(dx, dy);
    return { pan: Phaser.Math.Clamp(dx / 110, -1, 1), vol: Phaser.Math.Clamp(1.25 - dist / 320, 0.25, 1.1), dist };
  }

  /** Expanding rings at a screen point. */
  ripple(sx: number, sy: number, color: number, strength = 1): void {
    if (!this.alive) return;
    for (let i = 0; i < 3; i++) {
      this.rings.push({ x: sx, y: sy, r: 4 + i * 5, max: 26 + 22 * strength + i * 8, color, life: 1.1 + i * 0.25, age: -i * 0.16, width: 2 });
    }
  }

  /** Rings at a world point (clamped to the frame). */
  rippleAt(x: number, y: number, color: number, strength = 1): void {
    const s = this.screenOf(x, y);
    this.ripple(s.x, s.y, color, strength);
  }

  /**
   * A voice in the dark: a speech bubble at the speaker's direction, typewriter blips panned by position, rings.
   * Resolves after the line had time to be read (the player can keep walking meanwhile).
   */
  async voice(actorId: string | null, text: string, o: VoiceOpts): Promise<void> {
    if (!this.alive) return;
    const ui = G.ui as UiApiExt;
    const where = (): { x: number; y: number } => {
      if (!actorId) return { x: W / 2, y: 70 };
      const a = this.w.actor(actorId);
      if (!a.exists) return { x: W / 2, y: 70 };
      return this.screenOf(a.x, a.y - 34);
    };
    const ms = o.ms ?? Math.max(1700, 900 + text.length * 48);
    ui.bubble(`*${o.name}:* ${text}`, where, ms);
    const pos = where();
    this.ripple(pos.x, pos.y + 18, o.color, 1);
    const letters = Math.min(40, Math.ceil(text.replace(/[^\p{L}]/gu, '').length / 2));
    const started = this.token;
    void (async () => {
      for (let i = 0; i < letters; i++) {
        if (!ui.alive(started) || !this.alive) return;
        const a = actorId ? this.w.actor(actorId) : null;
        const e = a && a.exists ? this.ear(a.x, a.y) : { pan: 0, vol: 0.8 };
        try { G.audio.blip(o.pitch * (0.94 + Math.random() * 0.12), o.wave ?? 'triangle', { pan: e.pan, volume: e.vol }); } catch { /* audio optional */ }
        if (i % 6 === 5) { const p = where(); this.ripple(p.x, p.y + 18, o.color, 0.6); }
        await ui.wait(62);
      }
    })();
    await ui.wait(ms);
  }

  /** A panned one-shot sound with rings at a world point. */
  soundAt(name: Parameters<typeof G.audio.sfx>[0], x: number, y: number, color: number, volume = 1): void {
    const e = this.ear(x, y);
    sfx(name, { pan: e.pan, volume: volume * e.vol, distance: Phaser.Math.Clamp(e.dist / 500, 0, 0.8) });
    this.rippleAt(x, y, color, 1.2);
  }

  /** A jolt of pain in the dark (bump, bonk). */
  pain(): void {
    const p = internals(this.w).player;
    if (p) { const s = this.screenOf(p.x, p.y - 20); this.ripple(s.x, s.y, RING.pain, 1.6); }
    this.w.camera.shake(220, 0.006);
    this.dark.setFillStyle(0x2a0a08, 1);
    this.w.scene.time.delayedCall(160, () => { if (this.alive) this.dark.setFillStyle(0x050507, 1); });
  }

  private update(_t: number, delta: number): void {
    if (!this.alive) return;
    const dt = Math.min(delta, 50) / 1000;
    // ---- rings ----
    const g = this.gfx;
    g.clear();
    this.rings = this.rings.filter(r => r.age < r.life);
    for (const r of this.rings) {
      r.age += dt;
      if (r.age < 0) continue;
      const k = r.age / r.life;
      const rad = r.r + (r.max - r.r) * Phaser.Math.Easing.Cubic.Out(k);
      const alpha = (1 - k) * 0.55 * Math.max(0.25, this.level);
      g.lineStyle(r.width, r.color, alpha);
      g.strokeEllipse(r.x, r.y, rad * 2, rad * 1.2);
    }
    // ---- bump detection: pushing while not moving ----
    const p = internals(this.w).player;
    if (!p) return;
    this.bumpCooldown -= dt;
    const moved = Math.hypot(p.x - this.lastPos.x, p.y - this.lastPos.y);
    this.lastPos = { x: p.x, y: p.y };
    const intent = moveIntent(this.w);
    if ((intent.x !== 0 || intent.y !== 0) && moved < 0.25 * (delta / 16.7) && !G.ui.busy()) this.stuckT += dt;
    else this.stuckT = 0;
    if (this.stuckT > 0.28 && this.bumpCooldown <= 0) {
      this.stuckT = 0;
      this.bumpCooldown = 1.6;
      this.onBump?.();
    }
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.w.scene.events.off('update', this.update, this);
    for (const o of [this.dark, this.cloth, this.gfx]) if (o.active) o.destroy();
  }
}

/** A dark linen weave with light seeping through from the upper left (what Lia sees under the cloth). */
function clothTexture(scene: Phaser.Scene): string {
  const key = 'k4-blindfold-cloth';
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, W, H);
  if (!tex) return key;
  const c = tex.getContext();
  const grad = c.createRadialGradient(W * 0.32, H * 0.08, 10, W * 0.32, H * 0.08, W * 0.75);
  grad.addColorStop(0, 'rgba(120,84,46,0.20)');
  grad.addColorStop(0.5, 'rgba(60,40,24,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, W, H);
  // weave: faint warm threads, horizontal and vertical
  for (let y = 0; y < H; y += 3) {
    c.fillStyle = `rgba(150,110,70,${0.025 + ((y * 7919) % 13) / 900})`;
    c.fillRect(0, y, W, 1);
  }
  for (let x = 0; x < W; x += 3) {
    c.fillStyle = `rgba(130,96,60,${0.02 + ((x * 104729) % 11) / 1000})`;
    c.fillRect(x, 0, 1, H);
  }
  // vignette
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.6)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  tex.refresh();
  return key;
}

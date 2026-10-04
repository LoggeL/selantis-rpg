import Phaser from 'phaser';
import { settings } from '../../core/settings';

const FX_DEPTH = 900000;

/** Juice helpers: particles, projectiles, beams, rings, flashes. All screen-space world coordinates. */
export class Fx {
  constructor(private scene: Phaser.Scene) {}

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise(resolve => { this.scene.tweens.add({ ...cfg, onComplete: () => resolve() }); });
  }
  wait(ms: number): Promise<void> { return new Promise(r => this.scene.time.delayedCall(ms, () => r())); }

  /** Burst of small particles. */
  burst(x: number, y: number, opts: { color: number | number[]; count?: number; speed?: number; life?: number; gravity?: number; texture?: string; scale?: number; depth?: number; blend?: boolean; spreadY?: number }): void {
    const colors = Array.isArray(opts.color) ? opts.color : [opts.color];
    const count = settings.reducedMotion ? Math.ceil((opts.count ?? 10) / 2) : (opts.count ?? 10);
    const em = this.scene.add.particles(x, y, opts.texture ?? 'tac-px', {
      speed: { min: (opts.speed ?? 60) * 0.35, max: opts.speed ?? 60 },
      angle: { min: 0, max: 360 },
      lifespan: { min: (opts.life ?? 420) * 0.6, max: opts.life ?? 420 },
      gravityY: opts.gravity ?? 120,
      scale: { start: opts.scale ?? 1, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: colors,
      blendMode: opts.blend ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
      emitting: false,
    });
    em.setDepth(opts.depth ?? FX_DEPTH);
    em.explode(count, 0, 0);
    this.scene.time.delayedCall((opts.life ?? 420) + 120, () => em.destroy());
  }

  /** Small dust puff on landing / step. */
  dust(x: number, y: number, depth: number, n = 6): void {
    this.burst(x, y, { color: [0xcdb08a, 0xa8906c, 0xe6d6b8], count: n, speed: 26, life: 380, gravity: -14, texture: 'tac-dot', scale: 0.9, depth });
  }

  /** Impact star + sparks. */
  impact(x: number, y: number, color = 0xfff0b0, big = false): void {
    const s = this.scene.add.image(x, y, 'tac-impact').setDepth(FX_DEPTH + 2).setScale(big ? 1.3 : 0.9).setTint(color).setBlendMode(Phaser.BlendModes.ADD);
    void this.tween({ targets: s, scale: big ? 2 : 1.4, alpha: 0, duration: 220, ease: 'Quad.easeOut' }).then(() => s.destroy());
    this.burst(x, y, { color: [color, 0xffffff], count: big ? 14 : 8, speed: big ? 110 : 80, life: 320, gravity: 160 });
  }

  slash(x: number, y: number, angle: number, flip = false, color = 0xffffff): void {
    const s = this.scene.add.image(x, y, 'tac-slash').setDepth(FX_DEPTH + 1).setRotation(angle).setFlipY(flip).setTint(color).setAlpha(0.95);
    void this.tween({ targets: s, alpha: 0, scale: 1.25, duration: 200, ease: 'Quad.easeOut' }).then(() => s.destroy());
  }

  /** Projectile along a parabolic arc; resolves on arrival. */
  async projectile(texture: string, from: { x: number; y: number }, to: { x: number; y: number }, opts: { arc?: number; ms?: number; spin?: boolean } = {}): Promise<void> {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const ms = opts.ms ?? Math.max(220, Math.min(520, dist * 3.2));
    const arc = opts.arc ?? Math.min(36, 8 + dist * 0.22);
    const img = this.scene.add.image(from.x, from.y, texture).setDepth(FX_DEPTH + 3);
    const trail: Phaser.GameObjects.Image[] = [];
    const state = { t: 0 };
    let prev = { ...from };
    await this.tween({
      targets: state, t: 1, duration: ms, ease: 'Linear',
      onUpdate: () => {
        const t = state.t;
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * arc;
        img.setPosition(Math.round(x), Math.round(y));
        if (opts.spin) img.rotation += 0.4;
        else img.setRotation(Math.atan2(y - prev.y, x - prev.x));
        if (trail.length < 30 && !settings.reducedMotion) {
          const tr = this.scene.add.image(prev.x, prev.y, 'tac-px').setDepth(FX_DEPTH + 2).setAlpha(0.55).setTint(texture === 'tac-stone' ? 0xc0c0c8 : 0xfff2c0);
          trail.push(tr);
          this.scene.tweens.add({ targets: tr, alpha: 0, duration: 200, onComplete: () => tr.destroy() });
        }
        prev = { x, y };
      },
    } as Phaser.Types.Tweens.TweenBuilderConfig);
    img.destroy();
  }

  /** Crackling turquoise beam from a to b. Returns a handle to fade it. */
  beam(a: { x: number; y: number }, b: { x: number; y: number }): { stop: () => Promise<void> } {
    const g = this.scene.add.graphics().setDepth(FX_DEPTH + 1).setBlendMode(Phaser.BlendModes.ADD);
    const core = this.scene.add.graphics().setDepth(FX_DEPTH + 2);
    let alive = true;
    let width = 0;
    const grow = this.scene.tweens.add({ targets: { w: 0 }, w: 1, duration: 140, onUpdate: tw => { width = tw.getValue() ?? 1; } });
    const draw = () => {
      if (!alive) return;
      g.clear(); core.clear();
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const flick = 0.85 + Math.random() * 0.3;
      g.lineStyle(9 * width * flick, 0x138078, 0.35).lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(5 * width * flick, 0x49e0c8, 0.7).lineBetween(a.x, a.y, b.x, b.y);
      core.lineStyle(2 * width, 0xe8fffa, 1).lineBetween(a.x, a.y, b.x, b.y);
      // crackling side arcs
      for (let k = 0; k < 2; k++) {
        g.lineStyle(1, k ? 0x9cf8e6 : 0xe8fffa, 0.9);
        g.beginPath();
        g.moveTo(a.x, a.y);
        const segs = Math.max(4, Math.floor(len / 9));
        for (let i = 1; i <= segs; i++) {
          const t = i / segs;
          const off = (Math.random() - 0.5) * 9 * width * Math.sin(Math.PI * t);
          g.lineTo(a.x + dx * t + nx * off, a.y + dy * t + ny * off);
        }
        g.strokePath();
      }
    };
    const timer = this.scene.time.addEvent({ delay: 40, loop: true, callback: draw });
    draw();
    const sparks = this.scene.time.addEvent({
      delay: 60, loop: true, callback: () => {
        const t = Math.random();
        this.burst(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, { color: [0x49e0c8, 0x9cf8e6, 0xe8fffa], count: 3, speed: 50, life: 300, gravity: -20, blend: true });
      },
    });
    return {
      stop: async () => {
        sparks.remove();
        grow.stop();
        await this.tween({ targets: [g, core], alpha: 0, duration: 220 });
        alive = false;
        timer.remove();
        g.destroy(); core.destroy();
      },
    };
  }

  /** Charging motes converging on a point (magic windup). */
  async charge(x: number, y: number, color = 0x49e0c8, ms = 320): Promise<void> {
    const n = settings.reducedMotion ? 6 : 14;
    const motes: Promise<void>[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const r = 16 + Math.random() * 10;
      const m = this.scene.add.image(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 'tac-dot').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(FX_DEPTH + 2).setScale(0.8);
      motes.push(this.tween({ targets: m, x, y, scale: 0.2, alpha: 0.4, duration: ms * (0.7 + Math.random() * 0.3), ease: 'Quad.easeIn' }).then(() => m.destroy()));
    }
    const glow = this.scene.add.image(x, y, 'tac-dot').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(FX_DEPTH + 2).setScale(0.5);
    void this.tween({ targets: glow, scale: 2.2, alpha: 0, duration: ms + 120 }).then(() => glow.destroy());
    await Promise.all(motes);
  }

  /** Expanding iso-flattened shockwave ring. */
  async ring(x: number, y: number, color = 0x49e0c8, radius = 34, ms = 380): Promise<void> {
    const g = this.scene.add.graphics().setDepth(FX_DEPTH).setBlendMode(Phaser.BlendModes.ADD);
    const st = { r: 2 };
    await this.tween({
      targets: st, r: radius, duration: ms, ease: 'Cubic.easeOut',
      onUpdate: () => {
        const k = st.r / radius;
        g.clear();
        g.lineStyle(4 * (1 - k) + 1, color, 0.9 * (1 - k) + 0.1).strokeEllipse(x, y, st.r * 2, st.r);
        g.lineStyle(1, 0xe8fffa, 0.8 * (1 - k)).strokeEllipse(x, y, st.r * 1.7, st.r * 0.85);
      },
    } as Phaser.Types.Tweens.TweenBuilderConfig);
    g.destroy();
  }

  /** Shimmering shield bubble (ward). */
  async ward(x: number, y: number, depth: number): Promise<void> {
    const g = this.scene.add.graphics().setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
    const st = { k: 0 };
    await this.tween({
      targets: st, k: 1, duration: 700, ease: 'Sine.easeOut',
      onUpdate: () => {
        const k = st.k;
        const a = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
        g.clear();
        g.fillStyle(0x49e0c8, 0.16 * a).fillEllipse(x, y - 12, 26, 32);
        g.lineStyle(1, 0x9cf8e6, 0.9 * a).strokeEllipse(x, y - 12, 26, 32);
        for (let i = 0; i < 6; i++) {
          const ang = k * 4 + (i / 6) * Math.PI * 2;
          g.fillStyle(0xe8fffa, a).fillRect(Math.round(x + Math.cos(ang) * 12), Math.round(y - 12 + Math.sin(ang) * 15), 1, 1);
        }
      },
    } as Phaser.Types.Tweens.TweenBuilderConfig);
    g.destroy();
  }

  /** A soft additive glow sprite (for fire props). */
  glow(x: number, y: number, color: number, radius: number, depth: number): Phaser.GameObjects.Image {
    const img = this.scene.add.image(x, y, 'tac-glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setScale(radius / 32).setDepth(depth);
    this.scene.tweens.add({ targets: img, alpha: 0.7, duration: 160 + Math.random() * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return img;
  }
}

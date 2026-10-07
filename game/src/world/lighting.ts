import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../core/viewport';
import type { LightDef, LightKind, TimeOfDay } from './api';
import { clamp, type Vec } from './geom';

/**
 * Multiply grade per time of day (r, g, b 0..1), additive haze, how strongly light sources show (0..1), a
 * screen gradient (dusk/dawn: warm light side top-left → cool shade bottom-right, DESIGN.md §3) and how long
 * character shadows get.
 */
export const MOODS: Record<TimeOfDay, {
  grade: [number, number, number]; add: [number, number, number]; lights: number; dusk: number; dawn: number; longShadow: number;
}> = {
  day: { grade: [1, 1, 1], add: [0, 0, 0], lights: 0.0, dusk: 0, dawn: 0, longShadow: 0 },
  dawn: { grade: [0.92, 0.88, 0.94], add: [0.06, 0.035, 0.06], lights: 0.42, dusk: 0, dawn: 1, longShadow: 0.8 },
  dusk: { grade: [0.97, 0.86, 0.86], add: [0.085, 0.022, 0.06], lights: 0.66, dusk: 1, dawn: 0, longShadow: 1 },
  night: { grade: [0.22, 0.28, 0.5], add: [0.0, 0.012, 0.04], lights: 1, dusk: 0, dawn: 0, longShadow: 0 },
  storm: { grade: [0.46, 0.51, 0.6], add: [0.01, 0.02, 0.035], lights: 0.78, dusk: 0, dawn: 0, longShadow: 0 },
};

/** Diagonal multiply gradients (top-left → bottom-right) stamped into the light mask for dusk and dawn. */
const GRADIENTS: Record<'dusk' | 'dawn', [string, string, string]> = {
  dusk: ['#ffd9a8', '#d8a49a', '#7c6cb4'],
  dawn: ['#ffe6e0', '#e6d0e0', '#9eaedc'],
};

/** Extra multiply per weather (rain makes everything cooler and a bit darker). */
const WEATHER_TINT: Record<string, [number, number, number]> = {
  none: [1, 1, 1], fireflies: [1, 1, 1], leaves: [1, 1, 1], pollen: [1, 1, 1],
  rain: [0.78, 0.83, 0.9], storm: [0.7, 0.75, 0.84], fog: [0.9, 0.92, 0.95],
};

const KIND_DEFAULTS: Record<LightKind, { color: number; radius: number; flicker: number }> = {
  fire: { color: 0xffa04a, radius: 64, flicker: 1 },
  lantern: { color: 0xffc878, radius: 50, flicker: 0.25 },
  candle: { color: 0xffc070, radius: 30, flicker: 0.55 },
  window: { color: 0xffcf80, radius: 34, flicker: 0.08 },
  urmacht: { color: 0x49e0c8, radius: 56, flicker: 0 },
  moon: { color: 0x9fb4ff, radius: 160, flicker: 0 },
  plain: { color: 0xffffff, radius: 56, flicker: 0 },
};

export interface LightRuntime {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity: number;
  kind: LightKind;
  flicker: number;
  always: boolean;
  /** Dynamic position (lantern carried by a guard, player light). */
  follow?: () => Vec | null;
  phase: number;
  glow: Phaser.GameObjects.Image;
  /** Visual multiplier used by fades. */
  fade: number;
}

/**
 * Time-of-day grading + light sources.
 * A screen-sized RenderTexture is filled with the grade colour every frame, light sprites are stamped into it
 * additively, and the result is multiplied over the world. Additive glow sprites add the coloured halo.
 */
export class Lighting {
  readonly rt: Phaser.GameObjects.RenderTexture;
  private haze: Phaser.GameObjects.Image;
  private add_: [number, number, number] = [0, 0, 0];
  private fromAdd: [number, number, number] = [0, 0, 0];
  private toAdd: [number, number, number] = [0, 0, 0];
  private wTint: [number, number, number] = [1, 1, 1];
  private wTarget: [number, number, number] = [1, 1, 1];
  private lights = new Map<string, LightRuntime>();
  private grade: [number, number, number] = [1, 1, 1];
  private lightsFactor = 0;
  private from = { grade: [1, 1, 1] as [number, number, number], lights: 0 };
  private to = { grade: [1, 1, 1] as [number, number, number], lights: 0 };
  private tT = 1;
  private tDur = 0;
  private tResolve: (() => void) | null = null;
  time: TimeOfDay = 'day';
  private flashAmt = 0;
  private flashColor = 0xffffff;
  private flashDecay = 4;
  private seq = 0;
  private t = 0;
  /** Interpolated gradient strengths and long-shadow factor. */
  private grad = { dusk: 0, dawn: 0, long: 0 };
  private fromGrad = { dusk: 0, dawn: 0, long: 0 };
  private toGrad = { dusk: 0, dawn: 0, long: 0 };

  constructor(private scene: Phaser.Scene, private addWorld: <T extends Phaser.GameObjects.GameObject>(o: T) => T) {
    this.rt = addWorld(scene.add.renderTexture(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H));
    this.rt.setOrigin(0.5).setScrollFactor(0).setDepth(90000).setBlendMode(Phaser.BlendModes.MULTIPLY);
    // Additive haze: lifts shadows towards the mood colour (golden hour, moonlight). Gradient: stronger at the top.
    if (!scene.textures.exists('w-haze')) {
      const c = document.createElement('canvas'); c.width = 4; c.height = 64;
      const g = c.getContext('2d')!;
      const grad = g.createLinearGradient(0, 0, 0, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0.45)');
      g.fillStyle = grad; g.fillRect(0, 0, 4, 64);
      const tex = scene.textures.addCanvas('w-haze', c);
      tex?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    this.haze = addWorld(scene.add.image(GAME_W / 2, GAME_H / 2, 'w-haze')).setScrollFactor(0).setDepth(90001)
      .setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(GAME_W * 2, GAME_H * 2).setVisible(false);
    for (const [name, [a, b, c]] of Object.entries(GRADIENTS)) {
      const key = `w-grad-${name}`;
      if (scene.textures.exists(key)) continue;
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 36;
      const g = cv.getContext('2d')!;
      const grad = g.createLinearGradient(0, 0, 64, 36);
      grad.addColorStop(0, a); grad.addColorStop(0.5, b); grad.addColorStop(1, c);
      g.fillStyle = grad; g.fillRect(0, 0, 64, 36);
      scene.textures.addCanvas(key, cv)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }

  /** Time of day painted into the background (MapDef.baked): its grade is applied only lightly. */
  private baked: TimeOfDay | undefined;
  setBaked(t: TimeOfDay | undefined): void { this.baked = t; }

  /** The mood for a time, softened when the background already shows that time. */
  private mood(time: TimeOfDay): (typeof MOODS)[TimeOfDay] {
    const m = MOODS[time];
    if (this.baked !== time) return m;
    const k = 0.72; // keep 28% of the grade (a touch of cool contrast) — the painting is already dark/warm
    return {
      ...m,
      grade: m.grade.map(v => v + (1 - v) * k) as [number, number, number],
      add: m.add.map(v => v * 0.3) as [number, number, number],
      dusk: m.dusk * 0.35, dawn: m.dawn * 0.35,
    };
  }

  /** 0..1: long evening/morning shadows. */
  get longShadow(): number { return this.grad.long; }

  /** Weather influence on the grade (smoothly blended). */
  setWeather(kind: string): void { this.wTarget = [...(WEATHER_TINT[kind] ?? [1, 1, 1])] as [number, number, number]; }

  /** Current grade (for tinting weather particles). */
  get gradeColor(): [number, number, number] { return this.grade; }
  get darkness(): number { return this.lightsFactor; }

  setImmediate(time: TimeOfDay): void {
    this.time = time;
    const m = this.mood(time);
    this.grade = [...m.grade];
    this.add_ = [...m.add];
    this.toAdd = [...m.add];
    this.lightsFactor = m.lights;
    this.to = { grade: [...m.grade], lights: m.lights };
    this.grad = { dusk: m.dusk, dawn: m.dawn, long: m.longShadow };
    this.toGrad = { ...this.grad };
    this.tT = 1;
    this.tResolve?.(); this.tResolve = null;
  }

  set(time: TimeOfDay, ms = 2000): Promise<void> {
    if (ms <= 0) { this.setImmediate(time); return Promise.resolve(); }
    this.tResolve?.();
    this.time = time;
    this.from = { grade: [...this.grade], lights: this.lightsFactor };
    this.fromAdd = [...this.add_];
    const m = this.mood(time);
    this.to = { grade: [...m.grade], lights: m.lights };
    this.toAdd = [...m.add];
    this.fromGrad = { ...this.grad };
    this.toGrad = { dusk: m.dusk, dawn: m.dawn, long: m.longShadow };
    this.tT = 0;
    this.tDur = ms / 1000;
    return new Promise(resolve => { this.tResolve = resolve; });
  }

  flash(color = 0xffffff, ms = 400): void {
    this.flashAmt = 1;
    this.flashColor = color;
    this.flashDecay = 1000 / Math.max(60, ms);
  }

  add(def: LightDef & { follow?: () => Vec | null }, pos: Vec): LightRuntime {
    const kind = def.kind ?? 'plain';
    const d = KIND_DEFAULTS[kind];
    const id = def.id ?? `light-${++this.seq}`;
    this.remove(id);
    const glow = this.addWorld(this.scene.add.image(pos.x, pos.y, 'w-glow'))
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(89000).setAlpha(0);
    const l: LightRuntime = {
      id, x: pos.x, y: pos.y, kind,
      radius: def.radius ?? d.radius,
      color: def.color ?? d.color,
      intensity: def.intensity ?? 1,
      flicker: def.flicker ?? d.flicker,
      always: def.always ?? false,
      follow: def.follow,
      phase: Math.random() * 100,
      glow,
      fade: 1,
    };
    this.lights.set(id, l);
    return l;
  }

  get(id: string): LightRuntime | undefined { return this.lights.get(id); }

  remove(id: string): void {
    const l = this.lights.get(id);
    if (!l) return;
    l.glow.destroy();
    this.lights.delete(id);
  }

  clear(): void { for (const id of [...this.lights.keys()]) this.remove(id); }

  resize(): void {
    this.rt.resize(GAME_W, GAME_H);
    this.haze.setDisplaySize(GAME_W * 2, GAME_H * 2);
  }

  update(dt: number, cam: Phaser.Cameras.Scene2D.Camera): void {
    this.t += dt;
    if (this.tT < 1) {
      this.tT = Math.min(1, this.tT + dt / Math.max(0.001, this.tDur));
      const e = this.tT < 0.5 ? 2 * this.tT * this.tT : 1 - Math.pow(-2 * this.tT + 2, 2) / 2;
      for (let i = 0; i < 3; i++) {
        this.grade[i] = this.from.grade[i] + (this.to.grade[i] - this.from.grade[i]) * e;
        this.add_[i] = this.fromAdd[i] + (this.toAdd[i] - this.fromAdd[i]) * e;
      }
      this.lightsFactor = this.from.lights + (this.to.lights - this.from.lights) * e;
      for (const k of ['dusk', 'dawn', 'long'] as const) this.grad[k] = this.fromGrad[k] + (this.toGrad[k] - this.fromGrad[k]) * e;
      if (this.tT >= 1) { this.tResolve?.(); this.tResolve = null; }
    }
    if (this.flashAmt > 0) this.flashAmt = Math.max(0, this.flashAmt - dt * this.flashDecay);
    for (let i = 0; i < 3; i++) this.wTint[i] += (this.wTarget[i] - this.wTint[i]) * Math.min(1, dt * 0.8);
    const hz = this.add_;
    if (hz[0] + hz[1] + hz[2] > 0.003) {
      this.haze.setVisible(true).setTint(Phaser.Display.Color.GetColor(Math.min(255, hz[0] * 255 * 4), Math.min(255, hz[1] * 255 * 4), Math.min(255, hz[2] * 255 * 4)))
        .setAlpha(0.25).setPosition(GAME_W / 2, GAME_H / 2)
        .setScale((GAME_W * 2) / 4 / cam.zoom, (GAME_H * 2) / 64 / cam.zoom);
    } else this.haze.setVisible(false);

    const fr = ((this.flashColor >> 16) & 255) / 255, fg = ((this.flashColor >> 8) & 255) / 255, fb = (this.flashColor & 255) / 255;
    const f = this.flashAmt;
    const wt = this.wTint;
    const r = clamp(this.grade[0] * wt[0] + (fr - this.grade[0] * wt[0]) * f, 0, 1);
    const g = clamp(this.grade[1] * wt[1] + (fg - this.grade[1] * wt[1]) * f, 0, 1);
    const b = clamp(this.grade[2] * wt[2] + (fb - this.grade[2] * wt[2]) * f, 0, 1);
    const isNeutral = r > 0.995 && g > 0.995 && b > 0.995 && this.grad.dusk < 0.005 && this.grad.dawn < 0.005;

    const zoom = cam.zoom;
    const s = Math.max(1, 1 / zoom);
    this.rt.setPosition(GAME_W / 2, GAME_H / 2).setScale(s);
    const cx = cam.worldView.centerX, cy = cam.worldView.centerY;

    // Position lights and glows.
    for (const l of this.lights.values()) {
      if (l.follow) { const p = l.follow(); if (p) { l.x = p.x; l.y = p.y; } }
    }

    const show = this.lightsFactor;
    if (isNeutral && show < 0.01) {
      this.rt.setVisible(false);
      for (const l of this.lights.values()) l.glow.setAlpha(l.always ? 0.12 * l.intensity * l.fade : 0);
      return;
    }
    this.rt.setVisible(true);
    this.rt.clear();
    this.rt.beginDraw();
    // Compose the opaque grade and lights in the same batch. A separate fill
    // leaves alpha in the light quads, which darkens their rectangular bounds on blit.
    this.rt.stamp('w-white', undefined, GAME_W / 2, GAME_H / 2, {
      scaleX: GAME_W / 4, scaleY: GAME_H / 4,
      tint: Phaser.Display.Color.GetColor(r * 255, g * 255, b * 255),
      blendMode: Phaser.BlendModes.NORMAL, skipBatch: true,
    });
    // Two-part evening/morning grade: the flat colour sets the luminance, the gradient adds warm → cool contrast.
    for (const k of ['dusk', 'dawn'] as const) {
      const amt = this.grad[k] * (1 - f);
      if (amt < 0.005) continue;
      this.rt.stamp(`w-grad-${k}`, undefined, GAME_W / 2, GAME_H / 2, {
        scaleX: GAME_W / 64 + 0.1, scaleY: GAME_H / 36 + 0.1, alpha: clamp(amt, 0, 1), blendMode: Phaser.BlendModes.MULTIPLY, skipBatch: true,
      });
    }
    const viewR = Math.hypot(cam.worldView.width, cam.worldView.height) / 2;
    for (const l of this.lights.values()) {
      const vis = (l.always ? Math.max(show, 0.6) : show) * l.fade;
      if (vis <= 0.005 || l.intensity <= 0) { l.glow.setAlpha(0); continue; }
      const n = l.flicker > 0 ? this.noise(l.phase) : 0;
      const intensity = l.intensity * (1 - l.flicker * 0.16 * (0.5 + 0.5 * n)) * vis;
      const radius = l.radius * (1 + l.flicker * 0.05 * n);
      if (Math.hypot(l.x - cx, l.y - cy) - radius > viewR) { l.glow.setAlpha(0); continue; }
      const lx = (l.x - cx) / s + GAME_W / 2, ly = (l.y - cy) / s + GAME_H / 2;
      const scale = (radius * 2) / 128 / s;
      this.rt.stamp('w-light', undefined, lx, ly, {
        scale, tint: l.color, alpha: clamp(intensity, 0, 1), blendMode: Phaser.BlendModes.ADD, skipBatch: true,
      });
      // Second, tighter stamp for a brighter core.
      this.rt.stamp('w-light', undefined, lx, ly, {
        scale: scale * 0.45, tint: 0xffffff, alpha: clamp(intensity * 0.5, 0, 1), blendMode: Phaser.BlendModes.ADD, skipBatch: true,
      });
      // Coloured halo in the world.
      l.glow.setPosition(l.x, l.y).setTint(l.color).setScale((radius * 1.3) / 64)
        .setAlpha(clamp(0.28 * intensity, 0, 0.6));
    }
    // endDraw blits with the renderer's current blend mode. Flush the last
    // additive light or multiply gradient before copying the completed mask.
    const renderer = this.scene.game.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) renderer.setBlendMode(Phaser.BlendModes.NORMAL);
    this.rt.endDraw();
  }

  /** Smooth flicker noise in -1..1. */
  private noise(phase: number): number {
    const t = this.t + phase;
    return (Math.sin(t * 13.1) * 0.5 + Math.sin(t * 7.3 + 1.7) * 0.3 + Math.sin(t * 23.7 + 0.4) * 0.2);
  }

  destroy(): void {
    this.clear();
    this.tResolve?.();
    this.rt.destroy();
    this.haze.destroy();
  }
}

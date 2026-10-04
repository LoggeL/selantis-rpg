import Phaser from 'phaser';
import { G } from '../core/G';
import { events } from '../core/events';
import { settings } from '../core/settings';
import { GAME_H, GAME_W } from '../core/viewport';
import type { LightningEvent } from '../audio/api';
import type { TimeOfDay, WeatherKind } from './api';
import type { Rect, Vec } from './geom';

interface Drop { img: Phaser.GameObjects.Image; x: number; y: number; speed: number; len: number; near: boolean; dying: boolean; a: number }
interface Splash { img: Phaser.GameObjects.Image; t: number; life: number; active: boolean; ripple: boolean }
interface Mote {
  img: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; phase: number; spin: number; layer: number;
  frame?: number; base?: string; ax?: number; ay?: number; halo?: Phaser.GameObjects.Image;
}

export interface WeatherHost {
  readonly scene: Phaser.Scene;
  addWorld<T extends Phaser.GameObjects.GameObject>(o: T): T;
  addOverlay<T extends Phaser.GameObjects.GameObject>(o: T): T;
  readonly cam: Phaser.Cameras.Scene2D.Camera;
  readonly playerPos: Vec | undefined;
  /** The map rectangle in px (ambient particles stay inside it). */
  readonly mapRect: Rect;
  flash(color?: number, ms?: number): void;
  isWater(x: number, y: number): boolean;
  isBlocked(x: number, y: number): boolean;
}

const isRain = (k: WeatherKind) => k === 'rain' || k === 'storm';

/** One weather kind with its own fade level. Old layers fade out while the new one fades in (no hard cuts). */
class Layer {
  level: number;
  target = 1;
  rate: number;
  drops: Drop[] = [];
  fog: Phaser.GameObjects.TileSprite[] = [];
  fogLevel = 0;
  fogTarget = 0;
  motes: Mote[] = [];
  constructor(public kind: WeatherKind, public intensity: number, ms: number) {
    this.level = ms <= 0 ? 1 : 0;
    this.rate = 1000 / Math.max(1, ms);
  }
}

/**
 * Weather + ambient particles. Rain streaks live in screen space, splashes, fireflies, leaves and critters in world
 * space around the camera (clamped to the map). A global gusting `wind` value is shared with prop sway.
 */
export class Weather {
  kind: WeatherKind = 'none';
  private layers: Layer[] = [];
  private splashes: Splash[] = [];
  private critters: Mote[] = [];
  private flashRect: Phaser.GameObjects.Rectangle;
  private nextLightning = 6;
  private offLightning: (() => void) | null = null;
  private t = 0;
  wind = 0.3;
  private windTarget = 0.3;
  private windTimer = 0;
  private critterMode: 'none' | 'butterflies' = 'none';
  /** Particles are scattered over the visible area on the next update (the camera view is valid then). */
  private scatterPending = false;

  constructor(private host: WeatherHost) {
    const scene = host.scene;
    this.flashRect = host.addOverlay(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W * 3, GAME_H * 3, 0xdfe9ff, 0)
      .setScrollFactor(0).setDepth(9500).setBlendMode(Phaser.BlendModes.ADD));
    this.offLightning = events.on('audio:lightning', (e?: LightningEvent) => {
      if (this.kind !== 'storm') return;
      this.lightning(e?.strength ?? 0.8, false);
    });
  }

  private get current(): Layer | undefined { const l = this.layers[this.layers.length - 1]; return l && l.target > 0 ? l : undefined; }

  set(kind: WeatherKind, opts: { intensity?: number; ms?: number } = {}): void {
    const ms = opts.ms ?? 1500;
    if (kind === this.kind && opts.intensity === undefined) return;
    const cur = this.current;
    this.kind = kind;
    const intensity = opts.intensity ?? 1;
    // rain <-> storm: keep the falling drops, only change density, slant and fog.
    if (cur && isRain(cur.kind) && isRain(kind)) {
      cur.kind = kind;
      cur.intensity = intensity;
      cur.rate = 1000 / Math.max(1, ms);
      this.resizeDrops(cur);
      cur.fogTarget = kind === 'storm' ? 1 : 0;
      if (kind === 'storm' && !cur.fog.length) this.buildFog(cur);
      this.nextLightning = Math.min(this.nextLightning, 2 + Math.random() * 3);
      return;
    }
    if (cur && kind === cur.kind) { cur.intensity = intensity; if (isRain(kind)) this.resizeDrops(cur); return; }
    // Fade the old layer out (or drop it at once when ms <= 0, e.g. while building a map behind a fade).
    for (const l of this.layers) {
      if (ms <= 0) l.level = 0;
      l.target = 0;
      l.rate = 1000 / Math.max(1, ms * 0.9);
    }
    if (ms <= 0) { for (const l of this.layers) this.destroyLayer(l); this.layers = []; }
    if (kind === 'none') return;
    const layer = new Layer(kind, intensity, ms);
    this.layers.push(layer);
    this.build(layer);
  }

  setCritters(on: boolean): void {
    const mode = on ? 'butterflies' : 'none';
    if (mode === this.critterMode) return;
    for (const c of this.critters) c.img.destroy();
    this.critters = [];
    this.critterMode = mode;
    if (on) {
      const scene = this.host.scene;
      for (let i = 0; i < 5; i++) {
        const variant = i % 3;
        const base = `w-butterfly-${variant}`;
        const img = this.host.addWorld(scene.add.image(0, 0, `${base}-0`).setDepth(70000));
        this.critters.push({ img, x: 0, y: 0, vx: 0, vy: 0, phase: Math.random() * 10, spin: 0, layer: Math.random(), frame: 0, base, ax: 0, ay: 0 });
      }
      this.scatterPending = true;
    }
  }

  private dropCount(l: Layer): number { return Math.round((l.kind === 'storm' ? 300 : 200) * l.intensity); }

  private makeDrop(near: boolean, y?: number): Drop {
    const img = this.host.addOverlay(this.host.scene.add.image(0, 0, near ? 'w-rain-near' : 'w-rain').setScrollFactor(0).setDepth(near ? 9010 : 9000).setOrigin(0.5, 1));
    const d: Drop = {
      img, near, dying: false, a: 1,
      x: Math.random() * (GAME_W + 80) - 40, y: y ?? Math.random() * GAME_H,
      speed: near ? 420 + Math.random() * 120 : 260 + Math.random() * 90, len: near ? 1 + Math.random() * 0.5 : 0.7 + Math.random() * 0.6,
    };
    img.setScale(1, d.len).setVisible(false);
    return d;
  }

  private resizeDrops(l: Layer): void {
    const want = this.dropCount(l);
    const alive = l.drops.filter(d => !d.dying);
    if (alive.length < want) for (let i = alive.length; i < want; i++) l.drops.push(this.makeDrop(i % 5 < 2, -Math.random() * GAME_H));
    else for (let i = want; i < alive.length; i++) alive[i].dying = true;
  }

  private buildFog(l: Layer): void {
    const scene = this.host.scene;
    for (let i = 0; i < 2; i++) {
      const ts = this.host.addWorld(scene.add.tileSprite(GAME_W / 2, GAME_H / 2, GAME_W * 1.6, GAME_H * 1.6, 'w-fog')
        .setScrollFactor(0).setDepth(80000 + i).setAlpha(0));
      ts.setTint(i === 0 ? 0xdfe6ef : 0xcfd8e4);
      if (i === 1) ts.setTileScale(1.6, 1.6);
      l.fog.push(ts);
    }
  }

  private build(l: Layer): void {
    const k = l.kind;
    if (isRain(k)) {
      this.resizeDrops(l);
      this.ensureSplashes();
      this.nextLightning = 3 + Math.random() * 5;
    }
    if (k === 'fog' || k === 'storm') { this.buildFog(l); l.fogTarget = 1; }
    this.scatterPending = true;
    if (k === 'fireflies') this.spawnMotes(l, 44, 'w-firefly', true);
    if (k === 'pollen') this.spawnMotes(l, 46, 'w-pollen', true);
    if (k === 'leaves') this.spawnMotes(l, 34, 'w-leaf-0', false);
  }

  private ensureSplashes(): void {
    if (this.splashes.length) return;
    for (let i = 0; i < 70; i++) {
      const img = this.host.addOverlay(this.host.scene.add.image(0, 0, 'w-splash').setDepth(8000).setVisible(false));
      this.splashes.push({ img, t: 0, life: 0.3, active: false, ripple: false });
    }
  }

  private spawnMotes(l: Layer, n: number, key: string, overlay: boolean): void {
    const scene = this.host.scene;
    for (let i = 0; i < n; i++) {
      const tex = key === 'w-leaf-0' ? `w-leaf-${i % 3}` : key;
      const img = scene.add.image(0, 0, tex).setDepth(overlay ? 7000 : 85000).setAlpha(0);
      if (overlay) { this.host.addOverlay(img); img.setBlendMode(Phaser.BlendModes.ADD); } else this.host.addWorld(img);
      const layer = Math.random();
      const m: Mote = { img, x: 0, y: 0, vx: 0, vy: 0, phase: Math.random() * 100, spin: (Math.random() - 0.5) * 4, layer };
      if (key === 'w-firefly') {
        // Soft additive halo around a tiny body; nearer ones are bigger and blurrier.
        m.halo = this.host.addOverlay(scene.add.image(0, 0, 'w-glow').setDepth(6999).setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xc8ff78).setScale(0.1 + layer * 0.12).setAlpha(0));
        if (layer > 0.75) img.setScale(1.5);
      }
      l.motes.push(m);
    }
  }

  private destroyLayer(l: Layer): void {
    for (const d of l.drops) d.img.destroy();
    for (const f of l.fog) f.destroy();
    for (const m of l.motes) { m.img.destroy(); m.halo?.destroy(); }
    l.drops = []; l.fog = []; l.motes = [];
  }

  /** Re-distributes ambient particles over the view (after a camera jump). */
  rescatter(): void { this.scatterPending = true; }

  lightning(strength = 0.8, withThunder = true): void {
    if (settings.reducedMotion) strength *= 0.4;
    this.host.flash(0xe8f0ff, 380);
    this.flashRect.setAlpha(0.45 * strength);
    this.host.scene.tweens.add({ targets: this.flashRect, alpha: 0, duration: 90, yoyo: true, repeat: 1, onComplete: () => {
      this.host.scene.tweens.add({ targets: this.flashRect, alpha: { from: 0.25 * strength, to: 0 }, duration: 420 });
    } });
    if (withThunder) {
      const delay = 300 + Math.random() * 1600;
      this.host.scene.time.delayedCall(delay, () => { try { G.audio.sfx('thunder', { volume: 0.8, distance: delay / 2200 }); } catch { /* */ } });
    }
  }

  /** Visible part of the map (ambient particles live here, never over the black margin of small maps). */
  private area(): Rect {
    const v = this.host.cam.worldView, m = this.host.mapRect;
    const x0 = Math.max(v.x, m.x), y0 = Math.max(v.y, m.y);
    const x1 = Math.min(v.right, m.x + m.w), y1 = Math.min(v.bottom, m.y + m.h);
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }

  update(dt: number, time: TimeOfDay, grade: [number, number, number], darkness: number, look = 0): void {
    this.t += dt;
    // Gusting wind
    this.windTimer -= dt;
    if (this.windTimer <= 0) {
      this.windTimer = 2 + Math.random() * 4;
      const base = this.kind === 'storm' ? 0.85 : this.kind === 'rain' ? 0.5 : 0.28;
      this.windTarget = base * (0.6 + Math.random() * 0.8);
    }
    this.wind += (this.windTarget - this.wind) * Math.min(1, dt * 0.8);

    const area = this.area();
    if (this.scatterPending && this.host.cam.worldView.width > 0) {
      this.scatterPending = false;
      for (const m of [...this.layers.flatMap(l => l.motes), ...this.critters]) {
        m.x = area.x + Math.random() * area.w; m.y = area.y + Math.random() * area.h;
        if (m.ax !== undefined) { m.ax = m.x; m.ay = m.y; }
        m.img.setPosition(m.x, m.y);
      }
    }

    let rainLevel = 0;
    for (const l of [...this.layers]) {
      if (l.level < l.target) l.level = Math.min(l.target, l.level + dt * l.rate);
      else if (l.level > l.target) l.level = Math.max(l.target, l.level - dt * l.rate);
      const ft = l.target === 0 ? 0 : l.fogTarget;
      l.fogLevel += Math.sign(ft - l.fogLevel) * Math.min(Math.abs(ft - l.fogLevel), dt * l.rate);
      if (l.target === 0 && l.level <= 0 && l.fogLevel <= 0) {
        this.destroyLayer(l);
        this.layers.splice(this.layers.indexOf(l), 1);
        continue;
      }
      if (l.drops.length) { this.updateDrops(l, dt, grade, look, area); rainLevel = Math.max(rainLevel, l.level * l.intensity * (l.kind === 'storm' ? 1.4 : 1)); }
      if (l.fog.length) this.updateFog(l);
      if (l.motes.length) this.updateMotes(l, dt, time, darkness, area);
    }
    if (rainLevel > 0.01 || this.splashes.some(s => s.active)) this.updateSplashes(dt, rainLevel, grade, look, area);
    if (this.kind === 'storm') {
      this.nextLightning -= dt;
      if (this.nextLightning <= 0) {
        this.nextLightning = 6 + Math.random() * 9;
        const audioDrivesIt = (() => { try { return G.audio.currentAmbience().includes('storm'); } catch { return false; } })();
        if (!audioDrivesIt) this.lightning(0.6 + Math.random() * 0.4, true);
      }
    }
    if (this.critters.length) this.updateCritters(dt, time, area);
  }

  private updateDrops(l: Layer, dt: number, grade: [number, number, number], look: number, area: Rect): void {
    const slant = -0.25 - this.wind * (l.kind === 'storm' ? 0.5 : 0.35);
    const g = (grade[0] + grade[1] + grade[2]) / 3;
    const mix = (c: number) => c + (g - c) * look * 0.8;
    const tint = rgb(mix(0.55 + grade[0] * 0.45), mix(0.6 + grade[1] * 0.4), mix(0.7 + grade[2] * 0.3));
    const fade = l.level * (1 - look * 0.6);
    for (let i = l.drops.length - 1; i >= 0; i--) {
      const d = l.drops[i];
      if (d.dying) { d.a -= dt * 2; if (d.a <= 0) { d.img.destroy(); l.drops.splice(i, 1); continue; } }
      d.y += d.speed * dt;
      d.x += d.speed * slant * dt * 0.6;
      if (d.y > GAME_H + 14 || d.x < -50) {
        if (d.dying) { d.img.destroy(); l.drops.splice(i, 1); continue; }
        d.y = -Math.random() * 40;
        d.x = Math.random() * (GAME_W + 140) - 20;
        if (d.near && Math.random() < 0.6) this.splash(area.x + Math.random() * area.w, area.y + Math.random() * area.h);
      }
      const a = (d.near ? 0.42 + 0.22 * d.len : 0.22 + 0.2 * d.len) * fade * d.a;
      d.img.setVisible(a > 0.01);
      if (a > 0.01) d.img.setPosition(d.x, d.y).setRotation(-slant * 0.6).setTint(tint).setAlpha(a);
    }
  }

  private updateSplashes(dt: number, level: number, grade: [number, number, number], look: number, area: Rect): void {
    // Ground splashes and water ripples, scaled by the rain level.
    for (let i = 0; i < 3; i++) if (Math.random() < 0.6 * level) this.splash(area.x + Math.random() * area.w, area.y + Math.random() * area.h);
    const tint = rgb(0.6 + grade[0] * 0.4, 0.65 + grade[1] * 0.35, 0.75 + grade[2] * 0.25);
    for (const s of this.splashes) {
      if (!s.active) continue;
      s.t += dt;
      const k = s.t / s.life;
      if (k >= 1) { s.active = false; s.img.setVisible(false); continue; }
      if (s.ripple) s.img.setScale(0.3 + k * 1.1, 0.3 + k * 0.9).setAlpha((1 - k) * 0.6 * (1 - look * 0.6)).setTint(tint);
      else s.img.setScale(0.4 + k * 0.9, 0.4 + k * 0.7).setAlpha((1 - k) * 0.7 * (1 - look * 0.6)).setTint(tint);
    }
  }

  private updateFog(l: Layer): void {
    const cam = this.host.cam;
    const a = (l.kind === 'storm' ? 0.3 : 0.75) * l.fogLevel * l.intensity;
    l.fog.forEach((f, i) => {
      const par = i === 0 ? 0.7 : 1.15;
      f.tilePositionX = cam.scrollX * par + this.t * (6 + i * 5) * (1 + this.wind);
      f.tilePositionY = cam.scrollY * par + Math.sin(this.t * 0.1 + i) * 6;
      f.setAlpha(a * (i === 0 ? 1 : 0.7) * (0.85 + Math.sin(this.t * 0.4 + i * 2) * 0.15));
      f.setScale(1 / cam.zoom);
    });
  }

  private updateMotes(l: Layer, dt: number, time: TimeOfDay, darkness: number, area: Rect): void {
    const p = this.host.playerPos;
    const margin = 14;
    for (const m of l.motes) {
      m.phase += dt;
      if (l.kind === 'fireflies') {
        // Lazy wandering + faint attraction to Lia (the Urmacht motif).
        m.vx += (Math.sin(m.phase * 0.9 + m.layer * 10) * 10 - m.vx) * dt;
        m.vy += (Math.cos(m.phase * 0.7 + m.layer * 7) * 8 - m.vy) * dt;
        if (p) {
          const dx = p.x - m.x, dy = p.y - 12 - m.y, d = Math.hypot(dx, dy);
          if (d < 90 && d > 18) { m.vx += (dx / d) * 6 * dt; m.vy += (dy / d) * 6 * dt; }
        }
        m.x += m.vx * dt; m.y += m.vy * dt;
        const pulse = Math.max(0, Math.sin(m.phase * (1.2 + m.layer) + m.layer * 6));
        const vis = 0.15 + 0.85 * Math.max(darkness, time === 'day' ? 0.2 : 0.5);
        const a = l.level * vis * (0.15 + 0.85 * pulse * pulse);
        const by = Math.sin(m.phase * 2.3 + m.layer * 5) * 1.6;
        m.img.setPosition(Math.round(m.x), Math.round(m.y + by)).setAlpha(a);
        m.halo?.setPosition(m.x, m.y + by).setAlpha(a * (0.3 + m.layer * 0.15)).setScale((0.1 + m.layer * 0.12) * (0.85 + 0.25 * pulse));
      } else if (l.kind === 'pollen') {
        m.x += (Math.sin(m.phase * 0.6 + m.layer * 9) * 6 + this.wind * 10) * dt;
        m.y += (Math.cos(m.phase * 0.5 + m.layer * 5) * 4 - 2) * dt;
        m.img.setPosition(m.x, m.y).setAlpha(l.level * (0.25 + 0.4 * (0.5 + 0.5 * Math.sin(m.phase * 2 + m.layer * 4))));
      } else {
        // leaves: fall + flutter + wind drift
        m.y += (14 + m.layer * 10) * dt;
        m.x += (Math.sin(m.phase * 1.7 + m.layer * 9) * 16 + this.wind * 30) * dt;
        m.img.setPosition(m.x, m.y).setRotation(Math.sin(m.phase * 2.2 + m.layer) * 1.2 + m.phase * m.spin * 0.3)
          .setScale(1, 0.6 + 0.4 * Math.abs(Math.sin(m.phase * 3 + m.layer * 3))).setAlpha(l.level);
      }
      // Wrap around the visible part of the map.
      if (m.x < area.x - margin) m.x += area.w + margin * 2;
      if (m.x > area.x + area.w + margin) m.x -= area.w + margin * 2;
      if (m.y < area.y - margin) m.y += area.h + margin * 2;
      if (m.y > area.y + area.h + margin) m.y -= area.h + margin * 2;
    }
  }

  private updateCritters(dt: number, time: TimeOfDay, area: Rect): void {
    const show = time === 'day' || time === 'dawn' ? 1 : 0;
    const inset = 10;
    for (const c of this.critters) {
      c.phase += dt;
      // fluttery path around a drifting anchor
      c.ax! += Math.sin(c.phase * 0.21 + c.layer) * 8 * dt;
      c.ay! += Math.cos(c.phase * 0.17) * 5 * dt;
      if (c.ax! < area.x - 30 || c.ax! > area.x + area.w + 30 || c.ay! < area.y - 30 || c.ay! > area.y + area.h + 30) {
        c.ax = area.x + inset + Math.random() * Math.max(1, area.w - inset * 2); c.ay = area.y + inset + Math.random() * Math.max(1, area.h - inset * 2);
        c.x = c.ax; c.y = c.ay;
      }
      c.x += ((c.ax! + Math.sin(c.phase * 1.3) * 18) - c.x) * dt * 1.5;
      c.y += ((c.ay! + Math.sin(c.phase * 2.1) * 10 - Math.abs(Math.sin(c.phase * 5)) * 3) - c.y) * dt * 1.5;
      const m = this.host.mapRect;
      const inside = c.x > m.x + 4 && c.x < m.x + m.w - 4 && c.y > m.y + 4 && c.y < m.y + m.h - 4;
      const f = Math.floor(c.phase * 9) % 2;
      if (f !== c.frame) { c.frame = f; c.img.setTexture(`${c.base}-${f}`); }
      c.img.setPosition(c.x, c.y).setAlpha(inside ? show : 0).setDepth(c.y + 30);
    }
  }

  private splash(x: number, y: number): void {
    const water = this.host.isWater(x, y);
    if (this.host.isBlocked(x, y) && !water) return;
    const s = this.splashes.find(sp => !sp.active);
    if (!s) return;
    s.active = true; s.t = 0; s.ripple = water; s.life = water ? 0.65 : 0.28;
    s.img.setTexture(water ? 'w-ripple' : 'w-splash').setPosition(x, y).setVisible(true).setAlpha(0);
  }

  destroy(): void {
    for (const l of this.layers) this.destroyLayer(l);
    this.layers = [];
    for (const s of this.splashes) s.img.destroy();
    this.splashes = [];
    for (const c of this.critters) c.img.destroy();
    this.critters = [];
    this.offLightning?.();
    this.flashRect.destroy();
  }
}

function rgb(r: number, g: number, b: number): number {
  const c = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

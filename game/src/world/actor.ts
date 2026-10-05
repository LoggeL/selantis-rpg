import Phaser from 'phaser';
import type { CharAnim, CharacterSpec, TerrainId } from '../art/api';
import { G } from '../core/G';
import type { Dir } from '../core/types';
import type { EmoteKind } from './api';
import { terrainPuff, terrainStep } from './ascii';
import { clamp, dirFromVector, type Vec } from './geom';
import type { CollisionGrid } from './grid';
import { emoteKey } from './textures';

/** What actors need from the world scene (implemented by WorldScene). */
export interface ActorHost {
  readonly scene: Phaser.Scene;
  readonly grid: CollisionGrid;
  readonly timeSec: number;
  terrainAt(x: number, y: number): TerrainId | undefined;
  addWorld<T extends Phaser.GameObjects.GameObject>(obj: T): T;
  addOverlay<T extends Phaser.GameObjects.GameObject>(obj: T): T;
  toScreen(x: number, y: number): Vec;
  onScreen(x: number, y: number, margin?: number): boolean;
  puff(x: number, y: number, kind: 'dust' | 'splash' | 'grass', strength?: number): void;
  readonly playerPos: Vec | undefined;
  /** How many px an actor standing here sinks into tall terrain (wheat), 0 = none. */
  sinkAt(x: number, y: number): number;
  /** Shared wind value (0..1) for the stalks in front of a sunk actor. */
  readonly wind: number;
  /** 0..1: how long shadows are (dusk/dawn sun from the top-left). */
  readonly longShadow: number;
  /** Perspective scale at a feet y (MapDef.depthScale), 1 = none. */
  scaleAt(y: number): number;
  /** World scale (1 on ASCII maps, ~1.75 on painted maps): strides, hops. */
  readonly worldK: number;
  /** Base sprite scale for a character texture on this map (MapDef.spriteScale, procedural fallbacks ×2). */
  spriteScale(charKey: string, frame: { w: number; h: number }): number;
}

export type ActorKind = 'player' | 'npc' | 'companion' | 'guard';

export const SHADOW_DEPTH = -200;

/** A character in the world: sprite + shadow + movement along paths + animation selection + emotes. */
export class Actor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  charKey: string;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  dir: Dir;
  idleAnim: CharAnim = 'idle';
  walkSpeed = 45;
  runSpeed = 96;
  /** Movement style flags (set by controllers, used for animation + detection). */
  sneaking = false;
  running = false;
  solid = true;
  held = false;
  visible = true;
  /** Scripted path following. */
  path: Vec[] | null = null;
  /** The current path is an idle wander step (NPC logic may cancel it; scripted walks are never cancelled). */
  wandering = false;
  private pathSpeed = 45;
  private pathRun = false;
  private pathResolve: (() => void) | null = null;
  private pathFace: Dir | undefined;
  private override: { anim: CharAnim; until: number } | null = null;
  private stepAcc = 0;
  private puffAcc = 0;
  private hopY = 0;
  private emoteImg: Phaser.GameObjects.Image | null = null;
  private emoteTween: Phaser.Tweens.Tween | null = null;
  private playingKey = '';
  /** Frame size of the character texture (64x64 for Codex sheets, 24x24/32x32 for procedural fallbacks). */
  size: { w: number; h: number };
  /** Visible figure size inside the frame (unscaled). */
  private fig = { w: 16, h: 24 };
  /** Base sprite scale (map) × perspective scale; updated in sync(). */
  scale = 1;
  private baseScale = 1;
  /** Extra alpha multiplier (hidden in bush). */
  fade = 1;

  /** Extra depth (px) added to y-sorting, e.g. the player wins ties against followers, or sits on a stump. */
  depthBias = 0;
  /** Set once destroy() ran (bubble anchors and handles check it). */
  destroyed = false;
  /** Current sink depth into wheat (px, smoothed). */
  private sink = 0;
  private front: Phaser.GameObjects.Image | null = null;
  private frontPhase = Math.random() * 6;
  private rustle = 0;
  private shadowW = 1;

  constructor(
    readonly host: ActorHost,
    readonly id: string,
    public kind: ActorKind,
    look: string | CharacterSpec,
    at: Vec,
    dir: Dir = 'down',
    public speaker: string = id,
  ) {
    const scene = host.scene;
    this.charKey = Actor.makeKey(scene, id, look);
    this.size = safeSize(this.charKey);
    this.x = at.x; this.y = at.y; this.dir = dir;
    // Crisp pixel shadows: a small and a large variant instead of stretching one texture.
    this.shadow = host.addWorld(scene.add.image(at.x, at.y, 'w-shadow').setOrigin(0.5, 0.5).setDepth(SHADOW_DEPTH));
    this.sprite = host.addWorld(scene.add.sprite(at.x, at.y, this.charKey));
    this.applyLook();
    this.applyAnim(true);
    this.sync();
  }

  static makeKey(scene: Phaser.Scene, id: string, look: string | CharacterSpec): string {
    try {
      return typeof look === 'string' ? G.art.character(scene, look) : G.art.character(scene, look, `char-w-${id}`);
    } catch (err) {
      console.warn(`[world] character '${typeof look === 'string' ? look : id}' failed, using fallback`, err);
      return G.art.character(scene, { skin: '#e8c39e', top: { style: 'shirt', color: '#6a6a8a' } }, `char-w-fallback`);
    }
  }

  setLook(look: string | CharacterSpec): void {
    this.charKey = Actor.makeKey(this.host.scene, this.id, look);
    this.sprite.setTexture(this.charKey);
    this.size = safeSize(this.charKey);
    this.applyLook();
    this.playingKey = '';
    this.applyAnim(true);
  }

  /** Origin from the art anchor (feet), figure size and base scale for the current texture. */
  private applyLook(): void {
    let anchor = { x: 0.5, y: 1 };
    try { anchor = G.art.characterAnchor(this.charKey) ?? anchor; } catch { /* default */ }
    this.sprite.setOrigin(anchor.x, anchor.y);
    const { w, h } = this.size;
    // Codex sheets: 64x64 frames, ~42 px figure; procedural fallbacks: the frame is the figure (plus weapon room).
    this.fig = h >= 48 ? { w: Math.round(w * 0.34), h: Math.round(h * anchor.y * 0.74) } : { w: Math.round(w * 0.67), h: Math.round(h * anchor.y) };
    this.baseScale = this.host.spriteScale(this.charKey, this.size);
    this.shadow.setTexture(this.fig.w * this.baseScale > 15 ? 'w-shadow-l' : 'w-shadow');
  }

  get speed(): number { return Math.hypot(this.vx, this.vy); }
  get moving(): boolean { return this.speed > 4; }
  /** Visible figure size in world px (scaled). */
  get figureW(): number { return this.fig.w * this.scale; }
  get figureH(): number { return this.fig.h * this.scale; }
  get headY(): number { return this.y - this.figureH; }

  teleport(x: number, y: number, dir?: Dir): void {
    this.x = x; this.y = y; this.vx = this.vy = 0;
    if (dir) this.dir = dir;
    this.sync();
    this.applyAnim(true);
  }

  face(dir: Dir): void {
    if (this.dir === dir) return;
    this.dir = dir;
    this.applyAnim(true);
  }

  faceTowards(x: number, y: number): void {
    const dx = x - this.x, dy = y - this.y;
    if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
    this.face(dirFromVector(dx, dy));
  }

  /** Follows a list of px waypoints. Resolves on arrival (or when replaced/stopped). */
  moveAlong(points: Vec[], speed: number, run = false, face?: Dir): Promise<void> {
    this.finishPath();
    this.wandering = false;
    if (!points.length) { if (face) this.face(face); return Promise.resolve(); }
    this.path = points.slice();
    this.pathSpeed = speed;
    this.pathRun = run;
    this.pathFace = face;
    return new Promise(resolve => { this.pathResolve = resolve; });
  }

  stopPath(): void { this.finishPath(); this.vx = this.vy = 0; }

  private finishPath(): void {
    const r = this.pathResolve;
    this.path = null;
    this.pathResolve = null;
    if (this.pathFace) { this.face(this.pathFace); this.pathFace = undefined; }
    r?.();
  }

  /** Plays an animation once (or for ms), then falls back to automatic selection. */
  playOnce(anim: CharAnim, ms?: number): Promise<void> {
    const key = G.art.animKey(this.charKey, anim, this.dir);
    const animObj = this.host.scene.anims.get(key);
    const dur = ms ?? (animObj ? Math.max(250, (animObj.frames.length / Math.max(1, animObj.frameRate)) * 1000) : 500);
    this.override = { anim, until: this.host.timeSec + dur / 1000 };
    this.playKey(key, true);
    return new Promise(resolve => this.host.scene.time.delayedCall(dur, () => resolve()));
  }

  /** Holds an animation until cleared with clearOverride(). */
  hold(anim: CharAnim): void {
    this.override = { anim, until: Infinity };
    this.applyAnim(true);
  }
  clearOverride(): void { this.override = null; this.applyAnim(true); }

  hop(): Promise<void> {
    return new Promise(resolve => {
      const o = { t: 0 };
      this.host.scene.tweens.add({
        targets: o, t: 1, duration: 260, ease: 'Linear',
        onUpdate: () => { this.hopY = -Math.sin(o.t * Math.PI) * 5 * this.host.worldK; },
        onComplete: () => { this.hopY = 0; resolve(); },
      });
    });
  }

  emote(kind: EmoteKind, ms = 1400): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    const scene = this.host.scene;
    this.emoteTween?.stop();
    this.emoteImg?.destroy();
    const img = this.host.addOverlay(scene.add.image(this.x, this.headY - 3, emoteKey(kind)).setOrigin(0.5, 1).setDepth(5000));
    img.setScale(0);
    this.emoteImg = img;
    scene.tweens.add({ targets: img, scale: { from: 0, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    return new Promise(resolve => {
      this.emoteTween = scene.tweens.add({
        targets: img, alpha: 0, delay: ms, duration: 220,
        onComplete: () => { if (this.emoteImg === img) this.emoteImg = null; img.destroy(); resolve(); },
        onStop: () => resolve(),
      });
    });
  }

  setVisible(on: boolean): void {
    if (this.destroyed) return;
    this.visible = on;
    this.sprite.setVisible(on);
    this.shadow.setVisible(on);
    if (!on) { this.emoteImg?.destroy(); this.emoteImg = null; }
  }

  /** Path following + animation + depth. Controllers may set vx/vy themselves and call integrate=false. */
  update(dt: number, integrate = true): void {
    if (integrate && this.path) this.followPath(dt);
    this.applyAnim(false);
    this.footsteps(dt);
    this.updateSink(dt);
    this.sync();
  }

  /** Wading through wheat: the legs disappear in the stalks and a few stalks are drawn in front of the body. */
  private updateSink(dt: number): void {
    const target = this.visible ? this.host.sinkAt(this.x, this.y) : 0;
    this.sink += (target - this.sink) * Math.min(1, dt * 12);
    if (Math.abs(this.sink - target) < 0.05) this.sink = target;
    if (this.moving && target > 0) this.rustle = Math.min(1, this.rustle + dt * 4);
    else this.rustle = Math.max(0, this.rustle - dt * 2.5);
    if (this.sink > 0.6 && !this.front) {
      this.front = this.host.addWorld(this.host.scene.add.image(this.x, this.y, this.fig.w > 12 ? 'w-wheat-front-l' : 'w-wheat-front').setOrigin(0.5, 1));
    }
  }

  private followPath(dt: number): void {
    const path = this.path!;
    const target = path[0];
    const dx = target.x - this.x, dy = target.y - this.y;
    const d = Math.hypot(dx, dy);
    const speed = this.pathSpeed;
    const step = speed * dt;
    if (d <= Math.max(0.5, step)) {
      this.x = target.x; this.y = target.y;
      path.shift();
      if (!path.length) { this.vx = this.vy = 0; this.finishPath(); return; }
      return;
    }
    this.vx = (dx / d) * speed;
    this.vy = (dy / d) * speed;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.running = this.pathRun;
    this.dir = dirFromVector(this.vx, this.vy, this.dir);
  }

  private animFor(): CharAnim {
    if (this.override) {
      if (this.host.timeSec < this.override.until) return this.override.anim;
      this.override = null;
    }
    const s = this.speed;
    if (s > 4) {
      if (this.sneaking) return 'sneak';
      if (this.running || s > this.walkSpeed * 1.3) return 'run';
      return 'walk';
    }
    if (this.sneaking) return this.hasAnim('crouch' as CharAnim) ? ('crouch' as CharAnim) : 'sneak';
    return this.idleAnim;
  }

  /** True if the art layer generated this animation for the character (optional extras like 'crouch'). */
  private hasAnim(anim: CharAnim): boolean {
    return this.host.scene.anims.exists(G.art.animKey(this.charKey, anim, this.dir));
  }

  private applyAnim(force: boolean): void {
    const anim = this.animFor();
    const key = G.art.animKey(this.charKey, anim, this.dir);
    this.playKey(key, force);
    const s = this.speed;
    const sprite = this.sprite;
    if (anim === 'walk' || anim === 'run' || anim === 'sneak') {
      const nominal = anim === 'run' ? this.runSpeed : anim === 'sneak' ? 34 * this.host.worldK : this.walkSpeed;
      if (anim === 'sneak' && s < 4) { if (!sprite.anims.isPaused) sprite.anims.pause(); }
      else {
        if (sprite.anims.isPaused) sprite.anims.resume();
        sprite.anims.timeScale = clamp(s / nominal, 0.55, 1.7);
      }
    } else {
      if (sprite.anims.isPaused) sprite.anims.resume();
      sprite.anims.timeScale = 1;
    }
  }

  private playKey(key: string, force: boolean): void {
    if (!force && key === this.playingKey) return;
    if (key === this.playingKey && this.sprite.anims.isPlaying) return;
    if (this.host.scene.anims.exists(key)) {
      this.sprite.play(key, true);
      this.playingKey = key;
    }
  }

  private footsteps(dt: number): void {
    const s = this.speed;
    if (s < 4 || !this.visible) { this.stepAcc = Math.min(this.stepAcc, 6); return; }
    const moved = s * dt;
    this.stepAcc += moved;
    const stride = (this.sneaking ? 11 : this.running || s > this.walkSpeed * 1.3 ? 19 : 14) * this.host.worldK;
    const terrain = this.host.terrainAt(this.x, this.y);
    if (this.stepAcc >= stride) {
      this.stepAcc -= stride;
      this.stepSound(terrain);
    }
    // Dust/grass/splash puffs when running (or wading)
    const puff = terrainPuff(terrain);
    const fast = this.running || s > this.walkSpeed * 1.3;
    if (puff && (fast || (puff === 'splash' && s > 10)) && this.host.onScreen(this.x, this.y, 16)) {
      this.puffAcc += moved;
      const every = (puff === 'grass' ? 14 : 9) * this.host.worldK;
      if (this.puffAcc >= every) {
        this.puffAcc = 0;
        this.host.puff(this.x - Math.sign(this.vx) * 3, this.y, puff, fast ? 1 : 0.6);
      }
    }
  }

  private stepSound(terrain: TerrainId | undefined): void {
    const name = terrainStep(terrain);
    const p = this.host.playerPos;
    let volume: number;
    let pan = 0;
    if (this.kind === 'player') volume = this.sneaking ? 0.22 : this.running ? 0.6 : 0.42;
    else {
      if (!p || !this.host.onScreen(this.x, this.y, 24)) return;
      const d = Math.hypot(this.x - p.x, this.y - p.y);
      volume = Math.max(0, 0.28 * (1 - d / 220)) * (this.sneaking ? 0.5 : 1);
      if (volume < 0.03) return;
      pan = clamp((this.host.toScreen(this.x, this.y).x - 240) / 240, -1, 1) * 0.7;
    }
    try { G.audio.sfx(name, { volume, pitch: 0.92 + Math.random() * 0.16, pan, key: `step-${this.id}` }); } catch { /* audio optional */ }
  }

  /** Writes position/depth to the sprite and its attachments. */
  sync(): void {
    const x = this.x, y = this.y;
    const sc = this.baseScale * this.host.scaleAt(y);
    if (Math.abs(sc - this.scale) > 0.001 || this.sprite.scaleX !== sc) { this.scale = sc; this.sprite.setScale(sc); }
    this.sprite.setPosition(x, y + this.hopY);
    this.sprite.setDepth(y + this.depthBias);
    this.sprite.setAlpha(this.fade);
    // Sinking into wheat: crop the bottom rows of the frame (the sprite keeps its feet origin, so the legs vanish).
    const k = Math.round(this.sink);
    const fr = this.sprite.frame;
    // The sink is in world px; the crop works in frame px (minus the transparent rows under the feet anchor).
    const below = fr ? fr.realHeight * (1 - this.sprite.originY) : 0;
    if (k > 0 && fr) this.sprite.setCrop(0, 0, fr.realWidth, Math.max(1, Math.round(fr.realHeight - below - k / this.scale)));
    else if (this.sprite.isCropped) this.sprite.setCrop();
    if (this.front) {
      const on = this.sink > 0.6 && this.visible;
      this.front.setVisible(on);
      if (on) {
        const t = this.host.timeSec;
        const sway = Math.sin(t * 1.7 + this.frontPhase) * (0.4 + this.host.wind) + Math.sin(t * 31) * 1.2 * this.rustle;
        this.front.setScale(this.scale).setPosition(Math.round(x + sway), Math.round(y + 2 - Math.max(0, 7 - this.sink) * 0.5))
          .setDepth(this.sprite.depth + 0.5).setAlpha(Math.min(1, this.sink / 4) * Math.max(this.fade, 0.85));
      }
    }
    // Long evening shadows fall to the bottom-right (light from the top-left, DESIGN.md §3).
    const ls = this.host.longShadow;
    const shScale = Math.max(1, this.figureW / (this.shadow.texture.key === 'w-shadow-l' ? 15 : 10));
    const sw = (1 + ls * 0.6) * shScale;
    if (Math.abs(sw - this.shadowW) > 0.01 || this.shadow.scaleY !== shScale) { this.shadowW = sw; this.shadow.setScale(sw, shScale); }
    this.shadow.setPosition(Math.round(x + ls * 4 * shScale), y - 0.5);
    this.shadow.setAlpha((this.hopY < 0 ? 0.7 : 1) * (k > 3 ? 0 : 1) * (this.fade < 1 ? 0.6 : 1));
    if (this.emoteImg) this.emoteImg.setPosition(x, this.headY - 3 + this.hopY + Math.sin(this.host.timeSec * 6) * 0.6);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.finishPath();
    this.visible = false;
    this.destroyed = true;
    this.emoteTween?.stop();
    this.emoteImg?.destroy();
    this.emoteImg = null;
    this.front?.destroy();
    this.front = null;
    this.sprite.destroy();
    this.shadow.destroy();
  }
}

function safeSize(key: string): { w: number; h: number } {
  try { return G.art.characterSize(key); } catch { return { w: 16, h: 24 }; }
}

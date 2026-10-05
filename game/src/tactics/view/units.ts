import Phaser from 'phaser';
import type { CharAnim } from '../../art/api';
import { G } from '../../core/G';
import type { BattleUnitDef } from '../api';
import type { Facing, StatusId, Unit } from '../rules/types';
import { IsoView } from './iso';

/** Multiplies two colours; `k` blends the second toward white first (0 = no effect, 1 = full). */
function mulColor(a: number, b: number, k = 1): number {
  const ch = (sh: number) => {
    const ca = (a >> sh) & 255, cb = 255 - (255 - ((b >> sh) & 255)) * k;
    return Math.round((ca * cb) / 255) << sh;
  };
  return ch(16) | ch(8) | ch(0);
}

/** Feet sit slightly below the tile centre so figures read as standing *on* the block. */
const FOOT = 3;

const STATUS_ORDER: StatusId[] = ['guarded', 'evasive', 'taunt', 'stunned', 'burning', 'bound'];

/** Resolves the sprite texture for a unit: generated asset or art preset if known, else its custom spec. */
export function resolveCharacter(scene: Phaser.Scene, def: BattleUnitDef, battleId: string, bound = false): string {
  if (bound && def.boundPreset) {
    try { if (G.art.hasAsset('character', def.boundPreset)) return G.art.character(scene, def.boundPreset); } catch { /* fall through */ }
  }
  let ids: string[] = [];
  try { ids = G.art.characterIds(); } catch { /* art not ready */ }
  let asset = false;
  try { asset = !!def.preset && G.art.hasAsset('character', def.preset); } catch { /* older art layer */ }
  if (def.preset && (asset || ids.includes(def.preset))) return G.art.character(scene, def.preset);
  if (def.spec) return G.art.character(scene, def.spec, `tac-${battleId}-${def.id}`);
  return G.art.character(scene, def.preset ?? def.id);
}

/** Character ids a battle needs from the asset pipeline (for G.art.preload). */
export function characterIdsOf(defs: BattleUnitDef[]): string[] {
  return [...new Set(defs.flatMap(d => [d.preset, d.boundPreset]).filter((p): p is string => !!p))];
}

/**
 * Pose fallbacks: generated sheets name some poses differently ('hurt' for hit, 'lie' for fall) and
 * not every character has every pose. The first existing animation wins, idle is the last resort.
 */
const POSE_CHAIN: Partial<Record<CharAnim, string[]>> = {
  hit: ['hit', 'hurt'],
  fall: ['fall', 'lie', 'hurt', 'kneel'],
  kneel: ['kneel', 'crouch', 'hurt'],
  shoot: ['shoot', 'attack'],
  cast: ['cast', 'attack'],
  interact: ['interact', 'attack'],
  attack: ['attack'],
  walk: ['walk'],
  sit: ['sit', 'kneel'],
};

interface Metrics { scale: number; figH: number; ax: number; ay: number }
const metricsCache = new Map<string, Metrics>();

/**
 * Size of a character on the battlefield. Generated sheets (64x64 frames, ~42 px figures) are drawn 1:1;
 * the small procedural fallback (24 px frames) is doubled so units keep the same presence on 48 px tiles.
 * The figure height is measured from the first frame's opaque pixels.
 */
export function characterMetrics(scene: Phaser.Scene, charKey: string): Metrics {
  const hit = metricsCache.get(charKey);
  if (hit) return hit;
  let size = { w: 24, h: 24 };
  try { size = G.art.characterSize(charKey); } catch { /* default */ }
  let anchor = { x: 0.5, y: 1 };
  try { anchor = G.art.characterAnchor(charKey); } catch { /* default */ }
  const scale = size.h <= 32 ? 2 : 1;
  let top = 0;
  try {
    const tex = scene.textures.get(charKey);
    const frame = tex.get(tex.getFrameNames()[0] ?? '__BASE');
    const src = frame.source.image as HTMLImageElement | HTMLCanvasElement;
    const c = document.createElement('canvas');
    c.width = frame.cutWidth; c.height = frame.cutHeight;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(src, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    outer: for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { top = y; break outer; }
  } catch { top = Math.round(size.h * 0.1); }
  const footY = anchor.y * size.h;
  const m: Metrics = { scale, figH: Math.max(16, Math.round((footY - top) * scale)), ax: anchor.x, ay: anchor.y };
  metricsCache.set(charKey, m);
  return m;
}

/**
 * Visual representation of one unit: character sprite, shadow, team ring, facing arrow, HP pips and
 * status icons — all positioned in iso space with depth sorting by grid position and height.
 */
export class UnitView {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly ring: Phaser.GameObjects.Image;
  readonly arrow: Phaser.GameObjects.Image;
  readonly hp: Phaser.GameObjects.Graphics;
  private icons: Phaser.GameObjects.Image[] = [];
  charKey: string;
  frameH: number;
  /** Fractional grid position and height (tweened during movement). */
  gx: number;
  gy: number;
  z: number;
  /** Extra screen offset (lunges, hops, knockback shake). */
  ox = 0;
  oy = 0;
  facing: Facing;
  private anim: CharAnim = 'idle';
  private hpShown = -1;
  private down: false | 'dead' | 'wounded' = false;
  selected = false;
  active = false;
  hiddenInBush = false;
  private cinematic = false;

  constructor(private scene: Phaser.Scene, private iso: IsoView, readonly unit: Unit, readonly def: BattleUnitDef, battleId: string, z: number) {
    this.charKey = resolveCharacter(scene, def, battleId, !!unit.statuses.bound);
    this.boundLook = !!unit.statuses.bound && !!def.boundPreset;
    const m = characterMetrics(scene, this.charKey);
    this.frameH = m.figH;
    this.gx = unit.x; this.gy = unit.y; this.z = z;
    this.facing = unit.facing;
    this.shadow = scene.add.image(0, 0, 'tac-shadow').setOrigin(0.5, 0.5);
    this.ring = scene.add.image(0, 0, `tac-ring-${unit.team}`).setOrigin(0.5, 0.5);
    this.arrow = scene.add.image(0, 0, `tac-face-${unit.team}`).setOrigin(0.5, 0.5);
    this.sprite = scene.add.sprite(0, 0, this.charKey).setOrigin(m.ax, m.ay).setScale(m.scale);
    this.hp = scene.add.graphics();
    this.play('idle');
    this.layout();
    this.refresh(unit);
  }

  private boundLook = false;
  /** Switches from the bound look (boundPreset) to the normal one once freed. */
  unbind(battleId: string): void {
    if (!this.boundLook) return;
    this.boundLook = false;
    this.charKey = resolveCharacter(this.scene, this.def, battleId, false);
    const m = characterMetrics(this.scene, this.charKey);
    this.frameH = m.figH;
    this.sprite.setTexture(this.charKey).setOrigin(m.ax, m.ay).setScale(m.scale);
  }

  /** Team colours may change (freed prisoner joins the player). */
  setTeam(team: Unit['team']): void {
    this.ring.setTexture(`tac-ring-${team}`);
    this.arrow.setTexture(`tac-face-${team}`);
    this.hpShown = -1;
  }

  get feet(): { x: number; y: number } {
    const c = this.iso.center(this.gx, this.gy, this.z);
    return { x: Math.round(c.x + this.ox), y: Math.round(c.y + FOOT + this.oy) };
  }
  /** Screen point above the head (for numbers, bubbles, icons). */
  get head(): { x: number; y: number } { const f = this.feet; return { x: f.x, y: f.y - this.frameH - 2 }; }
  /** Screen rectangle of the visible figure (not the whole sheet frame). */
  figureRect(): Phaser.Geom.Rectangle { const f = this.feet; return new Phaser.Geom.Rectangle(f.x - 11, f.y - this.frameH, 22, this.frameH + 2); }
  get chest(): { x: number; y: number } { const f = this.feet; return { x: f.x, y: f.y - Math.round(this.frameH * 0.55) }; }

  depth(): number {
    return Math.max(this.iso.depthKey(Math.ceil(this.gx - 0.001), Math.ceil(this.gy - 0.001)), this.iso.depthKey(Math.floor(this.gx), Math.floor(this.gy))) * 100 + 50;
  }

  layout(): void {
    const c = this.iso.center(this.gx, this.gy, this.z);
    const fx = Math.round(c.x + this.ox), fy = Math.round(c.y + FOOT + this.oy);
    const ground = this.iso.center(this.gx, this.gy, this.z);
    const d = this.depth();
    this.sprite.setPosition(fx, fy).setDepth(d + 2);
    this.shadow.setPosition(Math.round(ground.x + this.ox), Math.round(ground.y + FOOT)).setDepth(d - 3);
    this.ring.setPosition(Math.round(ground.x + this.ox), Math.round(ground.y + FOOT)).setDepth(d - 2);
    const sd = this.iso.screenDir(this.facing);
    const len = Math.hypot(sd.x, sd.y) || 1;
    this.arrow.setPosition(Math.round(ground.x + this.ox + (sd.x / len) * 14), Math.round(ground.y + FOOT + (sd.y / len) * 7)).setDepth(d - 1);
    this.arrow.setFlipX(sd.x < 0).setFlipY(sd.y < 0);
    this.hp.setPosition(fx, fy - this.frameH - 5).setDepth(d + 3);
    this.icons.forEach((ic, i) => ic.setPosition(fx - (this.icons.length - 1) * 4 + i * 8, fy - this.frameH - 10).setDepth(d + 4));
    const alpha = this.down === 'dead' ? this.sprite.alpha : 1;
    void alpha;
  }

  setFacing(f: Facing): void {
    this.facing = f;
    this.play(this.anim, true);
    this.layout();
  }

  /** Re-applies facing after a camera rotation. */
  reorient(): void { this.play(this.anim, true); this.layout(); }

  /** Animation key for a pose, following the fallback chain (idle last). */
  animFor(anim: CharAnim): string | null {
    const dir = this.iso.spriteDir(this.facing);
    for (const a of [...(POSE_CHAIN[anim] ?? [anim]), 'idle']) {
      let k: string;
      try { k = G.art.animKey(this.charKey, a as CharAnim, dir); } catch { continue; }
      if (this.scene.anims.exists(k)) return k;
    }
    return null;
  }

  play(anim: CharAnim, keepFrame = false): void {
    this.anim = anim;
    const k = this.animFor(anim);
    if (!k) return;
    if (keepFrame && this.sprite.anims.currentAnim?.key === k) return;
    this.sprite.play(k, true);
  }

  /** Plays a one-shot animation and resolves when it ends (or after maxMs). */
  playOnce(anim: CharAnim, maxMs = 520): Promise<void> {
    this.play(anim);
    return new Promise(resolve => {
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, finish);
      this.scene.time.delayedCall(maxMs, finish);
    });
  }

  idle(): void {
    if (this.down === 'wounded') { this.play('kneel'); return; }
    if (this.down === 'dead') return;
    this.play(this.unit.statuses.bound ? 'sit' : 'idle');
  }

  flash(color = 0xffffff, ms = 70): void {
    this.sprite.setTintFill(color);
    this.scene.time.delayedCall(ms, () => { this.sprite.clearTint(); this.applyTint(); });
  }

  private applyTint(): void {
    const m = (c: number) => mulColor(c, this.light);
    if (this.down === 'wounded') this.sprite.setTint(m(0x9a8f90));
    else if (this.unit.statuses.bound) this.sprite.setTint(m(0xd8d0c8));
    else if (this.isDone) this.sprite.setTint(m(0xb8bcc8));
    else if (this.light !== 0xffffff) this.sprite.setTint(this.light);
    else this.sprite.clearTint();
  }

  /** Scene light (backdrop grading), applied softer than on the terrain so units stay readable. */
  light = 0xffffff;
  setLight(tint: number): void {
    this.light = mulColor(0xffffff, tint, 0.55);
    this.applyTint();
  }

  isDone = false;

  /** Syncs HP pips, status icons and tint with the rules unit. */
  refresh(u: Unit, done = false): void {
    this.isDone = done && u.team === 'player';
    if (u.down && !this.down) this.down = u.down;
    if (u.team !== this.unit.team) this.setTeam(u.team);
    // HP pips
    if (this.hpShown !== u.hp || done !== this.wasDone) {
      this.wasDone = done;
      this.hpShown = u.hp;
      const g = this.hp;
      g.clear();
      if (!u.down) {
        const w = 18, ratio = Math.max(0, u.hp / u.maxHp);
        g.fillStyle(0x140f18, 0.9).fillRect(-w / 2 - 1, -1, w + 2, 4);
        g.fillStyle(0x3a2830, 1).fillRect(-w / 2, 0, w, 2);
        const col = u.team === 'enemy' ? (ratio > 0.5 ? 0xe0603e : 0xd4573b) : ratio > 0.5 ? 0x7ccf6a : ratio > 0.25 ? 0xe6c25a : 0xe0603e;
        g.fillStyle(col, 1).fillRect(-w / 2, 0, Math.max(1, Math.round(w * ratio)), 2);
        g.fillStyle(0xffffff, 0.35).fillRect(-w / 2, 0, Math.max(1, Math.round(w * ratio)), 1);
      }
    }
    // Status icons
    const want = STATUS_ORDER.filter(s => (u.statuses[s] ?? 0) > 0);
    if (u.down === 'wounded') want.push('wounded' as StatusId);
    const have = this.icons.map(i => i.getData('s') as string);
    if (want.join() !== have.join()) {
      this.icons.forEach(i => i.destroy());
      this.icons = want.map(s => this.scene.add.image(0, 0, `tac-st-${s}`).setOrigin(0.5, 0.5).setData('s', s));
    }
    this.ring.setVisible(!this.cinematic && !u.down && !u.statuses.bound);
    this.arrow.setVisible(!this.cinematic && !u.down && !u.statuses.bound);
    this.hp.setVisible(!this.cinematic);
    this.icons.forEach(ic => ic.setVisible(!this.cinematic));
    this.ring.setTexture(this.selected ? 'tac-ring-active' : `tac-ring-${u.team}`);
    this.applyTint();
    this.layout();
  }
  private wasDone = false;

  /** Keep only the character and its shadow during a story tableau. */
  setCinematic(on: boolean): void {
    this.cinematic = on;
    this.refresh(this.unit);
  }

  setDown(kind: 'dead' | 'wounded'): void {
    this.down = kind;
    this.ring.setVisible(false);
    this.arrow.setVisible(false);
    this.hp.clear();
    this.applyTint();
  }

  setAlpha(a: number): void {
    for (const o of [this.sprite, this.shadow, this.ring, this.arrow, this.hp, ...this.icons]) o.setAlpha(a);
  }

  destroy(): void {
    for (const o of [this.sprite, this.shadow, this.ring, this.arrow, this.hp, ...this.icons]) o.destroy();
  }
}

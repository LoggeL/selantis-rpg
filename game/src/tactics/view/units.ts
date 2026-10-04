import Phaser from 'phaser';
import type { CharAnim } from '../../art/api';
import { G } from '../../core/G';
import type { BattleUnitDef } from '../api';
import type { Facing, StatusId, Unit } from '../rules/types';
import { IsoView } from './iso';

const STATUS_ORDER: StatusId[] = ['guarded', 'evasive', 'taunt', 'stunned', 'burning', 'bound'];

/** Resolves the sprite texture for a unit: art preset if known, else its custom spec. */
export function resolveCharacter(scene: Phaser.Scene, def: BattleUnitDef, battleId: string): string {
  let ids: string[] = [];
  try { ids = G.art.characterIds(); } catch { /* art not ready */ }
  if (def.preset && ids.includes(def.preset)) return G.art.character(scene, def.preset);
  if (def.spec) return G.art.character(scene, def.spec, `tac-${battleId}-${def.id}`);
  return G.art.character(scene, def.preset ?? def.id);
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
  readonly charKey: string;
  readonly frameH: number;
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

  constructor(private scene: Phaser.Scene, private iso: IsoView, readonly unit: Unit, readonly def: BattleUnitDef, battleId: string, z: number) {
    this.charKey = resolveCharacter(scene, def, battleId);
    let size = { w: 16, h: 24 };
    try { size = G.art.characterSize(this.charKey); } catch { /* default */ }
    this.frameH = size.h;
    this.gx = unit.x; this.gy = unit.y; this.z = z;
    this.facing = unit.facing;
    this.shadow = scene.add.image(0, 0, 'tac-shadow').setOrigin(0.5, 0.5);
    this.ring = scene.add.image(0, 0, `tac-ring-${unit.team}`).setOrigin(0.5, 0.5);
    this.arrow = scene.add.image(0, 0, `tac-face-${unit.team}`).setOrigin(0.5, 0.5);
    this.sprite = scene.add.sprite(0, 0, this.charKey).setOrigin(0.5, 1);
    this.hp = scene.add.graphics();
    this.play('idle');
    this.layout();
    this.refresh(unit);
  }

  /** Team colours may change (freed prisoner joins the player). */
  setTeam(team: Unit['team']): void {
    this.ring.setTexture(`tac-ring-${team}`);
    this.arrow.setTexture(`tac-face-${team}`);
    this.hpShown = -1;
  }

  get feet(): { x: number; y: number } {
    const c = this.iso.center(this.gx, this.gy, this.z);
    return { x: Math.round(c.x + this.ox), y: Math.round(c.y + 2 + this.oy) };
  }
  /** Screen point above the head (for numbers, bubbles, icons). */
  get head(): { x: number; y: number } { const f = this.feet; return { x: f.x, y: f.y - this.frameH - 2 }; }
  get chest(): { x: number; y: number } { const f = this.feet; return { x: f.x, y: f.y - Math.round(this.frameH * 0.55) }; }

  depth(): number {
    return Math.max(this.iso.depthKey(Math.ceil(this.gx - 0.001), Math.ceil(this.gy - 0.001)), this.iso.depthKey(Math.floor(this.gx), Math.floor(this.gy))) * 100 + 50;
  }

  layout(): void {
    const c = this.iso.center(this.gx, this.gy, this.z);
    const fx = Math.round(c.x + this.ox), fy = Math.round(c.y + 2 + this.oy);
    const ground = this.iso.center(this.gx, this.gy, this.z);
    const d = this.depth();
    this.sprite.setPosition(fx, fy).setDepth(d + 2);
    this.shadow.setPosition(Math.round(ground.x + this.ox), Math.round(ground.y + 2)).setDepth(d - 3);
    this.ring.setPosition(Math.round(ground.x + this.ox), Math.round(ground.y + 2)).setDepth(d - 2);
    const sd = this.iso.screenDir(this.facing);
    const len = Math.hypot(sd.x, sd.y) || 1;
    this.arrow.setPosition(Math.round(ground.x + this.ox + (sd.x / len) * 9), Math.round(ground.y + 2 + (sd.y / len) * 4.5)).setDepth(d - 1);
    this.arrow.setFlipX(sd.x < 0).setFlipY(sd.y < 0);
    this.hp.setPosition(fx, fy - this.frameH - 4).setDepth(d + 3);
    this.icons.forEach((ic, i) => ic.setPosition(fx - (this.icons.length - 1) * 4 + i * 8, fy - this.frameH - 9).setDepth(d + 4));
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

  play(anim: CharAnim, keepFrame = false): void {
    this.anim = anim;
    const key = G.art.animKey(this.charKey, anim, this.iso.spriteDir(this.facing));
    const fallback = G.art.animKey(this.charKey, 'idle', this.iso.spriteDir(this.facing));
    const k = this.scene.anims.exists(key) ? key : fallback;
    if (!this.scene.anims.exists(k)) return;
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
    if (this.down === 'wounded') this.sprite.setTint(0x9a8f90);
    else if (this.unit.statuses.bound) this.sprite.setTint(0xd8d0c8);
    else if (this.isDone) this.sprite.setTint(0xb8bcc8);
    else this.sprite.clearTint();
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
        const w = 14, ratio = Math.max(0, u.hp / u.maxHp);
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
    this.ring.setVisible(!u.down && !u.statuses.bound);
    this.arrow.setVisible(!u.down && !u.statuses.bound);
    this.ring.setTexture(this.selected ? 'tac-ring-active' : `tac-ring-${u.team}`);
    this.applyTint();
    this.layout();
  }
  private wasDone = false;

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

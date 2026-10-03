import Phaser from 'phaser';
import { sfx } from '../audio';
import type { CritterDef } from './maps';
import { clearWalkingLine, findWalkingPath } from './navigation';

type Pt = { x: number; y: number };

/** Ein Tier mit einfachem Verhalten. Reagiert auf Lias Nähe. */
export class Critter {
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow?: Phaser.GameObjects.Image;
  private home: Pt;
  private area: [number, number, number, number];
  private target?: Pt;
  private waitMs = Phaser.Math.Between(400, 2400);
  private mode: 'idle' | 'move' | 'flee' | 'gone' = 'idle';
  private t = Math.random() * 1000;
  private flees = 0;
  private reducedMotion = false;
  /** Wird aufgerufen, wenn der Hase in seinem Bau verschwindet. */
  onBurrow?: (at: Pt) => void;

  constructor(private scene: Phaser.Scene, private def: CritterDef, private walkable: (x: number, y: number) => boolean) {
    this.home = { x: def.at[0], y: def.at[1] };
    this.area = def.area ?? [def.at[0] - 50, def.at[1] - 30, 100, 60];
    const sheet = `crt-${def.kind}`;
    this.sprite = scene.add.sprite(this.home.x, this.home.y, sheet, 0).setOrigin(0.5, 29 / 32);
    if (def.kind !== 'butterfly' && def.kind !== 'bird') this.shadow = scene.add.image(this.home.x, this.home.y, 'shadow').setScale(0.55, 0.7);
    if (def.kind === 'butterfly') this.sprite.setFrame(Math.random() < 0.5 ? 0 : 4);
    this.play(this.idleAnim());
  }

  private anim(name: string) { return `${this.def.kind}-${name}`; }
  private play(key: string, ignoreIfPlaying = true) {
    if (this.scene.anims.exists(key)) {
      this.sprite.play(key, ignoreIfPlaying);
      if (this.reducedMotion) this.sprite.anims.pause();
    }
  }
  private idleAnim() {
    switch (this.def.kind) {
      case 'butterfly': return this.sprite.frame.name === '4' ? 'butterfly-b' : 'butterfly-a';
      case 'bird': return 'bird-peck';
      case 'hare': return 'hare-sit';
      case 'chicken': return 'chicken-peck';
      case 'pig': return 'pig-idle';
    }
  }

  private randomPoint(): Pt {
    const [x, y, w, h] = this.area;
    for (let i = 0; i < 20; i++) {
      const p = { x: x + Math.random() * w, y: y + Math.random() * h };
      if (this.def.kind === 'butterfly' || this.def.kind === 'pig' ||
          (this.walkable(p.x, p.y) && (this.mode === 'gone' || clearWalkingLine([this.sprite.x, this.sprite.y], [p.x, p.y], this.walkable)))) return p;
    }
    return { ...this.home };
  }

  update(dt: number, lia: Pt) {
    if (this.mode === 'gone' || this.reducedMotion) return;
    dt = Math.min(dt, 50);
    this.t += dt;
    const s = this.sprite;
    const d = Phaser.Math.Distance.Between(s.x, s.y, lia.x, lia.y);
    const k = this.def.kind;

    // Fluchtreaktionen
    if (this.mode !== 'flee') {
      if (k === 'bird' && d < 44) return this.flyAway(lia);
      if (k === 'butterfly' && d < 30) { this.target = this.awayFrom(lia, 70); this.mode = 'flee'; }
      if (k === 'hare' && d < 64) return this.hareFlee(lia);
      if (k === 'chicken' && d < 22) { this.target = this.awayFrom(lia, 34); this.mode = 'flee'; this.play('chicken-flap'); sfx.cluck(); }
    }

    if (this.mode === 'idle') {
      this.waitMs -= dt;
      if (k === 'butterfly') s.y = this.home.y + Math.sin(this.t / 300) * 3;
      if (this.waitMs <= 0 && k !== 'pig') {
        this.target = this.randomPoint();
        this.mode = 'move';
        if (k === 'chicken') this.play('chicken-walk');
        if (k === 'bird') this.play('bird-hop');
      }
      if (k === 'chicken' && Math.random() < dt / 9000) sfx.cluck();
      if (k === 'pig' && Math.random() < dt / 11000) sfx.grunt();
    } else if (this.target) {
      const speed = { butterfly: this.mode === 'flee' ? 70 : 26, bird: 30, hare: 150, chicken: this.mode === 'flee' ? 70 : 22, pig: 10 }[k];
      const dx = this.target.x - s.x, dy = this.target.y - s.y, dist = Math.hypot(dx, dy);
      const step = speed * dt / 1000;
      if (dist <= step) {
        s.setPosition(this.target.x, this.target.y);
        if (k === 'butterfly') this.home = { ...this.target };
        this.target = undefined;
        this.mode = 'idle';
        this.waitMs = Phaser.Math.Between(800, 3200);
        this.play(this.idleAnim());
      } else {
        const nx = s.x + (dx / dist) * step;
        const ny = s.y + (dy / dist) * step + (k === 'butterfly' ? Math.sin(this.t / 90) * 0.6 : 0);
        if (k === 'butterfly' || this.walkable(nx, ny)) s.setPosition(nx, ny);
        else { this.target = undefined; this.mode = 'idle'; this.waitMs = 1200; this.play(this.idleAnim()); }
        s.setFlipX(dx < 0);
      }
    }
    this.shadow?.setPosition(s.x, s.y - 1).setDepth(s.y - 1);
    s.setDepth(k === 'butterfly' ? 700 : s.y);
  }

  private awayFrom(lia: Pt, dist: number): Pt {
    const a = Math.atan2(this.sprite.y - lia.y, this.sprite.x - lia.x) + (Math.random() - 0.5) * 0.8;
    const p = { x: Phaser.Math.Clamp(this.sprite.x + Math.cos(a) * dist, 10, 630), y: Phaser.Math.Clamp(this.sprite.y + Math.sin(a) * dist, 20, 350) };
    if (this.def.kind === 'chicken' && !clearWalkingLine([this.sprite.x, this.sprite.y], [p.x, p.y], this.walkable)) return this.randomPoint();
    return p;
  }

  /** Vogel: flattert im Bogen aus dem Bild und kommt später woanders wieder. */
  private flyAway(lia: Pt) {
    this.mode = 'gone';
    sfx.bird();
    this.play('bird-fly');
    const s = this.sprite;
    const dir = s.x > lia.x ? 1 : -1;
    s.setFlipX(dir < 0).setDepth(720);
    this.scene.tweens.add({
      targets: s, x: s.x + dir * Phaser.Math.Between(180, 320), y: s.y - Phaser.Math.Between(120, 200), duration: 1300, ease: 'Quad.in',
      onComplete: () => {
        s.setVisible(false);
        this.scene.time.delayedCall(Phaser.Math.Between(9000, 16000), () => {
          const p = this.randomPoint();
          s.setPosition(p.x, p.y).setVisible(true);
          this.home = p;
          this.mode = 'idle';
          this.play('bird-peck');
        });
      },
    });
  }

  /** Hase: schlägt Haken, nach dem dritten Mal verschwindet er im Bau. */
  private hareFlee(lia: Pt) {
    this.mode = 'flee';
    this.flees++;
    this.play('hare-run');
    const s = this.sprite;
    const burrow = this.def.burrow;
    const toBurrow = this.flees >= 3 && burrow;
    const wanted = toBurrow ? { x: burrow[0], y: burrow[1] } : this.awayFrom(lia, 110);
    const path = findWalkingPath([s.x, s.y], [wanted.x, wanted.y], this.walkable, toBurrow ? 65 : 24);
    if (!path.length) { this.mode = 'idle'; this.waitMs = 1500; this.play('hare-alert'); return; }
    const finish = () => {
      if (toBurrow) {
        this.mode = 'gone';
        this.scene.tweens.add({ targets: [s, this.shadow!], alpha: 0, scale: 0.4, duration: 300, onComplete: () => { s.setVisible(false); this.shadow?.setVisible(false); } });
        this.onBurrow?.({ x: burrow![0], y: burrow![1] });
      } else {
        this.home = { x: s.x, y: s.y };
        this.mode = 'idle';
        this.waitMs = 99999;
        this.play('hare-alert');
        this.scene.time.delayedCall(900, () => this.play('hare-sit'));
      }
    };
    const follow = () => {
      const next = path.shift();
      if (!next) { finish(); return; }
      this.hopTo({ x: next[0], y: next[1] }, follow);
    };
    follow();
  }

  private hopTo(target: Pt, done: () => void) {
    const s = this.sprite;
    s.setFlipX(target.x < s.x);
    const dist = Phaser.Math.Distance.Between(s.x, s.y, target.x, target.y);
    this.scene.tweens.add({
      targets: s, x: target.x, y: target.y, duration: Math.max(250, dist / 0.16), ease: 'Sine.inOut',
      onUpdate: () => { this.shadow?.setPosition(s.x, s.y - 1).setDepth(s.y - 1); s.setDepth(s.y); },
      onComplete: done,
    });
  }

  /** Schweine fressen (nach dem Füttern). */
  eat() {
    if (this.def.kind !== 'pig') return;
    if (this.reducedMotion) { this.sprite.setFrame(6); return; }
    this.play('pig-eat', false);
    this.scene.time.delayedCall(4000, () => this.play('pig-happy'));
  }

  setReducedMotion(enabled: boolean) {
    this.reducedMotion = enabled;
    if (enabled) this.sprite.anims.pause(); else this.sprite.anims.resume();
    for (const tween of this.scene.tweens.getTweensOf([this.sprite, this.shadow].filter(Boolean))) {
      if (enabled) tween.pause(); else tween.resume();
    }
  }
}

import Phaser from 'phaser';
import { sfx } from '../audio';
import { FONT, Hud } from '../ui';
import { Dir, ItemId, MAPS, MapDef, Prop, Pt } from '../world/maps';
import { Critter } from '../world/critters';
import { WorldApi, WorldState, objectiveText, pickupText, runAction, state } from '../world/quests';
import { findWalkingPath, inPoly, isMapWalkable } from '../world/navigation';
import { ambientPrefs, motionDuration, subscribeSettings } from '../settings';
import { InventoryHud, ITEM_FRAME, itemTexture } from '../inventory';
import { completeHomecoming, homewardExit } from '../story/homecoming';
import { eastwardTravelGate, mapForTravel, travelObjective } from '../story/travel';

type Data = { map?: string; from?: string; x?: number; y?: number; facing?: Dir };

const SPEED = 72;
const NEST_CLIMB_MS = 2800;
type NestClimb = { prop: Prop; from: Pt; progress: number; complete: () => void; returning: boolean };

/** Freie Erkundung: verbundene Kartenbildschirme mit Kollision, Ausgängen und Untersuchbarem. */
export class WorldScene extends Phaser.Scene {
  private map!: MapDef;
  private lia!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private hud!: Hud;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private facing: Dir = 's';
  private busy = false;
  private prompt!: Phaser.GameObjects.Container;
  private propIndex = new Map<string, number>();
  private debugG?: Phaser.GameObjects.Graphics;
  private stepTimer = 0;
  private bgImage!: Phaser.GameObjects.Image;
  private target?: { x: number; y: number };
  private targetProp?: import('../world/maps').Prop;
  private stuckMs = 0;
  private hintShown?: string;
  private exitHints: { c: Phaser.GameObjects.Container; x: number; y: number; home: boolean }[] = [];
  private st!: WorldState;
  private critters: Critter[] = [];
  private pickups: { key: string; item: ItemId; s: Phaser.GameObjects.Image; ready: boolean }[] = [];
  private inventory!: InventoryHud;
  private objText!: Phaser.GameObjects.Text;
  private nest?: Phaser.GameObjects.Image;
  private route: Pt[] = [];
  private requestedTarget?: Pt;
  private routeUpdatedAt = 0;
  private finished = false;
  private pollen?: Phaser.GameObjects.Particles.ParticleEmitter;
  private blockedExit?: string;
  private nestClimb?: NestClimb;
  private climbPointer?: Phaser.Input.Pointer;
  private climbHands?: Phaser.GameObjects.Graphics;
  private nestControls = false;

  constructor() { super('world'); }

  create(data: Data) {
    const id = data.map ?? new URLSearchParams(location.search).get('map') ?? 'wiese';
    this.map = MAPS[id] ?? MAPS.wiese;
    this.busy = false;
    this.st = state(this.registry);
    this.map = mapForTravel(this.map, this.st);
    this.blockedExit = undefined;
    this.registry.set('visited', { ...(this.registry.get('visited') ?? {}), [this.map.id]: true });

    // Roman S. 13: The raid is already underway when Lia first sees the farm.
    // Use its restricted approach immediately, before free world input exists.
    if (this.map.id === 'hof' && !this.st.flags.raidWitnessed) {
      completeHomecoming(this.st);
      this.scene.start('raid');
      return;
    }
    if (this.map.id === 'hof' && this.st.flags.raidWitnessed) {
      this.finished = true;
      const entry = data.from ? this.map.entries[data.from] : undefined;
      this.scene.start('aftermath', { from: data.from, at: entry?.at });
      return;
    }

    this.finished = false;
    this.route = [];
    this.nest = undefined;
    this.nestClimb = undefined;
    this.climbPointer = undefined;
    this.climbHands = undefined;
    this.nestControls = false;
    this.data.set('mobile:controls', null);
    this.debugG = undefined;
    this.hintShown = undefined;
    this.bgImage = this.add.image(0, 0, this.map.bg).setOrigin(0).setDepth(-1000);
    this.drawFieldBranch();
    this.cameras.main.fadeIn(280, 0, 0, 0);

    const entry = data.from ? this.map.entries[data.from] : undefined;
    const start: Pt = entry ? entry.at : data.x !== undefined ? [data.x, data.y!] : this.map.start;
    this.facing = entry?.facing ?? data.facing ?? 's';
    this.shadow = this.add.image(start[0], start[1], 'shadow');
    this.lia = this.add.sprite(start[0], start[1], 'lia-walk', 0).setOrigin(0.5, 60 / 64).play(`lia-idle-${this.facing}`);

    // Sommerabend: Pollen im Gegenlicht
    this.pollen = this.add.particles(0, 0, 'px', {
      x: { min: 0, max: 640 }, y: { min: 0, max: 360 }, lifespan: 5000, speedX: { min: -6, max: 4 }, speedY: { min: -6, max: 2 },
      scale: { min: 0.4, max: 0.8 }, alpha: { start: 0.7, end: 0 }, tint: [0xfff2c0, 0xffe08a], frequency: 220,
    }).setDepth(800);

    this.hud = new Hud(this, 'portrait-lia', 'LIA');
    this.hud.setHp(1, false);
    this.objText = this.add.text(632, 10, '', { fontFamily: FONT, fontSize: '9px', color: '#fff4d8', stroke: '#2a1e10', strokeThickness: 3 })
      .setOrigin(1, 0).setDepth(1000);
    this.refreshObjective();
    this.inventory = new InventoryHud(this, () => this.clearTarget());
    this.refreshInventory();
    this.spawnWorldLife();

    const icon = this.registry.get('icon') as (n: string) => number;
    const bubble = this.add.rectangle(0, 0, 22, 22, 0x14171b, 0.9).setStrokeStyle(1, 0xd8d2c0);
    const key = this.add.text(0, 0, 'E', { fontFamily: FONT, fontSize: '14px', color: '#e8e2d0' }).setOrigin(0.5);
    void icon;
    this.prompt = this.add.container(0, 0, [bubble, key]).setDepth(990).setVisible(false);
    this.tweens.add({ targets: [bubble, key], y: -2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,F1') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.E.on('down', () => this.interact());
    this.input.on('pointerdown', this.onPointerDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.onPointerDown, this);
      this.nestClimb = undefined;
      this.climbPointer = undefined;
      this.clearTarget();
    });
    this.clearTarget();
    this.keys.F1.on('down', () => this.toggleDebug());
    if (new URLSearchParams(location.search).has('debug')) this.toggleDebug();

    this.addExitHints();
    const unsubscribe = subscribeSettings(() => {
      if (this.finished) return;
      const prefs = ambientPrefs();
      this.pollen?.setVisible(prefs.particles);
      if (prefs.particles) this.pollen?.start(); else this.pollen?.stop();
      if (prefs.reducedMotion) this.cameras.main.shakeEffect.reset();
      for (const c of this.critters) c.setReducedMotion(prefs.reducedMotion);
      const decorations = [...this.prompt.list, ...this.exitHints.map(h => h.c.list[0])];
      for (const tween of this.tweens.getTweensOf(decorations)) {
        if (prefs.reducedMotion) tween.pause(); else tween.resume();
      }
      for (const pickup of this.pickups) {
        for (const tween of this.tweens.getTweensOf(pickup.s)) {
          if (!tween.data.some(data => 'repeat' in data && data.repeat === -1)) continue;
          if (prefs.reducedMotion) tween.pause(); else tween.resume();
        }
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);

    const name = this.add.text(320, 40, this.map.name, { fontFamily: FONT, fontSize: '12px', color: '#fff4d8', stroke: '#2a1e10', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(1000).setAlpha(0);
    this.tweens.add({ targets: name, alpha: 1, duration: 500, hold: 1400, yoyo: true });
  }

  /** Kleine Pfeile an den Kartenrändern zeigen, wo es weitergeht. */
  private addExitHints() {
    this.exitHints = [];
    for (const e of this.map.exits) {
      const home = !this.st.flags.raidWitnessed && e.to === homewardExit(this.map.id);
      const [x, y, w, h] = e.rect;
      const cx = x + w / 2, cy = y + h / 2;
      const dir = x <= 0 ? 'w' : x + w >= 640 ? 'e' : y <= 0 ? 'n' : 's';
      const ang = { e: 0, s: Math.PI / 2, w: Math.PI, n: -Math.PI / 2 }[dir];
      const inset = 14;
      const px = dir === 'w' ? inset : dir === 'e' ? 640 - inset : Phaser.Math.Clamp(cx, 20, 620);
      const py = dir === 'n' ? inset : dir === 's' ? 360 - inset : Phaser.Math.Clamp(cy, 20, 340);
      const g = this.add.graphics();
      for (const off of [-4, 3]) {
        g.fillStyle(0x2a1e10, 0.8).fillTriangle(off - 1, -6, off + 6, 0, off - 1, 6);
        g.fillStyle(home ? 0xffd27a : 0xfff4d8, 1).fillTriangle(off, -4, off + 4, 0, off, 4);
      }
      g.setRotation(ang);
      const target = home ? 'Nach Hause' : e.label ?? MAPS[e.to]?.name ?? e.to;
      const lx = dir === 'w' ? 12 : dir === 'e' ? -12 : 0, ly = dir === 'n' ? 12 : dir === 's' ? -12 : 0;
      const label = this.add.text(lx, ly, target, { fontFamily: FONT, fontSize: '8px', color: '#fff4d8', stroke: '#2a1e10', strokeThickness: 3 })
        .setOrigin(dir === 'w' ? 0 : dir === 'e' ? 1 : 0.5, 0.5);
      const c = this.add.container(px, py, [g, label]).setDepth(980).setAlpha(home ? 1 : 0.55);
      {
        label.setInteractive({ useHandCursor: true });
        g.setInteractive(new Phaser.Geom.Rectangle(-8, -8, 16, 16), Phaser.Geom.Rectangle.Contains);
        const go = (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          if (this.busy) return;
          this.targetProp = undefined;
          this.setTarget(cx, cy, true);
        };
        label.on('pointerdown', go);
        g.on('pointerdown', go);
      }
      const dx = Math.cos(ang) * 2, dy = Math.sin(ang) * 2;
      this.tweens.add({ targets: g, x: dx, y: dy, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.exitHints.push({ c, x: px, y: py, home });
    }

  }

  /** The visible side road is present before and after the raid. */
  private drawFieldBranch() {
    if (this.map.id !== 'felder') return;
    const g = this.add.graphics().setDepth(-900);
    const branch: Pt[] = [[483, 270], [529, 273], [640, 267], [640, 301], [536, 287], [500, 290]];
    const earth = [0x8b713c, 0x997744, 0xa4864d, 0x80683c, 0xa89353];
    for (let y = 267; y < 302; y += 2) for (let x = 482; x < 640; x += 2) {
      if (!inPoly(x, y, branch)) continue;
      const grain = (x * 13 + y * 17 + x * y) % earth.length;
      g.fillStyle(earth[grain]).fillRect(x, y, 2, 2);
      if ((x + y * 3) % 17 === 0) g.fillStyle(0x756f37).fillRect(x, y, 1, 3);
    }
    if (!this.st.flags.raidWitnessed) return;
    for (let x = 492; x < 628; x += 17) {
      for (const y of [280, 286]) {
        g.lineStyle(1, 0x4c402a).strokeEllipse(x, y, 4, 5);
        g.fillStyle(0xa08a4d).fillRect(x + 1, y - 3, 2, 2);
      }
    }
  }

  private objective(text: string) {
    this.data.set('mobile:objective', text);
    this.add.text(632, 10, text, { fontFamily: FONT, fontSize: '9px', color: '#fff4d8', stroke: '#2a1e10', strokeThickness: 3 })
      .setOrigin(1, 0).setDepth(1000);
  }

  private walkable(x: number, y: number) {
    return isMapWalkable(this.map, x, y);
  }

  update(_t: number, dt: number) {
    if (this.inventory?.isOpen) return;
    if (this.finished) return;
    dt = Math.min(dt, 50);
    if (this.nestClimb) { this.updateNestClimb(dt); return; }
    this.shadow.setPosition(this.lia.x, this.lia.y - 1).setDepth(this.lia.y - 1);
    this.lia.setDepth(this.lia.y);
    for (const c of this.critters) c.update(dt, this.lia);
    if (this.busy) return;
    this.collectPickups();
    const k = this.keys;
    let dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (dx || dy) this.clearTarget();
    else if (this.target) {
      // Maussteuerung: auf den Zielpunkt zu, bei gedrückter Taste dem Cursor folgen
      const ptr = this.input.activePointer;
      if (ptr.isDown && !this.targetProp && this.time.now - this.routeUpdatedAt > 160 &&
          (!this.requestedTarget || Math.hypot(ptr.worldX - this.requestedTarget[0], ptr.worldY - this.requestedTarget[1]) > 8)) {
        this.setTarget(ptr.worldX, ptr.worldY, false);
      }
      const tx = (this.target?.x ?? this.lia.x) - this.lia.x, ty = (this.target?.y ?? this.lia.y) - this.lia.y, dist = Math.hypot(tx, ty);
      if (dist < 2) this.arrive();
      else { dx = tx / dist; dy = ty / dist; }
    }
    if (dx || dy) {
      const len = Math.hypot(dx, dy), sp = SPEED * dt / 1000;
      const ox = this.lia.x, oy = this.lia.y;
      const nx = ox + (dx / len) * sp, ny = oy + (dy / len) * sp;
      // An Kanten entlanggleiten statt hängenbleiben
      if (this.walkable(nx, ny)) this.lia.setPosition(nx, ny);
      else if (dx && this.walkable(nx, oy)) this.lia.x = nx;
      else if (dy && this.walkable(ox, ny)) this.lia.y = ny;
      else {
        // Schräge Kante: in leicht gedrehter Richtung weitergleiten
        const ang = Math.atan2(dy, dx);
        for (const off of [0.6, -0.6, 1.1, -1.1]) {
          const tx = ox + Math.cos(ang + off) * sp, ty = oy + Math.sin(ang + off) * sp;
          if (this.walkable(tx, ty)) { this.lia.setPosition(tx, ty); break; }
        }
      }
      // Festgefahren (Mausziel hinter einem Hindernis): anhalten statt zappeln
      if (this.target) {
        const moved = Math.hypot(this.lia.x - ox, this.lia.y - oy);
        this.stuckMs = moved < sp * 0.3 ? this.stuckMs + dt : 0;
        if (this.stuckMs > 220) this.arrive();
      }
      const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
      this.facing = d;
      if (this.target || k.D.isDown || k.A.isDown || k.S.isDown || k.W.isDown || k.UP.isDown || k.DOWN.isDown || k.LEFT.isDown || k.RIGHT.isDown) {
        this.lia.anims.currentAnim?.key !== `lia-walk-${d}` && this.lia.play(`lia-walk-${d}`);
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) { this.stepTimer = 300; sfx.step(); }
      }
      this.checkExits();
      this.checkTriggers();
    } else if (this.lia.anims.currentAnim?.key.startsWith('lia-walk')) {
      this.lia.play(`lia-idle-${this.facing}`);
    }
    this.updatePrompt();
    for (const h of this.exitHints) {
      const d = Phaser.Math.Distance.Between(this.lia.x, this.lia.y, h.x, h.y);
      h.c.setAlpha(h.home ? 1 : Phaser.Math.Clamp(1.15 - d / 160, 0.45, 1));
    }
    if (Math.random() < dt / 7000) sfx.bird();
  }

  private onPointerDown(ptr: Phaser.Input.Pointer) {
    // A fresh hold resumes the current grip, even though climbing locks walking.
    if (this.nestClimb) {
      const [x, y] = this.nestClimb.prop.at;
      if (!this.nestClimb.returning && Math.hypot(ptr.worldX - x, ptr.worldY - y) < 80) this.climbPointer = ptr;
      return;
    }
    if (this.inventory.hitTest(ptr)) return;
    if (this.busy || this.hud.hitTest(ptr)) return;
    this.inventory.close();
    const j = this.nearJump();
    if (j && Phaser.Math.Distance.Between(ptr.worldX, ptr.worldY, j.from[0], j.from[1]) >
        Phaser.Math.Distance.Between(ptr.worldX, ptr.worldY, j.to[0], j.to[1])) { this.jump(j.to); return; }
    const prop = this.map.props.find((p) => Phaser.Math.Distance.Between(ptr.worldX, ptr.worldY, p.at[0], p.at[1]) < p.radius);
    if (prop) {
      if (prop.action === 'returnChick') this.climbPointer = ptr;
      this.targetProp = prop;
      this.setTarget(prop.at[0], prop.at[1], true);
      // Schon da? Dann sofort untersuchen.
      if (Phaser.Math.Distance.Between(this.lia.x, this.lia.y, prop.at[0], prop.at[1]) < prop.radius) this.arrive();
    } else {
      this.targetProp = undefined;
      this.setTarget(ptr.worldX, ptr.worldY, true);
    }
  }

  private setTarget(x: number, y: number, mark: boolean) {
    this.requestedTarget = [x, y];
    this.routeUpdatedAt = this.time.now;
    this.route = findWalkingPath([this.lia.x, this.lia.y], [x, y], (px, py) => this.walkable(px, py), this.targetProp?.radius ?? 24);
    const first = this.route.shift();
    this.target = first ? { x: first[0], y: first[1] } : undefined;
    this.stuckMs = 0;
    if (!mark) return;
    const ring = this.add.ellipse(x, y, 14, 6).setStrokeStyle(1, 0xfff4d8, 0.9).setDepth(y - 2);
    this.tweens.add({ targets: ring, scale: ambientPrefs().reducedMotion ? 1 : 0.3, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
  }

  private clearTarget() { this.target = undefined; this.targetProp = undefined; this.route = []; this.requestedTarget = undefined; }

  private arrive() {
    const next = this.route.shift();
    if (next) { this.target = { x: next[0], y: next[1] }; this.stuckMs = 0; return; }
    const prop = this.targetProp;
    this.clearTarget();
    if (prop && Phaser.Math.Distance.Between(this.lia.x, this.lia.y, prop.at[0], prop.at[1]) < prop.radius + 6) this.interact(prop);
  }

  /** Nächste Sprungstelle: Absprungpunkt in Reichweite und das Ziel auf der anderen Seite. */
  private nearJump(): { from: Pt; to: Pt; hint: string } | undefined {
    for (const j of this.map.jumps ?? []) {
      if (Phaser.Math.Distance.Between(this.lia.x, this.lia.y, j.a[0], j.a[1]) < j.radius) return { from: j.a, to: j.b, hint: j.hint };
      if (Phaser.Math.Distance.Between(this.lia.x, this.lia.y, j.b[0], j.b[1]) < j.radius) return { from: j.b, to: j.a, hint: j.hint };
    }
    return undefined;
  }

  private jump(to: Pt) {
    this.busy = true;
    this.clearTarget();
    const fx = this.lia.x, fy = this.lia.y, [tx, ty] = to;
    const d: Dir = Math.abs(tx - fx) > Math.abs(ty - fy) ? (tx > fx ? 'e' : 'w') : ty > fy ? 's' : 'n';
    this.facing = d;
    this.lia.play(`lia-walk-${d}`).anims.pause(this.lia.anims.currentAnim!.frames[1]);
    sfx.step();
    const arc = { t: 0 };
    this.tweens.add({
      targets: arc, t: 1, duration: motionDuration(560), ease: 'Sine.inOut',
      onUpdate: () => {
        const h = ambientPrefs().reducedMotion ? 0 : Math.sin(arc.t * Math.PI) * 20;
        this.lia.setPosition(Phaser.Math.Linear(fx, tx, arc.t), Phaser.Math.Linear(fy, ty, arc.t) - h);
        this.shadow.setScale(1 - h / 40);
      },
      onComplete: () => {
        this.lia.setPosition(tx, ty);
        this.shadow.setScale(1);
        sfx.thud();
        if (!ambientPrefs().reducedMotion) this.cameras.main.shake(80, 0.002);
        this.lia.play(`lia-idle-${d}`);
        this.busy = false;
      },
    });
  }

  private nearProp() {
    return this.map.props.find((p) => Phaser.Math.Distance.Between(this.lia.x, this.lia.y, p.at[0], p.at[1]) < p.radius);
  }

  private updatePrompt() {
    if (this.nestClimb) { this.prompt.setVisible(false); return; }
    const j = this.nearJump();
    const p = j ?? this.nearProp();
    const canClimb = !j && !!p && 'action' in p && p.action === 'returnChick' && !!this.st.inv.kueken && !this.st.flags.chickReturned;
    if (canClimb !== this.nestControls) {
      this.nestControls = canClimb;
      this.data.set('mobile:controls', canClimb ? { directions: ['up', 'left', 'down', 'right'], actions: { E: 'Klettern halten' } } : null);
      this.hud.hint(canClimb ? 'E halten / Baum gedrückt halten: zum Nest klettern' : '', true);
    }
    if (j && this.hintShown !== j.hint) { this.hud.hint(j.hint, true); this.hintShown = j.hint; }
    else if (!j && this.hintShown) { this.hud.hint('', true); this.hintShown = undefined; }
    this.prompt.setVisible(!!p);
    if (p) this.prompt.setPosition(Math.round(this.lia.x), Math.round(this.lia.y - 58));
  }

  private interact(target?: { id: string; lines: string[] }) {
    if (this.busy || this.inventory?.isOpen) return;
    const j = target ? undefined : this.nearJump();
    if (j) { this.jump(j.to); return; }
    const p = target ?? this.nearProp();
    if (!p) return;
    const full = this.map.props.find((x) => x.id === p.id);
    if (full?.action && runAction(full, this.api())) { sfx.select(); return; }
    const i = this.propIndex.get(`${this.map.id}:${p.id}`) ?? 0;
    this.hud.thought(p.lines[i % p.lines.length], 2800);
    this.propIndex.set(`${this.map.id}:${p.id}`, i + 1);
    this.events.emit('prop', p.id);
    if (full?.discovery) this.discover(`${this.map.id}:${p.id}`, full.discovery, full.at);
    sfx.select();
  }

  private checkExits() {
    let withinExit = false;
    for (const e of this.map.exits) {
      const [x, y, w, h] = e.rect;
      if (this.lia.x >= x && this.lia.x <= x + w && this.lia.y >= y && this.lia.y <= y + h) {
        withinExit = true;
        const blocked = e.scene === 'journey' ? eastwardTravelGate(this.st) : undefined;
        if (blocked) {
          this.clearTarget();
          if (this.blockedExit !== e.to) this.hud.thought(blocked, 4200);
          this.blockedExit = e.to;
          return;
        }
        this.busy = true;
        this.lia.anims.stop();
        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          if (e.scene) this.scene.start(e.scene, { from: this.map.id });
          else this.scene.restart({ map: e.to, from: this.map.id });
        });
        return;
      }
    }
    if (!withinExit) this.blockedExit = undefined;
  }

  private checkTriggers() {
    for (const t of this.map.triggers ?? []) {
      const [x, y, w, h] = t.rect;
      if (this.lia.x >= x && this.lia.x <= x + w && this.lia.y >= y && this.lia.y <= y + h) this.events.emit('trigger', t.id);
    }
  }

  // ---------- Lebendige Welt: Tiere, Fundstücke, Inventar ----------
  private spawnWorldLife() {
    this.critters = [];
    for (const def of this.map.critters ?? []) {
      if (!this.textures.exists(`crt-${def.kind}`)) continue;
      const c = new Critter(this, def, (x, y) => this.walkable(x, y));
      c.onBurrow = (at) => this.discover(`${this.map.id}:hare-burrow`, 'Den Hasenbau entdeckt', [at.x, at.y]);
      this.critters.push(c);
    }
    this.pickups = [];
    for (const pk of this.map.pickups ?? []) {
      const key = `${this.map.id}:${pk.id}`;
      if (!this.st.picked[key]) this.addPickup(pk.item, pk.at[0], pk.at[1], key, true);
    }
    // Vom Schütteln heruntergefallenes, noch nicht aufgesammeltes Obst bleibt liegen
    for (const [key, v] of Object.entries(this.st.flags)) {
      const m = key.match(/^drop:([^:]+):([^:]+):(\w+):(\d+):(\d+)$/);
      if (v && m && m[1] === this.map.id && !this.st.picked[`${m[1]}:${m[2]}`]) this.addPickup(m[3] as ItemId, +m[4], +m[5], `${m[1]}:${m[2]}`, true);
    }
    const nestProp = this.map.props.find((p) => p.action === 'returnChick');
    if (nestProp && this.textures.exists('crt-fledgling')) this.showNest(!!this.st.flags.chickReturned, nestProp.at);
  }

  /** Einmalige kleine Ortsentdeckungen, ohne weitere Pflichtziele oder Beute. */
  private discover(id: string, title: string, at: Pt) {
    const flag = `discovered:${id}`;
    if (this.st.flags[flag]) return;
    this.st.flags[flag] = true;
    const ring = this.add.ellipse(at[0], at[1], 12, 5).setStrokeStyle(1, 0xffe6a4, 0.8).setDepth(at[1] + 1);
    const label = this.add.text(320, 96, title, { fontFamily: FONT, fontSize: '9px', color: '#ffe6a4', stroke: '#2a1e10', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(1000);
    this.tweens.add({ targets: ring, scale: ambientPrefs().reducedMotion ? 1 : 2.2, alpha: 0, duration: 750, onComplete: () => ring.destroy() });
    this.tweens.add({ targets: label, alpha: 0, duration: 400, delay: 1500, onComplete: () => label.destroy() });
    this.events.emit('discovery', { id, title });
  }

  private addPickup(item: ItemId, x: number, y: number, key: string, ready: boolean) {
    const s = item === 'kueken'
      ? this.add.image(x, y, 'crt-fledgling', 0).setOrigin(0.5, 29 / 32)
      : this.add.image(x, y, this.textures.exists(itemTexture(item)) ? itemTexture(item) : 'px', ITEM_FRAME[item]).setOrigin(0.5, 1);
    s.setDepth(y);
    if (!ambientPrefs().reducedMotion) {
      if (item !== 'kueken') this.tweens.add({ targets: s, y: y - 2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      else this.tweens.add({ targets: s, scaleY: 0.92, duration: 260, yoyo: true, repeat: -1 });
    }
    const entry = { key, item, s, ready };
    this.pickups.push(entry);
    return entry;
  }

  private collectPickups() {
    for (const p of this.pickups) {
      if (!p.ready || !p.s.visible) continue;
      if (Phaser.Math.Distance.Between(this.lia.x, this.lia.y, p.s.x, p.s.y) > 12) continue;
      p.s.setVisible(false);
      this.st.picked[p.key] = true;
      this.give(p.item);
      sfx.pickup();
      this.hud.thought(pickupText(p.item), 2600);
      if (!ambientPrefs().particles) continue;
      const fx = this.add.particles(p.s.x, p.s.y - 6, 'px', {
        speed: { min: 20, max: 60 }, lifespan: 420, scale: { start: 1, end: 0 }, tint: [0xfff4d8, 0xffd27a], emitting: false,
      }).setDepth(990);
      fx.explode(14);
      this.time.delayedCall(500, () => fx.destroy());
    }
  }

  private give(item: ItemId, n = 1) {
    this.st.inv[item] = (this.st.inv[item] ?? 0) + n;
    this.refreshInventory();
    this.refreshObjective();
  }
  private take(item: ItemId, n = 1) {
    this.st.inv[item] = Math.max(0, (this.st.inv[item] ?? 0) - n);
    this.refreshInventory();
    this.refreshObjective();
  }

  private refreshInventory() {
    this.inventory.refresh(this.st.inv);
  }

  private refreshObjective() { const text = travelObjective(this.st, this.map.id) ?? objectiveText(this.st, this.map.id); this.objText?.setText(text); this.data.set('mobile:objective', text); }

  private showNest(withChick: boolean, at?: Pt) {
    const p = at ?? this.map.props.find((x) => x.action === 'returnChick')!.at;
    this.nest?.destroy();
    this.nest = this.add.image(p[0], p[1] - 78, 'crt-fledgling', withChick ? 3 : 2).setDepth(650);
  }

  private beginChickReturn(prop: Prop, complete: () => void) {
    if (this.nestClimb || this.busy) return;
    this.clearTarget();
    this.busy = true;
    this.facing = 'n';
    this.nestClimb = { prop, from: [this.lia.x, this.lia.y], progress: 0, complete, returning: false };
    this.inventory.setVisible(false);
    this.prompt.setVisible(false);
    this.lia.play('lia-walk-n').anims.pause();
    this.climbHands = this.add.graphics().setDepth(641);
    this.hud.hint('E halten / Baum gedrückt halten: zum Nest klettern', true);
  }

  private updateNestClimb(dt: number) {
    const climb = this.nestClimb!;
    if (climb.returning) return;
    const held = this.input.enabled && !!this.input.keyboard?.enabled && (this.keys.E.isDown || !!this.climbPointer?.isDown);
    if (held) climb.progress = Math.min(1, climb.progress + dt / NEST_CLIMB_MS);
    // The vertical displacement is gameplay feedback, including with reduced motion.
    const x = Phaser.Math.Linear(climb.from[0], climb.prop.at[0], Math.min(1, climb.progress * 4));
    const y = Phaser.Math.Linear(climb.from[1], climb.prop.at[1] - 30, climb.progress);
    this.lia.setPosition(x, y).setDepth(640);
    this.shadow.setPosition(climb.prop.at[0], climb.prop.at[1] - 1).setDepth(climb.prop.at[1] - 1).setAlpha(0.3);
    if (held) this.lia.anims.resume(); else this.lia.anims.pause();
    const grip = Math.floor(climb.progress * 12) % 2;
    this.climbHands!.clear().setPosition(x, y);
    // Alternating raised hands make the north-facing steps read as trunk grips.
    for (const side of [-1, 1]) {
      const handY = -32 - (side === (grip ? 1 : -1) ? 5 : 0);
      this.climbHands!.fillStyle(0xb18b56).fillRect(side * 6 - 1, handY + 3, 3, 7);
      this.climbHands!.fillStyle(0xf0c38a).fillRect(side * 6 - 1, handY, 3, 4);
    }
    const percent = Math.round(climb.progress * 100);
    this.hud.hint(`${held ? 'Zum Nest klettern' : 'Am Stamm festhalten'}: ${percent}% · E / Baum halten`, true);
    if (climb.progress < 1) return;
    climb.returning = true;
    climb.complete();
    this.hud.hint('Vorsichtig wieder hinunter …', true);
    this.climbPointer = undefined;
    this.tweens.add({
      targets: this.lia, x: climb.from[0], y: climb.from[1], duration: 1100, ease: 'Sine.inOut',
      onUpdate: () => this.climbHands?.setPosition(this.lia.x, this.lia.y),
      onComplete: () => {
        this.lia.setPosition(...climb.from).setDepth(climb.from[1]).play('lia-idle-n');
        this.shadow.setPosition(climb.from[0], climb.from[1] - 1).setAlpha(1);
        this.climbHands?.destroy(); this.climbHands = undefined;
        this.nestClimb = undefined; this.busy = false;
        this.inventory.setVisible(true);
        this.hud.hint('', true);
        this.updatePrompt();
      },
    });
  }

  private api(): WorldApi {
    return {
      mapId: this.map.id,
      st: this.st,
      thought: (t, ms) => this.hud.thought(t, ms ?? 2800),
      give: (i, n) => this.give(i, n),
      take: (i, n) => this.take(i, n),
      refreshObjective: () => this.refreshObjective(),
      showNest: (c) => this.showNest(c),
      beginChickReturn: (p, complete) => this.beginChickReturn(p, complete),
      shakeAt: (x, y) => {
        if (!ambientPrefs().reducedMotion) this.cameras.main.shake(160, 0.003);
        if (!ambientPrefs().particles) return;
        const leaves = this.add.particles(x, y, 'px', {
          x: { min: -26, max: 26 }, speedY: { min: 20, max: 60 }, speedX: { min: -20, max: 20 }, lifespan: 1400,
          scale: { min: 0.8, max: 1.4 }, tint: [0x52783c, 0x6f9a3e, 0xd6ad59], rotate: { min: 0, max: 360 }, emitting: false,
        }).setDepth(900);
        leaves.explode(30);
        this.time.delayedCall(1600, () => leaves.destroy());
      },
      dropPickup: (item, from, to, id) => {
        const key = `${this.map.id}:${id}`;
        if (this.st.picked[key]) return;
        this.st.flags[`drop:${key}:${item}:${Math.round(to.x)}:${Math.round(to.y)}`] = true;
        const e = this.addPickup(item, from.x, from.y, key, false);
        this.tweens.killTweensOf(e.s);
        this.tweens.add({
          targets: e.s, x: to.x, y: to.y, duration: motionDuration(520), ease: 'Bounce.out', delay: motionDuration(Phaser.Math.Between(0, 220)),
          onComplete: () => { e.ready = true; e.s.setDepth(to.y); sfx.step(); if (!ambientPrefs().reducedMotion) this.tweens.add({ targets: e.s, y: to.y - 2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' }); },
        });
      },
    };
  }

  /** F1 oder ?debug: Begehbarkeit, Blocker, Ausgänge und Objekte einblenden. */
  private toggleDebug() {
    if (this.debugG) { this.debugG.destroy(); this.debugG = undefined; return; }
    const g = (this.debugG = this.add.graphics().setDepth(995));
    for (const p of this.map.walk) g.lineStyle(1, 0x00ff88, 0.9).strokePoints(p.map(([x, y]) => ({ x, y })), true);
    for (const p of this.map.block) g.fillStyle(0xff3355, 0.35).fillPoints(p.map(([x, y]) => ({ x, y })), true);
    for (const e of this.map.exits) g.fillStyle(0x3399ff, 0.5).fillRect(...e.rect);
    for (const p of this.map.props) g.lineStyle(1, 0xffdd00, 1).strokeCircle(p.at[0], p.at[1], p.radius);
    for (const t of this.map.triggers ?? []) g.lineStyle(1, 0xff00ff, 1).strokeRect(...t.rect);
  }
}

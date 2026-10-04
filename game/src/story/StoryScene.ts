import Phaser from 'phaser';
import { sfx } from '../audio';
import { InventoryHud } from '../inventory';
import { ambientPrefs, motionDuration, subscribeSettings } from '../settings';
import { FONT, Hud } from '../ui';
import { clearWalkingLine, findWalkingPath, inPoly } from '../world/navigation';
import { state } from '../world/quests';
import type { Dir } from '../world/maps';
import type { Pt, StoryArea, StorySpot } from './types';
import { StoryCloseup, type CloseupOptions } from './closeups';
import { resolveLiaAppearance } from '../appearance';

const SPEED = 72;
const WALK_HINT = 'WASD / Pfeile: gehen · Klick: gehen / untersuchen · I: Tasche';

/** Shared exploration controls and collision for the story chapters. */
export class StoryScene extends Phaser.Scene {
  protected lia!: Phaser.GameObjects.Sprite;
  protected hud!: Hud;
  protected inventory!: InventoryHud;
  protected areaRoot!: Phaser.GameObjects.Container;
  protected keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private area!: StoryArea;
  private shadow!: Phaser.GameObjects.Image;
  private prompt!: Phaser.GameObjects.Container;
  private spots: StorySpot[] = [];
  private markers: { spot: StorySpot; object: Phaser.GameObjects.Container }[] = [];
  private actors: Phaser.GameObjects.Image[] = [];
  private route: Pt[] = [];
  private destination?: Pt;
  private routeSpot?: StorySpot;
  private facing: Dir = 's';
  private locked = false;
  private cinematic = false;
  private closeup?: StoryCloseup;
  private liaPose?: string;
  private liaCrouched = false;
  private leaving = false;
  private stepTimer = 0;
  private stuckMs = 0;
  private hint = '';
  private inventorySignature = '';
  private readonly onInteract = () => {
    if (this.closeup?.hasCaption) { this.closeup.advance(); return; }
    if (this.hud.advanceDialogue()) return;
    this.useSpot(this.nearestSpot());
  };
  private transitionDone?: () => void;

  protected get areaCurrent(): StoryArea { return this.area; }
  protected get closeupVisible(): boolean { return this.closeup?.visible ?? false; }

  protected begin(area: StoryArea) {
    this.closeup?.destroy();
    this.closeup = undefined;
    this.liaPose = undefined;
    this.liaCrouched = false;
    this.data.set('story:lia-crouched', false);
    this.locked = false;
    this.cinematic = false;
    this.leaving = false;
    this.facing = 's';
    this.stepTimer = 0;
    this.hint = '';
    this.actors = [];
    this.markers = [];
    this.clearRoute();
    this.areaRoot = this.add.container(0, 0);
    this.hud = new Hud(this, 'portrait-lia', 'LIA');
    this.hud.setHp(1, false);
    this.inventory = new InventoryHud(this, () => this.clearRoute());
    this.inventorySignature = '';
    this.refreshInventory();
    const bubble = this.add.rectangle(0, 0, 22, 22, 0x14171b, 0.9).setStrokeStyle(1, 0xd8d2c0);
    const key = this.add.text(0, 0, 'E', { fontFamily: FONT, fontSize: '14px', color: '#e8e2d0' }).setOrigin(0.5);
    this.prompt = this.add.container(0, 0, [bubble, key]).setDepth(990).setVisible(false);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.E.on('down', this.onInteract);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.changeArea(area);
    const unsubscribe = subscribeSettings(() => {
      if (ambientPrefs().reducedMotion) {
        this.cameras.main.shakeEffect.reset();
        if (this.transitionDone) this.transitionDone();
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      this.leaving = true;
      this.clearRoute();
      this.keys.E.off('down', this.onInteract);
      this.input.off('pointerdown', this.onPointerDown, this);
      if (this.transitionDone) this.cameras.main.off('camerafadeoutcomplete', this.transitionDone);
      this.transitionDone = undefined;
      this.spots = [];
      this.actors = [];
      this.markers = [];
      this.closeup = undefined;
      this.liaPose = undefined;
      this.data.set('mobile:closeup', '');
    });
    const duration = motionDuration(280);
    this.cameras.main.resetFX();
    if (duration) this.cameras.main.fadeIn(duration, 0, 0, 0);
  }

  protected changeArea(area: StoryArea) {
    this.hideCloseup();
    this.liaPose = undefined;
    this.clearRoute();
    this.spots = [];
    this.markers = [];
    this.actors = [];
    this.prompt.setVisible(false);
    // Area-local cinematic tweens must not retain destroyed actors on revisits.
    for (const object of this.areaRoot.list) this.tweens.killTweensOf(object);
    this.areaRoot.removeAll(true);
    this.area = area;
    this.facing = 's';
    const background = this.add.image(0, 0, area.bg).setOrigin(0).setDisplaySize(640, 360).setDepth(-1000);
    this.shadow = this.add.image(...area.start, 'shadow').setDepth(area.start[1] - 1);
    const appearance = resolveLiaAppearance({ flags: state(this.registry).flags, areaId: area.id });
    this.lia = this.add.sprite(...area.start, appearance.texture, 0).setOrigin(0.5, 60 / 64).setDepth(area.start[1]);
    this.refreshLiaAppearance();
    this.areaRoot.add([background, this.shadow, this.lia]);
    this.areaRoot.sort('depth');
    this.refreshPrompt();
  }

  protected setSpots(spots: StorySpot[]) {
    this.clearRoute();
    for (const marker of this.markers) marker.object.destroy();
    this.spots = spots;
    this.markers = spots.map(spot => {
      const ring = this.add.ellipse(0, 0, 12, 5).setStrokeStyle(1, 0xfff4d8, 0.65);
      const dot = this.add.rectangle(0, -7, 2, 2, 0xfff4d8);
      const object = this.add.container(...spot.at, [ring, dot]).setDepth(850);
      this.areaRoot.add(object);
      return { spot, object };
    });
    this.refreshPrompt();
  }

  protected setObjective(text: string) { this.hud.setObjective(text); }
  protected say(text: string, ms = 3000) { this.hud.thought(text, ms); }
  protected setLocked(locked: boolean) {
    this.locked = locked;
    if (locked) { this.clearRoute(); this.idleLia(); }
  }
  protected setCinematic(cinematic: boolean) {
    this.cinematic = cinematic;
    this.inventory.setVisible(!cinematic && !this.closeupVisible && !this.closeup?.hasCaption);
    if (cinematic) this.clearRoute();
    this.refreshHudVisibility();
    this.refreshPrompt();
  }

  /** True illustrated close-ups sit above map art and below dialogue/HUD. */
  protected showCloseup(textureKey: string, options: CloseupOptions = {}) {
    this.closeup ??= new StoryCloseup(this);
    this.closeup.show(textureKey, options);
    this.hud.thought('', 0);
    this.hud.setThoughtsVisible(false);
    this.refreshHudVisibility();
    this.clearRoute();
    this.inventory.close();
    this.inventory.setVisible(!this.cinematic && !this.closeupVisible && !this.closeup?.hasCaption);
    this.data.set('mobile:closeup', this.closeupVisible ? textureKey : '');
    this.refreshPrompt();
  }

  protected hideCloseup() {
    this.closeup?.hide();
    this.hud?.setThoughtsVisible(true);
    this.refreshHudVisibility();
    this.inventory?.setVisible(!this.cinematic);
    this.data.set('mobile:closeup', '');
    if (this.prompt) this.refreshPrompt();
  }

  protected setCloseupText(text: string) {
    this.closeup ??= new StoryCloseup(this);
    this.hud.thought('', 0);
    this.hud.setThoughtsVisible(false);
    this.closeup.setText(text);
    this.refreshHudVisibility();
    if (text) { this.clearRoute(); this.inventory.setVisible(false); }
    this.refreshPrompt();
  }

  private refreshHudVisibility() {
    const cinematic = this.cinematic || this.closeupVisible || !!this.closeup?.hasCaption;
    this.hud?.setCinematic(cinematic);
    this.hud?.setObjectiveVisible(!cinematic);
  }

  protected setCloseupContinue(callback: (() => void) | null, label = 'Weiter') {
    this.closeup ??= new StoryCloseup(this);
    this.closeup.setContinue(callback, label);
  }

  /** A kneeling/crouched pose survives logical E interactions and locked idle updates. */
  protected setLiaPose(animation: string | null) {
    this.liaPose = animation && this.anims.exists(animation) ? animation : undefined;
    if (!this.liaPose) this.lia.setOrigin(0.5, 60 / 64);
    this.idleLia();
  }

  /** Movement changes pose without replacing keyboard or pointer navigation. */
  protected setLiaCrouched(crouched: boolean) {
    this.liaCrouched = crouched;
    this.data.set('story:lia-crouched', crouched);
    this.idleLia();
  }

  protected playLiaMovement(direction: Dir, moving: boolean) {
    const appearance = resolveLiaAppearance({
      flags: state(this.registry).flags, areaId: this.area?.id, direction, moving,
      crouched: this.liaCrouched, pose: this.liaPose,
    });
    this.data.set('story:lia-appearance', appearance);
    this.lia.setFlipX(appearance.flipX).play(appearance.animation, true);
  }

  protected refreshLiaAppearance() {
    if (this.lia) this.idleLia();
  }

  private idleLia() {
    this.playLiaMovement(this.facing, false);
  }

  protected goTo(sceneKey: string) {
    if (this.leaving) return;
    this.leaving = true;
    this.setLocked(true);
    this.inventory.close();
    this.prompt.setVisible(false);
    const finish = () => {
      if (this.transitionDone !== finish) return;
      this.cameras.main.off('camerafadeoutcomplete', finish);
      this.transitionDone = undefined;
      this.scene.start(sceneKey);
    };
    this.transitionDone = finish;
    const duration = motionDuration(350);
    if (!duration) { finish(); return; }
    this.cameras.main.once('camerafadeoutcomplete', finish);
    this.cameras.main.fadeOut(duration, 0, 0, 0);
  }

  protected addActor(texture: string, frame: string | number, at: Pt): Phaser.GameObjects.Image {
    const actor = this.add.image(...at, texture, frame).setOrigin(0.5, 60 / 64).setDepth(at[1]);
    this.areaRoot.add(actor);
    this.actors.push(actor);
    return actor;
  }

  update(_time: number, dt: number) {
    this.closeup?.update();
    this.hud?.setObjectiveVisible(!this.cinematic && !this.closeupVisible && !this.closeup?.hasCaption && !this.hud.dialogueVisible);
    if (this.inventory?.isOpen) return;
    if (this.leaving || !this.lia?.active) return;
    dt = Math.min(dt, 50);
    this.refreshInventory();
    this.shadow.setPosition(this.lia.x, this.lia.y - 1).setDepth(this.lia.y - 1);
    this.lia.setDepth(this.lia.y);
    for (const actor of this.actors) if (actor.active) actor.setDepth(actor.y);
    if (!this.locked && !this.closeupVisible && !this.closeup?.hasCaption && !this.hud.dialogueVisible) this.move(dt);
    this.areaRoot.sort('depth');
    this.refreshPrompt();
  }

  private walkable = (x: number, y: number): boolean => {
    const ok = (px: number, py: number) => this.area.walk.some(p => inPoly(px, py, p)) && !this.area.block.some(p => inPoly(px, py, p));
    return ok(x, y) && ok(x - 5, y) && ok(x + 5, y) && ok(x, y - 3);
  };

  private move(dt: number) {
    const k = this.keys;
    let dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (dx || dy) this.clearRoute();
    else if (this.destination) {
      if (this.routeSpot && !this.isEnabled(this.routeSpot)) this.clearRoute();
      else if (this.routeSpot && this.inRange(this.routeSpot)) {
        const spot = this.routeSpot;
        this.clearRoute();
        this.useSpot(spot);
        return;
      }
      if (this.destination) {
        const distance = Math.hypot(this.destination[0] - this.lia.x, this.destination[1] - this.lia.y);
        if (distance < 1) {
          if (clearWalkingLine([this.lia.x, this.lia.y], this.destination, this.walkable)) {
            this.lia.setPosition(...this.destination);
            this.advanceRoute();
          } else this.clearRoute();
          return;
        }
        dx = (this.destination[0] - this.lia.x) / distance;
        dy = (this.destination[1] - this.lia.y) / distance;
      }
    }
    if (!dx && !dy) { this.idleLia(); return; }
    const length = Math.hypot(dx, dy);
    let step = (this.liaCrouched ? 44 : SPEED) * dt / 1000;
    if (this.destination) step = Math.min(step, Math.hypot(this.destination[0] - this.lia.x, this.destination[1] - this.lia.y));
    const ox = this.lia.x, oy = this.lia.y;
    const nx = ox + dx / length * step, ny = oy + dy / length * step;
    if (clearWalkingLine([ox, oy], [nx, ny], this.walkable)) this.lia.setPosition(nx, ny);
    else if (!this.destination) {
      if (clearWalkingLine([ox, oy], [nx, oy], this.walkable)) this.lia.x = nx;
      else if (clearWalkingLine([ox, oy], [ox, ny], this.walkable)) this.lia.y = ny;
    }
    const moved = Math.hypot(this.lia.x - ox, this.lia.y - oy);
    this.stuckMs = moved < step * 0.2 ? this.stuckMs + dt : 0;
    if (this.destination && this.stuckMs > 250) this.clearRoute();
    this.facing = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'e' : 'w' : dy > 0 ? 's' : 'n';
    this.playLiaMovement(this.facing, moved > 0.05);
    if (moved > 0.05) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) { this.stepTimer = 300; sfx.step(); }
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (this.leaving || this.closeupVisible || this.closeup?.hasCaption || this.inventory.hitTest(pointer) || this.hud.hitTest(pointer)) return;
    if (pointer.x > 606 && pointer.y > 326) return;
    this.inventory.close();
    // Cinematic framing transforms the art, while routes and spots remain area-local.
    const local = this.areaRoot.getWorldTransformMatrix().applyInverse(pointer.worldX, pointer.worldY);
    const spot = this.spots.filter(s => this.isEnabled(s) && Math.hypot(local.x - s.at[0], local.y - s.at[1]) <= s.radius)
      .sort((a, b) => Math.hypot(local.x - a.at[0], local.y - a.at[1]) - Math.hypot(local.x - b.at[0], local.y - b.at[1]))[0];
    if (spot && this.inRange(spot)) { this.useSpot(spot); return; }
    if (this.locked) return;
    this.clearRoute();
    const from: Pt = [this.lia.x, this.lia.y];
    const goal: Pt = spot?.at ?? [local.x, local.y];
    let path = findWalkingPath(from, goal, this.walkable, spot?.radius ?? 24);
    // A blocked target may have a closer point in a disconnected region. Search
    // the full interaction circle for an approach that this character can reach.
    if (spot && (!path.length || Math.hypot(path.at(-1)![0] - goal[0], path.at(-1)![1] - goal[1]) > spot.radius)) {
      path = [];
      const toward = Math.atan2(from[1] - goal[1], from[0] - goal[0]);
      for (const radius of [spot.radius * 0.85, spot.radius * 0.55, spot.radius * 0.25]) {
        for (let i = 0; i < 32; i++) {
          const angle = toward + i * Math.PI / 16;
          const approach: Pt = [goal[0] + Math.cos(angle) * radius, goal[1] + Math.sin(angle) * radius];
          if (!this.walkable(...approach)) continue;
          path = findWalkingPath(from, approach, this.walkable, 0);
          if (path.length) break;
        }
        if (path.length) break;
      }
    }
    if (!path.length) { this.say('Von hier komme ich dort nicht heran.', 1600); return; }
    this.routeSpot = spot;
    this.route = path;
    this.destination = this.route.shift();
  }

  private clearRoute() { this.route = []; this.destination = undefined; this.routeSpot = undefined; this.stuckMs = 0; }
  private refreshInventory() {
    const inv = state(this.registry).inv;
    const signature = JSON.stringify(inv);
    if (signature === this.inventorySignature) return;
    this.inventorySignature = signature;
    this.inventory.refresh(inv);
  }
  private advanceRoute() {
    this.destination = this.route.shift();
    if (this.destination) return;
    const spot = this.routeSpot;
    this.clearRoute();
    this.useSpot(spot);
  }
  private isEnabled(spot: StorySpot) { return !spot.enabled || spot.enabled(); }
  private inRange(spot: StorySpot) { return Math.hypot(this.lia.x - spot.at[0], this.lia.y - spot.at[1]) <= spot.radius; }
  private nearestSpot() {
    return this.spots.filter(spot => this.isEnabled(spot) && this.inRange(spot))
      .sort((a, b) => Math.hypot(this.lia.x - a.at[0], this.lia.y - a.at[1]) - Math.hypot(this.lia.x - b.at[0], this.lia.y - b.at[1]))[0];
  }
  private useSpot(spot?: StorySpot) {
    if (this.leaving || this.inventory?.isOpen || !spot || !this.spots.includes(spot) || !this.isEnabled(spot) || !this.inRange(spot)) return;
    this.clearRoute();
    this.idleLia();
    sfx.select();
    spot.onUse();
  }
  private refreshPrompt() {
    const spot = this.nearestSpot();
    this.prompt.setVisible(!!spot && !this.leaving && !this.cinematic && !this.closeupVisible && !this.closeup?.hasCaption);
    if (spot) {
      const position = this.areaRoot.getWorldTransformMatrix().transformPoint(this.lia.x, this.lia.y - 58);
      this.prompt.setPosition(Math.round(position.x), Math.round(position.y));
    }
    const hint = this.cinematic || this.closeupVisible || this.closeup?.hasCaption ? '' : spot ? `${spot.label} · E / Klick` : WALK_HINT;
    if (hint !== this.hint) { this.hint = hint; this.hud.hint(hint, true); }
    for (const marker of this.markers) marker.object.setVisible(!this.cinematic && !this.closeupVisible && !this.closeup?.hasCaption && (this.isEnabled(marker.spot) || marker.spot.markerWhenDisabled === true) && (!marker.spot.markerVisible || marker.spot.markerVisible()));
  }
}

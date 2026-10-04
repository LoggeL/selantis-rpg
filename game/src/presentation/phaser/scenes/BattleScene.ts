import Phaser from 'phaser';
import { sfx, startBattleAmbience } from "../../../app/audio";
import * as grid from "../../../modules/combat/grid";
import { dirFromVector, eq, key, manhattan, unitAt, type Cell, type Push, type Unit } from "../../../modules/combat/grid";
import { Hud, FONT } from "../Hud";
import { ambientPrefs, getSettings, subscribeSettings } from "../../../app/settings";
import type { MobileControlProfile } from "../../dom/controlLabels";
import { StoryCloseup } from "../StoryCloseup";
import { usesMobileInterface } from "../../dom/dialogs";
import { resolveBattleUnitStats } from "../../../app/characterRules";
import { enemyOrder, facingFromVector, facingVector, unitSpeed, type BattleSnapshot } from "../../../modules/combat/tactics";
import { BattleModel, type BattleEffect, type BattlePhase, type DamageResult } from "../../../modules/combat/model";
import { DUNKELHAIN } from "../../../content/encounters/dunkelhain";
import { bindSceneInput, type SceneInputScope } from "../../../platform/input/router";

type Phase = BattlePhase;
type Aim = Pick<Phaser.Input.Pointer, 'worldX' | 'worldY'>;
const GRID = { ...DUNKELHAIN.board, ...DUNKELHAIN.layout };
const cellAt = (x: number, y: number) => grid.cellAt(x, y, DUNKELHAIN.board, DUNKELHAIN.layout);
const cellCenter = (cell: Cell) => grid.cellCenter(cell, DUNKELHAIN.layout);
const cellFoot = (cell: Cell) => grid.cellFoot(cell, DUNKELHAIN.layout);
const inside = (cell: Cell) => grid.inside(cell, DUNKELHAIN.board);
const isRock = (cell: Cell) => grid.isBlocked(cell, DUNKELHAIN.board);
const START_CELL = DUNKELHAIN.player.cell;
const BOY_CELL = DUNKELHAIN.narrative!.protectedCell;
const BOY_EXIT = DUNKELHAIN.narrative!.exit;
const BEAM = DUNKELHAIN.abilities.find(ability => ability.id === 'beam')!;
const WAVE = DUNKELHAIN.abilities.find(ability => ability.id === 'wave')!;
const MAGIC_BLUE = BEAM.display.color;
const DANGER = 0xd2453a;

export class BattleScene extends Phaser.Scene {
  private inputScope?: SceneInputScope;
  private controls?: ReturnType<SceneInputScope['setControls']>;
  private model = new BattleModel(DUNKELHAIN, resolveBattleUnitStats);
  private get units() { return this.model.state.units; }
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private shadows = new Map<string, Phaser.GameObjects.Image>();
  private get intents() { return this.model.intents; }
  private intentIcons = new Map<string, Phaser.GameObjects.Image>();
  private get phase() { return this.model.state.phase; }
  private set phase(value: Phase) { this.model.state.phase = value; }
  private get beat() { return this.model.state.beat; }
  private set beat(value: number) { this.model.state.beat = value; }
  private turnStart: Cell = START_CELL;
  private get turn() { return this.model.state.turn; }
  private get moved() { return this.turn.moved; }
  private get acted() { return this.turn.acted; }
  private get guarding() { return this.model.state.guarding; }
  private get facing() { return this.model.state.facing; }
  private set facing(value: typeof this.model.state.facing) { this.model.state.facing = value; }
  private tacticalText?: Phaser.GameObjects.Text;
  private tacticalPanel?: Phaser.GameObjects.Rectangle;
  private get maxHp() { return this.model.state.maxHp; }
  private gridG!: Phaser.GameObjects.Graphics;
  private previewG!: Phaser.GameObjects.Graphics;
  private intentG!: Phaser.GameObjects.Graphics;
  private hud!: Hud;

  private marker?: Phaser.GameObjects.Container;
  private stopAmbience: () => void = () => {};
  private falkeShown = false;
  private lastMagic: { kind: 'beam' | 'wave'; from: Cell; dir?: Cell; center?: Cell } | null = null;
  private hintsSeen = new Set<string>();
  private cursor: Cell = { ...START_CELL };
  private goalG!: Phaser.GameObjects.Graphics;
  private ambientTweens: Phaser.Tweens.Tween[] = [];
  private ambientEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private cinematicAdvance?: () => void;
  private stabCloseup?: StoryCloseup;
  private arrivalPath: Array<{ x: number; y: number }> = [];
  private finishControl?: Phaser.GameObjects.Container;
  private finishLabel?: Phaser.GameObjects.Text;
  private backgroundSoldiers: Phaser.GameObjects.Sprite[] = [];

  constructor() { super('battle'); }

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.cinematicAdvance = undefined;
    const controls: MobileControlProfile | undefined = phase === 'arrival'
      ? { directions: ['up', 'left', 'down', 'right'], actions: {}, inventory: false }
      : phase === 'busy' || phase === 'end'
        ? { directions: [], actions: { E: 'Weiter' }, inventory: false }
        : phase === 'facing'
          ? { directions: ['up', 'left', 'down', 'right'], actions: { ENTER: 'Zug beenden' }, inventory: true }
          : { directions: ['up', 'left', 'down', 'right'], actions: this.acted
            ? { ENTER: 'Feld wählen', SPACE: 'Zug beenden' }
            : { ENTER: 'Feld wählen', Q: 'Strahl', R: 'Druckwelle', SPACE: 'Warten', ESC: 'Zurück' }, inventory: true };
    this.data.set('mobile:controls', controls);
    if (controls && this.inputScope) {
      if (this.controls) this.controls.update(controls);
      else this.controls = this.inputScope.setControls(controls);
    }
    this.refreshTacticalStatus();
  }

  create() {
    this.controls = undefined;
    this.inputScope = undefined;
    this.model = new BattleModel(DUNKELHAIN, resolveBattleUnitStats); this.sprites.clear(); this.shadows.clear(); this.intents.clear(); this.intentIcons.clear();
    this.maxHp.clear();
    this.setPhase('arrival'); this.beat = 0; this.falkeShown = false;
    this.facing = 's'; this.lastMagic = null; this.hintsSeen.clear(); this.cursor = { ...START_CELL };
    this.turnStart = { ...START_CELL };
    this.ambientTweens = []; this.ambientEmitters = [];
    this.stabCloseup = undefined;
    this.arrivalPath = []; this.backgroundSoldiers = [];
    this.finishControl = undefined; this.finishLabel = undefined;
    this.data.set('story:battleEnding', '');
    this.data.set('battle:axeOutcome', '');
    this.cameras.main.fadeIn(900, 0, 0, 0);
    this.add.image(0, 0, 'bg-battle').setOrigin(0).setDepth(-1000);
    this.gridG = this.add.graphics().setDepth(-500);
    this.intentG = this.add.graphics().setDepth(-400);
    this.previewG = this.add.graphics().setDepth(-300);
    this.goalG = this.add.graphics().setDepth(-350);
    this.battlefieldLife();
    this.dreamLayer();

    this.hud = new Hud(this, 'portrait-valentus', 'VALENTUS');
    this.hud.setAbilities([
      { icon: BEAM.display.icon, key: BEAM.display.key, onClick: () => this.enterBeam() },
      { icon: WAVE.display.icon, key: WAVE.display.key, onClick: () => this.enterWave() },
      { icon: 'wait', key: '␣', onClick: () => this.doWait() },
    ]);
    this.hud.setAbilitiesVisible(false);
    this.tacticalPanel = this.add.rectangle(418, 92, 208, 207, 0x111821, 0.92).setOrigin(0).setStrokeStyle(1, 0x64809a).setDepth(980).setVisible(false);
    this.tacticalText = this.add.text(428, 101, '', { fontFamily: FONT, fontSize: '12px', color: '#e8e2d0', lineSpacing: 5, wordWrap: { width: 188 } }).setDepth(981);
    this.createFinishControl();

    const v = this.addUnit(DUNKELHAIN.player);
    v.setPosition(172, 74).play('v-idle-s');
    this.syncShadow('valentus');

    // Ankunftsmarker
    const p = cellCenter(START_CELL);
    const ring = this.add.ellipse(0, 10, 26, 10).setStrokeStyle(1, 0xbfd8ff, 0.9);
    const glow = this.add.ellipse(0, 10, 26, 10, MAGIC_BLUE, 0.25);
    this.marker = this.add.container(p.x, p.y, [glow, ring]).setDepth(-450);
    this.ambientTweens.push(this.tweens.add({ targets: [ring, glow], scale: { from: 0.8, to: 1.15 }, alpha: { from: 1, to: 0.4 }, duration: 900, yoyo: true, repeat: -1 }));

    this.inputScope = bindSceneInput(this, {
      interact: intent => { if (intent.phase !== 'end') this.cinematicAdvance?.(); },
      beam: intent => { if (intent.phase !== 'end') this.enterBeam(); },
      wave: intent => { if (intent.phase !== 'end') this.enterWave(); },
      wait: intent => { if (intent.phase !== 'end') this.doWait(); },
      cancel: intent => { if (intent.phase !== 'end') this.cancel(); },
      confirm: intent => { if (intent.phase !== 'end') this.confirmCursor(); },
      'move-left': intent => { if (intent.phase !== 'end') this.moveCursor(-1, 0); },
      'move-right': intent => { if (intent.phase !== 'end') this.moveCursor(1, 0); },
      'move-up': intent => { if (intent.phase !== 'end') this.moveCursor(0, -1); },
      'move-down': intent => { if (intent.phase !== 'end') this.moveCursor(0, 1); },
    });
    this.setPhase(this.phase);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => this.onHover(ptr));
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => (ptr.rightButtonDown() ? this.cancel() : this.onClick(ptr)));

    this.hud.hint('Klick auf den Hang oder WASD / Pfeiltasten: Geh zu deinem Platz.');
    this.time.delayedCall(400, () => this.hud.thought('Da stand er nun.'));
    const unsubscribe = subscribeSettings(() => {
      const prefs = ambientPrefs();
      for (const tween of this.ambientTweens) prefs.reducedMotion ? tween.pause() : tween.resume();
      for (const emitter of this.ambientEmitters) {
        emitter.emitting = prefs.particles; emitter.setVisible(prefs.particles);
        if (!prefs.particles) emitter.killAll();
      }
      if (prefs.reducedMotion) {
        this.cameras.main.shakeEffect.reset();
        for (const [id, icon] of this.intentIcons) {
          this.tweens.killTweensOf(icon);
          const sprite = this.sprites.get(id);
          if (sprite) icon.setPosition(sprite.x, sprite.y - 52);
        }
      } else if (this.intents.size) this.drawIntents();
    });
    this.events.once('shutdown', () => {
      unsubscribe();
      this.stopAmbience();
      this.stabCloseup?.destroy();
      this.stabCloseup = undefined;
      this.tweens.timeScale = 1;
      this.anims.globalTimeScale = 1;
    });
  }

  /** Small animated details remain outside the tactical simulation. */
  private battlefieldLife() {
    for (const x of [74, 178, 289, 384]) {
      const cloth = this.add.graphics();
      cloth.fillStyle(0xe6e3d7).fillRect(-9, 0, 18, 32);
      cloth.fillStyle(0xbebdaf).fillRect(7, 0, 2, 32);
      cloth.fillStyle(0x2d527f).fillTriangle(0, 11, -7, 8, -3, 17)
        .fillTriangle(0, 11, 7, 8, 3, 17).fillTriangle(-3, 13, 3, 13, 0, 23);
      const flag = this.add.container(x, 11, [cloth]).setDepth(5);
      this.ambientTweens.push(this.tweens.add({ targets: flag, angle: { from: -3, to: 4 }, scaleX: { from: 0.88, to: 1 },
        duration: 1300 + x, yoyo: true, repeat: -1, ease: 'Sine.inOut' }));
    }
    for (let i = 0; i < 8; i++) {
      const soldier = this.add.sprite(34 + i * 49, 60 + i % 2 * 3, 'falke', 8)
        .setOrigin(0.5, 60 / 64).setScale(0.31).setDepth(8).setTint(0x9a9b94);
      soldier.play('falke-idle');
      this.backgroundSoldiers.push(soldier);
      this.ambientTweens.push(this.tweens.add({ targets: soldier, y: soldier.y - 1, duration: 1100 + i * 110,
        yoyo: true, repeat: -1, ease: 'Sine.inOut' }));
    }
    this.time.addEvent({ delay: 2400, loop: true, callback: () => {
      if (this.phase === 'end' || !ambientPrefs().particles) return;
      const x = Phaser.Math.Between(460, 615), y = Phaser.Math.Between(220, 300);
      const glint = this.add.rectangle(x, y, 5, 1, 0xdcd7bd, 0.6).setDepth(10).setAngle(-30);
      this.tweens.add({ targets: glint, alpha: 0, x: x - 8, duration: 260, onComplete: () => glint.destroy() });
    } });
  }

  // ---------- Schlachtatmosphäre: atmende Ränder, träge Glut ----------
  private dreamLayer() {
    const vig = this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(900).setAlpha(0.55);
    this.ambientTweens.push(this.tweens.add({ targets: vig, alpha: 0.8, duration: 3800, yoyo: true, repeat: -1, ease: 'Sine.inOut' }));
    this.ambientEmitters.push(this.add.particles(0, 0, 'px', {
      x: { min: 0, max: 640 }, y: 370, lifespan: 9000, speedY: { min: -14, max: -6 }, speedX: { min: -4, max: 6 },
      scale: { min: 0.5, max: 1 }, alpha: { start: 0.9, end: 0 }, tint: [0xd9732b, 0xf0a040, 0xb04a1c], frequency: 260,
    }).setDepth(850));
    this.ambientEmitters.push(this.add.particles(0, 0, 'px', {
      x: { min: 0, max: 640 }, y: { min: 0, max: 360 }, lifespan: 6000, speedX: { min: 4, max: 12 }, speedY: { min: -2, max: 2 },
      scale: { min: 2, max: 4 }, alpha: { start: 0.06, end: 0 }, tint: 0x9aa0a6, frequency: 180,
    }).setDepth(840));
  }

  private shake(duration: number, intensity: number) {
    if (!getSettings().reducedMotion) this.cameras.main.shake(duration, intensity);
  }

  // ---------- Einheiten ----------
  private addUnit(u: Unit) {
    u = this.model.spawn(u);
    const sheet = { valentus: 'valentus-walk', warrior: 'warrior', axe: 'axe', crossbow: 'crossbow', boy: 'boy', falke: 'falke' }[u.kind];
    const f = cellFoot(u.cell);
    const s = this.add.sprite(f.x, f.y, sheet, 0).setOrigin(0.5, 60 / 64);
    this.sprites.set(u.id, s);
    this.shadows.set(u.id, this.add.image(f.x, f.y, 'shadow').setDepth(-200));
    this.refreshTacticalStatus();
    return s;
  }
  private sprite(id: string) { return this.sprites.get(id)!; }
  private unit(id: string) { return this.units.find((u) => u.id === id)!; }
  private syncShadow(id: string) {
    const s = this.sprite(id), sh = this.shadows.get(id)!;
    sh.setPosition(s.x, s.y - 1).setAlpha(s.alpha * (s.visible ? 1 : 0));
    s.setDepth(s.y);
  }

  update(_t: number, dt: number) {
    for (const id of this.sprites.keys()) this.syncShadow(id);
    this.stabCloseup?.update();
    if (this.phase === 'arrival') this.updateArrival(dt);
    this.finishControl?.setVisible(!usesMobileInterface() && (this.phase === 'plan' || this.phase === 'facing'));
    const tacticalVisible = !usesMobileInterface() && this.phase !== 'arrival' && this.phase !== 'end' && this.beat < 4;
    this.tacticalPanel?.setVisible(tacticalVisible);
    this.tacticalText?.setVisible(tacticalVisible);
  }

  private updateArrival(dt: number) {
    let dx = (this.inputScope?.isHeld('move-right') ? 1 : 0) - (this.inputScope?.isHeld('move-left') ? 1 : 0);
    let dy = (this.inputScope?.isHeld('move-down') ? 1 : 0) - (this.inputScope?.isHeld('move-up') ? 1 : 0);
    const v = this.sprite('valentus');
    if (dx || dy) this.arrivalPath = [];
    else {
      let target = this.arrivalPath[0];
      if (target && Phaser.Math.Distance.Between(v.x, v.y, target.x, target.y) < 3) {
        v.setPosition(target.x, target.y); this.arrivalPath.shift(); target = this.arrivalPath[0];
      }
      if (target) { dx = target.x - v.x; dy = target.y - v.y; }
    }
    if (dx || dy) {
      const len = Math.hypot(dx, dy), sp = Math.min(len > 1 ? len : Infinity, 62 * dt / 1000);
      const nx = Phaser.Math.Clamp(v.x + dx / len * sp, 40, 420), ny = Phaser.Math.Clamp(v.y + dy / len * sp, 70, 318);
      const c = cellAt(nx, ny - 8);
      if (!c || !isRock(c)) v.setPosition(nx, ny);
      const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
      this.facing = d;
      v.anims.currentAnim?.key !== `v-walk-${d}` && v.play(`v-walk-${d}`);
    } else if (v.anims.currentAnim?.key.startsWith('v-walk')) {
      v.play(`v-idle-${this.facing}`);
    }
    const target = cellFoot(START_CELL);
    if (Phaser.Math.Distance.Between(v.x, v.y, target.x, target.y) < 18) this.startBattle();
  }

  // ---------- Schlachtbeginn ----------
  private startBattle() {
    this.arrivalPath = [];
    this.setPhase('busy');
    const v = this.sprite('valentus');
    this.marker?.destroy();
    const f = cellFoot(START_CELL);
    this.tweens.add({ targets: v, x: f.x, y: f.y, duration: 150 });
    this.face('e');
    sfx.trumpets();
    this.stopAmbience = startBattleAmbience();
    this.hud.hint('');
    this.shake(900, 0.0035);
    this.time.delayedCall(700, () => this.hud.thought('Trompeten. Beide Heere setzen sich in Bewegung.'));
    this.drawGrid(true);
    this.time.delayedCall(1300, () => this.startBeat(1));
  }

  private drawGrid(fadeIn = false) {
    const g = this.gridG.clear();
    for (let y = 0; y < GRID.rows; y++) for (let x = 0; x < GRID.cols; x++) {
      if (isRock({ x, y })) continue;
      const px = GRID.originX + x * GRID.size, py = GRID.originY + y * GRID.size;
      g.lineStyle(1, 0xd8d2c0, 0.13).strokeRect(px + 0.5, py + 0.5, GRID.size - 1, GRID.size - 1);
    }
    if (fadeIn) { g.setAlpha(0); this.tweens.add({ targets: g, alpha: 1, duration: 700 }); }
  }

  // ---------- Beats ----------
  private startBeat(n: number) {
    const definition = this.model.startBeat(n);
    if (n === 1) {
      for (const unit of definition!.spawns) this.spawnEnemy(unit);
      this.time.delayedCall(900, () => {
        this.hud.thought(definition!.narrative!);
        this.beginPlayerTurn();
      });
    } else if (n === 2) {
      this.spawnBoyFalling(() => {
        this.spawnEnemy(definition!.spawns.find(unit => unit.side === 'enemy')!);
        this.time.delayedCall(700, () => {
          this.hud.showProtect('portrait-boy');
          this.hud.thought(definition!.narrative!, 2600);
          this.beginPlayerTurn();
        });
      });
    } else if (n === 3) {
      this.unit('boy') && this.sprite('boy').play('boy-rise');
      for (const unit of definition!.spawns) this.spawnEnemy(unit);
      this.time.delayedCall(900, () => {
        this.hud.thought(definition!.narrative!);
        this.beginPlayerTurn();
      });
    } else if (n === 4) {
      this.boyEscapes();
    }
  }

  private spawnEnemy(unit: Unit) {
    const { id, kind } = unit;
    const s = this.addUnit(unit);
    const f = cellFoot(this.unit(id).cell);
    s.setPosition(f.x + 160, f.y);
    s.play(kind === 'warrior' ? 'warrior-charge' : kind === 'axe' ? 'axe-walk' : 'crossbow-walk');
    this.tweens.add({
      targets: s, x: f.x, duration: 850, ease: 'Quad.out',
      onComplete: () => s.play(kind === 'warrior' ? 'warrior-ready' : kind === 'axe' ? 'axe-telegraph' : 'crossbow-idle'),
    });
  }

  private spawnBoyFalling(done: () => void) {
    const s = this.addUnit(DUNKELHAIN.beats[1].spawns.find(unit => unit.side === 'ally')!);
    const f = cellFoot(this.unit('boy').cell);
    s.setPosition(f.x + 50, f.y - 50).play('boy-prone');
    sfx.thud();
    this.tweens.add({
      targets: s, x: f.x, y: f.y, duration: 380, ease: 'Quad.in',
      onComplete: () => { this.shake(180, 0.006); sfx.hit(); done(); },
    });
  }

  // ---------- Spielerzug ----------
  private beginPlayerTurn() {
    this.model.startPlayerTurn();
    this.drawIntents();
    this.turnStart = { ...this.unit('valentus').cell };
    this.cursor = { ...this.turnStart };
    this.setPhase('plan');
    this.hud.setAbilitiesVisible(true);
    this.hud.setAbilitiesDisabled(false);
    this.showPlan();
    this.drawGoal();
    this.tutorialHint();
  }

  private tutorialHint() {
    const once = (id: string, text: string) => {
      if (this.hintsSeen.has(id)) return false;
      this.hintsSeen.add(id); this.hud.hint(text); return true;
    };
    if (this.beat === 1 && once('move', 'Blau: bewegen · Q: Strahl · Pfeile + Enter oder Klick.')) return;
    if (this.beat === 2 && once('wave', 'R: Druckwelle · schützt den Jungen.')) { this.hud.pulse('wave'); return; }
    if (this.beat === 3 && once('bolt', 'Bolzenlinie: hinein und warten (Leertaste), oder Schützen treffen.')) return;
  }

  private movementPaths() { return this.model.movementPaths(); }

  private cursorAim(): Aim {
    const p = cellCenter(this.cursor);
    return { worldX: p.x, worldY: p.y };
  }

  private moveCursor(dx: number, dy: number) {
    if (this.phase === 'facing') { this.face(facingFromVector(dx, dy)); this.drawFacing(); return; }
    if (!['plan', 'beam', 'wave'].includes(this.phase)) return;
    this.cursor = { x: Phaser.Math.Clamp(this.cursor.x + dx, 0, GRID.cols - 1),
      y: Phaser.Math.Clamp(this.cursor.y + dy, 0, GRID.rows - 1) };
    this.refreshPreview(this.cursorAim());
    this.refreshTacticalStatus();
  }

  private confirmCursor() {
    const aim = this.cursorAim();
    if (this.phase === 'facing') this.commitTurn();
    else if (this.phase === 'beam') this.confirmBeam(aim);
    else if (this.phase === 'wave') this.confirmWave(aim);
    else if (this.phase === 'plan') this.chooseMovement(this.cursor);
  }

  private drawGoal() {
    const g = this.goalG.clear();
    const target = this.beat === 1 ? this.units.find((u) => u.side === 'enemy' && u.alive)?.cell : BOY_CELL;
    if (!target) return;
    const p = cellCenter(target), color = this.beat === 1 ? 0xffc77c : 0x83c6b5;
    g.lineStyle(2, color, 0.9).strokeEllipse(p.x, p.y + 8, 25, 10);
    if (this.beat > 1) {
      const exit = cellCenter(BOY_EXIT[0]);
      g.lineStyle(1, 0x83c6b5, 0.5).lineBetween(p.x + 10, p.y + 5, exit.x, exit.y + 5);
    }
  }

  private showPlan() {
    const g = this.previewG.clear();
    const paths = this.movementPaths();
    for (const [, path] of paths) {
      const c = path[path.length - 1];
      const px = GRID.originX + c.x * GRID.size, py = GRID.originY + c.y * GRID.size;
      g.fillStyle(MAGIC_BLUE, 0.22).fillRect(px + 1, py + 1, GRID.size - 2, GRID.size - 2);
      g.lineStyle(1, 0x9cc4ec, 0.55).strokeRect(px + 1.5, py + 1.5, GRID.size - 3, GRID.size - 3);
    }
    const current = cellCenter(this.unit('valentus').cell);
    g.lineStyle(2, 0xc5e7ff, 0.95).strokeEllipse(current.x, current.y + 9, 24, 10);
    if (this.moved) this.markCell(g, this.turnStart, 0xb5c4cf, false, 0.4);
  }

  private onHover(ptr: Phaser.Input.Pointer) {
    // HUD hover must not aim a spell through the battlefield behind its icons.
    if (ptr.worldX >= 418 || ptr.worldY >= 314 || ptr.worldY < 88) return;
    const cell = cellAt(ptr.worldX, ptr.worldY);
    if (cell) this.cursor = cell;
    this.refreshPreview(ptr);
    this.refreshTacticalStatus();
  }

  private refreshPreview(ptr: Aim) {
    if (this.phase === 'plan') {
      this.showPlan();
      const c = cellAt(ptr.worldX, ptr.worldY);
      const path = c && this.movementPaths().get(key(c));
      if (path && path.length > 1) {
        const g = this.previewG;
        g.lineStyle(2, 0xe8f2ff, 0.9).beginPath();
        path.forEach((p, i) => { const m = cellCenter(p); i ? g.lineTo(m.x, m.y + 6) : g.moveTo(m.x, m.y + 6); });
        g.strokePath();
        this.markCell(g, c!, 0xe8f2ff, false);
        const end = cellCenter(c!);
        g.fillStyle(0xe8f2ff, 0.95).fillCircle(end.x, end.y + 6, 3);
        path.slice(1, -1).forEach((step) => { const p = cellCenter(step); g.fillCircle(p.x, p.y + 6, 1.5); });
      } else if (c && !path) {
        this.markCell(this.previewG, c, 0x777b82, true, 0.6);
      }
    } else if (this.phase === 'beam') this.previewBeam(ptr);
    else if (this.phase === 'wave') this.previewWave(ptr);
  }

  private onClick(ptr: Phaser.Input.Pointer) {
    if (this.hud.hitTest(ptr)) return;
    if (ptr.worldX >= 418 || ptr.worldY >= 314 || ptr.worldY < 88) return;
    if (this.phase === 'arrival') {
      const target = cellAt(ptr.worldX, ptr.worldY), v = this.sprite('valentus');
      const from = cellAt(v.x, Phaser.Math.Clamp(v.y - 8, GRID.originY, GRID.originY + GRID.rows * GRID.size - 1));
      if (!target || !from || isRock(target)) return;
      const path = grid.reachable([], from, GRID.cols * GRID.rows, DUNKELHAIN.board).get(key(target));
      if (path) this.arrivalPath = path.map(cellFoot);
    } else if (this.phase === 'plan') {
      const c = cellAt(ptr.worldX, ptr.worldY);
      if (c) this.chooseMovement(c);
    } else if (this.phase === 'facing') {
      const v = cellCenter(this.unit('valentus').cell);
      this.face(facingFromVector(ptr.worldX - v.x, ptr.worldY - v.y));
      this.drawFacing();
    } else if (this.phase === 'beam') this.confirmBeam(ptr);
    else if (this.phase === 'wave') this.confirmWave(ptr);
  }

  private chooseMovement(c: Cell) {
    if (this.moved) { this.hud.hint('Bewegung verbraucht. Aktion wählen oder Zug beenden.', true); return; }
    const path = this.movementPaths().get(key(c));
    if (path && path.length > 1 && !eq(c, this.unit('valentus').cell)) this.moveValentus(path);
    else if (!path) this.hud.hint('Dieses Feld ist blockiert oder zu weit.', true);
  }

  private moveValentus(path: Cell[]) {
    const result = this.model.dispatch({ type: 'move', to: path[path.length - 1] });
    if (!result.ok) return;
    const effect = result.effects[0];
    this.setPhase('busy');
    const v = this.unit('valentus'), s = this.sprite('valentus');
    const steps = path.slice(1);
    const run = (i: number) => {
      if (i >= steps.length) {
        this.model.settle(effect.id);
        this.refreshTacticalStatus();
        s.play(`v-idle-${this.facing}`);
        this.setPhase('plan');
        this.cursor = { ...v.cell };
        this.computeIntents(); this.drawIntents(); this.drawGoal();
        if (this.acted) this.chooseFacing();
        else { this.showPlan(); this.hud.hint('Bewegung verbraucht · Q: Strahl · R: Druckwelle · Leertaste: Warten.'); }
        return;
      }
      const prev = i ? steps[i - 1] : path[0], c = steps[i], f = cellFoot(c);
      this.face(c.x > prev.x ? 'e' : c.x < prev.x ? 'w' : c.y > prev.y ? 's' : 'n', true);
      sfx.step();
      this.tweens.add({ targets: s, x: f.x, y: f.y, duration: 110, onComplete: () => run(i + 1) });
    };
    run(0);
  }

  private cancel() {
    if (this.phase === 'beam' || this.phase === 'wave') {
      this.setPhase('plan'); this.previewG.clear(); this.showPlan(); this.hud.select(null);
    }
  }

  private face(d: 's' | 'w' | 'e' | 'n', walk = false) {
    if (this.phase === 'facing') this.model.dispatch({ type: 'face', facing: d });
    else this.facing = d;
    this.refreshTacticalStatus();
    this.sprite('valentus').play(walk ? `v-walk-${d}` : `v-idle-${d}`, true);
  }

  // ---------- Strahl ----------
  private enterBeam() {
    if (this.acted || (this.phase !== 'plan' && this.phase !== 'wave')) return;
    this.setPhase('beam'); this.hud.select('beam'); sfx.select();
    this.previewG.clear();
    this.previewBeam(this.cursorAim());
    this.hud.hint('Richtung wählen · Klick / Enter: Strahl · Rechtsklick: zurück.', true);
  }

  private beamFromPointer(ptr: Aim) {
    const v = this.unit('valentus'), m = cellCenter(v.cell);
    const dir = dirFromVector(ptr.worldX - m.x, ptr.worldY - m.y);
    const preview = this.model.preview('beam', dir)!;
    const { cells, hits } = preview;
    return { dir, cells, hits };
  }

  private previewBeam(ptr: Aim) {
    const { cells, hits } = this.beamFromPointer(ptr);
    const g = this.previewG.clear();
    for (const c of cells) {
      const px = GRID.originX + c.x * GRID.size, py = GRID.originY + c.y * GRID.size;
      g.fillStyle(0xbfe0ff, 0.28).fillRect(px + 1, py + 1, GRID.size - 2, GRID.size - 2);
      g.lineStyle(1, 0xbfe0ff, 0.8).strokeRect(px + 2, py + 2, GRID.size - 4, GRID.size - 4);
    }
    for (const u of hits) this.markCell(g, u.cell, u.side === 'enemy' ? 0xffb03a : DANGER, u.side !== 'enemy');
    const ally = hits.find((u) => u.side === 'ally');
    if (ally) this.hud.hint('Der Strahl würde den Jungen treffen.', true);
    else this.hud.hint(hits.length ? `${hits.length} Gegner · ${resolveBattleUnitStats(this.unit('valentus')).magicAttack ?? BEAM.damage} Schaden je Ziel · Klick / Enter: Strahl.` : 'Kein Ziel in dieser Richtung.', true);
    if (cells.length) {
      const from = cellCenter(this.unit('valentus').cell), end = cellCenter(cells[cells.length - 1]);
      g.lineStyle(2, 0xd6ebff, 0.7).lineBetween(from.x, from.y + 6, end.x, end.y + 6);
    }
  }

  private confirmBeam(ptr: Aim) {
    if (this.phase !== 'beam' || this.acted) return;
    const { dir, cells } = this.beamFromPointer(ptr);
    if (!cells.length) return;
    const result = this.model.dispatch({ type: 'cast', ability: 'beam', target: dir });
    if (!result.ok) {
      if (result.reason === 'ally') { this.shake(120, 0.003); sfx.clang(); }
      else this.hud.hint('Wähle einen Gegner in der Linie.', true);
      return;
    }
    this.setPhase('busy'); this.previewG.clear(); this.hud.select(null); this.hud.hint('');
    const v = this.unit('valentus');
    this.lastMagic = { kind: 'beam', from: { ...v.cell }, dir };
    const d = Math.abs(dir.x) >= Math.abs(dir.y) ? (dir.x > 0 ? 'e' : 'w') : dir.y > 0 ? 's' : 'n';
    this.facing = d;
    const s = this.sprite('valentus');
    s.play(`v-beam-${d}`);
    this.time.delayedCall(180, () => {
      sfx.beam();
      this.beamFx(v.cell, cells[cells.length - 1]);
      // Freeze-Frame
      if (!getSettings().reducedMotion) {
        this.time.delayedCall(10, () => { this.tweens.timeScale = 0.05; this.anims.globalTimeScale = 0.05; });
        this.time.delayedCall(90, () => { this.tweens.timeScale = 1; this.anims.globalTimeScale = 1; });
      }
      this.shake(260, 0.012);
      for (const effect of result.effects) this.presentDamage(this.model.settle(effect.id));
      this.time.delayedCall(1100, () => { s.play(`v-idle-${d}`); this.afterPlayerAction(); });
    });
  }

  private beamFx(from: Cell, to: Cell) {
    const a = cellCenter(from), b = cellCenter(to);
    const hand = { x: a.x + (b.x > a.x ? 10 : b.x < a.x ? -10 : 0), y: a.y - 14 };
    const end = { x: b.x, y: b.y - 10 };
    const layers = [
      { w: 14, c: MAGIC_BLUE, a: 0.35 }, { w: 8, c: 0x6fb2ff, a: 0.7 }, { w: 3, c: 0xffffff, a: 1 },
    ];
    const gfx = layers.map((l) => {
      const g = this.add.graphics().setDepth(700).setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(l.w, l.c, l.a).lineBetween(hand.x, hand.y, end.x, end.y);
      return g;
    });
    this.tweens.add({ targets: gfx, alpha: 0, duration: 520, delay: 160, onComplete: () => gfx.forEach((g) => g.destroy()) });
    const flash = this.add.rectangle(320, 180, 640, 360, 0xdfefff, getSettings().reducedMotion ? 0.06 : 0.35).setDepth(800).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
    const len = Phaser.Math.Distance.Between(hand.x, hand.y, end.x, end.y);
    const ang = Math.atan2(end.y - hand.y, end.x - hand.x);
    if (!ambientPrefs().particles) return;
    const em = this.add.particles(0, 0, 'px', {
      x: { min: 0, max: len }, y: 0, lifespan: 600, speed: { min: 20, max: 70 }, scale: { start: 1.2, end: 0 },
      tint: [0xffffff, 0x9cc4ec, MAGIC_BLUE], blendMode: 'ADD', emitting: false,
    }).setDepth(710).setPosition(hand.x, hand.y).setRotation(ang);
    em.explode(70);
    this.time.delayedCall(800, () => em.destroy());
  }

  // ---------- Druckwelle ----------
  private enterWave() {
    if (this.acted || (this.phase !== 'plan' && this.phase !== 'beam')) return;
    this.setPhase('wave'); this.hud.select('wave'); sfx.select();
    this.previewG.clear();
    this.previewWave(this.cursorAim());
    this.hud.hint(`Mittelpunkt bis ${WAVE.range} Felder · Klick / Enter: Druckwelle.`, true);
  }

  private waveFromPointer(ptr: Aim) {
    const c = cellAt(ptr.worldX, ptr.worldY);
    if (!c) return null;
    const preview = this.model.preview('wave', c);
    return preview ? { center: c, area: preview.cells, pushes: preview.pushes } : null;
  }

  private previewWave(ptr: Aim) {
    const g = this.previewG.clear();
    const v = this.unit('valentus');
    for (let y = 0; y < GRID.rows; y++) for (let x = 0; x < GRID.cols; x++) {
      const c = { x, y };
      if (manhattan(c, v.cell) > WAVE.range || isRock(c)) continue;
      g.fillStyle(MAGIC_BLUE, 0.08).fillRect(GRID.originX + x * GRID.size + 1, GRID.originY + y * GRID.size + 1, GRID.size - 2, GRID.size - 2);
    }
    const w = this.waveFromPointer(ptr);
    if (!w) { this.hud.hint('Mittelpunkt außerhalb der Reichweite.', true); return; }
    for (const c of w.area) {
      const px = GRID.originX + c.x * GRID.size, py = GRID.originY + c.y * GRID.size;
      g.fillStyle(0xbfe0ff, 0.22).fillRect(px + 1, py + 1, GRID.size - 2, GRID.size - 2);
    }
    const a0 = w.area[0], a1 = w.area[w.area.length - 1];
    g.lineStyle(1, 0xe8f2ff, 0.9).strokeRect(GRID.originX + a0.x * GRID.size + 0.5, GRID.originY + a0.y * GRID.size + 0.5,
      (a1.x - a0.x + 1) * GRID.size - 1, (a1.y - a0.y + 1) * GRID.size - 1);
    for (const p of w.pushes) this.drawPush(g, p);
    this.markCell(g, w.center, 0xe8f2ff, false, 0.9);
    this.hud.hint(w.pushes.length ? `${WAVE.damage} Schaden · Rückstoß +${WAVE.collisionDamage} bei Aufprall · Verbündete geschützt.` : 'Kein Gegner in der Fläche.', true);
  }

  private drawPush(g: Phaser.GameObjects.Graphics, p: Push) {
    const a = cellCenter(p.unit.cell), b = cellCenter(p.end);
    this.markCell(g, p.unit.cell, 0xffb03a, false);
    if (!eq(p.unit.cell, p.end)) {
      g.lineStyle(2, 0xffd28a, 1).lineBetween(a.x, a.y, b.x, b.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      g.fillStyle(0xffd28a, 1).fillTriangle(
        b.x + Math.cos(ang) * 6, b.y + Math.sin(ang) * 6,
        b.x + Math.cos(ang + 2.4) * 6, b.y + Math.sin(ang + 2.4) * 6,
        b.x + Math.cos(ang - 2.4) * 6, b.y + Math.sin(ang - 2.4) * 6);
    }
    const px = GRID.originX + p.end.x * GRID.size, py = GRID.originY + p.end.y * GRID.size;
    g.lineStyle(1, 0xffd28a, 1).strokeRect(px + 3.5, py + 3.5, GRID.size - 7, GRID.size - 7);
    if (p.collidedWith || p.hitWall) {
      const m = cellCenter(p.end);
      g.lineStyle(2, DANGER, 1).lineBetween(m.x - 4, m.y - 4, m.x + 4, m.y + 4).lineBetween(m.x - 4, m.y + 4, m.x + 4, m.y - 4);
    }
  }

  private confirmWave(ptr: Aim) {
    if (this.phase !== 'wave' || this.acted) return;
    const w = this.waveFromPointer(ptr);
    if (!w) return;
    const result = this.model.dispatch({ type: 'cast', ability: 'wave', target: w.center });
    if (!result.ok) { this.hud.hint('Wähle eine Fläche mit Gegnern.', true); return; }
    this.setPhase('busy'); this.previewG.clear(); this.hud.select(null); this.hud.hint('');
    const v = this.unit('valentus');
    this.lastMagic = { kind: 'wave', from: { ...v.cell }, center: w.center };
    const m = cellCenter(w.center), vm = cellCenter(v.cell);
    const d = Math.abs(m.x - vm.x) >= Math.abs(m.y - vm.y) ? (m.x >= vm.x ? 'e' : 'w') : m.y > vm.y ? 's' : 'n';
    this.facing = d;
    const s = this.sprite('valentus');
    s.play(`v-wave-${d}`);
    this.time.delayedCall(200, () => {
      sfx.wave();
      this.shake(220, 0.008);
      const ring = this.add.circle(m.x, m.y, getSettings().reducedMotion ? 52 : 6).setStrokeStyle(3, 0xcfe6ff, 1).setDepth(700).setBlendMode(Phaser.BlendModes.ADD);
      const ring2 = this.add.circle(m.x, m.y, getSettings().reducedMotion ? 52 : 4).setStrokeStyle(6, MAGIC_BLUE, 0.6).setDepth(699).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: [ring, ring2], radius: 52, alpha: 0, duration: 420, ease: 'Cubic.out', onComplete: () => { ring.destroy(); ring2.destroy(); } });
      if (ambientPrefs().particles) {
        const dust = this.add.particles(m.x, m.y + 8, 'px', {
          speed: { min: 60, max: 140 }, angle: { min: 0, max: 360 }, lifespan: 500, scale: { start: 1.5, end: 0 },
          tint: [0x8a7a5a, 0x6d6450], emitting: false,
        }).setDepth(690);
        dust.explode(40);
        this.time.delayedCall(700, () => dust.destroy());
      }
      w.pushes.forEach((push, index) => this.knockback(push, result.effects[index]));
      this.time.delayedCall(1200, () => { s.play(`v-idle-${d}`); this.afterPlayerAction(); });
    });
  }

  private knockback(p: Push, effect: BattleEffect) {
    const u = p.unit, s = this.sprite(u.id);
    this.clearIntent(u.id);
    const f = cellFoot(p.end);
    if (u.kind === 'axe') s.play('axe-fly');
    else if (u.kind === 'warrior') s.play('warrior-hit');
    this.tweens.add({
      targets: s, x: f.x, y: { value: f.y, ease: 'Quad.in' }, duration: 360, ease: 'Quad.out',
      onUpdate: (tw) => { s.y = Phaser.Math.Linear(s.y, f.y, 0.1) - Math.sin(tw.progress * Math.PI) * 4; },
      onComplete: () => {
        sfx.thud();
        if (p.collidedWith || p.hitWall) this.shake(140, 0.006);
        this.presentDamage(this.model.settle(effect.id));
      },
    });
  }

  // ---------- Schaden und Tod ----------
  private presentDamage(results: DamageResult[]) {
    for (const result of results) {
      if (result.damage === 0 && !result.protected) continue;
      this.showDamage(result);
    }
  }

  private showDamage(result: DamageResult) {
    const u = this.unit(result.target), amount = result.amount, source = result.source;
    this.refreshTacticalStatus();
    const s = this.sprite(u.id);
    s.setTintFill(0xffffff);
    this.time.delayedCall(70, () => s.clearTint());
    const num = this.add.text(s.x, s.y - 50, `${amount}`, { fontFamily: FONT, fontSize: '10px', color: '#ffe6b0', stroke: '#1a1410', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(950);
    this.tweens.add({ targets: num, y: num.y - 14, alpha: 0, duration: 900, onComplete: () => num.destroy() });
    const impact = this.add.ellipse(s.x, s.y - 22, 8, 8).setStrokeStyle(2, source === 'beam' ? 0xbfe0ff : 0xffd28a)
      .setDepth(965);
    this.tweens.add({ targets: impact, scale: getSettings().reducedMotion ? 1 : 2.6, alpha: 0, duration: 240, onComplete: () => impact.destroy() });
    if (result.wounded) this.woundAxe(u);
    else if (result.defeated) this.kill(u, source);
  }

  private woundAxe(u: Unit) {
    this.clearIntent(u.id);
    this.sprite(u.id).play('axe-land').setAlpha(1).setVisible(true);
    this.data.set('battle:axeOutcome', 'wounded');
    this.refreshTacticalStatus();
    this.hud.thought('Der Axtkämpfer bleibt verwundet liegen.');
  }

  private kill(u: Unit, source: string) {
    this.refreshTacticalStatus();
    this.clearIntent(u.id);
    const s = this.sprite(u.id);
    const fall = u.kind === 'warrior' ? 'warrior-fall' : u.kind === 'axe' ? 'axe-land' : u.kind === 'crossbow' ? 'crossbow-fall' : null;
    if (fall) s.play(fall);
    if (source === 'beam') s.setTint(0xffb27a);
    // Fallen opponents leave the tactical field; the wounded axe fighter stays.
    this.time.delayedCall(900, () => {
      if (!ambientPrefs().particles) {
        this.tweens.add({ targets: s, alpha: 0, duration: 350, onComplete: () => s.setVisible(false) });
        return;
      }
      const ash = this.add.particles(s.x, s.y - 14, 'px', {
        x: { min: -12, max: 12 }, y: { min: -16, max: 8 }, speedY: { min: -40, max: -15 }, speedX: { min: -8, max: 8 },
        lifespan: 1400, alpha: { start: 0.9, end: 0 }, tint: [0x2a2a2e, 0x55555c, 0xd9732b], emitting: false,
      }).setDepth(s.depth + 1);
      ash.explode(60);
      this.tweens.add({ targets: s, alpha: 0, duration: 700, onComplete: () => s.setVisible(false) });
      this.time.delayedCall(1600, () => ash.destroy());
    });
  }

  // ---------- Gegnerabsichten ----------
  private computeIntents() { this.model.computeIntents(); }

  private clearIntent(id: string) {
    this.intents.delete(id);
    this.intentIcons.get(id)?.destroy();
    this.intentIcons.delete(id);
    this.drawIntents();
  }

  private drawIntents() {
    const g = this.intentG.clear();
    for (const [id, ic] of this.intentIcons) {
      if (!this.intents.has(id)) { ic.destroy(); this.intentIcons.delete(id); }
    }
    const icon = this.registry.get('icon') as (n: string) => number;
    for (const [id, it] of this.intents) {
      const u = this.unit(id);
      if (!u.alive) continue;
      const s = this.sprite(id);
      let name = 'intent-sword';
      if (it.kind === 'advance') {
        let prev = cellCenter(u.cell);
        for (const c of it.path) {
          const m = cellCenter(c);
          g.lineStyle(2, DANGER, 0.7).lineBetween(prev.x, prev.y + 6, m.x, m.y + 6);
          prev = m;
        }
        if (it.path.length) this.markCell(g, it.path[it.path.length - 1], DANGER, false, 0.5);
      } else if (it.kind === 'strike') {
        this.markCell(g, this.unit('valentus').cell, DANGER, true);
      } else if (it.kind === 'chop') {
        name = 'intent-axe';
        this.markCell(g, this.unit('boy').cell, DANGER, true);
      } else if (it.kind === 'bolt') {
        name = 'intent-bolt';
        it.line.forEach((c, i) => {
          const m = cellCenter(c);
          if (i < it.line.length - 1) {
            const n = cellCenter(it.line[i + 1]);
            for (let t = 0; t < 1; t += 0.25) {
              const x0 = Phaser.Math.Linear(m.x, n.x, t), y0 = Phaser.Math.Linear(m.y, n.y, t);
              const x1 = Phaser.Math.Linear(m.x, n.x, t + 0.13), y1 = Phaser.Math.Linear(m.y, n.y, t + 0.13);
              g.lineStyle(2, DANGER, 0.9).lineBetween(x0, y0 - 6, x1, y1 - 6);
            }
          }
        });
        const from = cellCenter(u.cell), first = cellCenter(it.line[0]);
        g.lineStyle(2, DANGER, 0.9).lineBetween(from.x, from.y - 12, first.x, first.y - 6);
        this.markCell(g, it.line[it.line.length - 1], DANGER, true);
      } else if (it.kind === 'reload') name = 'wait';
      let ic = this.intentIcons.get(id);
      if (!ic) {
        ic = this.add.image(s.x, s.y - 52, 'icons', icon(name)).setDepth(960);
        if (!getSettings().reducedMotion) this.tweens.add({ targets: ic, y: '-=3', duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.intentIcons.set(id, ic);
      } else {
        this.tweens.killTweensOf(ic);
        ic.setFrame(icon(name)).setPosition(s.x, s.y - 52);
        if (!getSettings().reducedMotion) this.tweens.add({ targets: ic, y: '-=3', duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
    }
  }

  private markCell(g: Phaser.GameObjects.Graphics, c: Cell, color: number, hatch: boolean, alpha = 0.85) {
    const px = GRID.originX + c.x * GRID.size, py = GRID.originY + c.y * GRID.size;
    g.lineStyle(2, color, alpha).strokeRect(px + 2, py + 2, GRID.size - 4, GRID.size - 4);
    if (hatch) {
      g.lineStyle(1, color, alpha * 0.6);
      for (let i = 4; i < GRID.size * 2 - 4; i += 6) {
        const x0 = px + 2 + Math.max(0, i - (GRID.size - 4)), y0 = py + 2 + Math.min(i, GRID.size - 4);
        const x1 = px + 2 + Math.min(i, GRID.size - 4), y1 = py + 2 + Math.max(0, i - (GRID.size - 4));
        g.lineBetween(x0, y0, x1, y1);
      }
    }
  }

  // ---------- Zugende ----------
  private createFinishControl() {
    const frame = this.add.rectangle(0, 0, 208, 32, 0x172330).setOrigin(0).setStrokeStyle(1, 0xa5b7c6)
      .setInteractive({ useHandCursor: true });
    const glass = this.add.graphics();
    glass.lineStyle(2, 0xe8d3a6).lineBetween(12, 7, 28, 7).lineBetween(12, 25, 28, 25)
      .lineBetween(14, 8, 26, 24).lineBetween(26, 8, 14, 24);
    this.finishLabel = this.add.text(37, 7, 'Zug beenden', { fontFamily: FONT, fontSize: '14px', color: '#f4ecd8' });
    this.finishControl = this.add.container(418, 307, [frame, glass, this.finishLabel]).setDepth(1003).setVisible(false);
    frame.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); this.doWait();
    });
  }

  private doWait() {
    if (this.phase === 'facing') { this.commitTurn(); return; }
    if (this.phase !== 'plan') return;
    if (!this.model.dispatch({ type: 'wait' }).ok) return;
    sfx.select();
    this.chooseFacing();
  }

  private afterPlayerAction() {
    this.model.finishAction();
    this.computeIntents(); this.drawIntents();
    if (this.moved || this.beatDone()) { this.chooseFacing(); return; }
    this.setPhase('plan');
    this.hud.setAbilitiesVisible(true);
    this.hud.setAbilitiesDisabled(false);
    this.showPlan();
    this.hud.hint('Aktion verbraucht · Blau: noch einmal bewegen · Leertaste: Zug beenden.');
  }

  private chooseFacing() {
    this.setPhase('facing');
    this.hud.select(null);
    this.hud.setAbilitiesVisible(false);
    this.drawFacing();
    this.hud.hint('Zum Gegner blicken schützt die Front · Klick / Pfeile · Sanduhr / Enter: Zugende.');
  }

  private drawFacing() {
    const g = this.previewG.clear(), center = cellCenter(this.unit('valentus').cell);
    for (const direction of ['n', 'e', 's', 'w'] as const) {
      const d = facingVector(direction), x = center.x + d.x * 26, y = center.y + d.y * 26;
      g.fillStyle(direction === this.facing ? 0xf3d397 : 0x6c8499, 0.95);
      g.fillTriangle(x + d.x * 7, y + d.y * 7, x - d.x * 5 + d.y * 5, y - d.y * 5 - d.x * 5,
        x - d.x * 5 - d.y * 5, y - d.y * 5 + d.x * 5);
    }
    this.refreshTacticalStatus();
  }

  private commitTurn() {
    if (!this.model.dispatch({ type: 'end-turn' }).ok) return;
    this.setPhase('busy'); this.previewG.clear(); this.hud.hint('');
    this.sprite('valentus').play(`v-${this.guarding ? 'guard' : 'idle'}-${this.facing}`);
    this.hud.setAbilitiesVisible(false);
    if (this.beatDone()) return this.nextBeat();
    this.enemyPhase(() => (this.beatDone() ? this.nextBeat() : this.beginPlayerTurn()));
  }

  private refreshTacticalStatus() {
    this.finishLabel?.setText(this.phase === 'facing' ? 'Zug beenden' : this.acted ? 'Zug beenden' : 'Warten / Zugende');
    this.finishControl?.setVisible(!usesMobileInterface() && (this.phase === 'plan' || this.phase === 'facing'));
    const snapshot: BattleSnapshot = {
      beat: this.beat, phase: this.phase, moved: this.moved, acted: this.acted, guarding: this.guarding, facing: this.facing,
      units: this.units.map(u => ({ ...u, cell: { ...u.cell }, maxHp: this.maxHp.get(u.id) ?? u.hp, ...resolveBattleUnitStats(u) })),
    };
    this.registry?.set?.('battle:state', snapshot);
    const v = this.units.find(u => u.id === 'valentus');
    if (!v) return;
    const names: Record<Unit['kind'], string> = { valentus: 'Valentus', warrior: 'Krieger', axe: 'Axtkämpfer', crossbow: 'Schütze', boy: 'Junge', falke: 'Falke' };
    const facing = { n: 'Nord', e: 'Ost', s: 'Süd', w: 'West' }[this.facing];
    const order = enemyOrder(this.units, this.model.stats);
    const target = unitAt(this.units, this.cursor);
    const lines = [
      this.phase === 'facing' ? 'BLICKRICHTUNG WÄHLEN' : this.phase === 'busy' ? 'ZUG WIRD AUSGEFÜHRT' : 'VALENTUS AM ZUG',
      `LP ${v.hp}/${this.maxHp.get(v.id) ?? 100} · Tutorialschutz`,
      `Bewegen: ${this.moved ? 'verbraucht' : `${resolveBattleUnitStats(v).move} Felder`}`,
      `Aktion: ${this.acted ? 'verbraucht' : 'Strahl / Welle / Warten'}`,
      `Blick: ${facing}${this.guarding ? ' · Deckung' : ''}`,
      this.phase === 'facing' ? 'Front weniger · Rücken mehr' : 'Danach: Gegner nach Tempo',
      ...order.map((u, i) => `${i + 1}. ${names[u.kind]}${u.id === 'w1' ? ' I' : u.id === 'w2' ? ' II' : ''} · ${unitSpeed(u, this.model.stats)} · LP ${u.hp}`),
      ...this.units.filter(u => u.wounded).map(u => `${names[u.kind]} · verwundet`),
      target && target.side === 'enemy' ? `Ziel: ${names[target.kind]} ${target.hp} LP` : this.guarding ? 'Warten schützt nur die Front.' : 'Blick zum Gegner schützt die Front.',
    ];
    const status = lines.join('\n');
    const visible = !usesMobileInterface() && this.phase !== 'arrival' && this.phase !== 'end' && this.beat < 4;
    this.tacticalPanel?.setVisible(visible);
    this.tacticalText?.setText(status).setVisible(visible);
    this.data?.set?.('mobile:battleStatus', this.phase !== 'arrival' && this.phase !== 'end' && this.beat < 4 ? status : '');
  }

  private hurtValentus(hit: DamageResult) {
    const v = this.model.player;
    this.hud.setHp(v.hp / (this.maxHp.get(v.id) ?? 100));
    this.refreshTacticalStatus();
    const position = this.sprite(v.id);
    const number = this.add.text(position.x, position.y - 48, hit.protected ? 'Tutorialschutz' : `-${hit.damage} LP`,
      { fontFamily: FONT, fontSize: '13px', color: '#f2c194', stroke: '#10151b', strokeThickness: 3 }).setOrigin(0.5).setDepth(990);
    this.tweens.add({ targets: number, y: number.y - 14, alpha: 0, duration: 1000, onComplete: () => number.destroy() });
  }

  private beatDone() {
    return this.model.beatComplete();
  }

  private nextBeat() {
    this.intents.clear();
    for (const ic of this.intentIcons.values()) ic.destroy();
    this.intentIcons.clear();
    this.intentG.clear();
    this.time.delayedCall(500, () => this.startBeat(this.beat + 1));
  }

  private enemyPhase(done: () => void) {
    const order = this.model.enemyTurns;
    const step = (i: number) => {
      if (i >= order.length) { this.intents.clear(); this.drawIntents(); done(); return; }
      this.resolveIntent(order[i], () => this.time.delayedCall(250, () => step(i + 1)));
    };
    this.time.delayedCall(300, () => step(0));
  }

  private resolveIntent(id: string, done: () => void) {
    const result = this.model.dispatch({ type: 'resolve-enemy', id });
    if (!result.ok) return done();
    const effect = result.effects[0];
    const u = this.unit(id), it = this.intents.get(id)!, s = this.sprite(id);
    if (it.kind === 'advance') {
      const path = effect?.kind === 'move' ? effect.path : [];
      if (!path.length) return done();
      s.play(u.kind === 'warrior' ? 'warrior-charge' : 'axe-walk');
      const walk = (i: number) => {
        if (i >= path.length) {
          if (effect) this.model.settle(effect.id);
          s.play(u.kind === 'warrior' ? 'warrior-ready' : 'axe-telegraph'); return done();
        }
        const f = cellFoot(path[i]);
        this.intentIcons.get(id)?.setX(f.x);
        this.tweens.add({ targets: [s], x: f.x, y: f.y, duration: 220, onComplete: () => walk(i + 1) });
        this.tweens.add({ targets: this.intentIcons.get(id) ?? [], x: f.x, duration: 220 });
      };
      walk(0);
    } else if (it.kind === 'strike') {
      s.play('warrior-strike');
      this.time.delayedCall(180, () => {
        sfx.clang();
        this.sparks(this.sprite('valentus'));
        this.sprite('valentus').play(`v-guard-${this.facing}`);
        this.hud.shakeHp();
        this.hurtValentus(this.model.settle(effect.id)[0]);
        this.time.delayedCall(500, () => { s.play('warrior-ready'); this.sprite('valentus').play(`v-idle-${this.facing}`); done(); });
      });
    } else if (it.kind === 'chop') {
      this.falkeSavesFromAxe(effect, done);
    } else if (it.kind === 'bolt') {
      this.fireBolt(u, it.line, effect, done);
    } else done();
  }

  private sparks(target: Phaser.GameObjects.Sprite) {
    if (!ambientPrefs().particles) {
      const guard = this.add.ellipse(target.x, target.y - 23, 23, 32).setStrokeStyle(2, 0xbfe0ff).setDepth(960);
      this.tweens.add({ targets: guard, alpha: 0, duration: 350, onComplete: () => guard.destroy() });
      return;
    }
    const p = this.add.particles(target.x, target.y - 26, 'px', {
      speed: { min: 60, max: 160 }, angle: { min: 0, max: 360 }, lifespan: 380, scale: { start: 1.2, end: 0 },
      tint: [0xffffff, 0x9cc4ec, MAGIC_BLUE], blendMode: 'ADD', emitting: false,
    }).setDepth(960);
    p.explode(26);
    this.time.delayedCall(500, () => p.destroy());
  }

  /** Romanverlauf, wenn der Spieler den Axthieb nicht verhindert: Der Falke sticht den Axtkämpfer nieder. */
  private falkeSavesFromAxe(effect: BattleEffect, done: () => void) {
    const axe = this.unit('axe'), as = this.sprite('axe');
    as.play('axe-chop');
    const fk = this.ensureFalke();
    const target = { x: axe.cell.x + 1, y: axe.cell.y - 1 };
    const f = cellFoot(inside(target) && !unitAt(this.units, target) ? target : { x: axe.cell.x, y: axe.cell.y - 1 });
    fk.setFlipX(false).play('falke-charge');
    this.hud.thought('Ein Soldat der Falken stürzt heran.');
    this.tweens.add({
      targets: fk, x: f.x, y: f.y, duration: 420, ease: 'Quad.in',
      onComplete: () => {
        fk.play('falke-thrust');
        sfx.hit();
        this.shake(160, 0.006);
        this.presentDamage(this.model.settle(effect.id));
        this.time.delayedCall(600, () => { fk.play('falke-idle'); done(); });
      },
    });
  }

  private ensureFalke() {
    if (!this.falkeShown) {
      this.falkeShown = true;
      const s = this.addUnit(DUNKELHAIN.enemies.axe.rescue!.actor);
      s.setPosition(340, 40);
    }
    return this.sprite('falke');
  }

  private fireBolt(u: Unit, line: Cell[], effect: BattleEffect, done: () => void) {
    const s = this.sprite(u.id);
    s.play('crossbow-aim');
    this.time.delayedCall(450, () => {
      s.play('crossbow-shoot');
      sfx.bolt();
      const first = effect.kind === 'bolt' && effect.target ? this.unit(effect.target) : undefined;
      const from = { x: s.x - 8, y: s.y - 26 };
      if (first?.id === 'valentus') {
        const vs = this.sprite('valentus');
        this.flyBolt(from, { x: vs.x, y: vs.y - 24 }, () => {
          sfx.clang(); this.sparks(vs); vs.play(`v-guard-${this.facing}`); this.hud.shakeHp();
          this.hurtValentus(this.model.settle(effect.id)[0]);
          this.hud.thought('Der Bolzen zerspringt an ihm.');
          this.time.delayedCall(700, () => { vs.play(`v-idle-${this.facing}`); done(); });
        });
      } else {
        // Romanverlauf: Der Falke wirft sich dazwischen – und wird getroffen.
        const fk = this.ensureFalke();
        const boy = this.sprite('boy');
        fk.play('falke-charge');
        this.tweens.add({
          targets: fk, x: boy.x + 14, y: boy.y + 12, duration: 300,
          onComplete: () => this.flyBolt(from, { x: fk.x, y: fk.y - 30 }, () => {
            sfx.hit(); this.shake(150, 0.005);
            fk.setTint(0x9a3438);
            this.tweens.add({ targets: fk, angle: -80, y: fk.y + 4, duration: 400 });
            this.hud.thought('Der Falke wirft sich dazwischen. Der Bolzen trifft ihn in den Hals.', 2800);
            this.model.settle(effect.id);
            this.time.delayedCall(1100, done);
          }),
        });
      }
    });
  }

  private flyBolt(from: { x: number; y: number }, to: { x: number; y: number }, hit: () => void) {
    const b = this.add.rectangle(from.x, from.y, 8, 2, 0xd8d2c0).setDepth(970)
      .setRotation(Math.atan2(to.y - from.y, to.x - from.x));
    this.tweens.add({ targets: b, x: to.x, y: to.y, duration: 160, onComplete: () => { b.destroy(); hit(); } });
  }

  // ---------- Beat 4: Der Junge entkommt, die Verbündeten weichen zurück ----------
  private boyEscapes() {
    this.setPhase('busy');
    this.hud.setAbilitiesVisible(false);
    this.goalG.clear();
    this.tacticalText?.setVisible(false);
    this.tacticalPanel?.setVisible(false);
    this.data.set('mobile:battleStatus', '');
    const boy = this.unit('boy'), s = this.sprite('boy');
    s.play('boy-rise');
    this.time.delayedCall(500, () => {
      s.play('boy-run-n');
      const steps = [...BOY_EXIT.map(cellFoot), { x: 330, y: 52 }];
      const run = (i: number) => {
        if (i >= steps.length) {
          boy.cell = { x: 8, y: -1 };
          s.play('boy-lookback');
          this.hud.protectDone();
          this.hud.thought('Er ist in Sicherheit.', 2200);
          this.time.delayedCall(1800, () => this.dangerBehind());
          return;
        }
        this.tweens.add({ targets: s, x: steps[i].x, y: steps[i].y, duration: 260, onComplete: () => run(i + 1) });
      };
      run(0);
    });
  }

  private dangerBehind() {
    this.data.set('story:battleEnding', 'retreat');
    this.hud.thought('Die eigenen Reihen weichen zurück.', 2600);
    this.intentG.clear();
    for (const soldier of this.backgroundSoldiers) {
      this.tweens.killTweensOf(soldier);
      soldier.play('falke-charge').setFlipX(true);
      this.tweens.add({ targets: soldier, x: soldier.x - 130, y: soldier.y - 30,
        alpha: 0, duration: 1800, onComplete: () => soldier.setVisible(false) });
    }
    this.stopAmbience(); this.stopAmbience = () => {};
    this.time.delayedCall(1400, () => this.showValentusStab());
  }

  private showValentusStab() {
    if (this.phase === 'end' || this.stabCloseup) return;
    this.hud.setThoughtsVisible(false);
    this.hud.setCinematic(true);
    this.intentG.clear();
    for (const icon of this.intentIcons.values()) icon.setVisible(false);
    this.stabCloseup = new StoryCloseup(this);
    this.stabCloseup.show('cinematic-valentus-stab', { fit: 'contain' });
    this.stabCloseup.setText('Eine Klinge trifft ihn von hinten.');
    this.stabCloseup.setContinue(() => this.finishBattle());
    this.cinematicAdvance = () => this.stabCloseup?.advance();
    this.data.set('story:battleEnding', 'stab');
    sfx.hit();
  }

  private finishBattle() {
    if (this.phase === 'end') return;
    this.stabCloseup?.hide();
    this.setPhase('end');
    this.data.set('story:battleEnding', 'break');
    this.registry.set('lastMagic', this.lastMagic);
    const vs = this.sprite('valentus');
    this.game.renderer.snapshot((img) => {
      if (this.phase !== 'end') return;
      if (this.textures.exists('snap')) this.textures.remove('snap');
      this.textures.addImage('snap', img as HTMLImageElement);
      this.scene.start('break', { vx: vs.x, vy: vs.y });
    });
  }
}

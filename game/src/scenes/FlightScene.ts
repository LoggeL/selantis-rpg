import Phaser from 'phaser';
import { sfx, startAmbient } from '../audio';
import { FONT, Hud } from '../ui';
import { ambientPrefs, getSettings, subscribeSettings } from '../settings';
import { Dialogue } from '../dialogue';

type Pt = { x: number; y: number };
type Station = { at: number; kind: 'stumble' | 'jump' | 'climb' | 'brace' | 'slip'; hint?: string; holdMs?: number; to?: number };
type PauseAction = { at: number; kind: 'listen' | 'wound'; done: boolean; marker: Phaser.GameObjects.Container };

// Laufweg über beide Bühnen (Welt 1280 x 360). Romanstationen S. 1–2.
const PATH: Pt[] = [
  { x: 36, y: 44 }, { x: 70, y: 62 }, { x: 110, y: 88 }, { x: 150, y: 108 }, { x: 200, y: 122 },
  /* 5: Wurzel */ { x: 250, y: 136 }, { x: 290, y: 162 }, { x: 322, y: 194 }, { x: 362, y: 216 }, { x: 402, y: 238 },
  { x: 442, y: 255 }, { x: 482, y: 274 }, { x: 522, y: 290 }, { x: 562, y: 302 },
  /* 14: Absprung am Bach */ { x: 604, y: 316 },
  /* 15: anderes Ufer */ { x: 700, y: 226 }, { x: 760, y: 216 },
  /* 17: Fuß des Abhangs */ { x: 806, y: 204 },
  /* 18: oben */ { x: 850, y: 134 }, { x: 905, y: 130 }, { x: 955, y: 138 },
  /* 21: krummer Stamm */ { x: 984, y: 146 }, { x: 1040, y: 152 }, { x: 1090, y: 150 },
  /* 24: glitschiger Stein */ { x: 1126, y: 146 },
];

export class FlightScene extends Phaser.Scene {
  private v!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private hud!: Hud;
  private lens: number[] = [];
  private total = 0;
  private dist = 0;
  private busy = false;
  private stations: Station[] = [];
  private nextStation = 0;
  private holding = 0;
  private holdBar?: Phaser.GameObjects.Rectangle;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private facing: 's' | 'w' | 'e' | 'n' = 'e';
  private vig!: Phaser.GameObjects.Image;
  private beatTimer = 0;
  private dropTimer = 0;
  private barkTimer = 3000;
  private torches: Phaser.GameObjects.Arc[] = [];
  private glimmerLock = 0;
  private railTarget?: number;
  private ended = false;
  private moon!: Phaser.GameObjects.Ellipse;
  private pauses: PauseAction[] = [];
  private safeFloor = 0;
  private stationMarker!: Phaser.GameObjects.Container;
  private routeMarker!: Phaser.GameObjects.Ellipse;
  private holdBack?: Phaser.GameObjects.Rectangle;
  private pointerHolding = false;
  private holdPointer?: Phaser.Input.Pointer;
  private hintState = '';
  private skipHeld = 0;
  private skipBar!: Phaser.GameObjects.Rectangle;
  private ambientShapes: Phaser.GameObjects.Ellipse[] = [];
  private ambientTweens: Phaser.Tweens.Tween[] = [];
  private rescue?: Dialogue;

  constructor() { super('flight'); }

  create() {
    this.holdPointer = undefined;
    this.rescue = undefined;
    startAmbient(this, 'flight');
    this.busy = false; this.nextStation = 0; this.dist = 0; this.ended = false; this.holding = 0;
    this.safeFloor = 0; this.railTarget = undefined; this.pointerHolding = false;
    this.hintState = ''; this.skipHeld = 0; this.glimmerLock = 0;
    this.beatTimer = 1100; this.dropTimer = 380; this.barkTimer = 3000;
    this.torches = []; this.pauses = []; this.holdBar = undefined; this.holdBack = undefined;
    this.ambientShapes = []; this.ambientTweens = [];
    this.addForestBackground();
    const cam = this.cameras.main;
    cam.setBounds(0, 0, 1280, 360);
    cam.fadeIn(1200, 0, 0, 0);
    // Fieber: kalt, leicht entsättigt
    const cm = cam.postFX.addColorMatrix();
    cm.saturate(-0.2);
    cm.brightness(1.12, true);

    this.lens = PATH.slice(1).map((p, i) => Phaser.Math.Distance.Between(PATH[i].x, PATH[i].y, p.x, p.y));
    this.total = this.lens.reduce((a, b) => a + b, 0);
    const at = (i: number) => this.lens.slice(0, i).reduce((a, b) => a + b, 0);
    this.stations = [
      { at: at(5), kind: 'stumble' },
      { at: at(14), kind: 'jump', hint: 'E / Klick · Springen', to: at(15) },
      { at: at(17), kind: 'climb', hint: 'E / Klick halten · Hinaufziehen', holdMs: 1800, to: at(18) },
      { at: at(21), kind: 'brace', hint: 'E / Klick halten · Abstützen', holdMs: 1200 },
      { at: at(24) - 2, kind: 'slip' },
    ];

    this.shadow = this.add.image(0, 0, 'shadow');
    this.v = this.add.sprite(PATH[0].x, PATH[0].y, 'valentus-cloak-run', 0).setOrigin(0.5, 60 / 64).play('vc-run-e');
    cam.startFollow(this.v, true, 0.08, 0.08);
    // Mondlicht, das ihm folgt – damit der dunkle Mantel lesbar bleibt
    this.moon = this.add.ellipse(0, 0, 70, 34, 0xb8c4d6, 0.13).setBlendMode(Phaser.BlendModes.ADD);

    this.vig = this.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(900).setAlpha(0.5);
    // Wenige Tautupfer statt einer hellen Partikeldecke über dem Laufweg.
    const dew = this.add.particles(0, 0, 'px', {
      x: { min: 0, max: 1280 }, y: { min: 20, max: 340 }, lifespan: 900, scale: { start: 0.6, end: 0 },
      alpha: { start: 0.35, end: 0 }, tint: 0xdfe8f4, frequency: 180,
    }).setDepth(800);
    this.addForestAmbience();
    // Fackeln der Verfolger am linken Bildrand
    for (let i = 0; i < 3; i++) {
      const t = this.add.circle(6 + i * 9, 120 + i * 40, 2, 0xf0a040).setScrollFactor(0).setDepth(850).setAlpha(0);
      const glow = this.add.circle(t.x, t.y, 9, 0xd9732b, 0.25).setScrollFactor(0).setDepth(849).setAlpha(0);
      this.torches.push(t, glow);
    }

    this.hud = new Hud(this, 'portrait-valentus-wounded', 'VALENTUS');
    this.hud.setHp(0.12, false);
    this.hud.setAbilities([
      { icon: 'beam', key: 'Q', onClick: () => this.glimmer() },
      { icon: 'wave', key: 'R', onClick: () => this.glimmer() },
    ]);
    this.hud.setAbilitiesDisabled(true);
    this.hud.moveAbilities(98, 48);
    this.routeMarker = this.add.ellipse(0, 0, 12, 5).setStrokeStyle(1, 0xa3bdd1, 0.5).setDepth(-400);
    this.stationMarker = this.actionMarker('E', 0x9cc4ec).setVisible(false);
    this.pauses = [
      { at: at(8), kind: 'listen', done: false, marker: this.actionMarker('E', 0xb6bba9) },
      { at: at(20), kind: 'wound', done: false, marker: this.actionMarker('E', 0xc29186) },
    ];
    this.add.text(628, 8, 'Esc halten', { fontFamily: FONT, fontSize: '8px', color: '#8f9aa4', stroke: '#0d0f12', strokeThickness: 2 })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(1000);
    this.skipBar = this.add.rectangle(628, 22, 0, 2, 0xa3bdd1).setOrigin(1, 0).setScrollFactor(0).setDepth(1001);
    this.setHint('WASD / Klick · Weiter');

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,Q,R,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.Q.on('down', () => this.glimmer());
    this.keys.R.on('down', () => this.glimmer());
    this.keys.E.on('down', () => this.onInteract());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p));
    const releaseHold = (pointer: Phaser.Input.Pointer) => {
      if (pointer === this.holdPointer) { this.pointerHolding = false; this.holdPointer = undefined; }
    };
    this.input.on('pointerup', releaseHold);
    this.input.on('pointerupoutside', releaseHold);
    const resetHold = () => { this.pointerHolding = false; this.holdPointer = undefined; };
    this.events.on('pause', resetHold);
    this.events.once('shutdown', () => { this.events.off('pause', resetHold); resetHold(); });

    this.time.delayedCall(600, () => sfx.horn());
    this.time.delayedCall(1500, () => this.hud.thought('Sie werden mich finden. Ich muss weiter.', 2600));
    this.placeAt(0);
    const unsubscribe = subscribeSettings(() => {
      const prefs = ambientPrefs();
      dew.setVisible(prefs.particles);
      if (prefs.particles) dew.start(); else dew.stop();
      this.ambientShapes.forEach((shape) => shape.setVisible(prefs.particles));
      this.ambientTweens.forEach((tween) => { if (prefs.particles) tween.resume(); else tween.pause(); });
      if (prefs.reducedMotion) {
        this.tweens.killTweensOf(this.vig);
        this.vig.setAlpha(0.5);
      }
    });
    this.events.once('shutdown', unsubscribe);
  }

  // ---------- Weg ----------
  private pointAt(d: number): { p: Pt; dir: Pt } {
    let acc = 0;
    for (let i = 0; i < this.lens.length; i++) {
      if (d <= acc + this.lens[i] || i === this.lens.length - 1) {
        const t = Phaser.Math.Clamp((d - acc) / this.lens[i], 0, 1);
        const a = PATH[i], b = PATH[i + 1];
        const len = this.lens[i];
        return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, dir: { x: (b.x - a.x) / len, y: (b.y - a.y) / len } };
      }
      acc += this.lens[i];
    }
    return { p: PATH[PATH.length - 1], dir: { x: 1, y: 0 } };
  }

  private placeAt(d: number) {
    this.dist = d;
    const { p } = this.pointAt(d);
    this.v.setPosition(p.x, p.y);
  }

  /** Rennen → Laufen → Gehen, wie im Roman. */
  private speed() {
    const f = this.dist / this.total;
    if (f < 0.35) return 62;
    if (f < 0.7) return Phaser.Math.Linear(62, 42, (f - 0.35) / 0.35);
    return Phaser.Math.Linear(42, 26, (f - 0.7) / 0.3);
  }

  update(_t: number, dt: number) {
    dt = Math.min(dt, 80);
    if (!this.ended) {
      this.skipHeld = this.keys.ESC.isDown ? this.skipHeld + dt : 0;
      this.skipBar.width = 52 * Phaser.Math.Clamp(this.skipHeld / 1500, 0, 1);
      if (this.skipHeld >= 1500) { this.skipFlight(); return; }
    }
    this.shadow.setPosition(this.v.x, this.v.y - 1).setDepth(this.v.y - 1);
    this.moon.setPosition(this.v.x, this.v.y - 14).setDepth(this.v.y - 2);
    this.v.setDepth(this.v.y);
    const f = this.dist / this.total;
    this.fever(dt, f);
    this.updateMarkers();
    if (this.busy || this.ended) return;

    const st = this.stations[this.nextStation];
    // Der Griff bewegt ihn selbst den Abhang hinauf. Solange die Station
    // offen ist, können weder Richtungstasten noch ein Klick ihn wegziehen.
    if (st?.holdMs && this.dist >= st.at - 1) {
      this.updateHold(st, dt);
      return;
    }
    const k = this.keys;
    const ix = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const iy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const { dir } = this.pointAt(this.dist);
    let dot = ix * dir.x + iy * dir.y;
    if (ix || iy) this.railTarget = undefined;
    else if (this.railTarget !== undefined) {
      // Maus: entlang des Wegs zum angeklickten Punkt; gedrückt halten folgt dem Cursor
      const ptr = this.input.activePointer;
      if (ptr.isDown && !this.isHudPointer(ptr)) this.railTarget = this.nearestDist(ptr.worldX, ptr.worldY);
      const diff = this.railTarget - this.dist;
      // Auch ein Klick hinter einer Pflichtstation endet exakt an ihr. Ein
      // vorzeitiger Zielradius würde das Stolpern vor reachStation abbrechen.
      if (Math.abs(diff) < 0.001) this.railTarget = undefined;
      else dot = Math.sign(diff);
    }
    const moving = (ix || iy || this.railTarget !== undefined) && Math.abs(dot) > 0.2;

    if (moving) {
      let nd = this.dist + Math.sign(dot) * this.speed() * dt / 1000;
      // Den letzten Mausschritt auf das Ziel begrenzen, damit kleine Schritte
      // die Station erreichen und große Schritte am Ziel nicht hin und her laufen.
      if (this.railTarget !== undefined) nd = dot > 0 ? Math.min(nd, this.railTarget) : Math.max(nd, this.railTarget);
      if (st && nd >= st.at) nd = st.at;
      // Sprung und Klettern öffnen einen neuen trockenen Wegabschnitt. Rückwärts
      // darf er deren übersprungene Verbindung nicht als normalen Boden betreten.
      nd = Phaser.Math.Clamp(nd, this.safeFloor, this.total);
      this.placeAt(nd);
      const face = Math.abs(dir.x * Math.sign(dot)) >= Math.abs(dir.y) ? (dir.x * Math.sign(dot) > 0 ? 'e' : 'w') : dir.y * Math.sign(dot) > 0 ? 's' : 'n';
      this.facing = face;
      const anim = `vc-run-${face}`;
      this.v.play(anim, true);
      this.v.anims.timeScale = this.speed() / 62;
      this.dropTimer -= dt;
      if (this.dropTimer <= 0) { this.dropTimer = 380; this.bloodDrop(); }
      if (st && this.dist >= st.at - 0.5) this.reachStation(st);
    } else {
      this.movementIdle();
    }
  }

  private fever(dt: number, f: number) {
    // Herzschlag: wird schwerer, je weiter er kommt
    this.beatTimer -= dt;
    if (this.beatTimer <= 0) {
      this.beatTimer = Phaser.Math.Linear(1150, 820, f);
      sfx.heartbeat();
      if (!getSettings().reducedMotion) this.tweens.add({ targets: this.vig, alpha: { from: 0.68, to: 0.48 }, duration: 520, ease: 'Sine.out' });
      if (f > 0.5 && Math.random() < 0.3) sfx.breath();
    }
    this.barkTimer -= dt;
    if (this.barkTimer <= 0 && !this.ended) {
      this.barkTimer = Phaser.Math.Between(2600, 4800) - f * 1200;
      sfx.bark(0.12 + f * 0.25);
    }
    const torchAlpha = Phaser.Math.Clamp(0.25 + f * 0.9, 0, 1);
    this.torches.forEach((t, i) => t.setAlpha(torchAlpha * (getSettings().reducedMotion ? 0.75 : 0.7 + 0.3 * Math.sin(this.time.now / (240 + i * 13)))));
  }

  private bloodDrop() {
    if (!ambientPrefs().particles) return;
    const d = this.add.rectangle(this.v.x + Phaser.Math.Between(-3, 3), this.v.y - 1, 2, 1, 0x9a3438).setDepth(-500);
    this.tweens.add({ targets: d, alpha: 0, duration: 8000, onComplete: () => d.destroy() });
  }

  /** Nächster Wegpunkt (als Strecke) zu einer Bildschirmposition. */
  private nearestDist(x: number, y: number) {
    const end = this.stations[this.nextStation]?.at ?? this.total;
    const endpoint = this.pointAt(end).p;
    let best = Math.max(this.safeFloor, end), bd = (endpoint.x - x) ** 2 + (endpoint.y - y) ** 2;
    for (let d = this.safeFloor; d <= end; d += 4) {
      const { p } = this.pointAt(d);
      const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  private onPointer(p: Phaser.Input.Pointer) {
    if (this.rescue?.visible) { this.rescue.advance(); return; }
    if (this.ended || this.busy) return;
    if (this.isHudPointer(p)) {
      if (p.y >= 34 && p.y <= 62 && p.x >= 67 && p.x <= 129) this.glimmer();
      return;
    }
    for (const pause of this.pauses) {
      if (!pause.done && Math.abs(this.dist - pause.at) < 26 && Phaser.Math.Distance.Between(p.worldX, p.worldY, pause.marker.x, pause.marker.y) < 18) {
        this.optionalPause(pause); return;
      }
    }
    const st = this.stations[this.nextStation];
    // An der Bachstation zählt ein Klick wie E
    const nearFeet = Phaser.Math.Distance.Between(p.worldX, p.worldY, this.v.x, this.v.y) < 64;
    if (st && st.kind === 'jump' && this.dist >= st.at - 1 && nearFeet) { this.onInteract(); return; }
    if (st && st.holdMs && this.dist >= st.at - 1) { this.pointerHolding = nearFeet; this.holdPointer = nearFeet ? p : undefined; return; }
    this.railTarget = this.nearestDist(p.worldX, p.worldY);
  }

  private isHudPointer(p: Phaser.Input.Pointer) {
    return (p.x < 158 && p.y < 65) || (p.x > 558 && p.y < 34) || p.y > 330;
  }

  private glimmer() {
    if (this.time.now < this.glimmerLock || this.ended) return;
    this.glimmerLock = this.time.now + 1000;
    sfx.fizzle();
    const g = this.add.circle(this.v.x + (this.facing === 'w' ? -8 : 8), this.v.y - 26, 3, 0x397fc1, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(this.v.depth + 1);
    this.tweens.add({ targets: g, scale: { from: getSettings().reducedMotion ? 1 : 1.6, to: getSettings().reducedMotion ? 1 : 0.2 }, alpha: 0, duration: 550, ease: 'Quad.in', onComplete: () => g.destroy() });
  }

  // ---------- Stationen ----------
  private reachStation(st: Station) {
    if (st.kind === 'stumble') {
      this.busy = true;
      sfx.thud();
      this.v.play('vc-stumble');
      if (!getSettings().reducedMotion) this.cameras.main.shake(200, 0.004);
      this.v.once('animationcomplete', () => { this.busy = false; this.nextStation++; });
    } else if (st.kind === 'slip') {
      this.slip();
    } else if (st.hint) {
      this.hud.hint(st.hint);
      this.v.anims.stop();
    }
  }

  private onInteract() {
    if (this.rescue?.visible) { this.rescue.advance(); return; }
    const st = this.stations[this.nextStation];
    if (this.busy || this.ended) return;
    if (!st || this.dist < st.at - 1) {
      const pause = this.pauses.find((p) => !p.done && Math.abs(this.dist - p.at) < 26);
      if (pause) this.optionalPause(pause);
      return;
    }
    if (st.kind !== 'jump') return;
    this.busy = true;
    this.railTarget = undefined;
    this.setHint('');
    const from = { x: this.v.x, y: this.v.y }, to = this.pointAt(st.to!).p;
    this.v.play('vc-jump');
    const arc = { t: 0 };
    this.tweens.add({
      targets: arc, t: 1, duration: getSettings().reducedMotion ? 200 : 760, ease: 'Sine.inOut',
      onUpdate: () => {
        this.v.setPosition(Phaser.Math.Linear(from.x, to.x, arc.t), Phaser.Math.Linear(from.y, to.y, arc.t) - Math.sin(arc.t * Math.PI) * (getSettings().reducedMotion ? 8 : 26));
      },
      onComplete: () => {
        this.dist = st.to!;
        this.safeFloor = st.to!;
        sfx.thud();
        if (!getSettings().reducedMotion) this.cameras.main.shake(150, 0.004);
        // Keuchend hält er inne, blickt auf seine Hand: Blut.
        this.time.delayedCall(300, () => this.hud.thought('Blutrot.', 1800));
        this.time.delayedCall(1400, () => { this.busy = false; this.nextStation++; });
      },
    });
  }

  private drawHold(p: number) {
    if (!this.holdBar) {
      this.holdBack = this.add.rectangle(this.v.x, this.v.y + 9, 34, 5, 0x0d0f12, 0.9).setDepth(901);
      this.holdBar = this.add.rectangle(this.v.x - 16, this.v.y + 9, 0, 3, 0x9cc4ec).setOrigin(0, 0.5).setDepth(902);
    }
    this.holdBar.width = 32 * Phaser.Math.Clamp(p, 0, 1);
    this.holdBack!.setPosition(this.v.x, this.v.y + 9);
    this.holdBar.setPosition(this.v.x - 16, this.v.y + 9);
  }

  private movementIdle() {
    this.v.anims.stop();
    this.v.setTexture('valentus-cloak-run', { s: 0, w: 4, e: 8, n: 12 }[this.facing]);
  }

  private updateHold(st: Station, dt: number) {
    this.railTarget = undefined;
    const held = this.keys.E.isDown || !!(this.pointerHolding && this.holdPointer?.isDown);
    if (held) this.holding = Math.min(st.holdMs!, this.holding + dt);
    const progress = this.holding / st.holdMs!;
    // Loslassen friert Griff und Strecke gemeinsam ein. Am Stamm bleiben
    // seine Füße am festen Stützpunkt, auch wenn eine Lauftaste gehalten wird.
    this.placeAt(st.kind === 'climb' ? Phaser.Math.Linear(st.at, st.to!, progress) : st.at);
    if (held || (st.kind === 'climb' && this.holding > 0)) {
      this.v.anims.stop();
      this.v.setTexture('valentus-cloak-events', st.kind === 'climb' ? 8 : 9);
    } else this.movementIdle();
    if (held || this.holding > 0) this.drawHold(progress);
    if (this.holding >= st.holdMs!) this.finishStation(st);
  }

  private finishStation(st: Station) {
    this.holding = 0;
    this.holdBar?.destroy(); this.holdBar = undefined;
    this.holdBack?.destroy(); this.holdBack = undefined;
    this.pointerHolding = false;
    this.holdPointer = undefined;
    this.railTarget = undefined;
    this.movementIdle();
    this.setHint('');
    if (st.kind === 'climb') {
      this.placeAt(st.to!);
      this.safeFloor = st.to!;
      this.nextStation++;
      this.hud.thought('Es darf ihnen nicht in die Hände fallen.', 2600);
    } else {
      this.nextStation++;
      this.hud.thought('Wenn sie es bekommen, ist es aus.', 2600);
    }
  }

  private slip() {
    this.ended = true;
    this.busy = true;
    this.railTarget = undefined;
    this.hud.hint('');
    this.v.play('vc-slip');
    if (!getSettings().reducedMotion) this.tweens.add({ targets: this.v, x: this.v.x + 10, y: this.v.y + 4, duration: 300, ease: 'Quad.in' });
    this.time.delayedCall(420, () => {
      sfx.thud();
      if (!getSettings().reducedMotion) {
        this.cameras.main.shake(250, 0.01);
        this.cameras.main.flash(80, 255, 255, 255);
      }
      this.time.delayedCall(350, () => this.rescueBridge());
    });
  }

  private rescueBridge() {
    this.hud.hideAll(250);
    this.cameras.main.stopFollow();
    this.rescue = new Dialogue(this, { depth: 1200 });
    [0, 360, 760].forEach(delay => this.time.delayedCall(delay, () => sfx.step()));
    this.rescue.setText('Schritte im Unterholz. Jemand kommt näher. Dann wird alles schwarz.');
    this.rescue.setContinue(() => {
      this.rescue!.hide();
      const black = this.add.rectangle(320, 180, 640, 360, 0x000000)
        .setScrollFactor(0).setDepth(1100).setAlpha(0);
      this.tweens.add({ targets: black, alpha: 1, duration: getSettings().reducedMotion ? 150 : 900, onComplete: () => {
        this.rescue!.setText('Ein Mann findet Valentus und bringt den Bewusstlosen in ein Bauernhaus. Dort versorgt ihn das Paar.');
        this.rescue!.setContinue(() => { this.rescue!.hide(); this.scene.start('refuge'); });
      } });
    });
  }

  private setHint(text: string) {
    if (text === this.hintState) return;
    this.hintState = text;
    this.hud.hint(text);
  }

  private actionMarker(label: string, color: number) {
    const ring = this.add.circle(0, 0, 12, 0x101820, 0.96).setStrokeStyle(2, color, 1);
    const text = this.add.text(0, -1, label, { fontFamily: FONT, fontSize: '16px', color: '#f4ecd8', stroke: '#101820', strokeThickness: 2 }).setOrigin(0.5);
    return this.add.container(0, 0, [ring, text]).setDepth(810).setVisible(false);
  }

  private updateMarkers() {
    const st = this.stations[this.nextStation];
    const actionable = st && (st.kind === 'jump' || !!st.holdMs);
    const ready = actionable && this.dist >= st.at - 1;
    this.stationMarker.setVisible(!!actionable && st.at - this.dist < 85 && !this.busy && !this.ended && !(st.holdMs && this.holding > 0));
    if (actionable) {
      const p = this.pointAt(st.at).p;
      this.stationMarker.setPosition(p.x + 12, p.y - 18).setAlpha(ready ? 1 : 0.55);
    }
    for (const pause of this.pauses) {
      const p = this.pointAt(pause.at).p;
      pause.marker.setPosition(p.x + 14, p.y - 18).setVisible(!pause.done && Math.abs(this.dist - pause.at) < 45 && !this.busy && !this.ended && !ready);
    }
    const nearPause = this.pauses.find((p) => !p.done && Math.abs(this.dist - p.at) < 26);
    if (!this.busy && !this.ended) this.setHint(ready ? st.hint ?? '' : nearPause ? `E · ${nearPause.kind === 'listen' ? 'Lauschen' : 'Wunde drücken'} (optional)` : 'WASD / Klick · Weiter');
    this.routeMarker.setVisible(!this.busy && !this.ended && !ready);
    if (this.routeMarker.visible) {
      const target = Math.min(this.dist + 38, st?.at ?? this.total);
      const p = this.pointAt(target).p;
      this.routeMarker.setPosition(p.x, p.y - 1).setAlpha(getSettings().reducedMotion ? 0.6 : 0.45 + Math.sin(this.time.now / 380) * 0.15);
    }
  }

  private optionalPause(pause: PauseAction) {
    if (pause.done || this.busy || this.ended) return;
    pause.done = true;
    this.busy = true;
    this.railTarget = undefined;
    this.v.anims.stop();
    this.setHint('');
    const ring = this.add.ellipse(this.v.x, this.v.y, 16, 7).setStrokeStyle(1, pause.kind === 'listen' ? 0xaebdc7 : 0xc29186, 0.7).setDepth(this.v.y - 2);
    this.tweens.add({ targets: ring, scale: getSettings().reducedMotion ? 1 : 2, alpha: 0, duration: 800, onComplete: () => ring.destroy() });
    if (pause.kind === 'listen') {
      sfx.bark(0.16);
      this.hud.thought('Die Hunde. Noch hinter mir.', 1700);
    } else {
      sfx.breath();
      this.hud.thought('Fest drücken. Weiter.', 1700);
      this.dropTimer = 1100; // kurze Druckpause, keine Heilung
    }
    this.time.delayedCall(700, () => { this.busy = false; });
  }

  private addForestAmbience() {
    // Flaches Mondlicht bewegt sich langsam zwischen den Stämmen, ohne neue
    // begehbare Flächen oder Hindernisse in die festen Bühnen zu zeichnen.
    for (const x of [170, 470, 890, 1170]) {
      const mist = this.add.ellipse(x, 285, 130, 14, 0xc1d3df, 0.04).setDepth(750);
      this.ambientShapes.push(mist);
      this.ambientTweens.push(this.tweens.add({ targets: mist, x: x + 20, alpha: 0.07, duration: 6200, yoyo: true, repeat: -1, ease: 'Sine.inOut' }));
    }
    for (const [x, y] of [[664, 312], [730, 320], [815, 334]]) {
      const ripple = this.add.ellipse(x, y, 13, 3).setStrokeStyle(1, 0x829ba8, 0.35).setDepth(-450);
      this.ambientShapes.push(ripple);
      this.ambientTweens.push(this.tweens.add({ targets: ripple, scaleX: 1.7, alpha: 0.1, duration: 2200, delay: x % 900, yoyo: true, repeat: -1 }));
    }
  }

  private addForestBackground() {
    const key = 'bg-flight-blended';
    if (!this.textures.exists(key)) {
      const a = this.textures.get('bg-flight-a').getSourceImage() as HTMLImageElement;
      const b = this.textures.get('bg-flight-b').getSourceImage() as HTMLImageElement;
      const texture = this.textures.createCanvas(key, 1280, 360)!;
      const context = texture.getContext();
      context.imageSmoothingEnabled = false;
      context.drawImage(a, 0, 0);
      context.drawImage(b, 640, 0);
      // Die Randstreifen gehen über 128 Pixel ineinander über. Außerhalb
      // dieses Bands behalten beide Bühnen ihre ursprünglichen Koordinaten.
      for (let x = 0; x < 128; x++) {
        const t = x / 127;
        const alpha = t * t * (3 - 2 * t);
        context.globalAlpha = 1;
        context.drawImage(a, 576 + Math.floor(x / 2), 0, 1, 360, 576 + x, 0, 1, 360);
        context.globalAlpha = alpha;
        context.drawImage(b, Math.floor(x / 2), 0, 1, 360, 576 + x, 0, 1, 360);
      }
      context.globalAlpha = 1;
      texture.refresh();
    }
    this.add.image(0, 0, key).setOrigin(0).setDepth(-1000);
  }

  private skipFlight() {
    this.ended = true;
    this.busy = true;
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.v.anims.stop();
    this.stationMarker.setVisible(false); this.routeMarker.setVisible(false);
    this.pauses.forEach((p) => p.marker.setVisible(false));
    this.holdBar?.destroy(); this.holdBack?.destroy();
    this.hud.hideAll(300);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(550, () => this.scene.start('refuge'));
  }
}

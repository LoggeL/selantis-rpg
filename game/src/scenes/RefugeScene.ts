import Phaser from 'phaser';
import { sfx } from '../audio';
import { getSettings, motionDuration } from '../settings';
import { FONT, Hud } from '../ui';
import { BEAM_LENGTH, cellCenter, inside, type Cell } from '../battle/grid';
import type { MobileControlProfile } from '../mobileInput';
import { Dialogue } from '../dialogue';

type Pt = { x: number; y: number };
type Phase = 'cine' | 'wake' | 'rise' | 'walk' | 'cradle' | 'raise' | 'light';
type LastMagic = { kind: 'beam' | 'wave'; from: Cell; dir?: Cell; center?: Cell } | null;

const MAGIC_BLUE = 0x397fc1;
const V_SCALE = 2; // Figurenblatt ist für die Schlachtbühne gezeichnet; das Zimmer ist doppelt so groß gemalt
const LIE: Pt = { x: 150, y: 162 };
const SIT: Pt = { x: 214, y: 186 };
// Weg zur Wiege: am Bett vorbei, zuletzt in den Mondlichtstreifen
const WALK: Pt[] = [SIT, { x: 300, y: 197 }, { x: 405, y: 192 }, { x: 482, y: 168 }];
const STEPS = 8;
const CRADLE: Pt = { x: 535, y: 108 };
const DARK_TINT = 0x8a90ac, MOON_TINT = 0xc4cce6;
// Wiegen-Nahaufnahme: Mitte zwischen den Köpfen, darüber Hand und Schimmer
const HEADS_MID: Pt = { x: 320, y: 132 };
const HAND_OFF: Pt = { x: 4, y: -20 };
const HAND_EXT = 24;

export class RefugeScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Layer;
  private ui!: Phaser.GameObjects.Layer;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private phase: Phase = 'cine';
  private cine: Phaser.Time.TimerEvent[] = [];
  private hud?: Hud;
  private v?: Phaser.GameObjects.Sprite;
  private blanket?: Phaser.GameObjects.Image;
  private white!: Phaser.GameObjects.Rectangle;
  private bar?: { back: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle };
  private skipHeld = 0;
  private holding = 0;
  private step = 0;
  private stepping = false;
  private idleMs = 0;
  private beatEvery = 0;
  private beatTimer = 0;
  private focus = { x: 320, y: 180, z: 1 };
  private follow = false;
  private walkLens: number[] = [];
  private inspected = new Set<string>();
  private risePointer?: Phaser.Input.Pointer;
  private dialogue?: Dialogue;

  constructor() { super('refuge'); }

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.hud?.setCinematic(['cine', 'wake', 'cradle', 'raise', 'light'].includes(phase));
    this.publishControls();
  }

  private publishControls() {
    const action = this.phase === 'cine' ? 'Weiter halten'
      : this.phase === 'rise' ? 'Aufrichten halten'
        : this.phase === 'walk' ? 'Schritt'
          : this.phase === 'cradle' || this.phase === 'raise' ? 'Hand heben'
            : 'Weiter';
    const disabled = this.phase === 'wake' || this.phase === 'cradle' || this.phase === 'light' || (this.phase === 'walk' && this.stepping);
    const controls: MobileControlProfile = { directions: [], actions: { E: action }, inventory: false, disabled };
    this.data.set('mobile:controls', controls);
    this.data.set('mobile:hint', disabled ? '' : this.phase === 'cine' ? 'Zum Überspringen gedrückt halten.'
      : this.phase === 'rise' ? 'Gedrückt halten: aufrichten.'
        : this.phase === 'walk' ? 'Ein Schritt zur Wiege.' : 'Die Hand heben.');
  }

  private primaryAction() {
    if (this.dialogue?.visible) { this.dialogue.advance(); return; }
    if (this.hud?.advanceDialogue()) return;
    if (this.phase === 'walk') this.tryStep();
    else if (this.phase === 'raise') this.raiseHand();
    // Cine and rise consume E.isDown in update; automatic phases accept no action.
  }

  create() {
    this.risePointer = undefined;
    this.dialogue = undefined;
    this.data.set('mobile:dialogue', '');
    this.phase = 'cine'; this.cine = []; this.hud = undefined; this.v = undefined; this.blanket = undefined; this.bar = undefined;
    this.inspected.clear();
    this.skipHeld = 0; this.holding = 0; this.step = 0; this.stepping = false; this.idleMs = 0;
    this.beatEvery = 1500; this.beatTimer = 900; this.focus = { x: 320, y: 180, z: 1 }; this.follow = false;
    this.walkLens = WALK.slice(1).map((p, i) => Phaser.Math.Distance.Between(WALK[i].x, WALK[i].y, p.x, p.y));
    this.publishControls();

    const cam = this.cameras.main;
    cam.setBackgroundColor('#000000');
    cam.setBounds(0, 0, 640, 360);
    // Zwei Ebenen: die Welt (Kamera zoomt, Nachbearbeitung) und eine ungezoomte UI-Kamera darüber
    this.world = this.add.layer();
    this.ui = this.add.layer();
    cam.ignore(this.ui);
    this.uiCam = this.cameras.add(0, 0, 640, 360).setName('ui');
    this.uiCam.ignore(this.world);
    this.white = this.u(this.add.rectangle(320, 180, 640, 360, 0xffffff).setAlpha(0).setDepth(5000));
    this.dialogue = new Dialogue(this, { layer: this.ui });

    this.keys = this.input.keyboard!.addKeys('D,RIGHT,E,Q,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.E.on('down', () => this.primaryAction());
    this.keys.D.on('down', () => this.tryStep());
    this.keys.RIGHT.on('down', () => this.tryStep());
    this.keys.Q.on('down', () => this.raiseHand());
    // Maus: Klick = ein Schritt bzw. die Hand heben; gedrückt halten = aufrichten (wie E)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.dialogue?.visible) { this.dialogue.advance(); return; }
      if (this.hud?.hitTest(p)) return;
      if (this.inspectRoom(p.worldX, p.worldY)) return;
      if (this.phase === 'rise') this.risePointer = p;
      this.tryStep();
      this.raiseHand();
    });
    const releasePointer = (pointer: Phaser.Input.Pointer) => { if (pointer === this.risePointer) this.risePointer = undefined; };
    this.input.on('pointerup', releasePointer);
    this.input.on('pointerupoutside', releasePointer);
    const resetPointer = () => { this.risePointer = undefined; };
    this.events.on('pause', resetPointer);
    this.events.once('shutdown', () => { this.events.off('pause', resetPointer); this.risePointer = undefined; });

    this.voices();
  }

  private w<T extends Phaser.GameObjects.GameObject>(o: T): T { this.world.add(o); return o; }
  private u<T extends Phaser.GameObjects.GameObject>(o: T): T { this.ui.add(o); return o; }
  private at(ms: number, fn: () => void) { this.cine.push(this.time.delayedCall(ms, fn)); }

  /** Reading pauses the cinematic timeline; animation/action locks remain intact. */
  private say(who: string, line: string, _ms: number, _y: number) {
    const pending = this.cine.filter(timer => !timer.loop);
    pending.forEach(timer => { timer.paused = true; });
    this.dialogue!.setText(line, who);
    this.dialogue!.setContinue(() => {
      this.dialogue!.hide();
      pending.forEach(timer => { timer.paused = false; });
    });
  }

  // ---------- 1: Stimmen im Schwarz ----------
  private voices() {
    this.at(700, () => this.say('Frau', 'Schnell, hole ihm etwas Wasser! Ich glaube, er wacht auf.', 2600, 180));
    this.at(4000, () => this.say('Mann', 'Unglaublich. Als ich ihn gefunden habe, dachte ich schon, er sei tot. Sein Herzschlag war kaum mehr zu spüren.', 3900, 180));
    [8600, 9000, 9450, 9950].forEach((t) => this.at(t, () => sfx.step()));
    this.at(10600, () => this.eyesOpen());
  }

  // ---------- 2: Augen öffnen ----------
  private eyesOpen() {
    const cam = this.cameras.main;
    this.w(this.add.image(0, 0, 'cut-woman').setOrigin(0));
    // Kerzenlicht von links unten, unruhig
    const glow = this.glowTexture();
    const warm = [
      this.w(this.add.image(20, 250, glow).setDisplaySize(560, 560).setTint(0xd9732b)),
      this.w(this.add.image(20, 250, glow).setDisplaySize(260, 260).setTint(0xf0a040)),
      this.w(this.add.rectangle(320, 180, 640, 360, 0x3a1c06, 0.08)),
    ];
    const base = [0.22, 0.2, 0.08];
    warm.forEach((o, i) => { o.setBlendMode(Phaser.BlendModes.ADD).setDepth(10); (o as Phaser.GameObjects.Image).setAlpha(base[i]); });
    this.cine.push(this.time.addEvent({ delay: 110, loop: true, callback: () => {
      const f = Phaser.Math.FloatBetween(0.7, 1.3);
      warm.forEach((o, i) => (o as Phaser.GameObjects.Image).setAlpha(base[i] * (i === 1 ? f * Phaser.Math.FloatBetween(0.9, 1.1) : f)));
    } }));
    this.w(this.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(0.6).setDepth(20));

    // Tränenfilm: grob verpixelt, verschwommen, leicht gewölbt – wird langsam scharf
    const blur = cam.postFX.addBlur(1, 2, 2, 2.6);
    const pix = cam.postFX.addPixelate(10);
    const lens = getSettings().reducedMotion ? undefined : cam.postFX.addBarrel(1.08);
    cam.fadeIn(1400, 0, 0, 0);
    this.tweens.addCounter({
      from: 0, to: 1, duration: 3300, delay: 700, ease: 'Linear',
      onUpdate: (tw) => {
        const t = tw.getValue()!, rest = 1 - t;
        pix.amount = Math.floor(Phaser.Math.Linear(10, -1, Math.min(1, t * 1.1)));
        blur.strength = 2.6 * Math.pow(rest, 1.3);
        if (lens) lens.amount = getSettings().reducedMotion ? 1 : 1 + 0.08 * rest + 0.02 * rest * Math.sin(this.time.now / 260);
      },
      onComplete: () => { cam.postFX.remove(pix); cam.postFX.remove(blur); if (lens) lens.amount = 1; },
    });
    this.at(4300, () => this.say('Frau', 'Habt keine Angst. Ihr seid in guten Händen.', 2800, 322));
    // Die Sinne schwinden
    this.at(7900, () => {
      const b = cam.postFX.addBlur(1, 2, 2, 0);
      this.tweens.add({ targets: b, strength: 3, duration: 450, ease: 'Quad.in' });
      if (lens && !getSettings().reducedMotion) this.tweens.add({ targets: lens, amount: 1.12, duration: 450, ease: 'Quad.in' });
      cam.fadeOut(450, 0, 0, 0);
    });
    this.at(8500, () => { this.clearWorld(); this.beatEvery = 0; });
    this.at(9100, () => this.echo());
  }

  // ---------- 3: Echo der letzten Magie (höchstens 1 s) ----------
  private echo() {
    const cam = this.cameras.main;
    cam.resetFX();
    const last = (this.registry.get('lastMagic') as LastMagic) ?? { kind: 'beam', from: { x: 3, y: 4 }, dir: { x: 1, y: 0 } };
    const bg = this.w(this.add.image(0, 0, 'bg-battle').setOrigin(0).setTint(0xa4a8b4));
    bg.preFX?.addColorMatrix().saturate(-1);
    if (!getSettings().reducedMotion) {
      const lens = cam.postFX.addBarrel(1.22);
      this.tweens.add({ targets: lens, amount: 0.9, duration: 700 });
    }

    this.at(140, () => {
      if (last.kind === 'wave') {
        const m = cellCenter(last.center ?? last.from);
        sfx.wave();
        const ring = this.w(this.add.circle(m.x, m.y, 6).setStrokeStyle(3, 0xcfe6ff, 1));
        const ring2 = this.w(this.add.circle(m.x, m.y, 4).setStrokeStyle(6, MAGIC_BLUE, 0.7));
        [ring, ring2].forEach((r) => r.setBlendMode(Phaser.BlendModes.ADD).setDepth(50));
        this.tweens.add({ targets: [ring, ring2], radius: 60, alpha: 0.2, duration: 420, ease: 'Cubic.out' });
      } else {
        const dir = last.dir ?? { x: 1, y: 0 };
        let end = last.from;
        for (let i = 1; i <= BEAM_LENGTH; i++) {
          const c = { x: last.from.x + dir.x * i, y: last.from.y + dir.y * i };
          if (!inside(c)) break;
          end = c;
        }
        const a = cellCenter(last.from), b = cellCenter(end);
        const hand = { x: a.x + Math.sign(b.x - a.x) * 10, y: a.y - 14 }, tip = { x: b.x, y: b.y - 10 };
        sfx.beam();
        [{ w: 14, c: MAGIC_BLUE, a: 0.45 }, { w: 7, c: 0x6fb2ff, a: 0.8 }, { w: 3, c: 0xffffff, a: 1 }].forEach((l) => {
          const g = this.w(this.add.graphics().setDepth(50).setBlendMode(Phaser.BlendModes.ADD));
          g.lineStyle(l.w, l.c, l.a).lineBetween(hand.x, hand.y, tip.x, tip.y);
          this.tweens.add({ targets: g, alpha: 0.15, duration: 520 });
        });
      }
      const flash = this.w(this.add.rectangle(320, 180, 640, 360, 0xdfefff, 0.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(60));
      this.tweens.add({ targets: flash, alpha: 0, duration: 220 });
      if (!getSettings().reducedMotion) cam.shake(240, 0.012);
    });
    // hart Schwarz
    this.at(760, () => { this.clearWorld(); cam.resetFX(); });
    this.at(1500, () => this.wake());
  }

  /** Alle Weltobjekte zerstören (Layer.removeAll würde sie nur aushängen). */
  private wipe() {
    [...this.world.getAll()].forEach((o) => o.destroy());
  }

  private clearWorld() {
    this.tweens.killAll();
    this.cameras.main.postFX.clear();
    this.wipe();
  }

  /** Esc gehalten: die rein filmischen Teile überspringen. */
  private skipCine() {
    this.cine.forEach((t) => t.remove(false));
    this.cine = [];
    this.dialogue?.hide();
    this.ui.getAll().filter((o) => o !== this.white && o !== this.dialogue?.container).forEach((o) => o.destroy());
    this.clearWorld();
    this.cameras.main.resetFX();
    this.wake();
  }

  // ---------- 4: erstes wirkliches Erwachen ----------
  private wake() {
    this.dialogue?.hide();
    this.cine.forEach((t) => t.remove(false));
    this.cine = [];
    this.setPhase('wake');
    this.dropBar();
    const cam = this.cameras.main;
    cam.resetFX();
    cam.postFX.clear();
    // scharf, ohne Vignette: die Gegenwart
    this.w(this.add.image(0, 0, 'bg-refuge-dark').setOrigin(0).setDepth(-1000));
    const candleLight = this.w(this.add.image(0, 0, 'bg-refuge-candle').setOrigin(0).setDepth(-999).setAlpha(0));
    this.tweens.add({ targets: candleLight, alpha: 0.13, duration: motionDuration(1800), ease: 'Sine.out' });
    this.v = this.w(this.add.sprite(LIE.x, LIE.y, 'valentus-refuge', 0).setOrigin(0.5, 60 / 64).setScale(V_SCALE).setTint(DARK_TINT).setDepth(LIE.y));
    // Decke aus dem Hintergrund über ihn gelegt
    this.blanket = this.w(this.add.image(0, 0, 'bg-refuge-dark').setOrigin(0).setCrop(52, 116, 160, 124).setDepth(LIE.y + 1));
    cam.fadeIn(700, 0, 0, 0);
    sfx.breath();
    this.beatEvery = 1400; this.beatTimer = 300;

    const before = this.children.list.length;
    this.hud = new Hud(this, 'portrait-valentus-wounded', 'VALENTUS', { dialogueLayer: this.ui });
    this.hud.setCinematic(true);
    this.hud.setHp(0.12, false);
    this.hud.setAbilities([{ icon: 'beam', key: 'Q', onClick: () => this.raiseHand() }]);
    this.hud.setAbilitiesDisabled(true);
    this.hud.setAbilitiesVisible(false);
    this.hud.moveAbilities(98, 48);
    this.children.list.slice(before).forEach((o) => this.ui.add(o));
    this.publishControls();

    const t = this.time;
    t.delayedCall(1300, () => this.hud!.thought('Sie werden mich hier finden.', 2300));
    t.delayedCall(4000, () => this.hud!.thought('Und dann töten sie die beiden gleich mit.', 2300));
    t.delayedCall(6700, () => this.hud!.thought('Die Hoffnung muss weiterleben.', 2600));
    t.delayedCall(8600, () => { this.hud!.hint('E / Maus halten: aufrichten'); this.setPhase('rise'); });
  }

  // ---------- 5: Aufstehen ----------
  private rise(dt: number) {
    const v = this.v!;
    if (!this.keys.E.isDown && !this.risePointer?.isDown) { v.x = Math.round(v.x); return; }
    this.holding += dt;
    const p = Phaser.Math.Clamp(this.holding / 2400, 0, 1);
    this.drawBar(p, 0x9cc4ec);
    v.setFrame(p < 0.12 ? 0 : p < 0.45 ? 1 : p < 0.78 ? 2 : 3);
    const m = Phaser.Math.Clamp((p - 0.25) / 0.65, 0, 1);
    const x = Phaser.Math.Linear(LIE.x, SIT.x, Phaser.Math.Easing.Sine.InOut(m)), y = Phaser.Math.Linear(LIE.y, SIT.y, m);
    // Arme zittern
    v.setPosition(Math.round(x + Phaser.Math.Between(-1, 1)), Math.round(y)).setDepth(y);
    this.blanket!.setAlpha(1 - Phaser.Math.Clamp((p - 0.1) / 0.3, 0, 1));
    if (p >= 1) {
      this.setPhase('wake');
      this.dropBar();
      this.hud!.hint('');
      sfx.creak();
      v.setPosition(SIT.x, SIT.y);
      this.blanket!.destroy(); this.blanket = undefined;
      this.follow = true;
      this.time.delayedCall(900, () => {
        this.hud!.hint('E / Klick: ein Schritt zur Wiege.');
        this.setPhase('walk');
      });
    }
  }

  // ---------- 6: der Weg zur Wiege ----------
  private walkPoint(d: number): Pt {
    let acc = 0;
    for (let i = 0; i < this.walkLens.length; i++) {
      if (d <= acc + this.walkLens[i] || i === this.walkLens.length - 1) {
        const t = Phaser.Math.Clamp((d - acc) / this.walkLens[i], 0, 1);
        return { x: Phaser.Math.Linear(WALK[i].x, WALK[i + 1].x, t), y: Phaser.Math.Linear(WALK[i].y, WALK[i + 1].y, t) };
      }
      acc += this.walkLens[i];
    }
    return WALK[WALK.length - 1];
  }

  private tryStep() {
    if (this.phase !== 'walk' || this.stepping || this.hud?.dialogueVisible) return;
    this.stepping = true;
    this.idleMs = 0;
    if (this.step === 0) this.hud!.hint('', true);
    this.publishControls();
    const v = this.v!;
    const total = this.walkLens.reduce((a, b) => a + b, 0);
    const d0 = total * this.step / STEPS, d1 = total * (this.step + 1) / STEPS;
    this.step++;
    v.play('vr-stagger');
    v.anims.timeScale = 1.2;
    sfx.creak();
    const cam = this.cameras.main;
    cam.shake(180, 0.0025);
    const k = this.step / STEPS;
    const target = this.walkPoint(d1);
    this.tweens.add({
      targets: this.focus, duration: 700, ease: 'Sine.inOut',
      z: 1 + 0.6 * k,
      x: Phaser.Math.Linear(320, (target.x + CRADLE.x) / 2, k),
      y: Phaser.Math.Linear(180, (target.y - 40 + CRADLE.y) / 2, k),
    });
    const prog = { t: 0 };
    this.tweens.add({
      targets: prog, t: 1, duration: 640, ease: 'Sine.inOut',
      onUpdate: () => {
        const p = this.walkPoint(Phaser.Math.Linear(d0, d1, prog.t));
        v.setPosition(Math.round(p.x), Math.round(p.y - Math.sin(prog.t * Math.PI) * 2)).setDepth(p.y);
        const lit = Phaser.Math.Clamp((p.x - 400) / 80, 0, 1);
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(DARK_TINT), Phaser.Display.Color.ValueToColor(MOON_TINT), 1, lit);
        v.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      },
      onComplete: () => {
        v.anims.stop();
        v.setFrame(4);
        if (this.step % 2 === 0 || this.step === STEPS) sfx.breath();
        // Atempause: keine Eingabe zählt
        this.time.delayedCall(this.step === STEPS ? 200 : 520, () => {
          this.stepping = false;
          if (this.step >= STEPS) this.atCradle();
          else this.publishControls();
        });
      },
    });
  }

  /** Kleine optionale Beobachtungen; sie ändern weder Versorgung noch Handlung. */
  private inspectRoom(x: number, y: number): boolean {
    if (this.phase !== 'wake' && this.phase !== 'walk') return false;
    const points = [
      { id: 'water', x: 235, y: 91, rx: 36, ry: 28, line: 'Wasser. Sie haben es mir hingestellt.' },
      { id: 'supplies', x: 110, y: 24, rx: 58, ry: 24, line: 'Tücher und Töpfe, alles griffbereit. Sie haben gut für mich gesorgt.' },
    ];
    const point = points.find((p) => Math.abs(x - p.x) <= p.rx && Math.abs(y - p.y) <= p.ry);
    if (!point) return false;
    if (!this.inspected.has(point.id)) {
      this.inspected.add(point.id);
      this.hud?.thought(point.line, 1800);
      sfx.select();
      const glint = this.w(this.add.image(point.x, point.y, this.glowTexture())
        .setDisplaySize(72, 52).setTint(0xf3c77a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.16).setDepth(40));
      this.tweens.add({ targets: glint, alpha: 0, duration: motionDuration(650), onComplete: () => glint.destroy() });
    }
    return true;
  }

  private idle(dt: number) {
    const v = this.v!;
    if (this.stepping) return;
    // Ohne Eingabe: abstützen und atmen
    this.idleMs += dt;
    v.setFrame(this.step === 0 ? 3 : 4);
    const p = this.walkPoint(this.walkLens.reduce((a, b) => a + b, 0) * this.step / STEPS);
    v.y = Math.round(p.y) + (Math.floor(this.idleMs / 700) % 2);
    if (this.idleMs > 2600 && Math.floor((this.idleMs - dt) / 2600) !== Math.floor(this.idleMs / 2600)) sfx.breath();
  }

  // ---------- 7: Wiegenkante ----------
  private atCradle() {
    this.setPhase('cradle');
    this.hud!.hint('');
    const v = this.v!;
    v.play('vr-brace');
    sfx.creak();
    this.time.delayedCall(1100, () => {
      // Schnitt: Blick in die Wiege
      this.follow = false;
      const cam = this.cameras.main;
      cam.setZoom(1); cam.centerOn(320, 180);
      this.wipe();
      this.v = undefined;
      this.w(this.add.image(0, 0, 'cut-cradle-sleep').setOrigin(0));
      this.beatEvery = 0;
      sfx.heartbeat();
      this.time.delayedCall(1100, () => this.hud!.thought('Es tut mir leid. Ich hoffe, du kannst mir verzeihen.', 2800));
      this.time.delayedCall(3900, () => {
        this.hud!.hint('E / Klick: die Hand heben');
        this.setPhase('raise');
        this.hud!.setAbilitiesDisabled(false);
        this.hud!.setAbilitiesVisible(false);
        this.beatEvery = 1700; this.beatTimer = 600;
      });
    });
  }

  // ---------- 8: Hand und Licht ----------
  private raiseHand() {
    if (this.phase !== 'raise' || this.hud?.dialogueVisible) return;
    this.setPhase('light');
    this.beatEvery = 0;
    this.hud!.hint('');
    this.hud!.select('beam');
    const key = this.handTexture();
    const hand = this.w(this.add.image(HAND_OFF.x, HAND_OFF.y + 80, key).setOrigin(0).setDepth(100));
    // nur die Haut fängt das Licht, nicht der Ärmel
    const lit = this.w(this.add.image(hand.x, hand.y, this.skinTexture()).setOrigin(0).setDepth(101)
      .setTint(0x6fb2ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    this.tweens.add({ targets: [hand, lit], y: HAND_OFF.y, duration: 900, ease: 'Quad.out' });

    this.time.delayedCall(900, () => {
      sfx.hum(2.2);
      const c = HEADS_MID;
      // gestuftes Licht aus vielen schwachen Kreisen
      [88, 72, 58, 46, 35, 25, 16, 9].forEach((r, i) => {
        const col = i < 3 ? MAGIC_BLUE : i < 6 ? 0x6fb2ff : 0xcfe6ff;
        const o = this.w(this.add.circle(c.x, c.y, r, col, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(90).setScale(0.05).setAlpha(0.07));
        this.tweens.add({ targets: o, scale: 1, duration: 1500 + i * 30, ease: 'Sine.out' });
        this.tweens.add({ targets: o, alpha: { from: 0.055, to: 0.09 }, duration: 420 + i * 25, yoyo: true, repeat: -1 });
      });
      this.w(this.add.particles(c.x, c.y, 'px', {
        x: { min: -26, max: 26 }, y: { min: -14, max: 14 }, speedY: { min: -14, max: -4 }, speedX: { min: -5, max: 5 },
        lifespan: 1300, scale: { start: 1, end: 0 }, alpha: { start: 0.9, end: 0 },
        tint: [0xffffff, 0x9cc4ec, MAGIC_BLUE], blendMode: 'ADD', frequency: 45,
      }).setDepth(95));
      this.tweens.add({ targets: lit, alpha: 0.28, duration: 1600, ease: 'Sine.in' });
      this.cameras.main.shake(1600, 0.0012);

      this.time.delayedCall(1650, () => {
        // grelles Licht, Knall
        sfx.bang();
        this.white.setAlpha(1);
        this.hud!.hideAll(0);
        this.cameras.main.shake(700, 0.02);
        this.time.delayedCall(260, () => {
          // ---------- 9: Nachblick ----------
          this.wipe();
          this.w(this.add.image(0, 0, 'cut-cradle-empty').setOrigin(0).setTint(0x8a8ea4));
          sfx.babyCry(3);
          this.tweens.add({ targets: this.white, alpha: 0, duration: 140 });
          this.time.delayedCall(440, () => {
            // ---------- 10: ein ruhiger Abschluss vor dem Zeitsprung ----------
            this.fadeToNextChapter();
          });
        });
      });
    });
  }

  private fadeToNextChapter() {
    const black = this.u(this.add.rectangle(320, 180, 640, 360, 0x000000).setDepth(5001).setAlpha(0));
    if (getSettings().reducedMotion) black.setAlpha(1);
    else this.tweens.add({ targets: black, alpha: 1, duration: 2000, ease: 'Sine.inOut' });
    this.time.delayedCall(2000, () => { this.wipe(); this.scene.start('lia'); });
  }

  /** Nur die Hautpixel des Hand-Overlays, weiß – für das Blau von unten. */
  private skinTexture() {
    const key = 'refuge-hand-skin';
    if (this.textures.exists(key)) return key;
    const src = this.textures.get(this.handTexture()).getSourceImage() as HTMLCanvasElement;
    const t = this.textures.createCanvas(key, src.width, src.height)!;
    const ctx = t.getContext();
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, src.width, src.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const skin = d[i + 3] > 0 && d[i] > d[i + 2] + 12;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = skin ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
    t.refresh();
    return key;
  }

  /** Weicher Lichtfleck für Kerze und Schimmer. */
  private glowTexture() {
    const key = 'refuge-glow';
    if (this.textures.exists(key)) return key;
    const t = this.textures.createCanvas(key, 128, 128)!;
    const ctx = t.getContext();
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return key;
  }

  /** Hand-Overlay mit verlängertem Ärmel, damit er nach dem Anheben unten nicht abreißt. */
  private handTexture() {
    const key = 'refuge-hand-long';
    if (this.textures.exists(key)) return key;
    const src = this.textures.get('cut-hand').getSourceImage() as HTMLImageElement;
    const t = this.textures.createCanvas(key, 640, 360 + HAND_EXT)!;
    const ctx = t.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
    ctx.drawImage(src, 0, 358, 640, 2, 0, 360, 640, HAND_EXT);
    t.refresh();
    return key;
  }

  // ---------- Hilfen ----------
  private drawBar(p: number, color: number) {
    if (!this.bar) {
      const back = this.u(this.add.rectangle(320, 300, 102, 6, 0x0d0f12).setDepth(1000));
      const fill = this.u(this.add.rectangle(270, 300, 0, 4, color).setOrigin(0, 0.5).setDepth(1001));
      this.bar = { back, fill };
    }
    this.bar.fill.width = 100 * Phaser.Math.Clamp(p, 0, 1);
  }

  private dropBar() {
    this.bar?.back.destroy(); this.bar?.fill.destroy(); this.bar = undefined;
  }

  update(_t: number, dt: number) {
    this.dialogue?.update();
    if (this.beatEvery > 0) {
      this.beatTimer -= dt;
      if (this.beatTimer <= 0) { this.beatTimer = this.beatEvery; sfx.heartbeat(); }
    }
    if (this.hud?.dialogueVisible) return;
    if (this.phase === 'cine') {
      if (this.keys.ESC.isDown || (this.keys.E.isDown && !this.dialogue?.visible)) {
        this.skipHeld += dt;
        this.drawBar(this.skipHeld / 1500, 0x8a8478);
        if (this.skipHeld >= 1500) this.skipCine();
      } else if (this.skipHeld > 0) {
        this.skipHeld = 0;
        this.dropBar();
      }
      return;
    }
    if (this.phase === 'rise') this.rise(dt);
    if (this.phase === 'walk') this.idle(dt);
    if (this.follow) {
      const cam = this.cameras.main;
      cam.setZoom(this.focus.z);
      cam.centerOn(this.focus.x, this.focus.y);
    }
  }
}

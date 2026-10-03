import Phaser from 'phaser';
import { sfx } from '../audio';
import { FONT, Hud } from '../ui';
import { ambientPrefs, getSettings } from '../settings';
import { usesMobileInterface } from '../mobileDialogs';

/** Traumbruch: Farbe läuft aus, die Wunde wird sichtbar, die Welt zerfällt – zuerst der Junge. */
export class BreakScene extends Phaser.Scene {
  private skipKey!: Phaser.Input.Keyboard.Key;
  private actionKey!: Phaser.Input.Keyboard.Key;
  private skipFill!: Phaser.GameObjects.Rectangle;
  private skipHeld = false;
  private skipProgress = 0;
  private transitioning = false;
  private woundVisible = false;
  private lastBreath = -1000;
  private woundHint!: Phaser.GameObjects.Text;
  constructor() { super('break'); }

  create() {
    this.skipHeld = false; this.skipProgress = 0; this.transitioning = false;
    this.setWoundVisible(false); this.lastBreath = -1000;
    this.data.set('mobile:thought', '');
    const cam = this.cameras.main;
    cam.setBackgroundColor('#f4f1ea');
    const snapKey = this.textures.exists('snap') ? 'snap' : 'bg-battle';
    const snap = this.add.image(0, 0, snapKey).setOrigin(0);
    this.skipKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    const skip = this.add.text(320, 335, 'Leertaste halten: weiter', {
      fontFamily: FONT, fontSize: '9px', color: '#ded8c7', stroke: '#191a1e', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1100).setInteractive({ useHandCursor: true });
    this.add.rectangle(271, 350, 98, 2, 0x262932, 0.55).setOrigin(0).setDepth(1100);
    this.skipFill = this.add.rectangle(271, 350, 0, 2, 0xb8cedf).setOrigin(0).setDepth(1101);
    if (usesMobileInterface()) skip.setVisible(false).disableInteractive();
    skip.on('pointerdown', () => { this.skipHeld = true; });
    this.input.on('pointerup', () => { this.skipHeld = false; });
    this.input.on('pointerupoutside', () => { this.skipHeld = false; });
    this.events.on('pause', () => {
      this.skipHeld = false; this.skipProgress = 0; this.skipFill.width = 0;
    });
    this.actionKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.actionKey.on('down', () => this.breathe());
    this.woundHint = this.add.text(320, 337, '', {
      fontFamily: FONT, fontSize: '10px', color: '#e1d4c5', stroke: '#191a1e', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1100);

    // 1) Farbe läuft aus, Lärm wird eingesaugt
    const cm = cam.postFX.addColorMatrix();
    sfx.suck();
    sfx.drone(4);
    this.tweens.addCounter({
      from: 0, to: 1, duration: 1600, ease: 'Sine.in',
      onUpdate: (tw) => { cm.reset(); cm.saturate(-tw.getValue()!); cm.brightness(1 + 0.15 * tw.getValue()!, true); },
    });

    // 2) Nahaufnahme: die Wunde war die ganze Zeit da
    this.time.delayedCall(1800, () => {
      cm.reset();
      snap.setVisible(false);
      const mono = this.add.image(0, 0, 'cut-wound-mono').setOrigin(0);
      const red = this.add.image(0, 0, 'cut-wound-red').setOrigin(0);
      this.woundHint.setText(usesMobileInterface() ? 'Die Wunde.' : 'E oder Wunde anklicken: Atemzug.').setY(312);
      const woundZone = this.add.zone(250, 190, 160, 100).setDepth(1005).setInteractive({ useHandCursor: true });
      if (usesMobileInterface()) woundZone.disableInteractive();
      woundZone.on('pointerdown', () => this.breathe());
      const maskShape = this.make.graphics({}, false);
      const mask = maskShape.createGeometryMask();
      red.setMask(mask);
      const blood = { r: 4 };
      sfx.heartbeat();
      this.tweens.add({
        targets: blood, r: 260, duration: 2600, ease: 'Sine.out',
        onUpdate: () => maskShape.clear().fillStyle(0xffffff).fillCircle(250, 190, blood.r),
      });
      this.time.delayedCall(900, () => sfx.heartbeat());
      const hud = new Hud(this, 'portrait-valentus', 'VALENTUS');
      hud.setHp(1, false);
      this.setWoundVisible(true);
      this.time.delayedCall(700, () => {
        hud.setPortrait('portrait-valentus-wounded');
        hud.setHp(0.12);
        if (!getSettings().reducedMotion) this.cameras.main.shake(300, 0.006);
      });
      // 3) zurück auf die graue Welt, die zerfällt
      this.time.delayedCall(3100, () => {
        this.woundHint.setText(''); woundZone.destroy();
        mono.destroy(); red.destroy(); mask.destroy(); maskShape.destroy(); hud.hideAll(0);
        this.setWoundVisible(false);
        snap.setVisible(true);
        cm.reset(); cm.saturate(-1); cm.brightness(1.15, true);
        this.time.delayedCall(250, () => { snap.setVisible(false); this.dissolve(snapKey); });
      });
    });
  }

  update(_time: number, dt: number) {
    this.woundHint.setVisible(!usesMobileInterface());
    if (this.transitioning) return;
    const skipDown = this.skipKey.isDown || this.skipHeld || (!this.woundVisible && this.actionKey.isDown);
    this.skipProgress = skipDown ? Math.min(1, this.skipProgress + dt / 950) : 0;
    this.skipFill.width = 98 * this.skipProgress;
    if (this.skipProgress >= 1) this.finish();
  }

  private setWoundVisible(visible: boolean) {
    this.woundVisible = visible;
    this.skipProgress = 0;
    this.data.set('mobile:controls', {
      directions: [], actions: { E: visible ? 'Atmen' : 'Weiter halten' }, inventory: false,
    });
    this.data.set('mobile:hint', visible ? 'Ein Atemzug.' : 'Zum Überspringen gedrückt halten.');
  }

  /** A breath changes the image briefly, without healing or changing the story. */
  private breathe() {
    if (!this.woundVisible || this.time.now - this.lastBreath < 850) return;
    this.lastBreath = this.time.now;
    sfx.breath(); sfx.heartbeat();
    const pulse = this.add.ellipse(250, 190, 25, 13).setStrokeStyle(2, 0xb15750, 0.65).setDepth(999);
    this.tweens.add({ targets: pulse, scaleX: getSettings().reducedMotion ? 1 : 3,
      scaleY: getSettings().reducedMotion ? 1 : 2, alpha: 0, duration: 700,
      ease: 'Sine.out', onComplete: () => pulse.destroy() });
    this.woundHint.setText('Ein schwerer Atemzug.');
    this.data.set('mobile:hint', 'Ein schwerer Atemzug.');
    this.time.delayedCall(850, () => {
      if (this.woundVisible) {
        this.woundHint.setText(usesMobileInterface() ? 'Die Wunde.' : 'E oder Wunde anklicken: Atemzug.');
        this.data.set('mobile:hint', 'Ein Atemzug.');
      }
    });
  }

  private finish() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.data.set('mobile:controls', { directions: [], actions: { E: 'Weiter' }, inventory: false, disabled: true });
    this.cameras.main.postFX.clear();
    this.scene.start('flight');
  }

  /** Die Welt zerfällt in Blöcke, die nach oben driften – ausgehend vom geretteten Jungen. */
  private dissolve(key: string) {
    if (!ambientPrefs().particles) {
      const image = this.add.image(0, 0, key).setOrigin(0);
      this.cameras.main.setBackgroundColor('#f4f1ea');
      this.tweens.add({ targets: image, alpha: 0, duration: 1300,
        onComplete: () => { image.destroy(); this.fever(); } });
      return;
    }
    const B = 20, origin = { x: 330, y: 52 };
    this.cameras.main.setBackgroundColor('#8c8a86');
    this.tweens.addCounter({ from: 0, to: 1, duration: 4200, onUpdate: (tw) => {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x8c8a86), Phaser.Display.Color.ValueToColor(0xf4f1ea), 1, tw.getValue()!);
      this.cameras.main.setBackgroundColor(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    } });
    let last = 0;
    for (let y = 0; y < 360; y += B) for (let x = 0; x < 640; x += B) {
      // Ausschnitt mit Drehpunkt in der Blockmitte, damit er an Ort und Stelle bleibt
      const img = this.add.image(x + B / 2, y + B / 2, key)
        .setOrigin((x + B / 2) / 640, (y + B / 2) / 360).setDisplaySize(640, 360).setCrop(x, y, B, B);
      const dist = Phaser.Math.Distance.Between(x + B / 2, y + B / 2, origin.x, origin.y);
      const delay = dist * 6 + Phaser.Math.Between(0, 260);
      last = Math.max(last, delay);
      this.tweens.add({
        targets: img, y: img.y - Phaser.Math.Between(40, 140), x: img.x + Phaser.Math.Between(-20, 20),
        alpha: 0, angle: Phaser.Math.Between(-25, 25), duration: Phaser.Math.Between(900, 1500), delay, ease: 'Quad.in',
        onComplete: () => img.destroy(),
      });
    }
    this.time.delayedCall(last + 1200, () => this.fever());
  }

  private fever() {
    this.cameras.main.postFX.clear();
    this.data.set('mobile:thought', 'Ein Fiebertraum.');
    const t = this.add.text(320, 180, 'Ein Fiebertraum.', { fontFamily: FONT, fontSize: '16px', color: '#3a3832', fontStyle: 'italic' })
      .setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 900, hold: 1500, yoyo: true });
    this.time.delayedCall(2600, () => sfx.horn());
    this.time.delayedCall(3500, () => sfx.bark(0.25));
    this.time.delayedCall(3900, () => sfx.bark(0.3));
    this.time.delayedCall(3300, () => this.cameras.main.fadeOut(900, 0, 0, 0));
    this.time.delayedCall(4600, () => this.finish());
  }
}

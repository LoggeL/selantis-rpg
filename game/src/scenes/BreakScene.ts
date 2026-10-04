import Phaser from 'phaser';
import { sfx } from '../audio';
import { FONT } from '../ui';
import { getSettings } from '../settings';
import { usesMobileInterface } from '../mobileDialogs';

/** The historical battle ends in injury, a quiet fade and flight into the forest. */
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

  preload() {
    // Reuse the existing wounded-flight illustration from the original prologue.
    if (!this.textures.exists('prologue-valentus-flight'))
      this.load.image('prologue-valentus-flight', 'assets/cut/prologue-valentus.png');
  }

  create() {
    this.skipHeld = false; this.skipProgress = 0; this.transitioning = false;
    this.setWoundVisible(false); this.lastBreath = -1000;
    this.data.set({ 'mobile:thought': '', 'mobile:hudVisible': false });
    const cam = this.cameras.main;
    cam.setBackgroundColor('#07080a');
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

    // 1) The retreating battlefield fades to black.
    this.data.set('story:breakStage', 'battlefield');
    this.tweens.add({ targets: snap, alpha: 0, duration: 1400, ease: 'Sine.inOut' });

    // 2) The wound is visible; Valentus is alive and breathing.
    this.time.delayedCall(1500, () => {
      snap.setVisible(false);
      this.data.set('story:breakStage', 'wound');
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
        targets: blood, r: 260, duration: 2200, ease: 'Sine.out',
        onUpdate: () => maskShape.clear().fillStyle(0xffffff).fillCircle(250, 190, blood.r),
      });
      this.time.delayedCall(900, () => sfx.heartbeat());
      this.setWoundVisible(true);
      this.time.delayedCall(2700, () => {
        this.cameras.main.fadeOut(900, 0, 0, 0);
        this.time.delayedCall(900, () => {
          this.woundHint.setText(''); woundZone.destroy();
          mono.destroy(); red.destroy(); mask.destroy(); maskShape.destroy();
          this.setWoundVisible(false);
          this.showFlight();
        });
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

  private showFlight() {
    if (this.transitioning) return;
    this.data.set('story:breakStage', 'flight');
    const source = this.textures.get('prologue-valentus-flight').getSourceImage();
    const scale = Math.min(640 / source.width, 360 / source.height);
    this.add.image(320, 180, 'prologue-valentus-flight').setScale(scale);
    this.cameras.main.fadeIn(850, 0, 0, 0);
    this.data.set('mobile:thought', 'Verwundet flieht er in den Wald.');
    this.add.text(320, 307, 'Verwundet flieht er in den Wald.', {
      fontFamily: FONT, fontSize: '14px', color: '#f0e2d0',
      stroke: '#11151b', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1090);
    sfx.horn();
    this.time.delayedCall(1700, () => sfx.bark(0.25));
    this.time.delayedCall(2300, () => {
      this.data.set('story:breakStage', 'fade');
      this.cameras.main.fadeOut(1600, 0, 0, 0);
    });
    this.time.delayedCall(4100, () => this.finish());
  }
}

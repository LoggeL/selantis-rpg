import Phaser from 'phaser';
import { FONT } from './Hud';
import { getSettings } from '../../platform/settings';
import { FIRE_HEAT_REQUIRED, fireHitBand, fireMarkerPosition, type FireMinigameState } from '../../modules/camp/fireMinigame';

/** The close-up owns a fixed pool of effects, its input surface and every tween. */
export class FireMinigameUI {
  private root: Phaser.GameObjects.Container;
  private marker: Phaser.GameObjects.Rectangle;
  private heat: Phaser.GameObjects.Text;
  private feedback: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.Rectangle[];
  private band: Phaser.GameObjects.Rectangle;
  private instructions: Phaser.GameObjects.Text;
  private flame: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Ellipse[];
  private sparks: Phaser.GameObjects.Rectangle[];
  private smoke: Phaser.GameObjects.Ellipse[];
  private spindle: Phaser.GameObjects.Container;
  private tinder: Phaser.GameObjects.Graphics;
  private action: Phaser.GameObjects.Container;
  private actionFrame: Phaser.GameObjects.Rectangle;
  private target: Phaser.GameObjects.Text;
  private reducedMotion = true;
  private finished = false;
  private disposed = false;
  private readonly shutdown = () => this.destroy();

  constructor(private readonly scene: Phaser.Scene, stroke: () => void, cancel: () => void) {
    const stop = (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation();
    const veil = scene.add.rectangle(320, 180, 640, 360, 0x070b13, 0.68).setInteractive();
    veil.on('pointerdown', stop);
    const shadow = scene.add.rectangle(320, 175, 480, 300, 0x05090d, 0.5);
    const frame = scene.add.rectangle(320, 171, 470, 296, 0x151b20, 0.98).setStrokeStyle(1, 0xa18a60);
    const inset = scene.add.rectangle(320, 171, 460, 286).setStrokeStyle(1, 0x363d3c, 0.8);
    const title = scene.add.text(320, 42, 'FEUERBOHREN', { fontFamily: FONT, fontSize: '18px', color: '#f4e3bf', letterSpacing: 2 }).setOrigin(0.5);
    const subtitle = scene.add.text(320, 61, 'Trockenes Holz. Ein ruhiger Rhythmus.', { fontFamily: FONT, fontSize: '11px', color: '#b8b6a3' }).setOrigin(0.5);
    const backdrop = scene.add.image(320, 130, 'bg-first-camp-evening').setDisplaySize(424, 238.5).setCrop(0, 100, 640, 163).setTint(0x8a7d8b);
    const dusk = scene.add.rectangle(320, 130, 424, 108, 0x101821, 0.32);
    const ground = scene.add.ellipse(320, 172, 178, 22, 0x090e11, 0.5);
    this.glow = [
      scene.add.ellipse(320, 166, 186, 58, 0xe67a29, 0),
      scene.add.ellipse(320, 165, 114, 30, 0xffb544, 0),
      scene.add.ellipse(320, 161, 55, 17, 0xffd86b, 0),
    ];
    const ring = scene.add.image(320, 172, 'camp-fire-ring-detailed').setDisplaySize(132, 66);
    const logs = scene.add.image(320, 164, 'camp-logs-detailed').setDisplaySize(77, 58);
    this.tinder = scene.add.graphics();
    this.tinder.lineStyle(1, 0xb89b61, 0.9);
    for (let i = 0; i < 11; i++) this.tinder.lineBetween(303 + i * 3, 166 + i % 3, 334 - i * 2, 157 + i % 5);
    this.smoke = Array.from({ length: 5 }, () => scene.add.ellipse(320, 151, 12, 8, 0xc2bcb0, 0));
    this.flame = scene.add.image(320, 165, 'camp-fire-detailed').setOrigin(0.5, 1).setDisplaySize(49, 90).setAlpha(0);
    this.sparks = Array.from({ length: 12 }, (_, i) => scene.add.rectangle(320, 158, i % 3 === 0 ? 2 : 1, 2, i % 2 === 0 ? 0xffd77b : 0xf28a38, 0));
    const spindleArt = scene.add.graphics();
    spindleArt.fillStyle(0x38261a).fillRect(-3, -40, 6, 43);
    spindleArt.fillStyle(0x9c7950).fillRect(-2, -40, 2, 41);
    spindleArt.fillStyle(0xb69a69).fillRect(-6, -43, 12, 5);
    spindleArt.lineStyle(3, 0x8a6341).lineBetween(-40, -16, -19, -24).lineBetween(-19, -24, 20, -24).lineBetween(20, -24, 41, -15);
    spindleArt.lineStyle(1, 0xd3c299).lineBetween(-40, -16, 41, -15);
    this.spindle = scene.add.container(320, 160, [spindleArt]);
    const vignette = scene.add.rectangle(320, 130, 424, 108).setStrokeStyle(1, 0x657064, 0.4);
    const track = scene.add.rectangle(320, 202, 326, 14, 0x293735).setStrokeStyle(1, 0x7e876a);
    this.band = scene.add.rectangle(320, 202, 124, 12, 0x6a8c54, 0.9);
    this.target = scene.add.text(320, 202, 'TREFFER', { fontFamily: FONT, fontSize: '9px', color: '#e4edc4' }).setOrigin(0.5);
    this.marker = scene.add.rectangle(157, 202, 3, 22, 0xffefbf).setStrokeStyle(1, 0x141b1d);
    this.pips = Array.from({ length: FIRE_HEAT_REQUIRED }, (_, i) => scene.add.rectangle(241 + i * 16, 222, 11, 5, 0x35413a).setStrokeStyle(1, 0x66705a, 0.5));
    this.heat = scene.add.text(386, 222, '', { fontFamily: FONT, fontSize: '11px', color: '#f0ce8c' }).setOrigin(0.5);
    this.instructions = scene.add.text(320, 243, '', { fontFamily: FONT, fontSize: '11px', color: '#e7dcc5', align: 'center' }).setOrigin(0.5);
    this.feedback = scene.add.text(320, 300, 'Sechs ruhige Schläge lassen Glut entstehen.', { fontFamily: FONT, fontSize: '11px', color: '#c5bda8', align: 'center' }).setOrigin(0.5);
    this.actionFrame = scene.add.rectangle(0, 0, 248, 32, 0x43553b).setStrokeStyle(1, 0xb0bd83).setInteractive({ useHandCursor: true });
    const actionText = scene.add.text(0, 0, 'Holz bohren (E / Tippen)', { fontFamily: FONT, fontSize: '13px', color: '#fff1d2' }).setOrigin(0.5);
    this.action = scene.add.container(264, 274, [this.actionFrame, actionText]);
    this.actionFrame.on('pointerover', () => { if (!this.finished) this.actionFrame.setFillStyle(0x576846); });
    this.actionFrame.on('pointerout', () => this.actionFrame.setFillStyle(this.finished ? 0x71502d : 0x43553b));
    this.actionFrame.on('pointerdown', (pointer: Phaser.Input.Pointer, x: number, y: number, event: Phaser.Types.Input.EventData) => {
      stop(pointer, x, y, event); if (!this.disposed && !this.finished) stroke();
    });
    const cancelButton = scene.add.rectangle(451, 274, 106, 32, 0x26332e).setStrokeStyle(1, 0x69776b).setInteractive({ useHandCursor: true });
    const cancelText = scene.add.text(451, 274, 'Pause (Esc)', { fontFamily: FONT, fontSize: '12px', color: '#d7d7c7' }).setOrigin(0.5);
    cancelButton.on('pointerdown', (pointer: Phaser.Input.Pointer, x: number, y: number, event: Phaser.Types.Input.EventData) => {
      stop(pointer, x, y, event); if (!this.disposed && !this.finished) cancel();
    });
    this.root = scene.add.container(0, 0, [veil, shadow, frame, inset, title, subtitle, backdrop, dusk, ground, ...this.glow, ring, logs, this.tinder, ...this.smoke, this.flame, ...this.sparks, this.spindle, vignette, track, this.band, this.target, this.marker, ...this.pips, this.heat, this.instructions, this.action, cancelButton, cancelText, this.feedback]).setDepth(1500).setScrollFactor(0);
    scene.events.once('shutdown', this.shutdown);
  }

  update(state: FireMinigameState) {
    if (this.disposed) return;
    const [start, end] = fireHitBand(state);
    this.band.setPosition(157 + (start + end) / 2 * 326, 202).setSize((end - start) * 326, 12);
    const marker = fireMarkerPosition(state);
    const inBand = marker >= start && marker <= end;
    this.marker.setPosition(157 + marker * 326, 202).setFillStyle(inBand ? 0xffefbf : 0xa6b5a7);
    this.target.setColor(inBand ? '#fff1c6' : '#e4edc4');
    this.pips.forEach((pip, i) => pip.setFillStyle(i < state.heat ? 0xe8a355 : 0x35413a));
    this.heat.setText(`Glut ${state.heat} / ${FIRE_HEAT_REQUIRED}`);
    this.instructions.setText(state.finished ? 'Die Glut greift auf die trockenen Zweige über.' : state.reducedMotion ? 'In Ruhe einzeln drücken oder tippen.\nJeder Schlag bringt mehr Wärme.' : 'Im grünen Feld drücken oder tippen.\nNach jedem Schlag kurz loslassen.');
    if (state.reducedMotion && !this.reducedMotion) this.resetStroke();
    this.reducedMotion = state.reducedMotion;
    this.finished = state.finished;
    const warmth = state.heat / FIRE_HEAT_REQUIRED;
    const motion = state.reducedMotion ? 0 : Math.sin(state.elapsedMs / 83) * 0.04 + Math.sin(state.elapsedMs / 137) * 0.025;
    this.glow.forEach((glow, i) => glow.setAlpha(warmth * (0.08 + i * 0.07) + (warmth > 0 ? motion * 0.16 : 0)));
    this.tinder.setAlpha(1 - warmth * 0.6);
    this.spindle.setVisible(!state.finished);
    // Early strokes produce a glowing nest; only strong embers sustain a flame.
    const flameStrength = Math.max(0, (state.heat - 3) / 3);
    this.flame.setDisplaySize(49 * (0.6 + flameStrength * 0.4 - motion), 90 * (0.18 + flameStrength * 0.82 + motion))
      .setAlpha(flameStrength > 0 ? 0.65 + flameStrength * 0.35 : 0);
    const particles = !state.reducedMotion && getSettings().particles && state.heat > 0;
    this.smoke.forEach((puff, i) => {
      const phase = (state.elapsedMs / 2400 + i / this.smoke.length) % 1;
      puff.setPosition(320 + Math.sin(phase * 5 + i) * (3 + phase * 10), 154 - phase * 62)
        .setScale(0.4 + phase * 1.8).setAlpha(particles ? Math.sin(phase * Math.PI) * warmth * 0.2 : 0);
    });
    this.sparks.forEach((spark, i) => {
      const phase = (state.elapsedMs / (820 + i * 51) + i / this.sparks.length) % 1;
      spark.setPosition(320 + Math.sin(i * 2.4) * phase * (14 + warmth * 20), 158 - phase * (24 + warmth * 62))
        .setAlpha(particles && i < 2 + state.heat * 1.5 ? (1 - phase) * warmth : 0);
    });
  }

  result(result: 'hit' | 'miss' | 'complete') {
    if (this.disposed) return;
    this.feedback.setText(result === 'miss' ? 'Etwas ruhiger. Warte auf das grüne Feld.' : result === 'complete' ? 'Glut! Die trockenen Zweige fangen Feuer.' : 'Gut! Der Zunder wird wärmer.');
    this.feedback.setColor(result === 'miss' ? '#e5b795' : '#f0ce8c');
    this.actionFrame.setFillStyle(result === 'complete' ? 0x71502d : 0x43553b);
    this.resetStroke();
    if (this.reducedMotion) return;
    this.scene.tweens.add({ targets: this.action, scaleX: 0.97, scaleY: 0.97, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
    if (result !== 'complete') this.scene.tweens.add({ targets: this.spindle, x: 325, y: 162, angle: 3, duration: 70, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    else this.scene.tweens.add({ targets: this.glow, scaleX: 1.18, scaleY: 1.18, duration: 280, yoyo: true, ease: 'Sine.easeInOut' });
  }

  private resetStroke() {
    this.scene.tweens.killTweensOf([this.action, this.spindle, ...this.glow]);
    this.action.setScale(1);
    this.glow.forEach(glow => glow.setScale(1));
    this.spindle.setPosition(320, 160).setAngle(0);
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.events.off('shutdown', this.shutdown);
    this.scene.tweens.killTweensOf([this.action, this.spindle, ...this.glow]);
    this.root.destroy();
  }
}

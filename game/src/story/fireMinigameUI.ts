import Phaser from 'phaser';
import { FONT } from '../ui';
import { FIRE_HEAT_REQUIRED, fireHitBand, fireMarkerPosition, type FireMinigameState } from './fireMinigame';

/** One action surface for mouse and touch; the background catches stray taps. */
export class FireMinigameUI {
  private root: Phaser.GameObjects.Container;
  private marker: Phaser.GameObjects.Rectangle;
  private heat: Phaser.GameObjects.Text;
  private feedback: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.Rectangle[];
  private band: Phaser.GameObjects.Rectangle;
  private instructions: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, stroke: () => void, cancel: () => void) {
    const stop = (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation();
    const veil = scene.add.rectangle(320, 180, 640, 360, 0x07100e, 0.32).setInteractive();
    veil.on('pointerdown', stop);
    const frame = scene.add.rectangle(320, 160, 388, 216, 0x14201d, 0.98).setStrokeStyle(1, 0x9f9674);
    const title = scene.add.text(320, 72, 'FEUERBOHREN', { fontFamily: FONT, fontSize: '17px', color: '#f0e3c6' }).setOrigin(0.5);
    this.instructions = scene.add.text(320, 99, '', { fontFamily: FONT, fontSize: '12px', color: '#e7dcc5', align: 'center' }).setOrigin(0.5);
    const track = scene.add.rectangle(320, 132, 294, 17, 0x28342f).setStrokeStyle(1, 0x81856b);
    this.band = scene.add.rectangle(320, 132, 112, 17, 0x719564, 0.85);
    const target = scene.add.text(320, 132, 'TREFFER', { fontFamily: FONT, fontSize: '9px', color: '#142417' }).setOrigin(0.5);
    this.marker = scene.add.rectangle(173, 132, 4, 25, 0xffefbf);
    this.pips = Array.from({ length: FIRE_HEAT_REQUIRED }, (_, i) => scene.add.rectangle(250 + i * 28, 158, 20, 7, 0x35413a));
    this.heat = scene.add.text(320, 173, '', { fontFamily: FONT, fontSize: '11px', color: '#f0ce8c' }).setOrigin(0.5);
    this.feedback = scene.add.text(320, 194, 'Sechs ruhige Schläge lassen Glut entstehen.', { fontFamily: FONT, fontSize: '12px', color: '#dfd5bd', align: 'center' }).setOrigin(0.5);
    const action = scene.add.rectangle(267, 236, 238, 36, 0x445a40).setStrokeStyle(1, 0xaabd87).setInteractive({ useHandCursor: true });
    const actionText = scene.add.text(267, 236, 'Holz bohren (E / Tippen)', { fontFamily: FONT, fontSize: '13px', color: '#fff1d2' }).setOrigin(0.5);
    action.on('pointerdown', (pointer: Phaser.Input.Pointer, x: number, y: number, event: Phaser.Types.Input.EventData) => {
      stop(pointer, x, y, event); stroke();
    });
    const cancelButton = scene.add.rectangle(448, 236, 100, 36, 0x26332e).setStrokeStyle(1, 0x69776b).setInteractive({ useHandCursor: true });
    const cancelText = scene.add.text(448, 236, 'Pause (Esc)', { fontFamily: FONT, fontSize: '12px', color: '#d7d7c7' }).setOrigin(0.5);
    cancelButton.on('pointerdown', (pointer: Phaser.Input.Pointer, x: number, y: number, event: Phaser.Types.Input.EventData) => {
      stop(pointer, x, y, event); cancel();
    });
    this.root = scene.add.container(0, 0, [veil, frame, title, this.instructions, track, this.band, target, this.marker, ...this.pips, this.heat, this.feedback, action, actionText, cancelButton, cancelText]).setDepth(1500).setScrollFactor(0);
  }

  update(state: FireMinigameState) {
    const [start, end] = fireHitBand(state);
    this.band.setPosition(173 + (start + end) / 2 * 294, 132).setSize((end - start) * 294, 17);
    const marker = fireMarkerPosition(state);
    this.marker.setPosition(173 + marker * 294, 132).setFillStyle(marker >= start && marker <= end ? 0xffefbf : 0xa6b5a7);
    this.pips.forEach((pip, i) => pip.setFillStyle(i < state.heat ? 0xe8a355 : 0x35413a));
    this.heat.setText(`Glut: ${state.heat} / ${FIRE_HEAT_REQUIRED}`);
    this.instructions.setText(state.reducedMotion ? 'In Ruhe sechsmal drücken oder tippen.\nJeder einzelne Schlag bringt mehr Wärme.' : 'Drücke oder tippe, wenn der Strich im grünen Feld ist.\nNach jedem Schlag kurz loslassen.');
  }

  result(result: 'hit' | 'miss' | 'complete') {
    this.feedback.setText(result === 'miss' ? 'Etwas ruhiger. Warte auf das grüne Feld.' : result === 'complete' ? 'Glut! Die trockenen Zweige fangen Feuer.' : 'Gut! Der Zunder wird wärmer.');
    this.feedback.setColor(result === 'miss' ? '#e5b795' : '#f0ce8c');
  }

  destroy() { this.root.destroy(); }
}

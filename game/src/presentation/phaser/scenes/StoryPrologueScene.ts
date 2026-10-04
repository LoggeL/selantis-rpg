import Phaser from 'phaser';
import { StoryCloseup } from "../StoryCloseup";
import { usesMobileInterface } from "../../dom/dialogs";

import { PROLOGUE_CARDS } from "../../../content/chapters/prologue/cards";
export { PROLOGUE_CARDS } from "../../../content/chapters/prologue/cards";
import { bindSceneInput } from "../../../platform/input/router";
import { SequenceRunner } from "../../../modules/narrative/sequence";

/** Four reading cards introduce the source story before the playable battle. */
export class StoryPrologueScene extends Phaser.Scene {
  private closeup!: StoryCloseup;
  private progress!: Phaser.GameObjects.Text;
  private attribution!: Phaser.GameObjects.Text;
  private index = 0;
  private sequence?: SequenceRunner<typeof PROLOGUE_CARDS[number]>;
  private leaving = false;
  private mobileLayout = false;

  constructor() { super('storyprologue'); }

  create() {
    this.index = 0;
    this.leaving = false;
    this.cameras.main.setBackgroundColor('#07080a');
    this.data.set('mobile:hudVisible', false);
    this.closeup = new StoryCloseup(this, { additionalActions: { ESC: 'Überspringen' } });
    this.progress = this.add.text(18, 16, '', {
      fontFamily: 'Pixelify Sans, monospace', fontSize: '14px', color: '#f4ecd8',
      backgroundColor: '#101b17', padding: { x: 6, y: 4 },
    }).setDepth(1200);
    this.attribution = this.add.text(18, 44, '', {
      fontFamily: 'Pixelify Sans, monospace', fontSize: '12px', color: '#f4ecd8',
      backgroundColor: '#101b17', padding: { x: 6, y: 3 },
    }).setDepth(1200);
    const skip = this.add.text(622, 16, 'Überspringen', {
      fontFamily: 'Pixelify Sans, monospace', fontSize: '14px', color: '#f4ecd8',
      backgroundColor: '#101b17', padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setDepth(1200).setInteractive({ useHandCursor: true });
    skip.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); this.beginBattle();
    });
    const advance = (intent: { phase: string }) => { if (intent.phase !== 'end' && !this.leaving) this.closeup.advance(); };
    bindSceneInput(this, {
      interact: advance, continue: advance, wait: advance, confirm: advance,
      cancel: intent => { if (intent.phase !== 'end') this.beginBattle(); },
    });
    this.events.once('shutdown', () => {
      this.leaving = true;
      this.sequence?.dispose();
      this.closeup.destroy();
    });
    this.sequence = new SequenceRunner(PROLOGUE_CARDS, {
      enter: (_card, index, ready) => { this.index = index; this.showCard(); ready(); },
      complete: () => this.beginBattle(),
    });
    this.sequence.start();
  }

  private showCard() {
    const card = PROLOGUE_CARDS[this.index];
    this.progress.setText(`${this.index + 1} / ${PROLOGUE_CARDS.length} · ${card.title}`);
    this.attribution.setText(card.attribution).setVisible(!!card.attribution);
    this.data.set('story:prologue', { index: this.index, id: card.id, total: PROLOGUE_CARDS.length });
    this.showIllustration();
    this.closeup.setText(card.text);
    this.closeup.setContinue(this.sequence!.continuation(), this.index === PROLOGUE_CARDS.length - 1 ? 'Schlacht beginnen' : 'Weiter');
  }

  private showIllustration() {
    this.mobileLayout = usesMobileInterface();
    this.closeup.show(PROLOGUE_CARDS[this.index].art, { fit: 'contain', height: this.mobileLayout ? 360 : 220 });
  }

  private beginBattle() {
    if (this.leaving) return;
    this.leaving = true;
    this.sequence?.cancel();
    this.closeup.hide();
    this.scene.start('battle');
  }

  update() {
    if (!this.leaving && this.mobileLayout !== usesMobileInterface()) this.showIllustration();
    this.closeup?.update();
  }
}

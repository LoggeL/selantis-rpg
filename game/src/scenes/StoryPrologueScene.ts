import Phaser from 'phaser';
import { StoryCloseup } from '../story/closeups';
import { usesMobileInterface } from '../mobileDialogs';

/** Novel pages 51–52 for the factions; page 3 for the moment before battle.
 * The council's protection of the Urmacht and the four masters' claim follow
 * the film prologue and Ignatius' explanation (episode 2, 16:57–17:09).
 * The intro ends before the historical battle, without showing its outcome. */
export const PROLOGUE_CARDS = [
  { id: 'power', art: 'prologue-power', title: 'Der gespaltene Rat',
    attribution: '',
    text: 'Der Rat der Zehn wacht über die Urmacht, damit niemand sie für eigene Zwecke nutzt. Vier Zaubermeister wollen sie für sich gewinnen. Die sechs anderen stellen sich ihnen entgegen.' },
  { id: 'conflict', art: 'prologue-conflict', title: 'Die verfeindeten Mächte',
    attribution: 'Nach Foltans Bericht',
    text: 'Aus dem Streit um die Urmacht wird Krieg. Die Fürsten unterstützen die sechs ratstreuen Meister, um ihr Herrschaftsrecht zu schützen. Die vier abtrünnigen Magier haben Räuber, Söldner und bewaffnete Bauern hinter sich versammelt.' },
  { id: 'falken', art: 'prologue-falken', title: 'Vor Dunkelhain', attribution: '',
    text: 'Auf dem Hügel stehen die Paladine des Lichts, Ebarils achte und elfte Brigade und die Falken aus Portas. Am Fuß des Hangs wartet das schwarz gekleidete Heer.' },
  { id: 'valentus', art: 'prologue-valentus-ready', title: 'Valentus', attribution: '',
    text: 'Der Magier Valentus steht vor den Reihen der Verbündeten. Der Wind zerrt an seiner blau-weißen Robe. Vor ihm wartet das feindliche Heer. Gleich beginnt die Schlacht.' },
] as const;

/** Four reading cards introduce the source story before the playable battle. */
export class StoryPrologueScene extends Phaser.Scene {
  private closeup!: StoryCloseup;
  private progress!: Phaser.GameObjects.Text;
  private attribution!: Phaser.GameObjects.Text;
  private index = 0;
  private leaving = false;
  private mobileLayout = false;

  constructor() { super('storyprologue'); }

  create() {
    this.index = 0;
    this.leaving = false;
    this.cameras.main.setBackgroundColor('#07080a');
    this.data.set('mobile:hudVisible', false);
    this.closeup = new StoryCloseup(this);
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
    const keys = this.input.keyboard!;
    const bindings = ['E', 'SPACE', 'ENTER'].map(name => {
      const key = keys.addKey(name);
      const advance = () => { if (!this.leaving) this.closeup.advance(); };
      key.on('down', advance);
      return { key, advance };
    });
    const escape = keys.addKey('ESC');
    const skipByKey = () => this.beginBattle();
    escape.on('down', skipByKey);
    this.events.once('shutdown', () => {
      this.leaving = true;
      for (const { key, advance } of bindings) key.off('down', advance);
      escape.off('down', skipByKey);
      this.closeup.destroy();
    });
    this.showCard();
  }

  private showCard() {
    const card = PROLOGUE_CARDS[this.index];
    this.progress.setText(`${this.index + 1} / ${PROLOGUE_CARDS.length} · ${card.title}`);
    this.attribution.setText(card.attribution).setVisible(!!card.attribution);
    this.data.set('story:prologue', { index: this.index, id: card.id, total: PROLOGUE_CARDS.length });
    this.showIllustration();
    this.closeup.setText(card.text);
    this.closeup.setContinue(() => {
      if (this.leaving) return;
      if (++this.index === PROLOGUE_CARDS.length) this.beginBattle();
      else this.showCard();
    }, this.index === PROLOGUE_CARDS.length - 1 ? 'Schlacht beginnen' : 'Weiter');
    this.syncSkipControl();
  }

  private showIllustration() {
    this.mobileLayout = usesMobileInterface();
    this.closeup.show(PROLOGUE_CARDS[this.index].art, { fit: 'contain', height: this.mobileLayout ? 360 : 220 });
  }

  private syncSkipControl() {
    const controls = this.data.get('mobile:controls');
    if (controls && controls.actions.ESC !== 'Überspringen') {
      this.data.set('mobile:controls', { ...controls, actions: { ...controls.actions, ESC: 'Überspringen' } });
    }
  }

  private beginBattle() {
    if (this.leaving) return;
    this.leaving = true;
    this.closeup.hide();
    this.scene.start('battle');
  }

  update() {
    if (!this.leaving && this.mobileLayout !== usesMobileInterface()) this.showIllustration();
    this.closeup?.update();
    this.syncSkipControl();
  }
}

import Phaser from 'phaser';
import { StoryCloseup } from '../story/closeups';
import { usesMobileInterface } from '../mobileDialogs';

/** Novel pages 51–52 for Foltan's report; pages 1–6 for the flight and fever dream. */
export const PROLOGUE_CARDS = [
  { id: 'power', art: 'prologue-power', title: 'Der gespaltene Rat',
    attribution: 'Nach Foltans Bericht',
    text: 'Sechs Zaubermeister im Rat der Zehn hielten zur bestehenden Ordnung, vier waren abtrünnig. Die Fürsten unterstützten die Sechs, auch um ihr eigenes Herrschaftsrecht zu schützen.' },
  { id: 'conflict', art: 'prologue-conflict', title: 'Ein zerbrochenes Land',
    attribution: 'Nach Foltans Bericht',
    text: 'Nach der Niederlage zerbrach der Rat. Zwei abtrünnige Zaubermeister überlebten. Die Fürsten zogen sich in ihre Städte zurück, während die Dunkelschatten das Land verheeren. Eine gemeinsame Ordnung fehlt.' },
  { id: 'falken', art: 'prologue-falken', title: 'Die Schlacht von Dunkelhain', attribution: '',
    text: 'In Valentus’ Fiebertraum kämpfen die Paladine des Lichts, Ebarils achte und elfte Brigade und die Falken aus Portas auf seiner Seite. Ihnen gegenüber zieht ein schwarz gekleidetes Heer auf.' },
  { id: 'valentus', art: 'prologue-valentus', title: 'Der gejagte Magier', attribution: '',
    text: 'Valentus flieht schwer verletzt vor seinen Verfolgern. Er will verhindern, dass seine letzte Hoffnung für Selantis in ihre Hände fällt. Im Fiebertraum kehrt er in die Schlacht zurück.' },
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

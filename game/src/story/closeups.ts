import type Phaser from 'phaser';
import { usesMobileInterface } from '../mobileDialogs';
import { FONT } from '../ui';

export type CloseupOptions = {
  y?: number;
  height?: number;
  shade?: number;
};

/** Illustrated actor shots and one reading action, independent of map coordinates. */
export class StoryCloseup {
  private readonly art: Phaser.GameObjects.Container;
  private readonly image: Phaser.GameObjects.Image;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly caption: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;
  private readonly continueText: Phaser.GameObjects.Text;
  private readonly continueZone: Phaser.GameObjects.Zone;
  private captionOpen = false;
  private continuation?: () => void;
  private continueLabel = 'Weiter';
  private previousControls: unknown;
  private controlsOwned = false;
  private textureKey?: string;
  private options: CloseupOptions = {};
  private mobileLayout?: boolean;

  constructor(private readonly scene: Phaser.Scene) {
    const backdrop = scene.add.rectangle(320, 180, 640, 360, 0x080e0d);
    this.image = scene.add.image(0, 0, '__WHITE').setOrigin(0);
    this.shade = scene.add.rectangle(320, 132, 640, 264, 0x07100c, 0);
    const blocker = scene.add.zone(320, 180, 640, 360).setInteractive();
    blocker.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    this.art = scene.add.container(0, 0, [backdrop, this.image, this.shade, blocker])
      .setDepth(900).setScrollFactor(0).setVisible(false);

    const panel = scene.add.rectangle(320, 300, 600, 64, 0x101b17, 0.96).setStrokeStyle(1, 0xafa083);
    this.text = scene.add.text(34, 277, '', {
      fontFamily: FONT, fontSize: '13px', color: '#f4ecd8', wordWrap: { width: 470 }, lineSpacing: 3,
    });
    this.continueText = scene.add.text(562, 299, '…', {
      fontFamily: FONT, fontSize: '12px', color: '#e8d5ac', align: 'center',
    }).setOrigin(0.5);
    this.continueZone = scene.add.zone(562, 299, 100, 58).setInteractive({ useHandCursor: true });
    this.continueZone.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.advance();
    });
    this.caption = scene.add.container(0, 0, [panel, this.text, this.continueText, this.continueZone])
      .setDepth(1010).setScrollFactor(0).setVisible(false);
  }

  get visible() { return this.art.visible; }
  get hasCaption() { return this.captionOpen; }

  show(textureKey: string, options: CloseupOptions = {}) {
    if (!this.scene.textures.exists(textureKey)) { this.art.setVisible(false); return; }
    this.textureKey = textureKey;
    this.options = { ...options };
    this.layout();
    this.art.setVisible(true);
  }

  private layout() {
    if (!this.textureKey) return;
    const options = this.options;
    const source = this.scene.textures.get(this.textureKey).getSourceImage();
    const scale = 640 / source.width;
    this.mobileLayout = usesMobileInterface();
    const y = Math.max(0, Math.min(359, options.y ?? 0));
    const height = Math.max(1, Math.min(360 - y, options.height ?? (this.mobileLayout ? 360 : 264)));
    this.image.setTexture(this.textureKey).setPosition(0, y).setScale(scale);
    this.image.setCrop(0, 0, source.width, Math.min(source.height, height / scale));
    this.shade.setPosition(320, y + height / 2).setSize(640, height).setAlpha(Math.max(0, Math.min(1, options.shade ?? 0)));
  }

  setText(text: string) {
    this.captionOpen = !!text;
    this.text.setText(text);
    this.scene.data.set({ 'mobile:dialogue': text, 'mobile:thought': text, 'mobile:thoughtUntil': Number.MAX_SAFE_INTEGER });
    this.update();
  }

  setContinue(callback: (() => void) | null, label = 'Weiter') {
    if (!this.controlsOwned) {
      this.previousControls = this.scene.data.get('mobile:controls');
      this.controlsOwned = true;
    }
    this.continuation = callback ?? undefined;
    this.continueLabel = label;
    this.continueText.setText(callback ? `[E] ${label}` : '…').setAlpha(callback ? 1 : 0.4);
    this.scene.data.set('mobile:controls', { directions: [], actions: { E: label }, inventory: false, disabled: !callback });
  }

  advance() {
    const next = this.continuation;
    if (!next) return;
    this.setContinue(null, this.continueLabel);
    next();
  }

  update() {
    const mobile = usesMobileInterface();
    if (this.art.visible && this.mobileLayout !== mobile) this.layout();
    this.caption.setVisible(this.captionOpen && !mobile);
  }

  hide() {
    this.art.setVisible(false);
    this.captionOpen = false;
    this.caption.setVisible(false);
    this.continuation = undefined;
    this.scene.data.set({ 'mobile:dialogue': '', 'mobile:thought': '', 'mobile:thoughtUntil': 0 });
    if (this.controlsOwned) this.scene.data.set('mobile:controls', this.previousControls ?? null);
    this.controlsOwned = false;
    this.previousControls = undefined;
  }

  destroy() { this.art.destroy(); this.caption.destroy(); }
}

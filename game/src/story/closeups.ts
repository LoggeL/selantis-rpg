import type Phaser from 'phaser';
import { usesMobileInterface } from '../mobileDialogs';
import { Dialogue } from '../dialogue';

export type CloseupOptions = {
  y?: number;
  height?: number;
  shade?: number;
  fit?: 'contain';
};

/** Illustrated actor shots and one reading action, independent of map coordinates. */
export class StoryCloseup {
  private readonly art: Phaser.GameObjects.Container;
  private readonly image: Phaser.GameObjects.Image;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly dialogue: Dialogue;
  private textureKey?: string;
  private options: CloseupOptions = {};
  private mobileLayout?: boolean;

  constructor(private readonly scene: Phaser.Scene) {
    const backdrop = scene.add.rectangle(320, 180, 640, 360, 0x080e0d);
    this.image = scene.add.image(0, 0, '__WHITE').setOrigin(0);
    this.shade = scene.add.rectangle(320, 132, 640, 264, 0x07100c, 0);
    const blocker = scene.add.zone(320, 180, 640, 360).setInteractive();
    blocker.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.advance(); });
    this.art = scene.add.container(0, 0, [backdrop, this.image, this.shade, blocker])
      .setDepth(900).setScrollFactor(0).setVisible(false);

    this.dialogue = new Dialogue(scene, { depth: 1010 });
  }

  get visible() { return this.art.visible; }
  get hasCaption() { return this.dialogue.visible; }

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
    this.mobileLayout = usesMobileInterface();
    const y = Math.max(0, Math.min(359, options.y ?? 0));
    const height = Math.max(1, Math.min(360 - y, options.height ?? (this.mobileLayout ? 360 : 264)));
    const scale = options.fit === 'contain' ? Math.min(640 / source.width, height / source.height) : 640 / source.width;
    this.image.setTexture(this.textureKey).setScale(scale);
    if (options.fit === 'contain') {
      this.image.setPosition((640 - source.width * scale) / 2, y + (height - source.height * scale) / 2);
      this.image.setCrop();
    } else {
      this.image.setPosition(0, y);
      this.image.setCrop(0, 0, source.width, Math.min(source.height, height / scale));
    }
    this.shade.setPosition(320, y + height / 2).setSize(640, height).setAlpha(Math.max(0, Math.min(1, options.shade ?? 0)));
  }

  setText(text: string) { this.dialogue.setText(text); }

  setContinue(callback: (() => void) | null, label = 'Weiter') { this.dialogue.setContinue(callback, label); }

  advance() { this.dialogue.advance(); }

  update() {
    const mobile = usesMobileInterface();
    if (this.art.visible && this.mobileLayout !== mobile) this.layout();
    this.dialogue.update();
  }

  hide() { this.art.setVisible(false); this.dialogue.hide(); }

  destroy() { this.art.destroy(); this.dialogue.destroy(); }
}

import type Phaser from 'phaser';
import { sfx } from './audio';
import { usesMobileInterface } from './mobileDialogs';
import { getSettings, subscribeSettings } from './settings';
import { parseDialogue, resolvePortrait, type DialogueEmotion } from './portraits';

const FONT = 'Pixelify Sans, monospace';
const LETTER_MS = 28;

export type DialogueOptions = {
  depth?: number;
  layer?: Phaser.GameObjects.Layer;
  manageControls?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
};

/** A scene-clock reader: one press reveals the line, the following press continues. */
export class Dialogue {
  readonly container: Phaser.GameObjects.Container;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly portraitCard: Phaser.GameObjects.Container;
  private readonly name: Phaser.GameObjects.Text;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly panelBack: Phaser.GameObjects.Rectangle;
  private readonly panelZone: Phaser.GameObjects.Zone;
  private readonly text: Phaser.GameObjects.Text;
  private readonly cue: Phaser.GameObjects.Text;
  private letters: string[] = [];
  private hasPortrait = false;
  private revealed = 0;
  private timer?: Phaser.Time.TimerEvent;
  private continuation?: () => void;
  private continueLabel = 'Weiter';
  private controlsOwned = false;
  private previousControls: unknown;
  private destroyed = false;
  private readonly unsubscribe: () => void;
  private readonly onUpdate = () => this.update();
  private readonly onShutdown = () => this.destroy();

  constructor(private readonly scene: Phaser.Scene, private readonly options: DialogueOptions = {}) {
    const frame = scene.add.rectangle(0, 0, 100, 112, 0x101713, 0.98).setStrokeStyle(2, 0xafa083);
    this.portrait = scene.add.image(0, -5, '__WHITE');
    const nameShade = scene.add.rectangle(0, 40, 96, 28, 0x080e0b, 0.94);
    this.name = scene.add.text(0, 40, '', { fontFamily: FONT, fontSize: '14px', color: '#f4e5bd', align: 'center', wordWrap: { width: 92 } }).setOrigin(0.5);
    this.portraitCard = scene.add.container(66, 206, [frame, this.portrait, nameShade, this.name]);
    this.panelBack = scene.add.rectangle(320, 304, 608, 88, 0x101b17, 0.97).setStrokeStyle(2, 0xafa083);
    this.text = scene.add.text(32, 271, '', { fontFamily: FONT, fontSize: '16px', color: '#f4ecd8', wordWrap: { width: 568 }, lineSpacing: 3 });
    this.cue = scene.add.text(604, 340, '', { fontFamily: FONT, fontSize: '11px', color: '#e8d5ac' }).setOrigin(1, 0.5);
    this.panelZone = scene.add.zone(320, 304, 608, 88).setInteractive({ useHandCursor: true });
    this.panelZone.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); this.advance();
    });
    this.panel = scene.add.container(0, 0, [this.panelBack, this.text, this.cue, this.panelZone]);
    this.container = scene.add.container(0, 0, [this.panel, this.portraitCard]).setDepth(options.depth ?? 1100).setScrollFactor(0).setVisible(false);
    options.layer?.add(this.container);
    this.unsubscribe = subscribeSettings(settings => { if (settings.reducedMotion && this.isTyping) this.finishTyping(); });
    scene.events.on('update', this.onUpdate);
    scene.events.once('shutdown', this.onShutdown);
  }

  get visible() { return this.container.visible; }
  get isTyping() { return this.revealed < this.letters.length; }

  setText(rawText: string, speakerName?: string, emotion?: DialogueEmotion) {
    this.timer?.remove(false);
    this.timer = undefined;
    const parsed = parseDialogue(rawText);
    const name = speakerName ?? parsed.name;
    // These descriptions identify the right face before the strangers introduce
    // themselves, while the reader only sees that their names are still unknown.
    const displayName = name && /^(der schmale|der dicke)$/i.test(name) ? '???' : name;
    this.letters = Array.from(parsed.text);
    this.revealed = getSettings().reducedMotion ? this.letters.length : 0;
    this.continuation = undefined;
    this.continueLabel = 'Weiter';
    const portrait = name && resolvePortrait(this.scene, name, emotion);
    this.hasPortrait = !!name && !!portrait;
    if (portrait) {
      this.portrait.setTexture(portrait.texture, portrait.frame).setDisplaySize(96, 96);
    }
    this.name.setText(displayName ?? '');
    const visible = !!parsed.text;
    // Measure the whole line before revealing letters, so the panel never jumps
    // while typing and long wrapped dialogue has room above the continue cue.
    this.text.setText(parsed.text);
    const height = Math.max(88, this.text.height + 44);
    this.panelBack.setPosition(320, 348 - height / 2).setSize(608, height);
    this.panelZone.setPosition(320, 348 - height / 2).setSize(608, height);
    this.text.setPosition(32, 348 - height + 12);
    this.portraitCard.setPosition(66, 348 - height - 54);
    this.container.setVisible(visible);
    this.options.onVisibilityChange?.(visible);
    this.scene.data.set({
      'dialogue:active': visible, 'dialogue:speaker': displayName ?? '', 'dialogue:identity': name ?? '', 'dialogue:complete': '', 'dialogue:fullText': parsed.text,
      'dialogue:portraitSrc': portrait && portrait.src ? `${import.meta.env.BASE_URL}${portrait.src}` : '',
      'dialogue:emotion': emotion ?? '',
    });
    this.render();
    if (this.isTyping) this.timer = this.scene.time.addEvent({ delay: LETTER_MS, loop: true, callback: () => this.tick() });
    this.update();
  }

  setContinue(callback: (() => void) | null, label = 'Weiter') {
    this.continuation = callback ?? undefined;
    this.continueLabel = label;
    this.syncControls();
  }

  private tick() {
    if (!this.visible || this.destroyed) return;
    this.revealed = Math.min(this.letters.length, this.revealed + 1);
    const letter = this.letters[this.revealed - 1];
    if (this.revealed % 3 === 0 && /[\p{L}\p{N}]/u.test(letter)) sfx.dialogue();
    if (!this.isTyping) { this.timer?.remove(false); this.timer = undefined; }
    this.render();
  }

  finishTyping() {
    this.timer?.remove(false); this.timer = undefined;
    this.revealed = this.letters.length;
    this.render();
  }

  /** Returns whether the reader consumed the input, even during an action lock. */
  advance(): boolean {
    if (!this.visible) return false;
    if (this.isTyping) { this.finishTyping(); return true; }
    const next = this.continuation;
    if (next) {
      this.continuation = undefined;
      this.syncControls();
      next();
    }
    return true;
  }

  private render() {
    const visible = this.letters.slice(0, this.revealed).join('');
    this.text.setText(visible);
    this.scene.data.set({ 'mobile:dialogue': visible, 'dialogue:typing': this.isTyping });
    if (!this.isTyping) this.scene.data.set('dialogue:complete', this.letters.join(''));
    this.syncControls();
  }

  private syncControls() {
    this.cue.setText(this.isTyping ? '[E] Lesen' : this.continuation ? `[E] ${this.continueLabel}` : '…');
    if (!this.visible || this.options.manageControls === false) return;
    if (!this.controlsOwned) { this.previousControls = this.scene.data.get('mobile:controls'); this.controlsOwned = true; }
    this.scene.data.set('mobile:controls', { directions: [], actions: { E: this.isTyping ? 'Text zeigen' : this.continueLabel }, inventory: false, disabled: !this.isTyping && !this.continuation });
  }

  update() {
    const desktop = !usesMobileInterface();
    this.panel.setVisible(this.visible && desktop);
    this.portraitCard.setVisible(this.visible && this.hasPortrait && desktop);
  }

  hide() {
    if (this.destroyed) return;
    this.timer?.remove(false); this.timer = undefined;
    this.letters = []; this.revealed = 0; this.continuation = undefined;
    this.container.setVisible(false);
    this.scene.data.set({ 'mobile:dialogue': '', 'dialogue:active': false, 'dialogue:typing': false, 'dialogue:complete': '', 'dialogue:fullText': '', 'dialogue:speaker': '', 'dialogue:identity': '', 'dialogue:portraitSrc': '', 'dialogue:emotion': '' });
    if (this.controlsOwned) this.scene.data.set('mobile:controls', this.previousControls ?? null);
    this.controlsOwned = false; this.previousControls = undefined;
    this.options.onVisibilityChange?.(false);
  }

  destroy() {
    if (this.destroyed) return;
    this.hide(); this.destroyed = true; this.unsubscribe();
    this.scene.events.off('update', this.onUpdate);
    this.scene.events.off('shutdown', this.onShutdown);
    this.container.destroy();
  }
}

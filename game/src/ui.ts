import Phaser from 'phaser';
import { getSettings, motionDuration, subscribeSettings, toggleSettings } from './settings';
import { usesMobileInterface } from './mobileDialogs';
import { Dialogue } from './dialogue';
import { parseDialogue } from './portraits';
import { openCharacterStats } from './characterStats';

export const FONT = 'Pixelify Sans, monospace';

type Ability = { icon: string; key: string; onClick: () => void };

/** Sparsames HUD: Portrait, Lebensbalken, Fähigkeiten, eine Hinweiszeile, Gedankenstimme. */
export class Hud {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private hp: Phaser.GameObjects.Rectangle;
  private hintText: Phaser.GameObjects.Text;
  private thoughtText: Phaser.GameObjects.Text;
  private abilities: { name: string; box: Phaser.GameObjects.Container; frame: Phaser.GameObjects.Rectangle; onClick: () => void }[] = [];
  private abilityBar: Phaser.GameObjects.Container;
  private protect?: Phaser.GameObjects.Container;
  private thoughtTimer?: Phaser.Time.TimerEvent;
  private disabled = false;
  private abilitiesVisible = true;
  private thoughtsVisible = true;
  private cinematic = false;
  private settingsObjects: Phaser.GameObjects.GameObject[] = [];
  private settingsTooltip?: Phaser.GameObjects.Text;
  private syncLayout = () => {};
  private dialogue?: Dialogue;
  private dialogueOpen = false;

  constructor(scene: Phaser.Scene, portrait: string, name: string, private readonly options: { dialogueLayer?: Phaser.GameObjects.Layer } = {}) {
    this.scene = scene;
    scene.data.set({ 'mobile:name': name, 'mobile:portrait': portrait, 'mobile:hp': 1, 'mobile:hudVisible': true, 'mobile:hint': '', 'mobile:thought': '', 'mobile:thoughtUntil': 0, 'mobile:abilities': [], 'mobile:disabled': false, 'mobile:selected': null });
    const frame = scene.add.rectangle(6, 6, 52, 52, 0x14171b).setOrigin(0).setStrokeStyle(2, 0x8a7a5a);
    const img = scene.add.image(8, 8, portrait).setOrigin(0).setDisplaySize(48, 48);
    img.setInteractive({ useHandCursor: true }).on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); openCharacterStats(scene.game);
    });
    const label = scene.add.text(64, 8, name, { fontFamily: FONT, fontSize: '11px', color: '#e8e2d0', stroke: '#0d0f12', strokeThickness: 3 });
    const hpBack = scene.add.rectangle(64, 26, 90, 6, 0x2a1416).setOrigin(0).setStrokeStyle(1, 0x0d0f12);
    this.hp = scene.add.rectangle(65, 27, 88, 4, 0xb8403a).setOrigin(0);
    this.root = scene.add.container(0, 0, [frame, img, label, hpBack, this.hp]).setDepth(1000).setScrollFactor(0);
    this.abilityBar = scene.add.container(320, 330).setDepth(1000).setScrollFactor(0);
    const mobileMode = window.matchMedia('(any-pointer: coarse), (max-width: 900px)');
    const syncAbilities = () => {
      const mobile = usesMobileInterface();
      const cinematic = this.cinematic || this.dialogueOpen;
      this.root.setVisible(!cinematic && !mobile);
      this.abilityBar.setVisible(this.abilitiesVisible && !mobile && !cinematic);
      this.hintText?.setVisible(!mobile && !cinematic);
      this.thoughtText?.setVisible(this.thoughtsVisible && !mobile && !cinematic);
      this.protect?.setVisible(!cinematic);
      for (const object of this.settingsObjects) (object as Phaser.GameObjects.Graphics).setVisible(!cinematic);
      if (cinematic) this.settingsTooltip?.setVisible(false);
    };
    this.syncLayout = syncAbilities;
    mobileMode.addEventListener('change', syncAbilities);
    syncAbilities();
    this.hintText = scene.add.text(320, 352, '', { fontFamily: FONT, fontSize: '10px', color: '#e8e2d0', stroke: '#0d0f12', strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(1000).setScrollFactor(0);
    this.thoughtText = scene.add.text(320, 70, '', { fontFamily: FONT, fontSize: '11px', color: '#cfe0f4', stroke: '#0d0f12', strokeThickness: 3, fontStyle: 'italic', wordWrap: { width: 520 }, align: 'center' })
      .setOrigin(0.5).setDepth(1000).setAlpha(0).setScrollFactor(0);
    syncAbilities();
    // A tiny corner control; keyboard O is available even in scenes without a HUD.
    const gear = scene.add.graphics().setScrollFactor(0).setDepth(1001);
    gear.lineStyle(2, 0xaaa68f);
    gear.strokeCircle(622, 340, 4);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      gear.lineBetween(622 + Math.cos(a) * 6, 340 + Math.sin(a) * 6, 622 + Math.cos(a) * 8, 340 + Math.sin(a) * 8);
    }
    const control = scene.add.zone(622, 340, 24, 24).setScrollFactor(0).setDepth(1002).setInteractive({ useHandCursor: true });
    const tooltip = scene.add.text(606, 318, 'Einstellungen  O', { fontFamily: FONT, fontSize: '10px', color: '#e8e2d0', backgroundColor: '#14171b' }).setOrigin(1, 0.5).setDepth(1002).setScrollFactor(0).setVisible(false);
    this.settingsObjects = [gear, control];
    this.settingsTooltip = tooltip;
    control.on('pointerover', () => tooltip.setVisible(true));
    control.on('pointerout', () => tooltip.setVisible(false));
    control.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); tooltip.setVisible(false); toggleSettings(scene.game); });
    const unsubscribe = subscribeSettings((settings) => {
      if (!settings.reducedMotion) return;
      for (const a of this.abilities) { scene.tweens.killTweensOf(a.box); a.box.setScale(1); }
      const shield = this.protect?.list[2] as Phaser.GameObjects.Image | undefined;
      if (shield) { scene.tweens.killTweensOf(shield); shield.setScale(1); }
    });
    scene.events.once('shutdown', () => { unsubscribe(); mobileMode.removeEventListener('change', syncAbilities); this.dialogue?.destroy(); });
  }

  setPortrait(key: string) {
    (this.root.list[1] as Phaser.GameObjects.Image).setTexture(key).setDisplaySize(48, 48);
    this.scene.data.set('mobile:portrait', key);
  }
  /** Restore the existing gameplay state when the shot closes. */
  setCinematic(cinematic: boolean) {
    this.cinematic = cinematic;
    this.scene.data.set('mobile:hudVisible', !cinematic && !this.dialogueOpen);
    this.syncLayout();
  }
  get dialogueVisible() { return this.dialogue?.visible ?? false; }
  advanceDialogue() { return this.dialogue?.visible ? this.dialogue.advance() : false; }
  setHp(frac: number, animate = true) {
    this.scene.data.set('mobile:hp', Phaser.Math.Clamp(frac, 0, 1));
    const w = 88 * Phaser.Math.Clamp(frac, 0, 1);
    if (animate && !getSettings().reducedMotion) this.scene.tweens.add({ targets: this.hp, width: w, duration: 400, ease: 'Cubic.out' });
    else this.hp.width = w;
  }
  shakeHp() {
    if (getSettings().reducedMotion) return;
    this.scene.tweens.add({ targets: this.hp, x: { from: 67, to: 65 }, duration: 50, yoyo: true, repeat: 2 });
  }

  setAbilities(list: Ability[]) {
    this.scene.data.set('mobile:abilities', list.map(({ icon, key }) => ({ icon, key })));
    const icon = this.scene.registry.get('icon') as (n: string) => number;
    this.abilityBar.removeAll(true);
    this.abilities = [];
    list.forEach((a, i) => {
      const x = (i - (list.length - 1) / 2) * 34;
      const frame = this.scene.add.rectangle(0, 0, 28, 28, 0x14171b, 0.92).setStrokeStyle(1, 0x8a7a5a);
      const img = this.scene.add.image(0, 0, 'icons', icon(a.icon));
      const k = this.scene.add.text(9, 9, a.key, { fontFamily: FONT, fontSize: '8px', color: '#e8e2d0', stroke: '#0d0f12', strokeThickness: 2 }).setOrigin(0.5);
      const box = this.scene.add.container(x, 0, [frame, img, k]);
      this.abilityBar.add(box);
      this.abilities.push({ name: a.icon, box, frame, onClick: a.onClick });
    });
  }
  moveAbilities(x: number, y: number, scale = 1) { this.abilityBar.setPosition(x, y).setScale(scale); }
  setAbilitiesVisible(v: boolean) {
    this.abilitiesVisible = v;
    this.scene.tweens.killTweensOf(this.abilityBar);
    this.abilityBar.setVisible(v && !usesMobileInterface() && !this.cinematic && !this.dialogueOpen).setAlpha(1);
  }
  setAbilitiesDisabled(dis: boolean) {
    this.disabled = dis;
    this.scene.data.set('mobile:disabled', dis);
    for (const a of this.abilities) (a.box.list[1] as Phaser.GameObjects.Image).setTint(dis ? 0x555555 : 0xffffff);
  }
  select(name: string | null) {
    this.scene.data.set('mobile:selected', name);
    for (const a of this.abilities) a.frame.setStrokeStyle(name === a.name ? 2 : 1, name === a.name ? 0x9cc4ec : 0x8a7a5a);
  }
  pulse(name: string) {
    if (getSettings().reducedMotion) return;
    const a = this.abilities.find((x) => x.name === name);
    if (a) this.scene.tweens.add({ targets: a.box, scale: 1.18, duration: 380, yoyo: true, repeat: 5, ease: 'Sine.inOut' });
  }
  /** Klick auf ein Fähigkeitssymbol? */
  hitTest(ptr: Phaser.Input.Pointer) {
    if (this.dialogueVisible) { this.advanceDialogue(); return true; }
    if (this.root.visible && ptr.x >= 6 && ptr.x <= 58 && ptr.y >= 6 && ptr.y <= 58) { openCharacterStats(this.scene.game); return true; }
    if (this.disabled || !this.abilityBar.visible || this.abilityBar.alpha < 0.1) return false;
    for (const a of this.abilities) {
      const x = this.abilityBar.x + a.box.x * this.abilityBar.scaleX, y = this.abilityBar.y + a.box.y * this.abilityBar.scaleY;
      if (Math.abs(ptr.x - x) <= 14 * this.abilityBar.scaleX && Math.abs(ptr.y - y) <= 14 * this.abilityBar.scaleY) { a.onClick(); return true; }
    }
    return false;
  }

  hint(text: string, quiet = false) {
    this.scene.data.set('mobile:hint', text);
    this.hintText.setText(text);
    if (!quiet && text) { this.hintText.setAlpha(0); this.scene.tweens.add({ targets: this.hintText, alpha: 1, duration: motionDuration(300) }); }
  }
  setThoughtsVisible(visible: boolean) {
    if (!visible && this.dialogue?.visible) { this.thoughtTimer?.remove(); this.dialogue.hide(); }
    this.thoughtsVisible = visible;
    this.thoughtText.setVisible(visible && !usesMobileInterface() && !this.cinematic && !this.dialogueOpen);
  }
  thought(text: string, ms = 2200) {
    this.thoughtTimer?.remove();
    if (this.dialogue?.visible) this.dialogue.hide();
    const parsed = parseDialogue(text);
    if (text && (parsed.name || this.cinematic)) {
      this.thoughtText.setAlpha(0);
      this.dialogue ??= new Dialogue(this.scene, { layer: this.options.dialogueLayer, onVisibilityChange: visible => {
        this.dialogueOpen = visible;
        this.scene.data.set('mobile:hudVisible', !this.cinematic && !visible);
        this.syncLayout();
      } });
      this.dialogue.setText(text);
      this.dialogue.setContinue(() => this.dialogue?.hide());
      this.thoughtTimer = this.scene.time.delayedCall(ms + Array.from(parsed.text).length * 28, () => this.dialogue?.hide());
      return;
    }
    this.scene.data.set({ 'mobile:thought': text, 'mobile:thoughtUntil': this.scene.time.now + ms });
    this.thoughtText.setText(text);
    this.scene.tweens.killTweensOf(this.thoughtText);
    this.scene.tweens.add({ targets: this.thoughtText, alpha: 1, duration: motionDuration(350) });
    this.thoughtTimer = this.scene.time.delayedCall(ms, () => {
      this.scene.data.set('mobile:thought', '');
      this.scene.tweens.add({ targets: this.thoughtText, alpha: 0, duration: motionDuration(600) });
    });
  }

  showProtect(portrait: string) {
    const icon = this.scene.registry.get('icon') as (n: string) => number;
    const frame = this.scene.add.rectangle(0, 0, 52, 52, 0x14171b).setStrokeStyle(2, 0x9cc4ec);
    const img = this.scene.add.image(0, 0, portrait).setDisplaySize(48, 48);
    const shield = this.scene.add.image(20, 20, 'icons', icon('protect'));
    this.protect = this.scene.add.container(608, 32, [frame, img, shield]).setDepth(1000).setAlpha(0).setScrollFactor(0);
    this.protect.setVisible(!this.cinematic && !this.dialogueOpen);
    this.scene.tweens.add({ targets: this.protect, alpha: 1, duration: motionDuration(400) });
    if (!getSettings().reducedMotion) this.scene.tweens.add({ targets: shield, scale: 1.2, duration: 600, yoyo: true, repeat: -1 });
  }
  protectDone() {
    if (!this.protect) return;
    (this.protect.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0x7cc47a);
  }

  hideAll(ms = 400) {
    this.thoughtTimer?.remove();
    if (this.dialogue?.visible) this.dialogue.hide();
    this.setCinematic(true);
    this.scene.data.set({ 'mobile:name': '', 'mobile:hint': '', 'mobile:thought': '', 'mobile:abilities': [] });
    this.scene.tweens.add({ targets: [this.root, this.abilityBar, this.hintText, this.thoughtText, this.protect].filter(Boolean), alpha: 0, duration: motionDuration(ms) });
  }
}

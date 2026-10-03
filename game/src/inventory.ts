import Phaser from 'phaser';
import { FONT } from './ui';
import type { ItemId } from './world/maps';
import { ITEM_NAMES } from './world/quests';

export const ITEM_FRAME: Record<ItemId, number> = { apfel: 0, feder: 2, kupfer: 3, kornblume: 4, kueken: -1 };
const ORDER: ItemId[] = ['apfel', 'kornblume', 'kupfer', 'feder', 'kueken'];
const PANEL_WIDTH = 192;
const PANEL_HEIGHT = 84;

/** Compact bag button, with separate slots and labels only when inspecting an item. */
export class InventoryHud {
  private button: Phaser.GameObjects.Container;
  private frame: Phaser.GameObjects.Rectangle;
  private badge: Phaser.GameObjects.Text;
  private panel: Phaser.GameObjects.Container;
  private slots: Phaser.GameObjects.Container;
  private label: Phaser.GameObjects.Text;
  private tooltip: Phaser.GameObjects.Text;
  private selected?: ItemId;
  private inv: Partial<Record<ItemId, number>> = {};

  constructor(private scene: Phaser.Scene, private onOpen: () => void) {
    this.frame = scene.add.rectangle(0, 0, 30, 30, 0x141b1a).setOrigin(0).setStrokeStyle(1, 0x8a7a5a);
    const inset = scene.add.rectangle(2, 2, 26, 26).setOrigin(0).setStrokeStyle(1, 0x394034);
    const bag = scene.add.image(15, 14, 'inventory-bag');
    const key = scene.add.text(25, 26, 'I', { fontFamily: FONT, fontSize: '8px', color: '#e8e2d0', backgroundColor: '#141b1a' }).setOrigin(0.5);
    this.badge = scene.add.text(29, -2, '', { fontFamily: FONT, fontSize: '8px', color: '#fff4d8', backgroundColor: '#394034', padding: { x: 2, y: 1 } }).setOrigin(1, 0);
    const buttonHit = scene.add.zone(15, 15, 32, 32).setInteractive({ useHandCursor: true });
    this.button = scene.add.container(64, 38, [this.frame, inset, bag, key, this.badge, buttonHit]).setDepth(1003).setScrollFactor(0);
    this.tooltip = scene.add.text(100, 53, 'Tasche · I', { fontFamily: FONT, fontSize: '9px', color: '#e8e2d0', backgroundColor: '#141b1a', padding: { x: 4, y: 3 } })
      .setOrigin(0, 0.5).setDepth(1004).setScrollFactor(0).setVisible(false);
    buttonHit.on('pointerover', () => { this.frame.setStrokeStyle(1, 0xd6ad59); this.tooltip.setVisible(!this.panel.visible); });
    buttonHit.on('pointerout', () => { this.frame.setStrokeStyle(1, this.panel.visible ? 0xd6ad59 : 0x8a7a5a); this.tooltip.setVisible(false); });
    buttonHit.on('pointerdown', (_ptr: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.toggle(); });

    const shadow = scene.add.rectangle(3, 3, PANEL_WIDTH, PANEL_HEIGHT, 0x070b0a, 0.65).setOrigin(0);
    const background = scene.add.rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0x141b1a).setOrigin(0).setStrokeStyle(1, 0x8a7a5a);
    const innerBorder = scene.add.rectangle(2, 2, PANEL_WIDTH - 4, PANEL_HEIGHT - 4).setOrigin(0).setStrokeStyle(1, 0x394034);
    const header = scene.add.text(8, 7, 'Tasche', { fontFamily: FONT, fontSize: '11px', color: '#e8e2d0' });
    const rule = scene.add.rectangle(8, 23, PANEL_WIDTH - 16, 1, 0x394034).setOrigin(0);
    this.label = scene.add.text(8, 70, '', { fontFamily: FONT, fontSize: '9px', color: '#b7ad94' });
    this.slots = scene.add.container(0, 0);
    const panelHit = scene.add.zone(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT).setInteractive();
    panelHit.on('pointerdown', (_ptr: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    const close = scene.add.text(180, 12, '×', { fontFamily: FONT, fontSize: '14px', color: '#b7ad94' }).setOrigin(0.5);
    const closeHit = scene.add.zone(180, 12, 20, 20).setInteractive({ useHandCursor: true });
    closeHit.on('pointerdown', (_ptr: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.close(); });
    this.panel = scene.add.container(64, 74, [shadow, background, innerBorder, panelHit, header, rule, this.slots, this.label, close, closeHit])
      .setDepth(1003).setScrollFactor(0).setVisible(false);

    const keyboard = scene.input.keyboard!;
    const bagKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    const escape = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    const toggle = () => this.toggle();
    const dismiss = () => this.close();
    bagKey.on('down', toggle);
    escape.on('down', dismiss);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bagKey.off('down', toggle);
      escape.off('down', dismiss);
    });
  }

  refresh(inv: Partial<Record<ItemId, number>>) {
    this.inv = inv;
    this.slots.removeAll(true);
    let total = 0;
    ORDER.forEach((item, index) => {
      const n = inv[item] ?? 0;
      total += n;
      const x = 24 + index * 36;
      const frame = this.scene.add.rectangle(x, 44, 32, 32, n ? 0x252d26 : 0x111614).setStrokeStyle(1, n ? 0x807252 : 0x394034);
      const inset = this.scene.add.rectangle(x, 44, 28, 28).setStrokeStyle(1, 0x0a100e, 0.8);
      this.slots.add([frame, inset]);
      if (!n) {
        this.slots.add(this.scene.add.rectangle(x, 44, 3, 3, 0x394034));
        return;
      }
      const icon = item === 'kueken'
        ? this.scene.add.image(x, 41, 'crt-fledgling', 0).setDisplaySize(24, 24)
        : this.scene.add.image(x, 41, 'items', ITEM_FRAME[item]);
      const amountBack = this.scene.add.rectangle(x + 13, 59, 12, 10, 0x0b120f).setOrigin(1);
      const amount = this.scene.add.text(x + 12, 58, `${n}`, { fontFamily: FONT, fontSize: '8px', color: '#fff4d8' }).setOrigin(1);
      const hit = this.scene.add.zone(x, 44, 32, 32).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => { frame.setStrokeStyle(1, 0xd6ad59); this.label.setText(ITEM_NAMES[item]); });
      hit.on('pointerout', () => { frame.setStrokeStyle(1, 0x807252); this.refreshLabel(); });
      hit.on('pointerdown', (_ptr: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.selected = item;
        this.refreshLabel();
      });
      this.slots.add([icon, amountBack, amount, hit]);
    });
    this.badge.setText(`${total}`).setVisible(total > 0);
    if (this.selected && !inv[this.selected]) this.selected = undefined;
    this.refreshLabel();
  }

  private refreshLabel() {
    this.label.setText(this.selected ? ITEM_NAMES[this.selected] : ORDER.some(item => this.inv[item]) ? '' : 'Noch leer.');
  }

  private toggle() {
    if (this.panel.visible) { this.close(); return; }
    this.onOpen();
    this.panel.setVisible(true);
    this.tooltip.setVisible(false);
    this.frame.setStrokeStyle(1, 0xd6ad59);
  }

  close() {
    this.panel.setVisible(false);
    this.tooltip.setVisible(false);
    this.frame.setStrokeStyle(1, 0x8a7a5a);
  }

  /** HUD clicks must never become walking targets underneath the panel. */
  hitTest(ptr: Phaser.Input.Pointer) {
    if (!this.button.active) return false;
    const overButton = ptr.x >= 63 && ptr.x <= 95 && ptr.y >= 37 && ptr.y <= 69;
    const overPanel = this.panel.visible && ptr.x >= 64 && ptr.x <= 64 + PANEL_WIDTH && ptr.y >= 74 && ptr.y <= 74 + PANEL_HEIGHT;
    return overButton || overPanel;
  }
}

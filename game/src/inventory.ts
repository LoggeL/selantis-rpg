import Phaser from 'phaser';
import { FONT } from './ui';
import type { ItemId } from './world/maps';
import { ITEM_NAMES } from './world/quests';
import { createMobileDialog, usesMobileInterface } from './mobileDialogs';

export const ITEM_FRAME: Record<ItemId, number> = {
  apfel: 0, feder: 2, kupfer: 3, kornblume: 4, kueken: -1,
  proviant: 0, wasserschlauch: 1, dolch: 2, silber: 3, reisezeug: 4, heilzeug: 5, 'buch-kraeuter': 6, 'buch-alana': 7,
};
export const itemTexture = (item: ItemId): string => TRAVEL_ORDER.includes(item) ? 'story-items' : 'items';
const ORDER: ItemId[] = ['apfel', 'kornblume', 'kupfer', 'feder', 'kueken'];
const TRAVEL_ORDER: ItemId[] = ['proviant', 'wasserschlauch', 'dolch', 'silber', 'reisezeug', 'heilzeug', 'buch-kraeuter', 'buch-alana'];
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
  private background: Phaser.GameObjects.Rectangle;
  private shadow: Phaser.GameObjects.Rectangle;
  private innerBorder: Phaser.GameObjects.Rectangle;
  private panelHit: Phaser.GameObjects.Zone;
  private height = PANEL_HEIGHT;
  private slotFrames = new Map<ItemId, Phaser.GameObjects.Rectangle>();
  private selected?: ItemId;
  private inv: Partial<Record<ItemId, number>> = {};
  private mobileDialog?: ReturnType<typeof createMobileDialog>;
  private enabled = true;
  get isOpen() { return this.panel.visible; }

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

    const shadow = this.shadow = scene.add.rectangle(3, 3, PANEL_WIDTH, PANEL_HEIGHT, 0x070b0a, 0.65).setOrigin(0);
    const background = this.background = scene.add.rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0x141b1a).setOrigin(0).setStrokeStyle(1, 0x8a7a5a);
    const innerBorder = this.innerBorder = scene.add.rectangle(2, 2, PANEL_WIDTH - 4, PANEL_HEIGHT - 4).setOrigin(0).setStrokeStyle(1, 0x394034);
    const header = scene.add.text(8, 7, 'Tasche', { fontFamily: FONT, fontSize: '11px', color: '#e8e2d0' });
    const rule = scene.add.rectangle(8, 23, PANEL_WIDTH - 16, 1, 0x394034).setOrigin(0);
    this.label = scene.add.text(8, 70, '', { fontFamily: FONT, fontSize: '9px', color: '#b7ad94' });
    this.slots = scene.add.container(0, 0);
    const panelHit = this.panelHit = scene.add.zone(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT).setInteractive();
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
    scene.events.on('mobile-inventory-toggle', toggle);
    this.publish();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bagKey.off('down', toggle);
      escape.off('down', dismiss);
      scene.events.off('mobile-inventory-toggle', toggle);
      this.mobileDialog?.destroy();
      this.mobileDialog = undefined;
    });
  }

  refresh(inv: Partial<Record<ItemId, number>>) {
    this.inv = inv;
    this.slots.removeAll(true);
    this.slotFrames.clear();
    const order = TRAVEL_ORDER.some(item => inv[item]) ? [...ORDER, ...TRAVEL_ORDER] : ORDER;
    const rows = Math.ceil(order.length / 5);
    this.height = PANEL_HEIGHT + (rows - 1) * 36;
    this.background.setSize(PANEL_WIDTH, this.height);
    this.shadow.setSize(PANEL_WIDTH, this.height);
    this.innerBorder.setSize(PANEL_WIDTH - 4, this.height - 4);
    this.panelHit.setPosition(PANEL_WIDTH / 2, this.height / 2).setSize(PANEL_WIDTH, this.height);
    if (this.panelHit.input) (this.panelHit.input.hitArea as Phaser.Geom.Rectangle).setSize(PANEL_WIDTH, this.height);
    this.label.setY(this.height - 14);
    if (this.selected && !inv[this.selected]) this.selected = undefined;
    let total = 0;
    Array.from({ length: rows * 5 }, (_, index) => order[index]).forEach((item, index) => {
      const x = 24 + (index % 5) * 36, y = 44 + Math.floor(index / 5) * 36;
      if (!item) {
        this.slots.add(this.scene.add.rectangle(x, y, 32, 32, 0x111614).setStrokeStyle(1, 0x394034));
        return;
      }
      const n = inv[item] ?? 0;
      total += n;
      const frame = this.scene.add.rectangle(x, y, 32, 32, n ? 0x252d26 : 0x111614).setStrokeStyle(1, this.selected === item ? 0xd6ad59 : n ? 0x807252 : 0x394034);
      this.slotFrames.set(item, frame);
      const inset = this.scene.add.rectangle(x, y, 28, 28).setStrokeStyle(1, 0x0a100e, 0.8);
      this.slots.add([frame, inset]);
      if (!n) {
        this.slots.add(this.scene.add.rectangle(x, y, 3, 3, 0x394034));
        return;
      }
      const icon = item === 'kueken'
        ? this.scene.add.image(x, y - 3, 'crt-fledgling', 0).setDisplaySize(24, 24)
        : this.scene.add.image(x, y - 3, itemTexture(item), ITEM_FRAME[item]);
      const amountBack = this.scene.add.rectangle(x + 13, y + 15, 12, 10, 0x0b120f).setOrigin(1);
      const amount = this.scene.add.text(x + 12, y + 14, `${n}`, { fontFamily: FONT, fontSize: '8px', color: '#fff4d8' }).setOrigin(1);
      const hit = this.scene.add.zone(x, y, 32, 32).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => { frame.setStrokeStyle(1, 0xd6ad59); this.label.setText(ITEM_NAMES[item]); });
      hit.on('pointerout', () => { frame.setStrokeStyle(1, this.selected === item ? 0xd6ad59 : 0x807252); this.refreshLabel(); });
      hit.on('pointerdown', (_ptr: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.selected = item;
        for (const [id, slot] of this.slotFrames) slot.setStrokeStyle(1, id === item ? 0xd6ad59 : this.inv[id] ? 0x807252 : 0x394034);
        this.refreshLabel();
      });
      this.slots.add([icon, amountBack, amount, hit]);
    });
    this.badge.setText(`${total}`).setVisible(total > 0);
    if (this.selected && !inv[this.selected]) this.selected = undefined;
    this.refreshLabel();
    this.publish();
    this.renderMobileItems();
  }

  private refreshLabel() {
    this.label.setText(this.selected ? ITEM_NAMES[this.selected] : [...ORDER, ...TRAVEL_ORDER].some(item => this.inv[item]) ? '' : 'Noch leer.');
  }

  toggle() {
    if (!this.enabled) return;
    if (this.panel.visible) { this.close(); return; }
    this.onOpen();
    this.panel.setVisible(true);
    this.tooltip.setVisible(false);
    this.frame.setStrokeStyle(1, 0xd6ad59);
    this.scene.input.keyboard?.resetKeys();
    if (usesMobileInterface()) {
      this.mobileDialog = createMobileDialog('Tasche', () => this.close());
      this.renderMobileItems();
    }
    this.publish();
  }

  close() {
    this.panel.setVisible(false);
    this.tooltip.setVisible(false);
    this.frame.setStrokeStyle(1, 0x8a7a5a);
    this.mobileDialog?.destroy();
    this.mobileDialog = undefined;
    this.publish();
  }

  setVisible(visible: boolean) {
    this.enabled = visible;
    this.button.setVisible(visible);
    if (!visible) this.close();
    else this.publish();
  }

  private publish() {
    this.scene.data.set('mobile:inventory', {
      open: this.panel.visible,
      available: this.enabled,
      items: [...ORDER, ...TRAVEL_ORDER].filter(id => (this.inv[id] ?? 0) > 0)
        .map(id => ({ id, name: ITEM_NAMES[id], count: this.inv[id]! })),
    });
  }

  private renderMobileItems() {
    if (!this.mobileDialog) return;
    const content = this.mobileDialog.content;
    content.replaceChildren();
    const items = [...ORDER, ...TRAVEL_ORDER].filter(id => (this.inv[id] ?? 0) > 0);
    if (!items.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Deine Tasche ist noch leer.';
      content.append(empty);
      return;
    }
    const list = document.createElement('ul');
    for (const id of items) {
      const row = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'mobile-item-name';
      const icon = document.createElement('span');
      icon.className = 'mobile-item-icon';
      icon.setAttribute('aria-hidden', 'true');
      if (id === 'kueken') {
        icon.style.backgroundImage = 'url("/assets/sprites/crt-fledgling.png")';
        icon.style.backgroundSize = '128px 32px';
      } else {
        const story = itemTexture(id) === 'story-items';
        const columns = story ? 4 : 8;
        const frame = ITEM_FRAME[id];
        icon.style.backgroundImage = `url("/assets/ui/${story ? 'story-items' : 'items'}.png")`;
        icon.style.backgroundSize = story ? '128px 64px' : '256px 32px';
        icon.style.backgroundPosition = `${-(frame % columns) * 32}px ${-Math.floor(frame / columns) * 32}px`;
      }
      label.append(icon, document.createTextNode(ITEM_NAMES[id]));
      const amount = document.createElement('span');
      amount.textContent = `× ${this.inv[id]}`;
      row.append(label, amount);
      list.append(row);
    }
    content.append(list);
  }

  /** HUD clicks must never become walking targets underneath the panel. */
  hitTest(ptr: Phaser.Input.Pointer) {
    if (!this.enabled || !this.button.active || !this.button.visible) return false;
    const overButton = ptr.x >= 63 && ptr.x <= 95 && ptr.y >= 37 && ptr.y <= 69;
    const overPanel = this.panel.visible && ptr.x >= 64 && ptr.x <= 64 + PANEL_WIDTH && ptr.y >= 74 && ptr.y <= 74 + this.height;
    return overButton || overPanel;
  }
}

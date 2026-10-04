import { assetUrl } from "../../platform/assets/url";
import Phaser from 'phaser';
import { FONT } from "./Hud";
import { ITEM_NAMES, FIND_ITEM_ORDER as ORDER, TRAVEL_ITEM_ORDER as TRAVEL_ORDER, type ItemId } from "../../modules/inventory/catalog";
import { inventorySnapshot } from "../../modules/inventory/snapshot";
import { inspectInventoryItem } from "../../modules/inventory/inspection";
import { ITEM_COMMENTS } from "../../content/inventory/comments";
import { applyCampaignCommand, type CampaignCommand } from "../../modules/campaign/commands";
import { state } from "../../platform/campaignRegistry";
import { createMobileDialog, usesMobileInterface } from "../dom/dialogs";
import { closeCharacterStats, openBag } from "../dom/characterSheetControls";
import { ITEM_FRAME, itemTexture } from "../dom/itemPresentation";
export { ITEM_FRAME, itemTexture } from "../dom/itemPresentation";

const PANEL_WIDTH = 192;
const PANEL_HEIGHT = 84;
export type InventoryItemAction = { item: ItemId; label: string } & ({ onUse: () => boolean; command?: never } | { command: CampaignCommand; onUse?: never });

/** Compact bag button, with separate slots and labels only when inspecting an item. */
export class InventoryHud {
  private button: Phaser.GameObjects.Container;
  private frame: Phaser.GameObjects.Rectangle;
  private badge: Phaser.GameObjects.Text;
  private panel: Phaser.GameObjects.Container;
  private slots: Phaser.GameObjects.Container;
  private label: Phaser.GameObjects.Text;
  private comment: Phaser.GameObjects.Text;
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
  private characterDialog = false;
  private openState = false;
  private itemActions: InventoryItemAction[] = [];
  private itemInstruction = '';
  private useButton: Phaser.GameObjects.Text;
  get isOpen() { return this.openState; }

  constructor(private scene: Phaser.Scene, private onOpen: () => void) {
    this.frame = scene.add.rectangle(0, 0, 30, 30, 0x141b1a).setOrigin(0).setStrokeStyle(1, 0x8a7a5a);
    const inset = scene.add.rectangle(2, 2, 26, 26).setOrigin(0).setStrokeStyle(1, 0x394034);
    const bag = scene.add.image(15, 14, 'inventory-bag');
    const key = scene.add.text(25, 26, 'I', { fontFamily: FONT, fontSize: '8px', color: '#e8e2d0', backgroundColor: '#141b1a' }).setOrigin(0.5);
    this.badge = scene.add.text(29, -2, '', { fontFamily: FONT, fontSize: '8px', color: '#fff4d8', backgroundColor: '#394034', padding: { x: 2, y: 1 } }).setOrigin(1, 0);
    const buttonHit = scene.add.zone(15, 15, 32, 32).setInteractive({ useHandCursor: true });
    this.button = scene.add.container(64, 38, [this.frame, inset, bag, key, this.badge, buttonHit]).setDepth(1003).setScrollFactor(0);
    this.button.setVisible(document.documentElement.dataset.actionBarInstalled !== 'true');
    this.tooltip = scene.add.text(100, 53, 'Tasche · I', { fontFamily: FONT, fontSize: '9px', color: '#e8e2d0', backgroundColor: '#141b1a', padding: { x: 4, y: 3 } })
      .setOrigin(0, 0.5).setDepth(1004).setScrollFactor(0).setVisible(false);
    buttonHit.on('pointerover', () => { this.frame.setStrokeStyle(1, 0xd6ad59); this.tooltip.setVisible(!this.isOpen); });
    buttonHit.on('pointerout', () => { this.frame.setStrokeStyle(1, this.isOpen ? 0xd6ad59 : 0x8a7a5a); this.tooltip.setVisible(false); });
    buttonHit.on('pointerdown', (_ptr: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.toggle(); });

    const shadow = this.shadow = scene.add.rectangle(3, 3, PANEL_WIDTH, PANEL_HEIGHT, 0x070b0a, 0.65).setOrigin(0);
    const background = this.background = scene.add.rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0x141b1a).setOrigin(0).setStrokeStyle(1, 0x8a7a5a);
    const innerBorder = this.innerBorder = scene.add.rectangle(2, 2, PANEL_WIDTH - 4, PANEL_HEIGHT - 4).setOrigin(0).setStrokeStyle(1, 0x394034);
    const header = scene.add.text(8, 7, 'Tasche', { fontFamily: FONT, fontSize: '11px', color: '#e8e2d0' });
    const rule = scene.add.rectangle(8, 23, PANEL_WIDTH - 16, 1, 0x394034).setOrigin(0);
    this.label = scene.add.text(8, 70, '', { fontFamily: FONT, fontSize: '9px', color: '#b7ad94' });
    this.comment = scene.add.text(8, 85, '', { fontFamily: FONT, fontSize: '10px', color: '#fff0cf', wordWrap: { width: PANEL_WIDTH - 16 }, lineSpacing: 2 });
    this.useButton = scene.add.text(8, 88, '', { fontFamily: FONT, fontSize: '11px', color: '#fff4d8', backgroundColor: '#394034', padding: { x: 12, y: 7 } })
      .setInteractive({ useHandCursor: true }).setVisible(false);
    this.useButton.on('pointerdown', (_ptr: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); if (this.selected) this.useItem(this.selected);
    });
    this.slots = scene.add.container(0, 0);
    const panelHit = this.panelHit = scene.add.zone(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT).setInteractive();
    panelHit.on('pointerdown', (_ptr: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    const close = scene.add.text(180, 12, '×', { fontFamily: FONT, fontSize: '14px', color: '#b7ad94' }).setOrigin(0.5);
    const closeHit = scene.add.zone(180, 12, 20, 20).setInteractive({ useHandCursor: true });
    closeHit.on('pointerdown', (_ptr: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.close(); });
    this.panel = scene.add.container(64, 74, [shadow, background, innerBorder, panelHit, header, rule, this.slots, this.label, this.comment, this.useButton, close, closeHit])
      .setDepth(1003).setScrollFactor(0).setVisible(false);

    const keyboard = scene.input.keyboard!;
    const bagKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    const escape = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    const toggle = () => this.toggle();
    const dismiss = () => this.close();
    bagKey.on('down', toggle);
    escape.on('down', dismiss);
    const navigate = (event: KeyboardEvent) => {
      if (!this.enabled || !this.isOpen || this.characterDialog || this.mobileDialog) return;
      const items = inventorySnapshot(this.inv).map(entry => entry.id);
      if (!items.length) return;
      const index = this.selected ? items.indexOf(this.selected) : -1;
      let next: ItemId | undefined;
      if (event.code === 'Home') next = items[0];
      else if (event.code === 'End') next = items[items.length - 1];
      else if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.code)) {
        const direction = ['ArrowLeft', 'ArrowUp'].includes(event.code) ? -1 : 1;
        next = items[index < 0 ? 0 : (index + direction + items.length) % items.length];
      } else if (event.code === 'Enter' || event.code === 'Space') {
        if (!this.selected) next = items[0];
        else this.useItem(this.selected);
      } else return;
      event.preventDefault();
      if (next) this.selectItem(next);
    };
    keyboard.on('keydown', navigate);
    scene.events.on('mobile-inventory-toggle', toggle);
    const characterOpen = () => { this.close(); this.onOpen(); };
    scene.events.on('character-open', characterOpen);
    const bagOpen = () => { this.characterDialog = true; this.openState = true; this.panel.setVisible(false); this.publish(); };
    const bagClose = () => { this.characterDialog = false; this.openState = false; this.panel.setVisible(false); this.publish(); };
    const itemSelect = (item: ItemId) => this.selectItem(item);
    const itemUse = (item: ItemId) => this.useItem(item);
    scene.events.on('character-bag-open', bagOpen);
    scene.events.on('character-bag-close', bagClose);
    scene.events.on('inventory-item-select', itemSelect);
    scene.events.on('inventory-item-use', itemUse);
    this.publish();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bagKey.off('down', toggle);
      escape.off('down', dismiss);
      keyboard.off('keydown', navigate);
      scene.events.off('mobile-inventory-toggle', toggle);
      scene.events.off('character-open', characterOpen);
      scene.events.off('character-bag-open', bagOpen);
      scene.events.off('character-bag-close', bagClose);
      scene.events.off('inventory-item-select', itemSelect);
      scene.events.off('inventory-item-use', itemUse);
      this.mobileDialog?.destroy();
      this.mobileDialog = undefined;
    });
  }

  refresh(inv: Partial<Record<ItemId, number>>) {
    this.inv = { ...inv };
    this.slots.removeAll(true);
    this.slotFrames.clear();
    const order = TRAVEL_ORDER.some(item => inv[item]) ? [...ORDER, ...TRAVEL_ORDER] : ORDER;
    const rows = Math.ceil(order.length / 5);
    if (this.selected && !inv[this.selected]) this.selected = undefined;
    const inspection = this.inspection();
    this.comment.setText(inspection ? `Lia: ${inspection.comment}` : '').setVisible(!!inspection);
    const detailHeight = inspection ? this.comment.height + 8 : 0;
    this.height = PANEL_HEIGHT + (rows - 1) * 36 + detailHeight + (this.itemActions.length ? 42 : 0);
    this.background.setSize(PANEL_WIDTH, this.height);
    this.shadow.setSize(PANEL_WIDTH, this.height);
    this.innerBorder.setSize(PANEL_WIDTH - 4, this.height - 4);
    this.panelHit.setPosition(PANEL_WIDTH / 2, this.height / 2).setSize(PANEL_WIDTH, this.height);
    if (this.panelHit.input) (this.panelHit.input.hitArea as Phaser.Geom.Rectangle).setSize(PANEL_WIDTH, this.height);
    this.label.setY(PANEL_HEIGHT + (rows - 1) * 36 - 14);
    this.comment.setY(this.label.y + 15);
    this.useButton.setY(this.height - 36);
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
        this.selectItem(item);
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
    const action = this.itemActions.find(action => action.item === this.selected);
    this.useButton.setText(action ? `${action.label} · Enter` : '').setVisible(!!action && !!this.inv[action.item]);
  }

  setItemActions(actions: InventoryItemAction[], instruction = '') {
    this.itemActions = actions;
    this.itemInstruction = instruction;
    this.refresh(this.inv);
  }

  private selectItem(item: ItemId) {
    if (!this.enabled || !this.isOpen || !inspectInventoryItem(item, this.inv, state(this.scene.registry).flags, ITEM_COMMENTS)) return;
    this.selected = item;
    this.refresh(this.inv);
  }

  private inspection() {
    return this.selected ? inspectInventoryItem(this.selected, this.inv, state(this.scene.registry).flags, ITEM_COMMENTS) : undefined;
  }

  private useItem(item: ItemId) {
    if (!this.enabled || !this.isOpen || this.selected !== item || !((this.inv[item] ?? 0) > 0)) return false;
    const action = this.itemActions.find(action => action.item === item);
    if (!action) return false;
    if (action.onUse) return action.onUse();
    const world = state(this.scene.registry);
    const accepted = applyCampaignCommand(world, action.command);
    if (accepted) this.refresh(world.inv);
    return accepted;
  }

  toggle() {
    if (!this.enabled) return;
    if (this.isOpen) { this.close(); return; }
    this.onOpen();
    this.selected = undefined;
    this.refresh(this.inv);
    this.tooltip.setVisible(false);
    this.frame.setStrokeStyle(1, 0xd6ad59);
    this.scene.input.keyboard?.resetKeys();
    this.characterDialog = openBag(this.scene.game, () => this.close());
    this.openState = true;
    if (!this.characterDialog && usesMobileInterface()) {
      this.mobileDialog = createMobileDialog('Tasche', () => this.close());
      this.renderMobileItems();
    }
    this.panel.setVisible(!this.characterDialog && !this.mobileDialog);
    this.frame.setStrokeStyle(1, 0xd6ad59);
    this.publish();
  }

  close() {
    this.openState = false;
    if (this.characterDialog) { this.characterDialog = false; closeCharacterStats(); }
    this.panel.setVisible(false);
    this.tooltip.setVisible(false);
    this.frame.setStrokeStyle(1, 0x8a7a5a);
    this.mobileDialog?.destroy();
    this.mobileDialog = undefined;
    this.publish();
  }

  setVisible(visible: boolean) {
    this.enabled = visible;
    this.button.setVisible(visible && document.documentElement.dataset.actionBarInstalled !== 'true');
    if (!visible) this.close();
    else this.publish();
  }

  private publish() {
    this.scene.data.set('mobile:inventory', {
      open: this.isOpen,
      available: this.enabled,
      selected: this.selected,
      inspection: this.inspection(),
      instruction: this.itemInstruction,
      actions: this.itemActions.map(action => ({ item: action.item, label: action.label })),
      items: inventorySnapshot(this.inv),
    });
  }

  private renderMobileItems() {
    if (!this.mobileDialog) return;
    const content = this.mobileDialog.content;
    content.replaceChildren();
    if (this.itemInstruction) { const instruction = document.createElement('p'); instruction.textContent = this.itemInstruction; content.append(instruction); }
    const items = [...ORDER, ...TRAVEL_ORDER].filter(id => (this.inv[id] ?? 0) > 0);
    if (!items.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Deine Tasche ist noch leer.';
      content.append(empty);
      return;
    }
    const list = document.createElement('ul');
    for (const id of items) {
      const row = document.createElement('li'); row.dataset.item = id;
      const label = document.createElement('span');
      label.className = 'mobile-item-name';
      const icon = document.createElement('span');
      icon.className = 'mobile-item-icon';
      icon.setAttribute('aria-hidden', 'true');
      if (id === 'steine' || id === 'zunderholz') {
        icon.style.backgroundImage = `url("${assetUrl(`/assets/ui/${id === 'steine' ? 'camp-stones' : 'camp-wood'}.svg`)}")`; icon.style.backgroundSize = '32px 32px';
      } else if (id === 'kueken') {
        icon.style.backgroundImage = `url("${assetUrl('/assets/sprites/crt-fledgling.png')}")`;
        icon.style.backgroundSize = '128px 32px';
      } else {
        const story = itemTexture(id) === 'story-items';
        const columns = story ? 4 : 8;
        const frame = ITEM_FRAME[id];
        icon.style.backgroundImage = `url("${assetUrl(`/assets/ui/${story ? 'story-items' : 'items'}.png`)}")`;
        icon.style.backgroundSize = story ? '128px 64px' : '256px 32px';
        icon.style.backgroundPosition = `${-(frame % columns) * 32}px ${-Math.floor(frame / columns) * 32}px`;
      }
      label.append(icon, document.createTextNode(ITEM_NAMES[id]));
      const amount = document.createElement('span');
      amount.textContent = `× ${this.inv[id]}`;
      const select = document.createElement('button'); select.type = 'button';
      select.setAttribute('aria-pressed', String(this.selected === id)); select.append(label, amount);
      select.addEventListener('click', () => {
        this.selectItem(id);
        this.mobileDialog?.content.querySelector<HTMLButtonElement>(`[data-item="${id}"] button`)?.focus({ preventScroll: true });
      }); row.append(select);
      const inspection = this.inspection();
      if (inspection?.item === id) {
        const comment = document.createElement('p'); comment.className = 'bag-item-comment'; comment.setAttribute('role', 'status');
        comment.textContent = `Lia: ${inspection.comment}`; row.append(comment);
      }
      const action = this.itemActions.find(action => action.item === id);
      if (this.selected === id && action) {
        const use = document.createElement('button'); use.type = 'button'; use.textContent = action.label;
        use.addEventListener('click', () => this.useItem(id)); row.append(use);
      }
      list.append(row);
    }
    content.append(list);
  }

  /** HUD clicks must never become walking targets underneath the panel. */
  hitTest(ptr: Phaser.Input.Pointer) {
    if (!this.enabled || !this.button.active) return false;
    const overButton = this.button.visible && ptr.x >= 63 && ptr.x <= 95 && ptr.y >= 37 && ptr.y <= 69;
    const overPanel = this.panel.visible && ptr.x >= 64 && ptr.x <= 64 + PANEL_WIDTH && ptr.y >= 74 && ptr.y <= 74 + this.height;
    return overButton || overPanel;
  }
}

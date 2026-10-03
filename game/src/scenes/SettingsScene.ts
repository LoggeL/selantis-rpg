import Phaser from 'phaser';
import { FONT } from '../ui';
import { closeSettings, getSettings, subscribeSettings, updateSettings } from '../settings';
import { unlockAudio, sfx } from '../audio';
import { createMobileDialog, usesMobileInterface } from '../mobileDialogs';

export class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }
  create() {
    this.add.rectangle(320, 180, 640, 360, 0x07080a, 0.76).setInteractive();
    if (usesMobileInterface()) { this.createTouchSettings(); return; }
    this.add.rectangle(320, 180, 340, 248, 0x14171b).setStrokeStyle(2, 0x8a7a5a);
    const text = (x: number, y: number, value: string, size = 14) => this.add.text(x, y, value, { fontFamily: FONT, fontSize: `${size}px`, color: '#e8e2d0' });
    text(190, 72, 'Einstellungen', 18);
    const repaint: (() => void)[] = [];
    const slider = (label: string, y: number, key: 'musicVolume' | 'effectsVolume') => {
      text(188, y - 6, label);
      const value = text(438, y - 5, '', 11).setOrigin(1, 0);
      this.add.rectangle(344, y + 4, 140, 4, 0x30343b);
      const fill = this.add.rectangle(274, y + 4, 140, 4, 0x9cc4ec).setOrigin(0, 0.5);
      const knob = this.add.rectangle(344, y + 4, 6, 14, 0xe8e2d0);
      const zone = this.add.zone(344, y + 4, 148, 24).setInteractive({ useHandCursor: true });
      let dragging = false;
      const setValue = (pointer: Phaser.Input.Pointer) => { unlockAudio(); updateSettings({ [key]: Phaser.Math.Clamp((pointer.x - 274) / 140, 0, 1) }); };
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => { dragging = true; setValue(pointer); });
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => { if (dragging && pointer.isDown) setValue(pointer); });
      this.input.on('pointerup', () => { dragging = false; });
      repaint.push(() => { const v = getSettings()[key]; fill.width = 140 * v; knob.x = 274 + 140 * v; value.setText(`${Math.round(v * 100)}%`); });
    };
    slider('Musik', 120, 'musicVolume');
    slider('Effekte', 156, 'effectsVolume');
    const toggle = (label: string, y: number, key: 'reducedMotion' | 'particles') => {
      text(188, y - 7, label, 13);
      const frame = this.add.rectangle(423, y, 34, 20, 0x30343b).setStrokeStyle(1, 0x8a7a5a).setInteractive({ useHandCursor: true });
      const mark = text(423, y, '', 11).setOrigin(0.5);
      frame.on('pointerdown', () => { if (key === 'particles' && getSettings().reducedMotion) return; unlockAudio(); updateSettings({ [key]: !getSettings()[key] }); sfx.select(); });
      repaint.push(() => { const active = getSettings()[key] && !(key === 'particles' && getSettings().reducedMotion); mark.setText(active ? 'AN' : 'AUS'); frame.setFillStyle(active ? 0x345747 : 0x30343b); frame.setAlpha(key === 'particles' && getSettings().reducedMotion ? 0.45 : 1); });
    };
    toggle('Ruhige Bewegung', 201, 'reducedMotion');
    toggle('Partikel', 235, 'particles');
    const button = this.add.rectangle(320, 278, 126, 24, 0x252c35).setStrokeStyle(1, 0x9cc4ec).setInteractive({ useHandCursor: true });
    text(320, 278, 'Zurück  O', 12).setOrigin(0.5);
    button.on('pointerdown', () => { sfx.select(); closeSettings(); });
    const unsubscribe = subscribeSettings(() => repaint.forEach((draw) => draw()));
    this.events.once('shutdown', () => { unsubscribe(); closeSettings(); });
  }

  private createTouchSettings() {
    const dialog = createMobileDialog('Einstellungen', () => { sfx.select(); closeSettings(); });
    const repaint: (() => void)[] = [];
    for (const [key, title] of [['musicVolume', 'Musik'], ['effectsVolume', 'Effekte']] as const) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      const value = document.createElement('output');
      input.type = 'range'; input.min = '0'; input.max = '100'; input.step = '1';
      input.id = `mobile-settings-${key}`;
      label.htmlFor = input.id;
      label.append(title, value);
      input.addEventListener('input', () => { unlockAudio(); updateSettings({ [key]: Number(input.value) / 100 }); });
      repaint.push(() => {
        const percent = Math.round(getSettings()[key] * 100);
        input.value = `${percent}`;
        input.setAttribute('aria-valuetext', `${percent} Prozent`);
        value.value = `${percent}%`;
      });
      dialog.content.append(label, input);
    }
    for (const [key, title] of [['reducedMotion', 'Ruhige Bewegung'], ['particles', 'Partikel']] as const) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      label.append(title, input);
      input.addEventListener('change', () => { unlockAudio(); updateSettings({ [key]: input.checked }); sfx.select(); });
      repaint.push(() => {
        input.disabled = key === 'particles' && getSettings().reducedMotion;
        input.checked = getSettings()[key] && !input.disabled;
      });
      dialog.content.append(label);
    }
    const note = document.createElement('p');
    note.textContent = 'Bei ruhiger Bewegung sind Partikel ausgeschaltet.';
    dialog.content.append(note);
    const unsubscribe = subscribeSettings(() => repaint.forEach(draw => draw()));
    this.events.once('shutdown', () => { unsubscribe(); dialog.destroy(); closeSettings(); });
  }
}

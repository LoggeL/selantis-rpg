import { settings, updateSettings } from '../core/settings';
import { el, sfx } from './dom';
import { NavList, type NavItem } from './nav';
import { Typewriter } from './typewriter';

/** The fullscreen toggle of the settings page that is currently open (one document listener for all). */
let paintFullscreen: (() => void) | null = null;
if (typeof document !== 'undefined') document.addEventListener('fullscreenchange', () => paintFullscreen?.());

const SPEEDS: [number, string][] = [[25, 'Langsam'], [45, 'Normal'], [80, 'Schnell'], [0, 'Sofort']];

function speedIndex(): number {
  const i = SPEEDS.findIndex(([v]) => v === settings.textSpeed);
  if (i >= 0) return i;
  if (settings.textSpeed <= 0) return 3;
  return settings.textSpeed < 35 ? 0 : settings.textSpeed < 60 ? 1 : 2;
}

/** Settings rows (shared by the title screen and the pause menu). Returns the nav for key handling. */
export function buildSettings(host: HTMLElement, onBack?: () => void): NavList {
  host.textContent = '';
  const rows = el('div', 'set-rows');
  host.appendChild(rows);
  const items: NavItem[] = [];

  const row = (label: string, control: HTMLElement, extra?: HTMLElement) => {
    const r = el('div', 'set-row');
    r.append(el('div', 'set-label', label), control);
    if (extra) r.appendChild(extra);
    rows.appendChild(r);
    return r;
  };

  // Volume sliders with pips
  const slider = (label: string, key: 'music' | 'sfx') => {
    const ctl = el('div', 'set-slider');
    const pips: HTMLElement[] = [];
    for (let i = 0; i < 10; i++) { const p = el('span', 'set-pip'); ctl.appendChild(p); pips.push(p); }
    const value = el('span', 'set-value');
    ctl.appendChild(value);
    const paint = () => {
      const v = Math.round(settings[key] * 10);
      pips.forEach((p, i) => p.classList.toggle('on', i < v));
      value.textContent = v === 0 ? 'Aus' : `${v * 10} %`;
    };
    const set = (v: number) => {
      const next = Math.round(Math.max(0, Math.min(1, v)) * 10) / 10;
      if (next === settings[key]) return;
      updateSettings({ [key]: next });
      paint();
      sfx(key === 'sfx' ? 'ui-confirm' : 'ui-move', { volume: 0.7 });
    };
    const fromPointer = (e: PointerEvent) => {
      const first = pips[0].getBoundingClientRect(), last = pips[9].getBoundingClientRect();
      const t = (e.clientX - first.left) / Math.max(1, last.right - first.left);
      set(Math.ceil(Math.max(0, Math.min(1, t)) * 10) / 10);
    };
    ctl.addEventListener('click', e => e.stopPropagation());
    ctl.addEventListener('pointerdown', e => {
      e.stopPropagation();
      ctl.setPointerCapture?.(e.pointerId);
      fromPointer(e);
      const move = (ev: PointerEvent) => fromPointer(ev);
      const up = () => { ctl.removeEventListener('pointermove', move); ctl.removeEventListener('pointerup', up); };
      ctl.addEventListener('pointermove', move);
      ctl.addEventListener('pointerup', up);
    });
    paint();
    const r = row(label, ctl);
    items.push({ el: r, left: () => set(settings[key] - 0.1), right: () => set(settings[key] + 0.1), activate: () => set(settings[key] >= 1 ? 0 : settings[key] + 0.1) });
  };
  slider('Musik', 'music');
  slider('Effekte', 'sfx');

  // Text speed (segmented) with a live sample line
  const seg = el('div', 'set-seg');
  const sample = el('div', 'set-sample');
  const buttons = SPEEDS.map(([v, name], i) => {
    const b = el('button', 'set-seg-btn', name);
    b.type = 'button';
    b.addEventListener('click', e => { e.stopPropagation(); setSpeed(i); });
    seg.appendChild(b);
    void v;
    return b;
  });
  let tw: Typewriter | null = null;
  const playSample = () => {
    tw?.cancel();
    tw = new Typewriter(sample, '„Ich lese nur noch ein Kapitel, versprochen!“', { voice: { pitch: 330, wave: 'triangle' } });
  };
  const paintSpeed = () => buttons.forEach((b, i) => b.classList.toggle('on', i === speedIndex()));
  const setSpeed = (i: number) => {
    const idx = (i + SPEEDS.length) % SPEEDS.length;
    updateSettings({ textSpeed: SPEEDS[idx][0] });
    paintSpeed();
    sfx('ui-move', { volume: 0.5 });
    playSample();
  };
  paintSpeed();
  const speedRow = row('Textgeschwindigkeit', seg, sample);
  speedRow.classList.add('set-row-speed');
  items.push({ el: speedRow, left: () => setSpeed(speedIndex() - 1), right: () => setSpeed(speedIndex() + 1), activate: () => setSpeed(speedIndex() + 1) });

  // Toggles
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const t = el('button', 'set-toggle');
    t.type = 'button';
    t.append(el('span', 'set-toggle-knob'), el('span', 'set-toggle-text'));
    const paint = () => {
      const on = get();
      t.classList.toggle('on', on);
      (t.lastElementChild as HTMLElement).textContent = on ? 'Ein' : 'Aus';
      t.setAttribute('aria-pressed', String(on));
    };
    const flip = (v = !get()) => { set(v); paint(); sfx('ui-confirm', { volume: 0.5 }); setTimeout(paint, 250); };
    t.addEventListener('click', e => { e.stopPropagation(); flip(); });
    paint();
    const r = row(label, t);
    items.push({ el: r, activate: () => flip(), left: () => flip(false), right: () => flip(true) });
    return paint;
  };
  toggle('Reduzierte Bewegung', () => settings.reducedMotion, v => updateSettings({ reducedMotion: v }));
  const fsSupported = typeof document.documentElement.requestFullscreen === 'function';
  if (fsSupported) {
    const paintFs = toggle('Vollbild', () => Boolean(document.fullscreenElement), v => {
      if (v && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else if (!v && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    });
    paintFullscreen = () => { if (rows.isConnected) paintFs(); else paintFullscreen = null; };
  }

  if (onBack) {
    const back = el('button', 'menu-item set-back', 'Zurück');
    back.type = 'button';
    rows.appendChild(back);
    items.push({ el: back, activate: onBack });
  }
  // Rows are not buttons: clicking anywhere on a row selects it.
  return new NavList(items);
}

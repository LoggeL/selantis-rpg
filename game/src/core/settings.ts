import { events } from './events';

export interface Settings {
  music: number;        // 0..1
  sfx: number;          // 0..1
  textSpeed: number;    // characters per second, 0 = instant
  reducedMotion: boolean;
}

const KEY = 'selantis.settings.v1';
const defaults: Settings = { music: 0.7, sfx: 0.8, textSpeed: 45, reducedMotion: false };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { ...defaults, reducedMotion: prefersReduced, ...(raw ? JSON.parse(raw) : {}) };
  } catch { return { ...defaults }; }
}

export const settings: Settings = load();

export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  events.emit('settings:changed', { ...settings });
}

import type { SfxName } from '../audio/api';
import { G } from '../core/G';

/** Small DOM helper: el('div', 'cls a', 'text') — text is set as textContent. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Creates an element from trusted HTML (our own templates / formatted text only). */
export function html<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, markup: string): HTMLElementTagNameMap[K] {
  const node = el(tag, cls);
  node.innerHTML = markup;
  return node;
}

export const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
export const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Plays a UI sound; never throws (audio may be locked or not yet attached). */
export function sfx(name: SfxName, opts?: { volume?: number; pitch?: number }): void {
  try { G.audio?.sfx(name, opts); } catch { /* audio optional */ }
}

export function blip(pitch: number, wave?: OscillatorType): void {
  try { G.audio?.blip(pitch, wave); } catch { /* audio optional */ }
}

export function dialogueFocus(on: boolean): void {
  try { G.audio?.dialogueFocus(on); } catch { /* audio optional */ }
}

/** Waits for a CSS transition/animation to settle, with a timeout fallback. */
export function settle(node: HTMLElement, ms: number): Promise<void> {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; node.removeEventListener('transitionend', onEnd); node.removeEventListener('animationend', onEnd); resolve(); };
    const onEnd = (e: Event) => { if (e.target === node) finish(); };
    node.addEventListener('transitionend', onEnd);
    node.addEventListener('animationend', onEnd);
    setTimeout(finish, ms + 60);
  });
}

/** Forces a style flush so a following class change animates. */
export function reflow(node: HTMLElement): void { void node.offsetWidth; }

/** Inline SVG icons drawn in code (no image assets). currentColor based. */
export const ICONS = {
  journal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M5 3.5h11.5a2 2 0 0 1 2 2V20a.5.5 0 0 1-.5.5H6.5A1.5 1.5 0 0 1 5 19z"/><path d="M5 17.5A1.5 1.5 0 0 1 6.5 16h12"/><path d="M8.5 7.5h6M8.5 10.5h4.5"/><path d="M15.5 3.5v6l-1.5-1-1.5 1v-6" fill="currentColor" stroke-width="1"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M9 7V5.8A3 3 0 0 1 12 3a3 3 0 0 1 3 2.8V7"/><path d="M4.5 9.5c0-1.4 1.1-2.5 2.5-2.5h10c1.4 0 2.5 1.1 2.5 2.5L18.6 19a2 2 0 0 1-2 1.5H7.4a2 2 0 0 1-2-1.5z"/><path d="M4.8 11.5c4.5 2 9.9 2 14.4 0"/><rect x="10.5" y="11.6" width="3" height="2.6" rx=".6" fill="currentColor" stroke-width="1"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/><circle cx="5" cy="7" r=".4" fill="currentColor"/></svg>',
  item: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M9 7V5.8A3 3 0 0 1 12 3a3 3 0 0 1 3 2.8V7"/><path d="M4.5 9.5c0-1.4 1.1-2.5 2.5-2.5h10c1.4 0 2.5 1.1 2.5 2.5L18.6 19a2 2 0 0 1-2 1.5H7.4a2 2 0 0 1-2-1.5z"/></svg>',
  memory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z"/><path d="M9.2 9.4c.4-.9 1.1-1.4 2-1.5" opacity=".7"/></svg>',
  lore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/></svg>',
  clue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="5.5"/><path d="M14.6 14.6 20 20"/><path d="M8 9a3 3 0 0 1 2.5-1.5" opacity=".7"/></svg>',
  objective: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M4 20.5 15.5 9"/><path d="M15.5 9c1-3.5 3.3-5.5 5-6-.3 2.3-1.8 5-5 6z" fill="currentColor" fill-opacity=".25"/><path d="M5 15.5l3.5 3.5"/></svg>',
  ability: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.8l2.2 6.1 6.3.2-5 3.9 1.8 6.2L12 15.6 6.7 19.2l1.8-6.2-5-3.9 6.3-.2z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/></svg>',
  hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M9 11.5V4.8a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2.5"/><path d="M15 11V10a1.5 1.5 0 0 1 3 0v4.5c0 3.6-2.6 6-6 6-2.5 0-4-1-5.3-3L4.4 13.8a1.5 1.5 0 0 1 2.3-1.9L9 14"/></svg>',
  run: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="14.5" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2.5V22"/><path d="M6 11l3.5-3 4 .5 2.5 3.5 3 1"/><path d="M11 15l2.5-7"/></svg>',
  sneak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="1.8"/><path d="M5 20l3-4.5 3.5 1L13 20"/><path d="M4 13.5l4-3.5 5 1.5 4 4"/><path d="M8 16l2-6"/><path d="M17 20h4" opacity=".6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".8" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M3 12 21 3.5 16.5 12 21 20.5z" fill="currentColor"/></svg>',
  quill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 3.5c-6 1-10.5 5.5-12.5 12l-1 4.5 4-2c5.5-2.5 9-7.5 9.5-14.5z" fill="currentColor" fill-opacity=".18"/><path d="M6.5 20 15 9.5"/></svg>',
  fullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, cls = 'ch-ico'): HTMLSpanElement {
  const span = el('span', cls);
  span.innerHTML = ICONS[name];
  span.setAttribute('aria-hidden', 'true');
  return span;
}

/** Blurs the focused element, so Space/Enter never re-trigger a previously clicked button. */
export function blurActive(): void {
  const active = document.activeElement as HTMLElement | null;
  if (active && active !== document.body && typeof active.blur === 'function') active.blur();
}

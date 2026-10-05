// Kapitel II shared helpers: warp state (cross-chapter contract), scene hand-off, small UI utilities.
import { G } from '../../core/G';
import { findScene } from '../../core/registry';
import type { UiApiExt } from '../../ui';

export const ui = () => G.ui as UiApiExt;

/** Scene-safe sleep (never resolves once the player left the scene). */
export const sleep = (ms: number) => ui().wait(ms);

/** Plays a sound effect; audio is optional (locked autoplay, tests). */
export function sfx(name: Parameters<typeof G.audio.sfx>[0], opts?: Parameters<typeof G.audio.sfx>[1]): void {
  try { G.audio.sfx(name, opts); } catch { /* audio optional */ }
}

/** The fixed Kapitel-I departure kit (DESIGN §7.4 trauer; contract: always given). */
export const DEPARTURE_KIT: [string, number][] = [
  ['bread', 2], ['cheese', 1], ['bacon', 1], ['waterskin', 1], ['blanket', 1], ['cloak', 1], ['coins', 1], ['tincture', 1], ['dagger', 1],
];

/**
 * State a direct warp into Kapitel II needs: the departure kit, a plausible bag choice (both books, no tinder,
 * like in the novel), the Kapitel-I abilities and Lia alone. Later scenes add on top of this.
 */
export function prepareKapitel2Base(): void {
  for (const [id, n] of DEPARTURE_KIT) G.state.give(id, n);
  G.state.give('book-alana');
  G.state.give('book-herbs');
  G.state.learn('spurenblick');
  G.state.learn('schleichen');
  G.state.setParty([]);
}

/** Everything the road scene produced (decision east). */
export function prepareAfterStrasse(): void {
  prepareKapitel2Base();
  G.state.set('k2-entschieden', 'osten');
  G.state.addClue('k2-hufspuren');
  G.state.addClue('k2-wegweiser');
  G.state.addLore('k2-lore-trapas');
}

/** Everything the first camp produced (fire burning, Lia asleep on her cloak). */
export function prepareAfterLager(): void {
  prepareAfterStrasse();
  G.state.take('bread');
  G.state.set('k2-feuer');
  G.state.set('k2-gegessen');
  G.state.set('k2-schlafplatz');
}

/** Everything the night with Foltan and Azar produced. */
export function prepareAfterFoltanAzar(): void {
  prepareAfterLager();
  G.state.setParty(['foltan', 'azar']);
  G.state.set('k2-foltan-azar');
  G.state.addLore('k2-lore-kodex');
  G.state.addLore('k2-lore-rat-der-drei');
  G.state.addLore('k2-lore-crios');
}

/**
 * Goes to the next story scene; if that chapter is not installed (yet), ends gracefully at the title instead
 * of throwing.
 */
export async function gotoNext(id: string): Promise<void> {
  if (findScene(id)) { await G.goto(id); return; }
  console.warn(`[kapitel-2] next scene '${id}' is not available`);
  await G.ui.narrate('Hier endet dieser Teil der Chronik. Die Geschichte geht weiter …', { style: 'card' });
  const m = await import('../../scenes/BootScene');
  await m.showTitle();
}

/** Escapes text for innerHTML. */
export function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** True for the „confirm“ keys of minigame panels. */
export function isConfirmKey(e: KeyboardEvent): boolean {
  return e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E';
}

/** Fire-and-forget for world promises (emotes, long light fades): they reject silently when the scene ends. */
export function bg(p: Promise<unknown>): void {
  p.catch(() => { /* scene ended */ });
}

/** True when the UI runs in touch mode (touch device or ?touch), like the UI kit's own prompts. */
export function touchUi(): boolean {
  return document.getElementById('ui')?.classList.contains('is-touch') ?? false;
}

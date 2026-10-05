// Shared helpers of Kapitel III: warp state (prepare), dialogue shortcuts, scene-safe polling.
import { G } from '../../core/G';
import type { UiApiExt } from '../../ui';
import type { WorldCtx } from '../../world';
import { BOARD_CLUES } from './deduce';

export const ui = () => G.ui as UiApiExt;

/** Kapitel I departure kit (always packed) — see the cross-chapter contract. */
const KIT: [string, number][] = [
  ['bread', 2], ['cheese', 1], ['bacon', 1], ['waterskin', 1], ['blanket', 1], ['cloak', 1], ['coins', 1], ['tincture', 1], ['dagger', 1],
];

/**
 * State a direct warp into Kapitel III needs: Lia with her travel kit and both books (as in the novel), the
 * abilities from Kapitel I, Foltan and Azar as party (Kapitel II).
 */
export function prepareKapitel3(): void {
  for (const [id, n] of KIT) if (!G.state.has(id)) G.state.give(id, n);
  if (!G.state.has('book-alana')) G.state.give('book-alana');
  if (!G.state.has('book-herbs')) G.state.give('book-herbs');
  G.state.learn('spurenblick');
  G.state.learn('schleichen');
  G.state.setParty(['foltan', 'azar']);
}

/** Lia in travel clothes. */
export function lia(w: WorldCtx, text: string, mood?: string): Promise<void> {
  return w.say('k3-lia', text, mood ? { mood } : undefined);
}

/** Board clues found so far. */
export function boardCount(): number {
  return BOARD_CLUES.filter(id => G.state.hasClue(id)).length;
}

/** Waits (scene-safe) until `cond` is true. */
export async function until(w: WorldCtx, cond: () => boolean, stepMs = 200): Promise<void> {
  while (!cond()) await w.wait(stepMs);
}

export function sfx(name: Parameters<typeof G.audio.sfx>[0], opts?: Parameters<typeof G.audio.sfx>[1]): void {
  try { G.audio.sfx(name, opts); } catch { /* audio optional */ }
}

export function music(mood: Parameters<typeof G.audio.music>[0], fadeMs?: number): void {
  try { G.audio.music(mood, fadeMs ? { fadeMs } : undefined); } catch { /* audio optional */ }
}

export function ambience(layers: Parameters<typeof G.audio.ambience>[0], volume?: Parameters<typeof G.audio.ambience>[1]): void {
  try { G.audio.ambience(layers, volume); } catch { /* audio optional */ }
}

/**
 * Walks an actor to a point in a cutscene, but never hangs: after `ms` (or when blocked) it teleports the rest of
 * the way. Cutscenes must not stall because someone stands in a narrow aisle.
 */
export async function walk(w: WorldCtx, id: string, to: [number, number], opts: { face?: 'up' | 'down' | 'left' | 'right'; run?: boolean } = {}, ms = 5000): Promise<void> {
  const a = id === 'player' ? w.player : w.actor(id);
  await Promise.race([a.walkTo(to, opts), w.wait(ms)]);
  if (Math.hypot(a.x - to[0], a.y - to[1]) > 6) {
    a.hold(true); // stops the pending path
    a.teleport(to, opts.face);
    if (id === 'player') a.hold(false);
  } else if (opts.face) a.face(opts.face);
}

/** Fire-and-forget for world promises: they reject with WorldStopped when the scene ends — that is expected. */
export function bg(p: Promise<unknown>): void {
  p.catch(() => { /* scene ended */ });
}

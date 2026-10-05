// Shared helpers of Kapitel IV: warp state, Lia's travel-outfit lines, corridor geometry, small engine bridges.
import type Phaser from 'phaser';
import { G } from '../../core/G';
import { virtualInput } from '../../core/input';
import { findScene } from '../../core/registry';
import type { UiApiExt } from '../../ui';
import type { Polygon, WorldCtx } from '../../world';

/** Lia wears her travel clothes from Kapitel II on (cross-chapter contract). */
export const LIA = 'lia-cloak';

/** Lia speaks with her travel-outfit portrait. */
export function lia(w: WorldCtx, text: string, mood?: string): Promise<void> {
  return w.say('k4-lia', text, mood ? { mood } : undefined);
}

/** Scene-safe sleep outside a world context. */
export function sleep(ms: number): Promise<void> {
  return (G.ui as UiApiExt).wait(ms);
}

/**
 * State a direct warp into Kapitel IV needs (what Kapitel I–III would have produced): travel pack, the books Lia
 * most likely carries, Kyra's ribbon from the Goldener Eber, Spurenblick + Schleichen, Foltan and Azar as party.
 */
export function prepareKapitel4(stage: 'augenbinde' | 'bruderschaft' | 'verrat'): void {
  const s = G.state;
  for (const id of ['bread', 'cheese', 'bacon', 'waterskin', 'blanket', 'cloak', 'coins', 'tincture', 'dagger', 'book-alana', 'ribbon']) s.give(id);
  s.learn('spurenblick');
  s.learn('schleichen');
  s.set('k3-luege-bemerkt');
  s.setParty(['foltan', 'azar']);
  if (stage === 'augenbinde') return;
  s.set('k4-augenbinde-done');
  if (stage === 'bruderschaft') return;
  s.set('k4-training-done');
  s.learn('ausweichen');
  s.learn('ablenken');
}

/** Hands over to the next chapter (contract: kapitel-4 → 'regenwald'); falls back to the title while Kapitel V is missing. */
export async function gotoNextChapter(): Promise<void> {
  G.state.set('k4-done');
  if (findScene('regenwald')) { await G.goto('regenwald'); return; }
  console.warn('[kapitel-4] Szene „regenwald“ (Kapitel V) fehlt noch – zurück zum Titel.');
  const { showTitle } = await import('../../scenes/BootScene');
  showTitle();
}

/**
 * Walkable corridor along a polyline: one quad per segment plus an octagon at every joint (the walk union of a
 * MapDef merges them). Used for forest paths that are only walkable on and right next to the painted path.
 */
export function corridor(points: [number, number][], half: number): Polygon[] {
  const out: Polygon[] = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    const oct: [number, number][] = [];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; oct.push([Math.round(x + Math.cos(a) * half), Math.round(y + Math.sin(a) * half)]); }
    out.push(oct);
    if (i === points.length - 1) break;
    const [x2, y2] = points[i + 1];
    const len = Math.hypot(x2 - x, y2 - y) || 1;
    const nx = (-(y2 - y) / len) * half, ny = ((x2 - x) / len) * half;
    out.push([[Math.round(x + nx), Math.round(y + ny)], [Math.round(x2 + nx), Math.round(y2 + ny)], [Math.round(x2 - nx), Math.round(y2 - ny)], [Math.round(x - nx), Math.round(y - ny)]]);
  }
  return out;
}

/** Minimal view on world-scene internals this chapter needs (see engine wishes in the chapter report). */
interface WorldInternals {
  addOverlay<T extends Phaser.GameObjects.GameObject>(obj: T): T;
  toScreen(x: number, y: number): { x: number; y: number };
  player?: { x: number; y: number; speed: number; sneaking: boolean };
  keys?: Record<string, Phaser.Input.Keyboard.Key>;
  guards?: { actor: { id: string }; def: { id: string }; calmDown(): void }[];
}

export function internals(w: WorldCtx): WorldInternals {
  return w.scene as unknown as WorldInternals;
}

/** Movement intent from keyboard or touch stick (to notice Lia pushing against something in the dark). */
export function moveIntent(w: WorldCtx): { x: number; y: number } {
  const k = internals(w).keys;
  let x = 0, y = 0;
  if (k) {
    if (k.A?.isDown || k.LEFT?.isDown) x -= 1;
    if (k.D?.isDown || k.RIGHT?.isDown) x += 1;
    if (k.W?.isDown || k.UP?.isDown) y -= 1;
    if (k.S?.isDown || k.DOWN?.isDown) y += 1;
  }
  if (Math.abs(virtualInput.x) > 0.12 || Math.abs(virtualInput.y) > 0.12) { x += virtualInput.x; y += virtualInput.y; }
  return { x, y };
}

/** True while the player holds the sneak control (C / Ctrl / touch). */
export function sneakHeld(w: WorldCtx): boolean {
  return Boolean(internals(w).player?.sneaking);
}

/** Plays a sound effect; audio is optional (locked before the first gesture). */
export function sfx(name: Parameters<typeof G.audio.sfx>[0], opts?: Parameters<typeof G.audio.sfx>[1]): void {
  try { G.audio.sfx(name, opts); } catch { /* audio optional */ }
}

/** Runs a script promise in the background; a scene that ends meanwhile rejects it silently (WorldStopped). */
export function bg(p: Promise<unknown>): void {
  p.catch(() => { /* scene ended */ });
}

/** Stops scripted walks before the scene ends (pending walks with a final facing break the world teardown). */
export function halt(w: WorldCtx, ids: string[]): void {
  for (const id of ids) { const a = w.actor(id); if (a.exists) { a.hold(true); a.hold(false); } }
}

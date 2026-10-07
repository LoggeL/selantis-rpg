import { events } from '../core/events';
import { findScene, getChapters } from '../core/registry';

/**
 * Meta progress across all saves: which story scenes the player has reached (chapter select only offers those)
 * and the „alles freischalten“ cheat (chapters + gallery). Kept apart from the save game on purpose: starting a
 * new game or warping must not lock anything again.
 */

const STORE = 'selantis.progress.v1';
const SAVE = 'selantis.save.v1';
interface Progress { reached: string[]; all?: boolean }

let data: Progress | null = null;

function load(): Progress {
  if (data) return data;
  data = { reached: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Progress | null;
    if (raw && Array.isArray(raw.reached)) data = { reached: raw.reached, all: Boolean(raw.all) };
    else seedFromSave(data);
  } catch { /* storage optional */ }
  return data;
}

function save(): void {
  try { localStorage.setItem(STORE, JSON.stringify(data)); } catch { /* storage optional */ }
}

/** Campaign scenes in story order (dev chapters left out). */
function campaign(): string[] {
  return getChapters().filter(c => !c.hidden).flatMap(c => c.scenes.map(s => s.id));
}

/** First run with this store: everything up to the scene of an existing campaign save counts as reached. */
function seedFromSave(p: Progress): void {
  try {
    const scene = (JSON.parse(localStorage.getItem(SAVE) ?? 'null') as { scene?: string } | null)?.scene;
    const order = campaign();
    const at = scene ? order.indexOf(scene) : -1;
    if (at >= 0) p.reached = order.slice(0, at + 1);
  } catch { /* storage optional */ }
}

export function markReached(sceneId: string): void {
  const found = findScene(sceneId);
  if (!found || found.chapter.hidden) return;
  const p = load();
  if (p.reached.includes(sceneId)) return;
  p.reached.push(sceneId);
  save();
}

export function sceneUnlocked(sceneId: string): boolean {
  const p = load();
  return Boolean(p.all) || p.reached.includes(sceneId);
}

/** The cheat: every chapter, scene and gallery picture is open from now on. */
export function unlockEverything(): void {
  load().all = true;
  save();
}

export function everythingUnlocked(): boolean { return Boolean(load().all); }

let tracking = false;
/** Records every scene the story enters (G.goto emits 'scene:goto'). */
export function trackProgress(): void {
  if (tracking) return;
  tracking = true;
  events.on('scene:goto', (e: { id: string }) => markReached(e.id));
}

/**
 * Cheat input on the title screen: the classic ↑ ↑ ↓ ↓ ← → ← → B A (touch: tap the logo seven times, see title.ts).
 * Returns true when the sequence just completed.
 */
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
export function cheatInput(): (e: KeyboardEvent) => boolean {
  let k = 0;
  return e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    k = key === KONAMI[k] ? k + 1 : key === 'ArrowUp' ? (k === 2 ? 2 : 1) : 0;
    if (k < KONAMI.length) return false;
    k = 0;
    return true;
  };
}

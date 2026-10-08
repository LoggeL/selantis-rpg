// Teil III „Falscher Glaube“: shared helpers, the documented warp state per scene, staff and poison state.
// Scene modules own their maps and scripts; this file only holds what several scenes need (docs/teil-3/umsetzung.md).
import type { AmbienceLayer, SfxName, SfxOptions } from '../../audio/api';
import { G } from '../../core/G';
import type { SceneEntry } from '../../core/registry';
import type { UiApiExt } from '../../ui';
import type { WorldCtx } from '../../world';
import { E2_FLAGS, STAFF, prepareBook2EndState } from '../common/bookContract';

export const ui = (): UiApiExt => G.ui as UiApiExt;

/** Story order of Teil III (index.ts registers the scenes in exactly this order). */
export const E3_SCENES = [
  'e3-valentus', 'e3-eigener-stab', 'e3-paladine', 'e3-schutzreaktion', 'e3-macht-und-schutz', 'e3-falscher-glaube',
  'e3-kyras-fluchtweg', 'e3-waldgegner', 'e3-vertraute-schwester', 'e3-falle', 'e3-innere-zuflucht', 'e3-flicks-hilfe',
  'e3-hoffnung-und-weigerung', 'e3-ritual', 'e3-ritualangriff', 'e3-vamir', 'e3-ignatius-abschied', 'e3-hueterin',
  'e3-epilog',
] as const;
export type E3Scene = typeof E3_SCENES[number];

/** Cold violet of Vamir's magic (never turquoise). */
export const VIOLET = 0x9a6cff;
/** Warm amber of Ignatius' magic. */
export const AMBER = 0xffc46b;
/** Turquoise of the Urmacht and of Valentus' apparition. */
export const TURQUOISE = 0x5fe0d0;

// ---------------------------------------------------------------------------------------------------------------
// Staffs and poison (umsetzung.md §2, binding)
// ---------------------------------------------------------------------------------------------------------------

/** Where Lia's own staff is right now. */
export type StaffPlace = 'lia' | 'waffenkammer' | 'flick';
export const STAFF_PLACE_FLAG = 'e3-stab-ort';

/** Lia really carries her own staff (inventory is the truth; the flag only says where it is otherwise). */
export function hasOwnStaff(): boolean {
  return G.state.has(STAFF.own);
}

export function staffPlace(): StaffPlace | undefined {
  return G.state.flag<StaffPlace>(STAFF_PLACE_FLAG);
}

/** Moves Lia's own staff away from her (confiscated, carried by Flick). Inventory follows. */
export function staffAway(place: Exclude<StaffPlace, 'lia'>): void {
  G.state.take(STAFF.own, G.state.count(STAFF.own));
  G.state.set(STAFF_PLACE_FLAG, place);
}

/** Gives the staff back exactly once per return (guarded by `flag`); never duplicates it. */
export function staffBack(flag: string): boolean {
  if (G.state.is(flag) && hasOwnStaff()) return false;
  G.state.set(flag);
  if (!hasOwnStaff()) G.state.give(STAFF.own);
  G.state.set(STAFF_PLACE_FLAG, 'lia');
  return true;
}

/** Lia is weakened by Vamir's poison (from the sisters' camp until the order's healer in e3-hueterin). */
export function poisoned(): boolean {
  return G.state.is('e3-vergiftet') && !G.state.is('e3-gift-abklingend');
}

/** Battle factor for Lia's HP/MP while poisoned. */
export const POISON_FACTOR = 0.6;

/** Lia's world look by state: bound / own staff / borrowed staff / travel cloak (falls back if a sprite is missing). */
export function liaLook(opts: { bound?: boolean } = {}): string {
  const has = (id: string) => G.art.hasAsset('character', id);
  if (opts.bound && has('e3-lia-gefesselt')) return 'e3-lia-gefesselt';
  if (hasOwnStaff() && has('e3-lia-eigenstab')) return 'e3-lia-eigenstab';
  if (G.state.has(STAFF.borrowed) && has('e2-lia-stab')) return 'e2-lia-stab';
  return 'lia-cloak';
}

/** WorldScene sets the player's walk speed to 64 × worldScale px/s (run 108 ×), freshly on every map it builds. */
export const ENGINE_WALK = 64;
/** Poisoned, Lia walks at this share of the engine's walk speed … */
export const POISON_WALK = 0.6;
/** … and her „run“ is barely faster than that walk. */
export const POISON_RUN = 1.25;

/** Lia's walk speed as a share of the engine's player speed (1 = normal, POISON_WALK while poisoned). */
export function liaSpeedFactor(): number {
  return poisoned() ? POISON_WALK : 1;
}

/** Lia's walk speed in px/s on a map with world scale `k` (engine default 1.75). */
export function liaSpeed(k = 1.75): number {
  return Math.round(ENGINE_WALK * k * liaSpeedFactor());
}

/**
 * Sets Lia's gait on the current map: the engine's walk speed times liaSpeedFactor(); poisoned, her run is capped to
 * POISON_RUN × that walk as well (engine field, read defensively). The engine resets both on every map it builds, so
 * call this again after a map change.
 */
export function liaGait(w: WorldCtx): void {
  w.player.setSpeed(liaSpeed(w.map?.worldScale ?? 1.75));
  if (!poisoned()) return;
  const body = (w.scene as unknown as { player?: { walkSpeed: number; runSpeed: number } }).player;
  if (body) body.runSpeed = Math.min(body.runSpeed, body.walkSpeed * POISON_RUN);
}

// ---------------------------------------------------------------------------------------------------------------
// Speaking and small engine bridges
// ---------------------------------------------------------------------------------------------------------------

/** Lia speaks (travel portrait). */
export function lia(w: WorldCtx, text: string, mood?: string): Promise<void> {
  return w.say('e3-lia', text, mood ? { mood } : undefined);
}

export function sfx(name: SfxName, opts?: SfxOptions): void {
  try { G.audio.sfx(name, opts); } catch { /* audio optional */ }
}

export function ambience(layers: AmbienceLayer[], volume?: Partial<Record<AmbienceLayer, number>>, fadeMs = 1600): void {
  try { G.audio.ambience(layers, { fadeMs, volume }); } catch { /* audio optional */ }
}

/** Scene-safe sleep outside a world context. */
export function sleep(ms: number): Promise<void> {
  return ui().wait(ms);
}

/** Next Teil-III scene (G.goto). Clears the transient UI of the scene being left first (knowledge kept apart). */
export async function nextScene(id: E3Scene, params?: Record<string, unknown>): Promise<void> {
  ui().reset({ keepFade: true });
  await G.goto(id, params);
}

/** Runs a script promise in the background; a scene that ends meanwhile rejects it silently. */
export function bg(p: Promise<unknown>): void {
  p.catch(() => { /* scene ended */ });
}

/** Waits until `cond` holds (polling, scene-safe). */
export async function until(w: WorldCtx, cond: () => boolean, stepMs = 200): Promise<void> {
  while (!cond()) await w.wait(stepMs);
}

/** Visible framing for scenes Lia does not witness (enemy, Flick): black card with the location line. */
export async function interlude(line: string): Promise<void> {
  await ui().fade('out', 500);
  await G.ui.narrate([line], { style: 'card' });
}

/** Once-only grant (items, abilities, progress): runs `give` the first time and marks `flag`. */
export function grantOnce(flag: string, give: () => void): boolean {
  if (G.state.is(flag)) return false;
  G.state.set(flag);
  give();
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Regular entry from Teil II
// ---------------------------------------------------------------------------------------------------------------

/**
 * Called once at the start of e3-valentus on a continued campaign: keeps everything (levels, EXP, inventory,
 * abilities, choices); only closes Teil-II objectives that would otherwise linger in the HUD and empties the party.
 * Never resets. Idempotent (a reload of e3-valentus runs it again harmlessly).
 */
export function enterBook3(): void {
  for (const o of G.state.data.objectives) if (!o.done) G.state.complete(o.id);
  G.state.setParty([]);
  if (G.state.flag('e3-eingang') === undefined) G.state.set('e3-eingang', G.state.is(E2_FLAGS.finished) ? 'teil-2' : 'direkt');
}

// ---------------------------------------------------------------------------------------------------------------
// Direct-entry state (prepare): what Teil II and the earlier Teil-III scenes would have produced
// ---------------------------------------------------------------------------------------------------------------

/** Flags (and other effects) each scene leaves behind when it ends; prepareE3 applies all of those before the target. */
const AFTER: Record<E3Scene, () => void> = {
  'e3-valentus': () => { G.state.set('e3-valentus-getroffen'); },
  'e3-eigener-stab': () => {
    grantOnce('e3-stab-erhalten', () => { G.state.give(STAFF.own); G.state.set(STAFF_PLACE_FLAG, 'lia'); });
    grantOnce('e3-schattentoeter-zurueck', () => G.state.take(STAFF.borrowed, G.state.count(STAFF.borrowed)));
    G.state.set('e3-ignatius-zurueck');
    G.state.learn('e3-stabstrahl');
  },
  'e3-paladine': () => { G.state.set('e3-gefangen-genommen'); staffAway('waffenkammer'); G.state.addLore('e3-lore-lichterorden'); },
  'e3-schutzreaktion': () => { G.state.set('e3-schutz-ausgeloest'); },
  'e3-macht-und-schutz': () => { G.state.set('e3-untersucht'); G.state.set('e3-verhandelt'); G.state.set('e3-verhandlung-ton', 'klug'); },
  'e3-falscher-glaube': () => { G.state.set('e3-gelauscht'); G.state.addClue('e3-hinweis-gwynn'); G.state.addLore('e3-lore-glaube'); },
  'e3-kyras-fluchtweg': () => { G.state.set('e3-geflohen'); G.state.set('e3-stab-zurueckgelassen'); G.state.addClue('e3-kyras-bericht'); },
  'e3-waldgegner': () => { G.state.set('e3-flick-ghule'); },
  'e3-vertraute-schwester': () => { G.state.set('e3-vergiftet'); G.state.set('e3-gift-plan'); },
  'e3-falle': () => { G.state.set('e3-gefangen'); },
  'e3-innere-zuflucht': () => { G.state.set('e3-zuflucht-1'); },
  'e3-flicks-hilfe': () => { G.state.set('e3-flick-gemeldet'); G.state.set(STAFF_PLACE_FLAG, 'flick'); G.state.set('e3-orden-rueckt-aus'); },
  'e3-hoffnung-und-weigerung': () => { G.state.set('e3-geweigert'); G.state.set('e3-relikte-plan'); },
  'e3-ritual': () => { G.state.set('e3-ritual-begonnen'); },
  'e3-ritualangriff': () => {
    G.state.set('e3-kyra-frei'); staffBack('e3-stab-zurueck'); G.state.set('e3-ritual-gebrochen'); G.state.addLore('e3-lore-relikte');
  },
  'e3-vamir': () => {
    // Lia picked up Ignatius' lost Schattentöter on the path (vamir-spur.ts) and won the duel.
    grantOnce('e3-schattentoeter-gefunden', () => { if (!G.state.has(STAFF.borrowed)) G.state.give(STAFF.borrowed); });
    G.state.set('e3-duell-gewonnen');
    G.state.set('e3-vamir-besiegt');
  },
  'e3-ignatius-abschied': () => { G.state.set('e3-ignatius-tot'); G.state.set('e3-versoehnt'); G.state.setParty(['kyra', 'flick']); },
  'e3-hueterin': () => {
    G.state.set('e3-hueterin'); grantOnce('e3-fibel-erhalten', () => G.state.give('e3-ordensfibel'));
    G.state.set('e3-gift-abklingend'); G.state.set('e3-orden-auftrag', 'schutz');
  },
  'e3-epilog': () => { G.state.set('e3-finished'); },
};

/**
 * Documented default state for a direct entry into `stage` (chapter select, F2, ?scene=): the end state of Teil II
 * (bookContract.prepareBook2EndState: Lia alone with Schattentöter, Lichtstoß and Stabimpuls known, Kyra controlled,
 * Flick escaped, Elnon struck) plus every earlier Teil-III scene. Only called from prepare() after G.warp reset the
 * state — never on a continued campaign.
 */
export function prepareE3(stage: E3Scene): void {
  prepareBook2EndState();
  G.state.set('e3-eingang', 'direkt');
  const at = E3_SCENES.indexOf(stage);
  for (let i = 0; i < at; i++) AFTER[E3_SCENES[i]]();
}

/** Builds a scene entry with the standard prepare (plus optional scene-specific extras). */
export function e3Scene(id: E3Scene, title: string, start: SceneEntry['start'], extraPrepare?: () => void): SceneEntry {
  return { id, title, start, prepare: () => { prepareE3(id); extraPrepare?.(); } };
}

// Teil II „Letzte Hoffnung“: shared helpers, the documented warp state per scene and once-only reward guards.
// Scene modules own their maps and scripts; this file only holds what several scenes need (docs/teil-2/umsetzung.md).
import type { AmbienceLayer, SfxName, SfxOptions } from '../../audio/api';
import { G } from '../../core/G';
import type { SceneEntry } from '../../core/registry';
import type { UiApiExt } from '../../ui';
import type { WorldCtx } from '../../world';
import { STAFF } from '../common/bookContract';

export const ui = (): UiApiExt => G.ui as UiApiExt;

/** Story order of Teil II (index.ts registers the scenes in exactly this order). */
export const E2_SCENES = [
  'e2-taverne', 'e2-bruderschaft', 'e2-pruefung', 'e2-flicks-herkunft', 'e2-lagerangriff', 'e2-der-fremde',
  'e2-gefangene', 'e2-urmacht', 'e2-flicks-verhoer', 'e2-konzentration', 'e2-flicks-erinnerungen',
  'e2-kyras-widerstand', 'e2-ignatius', 'e2-zellengespraeche', 'e2-stabtraining', 'e2-flick-entkommt',
  'e2-kontrolle', 'e2-aufbruch',
] as const;
export type E2Scene = typeof E2_SCENES[number];

/** Cold violet of the Master's magic (never turquoise). */
export const VIOLET = 0x9a6cff;
/** Warm amber of Ignatius' small sleep gesture (adaptation, docs/teil-2/adaption.md). */
export const AMBER = 0xffc46b;

// ---------------------------------------------------------------------------------------------------------------
// Speaking and small engine bridges
// ---------------------------------------------------------------------------------------------------------------

/** Lia speaks (travel portrait). */
export function lia(w: WorldCtx, text: string, mood?: string): Promise<void> {
  return w.say('e2-lia', text, mood ? { mood } : undefined);
}

/** Lia's world look: with the borrowed staff once she owns it and the sprite exists. */
export function liaLook(): string {
  return G.state.has(STAFF.borrowed) && G.art.hasAsset('character', 'e2-lia-stab') ? 'e2-lia-stab' : 'lia-cloak';
}

/** Ignatius speaks; before he introduces himself he is „Der Fremde“ for Lia and the player. */
export function mentor(): string {
  return G.state.is('e2-ignatius-vorgestellt') ? 'e2-ignatius' : 'e2-fremder';
}

/** The Master's speaker: „Der Meister“ until Ignatius named him, then „Vamir“. */
export function master(): string {
  return G.state.is('e2-ignatius-vorgestellt') ? 'e2-vamir' : 'vamir';
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

/**
 * Next Teil-II scene or part (G.goto). Like the title's scene transition, the transient UI of the scene being left
 * (toasts, bubbles, hints, letterbox) is cleared first, so e.g. a 'Ziel erledigt' toast from Flick's interlude never
 * shows up in Lia's morning (umsetzung.md §1, knowledge kept apart). Keeps the fade, so call it after fading out.
 */
export async function nextScene(id: E2Scene, params?: Record<string, unknown>): Promise<void> {
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

/**
 * Visible framing for scenes Lia does not witness (captivity, the enemy): black card with the location line.
 * Keeps player knowledge and Lia's knowledge apart (docs/teil-2/umsetzung.md §1).
 */
export async function interlude(line: string): Promise<void> {
  await ui().fade('out', 500);
  await G.ui.narrate([line], { style: 'card' });
}

/**
 * Once-only grant (items, abilities, progress): runs `give` the first time and marks `flag`. Returns true when it ran.
 * Reloads restart a scene from its saved start, where the flag is already part of the save once it was granted.
 */
export function grantOnce(flag: string, give: () => void): boolean {
  if (G.state.is(flag)) return false;
  G.state.set(flag);
  give();
  return true;
}

/** Records once on entering Teil II whether Lia already knew Lichtstoß from the optional travel (both ways supported). */
export function noteLichtstossOrigin(): void {
  if (G.state.flag('e2-lichtstoss-vorher') === undefined) G.state.set('e2-lichtstoss-vorher', G.state.knows('lichtstoss'));
}

/** Whether Lia brought Lichtstoß from book one's optional travel (as opposed to learning it from Ignatius). */
export function knewLichtstossBefore(): boolean {
  return G.state.flag('e2-lichtstoss-vorher') === true;
}

// ---------------------------------------------------------------------------------------------------------------
// Direct-entry state (prepare): what book one and the earlier Teil-II scenes would have produced
// ---------------------------------------------------------------------------------------------------------------

/** Book-one travel kit (whatever the player really packed stays with a real save; this is the documented default). */
const KIT: [string, number][] = [
  ['bread', 1], ['cheese', 1], ['bacon', 1], ['waterskin', 1], ['blanket', 1], ['cloak', 1], ['coins', 1], ['tincture', 1],
  ['dagger', 1], ['book-alana', 1],
];

/** Flags (and other effects) each scene leaves behind when it ends; prepareE2 applies all of those before the target. */
const AFTER: Record<E2Scene, () => void> = {
  'e2-taverne': () => { G.state.set('e2-taverne-done'); G.state.addClue('e2-spur-zugang'); },
  'e2-bruderschaft': () => { G.state.set('e2-angekommen'); G.state.set('e2-foltan-haltung', 'kalt'); },
  'e2-pruefung': () => { G.state.set('e2-pruefung-done'); G.state.addLore('e2-lore-pruefung'); },
  'e2-flicks-herkunft': () => { G.state.set('e2-flick-zugehoerig'); },
  'e2-lagerangriff': () => { G.state.set('e2-getrennt'); G.state.setParty([]); },
  'e2-der-fremde': () => { G.state.set('e2-fremder-done'); },
  'e2-gefangene': () => { G.state.set('e2-gefangene-done'); G.state.set('e2-flick-sah-ring'); },
  'e2-urmacht': () => {
    G.state.set('e2-urmacht-erklaert'); G.state.set('e2-urmacht-antwort', 'freunde');
    G.state.addLore('e2-lore-xenovia'); G.state.addLore('e2-lore-valentus');
  },
  'e2-flicks-verhoer': () => { G.state.set('e2-verhoer-done'); G.state.set('e2-flick-nagel'); },
  // The documented default enters Teil II without Lichtstoß, so the concentration exercise is where Lia learned it.
  'e2-konzentration': () => { G.state.set('e2-konzentration-done'); G.state.set('e2-konz-lichtstoss'); G.state.learn('lichtstoss'); },
  'e2-flicks-erinnerungen': () => { G.state.set('e2-erinnerungen-done'); },
  'e2-kyras-widerstand': () => { G.state.set('e2-kyra-widerstand-done'); },
  'e2-ignatius': () => {
    G.state.set('e2-ignatius-vorgestellt');
    G.state.addLore('e2-lore-rat'); G.state.addLore('e2-lore-vamir');
    grantOnce('e2-staff-received', () => G.state.give(STAFF.borrowed));
  },
  'e2-zellengespraeche': () => { G.state.set('e2-versoehnt'); },
  'e2-stabtraining': () => { G.state.set('e2-training-complete'); G.state.learn('e2-stabimpuls'); },
  'e2-flick-entkommt': () => { G.state.set('e2-flick-escaped'); },
  'e2-kontrolle': () => { G.state.set('e2-kyra-controlled'); G.state.set('e2-elnon-struck'); },
  'e2-aufbruch': () => { G.state.set('e2-finished'); },
};

/**
 * Documented default state for a direct entry into `stage` (chapter select, F2, ?scene=). Book one finished on the
 * finale path WITHOUT the optional Lichtstoß; Flick and Kyra are the companions; every earlier Teil-II scene is done.
 * Only called from prepare() after G.warp reset the state — never on a continued campaign.
 */
export function prepareE2(stage: E2Scene): void {
  const s = G.state;
  for (const [id, n] of KIT) s.give(id, n);
  for (const a of ['spurenblick', 'schleichen', 'ausweichen', 'ablenken', 'urmacht']) s.learn(a);
  for (const f of ['k4-verrat', 'k5-flick-dabei', 'k5-urmacht', 'k5-erwacht', 'k5-weiter', 'k5-ende']) s.set(f);
  s.set('e2-lichtstoss-vorher', false);
  s.setParty(['flick', 'kyra']);
  const at = E2_SCENES.indexOf(stage);
  for (let i = 0; i < at; i++) AFTER[E2_SCENES[i]]();
}

/** Builds a scene entry with the standard prepare (plus optional scene-specific extras). */
export function e2Scene(id: E2Scene, title: string, start: SceneEntry['start'], extraPrepare?: () => void): SceneEntry {
  return { id, title, start, prepare: () => { prepareE2(id); extraPrepare?.(); } };
}

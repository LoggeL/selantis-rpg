// Kapitel V shared helpers: Lia's lines in her travel cloak, warp state per scene, audio helpers.
import type { CharAnim } from '../../art/api';
import type { AmbienceLayer, SfxName, SfxOptions } from '../../audio/api';
import { G } from '../../core/G';
import type { UiApiExt } from '../../ui';

export const ui = (): UiApiExt => G.ui as UiApiExt;

/** Static hiding crouch (art extension animation, see CharAnimExtra). */
export const CROUCH = 'crouch' as unknown as CharAnim;

/** Lia speaks (travel cloak portrait). */
export function lia(text: string, mood?: string): Promise<void> {
  return G.ui.say('k5-lia', text, mood ? { mood } : undefined);
}

export function sfx(name: SfxName, opts?: SfxOptions): void {
  try { G.audio.sfx(name, opts); } catch { /* audio optional */ }
}

export function ambience(layers: AmbienceLayer[], volume?: Partial<Record<AmbienceLayer, number>>, fadeMs = 1600): void {
  try { G.audio.ambience(layers, { fadeMs, volume }); } catch { /* audio optional */ }
}

/** Fixed travel kit from Kapitel I (whatever the player packed on top is chapter-specific). */
const KIT: [string, number][] = [
  ['bread', 1], ['cheese', 1], ['bacon', 1], ['waterskin', 1], ['blanket', 1], ['cloak', 1], ['coins', 1], ['tincture', 1], ['dagger', 1],
];

export type Stage = 'regenwald' | 'faehrte' | 'schattenlager' | 'rettung' | 'finale';
const ORDER: Stage[] = ['regenwald', 'faehrte', 'schattenlager', 'rettung', 'finale'];

/**
 * State a direct warp needs (prepare()): what Kapitel I–IV and the earlier Kapitel V scenes would have produced.
 * Inventory: the travel kit, the Alana book and Kyra's ribbon (Kapitel III). Abilities: everything learned so far.
 */
export function prepareStage(stage: Stage): void {
  const s = G.state;
  const at = ORDER.indexOf(stage);
  for (const [id, n] of KIT) s.give(id, n);
  s.give('book-alana');
  s.give('ribbon');
  for (const a of ['spurenblick', 'schleichen', 'ausweichen', 'ablenken']) s.learn(a);
  s.set('k4-verrat', true);
  s.setParty([]);
  if (at >= 1) {
    s.setParty(['flick']);
    s.set('k5-flick-dabei');
    s.addLore('k5-lore-leichenfresser');
  }
  if (at >= 2) {
    s.give('bead', 3);
    for (const c of ['k5-spur-hufe', 'k5-spur-zweige', 'k5-spur-frisch', 'k5-spur-perlen', 'k5-spur-asche']) s.addClue(c);
    s.addLore('k5-lore-grunwald');
  }
  if (at >= 3) {
    s.set('k5-ablenkung', 2);
    for (const c of ['k5-lager-wachen', 'k5-lager-kyra', 'k5-lager-weg']) s.addClue(c);
  }
  if (at >= 4) {
    s.setParty(['flick', 'kyra']);
    s.learn('urmacht');
    s.set('k5-urmacht');
  }
}

// Small helpers shared by the prologue scenes.
import { G } from '../../core/G';
import { settings } from '../../core/settings';
import type { AmbienceLayer, MusicMood, SfxName } from '../../audio/api';
import type { UiApiExt } from '../../ui';
import type { WorldCtx } from '../../world';
import type { WorldScene } from '../../world/WorldScene';

export const ui = (): UiApiExt => G.ui as UiApiExt;
/** Scene-safe sleep (never resolves after the scene was left). */
export const sleep = (ms: number): Promise<void> => ui().wait(ms);

export function sfx(name: SfxName, opts?: Parameters<typeof G.audio.sfx>[1]): void {
  try { G.audio.sfx(name, opts); } catch { /* audio optional */ }
}
export function music(mood: MusicMood | null, fadeMs = 1500): void {
  try { G.audio.music(mood, { fadeMs }); } catch { /* audio optional */ }
}
export function ambience(layers: AmbienceLayer[], fadeMs = 1500, volume?: Partial<Record<AmbienceLayer, number>>): void {
  try { G.audio.ambience(layers, { fadeMs, volume }); } catch { /* audio optional */ }
}

/** The engine scene behind a world context (camera, player tuning, screen projection). */
export const sceneOf = (w: WorldCtx): WorldScene => w.scene as unknown as WorldScene;

export const reducedMotion = (): boolean => Boolean((settings as unknown as { reducedMotion?: boolean }).reducedMotion);

/** Speech bubble anchored to a map position (for props such as the cradle). */
export function bubbleAt(w: WorldCtx, x: number, y: number, text: string, ms = 1800): () => void {
  const s = sceneOf(w);
  return G.ui.bubble(text, () => (w.alive ? s.toScreen(x, y) : null), ms);
}

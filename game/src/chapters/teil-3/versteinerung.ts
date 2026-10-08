// Vamir's petrification of Flick (e3-innere-zuflucht, camp cut) and its end at nightfall (e3-flicks-hilfe, part 1).
// The stone look is the painted figure `e3-flick-stein` (pose „frozen“ mid-run, „crumble“ for the breaking stone) when it exists; without
// it, Flick's own sprite is tinted grey and frozen, so the beat always reads.
import type { ArtExtras } from '../../art';
import { G } from '../../core/G';
import type { ActorHandle, WorldCtx } from '../../world';
import { VIOLET, bg, sfx } from './shared';

export const STONE_LOOK = 'e3-flick-stein';
const GREY = 0x8d8a86;

const hasStone = (): boolean => G.art.hasAsset('character', STONE_LOOK);

/** Turns the actor to stone on the spot: frozen frame, stone look (or grey tint). */
export function asStone(a: ActorHandle): void {
  if (hasStone()) {
    a.setLook(STONE_LOOK);
    if ((G.art as typeof G.art & ArtExtras).poseIds(STONE_LOOK).includes('frozen')) a.setIdle('frozen' as never);
  } else {
    a.sprite?.setTint(GREY);
    a.sprite?.anims.pause();
  }
}

/** Vamir raises his hand: a violet bolt runs from `from` to the actor, the light goes violet and she freezes mid-run. */
export async function petrify(w: WorldCtx, from: { x: number; y: number }, a: ActorHandle): Promise<void> {
  const glow = w.lighting.add({ id: 'e3-stein-glanz', at: [a.x, a.y - 18], kind: 'plain', color: VIOLET, radius: 80, intensity: 1.3, always: true });
  sfx('magic', { volume: 0.6, pitch: 0.6 });
  w.fx.burst([from.x, from.y - 24], 'smoke', 6);
  await w.wait(220);
  sfx('shockwave', { volume: 0.7, pitch: 0.55 });
  w.lighting.flash(VIOLET, 260);
  w.fx.burst([a.x, a.y - 20], 'dust', 14);
  asStone(a);
  sfx('stone-place', { volume: 0.7, pitch: 0.7 });
  w.camera.shake(220, 0.005);
  bg(glow.fadeTo(0, 2000).then(() => glow.remove()));
}

/** The stone cracks and falls away: dust, a dull crack, then Flick in her own look again (`look`). */
export async function breakStone(w: WorldCtx, a: ActorHandle, look: string): Promise<void> {
  for (let n = 0; n < 3; n++) {
    sfx('branch-snap', { volume: 0.35 + n * 0.15, pitch: 0.5 });
    w.fx.burst([a.x, a.y - 16 - n * 6], 'dust', 6 + n * 4);
    if (n === 1 && hasStone() && (G.art as typeof G.art & ArtExtras).poseIds(STONE_LOOK).includes('crumble')) a.setIdle('crumble' as never);
    await w.wait(650);
  }
  sfx('stone-place', { volume: 0.6, pitch: 1.3 });
  w.fx.burst([a.x, a.y - 20], 'dust', 22);
  a.sprite?.clearTint();
  a.sprite?.anims.resume();
  a.setLook(look);
  a.setIdle('idle');
}

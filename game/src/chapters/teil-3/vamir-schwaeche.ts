// Lia's poisoned gait for the last scenes before the order's healer (e3-vamir, e3-ignatius-abschied, e3-hueterin):
// slow walk and no real running (shared.liaGait), and now and then a stagger with a short bark. Nothing here changes
// state; it only reads poisoned() so the effect ends by itself once e3-gift-abklingend is set (umsetzung.md §2 Gift).
import { G } from '../../core/G';
import type { WorldCtx } from '../../world';
import { liaGait, poisoned } from './shared';

/** Lia's barks when she staggers in these scenes (round robin, ≤ 40 characters). */
export const LATE_STAGGER_BARKS: readonly string[] = [
  'Nicht jetzt umkippen.',
  'Der Boden schaukelt schon wieder.',
  'Kalt. Bis in die Finger.',
  'Weiter. Einen Fuß vor den anderen.',
];

/** Walking time (ms) between two staggers while poisoned. */
export const STAGGER_EVERY_MS = 6000;

/**
 * Sets the slow gait and staggers now and then while Lia walks, until `stop()` holds or the scene ends. Pauses while
 * any dialogue or panel is open, and only acts while the player can move.
 */
export async function poisonedGait(w: WorldCtx, stop: () => boolean = () => false, barks: readonly string[] = LATE_STAGGER_BARKS): Promise<void> {
  liaGait(w);
  if (!poisoned()) return;
  let walked = 0, n = 0, lx = w.player.x, ly = w.player.y;
  while (w.alive && !stop()) {
    await w.wait(200);
    if (G.ui.busy() || !poisoned()) { lx = w.player.x; ly = w.player.y; continue; }
    const moved = Math.hypot(w.player.x - lx, w.player.y - ly);
    lx = w.player.x; ly = w.player.y;
    if (moved > 1) walked += 200;
    if (walked < STAGGER_EVERY_MS) continue;
    walked = 0;
    w.lockPlayer();
    w.bark('player', barks[n++ % barks.length], 1600);
    await w.player.play('hurt' as never, { ms: 800 });
    w.unlockPlayer();
  }
}

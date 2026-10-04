import type Phaser from 'phaser';
import { unlockAudio } from "./audio";
import { prepareCampaignCheckpoint } from "../modules/campaign/checkpoints";
import { state } from "../platform/campaignRegistry";
import { resolveStartup } from "./sceneCatalog";

/** Boot delegates entry validation and checkpoint construction to the app. */
export function startInitialScene(scene: Phaser.Scene, search = window.location.search): void {
  const route = resolveStartup(search);
  const destination = route.checkpoint ? prepareCampaignCheckpoint(state(scene.registry), route.checkpoint) : route;
  if (route.direct) {
    // These gestures remain available after Boot shuts down for direct playtest entry.
    const unlock = () => { dispose(); unlockAudio(); };
    const dispose = () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      scene.game.events.off('destroy', dispose);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    scene.game.events.once('destroy', dispose);
  }
  scene.scene.start(destination.scene, destination.data);
}

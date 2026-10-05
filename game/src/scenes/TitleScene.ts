import Phaser from 'phaser';
import { backdropAnchor, hideBackdrop, showBackdrop } from '../ui/titleBackdrop';

/**
 * Title backdrop host. The painted night over Selantis (assets/ui/title.png) and all its animation live in
 * the DOM (ui/titleBackdrop.ts) so the 1280x720 painting stays sharp at every window size; this Phaser scene
 * only owns its lifetime (start = show, stop = hide), so G.stopGameplayScenes() clears it like any scene.
 *
 * data.mode: 'title' (default) covers the whole window; 'backdrop' maps the painting exactly onto the game
 * canvas (UI demo), so anchor() returns canvas coordinates that line up with the picture.
 */
export default class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create(data?: { mode?: 'title' | 'backdrop' }): void {
    this.cameras.main.setBackgroundColor('#05070f');
    showBackdrop(data?.mode === 'backdrop' ? 'stage' : 'title');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => hideBackdrop());
  }

  /** Canvas-space (640x360) anchors on the painting (for demos: bubbles, hints). */
  anchor(name: 'house' | 'tree' | 'crios' | 'firefly' | 'window'): { x: number; y: number } {
    return backdropAnchor(name);
  }
}

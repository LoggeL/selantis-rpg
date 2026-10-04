import Phaser from 'phaser';
import { G } from '../core/G';
import { GameState } from '../core/state';
import { getChapters } from '../core/registry';

/** Generates shared art, then routes to ?scene=<id> or the title screen. Stays registered but idle. */
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create(): void {
    G.art.init(this);
    void this.route();
  }

  private async route(): Promise<void> {
    const wanted = new URLSearchParams(location.search).get('scene');
    if (wanted) { await G.warp(wanted); return; }
    await showTitle();
  }
}

/** Shows the title screen and starts the chosen game. Also used by „Zum Titel“. */
export async function showTitle(): Promise<void> {
  G.stopGameplayScenes();
  G.ui.setHud('none');
  const choice = await G.ui.title();
  if (choice === 'continue' && GameState.hasSave() && G.state.load()) {
    await G.goto(G.state.data.scene, G.state.data.params);
  } else if (typeof choice === 'object') {
    await G.warp(choice.warp);
  } else {
    G.state.reset();
    const first = getChapters().find(c => !c.hidden)?.scenes[0];
    if (first) await G.goto(first.id);
  }
}

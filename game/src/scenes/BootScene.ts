import Phaser from 'phaser';
import { G } from '../core/G';
import { GameState } from '../core/state';
import { findScene, getChapters } from '../core/registry';
import type { UiApiExt } from '../ui';

const ui = () => G.ui as UiApiExt;

/** Generates shared art, then routes to ?scene=<id> or the title screen. Stays registered but idle. */
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create(): void {
    G.art.init(this);
    void this.route();
  }

  private async route(): Promise<void> {
    const wanted = new URLSearchParams(location.search).get('scene');
    if (wanted) {
      if (findScene(wanted)) {
        try { await G.warp(wanted); return; } catch (err) { console.error(`[boot] scene ${wanted} failed`, err); }
      } else console.warn(`[boot] unknown scene "${wanted}"`);
      setTimeout(() => G.ui.toast(`Szene „${wanted}“ gibt es nicht.`, 'info'), 1800);
    }
    await showTitle();
  }
}

/** Shows the title screen (with its Phaser backdrop) and starts the chosen game. Also used by „Zum Titel“. */
export async function showTitle(): Promise<void> {
  const u = ui();
  const wasBlack = document.querySelector<HTMLElement>('.fade')?.style.opacity === '1';
  if (!wasBlack) await u.fade('out', 450);
  u.reset({ keepFade: true });
  G.stopGameplayScenes();
  G.currentScene = '';
  u.setHud('none');
  u.objective(null);
  G.game.scene.start('Title', { mode: 'title' });
  void u.fade('in', 1100);

  for (;;) {
    const choice = await u.title();
    if (choice === 'continue') {
      if (GameState.hasSave() && G.state.load() && findScene(G.state.data.scene)) {
        const { scene, params } = G.state.data;
        await u.transition(() => G.goto(scene, params), { fadeMs: 800 });
        return;
      }
      G.ui.toast('Der Spielstand konnte nicht geladen werden.', 'info');
      continue;
    }
    if (typeof choice === 'object') {
      await u.transition(() => G.warp(choice.warp), { fadeMs: 800 });
      return;
    }
    const first = getChapters().find(c => !c.hidden && c.scenes.length)?.scenes[0];
    if (!first) {
      G.ui.toast('Das erste Kapitel wird gerade noch geschrieben.', 'info');
      continue;
    }
    await u.transition(() => { G.state.reset(); return G.goto(first.id); }, { fadeMs: 900 });
    return;
  }
}

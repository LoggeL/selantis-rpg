import Phaser from 'phaser';
import { createArt } from './art';
import { createAudio } from './audio';
import { G } from './core/G';
import { getChapters } from './core/registry';
import { GAME_H, GAME_W, setCanvas, setViewportSize } from './core/viewport';
import BootScene from './scenes/BootScene';
import TitleScene from './scenes/TitleScene';
import { phaserScenes as tacticsScenes } from './tactics';
import { createUi } from './ui';
import { phaserScenes as worldScenes } from './world';

// Chapters register themselves (defineChapter) when imported.
import.meta.glob('./chapters/*/index.ts', { eager: true });

const gameHost = document.getElementById('game')!;
const hostSize = () => gameHost.getBoundingClientRect();
setViewportSize(hostSize().width, hostSize().height);

G.art = createArt();
G.audio = createAudio();
G.ui = createUi();
G.ui.mount(document.getElementById('ui')!);

const chapterScenes = getChapters().flatMap(c => c.phaserScenes ?? []);

G.game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#07080c',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [BootScene, TitleScene, ...worldScenes, ...tacticsScenes, ...chapterScenes],
});
G.game.events.once(Phaser.Core.Events.READY, () => {
  setCanvas(G.game.canvas);
  let scheduled = false;
  const resize = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const { width, height } = hostSize();
      if (setViewportSize(width, height)) G.game.scale.setGameSize(GAME_W, GAME_H);
      else G.game.scale.refresh();
    });
  };
  new ResizeObserver(resize).observe(gameHost);
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  document.addEventListener('fullscreenchange', resize);
  document.addEventListener('webkitfullscreenchange', resize);
  resize();
});

// Browsers only allow audio after a gesture.
const unlock = () => G.audio.unlock();
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock);

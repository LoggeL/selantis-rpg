import Phaser from 'phaser';
import { createArt } from './art';
import { createAudio } from './audio';
import { G } from './core/G';
import { getChapters } from './core/registry';
import { GAME_H, GAME_W, setCanvas } from './core/viewport';
import BootScene from './scenes/BootScene';
import TitleScene from './scenes/TitleScene';
import { phaserScenes as tacticsScenes } from './tactics';
import { createUi } from './ui';
import { phaserScenes as worldScenes } from './world';

// Chapters register themselves (defineChapter) when imported.
import.meta.glob('./chapters/*/index.ts', { eager: true });

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
G.game.events.once(Phaser.Core.Events.READY, () => setCanvas(G.game.canvas));

// Browsers only allow audio after a gesture.
const unlock = () => G.audio.unlock();
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock);

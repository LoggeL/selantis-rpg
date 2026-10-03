import Phaser from 'phaser';
import { BootScene, TitleScene } from './scenes/BootScene';
import { BattleScene } from './scenes/BattleScene';
import { BreakScene } from './scenes/BreakScene';
import { FlightScene } from './scenes/FlightScene';
import { RefugeScene } from './scenes/RefugeScene';
import { LiaScene } from './scenes/LiaScene';
import { WorldScene } from './scenes/WorldScene';
import { SettingsScene } from './scenes/SettingsScene';
import { installSettingsControls } from './settings';
import { installSceneAudio } from './audio';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: 640,
  height: 360,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#07080a',
  scale: { mode: Phaser.Scale.NONE, width: 640, height: 360 },
  scene: [BootScene, TitleScene, BattleScene, new BreakScene(), new FlightScene(), new RefugeScene(), new LiaScene(), new WorldScene(), new SettingsScene()],
});

installSettingsControls(game);
installSceneAudio(game);

function resize() {
  const zoom = Math.max(1, Math.floor(Math.min(innerWidth / 640, innerHeight / 360)));
  game.scale.setZoom(zoom);
  const host = document.getElementById('game')!;
  host.style.width = `${640 * zoom}px`;
  host.style.height = `${360 * zoom}px`;
}
addEventListener('resize', resize);
resize();
(window as unknown as { game: Phaser.Game }).game = game;

import Phaser from 'phaser';
import { BootScene, TitleScene } from './scenes/BootScene';
import { BattleScene } from './scenes/BattleScene';
import { BreakScene } from './scenes/BreakScene';
import { FlightScene } from './scenes/FlightScene';
import { RefugeScene } from './scenes/RefugeScene';
import { LiaScene } from './scenes/LiaScene';
import { WorldScene } from './scenes/WorldScene';
import { RaidScene } from './scenes/RaidScene';
import { AftermathScene } from './scenes/AftermathScene';
import { JourneyScene } from './scenes/JourneyScene';
import { SettingsScene } from './scenes/SettingsScene';
import { installSettingsControls } from './settings';
import { installSceneAudio } from './audio';
import { installMobileControls } from './mobileControls';
import { fitGameScale } from './viewport';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: 640,
  height: 360,
  pixelArt: true,
  roundPixels: true,
  input: { activePointers: 3 },
  backgroundColor: '#07080a',
  scale: { mode: Phaser.Scale.NONE, width: 640, height: 360 },
  scene: [BootScene, TitleScene, BattleScene, new BreakScene(), new FlightScene(), new RefugeScene(), new LiaScene(), new WorldScene(), new RaidScene(), new AftermathScene(), new JourneyScene(), new SettingsScene()],
});

installSettingsControls(game);
installSceneAudio(game);
const touchMode = matchMedia('(any-pointer: coarse), (max-width: 900px)');
const setTouchMode = () => { document.documentElement.dataset.touchEnabled = String(touchMode.matches); queueResize(); };
document.documentElement.dataset.touchEnabled = String(touchMode.matches);
installMobileControls(game);

function resize() {
  const host = document.getElementById('game')!;
  const zoom = fitGameScale(host.clientWidth, host.clientHeight);
  if (!zoom) return;
  game.scale.setZoom(zoom);
  game.scale.refresh();
}
let resizeFrame = 0;
function queueResize() { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(resize); }
const observer = new ResizeObserver(queueResize);
observer.observe(document.getElementById('game')!);
observer.observe(document.getElementById('mobile-controls')!);
addEventListener('resize', queueResize);
window.visualViewport?.addEventListener('resize', queueResize);
touchMode.addEventListener('change', setTouchMode);
queueResize();
game.events.once('destroy', () => {
  observer.disconnect(); cancelAnimationFrame(resizeFrame);
  removeEventListener('resize', queueResize);
  window.visualViewport?.removeEventListener('resize', queueResize);
  touchMode.removeEventListener('change', setTouchMode);
});
(window as unknown as { game: Phaser.Game }).game = game;

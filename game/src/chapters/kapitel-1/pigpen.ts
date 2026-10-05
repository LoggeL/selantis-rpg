import type Phaser from 'phaser';
import { G } from '../../core/G';
import type { WorldCtx } from '../../world';
import type { WorldScene } from '../../world/WorldScene';
import { clearPigpenGate } from './hofGeo';

interface PigpenGate { open(): Promise<void>; destroy(): void }
const DATA_KEY = 'k1-pigpen-gate';
// Include the upper rail and its outline. The posts stay in the background.
const LEAF = [[319, 165], [346, 155], [346, 185], [319, 195]];
const CROP = { x: 314, y: 150, width: 40, height: 48 };

/** The gate is painted into the farm background. Replace just its leaf with a hinged copy. */
export function restorePigpen(w: WorldCtx, opened: boolean): PigpenGate {
  const scene = w.scene as WorldScene;
  (scene.data.get(DATA_KEY) as PigpenGate | undefined)?.destroy();
  const src = scene.textures.get(G.art.background(scene, 'k1-hof').key).getSourceImage() as HTMLImageElement;
  const floorKey = 'k1-pigpen-gate-floor';
  if (!scene.textures.exists(floorKey)) {
    const texture = scene.textures.createCanvas(floorKey, CROP.width, CROP.height)!;
    const ctx = texture.context;
    ctx.imageSmoothingEnabled = false;
    ctx.beginPath();
    LEAF.forEach(([x, y], i) => i ? ctx.lineTo(x - CROP.x, y - CROP.y) : ctx.moveTo(x - CROP.x, y - CROP.y));
    ctx.closePath(); ctx.clip();
    ctx.drawImage(src, 258, 132, 40, 40, 0, 0, CROP.width, CROP.height);
    texture.refresh();
  }
  const floor = scene.addWorld(scene.add.image(CROP.x, CROP.y, floorKey).setOrigin(0).setDepth(-998));
  const leafSource = document.createElement('canvas');
  leafSource.width = CROP.width; leafSource.height = CROP.height;
  const sourceCtx = leafSource.getContext('2d')!;
  sourceCtx.beginPath();
  LEAF.forEach(([x, y], i) => i ? sourceCtx.lineTo(x - CROP.x, y - CROP.y) : sourceCtx.moveTo(x - CROP.x, y - CROP.y));
  sourceCtx.closePath(); sourceCtx.clip();
  sourceCtx.drawImage(src, CROP.x, CROP.y, CROP.width, CROP.height, 0, 0, CROP.width, CROP.height);

  const leafKey = 'k1-pigpen-gate-leaf';
  const texture = (scene.textures.exists(leafKey) ? scene.textures.get(leafKey) : scene.textures.createCanvas(leafKey, 90, 90)) as Phaser.Textures.CanvasTexture;
  const leaf = scene.addWorld(scene.add.image(274, 144, leafKey).setOrigin(0).setDepth(216).setName('pigpen-gate-leaf'));
  const state = { amount: opened ? 1 : 0 };
  const draw = () => {
    const ctx = texture.context;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 90, 90);
    // Keep the hinge upright while the leaf swings out to the left of the passage.
    ctx.setTransform(1 - 1.65 * state.amount, state.amount, 0, 1, 44, 50);
    ctx.drawImage(leafSource, CROP.x - 318, CROP.y - 194);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    texture.refresh();
    leaf.setData('open', state.amount === 1);
  };
  draw();
  if (opened) clearPigpenGate(scene.grid);
  let destroyed = false;
  const gate: PigpenGate = {
    async open() {
      if (state.amount === 1) return;
      await new Promise<void>(resolve => scene.tweens.add({
        targets: state, amount: 1, duration: 550, ease: 'Sine.easeInOut', onUpdate: draw,
        onComplete: () => { draw(); clearPigpenGate(scene.grid); resolve(); },
      }));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.tweens.killTweensOf(state);
      floor.destroy(); leaf.destroy();
      offMap(); scene.events.off('shutdown', gate.destroy);
      if (scene.data.get(DATA_KEY) === gate) scene.data.remove(DATA_KEY);
    },
  };
  const offMap = w.on('map', '*', id => { if (id !== 'k1-hof-trauer') gate.destroy(); });
  scene.events.once('shutdown', gate.destroy);
  scene.data.set(DATA_KEY, gate);
  return gate;
}

export function pigpenGate(w: WorldCtx): PigpenGate {
  return w.scene.data.get(DATA_KEY) as PigpenGate;
}

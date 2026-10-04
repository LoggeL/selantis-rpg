import type Phaser from 'phaser';
import type { AssetManifest, CatalogAsset } from "../../content/assets/types";
import { createAvailableAnimations } from "./animations";
import { validateAssetManifest } from "./schema.mjs";

export { createAvailableAnimations } from './animations';

export type PackLoadReport = {
  pack: string;
  requestedIds: string[];
  requestedGraphicBytes: number;
};

/** The loader queues only missing textures; each chapter includes its intra-area transitions. */
export function preloadPack(scene: Phaser.Scene, sceneKey = scene.sys.settings.key): PackLoadReport {
  const manifest: AssetManifest = validateAssetManifest(scene.cache.json.get('manifest'));
  const pack = manifest.packs[sceneKey];
  if (!pack) throw new Error(`No asset pack for scene ${sceneKey}`);
  const ids = new Set([...manifest.packs.shared, ...pack]);
  const report: PackLoadReport = { pack: sceneKey, requestedIds: [], requestedGraphicBytes: 0 };
  for (const asset of manifest.assets) {
    if (!ids.has(asset.id) || scene.textures.exists(asset.id)) continue;
    // Respect an existing scene preload, including BreakScene's authored flight image.
    if (scene.load.list.entries.some(file => file.key === asset.id)) continue;
    queueAsset(scene, asset);
    report.requestedIds.push(asset.id);
    report.requestedGraphicBytes += asset.bytes;
  }
  scene.registry.set(`assets:pack:${sceneKey}`, report);
  return report;
}

function queueAsset(scene: Phaser.Scene, asset: CatalogAsset) {
  if (asset.kind === 'spritesheet') {
    scene.load.spritesheet(asset.id, asset.url, { frameWidth: asset.frameW!, frameHeight: asset.frameH! });
  } else scene.load.image(asset.id, asset.url);
}

/** Keep chapter asset loading at scene registration without coupling narrative scenes to catalogs. */
export function withSceneAssets<T extends new (...args: any[]) => Phaser.Scene>(Base: T): T {
  const parent = Base.prototype as Phaser.Scene & { preload?: () => void; create?: (...args: any[]) => void };
  class SceneWithAssets extends Base {
    preload() {
      parent.preload?.call(this);
      preloadPack(this);
    }
    create(...args: any[]) {
      createAvailableAnimations(this);
      return parent.create?.apply(this, args);
    }
  }
  return SceneWithAssets;
}

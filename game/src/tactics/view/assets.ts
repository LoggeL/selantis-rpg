import Phaser from 'phaser';
import { texKey, type TexId } from './paint';
import { upgradableTexture, whenReady } from '../../art/assets';
import { previewInfo } from '../../art/blurhash';

/**
 * Loader for the painted tactics art (public/assets/tactics/manifest.json lists what exists):
 * seamless terrain textures, iso props (public/assets/props/iso-*.png) and sky backdrops.
 * Everything is optional — missing pieces fall back to generated art.
 */
export interface TacticsManifest {
  textures: string[];
  backdrops: string[];
  /** Variants per iso prop: size and the x of the ground contact (pole foot etc.). */
  props: Record<string, { n: number; w: number; h: number; ax?: number }[]>;
}

const EMPTY: TacticsManifest = { textures: [], backdrops: [], props: {} };
let manifest: TacticsManifest | null = null;

export const isoPropKey = (id: string, n: number) => `tac-iso-${id}-${n}`;
export const skyKey = (id: string) => `tac-sky-${id}`;
export function tacticsManifest(): TacticsManifest { return manifest ?? EMPTY; }

function run(scene: Phaser.Scene, queue: (load: Phaser.Loader.LoaderPlugin) => void): Promise<void> {
  return new Promise(resolve => {
    const load = scene.load;
    queue(load);
    if (load.list.size === 0 && !load.isLoading()) { resolve(); return; }
    const done = () => { load.off(Phaser.Loader.Events.COMPLETE, done); resolve(); };
    load.on(Phaser.Loader.Events.COMPLETE, done);
    load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (f: Phaser.Loader.File) => console.warn(`[tactics] asset missing: ${f.src}`));
    if (!load.isLoading()) load.start();
  });
}

/** Loads manifest + all listed tactics art into the texture manager (idempotent, cached across scenes). */
export async function loadTacticsArt(scene: Phaser.Scene, backdrop?: string): Promise<void> {
  if (!manifest) {
    await run(scene, l => { if (!scene.cache.json.exists('tac-manifest')) l.json('tac-manifest', 'assets/tactics/manifest.json'); });
    const m = scene.cache.json.get('tac-manifest') as TacticsManifest | undefined;
    manifest = m && Array.isArray(m.textures) ? { textures: m.textures, backdrops: m.backdrops ?? [], props: m.props ?? {} } : EMPTY;
  }
  const m = manifest;
  const upgrades: Promise<void>[] = [];
  const image = (load: Phaser.Loader.LoaderPlugin, key: string, file: string) => {
    if (scene.textures.exists(key)) { upgrades.push(whenReady(key)); return; }
    const info = previewInfo(file);
    if (info) {
      upgradableTexture(scene.textures, key, info.width, info.height, null, null, file);
      upgrades.push(whenReady(key));
    } else load.image(key, file);
  };
  await run(scene, l => {
    for (const t of m.textures) image(l, texKey(t as TexId), `assets/tactics/tex-${t}.png`);
    for (const [id, vars] of Object.entries(m.props)) {
      for (const v of vars) image(l, isoPropKey(id, v.n), `assets/props/${id}-${v.n}.png`);
    }
    if (backdrop && m.backdrops.includes(backdrop)) image(l, skyKey(backdrop), `assets/tactics/sky-${backdrop}.png`);
  });
  await Promise.all(upgrades);
}

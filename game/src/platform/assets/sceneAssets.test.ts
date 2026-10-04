import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { preloadPack, withSceneAssets } from "./sceneAssets";
import type { AssetManifest } from "../../content/assets/types";

const asset = (id: string, kind: 'image' | 'spritesheet' = 'image') => ({ id, kind, file: `assets/sprites/${id}.png`, url: `assets/sprites/${id}.png?v=123456abcdef`, category: 'sprites', width: 64, height: 64, bytes: 100, ...(kind === 'spritesheet' ? { frameW: 64, frameH: 64, rows: 1, cols: 1 } : {}) });
const manifest: AssetManifest = {
  schemaVersion: 1, assets: [asset('portrait'), asset('splash'), asset('field'), asset('companion', 'spritesheet')],
  packs: { shared: ['portrait'], title: ['splash'], world: ['field'], 'companions-road': ['companion'] }, iconNames: [],
};
function fixture(key: string, loaded: string[] = []) {
  return {
    sys: { settings: { key } }, cache: { json: { get: () => manifest } },
    textures: { exists: (id: string) => loaded.includes(id) },
    load: { image: vi.fn(), spritesheet: vi.fn(), list: { entries: [] as { key: string }[] } },
    registry: { set: vi.fn() }, anims: { exists: vi.fn(), create: vi.fn() },
  };
}
describe('chapter texture loading', () => {
  it('queues startup portraits and title while leaving future chapters untouched', () => {
    const scene = fixture('title');
    expect(preloadPack(scene as unknown as Phaser.Scene)).toEqual({ pack: 'title', requestedIds: ['portrait', 'splash'], requestedGraphicBytes: 200 });
    expect(scene.load.image.mock.calls.map(args => args[0])).toEqual(['portrait', 'splash']);
    expect(scene.load.spritesheet).not.toHaveBeenCalled();
  });
  it('reuses shared and visited textures and respects scene-specific queues', () => {
    const scene = fixture('world', ['portrait', 'field']);
    expect(preloadPack(scene as unknown as Phaser.Scene).requestedGraphicBytes).toBe(0);
    scene.sys.settings.key = 'companions-road';
    scene.load.list.entries.push({ key: 'companion' });
    expect(preloadPack(scene as unknown as Phaser.Scene).requestedIds).toEqual([]);
  });
  it('loads a sheet using authored frame dimensions', () => {
    const scene = fixture('companions-road', ['portrait']);
    preloadPack(scene as unknown as Phaser.Scene);
    expect(scene.load.spritesheet).toHaveBeenCalledWith('companion', 'assets/sprites/companion.png?v=123456abcdef', { frameWidth: 64, frameHeight: 64 });
  });
  it('composes inherited preloads and creates without changing scene arguments', () => {
    class Base {
      preloaded = false;
      created?: string;
      preload() { this.preloaded = true; }
      create(value: string) { this.created = value; }
    }
    const Wrapped = withSceneAssets(Base as unknown as new () => Phaser.Scene);
    const scene = new Wrapped() as unknown as Base & ReturnType<typeof fixture>;
    Object.assign(scene, fixture('world', ['portrait', 'field']));
    scene.preload(); scene.create('continued');
    expect(scene.preloaded).toBe(true); expect(scene.created).toBe('continued');
  });
});

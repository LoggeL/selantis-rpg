import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileAssetCatalog } from '../../../../scripts/asset_catalog.mjs';
import { NOVEL_CONTINUATION_CHAPTERS } from '../../content/chapters/continuationNovel';
import { FILM_CONTINUATION_CHAPTERS } from '../../content/chapters/continuationFilm';
import { isSceneKey } from '../../app/sceneCatalog';
import { preloadPack, createAvailableAnimations } from './sceneAssets';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const chapters = [...NOVEL_CONTINUATION_CHAPTERS, ...FILM_CONTINUATION_CHAPTERS];

describe('direct continuation entry asset contract', () => {
  it('loads Flicks actual integer cells and registers complete directional walking phases', () => {
    const manifest = compileAssetCatalog(root), loaded = new Map(), animations = new Map();
    const sheet = manifest.assets.find(asset => asset.id === 'flick-walk');
    expect(sheet).toMatchObject({ width: 1254, height: 1254, frameW: 209, frameH: 209, cols: 6, rows: 6, foot: [104, 195] });
    const scene = {
      sys: { settings: { key: 'flick-trail' } }, cache: { json: { get: () => manifest } }, registry: { set() {} },
      textures: { exists: id => loaded.has(id), get: id => ({ has: frame => Number(frame) >= 0 && Number(frame) < loaded.get(id).cols * loaded.get(id).rows }) },
      load: { list: { entries: [] }, image: id => loaded.set(id, manifest.assets.find(asset => asset.id === id)), spritesheet: id => loaded.set(id, manifest.assets.find(asset => asset.id === id)) },
      anims: { exists: key => animations.has(key), create: animation => animations.set(animation.key, animation) },
    };
    preloadPack(scene); createAvailableAnimations(scene);
    for (const [row, direction] of ['s', 'w', 'e', 'n'].entries()) {
      const walk = animations.get(`flick-walk-${direction}`), idle = animations.get(`flick-idle-${direction}`);
      expect(walk.frames.map(frame => frame.frame)).toEqual(Array.from({ length: 6 }, (_unused, frame) => row * 6 + frame));
      expect(walk.frames.every(frame => frame.key === 'flick-walk')).toBe(true);
      expect(idle.frames[0].frame).toBeGreaterThanOrEqual(row * 6);
      expect(idle.frames[0].frame).toBeLessThan(row * 6 + 6);
    }
  });
  it('loads distinct native standing bodies and foot anchors for Craupor and Elnon', () => {
    const manifest = compileAssetCatalog(root);
    for (const [sceneKey, id, foot] of [['golden-boar', 'craupor-idle', [610.5, 1174]], ['brotherhood', 'elnon-idle', [616, 1185]]]) {
      const sheet = manifest.assets.find(asset => asset.id === id);
      expect(sheet).toMatchObject({ kind: 'spritesheet', width: 1254, height: 1254, frameW: 1254, frameH: 1254, cols: 1, rows: 1, foot });
      const chapter = chapters.find(chapter => chapter.id === sceneKey);
      expect(chapter.actors.find(actor => actor.id === id.replace('-idle', ''))).toMatchObject({ texture: id, frame: 0 });
      const loaded = new Map(), animations = new Map();
      const scene = {
        sys: { settings: { key: sceneKey } }, cache: { json: { get: () => manifest } }, registry: { set() {} },
        textures: { exists: key => loaded.has(key), get: key => ({ has: frame => Number(frame) >= 0 && Number(frame) < loaded.get(key).cols * loaded.get(key).rows }) },
        load: { list: { entries: [] }, image: key => loaded.set(key, manifest.assets.find(asset => asset.id === key)), spritesheet: key => loaded.set(key, manifest.assets.find(asset => asset.id === key)) },
        anims: { exists: key => animations.has(key), create: animation => animations.set(animation.key, animation) },
      };
      preloadPack(scene); createAvailableAnimations(scene);
      expect(loaded.has(id)).toBe(true);
      expect(animations.get(id).frames).toEqual([{ key: id, frame: 0 }]);
    }
  });
  it('loads every authored background, actor and dialogue shot before the scene starts', () => {
    const manifest = compileAssetCatalog(root);
    for (const chapter of chapters) {
      const available = new Set([...manifest.packs.shared, ...manifest.packs[chapter.id]]);
      const ids = [chapter.area.bg, ...chapter.actors.map(actor => actor.texture),
        ...(chapter.entry ?? []).map(beat => beat.shot), ...chapter.actions.flatMap(action => action.beats.map(beat => beat.shot))].filter(Boolean);
      for (const id of ids) expect(available.has(id), `${chapter.id}: ${id}`).toBe(true);
      expect(isSceneKey(chapter.exit.to), `${chapter.id}: exit ${chapter.exit.to}`).toBe(true);
      for (const actor of chapter.actors) {
        const sheet = manifest.assets.find(asset => asset.id === actor.texture);
        if (sheet.kind === 'spritesheet' && typeof actor.frame === 'number') expect(actor.frame).toBeLessThan(sheet.cols * sheet.rows);
      }
    }
  });
});

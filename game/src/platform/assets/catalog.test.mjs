import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { compileAssetCatalog, assetLoadMetrics } from "../../../../scripts/asset_catalog.mjs";
import { validateAssetManifest } from "./schema.mjs";
import { preloadPack, createAvailableAnimations } from "./sceneAssets";

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const catalog = compileAssetCatalog(root), temporary = [];
afterEach(() => temporary.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
function clone() {
  const path = mkdtempSync(join(tmpdir(), 'selantis-catalog-')); temporary.push(path);
  cpSync(join(root, 'game/public/assets'), join(path, 'game/public/assets'), { recursive: true });
  cpSync(join(root, 'game/src/content/assets'), join(path, 'game/src/content/assets'), { recursive: true });
  return path;
}
function sourceChange(path, change) {
  const file = join(path, 'game/public/assets/manifest.json');
  const source = JSON.parse(readFileSync(file, 'utf8')); change(source); writeFileSync(file, JSON.stringify(source));
}
describe('canonical asset catalog', () => {
  it('is deterministic and keeps the complete downloadable collection', () => {
    expect(compileAssetCatalog(root)).toEqual(catalog);
    expect(catalog.assets.some(asset => asset.file.endsWith('bag-open.png'))).toBe(true);
    expect(catalog.assets.some(asset => asset.file.endsWith('camp-fire-detailed.png'))).toBe(true);
    expect(catalog.assets.find(asset => asset.id === 'lia-walk')).toMatchObject({ cols: 4, rows: 4, foot: [32, 60] });
  });
  it('keeps world maps and chapter-internal area transitions ready before create', () => {
    expect(catalog.packs.world).toEqual(expect.arrayContaining(['bg-lia', 'bg-map-waldrand', 'bg-map-hof', 'bg-map-hohlweg', 'bg-map-felder']));
    expect(catalog.packs.aftermath).toEqual(expect.arrayContaining(['bg-farm-dawn', 'bg-farm-interior']));
    expect(catalog.packs.journey).toEqual(expect.arrayContaining(['bg-road-east', 'bg-first-camp-evening', 'bg-first-camp-night', 'camp-fire-detailed']));
    expect(catalog.packs.shared.some(id => id.startsWith('portrait-'))).toBe(false);
    expect(catalog.packs.title.some(id => id.startsWith('portrait-'))).toBe(false);
    expect(catalog.packs.battle).toEqual(expect.arrayContaining(['portrait-valentus', 'portrait-boy']));
    expect(catalog.packs.refuge).toEqual(expect.arrayContaining(['portrait-woman', 'portrait-dialogue-refuge-man']));
    expect(catalog.packs.lia).toEqual(expect.arrayContaining(['portrait-lia', 'portrait-dialogue-kyra']));
    expect(catalog.packs.raid).toEqual(expect.arrayContaining(['portrait-father', 'portrait-mother', 'portrait-dialogue-scarred', 'portrait-dialogue-hooded']));
    expect(catalog.packs.journey).toEqual(expect.arrayContaining(['portrait-dialogue-foltan', 'portrait-dialogue-azar']));
    expect(assetLoadMetrics(catalog).startupGraphicBytes).toBeLessThan(assetLoadMetrics(catalog).catalogGraphicBytes / 4);
  });
  it('provides camp and road companion actor frames and directional animations from each scene pack', () => {
    function companionContract(manifest, sceneKey) {
      const loaded = new Map(), animations = new Map();
      const scene = {
        sys: { settings: { key: sceneKey } }, cache: { json: { get: () => manifest } }, registry: { set() {} },
        textures: {
          exists: id => loaded.has(id),
          get: id => ({ has: frame => Number(frame) >= 0 && Number(frame) < loaded.get(id).cols * loaded.get(id).rows }),
        },
        load: {
          list: { entries: [] },
          image: id => loaded.set(id, manifest.assets.find(asset => asset.id === id)),
          spritesheet: id => loaded.set(id, manifest.assets.find(asset => asset.id === id)),
        },
        anims: { exists: key => animations.has(key), create: animation => animations.set(animation.key, animation) },
      };
      // A direct chapter entry has no textures inherited from future or visited chapters.
      preloadPack(scene); createAvailableAnimations(scene);
      for (const name of ['foltan', 'azar']) {
        const sheet = loaded.get(`${name}-walk`);
        if (!sheet) throw new Error(`${sceneKey} missing actor texture ${name}-walk`);
        expect(sheet).toMatchObject({ kind: 'spritesheet', frameW: 64, frameH: 64, cols: 4, rows: 4 });
        for (const direction of ['s', 'w', 'e', 'n']) {
          for (const motion of ['idle', 'walk']) {
            const animation = animations.get(`${name}-${motion}-${direction}`);
            expect(animation, `${sceneKey}: ${name}-${motion}-${direction}`).toBeDefined();
            expect(animation.frames.every(frame => frame.key === sheet.id && Number.isInteger(frame.frame) && frame.frame >= 0 && frame.frame < sheet.cols * sheet.rows)).toBe(true);
          }
        }
      }
    }
    companionContract(catalog, 'journey');
    companionContract(catalog, 'companions-road');
    const missingCompanion = structuredClone(catalog);
    missingCompanion.packs.journey = missingCompanion.packs.journey.filter(id => id !== 'foltan-walk');
    expect(() => companionContract(missingCompanion, 'journey')).toThrow('journey missing actor texture foltan-walk');
  });
  it('accepts existing legacy producers and rejects missing files and wrong authored grids', () => {
    const path = clone(); sourceChange(path, source => { delete source.schemaVersion; });
    expect(compileAssetCatalog(path)).toEqual(catalog);
    sourceChange(path, source => { source.sprites['lia-walk'].cols = 3; });
    expect(() => compileAssetCatalog(path)).toThrow(/dimensions disagree/);
    sourceChange(path, source => { source.sprites['lia-walk'].cols = 4; source.images['bg-lia'] = 'assets/bg/missing.png'; });
    expect(() => compileAssetCatalog(path)).toThrow(/Missing asset/);
  });
  it('rejects malformed runtime boundaries: duplicate IDs, anchors, paths and package references', () => {
    const modify = change => { const value = structuredClone(catalog); change(value); return () => validateAssetManifest(value); };
    expect(modify(value => value.assets.push(value.assets[0]))).toThrow(/duplicate/);
    expect(modify(value => value.assets.find(asset => asset.id === 'lia-walk').foot = [999, 60])).toThrow(/anchor/);
    expect(modify(value => value.assets[0].file = 'assets/../outside.png')).toThrow(/file/);
    expect(modify(value => value.packs.world.push('missing'))).toThrow(/unknown asset/);
  });
});

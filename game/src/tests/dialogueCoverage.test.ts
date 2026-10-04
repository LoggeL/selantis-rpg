import { assetUrl } from '../platform/assets/url';
import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { parseDialogue, resolvePortrait, SPEAKER_PORTRAITS } from '../presentation/phaser/portraits';
import { preloadPack } from '../platform/assets/sceneAssets';
import type { AssetManifest } from '../content/assets/types';
// The real build compiler validates native files and expands the scene pack selectors.
// @ts-expect-error The Node build script has no TypeScript declaration.
import { compileAssetCatalog } from '../../../scripts/asset_catalog.mjs';

const authoredModules = import.meta.glob<Record<string, unknown>>(['../content/chapters/**/*.ts', '!../content/chapters/**/*.test.ts'], { eager: true });
const catalog: AssetManifest = compileAssetCatalog();
const assetsById = new Map(catalog.assets.map(asset => [asset.id, asset]));
const OBSERVATION_PREFIXES = new Set(['Westen', 'Vaters doppelter Boden']);
const nativePath = (url: string) => url.split(/[?#]/)[0];

/** Validate exported authored records, independent of adapters or TS source syntax. */
function speakerLabels(content: unknown): Set<string> {
  const labels = new Set<string>();
  const visited = new Set<object>();
  function visit(value: unknown) {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const record = value as Record<string, unknown>;
    const line = typeof record.line === 'string' ? record.line : typeof record.text === 'string' ? record.text : undefined;
    if (line !== undefined && (typeof record.narrativeId === 'string' || typeof record.id === 'string')) {
      for (const field of ['speaker', 'name']) if (typeof record[field] === 'string') labels.add(record[field]);
      const match = /^\s*([\p{Lu}][\p{L} ()/-]{0,31}):\s*/u.exec(line);
      if (match && !OBSERVATION_PREFIXES.has(match[1].trim())) labels.add(match[1].trim());
    }
    Object.values(record).forEach(visit);
  }
  visit(content);
  return labels;
}

function sceneForModule(path: string): string {
  if (path.includes('/firstJourney/')) return 'journey';
  if (path.includes('/companions/')) return 'companions-road';
  if (path.includes('/aftermath/')) return 'aftermath';
  if (path.includes('/homecoming/raid')) return 'raid';
  if (path.includes('/homecoming/')) return 'lia';
  if (path.includes('/flight/')) return 'flight';
  if (path.includes('/prologue/refuge')) return 'refuge';
  if (path.includes('/prologue/break')) return 'break';
  if (path.includes('/prologue/')) return 'storyprologue';
  throw new Error(`Authored dialogue needs a scene pack assignment: ${path}`);
}

const sceneSpeakers = new Map<string, Set<string>>();
for (const [path, content] of Object.entries(authoredModules)) {
  // Continuation modules and their barrels export the actual chapter records.
  // Their authored scene id keeps dialogue coverage aligned with lazy loading.
  const chapters = Object.values(content).filter((value): value is { id: string } =>
    !!value && typeof value === 'object' && 'id' in value && typeof value.id === 'string' && 'area' in value && 'actions' in value);
  if (chapters.length) {
    for (const chapter of chapters) {
      const cast = sceneSpeakers.get(chapter.id) ?? new Set<string>();
      for (const speaker of speakerLabels(chapter)) cast.add(speaker);
      sceneSpeakers.set(chapter.id, cast);
    }
    continue;
  }
  const speakers = speakerLabels(content);
  if (!speakers.size) continue;
  const scene = sceneForModule(path);
  const cast = sceneSpeakers.get(scene) ?? new Set<string>();
  for (const speaker of speakers) cast.add(speaker);
  sceneSpeakers.set(scene, cast);
}
// The battlefield's two voiced identities also appear in its on-screen HUD.
sceneSpeakers.set('battle', new Set(['Valentus', 'Junge']));
const actualSpeakers = new Set([...sceneSpeakers.values()].flatMap(speakers => [...speakers]));

/** Use the same lazy pack loader as scene registration, starting with empty textures. */
function loadScenePack(key: string) {
  const loaded = new Map<string, string>();
  const scene = {
    sys: { settings: { key } },
    cache: { json: { get: () => catalog } },
    textures: { exists: (texture: string) => loaded.has(texture) },
    load: {
      image: (texture: string, url: string) => loaded.set(texture, url),
      spritesheet: (texture: string, url: string) => loaded.set(texture, url),
      list: { entries: [] },
    },
    registry: { set: () => {} },
  } as unknown as Phaser.Scene;
  const report = preloadPack(scene);
  return { scene, loaded, report };
}

describe('speaking cast portrait coverage', () => {
  it('discovers authored speaker metadata and labeled lines, rejecting unregistered speakers', () => {
    const labels = speakerLabels([
      { narrativeId: 'test.guard', line: 'Testreiter: Halt!' },
      { narrativeId: 'test.visitor', speaker: 'Gast', line: 'Guten Abend' },
      { id: 'test.guest', name: 'Besucherin', text: 'Weiter.' },
      { id: 'test.signpost', line: 'Westen: Trapas.' },
      { label: 'Kein Sprecher: Weiter.' },
    ]);
    expect([...labels].sort()).toEqual(['Besucherin', 'Gast', 'Testreiter']);
    expect([...labels].filter(label => !(label.toLocaleLowerCase('de') in SPEAKER_PORTRAITS))).toEqual(['Testreiter', 'Gast', 'Besucherin']);
  });

  it('registers every authored speaking character, including the refuge speaker metadata', () => {
    for (const speaker of ['Mann', 'Narbiger', 'Kapuzenmann', 'Der Dicke', 'Der Schmale']) expect(actualSpeakers.has(speaker)).toBe(true);
    const missing = [...actualSpeakers].filter(label => !(label.toLocaleLowerCase('de') in SPEAKER_PORTRAITS));
    expect(missing, 'A new speaking character needs its own portrait registry entry.').toEqual([]);
    for (const name of actualSpeakers) expect(parseDialogue(`${name}: Eine Zeile.`).name).toBe(name);
  });

  it('loads each scene cast from its own pack and resolves existing native portrait files', () => {
    for (const [sceneKey, speakers] of sceneSpeakers) {
      const { scene, loaded } = loadScenePack(sceneKey);
      for (const name of speakers) {
        const portrait = resolvePortrait(scene, name);
        expect(portrait, `${sceneKey}: ${name} needs a portrait in its scene pack`).toBeDefined();
        expect(portrait?.texture, `${sceneKey}: ${name} must show their own face`).not.toBe('portrait-unknown');
        expect(portrait?.src, `${name} needs the native mobile image too`).toBeTruthy();
        const asset = assetsById.get(portrait!.texture);
        expect(asset?.category).toBe('portraits');
        expect(asset?.file).toBe(nativePath(portrait!.src!));
        expect(loaded.get(portrait!.texture)).toBe(asset?.url);
      }
    }
    expect([...loadScenePack('title').loaded.keys()].filter(id => id.startsWith('portrait-'))).toEqual([]);
  });

  it('uses distinct authored faces for the three formerly anonymous speaking characters', () => {
    const raid = loadScenePack('raid');
    const refuge = loadScenePack('refuge');
    expect(resolvePortrait(raid.scene, 'Narbiger')?.src).toBe(assetUrl('assets/portraits/dialogue-scarred.png'));
    expect(resolvePortrait(raid.scene, 'Kapuzenmann')?.src).toBe(assetUrl('assets/portraits/dialogue-hooded.png'));
    expect(resolvePortrait(refuge.scene, 'Mann')?.src).toBe(assetUrl('assets/portraits/dialogue-refuge-man.png'));
    const battle = loadScenePack('battle');
    for (const [key, file] of [['portrait-woman', 'woman'], ['portrait-boy', 'boy'], ['portrait-valentus', 'valentus']]) {
      const loaded = key === 'portrait-woman' ? refuge.loaded : battle.loaded;
      expect(nativePath(loaded.get(key)!)).toBe(`assets/portraits/${file}.png`);
    }
  });
});

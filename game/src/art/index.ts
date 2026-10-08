import type Phaser from 'phaser';
import type { ArtApi, AssetRequest, CharacterSpec, PropInfo } from './api';
import { loadImage, upgradableTexture, warm, whenReady } from './assets';
import { drawPreview, previewCanvas } from './blurhash';
import { FX_KEYS, makeFx } from './fx';
import { assetUrl, loadManifest, manifest, type AssetManifest } from './manifest';
import { color as paletteColor } from './palette';
import { placeholderBackground, placeholderIcon, placeholderPortrait, placeholderProp } from './placeholder';
import { animKey, characterAnchor, characterIds, characterReady, characterSize, ensureCharacter } from './sprites';

/**
 * Selantis art runtime (DESIGN.md §3): painted, Codex-generated assets listed in public/assets/manifest.json,
 * plus procedural FX textures (particles, light) and neutral placeholders for everything not generated yet.
 *
 * The manifest is loaded before the game boots (top-level await below), so all lookups are synchronous.
 * Textures, including the item-icon atlas, upgrade in place when their PNG has loaded
 * (see assets.ts); preload() just awaits that for the requested ids.
 */

await loadManifest();
let atlasImage: HTMLImageElement | null = null;
const pendingIcons: { textures: Phaser.Textures.TextureManager; texture: Phaser.Textures.CanvasTexture; id: string }[] = [];
const iconUrlCache = new Map<string, string>();
if (manifest().icons.atlas) void loadImage(manifest().icons.atlas).then(img => {
  if (!img) return;
  atlasImage = img;
  for (const { textures, texture, id } of pendingIcons.splice(0)) {
    if (!textures.exists(texture.key) || textures.get(texture.key) !== texture) continue;
    const canvas = iconCanvas(id);
    if (!canvas) continue;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(canvas, 0, 0);
    texture.refresh();
  }
  const upgradedUrls = new Map<string, string>();
  for (const [id, oldUrl] of iconUrlCache) {
    const canvas = iconCanvas(id);
    if (!canvas) continue;
    const url = canvas.toDataURL('image/png');
    iconUrlCache.set(id, url);
    upgradedUrls.set(oldUrl, url);
  }
  if (typeof document !== 'undefined') document.querySelectorAll<HTMLImageElement>('img').forEach(img => {
    const url = upgradedUrls.get(img.src);
    if (url) img.src = url;
  });
});

const MOOD_FALLBACK: Record<string, string[]> = {
  pained: ['hurt', 'sad'], hurt: ['pained', 'sad'], scared: ['surprised', 'sad'], thinking: ['neutral'],
  shocked: ['surprised'], worried: ['sad', 'scared'], crying: ['sad'], laughing: ['happy'], smirk: ['happy'],
  grim: ['determined', 'angry'], tired: ['sad'], ashamed: ['sad', 'worried'],
};

const warnedProps = new Set<string>();

function toNumberColor(c: number | string | undefined, fallback = 0xffc070): number {
  if (typeof c === 'number') return c;
  if (typeof c === 'string') {
    if (c.startsWith('#')) return parseInt(c.slice(1), 16);
    if (c.startsWith('0x')) return parseInt(c.slice(2), 16);
    try { return paletteColor(c); } catch { return fallback; }
  }
  return fallback;
}

function iconCanvas(id: string): HTMLCanvasElement | null {
  const m = manifest().icons;
  const idx = m.ids[id];
  if (idx === undefined || !m.cols) return null;
  const atlas = atlasImage ?? previewCanvas(m.atlas);
  if (!atlas) return null;
  const c = document.createElement('canvas');
  c.width = m.cell; c.height = m.cell;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(atlas, (idx % m.cols) * m.cell, Math.floor(idx / m.cols) * m.cell, m.cell, m.cell, 0, 0, m.cell, m.cell);
  return c;
}

export function createArt(): ArtApi {
  const api: ArtApi & ArtExtras = {
    init(scene) {
      for (const key of FX_KEYS) if (!scene.textures.exists(key)) scene.textures.addCanvas(key, makeFx(key));
      for (const id of api.iconIds()) api.icon(scene, id);
    },

    async preload(scene, req: AssetRequest) {
      const waits: Promise<void>[] = [];
      for (const id of req.characters ?? []) waits.push(characterReady(ensureCharacter(scene, id)));
      for (const id of req.props ?? []) { api.prop(scene, id); waits.push(whenReady(`prop:${id}`)); }
      for (const id of req.backgrounds ?? []) { api.background(scene, id); waits.push(whenReady(`bg:${id}`)); }
      for (const id of req.plates ?? []) if (manifest().plates[id]) waits.push(warm(manifest().plates[id].file));
      await Promise.all(waits);
    },

    background(scene, id) {
      const e = manifest().backgrounds[id];
      const key = `bg:${id}`;
      const w = e?.w ?? 640, h = e?.h ?? 360;
      upgradableTexture(scene.textures, key, w, h, null, e ? null : placeholderBackground(w, h, id), e?.file);
      return { key, width: w, height: h };
    },

    characterAnchor: (k: string) => characterAnchor(k),
    plateUrl: (id: string) => assetUrl(manifest().plates[id]?.file ?? `assets/cut/${id}.jpg`),
    hasAsset(kind, id) {
      const m = manifest();
      switch (kind) {
        case 'character': return !!m.characters[id]?.walk;
        case 'prop': return !!m.props[id];
        case 'background': return !!m.backgrounds[id];
        case 'plate': return !!m.plates[id];
        case 'portrait': return !!m.portraits[id];
        default: return false;
      }
    },

    prop(scene, id, variant = 0): PropInfo {
      const m = manifest().props;
      const vid = variant > 0 && m[`${id}-v${variant + 1}`] ? `${id}-v${variant + 1}` : id;
      const e = m[vid];
      const key = `prop:${vid}`;
      if (!e) {
        if (!warnedProps.has(id)) { warnedProps.add(id); console.info(`[art] no prop asset "${id}" yet — placeholder`); }
        upgradableTexture(scene.textures, key, 16, 16, null, placeholderProp(16, 16));
        return { key, width: 16, height: 16, originX: 8, originY: 16, footprint: { x: -6, y: -5, w: 12, h: 5 } };
      }
      const frames = Math.max(1, e.frames ?? 1);
      upgradableTexture(scene.textures, key, e.w * frames, e.h, frames > 1 ? { w: e.w, h: e.h, count: frames, cols: frames } : null,
        placeholderProp(e.w * frames, e.h), e.file);
      const info: PropInfo = {
        key, width: e.w, height: e.h, originX: e.anchor[0], originY: e.anchor[1], footprint: e.footprint ?? null,
      };
      if (e.sway) info.sway = true;
      if (e.anchors) info.anchors = e.anchors;
      if (e.light) info.light = { ...e.light, color: toNumberColor(e.light.color) };
      if (e.lights) info.lights = e.lights.map(l => ({ ...l, color: toNumberColor(l.color) }));
      if (frames > 1) {
        const ak = `${key}:anim`;
        if (!scene.anims.exists(ak)) {
          scene.anims.create({ key: ak, frames: Array.from({ length: frames }, (_, i) => ({ key, frame: i })), frameRate: e.fps ?? 8, repeat: -1 });
        }
        info.anim = ak;
      }
      return info;
    },
    propIds: () => Object.keys(manifest().props),

    character(scene, idOrSpec: string | CharacterSpec, customKey?: string) {
      return ensureCharacter(scene, idOrSpec, customKey);
    },
    animKey: (k, a, d) => animKey(k, a, d),
    characterIds: () => characterIds(),
    characterSize: (k: string) => characterSize(k),

    portrait(id: string, mood = 'neutral') {
      const set = manifest().portraits[id];
      if (!set) return placeholderPortrait(id);
      const file = set[mood] ?? (MOOD_FALLBACK[mood] ?? []).map(m => set[m]).find(Boolean) ?? set.neutral ?? Object.values(set)[0];
      return assetUrl(file);
    },
    portraitIds: () => Object.keys(manifest().portraits),

    icon(scene, id) {
      const key = `icon:${id}`;
      if (!scene.textures.exists(key)) {
        const texture = scene.textures.addCanvas(key, iconCanvas(id) ?? placeholderIcon());
        if (texture && !atlasImage && manifest().icons.atlas) pendingIcons.push({ textures: scene.textures, texture, id });
      }
      return key;
    },
    iconDataUrl(id: string) {
      let u = iconUrlCache.get(id);
      if (!u) {
        u = (iconCanvas(id) ?? placeholderIcon()).toDataURL('image/png');
        // A fragment identifies the icon even when two interim crops have identical pixels.
        if (!atlasImage && manifest().icons.ids[id] !== undefined) u += `#selantis-icon=${encodeURIComponent(id)}`;
        iconUrlCache.set(id, u);
      }
      return u;
    },
    iconIds: () => Object.keys(manifest().icons.ids),
    fxKeys: () => [...FX_KEYS],
    color: (name: string) => paletteColor(name),

    manifest: () => manifest(),
    assetIds(kind) {
      const m = manifest();
      switch (kind) {
        case 'character': return characterIds();
        case 'portrait': return Object.keys(m.portraits);
        case 'background': return Object.keys(m.backgrounds);
        case 'plate': return Object.keys(m.plates);
        case 'prop': return Object.keys(m.props);
        case 'icon': return Object.keys(m.icons.ids);
        default: return [];
      }
    },
    poseIds(id: string) { return Object.keys(manifest().characters[id]?.poses ?? {}); },
    moodIds(id: string) { return Object.keys(manifest().portraits[id] ?? {}); },
  };
  return api;
}

/** (art extension) Extra members on the object returned by createArt(); reach them via `G.art as ArtApi & ArtExtras`. */
export interface ArtExtras {
  manifest(): AssetManifest;
  assetIds(kind: 'character' | 'portrait' | 'background' | 'plate' | 'prop' | 'icon'): string[];
  poseIds(characterId: string): string[];
  moodIds(portraitId: string): string[];
}

/** (art extension) Registers a portrait as a Phaser texture (for in-canvas use, e.g. tactics cards). */
export function portraitTexture(scene: Phaser.Scene, id: string, mood?: string): string {
  const key = `portrait:${id}:${mood ?? 'neutral'}`;
  if (scene.textures.exists(key)) return key;
  const url = createArtSingleton().portrait(id, mood);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  drawPreview(ctx, url, 0, 0, c.width, c.height);
  const tex = scene.textures.addCanvas(key, c)!;
  void loadImage(url).then(img => {
    if (!img || !scene.textures.exists(key) || scene.textures.get(key) !== tex) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    tex.refresh();
  });
  return key;
}

let singleton: ArtApi | undefined;
function createArtSingleton(): ArtApi { return (singleton ??= createArt()); }

export { manifest, assetUrl };
export type { AssetManifest };
export type { Phaser };

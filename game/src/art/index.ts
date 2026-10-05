import type Phaser from 'phaser';
import type { ArtApi, AssetRequest, CharacterSpec, PropInfo } from './api';
import { loadImage, upgradableTexture, warm, whenReady } from './assets';
import { FX_KEYS, makeFx } from './fx';
import { assetUrl, loadManifest, manifest, type AssetManifest } from './manifest';
import { color as paletteColor } from './palette';
import { placeholderBackground, placeholderIcon, placeholderPortrait, placeholderProp } from './placeholder';
import { animKey, characterAnchor, characterIds, characterReady, characterSize, ensureCharacter } from './sprites';

/**
 * Selantis art runtime (DESIGN.md §3): painted, Codex-generated assets listed in public/assets/manifest.json,
 * plus procedural FX textures (particles, light) and neutral placeholders for everything not generated yet.
 *
 * The manifest and the item-icon atlas are loaded before the game boots (top-level await below), so all
 * lookups are synchronous. Textures are canvas textures that upgrade in place when their PNG has loaded
 * (see assets.ts); preload() just awaits that for the requested ids.
 */

await loadManifest();
const atlasImage: HTMLImageElement | null = manifest().icons.atlas
  ? await Promise.race([loadImage(manifest().icons.atlas), new Promise<null>(r => setTimeout(() => r(null), 3000))])
  : null;

const MOOD_FALLBACK: Record<string, string[]> = {
  pained: ['hurt', 'sad'], hurt: ['pained', 'sad'], scared: ['surprised', 'sad'], thinking: ['neutral'],
  shocked: ['surprised'], worried: ['sad', 'scared'], crying: ['sad'], laughing: ['happy'], smirk: ['happy'],
  grim: ['determined', 'angry'], tired: ['sad'], ashamed: ['sad', 'worried'],
};

const warnedProps = new Set<string>();
const iconUrlCache = new Map<string, string>();

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
  if (!atlasImage || idx === undefined || !m.cols) return null;
  const c = document.createElement('canvas');
  c.width = m.cell; c.height = m.cell;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(atlasImage, (idx % m.cols) * m.cell, Math.floor(idx / m.cols) * m.cell, m.cell, m.cell, 0, 0, m.cell, m.cell);
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
        scene.textures.addCanvas(key, iconCanvas(id) ?? placeholderIcon());
      }
      return key;
    },
    iconDataUrl(id: string) {
      let u = iconUrlCache.get(id);
      if (!u) {
        u = (iconCanvas(id) ?? placeholderIcon()).toDataURL('image/png');
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
  const tex = scene.textures.addCanvas(key, c)!;
  const img = new Image();
  img.onload = () => { c.getContext('2d')!.drawImage(img, 0, 0, 256, 256); tex.refresh(); };
  img.src = url;
  return key;
}

let singleton: ArtApi | undefined;
function createArtSingleton(): ArtApi { return (singleton ??= createArt()); }

export { manifest, assetUrl };
export type { AssetManifest };
export type { Phaser };

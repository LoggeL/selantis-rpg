import type Phaser from 'phaser';
import type { ArtApi, CharacterSpec, GroundSpec, PropInfo } from './api';
import { animKey as charAnimKey, characterIds, characterSize, ensureCharacter } from './characters';
import { FX_KEYS, makeFx } from './fx';
import { ICON_IDS, iconDataUrl, iconPx } from './icons';
import { color as paletteColor } from './palette';
import { portraitCanvas, portraitDataUrl, portraitIds } from './portraits';
import { ensureProp, propIds } from './props';
import { buildGroundObject } from './tiles/ground';

/**
 * Procedural pixel-art library ("Selantis-Pixel"). Everything is drawn into canvases with a fixed palette and
 * seeded randomness, then registered as Phaser textures/spritesheets/animations on first use and cached.
 */
export function createArt(): ArtApi {
  const api: ArtApi = {
    init(scene) {
      for (const key of FX_KEYS) if (!scene.textures.exists(key)) scene.textures.addCanvas(key, makeFx(key));
      for (const id of ICON_IDS) api.icon(scene, id);
    },
    buildGround(scene, spec: GroundSpec) {
      return buildGroundObject(scene, spec);
    },
    prop(scene, id, variant = 0): PropInfo {
      return ensureProp(scene, id, variant);
    },
    propIds: () => propIds(),
    character(scene, idOrSpec: string | CharacterSpec, customKey?: string) {
      return ensureCharacter(scene, idOrSpec, customKey);
    },
    animKey: (k, a, d) => charAnimKey(k, a, d),
    characterIds: () => characterIds(),
    characterSize: (k: string) => characterSize(k),
    portrait: (id: string, mood?: string) => portraitDataUrl(id, mood),
    portraitIds: () => portraitIds(),
    icon(scene, id) {
      const key = `icon:${id}`;
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, iconPx(id).toCanvas());
      return key;
    },
    iconDataUrl: (id: string) => iconDataUrl(id),
    iconIds: () => [...ICON_IDS],
    fxKeys: () => [...FX_KEYS],
    color: (name: string) => paletteColor(name),
  };
  return api;
}

/** (art extension) Registers a portrait as a Phaser texture (for in-canvas use, e.g. tactics cards). */
export function portraitTexture(scene: Phaser.Scene, id: string, mood?: string): string {
  const key = `portrait:${id}:${mood ?? 'neutral'}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, portraitCanvas(id, mood));
  return key;
}

export { portraitCanvas };
export type { Phaser };

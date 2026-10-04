// TEMPORARY STUB — replaced by the art agent. Draws flat placeholder shapes so consumers can run.
import type Phaser from 'phaser';
import type { Dir } from '../core/types';
import type { ArtApi, CharAnim, CharacterSpec, GroundSpec, PropInfo } from './api';
import { TILE } from './api';

const TERRAIN_COLORS: Record<string, string> = {
  grass: '#5d9b48', meadow: '#74b04f', darkgrass: '#3f7a3a', forest: '#3a5a2e', dirt: '#8a6a44', path: '#b08f5c',
  road: '#a58a62', mud: '#5e4a35', sand: '#d8c38a', wheat: '#d9b84e', crops: '#6c8f3a', stubble: '#b9a160',
  water: '#3f78b0', shallow: '#6aa0c8', stone: '#8d8a84', cobble: '#7d7468', wood: '#8b5e3c', rug: '#8c3b32',
  carpet: '#6b2f4a', cliff: '#4e4a46', void: '#000000',
};
const DIRS: Dir[] = ['down', 'up', 'left', 'right'];
const ANIMS: CharAnim[] = ['idle', 'walk', 'run', 'sneak', 'interact', 'kneel', 'sit', 'lie', 'cast', 'attack', 'shoot', 'hit', 'fall', 'carry', 'read'];

function canvas(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return { c, g: c.getContext('2d')! };
}

export function createArt(): ArtApi {
  const api: ArtApi = {
    init(scene) {
      for (const key of api.fxKeys()) {
        if (scene.textures.exists(key)) continue;
        const { c, g } = canvas(8, 8);
        g.fillStyle = key === 'fx-urmacht' ? '#49e0c8' : '#ffffff';
        g.beginPath(); g.arc(4, 4, 3, 0, Math.PI * 2); g.fill();
        scene.textures.addCanvas(key, c);
      }
    },
    buildGround(scene, spec: GroundSpec) {
      const key = `ground-stub-${spec.seed}-${spec.cols}x${spec.rows}`;
      if (!scene.textures.exists(key)) {
        const { c, g } = canvas(spec.cols * TILE, spec.rows * TILE);
        spec.terrain.forEach((row, y) => row.forEach((t, x) => {
          g.fillStyle = TERRAIN_COLORS[t] ?? '#ff00ff'; g.fillRect(x * TILE, y * TILE, TILE, TILE);
        }));
        scene.textures.addCanvas(key, c);
      }
      const container = scene.add.container(0, 0);
      container.add(scene.add.image(0, 0, key).setOrigin(0, 0));
      return container;
    },
    prop(scene, id, variant = 0): PropInfo {
      const key = `prop-stub-${id}`;
      const big = /tree|house|barn|tent|tower/.test(id);
      const w = big ? 32 : 16, h = big ? 48 : 16;
      if (!scene.textures.exists(key)) {
        const { c, g } = canvas(w, h);
        g.fillStyle = /tree|bush/.test(id) ? '#2f6b34' : '#7a5a3a'; g.fillRect(0, 0, w, h);
        scene.textures.addCanvas(key, c);
      }
      void variant;
      return { key, width: w, height: h, originX: w / 2, originY: h, footprint: { x: -w / 2, y: -8, w, h: 8 } };
    },
    propIds: () => ['tree-oak', 'bush', 'rock', 'house-farm', 'fence-h', 'campfire'],
    character(scene, idOrSpec: string | CharacterSpec, customKey?: string) {
      const key = customKey ?? (typeof idOrSpec === 'string' ? `char-${idOrSpec}` : `char-custom-${Math.random().toString(36).slice(2)}`);
      if (!scene.textures.exists(key)) {
        const { c, g } = canvas(16, 24);
        g.fillStyle = '#e8c39e'; g.fillRect(5, 2, 6, 6);
        g.fillStyle = typeof idOrSpec === 'string' && idOrSpec === 'lia' ? '#f2efe6' : '#4a4a6a'; g.fillRect(4, 8, 8, 10);
        g.fillStyle = '#3b2a20'; g.fillRect(5, 18, 2, 6); g.fillRect(9, 18, 2, 6);
        scene.textures.addSpriteSheet(key, c as unknown as HTMLImageElement, { frameWidth: 16, frameHeight: 24 });
        for (const a of ANIMS) for (const d of DIRS) {
          scene.anims.create({ key: api.animKey(key, a, d), frames: [{ key, frame: 0 }], frameRate: 1, repeat: -1 });
        }
      }
      return key;
    },
    animKey: (k, a, d) => `${k}:${a}:${d}`,
    characterIds: () => ['lia', 'kyra', 'valentus'],
    characterSize: () => ({ w: 16, h: 24 }),
    icon(scene, id) { const key = `icon-stub-${id}`; if (!scene.textures.exists(key)) { const { c, g } = canvas(16, 16); g.fillStyle = '#d8b25a'; g.fillRect(3, 3, 10, 10); scene.textures.addCanvas(key, c); } return key; },
    iconDataUrl() { const { c, g } = canvas(16, 16); g.fillStyle = '#d8b25a'; g.fillRect(3, 3, 10, 10); return c.toDataURL(); },
    iconIds: () => [],
    portrait() { const { c, g } = canvas(64, 64); g.fillStyle = '#2a2f3a'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#e8c39e'; g.fillRect(22, 14, 20, 22); return c.toDataURL(); },
    portraitIds: () => [],
    fxKeys: () => ['fx-dot', 'fx-dot-soft', 'fx-spark', 'fx-ember', 'fx-smoke', 'fx-leaf', 'fx-petal', 'fx-raindrop', 'fx-splash', 'fx-glow', 'fx-firefly', 'fx-urmacht', 'fx-dust', 'fx-ring', 'fx-star', 'fx-arrow'],
    color: (name: string) => (name === 'urmacht' ? 0x49e0c8 : 0xffffff),
  };
  return api;
}

// Keep the type import used for consumers that want Phaser types from here.
export type { Phaser };

import type Phaser from 'phaser';
import type { CharacterSpec } from '../api';
import type { Dir } from '../../core/types';
import { Px } from '../px';
import { hashString } from '../rng';
import { renderFrame } from './draw';
import { ALL_ANIMS, ANIM_DEFS, type AnyAnim, maxFrames, metrics, pose, weaponKind, type BodyType } from './rig';
import { ANIMAL_IDS, PRESETS, type Preset } from './specs';
import { ANIMALS, renderAnimalFrame } from './animals';

export const DIRS: Dir[] = ['down', 'up', 'left', 'right'];

export function animKey(charKey: string, anim: AnyAnim, dir: Dir): string {
  return `${charKey}:${anim}:${dir}`;
}

export function characterIds(): string[] {
  return [...Object.keys(PRESETS), ...ANIMAL_IDS];
}

const sizes = new Map<string, { w: number; h: number }>();

export function characterSize(key: string): { w: number; h: number } {
  return sizes.get(key) ?? { w: 24, h: 24 };
}

/** Renders the full sheet for a human spec: rows = anim × dir, columns = frames. */
export function renderSheet(spec: Preset): { sheet: Px; fw: number; fh: number; layout: Map<string, number[]> } {
  const flags = new Set(spec.extra ?? []);
  const m = metrics((spec.body ?? 'normal') as BodyType, { tall: flags.has('tall'), hunch: flags.has('hunch') });
  const cols = maxFrames();
  const rows = ALL_ANIMS.length * DIRS.length;
  const sheet = new Px(cols * m.fw, rows * m.fh);
  const wk = weaponKind(spec.weapon);
  const bound = flags.has('bound');
  const layout = new Map<string, number[]>();
  ALL_ANIMS.forEach((anim, ai) => {
    const def = ANIM_DEFS[anim];
    DIRS.forEach((dir, di) => {
      const row = ai * DIRS.length + di;
      const frames: number[] = [];
      for (let f = 0; f < def.frames; f++) {
        const fr = renderFrame(spec, m, pose(anim, f, wk, bound), dir, wk);
        sheet.blit(fr, f * m.fw, row * m.fh);
        frames.push(row * cols + f);
      }
      layout.set(`${anim}:${dir}`, frames);
    });
  });
  return { sheet, fw: m.fw, fh: m.fh, layout };
}

let customCounter = 0;

export function ensureCharacter(scene: Phaser.Scene, idOrSpec: string | CharacterSpec, customKey?: string): string {
  const isId = typeof idOrSpec === 'string';
  const key = customKey ?? (isId ? `char:${idOrSpec}` : `char:custom:${hashString(JSON.stringify(idOrSpec))}:${customCounter}`);
  if (scene.textures.exists(key) && sizes.has(key)) return key;
  if (isId && ANIMALS[idOrSpec]) return ensureAnimal(scene, idOrSpec, key);
  let spec: Preset;
  if (isId) {
    spec = PRESETS[idOrSpec] ?? PRESETS['villager-m'];
    if (!PRESETS[idOrSpec]) console.warn(`[art] unknown character "${idOrSpec}", using villager-m`);
  } else spec = idOrSpec;
  const { sheet, fw, fh, layout } = renderSheet(spec);
  scene.textures.addSpriteSheet(key, sheet.toCanvas() as unknown as HTMLImageElement, { frameWidth: fw, frameHeight: fh });
  sizes.set(key, { w: fw, h: fh });
  for (const anim of ALL_ANIMS) for (const dir of DIRS) {
    const k = animKey(key, anim, dir);
    if (scene.anims.exists(k)) scene.anims.remove(k);
    const def = ANIM_DEFS[anim];
    scene.anims.create({
      key: k,
      frames: layout.get(`${anim}:${dir}`)!.map(frame => ({ key, frame })),
      frameRate: def.fps,
      repeat: def.repeat ? -1 : 0,
    });
  }
  return key;
}

function ensureAnimal(scene: Phaser.Scene, id: string, key: string): string {
  const def = ANIMALS[id];
  const cols = 6;
  const rows = ALL_ANIMS.length * DIRS.length;
  // animals only have a few real animations; every other key maps onto them
  const sheet = new Px(cols * def.w, (3 * DIRS.length) * def.h);
  const base: ('idle' | 'walk' | 'run')[] = ['idle', 'walk', 'run'];
  const layout = new Map<string, number[]>();
  base.forEach((anim, ai) => DIRS.forEach((dir, di) => {
    const row = ai * DIRS.length + di;
    const n = anim === 'idle' ? def.idleFrames : 6;
    const frames: number[] = [];
    for (let f = 0; f < n; f++) {
      sheet.blit(renderAnimalFrame(id, anim, f, dir), f * def.w, row * def.h);
      frames.push(row * cols + f);
    }
    layout.set(`${anim}:${dir}`, frames);
  }));
  void rows;
  scene.textures.addSpriteSheet(key, sheet.toCanvas() as unknown as HTMLImageElement, { frameWidth: def.w, frameHeight: def.h });
  sizes.set(key, { w: def.w, h: def.h });
  for (const anim of ALL_ANIMS) for (const dir of DIRS) {
    const k = animKey(key, anim, dir);
    if (scene.anims.exists(k)) scene.anims.remove(k);
    const src: 'idle' | 'walk' | 'run' = anim === 'walk' || anim === 'carry' || anim === 'sneak' ? 'walk' : anim === 'run' ? 'run' : 'idle';
    const fps = src === 'run' ? def.runFps : src === 'walk' ? def.walkFps : def.idleFps;
    scene.anims.create({ key: k, frames: layout.get(`${src}:${dir}`)!.map(frame => ({ key, frame })), frameRate: fps, repeat: -1 });
  }
  return key;
}

export { PRESETS };

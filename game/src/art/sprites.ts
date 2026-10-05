import type Phaser from 'phaser';
import type { CharAnim, CharAnimExtra, CharacterSpec } from './api';
import type { Dir } from '../core/types';
import { upgradableTexture, whenReady } from './assets';
import { manifest, type CharacterEntry, type PoseEntry } from './manifest';
import { color as paletteColor, toHex } from './palette';
import { placeholderPose, placeholderWalkSheet } from './placeholder';

/**
 * Characters from Codex-generated sheets (DESIGN.md §3):
 *   texture `chr:<id>`              256×256 walk sheet, 16 frames of 64×64, rows down/left/right/up, foot (32, 60)
 *   texture `chr:<id>:<pose>[:dir]` pose images (64×64, lying 128×64; may be strips), `:flip` = mirrored
 *   anims   `<charKey>:<anim>:<dir>` for every CharAnim/CharAnimExtra (see ANIM_SOURCE for the mapping)
 * Ids without a walk sheet get a neutral silhouette with the same geometry.
 */

export const DIRS: Dir[] = ['down', 'up', 'left', 'right'];
const SHEET_ROWS: Dir[] = ['down', 'left', 'right', 'up'];
export const FRAME = 64;
export const FOOT = { x: 32, y: 60 };

export const ALL_ANIMS: (CharAnim | CharAnimExtra)[] = [
  'idle', 'walk', 'run', 'sneak', 'interact', 'kneel', 'sit', 'lie', 'cast', 'attack', 'shoot', 'hit', 'fall', 'carry',
  'read', 'sit-read', 'crouch', 'sleep', 'struggle', 'wave', 'point', 'talk', 'cheer',
];

/** Pose fallback chains: first pose image that exists wins; 'idle' = first frame of the walk row. */
const ANIM_SOURCE: Record<string, string[]> = {
  idle: ['idle'], interact: ['interact', 'idle'], kneel: ['kneel', 'crouch', 'idle'], sit: ['sit', 'kneel', 'idle'],
  lie: ['lie', 'idle'], sleep: ['sleep', 'lie', 'idle'], fall: ['fall', 'lie', 'idle'], cast: ['cast', 'idle'],
  attack: ['attack', 'cast', 'idle'], shoot: ['shoot', 'attack', 'idle'], hit: ['hit', 'hurt', 'idle'],
  read: ['read', 'sit-read', 'idle'], 'sit-read': ['sit-read', 'read', 'sit', 'idle'], crouch: ['crouch', 'kneel', 'idle'],
  struggle: ['struggle', 'hurt', 'idle'], wave: ['wave', 'idle'], point: ['point', 'idle'], talk: ['talk', 'idle'],
  cheer: ['cheer', 'idle'],
};
/** Anims that move: built from the walk rows (or a dedicated pose strip when present). */
const MOVING: Record<string, { pose?: string; fps: number }> = {
  walk: { fps: 8 }, run: { fps: 12 }, carry: { pose: 'carry', fps: 7 }, sneak: { pose: 'sneak', fps: 5 },
};

const info = new Map<string, { id: string; placeholder: boolean; height: number }>();
let customCounter = 0;

export function animKey(charKey: string, anim: CharAnim | CharAnimExtra | string, dir: Dir): string {
  return `${charKey}:${anim}:${dir}`;
}

export function characterIds(): string[] {
  return Object.keys(manifest().characters).filter(id => manifest().characters[id].walk);
}

export function characterSize(_key: string): { w: number; h: number } {
  return { w: FRAME, h: FRAME };
}

export function characterAnchor(_key: string): { x: number; y: number } {
  return { x: FOOT.x / FRAME, y: FOOT.y / FRAME };
}

export function characterInfo(key: string) { return info.get(key); }

function specTint(spec: CharacterSpec): string | undefined {
  const c = spec.cloak?.color ?? spec.top?.color;
  if (!c) return undefined;
  if (c.startsWith('#')) return c;
  try { return toHex(paletteColor(c)); } catch { return undefined; }
}

/** Texture + anims for a character id (manifest) or custom spec (placeholder tinted from the spec). */
export function ensureCharacter(scene: Phaser.Scene, idOrSpec: string | CharacterSpec, customKey?: string): string {
  const isId = typeof idOrSpec === 'string';
  const id = isId ? idOrSpec : `custom-${customCounter++}`;
  const key = customKey ?? (isId ? `chr:${id}` : `chr:${id}`);
  if (scene.textures.exists(key) && info.has(key)) return key;
  const entry: CharacterEntry | undefined = isId ? manifest().characters[idOrSpec] : undefined;
  const height = entry?.height ?? 40;
  const tint = isId ? undefined : specTint(idOrSpec);
  const textures = scene.textures;
  const grid = { w: FRAME, h: FRAME, count: 16, cols: 4 };
  if (entry?.walk) {
    upgradableTexture(textures, key, 256, 256, grid, placeholderWalkSheet(id, undefined, height), entry.walk.file);
  } else {
    if (isId && !warned.has(id)) { warned.add(id); console.info(`[art] no walk sheet for "${id}" yet — placeholder silhouette`); }
    upgradableTexture(textures, key, 256, 256, grid, placeholderWalkSheet(id, tint, height));
  }
  info.set(key, { id, placeholder: !entry?.walk, height });
  buildAnims(scene, key, entry);
  return key;
}
const warned = new Set<string>();

function poseTexture(scene: Phaser.Scene, key: string, pose: string, p: Omit<PoseEntry, 'dirs'>, flip: boolean, suffix = ''): string {
  const tkey = `${key}:${pose}${suffix}${flip ? ':flip' : ''}`;
  upgradableTexture(scene.textures, tkey, p.w * p.frames, p.h, { w: p.w, h: p.h, count: p.frames, cols: p.frames },
    placeholderPose(p.w, p.h, p.frames, pose), p.file, flip);
  return tkey;
}

/** Frames for (pose, dir): explicit dir variant → mirrored opposite variant → default (mirrored if needed). */
function poseFrames(scene: Phaser.Scene, key: string, pose: string, pe: PoseEntry, dir: Dir): { key: string; frame: number }[] {
  const opposite: Partial<Record<Dir, Dir>> = { left: 'right', right: 'left' };
  let tkey: string;
  let frames = pe.frames;
  if (pe.dirs?.[dir]) {
    tkey = poseTexture(scene, key, pose, pe.dirs[dir]!, false, `:${dir}`);
    frames = pe.dirs[dir]!.frames;
  } else if (opposite[dir] && pe.dirs?.[opposite[dir]!]) {
    tkey = poseTexture(scene, key, pose, pe.dirs[opposite[dir]!]!, true, `:${opposite[dir]}`);
    frames = pe.dirs[opposite[dir]!]!.frames;
  } else {
    const mirror = (dir === 'left' && pe.facing === 'right') || (dir === 'right' && pe.facing === 'left');
    tkey = poseTexture(scene, key, pose, pe, mirror);
  }
  return Array.from({ length: frames }, (_, i) => ({ key: tkey, frame: i }));
}

function buildAnims(scene: Phaser.Scene, key: string, entry: CharacterEntry | undefined): void {
  const poses = entry?.poses ?? {};
  const walkFps = entry?.walk?.fps ?? 8;
  for (const dir of DIRS) {
    const row = SHEET_ROWS.indexOf(dir);
    const walkFrames = [0, 1, 2, 3].map(i => ({ key, frame: row * 4 + i }));
    const idleFrames = poses.idle ? poseFrames(scene, key, 'idle', poses.idle, dir) : [{ key, frame: entry?.walk?.idle?.[row] ?? row * 4 }];
    for (const anim of ALL_ANIMS) {
      const k = animKey(key, anim, dir);
      if (scene.anims.exists(k)) scene.anims.remove(k);
      let frames = idleFrames;
      let fps = 4;
      let repeat = -1;
      const mv = MOVING[anim];
      if (mv) {
        if (mv.pose && poses[mv.pose]) { frames = poseFrames(scene, key, mv.pose, poses[mv.pose], dir); fps = poses[mv.pose].fps ?? mv.fps; }
        else { frames = walkFrames; fps = anim === 'walk' ? walkFps : mv.fps; }
      } else {
        const src = (ANIM_SOURCE[anim] ?? [anim, 'idle']).find(p => p === 'idle' || poses[p]);
        if (src && src !== 'idle') {
          const pe = poses[src];
          frames = poseFrames(scene, key, src, pe, dir);
          fps = pe.fps ?? 6;
          repeat = pe.loop === false ? 0 : -1;
        }
      }
      scene.anims.create({ key: k, frames, frameRate: fps, repeat });
    }
    // Every other painted pose (animal poses like graze/peck/fly, 'hurt', …) is playable under its own name.
    for (const pose of Object.keys(poses)) {
      if ((ALL_ANIMS as string[]).includes(pose) || MOVING[pose]) continue;
      const k = animKey(key, pose, dir);
      if (scene.anims.exists(k)) scene.anims.remove(k);
      const pe = poses[pose];
      scene.anims.create({ key: k, frames: poseFrames(scene, key, pose, pe, dir), frameRate: pe.fps ?? 6, repeat: pe.loop === false ? 0 : -1 });
    }
  }
}

/** Resolves when all textures of a character key show painted art. */
export async function characterReady(key: string): Promise<void> {
  const keys = [key];
  const id = info.get(key)?.id;
  const entry = id ? manifest().characters[id] : undefined;
  if (entry) for (const pose of Object.keys(entry.poses)) keys.push(`${key}:${pose}`, `${key}:${pose}:flip`);
  await Promise.all(keys.map(whenReady));
}

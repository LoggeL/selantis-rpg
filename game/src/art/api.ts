import type Phaser from 'phaser';
import type { Dir } from '../core/types';

/**
 * CONTRACT between art/ (producer) and world/, tactics/, ui/, chapters/ (consumers).
 * All graphics are generated procedurally into canvases and registered as Phaser textures once.
 * The art agent owns the implementation in art/index.ts and may ADD members; it must not remove or rename these.
 */

export const TILE = 16;
/** Standard character frame. Huge characters (Baris) use 24x32. Origin is bottom-center (feet) at (0.5, 1). */
export const CHAR_W = 16;
export const CHAR_H = 24;

export type TerrainId =
  | 'grass' | 'meadow' | 'darkgrass' | 'forest'      // greens (forest = dark forest floor with leaf litter)
  | 'dirt' | 'path' | 'road' | 'mud' | 'sand'        // ground (path = trodden footpath, road = wide cart road)
  | 'wheat' | 'crops' | 'stubble'                    // fields (wheat is tall, sways)
  | 'water' | 'shallow'                              // water (animated), shallow is wadeable ford
  | 'stone' | 'cobble' | 'wood' | 'rug' | 'carpet'   // floors (wood = plank floor, stone = flagstones)
  | 'cliff' | 'void';                                // impassable

export interface GroundSpec {
  cols: number;
  rows: number;
  /** terrain[row][col] */
  terrain: TerrainId[][];
  seed: number;
  /** Optional tint mood baked into tiles (e.g. autumn later). */
  palette?: 'summer' | 'night';
}

export type CharAnim =
  | 'idle' | 'walk' | 'run' | 'sneak' | 'interact' | 'kneel' | 'sit' | 'lie'
  | 'cast' | 'attack' | 'shoot' | 'hit' | 'fall' | 'carry' | 'read';

export interface CharacterSpec {
  body?: 'slim' | 'normal' | 'broad' | 'huge' | 'child';
  skin: string;             // palette color name or hex
  hair?: { style: string; color: string };
  top?: { style: string; color: string; trim?: string };
  bottom?: { style: string; color: string };
  cloak?: { style: string; color: string; trim?: string };
  head?: { style: string; color?: string };   // helmet, beret, hood, bandana, cap, headscarf, ...
  beard?: { style: string; color: string };
  ears?: 'human' | 'elf';
  weapon?: string;          // sword, axe, spear, bow, crossbow, staff, dagger, scimitar, none
  shield?: string;
  extra?: string[];         // e.g. 'scar-left', 'necklace', 'satchel', 'apron', 'quiver', 'pauldrons', 'glow'
}

export interface PropInfo {
  key: string;              // texture key
  width: number;
  height: number;
  /** Origin in px from top-left (usually bottom-center of the footprint). */
  originX: number;
  originY: number;
  /** Collision footprint relative to the origin point, in px. Null = no collision. */
  footprint: { x: number; y: number; w: number; h: number } | null;
  /** If true, consumers may apply wind sway to the top part. */
  sway?: boolean;
  /** Animated props expose an animation key (campfire, torch, water wheel...). */
  anim?: string;
  /** Light emitted by this prop (world adds a light source). */
  light?: { radius: number; color: number; flicker?: boolean; offsetY?: number };
}

export interface ArtApi {
  /** Generate all shared textures (tiles atlas, fx, ui icons). Idempotent; call from Boot. */
  init(scene: Phaser.Scene): void;

  /** Builds the ground layer (autotiled, varied, animated water) for a map. Returns a container at (0,0). */
  buildGround(scene: Phaser.Scene, spec: GroundSpec): Phaser.GameObjects.Container;

  /** Ensures a prop texture exists and returns its info. `variant` picks a deterministic visual variant. */
  prop(scene: Phaser.Scene, id: string, variant?: number): PropInfo;
  /** All available prop ids (for galleries and validation). */
  propIds(): string[];

  /**
   * Ensures textures + animations for a character and returns the texture key.
   * `idOrSpec` is a preset id (see characterIds()) or a custom spec.
   * Animation keys: animKey(key, anim, dir). Left is usually right mirrored by the art layer itself.
   */
  character(scene: Phaser.Scene, idOrSpec: string | CharacterSpec, customKey?: string): string;
  animKey(charKey: string, anim: CharAnim, dir: Dir): string;
  characterIds(): string[];
  /** Frame size of a generated character key. */
  characterSize(charKey: string): { w: number; h: number };

  /** Small 16x16 item/UI icons as Phaser texture keys and as data URLs (for DOM UI). */
  icon(scene: Phaser.Scene, id: string): string;
  iconDataUrl(id: string): string;
  iconIds(): string[];

  /**
   * Particle/FX textures. Keys always available after init():
   * 'fx-dot', 'fx-dot-soft', 'fx-spark', 'fx-ember', 'fx-smoke', 'fx-leaf', 'fx-petal', 'fx-raindrop', 'fx-splash',
   * 'fx-glow' (soft radial, for lights), 'fx-firefly', 'fx-urmacht', 'fx-dust', 'fx-ring', 'fx-star', 'fx-arrow'.
   */
  fxKeys(): string[];

  /** Named palette colors as numbers (e.g. palette('urmacht') -> 0x49e0c8). */
  color(name: string): number;
}

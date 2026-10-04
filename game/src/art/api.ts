import type Phaser from 'phaser';
import type { Dir } from '../core/types';

/**
 * CONTRACT between art/ (producer) and world/, tactics/, ui/, chapters/ (consumers).
 * All graphics are generated procedurally into canvases and registered as Phaser textures once.
 * The art agent owns the implementation in art/index.ts and may ADD members; it must not remove or rename these.
 */

export const TILE = 16;
/**
 * Standard character body size. Huge characters (Baris) have a 24x32 body. Origin is bottom-center (feet) at (0.5, 1).
 * NOTE (art): the generated frames are wider/taller than the body so weapons, bows and lying poses fit —
 * 24x24 for normal characters, 32x32 for huge ones. Always use characterSize(key) for the real frame size;
 * with origin (0.5, 1) the feet stay exactly at the sprite position.
 */
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

/**
 * (art extension) Additional animations every human character also has, same key scheme via animKey():
 * 'sit-read' (sitting with an open book), 'crouch' (static hiding crouch), 'sleep' (lying, eyes closed),
 * 'struggle' (hands tied behind the back, tugging), 'wave', 'point', 'talk' (gesturing), 'cheer'.
 * Animals map every key onto idle/walk/run.
 */
export type CharAnimExtra = 'sit-read' | 'crouch' | 'sleep' | 'struggle' | 'wave' | 'point' | 'talk' | 'cheer';

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
  /** (art extension) Additional light sources, positions relative to the origin (e.g. lit windows). */
  lights?: { x: number; y: number; radius: number; color: number; flicker?: boolean }[];
  /**
   * (art extension) Named points relative to the origin, e.g. 'door' (where to stand to enter),
   * 'seat', 'fire', 'smoke' (chimney top), 'sit' (bench/chair), 'hang' (cloak hook).
   */
  anchors?: Record<string, { x: number; y: number }>;
}

/** Assets to load before a scene uses them (Codex-generated art from public/assets/manifest.json). */
export interface AssetRequest {
  characters?: string[];   // walk sheets + poses of these character ids
  props?: string[];
  backgrounds?: string[];
  plates?: string[];
}

export interface ArtApi {
  /** Generate all shared textures (tiles atlas, fx, ui icons). Idempotent; call from Boot. */
  init(scene: Phaser.Scene): void;

  /**
   * ASSET-BASED ART (preferred, DESIGN.md §3): loads the requested Codex-generated assets listed in
   * public/assets/manifest.json into the scene's texture manager (idempotent, cached across scenes).
   * Missing ids resolve gracefully (fallback placeholder art) so scenes keep working while assets are produced.
   * After it resolves, character()/prop()/background() are synchronous for those ids.
   * Generated character sheets are 64x64 frames with the foot anchor at (32, 60) — use characterAnchor().
   */
  preload(scene: Phaser.Scene, req: AssetRequest): Promise<void>;
  /** A painted map background (640x360 or 1280x720). Returns the texture key and size. */
  background(scene: Phaser.Scene, id: string): { key: string; width: number; height: number };
  /** Origin (0..1) to place a character sprite so its feet stand on the given point. */
  characterAnchor(charKey: string): { x: number; y: number };
  /** Public URL of a code-independent plate/cutscene image (1280x720), e.g. 'assets/cut/raid-confrontation.jpg'. */
  plateUrl(id: string): string;
  /** Whether the manifest contains an asset (for content fallbacks). */
  hasAsset(kind: 'character' | 'prop' | 'background' | 'plate' | 'portrait', id: string): boolean;

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
  animKey(charKey: string, anim: CharAnim | CharAnimExtra, dir: Dir): string;
  characterIds(): string[];
  /** Frame size of a generated character key. */
  characterSize(charKey: string): { w: number; h: number };

  /**
   * Dialogue portrait URL: the Codex-generated 256x256 painting from public/assets/portraits/<id>[-<mood>].png
   * when present (mood falls back to neutral), otherwise a generated fallback data URL.
   * Derived from the same character spec as the sprite so they match. Original designs only —
   * never modelled on film actors (DESIGN.md §2). Moods at least: neutral, happy, sad, angry, surprised,
   * determined, hurt, thinking, scared. Unknown ids fall back to a hooded silhouette.
   */
  portrait(id: string, mood?: string): string;
  portraitIds(): string[];

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

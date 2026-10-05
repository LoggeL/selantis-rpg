import type Phaser from 'phaser';
import type { Dir } from '../core/types';

/**
 * CONTRACT between art/ (producer) and world/, tactics/, ui/, chapters/ (consumers).
 * Graphics are Codex-generated painted assets listed in public/assets/manifest.json (DESIGN.md §3, pipeline in
 * docs/rebuild/art-pipeline.md); FX textures are procedural; ids without an asset get neutral placeholders.
 * The art agent owns the implementation in art/index.ts and may ADD members; it must not remove or rename these.
 */

/** World grid unit (px) for tile-based coordinates (world `units: 'tiles'`, collision cells). */
export const TILE = 16;
/**
 * Character frames: painted 64x64 cells (lying poses 128x64, weapon poses 96x64) with the feet at (32, 60) — use
 * characterSize(key) for the frame size and characterAnchor(key) as sprite origin (= (0.5, 0.9375)). Figures are
 * 38–44 px tall (Baris ~52).
 */
export const CHAR_FRAME = 64;

/** Ground materials of painted maps (world SurfaceDef.kind): footsteps, speed, dust, wading/hiding. */
export type TerrainId =
  | 'grass' | 'meadow' | 'darkgrass' | 'forest'      // greens (forest = dark forest floor with leaf litter)
  | 'dirt' | 'path' | 'road' | 'mud' | 'sand'        // ground (path = trodden footpath, road = wide cart road)
  | 'wheat' | 'crops' | 'stubble'                    // fields (wheat is tall, sways)
  | 'water' | 'shallow'                              // water (animated), shallow is wadeable ford
  | 'stone' | 'cobble' | 'wood' | 'rug' | 'carpet'   // floors (wood = plank floor, stone = flagstones)
  | 'cliff' | 'void';                                // impassable

export type CharAnim =
  | 'idle' | 'walk' | 'run' | 'sneak' | 'interact' | 'kneel' | 'sit' | 'lie'
  | 'cast' | 'attack' | 'shoot' | 'hit' | 'fall' | 'carry' | 'read';

/**
 * (art extension) Additional animations every human character also has, same key scheme via animKey():
 * 'sit-read' (sitting with an open book), 'crouch' (static hiding crouch), 'sleep' (lying, eyes closed),
 * 'struggle' (hands tied behind the back, tugging), 'wave', 'point', 'talk' (gesturing), 'cheer'.
 * Keys without a painted pose fall back along a chain ending in idle (e.g. sit → kneel → idle). Every other pose
 * listed in the manifest (animal poses such as 'graze', 'peck', 'fly', or 'hurt') is playable under its own name:
 * animKey(key, '<pose>' as CharAnimExtra, dir). See (G.art as ArtApi & ArtExtras).poseIds(id).
 */
export type CharAnimExtra = 'sit-read' | 'crouch' | 'sleep' | 'struggle' | 'wave' | 'point' | 'talk' | 'cheer';

/**
 * Legacy look description from the procedural era. Characters are painted manifest ids now; a spec only tints the
 * placeholder silhouette (cloak/top colour) so unknown figures stay distinguishable until their sheets exist.
 */
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

  /** Ensures a prop texture exists and returns its info. `variant` picks a deterministic visual variant. */
  prop(scene: Phaser.Scene, id: string, variant?: number): PropInfo;
  /** All available prop ids (for galleries and validation). */
  propIds(): string[];

  /**
   * Ensures textures + animations for a character and returns the texture key.
   * `idOrSpec` is a manifest character id (see characterIds()) or a custom spec (→ placeholder silhouette tinted
   * with the spec's cloak/top colour; unknown ids → neutral silhouette, both with the same 64x64 geometry).
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
   * Original designs only —
   * never modelled on film actors (DESIGN.md §2). Moods at least: neutral, happy, sad, angry, surprised,
   * determined, hurt, thinking, scared. Unknown ids fall back to a hooded silhouette.
   */
  portrait(id: string, mood?: string): string;
  portraitIds(): string[];

  /** Item/UI icons (32x32 from the painted atlas ui/items.png, else 16x16 procedural) as texture keys and data URLs. */
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

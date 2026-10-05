import type Phaser from 'phaser';
import type { CharAnim, CharacterSpec, TerrainId } from '../art/api';
import type { AmbienceLayer, MusicMood } from '../audio/api';
import type { ChoiceOption } from '../ui/api';
import type { Dir } from '../core/types';

/**
 * CONTRACT between world/ (producer) and chapters/ (consumers).
 *
 * A chapter scene is a map definition plus a few async functions:
 *
 *   const wiese = defineMap({ id: 'wiese', background: 'wiese', walk: [[[40, 300], …]], spawns: {...}, … });
 *   start: () => startWorld({ map: wiese, spawn: 'start', script: async w => { ... } })
 *
 * Maps are PAINTED (DESIGN.md §3/§6.2): `background` names a Codex-painted image (assets/bg/<id>.png, 640x360 or
 * 1280x720 scrolling) and the geometry is drawn on top as polygons in MAP PIXELS. Every coordinate and distance
 * (At, Area, wander, guard range, waitForNear radius) is in PIXELS: [312, 240] is a pixel. `units: 'tiles'` switches
 * At/Area/distances to 16 px tiles (a tile position = the tile's centre); polygons are always pixels.
 *
 * The world agent owns this file and may ADD members; it must not remove or rename these.
 */

// ---------------------------------------------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------------------------------------------

/** A position: [x, y] or { x, y } in map units (pixels by default, see MapDef.units); { x, y, px: true } is always pixels. */
export type At = readonly [number, number] | { x: number; y: number; px?: boolean };
/** A rectangle in map units (x, y = top-left corner), or pixels with px: true. */
export interface Area { x: number; y: number; w: number; h: number; px?: boolean }

export type TimeOfDay = 'day' | 'dusk' | 'night' | 'dawn' | 'storm';
export type WeatherKind = 'none' | 'rain' | 'storm' | 'fog' | 'fireflies' | 'leaves' | 'pollen';
export type EmoteKind = '!' | '?' | '…' | 'heart' | 'drop' | 'anger' | 'note';
export type LightKind = 'fire' | 'lantern' | 'candle' | 'window' | 'urmacht' | 'moon' | 'plain';
export type HideKind = 'bush' | 'grass' | 'crate';
export type ClueKind = 'footprint' | 'hoof' | 'branch' | 'bead' | 'glint' | 'blood' | 'rope' | 'mark';

/** A polygon in MAP PIXELS, closed implicitly: [[x, y], [x, y], …]. Author with the debug overlay (F1 / ?debug). */
export type Polygon = readonly (readonly [number, number])[];

/** A walkable area with optional holes (ponds, rocks inside a meadow). */
export interface WalkArea { poly: Polygon; holes?: Polygon[] }

/** An obstacle inside the walkable area. Blocks movement and (by default) guard vision. */
export interface BlockDef {
  id?: string;
  poly: Polygon;
  /** Blocks guard vision (default true). Ponds and low fences: false. */
  sight?: boolean;
  /** Blocks movement (default true). false + sight = a see-through-proof hedge you can walk around in. */
  move?: boolean;
}

/**
 * A part of the background that is redrawn ABOVE actors whose feet are above (smaller y than) its baseline:
 * tree crowns and trunks, roofs, arches, hedges, foreground bushes. The baseline is where the object meets the
 * ground (default: the lowest point of the polygon).
 */
export interface OccluderDef {
  id?: string;
  poly: Polygon;
  baseline?: number;
  /** Alpha while it covers the player (e.g. 0.55 for big crowns so Lia stays visible). Default 1 (opaque). */
  fade?: number;
}

/** Ground material inside a polygon: footstep sound, dust/splash, speed, wading (wheat hides the legs). */
export interface SurfaceDef {
  id?: string;
  poly: Polygon;
  kind: TerrainId;
  /** Speed factor (default from the kind: wheat 0.82, shallow 0.55, mud 0.72 …). */
  speed?: number;
  /** A crouching player is hidden here (default: kind is in MapDef.hideTerrain, i.e. wheat). */
  hide?: boolean;
}

/** Perspective: characters get smaller towards the back (y0, scale s0) and bigger at the front (y1, scale s1). */
export interface DepthScaleDef { y0: number; s0: number; y1: number; s1: number }

/** Handlers receive the world context. They may be async; while one runs the same object cannot re-trigger. */
export type WorldHandler = (w: WorldCtx) => void | Promise<void>;

// ---------------------------------------------------------------------------------------------------------------
// Map definition
// ---------------------------------------------------------------------------------------------------------------

export interface MapDef {
  id: string;
  /** German place name, shown as a small toast when entering via an exit (optional). */
  name?: string;

  /**
   * Painted background id (game/public/assets/bg/<id>.png, from the asset manifest via G.art). 640x360 = one
   * screen, 1280x720 = scrolling (the camera follows within the bounds). Required.
   */
  background: string;
  /** Explicit URL for the background (default: the manifest, then 'assets/bg/<id>.png'). */
  backgroundUrl?: string;
  /** Map size in px (default: the background's size). */
  size?: { w: number; h: number };
  /** Coordinate units for At/Area/distances. Default 'px'. */
  units?: 'px' | 'tiles';
  /**
   * Time of day already painted into the background (a night clearing): the engine grades it only lightly for that
   * time, so it is not darkened twice. Lights, darkness-driven effects and transitions to other times still work.
   */
  baked?: TimeOfDay;
  /** Walkable polygons (union). Everything outside is blocked. Holes and `block` polygons cut obstacles out. */
  walk?: (Polygon | WalkArea)[];
  /** Obstacles (trunks, walls, the pond). */
  block?: (Polygon | BlockDef)[];
  /** Parts of the background drawn in front of actors standing behind them (see OccluderDef). */
  occluders?: (Polygon | OccluderDef)[];
  /** Ground materials (footsteps, speed, wading/hiding). Later entries win. */
  surfaces?: SurfaceDef[];
  /** Material outside all surfaces (default 'grass'). */
  surface?: TerrainId;
  /** Optional y-based character scale for perspective. */
  depthScale?: DepthScaleDef;
  /**
   * World scale: character size relative to the 16 px tile world. Default 1.75 (~42 px figures). Walk speeds, interaction radii, follow distances, guard range and the foot box scale with it.
   */
  worldScale?: number;
  /**
   * Base scale for character sprites. Default 1 for the 64x64 Codex sheets (~42 px figures); the small procedural
   * fallback sprites are shown at 2 on painted maps so placeholder art has the right size.
   */
  spriteScale?: number;

  props?: PropDef[];
  npcs?: NpcDef[];
  interactables?: InteractableDef[];
  exits?: ExitDef[];
  triggers?: TriggerDef[];
  guards?: GuardDef[];
  lights?: LightDef[];
  hidingSpots?: HidingSpotDef[];
  /** Spurenblick clues: only visible (glowing turquoise) while look mode is held. */
  clues?: ClueDef[];
  /** Named spawn points. 'default' (or the first) is used when none is given. */
  spawns: Record<string, SpawnDef>;

  time?: TimeOfDay;
  weather?: WeatherKind;
  /** Ambience layers (G.audio.ambience). Volume per layer optional. */
  ambience?: AmbienceLayer[];
  ambienceVolume?: Partial<Record<AmbienceLayer, number>>;
  /** Music mood. undefined keeps what is playing, null fades out. */
  music?: MusicMood | null;

  camera?: {
    /** Camera bounds in map units (default: whole map). */
    bounds?: Area;
    zoom?: number;
    /** Look-ahead in px in movement direction (default 18). */
    lookahead?: number;
  };

  /** Allow Spurenblick (hold Q) on this map. Can also be toggled by script (w.lookMode.enable()). */
  lookMode?: boolean;
  /** Allow sneaking (C/Ctrl). Default true. */
  sneak?: boolean;
  /** Stealth settings. checkpoint = spawn name used when spotted (default: the entry spawn). */
  stealth?: { checkpoint?: string; onSpotted?: (w: WorldCtx, guard: ActorHandle) => void | Promise<void> };

  /** Player character preset/spec for this map (default: StartWorldOptions.player ?? 'lia'). */
  player?: string | CharacterSpec;
  /** Soft light around the player (px radius) - useful on dark maps. */
  playerLight?: number;
  /** Tall terrain that hides a crouching player (default ['wheat']). */
  hideTerrain?: TerrainId[];
  /** Ambient critters: butterflies by day, birds that take off. Default: auto (butterflies on day meadow maps). */
  critters?: boolean;

  /** Runs every time this map is entered (after fade-in). Use w.onMap() for listeners that should end with the visit. */
  onEnter?: WorldHandler;

  /**
   * Maps REMEMBER their state between visits (and in save games): used/removed interactables, fired once-triggers,
   * removed props, found clues, disabled objects and lighting/weather set by scripts. true = start fresh every time.
   */
  resetOnEnter?: boolean;
}

export interface SpawnDef { at: At; dir?: Dir }

export interface PropDef {
  /** Art prop id (G.art.propIds()). */
  prop: string;
  at: At;
  /** Handle id for scripts (w.prop(id)). */
  id?: string;
  variant?: number;
  flipX?: boolean;
  /** Default: the art footprint collides. false = walk through. */
  collide?: boolean;
  /** Default: props with a footprint block guard vision (unless they are hiding spots). */
  blocksView?: boolean;
  /** Override the art sway hint. */
  sway?: boolean;
  /** Makes this prop a hiding spot (no collision, a crouching player inside is invisible). */
  hide?: HideKind;
  /** Draw above the player regardless of y (e.g. a roof overhang, arch). */
  above?: boolean;
  /** Depth offset in px for fine y-sorting tweaks. */
  depthOffset?: number;
  /** Shortcut: makes the prop interactable. */
  interact?: Omit<InteractableDef, 'id' | 'at' | 'prop'> & { id?: string };
  /** Extra light, merged with the art light (if any). false disables the art light. */
  light?: Omit<LightDef, 'at'> | false;
  tint?: number;
  alpha?: number;
}

export interface NpcDef {
  id: string;
  /** Character preset id or spec (G.art.character). */
  preset: string | CharacterSpec;
  at: At;
  dir?: Dir;
  /** Speaker id for dialogue (default: id). */
  speaker?: string;
  /** Idle animation (default 'idle'). */
  idle?: CharAnim;
  /** Wander radius around the start position (map units, px by default). */
  wander?: number;
  /** Talk handler. Without it the NPC is not interactable. */
  talk?: (w: WorldCtx, npc: ActorHandle) => void | Promise<void>;
  verb?: string;
  /** Ambient barks shown as speech bubbles every `barkEvery` ms (random order). */
  barks?: string[];
  barkEvery?: number;
  /** Turn towards the player when talking (default true). */
  facePlayer?: boolean;
  /** Blocks the player (default true). */
  solid?: boolean;
  /** Initially hidden (spawn later with w.actor(id).show()). */
  hidden?: boolean;
  /** Walk speed in px/s (default 45). */
  speed?: number;
}

export interface InteractableDef {
  id: string;
  /** Anchor point (feet/ground). Optional when `poly` is given (then: bottom centre of the polygon). */
  at?: At;
  /** Verb shown in the hint, e.g. „Untersuchen“, „Aufheben“, „Öffnen“. */
  verb?: string;
  /** Optional visual: prop id rendered at `at`. */
  prop?: string;
  variant?: number;
  /** Interaction radius in px (default 18 × world scale; with `poly`: distance to the polygon outline). */
  radius?: number;
  /** Hotspot polygon in map px (painted maps: the drawn object itself). Clickable; `at` defaults to its base. */
  poly?: Polygon;
  /** Size of the clickable/hover area in px (default 16x16, centered above `at`). */
  size?: { w: number; h: number };
  onInteract?: WorldHandler;
  /** Shortcut: gives an item (toast + pickup sfx). */
  item?: { id: string; n?: number; name?: string };
  /** Shortcut: a short thought line by the player. */
  thought?: string;
  /** Removed after the first use (default false; true when `item` is set). */
  once?: boolean;
  /** Dynamic enable check (e.g. () => G.state.is('flag')). */
  when?: () => boolean;
  /** Small sparkle so the player notices it (default true for items). */
  sparkle?: boolean;
  /** Hide the object (prop + sparkle) when used up. Default true for items. */
  removeOnUse?: boolean;
  /**
   * Where the player stands while interacting (sit on the bench, kneel at the grave, stand at the door). The player
   * walks there first; companions step aside. `{ anchor: 'sit' }` uses a named anchor of this object's prop
   * (PropInfo.anchors; falls back to the prop's base), `{ anchor, prop }` one of another prop.
   */
  standAt?: At | { anchor: string; prop?: string };
  /** Direction the player faces at the stand point (default: towards the object). */
  face?: Dir;
}

export interface ExitDef {
  id: string;
  /** Walking into this area (or `poly`) triggers the transition. */
  area?: Area;
  poly?: Polygon;
  /** Fade duration in ms (default 420). */
  fade?: number;
  to: string;
  spawn?: string;
  /** Direction the player keeps walking while fading out (auto-detected from the area at the map edge). */
  dir?: Dir;
  /** Door-style exit: needs interaction instead of walking in. */
  door?: { at: At; verb?: string };
  when?: () => boolean;
  /** Thought shown (once per approach) when `when` fails. */
  blocked?: string;
}

export interface TriggerDef {
  id: string;
  /** Rectangle (map units) or `poly` (px). */
  area?: Area;
  poly?: Polygon;
  /** Default true. */
  once?: boolean;
  onEnter?: WorldHandler;
  onExit?: WorldHandler;
  when?: () => boolean;
}

export interface GuardWaypoint { at: At; /** ms to wait here */ wait?: number; /** direction to look while waiting */ face?: Dir }

export interface GuardDef {
  id: string;
  preset: string | CharacterSpec;
  /** Patrol path (loops). A single waypoint = stationary guard (use `face`). */
  path: (At | GuardWaypoint)[];
  /** 'loop' (default) or 'pingpong'. */
  mode?: 'loop' | 'pingpong';
  speed?: number;
  /** View range in map units (default 5.5 tiles = 88 px) and full cone angle in degrees (default 70). */
  range?: number;
  fov?: number;
  /** Carries a lantern (adds a moving light, also drawn at night). */
  lantern?: boolean;
  /** Seconds of full exposure until spotted at mid range (default 1.3). */
  reaction?: number;
  speaker?: string;
  /** Lines barked when they become suspicious / lose interest. */
  suspiciousBarks?: string[];
  calmBarks?: string[];
}

export interface LightDef {
  id?: string;
  at: At;
  /** Radius in px (default 56). */
  radius?: number;
  color?: number;
  /** 0..1.5 (default 1). */
  intensity?: number;
  kind?: LightKind;
  /** Flicker amount 0..1 (fire default 1, candle 0.5, others 0). */
  flicker?: number;
  /** Lights fade in with darkness. Set true to show even at full day. */
  always?: boolean;
  /** Flame particles at the light (campfire over a painted fire pit). Number = size factor (default 1). */
  flame?: boolean | number;
}

export interface HidingSpotDef { id?: string; area?: Area; /** Polygon in px (painted bushes). */ poly?: Polygon; kind?: HideKind }

export interface ClueDef {
  id: string;
  at: At;
  kind?: ClueKind;
  /** Rotation of the marker in degrees (e.g. footprint direction). */
  angle?: number;
  verb?: string;
  /** Adds this clue id to the journal (G.state.addClue) on inspection. */
  clue?: string;
  /** Thought line of the player on inspection. */
  thought?: string;
  onInteract?: WorldHandler;
}

// ---------------------------------------------------------------------------------------------------------------
// Starting the world
// ---------------------------------------------------------------------------------------------------------------

export interface StartWorldOptions {
  map: string | MapDef;
  spawn?: string;
  /** Player preset (default 'lia'). */
  player?: string | CharacterSpec;
  /** Companions following the player (ids; preset = id unless given). */
  companions?: (string | { id: string; preset?: string | CharacterSpec; speaker?: string })[];
  /** Main script; runs once after the first map is visible. Cancelled silently when the scene ends. */
  script?: WorldHandler;
  /** Fade in from black (default true). */
  fadeIn?: boolean;
}

// ---------------------------------------------------------------------------------------------------------------
// Script context
// ---------------------------------------------------------------------------------------------------------------

export interface WalkOptions {
  /** px/s, overrides walk/run speed. */
  speed?: number;
  run?: boolean;
  /** Face this direction after arriving. */
  face?: Dir;
  /** Skip pathfinding and walk straight (cutscenes through obstacles). */
  straight?: boolean;
  /** With a prop id as target: walk to this named anchor of the prop ('sit', 'door', 'seat', …). */
  anchor?: string;
}

export interface ActorHandle {
  readonly id: string;
  /** Current feet position in px. */
  readonly x: number;
  readonly y: number;
  /** Current feet position in tiles (fractional). */
  readonly tile: { x: number; y: number };
  readonly dir: Dir;
  readonly exists: boolean;
  /** The underlying sprite (advanced use). */
  readonly sprite: Phaser.GameObjects.Sprite | undefined;

  /** Walks there with pathfinding. Tile coords, an At, or another actor/interactable id. */
  walkTo(x: number, y: number, opts?: WalkOptions): Promise<void>;
  walkTo(target: At | string, opts?: WalkOptions): Promise<void>;
  /** Walks a list of points in order. */
  walkPath(points: At[], opts?: WalkOptions): Promise<void>;
  /** Moves instantly. */
  teleport(at: At, dir?: Dir): void;
  /** Face a direction, an actor id or a position. */
  face(target: Dir | string | At): void;
  /** Plays an animation. once: plays once then returns to idle and resolves. */
  play(anim: CharAnim, opts?: { once?: boolean; ms?: number }): Promise<void>;
  /** Sets the animation used while standing (e.g. 'sit', 'read'). */
  setIdle(anim: CharAnim): void;
  emote(kind: EmoteKind, ms?: number): Promise<void>;
  /** Dialogue line with this actor as speaker. */
  say(text: string, opts?: { mood?: string; portrait?: string }): Promise<void>;
  /** Speech bubble over the head (non-blocking). Returns a remover. */
  bark(text: string, ms?: number): () => void;
  show(): void;
  hide(): void;
  /** Hop / small jump (surprise). */
  hop(): Promise<void>;
  /** Pause NPC wandering/patrol logic (scripts take control). */
  hold(on?: boolean): void;
  setSpeed(pxPerSec: number): void;
  /** Character preset or spec can be swapped (e.g. outfit change). */
  setLook(preset: string | CharacterSpec): void;
}

export interface LightHandle {
  readonly id: string;
  set(patch: Partial<Omit<LightDef, 'id'>>): void;
  /** Fade intensity to a value. */
  fadeTo(intensity: number, ms?: number): Promise<void>;
  remove(): void;
}

export interface PropHandle {
  readonly id: string;
  readonly exists: boolean;
  readonly image: Phaser.GameObjects.Image | undefined;
  setVisible(on: boolean): void;
  /** Shakes the prop (rustling bush, hit door). */
  shake(): void;
  remove(): void;
}

export interface WorldCtx {
  readonly scene: Phaser.Scene;
  readonly map: MapDef;
  readonly player: ActorHandle;
  /** False after the world scene ended. Long loops should check it. */
  readonly alive: boolean;

  actor(id: string): ActorHandle;
  /** Spawns an NPC at runtime (same options as in the map). */
  spawn(def: NpcDef): ActorHandle;
  despawn(id: string): void;
  prop(id: string): PropHandle;
  /** Adds a prop at runtime. */
  addProp(def: PropDef): PropHandle;

  // ---- dialogue shortcuts (G.ui with input safety) ----
  say(speaker: string, text: string, opts?: { mood?: string; portrait?: string }): Promise<void>;
  choose(options: (string | ChoiceOption)[], opts?: { speaker?: string; prompt?: string }): Promise<number>;
  narrate(lines: string | string[], opts?: { style?: 'book' | 'card' | 'thought' }): Promise<void>;
  think(text: string): Promise<void>;
  bark(actorId: string, text: string, ms?: number): () => void;

  wait(ms: number): Promise<void>;
  /** Blocks player movement/interaction (nested). */
  lockPlayer(): void;
  unlockPlayer(): void;
  /** Runs fn with player locked, letterbox and cinematic HUD; restores afterwards. */
  cutscene<T>(fn: () => Promise<T>): Promise<T>;

  waitForInteract(id: string): Promise<void>;
  waitForTrigger(id: string): Promise<void>;
  /** Resolves when the player is within `radius` (map units; default 1.5 tiles = 24 px) of the target. */
  waitForNear(target: At | string, radius?: number): Promise<void>;
  /**
   * Subscribes to world events. Returns an unsubscriber.
   * 'interact' (interactable/NPC/clue id), 'trigger' (enter), 'triggerExit', 'clue' (found), 'spotted' (guard id),
   * 'exit' (exit id, before the transition), 'map' (map id after entering).
   */
  on(event: WorldEvent, id: string | '*', handler: (id: string) => void | Promise<void>): () => void;
  /** Like on(), but removed automatically when the player leaves the current map (safe to call in onEnter). */
  onMap(event: WorldEvent, id: string | '*', handler: (id: string) => void | Promise<void>): () => void;

  /**
   * Device-aware name of a control for tutorial text: „C“ / „Q“ / „E“ / „Shift“ on keyboard,
   * „den Schleichen-Knopf“ etc. on touch. Example: `Halte ${w.controlHint('sneak')} gedrückt …`
   */
  controlHint(control: ControlName): string;

  /** Forgets what a map remembered (default: the current map; takes effect on the next visit). */
  resetMapMemory(mapId?: string): void;

  /** Sets the active objective (journal + HUD) and an optional world target for the edge pointer/marker. */
  setObjective(id: string, text: string, target?: At | string | null): void;
  completeObjective(id: string): void;
  /** Changes or clears just the target of the current objective. */
  setObjectiveTarget(target: At | string | null): void;

  interactable(id: string): { enable(): void; disable(): void; remove(): void; readonly used: boolean };
  /** Enables/disables an exit or trigger by id. */
  setEnabled(id: string, on: boolean): void;

  changeMap(mapId: string | MapDef, spawn?: string, opts?: { fadeMs?: number }): Promise<void>;

  camera: {
    /** Follow an actor (default: player) with smoothing and look-ahead. */
    follow(actorId?: string): void;
    /** Pans to a target and keeps it there until follow() is called. */
    pan(target: At | string, ms?: number): Promise<void>;
    shake(ms?: number, intensity?: number): void;
    zoom(zoom: number, ms?: number): Promise<void>;
    /** Short zoom pulse (impact, surprise). */
    punch(strength?: number): void;
  };

  lighting: {
    set(time: TimeOfDay, ms?: number): Promise<void>;
    readonly time: TimeOfDay;
    add(def: LightDef): LightHandle;
    get(id: string): LightHandle;
    /** Brief full-screen flash (lightning, magic). */
    flash(color?: number, ms?: number): void;
  };

  weather: {
    set(kind: WeatherKind, opts?: { intensity?: number; ms?: number }): void;
    readonly kind: WeatherKind;
  };

  stealth: {
    /** Where the player respawns when spotted (spawn name or position, optional facing). */
    checkpoint(spawnOrAt: string | At, dir?: Dir): void;
    /** Replaces the default reaction for this map visit (fade + respawn). Cleared on map change. Return value ignored. */
    onSpotted(handler: ((guard: ActorHandle) => void | Promise<void>) | null): void;
    /** Disables/enables all guard detection (cutscenes). */
    enable(on: boolean): void;
    /** Resets guards to their patrol start and suspicion to 0. */
    resetGuards(): void;
    /** True while the crouching player is in a hiding spot. */
    readonly hidden: boolean;
  };

  lookMode: {
    enable(on?: boolean): void;
    readonly active: boolean;
    readonly enabled: boolean;
  };

  /** Small effects in world space. */
  fx: {
    burst(at: At | string, kind?: 'dust' | 'sparkle' | 'urmacht' | 'leaves' | 'splash' | 'smoke', count?: number): void;
  };

  /** Low-level access (advanced). */
  readonly companions: {
    add(id: string, preset?: string | CharacterSpec, speaker?: string): ActorHandle;
    remove(id: string): void;
    readonly ids: string[];
  };
}

export type ControlName = 'sneak' | 'look' | 'interact' | 'run' | 'move';

export type WorldEvent = 'interact' | 'trigger' | 'triggerExit' | 'clue' | 'spotted' | 'exit' | 'map';

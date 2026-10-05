import Phaser from 'phaser';
import type { CharacterSpec, TerrainId } from '../art/api';
import { items as itemCatalog } from '../core/catalog';
import { G } from '../core/G';
import { consumeAction, inputLock, isTouch, virtualInput } from '../core/input';
import { settings } from '../core/settings';
import type { Dir } from '../core/types';
import { GAME_H, GAME_W } from '../core/viewport';
import type {
  At, ClueDef, ExitDef, InteractableDef, LightDef, MapDef, NpcDef, PropDef, StartWorldOptions, TriggerDef, WorldCtx, WorldEvent,
} from './api';
import { Actor, type ActorHost } from './actor';
import { createCtx, WorldStopped } from './ctx';
import type { UiApiExt } from '../ui';
import { areaPx, clamp, damp, dirFromVector, dirVector, inRect, isAt, setMapUnits, setWorldScale, toPx, unitPx, wk, type Rect, type Vec } from './geom';
import { DebugOverlay } from './debug';
import { Flame } from './flame';
import { buildPaintedGrid, buildSurfaceGrid, normOccluders, type SurfaceGrid } from './navgrid';
import { closestOnPoly, distToPoly, pointInPoly, polyBounds, type Poly } from './poly';
import { CollisionGrid, FOOT_HH, FOOT_HW, setFootScale } from './grid';
import { Lighting, type LightRuntime } from './lighting';
import { getMap } from './maps';
import { normalizeInput, stepVelocity } from './motion';
import { MapMemory, type MemoryStore } from './memory';
import { findPath, lineFree } from './pathfind';
import { PropObj } from './props';
import { Guard } from './stealth';
import { clueKey, ensureWorldTextures } from './textures';
import { followDistance, followerSpeed, formationSlot, sideOf, Trail } from './trail';
import { conePolygon } from './vision';
import { Weather, type WeatherHost } from './weather';

export const WORLD_SCENE_KEY = 'World';

/** Something the player can interact with (object, NPC, clue, door). */
export interface Interactive {
  id: string;
  kind: 'object' | 'npc' | 'clue' | 'door';
  verb: string;
  radius: number;
  /** Anchor (feet / ground point) in px. */
  pos(): Vec;
  /** Distance from a point to the object (default: to pos()). Hotspot polygons measure to their outline. */
  dist?(x: number, y: number): number;
  /** Precise click test (hotspot polygons); bounds() is used otherwise. */
  hit?(x: number, y: number): boolean;
  /** Hotspot polygon (painted objects). */
  hotPoly?: Poly;
  /** Brightening cut-out of the painted object, pulsing while focused (the 'outline' of painted hotspots). */
  glow?: Phaser.GameObjects.Image;
  /** Hint anchor (top of the object) in px. */
  top(): Vec;
  /** Clickable area in px. */
  bounds(): Rect;
  enabled(): boolean;
  run(): Promise<void>;
  /** Outline source for the highlight. */
  outline?(): Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | undefined;
  used?: boolean;
  disabled?: boolean;
  removed?: boolean;
  /** Where the player should stand while interacting (standAt), resolved lazily. */
  stand?(): StandPoint | null;
  /** Re-applies the remembered 'used' state when the map is rebuilt. */
  restoreUsed?(): void;
}

/** A spot the player walks to before an interaction (sit, kneel, door). `over`: draw the player above this depth. */
export interface StandPoint { x: number; y: number; face?: Dir; over?: number }

interface TriggerRt { def: TriggerDef; rect: Rect; poly?: Poly; inside: boolean; done: boolean; enabled: boolean }
interface ExitRt { def: ExitDef; rect: Rect; poly?: Poly; armed: boolean; enabled: boolean; blockedShown: boolean }
/** A cut-out of the painted background drawn above actors standing behind it. */
interface OccluderRt { id: string; poly: Poly; baseline: number; fade: number; img: Phaser.GameObjects.Image; alpha: number; box: Rect }
interface ClueRt { def: ClueDef; x: number; y: number; img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; revealed: boolean; found: boolean; phase: number }
interface HideRt { rect: Rect; poly?: Poly; prop?: PropObj; kind: string }

/** Rect or polygon area test. */
const inArea = (a: { rect: Rect; poly?: Poly }, x: number, y: number): boolean => (a.poly ? pointInPoly(x, y, a.poly) : inRect(a.rect, x, y));
const polyRect = (p: Poly): Rect => polyBounds(p);
interface Puff { img: Phaser.GameObjects.Image; t: number; life: number; vx: number; vy: number; s0: number; s1: number; a0: number; active: boolean; gravity: number; spin: number }
interface CompanionDef { id: string; preset: string | CharacterSpec; speaker?: string }

type Listener = { id: string; fn: (id: string) => void | Promise<void>; map?: boolean };

/** G.state-backed storage for map memory (flag `world.mem.<mapId>`, JSON). */
const stateStore: MemoryStore = {
  read: k => { const v = G.state.flag<string>(k); return typeof v === 'string' ? v : undefined; },
  write: (k, v) => G.state.set(k, v),
};

/**
 * The exploration scene: renders a MapDef and runs the player controller, NPCs, companions, guards, interaction,
 * lighting, weather, Spurenblick and the camera. One instance hosts all maps; changeMap rebuilds in place.
 */
export class WorldScene extends Phaser.Scene {
  // ---- map runtime ----
  map!: MapDef;
  grid!: CollisionGrid;
  mapW = 0;
  mapH = 0;
  /** Painted map: background image, occluders, surface materials. */
  private bgImage: Phaser.GameObjects.Image | null = null;
  bgKey = '';
  occluders: OccluderRt[] = [];
  surfaces: SurfaceGrid | null = null;
  private flames: Flame[] = [];
  private hotGlows: Phaser.GameObjects.Image[] = [];
  debug!: DebugOverlay;
  props = new Map<string, PropObj>();
  private propList: PropObj[] = [];
  actors = new Map<string, Actor>();
  player!: Actor;
  interactives: Interactive[] = [];
  private triggers: TriggerRt[] = [];
  private exits: ExitRt[] = [];
  private clues: ClueRt[] = [];
  private hides: HideRt[] = [];
  guards: Guard[] = [];
  private npcDefs = new Map<string, NpcDef>();
  private npcTimers = new Map<string, { wander: number; bark: number; origin: Vec; barkIdx: number }>();
  private sparkles: { img: Phaser.GameObjects.Image; it: Interactive; t: number }[] = [];
  private mapLights: string[] = [];
  /** What the current map remembers between visits (see MapDef.resetOnEnter). */
  mem: MapMemory = new MapMemory('', null);

  // ---- persistent ----
  cam!: Phaser.Cameras.Scene2D.Camera;
  overlayCam!: Phaser.Cameras.Scene2D.Camera;
  lighting!: Lighting;
  weather!: Weather;
  private opts!: StartWorldOptions;
  private onReady: (() => void) | null = null;
  companionDefs: CompanionDef[] = [];
  private trail = new Trail(3, 260);
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  timeSec = 0;
  alive = false;
  scriptLock = 0;
  transitioning = false;
  private busyInteract = false;
  private lastLockedAt = 0;
  private lastLockedReal = 0;
  private actionQueuedAt = 0;
  private focus: Interactive | null = null;
  private hintKey = '';
  private clickPath: Vec[] | null = null;
  private clickTarget: Interactive | null = null;
  private clickMarker!: Phaser.GameObjects.Image;
  private stuckT = 0;
  private outline: Phaser.GameObjects.Image[] = [];
  private outlineSrc: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | null = null;
  private coneGfx!: Phaser.GameObjects.Graphics;
  private meterGfx!: Phaser.GameObjects.Graphics;
  private vignette!: Phaser.GameObjects.Image;
  /** Freeze frames left (seconds) after being spotted. */
  private hitStop = 0;
  /** Open speech bubbles (removed on map changes, when spotted and on shutdown). */
  private bubbles = new Set<() => void>();
  /** Companions stay where they are (interactions, standAt, cutscenes). */
  private partyHold = false;
  private idleT = 0;
  private formSide = new Map<string, 1 | -1>();
  private lastInteract = { id: '', at: 0 };
  private puffs: Puff[] = [];
  private listeners = new Map<WorldEvent, Set<Listener>>();
  pending = new Set<(e: Error) => void>();
  /** Dialogue boxes opened by world scripts that are still open. */
  openDialogs = 0;
  private camMode: { kind: 'follow'; id: string } | { kind: 'fixed'; x: number; y: number } = { kind: 'follow', id: 'player' };
  private camFocus: Vec = { x: 0, y: 0 };
  private camLook: Vec = { x: 0, y: 0 };
  private baseZoom = 1;
  private zoomPunch = 0;
  look = { enabled: false, amt: 0, held: false };
  private colorFx: Phaser.FX.ColorMatrix | null = null;
  private vignetteFx: Phaser.FX.Vignette | null = null;
  stealthOn = true;
  checkpoint: Vec = { x: 0, y: 0 };
  checkpointDir: Dir = 'down';
  spottedHandler: ((guardId: string) => void | Promise<void>) | null = null;
  private spotting = false;
  playerHidden = false;
  private hiddenIn: HideRt | null = null;
  private heartbeat: { set(o: { interval?: number; volume?: number }): void; stop(ms?: number): void } | null = null;
  objective: { id: string; text: string; target: At | string | null } | null = null;
  private objMarker!: Phaser.GameObjects.Image;
  private pointerShown = false;
  private playerLight: LightRuntime | null = null;
  private focusLight: LightRuntime | null = null;
  ctx!: WorldCtx;

  constructor() { super(WORLD_SCENE_KEY); }

  init(data: { opts: StartWorldOptions; ready?: () => void }): void {
    this.opts = data.opts;
    this.onReady = data.ready ?? null;
    // Phaser reuses this scene instance. A departing script may keep Lia locked
    // through its fade and goto; that lock belongs to the previous visit.
    this.scriptLock = 0;
  }

  // =============================================================================================================
  // Host interface
  // =============================================================================================================

  /** Adapter handed to actors, props and weather (Phaser.Scene#scene is the scene plugin, hence a wrapper). */
  host!: ActorHost & WeatherHost;

  private makeHost(): ActorHost & WeatherHost {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      get scene() { return self as Phaser.Scene; },
      get grid() { return self.grid; },
      get timeSec() { return self.timeSec; },
      get cam() { return self.cam; },
      get playerPos() { return self.playerPos; },
      terrainAt: (x, y) => self.terrainAt(x, y),
      addWorld: o => self.addWorld(o),
      addOverlay: o => self.addOverlay(o),
      toScreen: (x, y) => self.toScreen(x, y),
      onScreen: (x, y, m) => self.onScreen(x, y, m),
      puff: (x, y, k, st) => self.puff(x, y, k, st),
      flash: (c, ms) => self.flash(c, ms),
      isWater: (x, y) => self.isWater(x, y),
      isBlocked: (x, y) => self.isBlocked(x, y),
      sinkAt: (x, y) => self.sinkAt(x, y),
      get wind() { return self.weather?.wind ?? 0.3; },
      get longShadow() { return self.lighting?.longShadow ?? 0; },
      get mapRect() { return { x: 0, y: 0, w: self.mapW, h: self.mapH }; },
      scaleAt: y => self.scaleAt(y),
      get worldK() { return wk(); },
      spriteScale: (key, frame) => self.spriteScale(key, frame),
    };
  }

  /** Perspective scale (MapDef.depthScale) at a feet y. */
  scaleAt(y: number): number {
    const d = this.map?.depthScale;
    if (!d) return 1;
    const t = clamp((y - d.y0) / Math.max(1, d.y1 - d.y0), 0, 1);
    return d.s0 + (d.s1 - d.s0) * t;
  }

  /** Base scale of character sprites: MapDef.spriteScale, or ×2 for small (≤32 px) fallback frames. */
  spriteScale(_key: string, frame: { w: number; h: number }): number {
    if (this.map?.spriteScale !== undefined) return this.map.spriteScale;
    return frame.h <= 32 ? 2 : 1;
  }

  /** Wheat swallows the legs (hide terrain / hiding surfaces); everything else keeps actors on top of the ground. */
  sinkAt(x: number, y: number): number {
    return this.hideAt(x, y) ? Math.round(8 * this.spriteScaleNominal()) : 0;
  }

  /** A crouching player is hidden on this ground (wheat, tall grass surfaces). */
  hideAt(x: number, y: number): boolean {
    return this.surfaces ? this.surfaces.hideAt(x, y) : false;
  }

  /** Movement speed factor of the ground. */
  speedAt(x: number, y: number): number {
    return this.surfaces ? this.surfaces.speedAt(x, y) : 1;
  }

  /** Scale of a regular figure on this map (wheat sink, small fx). */
  private spriteScaleNominal(): number { return this.player ? this.player.scale : 1; }
  get playerPos(): Vec | undefined { return this.player ? { x: this.player.x, y: this.player.y } : undefined; }

  addWorld<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    if (this.overlayCam) this.overlayCam.ignore(obj);
    return obj;
  }

  addOverlay<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    if (this.overlayCam) (obj as unknown as { cameraFilter: number }).cameraFilter &= ~this.overlayCam.id;
    this.cam.ignore(obj);
    return obj;
  }

  toScreen(x: number, y: number): Vec {
    const v = this.cam.worldView;
    return { x: (x - v.x) * this.cam.zoom, y: (y - v.y) * this.cam.zoom };
  }

  onScreen(x: number, y: number, margin = 0): boolean {
    const v = this.cam.worldView;
    return x >= v.x - margin && x <= v.right + margin && y >= v.y - margin && y <= v.bottom + margin;
  }

  terrainAt(x: number, y: number): TerrainId | undefined {
    return this.surfaces?.kindAt(x, y);
  }
  isWater(x: number, y: number): boolean { const t = this.terrainAt(x, y); return t === 'water' || t === 'shallow'; }
  isBlocked(x: number, y: number): boolean { return this.grid ? this.grid.solidAt(x, y) : false; }
  flash(color?: number, ms?: number): void { this.lighting.flash(color, ms); }

  // =============================================================================================================
  // Lifecycle
  // =============================================================================================================

  create(): void {
    ensureWorldTextures(this);
    this.alive = true;
    this.host = this.makeHost();
    this.cam = this.cameras.main;
    this.cam.setBackgroundColor('#07080c');
    this.overlayCam = this.cameras.add(0, 0, GAME_W, GAME_H, false, 'overlay');
    this.overlayCam.setRoundPixels(true);
    // Every object created from now on is world-only unless addOverlay() flips it.
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, (go: Phaser.GameObjects.GameObject) => this.overlayCam.ignore(go));

    this.lighting = new Lighting(this, o => this.addWorld(o));
    this.weather = new Weather(this.host);
    // Vision cones lie on the ground: under every prop and actor (occluders cover them), above shadows.
    this.coneGfx = this.addWorld(this.add.graphics().setDepth(-150));
    this.vignette = this.addOverlay(this.add.image(GAME_W / 2, GAME_H / 2, 'w-vignette').setScrollFactor(0).setDepth(9400)
      .setDisplaySize(GAME_W, GAME_H).setTint(0xc8321e).setAlpha(0).setVisible(false));
    this.meterGfx = this.addOverlay(this.add.graphics().setDepth(5100));
    this.clickMarker = this.addOverlay(this.add.image(0, 0, 'w-marker').setDepth(90).setVisible(false));
    this.objMarker = this.addOverlay(this.add.image(0, 0, 'w-objective').setOrigin(0.5, 1).setDepth(4900).setVisible(false));

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,C,CTRL,Q,E,SPACE,ENTER', false) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointer, this);
    kb.on('keydown', this.onKeyDown, this);
    this.companionDefs = (this.opts.companions ?? []).map(c => (typeof c === 'string' ? { id: c, preset: c } : { id: c.id, preset: c.preset ?? c.id, speaker: c.speaker }));
    this.ctx = createCtx(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.onShutdown());

    this.debug = new DebugOverlay(this);
    const map = typeof this.opts.map === 'string' ? getMap(this.opts.map) : this.opts.map;
    void this.loadAssets(map).then(bg => { if (this.alive) this.startMap(map, bg); });
  }

  /**
   * Loads what a map needs before it is built: characters, props and the painted background through G.art.preload
   * (Codex assets from the manifest), with a direct 'assets/bg/<id>.png' load as fallback for backgrounds that are
   * not in the manifest yet. Never throws; missing art falls back to placeholders.
   */
  async loadAssets(def: MapDef): Promise<BgInfo | null> {
    const chars = new Set<string>();
    const add = (p: unknown) => { if (typeof p === 'string') chars.add(p); };
    add(def.player ?? this.opts.player ?? 'lia');
    for (const c of this.companionDefs) add(c.preset);
    for (const n of def.npcs ?? []) add(n.preset);
    for (const g of def.guards ?? []) add(g.preset);
    const props = new Set<string>();
    for (const p of def.props ?? []) props.add(p.prop);
    for (const i of def.interactables ?? []) if (i.prop) props.add(i.prop);
    try {
      await withTimeout(G.art.preload(this, { characters: [...chars], props: [...props], backgrounds: def.background ? [def.background] : [] }), 15000);
    } catch (e) { console.warn('[world] asset preload failed', e); }
    if (!def.background || !this.alive) return null;
    const id = def.background;
    let fromArt = false;
    try { fromArt = !def.backgroundUrl && G.art.hasAsset('background', id); } catch { /* */ }
    if (fromArt) {
      try { const b = G.art.background(this, id); if (this.textures.exists(b.key)) return { key: b.key, w: b.width, h: b.height }; } catch { /* fall through */ }
    }
    const key = `world-bg-${id}`;
    if (!this.textures.exists(key)) {
      await new Promise<void>(resolve => {
        const url = def.backgroundUrl ?? `assets/bg/${id}.png`;
        const done = () => { this.load.off(Phaser.Loader.Events.COMPLETE, done); resolve(); };
        this.load.image(key, url);
        this.load.once(Phaser.Loader.Events.COMPLETE, done);
        this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => console.warn(`[world] background '${id}' not found at ${url}`));
        this.load.start();
      });
    }
    if (this.textures.exists(key)) {
      const src = this.textures.get(key).getSourceImage() as { width: number; height: number };
      return { key, w: src.width, h: src.height };
    }
    try { const b = G.art.background(this, id); return { key: b.key, w: b.width, h: b.height }; } catch { return null; }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (/^(Arrow|Key[WASD])/.test(e.code)) this.cancelClick();
    // Queue action presses from the raw event so very short taps (down+up in one frame) are not lost.
    if ((e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) this.actionQueuedAt = performance.now();
  }

  private startMap(map: MapDef, bg: BgInfo | null): void {
    this.buildMap(map, this.opts.spawn, bg);
    this.drawDebug();
    this.snapCamera();
    try { G.ui.setHud('explore'); } catch { /* */ }
    const active = G.state.activeObjective();
    try { G.ui.objective(active?.text ?? null); } catch { /* */ }
    if (this.opts.fadeIn !== false) { this.cam.fadeIn(600, 0, 0, 0); this.overlayCam.fadeIn(600, 0, 0, 0); }
    (window as unknown as { __world?: WorldScene }).__world = this;
    G.events.emit('world:ready', { map: map.id });
    this.onReady?.();
    this.onReady = null;
    this.time.delayedCall(10, () => {
      this.emit('map', map.id);
      void this.runHandler(map.onEnter);
      void this.runHandler(this.opts.script);
    });
  }

  private onShutdown(): void {
    this.alive = false;
    const err = new WorldStopped();
    for (const reject of [...this.pending]) reject(err);
    this.pending.clear();
    this.heartbeat?.stop(100);
    this.heartbeat = null;
    this.clearBubbles();
    if (this.hitStop > 0) { this.hitStop = 0; this.anims.resumeAll(); }
    try { G.ui.hint(null); G.ui.objectivePointer(null); } catch { /* */ }
    // A dead script may have left a dialogue open: close it so it does not lock the next scene.
    if (this.openDialogs > 0) { try { (G.ui as Partial<UiApiExt>).reset?.({ keepFade: true }); } catch { /* */ } this.openDialogs = 0; }
    try { (G.ui as Partial<UiApiExt>).setTouchExtras?.({ sneak: false, look: false }); } catch { /* */ }
    this.teardownMap();
    // Phaser restarts this same scene object for the next map: until it is built, update() must not touch the
    // destroyed actors of this visit.
    this.player = undefined as unknown as Actor;
    this.debug?.destroy();
    this.lighting.destroy();
    this.weather.destroy();
    this.listeners.clear();
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointer, this);
    this.input.keyboard?.off('keydown', this.onKeyDown, this);
    this.events.removeAllListeners(Phaser.Scenes.Events.ADDED_TO_SCENE);
    this.colorFx = null; this.vignetteFx = null;
    if ((window as unknown as { __world?: WorldScene }).__world === this) delete (window as unknown as { __world?: WorldScene }).__world;
  }

  /** Runs a script/handler; swallows WorldStopped, logs other errors. */
  async runHandler(fn: ((w: WorldCtx) => void | Promise<void>) | undefined): Promise<void> {
    if (!fn) return;
    try { await fn(this.ctx); } catch (e) {
      if (e instanceof WorldStopped) return;
      console.error('[world] script error', e);
    }
  }

  // =============================================================================================================
  // Map building
  // =============================================================================================================

  buildMap(def: MapDef, spawnName?: string, bg: BgInfo | null = null): void {
    this.map = def;
    setMapUnits(def.units ?? 'px');
    const k = def.worldScale ?? 1.75;
    setWorldScale(k);
    setFootScale(k);
    // Painted map: background image + polygon geometry rasterized into the fine grid.
    const w = def.size?.w ?? bg?.w ?? GAME_W, h = def.size?.h ?? bg?.h ?? GAME_H;
    this.mapW = w; this.mapH = h;
    this.grid = buildPaintedGrid(def, w, h);
    this.surfaces = buildSurfaceGrid(def, w, h);
    if (bg) {
      this.bgKey = bg.key;
      this.bgImage = this.addWorld(this.add.image(0, 0, bg.key).setOrigin(0).setDepth(-1000).setDisplaySize(w, h));
      this.buildOccluders(def, bg);
    }
    const meadowy = (def.surface ?? 'grass') === 'grass' || (def.surface ?? 'grass') === 'meadow';
    // Map memory: what the player changed on earlier visits (or in a save game).
    this.mem = MapMemory.load(def.id, stateStore);
    if (def.resetOnEnter && !this.mem.empty) this.mem.clear();
    // Auto ids ('prop-N') must be stable across visits so remembered removals hit the same props.
    this.propSeq = 0;

    for (const p of def.props ?? []) this.addProp(p);

    for (const h of def.hidingSpots ?? []) {
      if (h.poly) this.hides.push({ rect: polyRect(h.poly), poly: h.poly, kind: h.kind ?? 'bush' });
      else if (h.area) this.hides.push({ rect: areaPx(h.area), kind: h.kind ?? 'bush' });
    }

    // Lights
    for (const l of def.lights ?? []) this.addLight(l);

    // Interactables
    for (const it of def.interactables ?? []) this.addInteractable(it);

    // Spawn player
    const spawns = def.spawns;
    const sp = spawns[spawnName ?? ''] ?? spawns.default ?? Object.values(spawns)[0];
    if (!sp) throw new Error(`[world] map '${def.id}' has no spawns`);
    const spPx = toPx(sp.at);
    this.checkpoint = { ...spPx };
    this.checkpointDir = sp.dir ?? 'down';
    if (def.stealth?.checkpoint && spawns[def.stealth.checkpoint]) {
      this.checkpoint = toPx(spawns[def.stealth.checkpoint].at);
      this.checkpointDir = spawns[def.stealth.checkpoint].dir ?? 'down';
    }
    const playerLook = def.player ?? this.opts.player ?? 'lia';
    this.player = new Actor(this.host, 'player', 'player', playerLook, spPx, sp.dir ?? 'down', typeof playerLook === 'string' ? playerLook : 'lia');
    this.player.walkSpeed = 64 * k;
    this.player.runSpeed = 108 * k;
    this.player.depthBias = 2; // Lia wins y-ties against followers walking right behind her
    this.actors.set('player', this.player);
    const dv = dirVector(sp.dir ?? 'down');
    this.trail.reset(spPx.x, spPx.y, dv.x, dv.y, 80);

    // NPCs
    for (const n of def.npcs ?? []) this.spawnNpc(n);

    // Companions
    this.companionDefs.forEach((c, i) => {
      if (this.actors.has(c.id)) return;
      const slot = this.trail.pointBehind(spPx.x, spPx.y, followDistance(i));
      const a = new Actor(this.host, c.id, 'companion', c.preset, slot, sp.dir ?? 'down', c.speaker ?? c.id);
      a.walkSpeed = 60 * k; a.solid = false;
      this.actors.set(c.id, a);
    });

    // Guards
    for (const g of def.guards ?? []) {
      const start = g.path[0];
      const at = start && !isAt(start) ? (start as { at: At }).at : (start as At);
      const a = new Actor(this.host, g.id, 'guard', g.preset, toPx(at ?? [0, 0]), 'down', g.speaker ?? g.id);
      this.actors.set(g.id, a);
      const guard = new Guard(a, g);
      guard.barker = (actor, text, ms) => this.barkActor(actor, text, ms);
      this.guards.push(guard);
      if (g.lantern) {
        const l = this.lighting.add({ id: `lantern-${g.id}`, at: [0, 0], kind: 'lantern', radius: 46, follow: () => ({ x: a.x + dirVector(a.dir).x * 5, y: a.y - 10 }) }, { x: a.x, y: a.y });
        this.mapLights.push(l.id);
      }
    }

    // Triggers / exits
    for (const t of def.triggers ?? []) {
      const rect = t.poly ? polyRect(t.poly) : areaPx(t.area ?? { x: 0, y: 0, w: 0, h: 0 });
      const rt: TriggerRt = { def: t, rect, poly: t.poly, inside: false, done: this.mem.has('triggers', t.id), enabled: !this.mem.has('off', t.id) };
      rt.inside = inArea(rt, spPx.x, spPx.y);
      this.triggers.push(rt);
    }
    for (const e of def.exits ?? []) {
      const rect = e.poly ? polyRect(e.poly) : areaPx(e.area ?? { x: 0, y: 0, w: 0, h: 0 });
      const rt: ExitRt = { def: e, rect, poly: e.poly, armed: true, enabled: !this.mem.has('off', e.id), blockedShown: false };
      rt.armed = !inArea(rt, spPx.x, spPx.y);
      this.exits.push(rt);
      if (e.door) {
        const pos = toPx(e.door.at);
        this.interactives.push({
          id: e.id, kind: 'door', verb: e.door.verb ?? 'Betreten', radius: 20 * k,
          pos: () => pos, top: () => ({ x: pos.x, y: pos.y - 18 }), bounds: () => ({ x: pos.x - 10, y: pos.y - 24, w: 20, h: 28 }),
          enabled: () => rt.enabled,
          run: async () => {
            if (e.when && !e.when()) { if (e.blocked) await this.ctx.think(e.blocked); return; }
            await this.transitionVia(rt);
          },
        });
      }
    }

    // Clues
    for (const c of def.clues ?? []) this.addClue(c);

    this.applyMemory();

    // Look mode / time / weather / audio (script-set lighting and weather are remembered too)
    this.look.enabled = Boolean(def.lookMode);
    this.syncTouchExtras();
    const time = this.mem.time ?? def.time ?? 'day';
    const weather = this.mem.weather ?? def.weather ?? 'none';
    this.lighting.setBaked(def.baked);
    this.lighting.setImmediate(time);
    this.weather.set(weather, { ms: 0 });
    this.weather.setCritters(def.critters ?? (meadowy && time === 'day' && weather !== 'rain' && weather !== 'storm'));
    if (def.playerLight) {
      this.playerLight = this.lighting.add({ id: 'player-light', at: [0, 0], kind: 'plain', color: 0xd8e0ff, radius: def.playerLight, intensity: 0.42, follow: () => (this.player ? { x: this.player.x, y: this.player.y - 2 } : null) }, spPx);
    } else this.playerLight = null;
    try {
      if (def.ambience) G.audio.ambience(def.ambience, { volume: def.ambienceVolume, fadeMs: 1500 });
      if (def.music !== undefined) G.audio.music(def.music, { fadeMs: 1800 });
    } catch { /* audio optional */ }

    // Camera
    const zoom = def.camera?.zoom ?? 1;
    this.baseZoom = zoom;
    this.cam.setZoom(zoom); this.overlayCam.setZoom(zoom);
    this.applyBounds();
    this.camMode = { kind: 'follow', id: 'player' };
  }

  /**
   * Cuts every occluder polygon out of the painted background into its own texture and draws it at the depth of its
   * baseline: actors whose feet are above the baseline (smaller y) are drawn behind it.
   */
  private buildOccluders(def: MapDef, bg: BgInfo): void {
    normOccluders(def).forEach((o, i) => {
      const cut = this.cutBackground(o.poly, `occ-${def.id}-${bg.key}-${i}`);
      if (!cut) return;
      const img = this.addWorld(this.add.image(cut.x, cut.y, cut.key).setOrigin(0).setDepth(o.baseline));
      this.occluders.push({ id: o.id ?? `occ-${i}`, poly: o.poly, baseline: o.baseline, fade: o.fade ?? 1, img, alpha: 1, box: { x: cut.x, y: cut.y, w: cut.w, h: cut.h } });
    });
  }

  /** Cuts a polygon out of the painted background into a cached texture (top-left at x/y). */
  private cutBackground(poly: Poly, key: string): { key: string; x: number; y: number; w: number; h: number } | null {
    if (!this.bgKey || !this.textures.exists(this.bgKey)) return null;
    const b = polyBounds(poly);
    const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y));
    const x1 = Math.min(this.mapW, Math.ceil(b.x + b.w)), y1 = Math.min(this.mapH, Math.ceil(b.y + b.h));
    if (x1 - x0 < 1 || y1 - y0 < 1) return null;
    if (!this.textures.exists(key)) {
      const src = this.textures.get(this.bgKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const sx = src.width / this.mapW, sy = src.height / this.mapH;
      const c = document.createElement('canvas');
      c.width = x1 - x0; c.height = y1 - y0;
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      g.beginPath();
      poly.forEach(([px, py], k) => (k ? g.lineTo(px - x0, py - y0) : g.moveTo(px - x0, py - y0)));
      g.closePath();
      g.clip();
      g.drawImage(src, x0 * sx, y0 * sy, (x1 - x0) * sx, (y1 - y0) * sy, 0, 0, x1 - x0, y1 - y0);
      this.textures.addCanvas(key, c);
    }
    return { key, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /** Occluders with `fade` turn see-through while they cover the player. */
  private updateOccluders(dt: number): void {
    const p = this.player;
    if (!p) return;
    const midY = p.y - p.figureH * 0.5;
    for (const o of this.occluders) {
      if (o.fade >= 1) continue;
      const covers = p.y < o.baseline && p.visible && (pointInPoly(p.x, midY, o.poly) || pointInPoly(p.x, p.headY + 3, o.poly) || pointInPoly(p.x, p.y - 2, o.poly));
      const target = covers ? o.fade : 1;
      o.alpha += (target - o.alpha) * Math.min(1, dt * 7);
      if (Math.abs(o.alpha - target) < 0.01) o.alpha = target;
      o.img.setAlpha(o.alpha);
    }
  }

  /** Re-applies remembered changes after the map objects were created. */
  private applyMemory(): void {
    const m = this.mem;
    if (m.empty) return;
    for (const id of m.toJSON().props) if (this.props.has(id)) this.removeProp(id);
    for (const it of this.interactives) {
      if (m.has('used', it.id)) it.restoreUsed?.();
      if (m.has('off', it.id)) it.disabled = true;
      if (m.has('removed', it.id)) it.removed = true;
    }
    this.interactives = this.interactives.filter(it => !it.removed || it.kind === 'object');
    for (const c of this.clues) if (m.has('clues', c.def.id)) c.found = true;
  }

  private applyBounds(): void {
    const b = this.map.camera?.bounds ? areaPx(this.map.camera.bounds) : { x: 0, y: 0, w: this.mapW, h: this.mapH };
    const vw = GAME_W / this.baseZoom, vh = GAME_H / this.baseZoom;
    let { x, y, w, h } = b;
    if (w < vw) { x -= (vw - w) / 2; w = vw; }
    if (h < vh) { y -= (vh - h) / 2; h = vh; }
    this.cam.setBounds(x, y, w, h);
    this.overlayCam.setBounds(x, y, w, h);
  }

  teardownMap(): void {
    this.clearBubbles();
    // Listeners registered with w.onMap() end with the visit.
    for (const set of this.listeners.values()) for (const l of [...set]) if (l.map) set.delete(l);
    for (const a of this.actors.values()) a.destroy();
    this.actors.clear();
    for (const p of this.propList) p.destroy();
    this.props.clear();
    this.propList = [];
    for (const c of this.clues) { c.img.destroy(); c.glow.destroy(); }
    this.clues = [];
    for (const s of this.sparkles) s.img.destroy();
    this.sparkles = [];
    this.interactives = [];
    this.triggers = [];
    this.exits = [];
    this.hides = [];
    this.guards = [];
    this.npcDefs.clear();
    this.npcTimers.clear();
    this.lighting?.clear();
    this.mapLights = [];
    this.playerLight = null;
    this.focusLight = null;
    this.bgImage?.destroy();
    this.bgImage = null;
    for (const o of this.occluders) o.img.destroy();
    this.occluders = [];
    for (const f of this.flames) f.destroy();
    this.flames = [];
    for (const g of this.hotGlows) g.destroy();
    this.hotGlows = [];
    this.surfaces = null;
    this.clearOutline();
    this.focus = null;
    this.cancelClick();
    this.playerHidden = false; this.hiddenIn = null;
    this.partyHold = false;
    this.formSide.clear();
    for (const p of this.puffs) p.img.destroy();
    this.puffs = [];
  }

  // ---- props ----
  private propSeq = 0;
  addProp(def: PropDef, autoVariant?: number): PropObj {
    const pos = toPx(def.at);
    const id = def.id ?? `prop-${++this.propSeq}`;
    const p = new PropObj(this.host, def, id, pos.x, pos.y, autoVariant);
    this.props.set(id, p);
    this.propList.push(p);
    const fp = p.footprint();
    if (def.hide) {
      this.hides.push({ rect: p.hideArea(), prop: p, kind: def.hide });
    } else if (fp) {
      const collide = def.collide ?? true;
      const see = def.blocksView ?? true;
      if (collide || see) this.grid.blockRect(fp.x, fp.y, fp.w, fp.h, { move: collide, sight: see });
    }
    // Lights from art (+ overrides). Art offsets are relative to the origin (negative y = up).
    if (def.light !== false) {
      const art = p.info.light;
      const flip = def.flipX ? -1 : 1;
      if (art || def.light) {
        const override = (def.light || {}) as Partial<LightDef>;
        const merged: LightDef = {
          at: { x: pos.x, y: pos.y + (art?.offsetY ?? -6), px: true },
          radius: art?.radius, color: art?.color, kind: art?.flicker ? 'fire' : 'plain', flicker: art?.flicker ? 1 : undefined,
          ...override,
        };
        this.addLight({ ...merged, id: merged.id ?? `${id}-light` });
      }
      p.info.lights?.forEach((l, i) => this.addLight({
        id: `${id}-light-${i}`, at: { x: pos.x + l.x * flip, y: pos.y + l.y, px: true }, radius: l.radius, color: l.color,
        kind: 'window', flicker: l.flicker ? 0.25 : 0.05,
      }));
    }
    if (def.interact) {
      const { id: iid, ...rest } = def.interact;
      this.addInteractable({ ...rest, id: iid ?? id, at: def.at }, p);
    }
    return p;
  }

  removeProp(id: string): void {
    const p = this.props.get(id);
    if (!p) return;
    this.mem.add('props', id);
    const fp = p.footprint();
    if (fp && !p.def.hide) this.grid.clearRect(fp.x, fp.y, fp.w, fp.h, { move: p.def.collide ?? true, sight: p.def.blocksView ?? true });
    this.hides = this.hides.filter(h => h.prop !== p);
    this.removeLight(`${id}-light`);
    p.info.lights?.forEach((_, i) => this.lighting.remove(`${id}-light-${i}`));
    p.destroy();
    this.props.delete(id);
    this.propList = this.propList.filter(x => x !== p);
  }

  addLight(def: LightDef & { follow?: () => Vec | null }): LightRuntime {
    const pos = toPx(def.at);
    const l = this.lighting.add(def, pos);
    this.mapLights.push(l.id);
    if (def.flame) {
      this.flames = this.flames.filter(f => { if (f.lightId === l.id) { f.destroy(); return false; } return true; });
      this.flames.push(new Flame(this, l, typeof def.flame === 'number' ? def.flame : 1, o => this.addWorld(o)));
    }
    return l;
  }

  /** Removes a light and its flame. */
  removeLight(id: string): void {
    this.lighting.remove(id);
    this.flames = this.flames.filter(f => { if (f.lightId === id) { f.destroy(); return false; } return true; });
  }

  // ---- interactables ----
  addInteractable(def: InteractableDef, existingProp?: PropObj): Interactive {
    const hot = def.poly;
    const hb = hot ? polyBounds(hot) : null;
    // A hotspot polygon without `at`: its base (bottom centre) is the ground anchor.
    const pos = def.at ? toPx(def.at) : hb ? { x: hb.x + hb.w / 2, y: hb.y + hb.h } : { x: 0, y: 0 };
    let prop = existingProp;
    if (!prop && def.prop) prop = this.addProp({ prop: def.prop, at: def.at ?? { x: pos.x, y: pos.y, px: true }, variant: def.variant, id: `${def.id}-prop` });
    const size = def.size ?? { w: 16, h: 16 };
    const once = def.once ?? Boolean(def.item);
    const removeOnUse = def.removeOnUse ?? Boolean(def.item);
    const it: Interactive = {
      id: def.id, kind: 'object', verb: def.verb ?? (def.item ? 'Aufheben' : 'Untersuchen'), radius: def.radius ?? 18 * wk(),
      pos: () => pos,
      hotPoly: hot,
      dist: hot ? (x, y) => distToPoly(x, y, hot) : undefined,
      hit: hot ? (x, y) => pointInPoly(x, y, hot) : undefined,
      top: () => (hb ? { x: hb.x + hb.w / 2, y: hb.y } : prop ? { x: pos.x, y: prop.bounds().y } : { x: pos.x, y: pos.y - size.h + 4 }),
      bounds: () => (hb ? { ...hb } : prop ? prop.bounds() : { x: pos.x - size.w / 2, y: pos.y - size.h + 6, w: size.w, h: size.h }),
      enabled: () => !it.disabled && !it.removed && !(once && it.used) && (def.when ? def.when() : true),
      outline: () => (prop && this.props.has(prop.id) ? prop.image : undefined),
      stand: def.standAt ? () => this.resolveStand(def.standAt!, def.face, prop, pos) : undefined,
      restoreUsed: () => {
        it.used = true;
        if (removeOnUse && once) { it.removed = true; if (prop) this.removeProp(prop.id); }
      },
      run: async () => {
        if (!def.standAt) { const q = hot ? closestOnPoly(this.player.x, this.player.y, hot) : pos; this.player.faceTowards(q.x, q.y === this.player.y ? q.y - 1 : q.y); }
        if (def.item) {
          void this.player.playOnce('interact', 380);
          // Register a catalog entry on the fly so the UI toast shows a proper name.
          if (def.item.name && !itemCatalog.has(def.item.id)) itemCatalog.set(def.item.id, { id: def.item.id, name: def.item.name, icon: def.item.id, description: '' });
          G.state.give(def.item.id, def.item.n ?? 1); // the UI toasts (with sound) on 'item:gained'
          this.burst(pos.x, pos.y - 6, 'sparkle', 6);
        }
        it.used = true;
        this.mem.add('used', def.id);
        if (removeOnUse && once) {
          it.removed = true;
          if (prop) this.fadeOutProp(prop);
        }
        if (def.thought) await this.ctx.think(def.thought);
        await this.runHandler(def.onInteract);
      },
    };
    if (hot && !prop) {
      const cut = this.cutBackground(hot, `hot-${this.map.id}-${this.bgKey}-${def.id}`);
      if (cut) {
        it.glow = this.addWorld(this.add.image(cut.x, cut.y, cut.key).setOrigin(0).setDepth(-999).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
        this.hotGlows.push(it.glow);
      }
    }
    this.interactives.push(it);
    if (def.sparkle ?? Boolean(def.item)) {
      const img = this.addOverlay(this.add.image(pos.x, pos.y, 'w-sparkle').setDepth(4800).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
      this.sparkles.push({ img, it, t: Math.random() * 2 });
    }
    return it;
  }

  /** Resolves InteractableDef.standAt to a px point (+ facing, + draw-over depth for seats on props). */
  resolveStand(st: At | { anchor: string; prop?: string }, face: Dir | undefined, own: PropObj | undefined, objPos: Vec): StandPoint | null {
    if (isAt(st)) {
      const p = toPx(st as At);
      return { x: p.x, y: p.y, face: face ?? dirFromVector(objPos.x - p.x, objPos.y - p.y, 'up') };
    }
    const spec = st as { anchor: string; prop?: string };
    const prop = spec.prop ? this.props.get(spec.prop) : own;
    if (!prop) return null;
    const a = this.anchorOf(prop, spec.anchor);
    return { x: a.x, y: a.y, face: face ?? (spec.anchor === 'door' ? 'up' : 'down'), over: a.onProp ? prop.depth + 1 : undefined };
  }

  /** A named anchor of a prop in world px. Missing anchors fall back to a sensible spot (seat on top / in front). */
  anchorOf(prop: PropObj, name: string): Vec & { onProp: boolean } {
    const a = prop.info.anchors?.[name];
    const flip = prop.def.flipX ? -1 : 1;
    if (a) return { x: prop.x + a.x * flip, y: prop.y + a.y, onProp: a.y < 0 };
    if (name === 'sit' || name === 'seat' || name === 'lie') return { x: prop.x, y: prop.y - Math.min(6, Math.round(prop.info.height * 0.25)), onProp: true };
    const fp = prop.footprint();
    return { x: prop.x, y: (fp ? fp.y + fp.h : prop.y) + 5, onProp: false };
  }

  private fadeOutProp(p: PropObj): void {
    const id = p.id;
    this.tweens.add({ targets: p.parts, alpha: 0, y: '-=3', duration: 260, onComplete: () => this.removeProp(id) });
  }

  // ---- NPCs ----
  spawnNpc(def: NpcDef): Actor {
    this.despawn(def.id);
    const pos = toPx(def.at);
    const a = new Actor(this.host, def.id, 'npc', def.preset, pos, def.dir ?? 'down', def.speaker ?? def.id);
    a.walkSpeed = def.speed ?? 42 * wk();
    a.idleAnim = def.idle ?? 'idle';
    a.solid = def.solid ?? true;
    if (def.hidden) a.setVisible(false);
    this.actors.set(def.id, a);
    this.npcDefs.set(def.id, def);
    this.npcTimers.set(def.id, { wander: 1 + Math.random() * 3, bark: (def.barkEvery ?? 7000) / 1000 * (0.4 + Math.random() * 0.8), origin: pos, barkIdx: Math.floor(Math.random() * 10) });
    if (def.talk) {
      const it: Interactive = {
        id: def.id, kind: 'npc', verb: def.verb ?? 'Reden', radius: 22 * wk(),
        pos: () => ({ x: a.x, y: a.y }),
        top: () => ({ x: a.x, y: a.headY }),
        bounds: () => ({ x: a.x - a.size.w / 2 - 2, y: a.headY - 2, w: a.size.w + 4, h: a.size.h + 4 }),
        enabled: () => a.visible && !it.removed,
        outline: () => a.sprite,
        run: async () => {
          const wasHeld = a.held;
          a.held = true;
          a.stopPath();
          this.player.faceTowards(a.x, a.y);
          if (def.facePlayer !== false) a.faceTowards(this.player.x, this.player.y);
          try { await def.talk!(this.ctx, this.ctx.actor(def.id)); } finally { a.held = wasHeld; }
        },
      };
      this.interactives.push(it);
    }
    return a;
  }

  despawn(id: string): void {
    const a = this.actors.get(id);
    if (!a || id === 'player') return;
    a.destroy();
    this.actors.delete(id);
    this.npcDefs.delete(id);
    this.npcTimers.delete(id);
    for (const it of this.interactives) if (it.id === id && it.kind === 'npc') it.removed = true;
    this.interactives = this.interactives.filter(it => !(it.id === id && it.kind === 'npc'));
  }

  addCompanion(id: string, preset?: string | CharacterSpec, speaker?: string): Actor {
    if (!this.companionDefs.some(c => c.id === id)) this.companionDefs.push({ id, preset: preset ?? id, speaker });
    const existing = this.actors.get(id);
    if (existing) {
      // An NPC joins the party.
      this.npcDefs.delete(id);
      this.npcTimers.delete(id);
      this.interactives = this.interactives.filter(it => !(it.id === id && it.kind === 'npc'));
      Object.assign(existing, { solid: false });
      existing.kind = 'companion';
      existing.walkSpeed = 60 * wk();
      return existing;
    }
    const slot = this.trail.pointBehind(this.player.x, this.player.y, followDistance(this.companionDefs.length - 1));
    const a = new Actor(this.host, id, 'companion', preset ?? id, slot, this.player.dir, speaker ?? id);
    a.walkSpeed = 60 * wk(); a.solid = false;
    this.actors.set(id, a);
    return a;
  }

  /** A companion leaves the party: it stays on the map as a normal NPC that scripts can still walk around. */
  removeCompanion(id: string): void {
    const def = this.companionDefs.find(c => c.id === id);
    this.companionDefs = this.companionDefs.filter(c => c.id !== id);
    this.formSide.delete(id);
    const a = this.actors.get(id);
    if (!a) return;
    a.kind = 'npc';
    a.vx = a.vy = 0;
    const npc: NpcDef = { id, preset: def?.preset ?? id, at: { x: a.x, y: a.y, px: true }, speaker: a.speaker, solid: false };
    this.npcDefs.set(id, npc);
    this.npcTimers.set(id, { wander: 2, bark: 9999, origin: { x: a.x, y: a.y }, barkIdx: 0 });
  }

  // ---- clues ----
  private addClue(def: ClueDef): void {
    const pos = toPx(def.at);
    const kind = def.kind ?? 'footprint';
    const glow = this.addOverlay(this.add.image(pos.x, pos.y, 'w-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x49e0c8).setDepth(150).setAlpha(0).setScale(0.55));
    const img = this.addOverlay(this.add.image(pos.x, pos.y, clueKey(kind)).setDepth(151).setAlpha(0).setAngle(def.angle ?? 0));
    const rt: ClueRt = { def, x: pos.x, y: pos.y, img, glow, revealed: false, found: (def.clue ? G.state.hasClue(def.clue) : false) || this.mem.has('clues', def.id), phase: Math.random() * 6 };
    this.clues.push(rt);
    this.interactives.push({
      id: def.id, kind: 'clue', verb: def.verb ?? 'Untersuchen', radius: 16 * wk(),
      pos: () => pos, top: () => ({ x: pos.x, y: pos.y - 8 }), bounds: () => ({ x: pos.x - 9, y: pos.y - 8, w: 18, h: 14 }),
      enabled: () => (rt.revealed || this.look.amt > 0.5) && !rt.found,
      run: async () => {
        rt.found = true;
        this.mem.add('clues', def.id);
        this.player.faceTowards(pos.x, pos.y);
        void this.player.playOnce('kneel', 600);
        if (!def.clue) sfx('discover', 0.6); // with a journal clue the UI toast plays the sound
        this.burst(pos.x, pos.y, 'urmacht', 10);
        if (def.clue) G.state.addClue(def.clue); // the UI toasts on 'clue:gained'
        this.emit('clue', def.id);
        if (def.thought) await this.ctx.think(def.thought);
        await this.runHandler(def.onInteract);
      },
    });
  }

  // =============================================================================================================
  // Events
  // =============================================================================================================

  on(event: WorldEvent, id: string, fn: (id: string) => void | Promise<void>, mapScoped = false): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    const l: Listener = { id, fn, map: mapScoped };
    set.add(l);
    return () => set!.delete(l);
  }

  emit(event: WorldEvent, id: string): void {
    const set = this.listeners.get(event);
    if (set) for (const l of [...set]) {
      if (l.id === id || l.id === '*') {
        try {
          const r = l.fn(id);
          if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(e => { if (!(e instanceof WorldStopped)) console.error('[world]', e); });
        } catch (e) { if (!(e instanceof WorldStopped)) console.error('[world]', e); }
      }
    }
    G.events.emit(`world:${event}`, { id, map: this.map?.id });
  }

  // =============================================================================================================
  // Update loop
  // =============================================================================================================

  get playerLocked(): boolean {
    return inputLock.locked || this.scriptLock > 0 || this.transitioning || this.spotting || this.busyInteract || !this.alive;
  }

  update(_time: number, delta: number): void {
    if (!this.alive || !this.player) return;
    const dt = Math.min(delta, 50) / 1000;
    this.timeSec += dt;
    const t = this.timeSec;

    if (this.playerLocked) { this.lastLockedAt = t; this.lastLockedReal = performance.now(); }
    if (this.hitStop > 0) {
      // Freeze frame after being spotted: actors hold still, the camera, light and cones keep breathing.
      this.hitStop -= dt;
      if (this.hitStop <= 0) this.anims.resumeAll();
    } else {
      this.updatePlayer(dt);
      this.updateNpcs(dt);
      this.updateCompanions(dt);
      this.updateOrphans(dt);
      this.updateHiding();
      this.updateGuards(dt);
      this.pushOutOfSolids();
    }
    if (!this.transitioning) { this.updateTriggers(); this.updateExits(); }
    this.updateFocus();
    this.updateLook(dt);
    for (const p of this.propList) p.update(t, dt, this.weather.wind);
    this.updateOccluders(dt);
    for (const f of this.flames) f.update(dt, this.weather.wind);
    this.updateCamera(dt);
    this.lighting.update(dt, this.cam);
    this.lighting.setWeather(this.weather.kind);
    this.weather.update(dt, this.lighting.time, this.lighting.gradeColor, this.lighting.darkness, this.look.amt);
    this.updatePuffs(dt);
    this.updateSparkles(dt);
    this.updateObjective();
    this.drawCones();
    this.debug.update();
  }

  // ---- player ----
  private updatePlayer(dt: number): void {
    const p = this.player;
    if (p.path) { p.update(dt, true); this.trail.push(p.x, p.y); return; }  // scripted walk
    const locked = this.playerLocked;
    let ix = 0, iy = 0;
    let running = false, sneaking = false;
    const k = this.keys;
    if (!locked) {
      if (k.A.isDown || k.LEFT.isDown) ix -= 1;
      if (k.D.isDown || k.RIGHT.isDown) ix += 1;
      if (k.W.isDown || k.UP.isDown) iy -= 1;
      if (k.S.isDown || k.DOWN.isDown) iy += 1;
      if (Math.abs(virtualInput.x) > 0.12 || Math.abs(virtualInput.y) > 0.12) { ix += virtualInput.x; iy += virtualInput.y; }
      running = k.SHIFT.isDown || virtualInput.run;
      sneaking = this.map.sneak !== false && (k.C.isDown || k.CTRL.isDown || virtualInput.sneak);
    }
    if ((ix !== 0 || iy !== 0) && this.clickPath) this.cancelClick();
    // click-to-move steering
    if (!locked && this.clickPath && this.clickPath.length) {
      const wp = this.clickPath[0];
      const dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy);
      if (d < 3) {
        this.clickPath.shift();
        if (!this.clickPath.length) { this.clickPath = null; this.clickMarker.setVisible(false); } // keep clickTarget for the check below
      } else { ix = dx / d; iy = dy / d; const slow = 14 * wk(); if (this.clickPath.length === 1 && d < slow) { ix *= d / slow; iy *= d / slow; } }
    }
    if (this.clickTarget && !locked) {
      if (this.distTo(this.clickTarget) <= this.clickTarget.radius - 2 && this.clickTarget.enabled()) {
        const target = this.clickTarget;
        this.cancelClick();
        void this.interact(target);
      } else if (!this.clickPath) this.clickTarget = null;
    }
    const inp = normalizeInput(ix, iy);
    const terrainK = this.speedAt(p.x, p.y);
    const K = wk();
    const max = (sneaking ? 34 * K : running ? p.runSpeed : p.walkSpeed) * terrainK;
    const v = stepVelocity(p.vx, p.vy, inp.x, inp.y, max, (running ? 520 : 640) * K, 820 * K, dt);
    const wasRunning = p.running && p.speed > 70 * K;
    p.vx = v.vx; p.vy = v.vy;
    p.running = running; p.sneaking = sneaking;
    this.moveWithCollision(p, dt);
    if (inp.x !== 0 || inp.y !== 0) p.dir = dirFromVector(inp.x, inp.y, p.dir);
    // Skid puff when stopping from a run
    if (wasRunning && inp.x === 0 && inp.y === 0 && p.speed < 40 * K) this.puff(p.x, p.y, 'dust', 1.2);
    p.update(dt, false);
    this.trail.push(p.x, p.y);
    // Stuck detection for click paths
    if (this.clickPath && p.speed < 6) { this.stuckT += dt; if (this.stuckT > 0.6) this.cancelClick(); }
    else this.stuckT = 0;
  }

  private moveWithCollision(a: Actor, dt: number): void {
    const g = this.grid;
    const dx = a.vx * dt, dy = a.vy * dt;
    if (dx !== 0) {
      if (g.boxFree(a.x + dx, a.y, FOOT_HW, FOOT_HH)) a.x += dx;
      else {
        // corner assist: slide around small edges
        let slid = false;
        for (const off of [1, 2, 3, 4, 5]) {
          for (const s of [-1, 1]) {
            if (g.boxFree(a.x + dx, a.y + off * s, FOOT_HW, FOOT_HH) && g.boxFree(a.x, a.y + off * s, FOOT_HW, FOOT_HH)) {
              a.y += Math.sign(s) * Math.min(off, Math.abs(dx) + 0.5); slid = true; break;
            }
          }
          if (slid) break;
        }
        if (!slid) a.vx = 0;
      }
    }
    if (dy !== 0) {
      if (g.boxFree(a.x, a.y + dy, FOOT_HW, FOOT_HH)) a.y += dy;
      else {
        let slid = false;
        for (const off of [1, 2, 3, 4, 5]) {
          for (const s of [-1, 1]) {
            if (g.boxFree(a.x + off * s, a.y + dy, FOOT_HW, FOOT_HH) && g.boxFree(a.x + off * s, a.y, FOOT_HW, FOOT_HH)) {
              a.x += Math.sign(s) * Math.min(off, Math.abs(dy) + 0.5); slid = true; break;
            }
          }
          if (slid) break;
        }
        if (!slid) a.vy = 0;
      }
    }
  }

  /** Keeps the player out of solid NPCs/guards (soft push). */
  private pushOutOfSolids(): void {
    const p = this.player;
    if (p.path) return;
    for (const a of this.actors.values()) {
      if (a === p || !a.solid || !a.visible || a.kind === 'companion') continue;
      const dx = p.x - a.x, dy = (p.y - a.y) * 1.6;
      const d = Math.hypot(dx, dy);
      const min = 8 * wk();
      if (d < min && d > 0.001) {
        const push = (min - d);
        const nx = p.x + (dx / d) * push, ny = p.y + (dy / d) * push / 1.6;
        if (this.grid.boxFree(nx, ny, FOOT_HW, FOOT_HH)) { p.x = nx; p.y = ny; }
      }
    }
  }

  // ---- NPCs ----
  private updateNpcs(dt: number): void {
    for (const [id, def] of this.npcDefs) {
      const a = this.actors.get(id);
      const tm = this.npcTimers.get(id);
      if (!a || !tm) continue;
      if (!a.held && !a.path && def.wander && a.visible) {
        tm.wander -= dt;
        if (tm.wander <= 0) {
          tm.wander = 2.5 + Math.random() * 4;
          const r = unitPx(def.wander);
          const ang = Math.random() * Math.PI * 2, rad = Math.random() * r;
          const target = { x: tm.origin.x + Math.cos(ang) * rad, y: tm.origin.y + Math.sin(ang) * rad };
          const path = findPath(this.grid, { x: a.x, y: a.y }, target, { hw: FOOT_HW, hh: FOOT_HH, maxNodes: 4000 });
          if (path && path.length) { void a.moveAlong(path, a.walkSpeed * 0.7); a.wandering = true; }
        }
      }
      // Don't walk into the player: pause when close.
      if (a.path && a.wandering && Math.hypot(a.x - this.player.x, a.y - this.player.y) < 12 * wk() && !a.held) { a.stopPath(); a.faceTowards(this.player.x, this.player.y); }
      if (def.barks?.length && a.visible && !a.held) {
        tm.bark -= dt;
        if (tm.bark <= 0) {
          tm.bark = (def.barkEvery ?? 7000) / 1000 * (0.8 + Math.random() * 0.5);
          const near = Math.hypot(a.x - this.player.x, a.y - this.player.y) < 150 * wk();
          if (near && this.onScreen(a.x, a.y, -8) && !inputLock.locked) {
            const text = def.barks[tm.barkIdx++ % def.barks.length];
            this.barkActor(a, text);
          }
        }
      }
      a.update(dt);
    }
  }

  /** Actors no controller drives (script-spawned extras, odd states) still walk their paths and animate. */
  private updateOrphans(dt: number): void {
    for (const a of this.actors.values()) {
      if (a.kind === 'player' || a.kind === 'guard') continue;
      if (a.kind === 'npc' && this.npcDefs.has(a.id)) continue;
      if (a.kind === 'companion' && this.companionDefs.some(c => c.id === a.id)) continue;
      a.update(dt);
    }
  }

  /** Speech bubble over an actor. Tracked so map changes, the spotted reaction and shutdown can clear it. */
  barkActor(a: Actor, text: string, ms = 2600): () => void {
    let remove: () => void = () => {};
    try {
      remove = G.ui.bubble(text, () => (!a.destroyed && a.visible && this.alive && !this.transitioning ? this.toScreen(a.x, a.headY - 2) : null), ms);
    } catch { return () => {}; }
    const r = () => { this.bubbles.delete(r); try { remove(); } catch { /* */ } };
    this.bubbles.add(r);
    this.time.delayedCall(ms + 400, () => this.bubbles.delete(r));
    return r;
  }

  clearBubbles(): void {
    for (const r of [...this.bubbles]) r();
    this.bubbles.clear();
    for (const g of this.guards) g.clearBark();
  }

  // ---- companions ----
  private updateCompanions(dt: number): void {
    const p = this.player;
    const idle = p.speed < 4 && !p.path;
    this.idleT = idle ? this.idleT + dt : 0;
    // During interactions and cutscenes followers stay put instead of crowding into the slot behind Lia.
    const hold = this.partyHold || this.scriptLock > 0 || this.busyInteract;
    this.companionDefs.forEach((c, i) => {
      const a = this.actors.get(c.id);
      if (!a) return;
      if (a.held || a.path) { a.update(dt); return; }
      let slot = this.trail.pointBehind(p.x, p.y, followDistance(i));
      let formation = false;
      if (idle && this.idleT > 0.35) {
        // Standing formation: step beside Lia (relative to her facing), not into a column behind her.
        const f = dirVector(p.dir);
        let side = this.formSide.get(c.id) ?? sideOf(p.x, p.y, f, a.x, a.y);
        let fs = formationSlot(p.x, p.y, f, side, i);
        const ok = (q: Vec) => this.grid.boxFree(q.x, q.y, FOOT_HW, FOOT_HH) && lineFree(this.grid, { x: p.x, y: p.y }, q, FOOT_HW, FOOT_HH);
        if (!ok(fs)) { side = side === 1 ? -1 : 1; fs = formationSlot(p.x, p.y, f, side, i); }
        if (ok(fs)) { slot = fs; formation = true; this.formSide.set(c.id, side); }
      } else if (!idle) this.formSide.delete(c.id);
      const dx = slot.x - a.x, dy = slot.y - a.y, d = Math.hypot(dx, dy);
      // Teleport catch-up when far away and off-screen (e.g. after a long run).
      if (d > 160 && !this.onScreen(a.x, a.y, 8) && !this.onScreen(slot.x, slot.y, -8)) {
        const behind = this.trail.pointBehind(p.x, p.y, followDistance(i) + 24 * wk());
        a.teleport(behind.x, behind.y);
        return;
      }
      if (d > 220) { a.teleport(slot.x, slot.y); return; }
      const sp = hold && d < 80 * wk() ? 0 : formation ? (d > 2 ? Math.max(28 * wk(), a.walkSpeed * 0.6) : 0) : followerSpeed(d, p.speed, a.walkSpeed, 2.5);
      if (sp === 0) { a.vx *= 0.6; a.vy *= 0.6; if (Math.abs(a.vx) + Math.abs(a.vy) < 1) { a.vx = 0; a.vy = 0; } }
      else {
        const s = Math.min(sp, d / dt);
        const nx = a.x + (dx / d) * s * dt, ny = a.y + (dy / d) * s * dt;
        // The trail is collision free; formation steps are checked so nobody walks into a wall or prop.
        if (!formation || this.grid.boxFree(nx, ny, FOOT_HW, FOOT_HH)) {
          a.vx = (dx / d) * s; a.vy = (dy / d) * s;
          a.x = nx; a.y = ny;
          a.dir = dirFromVector(a.vx, a.vy, a.dir);
        } else { a.vx = 0; a.vy = 0; }
      }
      a.running = p.running && a.speed > 70 * wk();
      a.sneaking = p.sneaking;
      if (!a.moving && !p.moving) {
        // idle: look where Lia looks, glance at her now and then
        if (formation && Math.random() < dt * 0.8) a.face(p.dir);
        else if (Math.hypot(p.x - a.x, p.y - a.y) < 40 * wk() && Math.random() < dt * 0.35) a.faceTowards(p.x, p.y);
      }
      a.update(dt, false);
    });
  }

  // ---- hiding ----
  private updateHiding(): void {
    const p = this.player;
    let spot: HideRt | null = null;
    if (p.sneaking) {
      for (const h of this.hides) if (inArea(h, p.x, p.y)) { spot = h; break; }
      if (!spot && this.hideAt(p.x, p.y)) spot = { rect: { x: 0, y: 0, w: 0, h: 0 }, kind: 'grass' };
    }
    const was = this.playerHidden;
    this.playerHidden = Boolean(spot);
    if (spot && (!was || (spot.prop && spot.prop !== this.hiddenIn?.prop))) {
      spot.prop?.shake(1);
      sfx('rustle', 0.6);
    }
    if (this.hiddenIn?.prop && this.hiddenIn.prop !== spot?.prop) this.hiddenIn.prop.setAlpha(1);
    this.hiddenIn = spot;
    p.fade = this.playerHidden ? (spot?.prop ? 0.85 : 0.8) : 1;
    // Draw the player inside the bush: behind its leaves, which turn see-through.
    if (spot?.prop) { p.sprite.setDepth(spot.prop.depth - 0.5); spot.prop.setAlpha(0.62); }
  }

  // ---- guards ----
  private updateGuards(dt: number): void {
    let maxSusp = 0, nearest = Infinity;
    const enabled = this.stealthOn && !this.playerLocked;
    for (const g of this.guards) {
      const res = g.update({ grid: this.grid, target: this.player, hidden: this.playerHidden, enabled, paused: this.playerLocked, dt, t: this.timeSec });
      maxSusp = Math.max(maxSusp, g.susp.value);
      nearest = Math.min(nearest, Math.hypot(g.actor.x - this.player.x, g.actor.y - this.player.y));
      if (res === 'spotted') void this.spotted(g);
    }
    // Heartbeat when danger is close.
    const proximity = this.guards.length ? clamp(1 - (nearest - 30 * wk()) / (90 * wk()), 0, 1) : 0;
    const danger = this.stealthOn ? Math.max(maxSusp, proximity * (this.playerHidden ? 0.5 : 0.75)) : 0;
    if (danger > 0.12 && !this.spotting) {
      const interval = 0.95 - danger * 0.5;
      const volume = 0.25 + danger * 0.65;
      if (!this.heartbeat) {
        try { this.heartbeat = G.audio.loop('heartbeat', { interval, volume }); } catch { this.heartbeat = null; }
      } else this.heartbeat.set({ interval, volume });
    } else if (this.heartbeat) { this.heartbeat.stop(400); this.heartbeat = null; }
  }

  private async spotted(g: Guard): Promise<void> {
    if (this.spotting) return;
    this.spotting = true;
    this.clickPath = null; this.clickTarget = null;
    this.player.vx = this.player.vy = 0;
    this.clearBubbles();
    this.emit('spotted', g.actor.id);
    // Juice (DESIGN.md §1): freeze frame, red vignette pulse, zoom punch + short shake (all reduced-motion aware).
    this.hitStop = settings.reducedMotion ? 0.06 : 0.14;
    this.anims.pauseAll();
    this.vignette.setVisible(true).setAlpha(0);
    this.tweens.killTweensOf(this.vignette);
    this.tweens.chain({ targets: this.vignette, tweens: [
      { alpha: 0.75, duration: 90, ease: 'Quad.easeOut' },
      { alpha: 0.28, duration: 380, ease: 'Sine.easeInOut' },
      { alpha: 0, duration: 700, ease: 'Sine.easeIn', onComplete: () => this.vignette.setVisible(false) },
    ] });
    this.punch(0.1);
    this.shake(200, 0.005);
    this.heartbeat?.stop(200); this.heartbeat = null;
    const handler = this.spottedHandler ?? (this.map.stealth?.onSpotted ? (id: string) => this.map.stealth!.onSpotted!(this.ctx, this.ctx.actor(id)) : null);
    try {
      if (handler) {
        await handler(g.actor.id);
        g.calmDown();
      } else {
        this.player.faceTowards(g.actor.x, g.actor.y);
        await this.ctx.wait(160);
        void this.player.emote('drop', 900);
        await this.ctx.wait(900);
        await this.fadeCams('out', 450);
        for (const gg of this.guards) gg.reset();
        this.player.teleport(this.checkpoint.x, this.checkpoint.y, this.checkpointDir);
        const dv = dirVector(this.checkpointDir);
        this.trail.reset(this.checkpoint.x, this.checkpoint.y, dv.x, dv.y, 80);
        this.placeCompanionsBehind();
        this.snapCamera();
        await this.ctx.wait(150);
        await this.fadeCams('in', 450);
      }
    } catch (e) { if (!(e instanceof WorldStopped)) console.error(e); } finally { this.spotting = false; }
  }

  /** Restarts the follow trail behind the player (after teleports). */
  resetTrail(): void {
    const dv = dirVector(this.player.dir);
    this.trail.reset(this.player.x, this.player.y, dv.x, dv.y, 80);
  }

  placeCompanionsBehind(): void {
    this.formSide.clear();
    this.companionDefs.forEach((c, i) => {
      const a = this.actors.get(c.id);
      if (!a) return;
      const s = this.trail.pointBehind(this.player.x, this.player.y, followDistance(i));
      a.teleport(s.x, s.y, this.player.dir);
    });
  }

  /**
   * Vision cones on the ground (world camera, depth -150: occluders and actors cover them). Drawn as a fan of
   * triangles with per-vertex alpha, which gives a true radial falloff without bands or outlines.
   */
  private drawCones(): void {
    const g = this.coneGfx;
    g.clear();
    this.meterGfx.clear();
    if (!this.guards.length) return;
    const dark = this.lighting.darkness;
    const night = dark > 0.5;
    g.setBlendMode(night ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    const lookK = 1 - this.look.amt * 0.65;
    for (const gd of this.guards) {
      const a = gd.actor;
      if (!a.visible || !this.onScreen(a.x, a.y, gd.range * 1.3 + 10)) continue;
      const lvl = gd.susp.level;
      const col = lvl === 'alert' ? 0xff4a32 : lvl === 'suspicious' ? 0xffa23c : 0xfff0a8;
      // Alert: quick red scale pulse that settles.
      const age = gd.alertAge;
      const pulse = age < 0.5 ? Math.sin((age / 0.5) * Math.PI) : 0;
      const range = gd.range * (1 + pulse * 0.16);
      const active = this.stealthOn ? 1 : 0.4;
      // Painted backgrounds are bright and busy: the cone needs body by day to stay readable.
      const dayA = 0.4;
      const base = (night ? dayA * 0.75 + dark * 0.12 : dayA) * active * lookK * (1 + pulse * 0.8) * (lvl === 'suspicious' ? 1.15 : 1);
      const rim = conePolygon(this.grid, gd.eye, gd.facing, gd.half, range, 30);
      const o = rim[0];
      const n = rim.length - 1;
      const alphaAt = (i: number) => {
        const p = rim[i];
        const t = Math.min(1, Math.hypot(p.x - o.x, p.y - o.y) / range);
        const u = (i - 1) / Math.max(1, n - 1);
        const edge = 0.45 + 0.55 * smooth(Math.min(u, 1 - u) / 0.14);
        return base * Math.pow(1 - t, 0.9) * edge;
      };
      for (let i = 1; i < n; i++) {
        const p1 = rim[i], p2 = rim[i + 1];
        g.fillGradientStyle(col, col, col, col, base * 1.1, alphaAt(i), alphaAt(i + 1), 0);
        g.fillTriangle(o.x, o.y, p1.x, p1.y, p2.x, p2.y);
      }
      // A faint 1 px tip arc where the rays reach full range (shows how far the guard sees).
      g.lineStyle(1, col, base * 0.55);
      for (let i = 1; i < n; i++) {
        const p1 = rim[i], p2 = rim[i + 1];
        if (Math.hypot(p1.x - o.x, p1.y - o.y) > range * 0.97 && Math.hypot(p2.x - o.x, p2.y - o.y) > range * 0.97) g.lineBetween(p1.x, p1.y, p2.x, p2.y);
      }
      // suspicion meter
      const v = gd.susp.value;
      if (v > 0.02 && lvl !== 'alert') {
        const mx = a.x, my = a.headY - 6;
        const m = this.meterGfx;
        m.fillStyle(0x1a1410, 0.75);
        m.fillRect(mx - 7, my - 1, 14, 4);
        m.fillStyle(v > 0.6 ? 0xff5a3a : 0xffb347, 1);
        m.fillRect(mx - 6, my, Math.max(1, Math.round(12 * v)), 2);
      }
    }
  }

  // ---- triggers & exits ----
  private updateTriggers(): void {
    const p = this.player;
    for (const t of this.triggers) {
      const inside = inArea(t, p.x, p.y);
      if (inside && !t.inside) {
        t.inside = true;
        // Cutscenes (scriptLock) walk through triggers without firing them.
        if (this.scriptLock > 0 || !t.enabled || (t.def.when && !t.def.when()) || ((t.def.once ?? true) && t.done)) continue;
        t.done = true;
        if (t.def.once ?? true) this.mem.add('triggers', t.def.id);
        this.emit('trigger', t.def.id);
        void this.runHandler(t.def.onEnter);
      } else if (!inside && t.inside) {
        t.inside = false;
        if (t.enabled) { this.emit('triggerExit', t.def.id); void this.runHandler(t.def.onExit); }
      }
    }
  }

  private updateExits(): void {
    const p = this.player;
    if (this.playerLocked) return;
    for (const e of this.exits) {
      if (e.def.door) continue;
      const inside = inArea(e, p.x, p.y);
      if (!inside) { e.armed = true; e.blockedShown = false; continue; }
      if (!e.armed || !e.enabled) continue;
      if (e.def.when && !e.def.when()) {
        if (!e.blockedShown && e.def.blocked) { e.blockedShown = true; void this.ctx.think(e.def.blocked).catch(() => {}); }
        continue;
      }
      void this.transitionVia(e);
      return;
    }
  }

  private exitDir(e: ExitRt): Dir {
    if (e.def.dir) return e.def.dir;
    const r = e.rect;
    if (r.x <= 2) return 'left';
    if (r.x + r.w >= this.mapW - 2) return 'right';
    if (r.y <= 2) return 'up';
    if (r.y + r.h >= this.mapH - 2) return 'down';
    return dirFromVector(this.player.vx, this.player.vy, this.player.dir);
  }

  async transitionVia(e: ExitRt): Promise<void> {
    if (this.transitioning) return;
    this.emit('exit', e.def.id);
    const dir = this.exitDir(e);
    const dv = dirVector(dir);
    void this.player.moveAlong([{ x: this.player.x + dv.x * 30 * wk(), y: this.player.y + dv.y * 30 * wk() }], (this.player.running ? 90 : 60) * wk(), this.player.running);
    await this.changeMap(e.def.to, e.def.spawn, { fadeMs: e.def.fade ?? 420 });
  }

  async changeMap(mapOrId: string | MapDef, spawn?: string, opts: { fadeMs?: number } = {}): Promise<void> {
    if (this.transitioning) return;
    const def = typeof mapOrId === 'string' ? getMap(mapOrId) : mapOrId;
    const ms = opts.fadeMs ?? 420;
    this.transitioning = true;
    this.clearOutline();
    this.clearBubbles();
    try { G.ui.hint(null); G.ui.objectivePointer(null); } catch { /* */ }
    this.hintKey = '';
    // Load the next map's art while the screen fades (both must finish before the rebuild).
    const [bg] = await Promise.all([this.loadAssets(def), this.fadeCams('out', ms)]);
    if (!this.alive) return;
    this.player.stopPath();
    this.teardownMap();
    this.buildMap(def, spawn, bg);
    this.drawDebug();
    this.snapCamera();
    this.weather.rescatter();
    // Walk in from the spawn direction for a smooth arrival.
    const sp = def.spawns[spawn ?? ''] ?? def.spawns.default ?? Object.values(def.spawns)[0];
    const fadeIn = this.fadeCams('in', ms);
    if (sp?.dir) {
      const dv = dirVector(sp.dir);
      const K = wk();
      const target = { x: this.player.x + dv.x * 14 * K, y: this.player.y + dv.y * 14 * K };
      if (this.grid.boxFree(target.x, target.y, FOOT_HW, FOOT_HH)) {
        this.player.teleport(this.player.x - dv.x * 10 * K, this.player.y - dv.y * 10 * K, sp.dir);
        await this.player.moveAlong([target], 60 * K);
      }
    }
    await fadeIn;
    this.transitioning = false;
    if (def.name) { try { G.ui.toast(def.name, 'info'); } catch { /* */ } }
    this.emit('map', def.id);
    void this.runHandler(def.onEnter);
  }

  fadeCams(dir: 'in' | 'out', ms: number): Promise<void> {
    return new Promise(resolve => {
      if (!this.alive) { resolve(); return; }
      const cams = [this.cam, this.overlayCam];
      for (const c of cams) {
        c.resetFX();
        if (dir === 'out') c.fadeOut(ms, 0, 0, 0); else c.fadeIn(ms, 0, 0, 0);
      }
      this.time.delayedCall(ms + 20, () => resolve());
    });
  }

  // ---- interaction ----
  private updateFocus(): void {
    const p = this.player;
    let best: Interactive | null = null;
    if (!this.playerLocked && !p.path) {
      let bestScore = Infinity;
      const facing = dirVector(p.dir);
      for (const it of this.interactives) {
        if (!it.enabled()) continue;
        const pos = it.dist ? closestOnPoly(p.x, p.y, it.hotPoly!) : it.pos();
        const dx = pos.x - p.x, dy = pos.y - p.y;
        const d = this.distTo(it);
        if (d > it.radius) continue;
        const front = d > 0.1 ? (dx * facing.x + dy * facing.y) / d : 1;
        const score = d - front * 6;
        if (score < bestScore) { bestScore = score; best = it; }
      }
    }
    if (best !== this.focus) {
      this.focus = best;
      this.setOutline(best?.outline?.());
      if (best) sfx('ui-move', 0.15);
    }
    // Painted hotspots brighten softly while focused.
    for (const it of this.interactives) {
      if (!it.glow) continue;
      const target = it === best ? 0.16 + 0.1 * Math.sin(this.timeSec * 5) : 0;
      const a = it.glow.alpha + (target - it.glow.alpha) * 0.25;
      it.glow.setAlpha(a < 0.005 ? 0 : a);
      if (!it.enabled()) it.glow.setAlpha(0);
    }
    // A soft light on the focused object keeps it readable at dusk/night.
    if (best) {
      const fp = best.pos();
      if (!this.focusLight) this.focusLight = this.lighting.add({ id: 'focus-light', at: [0, 0], kind: 'plain', color: 0xfff1d0, radius: 30, intensity: 0 }, fp);
      this.focusLight.x = fp.x; this.focusLight.y = fp.y - 8;
      this.focusLight.intensity = Math.min(0.55, this.focusLight.intensity + 0.05);
    } else if (this.focusLight) {
      this.focusLight.intensity = Math.max(0, this.focusLight.intensity - 0.05);
    }
    // Hint
    if (best) {
      const top = best.top();
      const s = this.toScreen(top.x, top.y - 3);
      const key = `${best.id}|${best.verb}|${Math.round(s.x)}|${Math.round(s.y)}`;
      if (key !== this.hintKey) {
        this.hintKey = key;
        try { G.ui.hint({ verb: best.verb, key: isTouch ? undefined : 'E', x: s.x, y: s.y }); } catch { /* */ }
      }
    } else if (this.hintKey) {
      this.hintKey = '';
      try { G.ui.hint(null); } catch { /* */ }
    }
    this.updateOutline();
    // Action input
    const now = performance.now();
    const queued = this.actionQueuedAt;
    // Ignore presses that closed a dialogue (they happened while/just after input was locked) and stale ones.
    const pressed = queued > 0 && now - queued < 300 && queued > this.lastLockedReal + 150;
    if (queued > 0 && (pressed || now - queued >= 300 || queued <= this.lastLockedReal + 150)) this.actionQueuedAt = 0;
    const touchPressed = consumeAction();
    if ((pressed || touchPressed) && best && !this.playerLocked && this.timeSec - this.lastLockedAt > 0.15) {
      // Mashing through a dialogue must not reopen the same conversation: the same target needs a calm gap.
      const since = now - Math.max(this.lastLockedReal, this.lastInteract.at);
      if (best.id !== this.lastInteract.id || since > 650) void this.interact(best);
    }
  }

  /** Distance from the player to an interactive (hotspot polygons: to the outline). */
  distTo(it: Interactive): number {
    const p = this.player;
    if (it.dist) return it.dist(p.x, p.y);
    const q = it.pos();
    return Math.hypot(q.x - p.x, q.y - p.y);
  }

  async interact(it: Interactive): Promise<void> {
    if (this.busyInteract || !it.enabled()) return;
    this.busyInteract = true;
    this.clickPath = null; this.clickTarget = null;
    this.player.vx = this.player.vy = 0;
    this.setOutline(undefined);
    try { G.ui.hint(null); } catch { /* */ }
    this.hintKey = '';
    this.focus = null;
    this.partyHold = true;
    let back: Vec | null = null;
    try {
      const st = it.stand?.();
      if (st) back = await this.walkPlayerToStand(st);
      await it.run();
      this.emit('interact', it.id);
    } catch (e) {
      if (!(e instanceof WorldStopped)) console.error('[world] interaction failed', e);
    } finally {
      // Off the seat again (stand points on props lie inside their footprint).
      if (back && this.alive && !this.transitioning && !this.grid.boxFree(this.player.x, this.player.y, FOOT_HW, FOOT_HH)) {
        await this.player.moveAlong([back], 60 * wk()).catch(() => {});
      }
      if (this.player) { this.player.depthBias = 2; this.player.clearOverride(); }
      this.partyHold = false;
      this.busyInteract = false;
      this.lastLockedAt = this.timeSec;
      this.lastInteract = { id: it.id, at: performance.now() };
    }
  }

  /**
   * Walks the player to an interaction stand point (pathfinding to the closest free spot, then a short straight
   * step onto seats inside a prop), faces it and parks companions that stand in the way. Returns the last free
   * point (to step back to afterwards).
   */
  async walkPlayerToStand(st: StandPoint): Promise<Vec> {
    const p = this.player;
    const target = { x: st.x, y: st.y };
    const path = findPath(this.grid, { x: p.x, y: p.y }, target, { hw: FOOT_HW, hh: FOOT_HH }) ?? [];
    const last = path.length ? path[path.length - 1] : { x: p.x, y: p.y };
    if (Math.hypot(last.x - target.x, last.y - target.y) > 0.5 && Math.hypot(last.x - target.x, last.y - target.y) < 18 * wk()) path.push(target);
    // Companions near the stand point step two tiles aside.
    for (const c of this.companionDefs) {
      const a = this.actors.get(c.id);
      if (!a || Math.hypot(a.x - target.x, a.y - target.y) > 26 * wk()) continue;
      const away = this.freeSpotNear(target, 30 * wk(), { x: a.x - target.x, y: a.y - target.y });
      if (away) { const ap = findPath(this.grid, { x: a.x, y: a.y }, away, { hw: FOOT_HW, hh: FOOT_HH }); if (ap) void a.moveAlong(ap, 60 * wk()); }
    }
    const dist = path.reduce((acc, q, i) => acc + Math.hypot(q.x - (i ? path[i - 1].x : p.x), q.y - (i ? path[i - 1].y : p.y)), 0);
    if (dist > 0.5) await p.moveAlong(path, Math.max(64 * wk(), Math.min(110 * wk(), dist / 0.35)));
    if (st.over !== undefined) p.depthBias = Math.max(2, st.over - p.y + 0.5);
    if (st.face) p.face(st.face);
    return last;
  }

  /** A free spot about `dist` px from `c`, preferring direction `pref`. */
  private freeSpotNear(c: Vec, dist: number, pref: Vec): Vec | null {
    const base = Math.atan2(pref.y, pref.x || 0.001);
    for (let k = 0; k < 12; k++) {
      const ang = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6);
      const q = { x: c.x + Math.cos(ang) * dist, y: c.y + Math.sin(ang) * dist };
      if (this.grid.boxFree(q.x, q.y, FOOT_HW, FOOT_HH)) return q;
    }
    return null;
  }

  private setOutline(src: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | undefined): void {
    this.clearOutline();
    if (!src || !src.active) return;
    this.outlineSrc = src;
    for (let i = 0; i < 4; i++) {
      const o = this.addWorld(this.add.image(src.x, src.y, src.texture.key, src.frame.name));
      o.setOrigin(src.originX, src.originY).setTintFill(0xffffff).setFlipX(src.flipX);
      this.outline.push(o);
    }
  }

  private clearOutline(): void {
    for (const o of this.outline) o.destroy();
    this.outline = [];
    this.outlineSrc = null;
  }

  private updateOutline(): void {
    const src = this.outlineSrc;
    if (!src) return;
    if (!src.active || !src.visible) { this.clearOutline(); return; }
    const pulse = 0.7 + 0.3 * Math.sin(this.timeSec * 6);
    const offs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    this.outline.forEach((o, i) => {
      o.setTexture(src.texture.key, src.frame.name);
      o.setOrigin(src.originX, src.originY).setScale(src.scaleX, src.scaleY);
      o.setPosition(src.x + offs[i][0], src.y + offs[i][1]).setDepth(src.depth - 0.002).setAlpha(pulse * src.alpha).setFlipX(src.flipX);
    });
  }

  private onPointer(p: Phaser.Input.Pointer): void {
    if (!this.alive || !this.player || !this.grid || this.playerLocked || p.button !== 0) return;
    const wp = this.cam.getWorldPoint(p.x, p.y);
    // Clicked an interactive?
    let hit: Interactive | null = null;
    if (this.debug.consumeClick(wp.x, wp.y, p)) return;
    for (const it of this.interactives) {
      if (!it.enabled()) continue;
      const b = it.bounds();
      const inside = it.hit ? it.hit(wp.x, wp.y) : wp.x >= b.x - 3 && wp.x <= b.x + b.w + 3 && wp.y >= b.y - 3 && wp.y <= b.y + b.h + 3;
      if (inside) {
        if (!hit || it.pos().y > hit.pos().y) hit = it;
      }
    }
    const pl = this.player;
    if (hit) {
      const pos = hit.hotPoly ? closestOnPoly(pl.x, pl.y, hit.hotPoly) : hit.pos();
      if (this.distTo(hit) <= hit.radius - 2) { void this.interact(hit); return; }
      this.clickTarget = hit;
      const path = findPath(this.grid, { x: pl.x, y: pl.y }, pos, { hw: FOOT_HW, hh: FOOT_HH });
      this.clickPath = path && path.length ? path : null;
      if (!this.clickPath) this.clickTarget = null;
      this.showMarker(pos.x, pos.y);
      return;
    }
    const path = findPath(this.grid, { x: pl.x, y: pl.y }, { x: wp.x, y: wp.y }, { hw: FOOT_HW, hh: FOOT_HH });
    this.clickTarget = null;
    this.clickPath = path && path.length ? path : null;
    if (this.clickPath) {
      const end = this.clickPath[this.clickPath.length - 1];
      this.showMarker(end.x, end.y);
    } else this.showMarker(wp.x, wp.y, true); // the click registered, but there is no way there
  }

  /** Refreshes the debug overlay geometry (F1 / ?debug). */
  drawDebug(): void { this.debug?.rebuild(); }

  /** Tells the touch UI which contextual buttons to show. */
  syncTouchExtras(): void {
    try { (G.ui as Partial<UiApiExt>).setTouchExtras?.({ sneak: this.map?.sneak !== false, look: this.look.enabled }); } catch { /* */ }
  }

  cancelClick(): void {
    this.clickPath = null;
    this.clickTarget = null;
    if (this.clickMarker?.visible) { this.tweens.killTweensOf(this.clickMarker); this.clickMarker.setVisible(false); }
  }

  private showMarker(x: number, y: number, blocked = false): void {
    const m = this.clickMarker;
    m.setTexture(blocked ? 'w-marker-no' : 'w-marker').setPosition(x, y).setVisible(true).setAlpha(1).setScale(1.6);
    this.tweens.killTweensOf(m);
    this.tweens.add({ targets: m, scale: 1, duration: 220, ease: 'Back.easeOut' });
    if (blocked) this.tweens.add({ targets: m, alpha: 0, duration: 500, delay: 350, onComplete: () => m.setVisible(false) });
    else this.tweens.add({ targets: m, alpha: 0.35, duration: 600, yoyo: true, repeat: -1, delay: 220 });
    if (blocked) sfx('ui-move', 0.12);
  }

  // ---- Spurenblick ----
  private updateLook(dt: number): void {
    const held = this.look.enabled && !this.playerLocked && (this.keys.Q.isDown || virtualInput.look);
    if (held && !this.look.held) sfx('whoosh', 0.25);
    this.look.held = held;
    const target = held ? 1 : 0;
    const prev = this.look.amt;
    this.look.amt += (target - this.look.amt) * Math.min(1, dt * (held ? 6 : 4));
    if (Math.abs(this.look.amt - target) < 0.003) this.look.amt = target;
    const amt = this.look.amt;
    if (amt !== prev || amt > 0) {
      if (!this.colorFx && amt > 0) {
        this.colorFx = this.cam.postFX?.addColorMatrix() ?? null;
        this.vignetteFx = this.cam.postFX?.addVignette(0.5, 0.5, 0.9, 0) ?? null;
      }
      if (this.colorFx) {
        this.colorFx.active = amt > 0.001;
        this.colorFx.reset();
        this.colorFx.saturate(-0.85 * amt, false);
        this.colorFx.brightness(1 - 0.32 * amt, true);
      }
      if (this.vignetteFx) { this.vignetteFx.active = amt > 0.001; this.vignetteFx.strength = 0.55 * amt; this.vignetteFx.radius = 0.75 - 0.15 * amt; }
    }
    // Clue markers
    for (const c of this.clues) {
      c.phase += dt;
      if (amt > 0.6 && !c.revealed && this.onScreen(c.x, c.y, -6)) {
        c.revealed = true;
        if (!c.found) sfx('memory', 0.25);
      }
      const pulse = 0.75 + 0.25 * Math.sin(c.phase * 3.2);
      const base = c.found ? 0.0 : c.revealed ? 0.4 : 0;
      const a = c.found ? amt * 0.35 : Math.max(base * (0.7 + 0.3 * pulse), amt * pulse);
      c.img.setAlpha(a);
      c.glow.setAlpha(a * (c.found ? 0.2 : 0.55)).setScale(0.45 + 0.08 * pulse);
      if (amt > 0.5 && !c.found && Math.random() < dt * 2.5 && this.onScreen(c.x, c.y)) this.burst(c.x + (Math.random() - 0.5) * 8, c.y, 'urmacht', 1);
    }
  }

  // ---- camera ----
  snapCamera(): void {
    const f = this.camTarget();
    this.camFocus = { ...f };
    this.camLook = { x: 0, y: 0 };
    this.cam.centerOn(f.x, f.y);
    this.overlayCam.centerOn(f.x, f.y);
    this.cam.preRender(); this.overlayCam.preRender();
  }

  private camTarget(): Vec {
    if (this.camMode.kind === 'fixed') return { x: this.camMode.x, y: this.camMode.y };
    const a = this.actors.get(this.camMode.id) ?? this.player;
    return { x: a.x, y: a.y - 10 };
  }

  setCamMode(mode: { kind: 'follow'; id: string } | { kind: 'fixed'; x: number; y: number }): void { this.camMode = mode; }

  private updateCamera(dt: number): void {
    const target = this.camTarget();
    if (this.camMode.kind === 'follow') {
      const a = this.actors.get(this.camMode.id) ?? this.player;
      const la = this.map.camera?.lookahead ?? 18;
      const sp = Math.hypot(a.vx, a.vy);
      const lx = sp > 5 ? (a.vx / Math.max(sp, 60)) * la : 0;
      const ly = sp > 5 ? (a.vy / Math.max(sp, 60)) * la * 0.7 : 0;
      this.camLook.x += (lx - this.camLook.x) * damp(2.2, dt);
      this.camLook.y += (ly - this.camLook.y) * damp(2.2, dt);
      target.x += this.camLook.x; target.y += this.camLook.y;
      // soft deadzone
      const dx = target.x - this.camFocus.x, dy = target.y - this.camFocus.y;
      const dz = 6;
      const ex = Math.abs(dx) > dz ? dx - Math.sign(dx) * dz : 0;
      const ey = Math.abs(dy) > dz ? dy - Math.sign(dy) * dz : 0;
      this.camFocus.x += ex * damp(6, dt);
      this.camFocus.y += ey * damp(6, dt);
    } else {
      this.camFocus.x += (target.x - this.camFocus.x) * damp(5, dt);
      this.camFocus.y += (target.y - this.camFocus.y) * damp(5, dt);
    }
    if (this.zoomPunch > 0.0005) this.zoomPunch *= Math.exp(-dt * 7); else this.zoomPunch = 0;
    const z = this.baseZoom * (1 + this.zoomPunch);
    if (this.cam.zoom !== z) { this.cam.setZoom(z); this.overlayCam.setZoom(z); }
    this.cam.centerOn(this.camFocus.x, this.camFocus.y);
    this.overlayCam.centerOn(this.camFocus.x, this.camFocus.y);
  }

  /** Smooth pan driven by tween (scripts). */
  panTo(x: number, y: number, ms: number): Promise<void> {
    this.camMode = { kind: 'fixed', x: this.camFocus.x, y: this.camFocus.y };
    const mode = this.camMode;
    return new Promise(resolve => {
      this.tweens.add({ targets: mode, x, y, duration: ms, ease: 'Sine.easeInOut', onUpdate: () => { this.camFocus.x = mode.x; this.camFocus.y = mode.y; }, onComplete: () => resolve() });
    });
  }

  zoomTo(z: number, ms: number): Promise<void> {
    return new Promise(resolve => {
      const o = { z: this.baseZoom };
      this.tweens.add({ targets: o, z, duration: ms, ease: 'Sine.easeInOut', onUpdate: () => { this.baseZoom = o.z; }, onComplete: () => { this.applyBounds(); resolve(); } });
    });
  }

  punch(strength = 0.06): void { if (!settings.reducedMotion) this.zoomPunch = Math.max(this.zoomPunch, strength); }

  shake(ms = 250, intensity = 0.006): void {
    const k = settings.reducedMotion ? 0.25 : 1;
    if (k * intensity < 0.0015) return;
    this.cam.shake(ms, intensity * k);
    this.overlayCam.shake(ms, intensity * k);
  }

  // ---- objective ----
  resolveTarget(target: At | string | null): Vec | null {
    if (!target) return null;
    if (typeof target === 'string') {
      const a = this.actors.get(target);
      if (a) return { x: a.x, y: a.headY };
      const it = this.interactives.find(i => i.id === target && !i.removed);
      if (it) return it.top();
      const p = this.props.get(target);
      if (p) return p.top;
      const e = this.exits.find(x => x.def.id === target);
      if (e) return { x: e.rect.x + e.rect.w / 2, y: e.rect.y + e.rect.h / 2 };
      const t = this.triggers.find(x => x.def.id === target);
      if (t) return { x: t.rect.x + t.rect.w / 2, y: t.rect.y + t.rect.h / 2 };
      return null;
    }
    return toPx(target);
  }

  private updateObjective(): void {
    const target = this.objective ? this.resolveTarget(this.objective.target) : null;
    if (!target || this.transitioning || this.playerLocked) {
      this.objMarker.setVisible(false);
      if (this.pointerShown) { this.pointerShown = false; try { G.ui.objectivePointer(null); } catch { /* */ } }
      return;
    }
    const s = this.toScreen(target.x, target.y);
    // Keep the in-world marker clear of the HUD (objective top-left, buttons top-right); otherwise use the edge pointer.
    const inside = s.x > 12 && s.x < GAME_W - 12 && s.y > 12 && s.y < GAME_H - 12
      && !(s.y < 70 && s.x < 170) && !(s.y < 34 && s.x > GAME_W - 130);
    if (inside) {
      const near = Math.hypot(target.x - this.player.x, target.y - this.player.y) < 20 * wk();
      this.objMarker.setVisible(!near).setPosition(target.x, target.y - 4 + Math.sin(this.timeSec * 3) * 1.5).setAlpha(0.9);
      if (this.pointerShown) { this.pointerShown = false; try { G.ui.objectivePointer(null); } catch { /* */ } }
    } else {
      this.objMarker.setVisible(false);
      this.pointerShown = true;
      try { G.ui.objectivePointer({ x: s.x, y: s.y }); } catch { /* */ }
    }
  }

  // ---- fx ----
  puff(x: number, y: number, kind: 'dust' | 'splash' | 'grass', strength = 1): void {
    if (kind === 'dust') {
      for (let i = 0; i < 2; i++) this.spawnPuff('w-dust', x + (Math.random() - 0.5) * 4, y - 1, (Math.random() - 0.5) * 14, -6 - Math.random() * 6, 0.35 * strength, 0.9 * strength + 0.3, 0.55, 0.45, 0, 0, false);
    } else if (kind === 'grass') {
      for (let i = 0; i < 2; i++) this.spawnPuff('w-grassbit', x + (Math.random() - 0.5) * 4, y - 1, (Math.random() - 0.5) * 30, -20 - Math.random() * 18, 1, 1, 0.9, 0.4, 120, 6, false);
    } else {
      this.spawnPuff('w-splash', x, y, 0, 0, 0.4, 1.3, 0.8, 0.4, 0, 0, false);
      for (let i = 0; i < 3; i++) this.spawnPuff('w-droplet', x, y - 2, (Math.random() - 0.5) * 30, -30 - Math.random() * 20, 1, 0.8, 0.9, 0.45, 160, 0, false);
    }
  }

  burst(x: number, y: number, kind: 'dust' | 'sparkle' | 'urmacht' | 'leaves' | 'splash' | 'smoke', count = 8): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = 10 + Math.random() * 25;
      switch (kind) {
        case 'sparkle': this.spawnPuff('w-sparkle', x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 8, Math.cos(a) * 12, -15 - Math.random() * 15, 0.3, 0.9, 1, 0.6, 0, 2, true, Phaser.BlendModes.ADD); break;
        case 'urmacht': this.spawnPuff('w-mote', x + (Math.random() - 0.5) * 8, y - Math.random() * 4, (Math.random() - 0.5) * 8, -12 - Math.random() * 16, 1, 0.3, 0.9, 1.1, 0, 0, true, Phaser.BlendModes.ADD, 0x49e0c8); break;
        case 'leaves': this.spawnPuff(`w-leaf-${i % 3}`, x, y - 8, Math.cos(a) * sp, -20 - Math.random() * 20, 1, 1, 1, 1.1, 40, 6, false); break;
        case 'smoke': this.spawnPuff('w-dust', x, y, (Math.random() - 0.5) * 8, -12 - Math.random() * 8, 0.6, 2.2, 0.5, 1.6, 0, 0, false, Phaser.BlendModes.NORMAL, 0x8a8a90); break;
        case 'splash': this.puff(x, y, 'splash'); break;
        default: this.spawnPuff('w-dust', x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.5 - 5, 0.5, 1.4, 0.7, 0.55, 0, 0, false);
      }
    }
  }

  private spawnPuff(tex: string, x: number, y: number, vx: number, vy: number, s0: number, s1: number, a0: number, life: number, gravity: number, spin: number, overlay: boolean, blend = Phaser.BlendModes.NORMAL, tint?: number): void {
    let p = this.puffs.find(q => !q.active && q.img.texture.key === tex && (q.img.cameraFilter & this.cam.id ? overlay : !overlay));
    if (!p) {
      if (this.puffs.length > 160) return;
      const img = this.add.image(x, y, tex);
      if (overlay) this.addOverlay(img); else this.addWorld(img);
      p = { img, t: 0, life, vx, vy, s0, s1, a0, active: true, gravity, spin };
      this.puffs.push(p);
    }
    Object.assign(p, { t: 0, life, vx, vy, s0, s1, a0, active: true, gravity, spin });
    p.img.setPosition(x, y).setVisible(true).setScale(s0).setAlpha(a0).setBlendMode(blend).setRotation(0).setDepth(overlay ? 4700 : y + 1);
    if (tint !== undefined) p.img.setTint(tint); else p.img.clearTint();
  }

  private updatePuffs(dt: number): void {
    for (const p of this.puffs) {
      if (!p.active) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { p.active = false; p.img.setVisible(false); continue; }
      p.vy += p.gravity * dt;
      p.vx *= 1 - dt * 2;
      p.img.x += p.vx * dt; p.img.y += p.vy * dt;
      p.img.setScale(p.s0 + (p.s1 - p.s0) * k).setAlpha(p.a0 * (1 - k * k));
      if (p.spin) p.img.rotation += p.spin * dt;
    }
  }

  private updateSparkles(dt: number): void {
    for (const s of this.sparkles) {
      s.t += dt;
      if (!s.it.enabled()) { s.img.setAlpha(0); continue; }
      const top = s.it.top();
      const cyc = (s.t % 2.2) / 2.2;
      const a = cyc < 0.25 ? Math.sin((cyc / 0.25) * Math.PI) : 0;
      s.img.setPosition(top.x + 3, top.y + 3).setAlpha(a * 0.95).setScale(0.6 + a * 0.5).setRotation(cyc * 2);
    }
  }
}

/** Loaded painted background (texture key + size in px). */
export interface BgInfo { key: string; w: number; h: number }

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), ms))]);
}

export function sfx(name: Parameters<typeof G.audio.sfx>[0], volume = 1): void {
  try { G.audio.sfx(name, { volume }); } catch { /* audio optional */ }
}


/** Smoothstep on 0..1 (clamped). */
function smooth(t: number): number { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); }

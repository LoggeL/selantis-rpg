import { presentTacticalBark } from './barkVoice';
import Phaser from 'phaser';
import type { CharAnim } from '../art/api';
import type { SfxName } from '../audio/api';
import { G } from '../core/G';
import { inputLock } from '../core/input';
import { settings } from '../core/settings';
import { GAME_H, GAME_W, canvasRect } from '../core/viewport';
import type { BattleActor, BattleResult, HintOptions, TacticsStartData } from './api';
import { BattleController, type Presenter } from './controller';
import { directionTo, key, TERRAIN } from './rules/grid';
import { pathTo } from './rules/movement';
import { WEAPONS, skillAvailable } from './rules/progression';
import { actionList } from './rules/battle';
import { surviveProgress } from './rules/objectives';
import type { BattleEvent, Facing, Phase, Point, Tile, Unit } from './rules/types';
import type { UiApiExt } from '../ui';
import { BattleUi, type AbilitySlot } from './ui/battleUi';
import { BACKDROP_TINT, buildBackdrop, type Backdrop } from './view/backdrop';
import { Fx } from './view/fx';
import { loadTacticsArt } from './view/assets';
import { BASE, IsoView, LEVEL, TH, TW, inDiamond, topEdgeY } from './view/iso';
import { isoProp, isTacticsPropId, sharedProp, type IsoProp } from './view/props';
import { buildTerrainAtlas, surfaceOf, WATER_DROP, WATER_FRAMES, type Surface, type TerrainAtlas } from './view/terrain';
import { ensureTacticsTextures } from './view/textures';
import { characterIdsOf, UnitView } from './view/units';
import { playMagicBurst } from './view/magicBurst';

type Mode = 'none' | 'move' | 'target' | 'facing';
interface PropView { img: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image; x: number; y: number; info: IsoProp; glow?: Phaser.GameObjects.Image; baseDepth: number; rules: boolean }

const PAINT: Record<string, Surface> = { g: 'grass', y: 'drygrass', f: 'forest', d: 'dirt', s: 'stone', a: 'sand', m: 'mud' };

const STEP_SFX: Partial<Record<string, SfxName>> = { grass: 'step-grass', bush: 'step-grass', dirt: 'step-dirt', mud: 'step-water', water: 'step-water', stone: 'step-stone', sand: 'step-dirt', fire: 'step-dirt' };
const STATUS_TEXT: Record<string, string> = { guarded: 'Schutzwall', stunned: 'Betäubt', taunt: 'Lenkt ab', evasive: 'Ausweichen', bound: 'Gefesselt', burning: 'Brennt' };

/**
 * Isometric tactical battle scene (FFTA style): iso blocks with heights, character sprites,
 * full mouse/keyboard/touch control, juicy animations and a DOM battle UI.
 */
export default class TacticsScene extends Phaser.Scene implements Presenter {
  private startData!: TacticsStartData;
  private ctrl!: BattleController;
  private iso!: IsoView;
  private ui!: BattleUi;
  private fx!: Fx;
  private atlas!: TerrainAtlas;
  private tileImgs = new Map<string, Phaser.GameObjects.Image>();
  private waterTiles: Phaser.GameObjects.Image[] = [];
  private props: PropView[] = [];
  private views = new Map<string, UnitView>();
  private overlays = new Map<string, Phaser.GameObjects.Image[]>();
  private cursor!: Phaser.GameObjects.Image;
  private pointerArrow!: Phaser.GameObjects.Image;
  private hintMarker!: Phaser.GameObjects.Image;
  /** Marks the affected unit the forecast currently details. */
  private focusMarker!: Phaser.GameObjects.Image;
  private focusUnit: string | null = null;
  /** Preview target (ability + cell) the focus index belongs to; a new target starts at its first unit. */
  private focusKey = '';
  /** Input state of the previous frame: the active unit is selected again whenever input opens up. */
  private inputWas = false;
  private tint = 0xffffff;
  private pickOrder: Tile[] = [];
  /** `focus`: index of the affected unit the forecast shows in detail (pager / Tab while a target is pinned). */
  private sel: { unit: string | null; mode: Mode; ability: string | null; actOpen: boolean; pending: Point | null; inspect: string | null; focus: number } =
    { unit: null, mode: 'none', ability: null, actOpen: false, pending: null, inspect: null, focus: 0 };
  private hover: Point | null = null;
  private hoverAbility: string | null = null;
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean; touch: boolean } | null = null;
  private animating = 0;
  private beamHandle: { stop: () => Promise<void> } | null = null;
  private lastAct: Extract<BattleEvent, { type: 'act' }> | null = null;
  private hintTarget: { unit?: string; tile?: Point } | null = null;
  private waterFrame = 0;
  private endFacing: Facing | null = null;
  private beforeFacing: { mode: Mode; actOpen: boolean; ability: string | null; pending: Point | null } | null = null;
  private keyHandler?: (e: KeyboardEvent) => void;
  private finished = false;
  private tableauActive = false;

  constructor() { super('Tactics'); }

  init(data: TacticsStartData): void {
    this.startData = data;
    this.tileImgs = new Map(); this.waterTiles = []; this.props = []; this.views = new Map(); this.overlays = new Map();
    this.sel = { unit: null, mode: 'none', ability: null, actOpen: false, pending: null, inspect: null, focus: 0 };
    this.focusKey = ''; this.focusUnit = null; this.inputWas = false;
    this.hover = null; this.drag = null; this.animating = 0; this.beamHandle = null; this.lastAct = null; this.hintTarget = null; this.finished = false;
    this.tableauActive = false;
    this.hoverAbility = null; this.endFacing = null; this.beforeFacing = null;
  }

  private ready = false;

  create(): void {
    const def = this.startData.battle;
    this.ready = false;
    ensureTacticsTextures(this);
    G.ui.setHud('battle');
    G.ui.objective(null);
    this.cameras.main.setAlpha(0);
    const backdrop: Backdrop = def.backdrop ?? 'dusk';
    // Painted art (terrain textures, iso props, sky) and the generated character sheets load first.
    const props = [...new Set((def.map.props ?? []).map(p => p.prop).filter(id => !isTacticsPropId(id)))];
    const characters = characterIdsOf([...def.units, ...(def.waves ?? []).flatMap(w => w.units)]);
    const loads = [
      loadTacticsArt(this, backdrop),
      Promise.resolve().then(() => G.art.preload(this, { characters, props })).catch(err => console.warn('[tactics] art preload failed', err)),
    ];
    const token = (this.bootToken = {});
    void Promise.all(loads).then(() => {
      if (this.bootToken !== token || !this.sys.isActive()) return;
      this.cameras.main.setAlpha(1);
      this.boot(backdrop);
    });
  }
  private bootToken: object = {};

  private boot(backdrop: Backdrop): void {
    const def = this.startData.battle;
    this.fx = new Fx(this);
    this.tint = BACKDROP_TINT[backdrop];
    buildBackdrop(this, backdrop);

    this.ctrl = new BattleController(def, this, G.ui, r => this.onFinish(r), this.startData.retries ?? 0, {
      get: id => G.state.character(id), set: (id, value) => G.state.setCharacter(id, value),
    });
    const g = this.ctrl.battle.grid;
    this.iso = new IsoView(g.cols, g.rows);
    this.iso.rot = (def.rotation ?? 0) & 3;

    this.cursor = this.add.image(0, 0, 'tac-cursor').setOrigin(0, 0).setVisible(false);
    this.pointerArrow = this.add.image(0, 0, 'tac-pointer').setOrigin(0.5, 1).setDepth(1e6).setVisible(false);
    this.hintMarker = this.add.image(0, 0, 'tac-pointer').setOrigin(0.5, 1).setDepth(1e6).setTint(0xffe9a8).setVisible(false).setScale(1.2);
    this.focusMarker = this.add.image(0, 0, 'tac-pointer').setOrigin(0.5, 1).setDepth(1e6).setTint(0xff9a7a).setVisible(false).setScale(1.1);

    this.buildField();
    for (const u of this.ctrl.battle.units) this.addUnitView(u);
    this.showGoals();
    this.centerCamera(true);

    this.ui = new BattleUi({
      endTurn: () => this.requestEndTurn(),
      undo: () => this.undo(),
      wait: () => this.waitUnit(),
      moveMode: () => this.toggleMoveMode(),
      actMenu: () => this.toggleActMenu(),
      ability: id => this.chooseAbility(id),
      rotate: d => this.rotate(d),
      selectUnit: id => this.clickUnitFromUi(id),
      hoverAbility: id => { this.hoverAbility = id; this.refreshOverlays(); },
      equip: weapon => {
        const id = this.sel.unit;
        if (!id || !this.ctrl.inputEnabled()) return;
        void this.ctrl.perform(() => this.ctrl.battle.equip(id, weapon)).then(() => { if (!this.ctrl.isEnded) this.select(id, true); });
      },
      back: () => { this.back(); },
      confirmTarget: () => this.confirmTarget(),
      face: facing => this.chooseFacing(facing),
      confirmFacing: () => { void this.confirmFacing(); },
      focusTarget: dir => this.cycleFocus(dir),
    });
    this.ui.mount(document.getElementById('ui')!);
    this.ui.setObjective(this.ctrl.objectiveText, this.ctrl.objectiveDetail, surviveProgress(this.ctrl.battle, def.objective.win));
    this.ui.setEndTurn(false, false);

    this.setupInput();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeViewport, this);
    if (def.music !== null) G.audio.music(def.music ?? 'battle', { fadeMs: 1200 });
    if (def.ambience) G.audio.ambience(def.ambience);
    this.time.addEvent({ delay: 180, loop: true, callback: () => this.tickWater() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.refresh();
    this.ready = true;
    void this.ctrl.run();
    (window as unknown as Record<string, unknown>).__tactics = this; // e2e / debugging
  }

  private cleanup(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeViewport, this);
    this.bootToken = {};
    this.ready = false;
    this.ui?.destroy();
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    (G.ui as UiApiExt).setEscapeHandler?.(null);
    this.input.removeAllListeners();
  }

  // =================================================================== field
  private buildField(): void {
    for (const img of this.tileImgs.values()) img.destroy();
    for (const p of this.props) { p.img.destroy(); p.glow?.destroy(); }
    this.tileImgs.clear(); this.waterTiles = []; this.props = [];
    const b = this.ctrl.battle, g = b.grid, def = this.startData.battle;
    this.atlas = buildTerrainAtlas(this, def.id, g, this.iso, this.surfaceResolver());
    for (const t of g.all()) {
      if (!surfaceOf(t.terrain)) continue;
      const top = this.iso.top(t.x, t.y, t.h);
      const img = this.add.image(Math.round(top.x - TW / 2), Math.round(top.y), this.atlas.key, this.atlas.frame(t.x, t.y)).setOrigin(0, 0);
      img.setDepth(this.iso.depthKey(t.x, t.y) * 100).setTint(this.tint);
      img.setData('tile', t);
      this.tileImgs.set(key(t.x, t.y), img);
      if (t.terrain === 'water') this.waterTiles.push(img);
      // Rules props from terrain.
      const variant = (t.x * 7 + t.y * 13) % 5;
      const trees = def.map.trees ?? 'mixed';
      const treeId = trees === 'oak' ? 'tree-oak' : trees === 'pine' ? 'tree-pine' : trees === 'dead' ? 'tree-dead' : variant % 2 ? 'tree-oak' : 'tree-pine';
      const replaced = (def.map.props ?? []).some(p => p.x === t.x && p.y === t.y);
      const id = replaced ? null : t.terrain === 'bush' ? 'bush' : t.terrain === 'rock' ? 'rock' : t.terrain === 'tree' ? treeId : t.terrain === 'wall' ? 'ruin' : t.terrain === 'fire' ? 'fire' : null;
      if (id) this.addProp(id, t.x, t.y, variant, 0, 0, true);
    }
    for (const p of def.map.props ?? []) this.addProp(p.prop, p.x, p.y, p.variant ?? 0, p.dx ?? 0, p.dy ?? 0, false);
    // Painter-order list for picking (front first).
    this.pickOrder = g.all().filter(t => surfaceOf(t.terrain)).slice().sort((a, c) => this.iso.depthKey(c.x, c.y) - this.iso.depthKey(a.x, a.y) || c.h - a.h);
  }

  /** Visual surface per tile: rules terrain, the map's ground style and its optional paint layer. */
  private surfaceResolver(): (x: number, y: number) => Surface | null {
    const def = this.startData.battle.map;
    const g = this.ctrl.battle.grid;
    const ground: Surface = def.ground === 'dry' ? 'drygrass' : def.ground === 'forest' ? 'forest' : 'grass';
    const paint = (def.paint ?? []).map(row => row.replace(/\s+/g, ''));
    return (x, y) => {
      const t = g.tile(x, y);
      if (!t) return null;
      const base = surfaceOf(t.terrain);
      if (!base) return null;
      const over = PAINT[paint[y]?.[x] ?? ''];
      if (over && base !== 'water') return over;
      if (base === 'grass') return t.terrain === 'tree' && ground === 'grass' && def.trees === 'pine' ? 'forest' : ground;
      return base;
    };
  }

  private addProp(id: string, x: number, y: number, variant: number, dx: number, dy: number, rules: boolean): void {
    const t = this.ctrl.battle.grid.tile(x, y);
    if (!t) return;
    const info = (!isTacticsPropId(id) ? sharedProp(this, id, variant) : null) ?? isoProp(this, id, variant);
    const c = this.iso.center(x, y, t.h);
    const depthBase = this.iso.depthKey(x, y) * 100;
    const img = info.frames ? this.add.sprite(0, 0, info.key, info.frames[0]) : info.anim ? this.add.sprite(0, 0, info.key) : this.add.image(0, 0, info.key, isoPropFrame(info));
    const px = Math.round(c.x + dx), py = Math.round(c.y + 3 + dy);
    img.setOrigin(info.ox / info.w, info.oy / info.h).setPosition(px, py).setScale(info.scale ?? 1);
    const flip = rules && (x + y) % 2 === 1 && id !== 'ruin' && !id.startsWith('banner');
    img.setFlipX(flip);
    const depth = depthBase + (info.overUnit ? 60 : 40);
    img.setDepth(depth).setTint(this.tint);
    if (info.frames && img instanceof Phaser.GameObjects.Sprite) {
      const animKey = `${info.key}-anim`;
      if (!this.anims.exists(animKey)) this.anims.create({ key: animKey, frames: info.frames.map(f => ({ key: info.key, frame: f })), frameRate: info.fps ?? 6, repeat: -1 });
      img.play({ key: animKey, startFrame: (x + y) % info.frames.length });
    } else if (info.anim && img instanceof Phaser.GameObjects.Sprite && this.anims.exists(info.anim)) img.play(info.anim);
    let glow: Phaser.GameObjects.Image | undefined;
    if (info.light) glow = this.fx.glow(px, py - 8, info.light.color, info.light.radius, depth + 1);
    if (info.key.startsWith('tac-iso-') && !info.flame) {
      // Painted props carry no ground shadow; a soft contact shadow seats them on the tile.
      const w = Math.min(info.tall ? 40 : info.w * 0.9, 44);
      const sh = this.add.image(px, py - 1, 'tac-shadow').setScale(w / 26, Math.max(0.7, w / 40)).setDepth(depthBase + 3).setAlpha(0.8);
      this.props.push({ img: sh, x, y, info: { key: 'tac-shadow', w: 26, h: 12, ox: 13, oy: 6 }, baseDepth: depthBase + 3, rules: false });
    }
    this.props.push({ img, x, y, info, glow, baseDepth: depth, rules });
    if (info.flame) {
      // Painted campfire: code-drawn flames on top (effects stay procedural, DESIGN §2).
      const fl = isoProp(this, 'flames', 0);
      const f = this.add.sprite(px, py - 3, fl.key, fl.frames![0]).setOrigin(fl.ox / fl.w, fl.oy / fl.h).setDepth(depth + 0.5);
      const animKey = `${fl.key}-anim`;
      if (!this.anims.exists(animKey)) this.anims.create({ key: animKey, frames: fl.frames!.map(fr => ({ key: fl.key, frame: fr })), frameRate: fl.fps ?? 8, repeat: -1 });
      f.play(animKey).setBlendMode(Phaser.BlendModes.NORMAL);
      this.props.push({ img: f, x, y, info: { ...fl, tall: false }, baseDepth: depth + 0.5, rules: false });
    }
  }

  private tickWater(): void {
    this.waterFrame = (this.waterFrame + 1) % WATER_FRAMES;
    for (const img of this.waterTiles) {
      const t = img.getData('tile') as Tile;
      img.setFrame(this.atlas.frame(t.x, t.y, this.waterFrame));
    }
  }

  private resizeViewport(): void {
    if (!this.ready) return;
    const cam = this.cameras.main;
    cam.centerOn(cam.midPoint.x, cam.midPoint.y);
    cam.preRender();
    this.refreshPanels(); this.updateCursor();
  }

  private centerCamera(instant = false): void {
    const b = this.ctrl.battle.grid;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of b.all()) {
      const top = this.iso.top(t.x, t.y, t.h);
      minX = Math.min(minX, top.x - TW / 2); maxX = Math.max(maxX, top.x + TW / 2);
      minY = Math.min(minY, top.y - 60); maxY = Math.max(maxY, top.y + TH + t.h * LEVEL + BASE);
    }
    const cam = this.cameras.main;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2 + 14;
    this.bounds = { minX: minX - 80, maxX: maxX + 80, minY: minY - 80, maxY: maxY + 80 };
    if (instant) cam.centerOn(Math.round(cx), Math.round(cy));
    else cam.pan(cx, cy, 300, 'Sine.easeInOut');
  }
  private bounds = { minX: -400, maxX: 400, minY: -300, maxY: 300 };

  private addUnitView(u: Unit): UnitView {
    const def = this.ctrl.unitDefs.get(u.id) ?? { ...u, abilities: u.abilities } as never;
    const v = new UnitView(this, this.iso, u, def, this.startData.battle.id, this.ctrl.battle.grid.height(u.x, u.y));
    v.setLight(this.tint);
    this.views.set(u.id, v);
    if (u.down) v.setDown(u.down);
    v.idle();
    return v;
  }

  private rotate(dir: 1 | -1): void {
    if (this.animating > 0 || this.finished || this.tableauActive) return;
    G.audio.sfx('whoosh', { volume: 0.4 });
    const cam = this.cameras.main;
    const center = this.screenToGridCenter();
    cam.fadeOut(90, 7, 8, 12);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.iso.rot = (this.iso.rot + dir + 4) & 3;
      this.buildField();
      for (const v of this.views.values()) { v.reorient(); }
      this.showGoals();
      this.centerCamera(true);
      const focusUnit = this.sel.unit ? this.views.get(this.sel.unit) : undefined;
      if (focusUnit) cam.centerOn(focusUnit.chest.x, focusUnit.chest.y);
      else if (center && this.views.size) { const c = this.iso.center(center.x, center.y, this.ctrl.battle.grid.height(center.x, center.y)); cam.centerOn((cam.midPoint.x + c.x) / 2, (cam.midPoint.y + c.y) / 2); }
      this.refreshOverlays();
      this.updateCursor();
      this.refreshPanels();
      cam.fadeIn(140, 7, 8, 12);
    });
  }

  private screenToGridCenter(): Point | null {
    const cam = this.cameras.main;
    return this.pick(cam.midPoint.x, cam.midPoint.y);
  }

  // =================================================================== overlays
  private setOverlay(layer: string, cells: Point[], texture: string, depthAdd = 2): void {
    const list = this.overlays.get(layer) ?? [];
    let i = 0;
    const g = this.ctrl.battle.grid;
    for (const c of cells) {
      const t = g.tile(c.x, c.y);
      if (!t || !surfaceOf(t.terrain)) continue;
      let img = list[i];
      if (!img) { img = this.add.image(0, 0, texture).setOrigin(0, 0); list.push(img); }
      const top = this.iso.top(c.x, c.y, t.h);
      img.setTexture(texture).setVisible(true).setPosition(Math.round(top.x - TW / 2), Math.round(top.y + (t.terrain === 'water' ? WATER_DROP : 0)));
      img.setDepth(this.iso.depthKey(c.x, c.y) * 100 + depthAdd);
      i++;
    }
    for (; i < list.length; i++) list[i].setVisible(false);
    this.overlays.set(layer, list);
  }
  private clearOverlay(layer: string): void { for (const img of this.overlays.get(layer) ?? []) img.setVisible(false); }

  private showGoals(): void {
    const def = this.startData.battle;
    const goals: Point[] = def.goalTiles ?? def.objective.win.flatMap(w => (w.type === 'reach' || w.type === 'escort' ? w.tiles : []));
    this.setOverlay('goal', goals, 'tac-ov-goal', 1);
    for (const p of this.props.filter(p => p.info.key.startsWith('tac-flag'))) p.img.destroy();
    this.props = this.props.filter(p => !p.info.key.startsWith('tac-flag'));
    goals.forEach((gp, i) => {
      if (i % 2) return;
      const t = this.ctrl.battle.grid.tile(gp.x, gp.y);
      if (!t) return;
      const c = this.iso.center(gp.x, gp.y, t.h);
      const img = this.add.image(Math.round(c.x + 9), Math.round(c.y + 3), 'tac-flag').setOrigin(0.2, 0.95).setDepth(this.iso.depthKey(gp.x, gp.y) * 100 + 45);
      this.props.push({ img, x: gp.x, y: gp.y, info: { key: 'tac-flag', w: 16, h: 26, ox: 3, oy: 25 }, baseDepth: img.depth, rules: false });
    });
  }

  /** Recomputes range/aoe/path overlays from the selection state. */
  private refreshOverlays(): void {
    const b = this.ctrl.battle;
    const s = this.sel;
    this.clearOverlay('range'); this.clearOverlay('aoe'); this.clearOverlay('path'); this.clearOverlay('danger');
    this.showPathSteps([]);
    if (s.mode === 'facing') return;
    const ability = s.mode === 'target' ? s.ability : this.hoverAbility;
    if (s.unit && ability && this.ctrl.inputEnabled()) {
      const a = b.ability(ability);
      const cells = b.targetCells(s.unit, ability);
      const tex = a.kind === 'magic' || a.vfx === 'ward' ? 'tac-ov-magic' : a.target === 'ally' ? 'tac-ov-ally' : 'tac-ov-act';
      this.setOverlay('range', cells, s.mode === 'target' ? tex : 'tac-ov-move-dim');
      if (s.mode === 'target') {
        // Every tile the pinned (or hovered) target would affect lights up.
        const tgt = s.pending ?? this.actionTarget(this.hover);
        const inRange = tgt && cells.some(c => c.x === tgt.x && c.y === tgt.y);
        if (tgt && inRange) this.setOverlay('aoe', b.affectedCells(s.unit, ability, tgt), b.validTarget(s.unit, ability, tgt) ? 'tac-ov-aoe' : 'tac-ov-hover', 3);
      }
    } else if (s.unit && s.mode === 'move' && b.canMove(s.unit)) {
      const reach = b.reach(s.unit);
      const u = b.unit(s.unit);
      this.setOverlay('range', [...reach.values()].filter(n => !(n.x === u.x && n.y === u.y)), 'tac-ov-move');
      const dest = s.pending ?? this.hover;
      if (dest && reach.has(key(dest.x, dest.y)) && !(dest.x === u.x && dest.y === u.y)) {
        const path = pathTo(reach, dest);
        this.setOverlay('path', path, 'tac-ov-hover', 3);
        this.showPathSteps(path);
      } else this.showPathSteps([]);
    } else this.showPathSteps([]);
    // Danger zone of an inspected/hovered enemy.
    const insp = s.inspect ?? (s.mode !== 'target' ? this.unitAtPoint(this.hover)?.id : undefined);
    if (insp && (s.mode !== 'move' || !s.unit || insp === s.inspect)) {
      const iu = b.findUnit(insp);
      if (iu && !iu.down && iu.team === 'enemy') this.setOverlay('danger', this.dangerCells(iu), 'tac-ov-danger', 1);
    }
  }

  private stepImgs: Phaser.GameObjects.Image[] = [];
  private showPathSteps(path: Point[]): void {
    const g = this.ctrl.battle.grid;
    this.stepImgs.forEach((im, i) => im.setVisible(i < path.length));
    path.forEach((p, i) => {
      let im = this.stepImgs[i];
      if (!im) { im = this.add.image(0, 0, 'tac-step'); this.stepImgs.push(im); }
      const c = this.iso.center(p.x, p.y, g.height(p.x, p.y));
      const last = i === path.length - 1;
      im.setVisible(true).setPosition(Math.round(c.x), Math.round(c.y + 1)).setDepth(this.iso.depthKey(p.x, p.y) * 100 + 4).setScale(last ? 1.3 : 0.8).setAlpha(last ? 1 : 0.9);
    });
  }

  private dangerCache = new Map<string, Point[]>();
  private dangerCells(u: Unit): Point[] {
    const b = this.ctrl.battle;
    const sig = `${u.id}:${u.x},${u.y}:${b.units.map(o => `${o.x},${o.y},${o.down}`).join(';')}`;
    const hit = this.dangerCache.get(sig);
    if (hit) return hit;
    const out = new Map<string, Point>();
    const reach = [...b.reach(u.id).values()];
    const abilities = actionList(u).map(a => b.ability(a)).filter(a => a.kind !== 'support' && a.kind !== 'interact');
    for (const r of reach) {
      for (const a of abilities) for (const c of b.targetCells(u.id, a.id, r)) out.set(key(c.x, c.y), c);
    }
    const list = [...out.values()];
    this.dangerCache.clear();
    this.dangerCache.set(sig, list);
    return list;
  }

  // =================================================================== picking + input
  private pick(wx: number, wy: number): Point | null {
    for (const t of this.pickOrder) {
      const top = this.iso.top(t.x, t.y, t.h);
      const lx = Math.floor(wx - (top.x - TW / 2)), ly = Math.floor(wy - top.y);
      if (lx < 0 || lx >= TW) continue;
      if (inDiamond(lx, ly)) return { x: t.x, y: t.y };
      const e = topEdgeY(lx);
      if (ly > e && ly <= e + t.h * LEVEL + BASE) return { x: t.x, y: t.y };
    }
    return null;
  }

  private pickUnit(wx: number, wy: number): Unit | null {
    let best: { u: Unit; d: number } | null = null;
    for (const v of this.views.values()) {
      const u = v.unit;
      if (u.down === 'dead' || !v.sprite.visible) continue;
      // Hit box around the visible figure (sheet frames are larger than the figure).
      const f = v.feet;
      if (Math.abs(wx - f.x) > 11 || wy > f.y + 2 || wy < f.y - v.frameH) continue;
      const d = v.sprite.depth;
      if (!best || d > best.d) best = { u, d };
    }
    return best?.u ?? null;
  }

  private unitAtPoint(p: Point | null): Unit | undefined { return p ? this.ctrl.battle.unitAt(p.x, p.y) : undefined; }

  private setupInput(): void {
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.tableauActive) return;
      if (this.drag && p.isDown) {
        const dx = p.x - this.drag.x, dy = p.y - this.drag.y;
        if (!this.drag.moved && Math.hypot(dx, dy) > (this.drag.touch ? 8 : 5)) this.drag.moved = true;
        if (this.drag.moved) {
          const cam = this.cameras.main;
          cam.setScroll(
            Phaser.Math.Clamp(this.drag.sx - dx / cam.zoom, this.bounds.minX - cam.width / 2, this.bounds.maxX - cam.width / 2),
            Phaser.Math.Clamp(this.drag.sy - dy / cam.zoom, this.bounds.minY - cam.height / 2, this.bounds.maxY - cam.height / 2),
          );
          return;
        }
      }
      if (p.wasTouch) return;
      const wp = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const u = this.pickUnit(wp.x, wp.y);
      const t = u ? { x: u.x, y: u.y } : this.pick(wp.x, wp.y);
      this.setHover(t);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.tableauActive) return;
      if (p.rightButtonDown()) { this.back(); return; }
      const cam = this.cameras.main;
      this.drag = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY, moved: false, touch: p.wasTouch };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.tableauActive) return;
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved || p.rightButtonReleased()) return;
      const wp = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const u = this.pickUnit(wp.x, wp.y);
      const t = u ? { x: u.x, y: u.y } : this.pick(wp.x, wp.y);
      this.setHover(t);
      this.click(t, d.touch);
    });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.tableauActive) return;
      const cam = this.cameras.main;
      const z = dy > 0 ? 1 : 2;
      if (z === cam.zoom) return;
      // Zoom in toward the pointer (half way, so the selection stays in view), out around the centre.
      const wp = p.positionToCamera(cam) as Phaser.Math.Vector2;
      this.tweens.add({ targets: cam, zoom: z, duration: 180, ease: 'Sine.easeOut' });
      if (z > 1) cam.pan((cam.midPoint.x + wp.x) / 2, (cam.midPoint.y + wp.y) / 2, 180, 'Sine.easeOut');
    });
    this.keyHandler = (e: KeyboardEvent) => this.onKey(e);
    window.addEventListener('keydown', this.keyHandler);
    // The UI routes Escape (capture phase) to the menu; in battle it first cancels targeting / the selection.
    (G.ui as UiApiExt).setEscapeHandler?.(() => this.ready && !this.finished && !this.ctrl.isEnded && this.ctrl.inputEnabled() && this.back());
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.scene.isActive()) return;
    const k = e.key;
    if (this.sel.mode !== 'facing' && this.ui.hintOpenWithButton() && (k === 'Enter' || k === ' ' || k === 'e' || k === 'E')) { e.preventDefault(); this.ui.confirmHint(); return; }
    if (this.finished || this.ctrl.isEnded) { if (k === 'Enter' || k === ' ' || k === 'e' || k === 'E') { e.preventDefault(); this.ui.confirmOutcome(); } return; }
    if (this.tableauActive) return;
    if (inputLock.locked || G.ui.busy()) return;
    const dirs: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    if (k === 'q' || k === 'Q') { this.rotate(-1); return; }
    if (k === 'r' || k === 'R') { this.rotate(1); return; }
    if (this.sel.mode === 'facing' && this.ctrl.inputEnabled()) {
      if (dirs[k]) { e.preventDefault(); this.chooseFacing(this.iso.facingForScreen(dirs[k])); return; }
      if (k === 'Enter' || k === 'e' || k === 'E' || k === ' ') { e.preventDefault(); void this.confirmFacing(); return; }
      if (k === 'Backspace') { e.preventDefault(); this.back(); return; }
      // Other action keys cannot replace the final direction choice.
      return;
    }
    if (dirs[k]) {
      e.preventDefault();
      const f = this.iso.facingForScreen(dirs[k]);
      const from = this.hover ?? (this.sel.unit ? this.ctrl.battle.unit(this.sel.unit) : { x: 0, y: 0 });
      const dv = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[f];
      const nx = Phaser.Math.Clamp(from.x + dv[0], 0, this.ctrl.battle.grid.cols - 1), ny = Phaser.Math.Clamp(from.y + dv[1], 0, this.ctrl.battle.grid.rows - 1);
      this.setHover({ x: nx, y: ny }, true);
      return;
    }
    if (!this.ctrl.inputEnabled()) return;
    if (k === 'Enter' || k === 'e' || k === 'E') { e.preventDefault(); if (this.sel.mode === 'target' && this.sel.pending) this.confirmTarget(); else if (this.hover) this.click(this.hover, false); return; }
    if (k === ' ') { e.preventDefault(); this.requestEndTurn(); return; }
    // Tab pages through the affected units of a pinned target, otherwise through the units that may still act.
    if (k === 'Tab') { e.preventDefault(); if (this.sel.mode === 'target' && this.sel.pending) this.cycleFocus(e.shiftKey ? -1 : 1); else this.cycleUnit(e.shiftKey ? -1 : 1); return; }
    if (k === 'Backspace') { e.preventDefault(); if (this.sel.mode === 'target' || this.sel.pending || this.sel.inspect || !this.sel.unit || !this.ctrl.battle.canUndo(this.sel.unit)) this.back(); else this.undo(); return; }
    if (k === 'z' || k === 'Z') { e.preventDefault(); this.undo(); return; }
    if (k === 'f' || k === 'F') { this.waitUnit(); return; }
    if (k === 'm' || k === 'M') { this.toggleMoveMode(); return; }
    if (k === '0' && this.sel.unit) {
      const attack = this.ctrl.battle.unit(this.sel.unit).attack;
      if (attack) this.chooseAbility(attack);
      return;
    }
    if (/^[1-9]$/.test(k) && this.sel.unit) {
      const u = this.ctrl.battle.unit(this.sel.unit);
      const ab = u.abilities[Number(k) - 1];
      if (ab) this.chooseAbility(ab);
    }
  }

  private setHover(t: Point | null, fromKeyboard = false): void {
    const changed = (t?.x ?? -1) !== (this.hover?.x ?? -1) || (t?.y ?? -1) !== (this.hover?.y ?? -1);
    this.hover = t;
    if (changed) {
      if (t && this.ctrl.inputEnabled()) G.audio.sfx('ui-move', { volume: 0.18, key: 'tac-cursor' });
      if (fromKeyboard && t) void this.ensureVisible(t);
    }
    this.updateCursor();
    this.refreshOverlays();
    this.refreshPanels();
  }

  private async ensureVisible(p: Point): Promise<void> {
    const cam = this.cameras.main;
    const c = this.iso.center(p.x, p.y, this.ctrl.battle.grid.height(p.x, p.y));
    const v = cam.worldView;
    if (c.x < v.x + 50 || c.x > v.right - 50 || c.y < v.y + 40 || c.y > v.bottom - 60) cam.pan(c.x, c.y, 220, 'Sine.easeOut');
  }

  private fadeTick = 0;
  private fadeTallProps(): void {
    const t = this.hover;
    const cursorAnchor = this.pointerArrow.visible ? { x: this.pointerArrow.getData('ax') as number, y: (this.pointerArrow.getData('ay') as number) + 4 } : null;
    for (const p of this.props) {
      if (!p.info.tall) continue;
      const bnd = p.img.getBounds();
      const pd = this.iso.depthKey(p.x, p.y);
      let hide = false;
      if (t && cursorAnchor && pd > this.iso.depthKey(t.x, t.y) && Phaser.Geom.Rectangle.Contains(bnd, cursorAnchor.x, cursorAnchor.y)) hide = true;
      if (!hide) for (const v of this.views.values()) {
        if (v.unit.down === 'dead' || pd <= this.iso.depthKey(Math.round(v.gx), Math.round(v.gy))) continue;
        const sb = v.figureRect();
        if (Phaser.Geom.Intersects.RectangleToRectangle(bnd, sb)) {
          const overlap = Phaser.Geom.Rectangle.Intersection(bnd, sb);
          if (overlap.width * overlap.height > sb.width * sb.height * 0.25) { hide = true; break; }
        }
      }
      const target = hide ? 0.42 : 1;
      p.img.setAlpha(p.img.alpha + (target - p.img.alpha) * 0.5);
    }
  }

  private updateCursor(): void {
    const t = this.hover;
    const g = this.ctrl.battle.grid;
    if (!t || !g.tile(t.x, t.y)) { this.cursor.setVisible(false); this.pointerArrow.setVisible(false); this.ui?.tile(null); return; }
    const tile = g.tile(t.x, t.y)!;
    const top = this.iso.top(t.x, t.y, tile.h);
    this.cursor.setVisible(true).setPosition(Math.round(top.x - TW / 2 - 2), Math.round(top.y - 2 + (tile.terrain === 'water' ? WATER_DROP : 0))).setDepth(this.iso.depthKey(t.x, t.y) * 100 + 5);
    const u = this.ctrl.battle.unitAt(t.x, t.y);
    const v = u ? this.views.get(u.id) : undefined;
    const anchor = v ? v.head : { x: top.x, y: top.y + 2 };
    this.pointerArrow.setVisible(true).setData('ax', anchor.x).setData('ay', anchor.y - (v ? 6 : 0));
    const info = TERRAIN[tile.terrain];
    this.ui?.tile({ label: info.label, h: tile.h, note: info.note });
  }

  update(time: number): void {
    if (!this.ready) return;
    const enabled = this.ctrl.inputEnabled();
    if (enabled !== this.inputWas) {
      this.inputWas = enabled;
      // Input opens up (turn start, a hint during a story hook): the active unit is selected with its menu open.
      // Never refresh while input closes: the rules already hold the outcome the animation is about to show.
      if (enabled && !this.sel.unit) this.autoSelect();
      if (enabled && this.animating === 0) this.refresh();
    }
    for (const v of this.views.values()) v.layout();
    const pulse = 0.78 + Math.sin(time / 260) * 0.22;
    for (const img of this.overlays.get('range') ?? []) if (img.visible) img.setAlpha(pulse);
    for (const img of this.overlays.get('goal') ?? []) if (img.visible) img.setAlpha(0.6 + Math.sin(time / 400) * 0.3);
    if (this.pointerArrow.visible) this.pointerArrow.setPosition(this.pointerArrow.getData('ax'), Math.round(this.pointerArrow.getData('ay') - 3 + Math.sin(time / 180) * 2));
    if (this.hintTarget) {
      const ht = this.hintTarget;
      let pos: { x: number; y: number } | null = null;
      if (ht.unit) { const v = this.views.get(ht.unit); if (v) pos = { x: v.head.x, y: v.head.y - 8 }; }
      else if (ht.tile) { const c = this.iso.center(ht.tile.x, ht.tile.y, this.ctrl.battle.grid.height(ht.tile.x, ht.tile.y)); pos = { x: c.x, y: c.y - 6 }; }
      if (pos) this.hintMarker.setVisible(true).setPosition(Math.round(pos.x), Math.round(pos.y - 4 + Math.sin(time / 140) * 3));
    } else this.hintMarker.setVisible(false);
    const fv = this.focusUnit ? this.views.get(this.focusUnit) : undefined;
    const onCursor = fv && this.hover && Math.round(fv.gx) === this.hover.x && Math.round(fv.gy) === this.hover.y;
    if (fv && !onCursor && this.sel.mode === 'target' && enabled) this.focusMarker.setVisible(true).setPosition(Math.round(fv.head.x), Math.round(fv.head.y - 12 + Math.sin(time / 160) * 2));
    else this.focusMarker.setVisible(false);
    // Tall props (trees, banners, ruins) turn see-through when they hide a unit or the cursor.
    if ((this.fadeTick = (this.fadeTick + 1) % 6) === 0) this.fadeTallProps();
    // Bushes become see-through when someone hides in them.
    for (const p of this.props) if (p.info.overUnit) p.img.setAlpha(this.ctrl.battle.unitAt(p.x, p.y) ? 0.72 : 1);
    if (this.sel.unit && this.ctrl.inputEnabled() && (this.sel.mode !== 'none' || this.sel.actOpen)) this.placeMenu();
  }

  // =================================================================== selection logic
  private controllable(u: Unit | undefined): boolean {
    return !!u && u.team === 'player' && !u.down && !this.ctrl.battle.has(u, 'bound') && this.ctrl.battle.isCurrent(u);
  }

  private select(id: string | null, silent = false): void {
    const b = this.ctrl.battle;
    if (this.sel.unit) { const v = this.views.get(this.sel.unit); if (v) v.selected = false; }
    this.hoverAbility = null;
    this.endFacing = null; this.beforeFacing = null;
    this.sel = { unit: id, mode: 'none', ability: null, actOpen: false, pending: null, inspect: null, focus: 0 };
    if (id) {
      const u = b.unit(id);
      const v = this.views.get(id);
      if (v) v.selected = true;
      this.sel.actOpen = !b.canMove(id) && b.canAct(id);
      if (!silent) { G.audio.sfx('ui-confirm', { volume: 0.5 }); this.ctrl.signal({ type: 'select', unit: id }); }
      void this.ensureVisible(u);
      this.bounceUnit(id);
    }
    this.refresh();
  }

  /**
   * Selects the unit whose turn it is (FFTA: its menu opens by itself). Tutorial hints waiting for 'select' receive
   * the same signal as for a click. Returns the selected unit, or null when no player unit may act.
   */
  private autoSelect(): string | null {
    const b = this.ctrl.battle;
    if (this.finished || this.tableauActive || this.ctrl.isEnded || b.phase !== 'player') return null;
    if (this.sel.unit && this.controllable(b.findUnit(this.sel.unit))) return this.sel.unit;
    const first = b.units.find(u => this.controllable(u) && !b.isDone(u.id));
    if (!first) return null;
    this.select(first.id, true);
    this.setHover({ x: first.x, y: first.y });
    this.ctrl.signal({ type: 'select', unit: first.id });
    return first.id;
  }

  /** Speed turns keep the active unit selected: cancelling steps back to its menu instead of deselecting it. */
  private keepsSelection(id: string): boolean {
    const b = this.ctrl.battle;
    return b.turnMode === 'speed' && this.controllable(b.findUnit(id)) && !b.isDone(id);
  }

  private bounceUnit(id: string): void {
    const v = this.views.get(id);
    if (!v || settings.reducedMotion) return;
    this.tweens.add({ targets: v, oy: -3, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }

  private click(t: Point | null, touch: boolean): void {
    if (!this.ctrl.inputEnabled() || inputLock.locked || G.ui.busy() || this.animating > 0) return;
    const b = this.ctrl.battle;
    const s = this.sel;
    if (!t) { if (s.mode === 'target') this.back(); return; }
    const occupant = b.unitAt(t.x, t.y);

    if (s.unit && s.mode === 'facing') {
      const u = b.unit(s.unit);
      if (u.x !== t.x || u.y !== t.y) this.chooseFacing(directionTo(u, t));
      return;
    }

    if (s.unit && s.mode === 'target' && s.ability) {
      const a = b.ability(s.ability);
      const ownOther = occupant && this.controllable(occupant) && occupant.id !== s.unit && !b.isDone(occupant.id);
      if (ownOther && a.target !== 'ally' && a.target !== 'any') { this.select(occupant!.id); return; }
      const target = this.actionTarget(t)!;
      if (b.validTarget(s.unit, s.ability, target)) {
        if (!s.pending || s.pending.x !== target.x || s.pending.y !== target.y) { s.pending = { ...target }; this.focusKey = ''; this.refresh(); return; }
        this.confirmTarget();
        return;
      }
      if (ownOther) { this.select(occupant!.id); return; }
      G.audio.sfx('ui-cancel', { volume: 0.3 });
      return;
    }
    if (occupant && this.controllable(occupant) && !b.isDone(occupant.id)) {
      if (occupant.id === s.unit) { this.ctrl.signal({ type: 'select', unit: occupant.id }); this.refresh(); return; }
      this.select(occupant.id);
      return;
    }
    if (s.unit && s.mode === 'move' && b.canMove(s.unit)) {
      const reach = b.reach(s.unit);
      const u = b.unit(s.unit);
      if (reach.has(key(t.x, t.y)) && !(t.x === u.x && t.y === u.y)) {
        if (touch && (!s.pending || s.pending.x !== t.x || s.pending.y !== t.y)) { s.pending = { ...t }; this.refresh(); return; }
        void this.doMove(s.unit, t);
        return;
      }
      if (!occupant) { G.audio.sfx('ui-cancel', { volume: 0.3 }); return; }
    }
    if (occupant && !this.controllable(occupant)) {
      this.sel.inspect = this.sel.inspect === occupant.id ? null : occupant.id;
      G.audio.sfx('ui-move', { volume: 0.35 });
      this.refresh();
      return;
    }
    if (s.unit && occupant?.id === s.unit) return;
    if (s.inspect) { s.inspect = null; this.refresh(); return; }
    if (s.unit && this.keepsSelection(s.unit)) {
      // An empty tile closes the Aktion list; the active unit stays selected.
      if (s.actOpen) { s.actOpen = false; this.hoverAbility = null; this.refresh(); }
      return;
    }
    if (s.unit && !(s.mode === 'move')) { this.select(null); return; }
    if (s.unit) { this.select(null); }
  }

  private clickUnitFromUi(id: string): void {
    if (this.sel.mode === 'facing') return;
    const u = this.ctrl.battle.findUnit(id);
    if (!u) return;
    if (this.controllable(u) && !this.ctrl.battle.isDone(id) && this.ctrl.inputEnabled()) this.select(id);
    else { this.sel.inspect = id; this.refresh(); }
    void this.focus(id, 250);
    this.setHover({ x: u.x, y: u.y });
  }

  /**
   * Steps back one level (pending action → targeting → Aktion list → inspect → selection; speed turns never drop the
   * active unit). False when there was nothing to undo.
   */
  private back(): boolean {
    const s = this.sel;
    if (s.mode === 'facing' && s.unit) {
      this.views.get(s.unit)?.setFacing(this.ctrl.battle.unit(s.unit).facing);
      s.mode = this.beforeFacing?.mode ?? 'none'; s.actOpen = this.beforeFacing?.actOpen ?? false;
      s.ability = this.beforeFacing?.ability ?? null; s.pending = this.beforeFacing?.pending ?? null;
      this.endFacing = null; this.beforeFacing = null;
      this.refresh(); return true;
    }
    if (s.pending) { s.pending = null; this.refresh(); return true; }
    if (s.mode === 'move') { s.mode = 'none'; this.refresh(); return true; }
    if (s.mode === 'target') {
      G.audio.sfx('ui-cancel', { volume: 0.4 });
      s.mode = 'none';
      s.ability = null;
      s.actOpen = true;
      this.refresh();
      return true;
    }
    if (s.inspect) { s.inspect = null; this.refresh(); return true; }
    if (s.unit && this.keepsSelection(s.unit)) {
      // Back to the turn menu; with nothing left to cancel, Escape falls through to the game menu.
      if (!s.actOpen) return false;
      G.audio.sfx('ui-cancel', { volume: 0.4 });
      s.actOpen = false; this.hoverAbility = null;
      this.refresh(); return true;
    }
    if (s.unit) { G.audio.sfx('ui-cancel', { volume: 0.4 }); this.select(null, true); return true; }
    return false;
  }

  private toggleMoveMode(): void {
    const s = this.sel;
    if (!s.unit || !this.ctrl.inputEnabled()) return;
    if (!this.ctrl.battle.canMove(s.unit)) return;
    if (s.mode === 'facing') return;
    s.mode = 'move';
    this.hoverAbility = null;
    s.ability = null; s.actOpen = false; s.pending = null;
    G.audio.sfx('ui-move', { volume: 0.35 });
    this.refresh();
  }

  private toggleActMenu(): void {
    const s = this.sel;
    if (!s.unit || !this.ctrl.inputEnabled() || !this.ctrl.battle.canAct(s.unit)) return;
    if (s.mode === 'facing') return;
    s.actOpen = !s.actOpen;
    s.mode = 'none'; s.ability = null; s.pending = null; this.hoverAbility = null;
    G.audio.sfx('ui-move', { volume: 0.35 });
    this.refresh();
  }

  private chooseAbility(id: string): void {
    const s = this.sel;
    const b = this.ctrl.battle;
    if (!s.unit || !this.ctrl.inputEnabled() || s.mode === 'facing') return;
    const u = b.unit(s.unit);
    if (!b.canAct(s.unit) || !b.abilityReady(u, id)) { G.audio.sfx('ui-cancel', { volume: 0.3 }); return; }
    if (s.mode === 'target' && s.ability === id) { this.back(); return; }
    const a = b.ability(id);
    s.mode = 'target'; s.ability = id; s.pending = null;
    this.hoverAbility = null;
    G.audio.sfx('ui-confirm', { volume: 0.45 });
    // Self and ring ranges are centred on the caster.
    if (a.shape.type === 'ring' || a.shape.type === 'self') {
      this.hover = { x: u.x, y: u.y }; this.updateCursor();
      if (a.shape.type === 'self') s.pending = { ...this.hover };
    }
    this.refresh();
  }

  /** A ring is centred on its caster, but any affected figure can be clicked to select it. */
  private actionTarget(point: Point | null): Point | null {
    const s = this.sel;
    if (!point || !s.unit || !s.ability) return point;
    const b = this.ctrl.battle, u = b.unit(s.unit), a = b.ability(s.ability);
    if (a.shape.type === 'ring' && b.affectedCells(u.id, a.id, u).some(c => c.x === point.x && c.y === point.y)) return { x: u.x, y: u.y };
    return point;
  }

  private confirmTarget(): void {
    const s = this.sel, b = this.ctrl.battle;
    if (!this.ctrl.inputEnabled() || this.animating || inputLock.locked || G.ui.busy() || s.mode !== 'target' || !s.unit || !s.ability || !s.pending) return;
    if (!b.canAct(s.unit) || !b.abilityReady(b.unit(s.unit), s.ability) || !b.validTarget(s.unit, s.ability, s.pending)) return;
    void this.doAct(s.unit, s.ability, { ...s.pending });
  }

  private cycleUnit(dir: number): void {
    const b = this.ctrl.battle;
    const list = b.units.filter(u => this.controllable(u) && !b.isDone(u.id));
    if (!list.length) return;
    const i = list.findIndex(u => u.id === this.sel.unit);
    const next = list[(i + dir + list.length) % list.length];
    this.select(next.id);
    this.setHover({ x: next.x, y: next.y });
  }

  /** Pages the forecast through the affected units; an unpinned (hovered) target gets pinned first. */
  private cycleFocus(dir: 1 | -1): void {
    const s = this.sel, b = this.ctrl.battle;
    if (!s.unit || s.mode !== 'target' || !s.ability || !this.ctrl.inputEnabled()) return;
    const tgt = this.previewTarget();
    if (!tgt) return;
    const n = b.affectedUnits(s.unit, s.ability, tgt).length;
    if (!s.pending) s.pending = { ...tgt };
    if (n < 2) { this.refresh(); return; }
    s.focus = (s.focus + dir + n) % n;
    G.audio.sfx('ui-move', { volume: 0.3 });
    this.refresh();
    if (this.focusUnit) { const u = b.findUnit(this.focusUnit); if (u) void this.ensureVisible(u); }
  }

  /** Cell the forecast is about: the pinned target, else the hovered cell when it is a legal target. */
  private previewTarget(): Point | null {
    const s = this.sel, b = this.ctrl.battle;
    if (!s.unit || s.mode !== 'target' || !s.ability) return null;
    const t = s.pending ?? this.actionTarget(this.hover);
    if (!t || !b.targetCells(s.unit, s.ability).some(c => c.x === t.x && c.y === t.y)) return null;
    return b.validTarget(s.unit, s.ability, t) ? t : null;
  }

  private requestEndTurn(): void {
    if (!this.ctrl.inputEnabled() || this.animating > 0) return;
    if (this.sel.mode === 'facing') { void this.confirmFacing(); return; }
    const u = this.ctrl.battle.findUnit(this.ctrl.battle.activeUnit ?? '');
    if (this.controllable(u)) this.beginFacing(u!.id);
    else this.ctrl.endTurn();
  }

  private beginFacing(id: string): void {
    if (this.sel.unit !== id) this.select(id, true);
    this.beforeFacing = this.ctrl.battle.isDone(id)
      ? { mode: 'none', actOpen: false, ability: null, pending: null }
      : { mode: this.sel.mode, actOpen: this.sel.actOpen, ability: this.sel.ability, pending: this.sel.pending };
    this.sel.mode = 'facing'; this.sel.ability = null; this.sel.pending = null; this.sel.inspect = null;
    this.hoverAbility = null;
    this.endFacing = this.ctrl.battle.unit(id).facing;
    this.refresh();
  }

  private chooseFacing(facing: Facing): void {
    if (!this.ctrl.inputEnabled() || this.sel.mode !== 'facing' || !this.sel.unit) return;
    this.endFacing = facing;
    this.views.get(this.sel.unit)?.setFacing(facing);
    this.refreshPanels();
  }

  private async confirmFacing(): Promise<void> {
    const id = this.sel.unit, facing = this.endFacing;
    if (!id || !facing || this.sel.mode !== 'facing' || !this.ctrl.inputEnabled() || inputLock.locked || G.ui.busy()) return;
    const done = await this.ctrl.perform(() => [...this.ctrl.battle.face(id, facing), ...this.ctrl.battle.wait(id)]);
    if (!done || this.ctrl.isEnded) return;
    this.ctrl.signal({ type: 'wait', unit: id });
    G.audio.sfx('page', { volume: 0.6 });
    this.select(null, true);
    this.ctrl.endTurn();
  }

  private undo(): void {
    const s = this.sel;
    if (!s.unit || !this.ctrl.battle.canUndo(s.unit)) return;
    const id = s.unit;
    G.audio.sfx('ui-cancel', { volume: 0.5 });
    void this.ctrl.perform(() => this.ctrl.battle.undoMove(id)).then(() => {
      this.ctrl.signal({ type: 'undo', unit: id });
      this.select(id, true);
    });
  }

  private waitUnit(): void {
    const s = this.sel;
    if (!s.unit || !this.ctrl.inputEnabled()) return;
    if (s.mode !== 'facing') this.beginFacing(s.unit);
  }

  private async doMove(id: string, to: Point): Promise<void> {
    this.sel.pending = null;
    this.clearOverlay('range'); this.clearOverlay('path'); this.showPathSteps([]);
    this.ui.menu(null);
    const moved = await this.ctrl.perform(() => this.ctrl.battle.move(id, to));
    if (!moved) return;
    this.ctrl.signal({ type: 'move', unit: id });
    if (this.ctrl.isEnded) return;
    const b = this.ctrl.battle;
    const u = b.unit(id);
    if (u.down) { this.afterUnitAction(id); return; }
    this.sel.mode = 'none';
    this.sel.actOpen = b.canAct(id);
    this.hover = { x: u.x, y: u.y };
    this.updateCursor();
    if (!b.canAct(id)) this.afterUnitAction(id); else this.refresh();
  }

  private async doAct(id: string, ability: string, target: Point): Promise<void> {
    this.sel.pending = null;
    this.clearOverlay('range'); this.clearOverlay('aoe');
    this.ui.menu(null); this.ui.previewCard(null);
    const acted = await this.ctrl.perform(() => this.ctrl.battle.act(id, ability, target));
    if (!acted) return;
    this.ctrl.signal({ type: 'act', unit: id, ability });
    if (this.ctrl.isEnded) return;
    this.afterUnitAction(id);
  }

  /** A completed turn stays open until the player chooses the unit's final facing. */
  private afterUnitAction(id: string): void {
    const b = this.ctrl.battle;
    if (!this.ctrl.inputEnabled() && !this.ctrl.isEnded && b.phase !== 'player') return;
    const u = b.findUnit(id);
    if (u && !u.down && this.controllable(u) && b.canMove(id)) {
      this.select(id, true);
      return;
    }
    if (u && this.controllable(u)) { this.beginFacing(id); return; }
    const next = b.units.find(o => this.controllable(o) && !b.isDone(o.id));
    if (next) { this.select(next.id, true); this.setHover({ x: next.x, y: next.y }); return; }
    this.select(null, true);
    if (this.ctrl.inputEnabled()) this.ctrl.endTurn();
  }

  // =================================================================== panels
  refresh(): void {
    if (!this.ui) return;
    const b = this.ctrl.battle;
    for (const v of this.views.values()) v.refresh(b.findUnit(v.unit.id) ?? v.unit, b.phase === 'player' && b.isDone(v.unit.id));
    this.ui.setOrder(this.ctrl.turnOrder(), this.ctrl.unitDefs, b.phase, () => false, b.activeUnit);
    this.ui.setObjective(this.ctrl.objectiveText, this.ctrl.objectiveDetail, surviveProgress(b, this.startData.battle.objective.win));
    const enabled = this.ctrl.inputEnabled();
    this.ui.setEndTurn(enabled && this.sel.mode !== 'facing', enabled && b.pending().length === 0);
    this.refreshOverlays();
    this.refreshPanels();
  }

  /** Entries under „Aktion“: the basic attack (hotkey 0), then the specials with their digit (index in u.abilities). */
  private slots(u: Unit): AbilitySlot[] {
    const b = this.ctrl.battle;
    return actionList(u).map(id => {
      const attack = id === u.attack;
      const index = u.abilities.indexOf(id);
      const key = attack ? '0' : index >= 0 && index < 9 ? String(index + 1) : undefined;
      const def = b.ability(id);
      const cd = u.cooldowns[id] ?? 0;
      let usable = true;
      let reason: string | undefined;
      if (!this.ctrl.inputEnabled() || u.team !== 'player') { usable = false; }
      else if (!skillAvailable(u, id)) { usable = false; reason = 'Passende Waffe ausrüsten oder die Fähigkeit mit AP meistern.'; }
      else if (!b.canAct(u.id)) { usable = false; reason = 'Diese Einheit hat in dieser Runde schon gehandelt.'; }
      else if (cd > 0) { usable = false; reason = `Bereit in ${cd} ${cd === 1 ? 'Runde' : 'Runden'}.`; }
      else if (u.mp < (def.mpCost ?? 0)) { usable = false; reason = `Benötigt ${def.mpCost} MP, vorhanden: ${u.mp}.`; }
      else if (!(def.target === 'self' && def.shape.type === 'self') && !b.targetCells(u.id, id).some(c => b.validTarget(u.id, id, c))) {
        usable = false;
        reason = def.target === 'bound' ? 'Niemand Gefesseltes in der Nähe.' : def.shape.type === 'ring' ? 'Kein Feind direkt daneben.' : def.shape.type === 'line' ? 'Kein Feind in gerader Linie.' : def.target === 'ally' ? 'Kein Verbündeter in Reichweite.' : 'Kein Ziel in Reichweite – erst bewegen.';
      }
      return { def, cooldown: cd, usable, reason, mastered: u.mastered.includes(id), attack, key };
    });
  }

  private refreshPanels(): void {
    if (!this.ui) return;
    if (this.tableauActive) return;
    const b = this.ctrl.battle;
    const s = this.sel;
    const facing = s.mode === 'facing' && s.unit && this.ctrl.inputEnabled();
    this.ui.facingCard(facing ? {
      name: b.unit(s.unit!).name, selected: this.endFacing!,
      options: ([['up', '↗', 'rechts oben'], ['right', '↘', 'rechts unten'], ['down', '↙', 'links unten'], ['left', '↖', 'links oben']] as const)
        .map(([dir, arrow, label]) => ({ facing: this.iso.facingForScreen(dir), arrow, label })),
    } : null);
    const hovered = this.unitAtPoint(this.hover);
    const cardUnit = s.unit ? b.findUnit(s.unit) : (hovered && this.controllable(hovered) ? hovered : undefined);
    if (cardUnit && !this.ctrl.isEnded) {
      this.ui.unitCard({
        unit: cardUnit, def: this.ctrl.unitDefs.get(cardUnit.id)!, abilities: this.slots(cardUnit), selected: s.ability,
        canAct: b.canAct(cardUnit.id), canMove: b.canMove(cardUnit.id), controllable: this.controllable(cardUnit),
      });
    } else if (hovered && !this.ctrl.isEnded && !s.unit) {
      this.ui.unitCard({ unit: hovered, def: this.ctrl.unitDefs.get(hovered.id)!, abilities: [], canAct: false, canMove: false, controllable: false });
    } else this.ui.unitCard(null);

    // Preview / inspect card.
    this.focusUnit = null;
    if (s.unit && s.mode === 'target' && s.ability && this.ctrl.inputEnabled() && this.animating === 0) {
      // Hovering a legal target previews it; a click pins it (s.pending) for confirmation.
      const tgt = this.previewTarget();
      const a = b.ability(s.ability);
      if (tgt) {
        const pv = b.preview(s.unit, s.ability, tgt);
        const key = `${s.ability}:${tgt.x},${tgt.y}`;
        // A new target starts at the unit under the cursor (an enemy inside a ring), else the first one; until the
        // target is pinned the focus follows the cursor.
        const under = pv.targets.findIndex(t => t.unit === this.unitAtPoint(this.hover)?.id);
        if (key !== this.focusKey) { this.focusKey = key; s.focus = Math.max(0, under); }
        else if (!s.pending && under >= 0) s.focus = under;
        if (pv.targets.length) s.focus = ((s.focus % pv.targets.length) + pv.targets.length) % pv.targets.length;
        this.focusUnit = pv.targets[s.focus]?.unit ?? null;
        this.ui.previewCard({
          ability: a, user: b.unit(s.unit), userDef: this.ctrl.unitDefs.get(s.unit),
          targets: pv.targets.map(p => ({ unit: b.unit(p.unit), def: this.ctrl.unitDefs.get(p.unit)!, p })),
          empty: a.shape.type === 'line' ? 'Kein Feind in dieser Linie.' : 'Kein Ziel.',
          confirmed: !!s.pending, focus: s.focus,
        });
      } else {
        this.focusKey = '';
        this.ui.previewCard(null);
        this.ui.inspectCard(null);
      }
    } else {
      this.focusKey = '';
      this.ui.previewCard(null);
      const insp = s.inspect ? b.findUnit(s.inspect) : hovered && hovered.id !== s.unit && (!this.controllable(hovered) || s.unit) ? hovered : undefined;
      if (insp) {
        const note = insp.team === 'enemy' && !insp.down ? 'Rot: Felder, die diese Einheit nächste Runde erreichen kann.' : insp.statuses.bound ? 'Gefesselt – ein angrenzender Verbündeter kann sie befreien.' : undefined;
        this.ui.inspectCard(insp, this.ctrl.unitDefs.get(insp.id), note);
      } else this.ui.inspectCard(null);
    }
    this.placeMenu();
  }

  private placeMenu(): void {
    const b = this.ctrl.battle;
    const s = this.sel;
    if (!s.unit || s.mode === 'facing' || !this.ctrl.inputEnabled() || this.animating > 0) { this.ui.menu(null); return; }
    const u = b.findUnit(s.unit);
    const v = this.views.get(s.unit);
    if (!u || !v || u.down) { this.ui.menu(null); return; }
    const p = this.worldToCanvas(v.chest.x, v.chest.y);
    this.ui.menu({
      x: p.x, y: p.y, canMove: b.canMove(u.id), canAct: b.canAct(u.id), canUndo: b.canUndo(u.id),
      moveOn: s.mode === 'move', actOpen: s.actOpen || s.mode === 'target', targeting: s.mode === 'target', abilities: this.slots(u), selected: s.ability,
      avoid: [...this.views.values()].filter(o => o !== v && o.unit.down !== 'dead').flatMap(o => [this.worldToCanvas(o.chest.x, o.chest.y), this.worldToCanvas(o.feet.x, o.feet.y)]),
    });
  }

  /** e2e helper: page coordinates of a tile centre (or a unit's chest). */
  debugPage(target: string | Point): { x: number; y: number } | null {
    let w: { x: number; y: number };
    if (typeof target === 'string') { const v = this.views.get(target); if (!v) return null; w = v.chest; }
    else w = this.iso.center(target.x, target.y, this.ctrl.battle.grid.height(target.x, target.y));
    const p = this.worldToCanvas(w.x, w.y);
    const r = canvasRect();
    if (!r) return null;
    return { x: r.left + (p.x / GAME_W) * r.width, y: r.top + (p.y / GAME_H) * r.height };
  }
  debugState(): unknown {
    const b = this.ctrl.battle;
    return { round: b.round, phase: b.phase, activeUnit: b.activeUnit, input: this.ctrl.inputEnabled(), sel: this.sel, units: b.units.map(u => ({ id: u.id, x: u.x, y: u.y, hp: u.hp, mp: u.mp, level: u.level, exp: u.exp, speed: u.speed, weapon: u.weapon, down: u.down, team: u.team, moved: u.moved, acted: u.acted })) };
  }

  private worldToCanvas(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return { x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom };
  }

  // =================================================================== presenter
  wait(ms: number): Promise<void> { return new Promise(r => this.time.delayedCall(ms, () => r())); }

  async startBanner(title: string, subtitle?: string): Promise<void> {
    this.ui.hideAllPanels(true);
    for (const v of this.views.values()) v.setAlpha(0);
    const cam = this.cameras.main;
    cam.fadeIn(600, 7, 8, 12);
    const p = this.ui.titleCard(title, subtitle);
    let i = 0;
    for (const v of this.views.values()) {
      const d = 500 + i++ * 90;
      this.time.delayedCall(d, () => {
        v.oy = -14;
        this.tweens.add({ targets: v, oy: 0, duration: 260, ease: 'Bounce.easeOut' });
        this.tweens.addCounter({ from: 0, to: 1, duration: 200, onUpdate: tw => v.setAlpha(tw.getValue() ?? 1) });
      });
    }
    await p;
    this.ui.hideAllPanels(false);
  }

  async phaseBanner(phase: Phase, round: number): Promise<void> {
    this.select(null, true);
    G.audio.sfx(phase === 'player' ? 'objective' : 'alert', { volume: 0.45 });
    const u = this.ctrl.battle.activeUnit ? this.ctrl.battle.unit(this.ctrl.battle.activeUnit) : undefined;
    await this.ui.turnBanner(phase, round, u);
    this.refresh();
  }

  banner(text: string, sub?: string): Promise<void> {
    G.audio.sfx('alert', { volume: 0.5 });
    return this.ui.banner(text, sub ?? '', 'enemy', 1500);
  }

  async focus(target: Point | string, ms = 300): Promise<void> {
    let p: { x: number; y: number };
    if (typeof target === 'string') { const v = this.views.get(target); if (!v) return; p = v.chest; }
    else p = this.iso.center(target.x, target.y, this.ctrl.battle.grid.height(target.x, target.y));
    const cam = this.cameras.main;
    const v = cam.worldView;
    const margin = 70;
    const inside = p.x > v.x + margin && p.x < v.right - margin && p.y > v.y + margin * 0.8 && p.y < v.bottom - margin;
    if (inside) return;
    await new Promise<void>(resolve => {
      cam.pan(p.x, p.y, ms, 'Sine.easeInOut', true, (_c: unknown, prog: number) => { if (prog >= 1) resolve(); });
      this.time.delayedCall(ms + 60, () => resolve());
    });
  }

  async showEnemyIntent(unit: string, cells: Point[]): Promise<void> {
    const u = this.ctrl.battle.unit(unit);
    this.setOverlay('intent', cells.filter(c => !(c.x === u.x && c.y === u.y)), 'tac-ov-danger', 1);
    this.views.get(unit)!.selected = true;
    this.views.get(unit)!.refresh(u);
    await this.wait(420);
    this.clearOverlay('intent');
    this.views.get(unit)!.selected = false;
  }

  async announce(unit: string, ability: string): Promise<void> {
    const v = this.views.get(unit);
    if (!v) return;
    const a = this.ctrl.battle.ability(ability);
    const p = this.worldToCanvas(v.head.x, v.head.y - 6);
    await this.ui.plate(p.x, p.y, a.name, a.kind === 'magic' ? 'magic' : v.unit.team === 'enemy' ? 'enemy' : 'player');
  }

  showHint(text: string, opts: HintOptions, withButton: boolean): Promise<void> {
    // The active unit is selected by itself, so a hint waiting for 'select' is already satisfied: no card at all.
    if (!withButton && opts.until === 'select' && this.ctrl.battle.phase === 'player') {
      const id = this.autoSelect();
      if (id) { this.ctrl.signal({ type: 'select', unit: id }); return Promise.resolve(); }
    }
    this.hintTarget = opts.unit || opts.tile ? { unit: opts.unit, tile: opts.tile } : null;
    G.audio.sfx('page', { volume: 0.4 });
    return this.ui.hint(text, opts, withButton);
  }
  clearHint(): void { this.hintTarget = null; this.ui?.clearHint(); }

  bark(unit: string, text: string, ms = 2200): void {
    const v = this.views.get(unit);
    if (!v) return;
    presentTacticalBark(G.ui, v.unit, text, () => (this.scene.isActive() ? this.worldToCanvas(v.head.x, v.head.y - 4) : null), ms);
  }

  pose(unit: string, anim: CharAnim): void {
    const v = this.views.get(unit);
    if (!v) return;
    if (anim === 'idle') v.idle(); else v.play(anim);
  }

  async tableau(actors: BattleActor[], focus: string): Promise<void> {
    this.select(null, true);
    this.tableauActive = true;
    this.drag = null;
    this.hover = null;
    this.clearHint();
    this.ui.hideAllPanels(true);
    this.ui.unitCard(null); this.ui.inspectCard(null); this.ui.previewCard(null);
    for (const layer of [...this.overlays.keys()]) this.clearOverlay(layer);
    this.showPathSteps([]);
    for (const prop of this.props) if (prop.info.key.startsWith('tac-flag')) prop.img.setVisible(false);
    for (const v of this.views.values()) v.setCinematic(true);
    this.cursor.setVisible(false); this.pointerArrow.setVisible(false);
    const cam = this.cameras.main;
    cam.fadeOut(180, 5, 9, 18);
    await this.wait(200);
    for (const actor of actors) {
      const v = this.views.get(actor.unit);
      if (!v) continue;
      v.gx = actor.at.x; v.gy = actor.at.y;
      v.z = this.ctrl.battle.grid.height(actor.at.x, actor.at.y);
      v.ox = 0; v.oy = 0;
      v.setFacing(actor.facing);
      v.setCinematic(true);
      v.play(actor.pose ?? (v.unit.down ? 'fall' : 'idle'));
      v.layout();
    }
    const cast = actors.flatMap(a => { const v = this.views.get(a.unit); return v ? [v] : []; });
    const lead = this.views.get(focus);
    if (lead && cast.length) {
      const extentX = Math.max(...cast.map(v => Math.abs(v.feet.x - lead.chest.x) + 40));
      const extentY = Math.max(...cast.map(v => Math.max(Math.abs(v.head.y - lead.chest.y), Math.abs(v.feet.y - lead.chest.y)) + 35));
      cam.setZoom(Math.min(1.65, GAME_W / (extentX * 2), (GAME_H - 60) / (extentY * 2)));
      cam.centerOn(lead.chest.x, lead.chest.y);
    }
    cam.fadeIn(420, 5, 9, 18);
    await this.wait(600);
  }

  async magicBurst(unit: string, thrown?: string): Promise<void> {
    const caster = this.views.get(unit);
    if (!caster) return;
    await playMagicBurst(this, this.fx, caster, [...this.views.values()], thrown);
  }

  shake(intensity: number): void {
    if (settings.reducedMotion) return;
    this.cameras.main.shake(160 + intensity * 60, 0.003 * intensity);
  }

  setObjective(text: string, detail?: string): void {
    this.ui.setObjective(text, detail, surviveProgress(this.ctrl.battle, this.startData.battle.objective.win), true);
    G.audio.sfx('write', { volume: 0.5 });
  }

  beginPlayerPhase(): void {
    // The unit may already be selected (a hint during the round hook opened input early); keep what the player chose.
    const id = this.sel.unit;
    if (!this.autoSelect()) this.select(null, true);
    else if (id && id === this.sel.unit) this.ctrl.signal({ type: 'select', unit: id });
    this.refresh();
  }
  endPlayerPhase(): void {
    if (this.sel.unit) this.select(null, true);
    this.clearOverlay('range'); this.clearOverlay('aoe'); this.clearOverlay('path'); this.showPathSteps([]);
    this.ui?.menu(null);
    this.ui?.setEndTurn(false, false);
  }

  async outcome(kind: 'win' | 'lose', canRetry: boolean): Promise<'retry' | 'continue'> {
    this.finished = true;
    await this.wait(500);
    if (kind === 'win') {
      G.audio.sfx('objective', { volume: 0.8 });
      for (const v of this.views.values()) if (v.unit.team === 'player' && !v.unit.down) this.tweens.add({ targets: v, oy: -5, duration: 160, yoyo: true, repeat: 2, delay: Math.random() * 200 });
    } else {
      G.audio.sfx('fall', { volume: 0.6 });
      this.cameras.main.fadeOut(900, 20, 6, 8);
      await this.wait(300);
      this.cameras.main.resetFX();
      this.cameras.main.setAlpha(0.55);
    }
    const def = this.startData.battle;
    const sub = kind === 'win' ? def.victoryText ?? this.ctrl.objectiveText : def.defeatText ?? 'Versuch es mit anderer Aufstellung – Höhe und Flanken entscheiden.';
    const r = await this.ui.outcome(kind, canRetry, sub);
    this.cameras.main.setAlpha(1);
    return r;
  }

  private onFinish(r: BattleResult | 'retry'): void {
    if (r === 'retry') {
      this.cameras.main.fadeOut(300, 7, 8, 12);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ ...this.startData, retries: (this.startData.retries ?? 0) + 1 }));
      return;
    }
    this.ui.hideAllPanels(true);
    void this.startData.onEnd?.(r);
  }

  // =================================================================== event playback
  async play(events: BattleEvent[]): Promise<void> {
    this.animating++;
    try {
      for (let i = 0; i < events.length; i++) await this.playOne(events[i], events, i);
      if (this.beamHandle) { await this.beamHandle.stop(); this.beamHandle = null; }
    } catch (err) {
      console.error('[tactics] animation failed', err);
    } finally {
      this.animating--;
      this.lastAct = null;
      for (const v of this.views.values()) { v.ox = 0; if (!v.unit.down) v.oy = 0; }
      for (const v of this.views.values()) if (!v.unit.down) v.idle();
    }
  }

  private view(id: string): UnitView {
    let v = this.views.get(id);
    if (!v) v = this.addUnitView(this.ctrl.battle.unit(id));
    return v;
  }

  private canvasOf(v: UnitView, part: 'head' | 'chest' = 'chest'): { x: number; y: number } {
    const p = part === 'head' ? v.head : v.chest;
    return this.worldToCanvas(p.x, p.y);
  }

  private async playOne(e: BattleEvent, all: BattleEvent[], idx: number): Promise<void> {
    const b = this.ctrl.battle;
    switch (e.type) {
      case 'mp': break;
      case 'equip': G.audio.sfx('ui-confirm', { volume: 0.4 }); break;
      case 'exp': {
        const p = this.canvasOf(this.view(e.unit));
        this.ui.float(p.x, p.y - 14, `+${e.amount} Exp`, 'info');
        break;
      }
      case 'level': {
        const p = this.canvasOf(this.view(e.unit));
        this.ui.float(p.x, p.y - 30, `Lvl ${e.level}!`, 'heal');
        G.audio.sfx('objective', { volume: 0.6 });
        break;
      }
      case 'master': {
        const p = this.canvasOf(this.view(e.unit));
        this.ui.float(p.x, p.y - 45, `${b.ability(e.ability).name} gemeistert`, 'magic');
        break;
      }
      case 'move': await this.animateMove(e.unit, e.path); break;
      case 'undo': {
        const v = this.view(e.unit);
        v.gx = e.to.x; v.gy = e.to.y; v.z = b.grid.height(e.to.x, e.to.y);
        v.setFacing(e.facing);
        this.fx.dust(v.feet.x, v.feet.y, v.depth(), 4);
        break;
      }
      case 'face': this.view(e.unit).setFacing(e.facing); break;
      case 'act': await this.animateAct(e, all, idx); break;
      case 'strike': await this.animateStrike(e); break;
      case 'push': await this.animatePush(e); break;
      case 'damage': {
        const v = this.view(e.unit);
        v.flash(0xffffff, 60);
        const p = this.canvasOf(v, 'head');
        this.ui.float(p.x, p.y, `${e.amount}`, e.cause === 'fall' || e.cause === 'collision' ? 'bad' : 'dmg');
        if (e.cause === 'fire') this.fx.burst(v.chest.x, v.chest.y, { color: [0xf8c64e, 0xec8a2c], count: 8, speed: 40, gravity: -60 });
        v.refresh(b.unit(e.unit));
        await this.wait(160);
        break;
      }
      case 'heal': {
        const v = this.view(e.unit);
        const p = this.canvasOf(v, 'head');
        this.ui.float(p.x, p.y, `+${e.amount}`, 'heal');
        G.audio.sfx('heal', { volume: 0.6 });
        v.refresh(b.unit(e.unit));
        break;
      }
      case 'status': {
        const v = this.view(e.unit);
        v.refresh(b.unit(e.unit));
        if (e.on && STATUS_TEXT[e.status] && e.status !== 'bound') {
          const p = this.canvasOf(v, 'head');
          this.ui.float(p.x, p.y - 8, STATUS_TEXT[e.status], e.status === 'guarded' ? 'magic' : 'info');
        }
        break;
      }
      case 'down': await this.animateDown(e.unit, e.kind); break;
      case 'free': {
        const v = this.view(e.unit);
        G.audio.sfx('rope-cut', { volume: 0.8 });
        for (let i = 0; i < 6; i++) {
          const r = this.add.image(v.chest.x, v.chest.y, 'tac-rope').setDepth(v.depth() + 5).setRotation(Math.random() * 3);
          this.tweens.add({ targets: r, x: r.x + (Math.random() - 0.5) * 30, y: r.y + 10 + Math.random() * 8, rotation: r.rotation + 4, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
        }
        v.unbind(this.startData.battle.id);
        v.setTeam(e.team);
        v.refresh(b.unit(e.unit));
        v.play('idle');
        this.tweens.add({ targets: v, oy: -6, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
        const p = this.canvasOf(v, 'head');
        this.ui.float(p.x, p.y - 6, 'Befreit!', 'info');
        await this.wait(500);
        break;
      }
      case 'spawn': {
        const u = b.unit(e.unit);
        const v = this.views.get(u.id) ?? this.addUnitView(u);
        v.gx = u.x; v.gy = u.y; v.z = b.grid.height(u.x, u.y);
        v.setAlpha(0); v.oy = -24;
        G.audio.sfx('thud', { volume: 0.5 });
        await new Promise<void>(r => this.tweens.add({ targets: v, oy: 0, duration: 320, ease: 'Bounce.easeOut', onUpdate: (tw) => v.setAlpha(Math.min(1, tw.progress * 2)), onComplete: () => r() }));
        this.fx.dust(v.feet.x, v.feet.y, v.depth(), 8);
        v.refresh(u);
        break;
      }
      case 'remove': {
        const v = this.views.get(e.unit);
        if (v) {
          await new Promise<void>(r => this.tweens.addCounter({ from: 1, to: 0, duration: 400, onUpdate: tw => v.setAlpha(tw.getValue() ?? 0), onComplete: () => r() }));
          v.destroy();
          this.views.delete(e.unit);
        }
        break;
      }
      case 'wait': this.view(e.unit).refresh(b.unit(e.unit), true); break;
      case 'phase': break;
    }
  }

  private async animateMove(id: string, path: Point[]): Promise<void> {
    const v = this.view(id);
    const g = this.ctrl.battle.grid;
    let prev = { x: Math.round(v.gx), y: Math.round(v.gy) };
    v.play('walk');
    for (const step of path) {
      const f = dirOf(prev, step);
      if (f !== v.facing) v.setFacing(f);
      v.play('walk', true);
      const h0 = g.height(prev.x, prev.y), h1 = g.height(step.x, step.y);
      const dh = h1 - h0;
      const hop = dh !== 0;
      const ms = hop ? 230 + Math.abs(dh) * 30 : 150;
      const st = { t: 0 };
      await new Promise<void>(r => this.tweens.add({
        targets: st, t: 1, duration: ms, ease: hop ? 'Linear' : 'Sine.easeInOut',
        onUpdate: () => {
          const t = st.t;
          v.gx = prev.x + (step.x - prev.x) * t;
          v.gy = prev.y + (step.y - prev.y) * t;
          // Jump arc: rise above the higher ledge, then land.
          v.z = hop ? h0 + dh * t + Math.sin(Math.PI * t) * (0.6 + Math.abs(dh) * 0.45) : h0;
        },
        onComplete: () => r(),
      }));
      v.z = h1; v.oy = 0; v.gx = step.x; v.gy = step.y;
      const tile = g.tile(step.x, step.y)!;
      const sfx = STEP_SFX[tile.terrain];
      if (sfx) G.audio.sfx(sfx, { volume: 0.5, key: `step-${id}` });
      if (hop) { this.fx.dust(v.feet.x, v.feet.y, v.depth(), 5); G.audio.sfx('thud', { volume: 0.25 }); }
      if (tile.terrain === 'water' || tile.terrain === 'mud') this.fx.burst(v.feet.x, v.feet.y, { color: [0x69abd2, 0xa6d8e6], count: 6, speed: 40, gravity: 140, life: 320 });
      prev = step;
    }
    v.idle();
  }

  private async animateAct(e: Extract<BattleEvent, { type: 'act' }>, all: BattleEvent[], idx: number): Promise<void> {
    this.lastAct = e;
    const b = this.ctrl.battle;
    const a = b.ability(e.ability);
    const v = this.view(e.unit);
    const firstStrike = all.slice(idx + 1).find(x => x.type === 'strike') as Extract<BattleEvent, { type: 'strike' }> | undefined;
    const targetView = firstStrike ? this.views.get(firstStrike.target) : undefined;
    const tc = b.grid.tile(e.target.x, e.target.y);
    const targetPos = targetView ? targetView.chest : tc ? (() => { const c = this.iso.center(e.target.x, e.target.y, tc.h); return { x: c.x, y: c.y - 10 }; })() : v.chest;
    if (v.unit.team !== 'player') { /* AI plate already shown */ }
    switch (a.vfx) {
      case 'arrow': case 'bolt': case 'stone': {
        await v.playOnce(a.vfx === 'stone' ? 'attack' : 'shoot', 260);
        G.audio.sfx(a.vfx === 'arrow' ? 'bow' : a.vfx === 'bolt' ? 'crossbow' : 'throw', { volume: 0.7 });
        const from = { x: v.chest.x + this.iso.screenDir(v.facing).x * 0.2, y: v.chest.y - 2 };
        const miss = firstStrike && !firstStrike.hit;
        const to = miss ? { x: targetPos.x + 10, y: targetPos.y + 8 } : targetPos;
        await this.fx.projectile(a.vfx === 'arrow' ? 'tac-arrow' : a.vfx === 'bolt' ? 'tac-bolt' : 'tac-stone', from, to, { spin: a.vfx === 'stone', arc: a.vfx === 'bolt' ? 6 : undefined });
        break;
      }
      case 'beam': {
        v.play('cast');
        const hand = { x: v.chest.x + this.iso.screenDir(v.facing).x * 0.3, y: v.chest.y - 1 };
        G.audio.sfx('magic', { volume: 0.6 });
        await this.fx.charge(hand.x, hand.y, 0x49e0c8, 300);
        G.audio.sfx('beam', { volume: 0.9 });
        const last = e.tiles[e.tiles.length - 1] ?? e.target;
        const lc = this.iso.center(last.x, last.y, b.grid.height(last.x, last.y));
        const sd = this.iso.screenDir(v.facing);
        const end = { x: lc.x + sd.x * 0.45, y: lc.y - 10 + sd.y * 0.45 };
        this.beamHandle = this.fx.beam(hand, end);
        this.shake(1);
        await this.wait(160);
        break;
      }
      case 'shockwave': {
        v.play('cast');
        G.audio.sfx('magic', { volume: 0.5 });
        await this.fx.charge(v.chest.x, v.chest.y, 0x49e0c8, 240);
        G.audio.sfx('shockwave', { volume: 0.9 });
        const f = v.feet;
        void this.fx.ring(f.x, f.y, 0x49e0c8, 40, 420);
        this.fx.burst(f.x, f.y, { color: [0xcdb08a, 0xa8906c], count: 16, speed: 90, gravity: 40, texture: 'tac-dot', life: 500, depth: v.depth() + 1 });
        this.shake(2);
        this.flashScreen(0x49e0c8, 0.18);
        await this.wait(120);
        break;
      }
      case 'ward': {
        v.play('cast');
        G.audio.sfx('magic', { volume: 0.7 });
        const tv = this.views.get(b.unitAt(e.target.x, e.target.y)?.id ?? e.unit) ?? v;
        await this.fx.charge(v.chest.x, v.chest.y, 0x49e0c8, 200);
        await this.fx.ward(tv.feet.x, tv.feet.y, tv.depth() + 6);
        break;
      }
      case 'taunt': {
        await v.playOnce('interact', 300);
        G.audio.sfx('alert', { volume: 0.6 });
        void this.fx.ring(v.feet.x, v.feet.y, 0xff6a50, 46, 520);
        this.bark(e.unit, pick(['Hierher, ihr Hohlköpfe!', 'He! Hier drüben!', 'Fangt mich doch!']), 1600);
        await this.wait(300);
        break;
      }
      case 'dodge': {
        G.audio.sfx('dodge', { volume: 0.6 });
        for (let i = 0; i < 3; i++) {
          const ghost = this.add.sprite(v.sprite.x, v.sprite.y, v.sprite.texture.key, v.sprite.frame.name).setOrigin(v.sprite.originX, v.sprite.originY).setScale(v.sprite.scaleX).setFlipX(v.sprite.flipX).setDepth(v.depth() - 1).setAlpha(0.45).setTint(0xd8dce4);
          this.tweens.add({ targets: ghost, x: ghost.x + (i - 1) * 10, alpha: 0, duration: 380, delay: i * 60, onComplete: () => ghost.destroy() });
        }
        this.tweens.add({ targets: v, ox: 4, duration: 90, yoyo: true, repeat: 1 });
        await this.wait(260);
        break;
      }
      case 'free': {
        await v.playOnce('interact', 380);
        break;
      }
      default: {
        // Melee: the strike events animate the lunge.
        G.audio.sfx('swing', { volume: 0.5, pitch: a.vfx === 'heavy' ? 0.8 : 1 });
        break;
      }
    }
  }

  private async animateStrike(e: Extract<BattleEvent, { type: 'strike' }>): Promise<void> {
    const b = this.ctrl.battle;
    const atk = this.view(e.unit);
    const tgt = this.view(e.target);
    const act = this.lastAct;
    const a = act ? b.ability(act.ability) : null;
    const melee = a && (a.kind === 'melee');
    const heavy = a?.vfx === 'heavy';
    if (melee) {
      if (e.index > 0) G.audio.sfx('swing', { volume: 0.45, pitch: 1.15 });
      atk.play('attack');
      const dx = tgt.feet.x - atk.feet.x, dy = tgt.feet.y - atk.feet.y;
      const len = Math.hypot(dx, dy) || 1;
      const reach = heavy ? 9 : 7;
      await new Promise<void>(r => this.tweens.add({ targets: atk, ox: (dx / len) * reach, oy: (dy / len) * reach * 0.6 - 2, duration: heavy ? 140 : 90, ease: 'Quad.easeIn', onComplete: () => r() }));
    } else if (a?.vfx === 'beam' || a?.vfx === 'shockwave' || a?.vfx === 'palm') {
      // magic impact, no lunge
    }
    // Impact
    const p = tgt.chest;
    if (e.hit) {
      const isBack = e.relation === 'back', isSide = e.relation === 'side';
      const big = heavy || isBack || e.hp <= 0;
      tgt.flash(0xffffff, 80);
      tgt.play('hit');
      const magic = a?.kind === 'magic' || a?.vfx === 'palm';
      this.fx.impact(p.x, p.y, magic ? 0x9cf8e6 : 0xfff0b0, big);
      if (melee && a?.vfx !== 'kick' && a?.vfx !== 'palm') this.fx.slash(p.x, p.y, Math.atan2(tgt.feet.y - atk.feet.y, tgt.feet.x - atk.feet.x) + (e.index % 2 ? 0.6 : -0.6), e.index % 2 === 1);
      if (a?.vfx === 'palm') { void this.fx.ring(p.x, p.y + 6, 0x49e0c8, 14, 240); }
      G.audio.sfx(heavy || isBack ? 'hit-heavy' : a?.vfx === 'arrow' || a?.vfx === 'bolt' ? 'arrow-hit' : a?.vfx === 'stone' ? 'thud' : 'hit', { volume: 0.8 });
      // Hit-stop: freeze both for a beat.
      atk.sprite.anims.pause(); tgt.sprite.anims.pause();
      await this.wait(big ? 95 : 60);
      atk.sprite.anims.resume(); tgt.sprite.anims.resume();
      if (big) this.shake(heavy ? 2 : 1);
      if (e.hp <= 0 && !settings.reducedMotion) this.zoomPulse();
      const c = this.canvasOf(tgt, 'head');
      this.ui.float(c.x, c.y, `${e.damage}`, big ? 'big' : 'dmg');
      if (isBack || isSide) this.ui.float(c.x, c.y - 14, isBack ? 'Rücken!' : 'Seite!', 'info');
      if (e.heightDiff >= 1 && melee) this.ui.float(c.x + 18, c.y - 4, 'Höhe +', 'info');
      // Knock the target back a hair.
      const dx = tgt.feet.x - atk.feet.x, dy = tgt.feet.y - atk.feet.y, len = Math.hypot(dx, dy) || 1;
      this.tweens.add({ targets: tgt, ox: (dx / len) * 3, duration: 60, yoyo: true });
      tgt.refresh(b.unit(e.target));
    } else {
      G.audio.sfx('dodge', { volume: 0.6 });
      const c = this.canvasOf(tgt, 'head');
      this.ui.float(c.x, c.y, 'Verfehlt', 'miss');
      this.tweens.add({ targets: tgt, ox: 5, oy: -2, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
      await this.wait(90);
    }
    if (melee) await new Promise<void>(r => this.tweens.add({ targets: atk, ox: 0, oy: 0, duration: 150, ease: 'Quad.easeOut', onComplete: () => r() }));
    else await this.wait(e.hit ? 140 : 80);
    if (a?.vfx === 'beam') await this.wait(40);
  }

  private async animatePush(e: Extract<BattleEvent, { type: 'push' }>): Promise<void> {
    const v = this.view(e.unit);
    const g = this.ctrl.battle.grid;
    v.play('hit');
    let prev = { x: Math.round(v.gx), y: Math.round(v.gy) };
    for (const step of e.path) {
      const h0 = g.height(prev.x, prev.y), h1 = g.height(step.x, step.y);
      const drop = h0 - h1;
      const st = { t: 0 };
      await new Promise<void>(r => this.tweens.add({
        targets: st, t: 1, duration: drop >= 1 ? 200 + drop * 50 : 120, ease: 'Linear',
        onUpdate: () => {
          const t = st.t;
          v.gx = prev.x + (step.x - prev.x) * Math.min(1, t * (drop >= 1 ? 1.6 : 1));
          v.gy = prev.y + (step.y - prev.y) * Math.min(1, t * (drop >= 1 ? 1.6 : 1));
          v.z = drop >= 1 ? h0 - drop * Math.pow(t, 2) + Math.sin(Math.PI * Math.min(1, t * 2)) * 0.4 : h0 + (h1 - h0) * t;
        },
        onComplete: () => r(),
      }));
      v.gx = step.x; v.gy = step.y; v.z = h1; v.oy = 0;
      this.fx.dust(v.feet.x, v.feet.y, v.depth(), drop >= 2 ? 10 : 4);
      if (drop >= 2) { G.audio.sfx('fall', { volume: 0.7 }); this.shake(1.5); }
      if (g.tile(step.x, step.y)?.terrain === 'water') { G.audio.sfx('splash', { volume: 0.7 }); this.fx.burst(v.feet.x, v.feet.y, { color: [0x69abd2, 0xa6d8e6, 0xe4faff], count: 14, speed: 70, gravity: 200, life: 420 }); }
      prev = step;
    }
    if (e.collide) {
      // Bump into the obstacle and bounce back.
      const f = this.ctrl.battle.unit(e.unit);
      const dir = e.path.length ? dirOf(e.path.length > 1 ? e.path[e.path.length - 2] : prev, prev) : null;
      const sd = this.iso.screenDir(dir ?? oppositeFacing(f.facing));
      const len = Math.hypot(sd.x, sd.y) || 1;
      await new Promise<void>(r => this.tweens.add({ targets: v, ox: (sd.x / len) * 6, oy: (sd.y / len) * 3, duration: 70, yoyo: true, ease: 'Quad.easeOut', onComplete: () => r() }));
      const ip = { x: v.chest.x + (sd.x / len) * 8, y: v.chest.y + (sd.y / len) * 4 };
      this.fx.impact(ip.x, ip.y, 0xffd27a, true);
      G.audio.sfx('thud', { volume: 0.9 });
      this.shake(1.5);
      if (e.collide.other) { const o = this.views.get(e.collide.other); if (o) { o.play('hit'); this.tweens.add({ targets: o, ox: (sd.x / len) * 3, duration: 60, yoyo: true }); } }
      const c = this.canvasOf(v, 'head');
      this.ui.float(c.x, c.y - 14, 'Aufprall!', 'info');
      await this.wait(120);
    }
  }

  private async animateDown(id: string, kind: 'dead' | 'wounded'): Promise<void> {
    const v = this.view(id);
    v.setDown(kind);
    G.audio.sfx('hit-heavy', { volume: 0.6, pitch: 0.8 });
    const c = this.canvasOf(v, 'head');
    if (kind === 'wounded') {
      await v.playOnce('kneel', 420);
      v.play('kneel');
      this.ui.float(c.x, c.y - 10, 'Kampfunfähig', 'bad');
      this.fx.dust(v.feet.x, v.feet.y, v.depth(), 6);
      await this.wait(380);
    } else {
      await v.playOnce('fall', 480);
      this.fx.dust(v.feet.x, v.feet.y, v.depth(), 10);
      G.audio.sfx('fall', { volume: 0.5 });
      this.ui.float(c.x, c.y - 10, 'Besiegt', 'info');
      await new Promise<void>(r => this.tweens.addCounter({ from: 1, to: 0, duration: 520, delay: 200, onUpdate: tw => { v.setAlpha(tw.getValue() ?? 0); v.oy = (1 - (tw.getValue() ?? 0)) * 3; }, onComplete: () => r() }));
      v.destroy();
      this.views.delete(id);
    }
    this.dangerCache.clear();
  }

  private flashScreen(color: number, alpha: number): void {
    if (settings.reducedMotion) return;
    const cam = this.cameras.main;
    cam.flash(140, (color >> 16) & 255, (color >> 8) & 255, color & 255, false);
    void alpha;
  }

  private zoomPulse(): void {
    const cam = this.cameras.main;
    const z0 = cam.zoom;
    this.tweens.add({ targets: cam, zoom: z0 * 1.06, duration: 110, yoyo: true, ease: 'Quad.easeOut', onComplete: () => cam.setZoom(z0) });
  }
}

function dirOf(a: Point, b: Point): Facing {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'e' : 'w';
  return dy > 0 ? 's' : 'n';
}
function oppositeFacing(f: Facing): Facing { return ({ n: 's', s: 'n', e: 'w', w: 'e' } as const)[f]; }
function pick<T>(list: T[]): T { return list[Math.floor(Math.random() * list.length)]; }
function isoPropFrame(info: IsoProp): string | undefined { return info.key.startsWith('tac-prop-') ? 'f0' : undefined; }

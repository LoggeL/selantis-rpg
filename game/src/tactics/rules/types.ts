/**
 * Pure data types of the tactics rules engine. No Phaser, no DOM: everything here is deterministic
 * and unit-testable. Coordinates are grid cells: x = column (east +), y = row (south +).
 */

export type TerrainKind =
  | 'grass' | 'dirt' | 'stone' | 'sand' | 'water' | 'mud'
  | 'bush' | 'rock' | 'wall' | 'tree' | 'fire' | 'void';

export type Facing = 'n' | 'e' | 's' | 'w';
export type Team = 'player' | 'ally' | 'enemy';
export type Phase = 'player' | 'ally' | 'enemy';

export interface Point { x: number; y: number; }

export interface Tile extends Point {
  /** Height level 0..N. Every level is one "block". */
  h: number;
  terrain: TerrainKind;
}

export type StatusId =
  | 'guarded'   // Schutzwall: halves incoming damage, ignores pushes
  | 'stunned'   // loses its next phase
  | 'taunt'     // Ablenken: enemies prefer this unit
  | 'evasive'   // Ausweichen: −45 hit chance against this unit
  | 'bound'     // tied up: cannot move or act, untargetable, can be freed by an adjacent unit
  | 'burning';  // standing in fire: damage at phase start

/** Remaining duration per status in own phases. Infinity = until removed. */
export type StatusMap = Partial<Record<StatusId, number>>;

export type DownKind = 'dead' | 'wounded';

export type AiProfile =
  | 'melee'     // approach and strike, flank when possible
  | 'archer'    // keep distance, seek height, shoot
  | 'guard'     // hold position until an enemy comes within `guardRadius`
  | 'hold'      // never move, attack what is in range
  | 'passive'   // do nothing (civilians, bound)
  | 'flee'      // move toward `goal` tiles, never attack
  | 'support';  // stay near allies, use support abilities

export interface AiOverride {
  profile?: AiProfile;
  /** Unit id this unit must focus. */
  target?: string;
  /** Tile the unit walks toward (flee/escort/forced approach). */
  goal?: Point;
  /** Skip this unit's turn entirely. */
  skip?: boolean;
  /**
   * Body-block this unit: stay as close to it as possible (between it and `goal`, if given) and attack
   * whoever else is in reach. Used for prisoners the enemy must not harm.
   */
  block?: string;
}

export type ShapeDef =
  | { type: 'single' }
  | { type: 'line'; length: number }          // straight line from the caster, pierces units
  | { type: 'ring'; radius: number }          // all tiles around the caster (Manhattan ring 1..radius)
  | { type: 'cone'; length: number }          // widening triangle in front of the caster
  | { type: 'area'; radius: number }          // diamond around the target tile
  | { type: 'self' };

export type AbilityKind = 'melee' | 'ranged' | 'magic' | 'support' | 'interact';
export type AbilityTarget = 'enemy' | 'ally' | 'any' | 'self' | 'tile' | 'bound';
export type AbilityVfx =
  | 'slash' | 'double' | 'thrust' | 'heavy' | 'kick' | 'palm' | 'arrow' | 'bolt' | 'stone' | 'dagger'
  | 'beam' | 'shockwave' | 'ward' | 'taunt' | 'dodge' | 'free';

export interface AbilityEffect {
  status: StatusId;
  turns: number;
  on: 'target' | 'self';
}

export interface AbilityDef {
  id: string;
  name: string;
  /** Short German description for the tooltip. */
  description: string;
  kind: AbilityKind;
  target: AbilityTarget;
  /** Manhattan range [min, max]. 0 = self. */
  range: [number, number];
  shape: ShapeDef;
  /** Base damage added to the user's atk (0 = no damage). */
  power: number;
  /** Strikes per use (two short swords = 2). Each strike rolls separately. */
  hits?: number;
  /** Base hit chance in percent. */
  accuracy: number;
  /** Tiles the target is pushed away from the caster. */
  push?: number;
  effects?: AbilityEffect[];
  heal?: number;
  /** Phases until usable again after use. */
  cooldown?: number;
  mpCost?: number;
  /** Ranged: +1 max range per 2 levels the user stands above the target. */
  heightRange?: boolean;
  /** Needs a free line of fire (projectiles). */
  needsLine?: boolean;
  /** Max height difference for melee reach (default 2). */
  vertical?: number;
  /** Ignores bush cover. */
  ignoresCover?: boolean;
  /** No flank/height multipliers (e.g. magic shock). */
  noFlank?: boolean;
  /** Always hits (cover/evasion still shown, but irrelevant). */
  alwaysHits?: boolean;
  /** Frees a bound unit (target: 'bound'). */
  frees?: boolean;
  /** Fixed damage per hit instead of power + atk − def (e.g. a thrown stone). */
  fixedDamage?: number;
  vfx: AbilityVfx;
  /** Optional small icon id (UI). */
  icon?: string;
}

export interface CombatStats {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  speed: number;
}

/** Encounter rewards. Budgets limit farming within one battle, including support actions. */
export interface BattleProgression {
  actionExp?: number;
  defeatExp?: number;
  actionAp?: number;
  victoryExp?: number;
  victoryAp?: number;
  budgets?: Record<string, { exp: number; ap: number; maxLevel?: number }>;
}

export interface UnitSpec {
  id: string;
  name: string;
  team: Team;
  x: number;
  y: number;
  facing?: Facing;
  /** Initial HP; omitted characters start with their full level-derived maximum. */
  hp?: number;
  maxHp?: number;
  /** Level-one attributes. When present, the level determines all combat attributes. */
  baseStats?: CombatStats;
  atk?: number;
  def?: number;
  move?: number;
  jump?: number;
  speed?: number;
  mp?: number;
  maxMp?: number;
  level?: number;
  exp?: number;
  weapon?: string;
  weapons?: string[];
  mastered?: string[];
  abilityAp?: Record<string, number>;
  abilities: string[];
  /** Becomes "kampfunfähig" (wounded, stays on the field) instead of dying. */
  nonLethal?: boolean;
  ai?: AiProfile;
  guardRadius?: number;
  statuses?: StatusMap;
  /** Team the unit switches to when freed from 'bound'. */
  freedTeam?: Team;
  /** Free-form tags for objectives and hooks (e.g. 'vip'). */
  tags?: string[];
}

export interface Unit {
  id: string;
  name: string;
  team: Team;
  x: number;
  y: number;
  facing: Facing;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  move: number;
  jump: number;
  speed: number;
  mp: number;
  maxMp: number;
  level: number;
  exp: number;
  weapon: string | null;
  weapons: string[];
  innate: string[];
  mastered: string[];
  abilityAp: Record<string, number>;
  abilities: string[];
  cooldowns: Record<string, number>;
  statuses: StatusMap;
  down: false | DownKind;
  nonLethal: boolean;
  ai: AiProfile;
  guardRadius: number;
  freedTeam: Team;
  tags: string[];
  /** Turn bookkeeping for the current phase. */
  moved: boolean;
  acted: boolean;
  /** Position before this phase's move, for undo. */
  undo: { x: number; y: number; facing: Facing } | null;
}

/** One modifier line shown in the hit preview. */
export interface PreviewMod {
  /** German label, e.g. „Rücken“, „Höhe“, „Deckung“. */
  label: string;
  /** Display text, e.g. „×1,5“ or „+10 %“. */
  text: string;
  kind: 'good' | 'bad' | 'neutral';
}

export interface PushOutcome {
  /** Cells the unit slides through, ending at its final cell. Empty if it does not move. */
  path: Point[];
  /** What stopped it. */
  collide: null | { kind: 'wall' | 'edge' | 'cliff' | 'unit'; other?: string; damage: number; otherDamage: number };
  /** Height levels fallen on landing (0 = none). */
  drop: number;
  fallDamage: number;
  intoWater: boolean;
  intoFire: boolean;
}

export interface TargetPreview {
  unit: string;
  chance: number;
  /** Damage per strike before rounding chance in. */
  damage: number;
  hits: number;
  relation: 'front' | 'side' | 'back' | 'none';
  heightDiff: number;
  mods: PreviewMod[];
  push: PushOutcome | null;
  heal: number;
  statuses: StatusId[];
  /** Lethal if all strikes hit (including push damage). */
  lethal: boolean;
  frees: boolean;
}

export interface ActionPreview {
  ability: string;
  tiles: Point[];
  targets: TargetPreview[];
}

export type BattleEvent =
  | { type: 'mp'; unit: string; amount: number; mp: number }
  | { type: 'exp'; unit: string; amount: number }
  | { type: 'level'; unit: string; level: number }
  | { type: 'master'; unit: string; ability: string }
  | { type: 'equip'; unit: string; weapon: string }
  | { type: 'move'; unit: string; path: Point[] }
  | { type: 'undo'; unit: string; to: Point; facing: Facing }
  | { type: 'face'; unit: string; facing: Facing }
  | { type: 'act'; unit: string; ability: string; target: Point; tiles: Point[] }
  | { type: 'strike'; unit: string; target: string; hit: boolean; damage: number; hp: number; relation: TargetPreview['relation']; index: number; heightDiff: number }
  | { type: 'heal'; unit: string; amount: number; hp: number }
  | { type: 'push'; unit: string; path: Point[]; drop: number; collide: PushOutcome['collide'] }
  | { type: 'damage'; unit: string; amount: number; hp: number; cause: 'collision' | 'fall' | 'fire' | 'script' }
  | { type: 'status'; unit: string; status: StatusId; on: boolean }
  | { type: 'down'; unit: string; kind: DownKind }
  | { type: 'free'; unit: string; by: string; team: Team }
  | { type: 'spawn'; unit: string }
  | { type: 'remove'; unit: string }
  | { type: 'wait'; unit: string }
  | { type: 'phase'; phase: Phase; round: number };

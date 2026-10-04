/**
 * CONTRACT between tactics/ (producer) and chapters/ (consumers).
 *
 * Start a battle:
 *   G.stopGameplayScenes();
 *   G.game.scene.start('Tactics', { battle: myBattle, onEnd: result => { ... } } satisfies TacticsStartData);
 *
 * Battles are pure data plus async hooks. The rules engine (tactics/rules) is deterministic; hooks
 * receive a BattleCtx to stage story moments (dialogue via G.ui, hints, reinforcements, AI changes).
 * The tactics agent may ADD members here; it must not remove or rename them.
 */
import type { CharAnim, CharacterSpec } from '../art/api';
import type { AmbienceLayer, MusicMood } from '../audio/api';
import type { UiApi } from '../ui/api';
import type { Battle } from './rules/battle';
import type { LoseCondition, WinCondition } from './rules/objectives';
import type {
  AbilityDef, AiOverride, BattleEvent, DownKind, Facing, Phase, Point, StatusId, TerrainKind, Unit, UnitSpec,
} from './rules/types';

export type { AbilityDef, AiOverride, BattleEvent, Facing, Phase, Point, StatusId, TerrainKind, Unit, UnitSpec, WinCondition, LoseCondition };

export interface BattleUnitDef extends UnitSpec {
  /** Character preset id for G.art.character() (e.g. 'valentus', 'lia'). */
  preset?: string;
  /** Look used when the preset is unknown to the art layer (always original designs, never film-derived). */
  spec?: CharacterSpec;
  /** Portrait id for G.art.portrait() on the unit card (defaults to preset, then a crest). */
  portrait?: string;
  /** Short role line on the unit card, e.g. „Großmeister des Rats“. */
  title?: string;
}

/**
 * Decorative prop on a tile (no rules effect). Rules props (bush, rock, tree, wall, fire) come from the terrain map;
 * a decorative prop on such a tile replaces its default look (e.g. 'campfire' on a fire tile, 'crate' on a rock tile).
 */
export interface BattlePropDef {
  x: number;
  y: number;
  /**
   * Tactics prop id: 'banner-light' | 'banner-dark' | 'campfire' | 'stake' | 'crate' | 'stump' | 'tree-pine' |
   * 'tree-oak' | 'tree-dead' | 'rock' | 'bush' | 'ruin' | 'fire' — or any G.art prop id.
   */
  prop: string;
  variant?: number;
  /** Pixel offset from the tile centre. */
  dx?: number;
  dy?: number;
}

export interface BattleMapDef {
  /** One string per row; digits 0-9 (or a-z for 10+) are height levels. Spaces between cells are allowed. */
  height: string[];
  /**
   * One string per row with terrain chars. Default legend:
   * '.' grass  ',' dirt  ':' stone  's' sand  '~' water  'm' mud  'b' bush  'r' rock  '#' wall/ruin
   * 'T' tree  'f' fire  'x' void (no tile)
   */
  terrain: string[];
  legend?: Record<string, TerrainKind>;
  props?: BattlePropDef[];
  /** Which tree prop 'T' tiles use (default mix of oak and pine). */
  trees?: 'oak' | 'pine' | 'mixed' | 'dead';
}

/** Reinforcements that arrive at the start of a phase. */
export interface WaveDef {
  round: number;
  /** Phase at whose start the wave arrives (default 'player', so the player sees them before they act). */
  phase?: Phase;
  units: BattleUnitDef[];
  /** Optional banner text, e.g. „Verstärkung der Dunkelschatten!“ */
  text?: string;
}

export interface HpTrigger {
  unit: string;
  /** Fires once when hp drops below this value: a fraction (0..1) of max hp, or an absolute value if > 1. */
  below: number;
  run(ctx: BattleCtx, unit: Unit): void | Promise<void>;
}

export interface CustomTrigger {
  id: string;
  /** Checked after every action and at every phase start. */
  when(ctx: BattleCtx): boolean;
  run(ctx: BattleCtx): void | Promise<void>;
  /** Fire only once (default true). */
  once?: boolean;
}

export interface BattleHooks {
  /** After the battlefield is visible, before the first player phase. */
  onStart?(ctx: BattleCtx): void | Promise<void>;
  /** At the start of every phase (after the turn banner). */
  onRound?(ctx: BattleCtx, round: number, phase: Phase): void | Promise<void>;
  onUnitDown?(ctx: BattleCtx, unit: Unit, kind: DownKind): void | Promise<void>;
  onHpBelow?: HpTrigger[];
  triggers?: CustomTrigger[];
  /** After any unit used an ability. */
  onAction?(ctx: BattleCtx, info: { unit: Unit; ability: string; events: BattleEvent[] }): void | Promise<void>;
  /** After any unit moved. */
  onMove?(ctx: BattleCtx, unit: Unit, to: Point): void | Promise<void>;
  /** When a bound unit was freed. */
  onFree?(ctx: BattleCtx, unit: Unit, by: Unit): void | Promise<void>;
}

export interface BattleObjective {
  /** Short line in the objective panel, e.g. „Deckt den Rückzug“. */
  text: string;
  /** Second line with the concrete conditions, e.g. „Überlebe 5 Runden oder besiege alle Feinde“. */
  detail?: string;
  win: WinCondition[];
  lose?: LoseCondition[];
}

export interface BattleDef {
  id: string;
  /** Shown on the start banner, e.g. „Der Hügel von Dunkelhain“. */
  title: string;
  subtitle?: string;
  map: BattleMapDef;
  units: BattleUnitDef[];
  /** Extra or overridden abilities (merged over the standard library in tactics/rules/abilities.ts). */
  abilities?: Record<string, AbilityDef>;
  objective: BattleObjective;
  waves?: WaveDef[];
  hooks?: BattleHooks;
  /** Music mood (default 'battle'; null keeps the current music). */
  music?: MusicMood | null;
  ambience?: AmbienceLayer[];
  /** Sky/backdrop and light grading. */
  backdrop?: 'dusk' | 'night' | 'day' | 'forest';
  /** Tiles marked as goals on the field (defaults to the tiles of reach/escort conditions). */
  goalTiles?: Point[];
  seed?: number;
  /** Initial camera rotation in 90° steps (0..3). */
  rotation?: number;
  /** On defeat: 'retry' (default) offers „Erneut versuchen“; 'end' finishes with outcome 'lose'. */
  onDefeat?: 'retry' | 'end';
  /** Line under the „Sieg“ banner (default: the objective text). */
  victoryText?: string;
  /** Line under the „Niederlage“ banner. */
  defeatText?: string;
  /** Runs after the victory banner, before onEnd. */
  onWin?(ctx: BattleCtx): void | Promise<void>;
  /** Runs after the defeat banner when onDefeat is 'end'. */
  onLose?(ctx: BattleCtx): void | Promise<void>;
}

export interface BattleResult {
  outcome: 'win' | 'lose';
  rounds: number;
  /** Units that died. */
  dead: string[];
  /** Units that ended kampfunfähig. */
  wounded: string[];
  flags: string[];
  /** Number of retries before this result. */
  retries: number;
}

export interface TacticsStartData {
  battle: BattleDef;
  onEnd?: (result: BattleResult) => void | Promise<void>;
  /** Internal: retry counter. */
  retries?: number;
}

export interface HintOptions {
  title?: string;
  /** Unit or tile the hint points at (pulsing marker). */
  unit?: string;
  tile?: Point;
  /**
   * When the hint resolves: 'click' (default, „Verstanden“ button), or when the player does something:
   * 'select' a unit, 'move', 'act', 'endTurn'. A function receives each player event.
   */
  until?: 'click' | 'select' | 'move' | 'act' | 'endTurn' | ((e: { type: string; unit?: string; ability?: string }) => boolean);
}

/** Context handed to hooks. All async calls pause the battle until they resolve. */
export interface BattleCtx {
  readonly ui: UiApi;
  /** The rules engine (read freely; prefer ctx methods for changes so they animate). */
  readonly battle: Battle;
  readonly def: BattleDef;
  readonly round: number;
  readonly phase: Phase;
  unit(id: string): Unit | undefined;
  /** Dialogue line (G.ui.say) while the battle waits. */
  say(speaker: string, text: string, opts?: { portrait?: string; mood?: string }): Promise<void>;
  /** Tutorial hint card in the battle UI. Resolves according to `until`. */
  hint(text: string, opts?: HintOptions): Promise<void>;
  clearHint(): void;
  /** Pans the camera to a unit or tile. */
  focus(target: string | Point, ms?: number): Promise<void>;
  wait(ms: number): Promise<void>;
  /** Big centred banner, e.g. „Verstärkung!“ */
  banner(text: string, sub?: string): Promise<void>;
  /** Speech bubble above a unit. */
  bark(unit: string, text: string, ms?: number): void;
  spawn(units: BattleUnitDef | BattleUnitDef[], opts?: { banner?: string }): Promise<void>;
  remove(unit: string): Promise<void>;
  /** Scripted walk along a path (ignores move points, respects terrain). */
  move(unit: string, to: Point): Promise<void>;
  face(unit: string, facing: Facing): void;
  /** Plays a character pose (e.g. 'kneel', 'cast'); 'idle' returns to normal. */
  pose(unit: string, anim: CharAnim): void;
  damage(unit: string, amount: number): Promise<void>;
  heal(unit: string, amount: number): Promise<void>;
  setStatus(unit: string, status: StatusId, turns: number): Promise<void>;
  /** Forces AI behaviour (null clears). */
  setAi(unit: string, override: AiOverride | null): void;
  setObjective(text: string, detail?: string): void;
  flag(name: string): void;
  hasFlag(name: string): boolean;
  shake(intensity?: number): void;
  /** Ends the battle right after the current hook. */
  win(): void;
  lose(): void;
}

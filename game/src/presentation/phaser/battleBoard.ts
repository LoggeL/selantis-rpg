// Dunkelhain board coordinates used by its scene adapters.
import * as rules from "../../modules/combat/grid";
import { DUNKELHAIN } from "../../content/encounters/dunkelhain";
import type { Cell, Unit } from "../../modules/combat/grid";

export type { BattleBoard, GridLayout, Cell, Side, Unit, Push } from "../../modules/combat/grid";
export { DIRS, eq, key, manhattan, unitAt, dirFromVector } from "../../modules/combat/grid";

export const GRID = { ...DUNKELHAIN.board, ...DUNKELHAIN.layout };
export const ROCK = DUNKELHAIN.board.blocked;
const beam = DUNKELHAIN.abilities.find(ability => ability.id === 'beam')!;
const wave = DUNKELHAIN.abilities.find(ability => ability.id === 'wave')!;
export const MOVE_RANGE = 4;
export const BEAM_LENGTH = beam.range;
export const BEAM_DAMAGE = beam.damage;
export const WAVE_RANGE = wave.range;
export const WAVE_DAMAGE = wave.damage;
export const WAVE_PUSH = wave.push ?? 0;
export const COLLISION_DAMAGE = wave.collisionDamage ?? 0;

const board = (): rules.BattleBoard => ({ cols: GRID.cols, rows: GRID.rows, blocked: ROCK });

export const inside = (c: Cell) => rules.inside(c, board());
export const isRock = (c: Cell) => rules.isBlocked(c, board());
export const cellCenter = (c: Cell) => rules.cellCenter(c, GRID);
export const cellFoot = (c: Cell) => rules.cellFoot(c, GRID);
export const cellAt = (px: number, py: number): Cell | null => rules.cellAt(px, py, board(), GRID);
export const freeCell = (units: Unit[], preferred: Cell): Cell => rules.freeCell(units, preferred, board());
export const reachable = (units: Unit[], from: Cell, range = MOVE_RANGE) => rules.reachable(units, from, range, board());
export const beamCells = (from: Cell, dir: Cell, length = BEAM_LENGTH): Cell[] => rules.beamCells(from, dir, length, board());
export const waveArea = (center: Cell): Cell[] => rules.waveArea(center, board());
export const wavePushes = (units: Unit[], center: Cell, caster: Cell): rules.Push[] => rules.wavePushes(units, center, caster, board(), WAVE_PUSH);
export const boltLine = (from: Cell, to: Cell): Cell[] => rules.boltLine(from, to, board());

import type { Cell, Unit } from "./grid";
import type { BattlePhase } from "./model";
import type { CombatStats } from "../party/stats";

export type Facing = 'n' | 'e' | 's' | 'w';
export type TurnBudget = { moved: boolean; acted: boolean };
export type BattleSnapshot = {
  beat: number; phase: BattlePhase; moved: boolean; acted: boolean; guarding: boolean; facing: Facing;
  units: Array<Unit & { maxHp: number } & CombatStats>;
};
export const freshTurn = (): TurnBudget => ({ moved: false, acted: false });

/** Each turn permits one movement and one action, in either order. */
export function spendTurn(turn: TurnBudget, choice: 'move' | 'act'): TurnBudget | null {
  const field = choice === 'move' ? 'moved' : 'acted';
  return turn[field] ? null : { ...turn, [field]: true };
}

/** Prototype phase order: speed sorts enemies, stable ids break ties. This is not CT. */
export function enemyOrder(units: Unit[], stats: (unit: Unit) => CombatStats): Unit[] {
  return units.filter(u => u.alive && !u.wounded && u.side === 'enemy')
    .sort((a, b) => stats(b).speed - stats(a).speed || a.id.localeCompare(b.id));
}
export const unitSpeed = (unit: Unit, stats: (unit: Unit) => CombatStats): number => stats(unit).speed;

const VECTORS: Record<Facing, Cell> = { n: { x: 0, y: -1 }, e: { x: 1, y: 0 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 } };
export function facingVector(facing: Facing): Cell { return VECTORS[facing]; }
export function facingFromVector(dx: number, dy: number): Facing {
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'e' : 'w') : (dy >= 0 ? 's' : 'n');
}
export function attackAspect(from: Cell, defender: Cell, facing: Facing): 'front' | 'side' | 'back' {
  const axis = VECTORS[facing];
  const dot = (from.x - defender.x) * axis.x + (from.y - defender.y) * axis.y;
  return dot > 0 ? 'front' : dot < 0 ? 'back' : 'side';
}

/** Direction changes the actual damage. Waiting protects only the front. */
export function incomingDamage(attack: number, defense: number, aspect: ReturnType<typeof attackAspect>, guarding = false): number {
  const multiplier = aspect === 'front' ? (guarding ? 0.35 : 0.65) : aspect === 'back' ? 1.35 : 1;
  return Math.max(1, Math.round(Math.max(1, attack - defense / 2) * multiplier));
}

/** Tutorial protection keeps the historical battle playable after failed tactics. */
export function dreamDamage(hp: number, amount: number): { hp: number; damage: number; protected: boolean } {
  const next = Math.max(1, hp - amount);
  return { hp: next, damage: hp - next, protected: next === 1 && amount >= hp };
}


/** Encounter progression is authored as defeated actors or a narrative flag. */
export function encounterBeatComplete(condition: { defeated?: string[]; flag?: string } | undefined, units: Unit[], flags: ReadonlySet<string>): boolean {
  if (!condition) return false;
  return !!condition.flag && flags.has(condition.flag)
    || !!condition.defeated?.length && condition.defeated.every(id => !units.some(unit => unit.id === id && unit.alive && !unit.wounded));
}

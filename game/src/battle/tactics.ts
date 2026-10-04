import type { Cell, Unit } from './grid';
import { resolveBattleUnitStats, type CombatStats } from '../combatStats';
export { TACTICAL_STATS } from '../combatStats';

export type Facing = 'n' | 'e' | 's' | 'w';
export type TurnBudget = { moved: boolean; acted: boolean };
export type BattleSnapshot = {
  beat: number; phase: string; moved: boolean; acted: boolean; guarding: boolean; facing: Facing;
  units: Array<Unit & { maxHp: number } & CombatStats>;
};
export const freshTurn = (): TurnBudget => ({ moved: false, acted: false });

/** Each turn permits one movement and one action, in either order. */
export function spendTurn(turn: TurnBudget, choice: 'move' | 'act'): TurnBudget | null {
  const field = choice === 'move' ? 'moved' : 'acted';
  return turn[field] ? null : { ...turn, [field]: true };
}

/** Prototype phase order: speed sorts enemies, stable ids break ties. This is not CT. */
export function enemyOrder(units: Unit[]): Unit[] {
  return units.filter(u => u.alive && u.side === 'enemy')
    .sort((a, b) => unitSpeed(b) - unitSpeed(a) || a.id.localeCompare(b.id));
}
export const unitSpeed = (unit: Unit): number => resolveBattleUnitStats(unit).speed;

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

/** The introductory dream stays playable even after repeated failed tactics. */
export function dreamDamage(hp: number, amount: number): { hp: number; damage: number; protected: boolean } {
  const next = Math.max(1, hp - amount);
  return { hp: next, damage: hp - next, protected: next === 1 && amount >= hp };
}

export function beatComplete(beat: number, units: Unit[], boltFired: boolean): boolean {
  const alive = (id: string) => units.some(u => u.id === id && u.alive);
  return beat === 1 ? !alive('w1') && !alive('w2') : beat === 2 ? !alive('axe') : beat === 3 ? !alive('xbow') || boltFired : false;
}

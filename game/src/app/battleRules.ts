/** Bind tactical helpers to the authored Dunkelhain encounter. */
export * from '../modules/combat/tactics';
import type { Unit } from "../presentation/phaser/battleBoard";
import { resolveBattleUnitStats } from "./characterRules";
import { DUNKELHAIN } from "../content/encounters/dunkelhain";
import { encounterBeatComplete, enemyOrder as orderByStats, unitSpeed as speedByStats } from "../modules/combat/tactics";
export { TACTICAL_STATS } from "./characterRules";
export const enemyOrder = (units: Unit[]) => orderByStats(units, resolveBattleUnitStats);
export const unitSpeed = (unit: Unit) => speedByStats(unit, resolveBattleUnitStats);

export function beatComplete(beat: number, units: Unit[], boltFired: boolean): boolean {
  return encounterBeatComplete(DUNKELHAIN.beats.find(definition => definition.id === beat)?.complete, units, new Set(boltFired ? ['bolt-fired'] : []));
}

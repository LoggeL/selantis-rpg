import type { BattleBoard, Cell, GridLayout, Unit } from "./grid";

export type AbilityDefinition = {
  id: string;
  targeting: 'line' | 'area';
  range: number;
  rangeStat?: 'attackRange';
  damage: number;
  damageStat?: 'magicAttack';
  radius?: number;
  push?: number;
  collisionDamage?: number;
  cost: 'act';
  protectsAllies: boolean;
  display: { name: string; icon: string; key: string; color: number };
};
export type EnemyRule = {
  strategy: 'melee' | 'bolt';
  target: string;
  intent: 'strike' | 'chop' | 'bolt';
  once?: boolean;
  rescue?: { actor: Unit; event: 'axe-rescue' | 'bolt-rescue'; damage: number };
};
export type EncounterBeat = {
  id: number;
  spawns: Unit[];
  complete: { defeated?: string[]; flag?: string };
  narrative?: string;
};
export type EncounterDefinition = {
  id: string;
  board: BattleBoard;
  layout: GridLayout;
  player: Unit;
  abilities: AbilityDefinition[];
  enemies: Record<string, EnemyRule>;
  beats: EncounterBeat[];
  tutorialProtection: boolean;
  nonlethal: string[];
  narrative?: { protectedUnit: string; protectedCell: Cell; exit: Cell[] };
};

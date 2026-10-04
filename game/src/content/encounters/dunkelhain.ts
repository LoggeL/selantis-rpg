import type { EncounterDefinition } from "../../modules/combat/encounter";

const falke = { id: 'falke', kind: 'falke', side: 'ally', cell: { x: 9, y: 0 }, hp: 30, alive: true } as const;

/** Narrative and balance of the opening battle, separate from the combat engine. */
export const DUNKELHAIN: EncounterDefinition = {
  id: 'dunkelhain',
  board: { cols: 11, rows: 7, blocked: [
    { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
    { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },
  ] },
  layout: { originX: 48, originY: 88, size: 32 },
  player: { id: 'valentus', kind: 'valentus', side: 'valentus', cell: { x: 3, y: 4 }, hp: 100, alive: true },
  tutorialProtection: true,
  nonlethal: ['axe'],
  abilities: [
    { id: 'beam', targeting: 'line', range: 7, rangeStat: 'attackRange', damage: 100, damageStat: 'magicAttack', cost: 'act', protectsAllies: true,
      display: { name: 'Strahl', icon: 'beam', key: 'Q', color: 0x397fc1 } },
    { id: 'wave', targeting: 'area', range: 4, radius: 1, push: 2, damage: 80, collisionDamage: 40, cost: 'act', protectsAllies: true,
      display: { name: 'Druckwelle', icon: 'wave', key: 'R', color: 0x397fc1 } },
  ],
  enemies: {
    w1: { strategy: 'melee', target: 'valentus', intent: 'strike' },
    w2: { strategy: 'melee', target: 'valentus', intent: 'strike' },
    axe: { strategy: 'melee', target: 'boy', intent: 'chop', rescue: { actor: falke, event: 'axe-rescue', damage: 999 } },
    xbow: { strategy: 'bolt', target: 'boy', intent: 'bolt', once: true, rescue: { actor: falke, event: 'bolt-rescue', damage: 999 } },
  },
  beats: [
    { id: 1, spawns: [
      { id: 'w1', kind: 'warrior', side: 'enemy', cell: { x: 8, y: 4 }, hp: 60, alive: true },
      { id: 'w2', kind: 'warrior', side: 'enemy', cell: { x: 10, y: 4 }, hp: 60, speed: 7, alive: true },
    ], complete: { defeated: ['w1', 'w2'] }, narrative: 'Zwei Krieger stürmen heran.' },
    { id: 2, spawns: [
      { id: 'boy', kind: 'boy', side: 'ally', cell: { x: 6, y: 3 }, hp: 20, alive: true },
      { id: 'axe', kind: 'axe', side: 'enemy', cell: { x: 7, y: 3 }, hp: 60, alive: true },
    ], complete: { defeated: ['axe'] }, narrative: 'Ein Junge. Sechzehn? Siebzehn?' },
    { id: 3, spawns: [
      { id: 'xbow', kind: 'crossbow', side: 'enemy', cell: { x: 9, y: 6 }, hp: 40, alive: true },
    ], complete: { defeated: ['xbow'], flag: 'bolt-fired' }, narrative: 'Ein Armbrustschütze legt auf den Jungen an.' },
    { id: 4, spawns: [], complete: {}, narrative: 'boy-escapes' },
  ],
  narrative: { protectedUnit: 'boy', protectedCell: { x: 6, y: 3 }, exit: [{ x: 7, y: 2 }, { x: 8, y: 1 }, { x: 8, y: 0 }] },
};

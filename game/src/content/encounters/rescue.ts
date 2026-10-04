import type { BattleBoard, GridLayout } from '../../modules/combat/grid';

/** This local encounter ends at the rescue; the authored panic burst follows. */
export const RESCUE = {
  board: { cols: 9, rows: 6, blocked: [{ x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 4 }] } satisfies BattleBoard,
  layout: { originX: 20, originY: 86, size: 40 } satisfies GridLayout,
  units: [
    { id: 'lia', name: 'Lia', side: 'ally', cell: { x: 1, y: 3 }, maxHp: 36, move: 3, attack: 0, range: 4, texture: 'lia-travel-walk', frame: 9, display: 56 },
    { id: 'flick', name: 'Flick', side: 'ally', cell: { x: 6, y: 1 }, maxHp: 40, move: 3, attack: 12, range: 4, texture: 'flick-walk', frame: 13, display: 44 },
    { id: 'kyra', name: 'Kyra', side: 'protected', cell: { x: 7, y: 1 }, maxHp: 24, move: 0, attack: 0, range: 0, texture: 'story-actors', frame: 1, display: 56 },
    { id: 'guard', name: 'Wache', side: 'enemy', cell: { x: 6, y: 3 }, maxHp: 28, move: 2, attack: 10, range: 1, texture: 'raid-spearman', frame: 0, display: 56 },
    { id: 'captain', name: 'Vardis', side: 'enemy', cell: { x: 7, y: 4 }, maxHp: 42, move: 1, attack: 12, range: 1, texture: 'warrior', frame: 0, display: 56 },
  ] as const,
};

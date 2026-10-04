import { describe, expect, it } from 'vitest';
import { beamCells, boltLine, cellAt, cellCenter, cellFoot, freeCell, inside, isBlocked, reachable, waveArea, wavePushes, type BattleBoard, type Cell, type Unit } from "./grid";
import * as dunkelhain from "../../presentation/phaser/battleBoard";

const board: BattleBoard = { cols: 4, rows: 3, blocked: [{ x: 1, y: 0 }] };
const enemy = (id: string, cell: Cell): Unit => ({ id, cell, kind: 'warrior', side: 'enemy', hp: 60, alive: true });

describe('configurable combat board', () => {
  it('uses custom bounds, terrain and layout for cell conversion', () => {
    const layout = { originX: 100, originY: 50, size: 20 };
    expect(inside({ x: 3, y: 2 }, board)).toBe(true);
    expect(inside({ x: 4, y: 2 }, board)).toBe(false);
    expect(inside({ x: 3, y: 3 }, board)).toBe(false);
    expect(isBlocked({ x: 1, y: 0 }, board)).toBe(true);
    expect(isBlocked({ x: 0, y: 1 }, board)).toBe(false);
    expect(cellCenter({ x: 3, y: 2 }, layout)).toEqual({ x: 170, y: 100 });
    expect(cellFoot({ x: 3, y: 2 }, layout)).toEqual({ x: 170, y: 110 });
    expect(cellAt(170, 100, board, layout)).toEqual({ x: 3, y: 2 });
    expect(cellAt(180, 100, board, layout)).toBeNull();
    expect(cellAt(99, 50, board, layout)).toBeNull();
  });

  it('finds shortest paths around terrain and active units within the movement budget', () => {
    const blocker = enemy('blocker', { x: 1, y: 1 });
    const paths = reachable([blocker], { x: 0, y: 0 }, 5, board);
    expect(paths.has('1,0')).toBe(false);
    expect(paths.has('1,1')).toBe(false);
    expect(paths.get('2,1')).toEqual([
      { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 },
      { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 },
    ]);
    expect(paths.has('3,1')).toBe(false);
    expect(reachable([{ ...blocker, wounded: true }], { x: 0, y: 0 }, 3, board).has('2,1')).toBe(true);
    for (const path of paths.values()) {
      expect(path.length).toBeLessThanOrEqual(6);
      expect(path.every(cell => inside(cell, board) && !isBlocked(cell, board))).toBe(true);
    }
  });

  it('stops beams at terrain, corners and board edges and limits bolt sightlines', () => {
    expect(beamCells({ x: 0, y: 0 }, { x: 1, y: 0 }, 7, board)).toEqual([]);
    expect(beamCells({ x: 0, y: 0 }, { x: 1, y: 1 }, 7, board)).toEqual([]);
    expect(beamCells({ x: 0, y: 2 }, { x: 1, y: 0 }, 7, board)).toEqual([
      { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
    ]);
    expect(beamCells({ x: 0, y: 2 }, { x: 1, y: 0 }, 1, board)).toEqual([{ x: 1, y: 2 }]);
    expect(boltLine({ x: 0, y: 2 }, { x: 3, y: 1 }, board)).toEqual([
      { x: 1, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 1 },
    ]);
    expect(boltLine({ x: 0, y: 0 }, { x: 3, y: 0 }, board)).toEqual([]);
    expect(boltLine({ x: 3, y: 2 }, { x: 6, y: 2 }, board)).toEqual([]);
  });

  it('chooses nearby free cells deterministically and detects a full board', () => {
    const blocker = enemy('blocker', { x: 0, y: 0 });
    expect(freeCell([blocker], { x: 0, y: 0 }, board)).toEqual({ x: 0, y: 1 });
    expect(freeCell([{ ...blocker, alive: false }], blocker.cell, board)).toEqual(blocker.cell);
    expect(freeCell([{ ...blocker, wounded: true }], blocker.cell, board)).toEqual(blocker.cell);
    const full: BattleBoard = { cols: 1, rows: 1, blocked: [] };
    expect(() => freeCell([blocker], blocker.cell, full)).toThrow('No free battle cell');
  });

  it('clips wave areas to the board and honors the radius', () => {
    expect(waveArea({ x: 0, y: 0 }, board)).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 },
    ]);
    expect(waveArea({ x: 1, y: 1 }, board, 0)).toEqual([{ x: 1, y: 1 }]);
    expect(waveArea({ x: 1, y: 1 }, board, 2)).toHaveLength(12);
  });

  it('reports the previously pushed unit when another victim reaches its new cell', () => {
    const outer = enemy('outer', { x: 2, y: 1 });
    const inner = enemy('inner', { x: 1, y: 1 });
    const roster = [inner, outer];
    const snapshot = structuredClone(roster);
    const pushes = wavePushes(roster, inner.cell, { x: 0, y: 1 }, board);
    expect(pushes.map(push => push.unit.id)).toEqual(['outer', 'inner']);
    expect(pushes[0]).toMatchObject({ path: [{ x: 3, y: 1 }], end: { x: 3, y: 1 }, hitWall: true });
    expect(pushes[1]).toMatchObject({ path: [{ x: 2, y: 1 }], end: { x: 2, y: 1 }, hitWall: false });
    expect(pushes[1].collidedWith).toBe(outer);
    expect(roster).toEqual(snapshot);
  });

  it('limits wave victims and displacement to the supplied radius and distance', () => {
    const far = enemy('far', { x: 2, y: 1 });
    const wounded = { ...enemy('wounded', { x: 1, y: 2 }), wounded: true };
    const ally = { ...enemy('ally', { x: 1, y: 1 }), side: 'ally' as const };
    expect(wavePushes([far, wounded, ally], { x: 0, y: 1 }, { x: 0, y: 2 }, board)).toEqual([]);
    const pushes = wavePushes([far, wounded, ally], { x: 0, y: 1 }, { x: 0, y: 2 }, board, 1, 2);
    expect(pushes).toHaveLength(1);
    expect(pushes[0].path).toEqual([{ x: 3, y: 1 }]);
    expect(pushes[0].hitWall).toBe(false);
  });
});

describe('Dunkelhain compatibility wrappers', () => {
  it('keeps existing encounter defaults and cell geometry', () => {
    expect(dunkelhain.inside({ x: 10, y: 6 })).toBe(true);
    expect(dunkelhain.inside({ x: 11, y: 6 })).toBe(false);
    expect(dunkelhain.isRock({ x: 2, y: 2 })).toBe(true);
    expect(dunkelhain.cellCenter({ x: 0, y: 0 })).toEqual({ x: 64, y: 104 });
    expect(dunkelhain.cellFoot({ x: 0, y: 0 })).toEqual({ x: 64, y: 114 });
    expect(dunkelhain.cellAt(64, 104)).toEqual({ x: 0, y: 0 });
    expect(dunkelhain.reachable([], { x: 3, y: 4 }).has('7,4')).toBe(true);
    expect(dunkelhain.reachable([], { x: 3, y: 4 }).has('8,4')).toBe(false);
    expect(dunkelhain.beamCells({ x: 0, y: 6 }, { x: 1, y: 0 })).toHaveLength(7);
  });
});

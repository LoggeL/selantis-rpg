import { describe, expect, it } from 'vitest';
import { boltLine, isRock, reachable, type Unit } from './grid';
import { attackAspect, beatComplete, dreamDamage, enemyOrder, freshTurn, incomingDamage, spendTurn } from './tactics';

const enemy = (id: string, kind: Unit['kind'] = 'warrior'): Unit => ({ id, kind, side: 'enemy', cell: { x: 8, y: 4 }, hp: 60, alive: true });

describe('tactical turn budget', () => {
  it.each([['move', 'act'], ['act', 'move']] as const)('allows %s then %s exactly once', (first, second) => {
    const once = spendTurn(freshTurn(), first)!;
    expect(spendTurn(once, first)).toBeNull();
    const twice = spendTurn(once, second)!;
    expect(twice).toEqual({ moved: true, acted: true });
    expect(spendTurn(twice, 'move')).toBeNull();
    expect(spendTurn(twice, 'act')).toBeNull();
  });
  it('keeps reachable movement bounded by real steps and terrain obstacles', () => {
    const paths = reachable([], { x: 3, y: 4 }, 4);
    expect(paths.has('7,4')).toBe(true);
    expect(paths.has('8,4')).toBe(false);
    for (const path of paths.values()) expect(path.every(c => !isRock(c)) && path.length <= 5).toBe(true);
  });
});

describe('enemy order and final facing', () => {
  it('orders living enemies by speed with stable ids, without mutating the roster', () => {
    const dead = enemy('dead', 'crossbow'); dead.alive = false;
    const ally = enemy('ally', 'falke'); ally.side = 'ally';
    const units = [enemy('axe', 'axe'), enemy('w2'), dead, enemy('xbow', 'crossbow'), enemy('w1'), ally];
    expect(enemyOrder(units).map(u => u.id)).toEqual(['xbow', 'w1', 'w2', 'axe']);
    expect(units[0].id).toBe('axe');
  });
  it.each([
    ['e', { x: 5, y: 4 }, 'front'], ['e', { x: 3, y: 4 }, 'back'], ['e', { x: 4, y: 3 }, 'side'],
    ['n', { x: 4, y: 3 }, 'front'], ['s', { x: 4, y: 3 }, 'back'], ['w', { x: 3, y: 4 }, 'front'],
  ] as const)('resolves %s facing and %j attack as %s', (facing, from, aspect) => {
    expect(attackAspect(from, { x: 4, y: 4 }, facing)).toBe(aspect);
  });
  it('front guard changes actual damage while leaving sides and back exposed', () => {
    const damage = (aspect: 'front' | 'side' | 'back', guard = false) => incomingDamage(24, 20, aspect, guard);
    expect(damage('front', true)).toBe(5);
    expect(damage('front')).toBe(9);
    expect(damage('side')).toBe(14);
    expect(damage('back')).toBe(19);
    expect(damage('back', true)).toBe(19);
    expect(damage('side', true)).toBe(14);
  });
  it('low HP keeps the opening dream playable without pretending damage was ignored', () => {
    expect(dreamDamage(100, 19)).toEqual({ hp: 81, damage: 19, protected: false });
    expect(dreamDamage(8, 19)).toEqual({ hp: 1, damage: 7, protected: true });
    expect(dreamDamage(1, 19)).toEqual({ hp: 1, damage: 0, protected: true });
  });
});

describe('prologue progression and rescue sightline', () => {
  it('requires both warriors before arrival of the boy, then handles either rescue branch', () => {
    const units = [enemy('w1'), enemy('w2'), enemy('axe', 'axe'), enemy('xbow', 'crossbow')];
    expect(beatComplete(1, units, false)).toBe(false);
    units[0].alive = false; expect(beatComplete(1, units, false)).toBe(false);
    units[1].alive = false; expect(beatComplete(1, units, false)).toBe(true);
    expect(beatComplete(2, units, false)).toBe(false);
    units[2].alive = false; expect(beatComplete(2, units, false)).toBe(true);
    expect(beatComplete(3, units, false)).toBe(false);
    expect(beatComplete(3, units, true)).toBe(true);
    units[3].alive = false; expect(beatComplete(3, units, false)).toBe(true);
  });
  it('reaches a displaced rescue target exactly and never overshoots into unrelated units', () => {
    const line = boltLine({ x: 9, y: 6 }, { x: 7, y: 3 });
    expect(line).toEqual([{ x: 8, y: 5 }, { x: 8, y: 4 }, { x: 7, y: 3 }]);
    expect(boltLine({ x: 4, y: 2 }, { x: 0, y: 2 })).toEqual([{ x: 3, y: 2 }]);
    expect(boltLine({ x: 4, y: 4 }, { x: 4, y: 4 })).toEqual([]);
  });
});

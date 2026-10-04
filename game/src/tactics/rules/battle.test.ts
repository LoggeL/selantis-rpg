import { describe, expect, it } from 'vitest';
import { Battle, COLLIDE_DAMAGE, COLLIDE_OTHER_DAMAGE, FALL_DAMAGE_PER_LEVEL } from './battle';
import { Grid, directionTo } from './grid';
import { pathTo, reachable } from './movement';
import { evaluate } from './objectives';
import { executePlan, planTurn } from './ai';
import type { UnitSpec } from './types';

const flat = (w: number, h: number, ch = '.') => ({ height: Array(h).fill('0'.repeat(w)), terrain: Array(h).fill(ch.repeat(w)) });
const hero = (o: Partial<UnitSpec> = {}): UnitSpec => ({ id: 'hero', name: 'Held', team: 'player', x: 0, y: 0, hp: 20, atk: 3, def: 1, move: 4, jump: 2, abilities: ['schwerthieb', 'handstoss', 'druckwelle', 'strahl', 'schutzwall', 'bolzen'], ...o });
const foe = (o: Partial<UnitSpec> = {}): UnitSpec => ({ id: 'foe', name: 'Feind', team: 'enemy', x: 1, y: 0, hp: 20, atk: 3, def: 1, move: 4, jump: 2, abilities: ['schwerthieb'], ...o });
const make = (units: UnitSpec[], map = flat(6, 6), seed = 3) => {
  const b = new Battle({ grid: Grid.parse(map.height, map.terrain), units, seed });
  b.startPhase('player');
  return b;
};

describe('grid parsing', () => {
  it('parses spaced rows and letters as heights', () => {
    const g = Grid.parse(['0 1 a', '2 3 4'], ['. ~ b', 'r # T']);
    expect(g.cols).toBe(3);
    expect(g.height(2, 0)).toBe(10);
    expect(g.tile(1, 0)!.terrain).toBe('water');
    expect(g.standable(0, 1)).toBe(false);
  });
  it('rejects unknown terrain', () => {
    expect(() => Grid.parse(['0'], ['?'])).toThrow();
  });
  it('line of fire is blocked by walls and high ground', () => {
    const g = Grid.parse(['00000', '00400', '00000'], ['.....', '.....', '..#..']);
    expect(g.hasLineOfFire({ x: 0, y: 1 }, { x: 4, y: 1 })).toBe(false);
    expect(g.hasLineOfFire({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true);
    expect(g.hasLineOfFire({ x: 0, y: 2 }, { x: 4, y: 2 })).toBe(false);
  });
});

describe('movement', () => {
  it('respects move points and terrain cost', () => {
    const map = { height: ['0000', '0000'], terrain: ['.~~.', '....'] };
    const b = make([hero({ move: 3 })], map);
    const r = b.reach('hero');
    expect(r.has('1,0')).toBe(true);   // cost 2
    expect(r.has('2,0')).toBe(false);  // water path 2+2, land path 4
    expect(r.has('2,1')).toBe(true);
  });
  it('cannot climb more than jump, climbing costs extra', () => {
    const map = { height: ['0130', '0000'], terrain: ['....', '....'] };
    const b = make([hero({ jump: 2, move: 6 })], map);
    const r = b.reach('hero');
    expect(r.get('1,0')?.cost).toBe(1);
    expect(r.has('2,0')).toBe(true);
    expect(r.get('2,0')?.cost).toBe(3); // 1 (to h1) + 1 + (3-1-1) = climb 2 from h1 costs 2
    const low = make([hero({ jump: 1, move: 6 })], map).reach('hero');
    expect(low.has('2,0')).toBe(false);
  });
  it('allies can be passed, enemies block, nobody can end on occupied cells', () => {
    const map = { height: ['00000'], terrain: ['.....'] };
    const b = make([hero({ move: 4 }), { ...hero(), id: 'friend', x: 1 }, foe({ x: 3 })], map);
    const r = b.reach('hero');
    expect(r.has('1,0')).toBe(false);
    expect(r.has('2,0')).toBe(true);
    expect(r.has('4,0')).toBe(false);
    expect(pathTo(r, { x: 2, y: 0 })).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  });
  it('move updates facing and supports undo until acting', () => {
    const b = make([hero(), foe({ x: 5, y: 5 })]);
    b.move('hero', { x: 0, y: 3 });
    expect(b.unit('hero').facing).toBe('s');
    expect(b.canUndo('hero')).toBe(true);
    b.undoMove('hero');
    expect(b.unit('hero')).toMatchObject({ x: 0, y: 0, moved: false });
    b.move('hero', { x: 2, y: 0 });
    expect(b.unit('hero').facing).toBe('e');
    b.wait('hero');
    expect(b.canUndo('hero')).toBe(false);
  });
  it('reachable() ignores dead units but wounded bodies block', () => {
    const map = { height: ['000'], terrain: ['...'] };
    const b = make([hero(), foe({ x: 1, nonLethal: true })], map);
    b.knockOut(b.unit('foe'));
    expect(b.unit('foe').down).toBe('wounded');
    expect(reachable(b.grid, b.unit('hero'), b.units).has('2,0')).toBe(false);
  });
});

describe('combat', () => {
  it('flanking: front, side and back', () => {
    const b = make([hero({ x: 2, y: 3 }), foe({ x: 2, y: 2, facing: 's' })]);
    const t = b.unit('foe');
    expect(b.relation({ x: 2, y: 3 }, t)).toBe('front');
    expect(b.relation({ x: 3, y: 2 }, t)).toBe('side');
    expect(b.relation({ x: 2, y: 1 }, t)).toBe('back');
    expect(b.relation({ x: 3, y: 1 }, t)).toBe('back'); // diagonal tie favours the attacker
  });
  it('damage multipliers for back and height are previewed', () => {
    const map = { height: ['000', '000', '000'], terrain: ['...', '...', '...'] };
    const b = make([hero({ x: 1, y: 0 }), foe({ x: 1, y: 1, facing: 's', def: 1 })], map);
    const p = b.preview('hero', 'schwerthieb', { x: 1, y: 1 });
    const base = 2 + 3 - 1;
    expect(p.targets[0].damage).toBe(Math.round(base * 1.5));
    expect(p.targets[0].mods.map(m => m.label)).toContain('Rücken');
    const hill = { height: ['020', '000', '000'], terrain: ['...', '...', '...'] };
    const b2 = make([hero({ x: 1, y: 0 }), foe({ x: 1, y: 1, facing: 'n', def: 1 })], hill);
    const p2 = b2.preview('hero', 'schwerthieb', { x: 1, y: 1 });
    expect(p2.targets[0].damage).toBe(Math.round(base * 1.2));
    expect(p2.targets[0].chance).toBe(84 + 10);
    expect(p2.targets[0].mods.find(m => m.label === 'Höhe')?.text).toBe('+20 %');
  });
  it('bush cover lowers hit chance, guarded halves damage', () => {
    const map = { height: ['000'], terrain: ['.b.'] };
    const b = make([hero(), foe({ x: 1, facing: 'w' })], map);
    expect(b.preview('hero', 'schwerthieb', { x: 1, y: 0 }).targets[0].chance).toBe(84 - 30);
    b.addStatus(b.unit('foe'), 'guarded', 1);
    const p = b.preview('hero', 'schwerthieb', { x: 1, y: 0 }).targets[0];
    expect(p.damage).toBe(2);
    expect(p.mods.some(m => m.label === 'Schutzwall')).toBe(true);
  });
  it('melee cannot reach across big height differences', () => {
    const map = { height: ['03'], terrain: ['..'] };
    const b = make([hero(), foe({ x: 1 })], map);
    expect(b.validTarget('hero', 'schwerthieb', { x: 1, y: 0 })).toBe(false);
  });
  it('ranged range grows with height', () => {
    const map = { height: ['4000000'], terrain: ['.......'] };
    const b = make([hero(), foe({ x: 6 })], map);
    expect(b.validTarget('hero', 'bolzen', { x: 6, y: 0 })).toBe(true); // 5 + floor(4/2)=7
    const flatB = make([hero(), foe({ x: 6 })], { height: ['0000000'], terrain: ['.......'] });
    expect(flatB.validTarget('hero', 'bolzen', { x: 6, y: 0 })).toBe(false);
  });
  it('act rolls deterministically, faces the target and sets cooldowns', () => {
    const run = () => {
      const b = make([hero({ x: 0, y: 1 }), foe({ x: 3, y: 1 }), { ...foe(), id: 'foe2', x: 4, y: 1 }]);
      b.act('hero', 'strahl', { x: 1, y: 1 });
      return b;
    };
    const a = run(), c = run();
    expect(a.unit('foe').hp).toBe(c.unit('foe').hp);
    expect(a.unit('foe').hp).toBeLessThan(20);
    expect(a.unit('foe2').hp).toBeLessThan(20); // pierce
    expect(a.unit('hero').facing).toBe('e');
    expect(a.unit('hero').cooldowns.strahl).toBe(2);
    expect(() => a.act('hero', 'strahl', { x: 1, y: 1 })).toThrow();
  });
  it('wounded instead of dead for non-lethal units', () => {
    const b = make([hero(), foe({ hp: 1, nonLethal: true })]);
    b.act('hero', 'handstoss', { x: 1, y: 0 });
    expect(b.unit('foe').down).toBe('wounded');
    expect(b.unitAt(1, 0)?.id === 'foe' || b.unitAt(2, 0)?.id === 'foe').toBe(true);
  });
});

describe('push', () => {
  it('collides with walls and units', () => {
    const map = { height: ['0000'], terrain: ['...#'] };
    const b = make([hero({ x: 1 }), foe({ x: 2 })], map);
    const p = b.resolvePush(b.unit('foe'), 'e', 1);
    expect(p.collide?.kind).toBe('wall');
    expect(p.collide?.damage).toBe(COLLIDE_DAMAGE);
    const b2 = make([hero({ x: 0 }), foe({ x: 1 }), { ...foe(), id: 'foe2', x: 2 }], map);
    const ev = b2.applyPush(b2.unit('foe'), 'e', 1);
    expect(ev.find(e => e.type === 'push')).toBeTruthy();
    expect(b2.unit('foe').hp).toBe(20 - COLLIDE_DAMAGE);
    expect(b2.unit('foe2').hp).toBe(20 - COLLIDE_OTHER_DAMAGE);
  });
  it('fall damage when pushed off a ledge, water softens it', () => {
    const map = { height: ['3300'], terrain: ['....'] };
    const b = make([hero({ x: 0 }), foe({ x: 1 })], map);
    const p = b.resolvePush(b.unit('foe'), 'e', 1);
    expect(p.drop).toBe(3);
    expect(p.fallDamage).toBe(2 * FALL_DAMAGE_PER_LEVEL);
    const wet = make([hero({ x: 0 }), foe({ x: 1 })], { height: ['3300'], terrain: ['..~.'] });
    expect(wet.resolvePush(wet.unit('foe'), 'e', 1)).toMatchObject({ fallDamage: 0, intoWater: true });
  });
  it('cannot be pushed up a cliff, guarded units do not move', () => {
    const b = make([hero({ x: 0 }), foe({ x: 1 })], { height: ['0020'], terrain: ['....'] });
    expect(b.resolvePush(b.unit('foe'), 'e', 1).collide?.kind).toBe('cliff');
    b.addStatus(b.unit('foe'), 'guarded', 1);
    expect(b.resolvePush(b.unit('foe'), 'e', 1).path).toEqual([]);
  });
  it('druckwelle pushes all adjacent enemies outward', () => {
    const b = make([hero({ x: 2, y: 2 }), foe({ x: 2, y: 1 }), { ...foe(), id: 'f2', x: 3, y: 2 }]);
    b.act('hero', 'druckwelle', { x: 2, y: 2 });
    expect(b.unit('foe')).toMatchObject({ x: 2, y: 0 });
    expect(b.unit('f2')).toMatchObject({ x: 4, y: 2 });
  });
});

describe('phases and statuses', () => {
  it('phase order skips empty teams and advances rounds', () => {
    const b = make([hero(), foe({ x: 5, y: 5 })]);
    expect(b.endPhase()[0]).toMatchObject({ type: 'phase', phase: 'enemy' });
    expect(b.endPhase()[0]).toMatchObject({ type: 'phase', phase: 'player', round: 2 });
    expect(b.completedRounds).toBe(1);
  });
  it('guard lasts until the owner team acts again; stun skips a phase', () => {
    const b = make([hero(), foe({ x: 5, y: 5 })]);
    b.act('hero', 'schutzwall', { x: 0, y: 0 });
    expect(b.has(b.unit('hero'), 'guarded')).toBe(true);
    b.endPhase();
    expect(b.has(b.unit('hero'), 'guarded')).toBe(true);
    b.addStatus(b.unit('hero'), 'stunned', 1);
    b.endPhase();
    expect(b.has(b.unit('hero'), 'guarded')).toBe(false);
    expect(b.canAct('hero')).toBe(false);
  });
  it('bound units are untargetable and can be freed by an adjacent unit', () => {
    const b = make([hero({ abilities: ['befreien', 'schwerthieb'] }), { ...foe(), id: 'kyra', team: 'ally', x: 1, abilities: [], statuses: { bound: Infinity }, freedTeam: 'player' }, foe({ x: 5, y: 5, abilities: ['schwerthieb'] })]);
    expect(b.validTarget('foe', 'schwerthieb', { x: 1, y: 0 })).toBe(false);
    b.act('hero', 'befreien', { x: 1, y: 0 });
    expect(b.unit('kyra').team).toBe('player');
    expect(b.has(b.unit('kyra'), 'bound')).toBe(false);
  });
  it('fire hurts when entered', () => {
    const b = make([hero(), foe({ x: 2, y: 0 })], { height: ['000'], terrain: ['.f.'] });
    b.move('hero', { x: 1, y: 0 });
    expect(b.unit('hero').hp).toBe(17);
  });
});

describe('objectives', () => {
  it('defeatAll, survive, protect, escort', () => {
    const b = make([hero(), foe({ hp: 1 }), { ...hero(), id: 'kyra', x: 0, y: 3 }]);
    expect(evaluate(b, [{ type: 'defeatAll' }])).toBe(null);
    b.act('hero', 'schwerthieb', { x: 1, y: 0 });
    const hit = b.unit('foe').down;
    if (hit) expect(evaluate(b, [{ type: 'defeatAll' }])).toBe('win');
    expect(evaluate(b, [{ type: 'escort', unit: 'kyra', tiles: [{ x: 0, y: 3 }] }])).toBe('win');
    b.knockOut(b.unit('kyra'));
    expect(evaluate(b, [{ type: 'escort', unit: 'kyra', tiles: [{ x: 0, y: 3 }] }], [{ type: 'unitDown', units: ['kyra'] }])).toBe('lose');
    const s = make([hero(), foe({ x: 5, y: 5 })]);
    s.endPhase(); s.endPhase();
    expect(evaluate(s, [{ type: 'survive', rounds: 1 }])).toBe('win');
  });
});

describe('ai', () => {
  it('melee approaches and attacks from behind when possible', () => {
    const b = make([hero({ x: 2, y: 2, facing: 'n' }), foe({ x: 2, y: 5, abilities: ['schwerthieb'] })]);
    b.endPhase();
    const plan = planTurn(b, 'foe');
    expect(plan.action?.ability).toBe('schwerthieb');
    expect(plan.moveTo).toEqual({ x: 2, y: 3 }); // behind the hero facing north
  });
  it('archer prefers high ground and keeps distance', () => {
    const map = { height: ['000000', '000000', '000022', '000022', '000000', '000000'], terrain: Array(6).fill('......') };
    const b = make([hero({ x: 0, y: 0 }), foe({ id: 'xb', x: 3, y: 3, ai: 'archer', abilities: ['bolzen'], move: 3 })], map);
    b.endPhase();
    const plan = planTurn(b, 'xb');
    const dest = plan.moveTo ?? { x: 3, y: 3 };
    expect(b.grid.height(dest.x, dest.y)).toBe(2);
    expect(plan.action?.ability).toBe('bolzen');
  });
  it('taunting units draw attacks', () => {
    const b = make([hero({ x: 1, y: 0 }), { ...hero(), id: 'lia', x: 3, y: 1, hp: 30, statuses: { taunt: 1 } }, foe({ x: 2, y: 0 })]);
    b.endPhase();
    const plan = planTurn(b, 'foe');
    expect(b.unitAt(plan.action!.target.x, plan.action!.target.y)?.id).toBe('lia');
  });
  it('hidden units in bushes are ignored from afar', () => {
    const map = { height: ['00000000'], terrain: ['b.......'] };
    const b = make([hero({ x: 0 }), foe({ x: 7 })], map);
    b.endPhase();
    expect(planTurn(b, 'foe').action).toBe(null);
  });
  it('a full AI-vs-AI skirmish terminates without errors', () => {
    const map = { height: ['00112', '00122', '00011', '00000', '00000'], terrain: ['..b..', '.r...', '.....', '..~~.', '.....'] };
    const b = make([
      hero({ id: 'a', x: 0, y: 0, ai: 'melee', abilities: ['schwerthieb', 'druckwelle'] }),
      hero({ id: 'b', x: 1, y: 0, ai: 'archer', abilities: ['bolzen'] }),
      foe({ id: 'x', x: 4, y: 4, abilities: ['schwerthieb'] }),
      foe({ id: 'y', x: 3, y: 4, abilities: ['axthieb'], nonLethal: true }),
    ], map, 11);
    let outcome = null;
    for (let i = 0; i < 80 && !outcome; i++) {
      for (const u of b.pending()) executePlan(b, planTurn(b, u.id));
      b.endPhase();
      outcome = evaluate(b, [{ type: 'defeatAll' }]);
    }
    expect(outcome).not.toBe(null);
  });
  it('directionTo prefers horizontal on ties', () => {
    expect(directionTo({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe('e');
  });
});

describe('spared prisoners', () => {
  it('enemies cannot harm spared units and blockers crowd them', () => {
    const b = make([
      hero({ id: 'kyra', x: 2, y: 2, tags: ['spared'], abilities: ['schubsen'] }),
      hero({ id: 'lia', x: 0, y: 5 }),
      foe({ x: 2, y: 3, abilities: ['schwerthieb'] }),
      foe({ id: 'f2', x: 5, y: 5, abilities: ['schwerthieb'] }),
    ]);
    b.endPhase();
    expect(b.validTarget('foe', 'schwerthieb', { x: 2, y: 2 })).toBe(false);
    b.aiOverrides.set('f2', { block: 'kyra', goal: { x: 0, y: 2 } });
    const plan = planTurn(b, 'f2');
    const dest = plan.moveTo!;
    expect(Math.abs(dest.x - 2) + Math.abs(dest.y - 2)).toBeLessThanOrEqual(2);
    expect(plan.action === null || b.unitAt(plan.action.target.x, plan.action.target.y)?.id !== 'kyra').toBe(true);
  });
});

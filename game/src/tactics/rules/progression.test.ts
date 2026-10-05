import { describe, expect, it } from 'vitest';
import { Battle, makeUnit } from './battle';
import { Grid } from './grid';
import { AP_TO_MASTER, awardProgress, normalizeProgress, progressOf, restoreProgress } from './progression';
import type { UnitSpec } from './types';

const spec = (id: string, team: UnitSpec['team'], speed: number, x: number): UnitSpec => ({
  id, name: id, team, speed, x, y: 0, hp: 30, abilities: ['schwerthieb'],
});
const battle = (units: UnitSpec[]) => new Battle({
  grid: Grid.parse(['000000', '000000'], ['......', '......']), units, turnMode: 'speed',
});

describe('speed turns', () => {
  it('interleaves both teams by speed and forbids commands for another character', () => {
    const b = battle([spec('slow', 'player', 3, 0), spec('enemy', 'enemy', 7, 1), spec('fast', 'player', 9, 2)]);
    b.startTurns();
    expect(b.turnOrder().map(u => u.id)).toEqual(['fast', 'enemy', 'slow']);
    expect(b.pending().map(u => u.id)).toEqual(['fast']);
    expect(b.canAct('slow')).toBe(false);
    expect(() => b.wait('slow')).toThrow();
    expect(() => b.act('slow', 'schwerthieb', { x: 1, y: 0 })).toThrow();
    b.advanceTurn(); expect(b.activeUnit).toBe('enemy');
    b.advanceTurn(); expect(b.activeUnit).toBe('slow');
    expect(b.completedRounds).toBe(0);
    b.advanceTurn(); expect(b.completedRounds).toBe(1); expect(b.round).toBe(2);
    expect(b.activeUnit).toBe('fast');
  });
  it('breaks equal speeds deterministically and skips units defeated before their turn', () => {
    const b = battle([spec('z', 'player', 5, 0), spec('a', 'enemy', 5, 1), spec('b', 'player', 5, 2)]);
    b.startTurns(); expect(b.activeUnit).toBe('a');
    b.knockOut(b.unit('b'));
    b.advanceTurn(); expect(b.activeUnit).toBe('z');
  });
  it('ticks cooldowns and stun only on the owner turn', () => {
    const b = battle([spec('hero', 'player', 8, 0), spec('foe', 'enemy', 4, 1)]);
    b.startTurns(); b.unit('hero').cooldowns.schwerthieb = 2;
    b.addStatus(b.unit('foe'), 'stunned', 1);
    b.advanceTurn();
    expect(b.unit('hero').cooldowns.schwerthieb).toBe(2);
    expect(b.pending()).toEqual([]); expect(b.unit('foe').statuses.stunned).toBeUndefined();
    b.advanceTurn(); expect(b.unit('hero').cooldowns.schwerthieb).toBe(1);
  });
  it('adds reinforcements and freed prisoners at the next round', () => {
    const b = battle([spec('hero', 'player', 8, 0), spec('foe', 'enemy', 4, 1), {
      ...spec('prisoner', 'ally', 12, 2), statuses: { bound: Infinity },
    }]);
    b.startTurns(); b.spawn(spec('new', 'enemy', 15, 3));
    b.removeStatus(b.unit('prisoner'), 'bound'); b.unit('prisoner').team = 'player';
    expect(b.turnOrder().map(u => u.id)).toEqual(['hero', 'foe']);
    b.advanceTurn(); b.advanceTurn();
    expect(b.turnOrder().map(u => u.id)).toEqual(['new', 'prisoner', 'hero', 'foe']);
  });
});

describe('character growth and weapons', () => {
  it('levels repeatedly, preserves EXP remainder, grows stats and stops at the cap', () => {
    const u = makeUnit(spec('hero', 'player', 5, 0));
    const events = awardProgress(u, 230);
    expect(u).toMatchObject({ level: 3, exp: 30, maxHp: 36, hp: 36, maxMp: 28, atk: 4, def: 1 });
    expect(events.filter(e => e.type === 'level')).toHaveLength(2);
    awardProgress(u, 10000); expect(u.level).toBe(50); expect(u.exp).toBe(0);
    const hp = u.maxHp; awardProgress(u, 100); expect(u.maxHp).toBe(hp);
  });
  it('does not revive downed characters through level rewards', () => {
    const u = makeUnit(spec('hero', 'player', 5, 0)); u.hp = 0; u.down = 'wounded';
    awardProgress(u, 100); expect(u.hp).toBe(0); expect(u.down).toBe('wounded');
  });
  it('locks skills to their weapon until mastery and retains them after a swap', () => {
    const b = battle([{ ...spec('hero', 'player', 8, 0), abilities: ['bogen', 'messer', 'befreien'], weapon: 'jagdbogen', weapons: ['jagdbogen', 'jagdmesser'] }, spec('foe', 'enemy', 4, 1)]);
    b.startTurns(); const u = b.unit('hero');
    expect(b.abilityReady(u, 'messer')).toBe(false); expect(b.abilityReady(u, 'bogen')).toBe(true);
    expect(b.abilityReady(u, 'befreien')).toBe(true);
    awardProgress(u, 0, AP_TO_MASTER);
    expect(u.mastered).toContain('bogen');
    b.equip('hero', 'jagdmesser'); expect(b.abilityReady(u, 'bogen')).toBe(true);
    expect(b.abilityReady(u, 'messer')).toBe(true);
    b.move('hero', { x: 0, y: 1 }); expect(() => b.equip('hero', 'jagdbogen')).toThrow();
    expect(() => b.equip('hero', 'axt')).toThrow();
  });
  it('spends MP atomically, rejects unaffordable spells, recovers MP on the owner turn', () => {
    const b = battle([{ ...spec('hero', 'player', 8, 0), abilities: ['strahl'], mp: 6, maxMp: 10 }, spec('foe', 'enemy', 4, 1)]);
    b.startTurns(); const u = b.unit('hero'); expect(u.mp).toBe(8);
    expect(() => b.act('hero', 'strahl', { x: 0, y: 1 })).toThrow(); expect(u.mp).toBe(8);
    b.act('hero', 'strahl', { x: 1, y: 0 }); expect(u.mp).toBe(2);
    b.advanceTurn(); expect(u.mp).toBe(2);
    b.advanceTurn(); expect(u.mp).toBe(4); u.cooldowns.strahl = 0;
    expect(b.abilityReady(u, 'strahl')).toBe(false);
    expect(() => b.act('hero', 'strahl', { x: 1, y: 0 })).toThrow(); expect(u.acted).toBe(false);
  });
  it('awards one EXP/AP reward for a multi-hit attack and none for waiting', () => {
    const b = battle([{ ...spec('hero', 'player', 8, 0), abilities: ['doppelhieb'], weapon: 'kurzschwerter' }, spec('foe', 'enemy', 4, 1)]);
    b.startTurns();
    b.abilities.doppelhieb = { ...b.ability('doppelhieb'), alwaysHits: true };
    const events = b.act('hero', 'doppelhieb', { x: 1, y: 0 });
    expect(events.filter(e => e.type === 'strike')).toHaveLength(2);
    expect(b.unit('hero').exp).toBe(10); expect(b.unit('hero').abilityAp.doppelhieb).toBe(10);
    b.wait('hero'); expect(b.unit('hero').exp).toBe(10);
  });
  it('restores campaign growth without accumulating stat bonuses across battles', () => {
    const original = { ...spec('hero', 'player', 5, 0), abilities: ['bogen', 'messer'] };
    const u = makeUnit(restoreProgress(original)); awardProgress(u, 230, 50);
    const saved = progressOf(u);
    const next = makeUnit(restoreProgress(original, saved));
    expect(next).toMatchObject({ level: u.level, exp: u.exp, maxHp: u.maxHp, maxMp: u.maxMp, atk: u.atk, def: u.def, speed: u.speed });
    expect(next.mastered).toEqual(u.mastered); expect(next.abilityAp).toEqual(u.abilityAp);
    const again = makeUnit(restoreProgress(original, progressOf(next))); expect(again.maxHp).toBe(next.maxHp);
  });
  it('sanitizes malformed saves and discards skills unknown to the weapon catalogue', () => {
    expect(normalizeProgress({ level: -1, exp: Infinity, weapon: 'toString', mastered: ['bogus', 'bogen'], abilityAp: { bogen: 999 } }))
      .toEqual({ level: 1, exp: 0, weapon: null, mastered: ['bogen'], abilityAp: { bogen: 50 } });
  });
  it('restores growth relative to authored starting levels and MP', () => {
    const original = { ...spec('hero', 'player', 5, 0), level: 4, mp: 12 };
    const u = makeUnit(original); awardProgress(u, 210);
    const next = makeUnit(restoreProgress(original, progressOf(u)));
    expect(next).toMatchObject({ maxMp: u.maxMp, def: u.def, speed: u.speed, level: 6 });
  });
});

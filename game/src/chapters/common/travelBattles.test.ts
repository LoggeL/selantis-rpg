import { describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { Battle, makeUnit } from '../../tactics/rules/battle';
import { executePlan, planTurn } from '../../tactics/rules/ai';
import { Grid } from '../../tactics/rules/grid';
import { evaluate } from '../../tactics/rules/objectives';
import { restoreProgress, withEquipment } from '../../tactics/rules/progression';
import type { BattleDef } from '../../tactics/api';
import { dunkelhain } from '../prolog/schlacht';
import { EARLY_PROGRESS, earlyProgress, escortEncounter, forestEncounter, onwardEncounter } from './travelBattles';

function build(def: BattleDef, seed = def.seed, turnMode: 'phases' | 'speed' = 'phases'): Battle {
  return new Battle({ grid: Grid.parse(def.map.height, def.map.terrain),
    units: def.units.map(withEquipment), abilities: def.abilities, seed, progression: def.progression, turnMode });
}

describe('travel battles and campaign pace', () => {
  it('gives Lia Vaters Dolch from her first fight and unlocks her light only after learning it on the continuation', () => {
    G.state.reset();
    for (const def of [forestEncounter(), escortEncounter(), onwardEncounter(0), onwardEncounter(7)]) {
      const b = build(def, def.seed, 'speed');
      expect(b.units.length).toBe(def.units.length);
      expect(b.living('player').length).toBeGreaterThanOrEqual(3);
      expect(b.unit('lia').attack, def.id).toBe('dolch');
      expect(b.unit('lia').traits.map(t => t.id), def.id).toEqual(['verzweiflung']);
    }
    expect(forestEncounter().units.find(u => u.id === 'lia')).toMatchObject({ level: 1, abilities: ['steinwurf'] });
    expect(escortEncounter().units.find(u => u.id === 'lia')!.level).toBe(2);
    G.state.give('tincture'); G.state.learn('ausweichen'); G.state.learn('ablenken');
    expect(forestEncounter().units.find(u => u.id === 'lia')!.abilities).toEqual(['ausweichen', 'ablenken', 'steinwurf', 'versorgen']);
    expect(onwardEncounter(0).units.find(u => u.id === 'lia')!.abilities).not.toContain('lichtstoss');
    G.state.learn('lichtstoss');
    expect(onwardEncounter(2).units.find(u => u.id === 'lia')).toMatchObject({ level: 4, abilities: expect.arrayContaining(['lichtstoss']) });
    G.state.reset();
  });

  it('grows Lia by at most one level per early fight, including the victory bonus', () => {
    const b = new Battle({ grid: Grid.parse(['00'], ['..']), progression: earlyProgress('k2-wegelagerer'),
      units: [{ id: 'lia', name: 'Lia', team: 'player', x: 0, y: 0, level: 1, exp: 0, hp: 16, abilities: ['ausweichen'], weapon: 'vatersdolch' }] });
    for (let n = 0; n < 40; n++) {
      b.startPhase('player'); b.unit('lia').cooldowns = {};
      b.act('lia', 'ausweichen', { x: 0, y: 0 });
    }
    b.rewardVictory('lia');
    expect(b.unit('lia')).toMatchObject({ level: 2, exp: 0 });
    expect(b.unit('lia').abilityAp.dolch).toBe(12);
    expect(b.unit('lia').mastered).toEqual([]);
    const next = new Battle({ grid: b.grid, progression: earlyProgress('k3-begleitung'),
      units: [{ id: 'lia', name: 'Lia', team: 'player', x: 0, y: 0, level: 2, exp: 95, hp: 19, abilities: [] }] });
    next.rewardVictory('lia');
    expect(next.unit('lia')).toMatchObject({ level: 3, exp: 0 });
  });

  it('caps the repeatable road so it cannot be farmed endlessly', () => {
    G.state.reset();
    const def = onwardEncounter(5);
    const b = build(def);
    const lia = b.unit('lia');
    lia.level = 6; lia.exp = 0;
    for (let n = 0; n < 5; n++) b.rewardVictory('lia');
    expect(lia).toMatchObject({ level: 6, exp: 0 });
    expect(def.progression!.budgets!.kyra.maxLevel).toBeDefined();
  });

  it('makes Verzweiflung strengthen the dagger at half HP or below, and only then', () => {
    G.state.reset();
    const def = forestEncounter(), b = build(def);
    const lia = b.unit('lia'), foe = b.unit('raeuber-1');
    const from = { x: foe.x - 1, y: foe.y };
    const calm = b.previewTarget(lia, b.ability('dolch'), foe, from);
    expect(calm.damage).toBe(5); // a level-1 bandit (10 HP) needs two stabs
    expect(calm.mods.map(m => m.label)).not.toContain('Verzweiflung');
    lia.hp = Math.floor(lia.maxHp / 2);
    const desperate = b.previewTarget(lia, b.ability('dolch'), foe, from);
    expect(desperate.damage).toBe(7);
    expect(desperate.chance).toBe(Math.min(100, calm.chance + 10));
    expect(desperate.mods.find(m => m.label === 'Verzweiflung')).toMatchObject({ text: '+10 % · Schaden +2', kind: 'good' });
    // Thrown stones are not part of it.
    expect(b.previewTarget(lia, b.ability('steinwurf'), foe, { x: foe.x - 2, y: foe.y }).damage).toBe(1);
  });

  it('keeps the first encounter forgiving across several seeds', () => {
    for (const seed of [1, 2, 3, 11, 23]) {
      const def = forestEncounter(), b = build(def, seed);
      for (const u of b.units) if (u.team === 'player') u.ai = u.id === 'foltan' || u.id === 'lia' ? 'melee' : 'support';
      b.startPhase('player');
      let outcome = null;
      for (let n = 0; n < 50 && !outcome; n++) {
        for (const u of b.pending()) executePlan(b, planTurn(b, u.id));
        outcome = evaluate(b, def.objective.win, def.objective.lose);
        if (!outcome) b.endPhase();
      }
      expect(outcome, `seed ${seed}`).toBe('win');
      expect(b.unit('lia').level).toBeLessThanOrEqual(2);
    }
  });

  it('retains the travel progression without a premature power jump, and lifts a lower save to the battle floor', () => {
    const spec = forestEncounter().units.find(u => u.id === 'lia')!;
    const lia = makeUnit(restoreProgress(spec, { level: 2, exp: 60, weapon: null, mastered: [], abilityAp: {} }));
    expect(lia).toMatchObject({ level: 2, hp: 19, atk: 3, exp: 60, weapon: 'vatersdolch', attack: 'dolch' });
    const late = onwardEncounter(0).units.find(u => u.id === 'lia')!;
    expect(makeUnit(restoreProgress(late, { level: 2, exp: 10, weapon: null, mastered: [], abilityAp: {} }))).toMatchObject({ level: 4, hp: 25 });
  });

  it('also caps the early companions when support actions are repeated', () => {
    const b = new Battle({ grid: Grid.parse(['000'], ['...']), progression: EARLY_PROGRESS,
      units: ['foltan', 'azar', 'reisender'].map((id, x) => ({ id, name: id, team: 'player', x, y: 0, hp: 20, abilities: ['ausweichen'], weapon: 'schwert' })) });
    for (let n = 0; n < 40; n++) {
      b.startPhase('player');
      for (const u of b.units) { u.cooldowns = {}; b.act(u.id, 'ausweichen', { x: u.x, y: 0 }); }
    }
    for (const u of b.units) b.rewardVictory(u.id);
    for (const id of ['foltan', 'azar']) {
      expect(b.unit(id).exp).toBe(30);
      expect(b.unit(id).abilityAp.schwerthieb).toBe(8);
      expect(b.unit(id).mastered).toEqual([]);
    }
    expect(b.unit('reisender').exp).toBe(0);
  });

  it('lets the escort reach safety and the rescued trio clear their first route', () => {
    G.state.reset(); G.state.give('dagger');
    for (const def of [escortEncounter(), onwardEncounter(0)]) {
      const b = build(def, def.seed, 'speed');
      if (def.id === 'k3-begleitung') expect(b.unit('reisender').attack).toBe(null);
      for (const u of b.units) if (u.team === 'player') {
        b.aiOverrides.set(u.id, u.id === 'reisender' ? { profile: 'flee', goal: { x: 7, y: 2 } }
          : { profile: u.id === 'foltan' || u.id === 'kyra' || u.id === 'lia' ? 'melee' : u.id === 'flick' ? 'archer' : 'support' });
      }
      b.startTurns();
      let outcome = null;
      for (let n = 0; n < 160 && !outcome; n++) {
        const u = b.unit(b.activeUnit!);
        executePlan(b, planTurn(b, u.id));
        outcome = evaluate(b, def.objective.win, def.objective.lose);
        if (!outcome) b.advanceTurn();
      }
      expect(outcome, def.id).toBe('win');
    }
    G.state.reset();
  });

  it('makes young Baris dangerous to the Falcon while Valentus remains clearly stronger', () => {
    const baris = dunkelhain.waves![0].units.find(u => u.id === 'baris')!;
    const def = { ...dunkelhain, units: [...dunkelhain.units, baris] };
    const b = build(def);
    const young = b.unit('baris'), falcon = b.unit('falke'), master = b.unit('valentus');
    expect(young.level).toBeGreaterThan(falcon.level);
    expect(master.level).toBeGreaterThan(young.level);
    expect(b.previewTarget(young, b.ability('axthieb'), falcon).damage).toBeGreaterThanOrEqual(10);
    expect(b.previewTarget(master, b.ability('handstoss'), young).damage).toBeGreaterThan(b.previewTarget(falcon, b.ability('doppelhieb'), young).damage * 2);
    expect(b.unit('ds-1').level).toBe(7);
  });
});

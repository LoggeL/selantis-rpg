import { describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { Battle, makeUnit } from '../../tactics/rules/battle';
import { executePlan, planTurn } from '../../tactics/rules/ai';
import { Grid } from '../../tactics/rules/grid';
import { evaluate } from '../../tactics/rules/objectives';
import { restoreProgress, withEquipment } from '../../tactics/rules/progression';
import type { BattleDef } from '../../tactics/api';
import { dunkelhain } from '../prolog/schlacht';
import { EARLY_PROGRESS, escortEncounter, forestEncounter, onwardEncounter } from './travelBattles';

function build(def: BattleDef, seed = def.seed, turnMode: 'phases' | 'speed' = 'phases'): Battle {
  return new Battle({ grid: Grid.parse(def.map.height, def.map.terrain),
    units: def.units.map(withEquipment), abilities: def.abilities, seed, progression: def.progression, turnMode });
}

describe('travel battles and campaign pace', () => {
  it('keeps early Lia modest and unlocks her light only after learning it on the continuation', () => {
    G.state.reset();
    for (const def of [forestEncounter(), escortEncounter(), onwardEncounter(0), onwardEncounter(7)]) {
      const b = build(def, def.seed, 'speed');
      expect(b.units.length).toBe(def.units.length);
      expect(b.living('player').length).toBeGreaterThanOrEqual(3);
    }
    expect(forestEncounter().units.find(u => u.id === 'lia')!.abilities).not.toContain('dolch');
    expect(onwardEncounter(0).units.find(u => u.id === 'lia')!.abilities).not.toContain('lichtstoss');
    G.state.learn('lichtstoss');
    expect(onwardEncounter(2).units.find(u => u.id === 'lia')!.abilities).toContain('lichtstoss');
    G.state.reset();
  });

  it('bounds support EXP within an early fight, including the victory bonus', () => {
    const b = new Battle({ grid: Grid.parse(['00'], ['..']), progression: EARLY_PROGRESS,
      units: [{ id: 'lia', name: 'Lia', team: 'player', x: 0, y: 0, level: 2, exp: 0, hp: 17, abilities: ['ausweichen'], weapon: 'vatersdolch' }] });
    for (let n = 0; n < 40; n++) {
      b.startPhase('player'); b.unit('lia').cooldowns = {};
      b.act('lia', 'ausweichen', { x: 0, y: 0 });
    }
    b.rewardVictory('lia');
    expect(b.unit('lia')).toMatchObject({ level: 2, exp: 30 });
    expect(b.unit('lia').abilityAp.dolch).toBe(8);
    expect(b.unit('lia').mastered).toEqual([]);
    const next = new Battle({ grid: b.grid, progression: EARLY_PROGRESS,
      units: [{ id: 'lia', name: 'Lia', team: 'player', x: 0, y: 0, level: 2, exp: 95, hp: 17, abilities: [] }] });
    next.rewardVictory('lia');
    expect(next.unit('lia')).toMatchObject({ level: 3, exp: 0 });
  });

  it('keeps the first encounter forgiving across several seeds', () => {
    for (const seed of [1, 2, 3, 11, 23]) {
      const def = forestEncounter(), b = build(def, seed);
      for (const u of b.units) if (u.team === 'player') u.ai = u.id === 'foltan' ? 'melee' : 'support';
      b.startPhase('player');
      let outcome = null;
      for (let n = 0; n < 50 && !outcome; n++) {
        for (const u of b.pending()) executePlan(b, planTurn(b, u.id));
        outcome = evaluate(b, def.objective.win, def.objective.lose);
        if (!outcome) b.endPhase();
      }
      expect(outcome, `seed ${seed}`).toBe('win');
      expect(b.unit('lia').level).toBe(2);
    }
  });

  it('retains the travel progression in the rescue character without a premature power jump', () => {
    const spec = forestEncounter().units.find(u => u.id === 'lia')!;
    const lia = makeUnit(restoreProgress(spec, { level: 2, exp: 60, weapon: null, mastered: [], abilityAp: {} }));
    expect(lia).toMatchObject({ level: 2, hp: 17, atk: 2, exp: 60 });
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
          : { profile: u.id === 'foltan' || u.id === 'kyra' || u.id === 'lia' && u.abilities.includes('dolch') ? 'melee' : u.id === 'flick' ? 'archer' : 'support' });
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

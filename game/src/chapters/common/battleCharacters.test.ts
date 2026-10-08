import { describe, expect, it } from 'vitest';
import { makeUnit } from '../../tactics/rules/battle';
import { dunkelhain } from '../prolog/schlacht';
import { dunkelhainBattle, rescueBattle as demoRescue, sandboxBattle } from '../dev-tactics';
import { rescueBattle } from '../kapitel-5/rettung';
import { characterStats } from './battleCharacters';

describe('campaign character levels', () => {
  it('uses the same character attributes in story battles and demos', () => {
    const rescue = rescueBattle(2, true);
    for (const def of [dunkelhain, dunkelhainBattle, demoRescue, sandboxBattle, rescue]) {
      for (const spec of [...def.units, ...(def.waves ?? []).flatMap(w => w.units)]) {
        expect(spec.baseStats, `${def.id}/${spec.id}`).toBeDefined();
        expect(spec.level, `${def.id}/${spec.id}`).toBeGreaterThan(0);
      }
    }
    const stats = (def: typeof dunkelhain, id: string) => makeUnit(def.units.find(u => u.id === id)!);
    expect(stats(dunkelhain, 'valentus')).toMatchObject({ level: 20, hp: 87, maxMp: 62, atk: 22, def: 11, speed: 9 });
    expect(stats(sandboxBattle, 'valentus')).toMatchObject({ level: 20, hp: 87, maxMp: 62, atk: 22, def: 11, speed: 9 });
    expect(stats(dunkelhain, 'falke')).toMatchObject({ level: 7, hp: 44, maxMp: 16, atk: 9, def: 5, speed: 8 });
    expect(stats(rescue, 'flick')).toMatchObject({ level: 8, hp: 39, maxMp: 20, atk: 10, def: 4, speed: 9 });
    expect(makeUnit({ ...characterStats('lia'), id: 'lia', name: 'Lia', team: 'player', x: 0, y: 0, abilities: [] }))
      .toMatchObject({ level: 1, hp: 16, maxMp: 8, atk: 2, def: 1, speed: 6 });
    // The rescue's level floor is 3 (K2 1→2, K3 2→3): weak, but a real fighter with Vaters Dolch.
    expect(stats(rescue, 'lia')).toMatchObject({ level: 3, hp: 22, maxMp: 12, atk: 4, def: 2, speed: 6, attack: 'dolch' });
    expect(stats(rescue, 'kyra')).toMatchObject({ level: 1, hp: 12, maxMp: 10, atk: 2, def: 0, speed: 6 });
    expect(stats(rescue, 'algard')).toMatchObject({ level: 5, hp: 26, atk: 6, def: 3 });
  });
  it('keeps the paladins wounded and gives later Baris stronger attributes', () => {
    const paladin = makeUnit(dunkelhain.units.find(u => u.id === 'verwundeter-1')!);
    expect(paladin).toMatchObject({ level: 8, hp: 25, maxHp: 43 });
    const young = makeUnit({ ...characterStats('baris-young'), id: 'young', name: 'Baris', team: 'enemy', x: 0, y: 0, abilities: [] });
    const captain = makeUnit({ ...characterStats('baris'), id: 'captain', name: 'Baris', team: 'enemy', x: 0, y: 0, abilities: [] });
    expect(young).toMatchObject({ level: 14, hp: 63, atk: 17, def: 8 });
    expect(captain).toMatchObject({ level: 16, hp: 69, atk: 19, def: 9 });
  });
});

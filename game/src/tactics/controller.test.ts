import { describe, expect, it } from 'vitest';
import { BattleController, type Presenter } from './controller';
import type { BattleDef } from './api';
import type { UiApi } from '../ui/api';
import type { CharacterProgress } from './rules/progression';

describe('speed battle flow', () => {
  it('runs each team hook once per round and commits growth on victory', async () => {
    const turns: string[] = [], hooks: string[] = [];
    const saves = new Map<string, CharacterProgress>();
    const def: BattleDef = {
      id: 'flow', title: 'Flow', map: { height: ['000'], terrain: ['...'] },
      units: [
        { id: 'fast', name: 'fast', team: 'player', x: 0, y: 0, hp: 10, speed: 9, abilities: ['dolch'] },
        { id: 'foe', name: 'foe', team: 'enemy', x: 1, y: 0, hp: 10, speed: 6, abilities: [], ai: 'passive' },
        { id: 'slow', name: 'slow', team: 'player', x: 2, y: 0, hp: 10, speed: 3, abilities: [] },
      ],
      objective: { text: 'Survive', win: [{ type: 'survive', rounds: 2 }] },
      hooks: { onRound: (ctx, round, phase) => { hooks.push(`${round}:${phase}`); expect(ctx.battle.activeUnit).toBeTruthy(); } },
    };
    let c: BattleController;
    const p = {
      startBanner: async () => {}, phaseBanner: async () => { turns.push(c.battle.activeUnit!); },
      play: async () => {}, refresh: () => {}, endPlayerPhase: () => {}, clearHint: () => {},
      beginPlayerPhase: () => c.endTurn(), wait: async () => {}, outcome: async () => 'continue',
    } as unknown as Presenter;
    c = new BattleController(def, p, {} as UiApi, () => {}, 0, {
      get: id => id === 'fast' ? { level: 1, exp: 95, weapon: 'vatersdolch', mastered: [], abilityAp: {} } : undefined,
      set: (id, value) => { saves.set(id, value); },
    });
    await c.run();
    expect(turns).toEqual(['fast', 'foe', 'slow', 'fast', 'foe', 'slow']);
    expect(hooks).toEqual(['1:player', '1:enemy', '2:player', '2:enemy']);
    expect(saves.get('fast')).toMatchObject({ level: 2, exp: 15 }); expect(saves.has('foe')).toBe(false);
  });
  it('discards uncommitted EXP when retrying a defeat', async () => {
    let commits = 0, result: unknown;
    const p = { startBanner: async () => {}, play: async () => {}, endPlayerPhase: () => {}, clearHint: () => {}, outcome: async () => 'retry' } as unknown as Presenter;
    const c = new BattleController({
      id: 'retry', title: 'Retry', map: { height: ['00'], terrain: ['..'] },
      units: [{ id: 'hero', name: 'hero', team: 'player', x: 0, y: 0, hp: 10, abilities: [] }],
      objective: { text: 'Lose', win: [], lose: [{ type: 'flag', flag: 'lost' }] },
      hooks: { onStart: ctx => { ctx.unit('hero')!.exp = 90; ctx.flag('lost'); } },
    }, p, {} as UiApi, r => { result = r; }, 0, { get: () => undefined, set: () => { commits++; } });
    await c.run(); expect(result).toBe('retry'); expect(commits).toBe(0);
  });
});

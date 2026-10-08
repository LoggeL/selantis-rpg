import { describe, expect, it } from 'vitest';
import { GameState } from '../../core/state';
import { completeScouting, updateScoutObjective } from './scoutObjective';

describe('Schattenlager scouting journal', () => {
  it('updates the final count before completing the task and activating the return route', () => {
    const state = new GameState();
    const targets: unknown[] = [];
    const world = {
      setObjective(id: string, text: string, target?: unknown) { state.objective(id, text); targets.push(target); },
      completeObjective(id: string) {
        expect(state.data.objectives.find(o => o.id === id)?.text).toContain('(3/3)');
        state.complete(id);
      },
    };
    updateScoutObjective(world, state);
    expect(state.activeObjective()?.text).toContain('(0/3)');
    expect(targets.at(-1)).toBe('felsen');
    state.set('k5-sp-felsen');
    updateScoutObjective(world, state);
    expect(state.activeObjective()?.text).toContain('(1/3)');
    expect(targets.at(-1)).toBe('stamm');
    state.set('k5-sp-stamm');
    updateScoutObjective(world, state);
    expect(state.activeObjective()?.text).toContain('(2/3)');
    expect(targets.at(-1)).toEqual([888, 492]);
    state.set('k5-lauschen');
    completeScouting(world, state);
    expect(state.data.objectives.find(o => o.id === 'k5-auskundschaften')).toMatchObject({ done: true, text: expect.stringContaining('(3/3)') });
    expect(state.activeObjective()?.id).toBe('k5-zurueck');
    expect(targets.slice(-2)).toEqual([null, 'flick']);
  });
});

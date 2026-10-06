import { describe, expect, it } from 'vitest';
import { storyMove, storyStart, storyTargets, stealthStart, stealthStep, stealthTarget, stealthTiming, type StealthKind } from './interactionRules';

describe('story gestures', () => {
  it('keeps an unfinished gesture until the player moves it, with no timeout or loss', () => {
    const state = storyMove(storyStart('lift'), 'lift', 0.45);
    expect(state).toEqual({ position: 0.45, strokes: 0 });
    expect(storyMove(state, 'lift', state.position)).toEqual(state);
    expect(storyMove(state, 'lift', 0).strokes).toBe(1);
  });
  it('requires three complete pumps with a return stroke, rather than holding one direction', () => {
    let state = storyStart('bellows');
    state = storyMove(state, 'bellows', 1);
    for (let i = 0; i < 100; i++) state = storyMove(state, 'bellows', 1);
    expect(state.strokes).toBe(1);
    for (const target of storyTargets('bellows').slice(1)) state = storyMove(state, 'bellows', target);
    expect(state.strokes).toBe(6);
  });
});

describe('short stealth challenges', () => {
  it.each<StealthKind>(['cover', 'duck', 'listen'])('%s cannot succeed by waiting or holding E', kind => {
    let state = stealthStart(kind);
    for (let i = 0; i < 800; i++) state = stealthStep(state, kind, 0.05, 0).state;
    expect(state.done).toBe(false);
    expect(state.round).toBe(0);
    expect(state.mistakes).toBeGreaterThan(0);
  });
  it.each<StealthKind>(['cover', 'duck', 'listen'])('%s completes with the authored movements', kind => {
    let state = stealthStart(kind);
    for (let i = 0; i < 500 && !state.done; i++) {
      const target = stealthTarget(kind, state.round);
      const direction = Math.abs(state.position - target) > 0.03 ? Math.sign(target - state.position) : 0;
      state = stealthStep(state, kind, 0.025, direction).state;
    }
    expect(state.done).toBe(true);
    expect(state.mistakes).toBe(0);
  });
  it('requires alternating sides after a completed search and preserves completed beats on a mistake', () => {
    let state = { ...stealthStart('cover'), position: 0.2, time: 2.94 };
    state = stealthStep(state, 'cover', 0.02, 0).state;
    expect(state.round).toBe(1);
    state = stealthStep({ ...state, time: stealthTiming('cover').prepare }, 'cover', 0.02, 0).state;
    expect(state.round).toBe(1);
    expect(state.time).toBeLessThan(0);
    expect(state.mistakes).toBe(1);
  });
  it('a rustle inside a bush during the search still makes a guard look over', () => {
    const state = { ...stealthStart('cover'), position: 0.2, time: 2.2 };
    expect(stealthStep(state, 'cover', 0.02, 1).event).toBe('noise');
  });
  it('a torch allows corrections within the shadow and pauses without advancing', () => {
    const state = { ...stealthStart('listen'), position: 0.2, time: 2.2 };
    expect(stealthStep(state, 'listen', 0.02, 1).event).toBeNull();
    expect(stealthStep(state, 'listen', 0, 1, 0.8).state).toEqual(state);
  });
});

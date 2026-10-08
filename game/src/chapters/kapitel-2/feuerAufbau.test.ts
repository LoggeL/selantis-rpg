import { describe, expect, it } from 'vitest';
import { FIRE_STEPS, fireOutcome, ideasFor, SPARK_AFTER } from './feuerAufbau';

describe('Feuer nach Büchern', () => {
  it('every step has a right idea that works without tinder, and at least one wrong one', () => {
    for (const step of FIRE_STEPS) {
      const ideas = ideasFor(step, false);
      expect(ideas.some(i => i.ok && !i.disabled), step.id).toBe(true);
      expect(ideas.some(i => !i.ok), step.id).toBe(true);
      expect(new Set(step.ideas.map(i => i.id)).size).toBe(step.ideas.length);
    }
  });

  it('Mother’s tinder is only at hand when Lia packed it', () => {
    expect(ideasFor(FIRE_STEPS[0], false).find(i => i.id === 'zunder')?.disabled).toBe(true);
    expect(ideasFor(FIRE_STEPS[0], true).find(i => i.id === 'zunder')?.disabled).toBeFalsy();
  });

  it('three failures – one of them the missing tinder – bring the secret spark', () => {
    expect(fireOutcome(0, true)).toBe('ember');
    expect(fireOutcome(SPARK_AFTER - 1, true)).toBe('ember');
    expect(fireOutcome(SPARK_AFTER - 1, false)).toBe('spark');
    expect(fireOutcome(0, false)).toBe('ember');
  });
});

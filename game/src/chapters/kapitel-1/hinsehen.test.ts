import { describe, expect, it } from 'vitest';
import { DUCK, judgePass, passCards, PASSES, TOO_CLOSE } from './hinsehen';

describe('Hinsehen', () => {
  it('alternates close and far groups, so Lia gets two looks', () => {
    expect(PASSES.map(p => p.cue)).toEqual(['nah', 'fern', 'nah', 'fern']);
  });

  it('looking up while the hooves are close nearly gives her away; ducking is always safe', () => {
    const near = PASSES[0], far = PASSES[1];
    expect(judgePass(near, 'kyra')).toEqual({ ok: false, line: TOO_CLOSE });
    expect(judgePass(near, DUCK).ok).toBe(true);
    expect(judgePass(far, DUCK).ok).toBe(true);
    expect(judgePass(far, DUCK).look).toBeUndefined();
    expect(judgePass(far, 'taschen')).toMatchObject({ ok: true, look: 'taschen' });
  });

  it('a detail can only be looked at once', () => {
    const cards = passCards(['taschen']);
    expect(cards[0].id).toBe(DUCK);
    expect(cards.find(c => c.id === 'taschen')?.disabled).toBe(true);
    expect(cards.find(c => c.id === 'kyra')?.disabled).toBeFalsy();
  });
});

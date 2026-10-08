import { describe, expect, it } from 'vitest';
import { judgeSpot, MOMENTS, QUESTIONS } from './wortfetzen';

describe('Wortfetzen', () => {
  it('close to the fire Lia hears whole orders, but the torch makes it wrong once', () => {
    const torch = MOMENTS.filter(m => m.torch);
    expect(torch).toHaveLength(1);
    for (const m of MOMENTS) {
      expect(judgeSpot(m, 'fern').ok).toBe(true);
      expect(judgeSpot(m, 'nah').ok).toBe(!m.torch);
    }
    expect(judgeSpot(MOMENTS[2], 'nah').line.text).toContain('drei');
    expect(judgeSpot(MOMENTS[2], 'fern').line.text).toContain('drei');
  });

  it('each of Flick’s questions has exactly one right answer', () => {
    for (const q of QUESTIONS) expect(q.answers.filter(a => a.ok)).toHaveLength(1);
  });
});

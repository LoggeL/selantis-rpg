import { describe, expect, it } from 'vitest';
import { judgeRoute, ROUTE_CLUES, ROUTES, routeTag, sourcesFound } from './taverne-route';

const ALL = Object.values(ROUTE_CLUES);

describe('e2-taverne route deduction', () => {
  it('counts only the three tavern sources', () => {
    expect(sourcesFound([])).toBe(0);
    expect(sourcesFound(['k3-haarband', ROUTE_CLUES.rinde])).toBe(1);
    expect(sourcesFound(ALL)).toBe(3);
  });

  it('accepts the northern route only with both halves of the way', () => {
    expect(judgeRoute('norden', ALL)).toBe('richtig');
    expect(judgeRoute('norden', [ROUTE_CLUES.eiche, ROUTE_CLUES.rinde])).toBe('richtig');
    expect(judgeRoute('norden', [ROUTE_CLUES.eiche])).toBe('luecke');
    expect(judgeRoute('norden', [ROUTE_CLUES.craupor])).toBe('luecke');
  });

  it('names why the other routes are wrong', () => {
    expect(judgeRoute('augenbinde', ALL)).toBe('binde');
    expect(judgeRoute('handelsstrasse', ALL)).toBe('unbelegt');
    expect(judgeRoute('sueden', ALL)).toBe('widerspruch');
    expect(judgeRoute('sueden', [])).toBe('unbelegt');
  });

  it('tags exactly one option, and only with heard sources', () => {
    const tagged = ROUTES.filter(r => routeTag(r, ALL));
    expect(tagged.map(r => r.id)).toEqual(['norden']);
    expect(routeTag(ROUTES.find(r => r.id === 'norden')!, [ROUTE_CLUES.rinde])).toBe('Fallensteller');
    expect(routeTag(ROUTES.find(r => r.id === 'norden')!, [])).toBeUndefined();
  });

  it('has exactly one right answer among the options', () => {
    expect(ROUTES.filter(r => judgeRoute(r.id, ALL) === 'richtig')).toHaveLength(1);
  });
});

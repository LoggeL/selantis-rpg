import { describe, expect, it } from 'vitest';
import { available, combine, complete, contradictsFoltan, DEDUCTIONS } from './deduce';

describe('kapitel-3 clue board', () => {
  it('combines matching pairs in any order', () => {
    expect(combine('k3-seilfasern', 'k3-zwerg')?.id).toBe('k3-schluss-pfeiler');
    expect(combine('k3-zwerg', 'k3-seilfasern')?.id).toBe('k3-schluss-pfeiler');
    expect(combine('k3-haarband', 'k3-kette')?.id).toBe('k3-schluss-stall');
    expect(combine('k3-wette', 'k3-schminke')?.id).toBe('k3-schluss-hauptmann');
  });

  it('rejects wrong pairs and identical clues', () => {
    expect(combine('k3-seilfasern', 'k3-kette')).toBeNull();
    expect(combine('k3-wette', 'k3-wette')).toBeNull();
  });

  it('lists only deductions whose parts are found and that are new', () => {
    expect(available(['k3-seilfasern'])).toEqual([]);
    expect(available(['k3-seilfasern', 'k3-zwerg']).map(d => d.id)).toEqual(['k3-schluss-pfeiler']);
    expect(available(['k3-seilfasern', 'k3-zwerg', 'k3-schluss-pfeiler'])).toEqual([]);
  });

  it('is complete with all three deductions', () => {
    expect(complete(DEDUCTIONS.slice(0, 2).map(d => d.id))).toBe(false);
    expect(complete(DEDUCTIONS.map(d => d.id))).toBe(true);
  });

  it('contradicts Foltan only with real evidence', () => {
    expect(contradictsFoltan([], false)).toBe(false);
    expect(contradictsFoltan(['k3-schluss-pfeiler'], false)).toBe(false);
    expect(contradictsFoltan(['k3-schluss-stall'], true)).toBe(true);
    expect(contradictsFoltan(['k3-fuenf'], false)).toBe(true);
  });
});

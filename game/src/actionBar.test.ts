import { describe, expect, it } from 'vitest';
import { actionBarSlots } from './actionBar';

const magic = [{ key: 'Q', icon: 'beam' }, { key: 'R', icon: 'wave' }];
describe('progressive action bar', () => {
  it('only offers interaction when Lia has no magic', () => {
    expect(actionBarSlots({ directions: [], actions: { E: 'Aktion' } })).toEqual([
      { key: 'E', label: 'Interagieren', disabled: false, selected: false },
    ]);
  });
  it('keeps learned spells visible without re-enabling a spent action or a facing-only turn', () => {
    const slots = actionBarSlots({ directions: [], actions: { ENTER: 'Zug beenden' } }, magic);
    expect(slots.filter(slot => slot.key === 'Q' || slot.key === 'R').every(slot => slot.disabled)).toBe(true);
    expect(slots.find(slot => slot.key === 'ENTER')?.disabled).toBe(false);
    expect(actionBarSlots({ directions: [], actions: {} }, magic, { visible: false })).toEqual([]);
  });
  it('reflects the selected spell and disables unavailable magic on the flight', () => {
    expect(actionBarSlots({ directions: [], actions: { Q: 'Strahl', R: 'Druckwelle' } }, magic,
      { disabled: true, selected: 'wave' })).toEqual([
      { key: 'Q', label: 'Strahl', disabled: true, selected: false },
      { key: 'R', label: 'Druckwelle', disabled: true, selected: true },
    ]);
  });
});

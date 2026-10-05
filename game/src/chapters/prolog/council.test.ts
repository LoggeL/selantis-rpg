import { describe, expect, it } from 'vitest';
import rat from './rat.ts?raw';
import { COUNCIL, COUNCIL_SPEAKERS } from './council';
import { speakers } from '../../core/catalog';
import './catalog';

describe('the canonical council', () => {
  it('preserves the source names, genders and four renegades', () => {
    expect(COUNCIL.map(m => [m.name, m.gender])).toEqual([
      ['Ulfbert von Rogar', 'male'], ['Loyla von Imandur', 'male'],
      ['Burm von Rogar', 'male'], ['Ignatius von Ignis', 'male'],
      ['Gira von Imandur', 'female'], ['Tholloss von Trapas', 'male'],
      ['Valentus von Trapas', 'male'], ['Gwynn von Portas', 'female'],
      ['Samira von Ignis', 'female'], ['Rikkon von Portas', 'male'],
    ]);
    expect(COUNCIL.filter(m => m.renegade).map(m => m.id)).toEqual(['ulfbert', 'loyla', 'tholoss', 'rikkon']);
  });

  it('registers a named speaker and individual portrait for every council member', () => {
    expect(new Set(COUNCIL_SPEAKERS.map(s => s.portrait)).size).toBe(10);
    for (const member of COUNCIL) {
      expect(speakers.get(member.id)).toMatchObject({ name: member.name, portrait: member.id });
    }
  });

  it('seats all nine peers with their own character and voice, while Valentus remains playable', () => {
    const seats = [...rat.matchAll(/\{ id: '[^']+', preset: '([^']+)', at: \[[^\]]+\], speaker: '([^']+)'/g)];
    expect(seats).toHaveLength(9);
    expect(seats.map(s => s[1]).sort()).toEqual(COUNCIL.filter(m => m.id !== 'valentus').map(m => m.id).sort());
    expect(seats.every(s => s[1] === s[2])).toBe(true);
    expect(rat).toContain("player: 'valentus'");
    expect(rat).not.toMatch(/prolog-rat', npc|prolog-abtruenniger|council-mage|setTint/);
    expect(rat).not.toMatch(/Vamir|vamir|Baris.*Meister/);
  });
});

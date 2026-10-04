import { describe, expect, it } from 'vitest';
import { mobileBattleSummary } from './mobileBattleStatus';
const status = `VALENTUS AM ZUG
LP 100/100 · Traum schützt
Bewegen: 4 Felder
Aktion: Strahl / Welle / Warten
Blick: Nord
Danach: Gegner nach Tempo
1. Krieger II · 7 · LP 60
2. Krieger I · 6 · LP 60
Front schützt. Rücken verwundbar.`;
describe('native mobile tactical summary', () => {
  it('keeps HP, both resources, facing and next enemy speeds in three lines', () => {
    expect(mobileBattleSummary(status)).toBe('LP 100/100 · Blick Nord\nBewegen 4 · Aktion frei\nDanach: Krieger II 7 → Krieger I 6');
  });
  it('shows committed actions and direction selection without tutorial clutter', () => {
    const facing = status.replace('VALENTUS AM ZUG', 'BLICKRICHTUNG WÄHLEN').replace('Bewegen: 4 Felder', 'Bewegen: verbraucht').replace('Aktion: Strahl / Welle / Warten', 'Aktion: verbraucht');
    expect(mobileBattleSummary(facing)).toContain('LP 100/100 · Blick Nord wählen');
    expect(mobileBattleSummary(facing)).toContain('Bewegen verbraucht · Aktion verbraucht');
    expect(mobileBattleSummary(facing).split('\n')).toHaveLength(3);
  });
  it('does not create a paragraph from an entire enemy army', () => {
    const many = status + '\n3. Schütze · 5 · LP 30\n4. Axtkämpfer · 4 · LP 80';
    expect(mobileBattleSummary(many).split('\n')[2]).toBe('Danach: Krieger II 7 → Krieger I 6 → Schütze 5 …');
    expect(mobileBattleSummary(null)).toBe(''); expect(mobileBattleSummary('')).toBe('');
  });
});

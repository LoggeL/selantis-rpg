import { describe, expect, it } from 'vitest';
import { CAMP_DIALOGUE_CHOICES, CAMP_DIALOGUE_TUTORIAL, campDialogueBranch } from './campDialogue';

describe('Optionales Gespräch mit Foltan in der ersten Nacht', () => {
  it('bietet alle Themen und einen Ausgang ohne Pflichtzweig an', () => {
    expect(CAMP_DIALOGUE_CHOICES.map(choice => choice.label)).toEqual([
      'Über Kyra', 'Über den Weg', 'Über die Wache', 'Zurück',
    ]);
    expect(campDialogueBranch('back')).toEqual([]);
    expect(CAMP_DIALOGUE_TUTORIAL).toContain('Zurück');
  });

  it('lässt die gewählten Themen wiederholt lesen und schreibt keinen Fortschritt', () => {
    for (const choice of CAMP_DIALOGUE_CHOICES.filter(choice => choice.id !== 'back')) {
      const first = campDialogueBranch(choice.id);
      expect(first).toHaveLength(3);
      expect(first[0]).toMatch(/^Lia:/);
      expect(first[1]).toMatch(/^Foltan:/);
      expect(campDialogueBranch('back')).toEqual([]);
      expect(campDialogueBranch(choice.id)).toEqual(first);
    }
  });

  it('verspricht keine Rettung und nimmt keine späteren Erkenntnisse vorweg', () => {
    const lines = CAMP_DIALOGUE_CHOICES.flatMap(choice => campDialogueBranch(choice.id)).join(' ');
    expect(lines).not.toMatch(/Baris|Geweih|Grotte|Craupor/);
    expect(campDialogueBranch('road').join(' ')).toContain('nachfragen, ob jemand');
  });
});

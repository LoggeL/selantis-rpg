import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameState } from './state';

afterEach(() => vi.unstubAllGlobals());
describe('saved character progression', () => {
  const storage = () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    return values;
  };
  it('reads back level, EXP, equipment and mastery after saving and loading', () => {
    storage();
    const s = new GameState();
    s.setCharacter('flick', { level: 4, exp: 39, weapon: 'jagdmesser', mastered: ['bogen'], abilityAp: { bogen: 50, messer: 20 } });
    s.save('kapitel-5', 'rettung');
    const loaded = new GameState(); expect(loaded.load()).toBe(true);
    expect(loaded.character('flick')).toEqual(s.character('flick'));
    const copy = loaded.character('flick')!; copy.mastered.push('dolch');
    expect(loaded.character('flick')!.mastered).toEqual(['bogen']);
    loaded.reset(); expect(loaded.character('flick')).toBeUndefined();
  });
  it('migrates existing version-one saves without character records', () => {
    const values = storage();
    values.set('selantis.save.v1', JSON.stringify({ version: 1, chapter: 'kapitel-5', flags: { rescue: true }, party: ['flick'] }));
    const s = new GameState(); expect(s.load()).toBe(true);
    expect(s.data.characters).toEqual({}); expect(s.is('rescue')).toBe(true); expect(s.data.party).toEqual(['flick']);
  });
});

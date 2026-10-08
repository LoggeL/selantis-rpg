import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from './state';
import type { SaveData } from './types';

const FOREST_EAST = 'Weiter nach Osten, über die Trittsteine.';
let stored: string | null;
beforeEach(() => {
  stored = null;
  vi.stubGlobal('localStorage', { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } });
});
afterEach(() => vi.unstubAllGlobals());

function resume(overrides: Partial<SaveData>): GameState {
  stored = JSON.stringify({ ...new GameState().data, ...overrides });
  const resumed = new GameState();
  expect(resumed.load()).toBe(true);
  return resumed;
}

describe('version-one story objective repairs', () => {
  it('repairs completed council and gift records in an already reached Kapitel-I save', () => {
    const resumed = resume({
      chapter: 'kapitel-1', scene: 'wiese',
      flags: { 'prolog-gehoert-ignatius': true, 'prolog-gehoert-aelteste': true, 'prolog-gehoert-hagere': true, 'prolog-gehoert-wortfuehrer': true, 'prolog-geschenk': true },
      objectives: [{ id: 'prolog-anhoeren', text: 'Höre die Ratsmitglieder an (3/4).', done: true }, { id: 'prolog-geschenk', text: 'Entscheide, was mit der Urmacht geschieht.', done: false }],
    });
    expect(resumed.data.objectives).toEqual([
      { id: 'prolog-anhoeren', text: 'Höre die Ratsmitglieder an (4/4).', done: true },
      { id: 'prolog-geschenk', text: 'Entscheide, was mit der Urmacht geschieht.', done: true },
    ]);
    expect(resumed.activeObjective()).toBeUndefined();
  });

  it('preserves genuinely unfinished prologue goals', () => {
    const objectives = [{ id: 'prolog-anhoeren', text: 'Höre die Ratsmitglieder an (3/4).', done: false }, { id: 'prolog-geschenk', text: 'Entscheide, was mit der Urmacht geschieht.', done: false }];
    const resumed = resume({ flags: { 'prolog-gehoert-ignatius': true, 'prolog-gehoert-aelteste': true, 'prolog-gehoert-hagere': true }, objectives });
    expect(resumed.data.objectives).toEqual(objectives);
  });

  it('restores the actual post-rest forest goal without reopening the completed road goal', () => {
    const resumed = resume({
      chapter: 'kapitel-2', scene: 'waldweg',
      flags: { 'k2-waldweg-start': true, 'k2-rast-fertig': true },
      objectives: [
        { id: 'k2-osten', text: FOREST_EAST, done: true },
        { id: 'k2-aufbruch', text: 'Brich mit Foltan und Azar auf.', done: false },
        { id: 'k2-waldweg', text: 'Folge den Kerben nach Osten.', done: false },
      ],
    });
    expect(resumed.activeObjective()).toEqual({ id: 'k2-trittsteine', text: FOREST_EAST, done: false });
    expect(resumed.data.objectives.slice(0, 3).every(o => o.done)).toBe(true);
    expect(resumed.data.objectives[0].text).toBe('Folge der Straße nach Osten.');
    resumed.save('kapitel-2', 'waldweg');
    const secondResume = new GameState();
    expect(secondResume.load()).toBe(true);
    expect(secondResume.data.objectives).toEqual(resumed.data.objectives);
  });

  it('closes stale forest history in a later chapter and preserves that chapter’s active task', () => {
    const resumed = resume({
      chapter: 'kapitel-3', scene: 'eber', flags: { 'k2-rast-fertig': true },
      objectives: [
        { id: 'k2-osten', text: FOREST_EAST, done: true },
        { id: 'k2-aufbruch', text: 'Aufbruch', done: false },
        { id: 'k2-waldweg', text: 'Waldweg', done: false },
        { id: 'k3-spuren', text: 'Suche nach Kyra.', done: false },
      ],
    });
    expect(resumed.activeObjective()?.id).toBe('k3-spuren');
    expect(resumed.data.objectives.find(o => o.id === 'k2-trittsteine')?.done).toBe(true);
    expect(resumed.data.objectives.filter(o => o.id.startsWith('k2-')).every(o => o.done)).toBe(true);
  });

  it('keeps the morning departure and pre-rest forest walk open until their milestones', () => {
    const morning = resume({ chapter: 'kapitel-2', scene: 'waldweg', flags: { 'k2-fruehstueck': true }, objectives: [{ id: 'k2-aufbruch', text: 'Aufbruch', done: false }] });
    expect(morning.activeObjective()?.id).toBe('k2-aufbruch');
    const forest = resume({ chapter: 'kapitel-2', scene: 'waldweg', flags: { 'k2-waldweg-start': true }, objectives: [{ id: 'k2-aufbruch', text: 'Aufbruch', done: false }, { id: 'k2-waldweg', text: 'Waldweg', done: false }] });
    expect(forest.data.objectives[0].done).toBe(true);
    expect(forest.activeObjective()?.id).toBe('k2-waldweg');
    expect(forest.data.objectives.some(o => o.id === 'k2-trittsteine')).toBe(false);
  });

  it('does not reopen an already completed new forest goal or other chapter goals', () => {
    const resumed = resume({ chapter: 'kapitel-2', scene: 'waldweg', flags: { 'k2-rast-fertig': true }, objectives: [{ id: 'k2-trittsteine', text: FOREST_EAST, done: true }, { id: 'k5-aufbruch', text: 'Aufbruch', done: true }] });
    expect(resumed.activeObjective()).toBeUndefined();
    expect(resumed.data.objectives).toHaveLength(2);
  });

  it('does not invent past forest goals for a later chapter selected directly', () => {
    const resumed = resume({ chapter: 'teil-2', scene: 'e2-taverne', flags: {}, objectives: [{ id: 'e2-aufbruch', text: 'Aufbruch', done: false }] });
    expect(resumed.data.objectives).toHaveLength(1);
    expect(resumed.activeObjective()?.id).toBe('e2-aufbruch');
  });
});

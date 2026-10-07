import { afterEach, describe, expect, it, vi } from 'vitest';
import { G } from './G';
import { defineChapter } from './registry';
import { GameState, normalizeSave } from './state';
import type { SaveData } from './types';

const KEY = 'selantis.save.v1';
afterEach(() => vi.unstubAllGlobals());

function storage(): Map<string, string> {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
  return values;
}

/** A controllable clock (ms). */
function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe('save → load round trip', () => {
  it('keeps every part of the campaign state', () => {
    storage();
    const s = new GameState();
    s.set('k1-versprochen'); s.set('k2-entschieden', 'osten'); s.inc('k5-reisekaempfe', 2);
    s.set('world.mem.k1-hof', JSON.stringify({ used: ['buch'], removed: [], triggers: [], props: [], clues: [], off: [], time: 'dusk' }));
    s.give('bread', 2); s.give('dagger');
    s.objective('k1-heim', 'Geh nach Hause.'); s.complete('k1-heim'); s.objective('k1-steine', 'Trag Steine.');
    s.addMemory('k1-mem-kuchen'); s.addLore('lore-alana'); s.addClue('k1-hufspuren'); s.learn('spurenblick');
    s.setParty(['flick', 'kyra']);
    s.setCharacter('lia', { level: 3, exp: 12, weapon: null, mastered: [], abilityAp: {} });
    s.save('kapitel-1', 'trauer', { part: 'morgen', encounterReturn: { scene: 'trauer', map: 'k1-hof', x: 10, y: 20 } });

    const loaded = new GameState();
    expect(loaded.load()).toBe(true);
    const { savedAt: _a, playtimeSec: _p, ...want } = s.data;
    const { savedAt: _b, playtimeSec: _q, ...got } = loaded.data;
    expect(got).toEqual(want);
    expect(loaded.flag('k2-entschieden')).toBe('osten');
    expect(loaded.count('bread')).toBe(2);
    expect(loaded.activeObjective()?.id).toBe('k1-steine');
  });

  it('remembers where and when objectives were noted and completed', () => {
    storage();
    const c = clock();
    const s = new GameState(() => 'trauer', c.now);
    s.objective('k1-steine', 'Trag Steine für zwei Gräber zusammen (0/4).');
    c.advance(60_000);
    s.objective('k1-steine', 'Trag Steine für zwei Gräber zusammen (1/4).'); // text update keeps the first note
    c.advance(60_000);
    s.complete('k1-steine');
    s.save('kapitel-1', 'trauer');

    const loaded = new GameState();
    expect(loaded.load()).toBe(true);
    expect(loaded.data.objectives).toEqual([
      { id: 'k1-steine', text: 'Trag Steine für zwei Gräber zusammen (1/4).', done: true, scene: 'trauer', setAt: 1_000_000, doneAt: 1_120_000 },
    ]);
  });

  it('falls back to the saved scene for the note and drops notes of warp-prepared objectives', () => {
    storage();
    const s = new GameState();
    s.save('kapitel-2', 'strasse');
    s.objective('k2-weg', 'Folge der Straße.');
    expect(s.data.objectives[0].scene).toBe('strasse');
    s.forgetObjectiveNotes();
    expect(s.data.objectives).toEqual([{ id: 'k2-weg', text: 'Folge der Straße.', done: false }]);
  });

  it('counts play time across saves and loads, but not while paused', () => {
    storage();
    const c = clock();
    const s = new GameState(undefined, c.now);
    c.advance(90_000);
    s.save('kapitel-1', 'wiese');
    expect(s.data.playtimeSec).toBe(90);
    s.pauseClock(true); c.advance(3_600_000); s.pauseClock(false);
    c.advance(30_000);
    expect(s.playtime()).toBe(120);
    s.save('kapitel-1', 'heimweg');

    const loaded = new GameState(undefined, c.now);
    c.advance(10 * 60_000); // sitting on the title screen before „Fortsetzen“ does not count
    expect(loaded.load()).toBe(true);
    expect(loaded.data.playtimeSec).toBe(120);
    c.advance(15_000);
    expect(loaded.playtime()).toBe(135);
    loaded.reset();
    expect(loaded.playtime()).toBe(0);
  });
});

describe('older and damaged saves', () => {
  it('load without objective notes or play time', () => {
    const values = storage();
    values.set(KEY, JSON.stringify({
      version: 1, chapter: 'kapitel-2', scene: 'strasse', flags: { 'k1-buch-aufgehoben': true },
      inventory: { bread: 2 }, objectives: [{ id: 'k2-weg', text: 'Folge der Straße.', done: false }],
      memories: [], lore: ['lore-alana'], clues: [], abilities: ['spurenblick'], party: [],
    }));
    const s = new GameState();
    expect(s.load()).toBe(true);
    expect(s.data.objectives).toEqual([{ id: 'k2-weg', text: 'Folge der Straße.', done: false }]);
    expect(s.data.playtimeSec).toBe(0);
    expect(s.data.characters).toEqual({});
    expect(s.knows('spurenblick')).toBe(true);
  });

  it('repair broken fields instead of failing', () => {
    const fixed = normalizeSave({
      version: 1, chapter: 'kapitel-3', scene: 'eber',
      flags: { ok: 'ja', bad: null, obj: {} } as unknown as SaveData['flags'],
      inventory: { bread: 1, none: 0, nan: Number.NaN } as SaveData['inventory'],
      objectives: [null, { id: 'k3', text: 'Rede mit Foltan.', done: 0, setAt: 'gestern' }] as unknown as SaveData['objectives'],
      memories: null as unknown as string[], party: ['flick', 3] as unknown as string[],
      playtimeSec: -5, params: 'x' as unknown as Record<string, unknown>,
    });
    expect(fixed.flags).toEqual({ ok: 'ja' });
    expect(fixed.inventory).toEqual({ bread: 1 });
    expect(fixed.objectives).toEqual([{ id: 'k3', text: 'Rede mit Foltan.', done: false }]);
    expect(fixed.memories).toEqual([]);
    expect(fixed.party).toEqual(['flick']);
    expect(fixed.playtimeSec).toBe(0);
    expect(fixed.params).toBeUndefined();
  });

  it('rejects foreign versions and garbage', () => {
    const values = storage();
    values.set(KEY, JSON.stringify({ version: 2, scene: 'x' }));
    expect(new GameState().load()).toBe(false);
    values.set(KEY, 'null');
    expect(new GameState().load()).toBe(false);
  });
});

describe('G.checkpoint (progress inside a running scene)', () => {
  defineChapter({ id: 'test-save-real', order: 900, numeral: 'T', title: 'Test', scenes: [{ id: 'test-save-scene', title: 'Szene', start: () => {} }] });
  defineChapter({ id: 'test-save-dev', order: 901, numeral: 'D', title: 'Dev', hidden: true, scenes: [{ id: 'test-save-dev-scene', title: 'Dev', start: () => {} }] });

  it('saves the progressed state under the running scene and keeps its start params', () => {
    const values = storage();
    G.state.reset();
    G.currentScene = 'test-save-scene';
    G.state.save('test-save-real', 'test-save-scene', { part: 'morgen' });
    G.state.set('k5-erwacht'); G.state.give('bead', 3);
    expect(G.checkpoint({ encounterReturn: { scene: 'test-save-scene', map: 'm', x: 1, y: 2 } })).toBe(true);
    G.state.set('k5-weiter');
    expect(G.checkpoint({ encounterReturn: { scene: 'test-save-scene', map: 'm', x: 5, y: 6 } })).toBe(true);

    const saved = JSON.parse(values.get(KEY)!) as SaveData;
    expect(saved.chapter).toBe('test-save-real');
    expect(saved.scene).toBe('test-save-scene');
    expect(saved.params).toEqual({ part: 'morgen', encounterReturn: { scene: 'test-save-scene', map: 'm', x: 5, y: 6 } });
    expect(saved.flags).toEqual({ 'k5-erwacht': true, 'k5-weiter': true });
    expect(saved.inventory).toEqual({ bead: 3 });
  });

  it('never writes the campaign save from a hidden dev chapter', () => {
    const values = storage();
    values.set(KEY, 'campaign');
    G.currentScene = 'test-save-dev-scene';
    expect(G.checkpoint()).toBe(false);
    G.currentScene = '';
    expect(G.checkpoint()).toBe(false);
    expect(values.get(KEY)).toBe('campaign');
  });
});

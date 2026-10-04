import { events } from './events';
import type { FlagValue, Objective, SaveData } from './types';

const SAVE_KEY = 'selantis.save.v1';

function blank(): SaveData {
  return {
    version: 1, chapter: 'prolog', scene: 'prolog-rat', flags: {}, inventory: {}, objectives: [],
    memories: [], lore: [], clues: [], abilities: [], party: [], playtimeSec: 0, savedAt: new Date().toISOString(),
  };
}

/** The single source of truth for campaign progress. Emits 'state:changed' on every mutation. */
export class GameState {
  data: SaveData = blank();

  private changed(kind: string, detail?: unknown) { events.emit('state:changed', { kind, detail }); }

  reset(): void { this.data = blank(); this.changed('reset'); }

  flag<T extends FlagValue = boolean>(key: string): T | undefined { return this.data.flags[key] as T | undefined; }
  is(key: string): boolean { return Boolean(this.data.flags[key]); }
  set(key: string, value: FlagValue = true): void { this.data.flags[key] = value; this.changed('flag', { key, value }); }
  inc(key: string, by = 1): number {
    const next = (Number(this.data.flags[key]) || 0) + by;
    this.set(key, next);
    return next;
  }

  count(item: string): number { return this.data.inventory[item] ?? 0; }
  has(item: string): boolean { return this.count(item) > 0; }
  give(item: string, n = 1): void {
    this.data.inventory[item] = this.count(item) + n;
    this.changed('item', { item, n });
    events.emit('item:gained', { item, n });
  }
  take(item: string, n = 1): boolean {
    if (this.count(item) < n) return false;
    const left = this.count(item) - n;
    if (left > 0) this.data.inventory[item] = left; else delete this.data.inventory[item];
    this.changed('item', { item, n: -n });
    return true;
  }

  /** Sets (or replaces) the active objective. Old active objectives stay listed as open unless completed. */
  objective(id: string, text: string): void {
    const existing = this.data.objectives.find(o => o.id === id);
    if (existing) existing.text = text; else this.data.objectives.push({ id, text, done: false });
    this.changed('objective', { id, text });
    events.emit('objective:set', { id, text });
  }
  complete(id: string): void {
    const o = this.data.objectives.find(x => x.id === id);
    if (!o || o.done) return;
    o.done = true;
    this.changed('objective', { id, done: true });
    events.emit('objective:done', { id, text: o.text });
  }
  activeObjective(): Objective | undefined {
    for (let i = this.data.objectives.length - 1; i >= 0; i--) if (!this.data.objectives[i].done) return this.data.objectives[i];
    return undefined;
  }

  private addUnique(list: 'memories' | 'lore' | 'clues' | 'abilities', id: string, event: string): boolean {
    if (this.data[list].includes(id)) return false;
    this.data[list].push(id);
    this.changed(list, { id });
    events.emit(event, { id });
    return true;
  }
  addMemory(id: string) { return this.addUnique('memories', id, 'memory:gained'); }
  addLore(id: string) { return this.addUnique('lore', id, 'lore:gained'); }
  addClue(id: string) { return this.addUnique('clues', id, 'clue:gained'); }
  learn(id: string) { return this.addUnique('abilities', id, 'ability:gained'); }
  knows(id: string): boolean { return this.data.abilities.includes(id); }
  hasClue(id: string): boolean { return this.data.clues.includes(id); }

  setParty(ids: string[]): void { this.data.party = [...ids]; this.changed('party', ids); }

  // ---- persistence ----
  save(chapter: string, scene: string, params?: Record<string, unknown>): void {
    this.data.chapter = chapter;
    this.data.scene = scene;
    this.data.params = params;
    this.data.savedAt = new Date().toISOString();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch { /* storage may be unavailable */ }
  }
  static hasSave(): boolean {
    try { return Boolean(localStorage.getItem(SAVE_KEY)); } catch { return false; }
  }
  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveData;
      if (parsed.version !== 1) return false;
      this.data = { ...blank(), ...parsed };
      this.changed('load');
      return true;
    } catch { return false; }
  }
  static clearSave(): void { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
}

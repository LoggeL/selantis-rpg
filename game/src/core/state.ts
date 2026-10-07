import { events } from './events';
import type { FlagValue, Objective, SaveData } from './types';
import { normalizeProgress, type CharacterProgress } from '../tactics/rules/progression';

const SAVE_KEY = 'selantis.save.v1';

function blank(): SaveData {
  return {
    version: 1, chapter: 'prolog', scene: 'prolog-rat', flags: {}, inventory: {}, objectives: [],
    memories: [], lore: [], clues: [], abilities: [], party: [], characters: {}, playtimeSec: 0, savedAt: new Date().toISOString(),
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const idList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const finite = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/**
 * Brings a stored save (any version-1 shape, also the oldest ones without characters, objective notes or play time)
 * into the current SaveData shape. Unknown or broken fields fall back to their defaults instead of failing the load.
 */
export function normalizeSave(parsed: Partial<SaveData>): SaveData {
  const base = blank();
  const flags: Record<string, FlagValue> = {};
  if (isRecord(parsed.flags)) {
    for (const [k, v] of Object.entries(parsed.flags)) if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') flags[k] = v;
  }
  const inventory: Record<string, number> = {};
  if (isRecord(parsed.inventory)) {
    for (const [k, v] of Object.entries(parsed.inventory)) { const n = finite(v); if (n !== undefined && n > 0) inventory[k] = n; }
  }
  const objectives: Objective[] = Array.isArray(parsed.objectives)
    ? parsed.objectives.filter((o): o is Objective => isRecord(o) && typeof o.id === 'string').map(o => {
      const out: Objective = { id: o.id, text: typeof o.text === 'string' ? o.text : '', done: Boolean(o.done) };
      if (typeof o.scene === 'string' && o.scene) out.scene = o.scene;
      const setAt = finite(o.setAt), doneAt = finite(o.doneAt);
      if (setAt !== undefined) out.setAt = setAt;
      if (doneAt !== undefined) out.doneAt = doneAt;
      return out;
    })
    : [];
  const characters = isRecord(parsed.characters)
    ? Object.fromEntries(Object.entries(parsed.characters).map(([id, p]) => [id, normalizeProgress(p)]))
    : {};
  return {
    ...base,
    ...parsed,
    version: 1,
    chapter: typeof parsed.chapter === 'string' ? parsed.chapter : base.chapter,
    scene: typeof parsed.scene === 'string' ? parsed.scene : base.scene,
    params: isRecord(parsed.params) ? parsed.params : undefined,
    flags, inventory, objectives,
    memories: idList(parsed.memories), lore: idList(parsed.lore), clues: idList(parsed.clues),
    abilities: idList(parsed.abilities), party: idList(parsed.party),
    characters,
    playtimeSec: Math.max(0, finite(parsed.playtimeSec) ?? 0),
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : base.savedAt,
  };
}

/** The single source of truth for campaign progress. Emits 'state:changed' on every mutation. */
export class GameState {
  data: SaveData = blank();

  /** Play-time clock: start of the not yet counted stretch (null while paused, e.g. hidden tab). */
  private clockFrom: number | null;
  private clockPaused = false;

  /**
   * @param where scene id stamped on newly noted objectives (G passes G.currentScene; default: the saved scene).
   * @param now clock in ms (tests inject a fake one).
   */
  constructor(private readonly where: () => string = () => '', private readonly now: () => number = () => Date.now()) {
    this.clockFrom = this.now();
  }

  private changed(kind: string, detail?: unknown) { events.emit('state:changed', { kind, detail }); }

  reset(): void { this.data = blank(); this.restartClock(); this.changed('reset'); }

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

  /**
   * Sets (or replaces) the active objective. Old active objectives stay listed as open unless completed.
   * A new objective remembers where and when it was noted (saved with the game, shown in the journal).
   */
  objective(id: string, text: string): void {
    const existing = this.data.objectives.find(o => o.id === id);
    if (existing) existing.text = text;
    else {
      const o: Objective = { id, text, done: false, setAt: this.now() };
      const scene = this.where() || this.data.scene;
      if (scene) o.scene = scene;
      this.data.objectives.push(o);
    }
    this.changed('objective', { id, text });
    events.emit('objective:set', { id, text });
  }
  complete(id: string): void {
    const o = this.data.objectives.find(x => x.id === id);
    if (!o || o.done) return;
    o.done = true;
    o.doneAt = this.now();
    this.changed('objective', { id, done: true });
    events.emit('objective:done', { id, text: o.text });
  }
  activeObjective(): Objective | undefined {
    for (let i = this.data.objectives.length - 1; i >= 0; i--) if (!this.data.objectives[i].done) return this.data.objectives[i];
    return undefined;
  }
  /** Drops the where/when notes (a direct warp prepares objectives the player never noted in this run). */
  forgetObjectiveNotes(): void {
    for (const o of this.data.objectives) { delete o.scene; delete o.setAt; delete o.doneAt; }
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

  character(id: string): CharacterProgress | undefined {
    const p = this.data.characters[id];
    return p ? normalizeProgress(p) : undefined;
  }
  setCharacter(id: string, progress: CharacterProgress): void {
    this.data.characters[id] = normalizeProgress(progress);
    this.changed('character', { id });
  }

  // ---- play time ----
  /** Play time in seconds including the stretch since the last save. */
  playtime(): number {
    return this.data.playtimeSec + (this.clockFrom === null ? 0 : Math.max(0, this.now() - this.clockFrom) / 1000);
  }
  /** Pauses the play-time clock (hidden tab) or resumes it. */
  pauseClock(paused: boolean): void {
    if (paused === this.clockPaused) return;
    if (paused) { this.foldClock(); this.clockFrom = null; } else this.clockFrom = this.now();
    this.clockPaused = paused;
  }
  private foldClock(): void {
    if (this.clockFrom === null) return;
    const t = this.now();
    this.data.playtimeSec += Math.max(0, t - this.clockFrom) / 1000;
    this.clockFrom = t;
  }
  private restartClock(): void { this.clockFrom = this.clockPaused ? null : this.now(); }

  // ---- persistence ----
  save(chapter: string, scene: string, params?: Record<string, unknown>): void {
    this.foldClock();
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
      const parsed = JSON.parse(raw) as Partial<SaveData> | null;
      if (!isRecord(parsed) || parsed.version !== 1) return false;
      this.data = normalizeSave(parsed);
      this.restartClock();
      this.changed('load');
      return true;
    } catch { return false; }
  }
  static clearSave(): void { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
}

import type { TimeOfDay, WeatherKind } from './api';

/**
 * What a map remembers between visits: used/removed interactables, fired once-triggers, removed props, found
 * clues, disabled objects and the lighting/weather a script left behind. Pure (no Phaser); persisted as a JSON
 * string in a G.state flag (`world.mem.<mapId>`) so it survives save/continue.
 */
export interface MapMemoryData {
  used: string[];
  removed: string[];
  triggers: string[];
  props: string[];
  clues: string[];
  off: string[];
  time?: TimeOfDay;
  weather?: WeatherKind;
}

type SetKey = 'used' | 'removed' | 'triggers' | 'props' | 'clues' | 'off';

export interface MemoryStore {
  read(key: string): string | undefined;
  write(key: string, value: string): void;
}

export const memoryKey = (mapId: string): string => `world.mem.${mapId}`;

export class MapMemory {
  private sets: Record<SetKey, Set<string>>;
  time?: TimeOfDay;
  weather?: WeatherKind;

  constructor(readonly mapId: string, private store: MemoryStore | null, data?: Partial<MapMemoryData>) {
    this.sets = {
      used: new Set(data?.used), removed: new Set(data?.removed), triggers: new Set(data?.triggers),
      props: new Set(data?.props), clues: new Set(data?.clues), off: new Set(data?.off),
    };
    this.time = data?.time;
    this.weather = data?.weather;
  }

  static load(mapId: string, store: MemoryStore | null): MapMemory {
    let data: Partial<MapMemoryData> | undefined;
    const raw = store?.read(memoryKey(mapId));
    if (raw) { try { data = JSON.parse(raw) as Partial<MapMemoryData>; } catch { data = undefined; } }
    return new MapMemory(mapId, store, data);
  }

  has(kind: SetKey, id: string): boolean { return this.sets[kind].has(id); }

  add(kind: SetKey, id: string): void {
    if (this.sets[kind].has(id)) return;
    this.sets[kind].add(id);
    this.save();
  }

  delete(kind: SetKey, id: string): void {
    if (this.sets[kind].delete(id)) this.save();
  }

  setTime(t: TimeOfDay): void { if (this.time !== t) { this.time = t; this.save(); } }
  setWeather(w: WeatherKind): void { if (this.weather !== w) { this.weather = w; this.save(); } }

  /** Forgets everything (MapDef.resetOnEnter, or a script that wants a fresh map). */
  clear(): void {
    for (const s of Object.values(this.sets)) s.clear();
    this.time = undefined; this.weather = undefined;
    this.save();
  }

  get empty(): boolean { return Object.values(this.sets).every(s => s.size === 0) && !this.time && !this.weather; }

  toJSON(): MapMemoryData {
    const out: MapMemoryData = { used: [], removed: [], triggers: [], props: [], clues: [], off: [] };
    for (const k of Object.keys(this.sets) as SetKey[]) out[k] = [...this.sets[k]];
    if (this.time) out.time = this.time;
    if (this.weather) out.weather = this.weather;
    return out;
  }

  private save(): void { this.store?.write(memoryKey(this.mapId), JSON.stringify(this.toJSON())); }
}

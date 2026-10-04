import type { MapDef } from './api';

const maps = new Map<string, MapDef>();

/** Registers a map so exits and changeMap can find it by id. Returns the def for convenience. */
export function defineMap(def: MapDef): MapDef {
  maps.set(def.id, def);
  return def;
}

export function getMap(id: string): MapDef {
  const m = maps.get(id);
  if (!m) throw new Error(`[world] unknown map '${id}' (did you defineMap it?)`);
  return m;
}

export function hasMap(id: string): boolean { return maps.has(id); }
export function mapIds(): string[] { return [...maps.keys()]; }

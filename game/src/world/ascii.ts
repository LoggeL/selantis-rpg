import type { TerrainId } from '../art/api';
import { DEFAULT_LEGEND } from './api';

export interface ParsedGround {
  cols: number;
  rows: number;
  terrain: TerrainId[][];
  warnings: string[];
}

/**
 * Parses ASCII ground rows into a terrain grid. Short rows are padded with `fill`, unknown chars become `fill`
 * (and produce a warning so authors notice typos).
 */
export function parseGround(rows: string[], legend: Record<string, TerrainId> = {}, fill: TerrainId = 'grass'): ParsedGround {
  const full: Record<string, TerrainId> = { ...DEFAULT_LEGEND, ...legend };
  const warnings: string[] = [];
  const cols = rows.reduce((m, r) => Math.max(m, [...r].length), 0);
  const unknown = new Set<string>();
  const terrain: TerrainId[][] = rows.map((row, y) => {
    const chars = [...row];
    if (chars.length < cols) warnings.push(`row ${y} is ${chars.length} wide, padded to ${cols}`);
    const out: TerrainId[] = [];
    for (let x = 0; x < cols; x++) {
      const ch = chars[x];
      if (ch === undefined) { out.push(fill); continue; }
      const t = full[ch];
      if (!t) { unknown.add(ch); out.push(fill); } else out.push(t);
    }
    return out;
  });
  for (const ch of unknown) warnings.push(`unknown ground char '${ch}'`);
  return { cols, rows: rows.length, terrain, warnings };
}

/** Iterates the non-empty cells of an ASCII overlay layer (spaces and '.' are empty). */
export function scanLayer(rows: string[], fn: (ch: string, x: number, y: number) => void): void {
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ' ' && ch !== '.') fn(ch, x, y); }));
}

export const BLOCKING_TERRAIN: ReadonlySet<TerrainId> = new Set<TerrainId>(['water', 'cliff', 'void']);
export const SIGHT_BLOCKING_TERRAIN: ReadonlySet<TerrainId> = new Set<TerrainId>(['cliff', 'void']);

/** Movement speed factor on a terrain. */
export function terrainSpeed(t: TerrainId | undefined): number {
  switch (t) {
    case 'shallow': return 0.55;
    case 'mud': return 0.72;
    case 'wheat': return 0.82;
    case 'crops': return 0.9;
    case 'sand': return 0.9;
    default: return 1;
  }
}

export type StepSound = 'step-grass' | 'step-dirt' | 'step-wood' | 'step-stone' | 'step-water';
export function terrainStep(t: TerrainId | undefined): StepSound {
  switch (t) {
    case 'dirt': case 'path': case 'road': case 'mud': case 'sand': case 'stubble': return 'step-dirt';
    case 'wood': case 'rug': case 'carpet': return 'step-wood';
    case 'stone': case 'cobble': case 'cliff': return 'step-stone';
    case 'shallow': case 'water': return 'step-water';
    default: return 'step-grass';
  }
}

/** Whether running on this terrain kicks up dust (or splashes). */
export function terrainPuff(t: TerrainId | undefined): 'dust' | 'splash' | 'grass' | null {
  switch (t) {
    case 'dirt': case 'path': case 'road': case 'sand': case 'stubble': return 'dust';
    case 'shallow': case 'mud': return 'splash';
    case 'grass': case 'meadow': case 'darkgrass': case 'wheat': case 'crops': return 'grass';
    default: return null;
  }
}

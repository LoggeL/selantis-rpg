/**
 * Typed view of game/public/assets/manifest.json (written by scripts/art/build_manifest.py, schema documented in
 * docs/rebuild/art-pipeline.md). The manifest is fetched once before the game starts (top-level await in
 * art/index.ts), so every lookup here is synchronous.
 */

export type Vec2 = [number, number];

export interface WalkSheetEntry {
  file: string;
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
  /** Row order of the sheet, always ['down', 'left', 'right', 'up']. */
  dirs: string[];
  fps: number;
  /** Frame index (0..15) used as standing idle per row (down, left, right, up). */
  idle?: number[];
}

export interface PoseEntry {
  file: string;
  /** Frame size (a pose may be a horizontal strip of `frames` frames). */
  w: number;
  h: number;
  frames: number;
  fps?: number;
  loop?: boolean;
  /** Foot anchor inside a frame, px from top-left. */
  foot: Vec2;
  /** Direction the pose was drawn facing; the runtime mirrors it for the opposite horizontal direction. */
  facing: 'right' | 'left' | 'down' | 'up';
  /** Optional explicit per-direction variants (<id>-<pose>-<dir>.png). */
  dirs?: Partial<Record<'down' | 'up' | 'left' | 'right', Omit<PoseEntry, 'dirs'>>>;
}

export interface CharacterEntry {
  walk?: WalkSheetEntry;
  /** Crouch-walk sheet (same 4×4 layout as walk), used for 'sneak' when present. */
  sneak?: WalkSheetEntry;
  foot?: Vec2;
  /** Visible sprite height in px. */
  height?: number;
  poses: Record<string, PoseEntry>;
}

export interface ImageEntry {
  file: string;
  w: number;
  h: number;
  [extra: string]: unknown;
}

export interface PropEntry extends ImageEntry {
  frames: number;
  fps?: number;
  /** Origin inside a frame (px from top-left), usually bottom centre. */
  anchor: Vec2;
  footprint: { x: number; y: number; w: number; h: number } | null;
  sway?: boolean;
  light?: { radius: number; color: number | string; flicker?: boolean; offsetY?: number };
  lights?: { x: number; y: number; radius: number; color: number | string; flicker?: boolean }[];
  anchors?: Record<string, { x: number; y: number }>;
}

export interface AssetManifest {
  version: number;
  characters: Record<string, CharacterEntry>;
  /** portraits[id][mood] = url; 'neutral' is <id>.png. */
  portraits: Record<string, Record<string, string>>;
  backgrounds: Record<string, ImageEntry>;
  plates: Record<string, ImageEntry>;
  props: Record<string, PropEntry>;
  icons: { atlas: string; cell: number; cols: number; ids: Record<string, number> };
  images: Record<string, ImageEntry>;
}

export function emptyManifest(): AssetManifest {
  return {
    version: 1, characters: {}, portraits: {}, backgrounds: {}, plates: {}, props: {},
    icons: { atlas: '', cell: 32, cols: 0, ids: {} }, images: {},
  };
}

let current: AssetManifest = emptyManifest();

export function manifest(): AssetManifest { return current; }

/** Normalises a parsed manifest (missing sections become empty) and makes it current. */
export function setManifest(raw: unknown): AssetManifest {
  const base = emptyManifest();
  const m = (raw && typeof raw === 'object' ? raw : {}) as Partial<AssetManifest>;
  current = {
    version: m.version ?? 1,
    characters: m.characters ?? base.characters,
    portraits: m.portraits ?? base.portraits,
    backgrounds: m.backgrounds ?? base.backgrounds,
    plates: m.plates ?? base.plates,
    props: m.props ?? base.props,
    icons: { ...base.icons, ...(m.icons ?? {}) },
    images: m.images ?? base.images,
  };
  for (const c of Object.values(current.characters)) c.poses ??= {};
  return current;
}

/** Absolute-ish URL for a manifest file path ('assets/…'), respecting Vite's base. */
export function assetUrl(file: string): string {
  if (/^(https?:|data:|blob:|\/)/.test(file)) return file;
  const base = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
  return base.endsWith('/') ? base + file : `${base}/${file}`;
}

/** Fetches public/assets/manifest.json (no cache) and makes it current. Never throws. */
export async function loadManifest(timeoutMs = 4000): Promise<AssetManifest> {
  if (typeof fetch !== 'function' || typeof window === 'undefined') return current;
  try {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = setTimeout(() => ctl?.abort(), timeoutMs);
    const res = await fetch(assetUrl('assets/manifest.json'), { cache: 'no-cache', signal: ctl?.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return setManifest(await res.json());
  } catch (err) {
    console.warn('[art] manifest.json could not be loaded — using placeholder art', err);
    return current;
  }
}

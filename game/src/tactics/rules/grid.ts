import type { Facing, Point, TerrainKind, Tile } from './types';

export interface TerrainInfo {
  /** German label for the tile info panel. */
  label: string;
  /** Move point cost to enter. */
  cost: number;
  /** Blocks movement and standing (rock, wall, tree, void). */
  blocks: boolean;
  /** Hit chance penalty for attacks against a unit standing here (percent points). */
  cover: number;
  /** Units standing here are hidden from distant enemies. */
  hides: boolean;
  /** Damage when entering or starting a phase here. */
  hazard: number;
  /** Blocks projectiles/beams passing over it. */
  blocksLine: boolean;
  /** Water softens falls. */
  soft: boolean;
  /** Short German effect text for the tile info panel. */
  note?: string;
}

export const TERRAIN: Record<TerrainKind, TerrainInfo> = {
  grass: { label: 'Gras', cost: 1, blocks: false, cover: 0, hides: false, hazard: 0, blocksLine: false, soft: false },
  dirt: { label: 'Erde', cost: 1, blocks: false, cover: 0, hides: false, hazard: 0, blocksLine: false, soft: false },
  stone: { label: 'Steinboden', cost: 1, blocks: false, cover: 0, hides: false, hazard: 0, blocksLine: false, soft: false },
  sand: { label: 'Sand', cost: 1, blocks: false, cover: 0, hides: false, hazard: 0, blocksLine: false, soft: false },
  water: { label: 'Wasser', cost: 2, blocks: false, cover: 0, hides: false, hazard: 0, blocksLine: false, soft: true, note: 'Kostet 2 Bewegung, dämpft Stürze' },
  mud: { label: 'Schlamm', cost: 2, blocks: false, cover: 0, hides: false, hazard: 0, blocksLine: false, soft: true, note: 'Kostet 2 Bewegung' },
  bush: { label: 'Gebüsch', cost: 1, blocks: false, cover: 30, hides: true, hazard: 0, blocksLine: false, soft: false, note: 'Deckung −30 % Trefferchance, verbirgt' },
  rock: { label: 'Fels', cost: 99, blocks: true, cover: 0, hides: false, hazard: 0, blocksLine: true, soft: false, note: 'Unpassierbar' },
  wall: { label: 'Mauer', cost: 99, blocks: true, cover: 0, hides: false, hazard: 0, blocksLine: true, soft: false, note: 'Unpassierbar' },
  tree: { label: 'Baum', cost: 99, blocks: true, cover: 0, hides: false, hazard: 0, blocksLine: true, soft: false, note: 'Unpassierbar' },
  fire: { label: 'Feuer', cost: 1, blocks: false, cover: 0, hides: false, hazard: 3, blocksLine: false, soft: false, note: '3 Schaden beim Betreten' },
  void: { label: 'Abgrund', cost: 99, blocks: true, cover: 0, hides: false, hazard: 0, blocksLine: false, soft: false },
};

/** Default ascii legend for terrain maps. */
export const DEFAULT_LEGEND: Record<string, TerrainKind> = {
  '.': 'grass', ',': 'dirt', ':': 'stone', s: 'sand', '~': 'water', m: 'mud',
  b: 'bush', r: 'rock', '#': 'wall', T: 'tree', f: 'fire', x: 'void', ' ': 'void',
};

export const DIRS: Record<Facing, Point> = { n: { x: 0, y: -1 }, e: { x: 1, y: 0 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 } };
export const FACINGS: Facing[] = ['n', 'e', 's', 'w'];
export const OPPOSITE: Record<Facing, Facing> = { n: 's', s: 'n', e: 'w', w: 'e' };

export const key = (x: number, y: number) => `${x},${y}`;
export const manhattan = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Dominant axis direction from a to b. Ties prefer the horizontal axis (deterministic). */
export function directionTo(a: Point, b: Point): Facing {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return 's';
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'e' : 'w';
  return dy > 0 ? 's' : 'n';
}

/** Facing that results from a single orthogonal step. */
export function stepFacing(from: Point, to: Point): Facing { return directionTo(from, to); }

export class Grid {
  readonly cols: number;
  readonly rows: number;
  private tiles: Tile[];

  constructor(cols: number, rows: number, tiles: Tile[]) {
    this.cols = cols; this.rows = rows; this.tiles = tiles;
  }

  /**
   * Parses a height map (digits 0-9, or letters a-z for 10+) and a terrain map (legend chars).
   * Rows may be given with spaces between cells for readability ("0 0 1 2") — spaces are stripped
   * when every row has spaces at odd indices.
   */
  static parse(height: string[], terrain: string[], legend: Record<string, TerrainKind> = {}): Grid {
    const leg = { ...DEFAULT_LEGEND, ...legend };
    const h = normalizeRows(height);
    const t = normalizeRows(terrain);
    const rows = h.length;
    const cols = Math.max(...h.map(r => r.length));
    if (t.length !== rows) throw new Error(`terrain map has ${t.length} rows, height map ${rows}`);
    const tiles: Tile[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const hc = h[y][x] ?? '0';
        const tc = t[y][x] ?? 'x';
        const kind = leg[tc];
        if (!kind) throw new Error(`unknown terrain char "${tc}" at ${x},${y}`);
        tiles.push({ x, y, h: parseHeight(hc), terrain: kind });
      }
    }
    return new Grid(cols, rows, tiles);
  }

  clone(): Grid { return new Grid(this.cols, this.rows, this.tiles.map(t => ({ ...t }))); }

  inBounds(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }
  tile(x: number, y: number): Tile | undefined { return this.inBounds(x, y) ? this.tiles[y * this.cols + x] : undefined; }
  height(x: number, y: number): number { return this.tile(x, y)?.h ?? 0; }
  info(x: number, y: number): TerrainInfo { return TERRAIN[this.tile(x, y)?.terrain ?? 'void']; }
  all(): readonly Tile[] { return this.tiles; }
  maxHeight(): number { return this.tiles.reduce((m, t) => Math.max(m, t.h), 0); }

  /** Changes a tile's terrain at runtime (e.g. fire spreading, a wall collapsing). */
  setTerrain(x: number, y: number, terrain: TerrainKind): void {
    const t = this.tile(x, y);
    if (t) t.terrain = terrain;
  }

  /** Standable: inside, not blocking terrain. */
  standable(x: number, y: number): boolean {
    const t = this.tile(x, y);
    return !!t && !TERRAIN[t.terrain].blocks;
  }

  neighbors(p: Point): Tile[] {
    const out: Tile[] = [];
    for (const f of FACINGS) {
      const t = this.tile(p.x + DIRS[f].x, p.y + DIRS[f].y);
      if (t) out.push(t);
    }
    return out;
  }

  /** Cells on the straight line between a and b (excluding both ends), Bresenham. */
  lineCells(a: Point, b: Point): Point[] {
    const cells: Point[] = [];
    let x0 = a.x, y0 = a.y;
    const dx = Math.abs(b.x - a.x), dy = -Math.abs(b.y - a.y);
    const sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (x0 === b.x && y0 === b.y) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
      if (x0 === b.x && y0 === b.y) break;
      cells.push({ x: x0, y: y0 });
    }
    return cells;
  }

  /**
   * Line of fire for projectiles: blocked by blocking props (rock/wall/tree) and by terrain that rises
   * clearly above the straight line between shooter and target (eye height +1).
   */
  hasLineOfFire(a: Point, b: Point): boolean {
    const ha = this.height(a.x, a.y) + 1, hb = this.height(b.x, b.y) + 1;
    const cells = this.lineCells(a, b);
    const total = cells.length + 1;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const t = this.tile(c.x, c.y);
      if (!t) continue;
      const lineH = ha + (hb - ha) * ((i + 1) / total);
      const obstacle = t.h + (TERRAIN[t.terrain].blocksLine ? 2 : 0);
      if (obstacle > lineH + 0.5) return false;
    }
    return true;
  }
}

function normalizeRows(rows: string[]): string[] {
  const trimmed = rows.map(r => r.replace(/\s+$/, ''));
  const spaced = trimmed.every(r => r.length < 2 || [...r].every((ch, i) => (i % 2 === 1 ? ch === ' ' : true)));
  const anySpace = trimmed.some(r => r.includes(' '));
  return spaced && anySpace ? trimmed.map(r => [...r].filter((_, i) => i % 2 === 0).join('')) : trimmed;
}

function parseHeight(ch: string): number {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  if (ch >= 'a' && ch <= 'z') return ch.charCodeAt(0) - 87;
  return 0;
}

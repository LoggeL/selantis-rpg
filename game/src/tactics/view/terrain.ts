import type Phaser from 'phaser';
import type { Grid } from '../rules/grid';
import type { TerrainKind, Tile } from '../rules/types';
import { BASE, IsoView, LEVEL, TH, TW, inDiamond, topEdgeY } from './iso';
import { getTex, sample, sample2, vnoise, type Tex, type TexId } from './paint';
import { hash } from './pixels';

/** Visual ground of a tile (rules terrain → painted surface; maps can repaint tiles via BattleMapDef.paint). */
export type Surface = 'grass' | 'drygrass' | 'forest' | 'dirt' | 'stone' | 'sand' | 'water' | 'mud' | 'scorched';

/** Default surface for a rules terrain (null = no tile). */
export function surfaceOf(t: TerrainKind): Surface | null {
  switch (t) {
    case 'grass': case 'bush': case 'tree': return 'grass';
    case 'dirt': case 'rock': return 'dirt';
    case 'stone': case 'wall': return 'stone';
    case 'sand': return 'sand';
    case 'water': return 'water';
    case 'mud': return 'mud';
    case 'fire': return 'scorched';
    case 'void': return null;
  }
}

/** Water surface sits a little below the tile top (the bank shows). */
export const WATER_DROP = 4;
export const WATER_FRAMES = 4;

interface SurfaceDef {
  top: TexId;
  /** Texels per tile edge (bigger = finer pattern). */
  scale: number;
  /** Colour multiplier for the top texture. */
  mul?: [number, number, number];
  /** Pulls the texture toward its average colour (0..1) to calm busy patterns at game scale. */
  soft?: number;
  /** Overhanging fringe on the side faces (grass hangs over the lip). */
  lip?: TexId;
  soil?: TexId;
  soilDepth: number;
  rock: TexId;
  /** Edge blending: a higher priority surface spills over a lower one at the same height. */
  priority: number;
}

const SURF: Record<Surface, SurfaceDef> = {
  grass: { top: 'grass', scale: 34, mul: [0.84, 1.0, 0.74], soft: 0.3, lip: 'grass', soil: 'cliffgrass', soilDepth: 9, rock: 'cliff', priority: 6 },
  drygrass: { top: 'drygrass', scale: 34, soft: 0.2, lip: 'drygrass', soil: 'cliffgrass', soilDepth: 9, rock: 'cliff', priority: 5 },
  forest: { top: 'forest', scale: 34, soft: 0.15, lip: 'forest', soil: 'cliffgrass', soilDepth: 8, rock: 'cliff', priority: 5 },
  dirt: { top: 'dirt', scale: 34, soil: 'cliffgrass', soilDepth: 7, rock: 'cliff', priority: 3 },
  scorched: { top: 'dirt', scale: 34, mul: [0.5, 0.42, 0.4], soil: 'cliff', soilDepth: 4, rock: 'cliff', priority: 4 },
  mud: { top: 'mud', scale: 34, soil: 'cliffgrass', soilDepth: 7, rock: 'cliff', priority: 2 },
  sand: { top: 'sand', scale: 34, soil: 'sand', soilDepth: 6, rock: 'cliff', priority: 2 },
  stone: { top: 'stone', scale: 44, rock: 'wall', soilDepth: 0, priority: 1 },
  water: { top: 'water', scale: 30, rock: 'water', soilDepth: 0, priority: 0 },
};

export interface TerrainAtlas {
  key: string;
  frame(x: number, y: number, f?: number): string;
  cellH: number;
}

export type SurfaceResolver = (x: number, y: number) => Surface | null;

interface Ctx {
  grid: Grid;
  iso: IsoView;
  surf: SurfaceResolver;
  tex: (id: TexId) => Tex;
  W: number;
  buf: Uint8ClampedArray;
}

const clamp = (v: number, a = 0, b = 255) => (v < a ? a : v > b ? b : v);

/** Rotated continuous coordinates → world (grid) coordinates. */
function toWorld(iso: IsoView, RX: number, RY: number): [number, number] {
  const C = iso.cols, R = iso.rows;
  switch (iso.rot & 3) {
    case 0: return [RX, RY];
    case 1: return [RY, R - RX];
    case 2: return [C - RX, R - RY];
    default: return [C - RY, RX];
  }
}

function heightAt(c: Ctx, x: number, y: number): number {
  if (!c.grid.inBounds(x, y)) return -1;
  return c.surf(x, y) ? c.grid.height(x, y) : -1;
}

/**
 * Paints one iso block (top face + two side faces) into the atlas buffer at (ox, oy) = top-left of the cell.
 * Everything is sampled in world space from the painted textures, so adjacent tiles continue seamlessly.
 */
function drawBlock(c: Ctx, ox: number, oy: number, t: Tile, frame: number): void {
  const { iso, buf, W } = c;
  const s0 = c.surf(t.x, t.y)!;
  const S = SURF[s0];
  const h = t.h;
  const r = iso.toRot(t.x, t.y);
  const nb = (rx: number, ry: number) => { const q = iso.fromRot(rx, ry); return heightAt(c, q.x, q.y); };
  const frontL = nb(r.x, r.y + 1), frontR = nb(r.x + 1, r.y), backL = nb(r.x - 1, r.y), backR = nb(r.x, r.y - 1);
  const water = s0 === 'water';
  const topOff = water ? WATER_DROP : 0;
  const sideH = h * LEVEL + BASE;
  const rgb = [0, 0, 0];
  const put = (x: number, y: number, rr: number, gg: number, bb: number) => {
    const i = ((oy + y) * W + ox + x) * 4;
    buf[i] = clamp(rr); buf[i + 1] = clamp(gg); buf[i + 2] = clamp(bb); buf[i + 3] = 255;
  };

  // ---------------------------------------------------------------- side faces
  for (let x = 0; x < TW; x++) {
    const left = x < TW / 2;
    const tcol = left ? (x + 0.5) / (TW / 2) : (x + 0.5 - TW / 2) / (TW / 2);
    // Texture u runs continuously along each screen-diagonal row of faces.
    const u = left ? (r.x + tcol) * 32 : 4096 - (r.y + 1 - tcol) * 32;
    const ey = topEdgeY(x) + 1;
    const hn = left ? frontL : frontR;
    const visible = hn < 0 ? sideH : hn >= h ? 0 : (h - hn) * LEVEL;
    const lipD = S.lip ? 2 + Math.floor(vnoise(u, 0, 3, 41) * 4.2) : 0;
    const soilD = S.soil ? S.soilDepth + Math.floor(vnoise(u, 0, 5, 42) * 5) : 0;
    for (let d = 0; d < sideH; d++) {
      const y = ey + d;
      const v = d - h * LEVEL;   // absolute height, so strata line up across tiles of different height
      let mul = left ? 0.94 : 0.66;
      if (water) {
        sample(c.tex('water'), u, v * 0.7, rgb);
        const k = 0.75 - Math.min(0.45, d / 60);
        rgb[0] *= k * 0.8; rgb[1] *= k * 0.9; rgb[2] *= k;
        if (d === 0) { rgb[0] = rgb[0] * 0.5 + 110; rgb[1] = rgb[1] * 0.5 + 140; rgb[2] = rgb[2] * 0.5 + 150; }
      } else if (d < lipD) {
        sample(c.tex(S.lip!), u, (v + 40) * 2, rgb);
        if (S.mul) { rgb[0] *= S.mul[0]; rgb[1] *= S.mul[1]; rgb[2] *= S.mul[2]; }
        mul *= d === lipD - 1 ? 0.72 : 0.9;
      } else if (d < soilD) {
        sample(c.tex(S.soil!), u, v, rgb);
        if (d === lipD && lipD > 0) mul *= 0.55;   // shadow under the grass fringe
      } else {
        sample(c.tex(S.rock), u, v, rgb);
        if (d === soilD && soilD > 0) mul *= 0.8;
      }
      // Deeper is darker; the front vertical edge catches light.
      mul *= 1 - Math.min(0.2, d / 160);
      if (left && x === TW / 2 - 1) mul *= 1.12;
      if (!left && x === TW / 2) mul *= 0.85;
      // Contact shadow where the face meets the lower ground in front.
      if (visible < sideH && d < visible) {
        const k = visible - d;
        if (k <= 5) mul *= 0.62 + k * 0.07;
      }
      const fromBottom = sideH - 1 - d;
      if (fromBottom < 4) mul *= 0.55 + fromBottom * 0.1;
      if (fromBottom === 0) mul *= 0.6;
      // cool shade on the right face, warm light on the left
      if (left) put(x, y, rgb[0] * mul * 1.04, rgb[1] * mul, rgb[2] * mul * 0.94);
      else put(x, y, rgb[0] * mul * 0.92, rgb[1] * mul * 0.96, rgb[2] * mul * 1.06);
    }
  }

  // ---------------------------------------------------------------- top face
  const tex0 = c.tex(S.top);
  const lowF = (l: boolean) => (l ? frontL : frontR) < h;
  const highB = (l: boolean) => (l ? backL : backR) > h;
  const sameB = (l: boolean) => (l ? backL : backR) === h;
  const wobU = [0, 1, 2, 1][frame % 4], wobV = [0, 1, 0, -1][frame % 4];
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    if (!inDiamond(x, y)) continue;
    const sx = x + 0.5 - TW / 2, sy = y + 0.5;
    const ru = sx / TW + sy / TH, rv = sy / TH - sx / TW;
    const [Px, Py] = toWorld(iso, r.x + ru, r.y + rv);
    // Which surface paints this pixel (edge blending into same-height neighbours).
    let surf = s0;
    if (!water) {
      const fu = Px - t.x, fv = Py - t.y;
      const n = vnoise(Px * 34, Py * 34, 5, 77);
      const reach = 0.3 * (0.2 + 0.8 * n);
      const sides: [number, number, number][] = [[fu, t.x - 1, t.y], [1 - fu, t.x + 1, t.y], [fv, t.x, t.y - 1], [1 - fv, t.x, t.y + 1]];
      let best = SURF[s0].priority;
      for (const [dist, nx, ny] of sides) {
        if (dist >= reach || !c.grid.inBounds(nx, ny)) continue;
        const o = c.surf(nx, ny);
        if (!o || o === 'water' || c.grid.height(nx, ny) !== h) continue;
        if (SURF[o].priority > best) { best = SURF[o].priority; surf = o; }
      }
    }
    const D = SURF[surf];
    const tx = surf === s0 ? tex0 : c.tex(D.top);
    const U = Px * D.scale, V = Py * D.scale;
    if (water) sample2(tx, U + wobU, V + wobV, 0.5, 0.5, rgb);
    else sample2(tx, U, V, D.scale / TH / 2, D.scale / TH / 2, rgb);
    let mul = 1;
    if (D.soft) { const k = D.soft, a = tx.avg; rgb[0] += (a[0] - rgb[0]) * k; rgb[1] += (a[1] - rgb[1]) * k; rgb[2] += (a[2] - rgb[2]) * k; }
    if (D.mul) { rgb[0] *= D.mul[0]; rgb[1] *= D.mul[1]; rgb[2] *= D.mul[2]; }
    // Large-scale variation breaks texture repetition.
    mul *= 0.93 + vnoise(Px, Py, 2.6, 9) * 0.14;
    const leftHalf = x < TW / 2;
    const ey = topEdgeY(x);
    const half = y < TH / 2;
    const backEdge = half && (x === TW / 2 - (y + 1) * 2 || x === TW / 2 - 1 + (y + 1) * 2 || x === TW / 2 - (y + 1) * 2 + 1 || x === TW / 2 - 2 + (y + 1) * 2);
    if (y === ey || y === ey - 1) {
      // Front lip: lit when it drops to lower ground, otherwise a faint seam.
      if (lowF(leftHalf)) mul *= y === ey ? 1.22 : 1.08;
      else if (y === ey) mul *= 0.96;
    }
    if (backEdge) {
      if (highB(leftHalf)) mul *= 0.6;
      else if (sameB(leftHalf)) mul *= 0.84;   // faint grid so tiles can be counted (FFTA readability)
      else mul *= 1.12;
    }
    // Ambient occlusion from a higher neighbour behind.
    if (!water) {
      if (backL > h && ru < 0.22) mul *= 0.7 + (ru / 0.22) * 0.3;
      if (backR > h && rv < 0.22) mul *= 0.7 + (rv / 0.22) * 0.3;
    }
    if (water) {
      const g = hash(Math.floor(Px * 30 + frame * 3), Math.floor(Py * 30 - frame), 5);
      if (g > 0.985) { rgb[0] = 220; rgb[1] = 245; rgb[2] = 250; mul = 1; }
    } else if (surf === 'scorched' && hash(Math.floor(Px * 24), Math.floor(Py * 24), 6) > 0.96) {
      rgb[0] = 240; rgb[1] = 120; rgb[2] = 40; mul = 1;
    }
    put(x, y + topOff, rgb[0] * mul, rgb[1] * mul, rgb[2] * mul);
  }
}

/**
 * Renders every tile for the current rotation into one canvas texture (frames 't<x>_<y>' and
 * 't<x>_<y>_f<n>' for animated water). Cached per (battle, rotation, version).
 */
export function buildTerrainAtlas(scene: Phaser.Scene, id: string, grid: Grid, iso: IsoView, surf: SurfaceResolver, version = 0): TerrainAtlas {
  const key = `tac-terrain-${id}-r${iso.rot}-v${version}`;
  const cellH = TH + grid.maxHeight() * LEVEL + BASE + 2;
  const atlas: TerrainAtlas = { key, cellH, frame: (x, y, f = 0) => (f ? `t${x}_${y}_f${f}` : `t${x}_${y}`) };
  if (scene.textures.exists(key)) return atlas;

  const tiles = grid.all().filter(t => surf(t.x, t.y));
  const cells: { t: Tile; f: number }[] = [];
  for (const t of tiles) {
    cells.push({ t, f: 0 });
    if (surf(t.x, t.y) === 'water') for (let f = 1; f < WATER_FRAMES; f++) cells.push({ t, f });
  }
  const perRow = 16;
  const W = perRow * TW, H = Math.max(1, Math.ceil(cells.length / perRow) * cellH);
  const texCache = new Map<TexId, Tex>();
  const ctx: Ctx = {
    grid, iso, surf, W, buf: new Uint8ClampedArray(W * H * 4),
    tex: tid => { let tx = texCache.get(tid); if (!tx) { tx = getTex(scene, tid); texCache.set(tid, tx); } return tx; },
  };
  const place: { name: string; x: number; y: number; h: number }[] = [];
  cells.forEach((cell, i) => {
    const cx = (i % perRow) * TW, cy = Math.floor(i / perRow) * cellH;
    drawBlock(ctx, cx, cy, cell.t, cell.f);
    place.push({ name: atlas.frame(cell.t.x, cell.t.y, cell.f), x: cx, y: cy, h: TH + cell.t.h * LEVEL + BASE });
  });
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(ctx.buf.buffer as ArrayBuffer), W, H), 0, 0);
  const tex = scene.textures.addCanvas(key, canvas)!;
  for (const pl of place) tex.add(pl.name, 0, pl.x, pl.y, TW, pl.h);
  return atlas;
}

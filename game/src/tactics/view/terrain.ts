import type Phaser from 'phaser';
import type { Grid } from '../rules/grid';
import type { TerrainKind, Tile } from '../rules/types';
import { BASE, IsoView, LEVEL, TH, TW } from './iso';
import { mix, pal } from './palette';
import { Pix, bayer, hash } from './pixels';

export type Surface = 'grass' | 'dirt' | 'stone' | 'sand' | 'water' | 'mud' | 'forest' | 'scorched';

export function surfaceOf(t: TerrainKind): Surface | null {
  switch (t) {
    case 'grass': case 'bush': return 'grass';
    case 'tree': return 'forest';
    case 'dirt': case 'rock': return 'dirt';
    case 'stone': case 'wall': return 'stone';
    case 'sand': return 'sand';
    case 'water': return 'water';
    case 'mud': return 'mud';
    case 'fire': return 'scorched';
    case 'void': return null;
  }
}

/** Water surface sits a little below the tile top. */
export const WATER_DROP = 3;
export const WATER_FRAMES = 4;

const topEdgeY = (x: number) => 8 + Math.floor(Math.min(x, TW - 1 - x) / 2);
const inDiamond = (x: number, y: number) => {
  if (y < 0 || y >= TH) return false;
  const half = y < 8 ? (y + 1) * 2 : (16 - y) * 2;
  return x >= 16 - half && x <= 15 + half;
};

interface Neigh { front: { l: number; r: number }; back: { l: number; r: number } }

/** Value noise in [0,1] with bilinear smoothing, seeded. */
function vnoise(x: number, y: number, s: number, salt: number): number {
  const xi = Math.floor(x / s), yi = Math.floor(y / s);
  const fx = x / s - xi, fy = y / s - yi;
  const a = hash(xi, yi, salt), b = hash(xi + 1, yi, salt), c = hash(xi, yi + 1, salt), d = hash(xi + 1, yi + 1, salt);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function topColor(s: Surface, u: number, v: number, wx: number, wy: number, frame: number): number {
  const n = vnoise(wx, wy, 6, 11) * 0.65 + vnoise(wx, wy, 2.5, 12) * 0.35;
  const d = bayer(wx, wy);
  switch (s) {
    case 'grass': {
      const t = n + (d - 0.5) * 0.18;
      return t < 0.3 ? pal('grass', 2) : t < 0.66 ? pal('grass', 3) : t < 0.86 ? pal('grass', 4) : mix(pal('grass', 4), pal('meadow', 3), 0.45);
    }
    case 'forest': {
      const t = n + (d - 0.5) * 0.2;
      return t < 0.35 ? pal('grass', 1) : t < 0.7 ? pal('grass', 2) : mix(pal('grass', 2), pal('earth', 3), 0.35);
    }
    case 'dirt': {
      const t = n + (d - 0.5) * 0.22;
      return t < 0.3 ? pal('earth', 2) : t < 0.72 ? pal('earth', 3) : pal('earth', 4);
    }
    case 'scorched': {
      const t = n + (d - 0.5) * 0.25;
      return t < 0.4 ? pal('ink', 2) : t < 0.75 ? pal('earth', 1) : pal('earth', 2);
    }
    case 'mud': {
      const t = n + (d - 0.5) * 0.2;
      return t < 0.35 ? pal('mud', 1) : t < 0.75 ? pal('mud', 2) : pal('mud', 3);
    }
    case 'sand': {
      const ripple = Math.sin((u * 0.9 + v * 0.35) + n * 3) > 0.82;
      const t = n + (d - 0.5) * 0.15;
      if (ripple) return pal('sand', 2);
      return t < 0.3 ? pal('sand', 2) : t < 0.8 ? pal('sand', 3) : pal('sand', 4);
    }
    case 'stone': {
      // Flagstones in tile space: offset rows, mortar lines.
      const row = Math.floor(v / 8);
      const uu = u + (row % 2) * 4;
      const mortar = v % 8 < 1 || uu % 8 < 1;
      if (mortar) return pal('warmstone', 1);
      const id = hash(Math.floor(uu / 8) + Math.floor(wx / 16) * 7, row + Math.floor(wy / 16) * 5, 3);
      const base = id < 0.33 ? 2 : id < 0.8 ? 3 : 4;
      const t = n + (d - 0.5) * 0.3;
      return t > 0.82 ? pal('warmstone', Math.min(5, base + 1)) : pal('warmstone', base);
    }
    case 'water': {
      const t = vnoise(wx + frame * 1.5, wy, 5, 21) + (d - 0.5) * 0.25;
      const glint = vnoise(wx * 1.3 - frame * 2.2, wy * 2.2, 3, 22);
      if (glint > 0.84) return pal('water', 6);
      if (glint > 0.76) return pal('water', 5);
      return t < 0.4 ? pal('water', 2) : t < 0.75 ? pal('water', 3) : pal('water', 4);
    }
  }
}

function sideMaterial(s: Surface): { soil: string; rock: string; soilDepth: number } {
  switch (s) {
    case 'grass': case 'forest': return { soil: 'earth', rock: 'warmstone', soilDepth: 5 };
    case 'dirt': case 'scorched': return { soil: 'earth', rock: 'warmstone', soilDepth: 6 };
    case 'mud': return { soil: 'mud', rock: 'warmstone', soilDepth: 6 };
    case 'sand': return { soil: 'sand', rock: 'warmstone', soilDepth: 7 };
    case 'stone': return { soil: 'stone', rock: 'stone', soilDepth: 0 };
    case 'water': return { soil: 'water', rock: 'water', soilDepth: 99 };
  }
}

/**
 * Draws one iso block (top face + two visible side faces) into `p` at (ox, oy) = top vertex - (16, 0).
 */
export function drawBlock(p: Pix, ox: number, oy: number, tile: Tile, surface: Surface, nb: Neigh, gx: number, gy: number, frame = 0): void {
  const h = tile.h;
  const sideH = h * LEVEL + BASE;
  const topOff = surface === 'water' ? WATER_DROP : 0;
  const mat = sideMaterial(surface);
  const seed = gx * 31 + gy * 17;

  // ---- side faces
  for (let x = 0; x < TW; x++) {
    const left = x < 16;
    const ey = topEdgeY(x);
    const s = left ? x : TW - 1 - x; // 0 at outer corner, 15 at front corner
    for (let d = 0; d < sideH; d++) {
      const y = oy + ey + 1 + d;
      const fromBottom = sideH - 1 - d;
      const levelLine = (d + (h * LEVEL) % LEVEL) % LEVEL === LEVEL - 1 && fromBottom > BASE - 1;
      let c: number;
      if (surface === 'water') {
        const t = d / Math.max(1, sideH);
        c = left ? mix(pal('water', 3), pal('water', 1), t) : mix(pal('water', 2), pal('water', 0), t);
        if (d < 1) c = pal('water', 5);
        else if ((x + d * 3 + frame) % 11 === 0 && d < sideH - 2) c = mix(c, pal('water', 5), 0.4);
      } else if (d < mat.soilDepth) {
        // Topsoil band with roots and grass drips.
        const r = hash(gx * 32 + x, gy * 32 + d, 5);
        const idx = left ? 3 : 2;
        c = pal(mat.soil, idx - (d === mat.soilDepth - 1 ? 1 : 0) - (r < 0.15 ? 1 : 0));
        if (d === 0) c = pal(mat.soil, idx - 1);
      } else {
        // Rock strata: shaded per level, cracks, embedded stones.
        const band = Math.floor((d - mat.soilDepth) / 4);
        const r = hash(gx * 32 + x + band * 7, gy * 32 + d, 9);
        let idx = left ? 3 : 1;
        if (hash(band + seed, x >> 2, 4) > 0.6) idx += 1;
        if (r < 0.08) idx -= 1;
        if (fromBottom < BASE) idx -= 1;
        c = pal(mat.rock, idx);
        if (mat.rock === 'stone') {
          // Ashlar bricks for stone surfaces.
          const by = d % 6, bx = (s + (Math.floor(d / 6) % 2) * 4) % 8;
          if (by === 5 || bx === 0) c = pal('stone', left ? 2 : 1);
          else if (by === 0) c = pal('stone', left ? 5 : 3);
        } else if (levelLine) c = pal(mat.rock, Math.max(0, idx - 2));
        else if ((d + s) % 7 === 0 && r > 0.85) c = pal(mat.rock, Math.min(5, idx + 2));
      }
      // Grass and moss drip over the lip where the face is exposed.
      if ((surface === 'grass' || surface === 'forest') && d < 4) {
        const drip = 1 + Math.floor(hash(gx * 32 + x, gy, 7) * 3.2);
        if (d < drip) c = pal('grass', d === drip - 1 ? (left ? 2 : 1) : left ? 3 : 2);
      }
      // Front corner highlight and AO toward the bottom.
      if (left && s === 15 && d > 0) c = mix(c, 0xffffff, 0.12);
      if (!left && s === 15 && d > 0) c = mix(c, 0x000000, 0.12);
      if (fromBottom < 3) c = mix(c, pal('ink', 0), 0.25 + (2 - fromBottom) * 0.12);
      if (fromBottom === 0) c = pal('ink', 1);
      p.set(ox + x, y, c);
    }
  }

  // ---- top face
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    if (!inDiamond(x, y)) continue;
    const u = y + (x - 16) / 2, v = y - (x - 16) / 2;
    const wx = gx * 16 + Math.floor(u), wy = gy * 16 + Math.floor(v);
    let c = topColor(surface, u, v, wx, wy, frame);
    const ey = topEdgeY(x);
    const isFront = y === ey;
    const half = y < 8 ? (y + 1) * 2 : (16 - y) * 2;
    const isBackEdge = y < 8 && (x === 16 - half || x === 15 + half);
    const leftSide = x < 16;
    // Gentle light gradient from the back-left.
    if (u < 2.5 && surface !== 'water') c = mix(c, 0xfff2c0, 0.1);
    if (isBackEdge) {
      const higher = leftSide ? nb.back.l > h : nb.back.r > h;
      c = higher ? mix(c, pal('ink', 0), 0.35) : mix(c, 0xffffff, 0.14);
    } else if (isFront) {
      const lower = leftSide ? nb.front.l < h : nb.front.r < h;
      c = lower ? mix(c, 0xfff6d0, surface === 'water' ? 0.35 : 0.22) : mix(c, pal('ink', 0), 0.22);
    }
    // Shadow cast from a higher neighbour behind.
    if (!isBackEdge && (leftSide ? nb.back.l > h && v < 3 : nb.back.r > h && u < 3) && surface !== 'water') c = mix(c, pal('night', 1), 0.22);
    p.set(ox + x, oy + y + topOff, c);
  }

  // ---- surface details
  const rnd = (i: number) => hash(gx * 97 + i, gy * 89 + i * 3, 13);
  const plot = (lx: number, ly: number, c: number, a = 1) => { if (inDiamond(lx, ly)) p.set(ox + lx, oy + ly + topOff, c, a); };
  if (surface === 'grass' || surface === 'forest') {
    const n = 4 + Math.floor(rnd(0) * 4);
    for (let i = 0; i < n; i++) {
      const tx = 5 + Math.floor(rnd(i + 1) * 22), ty = 3 + Math.floor(rnd(i + 20) * 10);
      if (!inDiamond(tx - 1, ty) || !inDiamond(tx + 1, ty + 1)) continue;
      const light = surface === 'grass' ? pal('grass', 5) : pal('grass', 3);
      const mid = surface === 'grass' ? pal('grass', 4) : pal('grass', 2);
      plot(tx, ty - 1, light); plot(tx - 1, ty, mid); plot(tx + 1, ty, mid); plot(tx, ty, light);
      plot(tx - 1, ty + 1, pal('grass', 1)); plot(tx, ty + 1, pal('grass', 1), 0.6); plot(tx + 1, ty + 1, pal('grass', 1));
    }
    if (surface === 'grass' && rnd(40) < 0.45) {
      const fx = 7 + Math.floor(rnd(41) * 18), fy = 4 + Math.floor(rnd(42) * 8);
      const fc = [pal('cream', 5), pal('yellow', 3), pal('pink', 3), pal('blue', 5)][Math.floor(rnd(43) * 4)];
      plot(fx, fy, fc); plot(fx, fy + 1, pal('grass', 1));
      if (rnd(44) < 0.5) { plot(fx + 3, fy + 2, fc); plot(fx + 3, fy + 3, pal('grass', 1)); }
    }
    if (surface === 'forest') {
      for (let i = 0; i < 5; i++) {
        const lx = 5 + Math.floor(rnd(60 + i) * 22), ly = 3 + Math.floor(rnd(70 + i) * 10);
        plot(lx, ly, [pal('orange', 2), pal('earth', 4), pal('yellow', 1)][i % 3]);
      }
    }
  } else if (surface === 'dirt' || surface === 'mud' || surface === 'scorched') {
    for (let i = 0; i < 4; i++) {
      const lx = 5 + Math.floor(rnd(i + 1) * 22), ly = 3 + Math.floor(rnd(i + 30) * 10);
      if (surface === 'mud') { plot(lx, ly, pal('water', 4), 0.55); plot(lx + 1, ly, pal('water', 5), 0.4); continue; }
      if (surface === 'scorched') { plot(lx, ly, pal('fire', 1), 0.8); continue; }
      plot(lx, ly, pal('stone', 4)); plot(lx + 1, ly, pal('stone', 3)); plot(lx, ly + 1, pal('earth', 1));
    }
  } else if (surface === 'sand') {
    for (let i = 0; i < 3; i++) plot(5 + Math.floor(rnd(i) * 22), 3 + Math.floor(rnd(i + 9) * 10), pal('cream', 5));
  } else if (surface === 'stone') {
    if (rnd(5) < 0.6) for (let i = 0; i < 3; i++) plot(6 + Math.floor(rnd(i + 50) * 20), 3 + Math.floor(rnd(i + 51) * 10), pal('grass', 2));
  }
}

export interface TerrainAtlas {
  key: string;
  frame(x: number, y: number, f?: number): string;
  cellH: number;
}

/**
 * Renders every tile for the current rotation into one canvas texture (frames 't<x>_<y>' and
 * 't<x>_<y>_f<n>' for animated water). Cached per (battle, rotation, version).
 */
export function buildTerrainAtlas(scene: Phaser.Scene, id: string, grid: Grid, iso: IsoView, version = 0): TerrainAtlas {
  const key = `tac-terrain-${id}-r${iso.rot}-v${version}`;
  const cellH = TH + grid.maxHeight() * LEVEL + BASE + 2;
  const atlas: TerrainAtlas = { key, cellH, frame: (x, y, f = 0) => (f ? `t${x}_${y}_f${f}` : `t${x}_${y}`) };
  if (scene.textures.exists(key)) return atlas;

  const tiles = grid.all().filter(t => surfaceOf(t.terrain));
  const cells: { t: Tile; f: number }[] = [];
  for (const t of tiles) {
    cells.push({ t, f: 0 });
    if (t.terrain === 'water') for (let f = 1; f < WATER_FRAMES; f++) cells.push({ t, f });
  }
  const perRow = 16;
  const W = perRow * TW, H = Math.ceil(cells.length / perRow) * cellH;
  const p = new Pix(W, Math.max(1, H));
  const hAt = (x: number, y: number) => (grid.inBounds(x, y) && surfaceOf(grid.tile(x, y)!.terrain) ? grid.height(x, y) : -1);
  const place: { name: string; x: number; y: number; h: number }[] = [];
  cells.forEach((cell, i) => {
    const cx = (i % perRow) * TW, cy = Math.floor(i / perRow) * cellH;
    const { t, f } = cell;
    const r = iso.toRot(t.x, t.y);
    const g = (rx: number, ry: number) => { const q = iso.fromRot(rx, ry); return hAt(q.x, q.y); };
    const nb: Neigh = {
      front: { l: g(r.x, r.y + 1), r: g(r.x + 1, r.y) },
      back: { l: g(r.x - 1, r.y), r: g(r.x, r.y - 1) },
    };
    drawBlock(p, cx, cy, t, surfaceOf(t.terrain)!, nb, t.x, t.y, f);
    place.push({ name: atlas.frame(t.x, t.y, f), x: cx, y: cy, h: TH + t.h * LEVEL + BASE });
  });
  const tex = scene.textures.addCanvas(key, p.toCanvas())!;
  for (const pl of place) tex.add(pl.name, 0, pl.x, pl.y, TW, pl.h);
  return atlas;
}

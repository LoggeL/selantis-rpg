// Reine Rasterregeln der Traumschlacht – keine Phaser-Abhängigkeit.

export type Cell = { x: number; y: number };
export type Side = 'valentus' | 'enemy' | 'ally';

export interface Unit {
  id: string;
  kind: 'valentus' | 'warrior' | 'axe' | 'crossbow' | 'boy' | 'falke';
  side: Side;
  cell: Cell;
  hp: number;
  alive: boolean;
}

export const GRID = { cols: 11, rows: 7, originX: 48, originY: 88, size: 32 };

/** Fels links oben: blockiert Bewegung und Sichtlinie. */
export const ROCK: Cell[] = [
  { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },
];

export const MOVE_RANGE = 4;
export const BEAM_LENGTH = 7;
export const BEAM_DAMAGE = 100;
export const WAVE_RANGE = 4;
export const WAVE_DAMAGE = 80;
export const WAVE_PUSH = 2;
export const COLLISION_DAMAGE = 40;

export const DIRS: Cell[] = [
  { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
  { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
];

export const eq = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
export const key = (c: Cell) => `${c.x},${c.y}`;
export const inside = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < GRID.cols && c.y < GRID.rows;
export const isRock = (c: Cell) => ROCK.some((r) => eq(r, c));
export const manhattan = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function cellCenter(c: Cell) {
  return { x: GRID.originX + c.x * GRID.size + GRID.size / 2, y: GRID.originY + c.y * GRID.size + GRID.size / 2 };
}
/** Fußpunkt einer Figur: etwas unterhalb der Zellmitte. */
export function cellFoot(c: Cell) {
  const m = cellCenter(c);
  return { x: m.x, y: m.y + 10 };
}
export function cellAt(px: number, py: number): Cell | null {
  const c = { x: Math.floor((px - GRID.originX) / GRID.size), y: Math.floor((py - GRID.originY) / GRID.size) };
  return inside(c) ? c : null;
}

export const unitAt = (units: Unit[], c: Cell) => units.find((u) => u.alive && eq(u.cell, c));

/** Erreichbare Felder per Breitensuche; Figuren und Fels blockieren. */
export function reachable(units: Unit[], from: Cell, range = MOVE_RANGE): Map<string, Cell[]> {
  const paths = new Map<string, Cell[]>([[key(from), [from]]]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    const path = paths.get(key(cur))!;
    if (path.length - 1 >= range) continue;
    for (const d of DIRS.filter((d) => d.x === 0 || d.y === 0)) {
      const n = { x: cur.x + d.x, y: cur.y + d.y };
      if (!inside(n) || isRock(n) || paths.has(key(n)) || unitAt(units, n)) continue;
      paths.set(key(n), [...path, n]);
      queue.push(n);
    }
  }
  return paths;
}

/** Strahl: bis BEAM_LENGTH Felder in eine der 8 Richtungen, durchdringt Figuren, endet am Fels. */
export function beamCells(from: Cell, dir: Cell): Cell[] {
  const out: Cell[] = [];
  let c = from;
  for (let i = 0; i < BEAM_LENGTH; i++) {
    const n = { x: c.x + dir.x, y: c.y + dir.y };
    if (!inside(n) || isRock(n)) break;
    // Diagonal an einer Felsecke vorbei: blockiert
    if (dir.x !== 0 && dir.y !== 0 && (isRock({ x: c.x + dir.x, y: c.y }) || isRock({ x: c.x, y: c.y + dir.y }))) break;
    out.push(n);
    c = n;
  }
  return out;
}

/** Richtung aus Mausposition relativ zu Valentus (8er-Raster). */
export function dirFromVector(dx: number, dy: number): Cell {
  const a = Math.atan2(dy, dx);
  const i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return DIRS[i];
}

export function waveArea(center: Cell): Cell[] {
  const out: Cell[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const c = { x: center.x + dx, y: center.y + dy };
    if (inside(c)) out.push(c);
  }
  return out;
}

export interface Push { unit: Unit; path: Cell[]; end: Cell; collidedWith?: Unit; hitWall: boolean }

/** Druckwelle: trifft nur Feinde in der 3x3-Fläche, stößt sie WAVE_PUSH Felder vom Mittelpunkt weg. */
export function wavePushes(units: Unit[], center: Cell, caster: Cell): Push[] {
  const area = waveArea(center);
  const victims = units.filter((u) => u.alive && u.side === 'enemy' && area.some((c) => eq(c, u.cell)))
    .sort((a, b) => manhattan(b.cell, center) - manhattan(a.cell, center) || a.id.localeCompare(b.id));
  const occupied = new Set(units.filter((u) => u.alive).map((u) => key(u.cell)));
  const pushes: Push[] = [];
  for (const u of victims) {
    let dx = u.cell.x - center.x, dy = u.cell.y - center.y;
    if (dx === 0 && dy === 0) { dx = u.cell.x - caster.x; dy = u.cell.y - caster.y; }
    const step = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
    const path: Cell[] = [];
    let c = u.cell, collidedWith: Unit | undefined, hitWall = false;
    occupied.delete(key(u.cell));
    for (let i = 0; i < WAVE_PUSH; i++) {
      const n = { x: c.x + step.x, y: c.y + step.y };
      if (!inside(n) || isRock(n)) { hitWall = true; break; }
      if (occupied.has(key(n))) { collidedWith = unitAt(units, n); break; }
      path.push(n);
      c = n;
    }
    occupied.add(key(c));
    pushes.push({ unit: u, path, end: c, collidedWith, hitWall });
  }
  return pushes;
}

/** Bolzenlinie vom Schützen zum Ziel (diagonal oder gerade); stoppt am ersten Körper. */
export function boltLine(from: Cell, to: Cell): Cell[] {
  const dx = Math.sign(to.x - from.x), dy = Math.sign(to.y - from.y);
  const out: Cell[] = [];
  let c = from;
  while (!eq(c, to)) {
    c = { x: c.x + dx, y: c.y + dy };
    out.push(c);
    if (out.length > 12) break;
  }
  return out;
}

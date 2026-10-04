// Pure combat grid rules, independent of rendering and encounter configuration.

export type Cell = { x: number; y: number };
export type Side = 'valentus' | 'enemy' | 'ally';

export interface Unit {
  id: string;
  kind: 'valentus' | 'warrior' | 'axe' | 'crossbow' | 'boy' | 'falke';
  side: Side;
  cell: Cell;
  hp: number;
  alive: boolean;
  /** Alive, but unable to act after a nonlethal defeat. */
  wounded?: boolean;
  speed?: number;
  attack?: number;
  defense?: number;
  move?: number;
  attackRange?: number;
  magicAttack?: number;
}

export interface BattleBoard { cols: number; rows: number; blocked: Cell[] }
export interface GridLayout { originX: number; originY: number; size: number }

export const DIRS: Cell[] = [
  { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
  { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
];

export const eq = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
export const key = (c: Cell) => `${c.x},${c.y}`;
export const inside = (c: Cell, board: BattleBoard) => c.x >= 0 && c.y >= 0 && c.x < board.cols && c.y < board.rows;
export const isBlocked = (c: Cell, board: BattleBoard) => board.blocked.some((blocked) => eq(blocked, c));
export const manhattan = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function cellCenter(c: Cell, layout: GridLayout) {
  return { x: layout.originX + c.x * layout.size + layout.size / 2, y: layout.originY + c.y * layout.size + layout.size / 2 };
}
/** Fußpunkt einer Figur: etwas unterhalb der Zellmitte. */
export function cellFoot(c: Cell, layout: GridLayout) {
  const m = cellCenter(c, layout);
  return { x: m.x, y: m.y + 10 };
}
export function cellAt(px: number, py: number, board: BattleBoard, layout: GridLayout): Cell | null {
  const c = { x: Math.floor((px - layout.originX) / layout.size), y: Math.floor((py - layout.originY) / layout.size) };
  return inside(c, board) ? c : null;
}

export const unitAt = (units: Unit[], c: Cell) => units.find((u) => u.alive && !u.wounded && eq(u.cell, c));

/** Keep scripted spawns nearby without placing living units on one another. */
export function freeCell(units: Unit[], preferred: Cell, board: BattleBoard): Cell {
  const cells: Cell[] = [];
  for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.cols; x++) {
    const c = { x, y };
    if (!isBlocked(c, board) && !unitAt(units, c)) cells.push(c);
  }
  cells.sort((a, b) => manhattan(a, preferred) - manhattan(b, preferred));
  if (!cells.length) throw new Error('No free battle cell');
  return cells[0];
}

/** Erreichbare Felder per Breitensuche; Figuren und Fels blockieren. */
export function reachable(units: Unit[], from: Cell, range: number, board: BattleBoard): Map<string, Cell[]> {
  const paths = new Map<string, Cell[]>([[key(from), [from]]]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    const path = paths.get(key(cur))!;
    if (path.length - 1 >= range) continue;
    for (const d of DIRS.filter((d) => d.x === 0 || d.y === 0)) {
      const n = { x: cur.x + d.x, y: cur.y + d.y };
      if (!inside(n, board) || isBlocked(n, board) || paths.has(key(n)) || unitAt(units, n)) continue;
      paths.set(key(n), [...path, n]);
      queue.push(n);
    }
  }
  return paths;
}

/** Strahl: bis length Felder in eine der 8 Richtungen, durchdringt Figuren, endet am Fels. */
export function beamCells(from: Cell, dir: Cell, length: number, board: BattleBoard): Cell[] {
  const out: Cell[] = [];
  let c = from;
  for (let i = 0; i < length; i++) {
    const n = { x: c.x + dir.x, y: c.y + dir.y };
    if (!inside(n, board) || isBlocked(n, board)) break;
    // Diagonal an einer Felsecke vorbei: blockiert
    if (dir.x !== 0 && dir.y !== 0 && (isBlocked({ x: c.x + dir.x, y: c.y }, board) || isBlocked({ x: c.x, y: c.y + dir.y }, board))) break;
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

export function waveArea(center: Cell, board: BattleBoard, radius = 1): Cell[] {
  const out: Cell[] = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const c = { x: center.x + dx, y: center.y + dy };
    if (inside(c, board)) out.push(c);
  }
  return out;
}

export interface Push { unit: Unit; path: Cell[]; end: Cell; collidedWith?: Unit; hitWall: boolean }

/** Druckwelle: trifft Feinde im Radius und stößt sie vom Mittelpunkt weg. */
export function wavePushes(units: Unit[], center: Cell, caster: Cell, board: BattleBoard, distance = 2, radius = 1): Push[] {
  const area = waveArea(center, board, radius);
  const victims = units.filter((u) => u.alive && !u.wounded && u.side === 'enemy' && area.some((c) => eq(c, u.cell)))
    .sort((a, b) => manhattan(b.cell, center) - manhattan(a.cell, center) || a.id.localeCompare(b.id));
  const occupied = new Map(units.filter((u) => u.alive && !u.wounded).map((u) => [key(u.cell), u]));
  const pushes: Push[] = [];
  for (const u of victims) {
    let dx = u.cell.x - center.x, dy = u.cell.y - center.y;
    if (dx === 0 && dy === 0) { dx = u.cell.x - caster.x; dy = u.cell.y - caster.y; }
    const step = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
    const path: Cell[] = [];
    let c = u.cell, collidedWith: Unit | undefined, hitWall = false;
    occupied.delete(key(u.cell));
    for (let i = 0; i < distance; i++) {
      const n = { x: c.x + step.x, y: c.y + step.y };
      if (!inside(n, board) || isBlocked(n, board)) { hitWall = true; break; }
      if (occupied.has(key(n))) { collidedWith = occupied.get(key(n)); break; }
      path.push(n);
      c = n;
    }
    occupied.set(key(c), u);
    pushes.push({ unit: u, path, end: c, collidedWith, hitWall });
  }
  return pushes;
}

/** Integer sightline including its target, even when a spawn shifted to a free cell. */
export function boltLine(from: Cell, to: Cell, board: BattleBoard): Cell[] {
  const out: Cell[] = [];
  let x = from.x, y = from.y;
  const dx = Math.abs(to.x - x), dy = -Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1;
  let error = dx + dy;
  while (x !== to.x || y !== to.y) {
    const twiceError = 2 * error;
    if (twiceError >= dy) { error += dy; x += sx; }
    if (twiceError <= dx) { error += dx; y += sy; }
    const cell = { x, y };
    if (!inside(cell, board) || isBlocked(cell, board)) break;
    out.push(cell);
  }
  return out;
}

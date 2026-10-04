import { CELL, CollisionGrid } from './grid';
import type { Vec } from './geom';

interface AgentCache { version: number; hw: number; hh: number; walk: Uint8Array }
const caches = new WeakMap<CollisionGrid, AgentCache[]>();

/** Walkability per cell for an agent with the given foot box (cached per grid version). */
export function agentGrid(grid: CollisionGrid, hw: number, hh: number): Uint8Array {
  let list = caches.get(grid);
  if (!list) caches.set(grid, (list = []));
  const hit = list.find(c => c.hw === hw && c.hh === hh);
  if (hit && hit.version === grid.version) return hit.walk;
  const walk = new Uint8Array(grid.cols * grid.rows);
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    walk[r * grid.cols + c] = grid.boxFree(c * CELL + CELL / 2, r * CELL + CELL / 2, hw, hh) ? 1 : 0;
  }
  if (hit) { hit.version = grid.version; hit.walk = walk; } else list.push({ version: grid.version, hw, hh, walk });
  return walk;
}

/** Binary min-heap keyed by f. */
class Heap {
  private items: number[] = [];
  private keys: number[] = [];
  get size() { return this.items.length; }
  clear() { this.items.length = 0; this.keys.length = 0; }
  push(item: number, key: number) {
    const a = this.items, k = this.keys;
    a.push(item); k.push(key);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [a[p], a[i]] = [a[i], a[p]]; [k[p], k[i]] = [k[i], k[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.items, k = this.keys;
    const top = a[0];
    const lastI = a.pop()!, lastK = k.pop()!;
    if (a.length) {
      a[0] = lastI; k[0] = lastK;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && k[l] < k[m]) m = l;
        if (r < a.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; [k[m], k[i]] = [k[i], k[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Nearest walkable cell to (c, r) by expanding rings, or -1. */
export function nearestWalkable(grid: CollisionGrid, walk: Uint8Array, c: number, r: number, maxRadius = 24): number {
  const cols = grid.cols;
  if (grid.inBounds(c, r) && walk[r * cols + c]) return r * cols + c;
  for (let rad = 1; rad <= maxRadius; rad++) {
    let best = -1, bestD = Infinity;
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
      const cc = c + dx, rr = r + dy;
      if (!grid.inBounds(cc, rr) || !walk[rr * cols + cc]) continue;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = rr * cols + cc; }
    }
    if (best >= 0) return best;
  }
  return -1;
}

const SQRT2 = Math.SQRT2;
const DIRS: [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2]];

export interface PathOptions { hw?: number; hh?: number; maxNodes?: number; smooth?: boolean }

/**
 * Scratch buffers reused across searches on the same grid. A generation stamp marks which entries belong to the
 * current search, so nothing has to be cleared or reallocated (24 wandering NPCs used to allocate MBs per second).
 */
interface SearchPool { n: number; gen: number; seen: Uint32Array; closed: Uint32Array; g: Float32Array; came: Int32Array; heap: Heap }
const pools = new WeakMap<CollisionGrid, SearchPool>();
function poolFor(grid: CollisionGrid): SearchPool {
  const n = grid.cols * grid.rows;
  let p = pools.get(grid);
  if (!p || p.n !== n) {
    p = { n, gen: 0, seen: new Uint32Array(n), closed: new Uint32Array(n), g: new Float32Array(n), came: new Int32Array(n), heap: new Heap() };
    pools.set(grid, p);
  }
  p.gen++;
  if (p.gen >= 0xfffffff0) { p.gen = 1; p.seen.fill(0); p.closed.fill(0); }
  p.heap.clear();
  return p;
}

/**
 * Goal cell for a target that may lie deep inside water or a building: nearest walkable cell around it, otherwise
 * the first walkable cell when marching from the target back towards `from` (so clicks into a pond still move).
 */
export function goalCell(grid: CollisionGrid, walk: Uint8Array, from: Vec, to: Vec): number {
  const near = nearestWalkable(grid, walk, Math.floor(to.x / CELL), Math.floor(to.y / CELL), 12);
  if (near >= 0) return near;
  const d = Math.hypot(from.x - to.x, from.y - to.y);
  const steps = Math.ceil(d / CELL);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const c = Math.floor((to.x + (from.x - to.x) * t) / CELL), r = Math.floor((to.y + (from.y - to.y) * t) / CELL);
    if (grid.inBounds(c, r) && walk[r * grid.cols + c]) return r * grid.cols + c;
  }
  return -1;
}

/**
 * A* on the fine grid (8 directions, no corner cutting) followed by line-of-sight smoothing.
 * Returns pixel waypoints (excluding the start, ending at the target or the nearest reachable spot), or null.
 */
export function findPath(grid: CollisionGrid, from: Vec, to: Vec, opts: PathOptions = {}): Vec[] | null {
  const hw = opts.hw ?? 3.5, hh = opts.hh ?? 2;
  const walk = agentGrid(grid, hw, hh);
  const cols = grid.cols;
  const start = nearestWalkable(grid, walk, Math.floor(from.x / CELL), Math.floor(from.y / CELL), 6);
  const goal = start < 0 ? -1 : goalCell(grid, walk, from, to);
  if (start < 0 || goal < 0) return null;
  const goalExact = goal === Math.floor(to.y / CELL) * cols + Math.floor(to.x / CELL);
  const gx = goal % cols, gy = (goal / cols) | 0;
  const pool = poolFor(grid);
  const { seen, closed, g, came, heap, gen } = pool;
  const h = (i: number) => {
    const dx = Math.abs((i % cols) - gx), dy = Math.abs(((i / cols) | 0) - gy);
    return (dx + dy) + (SQRT2 - 2) * Math.min(dx, dy);
  };
  seen[start] = gen; g[start] = 0; came[start] = -1;
  heap.push(start, h(start));
  const maxNodes = opts.maxNodes ?? 60000;
  let expanded = 0, found = false;
  // Track the closest node in case the goal is unreachable (different island).
  let bestNode = start, bestH = h(start);
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    if (cur === goal) { found = true; break; }
    if (++expanded > maxNodes) break;
    const hc = h(cur);
    if (hc < bestH) { bestH = hc; bestNode = cur; }
    const cx = cur % cols, cy = (cur / cols) | 0;
    const gc = g[cur];
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!grid.inBounds(nx, ny)) continue;
      const ni = ny * cols + nx;
      if (!walk[ni] || closed[ni] === gen) continue;
      if (dx !== 0 && dy !== 0 && (!walk[cy * cols + nx] || !walk[ny * cols + cx])) continue; // no corner cutting
      const ng = gc + cost;
      if (seen[ni] !== gen || ng < g[ni]) { seen[ni] = gen; g[ni] = ng; came[ni] = cur; heap.push(ni, ng + h(ni)); }
    }
  }
  const end = found ? goal : bestNode;
  if (end === start) {
    if (!found) return null;
    const p = goalExact ? { x: to.x, y: to.y } : { x: (goal % cols) * CELL + CELL / 2, y: ((goal / cols) | 0) * CELL + CELL / 2 };
    return grid.boxFree(p.x, p.y, hw, hh) ? [p] : null;
  }
  const cells: Vec[] = [];
  for (let i = end; i !== -1; i = came[i]) cells.push({ x: (i % cols) * CELL + CELL / 2, y: ((i / cols) | 0) * CELL + CELL / 2 });
  cells.reverse();
  // Replace the end with the exact target if it is reachable from the last cell.
  const last = cells[cells.length - 1];
  if (found && grid.boxFree(to.x, to.y, hw, hh) && lineFree(grid, last, to, hw, hh)) cells[cells.length - 1] = { x: to.x, y: to.y };
  cells[0] = { x: from.x, y: from.y };
  const path = opts.smooth === false ? cells : smoothPath(grid, cells, hw, hh);
  return path.slice(1);
}

/** True if a box can travel in a straight line from a to b. */
export function lineFree(grid: CollisionGrid, a: Vec, b: Vec, hw: number, hh: number): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(d / 1.5));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!grid.boxFree(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, hw, hh)) return false;
  }
  return true;
}

/** Greedy string pulling: keeps only waypoints needed to stay collision free. */
export function smoothPath(grid: CollisionGrid, pts: Vec[], hw: number, hh: number): Vec[] {
  if (pts.length <= 2) return pts.slice();
  const out: Vec[] = [pts[0]];
  let anchor = 0;
  while (anchor < pts.length - 1) {
    let next = anchor + 1;
    for (let j = pts.length - 1; j > anchor + 1; j--) {
      if (lineFree(grid, pts[anchor], pts[j], hw, hh)) { next = j; break; }
    }
    out.push(pts[next]);
    anchor = next;
  }
  return out;
}

// Vamir forcing his way into Lia's inner meadow, drawn in code (no new art): jagged cold-violet cracks in the grass
// with a glow and a little light, a calm ring round Lia's feet that fills while she holds still, and the final tear
// (cracks all over the meadow, a violet then white flash). Violet is Vamir's colour (umsetzung.md §1); the inner world
// itself stays lavender and warm white (innere-zuflucht-nebel.ts). Everything is removed when the scene shuts down.
import type Phaser from 'phaser';
import type { LightHandle, WorldCtx } from '../../world';
import { VIOLET } from './shared';

type WorldSceneLike = Phaser.Scene & { addWorld?<T extends Phaser.GameObjects.GameObject>(o: T): T };
const ADD = 1; // Phaser.BlendModes.ADD
const CALM = 0xf3eefc;
const DEEP = 0x100c1b;
const RIM = 0xaa87ce;
const SOIL = 0x36442b;
const GRASS = 0x778952;
type Point = { x: number; y: number };

const world = <T extends Phaser.GameObjects.GameObject>(w: WorldCtx, o: T): T => {
  const s = w.scene as WorldSceneLike;
  return s.addWorld ? s.addWorld(o) : o;
};

/** A long split with smaller forks, rather than radial arms resembling a magic sigil. */
function crackPoints(seed: number, len: number): Point[][] {
  let r = seed * 9301 + 49297;
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const slope = (rnd() - 0.5) * 0.28;
  const seam = Array.from({ length: 9 }, (_, i) => {
    const x = (i / 8 * 2 - 1) * len;
    return { x, y: x * slope + (rnd() - 0.5) * len * 0.2 };
  });
  const branches = [seam];
  for (let b = 0; b < 2; b++) {
    const start = seam[3 + b * 2];
    const pts = [{ ...start }];
    let x = start.x, y = start.y;
    for (let i = 0; i < 3; i++) {
      x += (rnd() - 0.5) * len * 0.35;
      y += (b === 0 ? -1 : 1) * len * (0.12 + rnd() * 0.08);
      pts.push({ x, y });
    }
    branches.push(pts);
  }
  return branches;
}

/** Tapered banks around a branch, flattened to the meadow's ground plane. */
function banks(points: Point[], width: number): [Point[], Point[]] {
  const upper: Point[] = [], lower: Point[] = [];
  points.forEach((p, i) => {
    const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - prev.x, dy = next.y - prev.y;
    const length = Math.hypot(dx, dy) || 1;
    const half = width * (0.08 + 0.42 * Math.sin(Math.PI * i / (points.length - 1)));
    const nx = -dy / length * half, ny = dx / length * half * 0.65;
    upper.push({ x: p.x - nx, y: p.y - ny });
    lower.push({ x: p.x + nx, y: p.y + ny });
  });
  return [upper, lower];
}

export interface RiftView {
  /** 1 = wide open, 0 = closed (the crack thins and fades with the calm). */
  setOpen(f: number): void;
  close(ms?: number): Promise<void>;
  remove(): void;
}

/** A violet crack in the meadow at `at`. */
export function drawRift(w: WorldCtx, at: readonly [number, number], seed: number, size = 34): RiftView {
  const scene = w.scene;
  // On the ground: above the painted meadow, under every figure (Lia stands on it while she closes it).
  const glow = world(w, scene.add.image(at[0], at[1] - 2, 'w-glow').setBlendMode(ADD).setTint(VIOLET).setDepth(-120).setScale(0.2).setAlpha(0));
  const g = world(w, scene.add.graphics().setDepth(-110));
  let light: LightHandle | null = null;
  try { light = w.lighting.add({ id: `e3-hw-riss-${seed}`, at: [at[0], at[1] - 4], kind: 'plain', color: VIOLET, radius: 40, intensity: 0, always: true }); } catch { light = null; }
  const branches = crackPoints(seed, size);
  let open = 0, target = 1, t = 0, gone = false;
  const onPost = (_time: number, delta: number) => {
    const dt = Math.min(0.1, delta / 1000);
    t += dt;
    open += Math.sign(target - open) * Math.min(Math.abs(target - open), dt * 2.5);
    g.clear();
    if (open <= 0.01) { glow.setAlpha(0); light?.set({ intensity: 0 }); return; }
    const flicker = 0.92 + 0.08 * Math.sin(t * 3 + seed);
    const placed = (p: Point): Point => ({ x: at[0] + p.x * open, y: at[1] + p.y * open });
    for (const [b, pts] of branches.entries()) {
      const width = b === 0 ? 10 : 5;
      const [outerTop, outerBottom] = banks(pts, width + 6);
      const [top, bottom] = banks(pts, width);
      // Grass darkens at the torn edge; the centre remains an opening, without a bright line across it.
      g.fillStyle(SOIL, 0.65 * open);
      g.fillPoints([...outerTop, ...outerBottom.reverse()].map(placed), true);
      g.fillStyle(DEEP, 0.98 * open);
      g.fillPoints([...top, ...bottom.slice().reverse()].map(placed), true);
      for (const [edge, color, alpha] of [[top, RIM, 0.62], [bottom, SOIL, 0.9]] as const) {
        g.lineStyle(b === 0 ? 1.2 : 0.8, color, alpha * open * flicker);
        g.beginPath();
        const first = placed(edge[0]);
        g.moveTo(first.x, first.y);
        for (const p of edge.slice(1)) { const q = placed(p); g.lineTo(q.x, q.y); }
        g.strokePath();
      }
      // A few bent blades bridge the painted meadow and the code-drawn bank.
      g.lineStyle(1, GRASS, 0.75 * open);
      for (let i = 1; i < pts.length - 1; i += 2) {
        const p = placed((i % 4 === 1 ? top : bottom)[i]);
        const lean = (seed + i) % 2 ? -1 : 1;
        g.lineBetween(p.x, p.y, p.x + lean * 2 * open, p.y - 3 * open);
        g.lineBetween(p.x, p.y, p.x - lean * open, p.y - 2 * open);
      }
    }
    glow.setScale(0.25 + 0.35 * open).setAlpha(0.22 * open * flicker);
    light?.set({ intensity: 0.45 * open });
  };
  scene.events.on('postupdate', onPost);
  const remove = () => {
    if (gone) return;
    gone = true;
    scene.events.off('postupdate', onPost);
    g.destroy(); glow.destroy();
    try { light?.remove(); } catch { /* scene gone */ }
  };
  scene.events.once('shutdown', remove);
  return {
    setOpen(f) { target = Math.max(0, Math.min(1, f)); },
    close(ms = 700) { target = 0; return w.wait(ms).then(remove); },
    remove,
  };
}

export interface CalmRing {
  /** Shows the ring round Lia's feet filled to `f` (0 … 1); 0 hides it. */
  set(f: number): void;
}

/** The calm ring: a soft white arc round the player's feet while she holds still at a rift. */
export function calmRing(w: WorldCtx): CalmRing {
  const scene = w.scene;
  const g = world(w, scene.add.graphics().setDepth(2300));
  let fill = 0;
  const onPost = () => {
    g.clear();
    if (fill <= 0.01) return;
    const x = w.player.x, y = w.player.y;
    g.lineStyle(1, CALM, 0.35);
    g.strokeEllipse(x, y, 30, 14);
    g.lineStyle(2, CALM, 0.9);
    g.beginPath();
    // Elliptic arc from the top, clockwise, as a polyline (Graphics.arc is circular).
    const steps = Math.max(2, Math.round(40 * fill));
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (i / 40) * Math.PI * 2;
      const px = x + Math.cos(a) * 15, py = y + Math.sin(a) * 7;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.strokePath();
  };
  scene.events.on('postupdate', onPost);
  scene.events.once('shutdown', () => { scene.events.off('postupdate', onPost); g.destroy(); });
  return { set(f) { fill = Math.max(0, Math.min(1, f)); } };
}

/** The meadow tears: cracks everywhere around `at`, a violet pulse, then white. Resolves after the flash. */
export async function tearMeadow(w: WorldCtx, at: readonly [number, number]): Promise<void> {
  const offsets: [number, number][] = [[0, 0], [-60, -20], [70, -10], [-110, 30], [120, 30], [-30, 50], [40, -50], [-150, -30], [160, -20]];
  const rifts = offsets.map(([dx, dy], i) => drawRift(w, [at[0] + dx, at[1] + dy], 40 + i, 26 + (i % 3) * 8));
  for (let i = 0; i < 4; i++) {
    w.camera.shake(260, 0.004 + i * 0.002);
    w.lighting.flash(VIOLET, 260);
    await w.wait(420);
  }
  w.lighting.flash(0xffffff, 900);
  await w.wait(500);
  for (const r of rifts) r.remove();
}

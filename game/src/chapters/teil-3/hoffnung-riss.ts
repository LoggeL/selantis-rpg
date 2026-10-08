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
const DEEP = 0x26123f;
const RIM = 0xd9c6ff;

const world = <T extends Phaser.GameObjects.GameObject>(w: WorldCtx, o: T): T => {
  const s = w.scene as WorldSceneLike;
  return s.addWorld ? s.addWorld(o) : o;
};

/** Deterministic jagged crack (a few branches) around a point; `seed` varies the shape. */
function crackPoints(seed: number, len: number): { x: number; y: number }[][] {
  let r = seed * 9301 + 49297;
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const branches: { x: number; y: number }[][] = [];
  for (let b = 0; b < 3; b++) {
    const a0 = (b / 3) * Math.PI * 2 + rnd() * 0.8;
    const pts = [{ x: 0, y: 0 }];
    let x = 0, y = 0, a = a0;
    const n = 4 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      a += (rnd() - 0.5) * 1.1;
      const step = (len / n) * (0.7 + rnd() * 0.6);
      x += Math.cos(a) * step;
      y += Math.sin(a) * step * 0.55; // flattened: the crack lies on the ground (3/4 view)
      pts.push({ x, y });
    }
    branches.push(pts);
  }
  return branches;
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
    const flicker = 0.8 + 0.2 * Math.sin(t * 9 + seed);
    // A soft violet seam, a dark gap in the middle, a pale rim of light along it (readable on bright grass).
    for (const [width, color, alpha] of [[7, VIOLET, 0.45], [3, DEEP, 0.95], [1, RIM, 0.9]] as const) {
      g.lineStyle(width * Math.max(0.4, open), color, alpha * open * flicker);
      for (const pts of branches) {
        g.beginPath();
        g.moveTo(at[0] + pts[0].x * open, at[1] + pts[0].y * open);
        for (const p of pts.slice(1)) g.lineTo(at[0] + p.x * open, at[1] + p.y * open);
        g.strokePath();
      }
    }
    glow.setScale(0.4 + 0.5 * open).setAlpha(0.7 * open * flicker);
    light?.set({ intensity: 0.9 * open });
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

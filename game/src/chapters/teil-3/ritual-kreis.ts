// The ritual circle on the hilltop, drawn in code over the painted stands (no new art): ten small veiled things on the
// stands, the veils coming off (ten different, nameless shapes: horn, bowl, ring, stones …), thin turquoise threads
// from every stand to Lia on the stone and the turquoise sphere growing above her, with Vamir's cold violet beside
// it. Turquoise here is the Urmacht being drawn out of Lia; violet is Vamir's (umsetzung.md §1 Farben).
// Everything is removed when the world scene shuts down.
import type Phaser from 'phaser';
import type { LightHandle, WorldCtx } from '../../world';
import { SPHERE, STANDS, STONE_LIE } from './ritual-huegel';
import { TURQUOISE, VIOLET } from './shared';

type WorldSceneLike = Phaser.Scene & { addWorld?<T extends Phaser.GameObjects.GameObject>(o: T): T };

const LINEN = 0xc9bea6;
const LINEN_DARK = 0x6a604e;
const BRONZE = 0x9a7a44;
const BRONZE_DARK = 0x3e2f1a;
const ADD = 1; // Phaser.BlendModes.ADD

export interface RitualCircle {
  /** The cloths come off, one stand after the other. */
  unveil(ms?: number): Promise<void>;
  /** Threads from the stands to Lia and the sphere above her (0 = nothing, 1 = full). */
  setCharge(f: number, ms?: number): void;
  /** Vamir's violet glow beside the sphere. */
  violet(on: boolean): void;
  /** Everything goes dark at once (the ritual is broken). */
  breakOff(): void;
}

/** Draws one nameless relic on top of stand `i` (ten different silhouettes; none is named anywhere). */
function drawRelic(g: Phaser.GameObjects.Graphics, i: number, x: number, top: number): void {
  g.fillStyle(BRONZE, 1);
  g.lineStyle(1, BRONZE_DARK, 1);
  const y = top - 1;
  switch (i % 10) {
    case 0: // horn
      g.fillTriangle(x - 7, y, x + 6, y - 3, x + 7, y - 9); g.strokeTriangle(x - 7, y, x + 6, y - 3, x + 7, y - 9); break;
    case 1: // bowl
      g.fillEllipse(x, y - 3, 13, 6); g.strokeEllipse(x, y - 3, 13, 6); break;
    case 2: // ring
      g.lineStyle(2, BRONZE, 1); g.strokeCircle(x, y - 5, 4); break;
    case 3: // short staff
      g.fillRect(x - 1, y - 12, 2, 12); g.strokeRect(x - 1, y - 12, 2, 12); break;
    case 4: // stone
      g.fillStyle(0x7d7a74, 1); g.fillEllipse(x, y - 3, 9, 7); g.strokeEllipse(x, y - 3, 9, 7); break;
    case 5: // small box
      g.fillRect(x - 5, y - 6, 10, 6); g.strokeRect(x - 5, y - 6, 10, 6); break;
    case 6: // cup
      g.fillRect(x - 3, y - 8, 6, 5); g.fillRect(x - 1, y - 3, 2, 3); g.strokeRect(x - 3, y - 8, 6, 5); break;
    case 7: // figurine
      g.fillCircle(x, y - 9, 2); g.fillRect(x - 2, y - 7, 4, 7); g.strokeRect(x - 2, y - 7, 4, 7); break;
    case 8: // antler-like branch
      g.lineStyle(2, BRONZE, 1); g.lineBetween(x, y, x, y - 9); g.lineBetween(x, y - 5, x - 5, y - 10); g.lineBetween(x, y - 6, x + 5, y - 11); break;
    default: // flat stone tablet
      g.fillStyle(0x8a857c, 1); g.fillRect(x - 4, y - 10, 8, 10); g.strokeRect(x - 4, y - 10, 8, 10); break;
  }
}

function drawVeil(g: Phaser.GameObjects.Graphics, x: number, top: number): void {
  g.fillStyle(LINEN, 1);
  g.lineStyle(1, LINEN_DARK, 1);
  const pts = [
    { x: x - 8, y: top + 1 }, { x: x + 8, y: top + 1 }, { x: x + 6, y: top - 6 }, { x: x + 1, y: top - 12 }, { x: x - 5, y: top - 7 },
  ];
  g.fillPoints(pts, true);
  g.strokePoints(pts, true);
  g.lineBetween(x - 2, top - 8, x - 4, top);
}

/**
 * Builds the circle for the current map visit. `veiled` starts with the cloths on (before the ritual); without it the
 * relics stand uncovered (later visits).
 */
export function ritualCircle(w: WorldCtx, opts: { veiled: boolean }): RitualCircle {
  const scene = w.scene as WorldSceneLike;
  const world = <T extends Phaser.GameObjects.GameObject>(o: T): T => (scene.addWorld ? scene.addWorld(o) : o);

  // One small graphics object per stand, at the depth of the stand's foot: whoever stands in front of the stand covers
  // it, whoever stands behind is covered by the stand's occluder anyway.
  const relics = STANDS.map((s, i) => {
    const g = world(scene.add.graphics().setDepth(s.base + 0.2));
    if (opts.veiled) drawVeil(g, s.x, s.top); else drawRelic(g, i, s.x, s.top);
    return g;
  });

  // Threads and sphere: above the figures, additive, invisible at first.
  const threads = world(scene.add.graphics().setDepth(2400).setBlendMode(ADD));
  const sphere = world(scene.add.image(SPHERE[0], SPHERE[1], 'w-glow').setBlendMode(ADD).setTint(TURQUOISE).setDepth(2401).setScale(0.1).setAlpha(0));
  const core = world(scene.add.image(SPHERE[0], SPHERE[1], 'w-glow').setBlendMode(ADD).setTint(0xffffff).setDepth(2402).setScale(0.05).setAlpha(0));
  const violetGlow = world(scene.add.image(SPHERE[0] + 26, SPHERE[1] + 4, 'w-glow').setBlendMode(ADD).setTint(VIOLET).setDepth(2399).setScale(0.6).setAlpha(0));
  let light: LightHandle | null = null;
  let violetLight: LightHandle | null = null;
  try {
    light = w.lighting.add({ id: 'e3-ri-kugel', at: [SPHERE[0], SPHERE[1]], kind: 'urmacht', radius: 60, intensity: 0, always: true });
    violetLight = w.lighting.add({ id: 'e3-ri-violett', at: [SPHERE[0] + 26, SPHERE[1] + 6], kind: 'plain', color: VIOLET, radius: 50, intensity: 0, always: true });
  } catch { light = null; }

  let charge = 0, target = 0, rate = 1, t = 0, broken = false, violetOn = false;
  const onPost = (_time: number, delta: number) => {
    const dt = Math.min(0.1, delta / 1000);
    t += dt;
    charge += Math.sign(target - charge) * Math.min(Math.abs(target - charge), dt * rate);
    threads.clear();
    if (charge > 0.01 && !broken) {
      const pulse = 0.65 + 0.35 * Math.sin(t * 5);
      for (const [i, s] of STANDS.entries()) {
        const a = Math.min(1, charge * 1.6) * (0.25 + 0.2 * Math.sin(t * 3 + i));
        threads.lineStyle(1, TURQUOISE, a * pulse);
        // A slightly sagging thread from the relic to Lia's chest (a quadratic curve as a short polyline).
        const x0 = s.x, y0 = s.top - 4, x1 = STONE_LIE[0], y1 = STONE_LIE[1] - 12;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + 10 + 4 * Math.sin(t * 2 + i);
        threads.beginPath();
        threads.moveTo(x0, y0);
        for (let k = 1; k <= 8; k++) {
          const u = k / 8;
          threads.lineTo((1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1);
        }
        threads.strokePath();
      }
    }
    const s = broken ? 0 : charge;
    sphere.setScale(0.15 + s * 0.75 + 0.04 * Math.sin(t * 4)).setAlpha(s * 0.9);
    core.setScale(0.08 + s * 0.3).setAlpha(s * 0.8);
    violetGlow.setAlpha((violetOn && !broken ? 0.45 + 0.15 * Math.sin(t * 3.3) : 0) * Math.max(0.3, s));
    light?.set({ intensity: s * 1.2, radius: 50 + s * 70 });
    violetLight?.set({ intensity: violetOn && !broken ? 0.7 : 0 });
  };
  scene.events.on('postupdate', onPost);

  const dispose = () => {
    scene.events.off('postupdate', onPost);
    for (const g of relics) g.destroy();
    threads.destroy(); sphere.destroy(); core.destroy(); violetGlow.destroy();
    try { light?.remove(); violetLight?.remove(); } catch { /* scene gone */ }
  };
  scene.events.once('shutdown', dispose);

  return {
    async unveil(ms = 2400) {
      const step = ms / STANDS.length;
      for (const [i, s] of STANDS.entries()) {
        const g = relics[i];
        g.clear();
        drawRelic(g, i, s.x, s.top);
        // The cloth slides down as a small pale patch at the foot of the stand.
        const cloth = world(scene.add.graphics().setDepth(s.base + 0.1));
        cloth.fillStyle(LINEN, 0.9);
        cloth.fillEllipse(s.x + 6, s.base - 1, 12, 4);
        await w.wait(step);
      }
    },
    setCharge(f, ms = 1500) {
      target = Math.max(0, Math.min(1, f));
      rate = Math.max(0.05, Math.abs(target - charge) / Math.max(0.05, ms / 1000));
    },
    violet(on) { violetOn = on; },
    breakOff() { broken = true; },
  };
}

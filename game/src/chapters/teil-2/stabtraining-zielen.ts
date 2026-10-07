// Aiming bar of e2-stabtraining: a small Chronik panel at the bottom of the screen while Lia aims Schattentöter at the
// practice ground. Arrow keys / WASD (or the on-screen arrows) move a soft golden marker from painted object to
// painted object (spatially, see nextInDirection); E / Enter / Space or „Stabimpuls“ fires, Esc / „Absetzen“ lowers
// the staff. The marker is a world light, so the player judges the painted object itself, not a label.
import type Phaser from 'phaser';
import { G } from '../../core/G';
import { ctx, isConfirm } from '../../ui/context';
import type { WorldCtx } from '../../world';
import { sfx, ui } from './shared';
import { AIM_START, nextInDirection, PRACTICE_OBJECTS } from './stabtraining-ziele';

let styled = false;
function ensureStyles(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const style = document.createElement('style');
  style.id = 'e2-zielen-styles';
  style.textContent = `
.e2-zielen { pointer-events: none; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 3%; }
.e2-zielen-bar { pointer-events: auto; display: flex; align-items: center; gap: 0.7em; padding: 0.55em 0.9em; max-width: 92%; flex-wrap: wrap; justify-content: center; }
.e2-zielen-call { font-family: var(--f-body); color: var(--parch, #efe3c8); font-size: 0.95em; max-width: 22em; line-height: 1.3; }
.e2-zielen-call em { color: var(--gold-hi, #f0d58a); font-style: italic; }
.e2-zielen-pad { display: grid; grid-template-columns: repeat(3, 2.1em); grid-template-rows: repeat(2, 2.1em); gap: 0.2em; }
.e2-zielen-pad .ch-btn { padding: 0; width: 2.1em; height: 2.1em; display: grid; place-items: center; }
.e2-zielen-pad .up { grid-column: 2; grid-row: 1; } .e2-zielen-pad .left { grid-column: 1; grid-row: 2; }
.e2-zielen-pad .down { grid-column: 2; grid-row: 2; } .e2-zielen-pad .right { grid-column: 3; grid-row: 2; }
.e2-zielen-keys { font-family: var(--f-label); color: var(--parch-dim, #c9bc9f); font-size: 0.72em; letter-spacing: 0.04em; }
`;
  document.head.appendChild(style);
}

/** A pulsing golden ring drawn over the aimed object (world space, above the scenery). */
function aimRing(w: WorldCtx): Phaser.GameObjects.Graphics {
  const scene = w.scene as Phaser.Scene & { addWorld?<T extends Phaser.GameObjects.GameObject>(o: T): T };
  const g = scene.add.graphics();
  scene.addWorld?.(g);
  g.setDepth(4500);
  g.lineStyle(2, 0xf0d58a, 0.95);
  g.strokeEllipse(0, 0, 30, 20);
  g.lineStyle(1, 0xfff6d8, 0.6);
  g.strokeEllipse(0, 0, 38, 26);
  scene.tweens.add({ targets: g, alpha: { from: 1, to: 0.45 }, duration: 520, yoyo: true, repeat: -1 });
  return g;
}

/**
 * Lets the player pick one painted object of the practice ground. Resolves with its id, or null when the player
 * lowered the staff. `call` is shown in the bar (Ignatius' last call), `from` is where the marker starts.
 */
export function aimStaff(w: WorldCtx, call: string, from = AIM_START): Promise<string | null> {
  ensureStyles();
  if (ctx.stale()) return new Promise(() => {});
  let current = PRACTICE_OBJECTS.some(o => o.id === from) ? from : AIM_START;
  const at = () => PRACTICE_OBJECTS.find(o => o.id === current)!.at;
  const marker = w.lighting.add({ id: 'e2-zielmarke', at: at(), kind: 'plain', color: 0xfff0b0, radius: 20, intensity: 1.1, always: true });
  const ring = aimRing(w);
  const placeRing = () => { const [x, y] = at(); ring.setPosition(x, y); };
  placeRing();
  w.player.face(at());
  w.fx.burst(at(), 'sparkle', 4);

  const root = ui().panel('e2-zielen');
  const touch = ctx.root.classList.contains('is-touch');
  root.innerHTML = `<div class="e2-zielen-bar ch-panel">
    <div class="e2-zielen-call">${call}</div>
    <div class="e2-zielen-pad">
      <button class="ch-btn up" aria-label="Ziel weiter hinten">▲</button><button class="ch-btn left" aria-label="Ziel links">◀</button>
      <button class="ch-btn down" aria-label="Ziel weiter vorn">▼</button><button class="ch-btn right" aria-label="Ziel rechts">▶</button>
    </div>
    <button class="ch-btn fire">Stabimpuls</button>
    <button class="ch-btn back">Absetzen</button>
    ${touch ? '' : '<div class="e2-zielen-keys">Pfeile / WASD zielen · E feuern · Esc absetzen</div>'}
  </div>`;

  return new Promise<string | null>(resolve => {
    let done = false;
    const move = (dx: number, dy: number) => {
      const next = nextInDirection(current, dx, dy);
      if (next === current) { sfx('ui-cancel', { volume: 0.4 }); return; }
      current = next;
      marker.set({ at: at() });
      placeRing();
      w.player.face(at());
      w.fx.burst(at(), 'sparkle', 3);
      sfx('ui-move', { volume: 0.5 });
    };
    let unsub = () => {};
    const finish = (result: string | null) => {
      if (done) return;
      done = true;
      unsub();
      close();
      marker.remove();
      ring.destroy();
      root.remove();
      sfx(result ? 'ui-confirm' : 'ui-close', { volume: 0.5 });
      resolve(result);
    };
    const close = ctx.open({
      id: 'e2-zielen', allowMenu: false,
      onKey: e => {
        if (e.repeat) return true;
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') move(-1, 0);
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') move(1, 0);
        else if (k === 'ArrowUp' || k === 'w' || k === 'W') move(0, -1);
        else if (k === 'ArrowDown' || k === 's' || k === 'S') move(0, 1);
        else if (isConfirm(e)) finish(current);
        else if (k === 'Escape' || k === 'Backspace') finish(null);
        else return false;
        return true;
      },
    });
    const on = (sel: string, fn: () => void) => root.querySelector(sel)?.addEventListener('click', e => { e.preventDefault(); fn(); });
    on('.up', () => move(0, -1));
    on('.down', () => move(0, 1));
    on('.left', () => move(-1, 0));
    on('.right', () => move(1, 0));
    on('.fire', () => finish(current));
    on('.back', () => finish(null));
    // A scene change removes the panel; the modal must not outlive it.
    unsub = G.events.on('scene:goto', () => { if (!done) { done = true; unsub(); close(); } });
  });
}

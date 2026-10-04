import type { SfxLoop } from '../audio/api';
import { G } from '../core/G';
import { ctx, isConfirm } from './context';
import { el, icon, sfx } from './dom';

const R = 42;
const CIRC = 2 * Math.PI * R;

/**
 * Hold-to-act prompt with progress ring. Struggle mode („Halte still“) shows a trembling bar instead of
 * the ring's progress, plays a heartbeat that speeds up with progress, drains quickly on release
 * (calls onRelease, vibrates on touch).
 */
export function hold(label: string, durationMs: number, opts: { struggle?: boolean; onRelease?: () => void } = {}): Promise<void> {
  const struggle = Boolean(opts.struggle);
  const root = el('div', struggle ? 'hold is-struggle' : 'hold');
  const catcher = el('div', 'ui-catcher hold-catcher');
  const ring = el('div', 'hold-ring');
  ring.innerHTML = `<svg viewBox="0 0 100 100"><circle class="hold-track" cx="50" cy="50" r="${R}"/><circle class="hold-fill" cx="50" cy="50" r="${R}" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/></svg>`;
  const cap = el('div', 'hold-key ch-key');
  if (ctx.root.classList.contains('is-touch')) cap.appendChild(icon('hand')); else cap.textContent = 'E';
  ring.appendChild(cap);
  const text = el('div', 'hold-text');
  text.append(el('div', 'hold-label', label), el('div', 'hold-sub', ctx.root.classList.contains('is-touch') ? 'Gedrückt halten' : 'E · Leertaste · Maus gedrückt halten'));
  const bar = el('div', 'hold-bar');
  const barFill = el('div', 'hold-bar-fill');
  bar.appendChild(barFill);
  root.append(ring, text, bar);
  ctx.layers.dialog.append(catcher, root);
  requestAnimationFrame(() => root.classList.add('is-in'));
  const fill = ring.querySelector('.hold-fill') as SVGCircleElement;

  return new Promise<void>(resolve => {
    const sources = new Set<string>();
    let progress = 0;
    let last = performance.now();
    let raf = 0;
    let done = false;
    let wasHolding = false;
    const openedAt = performance.now();
    let heart: SfxLoop | null = null;
    if (struggle) { try { heart = G.audio?.loop('heartbeat', { interval: 0.95, volume: 0.9 }) ?? null; } catch { heart = null; } }
    let lastInterval = 0.95;
    const stopHeart = () => { try { heart?.stop(300); } catch { /* audio optional */ } heart = null; };

    const press = (src: string) => {
      if (done || performance.now() - openedAt < 120) return;
      if (!sources.size) sfx('ui-move', { volume: 0.4, pitch: 0.8 });
      sources.add(src);
    };
    const release = (src: string) => { sources.delete(src); };

    const closeModal = ctx.open({
      id: 'hold',
      allowMenu: false,
      onKey: e => {
        if (!isConfirm(e)) return false;
        if (!e.repeat) press(e.code || e.key);
        return true;
      },
      onKeyUp: e => {
        if (!isConfirm(e)) return false;
        release(e.code || e.key);
        return true;
      },
    });
    const onDown = (e: PointerEvent) => { e.preventDefault(); catcher.setPointerCapture?.(e.pointerId); press(`p${e.pointerId}`); };
    const onUp = (e: PointerEvent) => release(`p${e.pointerId}`);
    catcher.addEventListener('pointerdown', onDown);
    catcher.addEventListener('pointerup', onUp);
    catcher.addEventListener('pointercancel', onUp);
    catcher.addEventListener('lostpointercapture', onUp);

    const tick = (now: number) => {
      if (!root.isConnected) { stopHeart(); closeModal(); return; } // UI was reset (scene change)
      const dt = Math.min(64, now - last);
      last = now;
      const holding = sources.size > 0;
      if (holding) progress += dt / durationMs;
      else progress -= dt / (struggle ? durationMs * 0.3 : durationMs * 1.6);
      progress = Math.max(0, Math.min(1, progress));
      if (wasHolding && !holding && struggle) {
        try { navigator.vibrate?.(40); } catch { /* not supported */ }
        try { opts.onRelease?.(); } catch (err) { console.error(err); }
      }
      if (heart) {
        // 0.95 s → 0.42 s between beats as the danger peaks; letting go makes it race.
        const target = holding ? 0.95 - progress * 0.5 : 0.42;
        if (Math.abs(target - lastInterval) > 0.04) { lastInterval = target; try { heart.set({ interval: target }); } catch { /* audio optional */ } }
      }
      wasHolding = holding;
      fill.style.strokeDashoffset = String(CIRC * (1 - progress));
      barFill.style.transform = `scaleX(${progress})`;
      root.classList.toggle('is-holding', holding);
      root.style.setProperty('--p', progress.toFixed(3));
      if (progress >= 1) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const finish = () => {
      done = true;
      stopHeart();
      cancelAnimationFrame(raf);
      sfx('ui-confirm', { volume: 0.8 });
      root.classList.add('is-complete');
      closeModal();
      catcher.remove();
      setTimeout(() => {
        root.classList.add('is-out');
        setTimeout(() => root.remove(), 360);
        resolve();
      }, ctx.reducedMotion ? 80 : 380);
    };
  });
}

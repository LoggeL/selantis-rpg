// Kapitel V: timing prompt „Ausweichen!“ (the ghoul attack in the rain forest).
// A ring closes in on the target circle; press E / Space / Enter or tap while it is inside the gold zone.
// A miss costs nothing but a bruise: the swing simply repeats (no game over).
import { G } from '../../core/G';
import { ctx, isConfirm } from '../../ui/context';
import { ensureStyles } from './styles';

export interface DodgeOptions {
  /** Successful dodges needed. */
  need: number;
  /** Called when a swing starts (telegraph: the attacker winds up). */
  onWindup?(i: number): void;
  /** Called with the result of a swing (animate dodge / hit). Awaited before the next swing. */
  onResult?(ok: boolean, i: number): Promise<void> | void;
  /** Ring closing time in ms (default 1100; the window is the last ~30 % plus a little grace). */
  closeMs?: number;
}

/** Pure timing check (unit-tested): progress p = elapsed / closeMs. */
export function dodgeWindow(p: number): 'early' | 'good' | 'late' {
  if (p < 0.72) return 'early';
  if (p <= 1.14) return 'good';
  return 'late';
}

export function dodgeQte(opts: DodgeOptions): Promise<void> {
  ensureStyles();
  if (ctx.stale()) return new Promise(() => {});
  const root = G.ui.panel('k5-qte');
  root.innerHTML = `
    <div class="k5-qte-box">
      <div class="k5-qte-ring"><div class="k5-qte-target"></div><div class="k5-qte-closing"></div>
        <div class="k5-qte-key ch-key">${ctx.root.classList.contains('is-touch') ? 'Tipp' : 'E'}</div></div>
      <div class="k5-qte-label ch-title">Ausweichen!</div>
      <div class="k5-qte-sub ch-label">${ctx.root.classList.contains('is-touch') ? 'Tippe, wenn der Ring golden leuchtet' : 'E · Leertaste · Klick, wenn der Ring golden leuchtet'}</div>
      <div class="k5-qte-pips"></div>
    </div>`;
  const closing = root.querySelector('.k5-qte-closing') as HTMLElement;
  const label = root.querySelector('.k5-qte-label') as HTMLElement;
  const pips = root.querySelector('.k5-qte-pips') as HTMLElement;
  pips.innerHTML = Array.from({ length: opts.need }, () => '<span></span>').join('');
  const closeMs = opts.closeMs ?? 1100;

  return new Promise<void>(resolve => {
    let ok = 0;
    let swing = 0;
    let start = 0;
    let state: 'pause' | 'run' = 'pause';
    let raf = 0;
    let pressed = false;
    const closeModal = ctx.open({
      id: 'k5-qte', allowMenu: false,
      onKey: e => { if (!isConfirm(e)) return false; if (!e.repeat) press(); return true; },
      onKeyUp: e => isConfirm(e),
    });
    const onDown = (e: PointerEvent) => { e.preventDefault(); press(); };
    root.addEventListener('pointerdown', onDown);

    const finishSwing = async (good: boolean) => {
      state = 'pause';
      cancelAnimationFrame(raf);
      root.dataset.state = good ? 'hit' : 'miss';
      root.classList.toggle('is-good', good);
      root.classList.toggle('is-bad', !good);
      label.textContent = good ? 'Ausgewichen!' : 'Getroffen!';
      if (good) { ok++; pips.children[ok - 1]?.classList.add('on'); }
      try { await opts.onResult?.(good, swing); } catch (err) { console.error(err); }
      if (!root.isConnected) { closeModal(); return; }
      if (ok >= opts.need) {
        root.dataset.state = 'done';
        closeModal();
        root.classList.add('is-out');
        setTimeout(() => root.remove(), 300);
        resolve();
        return;
      }
      setTimeout(next, 420);
    };
    const press = () => {
      if (state !== 'run' || pressed) return;
      pressed = true;
      const verdict = dodgeWindow((performance.now() - start) / closeMs);
      void finishSwing(verdict === 'good');
    };
    const tick = (now: number) => {
      if (!root.isConnected) { closeModal(); return; }
      if (state !== 'run') return;
      const p = (now - start) / closeMs;
      const scale = Math.max(1, 3.2 - 2.2 * Math.min(1, p));
      closing.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      const zone = dodgeWindow(p);
      root.classList.toggle('is-window', zone === 'good');
      root.dataset.state = zone === 'good' ? 'window' : 'wait';
      if (zone === 'late') { pressed = true; void finishSwing(false); return; }
      raf = requestAnimationFrame(tick);
    };
    const next = () => {
      if (!root.isConnected) { closeModal(); return; }
      swing++;
      pressed = false;
      root.classList.remove('is-good', 'is-bad', 'is-window');
      label.textContent = 'Ausweichen!';
      opts.onWindup?.(swing);
      start = performance.now() + 120;
      state = 'run';
      root.dataset.state = 'wait';
      raf = requestAnimationFrame(tick);
    };
    requestAnimationFrame(() => { root.classList.add('is-in'); setTimeout(next, 450); });
  });
}

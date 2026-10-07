// „e2-flick-entkommt“: the short reaction moment in the corridor (quellenpruefung.md §6: a scuffle, no magic).
// A ring closes in on the target circle; press E / Space / Enter or tap while it glows gold. Each beat is one
// movement of the scuffle; a miss only repeats that beat (no failure state, no game over). Reuses the Chronik look
// of chapter V's dodge prompt (kapitel-5/styles.ts) with its own labels.
import { G } from '../../core/G';
import { ctx, isConfirm } from '../../ui/context';
import { ensureStyles } from '../kapitel-5/styles';

export type MomentVerdict = 'early' | 'good' | 'late';

/** Pure timing check (flick-entkommt.test.ts): p = elapsed / closeMs of the closing ring. */
export function momentVerdict(p: number): MomentVerdict {
  if (p < 0.7) return 'early';
  if (p <= 1.15) return 'good';
  return 'late';
}

/** Feedback line for a beat's result. */
export function momentFeedback(verdict: MomentVerdict): string {
  return verdict === 'good' ? 'Getroffen!' : verdict === 'early' ? 'Zu früh!' : 'Zu spät!';
}

export interface MomentBeat {
  /** Big label while the ring closes, e.g. „Losreißen!“. */
  label: string;
}

export interface MomentOptions {
  beats: MomentBeat[];
  /** A beat starts (telegraph: the warden turns, reaches, lifts the club). */
  onWindup?(beat: number): void;
  /** Result of a try; awaited before the next try. A miss repeats the same beat. */
  onResult?(ok: boolean, beat: number, verdict: MomentVerdict): Promise<void> | void;
  /** Ring closing time in ms (default 1150). */
  closeMs?: number;
}

export function strikeMoment(opts: MomentOptions): Promise<void> {
  ensureStyles();
  if (ctx.stale()) return new Promise(() => {});
  const touch = ctx.root.classList.contains('is-touch');
  const root = G.ui.panel('k5-qte e2-moment');
  root.innerHTML = `
    <div class="k5-qte-box">
      <div class="k5-qte-ring"><div class="k5-qte-target"></div><div class="k5-qte-closing"></div>
        <div class="k5-qte-key ch-key">${touch ? 'Tipp' : 'E'}</div></div>
      <div class="k5-qte-label ch-title"></div>
      <div class="k5-qte-sub ch-label">${touch ? 'Tippe, wenn der Ring golden leuchtet' : 'E · Leertaste · Klick, wenn der Ring golden leuchtet'}</div>
      <div class="k5-qte-pips"></div>
    </div>`;
  const closing = root.querySelector('.k5-qte-closing') as HTMLElement;
  const label = root.querySelector('.k5-qte-label') as HTMLElement;
  const pips = root.querySelector('.k5-qte-pips') as HTMLElement;
  pips.innerHTML = opts.beats.map(() => '<span></span>').join('');
  const closeMs = opts.closeMs ?? 1150;

  return new Promise<void>(resolve => {
    let beat = 0;
    let start = 0;
    let state: 'pause' | 'run' = 'pause';
    let raf = 0;
    let pressed = false;
    const closeModal = ctx.open({
      id: 'e2-moment', allowMenu: false,
      onKey: e => { if (!isConfirm(e)) return false; if (!e.repeat) press(); return true; },
      onKeyUp: e => isConfirm(e),
    });
    const onDown = (e: PointerEvent) => { e.preventDefault(); press(); };
    root.addEventListener('pointerdown', onDown);

    const finish = async (verdict: MomentVerdict) => {
      state = 'pause';
      cancelAnimationFrame(raf);
      const good = verdict === 'good';
      root.dataset.state = good ? 'hit' : 'miss';
      root.classList.toggle('is-good', good);
      root.classList.toggle('is-bad', !good);
      root.classList.remove('is-window');
      label.textContent = momentFeedback(verdict);
      try { await opts.onResult?.(good, beat, verdict); } catch (err) { console.error(err); }
      if (!root.isConnected) { closeModal(); return; }
      if (good) { pips.children[beat]?.classList.add('on'); beat++; }
      if (beat >= opts.beats.length) {
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
      void finish(momentVerdict((performance.now() - start) / closeMs));
    };
    const tick = (now: number) => {
      if (!root.isConnected) { closeModal(); return; }
      if (state !== 'run') return;
      const p = (now - start) / closeMs;
      const scale = Math.max(1, 3.2 - 2.2 * Math.min(1, p));
      closing.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      const zone = momentVerdict(p);
      root.classList.toggle('is-window', zone === 'good');
      root.dataset.state = zone === 'good' ? 'window' : 'wait';
      if (zone === 'late') { pressed = true; void finish('late'); return; }
      raf = requestAnimationFrame(tick);
    };
    const next = () => {
      if (!root.isConnected) { closeModal(); return; }
      pressed = false;
      root.classList.remove('is-good', 'is-bad', 'is-window');
      label.textContent = opts.beats[beat].label;
      opts.onWindup?.(beat);
      start = performance.now() + 120;
      state = 'run';
      root.dataset.state = 'wait';
      raf = requestAnimationFrame(tick);
    };
    requestAnimationFrame(() => { root.classList.add('is-in'); setTimeout(next, 450); });
  });
}

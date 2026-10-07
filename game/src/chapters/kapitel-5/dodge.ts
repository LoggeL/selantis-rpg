// Kapitel V: timing prompt „Ausweichen!“ (the ghoul attack in the rain forest), staged as a painted combat cut-in.
// A ring closes in on the target circle; press E / Space / Enter or tap while it is inside the gold zone.
// A miss costs nothing but a bruise: the swing simply repeats (no game over).
// The scene is painted (assets/minigames/k5-dodge-*, Codex, prompts in docs/rebuild/art/minigames.json, built by
// output/k5-dodge-build.py): forest backdrop, the Leichenfresser (wind-up / strike) and Lia (ready / dodge / hurt).
// The code only adds rain, mist, lightning, the axe glint, the slash streak, hit flashes and the controls.
import { G } from '../../core/G';
import { assetUrl, manifest } from '../../art/manifest';
import { ctx, isConfirm } from '../../ui/context';
import { ICONS } from '../../ui/dom';
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

/** URL of a painted cut-in image (manifest first, conventional path as fallback). */
const art = (key: string, ext = 'png') => assetUrl(manifest().images?.[`minigames/${key}`]?.file ?? `assets/minigames/${key}.${ext}`);
const reduced = () => ctx.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const sfx = (name: Parameters<typeof G.audio.sfx>[0], opts?: Parameters<typeof G.audio.sfx>[1]) => { try { G.audio.sfx(name, opts); } catch { /* audio optional */ } };
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Rain streaks over the cut-in (a light canvas effect; static drizzle with reduced motion). */
function startRain(canvas: HTMLCanvasElement, root: HTMLElement): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  let w = 0;
  let h = 0;
  type Drop = { x: number; y: number; l: number; v: number; a: number };
  let drops: Drop[] = [];
  const spawn = (d: Drop, top: boolean) => {
    d.x = Math.random() * (w + h * 0.3) - h * 0.15;
    d.y = top ? -Math.random() * h * 0.3 : Math.random() * h;
    d.l = 10 + Math.random() * 26;
    d.v = 0.9 + Math.random() * 0.8;
    d.a = 0.12 + Math.random() * 0.3;
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (Math.round(r.width) === w && Math.round(r.height) === h) return;
    w = canvas.width = Math.max(1, Math.round(r.width));
    h = canvas.height = Math.max(1, Math.round(r.height));
    const n = Math.min(260, Math.round((w * h) / 4200));
    drops = Array.from({ length: n }, () => { const d = { x: 0, y: 0, l: 0, v: 0, a: 0 }; spawn(d, false); return d; });
  };
  const draw = (dt: number) => {
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    for (const d of drops) {
      d.y += d.v * dt * 1.15;
      d.x -= d.v * dt * 0.2;
      if (d.y - d.l > h) spawn(d, true);
      g.strokeStyle = `rgba(196, 210, 236, ${d.a.toFixed(3)})`;
      g.lineWidth = d.l > 28 ? 1.6 : 1;
      g.beginPath();
      g.moveTo(d.x, d.y);
      g.lineTo(d.x + d.l * 0.17, d.y - d.l);
      g.stroke();
    }
  };
  resize();
  if (reduced()) { draw(0); return; }
  let last = performance.now();
  const loop = (now: number) => {
    if (!root.isConnected || root.dataset.state === 'done') return;
    resize();
    draw(Math.min(50, now - last));
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

export function dodgeQte(opts: DodgeOptions): Promise<void> {
  ensureStyles();
  if (ctx.stale()) return new Promise(() => {});
  const root = G.ui.panel('k5-qte');
  const touch = ctx.root?.classList.contains('is-touch') ?? false;
  const closeMs = opts.closeMs ?? 1100;
  root.style.setProperty('--k5-close', `${closeMs}ms`);
  root.classList.toggle('is-reduced', reduced());
  const keyHint = touch
    ? `<span class="k5-qte-hand ch-key">${ICONS.hand}</span><span>Tippe irgendwo, wenn der Ring golden leuchtet</span>`
    : '<span class="ch-key">E</span><span class="ch-key">Leertaste</span><span class="ch-key">Klick</span><span>wenn der Ring golden leuchtet</span>';
  root.innerHTML = `
    <div class="k5-qte-scene" aria-hidden="true">
      <div class="k5-qte-bg" style="background-image:url('${art('k5-dodge-bg', 'jpg')}')"></div>
      <div class="k5-qte-mist"></div>
      <div class="k5-qte-fig k5-qte-ghoul">
        <div class="k5-qte-shadow"></div>
        <img class="pose-windup" alt="" draggable="false" src="${art('k5-dodge-ghoul-windup')}">
        <img class="pose-strike" alt="" draggable="false" src="${art('k5-dodge-ghoul-strike')}">
        <div class="k5-qte-glint"></div>
      </div>
      <svg class="k5-qte-slash" viewBox="0 0 60 100" preserveAspectRatio="none">
        <defs><linearGradient id="k5-slash-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fffdf4" stop-opacity="0"/><stop offset="0.3" stop-color="#fffdf4" stop-opacity="0.75"/>
          <stop class="tint" offset="0.75" stop-opacity="0.55"/><stop class="tint" offset="1" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="M52 2 Q-2 38 26 98 Q12 40 52 2 Z" fill="url(#k5-slash-g)"/>
        <path d="M52 2 Q4 40 24 92" fill="none" stroke="#fffdf4" stroke-width="0.7" stroke-linecap="round" opacity="0.85"/>
      </svg>
      <div class="k5-qte-impact"></div>
      <div class="k5-qte-fig k5-qte-lia">
        <div class="k5-qte-shadow"></div>
        <img class="pose-ready" alt="" draggable="false" src="${art('k5-dodge-lia-ready')}">
        <img class="pose-dodge" alt="" draggable="false" src="${art('k5-dodge-lia-dodge')}">
        <img class="pose-hurt" alt="" draggable="false" src="${art('k5-dodge-lia-hurt')}">
      </div>
      <canvas class="k5-qte-rain"></canvas>
      <div class="k5-qte-vignette"></div>
      <div class="k5-qte-flash"></div>
    </div>
    <div class="k5-qte-box">
      <div class="k5-qte-head">
        <div class="k5-qte-label ch-title" role="status" aria-live="assertive">Ausweichen!</div>
        <div class="k5-qte-pips" aria-label="Ausgewichen: 0 von ${opts.need}"></div>
      </div>
      <div class="k5-qte-ring"><div class="k5-qte-target"></div><div class="k5-qte-closing"></div>
        <div class="k5-qte-key ch-key">${touch ? ICONS.hand : 'E'}</div></div>
      <div class="k5-qte-sub ch-label">${keyHint}</div>
    </div>`;
  const closing = root.querySelector('.k5-qte-closing') as HTMLElement;
  const label = root.querySelector('.k5-qte-label') as HTMLElement;
  const pips = root.querySelector('.k5-qte-pips') as HTMLElement;
  pips.innerHTML = Array.from({ length: opts.need }, () => '<span></span>').join('');
  const imgs = Array.from(root.querySelectorAll('img'));
  startRain(root.querySelector('.k5-qte-rain') as HTMLCanvasElement, root);

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
    /** Restarts a one-shot CSS animation class. */
    const pulse = (cls: string) => { root.classList.remove(cls); void root.offsetWidth; root.classList.add(cls); };

    const finishSwing = async (good: boolean) => {
      state = 'pause';
      cancelAnimationFrame(raf);
      root.dataset.state = good ? 'hit' : 'miss';
      root.classList.remove('is-run', 'is-window');
      root.classList.toggle('is-good', good);
      root.classList.toggle('is-bad', !good);
      pulse(good ? 'fx-dodge' : 'fx-hurt');
      label.textContent = good ? 'Ausgewichen!' : 'Getroffen!';
      if (good) {
        ok++;
        pips.children[ok - 1]?.classList.add('on');
        pips.setAttribute('aria-label', `Ausgewichen: ${ok} von ${opts.need}`);
      }
      try { await opts.onResult?.(good, swing); } catch (err) { console.error(err); }
      if (!root.isConnected) { closeModal(); return; }
      if (ok >= opts.need) {
        root.dataset.state = 'done';
        root.classList.add('is-won');
        label.textContent = 'Geschafft!';
        closeModal();
        await wait(reduced() ? 150 : 520);
        root.classList.add('is-out');
        setTimeout(() => root.remove(), 380);
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
      closing.style.opacity = Math.min(1, Math.max(0, p) * 3 + 0.25).toFixed(2);
      const zone = dodgeWindow(p);
      if (zone === 'good' && !root.classList.contains('is-window')) sfx('ui-move', { volume: 0.35 });
      root.classList.toggle('is-window', zone === 'good');
      root.dataset.state = zone === 'good' ? 'window' : 'wait';
      if (zone === 'late') { pressed = true; void finishSwing(false); return; }
      raf = requestAnimationFrame(tick);
    };
    const next = () => {
      if (!root.isConnected) { closeModal(); return; }
      swing++;
      pressed = false;
      root.classList.remove('is-good', 'is-bad', 'is-window', 'fx-dodge', 'fx-hurt');
      root.dataset.swing = String(swing);
      label.textContent = 'Ausweichen!';
      opts.onWindup?.(swing);
      pulse('is-run');
      closing.style.transform = 'translate(-50%, -50%) scale(3.2)';
      start = performance.now() + 120;
      state = 'run';
      root.dataset.state = 'wait';
      raf = requestAnimationFrame(tick);
    };
    // Give the painted figures a moment to decode, so the cut-in never opens on empty frames.
    const ready = Promise.race([Promise.all(imgs.map(i => i.decode().catch(() => {}))), wait(1500)]);
    void ready.then(() => {
      if (!root.isConnected) { closeModal(); return; }
      requestAnimationFrame(() => {
        root.classList.add('is-in');
        if (!reduced()) sfx('thunder', { volume: 0.35 });
        setTimeout(next, 450);
      });
    });
  });
}

// „Sammlung“: DOM panel of Lia's concentration exercise (e2-konzentration). Rules live in konzentration-logic.ts.
// Keyboard (arrows/WASD hold, E/Space/Enter let the breath go), mouse (drag the light, click = let go) and touch
// (drag or on-screen arrows, „Ausatmen“ button). Grabbing a drifting thought (clicking/tapping it) is the mistake the
// exercise teaches against. Pauses on focus loss; a scene change removes the panel and the promise never resolves.
// Respects „Reduzierte Bewegung“: slower thoughts, no pulsing, the breath shows as a filling arc instead of a swelling ring.
import { G } from '../../core/G';
import type { SfxName, SfxOptions } from '../../audio/api';
import { ctx, isConfirm } from '../../ui/context';
import {
  breathAt, sammlungConfig, sammlungConfirm, sammlungGrab, sammlungStart, sammlungStep, thoughtPos,
  type ConfirmResult, type SammlungStats,
} from './konzentration-logic';

export interface SammlungResult {
  stats: SammlungStats;
  /** Words of the thoughts Lia grabbed (in order). */
  heldWords: string[];
  seconds: number;
}

export interface SammlungOptions {
  /** Whispered advice after repeated slips (the mentor's voice in the panel). */
  advice?: string;
  onCalm?(calm: number): void;
}

const MODAL = 'e2-sammlung';
const AXES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
};

const STYLE = `
.e2s-veil { position: absolute; inset: 0; display: grid; place-items: center; padding: .8em; pointer-events: auto; touch-action: none;
  background: radial-gradient(110% 100% at 50% 50%, rgba(6,9,15,.35), rgba(6,9,15,.86)); animation: e2s-in .4s ease-out; }
@keyframes e2s-in { from { opacity: 0; } to { opacity: 1; } }
.e2s-box { width: min(25em, 100%); max-height: 100%; overflow: hidden; padding: .7em 1em .8em; text-align: center; display: flex; flex-direction: column; align-items: center; }
.e2s-box .ch-title { font-size: 1.25em; }
.e2s-sub { min-height: 1.4em; margin: .15em 0 .35em; font-family: var(--f-body); font-style: italic; color: var(--parch-dim, #cfc2a4); font-size: .92em; }
.e2s-sub.is-good { color: #9ee7d6; }
.e2s-sub.is-bad { color: #f0a08a; }
.e2s-stage { position: relative; width: min(15em, 52vh); aspect-ratio: 1; border-radius: 50%; touch-action: none; cursor: grab;
  background: radial-gradient(circle at 50% 50%, #142233 0%, #0b121c 62%, #070b12 100%); box-shadow: inset 0 0 2.2em #000c, 0 0 0 1px var(--gold-line, #d8b25a55); }
.e2s-stage:active { cursor: grabbing; }
.e2s-svg { display: block; width: 100%; height: 100%; overflow: visible; }
.e2s-outer { fill: none; stroke: #d8b25a40; stroke-width: .012; }
.e2s-calm { fill: #49e0c80d; stroke: #49e0c866; stroke-width: .012; stroke-dasharray: .05 .04; }
.e2s-breath { fill: none; stroke: #d8b25a; stroke-width: .03; opacity: .55; transition: opacity .2s, stroke .2s; }
.e2s-track { fill: none; stroke: #d8b25a2e; stroke-width: .05; }
.e2s-arc { fill: none; stroke: #d8b25a; stroke-width: .05; opacity: .7; }
.e2s-root.is-full .e2s-breath, .e2s-root.is-full .e2s-arc { stroke: #f6dc8e; opacity: 1; filter: drop-shadow(0 0 .04px #f6dc8e); }
.e2s-light { fill: url(#e2s-glow); }
.e2s-core { fill: #e9fffb; }
.e2s-root.is-calm-pos .e2s-core { fill: #ffffff; }
.e2s-thought { font-family: var(--f-body, serif); font-style: italic; font-size: .2px; fill: #efe3c8; text-anchor: middle; dominant-baseline: middle; cursor: pointer;
  paint-order: stroke; stroke: #070b12; stroke-width: .03px; transition: fill .2s; }
.e2s-thought.is-grip { fill: #f6c56b; font-size: .25px; }
.e2s-pips { display: flex; gap: .55em; justify-content: center; margin: .45em 0 .2em; }
.e2s-pips i { width: .75em; height: .75em; border-radius: 50%; border: 1px solid var(--gold, #d8b25a); background: #0a111b; }
.e2s-pips i.is-on { background: #49e0c8; border-color: #9ee7d6; box-shadow: 0 0 .5em #49e0c888; }
.e2s-controls { display: flex; align-items: center; justify-content: center; gap: .6em; margin-top: .35em; }
.e2s-pad { display: none; grid-template-columns: repeat(3, 2.3em); grid-template-rows: repeat(2, 2.1em); gap: .2em; }
.is-touch .e2s-pad { display: grid; }
.e2s-pad .ch-btn { padding: 0; min-width: 0; display: grid; place-items: center; font-size: 1.05em; touch-action: none; }
.e2s-pad [data-d="up"] { grid-column: 2; grid-row: 1; }
.e2s-pad [data-d="left"] { grid-column: 1; grid-row: 2; }
.e2s-pad [data-d="down"] { grid-column: 2; grid-row: 2; }
.e2s-pad [data-d="right"] { grid-column: 3; grid-row: 2; }
.e2s-go.ch-btn { padding: .35em 1.1em; }
.e2s-root.is-full .e2s-go { border-color: #f6dc8e; box-shadow: 0 0 .8em #f6dc8e66; }
.e2s-root.is-full:not(.reduced) .e2s-go { animation: e2s-pulse .7s ease-in-out infinite alternate; }
@keyframes e2s-pulse { to { box-shadow: 0 0 1.3em #f6dc8eaa; } }
.e2s-keys { margin-top: .45em; font-family: var(--f-label); font-size: .74em; letter-spacing: .04em; opacity: .75; }
.e2s-root.is-done .e2s-stage { box-shadow: inset 0 0 2.2em #000c, 0 0 2.5em #49e0c8aa; }
.e2s-root.is-done:not(.reduced) .e2s-light { animation: e2s-burst .6s ease-out forwards; transform-origin: center; transform-box: fill-box; }
@keyframes e2s-burst { to { transform: scale(4); opacity: 0; } }
.e2s-root.is-out { opacity: 0; transition: opacity .35s; }
@media (max-height: 480px) and (orientation: landscape) {
  .e2s-box { padding: .4em .8em .5em; }
  .e2s-box .ch-title { font-size: 1em; }
  .e2s-stage { width: min(11em, 46vh); }
  .e2s-keys { display: none; }
  /* Phone landscape: the panel is as tall as the screen and would cut the HUD objective note in half; the panel
     carries its own instructions, so the note steps aside while it is open. */
  body:has(.e2s-root) .hud-obj { visibility: hidden; }
}
`;

function injectStyle(): void {
  if (document.getElementById('e2s-style')) return;
  const s = document.createElement('style');
  s.id = 'e2s-style';
  s.textContent = STYLE;
  document.head.appendChild(s);
}

function sfx(name: SfxName, opts?: SfxOptions): void {
  try { G.audio.sfx(name, opts); } catch { /* audio optional */ }
}

const SVG = 'http://www.w3.org/2000/svg';
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  parent?.appendChild(n);
  return n;
}

const FEEDBACK: Record<Exclude<ConfirmResult, 'ignored'>, { text: string; good: boolean }> = {
  calm: { text: 'Ruhig. Das Licht bleibt.', good: true },
  done: { text: 'Jetzt.', good: true },
  early: { text: 'Zu früh. Der Atem war noch nicht voll.', good: false },
  restless: { text: 'Das Licht war nicht in der Mitte.', good: false },
  late: { text: 'Der Atem ist schon unterwegs. Warte auf den nächsten.', good: false },
};

/** Opens the exercise. Resolves when three calm breaths are done. */
export function sammlungGame(opts: SammlungOptions = {}): Promise<SammlungResult> {
  if (ctx.stale()) return ctx.never();
  injectStyle();
  const reduced = G.settings.reducedMotion;
  const touch = ctx.root.classList.contains('is-touch');
  const cfg = sammlungConfig(reduced);
  const epoch = ctx.epoch;
  const scene = G.currentScene;

  const root = G.ui.panel('e2s-root');
  root.classList.toggle('reduced', reduced);
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Sammlung');
  root.innerHTML = `<div class="e2s-veil"><div class="e2s-box ch-panel">
    <div class="ch-title">Sammlung</div>
    <div class="e2s-sub" aria-live="polite">Halte das Licht in der Mitte. Lass die Gedanken vorbeiziehen.</div>
    <div class="e2s-stage"></div>
    <div class="e2s-pips"><i></i><i></i><i></i></div>
    <div class="e2s-controls">
      <div class="e2s-pad">
        <button type="button" class="ch-btn" data-d="up" aria-label="Nach oben">↑</button>
        <button type="button" class="ch-btn" data-d="left" aria-label="Nach links">←</button>
        <button type="button" class="ch-btn" data-d="down" aria-label="Nach unten">↓</button>
        <button type="button" class="ch-btn" data-d="right" aria-label="Nach rechts">→</button>
      </div>
      <button type="button" class="ch-btn e2s-go">Ausatmen</button>
    </div>
    <div class="e2s-keys">${touch
      ? 'Ziehen oder Pfeile: Licht halten · „Ausatmen“, wenn der Ring voll ist'
      : 'Pfeile / WASD oder Ziehen: Licht halten · E / Leertaste / Klick: ausatmen, wenn der Ring voll ist'}</div>
  </div></div>`;
  const stage = root.querySelector('.e2s-stage') as HTMLElement;
  const sub = root.querySelector('.e2s-sub') as HTMLElement;
  const pips = [...root.querySelectorAll('.e2s-pips i')] as HTMLElement[];
  const go = root.querySelector('.e2s-go') as HTMLButtonElement;

  const svg = svgEl('svg', { viewBox: '-1.5 -1.5 3 3', class: 'e2s-svg', 'aria-hidden': 'true' }, stage);
  const defs = svgEl('defs', {}, svg);
  const grad = svgEl('radialGradient', { id: 'e2s-glow' }, defs);
  svgEl('stop', { offset: '0%', 'stop-color': '#bff8ee', 'stop-opacity': 1 }, grad);
  svgEl('stop', { offset: '45%', 'stop-color': '#49e0c8', 'stop-opacity': 0.75 }, grad);
  svgEl('stop', { offset: '100%', 'stop-color': '#49e0c8', 'stop-opacity': 0 }, grad);
  svgEl('circle', { class: 'e2s-outer', r: cfg.outerRadius }, svg);
  svgEl('circle', { class: 'e2s-calm', r: cfg.calmRadius }, svg);
  const BREATH_R = 0.62;
  if (reduced) svgEl('circle', { class: 'e2s-track', r: BREATH_R }, svg);
  const breathRing = svgEl('circle', { class: reduced ? 'e2s-arc' : 'e2s-breath', r: BREATH_R, transform: 'rotate(-90)' }, svg);
  const arcLen = 2 * Math.PI * BREATH_R;
  if (reduced) breathRing.setAttribute('stroke-dasharray', `0 ${arcLen}`);
  const thoughtLayer = svgEl('g', {}, svg);
  const light = svgEl('circle', { class: 'e2s-light', r: 0.2 }, svg);
  const core = svgEl('circle', { class: 'e2s-core', r: 0.045 }, svg);

  let state = sammlungStart(cfg);
  const keys = new Set<string>();
  const pad = new Map<number, [number, number]>();
  let drag: { id: number; x: number; y: number; at: number; moved: boolean } | null = null;
  let target: { x: number; y: number } | null = null;
  let subUntil = 0;
  let finished = false;
  const openedAt = performance.now();
  const ready = () => performance.now() - openedAt > 250;
  const alive = () => epoch === ctx.epoch && scene === G.currentScene && root.isConnected && !ctx.stale();

  const say = (text: string, kind: 'good' | 'bad' | '' = '', ms = 1600) => {
    sub.textContent = text;
    sub.classList.toggle('is-good', kind === 'good');
    sub.classList.toggle('is-bad', kind === 'bad');
    subUntil = performance.now() + ms;
  };

  const toUnit = (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width - 0.5) * 3, y: ((e.clientY - r.top) / r.height - 0.5) * 3 };
  };

  return new Promise<SammlungResult>(resolve => {
    let raf = 0;
    let last = performance.now();
    let slipsSinceAdvice = 0;

    const confirm = () => {
      if (finished || !ready()) return;
      const r = sammlungConfirm(state, cfg);
      state = r.state;
      if (r.result === 'ignored') return;
      const f = FEEDBACK[r.result];
      say(r.result === 'calm' ? `${f.text} (${state.calm} / ${cfg.breaths})` : f.text, f.good ? 'good' : 'bad');
      if (r.result === 'calm') { sfx('spark', { volume: 0.5, pitch: 0.8 + 0.15 * state.calm }); opts.onCalm?.(state.calm); }
      else if (r.result === 'done') finish();
      else sfx('ui-cancel', { volume: 0.45 });
    };

    const grab = (id: string) => {
      if (finished || !ready()) return;
      const r = sammlungGrab(state, id, cfg);
      if (!r.word) return;
      state = r.state;
      sfx('whoosh', { volume: 0.35, pitch: 0.7 });
      say(`Du hältst „${r.word}“ fest. Lass los, lass vorbeiziehen.`, 'bad', 2200);
    };

    const clearInput = () => { keys.clear(); pad.clear(); drag = null; target = null; };
    const closeModal = ctx.open({
      id: MODAL, allowMenu: false, releaseKeys: Object.keys(AXES),
      onKey(e) {
        if (AXES[e.code]) { if (!e.repeat) keys.add(e.code); return true; }
        if (isConfirm(e)) { if (!e.repeat) confirm(); return true; }
        return e.key !== 'Escape' && e.key !== 'F2';
      },
      onKeyUp(e) { if (AXES[e.code]) { keys.delete(e.code); return true; } return isConfirm(e); },
    });
    const onBlur = () => clearInput();
    const onVisibility = () => { if (document.hidden) clearInput(); };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    const dispose = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInput();
      closeModal();
    };

    // Pointer: grabbing a thought is a mistake; dragging steers; a short tap lets the breath go.
    stage.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (finished || drag) return;
      const id = (e.target as Element | null)?.getAttribute?.('data-id');
      if (id) { grab(id); return; }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now(), moved: false };
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.moved = true;
      if (drag.moved) target = toUnit(e);
    });
    const endDrag = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const tap = !drag.moved && performance.now() - drag.at < 350 && e.type === 'pointerup';
      drag = null;
      target = null;
      if (tap) confirm();
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(ev, endDrag as EventListener);
    for (const b of root.querySelectorAll<HTMLButtonElement>('.e2s-pad .ch-btn')) {
      const d = b.dataset.d;
      const v: [number, number] = d === 'up' ? [0, -1] : d === 'down' ? [0, 1] : d === 'left' ? [-1, 0] : [1, 0];
      b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); pad.set(e.pointerId, v); });
      const up = (e: PointerEvent) => { pad.delete(e.pointerId); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
    }
    go.addEventListener('click', e => { e.preventDefault(); confirm(); });

    const thoughtNodes = new Map<string, SVGTextElement>();

    const render = () => {
      const b = breathAt(state.bt, cfg);
      if (reduced) breathRing.setAttribute('stroke-dasharray', `${(b.level * arcLen).toFixed(4)} ${arcLen.toFixed(4)}`);
      else breathRing.setAttribute('r', (0.36 + 0.5 * b.level).toFixed(4));
      root.classList.toggle('is-full', b.phase === 'full' && !state.used);
      const calmPos = Math.hypot(state.x, state.y) <= cfg.calmRadius;
      root.classList.toggle('is-calm-pos', calmPos);
      light.setAttribute('cx', state.x.toFixed(4)); light.setAttribute('cy', state.y.toFixed(4));
      core.setAttribute('cx', state.x.toFixed(4)); core.setAttribute('cy', state.y.toFixed(4));
      const seen = new Set<string>();
      for (const th of state.thoughts) {
        const p = thoughtPos(th, state.t);
        if (!p) continue;
        seen.add(th.id);
        let n = thoughtNodes.get(th.id);
        if (!n) {
          n = svgEl('text', { class: 'e2s-thought', 'data-id': th.id }, thoughtLayer);
          n.textContent = th.word;
          thoughtNodes.set(th.id, n);
        }
        const r = Math.hypot(p.x, p.y);
        n.setAttribute('x', p.x.toFixed(4)); n.setAttribute('y', p.y.toFixed(4));
        n.setAttribute('opacity', Math.max(0, Math.min(1, (1.45 - r) / 0.35)).toFixed(3));
        n.classList.toggle('is-grip', state.grip?.id === th.id);
      }
      for (const [id, n] of thoughtNodes) if (!seen.has(id)) { n.remove(); thoughtNodes.delete(id); }
      pips.forEach((p, i) => p.classList.toggle('is-on', i < state.calm));
      root.dataset.phase = b.phase;
      root.dataset.calm = String(state.calm);
      root.dataset.used = state.used ? '1' : '0';
      root.dataset.dist = Math.hypot(state.x, state.y).toFixed(3);
      root.dataset.x = state.x.toFixed(3);
      root.dataset.y = state.y.toFixed(3);
      if (performance.now() > subUntil) {
        const idle = b.phase === 'full' && !state.used ? 'Jetzt ausatmen.' : b.phase === 'in' ? 'Einatmen …' : 'Ausatmen … und wieder sammeln.';
        if (sub.textContent !== idle) { sub.textContent = idle; sub.classList.remove('is-good', 'is-bad'); }
      }
    };

    const finish = () => {
      finished = true;
      root.classList.add('is-done');
      root.dataset.done = '1';
      sfx('urmacht', { volume: 0.6 });
      render();
      setTimeout(() => {
        const current = alive();
        dispose();
        root.classList.add('is-out');
        setTimeout(() => root.remove(), 360);
        if (current) resolve({ stats: state.stats, heldWords: state.heldWords, seconds: state.t });
      }, reduced ? 250 : 900);
    };

    const tick = (now: number) => {
      if (!alive()) { dispose(); root.remove(); return; }
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (!finished && !document.hidden && ctx.top()?.id === MODAL) {
        let dx = 0, dy = 0;
        for (const k of keys) { dx += AXES[k][0]; dy += AXES[k][1]; }
        for (const v of pad.values()) { dx += v[0]; dy += v[1]; }
        const r = sammlungStep(state, dt, { dx: Math.sign(dx), dy: Math.sign(dy), target }, cfg);
        state = r.state;
        for (const ev of r.events) {
          if (ev === 'full') sfx('ui-move', { volume: 0.4, pitch: 1.4 });
          else if (ev === 'missed') say('Den vollen Atem verpasst. Der nächste kommt.', 'bad');
          else if (ev === 'lost') {
            slipsSinceAdvice++;
            sfx('whoosh', { volume: 0.5, pitch: 0.5 });
            const advice = slipsSinceAdvice >= 2 && opts.advice;
            if (advice) slipsSinceAdvice = 0;
            say(advice ? advice : 'Das Licht ist dir entglitten. Sammle dich neu.', 'bad', advice ? 3400 : 2000);
          }
        }
      } else if (!finished) clearInput();
      render();
      if (!finished) raf = requestAnimationFrame(tick);
    };
    render();
    raf = requestAnimationFrame(tick);
  });
}

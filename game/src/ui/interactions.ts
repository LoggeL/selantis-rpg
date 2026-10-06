import { ctx, isConfirm } from './context';
import { G } from '../core/G';
import { el, icon, sfx } from './dom';
import { storyMove, storyStart, storyTargets, stealthPhase, stealthRounds, stealthSafe, stealthStart, stealthStep, stealthTarget, stealthTiming, type StoryActionKind, type StealthKind } from './interactionRules';
import './interactions.css';
import { createStealthStage } from './stealthStage';
import { createMiniIllustration } from './miniIllustration';

export interface StoryActionOptions { onStroke?: (stroke: number) => void; onProgress?: (progress: number) => void }
export interface StealthOptions { onNoise?: (mistakes: number) => void }

const AXES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
};
const ARROWS = ['←', '→', '↑', '↓'];

/** One owner for keys, pointers, focus loss and scene cancellation. Stale scene promises never resume. */
function interaction(label: string, kind: string, help: string, vertical: boolean) {
  const epoch = ctx.epoch;
  const scene = G.currentScene;
  const modalId = `action-${kind}`;
  const root = el('div', `scene-action action-${kind}`);
  root.dataset.kind = kind;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', label);
  root.setAttribute('aria-modal', 'true');
  const box = el('div', 'action-box ch-panel');
  const title = el('div', 'ch-title', label);
  const instruction = el('p', 'action-instruction', help);
  const stage = el('div', `action-stage${vertical ? ' is-vertical' : ''}`);
  const status = el('div', 'action-status');
  status.setAttribute('aria-live', 'polite');
  const controls = el('div', 'action-controls');
  const keys = new Set<string>();
  const pointers = new Map<number, number>();
  let pointer: number | undefined;
  let pointerReleased = false;
  let activePointer: number | undefined;
  let last = performance.now(), raf = 0, finished = false, disposed = false;
  let keyAction: () => void = () => {};
  const openedAt = performance.now();
  const inputReady = () => performance.now() - openedAt > 180;
  const alive = () => epoch === ctx.epoch && scene === G.currentScene && root.isConnected && !ctx.stale();
  const close = ctx.open({
    id: modalId, allowMenu: false,
    releaseKeys: Object.keys(AXES),
    onKey(e) {
      if (AXES[e.code]) { if (inputReady() && !e.repeat) keys.add(e.code); return true; }
      if (isConfirm(e)) { if (inputReady() && !e.repeat) keyAction(); return true; }
      return false;
    },
    onKeyUp(e) { if (AXES[e.code]) { keys.delete(e.code); return true; } return isConfirm(e); },
  });
  const clearInput = () => { keys.clear(); pointers.clear(); pointer = undefined; activePointer = undefined; pointerReleased = false; };
  const visibility = () => { if (document.hidden) clearInput(); };
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', visibility);
  const addDirection = (n: number) => {
    const arrow = ARROWS[vertical ? (n < 0 ? 2 : 3) : (n < 0 ? 0 : 1)];
    const button = el('button', 'action-direction ch-btn', arrow);
    button.type = 'button';
    button.setAttribute('aria-label', vertical ? (n < 0 ? 'Nach oben' : 'Nach unten') : (n < 0 ? 'Nach links' : 'Nach rechts'));
    button.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (!inputReady() || finished) return;
      button.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, n);
    });
    const release = (e: PointerEvent) => { pointers.delete(e.pointerId); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    controls.append(button);
  };
  addDirection(-1); addDirection(1);
  const keyHint = el('div', 'action-keyhint', vertical ? 'W / S oder ↑ / ↓ · Griff ziehen' : 'A / D oder ← / → · Griff ziehen');
  box.append(title, instruction, stage, status, controls, keyHint);
  root.append(box);
  ctx.layers.dialog.append(root);
  const coordinate = (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    return Math.max(0, Math.min(1, kind === 'duck' ? ((e.clientY - r.top) / r.height - 0.42) / 0.42 : vertical ? (e.clientY - r.top - 24) / (r.height - 48) : (e.clientX - r.left - 24) / (r.width - 48)));
  };
  const updatePointer = (e: PointerEvent) => { if (e.pointerId === activePointer) pointer = coordinate(e); };
  stage.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!inputReady() || finished || activePointer !== undefined) return;
    if (root.dataset.position && !['cover', 'duck', 'listen'].includes(kind) && Math.abs(coordinate(e) - Number(root.dataset.position)) > 0.22) return;
    activePointer = e.pointerId;
    pointerReleased = false;
    stage.setPointerCapture(e.pointerId);
    pointer = coordinate(e);
  });
  stage.addEventListener('pointermove', updatePointer);
  const releasePointer = (e: PointerEvent) => {
    if (e.pointerId !== activePointer) return;
    activePointer = undefined;
    pointer = e.type === 'pointerup' ? coordinate(e) : undefined;
    pointerReleased = true;
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(event, releasePointer as EventListener);
  const direction = () => {
    let d = 0;
    for (const k of keys) d += AXES[k][vertical ? 1 : 0];
    for (const n of pointers.values()) d += n;
    return Math.sign(d);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('blur', clearInput);
    document.removeEventListener('visibilitychange', visibility);
    clearInput(); close(); root.remove();
  };
  return {
    root, stage, status, controls, keyHint,
    onConfirm(fn: () => void) { keyAction = fn; },
    finish(resolve: () => void) {
      if (finished) return;
      finished = true;
      root.classList.add('is-complete');
      sfx('ui-confirm', { volume: 0.7 });
      close();
      setTimeout(() => { const current = alive(); dispose(); if (current) resolve(); }, ctx.reducedMotion ? 100 : 420);
    },
    run(frame: (dt: number, direction: number, pointer?: number) => void) {
      const tick = (now: number) => {
        if (!alive()) { dispose(); return; }
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
        if (!finished && !document.hidden && document.hasFocus() && ctx.top()?.id === modalId) {
          frame(dt, direction(), pointer);
          if (pointerReleased) { pointer = undefined; pointerReleased = false; }
        } else if (!finished) clearInput();
        if (!disposed) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
  };
}

export function storyAction(kind: StoryActionKind, label: string, opts: StoryActionOptions = {}): Promise<void> {
  if (ctx.stale()) return ctx.never();
  const vertical = kind === 'lift' || kind === 'open-eyes' || kind === 'bellows';
  const helps: Record<StoryActionKind, string> = {
    reach: 'Führe die Hand zum Licht. Lass dir Zeit.',
    lift: 'Hebe die Hand zur Wiege. Lass dir Zeit.',
    'open-eyes': 'Schiebe die Lider langsam nach oben.',
    tend: 'Streiche die Tinktur vorsichtig hin und her auf die Ferse.',
    bellows: 'Bewege den Blasebalg dreimal ganz nach unten und wieder nach oben.',
  };
  const view = interaction(label, kind, helps[kind], vertical);
  let state = storyStart(kind);
  const targets = storyTargets(kind);
  const track = el('div', 'action-track');
  const goal = el('span', 'action-goal');
  const grip = el('div', 'action-grip');
  if (kind === 'bellows') {
    grip.classList.add('bellows-handle');
    grip.textContent = '↕';
  } else grip.append(icon(kind === 'open-eyes' ? 'eye' : 'hand'));
  grip.setAttribute('aria-hidden', 'true');
  const ornament = el('div', `action-ornament ornament-${kind}`);
  ornament.innerHTML = kind === 'bellows'
    ? '<div class="bellows-folds"><svg viewBox="0 0 160 100" preserveAspectRatio="none"><path d="M12 0H148L135 16L148 32L135 48L148 64L135 80L148 100H12L25 80L12 64L25 48L12 32L25 16Z" fill="#946d48" stroke="#e5bc78" stroke-width="3"/><path d="M25 16H135M12 32H148M25 48H135M12 64H148M25 80H135" stroke="#38281f" stroke-width="5"/></svg></div><div class="bellows-base"></div><div class="bellows-nozzle"></div>'
    : '';
  const art = createMiniIllustration(view.stage, kind);
  view.stage.append(ornament, track, goal, grip);
  return new Promise(resolve => {
    const render = (dt = 0) => {
      const target = targets[state.strokes] ?? state.position;
      const axis = vertical ? 'top' : 'left';
      grip.style[axis] = `calc(24px + (100% - 48px) * ${state.position})`;
      goal.style[axis] = `calc(24px + (100% - 48px) * ${target})`;
      const arrow = ARROWS[vertical ? (target === 0 ? 2 : 3) : (target === 0 ? 0 : 1)];
      const progress = Math.min(1, (state.strokes + Math.abs(state.position - (target === 0 ? 1 : 0))) / targets.length);
      view.root.style.setProperty('--action-progress', String(progress));
      view.root.style.setProperty('--stroke-position', String(state.position));
      view.root.dataset.target = String(target);
      view.root.dataset.position = String(state.position);
      view.root.dataset.strokes = String(state.strokes);
      const message = state.strokes >= targets.length ? 'Fertig.' : `${arrow} ${vertical ? (target === 0 ? 'Nach oben' : 'Nach unten') : (target === 0 ? 'Nach links' : 'Nach rechts')}${targets.length > 1 ? ` · ${state.strokes} / ${targets.length} Bewegungen` : ''}`;
      if (view.status.textContent !== message) view.status.textContent = message;
      opts.onProgress?.(progress);
      art.render({ progress, position: state.position }, dt);
    };
    render();
    view.run((dt, d, pointer) => {
      const before = state.strokes;
      state = storyMove(state, kind, pointer ?? state.position + d * dt * (kind === 'bellows' ? 2.8 : 1.05));
      // A pointer crossing an endpoint must reverse for the next stroke, just like the keys.
      if (state.strokes !== before) { sfx('ui-move', { volume: 0.4 }); opts.onStroke?.(state.strokes); }
      render(dt);
      if (state.strokes >= targets.length) view.finish(resolve);
    });
  });
}

export function stealthGame(kind: StealthKind, label: string, opts: StealthOptions = {}): Promise<number> {
  if (ctx.stale()) return ctx.never();
  const help: Record<StealthKind, string> = {
    cover: 'Wechsle zum markierten Busch, solange die Wache wegsieht. Wenn sie sucht, bleib dort still.',
    duck: 'Duck dich vor den Reitern unter die Böschung. Zwischen den Gruppen kurz hochsehen.',
    listen: 'Lausche hinter den Baumstämmen. Wechsle auf die dunkle Seite, bevor die Fackel dorthin leuchtet.',
  };
  const view = interaction(label, kind, help[kind], kind === 'duck');
  view.root.classList.add('is-stealth');
  view.keyHint.textContent = kind === 'duck' ? 'W / S oder ↑ / ↓ · Lia ziehen' : 'A / D oder ← / → · Lia ziehen';
  let state = stealthStart(kind), started = false;
  const scene = createStealthStage(view.stage, kind);
  const beats = el('div', 'stealth-beats');
  for (let i = 0; i < stealthRounds(kind); i++) beats.append(el('i'));
  const start = el('button', 'action-start ch-btn', 'Bereit');
  start.type = 'button';
  let assetsReady = false;
  start.disabled = true;
  const begin = () => { if (!started && assetsReady) { started = true; start.remove(); view.root.classList.add('is-started'); } };
  void scene.ready.then(ready => { assetsReady = ready; start.disabled = !ready; scene.render(state, started); });
  start.addEventListener('click', begin);
  view.controls.prepend(start);
  view.onConfirm(begin);
  view.stage.after(beats);
  return new Promise(resolve => {
    const render = () => {
      const phase = stealthPhase(state, kind);
      const target = stealthTarget(kind, state.round);
      view.root.dataset.phase = started ? phase : 'ready';
      view.root.dataset.round = String(state.round);
      view.root.dataset.target = String(target);
      view.root.dataset.position = String(state.position);
      view.root.dataset.mistakes = String(state.mistakes);
      view.root.classList.toggle('is-danger', started && phase === 'danger');
      view.root.classList.toggle('is-riding', started && phase === 'danger' && kind === 'duck' && target > 0.5);
      view.root.classList.toggle('is-safe', stealthSafe(state, kind));
      const timing = stealthTiming(kind);
      const remaining = phase === 'move' ? 1 - Math.max(0, state.time) / timing.prepare : 1 - (state.time - timing.prepare) / timing.danger;
      view.root.style.setProperty('--warning', String(Math.max(0, remaining)));
      view.root.style.setProperty('--beam-side', target < 0.5 ? '1' : '-1');
      [...beats.children].forEach((b, i) => b.classList.toggle('is-done', i < state.round));
      const message = !started ? 'Bereit? E / Enter oder „Bereit“.' : phase === 'done' ? 'Unbemerkt geblieben.' : phase === 'retry' ? 'Es raschelt. Noch einmal, du bist in Sicherheit.'
        : kind === 'duck' ? (target > 0.5 ? (phase === 'danger' ? 'Reiter! Tief geduckt bleiben.' : '↓ Abtauchen, die Reiter kommen!') : '↑ Kurz hochsehen, wo bleibt Kyra?')
        : kind === 'cover' ? (phase === 'danger' ? 'Die Wache sucht. Nicht bewegen!' : `Die Wache sieht weg. ${target < 0.5 ? '← Zum linken' : 'Zum rechten →'} Busch.`)
        : (phase === 'danger' ? 'Die Fackel streift den Stamm. Bleib im Schatten.' : `${target < 0.5 ? '← Links' : 'Rechts →'} hinter den Stamm, die Fackel wandert.`);
      if (view.status.textContent !== message) view.status.textContent = message;
    };
    render();
    scene.render(state, started);
    view.run((dt, d, pointer) => {
      if (!started) { scene.render(state, false, dt); return; }
      const result = stealthStep(state, kind, dt, d, pointer);
      state = result.state;
      if (result.event === 'noise') { sfx('branch-snap', { volume: 0.5 }); opts.onNoise?.(state.mistakes); }
      if (result.event === 'safe') sfx('ui-move', { volume: 0.45 });
      render();
      scene.render(state, true, dt);
      if (state.done) view.finish(() => resolve(state.mistakes));
    });
  });
}

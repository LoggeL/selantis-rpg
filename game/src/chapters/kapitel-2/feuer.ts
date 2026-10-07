// Fire-drilling minigame overlay (erstes-lager): a painted close-up of the stone ring at dusk (Codex art: scene,
// Lia's hands on the drill, the flame) in a Chronik frame, with the timing track and the ember gauge below it.
// The code only draws effects on top of the painting: the drill's sway, glow, smoke, sparks and the firelight.
// Rules: feuerLogic.ts. Input: E / Space / Enter, mouse click or tap anywhere.
import { loadImage } from '../../art/assets';
import { manifest } from '../../art/manifest';
import { G } from '../../core/G';
import { consumeAction } from '../../core/input';
import { settings } from '../../core/settings';
import { type FireConfig, type FireState, inZone, press, type PressResult, tick, zoneWidth } from './feuerLogic';
import { isConfirmKey, sfx, touchUi } from './shared';

let styled = false;
function ensureStyles(): void {
  if (styled) return;
  styled = true;
  const css = `
.k2-feuer { display: flex; align-items: center; justify-content: center; padding: 1em; cursor: pointer; touch-action: manipulation;
  background: radial-gradient(ellipse at 50% 45%, #05080e99 25%, #030509f0 100%); --k2-foot: 7.4em; }
.k2-feuer-box { position: relative; display: flex; flex-direction: column; width: min(100%, 1060px, calc((100dvh - 2em - var(--k2-foot) - var(--k2-extra, 0em)) * 16 / 9));
  max-height: 100%; padding: 0; overflow: hidden; animation: k2-rise .35s var(--ease-out, ease-out); box-shadow: 0 1.2em 3em #000c, 0 0 0 1px #000; }
.k2-feuer-box::before, .k2-feuer-box::after { z-index: 4; }
/* The developer preview keeps its game picker above the frame. */
.interaction-preview-nav ~ .k2-feuer { padding-top: 4em; --k2-extra: 3em; }
.k2-stage { position: relative; flex: none; width: 100%; aspect-ratio: 16 / 9; background: #0b0f17; border-bottom: 1px solid var(--gold-line); overflow: hidden; }
.k2-art { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.k2-stage::after { content: ''; position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 4em #000a; }
.k2-feuer .k2-stage .ch-title { position: absolute; z-index: 3; top: .7em; left: 0; margin: 0; padding: .3em 2.6em .36em 1.1em;
  font-size: clamp(1.05em, 2.8vmin, 1.65em); white-space: nowrap; pointer-events: none; text-shadow: 0 2px 6px #000;
  background: linear-gradient(90deg, #0d121bf0, #0d121be0 60%, transparent); }
.k2-feuer .k2-stage .ch-title::after { content: ''; position: absolute; left: .9em; right: 25%; bottom: 0; height: 1px; background: linear-gradient(90deg, var(--gold), transparent); }
.k2-msg { position: absolute; z-index: 3; left: 50%; bottom: .9em; transform: translateX(-50%); max-width: 86%; margin: 0; padding: .35em 1.8em .4em;
  font-family: var(--f-body); font-style: italic; font-size: clamp(1em, 2.5vmin, 1.32em); line-height: 1.25; text-align: center; white-space: nowrap;
  color: var(--parch); text-shadow: 0 1px 3px #000; pointer-events: none;
  background: linear-gradient(90deg, transparent, #0d121be0 14%, #0d121bf0 50%, #0d121be0 86%, transparent);
  border-top: 1px solid #d8b25a44; border-bottom: 1px solid #d8b25a44; transition: color .2s; }
.k2-feuer.is-hit .k2-msg { color: #ffe2a6; }
.k2-feuer.is-slip .k2-msg { color: #ffb19e; }
.k2-feuer.is-ember .k2-msg { color: var(--gold-hi); font-size: clamp(1.2em, 3.2vmin, 1.7em); font-style: normal; font-family: var(--f-head); letter-spacing: .06em; }
/* Footer: the timing rail, the ember gauge, the slips and a large control hint. */
.k2-foot { position: relative; flex: none; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-rows: auto auto; align-items: center; gap: .55em 1.1em;
  padding: .9em 1.4em 1em; background: linear-gradient(180deg, #151c2b, #0c1019); }
.k2-track { grid-column: 1 / -1; position: relative; height: 2.2em; border-radius: 1.1em; overflow: hidden;
  background: repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), #d8b25a1f calc(10% - 1px) 10%), linear-gradient(#070a10, #182030 55%, #0b0f17);
  border: 1px solid var(--gold-line); box-shadow: inset 0 .2em .5em #000c, 0 0 0 3px #0b0f17, 0 0 0 4px #d8b25a33; }
.k2-rail { position: absolute; top: 0; bottom: 0; left: .6em; right: .6em; }
.k2-zone { position: absolute; top: .22em; bottom: .22em; border-radius: .9em;
  background: radial-gradient(ellipse at 50% 55%, #fff1c2 0%, #ffc45a 30%, #e2701f 62%, #8a2c0e00 100%);
  box-shadow: 0 0 1em #ff9a3c88; transition: left .2s var(--ease-out, ease-out), width .2s ease-out; animation: k2-ember 1.3s ease-in-out infinite; }
.k2-feuer.is-in .k2-zone { box-shadow: 0 0 1.6em #ffbe5ccc, 0 0 .3em #fff1c2; }
.k2-needle { position: absolute; top: -.1em; bottom: -.1em; width: .5em; margin-left: -.25em; pointer-events: none; }
.k2-needle::before { content: ''; position: absolute; left: 50%; top: .15em; bottom: .15em; width: .22em; margin-left: -.11em; border-radius: .11em;
  background: linear-gradient(#fff6dc, var(--parch) 50%, #c9b993); box-shadow: 0 0 .5em #fff3d0dd, 0 0 0 1px #0009; }
.k2-needle::after { content: ''; position: absolute; left: 50%; top: 50%; width: .62em; height: .62em; margin: -.31em 0 0 -.31em; transform: rotate(45deg);
  background: radial-gradient(circle at 35% 35%, #fff6dc, var(--gold) 60%, var(--gold-lo)); box-shadow: 0 0 0 1px #0008, 0 0 .5em #f3d68a; }
.k2-feuer.is-hit .k2-needle::after { background: radial-gradient(circle, #fff, #ffd27a 50%, #e2701f); box-shadow: 0 0 1.2em #ffb050, 0 0 0 1px #000a; }
.k2-feuer.is-slip .k2-track { animation: k2-shake .25s; border-color: var(--danger, #d4573b); }
.k2-feuer.is-slip .k2-stage { animation: k2-shake .25s; }
.k2-gauge { display: flex; align-items: center; gap: .55em; min-width: 0; }
.k2-gauge .ch-label { color: var(--gold); font-size: .95em; }
.k2-heat { position: relative; flex: 1; min-width: 4em; height: .9em; border-radius: .45em; background: #070a10; border: 1px solid var(--gold-line); overflow: hidden; box-shadow: inset 0 1px 3px #000; }
.k2-heat-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: .45em; transition: width .15s linear;
  background: linear-gradient(90deg, #4a1606, #9b3410 35%, #e2701f 70%, #ffd27a); box-shadow: 0 0 .8em #ff8a3488; }
.k2-heat-fill::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 60%, #fff3 90%, #fff8); animation: k2-ember 0.9s ease-in-out infinite; }
.k2-hint { grid-column: 2; grid-row: 2; justify-self: center; min-width: 0; text-align: center; font-family: var(--f-label); letter-spacing: .05em; font-size: 1.02em; line-height: 1.5; color: var(--parch); }
.k2-hint .ch-key { margin: 0 .15em; font-size: .95em; }
.k2-hint b { color: #ffcf7a; font-weight: 700; }
.k2-hint-short { display: none; }
.k2-slips { grid-column: 3; grid-row: 2; display: flex; align-items: center; gap: .4em; color: var(--parch-dim); font-size: .95em; }
.k2-slips i { display: inline-block; width: .95em; height: .95em; border-radius: 50%; border: 1.5px solid var(--gold-line);
  background: radial-gradient(circle at 35% 30%, #1d2536, #070a10); box-shadow: inset 0 1px 2px #000; transition: background .25s, transform .25s var(--ease-back, ease-out); }
.k2-slips i.is-used { border-color: var(--danger, #d4573b); background: radial-gradient(circle at 35% 30%, #ff9e86, var(--danger, #d4573b) 55%, #5a170c); box-shadow: 0 0 .6em #d4573b99; transform: scale(1.12); }
.k2-gauge { grid-column: 1; grid-row: 2; width: 10em; }
@keyframes k2-shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-0.3em) } 75% { transform: translateX(0.3em) } }
.k2-feuer .k2-stage { transform-origin: 50% 50%; }
.k2-feuer.is-slip .k2-stage .ch-title { animation: none; }
@keyframes k2-rise { from { transform: translateY(1em); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes k2-ember { 0%, 100% { opacity: 1 } 50% { opacity: .78 } }
.k2-feuer.is-ember .k2-feuer-box { box-shadow: 0 0 0 2px var(--gold-hi), 0 0 3em #ffb05066, 0 1.2em 3em #000c; }
/* Phone portrait: a tall window onto the stone ring, the controls stacked below it. */
.is-portrait .k2-feuer { padding: .5em; --k2-foot: 9em; }
.is-portrait .k2-feuer-box { width: 100%; }
.is-portrait .k2-stage { aspect-ratio: 3 / 4; max-height: calc(100dvh - var(--k2-foot) - 2em); }
.is-portrait .k2-foot { grid-template-columns: 1fr auto; padding: .8em .9em .9em; gap: .7em .8em; }
.is-portrait .k2-gauge { grid-column: 1; grid-row: 2; width: auto; }
.is-portrait .k2-slips { grid-column: 2; grid-row: 2; }
.is-portrait .k2-hint { grid-column: 1 / -1; grid-row: 3; font-size: 1.1em; white-space: normal; }
.is-portrait .k2-msg { white-space: normal; width: 92%; padding: .35em .8em .4em; }
.is-portrait .k2-track { height: 2.6em; border-radius: 1.3em; }
/* Phone landscape: the same tableau, tighter. */
@media (max-height: 480px) and (orientation: landscape) {
  .k2-feuer { padding: .3em; --k2-foot: 5.4em; }
  .k2-feuer-box { width: min(100%, calc((100dvh - .6em - var(--k2-foot) - var(--k2-extra, 0em)) * 2)); }
  .k2-stage { aspect-ratio: 2 / 1; }
  .interaction-preview-nav ~ .k2-feuer { padding-top: 3.4em; --k2-extra: 3.1em; }
  .k2-foot { padding: .45em .9em .5em; gap: .35em .8em; }
  .k2-track { height: 1.9em; }
  .k2-feuer .k2-stage .ch-title { top: .3em; font-size: 1em; }
  .k2-msg { bottom: .4em; font-size: .95em; }
  .k2-gauge { width: 6.5em; }
  .k2-hint { font-size: 1.05em; white-space: nowrap; letter-spacing: .04em; }
  .k2-hint-long { display: none; }
  .k2-hint-short { display: inline; }
  .k2-slips-label { display: none; }
}
.reduced-motion .k2-feuer-box, .reduced-motion .k2-zone, .reduced-motion .k2-heat-fill::after { animation: none; }
.reduced-motion .k2-feuer.is-slip .k2-track, .reduced-motion .k2-feuer.is-slip .k2-stage { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .k2-feuer-box, .k2-zone, .k2-heat-fill::after, .k2-feuer.is-slip .k2-track, .k2-feuer.is-slip .k2-stage { animation: none; }
}
`;
  const tag = document.createElement('style');
  tag.dataset.k2 = 'feuer';
  tag.textContent = css;
  document.head.appendChild(tag);
}

export interface FireHooks {
  onHit?: (heat: number) => void;
  onSlip?: () => void;
}

const SLIP_LINES = ['Das Stöckchen rutscht ab …', 'Au. Meine Hände …', 'Nur Qualm.'];
const HIT_LINES = ['Rauch!', 'Weiter so …', 'Es wird warm …', 'Fast …'];

/** Debug/e2e handle: current state and config of the running attempt. */
export interface FireDebug { state: FireState; config: FireConfig; inZone: () => boolean }
declare global { interface Window { __k2fire?: FireDebug } }

// ------------------------------------------------------------------------------------------------ painted scene

/** The painting is 1280×720; the notch in the hearth board sits here, the tinder nest just in front of it. */
const SCENE_W = 1280, SCENE_H = 720;
const NOTCH = { x: 640, y: 393 };
const NEST = { x: 640, y: 506 };
/** Hands sprite: drill tip in sprite pixels and the drawn scale (in scene pixels). */
const HANDS_TIP = { x: 283.5, y: 559 };
const HANDS_SCALE = 0.72;
const FLAME_H = 300;

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; kind: 'smoke' | 'spark' | 'dust' }

/** Canvas illustration of the drilling; `update` receives the logic state every frame. */
function createFireArt(stage: HTMLElement, root: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'k2-art';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Lia kniet am Steinring und dreht den Feuerbohrer zwischen den Händen über dem Zunderbett.');
  stage.prepend(canvas);
  const g = canvas.getContext('2d')!;
  const art = manifest();
  const file = (key: string, ext: string) => art.images[`minigames/${key}`]?.file ?? `assets/minigames/${key}.${ext}`;
  const pics: { scene?: HTMLImageElement; hands?: HTMLImageElement; flame?: HTMLImageElement } = {};
  root.dataset.art = 'loading';
  void Promise.all([
    loadImage(file('feuer-scene', 'jpg')).then(p => { if (p) pics.scene = p; }),
    loadImage(file('feuer-hands', 'png')).then(p => { if (p) pics.hands = p; }),
    loadImage(file('feuer-flame', 'png')).then(p => { if (p) pics.flame = p; }),
  ]).then(() => { root.dataset.art = pics.scene && pics.hands && pics.flame ? 'ready' : 'failed'; });

  let W = 0, H = 0, dpr = 1, s = 1, ox = 0, oy = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width * dpr));
    H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    // "cover" framing that keeps the notch in view; tall phone windows zoom in a little less than they crop.
    s = Math.max(W / SCENE_W, H / SCENE_H);
    const fy = H > W ? 420 : SCENE_H / 2;
    ox = Math.min(0, Math.max(W - SCENE_W * s, W / 2 - NOTCH.x * s));
    oy = Math.min(0, Math.max(H - SCENE_H * s, H / 2 - fy * s));
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);

  const parts: Particle[] = [];
  const add = (p: Particle) => { if (parts.length < 140) parts.push(p); };
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  let t = 0, push = 0, kick = 0, flash = 0, slipFlash = 0, flameT = -1, outT = 0, smokeAcc = 0, glow = 0;
  let ended: PressResult | null = null;
  const reduced = () => settings.reducedMotion;

  // The hands are painted evenly lit; at dusk the sleeves and forearms sink into shadow and only the fingers
  // and the drill catch the ember below them. Shaded in a small offscreen canvas (clipped to the hands).
  const handsCv = document.createElement('canvas');
  const hg = handsCv.getContext('2d')!;
  const shadeHands = (img: HTMLImageElement, light: number): HTMLCanvasElement => {
    const w = img.width, h = img.height;
    if (handsCv.width !== w || handsCv.height !== h) { handsCv.width = w; handsCv.height = h; }
    hg.globalCompositeOperation = 'source-over';
    hg.clearRect(0, 0, w, h);
    hg.drawImage(img, 0, 0);
    hg.globalCompositeOperation = 'source-atop';
    const dusk = hg.createLinearGradient(0, 0, 0, h);
    dusk.addColorStop(0, 'rgba(10,12,32,.62)');
    dusk.addColorStop(.42, 'rgba(14,14,34,.34)');
    dusk.addColorStop(1, 'rgba(20,14,30,.12)');
    hg.fillStyle = dusk;
    hg.fillRect(0, 0, w, h);
    if (light > .02) {
      const warm = hg.createRadialGradient(HANDS_TIP.x, h, 0, HANDS_TIP.x, h, h * (.55 + .35 * light));
      warm.addColorStop(0, `rgba(255,150,60,${(.55 * light).toFixed(3)})`);
      warm.addColorStop(1, 'rgba(255,120,40,0)');
      hg.globalCompositeOperation = 'lighter';
      hg.fillStyle = warm;
      hg.fillRect(0, 0, w, h);
      // 'lighter' must not spill outside the hands' silhouette.
      hg.globalCompositeOperation = 'destination-in';
      hg.drawImage(img, 0, 0);
    }
    return handsCv;
  };

  const burst = (kind: 'hit' | 'slip') => {
    const n = reduced() ? 4 : kind === 'hit' ? 14 : 10;
    for (let i = 0; i < n; i++) {
      if (kind === 'hit') add({ x: NOTCH.x + rnd(-6, 6), y: NOTCH.y + rnd(-2, 4), vx: rnd(-90, 90), vy: rnd(-170, -50), life: 0, max: rnd(.35, .7), size: rnd(2, 4), kind: 'spark' });
      else add({ x: NOTCH.x + rnd(-8, 8), y: NOTCH.y + rnd(-4, 4), vx: rnd(-120, 120), vy: rnd(-60, 10), life: 0, max: rnd(.4, .8), size: rnd(4, 9), kind: 'dust' });
    }
    if (kind === 'hit') { push = 1; flash = 1; for (let i = 0; i < 3; i++) add(smoke(1.3)); }
    else { kick = Math.random() < .5 ? -1 : 1; slipFlash = 1; }
  };
  const smoke = (k = 1): Particle => ({ x: NOTCH.x + rnd(-5, 5), y: NOTCH.y - 2, vx: rnd(-10, 14), vy: rnd(-55, -35) * k, life: 0, max: rnd(1.4, 2.4), size: rnd(10, 16), kind: 'smoke' });

  const update = (st: FireState, dt: number) => {
    t += dt;
    const heat = ended === 'ember' ? 100 : st.heat;
    glow += ((heat / 100) - glow) * Math.min(1, dt * 6);
    push = Math.max(0, push - dt * 5);
    kick *= Math.pow(0.02, dt);
    flash = Math.max(0, flash - dt * 3.5);
    slipFlash = Math.max(0, slipFlash - dt * 2.5);
    if (flameT >= 0) flameT += dt;
    if (ended === 'ember') outT = Math.min(1, outT + dt * 2.2);
    // Smoke grows with the heat; dies out after a failed attempt.
    const rate = ended && ended !== 'ember' ? 0 : ended === 'ember' ? 6 : heat > 4 ? 1.5 + heat / 9 : 0;
    smokeAcc += rate * dt * (reduced() ? .4 : 1);
    while (smokeAcc >= 1) { smokeAcc -= 1; add(ended === 'ember' ? { ...smoke(1.6), x: NEST.x + rnd(-14, 14), y: NEST.y - FLAME_H * 1.02 } : smoke()); }
    if (ended === 'ember' && !reduced() && Math.random() < dt * 14) {
      add({ x: NEST.x + rnd(-30, 30), y: NEST.y - rnd(40, 160), vx: rnd(-30, 30), vy: rnd(-160, -90), life: 0, max: rnd(.7, 1.3), size: rnd(2, 4), kind: 'spark' });
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'spark') p.vy += 160 * dt;
      else if (p.kind === 'dust') { p.vy += 120 * dt; p.vx *= Math.pow(.15, dt); }
      else { p.vx += Math.sin(t * 1.7 + p.y * .02) * 14 * dt; p.size += 16 * dt; }
    }
    draw(st, heat);
  };

  const draw = (st: FireState, heat: number) => {
    if (!W || !H) resize();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0b0f17';
    g.fillRect(0, 0, W, H);
    if (!pics.scene) return;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.setTransform(s, 0, 0, s, ox, oy);
    g.drawImage(pics.scene, 0, 0, SCENE_W, SCENE_H);
    const calm = reduced();
    const flick = calm ? 1 : 0.88 + 0.12 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1);
    const fire = flameT >= 0 ? Math.min(1, flameT / .6) : 0;

    // Dusk: the clearing darkens towards the edges; the ember and later the flame light it from the centre.
    const dusk = g.createRadialGradient(NOTCH.x, NOTCH.y + 40, 120, NOTCH.x, NOTCH.y + 40, 820);
    dusk.addColorStop(0, `rgba(10,12,30,${0.05 * (1 - fire)})`);
    dusk.addColorStop(1, `rgba(8,10,28,${0.5 - 0.25 * fire})`);
    g.fillStyle = dusk;
    g.fillRect(0, 0, SCENE_W, SCENE_H);

    // Glowing specks in the wood dust under the notch.
    if (glow > .25) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const n = Math.round(glow * 14);
      for (let i = 0; i < n; i++) {
        const a = i * 2.39996, r = 6 + (i * 7) % 18;
        const tw = calm ? .8 : .5 + .5 * Math.sin(t * (5 + i) + i);
        g.fillStyle = `rgba(255,${120 + (i * 23) % 90},40,${(.35 + .5 * tw) * Math.min(1, (glow - .25) * 2)})`;
        g.fillRect(Math.round(NOTCH.x + Math.cos(a) * r * 1.4), Math.round(NOTCH.y + 10 + Math.abs(Math.sin(a)) * r), 3, 3);
      }
      g.restore();
    }

    // Lia's hands and the drill, pinned at the notch; the sway follows the needle, a hit pushes it down.
    if (pics.hands && outT < 1) {
      const sway = (st.pos - .5) * .07 + kick * .12 + (calm ? 0 : Math.sin(t * 31) * .006 * (heat > 0 ? 1 : .3));
      const dy = push * 7 - outT * 120;
      g.save();
      g.globalAlpha = 1 - outT;
      g.translate(NOTCH.x, NOTCH.y + dy);
      g.rotate(sway);
      const hw = pics.hands.width * HANDS_SCALE, hh = pics.hands.height * HANDS_SCALE;
      g.drawImage(shadeHands(pics.hands, glow * flick), -HANDS_TIP.x * HANDS_SCALE, -HANDS_TIP.y * HANDS_SCALE, hw, hh);
      g.restore();
    }

    // The ember: a warm core at the drill tip, its light spilling over the board, the stones and the hands.
    const e = Math.max(glow, flash * .6) * flick;
    if (e > .01) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const core = g.createRadialGradient(NOTCH.x, NOTCH.y + 9, 0, NOTCH.x, NOTCH.y + 9, 16 + 30 * e);
      core.addColorStop(0, `rgba(255,226,150,${.75 * e})`);
      core.addColorStop(.4, `rgba(255,130,40,${.45 * e})`);
      core.addColorStop(1, 'rgba(160,40,10,0)');
      g.fillStyle = core;
      g.fillRect(NOTCH.x - 60, NOTCH.y - 50, 120, 120);
      const wash = g.createRadialGradient(NOTCH.x, NOTCH.y, 0, NOTCH.x, NOTCH.y, 260 + 160 * e);
      wash.addColorStop(0, `rgba(255,140,50,${.32 * e})`);
      wash.addColorStop(1, 'rgba(255,110,30,0)');
      g.fillStyle = wash;
      g.fillRect(0, 0, SCENE_W, SCENE_H);
      g.restore();
    }

    // The flame catches in the tinder nest.
    if (fire > 0 && pics.flame) {
      const grow = 1 - Math.pow(1 - fire, 3);
      const fl = calm ? 1 : 1 + .06 * Math.sin(t * 11) + .04 * Math.sin(t * 17.3);
      const h = FLAME_H * grow * fl, w = h * pics.flame.width / pics.flame.height * (calm ? 1 : 1 + .05 * Math.sin(t * 9.1 + 2));
      g.save();
      g.globalCompositeOperation = 'lighter';
      const light = g.createRadialGradient(NEST.x, NEST.y - h * .3, 0, NEST.x, NEST.y - h * .3, 640);
      light.addColorStop(0, `rgba(255,170,70,${.5 * grow})`);
      light.addColorStop(.4, `rgba(255,120,40,${.22 * grow})`);
      light.addColorStop(1, 'rgba(255,90,20,0)');
      g.fillStyle = light;
      g.fillRect(0, 0, SCENE_W, SCENE_H);
      g.restore();
      g.drawImage(pics.flame, NEST.x - w / 2, NEST.y - h, w, h);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = .25 * flick;
      g.drawImage(pics.flame, NEST.x - w * .55, NEST.y - h * 1.04, w * 1.1, h * 1.04);
      g.restore();
    }

    // Particles: smoke (soft, behind nothing), dust (slip) and sparks (hits, the flame).
    for (const p of parts) {
      const k = p.life / p.max;
      if (p.kind === 'smoke') {
        const a = (k < .2 ? k / .2 : 1 - (k - .2) / .8) * .22;
        const sm = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        sm.addColorStop(0, `rgba(196,176,160,${a})`);
        sm.addColorStop(1, 'rgba(196,176,160,0)');
        g.fillStyle = sm;
        g.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      } else if (p.kind === 'dust') {
        g.fillStyle = `rgba(150,120,90,${(1 - k) * .7})`;
        g.beginPath(); g.arc(p.x, p.y, p.size * (0.6 + k), 0, Math.PI * 2); g.fill();
      } else {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(255,${200 - k * 110},${90 - k * 60},${1 - k})`;
        g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        g.fillStyle = `rgba(255,150,50,${(1 - k) * .25})`;
        g.fillRect(Math.round(p.x) - p.size, Math.round(p.y) - p.size, p.size * 3, p.size * 3);
        g.restore();
      }
    }

    // A slip: the edges flush cold and red for a moment.
    if (slipFlash > 0) {
      const v = g.createRadialGradient(SCENE_W / 2, SCENE_H / 2, 260, SCENE_W / 2, SCENE_H / 2, 760);
      v.addColorStop(0, 'rgba(120,20,10,0)');
      v.addColorStop(1, `rgba(120,20,10,${.45 * slipFlash})`);
      g.fillStyle = v;
      g.fillRect(0, 0, SCENE_W, SCENE_H);
    }
  };

  return {
    update,
    hit: () => burst('hit'),
    slip: () => burst('slip'),
    end(r: PressResult) {
      ended = r;
      if (r !== 'ember') return;
      flameT = 0; flash = 1;
      // The drilling smoke clears as the flame takes over (no grey haze over the fire).
      for (const p of parts) if (p.kind === 'smoke') p.max = Math.min(p.max, p.life + .25);
    },
    dispose() { ro?.disconnect(); },
  };
}

// ------------------------------------------------------------------------------------------------ attempt

/**
 * Runs one attempt until ember (success), failed (3 slips) or spark (the third failed attempt). The panel is
 * removed when the attempt ends. Never resolves if the player leaves the scene meanwhile.
 */
export function fireAttempt(s: FireState, c: FireConfig, hooks: FireHooks = {}): Promise<PressResult> {
  ensureStyles();
  const token = (G.ui as unknown as { token(): number }).token();
  const alive = () => (G.ui as unknown as { alive(t: number): boolean }).alive(token);
  const root = G.ui.panel('k2-feuer');
  const touch = touchUi();
  const hint = touch
    ? '<b>Tippen</b><span class="k2-hint-long">, wenn die Nadel im <b>Glutfeld</b> ist</span><span class="k2-hint-short"> im <b>Glutfeld</b></span>'
    : '<span class="ch-key">E</span> / <span class="ch-key">Leertaste</span><span class="k2-hint-long">, wenn die Nadel im <b>Glutfeld</b> ist</span><span class="k2-hint-short"> im <b>Glutfeld</b></span>';
  root.innerHTML = `
    <div class="k2-feuer-box ch-panel">
      <div class="k2-stage">
        <div class="ch-title">Feuerbohren</div>
        <div class="k2-msg" aria-live="polite">${s.failed === 0 ? 'Drehen, drehen … im richtigen Moment fest aufdrücken.' : 'Noch einmal. Ruhig bleiben.'}</div>
      </div>
      <div class="k2-foot">
        <div class="k2-track" role="presentation"><div class="k2-rail"><div class="k2-zone"></div><div class="k2-needle"></div></div></div>
        <div class="k2-gauge"><span class="ch-label">Glut</span><div class="k2-heat" role="meter" aria-label="Glut" aria-valuemin="0" aria-valuemax="100"><div class="k2-heat-fill"></div></div></div>
        <div class="k2-hint">${hint}</div>
        <div class="k2-slips ch-label" aria-label="Ausrutscher"><span class="k2-slips-label">Ausrutscher</span> <i></i><i></i><i></i></div>
      </div>
    </div>`;
  const zone = root.querySelector<HTMLElement>('.k2-zone')!;
  const needle = root.querySelector<HTMLElement>('.k2-needle')!;
  const fill = root.querySelector<HTMLElement>('.k2-heat-fill')!;
  const meter = root.querySelector<HTMLElement>('.k2-heat')!;
  const msg = root.querySelector<HTMLElement>('.k2-msg')!;
  const slips = [...root.querySelectorAll<HTMLElement>('.k2-slips > i')];
  const pic = createFireArt(root.querySelector<HTMLElement>('.k2-stage')!, root);
  window.__k2fire = { state: s, config: c, inZone: () => inZone(s, c) };

  const onHit = hooks.onHit ?? ((heat: number) => sfx('drill', { volume: .8, pitch: .9 + heat / 300 }));
  const onSlip = hooks.onSlip ?? (() => sfx('thud', { volume: .5 }));

  return new Promise<PressResult>(resolve => {
    let last = performance.now();
    let done = false;
    let flashT = 0;
    let lastPress = 0;

    const render = () => {
      const w = zoneWidth(s, c);
      zone.style.left = `${(s.zoneAt - w / 2) * 100}%`;
      zone.style.width = `${w * 100}%`;
      needle.style.left = `${s.pos * 100}%`;
      fill.style.width = `${s.heat}%`;
      meter.setAttribute('aria-valuenow', String(Math.round(s.heat)));
      root.classList.toggle('is-in', !done && inZone(s, c));
      slips.forEach((el, i) => el.classList.toggle('is-used', i < s.slips));
    };

    const finish = (r: PressResult) => {
      done = true;
      window.removeEventListener('keydown', onKey, true);
      root.removeEventListener('pointerdown', onPointer);
      msg.textContent = r === 'ember' ? 'Glut! Es fängt Feuer!' : r === 'spark' ? '…' : 'Nur Qualm. Die Glut ist wieder aus.';
      pic.end(r);
      if (r === 'ember') {
        root.classList.add('is-ember');
        if (!hooks.onHit) sfx('fire-ignite', { volume: .8 });
      }
      render();
      setTimeout(() => {
        root.remove();
        pic.dispose();
        if (window.__k2fire?.state === s) delete window.__k2fire;
        if (alive()) resolve(r);
      }, r === 'ember' ? 1100 : 900);
    };

    const doPress = () => {
      if (done || G.ui.busy()) return;
      const now = performance.now();
      if (now - lastPress < 120) return; // debounce double input (click + key)
      lastPress = now;
      const r = press(s, c, Math.random());
      root.classList.remove('is-hit', 'is-slip');
      void root.offsetWidth;
      if (r === 'hit' || r === 'ember') {
        root.classList.add('is-hit');
        msg.textContent = HIT_LINES[Math.min(HIT_LINES.length - 1, s.hits - 1)];
        pic.hit();
        onHit(s.heat);
      } else {
        root.classList.add('is-slip');
        msg.textContent = SLIP_LINES[Math.min(SLIP_LINES.length - 1, s.slips - 1)];
        pic.slip();
        onSlip();
      }
      flashT = 0.18;
      render();
      if (r !== 'hit' && r !== 'slip') finish(r);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !isConfirmKey(e) || G.ui.busy()) return;
      e.preventDefault();
      e.stopPropagation();
      doPress();
    };
    const onPointer = (e: PointerEvent) => { e.preventDefault(); doPress(); };
    window.addEventListener('keydown', onKey, true);
    root.addEventListener('pointerdown', onPointer);

    const frame = (now: number) => {
      if (!alive() || !root.isConnected) {
        if (!done) { done = true; window.removeEventListener('keydown', onKey, true); }
        pic.dispose();
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!done && !G.ui.busy() && !document.hidden) {
        tick(s, c, dt);
        if (consumeAction()) doPress();
      }
      if (flashT > 0 && (flashT -= dt) <= 0) root.classList.remove('is-hit', 'is-slip');
      if (!done) render();
      pic.update(s, document.hidden ? 0 : dt);
      requestAnimationFrame(frame);
    };
    render();
    requestAnimationFrame(frame);
  });
}

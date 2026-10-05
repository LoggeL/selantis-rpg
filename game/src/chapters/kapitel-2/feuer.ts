// Fire-drilling minigame overlay (erstes-lager): a DOM strip in the Chronik style over the world. Lia kneels at the
// stone ring in the world; this panel only shows the timing track, the ember gauge and the slips.
// Rules: feuerLogic.ts. Input: E / Space / Enter, mouse click or tap anywhere.
import { G } from '../../core/G';
import { consumeAction } from '../../core/input';
import { type FireConfig, type FireState, inZone, press, type PressResult, tick, zoneWidth } from './feuerLogic';
import { isConfirmKey, touchUi } from './shared';

let styled = false;
function ensureStyles(): void {
  if (styled) return;
  styled = true;
  const css = `
.k2-feuer { display: flex; align-items: flex-end; justify-content: center; padding-bottom: 7%; cursor: pointer; }
.k2-feuer-box { width: min(34em, 86%); padding: 0.9em 1.3em 1em; text-align: center; animation: k2-rise .28s ease-out; }
.k2-feuer-box .ch-title { font-size: 1.15em; margin-bottom: 0.55em; }
.k2-track { position: relative; height: 1.7em; border-radius: 0.85em; background: linear-gradient(#0b0f17, #1b2231);
  border: 1px solid var(--gold-line); overflow: hidden; box-shadow: inset 0 0.15em 0.4em rgba(0,0,0,.6); }
.k2-zone { position: absolute; top: 0; bottom: 0; border-radius: 0.6em;
  background: linear-gradient(90deg, rgba(255,170,70,.15), rgba(255,200,110,.75), rgba(255,170,70,.15));
  box-shadow: 0 0 0.8em rgba(255,180,80,.6); transition: left .18s ease-out, width .18s ease-out; }
.k2-needle { position: absolute; top: -0.15em; bottom: -0.15em; width: 0.32em; margin-left: -0.16em; border-radius: 0.2em;
  background: var(--parch, #efe3c8); box-shadow: 0 0 0.4em rgba(255,240,210,.9); }
.k2-feuer.is-hit .k2-needle { background: #ffd27a; box-shadow: 0 0 0.9em #ffb050; }
.k2-feuer.is-slip .k2-track { animation: k2-shake .25s; border-color: var(--danger, #d4573b); }
.k2-heat { position: relative; margin-top: 0.6em; height: 0.75em; border-radius: 0.4em; background: #0d121b; border: 1px solid var(--gold-faint); overflow: hidden; }
.k2-heat-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(90deg, #6b2a10, #d2601c, #ffc35a); transition: width .12s linear; }
.k2-row { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5em; font-size: 0.9em; }
.k2-slips span { display: inline-block; width: 0.7em; height: 0.7em; margin-left: 0.3em; border-radius: 50%; border: 1px solid var(--gold-line); }
.k2-slips span.is-used { background: var(--danger, #d4573b); border-color: var(--danger, #d4573b); }
.k2-msg { min-height: 1.3em; margin-top: 0.35em; font-family: var(--f-body); font-style: italic; color: var(--parch, #efe3c8); }
@keyframes k2-shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-0.3em) } 75% { transform: translateX(0.3em) } }
@keyframes k2-rise { from { transform: translateY(1em); opacity: 0 } to { transform: none; opacity: 1 } }
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

/**
 * Runs one attempt until ember (success), failed (3 slips) or spark (the third failed attempt). The panel is
 * removed when the attempt ends. Never resolves if the player leaves the scene meanwhile.
 */
export function fireAttempt(s: FireState, c: FireConfig, hooks: FireHooks = {}): Promise<PressResult> {
  ensureStyles();
  const token = (G.ui as unknown as { token(): number }).token();
  const alive = () => (G.ui as unknown as { alive(t: number): boolean }).alive(token);
  const root = G.ui.panel('k2-feuer');
  const key = touchUi() ? 'Tippen' : 'E';
  root.innerHTML = `
    <div class="k2-feuer-box ch-panel">
      <div class="ch-title">Feuerbohren</div>
      <div class="k2-track"><div class="k2-zone"></div><div class="k2-needle"></div></div>
      <div class="k2-heat"><div class="k2-heat-fill"></div></div>
      <div class="k2-row"><span class="ch-label"><span class="ch-key">${key}</span> im hellen Feld</span>
        <span class="k2-slips ch-label">Ausrutscher <span></span><span></span><span></span></span></div>
      <div class="k2-msg">${s.failed === 0 ? 'Drehen, drehen … im richtigen Moment fest aufdrücken.' : 'Noch einmal. Ruhig bleiben.'}</div>
    </div>`;
  const zone = root.querySelector<HTMLElement>('.k2-zone')!;
  const needle = root.querySelector<HTMLElement>('.k2-needle')!;
  const fill = root.querySelector<HTMLElement>('.k2-heat-fill')!;
  const msg = root.querySelector<HTMLElement>('.k2-msg')!;
  const slips = [...root.querySelectorAll<HTMLElement>('.k2-slips > span')];
  window.__k2fire = { state: s, config: c, inZone: () => inZone(s, c) };

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
      slips.forEach((el, i) => el.classList.toggle('is-used', i < s.slips));
    };

    const finish = (r: PressResult) => {
      done = true;
      window.removeEventListener('keydown', onKey, true);
      root.removeEventListener('pointerdown', onPointer);
      msg.textContent = r === 'ember' ? 'Glut!' : r === 'spark' ? '…' : 'Nur Qualm. Die Glut ist wieder aus.';
      render();
      setTimeout(() => {
        root.remove();
        if (window.__k2fire?.state === s) delete window.__k2fire;
        if (alive()) resolve(r);
      }, r === 'ember' ? 650 : 900);
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
        hooks.onHit?.(s.heat);
      } else {
        root.classList.add('is-slip');
        msg.textContent = SLIP_LINES[Math.min(SLIP_LINES.length - 1, s.slips - 1)];
        hooks.onSlip?.();
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
      if (done) return;
      if (!alive() || !root.isConnected) { done = true; window.removeEventListener('keydown', onKey, true); return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!G.ui.busy() && !document.hidden) {
        tick(s, c, dt);
        if (consumeAction()) doPress();
      }
      if (flashT > 0 && (flashT -= dt) <= 0) root.classList.remove('is-hit', 'is-slip');
      render();
      requestAnimationFrame(frame);
    };
    render();
    requestAnimationFrame(frame);
  });
}

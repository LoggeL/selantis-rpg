// The Crios moment (foltan-azar): Lia lies on her cloak and looks up through the leaves. A code-drawn night sky
// (book plate style, ui/plateKit) where the player picks the brightest star in the west. Clues: brightest + west.
import { G } from '../../core/G';
import { GOLD, nightSky, rng } from '../../ui/plateKit';
import { esc, isConfirmKey, sfx, touchUi } from './shared';

const W = 1600, H = 900;

export interface Star { id: string; x: number; y: number; r: number; ring?: number; color: string; line: string; correct?: boolean; memory?: string; cluster?: [number, number][] }

/** Candidate stars (canvas px). West is on the LEFT (Lia lies with her head to the east). */
export const STARS: Star[] = [
  { id: 'crios', x: 430, y: 360, r: 9, color: '#eaf4ff', line: 'Da. Der hellste von allen, ganz im Westen. Crios.', correct: true },
  { id: 'rot', x: 300, y: 600, r: 5, color: '#ffb59a', line: 'Im Westen, ja. Aber rötlich und matt. Das ist nicht Crios.' },
  { id: 'osten', x: 1250, y: 330, r: 8, color: '#fff6e0', line: 'Hell, aber im Osten. Crios steht immer im Westen.' },
  { id: 'wagen', x: 860, y: 250, r: 5, color: '#f4f0ff', line: 'Der Wagen. Vater hat ihn uns vom Scheunendach aus gezeigt.', memory: 'k2-mem-sterne',
    cluster: [[780, 270], [820, 250], [860, 250], [905, 268], [930, 310], [985, 300], [990, 255]] },
  { id: 'huehner', x: 1010, y: 560, r: 4, color: '#dfe8ff', line: 'Das Siebengestirn. Kyra hat es immer „die Hühner“ genannt.',
    cluster: [[990, 548], [1006, 556], [1022, 546], [1012, 570], [1030, 566], [996, 572], [1018, 584]] },
];

// Clusters: centre the star on the cluster's centroid (selection ring, hit testing, keyboard order).
for (const s of STARS) {
  if (!s.cluster) continue;
  s.x = Math.round(s.cluster.reduce((a, p) => a + p[0], 0) / s.cluster.length);
  s.y = Math.round(s.cluster.reduce((a, p) => a + p[1], 0) / s.cluster.length);
  s.ring = Math.max(...s.cluster.map(([x, y]) => Math.hypot(x - s.x, y - s.y))) + 26;
}

/** The eagle constellation around Crios (drawn when found). */
const EAGLE: [number, number][][] = [
  [[300, 300], [370, 330], [430, 360], [500, 330], [575, 290]],
  [[430, 360], [440, 440], [455, 520]],
  [[430, 360], [415, 300], [425, 255]],
  [[455, 520], [420, 560], [455, 520], [495, 560]],
];

let layers: { base: HTMLCanvasElement; canopy: HTMLCanvasElement } | null = null;

/** Static layers, drawn once: the sky with its milky band, and the leafy canopy frame. */
function staticLayers(): { base: HTMLCanvasElement; canopy: HTMLCanvasElement } {
  if (layers) return layers;
  const { canvas: base, g } = nightSky(W, H, 21);
  const band = g.createLinearGradient(0, H, W, 0);
  band.addColorStop(0.3, 'rgba(120,130,190,0)');
  band.addColorStop(0.5, 'rgba(150,160,220,0.10)');
  band.addColorStop(0.7, 'rgba(120,130,190,0)');
  g.fillStyle = band;
  g.fillRect(0, 0, W, H);
  const canopy = document.createElement('canvas');
  canopy.width = W; canopy.height = H;
  const c = canopy.getContext('2d')!;
  const r = rng(5);
  c.fillStyle = '#05080a';
  for (let i = 0; i < 420; i++) {
    const a = r() * Math.PI * 2;
    const edge = 0.8 + r() * 0.5;
    const x = W / 2 + Math.cos(a) * W * 0.5 * edge, y = H / 2 + Math.sin(a) * H * 0.55 * edge;
    const rad = 30 + r() * 90;
    c.beginPath(); c.ellipse(x, y, rad, rad * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = 'rgba(20,40,30,0.85)';
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2;
    const x = W / 2 + Math.cos(a) * W * 0.47, y = H / 2 + Math.sin(a) * H * 0.5;
    c.beginPath(); c.ellipse(x, y, 10 + r() * 22, 6 + r() * 10, r() * 3, 0, Math.PI * 2); c.fill();
  }
  layers = { base, canopy };
  return layers;
}

function drawSky(g: CanvasRenderingContext2D, found: boolean, eagleT: number, sel: string | null, t: number): void {
  const { base, canopy } = staticLayers();
  g.drawImage(base, 0, 0);
  for (const s of STARS) {
    const tw = 0.85 + 0.15 * Math.sin(t * 2.2 + s.x);
    const pts = s.cluster ?? [[s.x, s.y]];
    for (const [x, y] of pts) {
      const rad = (s.cluster ? 3.2 : s.r) * tw;
      const glow = g.createRadialGradient(x, y, 0, x, y, rad * 6);
      glow.addColorStop(0, s.color);
      glow.addColorStop(0.25, s.color + '88');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(x, y, rad * 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(x, y, rad * 0.55, 0, Math.PI * 2); g.fill();
    }
    if (s.id === 'crios') {
      g.strokeStyle = `rgba(235,245,255,${0.55 * tw})`;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(s.x - 34 * tw, s.y); g.lineTo(s.x + 34 * tw, s.y);
      g.moveTo(s.x, s.y - 34 * tw); g.lineTo(s.x, s.y + 34 * tw);
      g.stroke();
    }
  }
  if (sel) {
    const s = STARS.find(x => x.id === sel);
    if (s) {
      g.strokeStyle = 'rgba(243,214,138,0.9)';
      g.lineWidth = 3;
      g.setLineDash([10, 8]);
      g.beginPath(); g.arc(s.x, s.y, s.ring ?? 34, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
    }
  }
  if (found) {
    g.strokeStyle = GOLD;
    g.lineWidth = 2.5;
    g.globalAlpha = Math.min(1, eagleT);
    let budget = eagleT * 14;
    for (const seg of EAGLE) {
      g.beginPath();
      g.moveTo(seg[0][0], seg[0][1]);
      for (let i = 1; i < seg.length && budget > 0; i++, budget--) {
        const k = Math.min(1, budget);
        const [x0, y0] = seg[i - 1], [x1, y1] = seg[i];
        g.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
      }
      g.stroke();
      for (const [x, y] of seg) { g.fillStyle = '#f3e6c0'; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  g.drawImage(canopy, 0, 0);
}

let styled = false;
function ensureStyles(): void {
  if (styled) return;
  styled = true;
  const tag = document.createElement('style');
  tag.dataset.k2 = 'sterne';
  tag.textContent = `
.k2-sky { display: flex; align-items: center; justify-content: center; background: rgba(2,4,10,.92); animation: k2-fade .6s ease-out; }
.k2-sky-frame { position: relative; width: min(100%, calc(100vh * 16 / 9)); aspect-ratio: 16 / 9; max-height: 100%; }
.k2-sky canvas { width: 100%; height: 100%; display: block; cursor: pointer; border-radius: 0.4em; box-shadow: 0 0 2em rgba(0,0,0,.8); }
.k2-sky-dir { position: absolute; top: 50%; transform: translateY(-50%); padding: 0.2em 0.6em; font-size: 0.9em; }
.k2-sky-dir.w { left: 2.5%; } .k2-sky-dir.o { right: 2.5%; }
.k2-sky-text { position: absolute; left: 50%; bottom: 5%; transform: translateX(-50%); width: min(30em, 80%); padding: 0.6em 1em; text-align: center;
  font-family: var(--f-body); font-style: italic; }
.k2-sky-help { position: absolute; left: 50%; top: 4%; transform: translateX(-50%); font-size: 0.85em; color: var(--gold-hi); text-shadow: 0 1px 2px #000; white-space: nowrap; }
@keyframes k2-fade { from { opacity: 0 } to { opacity: 1 } }
`;
  document.head.appendChild(tag);
}

declare global { interface Window { __k2sky?: { stars: Star[]; select(id: string): void } } }

/** Shows the sky; resolves once the player found Crios and confirmed. Never resolves after leaving the scene. */
export function findCrios(): Promise<void> {
  ensureStyles();
  const token = (G.ui as unknown as { token(): number }).token();
  const alive = () => (G.ui as unknown as { alive(t: number): boolean }).alive(token);
  const root = G.ui.panel('k2-sky');
  const help = touchUi() ? 'Tippe auf einen Stern.' : 'Wähle einen Stern mit der Maus oder ← →, bestätige mit E.';
  root.innerHTML = `
    <div class="k2-sky-frame">
      <canvas width="${W}" height="${H}"></canvas>
      <div class="k2-sky-dir w ch-label ch-panel">Westen</div>
      <div class="k2-sky-dir o ch-label ch-panel">Osten</div>
      <div class="k2-sky-help ch-label">${esc(help)}</div>
      <div class="k2-sky-text ch-parch">Crios. Der hellste Stern am Himmel, und er steht immer im Westen. Wo bist du?</div>
    </div>`;
  const canvas = root.querySelector('canvas')!;
  const g = canvas.getContext('2d')!;
  const text = root.querySelector<HTMLElement>('.k2-sky-text')!;
  const helpEl = root.querySelector<HTMLElement>('.k2-sky-help')!;
  let sel: string | null = null;
  let found = false;
  let eagleT = 0;
  let t0 = performance.now();
  let lastFrame = t0;
  let done = false;

  return new Promise<void>(resolve => {
    const pick = (id: string) => {
      if (done) return;
      if (found) { finish(); return; }
      const s = STARS.find(x => x.id === id);
      if (!s) return;
      sel = id;
      text.innerHTML = esc(s.line);
      if (s.memory) G.state.addMemory(s.memory);
      if (s.correct) {
        found = true;
        sfx('discover');
        helpEl.textContent = touchUi() ? 'Tippen zum Weitermachen' : 'E / Klick zum Weitermachen';
        t0 = performance.now();
      } else sfx('ui-move');
    };
    window.__k2sky = { stars: STARS, select: pick };
    const finish = () => {
      done = true;
      window.removeEventListener('keydown', onKey, true);
      root.style.transition = 'opacity .5s';
      root.style.opacity = '0';
      setTimeout(() => { root.remove(); delete window.__k2sky; if (alive()) resolve(); }, 520);
    };
    const hit = (cx: number, cy: number): Star | undefined => {
      const rect = canvas.getBoundingClientRect();
      const x = ((cx - rect.left) / rect.width) * W, y = ((cy - rect.top) / rect.height) * H;
      let best: Star | undefined, bd = Infinity;
      for (const s of STARS) {
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < Math.max(80, (s.ring ?? 0) + 20) && d < bd) { bd = d; best = s; }
      }
      return best;
    };
    canvas.addEventListener('pointermove', e => { if (!found) sel = hit(e.clientX, e.clientY)?.id ?? sel; });
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (found) { if (performance.now() - t0 > 900) finish(); return; }
      const s = hit(e.clientX, e.clientY);
      if (s) pick(s.id);
    });
    const order = [...STARS].sort((a, b) => a.x - b.x).map(s => s.id);
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || G.ui.busy()) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd') {
        if (found) return;
        e.preventDefault(); e.stopPropagation();
        const i = sel ? order.indexOf(sel) : -1;
        const step = e.key === 'ArrowLeft' || e.key === 'a' ? -1 : 1;
        sel = order[(i + step + order.length) % order.length];
        sfx('ui-move', { volume: 0.5 });
      } else if (isConfirmKey(e)) {
        e.preventDefault(); e.stopPropagation();
        if (found) { if (performance.now() - t0 > 900) finish(); }
        else if (sel) pick(sel);
      }
    };
    window.addEventListener('keydown', onKey, true);

    const frame = (now: number) => {
      if (done || !root.isConnected) return;
      if (!alive()) { window.removeEventListener('keydown', onKey, true); return; }
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;
      if (found) eagleT = Math.min(1.2, eagleT + dt * 0.7);
      drawSky(g, found, eagleT, sel, now / 1000);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

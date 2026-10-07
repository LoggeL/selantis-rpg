// The Crios moment (foltan-azar): Lia lies on her cloak and looks up through the oak crowns. A painted sky
// (Codex: sky + leaf canopy as separate layers, minigames/sterne-*) with code-drawn stars, light and fireflies.
// The player picks the brightest star in the west. Clues: brightest + west.
// World coordinates are 1600×900 with west on the LEFT; in portrait windows the whole sky is turned a quarter
// (west at the top), which suits the worm's-eye view and keeps the stars clear of the leaves.
import { G } from '../../core/G';
import { loadImage } from '../../art/assets';
import { manifest } from '../../art/manifest';
import { settings } from '../../core/settings';
import { nightSky, rng } from '../../ui/plateKit';
import { esc, isConfirmKey, sfx, touchUi } from './shared';

const W = 1600, H = 900;

export interface Star {
  id: string; x: number; y: number; r: number; ring?: number; color: string; line: string; correct?: boolean; memory?: string;
  cluster?: [number, number][]; mood?: string;
}

/** Candidate stars (canvas px). West is on the LEFT (Lia lies with her head to the east). */
export const STARS: Star[] = [
  { id: 'crios', x: 430, y: 360, r: 9, color: '#eaf4ff', line: 'Da. Der hellste von allen, ganz im Westen. Crios.', correct: true, mood: 'happy' },
  { id: 'rot', x: 300, y: 600, r: 5, color: '#ffb59a', line: 'Im Westen, ja. Aber rötlich und matt. Das ist nicht Crios.', mood: 'thinking' },
  { id: 'osten', x: 1250, y: 330, r: 8, color: '#fff6e0', line: 'Hell, aber im Osten. Crios steht immer im Westen.', mood: 'thinking' },
  { id: 'wagen', x: 860, y: 250, r: 5, color: '#f4f0ff', line: 'Der Wagen. Vater hat ihn uns vom Scheunendach aus gezeigt.', memory: 'k2-mem-sterne', mood: 'sad',
    cluster: [[780, 270], [820, 250], [860, 250], [905, 268], [930, 310], [985, 300], [990, 255]] },
  { id: 'huehner', x: 1010, y: 560, r: 4, color: '#dfe8ff', line: 'Das Siebengestirn. Kyra hat es immer „die Hühner“ genannt.', mood: 'sad',
    cluster: [[990, 548], [1006, 556], [1022, 546], [1012, 570], [1030, 566], [996, 572], [1018, 584]] },
];

// Clusters: centre the star on the cluster's centroid (selection ring, hit testing, keyboard order).
for (const s of STARS) {
  if (!s.cluster) continue;
  s.x = Math.round(s.cluster.reduce((a, p) => a + p[0], 0) / s.cluster.length);
  s.y = Math.round(s.cluster.reduce((a, p) => a + p[1], 0) / s.cluster.length);
  s.ring = Math.max(...s.cluster.map(([x, y]) => Math.hypot(x - s.x, y - s.y))) + 26;
}

/** The eagle around Crios: the painted light figure (600×600 JPG on black) and its constellation lines. */
const EAGLE_IMG = { x: 210, y: 185, size: 440 };
const P = {
  wingL: [224, 199], elbowL: [326, 300], lowL: [263, 402], crios: [430, 360], elbowR: [526, 300], wingR: [638, 199],
  lowR: [596, 402], head: [452, 265], tailRoot: [430, 476], tailL: [378, 535], tailTip: [430, 543], tailR: [482, 535],
} satisfies Record<string, [number, number]>;
const EAGLE: [number, number][][] = [
  [P.wingL, P.elbowL, P.crios, P.elbowR, P.wingR],
  [P.crios, P.head],
  [P.crios, P.tailRoot, P.tailTip],
  [P.lowL, P.elbowL], [P.elbowR, P.lowR],
  [P.tailL, P.tailRoot, P.tailR],
];
const EAGLE_STARS = [...new Set(EAGLE.flat())].filter(p => p !== P.crios);

interface Pics { sky?: HTMLImageElement; canopy?: HTMLImageElement; eagle?: HTMLImageElement }
let pics: Pics | null = null;
let picsLoading: Promise<Pics> | null = null;
function loadPics(): Promise<Pics> {
  if (pics) return Promise.resolve(pics);
  if (picsLoading) return picsLoading;
  const art = manifest();
  const file = (key: string, ext: string) => art.images?.[`minigames/${key}`]?.file ?? `assets/minigames/${key}.${ext}`;
  const p: Pics = {};
  picsLoading = Promise.all([
    loadImage(file('sterne-sky', 'jpg')).then(i => { if (i) p.sky = i; }),
    loadImage(file('sterne-canopy', 'webp')).then(i => { if (i) p.canopy = i; }),
    loadImage(file('sterne-eagle', 'jpg')).then(i => { if (i) p.eagle = i; }),
  ]).then(() => { pics = p; return p; });
  return picsLoading;
}

/** Soft round glow sprites, one per colour (drawn scaled; much cheaper than a gradient per star per frame). */
const glowCache = new Map<string, HTMLCanvasElement>();
function glow(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, color);
  gr.addColorStop(0.12, color + 'cc');
  gr.addColorStop(0.35, color + '40');
  gr.addColorStop(1, color + '00');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  glowCache.set(color, c);
  return c;
}

let fallbackSky: HTMLCanvasElement | null = null;
function skyFallback(): HTMLCanvasElement {
  if (fallbackSky) return fallbackSky;
  const { canvas } = nightSky(W, H, 21);
  fallbackSky = canvas;
  return canvas;
}

/** Faint star dust and fireflies (fixed seeds: the same sky every time). */
const r0 = rng(11);
const DUST = Array.from({ length: 150 }, () => {
  const a = r0() * Math.PI * 2, d = Math.sqrt(r0());
  return { x: 800 + Math.cos(a) * 690 * d, y: 440 + Math.sin(a) * 360 * d, s: 0.8 + r0() * 1.6, p: r0() * 6.3, v: 0.6 + r0() * 1.8, a: 0.25 + r0() * 0.5 };
});
const FLIES = Array.from({ length: 14 }, () => {
  const a = r0() * Math.PI * 2, d = 0.92 + r0() * 0.2;
  return { x: 800 + Math.cos(a) * 760 * d, y: 450 + Math.sin(a) * 430 * d, p: r0() * 6.3, v: 0.4 + r0() * 0.6 };
});

interface Fx { seen: Set<string>; sel: string | null; picked: string | null; pickT: number; found: boolean; foundT: number; eagleT: number; px: number; py: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number }
let shooting: { x: number; y: number; vx: number; vy: number; t: number } | null = null;
let nextShoot = 4;

function drawStar(g: CanvasRenderingContext2D, x: number, y: number, rad: number, color: string, spikes: number): void {
  const sp = glow(color);
  const R = rad * 7;
  g.drawImage(sp, x - R, y - R, R * 2, R * 2);
  if (spikes > 0) {
    g.globalAlpha = 0.55;
    const L = rad * spikes;
    const grad = (x0: number, y0: number, x1: number, y1: number) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, color + '00'); gr.addColorStop(0.5, color); gr.addColorStop(1, color + '00');
      return gr;
    };
    g.fillStyle = grad(x - L, y, x + L, y); g.fillRect(x - L, y - 1, L * 2, 2);
    g.fillStyle = grad(x, y - L, x, y + L); g.fillRect(x - 1, y - L, 2, L * 2);
    g.globalAlpha = 1;
  }
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(x, y, Math.max(1.2, rad * 0.5), 0, Math.PI * 2); g.fill();
}

function drawSky(g: CanvasRenderingContext2D, f: Fx, t: number, still: boolean, sparks: Spark[]): void {
  const p = pics ?? {};
  g.drawImage(p.sky ?? skyFallback(), 0, 0, W, H);

  // Star dust.
  g.fillStyle = '#dfe6ff';
  for (const d of DUST) {
    g.globalAlpha = still ? d.a * 0.8 : d.a * (0.55 + 0.45 * Math.sin(t * d.v + d.p));
    g.fillRect(d.x, d.y, d.s, d.s);
  }
  g.globalAlpha = 1;

  // A shooting star now and then.
  if (shooting) {
    const s = shooting, k = s.t / 0.9;
    const hx = s.x + s.vx * s.t, hy = s.y + s.vy * s.t;
    const gr = g.createLinearGradient(hx, hy, hx - s.vx * 0.22, hy - s.vy * 0.22);
    gr.addColorStop(0, `rgba(255,250,235,${0.9 * (1 - k)})`); gr.addColorStop(1, 'rgba(255,250,235,0)');
    g.strokeStyle = gr; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - s.vx * 0.22, hy - s.vy * 0.22); g.stroke();
  }

  // The eagle: its faint stars are always there; the painted figure and the lines appear once Crios is found.
  const e = Math.min(1, f.eagleT);
  if (f.found && p.eagle) {
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = (0.42 + (still ? 0 : 0.08 * Math.sin(t * 1.3))) * e * e;
    g.drawImage(p.eagle, EAGLE_IMG.x, EAGLE_IMG.y, EAGLE_IMG.size, EAGLE_IMG.size);
    g.restore();
  }
  if (f.found) {
    g.save();
    g.strokeStyle = 'rgba(243,214,138,0.85)';
    g.shadowColor = 'rgba(243,214,138,0.8)';
    g.shadowBlur = 8;
    g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
    let budget = f.eagleT * 16;
    for (const seg of EAGLE) {
      g.beginPath();
      g.moveTo(seg[0][0], seg[0][1]);
      for (let i = 1; i < seg.length && budget > 0; i++, budget--) {
        const k = Math.min(1, budget);
        const [x0, y0] = seg[i - 1], [x1, y1] = seg[i];
        g.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
      }
      g.stroke();
    }
    g.restore();
  }
  for (const [x, y] of EAGLE_STARS) drawStar(g, x, y, f.found ? 2.6 + e : 1.7, f.found ? '#f6e6b8' : '#cfd8f0', 0);

  // Constellations the player recognised: thin silver lines (the Wagen) or a soft haze (the Hühner).
  for (const s of STARS) {
    if (!s.cluster || !f.seen.has(s.id)) continue;
    const k = f.picked === s.id ? Math.min(1, (t - f.pickT) * 1.5) : 0.45;
    g.save();
    g.globalAlpha = 0.55 * k;
    g.strokeStyle = '#dfe6ff'; g.lineWidth = 1.5; g.setLineDash([4, 6]);
    if (s.id === 'wagen') {
      g.beginPath();
      s.cluster.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.lineTo(s.cluster[3][0], s.cluster[3][1]);
      g.stroke();
    } else {
      // The Hühner: a faint blue reflection haze, as the Siebengestirn really shows on a clear night.
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5 * k;
      g.drawImage(glow('#6f88e0'), s.x - 150, s.y - 125, 300, 250);
      g.globalAlpha = 0.35 * k;
      g.drawImage(glow('#a9bcff'), s.x - 60, s.y - 50, 120, 100);
    }
    g.restore();
  }

  // Candidate stars.
  for (const s of STARS) {
    const tw = still ? 1 : 0.86 + 0.14 * Math.sin(t * 2.2 + s.x);
    if (s.cluster) for (const [x, y] of s.cluster) drawStar(g, x, y, 2.8 * tw, s.color, 0);
    else if (s.id === 'crios') {
      const boost = f.found ? 1.25 + (still ? 0 : 0.08 * Math.sin(t * 2)) : 1;
      drawStar(g, s.x, s.y, s.r * tw * boost, s.color, 6.5);
    } else drawStar(g, s.x, s.y, s.r * tw, s.color, s.id === 'osten' ? 4 : 0);
  }

  // Selection ring: gold, a slow turning compass tick; red-brown and shaking for a wrong pick.
  const sel = f.found ? 'crios' : f.sel;
  const s = sel ? STARS.find(x => x.id === sel) : undefined;
  if (s?.cluster && (s.ring ?? 0) > 80) {
    // A wide constellation (the Wagen): a small gold halo around each star (one big ring would cover half the sky).
    const pulse = still ? 1 : 1 + 0.08 * Math.sin(t * 4);
    g.save();
    for (const [x, y] of s.cluster) {
      const r = 12 * pulse;
      g.strokeStyle = 'rgba(243,214,138,0.22)'; g.lineWidth = 6;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(243,214,138,0.95)'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  } else if (s) {
    const miss = !f.found && f.picked === s.id && !s.correct && !s.cluster && t - f.pickT < 1.4;
    const mk = miss ? 1 - (t - f.pickT) / 1.4 : 0;
    const shake = miss && !still ? Math.sin(t * 46) * 6 * mk : 0;
    const base = (s.ring ?? 38) * (still ? 1 : 1 + 0.04 * Math.sin(t * 4));
    const col = miss ? '212,87,59' : '243,214,138';
    const cx = s.x + shake, cy = s.y;
    g.save();
    g.strokeStyle = `rgba(${col},0.22)`; g.lineWidth = 9;
    g.beginPath(); g.arc(cx, cy, base, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = `rgba(${col},0.95)`; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, base, 0, Math.PI * 2); g.stroke();
    g.fillStyle = `rgba(${col},0.95)`;
    const rot = still ? 0 : t * 0.5;
    for (let i = 0; i < 4; i++) {
      const a = rot + i * Math.PI / 2;
      const x = cx + Math.cos(a) * (base + 8), y = cy + Math.sin(a) * (base + 8);
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 4);
      g.fillRect(-4, -4, 8, 8);
      g.restore();
    }
    g.restore();
  }

  // Found: a light burst around Crios.
  if (f.found && !still) {
    const k = (t - f.foundT) / 1.4;
    if (k < 1) {
      const c = STARS[0];
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(243,230,190,${0.7 * (1 - k)})`; g.lineWidth = 3 * (1 - k) + 1;
      g.beginPath(); g.arc(c.x, c.y, 20 + 260 * k, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.9 * (1 - k);
      g.drawImage(glow('#fff4d6'), c.x - 160, c.y - 160, 320, 320);
      g.restore();
    }
  }
  for (const sp of sparks) {
    const a = sp.life / sp.max;
    g.globalAlpha = a;
    g.drawImage(glow('#f6e6b8'), sp.x - 8, sp.y - 8, 16, 16);
  }
  g.globalAlpha = 1;

  // The oak crowns in front of the sky, swaying a little (and leaning with the pointer).
  if (p.canopy) {
    const dx = (still ? 0 : Math.sin(t * 0.35) * 3) + f.px * 7;
    const dy = (still ? 0 : Math.cos(t * 0.27) * 2) + f.py * 5;
    g.drawImage(p.canopy, -24 + dx, -14 + dy, W + 48, H + 28);
  }

  // Fireflies along the leaves; firelight from the camp below.
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const fl of FLIES) {
    const x = fl.x + (still ? 0 : Math.sin(t * fl.v + fl.p) * 26);
    const y = fl.y + (still ? 0 : Math.cos(t * fl.v * 0.8 + fl.p) * 18);
    g.globalAlpha = still ? 0.5 : Math.max(0, Math.sin(t * fl.v * 2.1 + fl.p)) * 0.85;
    g.drawImage(glow('#f2e88a'), x - 14, y - 14, 28, 28);
  }
  g.globalAlpha = (0.16 + (still ? 0 : 0.035 * Math.sin(t * 7.3) + 0.025 * Math.sin(t * 13.1)));
  g.drawImage(glow('#ff9a4a'), 800 - 900, 980 - 520, 1800, 1040);
  g.restore();

  // Vignette.
  if (!vignette) {
    vignette = g.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, W * 0.62);
    vignette.addColorStop(0, 'rgba(2,4,10,0)');
    vignette.addColorStop(1, 'rgba(2,4,10,0.6)');
  }
  g.fillStyle = vignette;
  g.fillRect(0, 0, W, H);
}
let vignette: CanvasGradient | null = null;

let styled = false;
function ensureStyles(): void {
  if (styled) return;
  styled = true;
  const tag = document.createElement('style');
  tag.dataset.k2 = 'sterne';
  tag.textContent = `
.k2-sky { background: #03050b; animation: k2-fade .8s ease-out; overflow: hidden; font-size: clamp(14px, 2.3vmin, 20px); }
.k2-sky-frame { position: absolute; inset: 0; overflow: hidden; }
.k2-sky canvas { position: absolute; display: block; cursor: pointer; touch-action: none; }
.k2-sky[data-art="loading"] canvas { opacity: 0; }
.k2-sky canvas { transition: opacity .6s ease-out; }
.k2-sky-dir { position: absolute; z-index: 2; display: flex; align-items: center; gap: .45em; padding: .35em .95em .4em;
  font-family: var(--f-head); font-weight: 700; font-size: 1.05em; letter-spacing: .14em; color: var(--gold-hi);
  text-shadow: 0 1px 2px #000, 0 0 .8em rgba(243,214,138,.35); pointer-events: none; border-radius: 2em; }
.k2-sky-dir b { font-size: 1.25em; line-height: 1; color: var(--gold); }
.k2-sky-dir.w { left: 1.2em; top: 50%; transform: translateY(-50%); }
.k2-sky-dir.o { right: 1.2em; top: 50%; transform: translateY(-50%); }
.k2-sky-help { position: absolute; z-index: 2; left: 0; right: 0; margin: 0 auto; width: max-content; top: max(.9em, env(safe-area-inset-top));
  display: flex; flex-direction: column; align-items: center; gap: .2em; padding: .45em 1.4em .55em; text-align: center; pointer-events: none; max-width: calc(100% - 2em); }
.k2-sky-goal { font-family: var(--f-head); font-weight: 700; font-size: 1.12em; letter-spacing: .06em; color: var(--gold-hi); }
.k2-sky-keys { font-family: var(--f-label); font-size: .95em; letter-spacing: .05em; color: var(--parch); white-space: nowrap; }
.k2-sky-keys .ch-key { margin: 0 .1em; font-size: .9em; }
.k2-sky-say { position: absolute; z-index: 2; left: 50%; bottom: max(1em, env(safe-area-inset-bottom)); transform: translateX(-50%);
  width: min(40em, calc(100% - 2em)); display: flex; align-items: stretch; pointer-events: none; }
.k2-sky-face { flex: none; width: 5.6em; height: 5.6em; margin-right: -.6em; z-index: 1; align-self: flex-end; border-radius: .5em; overflow: hidden;
  border: 2px solid var(--gold); box-shadow: 0 .4em 1.2em #000c, inset 0 0 0 2px #0d121b; background: #141a26; }
.k2-sky-face img { width: 100%; height: 100%; display: block; image-rendering: pixelated; }
.k2-sky-text { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 4.2em; padding: .7em 1.4em .75em 1.8em;
  border-radius: .45em; text-align: center; font-family: var(--f-body); font-style: italic; font-size: 1.12em; line-height: 1.35;
  box-shadow: 0 .5em 1.6em #000b, inset 0 0 2.4em rgba(120,78,30,.32), inset 0 0 0 1px rgba(138,106,44,.55); text-wrap: balance; }
.k2-sky-text.is-new { animation: k2-sky-line .45s var(--ease-out); }
.k2-sky.is-found .k2-sky-text { box-shadow: 0 0 0 2px var(--gold-hi), 0 0 2.2em rgba(243,214,138,.45), inset 0 0 2.4em rgba(120,78,30,.32); }
.k2-sky.is-found .k2-sky-help { animation: k2-sky-pulse 1.6s ease-in-out infinite; }
.k2-sky.is-portrait .k2-sky-dir { left: 0; right: 0; margin: 0 auto; width: max-content; transform: none; }
.k2-sky.is-portrait .k2-sky-dir.w { top: calc(max(.9em, env(safe-area-inset-top)) + 4.9em); }
.k2-sky.is-portrait .k2-sky-dir.o { top: auto; bottom: calc(max(1em, env(safe-area-inset-bottom)) + 7.2em); }
.k2-sky.is-portrait .k2-sky-goal { font-size: 1.05em; }
.k2-sky.is-portrait .k2-sky-keys, .k2-sky.is-short .k2-sky-keys { font-size: 1em; color: var(--gold-hi); }
.k2-sky.is-portrait .k2-sky-face { width: 4.6em; height: 4.6em; }
.k2-sky.is-portrait .k2-sky-text { font-size: 1.05em; padding: .6em 1em .65em 1.5em; }
.k2-sky.is-short .k2-sky-help { padding: .25em 1em .3em; flex-direction: row; gap: .8em; }
.k2-sky.is-short .k2-sky-goal { font-size: 1em; }
.k2-sky.is-short .k2-sky-face { width: 4.2em; height: 4.2em; }
.k2-sky.is-short .k2-sky-text { min-height: 3.2em; padding: .45em 1em .5em 1.5em; }
@keyframes k2-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes k2-sky-line { from { opacity: 0; transform: translateY(.4em) } to { opacity: 1; transform: none } }
@keyframes k2-sky-pulse { 50% { box-shadow: 0 0 1.6em rgba(243,214,138,.5), 0 .7em 2.2em rgba(0,0,0,.55); } }
.reduced-motion .k2-sky, .reduced-motion .k2-sky-text.is-new, .reduced-motion .k2-sky.is-found .k2-sky-help { animation: none; }
@media (prefers-reduced-motion: reduce) { .k2-sky, .k2-sky-text.is-new, .k2-sky.is-found .k2-sky-help { animation: none; } }
`;
  document.head.appendChild(tag);
}

declare global { interface Window { __k2sky?: { stars: Star[]; select(id: string): void } } }

const keysHtml = () => touchUi()
  ? 'Tippe auf einen Stern.'
  : 'Maus oder <span class="ch-key">←</span><span class="ch-key">→</span> wählen · <span class="ch-key">E</span> bestätigen';
const nextHtml = () => touchUi() ? 'Tippen zum Weitermachen' : '<span class="ch-key">E</span> oder Klick zum Weitermachen';

/** Shows the sky; resolves once the player found Crios and confirmed. Never resolves after leaving the scene. */
export function findCrios(): Promise<void> {
  ensureStyles();
  const token = (G.ui as unknown as { token(): number }).token();
  const alive = () => (G.ui as unknown as { alive(t: number): boolean }).alive(token);
  const root = G.ui.panel('k2-sky');
  const face = (mood: string) => { try { return G.art?.portrait('lia-cloak', mood) ?? ''; } catch { return ''; } };
  root.innerHTML = `
    <div class="k2-sky-frame">
      <canvas width="${W}" height="${H}" role="img" aria-label="Nachthimmel zwischen den Eichenkronen. Westen links, Osten rechts."></canvas>
      <div class="k2-sky-dir w ch-panel"><b>◂</b>Westen</div>
      <div class="k2-sky-dir o ch-panel">Osten<b>▸</b></div>
      <div class="k2-sky-help ch-panel"><div class="k2-sky-goal">Der hellste Stern im Westen</div><div class="k2-sky-keys">${keysHtml()}</div></div>
      <div class="k2-sky-say">
        <div class="k2-sky-face"><img alt="Lia" src="${esc(face('thinking'))}"></div>
        <div class="k2-sky-text ch-parch">Crios. Der hellste Stern am Himmel, und er steht immer im Westen. Wo bist du?</div>
      </div>
    </div>`;
  const frameEl = root.querySelector<HTMLElement>('.k2-sky-frame')!;
  const canvas = root.querySelector('canvas')!;
  const g = canvas.getContext('2d')!;
  const text = root.querySelector<HTMLElement>('.k2-sky-text')!;
  const keysEl = root.querySelector<HTMLElement>('.k2-sky-keys')!;
  const goalEl = root.querySelector<HTMLElement>('.k2-sky-goal')!;
  const faceImg = root.querySelector<HTMLImageElement>('.k2-sky-face img')!;
  const dirW = root.querySelector<HTMLElement>('.k2-sky-dir.w b')!;
  const dirO = root.querySelector<HTMLElement>('.k2-sky-dir.o b')!;
  const fx: Fx = { seen: new Set(), sel: null, picked: null, pickT: -9, found: false, foundT: 0, eagleT: 0, px: 0, py: 0 };
  const sparks: Spark[] = [];
  let pointer = { x: 0, y: 0 };
  let t0 = performance.now();
  let lastFrame = t0;
  let done = false;
  let portrait = false;
  let now = 0;

  root.dataset.art = pics ? 'ready' : 'loading';
  void loadPics().then(p => { root.dataset.art = p.sky && p.canopy && p.eagle ? 'ready' : 'failed'; });

  // Cover layout: the canvas fills the window; tall windows turn the sky a quarter (west at the top).
  const layout = () => {
    const fw = frameEl.clientWidth || window.innerWidth, fh = frameEl.clientHeight || window.innerHeight;
    portrait = fh > fw * 1.05;
    root.classList.toggle('is-portrait', portrait);
    root.classList.toggle('is-short', !portrait && fh < 520);
    dirW.textContent = portrait ? '▴' : '◂';
    dirO.textContent = portrait ? '▾' : '▸';
    const cw = portrait ? H : W, ch = portrait ? W : H;
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const a = cw / ch;
    let w = fw, h = fw / a;
    if (h < fh) { h = fh; w = fh * a; }
    Object.assign(canvas.style, { width: `${w}px`, height: `${h}px`, left: `${(fw - w) / 2}px`, top: `${(fh - h) / 2}px` });
    canvas.setAttribute('aria-label', `Nachthimmel zwischen den Eichenkronen. Westen ${portrait ? 'oben' : 'links'}, Osten ${portrait ? 'unten' : 'rechts'}.`);
  };
  layout();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(layout) : null;
  ro?.observe(frameEl);

  /** Screen point → sky coordinates (1600×900, west left). */
  const toSky = (cx: number, cy: number): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const u = (cx - rect.left) / rect.width, v = (cy - rect.top) / rect.height;
    return portrait ? [v * W, H - u * H] : [u * W, v * H];
  };

  const say = (line: string, mood: string) => {
    text.textContent = line;
    text.classList.remove('is-new');
    void text.offsetWidth;
    text.classList.add('is-new');
    const src = face(mood);
    if (src) faceImg.src = src;
  };

  return new Promise<void>(resolve => {
    const pick = (id: string) => {
      if (done) return;
      if (fx.found) { finish(); return; }
      const s = STARS.find(x => x.id === id);
      if (!s) return;
      fx.sel = id;
      fx.picked = id;
      fx.seen.add(id);
      fx.pickT = now;
      say(s.line, s.mood ?? 'thinking');
      if (s.memory) { G.state.addMemory(s.memory); sfx('memory', { volume: 0.7 }); }
      if (s.correct) {
        fx.found = true;
        fx.foundT = now;
        root.classList.add('is-found');
        sfx('discover');
        goalEl.textContent = 'Crios, der Adler des Aros';
        keysEl.innerHTML = nextHtml();
        t0 = performance.now();
        if (!settings.reducedMotion) {
          for (let i = 0; i < 36; i++) {
            const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 220, max = 0.8 + Math.random() * 1.2;
            sparks.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: max, max });
          }
        }
      } else if (!s.memory) sfx(s.cluster ? 'ui-move' : 'ui-cancel', { volume: 0.6 });
    };
    window.__k2sky = { stars: STARS, select: pick };
    const finish = () => {
      done = true;
      window.removeEventListener('keydown', onKey, true);
      ro?.disconnect();
      sfx('ui-confirm', { volume: 0.6 });
      root.style.transition = 'opacity .5s';
      root.style.opacity = '0';
      setTimeout(() => { root.remove(); delete window.__k2sky; if (alive()) resolve(); }, 520);
    };
    const hit = (cx: number, cy: number): Star | undefined => {
      const [x, y] = toSky(cx, cy);
      let best: Star | undefined, bd = Infinity;
      for (const s of STARS) {
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < Math.max(80, (s.ring ?? 0) + 20) && d < bd) { bd = d; best = s; }
      }
      return best;
    };
    canvas.addEventListener('pointermove', e => {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: ((e.clientX - rect.left) / rect.width) * 2 - 1, y: ((e.clientY - rect.top) / rect.height) * 2 - 1 };
      if (fx.found || e.pointerType === 'touch') return;
      const h = hit(e.clientX, e.clientY)?.id;
      if (h && h !== fx.sel) { fx.sel = h; sfx('ui-move', { volume: 0.25 }); }
    });
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (fx.found) { if (performance.now() - t0 > 900) finish(); return; }
      const s = hit(e.clientX, e.clientY);
      if (s) pick(s.id);
    });
    const order = [...STARS].sort((a, b) => a.x - b.x).map(s => s.id);
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || G.ui.busy()) return;
      const back = e.key === 'ArrowLeft' || e.key === 'a' || (portrait && e.key === 'ArrowUp');
      const fwd = e.key === 'ArrowRight' || e.key === 'd' || (portrait && e.key === 'ArrowDown');
      if (back || fwd) {
        if (fx.found) return;
        e.preventDefault(); e.stopPropagation();
        const i = fx.sel ? order.indexOf(fx.sel) : -1;
        fx.sel = order[(i + (back ? -1 : 1) + order.length) % order.length];
        sfx('ui-move', { volume: 0.5 });
      } else if (isConfirmKey(e)) {
        e.preventDefault(); e.stopPropagation();
        if (fx.found) { if (performance.now() - t0 > 900) finish(); }
        else if (fx.sel) pick(fx.sel);
      }
    };
    window.addEventListener('keydown', onKey, true);

    const frame = (ms: number) => {
      if (done || !root.isConnected) { ro?.disconnect(); return; }
      if (!alive()) { window.removeEventListener('keydown', onKey, true); ro?.disconnect(); return; }
      const dt = Math.min(0.05, (ms - lastFrame) / 1000);
      lastFrame = ms;
      now = ms / 1000;
      const still = settings.reducedMotion;
      if (fx.found) fx.eagleT = Math.min(1.2, fx.eagleT + dt * (still ? 2 : 0.7));
      // Pointer lean (in sky orientation), smoothed.
      const [lx, ly] = portrait ? [pointer.y, -pointer.x] : [pointer.x, pointer.y];
      const k = still ? 0 : Math.min(1, dt * 3);
      fx.px += (-lx - fx.px) * k; fx.py += (-ly - fx.py) * k;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97;
        if (p.life <= 0) sparks.splice(i, 1);
      }
      if (!still) {
        if (shooting) { shooting.t += dt; if (shooting.t > 0.9) shooting = null; }
        else if ((nextShoot -= dt) <= 0) {
          nextShoot = 7 + Math.random() * 8;
          const left = Math.random() < 0.5;
          shooting = { x: 500 + Math.random() * 600, y: 140 + Math.random() * 160, vx: (left ? -1 : 1) * (420 + Math.random() * 200), vy: 220 + Math.random() * 120, t: 0 };
        }
      } else shooting = null;
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (portrait) g.setTransform(0, 1, -1, 0, H, 0);
      drawSky(g, fx, now, still, sparks);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

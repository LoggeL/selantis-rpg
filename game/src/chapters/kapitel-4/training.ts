// Training at the palisade (bruderschaft, DESIGN.md §7.4 Adaption): Foltan teaches Ausweichen with a wooden sword
// („Foltans Gewohnheiten“: he repeats a combination of blows from the left, the right and high; shown slowly once,
// then too fast to react to – Lia reads the combination from her notes and moves before the blade; after three reads
// he switches to a new one),
// then Gundrik and Jorin turn Ablenken into a little puzzle (make the guard look away from your friend).
//
// The dodge drill is staged as a painted sparring cut-in (assets/minigames/k4-drill-*, Codex, prompts in
// docs/rebuild/art/minigames.json, built by output/k4-build.py): the training yard, Foltan facing us (ready / wind-up /
// follow-through) and Lia seen over her shoulder (ready / sidestep / duck / ouch). The code only adds sunlight, dust,
// the glowing swing arc, slash streaks, flashes and the controls.
import { G } from '../../core/G';
import type { UiApiExt } from '../../ui';
import type { CharAnim } from '../../art/api';
import type { WorldCtx } from '../../world';
import { assetUrl, manifest } from '../../art/manifest';
import { ctx } from '../../ui/context';
import { bg, lia, sfx } from './shared';

import { afterStrike, DrillClock, drillStart, HABITS, judge, nextStrike, READS_PER_HABIT, type Dodge, type StrikeSide } from './drillLogic';

const STYLE_ID = 'k4-drill-style';
const CSS = `
.k4-drill.is-paused * { animation-play-state: paused !important; }
.k4-drill{--k4-gold:#f3d68a;--k4-bad:#e0644a;--k4-heat:0;overflow:hidden;touch-action:none;user-select:none;opacity:0;transition:opacity .45s ease;background:#120d08}
.k4-drill.is-in{opacity:1}
.k4-drill.is-out{opacity:0;transition-duration:.4s}
.k4-drill .k4-scene{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.k4-drill .k4-bg{position:absolute;inset:-3%;background:#3a2a14 center 58%/cover no-repeat;transform:scale(1.05);transition:transform 1.4s cubic-bezier(.2,.7,.2,1),filter .3s}
.k4-drill.is-in .k4-bg{transform:scale(1)}
.k4-drill .k4-sun{position:absolute;inset:0;mix-blend-mode:screen;opacity:.85;background:
  linear-gradient(118deg,rgba(255,214,140,.38) 0%,rgba(255,200,120,.1) 26%,transparent 46%),
  repeating-linear-gradient(112deg,transparent 0 5%,rgba(255,226,160,.07) 5% 7%,transparent 7% 12%);
  animation:k4-sun 7s ease-in-out infinite alternate}
@keyframes k4-sun{from{opacity:.65}to{opacity:.95}}
.k4-drill .k4-fx{position:absolute;inset:0;width:100%;height:100%;z-index:3}
.k4-drill .k4-fig{position:absolute;aspect-ratio:481/722;transition:translate .2s cubic-bezier(.3,.7,.2,1),opacity .4s,transform .6s cubic-bezier(.2,.8,.2,1)}
.k4-drill .k4-fig .k4-flip{position:absolute;inset:0;transform-origin:50% 100%;transition:transform .08s}
.k4-drill .k4-fig.is-flip .k4-flip{transform:scaleX(-1)}
.k4-drill .k4-fig img{position:absolute;left:0;bottom:0;width:100%;height:100%;opacity:0;transform-origin:50% 100%;image-rendering:auto;-webkit-user-drag:none}
.k4-drill .k4-fig img.on{opacity:1}
.k4-drill .k4-shadow{position:absolute;left:18%;right:18%;bottom:-2.5%;height:6%;border-radius:50%;background:radial-gradient(closest-side,rgba(30,16,4,.55),transparent)}
.k4-drill .k4-foltan{z-index:2;left:67%;bottom:15%;height:56%;transform:translate(-50%,0)}
.k4-drill .k4-foltan .p-windup-high{transform:scale(1.06)}
.k4-drill .k4-foltan .p-strike-high{transform:scale(.94)}
.k4-drill .k4-lia{z-index:4;left:30%;bottom:-3%;height:72%;transform:translate(-50%,0)}
.k4-drill .k4-lia .p-hurt{transform:scale(.95) rotate(-2deg)}
.k4-drill:not(.is-in) .k4-foltan{transform:translate(-40%,0);opacity:0}
.k4-drill:not(.is-in) .k4-lia{transform:translate(-62%,0);opacity:0}
.k4-drill .k4-lia.go-left{translate:-13vw 0}
.k4-drill .k4-lia.go-right{translate:9vw 0}
.k4-drill .k4-lia.go-duck{translate:0 2%}
.k4-drill .k4-foltan.lunge{translate:-3% 0;transform:translate(-50%,0) scale(1.05)}
.k4-drill .k4-heat{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:var(--k4-heat);
  background:radial-gradient(120% 90% at 50% 45%,transparent 55%,rgba(150,30,10,.42) 100%)}
.k4-drill .k4-slash{position:absolute;z-index:5;left:20%;top:26%;width:60%;height:30%;opacity:0;overflow:visible}
.k4-drill .k4-slash.from-right{transform:scaleX(-1)}
.k4-drill .k4-slash.from-high{left:34%;top:14%;width:34%;height:56%}
.k4-drill.fx-strike .k4-slash{animation:k4-slash .34s cubic-bezier(.2,.7,.3,1) forwards}
.k4-drill.fx-hurt .k4-slash .tint{stop-color:#e0644a}
@keyframes k4-slash{0%{opacity:0;clip-path:inset(0 100% 0 0)}25%{opacity:1}70%{opacity:1;clip-path:inset(0 0 0 0)}100%{opacity:0;clip-path:inset(0 0 0 0)}}
.k4-drill .k4-flash{position:absolute;inset:0;z-index:6;opacity:0;pointer-events:none}
.k4-drill.fx-hurt .k4-flash{background:radial-gradient(60% 70% at 33% 55%,rgba(224,100,74,.3),rgba(110,16,8,.5) 100%);animation:k4-flash .45s ease-out forwards}
.k4-drill.fx-dodge .k4-flash{background:radial-gradient(50% 50% at 45% 55%,rgba(255,236,180,.3),transparent 70%);animation:k4-flash .45s ease-out}
.k4-drill.fx-won .k4-flash{background:radial-gradient(55% 60% at 45% 45%,rgba(255,226,150,.38),transparent 75%);animation:k4-flash .9s ease-out}
.k4-drill.fx-won .k4-pips span.on{animation:k4-pop .45s cubic-bezier(.34,1.56,.64,1)}
.k4-drill.fx-feint .k4-flash{background:rgba(255,250,235,.35);animation:k4-flash .22s ease-out}
@keyframes k4-flash{0%{opacity:1}100%{opacity:0}}
.k4-drill.fx-hurt .k4-scene{animation:k4-shake .32s linear}
@keyframes k4-shake{0%,100%{translate:0 0}20%{translate:-.5em .2em}40%{translate:.45em -.2em}60%{translate:-.3em .1em}80%{translate:.2em 0}}
.k4-drill .k4-vignette{position:absolute;inset:0;z-index:6;pointer-events:none;box-shadow:inset 0 0 9em rgba(20,10,2,.75);background:linear-gradient(180deg,transparent 72%,rgba(12,8,4,.55))}

.k4-drill .k4-ui{position:absolute;inset:0;z-index:7;pointer-events:none}
.k4-drill .k4-head{position:absolute;left:50%;top:max(3%,env(safe-area-inset-top));transform:translate(-50%,-.6em);opacity:0;transition:opacity .4s .25s,transform .4s .25s;
  display:flex;flex-direction:column;align-items:center;gap:.35em;padding:.45em 2.6em .55em;width:max-content;max-width:94vw;
  background:linear-gradient(90deg,transparent,rgba(13,18,27,.78) 18%,rgba(13,18,27,.78) 82%,transparent)}
.k4-drill .k4-head::before,.k4-drill .k4-head::after{content:'';position:absolute;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,var(--gold-line),transparent)}
.k4-drill .k4-head::before{top:0}.k4-drill .k4-head::after{bottom:0}
.k4-drill.is-in .k4-head{opacity:1;transform:translate(-50%,0)}
.k4-drill .k4-title{margin:0;font-size:clamp(1.3em,3.6vmin,2em);line-height:1.05;letter-spacing:.08em;text-shadow:0 .06em 0 #2a1d0c,0 .1em .5em #000}
.k4-drill .k4-sub{max-width:40em;font-size:clamp(.85em,2.1vmin,1.08em);color:var(--parch);text-align:center;text-shadow:0 1px 2px #000}
.k4-drill .k4-pips{display:flex;gap:.9em;padding:.2em 0}
.k4-drill .k4-notes{display:flex;flex-direction:column;align-items:center;gap:.1em;font-size:clamp(.8em,2vmin,1em);color:var(--parch);text-shadow:0 1px 2px #000}
.k4-drill .k4-notes b{font-family:var(--f-label);font-weight:normal;font-size:.8em;color:var(--gold-hi)}
.k4-drill .k4-note-line{display:flex;gap:.45em;min-height:1.2em;letter-spacing:.05em;font-size:1.3em}
.k4-drill .k4-note-line i{font-style:normal;color:#e9a08f}.k4-drill .k4-note-line i.is-ok{color:var(--gold-hi)}
.k4-drill .k4-note-line.is-read::after{content:'…';color:var(--parch-dim)}
.k4-drill .k4-note-line.is-old{opacity:.4;text-decoration:line-through}
.k4-drill .k4-pips span{width:.95em;height:.95em;transform:rotate(45deg);border:.12em solid var(--gold,#d8b25a);background:rgba(13,18,27,.6);box-shadow:0 0 .4em #000;transition:background .25s,box-shadow .25s}
.k4-drill .k4-pips span.on{background:radial-gradient(circle at 35% 35%,#fff6d6,var(--k4-gold) 45%,#b8862e);box-shadow:0 0 .8em rgba(243,214,138,.9);animation:k4-pop .4s cubic-bezier(.34,1.56,.64,1)}
.k4-drill .k4-score{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.k4-drill .k4-titles{display:grid;place-items:center}
.k4-drill .k4-titles>*{grid-area:1/1}
.k4-drill .k4-cue:not(:empty)+.k4-title{visibility:hidden}
.k4-drill .k4-cue{font-family:var(--f-head);font-weight:700;font-size:clamp(1.5em,4.4vmin,2.3em);line-height:1.05;letter-spacing:.06em;white-space:nowrap;
  color:var(--k4-gold);text-shadow:0 .06em 0 #2a1d0c,0 0 .5em rgba(0,0,0,.9),0 0 1.2em rgba(0,0,0,.6);pointer-events:none;transition:color .15s}
.k4-drill .k4-cue:empty{display:none}
.k4-drill .k4-cue.is-late{color:#ff8a66;animation:k4-throb .22s ease-in-out infinite alternate}
.k4-drill .k4-cue.is-good{color:var(--k4-gold);animation:k4-pop .35s cubic-bezier(.34,1.56,.64,1)}
.k4-drill .k4-cue.is-bad{color:var(--k4-bad);animation:k4-pop .35s cubic-bezier(.34,1.56,.64,1)}
@keyframes k4-pop{0%{scale:.6}100%{scale:1}}
@keyframes k4-throb{from{scale:1}to{scale:1.06}}
.k4-drill .k4-say{position:absolute;z-index:8;max-width:min(22em,70vw);padding:.45em .9em .5em;font-size:clamp(.95em,2.2vmin,1.15em);line-height:1.25;color:var(--ink,#2b2119);
  background:linear-gradient(180deg,#f8eed6,#e9d9b4);border:1px solid #8a6d3f;border-radius:.6em;box-shadow:0 .3em .9em rgba(0,0,0,.55);
  transform:translate(-50%,-100%) scale(.85);opacity:0;transition:opacity .2s,transform .25s cubic-bezier(.34,1.56,.64,1);pointer-events:none}
.k4-drill .k4-say::after{content:'';position:absolute;left:50%;bottom:-.45em;width:.8em;height:.8em;background:#ead9b4;border-right:1px solid #8a6d3f;border-bottom:1px solid #8a6d3f;transform:translateX(-50%) rotate(45deg)}
.k4-drill .k4-say.on{opacity:1;transform:translate(-50%,-100%) scale(1)}
.k4-drill .k4-say b{font-family:var(--f-label);font-size:.8em;letter-spacing:.08em;color:#7a5520;margin-right:.35em}

.k4-drill .k4-bar{position:absolute;left:50%;bottom:max(3.5%,env(safe-area-inset-bottom));transform:translate(-50%,.6em);opacity:0;transition:opacity .4s .35s,transform .4s .35s;
  display:flex;gap:clamp(.8em,3vw,2.4em);align-items:flex-end;pointer-events:auto;z-index:9}
.k4-drill.is-in .k4-bar{opacity:1;transform:translate(-50%,0)}
.k4-drill .k4-btn{display:flex;flex-direction:column;align-items:center;gap:.4em;padding:0;border:0;background:none;cursor:pointer;touch-action:manipulation;color:var(--parch)}
.k4-drill .k4-ring{display:grid;place-items:center;width:clamp(3.6em,9vmin,5em);height:clamp(3.6em,9vmin,5em);border-radius:50%;color:var(--gold-hi);
  border:2px solid var(--gold);background:radial-gradient(circle at 50% 35%,#2a3550,#0d121b 75%);box-shadow:0 0 0 3px rgba(13,18,27,.7),0 .35em .9em rgba(0,0,0,.6),inset 0 0 .8em rgba(216,178,90,.25);
  transition:transform .12s,box-shadow .2s,border-color .2s,background .2s}
.k4-drill .k4-ring svg{width:46%;height:46%}
.k4-drill .k4-btn:hover .k4-ring{box-shadow:0 0 0 3px rgba(13,18,27,.7),0 0 1.2em rgba(243,214,138,.45),inset 0 0 .8em rgba(216,178,90,.35)}
.k4-drill .k4-btn .k4-name{font-family:var(--f-label);font-size:clamp(.85em,2vmin,1.05em);letter-spacing:.08em;color:var(--parch);text-shadow:0 1px 2px #000,0 0 6px #000}
.k4-drill .k4-btn .k4-keys{display:flex;gap:.25em}
.k4-drill .k4-btn .ch-key{font-size:.8em}
.is-touch .k4-drill .k4-btn .k4-keys{display:none}
.is-touch .k4-drill .k4-ring{width:clamp(4.2em,12vmin,5.2em);height:clamp(4.2em,12vmin,5.2em)}
.k4-drill .k4-btn.is-ok .k4-ring{transform:scale(.9);border-color:var(--k4-gold);background:radial-gradient(circle at 50% 35%,#6a5326,#1d1608 75%);box-shadow:0 0 1.6em rgba(243,214,138,.8)}
.k4-drill .k4-btn.is-hit .k4-ring{border-color:var(--k4-bad);background:radial-gradient(circle at 50% 35%,#6a2a1c,#1b0b07 75%);box-shadow:0 0 1.4em rgba(224,100,74,.8)}
.k4-drill.is-armed .k4-ring{border-color:var(--gold-hi)}

.is-portrait .k4-drill .k4-bg{background-position:42% 60%}
.is-portrait .k4-drill .k4-foltan{left:66%;bottom:31%;height:40%}
.is-portrait .k4-drill .k4-lia{left:36%;bottom:12%;height:46%}
.is-portrait .k4-drill .k4-lia.go-left{translate:-18vw 0}
.is-portrait .k4-drill .k4-lia.go-right{translate:6vw 0}
.is-portrait .k4-drill .k4-head{width:100%;padding-inline:1em}
.is-portrait .k4-drill .k4-slash{left:5%;top:38%;width:90%;height:20%}
.is-portrait .k4-drill .k4-slash.from-high{left:28%;top:30%;width:46%;height:36%}

.k4-drill.is-reduced .k4-sun{animation:none}
.k4-drill.is-reduced .k4-fig,.k4-drill.is-reduced .k4-bg{transition:opacity .2s}
.k4-drill.is-reduced .k4-lia.go-left,.k4-drill.is-reduced .k4-lia.go-right{translate:0 0}
.k4-drill.is-reduced.fx-hurt .k4-scene{animation:none}
.k4-drill.is-reduced .k4-cue.is-late{animation:none}
.k4-drill.is-reduced .k4-slash{animation-duration:.01s!important}
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = CSS;
  document.head.appendChild(st);
}

const KEYMAP: Record<string, Dodge> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'duck', KeyS: 'duck', KeyC: 'duck',
};

/** URL of a painted drill image (manifest first, conventional path as fallback). */
const art = (key: string, ext = 'png') => assetUrl(manifest().images?.[`minigames/${key}`]?.file ?? `assets/minigames/${key}.${ext}`);
const reducedMotion = () => ctx.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

const ARROW = (rot: number) => `<svg viewBox="0 0 24 24" style="transform:rotate(${rot}deg)"><path d="M15.5 4 7 12l8.5 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const FOLTAN_POSES = ['ready', 'windup-side', 'windup-high', 'strike-side', 'strike-high'] as const;
const LIA_POSES = ['ready', 'dodge', 'duck', 'hurt'] as const;
type FoltanPose = typeof FOLTAN_POSES[number];
type LiaPose = typeof LIA_POSES[number];

/** Telegraph state the effect canvas draws (the swing arc). */
interface Arc { side: StrikeSide; k: number; flash: boolean }

/**
 * Sunlit dust and the glowing swing arc around Foltan (a light canvas effect; static with reduced motion).
 * Returns a setter for the current arc (null = no swing).
 */
function startFx(canvas: HTMLCanvasElement, root: HTMLElement, foltan: HTMLElement, reduced: boolean): (a: Arc | null) => void {
  const g = canvas.getContext('2d');
  let arc: Arc | null = null;
  if (!g) return a => { arc = a; };
  let w = 0, h = 0, dpr = 1;
  type Mote = { x: number; y: number; r: number; vx: number; vy: number; a: number; t: number };
  let motes: Mote[] = [];
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (Math.round(r.width) === w && Math.round(r.height) === h) return;
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const n = Math.min(70, Math.round((w * h) / 16000));
    motes = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h * 0.8, r: 0.6 + Math.random() * 1.8, vx: 4 + Math.random() * 8, vy: -2 + Math.random() * 4, a: 0.15 + Math.random() * 0.45, t: Math.random() * 6 }));
  };
  const draw = (dt: number) => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    // dust in the sunbeams
    g.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      m.t += dt; m.x += m.vx * dt; m.y += (m.vy + Math.sin(m.t * 1.3) * 3) * dt;
      if (m.x > w + 4) { m.x = -4; m.y = Math.random() * h * 0.8; }
      const tw = 0.6 + 0.4 * Math.sin(m.t * 2.1);
      g.fillStyle = `rgba(255, 226, 160, ${(m.a * tw).toFixed(3)})`;
      g.beginPath(); g.arc(m.x, m.y, m.r, 0, Math.PI * 2); g.fill();
    }
    // the swing arc
    if (arc) {
      const cr = canvas.getBoundingClientRect();
      const fr = foltan.getBoundingClientRect();
      const cx = fr.left - cr.left + fr.width * 0.5, cy = fr.top - cr.top + fr.height * (arc.side === 'high' ? 0.42 : 0.36);
      const k = Math.min(1, arc.k);
      const late = k > 0.7;
      const high = arc.side === 'high';
      const R = fr.height * ((high ? 0.36 : 0.5) - 0.06 * k);
      const [a0, a1] = arc.side === 'high' ? [200, 340] : arc.side === 'left' ? [118, 238] : [-58, 62];
      const span = (a1 - a0) * (0.45 + 0.55 * k);
      const mid = (a0 + a1) / 2;
      const from = ((mid - span / 2) * Math.PI) / 180, to = ((mid + span / 2) * Math.PI) / 180;
      const col = arc.flash ? '255,252,240' : late ? '255,110,70' : '243,214,138';
      const width = (4 + 10 * k) * Math.max(0.6, fr.height / 430);
      g.lineCap = 'round';
      g.shadowColor = `rgba(${col}, 0.9)`;
      g.shadowBlur = 18 + 22 * k;
      for (const [lw, al] of [[width * 2.4, 0.16], [width, 0.55 + 0.35 * k], [Math.max(1.5, width * 0.3), 0.95]] as const) {
        g.strokeStyle = lw < width ? `rgba(255, 250, 235, ${al})` : `rgba(${col}, ${al})`;
        g.lineWidth = lw;
        g.beginPath(); g.arc(cx, cy, R, from, to); g.stroke();
      }
      // the leading tip and a few sparks along the arc
      const tipA = arc.side === 'right' ? from : to;
      const tx = cx + Math.cos(tipA) * R, ty = cy + Math.sin(tipA) * R;
      const glow = g.createRadialGradient(tx, ty, 0, tx, ty, width * 3);
      glow.addColorStop(0, 'rgba(255,255,245,0.95)'); glow.addColorStop(0.4, `rgba(${col},0.6)`); glow.addColorStop(1, `rgba(${col},0)`);
      g.shadowBlur = 0;
      g.fillStyle = glow;
      g.beginPath(); g.arc(tx, ty, width * 3, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    g.shadowBlur = 0;
  };
  resize();
  let last = performance.now();
  const loop = (now: number) => {
    if (!root.isConnected) return;
    resize();
    if (!root.classList.contains('is-paused')) draw(reduced ? 0 : Math.min(0.05, (now - last) / 1000));
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return a => { arc = a; };
}

/**
 * „Foltans Gewohnheiten“: the dodge drill. Foltan stands right of Lia. By default it runs until Lia has read both of
 * Foltan's habits (drillLogic.ts; never fails for good, after many blows Foltan calls it a day); `need` ends it after
 * that many dodges instead (unit tests). Resolves with the hits Lia took.
 */
export async function ausweichDrill(w: WorldCtx, need?: number): Promise<number> {
  const goal = need ?? READS_PER_HABIT * HABITS.length;
  const ui = G.ui as UiApiExt;
  ensureStyle();
  const foltan = w.actor('foltan');
  const scene = w.scene;
  const reduced = reducedMotion();
  const panel = G.ui.panel('k4-drill');
  panel.classList.toggle('is-reduced', reduced);
  const img = (fig: string, pose: string) => `<img class="p-${pose}" alt="" draggable="false" src="${art(`k4-drill-${fig}-${pose}`)}">`;
  const btn = (d: Dodge, name: string, rot: number, keys: string[]) =>
    `<button class="k4-btn" data-d="${d}" aria-label="${name}"><span class="k4-ring">${ARROW(rot)}</span><span class="k4-name">${name}</span>` +
    `<span class="k4-keys">${keys.map(k => `<span class="ch-key">${k}</span>`).join('')}</span></button>`;
  panel.innerHTML = `
    <div class="k4-scene" aria-hidden="true">
      <div class="k4-bg" style="background-image:url('${art('k4-drill-bg', 'jpg')}')"></div>
      <div class="k4-sun"></div>
      <div class="k4-fig k4-foltan"><div class="k4-shadow"></div><div class="k4-flip">${FOLTAN_POSES.map(p => img('foltan', p)).join('')}</div></div>
      <canvas class="k4-fx"></canvas>
      <div class="k4-fig k4-lia"><div class="k4-shadow"></div><div class="k4-flip">${LIA_POSES.map(p => img('lia', p)).join('')}</div></div>
      <svg class="k4-slash" viewBox="0 0 100 40" preserveAspectRatio="none">
        <defs><linearGradient id="k4-slash-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fffdf4" stop-opacity="0"/><stop offset=".45" stop-color="#fffdf4" stop-opacity=".8"/>
          <stop class="tint" offset=".8" stop-color="#f3d68a" stop-opacity=".6"/><stop class="tint" offset="1" stop-color="#f3d68a" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="M2 30 Q50 -6 98 26 Q50 6 2 30 Z" fill="url(#k4-slash-g)"/>
        <path d="M4 29 Q50 -2 96 25" fill="none" stroke="#fffdf4" stroke-width=".6" stroke-linecap="round" opacity=".85"/>
      </svg>
      <div class="k4-heat"></div>
      <div class="k4-vignette"></div>
      <div class="k4-flash"></div>
    </div>
    <div class="k4-ui">
      <div class="k4-head">
        <div class="k4-titles"><div class="k4-cue" aria-live="assertive"></div><h2 class="k4-title ch-title">Foltans Gewohnheiten</h2></div>
        <div class="k4-sub">Foltan wiederholt sich, ohne es zu merken. Schau, welche Folge er schlägt, und weich aus, bevor die Klinge kommt: zur anderen Seite oder darunter.</div>
        <div class="k4-notes" aria-label="Lias Notizen"><b>Lias Notizen</b><span class="k4-note-line"></span></div>
        <div class="k4-pips" role="img" aria-label="Gelesen: 0 von ${goal}">${'<span></span>'.repeat(goal)}</div>
        <div class="k4-score" role="status" aria-live="polite">Gelesen 0/${goal}</div>
      </div>
      <div class="k4-say"></div>
    </div>
    <div class="k4-bar">
      ${btn('left', 'Links', 0, ['A', '←'])}
      ${btn('duck', 'Ducken', -90, ['S', '↓'])}
      ${btn('right', 'Rechts', 180, ['D', '→'])}
    </div>`;
  const score = panel.querySelector('.k4-score') as HTMLElement;
  const pips = Array.from(panel.querySelectorAll<HTMLElement>('.k4-pips span'));
  const cue = panel.querySelector('.k4-cue') as HTMLElement;
  const sayEl = panel.querySelector('.k4-say') as HTMLElement;
  const notesEl = panel.querySelector('.k4-notes') as HTMLElement;
  const GLYPH: Record<StrikeSide, string> = { left: '◀', right: '▶', high: '▲' };
  /** Lia's notes: one line per habit, a glyph per blow (gold when she got away). */
  const notes: { glyphs: string[]; read: boolean; old: boolean }[] = [{ glyphs: [], read: false, old: false }];
  const renderNotes = () => {
    notesEl.innerHTML = '<b>Lias Notizen</b>' + notes.map(l =>
      `<span class="k4-note-line${l.read ? ' is-read' : ''}${l.old ? ' is-old' : ''}">${l.glyphs.join('')}</span>`).join('');
  };
  const slash = panel.querySelector('.k4-slash') as SVGElement;
  const figF = panel.querySelector('.k4-foltan') as HTMLElement;
  const figL = panel.querySelector('.k4-lia') as HTMLElement;
  const setArc = startFx(panel.querySelector('.k4-fx') as HTMLCanvasElement, panel, figF, reduced);
  const pose = (fig: HTMLElement, p: FoltanPose | LiaPose, flip = false) => {
    for (const im of fig.querySelectorAll('img')) im.classList.toggle('on', im.classList.contains(`p-${p}`));
    fig.classList.toggle('is-flip', flip);
  };
  pose(figF, 'ready');
  pose(figL, 'ready');
  /** Restarts a one-shot CSS animation class. */
  const pulse = (cls: string) => { panel.classList.remove(cls); void panel.offsetWidth; panel.classList.add(cls); };
  let sayTimer = 0;
  /** Foltan's / Lia's short remarks, shown in the cut-in (the world bark still plays the voice underneath). */
  const remark = (who: 'foltan' | 'player', text: string, ms: number) => {
    w.bark(who, text, ms);
    const pr = panel.getBoundingClientRect();
    const fr = (who === 'foltan' ? figF : figL).getBoundingClientRect();
    sayEl.innerHTML = `<b>${who === 'foltan' ? 'Foltan' : 'Lia'}</b>${text}`;
    const x = Math.min(pr.width - 120, Math.max(120, fr.left - pr.left + fr.width / 2));
    const y = Math.max(sayEl.offsetHeight + 90, fr.top - pr.top + fr.height * (who === 'foltan' ? 0.04 : 0.1));
    sayEl.style.left = `${x}px`;
    sayEl.style.top = `${y}px`;
    sayEl.classList.add('on');
    clearTimeout(sayTimer);
    sayTimer = window.setTimeout(() => sayEl.classList.remove('on'), ms);
  };
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('is-in')));

  let answer: Dodge | null = null;
  let armed = false;
  /** Between blows Lia may already commit: reading the habit means moving before the blade does. */
  let early = false;
  let disposed = false;
  let focused = document.hasFocus();
  const active = () => !disposed && focused && !document.hidden && document.hasFocus() && ctx.top()?.id === 'k4-drill';
  const clock = new DrillClock(performance.now(), !active());
  let pausedScene = false;
  const activeTime = () => {
    if (disposed) return clock.elapsed;
    const paused = !active();
    panel.classList.toggle('is-paused', paused);
    if (paused && !pausedScene && scene.scene.isActive()) { scene.scene.pause(); pausedScene = true; }
    else if (!paused && pausedScene) { scene.scene.resume(); pausedScene = false; }
    return clock.tick(performance.now(), paused);
  };
  const waitActive = async (ms: number) => {
    if (disposed) return;
    const until = activeTime() + ms;
    do { await ui.wait(16); } while (!disposed && (activeTime() < until || !active()));
  };
  const commit = (d: Dodge) => {
    if (!active() || !(armed || early) || answer) return;
    answer = d;
    const b = panel.querySelector(`[data-d="${d}"]`);
    b?.classList.add('is-ok');
    void waitActive(260).then(() => b?.classList.remove('is-ok'));
  };
  const closeModal = ctx.open({
    id: 'k4-drill', allowMenu: true, allowJournal: true, releaseKeys: Object.keys(KEYMAP),
    onKey(e) {
      const d = KEYMAP[e.code];
      if (!d) return false;
      if (!e.repeat) commit(d);
      return true;
    },
  });
  const onBlur = () => { focused = false; activeTime(); };
  const onFocus = () => { focused = true; activeTime(); };
  const onVisibility = () => { activeTime(); };
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibility);
  for (const b of panel.querySelectorAll<HTMLButtonElement>('.k4-btn')) {
    b.addEventListener('pointerdown', ev => { ev.preventDefault(); commit(b.dataset.d as Dodge); });
  }
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    closeModal();
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisibility);
    if (pausedScene && w.alive) scene.scene.resume();
    pausedScene = false;
    clearTimeout(sayTimer);
    panel.remove();
  };
  scene.events.once('shutdown', cleanup);

  const CUE: Record<StrikeSide, string> = { left: 'Hieb von links!', right: 'Hieb von rechts!', high: 'Hoher Hieb!' };
  const drawArc = (side: StrikeSide, k: number, flash = false) => {
    setArc({ side, k, flash });
    pose(figF, side === 'high' ? 'windup-high' : 'windup-side', side === 'right');
    panel.style.setProperty('--k4-heat', String(Math.max(0, (k - 0.55) / 0.45).toFixed(2)));
    if (cue.textContent !== CUE[side]) { cue.className = 'k4-cue'; cue.textContent = CUE[side]; }
    cue.classList.toggle('is-late', k > 0.7);
  };
  const result = (text: string, good: boolean) => {
    cue.className = `k4-cue ${good ? 'is-good' : 'is-bad'}`;
    cue.textContent = text;
  };

  // Read-only probe for automated playtests (e2e/kapitel-4.pw.ts): what the telegraph currently shows.
  const probe = { armed: false, side: 'left' as StrikeSide, coming: 'left' as StrikeSide, k: 0, ok: 0 };
  (window as unknown as { __k4drill?: typeof probe }).__k4drill = probe;
  let ok = 0, hits = 0, streakMiss = 0, reads = 0;
  let st = drillStart();
  const home = { x: w.player.x, y: w.player.y };
  await waitActive(reduced ? 200 : 700);
  for (let i = 0; !st.done && (need === undefined || ok < need); i++) {
    if (!w.alive) break;
    const s = nextStrike(st);
    probe.coming = s.side;
    answer = null;
    early = s.phase === 'fast';
    await waitActive(i === 0 ? 400 : 650);
    // back to guard
    pose(figF, 'ready');
    pose(figL, 'ready');
    figL.classList.remove('go-left', 'go-right', 'go-duck');
    figF.classList.remove('lunge');
    panel.classList.remove('fx-strike', 'fx-hurt', 'fx-dodge', 'fx-feint');
    cue.textContent = '';
    foltan.face('player');
    w.player.face('foltan');
    armed = true;
    panel.classList.add('is-armed');
    sfx('swing', { volume: 0.25, pitch: 0.7 });
    const t0 = activeTime();
    const side = s.side;
    probe.armed = true;
    while (activeTime() - t0 < s.windup) {
      const k = (activeTime() - t0) / s.windup;
      probe.side = side; probe.k = k;
      drawArc(side, k);
      await waitActive(16);
    }
    armed = false;
    early = false;
    probe.armed = false;
    panel.classList.remove('is-armed');
    setArc(null);
    panel.style.setProperty('--k4-heat', '0');
    bg(foltan.play('attack', { once: true }));
    sfx('swing', { volume: 0.9 });
    // the swing itself: Foltan follows through, the streak crosses the yard
    pose(figF, side === 'high' ? 'strike-high' : 'strike-side', side === 'right');
    figF.classList.add('lunge');
    slash.classList.toggle('from-right', side === 'right');
    slash.classList.toggle('from-high', side === 'high');
    const success = judge(s, answer);
    pulse('fx-strike');
    notes[notes.length - 1].glyphs.push(`<i${success ? ' class="is-ok"' : ''}>${GLYPH[side]}</i>`);
    renderNotes();
    if (success) {
      ok++; streakMiss = 0;
      sfx('dodge', { volume: 0.9 });
      const d: Dodge = answer!;
      pulse('fx-dodge');
      result(s.phase === 'fast' ? 'Gelesen!' : 'Ausgewichen!', true);
      if (s.phase === 'fast') { reads++; pips[reads - 1]?.classList.add('on'); }
      if (d === 'duck') {
        pose(figL, 'duck');
        figL.classList.add('go-duck');
        bg(w.player.play('crouch' as CharAnim, { ms: 420 }));
      } else {
        pose(figL, 'dodge', d === 'left');
        figL.classList.add(d === 'left' ? 'go-left' : 'go-right');
        const off = d === 'left' ? -12 : 12;
        w.player.teleport([home.x + off, home.y]);
        await waitActive(260);
        w.player.teleport([home.x, home.y]);
      }
      w.fx.burst([w.player.x, w.player.y - 4], 'dust', 4);
    } else {
      hits++; streakMiss++;
      sfx('thud', { volume: 0.8 });
      w.camera.shake(160, 0.004);
      pulse('fx-hurt');
      result('Getroffen!', false);
      pose(figL, 'hurt');
      bg(w.player.play('hit', { ms: 380 }));
      const b = panel.querySelector(answer ? `[data-d="${answer}"]` : '.k4-bar');
      b?.classList.add('is-hit');
      void waitActive(360).then(() => b?.classList.remove('is-hit'));
      if (s.phase === 'fast' && streakMiss >= 2) remark('player', 'Zu schnell zum Zusehen. Ich muss vorher wissen, wohin.', 1700);
      else if (!answer) remark('player', 'Zu langsam … au.', 1200);
      else remark('player', 'Au! Falsche Seite.', 1000);
    }
    const next = afterStrike(st, success);
    st = next.state;
    if (next.event === 'speedup') {
      remark('foltan', 'Das war langsam. Jetzt in echt.', 1600);
      notes[notes.length - 1].read = true;
      renderNotes();
    } else if (next.event === 'switch' && need === undefined) {
      await waitActive(500);
      remark('foltan', 'Du liest mich wie eins deiner Bücher. Na schön. Neue Folge.', 2000);
      for (const l of notes) l.old = true;
      notes.push({ glyphs: [], read: false, old: false });
      renderNotes();
      await waitActive(reduced ? 300 : 900);
    }
    score.textContent = `Gelesen ${reads}/${goal}`;
    panel.querySelector('.k4-pips')?.setAttribute('aria-label', `Gelesen: ${reads} von ${goal}`);
    probe.ok = ok;
  }
  if ((st.done || (need !== undefined && ok >= need)) && w.alive) {
    await waitActive(500);
    pose(figF, 'ready');
    pose(figL, 'ready');
    figL.classList.remove('go-left', 'go-right', 'go-duck');
    figF.classList.remove('lunge');
    result('Geschafft!', true);
    pulse('fx-won');
    sfx('pickup', { volume: 0.6 });
    await waitActive(reduced ? 400 : 1000);
  }
  panel.classList.add('is-out');
  await waitActive(reduced ? 120 : 380);
  cleanup();
  G.state.set('k4-treffer', hits);
  return hits;
}

/** Puts Gundrik (watching the banner) and Jorin (waiting west of him) back to their drill marks. */
async function resetAblenken(w: WorldCtx): Promise<void> {
  w.actor('k4-gundrik').teleport([162, 298], 'left');
  w.actor('k4-jorin').teleport([70, 352], 'right');
  await w.wait(60);
}

/** Ablenken, part of the training: make Gundrik look away so Jorin can grab the banner (stone, then words). */
export async function ablenkDrill(w: WorldCtx): Promise<void> {
  await resetAblenken(w);
  w.setObjective('k4-ablenken-1', 'Wirf einen Stein, damit Gundrik von Jorin wegschaut.', 'k4-stein-fass');
  G.state.set('k4-ablenken-phase', 1);
  while (!G.state.is('k4-ablenken-stein-ok')) await w.wait(200);
  w.completeObjective('k4-ablenken-1');
  await w.actor('foltan').say('Steine hat man nicht immer. Jetzt mit Worten. Rede mit ihm, Lia. Er soll dich ansehen, nicht Jorin.');
  w.setObjective('k4-ablenken-2', 'Lenk Gundrik mit Worten ab.', 'k4-gundrik');
  G.state.set('k4-ablenken-phase', 2);
  while (!G.state.is('k4-ablenken-ok')) await w.wait(200);
  G.state.set('k4-ablenken-phase', 0);
  w.completeObjective('k4-ablenken-2');
}

/** A stone thrown at the barrel by the weapon rack (east, away from Jorin) or at the archery target (west, towards him). */
export async function throwStone(w: WorldCtx, good: boolean): Promise<void> {
  const gundrik = w.actor('k4-gundrik');
  const jorin = w.actor('k4-jorin');
  const foltan = w.actor('foltan');
  const at: [number, number] = good ? [396, 238] : [76, 248];
  await w.cutscene(async () => {
    w.player.face(at);
    sfx('throw', { volume: 0.8 });
    await w.wait(380);
    sfx(good ? 'block' : 'thud', { volume: 0.9 });
    w.fx.burst(at, 'dust', 6);
    bg(gundrik.emote('?'));
    gundrik.face(at);
    await gundrik.say(good ? 'Hä? Wer schmeißt da mit Steinen?' : 'Was klappert da an der Scheibe …?');
    if (good) {
      await jorin.walkTo(112, 250, { run: true });
      sfx('pickup', { volume: 0.7 });
      bg(jorin.emote('note'));
      await jorin.say('Hab’s! Das Banner gehört uns!');
      gundrik.face('k4-jorin');
      bg(gundrik.emote('anger'));
      await gundrik.say('Bei meinem Bart! Hinterhältig. Gut gemacht, Kleine.');
      G.state.set('k4-ablenken-stein-ok');
    } else {
      bg(gundrik.emote('!'));
      gundrik.face('k4-jorin');
      await gundrik.say('Und wen seh ich da? Jorin, du Hasenfuß! Zurück auf deinen Platz!');
      bg(jorin.emote('drop'));
      await foltan.say('Er hat genau dorthin geschaut, wo Jorin steht. Lenk ihn WEG von deinem Freund.');
    }
    await resetAblenken(w);
  });
}

/** Talk handler for Gundrik during round 2 of the distraction drill. */
export async function gundrikAblenken(w: WorldCtx): Promise<void> {
  const gundrik = w.actor('k4-gundrik');
  const jorin = w.actor('k4-jorin');
  const pick = await w.choose([
    '„Gundrik, stimmt es, dass in Moneda die Straßen aus Gold sind?“',
    '„Pass auf, Jorin schleicht sich an!“',
    '„Schöner Bart. Ist der echt?“',
  ]);
  await w.cutscene(async () => {
    if (pick === 1) {
      bg(gundrik.emote('!'));
      gundrik.face('k4-jorin');
      await gundrik.say('Ach ja? Danke für die Warnung. Jorin! Zurück!');
      bg(jorin.emote('drop'));
      await jorin.say('Lia! Auf wessen Seite bist du eigentlich?');
      await lia(w, 'Ich … wollte nur ehrlich sein.', 'surprised');
      await resetAblenken(w);
      return;
    }
    gundrik.face('player');
    if (pick === 0) {
      await gundrik.say('Gold? Pah! Die Straßen sind aus Granit, poliert, dass du dich darin spiegelst! Gold liegt in den Kammern, wo es hingehört …');
    } else {
      bg(gundrik.emote('anger'));
      await gundrik.say('ECHT? Hundertzwanzig Jahre Arbeit, Mädchen! Jeder Ring ein Sieg! Der hier ist von …');
    }
    await jorin.walkTo(112, 250, { run: true });
    sfx('pickup', { volume: 0.7 });
    await jorin.say('Hab’s!');
    gundrik.face('k4-jorin');
    bg(gundrik.emote('…'));
    await gundrik.say('… Ach, verflucht. Mit Worten, ja? Das merk ich mir.');
    G.state.set('k4-ablenken-ok');
  });
}

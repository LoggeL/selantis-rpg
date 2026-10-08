// DOM minigame panels of Kapitel III (Chronik style): the clue board („Lias Notizen“), „Sanft pusten“ and
// „Der Pflock“. Panels claim the keyboard through the UI modal stack (input lock, no key reaches the world).
// The scenes are painted (assets/minigames/k3-*, Codex, prompts in docs/rebuild/art/minigames.json, built by
// output/k3-panels-build.py); the code only adds light, particles, markings and the controls.
import { G } from '../../core/G';
import { clues as clueCatalog } from '../../core/catalog';
import { loadImage } from '../../art/assets';
import { assetUrl, manifest } from '../../art/manifest';
import type { UiApiExt } from '../../ui';
import { ctx, isConfirm } from '../../ui/context';
import { BOARD_CLUES, combine, DEDUCTIONS, FINAL, reconcileConclusion, recordDeduction } from './deduce';
import { blowConfig, blowStart, blowStep, stakeStart, stakeStep, stakeTug, type StakeState } from './games';
import { BEAT_MS, type Song } from './song';

const ui = () => G.ui as UiApiExt;
const sfx = (name: Parameters<typeof G.audio.sfx>[0], opts?: Parameters<typeof G.audio.sfx>[1]) => { try { G.audio.sfx(name, opts); } catch { /* audio optional */ } };
const touch = () => ctx.root?.classList.contains('is-touch') ?? false;
const reduced = () => ctx.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
/** URL of a painted minigame image (manifest first, conventional path as fallback). */
const art = (key: string, ext = 'png') => assetUrl(manifest().images[`minigames/${key}`]?.file ?? `assets/minigames/${key}.${ext}`);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

const STYLE = `
.k3-blow, .k3-stake { pointer-events: none; }
.k3-airflow, .k3-ring, .k3-pause { pointer-events: auto; }
.k3-pause { position: absolute; right: 1em; top: 1em; z-index: 10; }
/* ---------------------------------------------------------------- Lias Notizen: notes on the tavern table */
.k3-veil { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 1em; overflow: hidden;
  background: #0b0806 var(--k3-table) center / cover no-repeat; animation: k3-in .35s ease-out; }
.k3-veil::before { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(90% 85% at 62% 42%, transparent 35%, #05030299 75%, #050302ee 100%); }
.k3-veil::after { content: ''; position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen;
  background: radial-gradient(38% 46% at 94% 6%, #ffb55a40, transparent 70%); animation: k3-candle 2.6s ease-in-out infinite; }
.k3-veil.is-solved::after { background: radial-gradient(60% 70% at 70% 20%, #ffc76a55, transparent 75%); }
@keyframes k3-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes k3-candle { 0%, 100% { opacity: .85; } 37% { opacity: 1; } 52% { opacity: .7; } 70% { opacity: .95; } }
.k3-box { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(64em, 100%); max-height: 100%; overflow: auto; scrollbar-width: thin; }
.k3-head { display: flex; align-items: center; justify-content: space-between; gap: 1em; padding: .45em .6em .45em 1.1em; margin-bottom: .7em;
  background: linear-gradient(90deg, #0d121bf2, #0d121bd9 70%, #0d121b99); border: 1px solid var(--gold-line); border-radius: .4em; box-shadow: 0 .4em 1.2em #0009; }
.k3-box > .k3-head { margin-bottom: .55em; }
.k3-box > * { flex-shrink: 0; }
.k3-head .ch-title { font-size: 1.45em; text-shadow: 0 2px 6px #000; }
.k3-help { flex: 1; margin: 0; font-family: var(--f-body); font-style: italic; color: var(--parch); opacity: .9; font-size: 1em; text-align: center; }
.k3-close { flex: none; }
.k3-board { position: relative; }
.k3-grid { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8em 1.1em; padding: .2em .3em; }
.k3-threads { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.k3-threads path { fill: none; stroke: #a52f1b; stroke-width: 3; stroke-linecap: round; filter: drop-shadow(0 2px 1.5px #000b); }
.k3-threads path.is-new { stroke-dasharray: 1; animation: k3-draw .9s ease-out both; }
.k3-threads.is-under { z-index: 0; }
.k3-threads circle { fill: url(#k3-pin); stroke: #3a2410; stroke-width: 1; filter: drop-shadow(0 1.5px 1px #000c); }
@keyframes k3-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
.k3-card { --r: 0deg; position: relative; display: grid; grid-template-columns: 4.8em minmax(0, 1fr); align-items: center; gap: .2em .75em; min-height: 6.9em;
  padding: .85em 1.5em .85em 1em; text-align: left; font: inherit; color: var(--ink); cursor: pointer; border: 0; border-radius: .3em;
  background: var(--k3-paper) center / 100% 100% no-repeat; filter: drop-shadow(0 .35em .5em #000b);
  transform: rotate(var(--r)); transition: transform .18s var(--ease-out, ease-out), filter .18s; -webkit-tap-highlight-color: transparent; }
.k3-card:nth-child(1) { --r: -1.4deg; } .k3-card:nth-child(2) { --r: .9deg; } .k3-card:nth-child(3) { --r: -.6deg; }
.k3-card:nth-child(4) { --r: 1.1deg; } .k3-card:nth-child(5) { --r: -1deg; } .k3-card:nth-child(6) { --r: .7deg; }
.k3-card img { grid-row: 1 / span 2; justify-self: center; max-width: 100%; max-height: 6em; object-fit: contain; filter: drop-shadow(0 .15em .2em #0007); pointer-events: none; }
.k3-card b { align-self: end; display: block; font-family: var(--f-label); font-weight: 700; letter-spacing: .04em; font-size: 1em; line-height: 1.15; color: #2b1d12; }
.k3-card span { align-self: start; display: block; font-family: var(--f-body); font-size: .85em; line-height: 1.24; color: #3b2a1c; }
.k3-card:hover:not(.is-missing), .k3-card.is-focus { transform: rotate(var(--r)) translateY(-.2em) scale(1.02); filter: drop-shadow(0 .6em .7em #000c) drop-shadow(0 0 .45em #f3d68a99); }
.k3-card.is-focus { filter: drop-shadow(0 0 1.5px var(--gold-hi)) drop-shadow(0 0 1.5px var(--gold-hi)) drop-shadow(0 0 .7em #f3d68acc) drop-shadow(0 .6em .7em #000c); }
.k3-card.is-focus::before { content: '❖'; position: absolute; top: -.7em; left: 50%; transform: translateX(-50%); font-size: 1.35em; line-height: 1; color: var(--gold-hi); text-shadow: 0 0 .3em #000, 0 0 .2em #000, 0 0 .6em #f3d68a; pointer-events: none; }
/* Picked: lifted into the candle light, a charcoal ring around it. */
.k3-card.is-pick { transform: rotate(0deg) translateY(-.45em) scale(1.05); z-index: 3; filter: drop-shadow(0 .9em 1em #000d) drop-shadow(0 0 .9em #ffc76acc); }
.k3-card.is-pick::after { content: ''; position: absolute; inset: .35em .5em; border: 3px solid #2a1a10cc; border-radius: 50% / 46%; transform: rotate(-2deg); pointer-events: none;
  animation: k3-ring .35s ease-out both; }
@keyframes k3-ring { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
.k3-card.is-used { filter: drop-shadow(0 .3em .4em #000b) saturate(.8) brightness(.93); }
.k3-card.is-used b::after { content: ' ✓'; color: #6a3a14; font-size: 1.15em; }
.k3-pair { position: absolute; top: .35em; right: .7em; width: 1.7em; height: 1.7em; display: grid; place-items: center; border: 2px solid #2a1a10b0; border-radius: 50%;
  font: 700 .82em/1 var(--f-head); font-style: normal; color: #2a1a10; transform: rotate(-8deg); pointer-events: none; }
.k3-card.is-match { animation: k3-glow .9s ease-out; }
@keyframes k3-glow { 0% { filter: drop-shadow(0 0 0 #ffd27a00); } 30% { filter: drop-shadow(0 0 1.4em #ffd27a) brightness(1.12); } 100% { filter: drop-shadow(0 .3em .4em #000b); } }
.k3-card.is-wrong { animation: k3-shake .38s ease-out; }
.k3-card.is-wrong::after { content: ''; position: absolute; inset: 0; border-radius: .3em; background: radial-gradient(closest-side, #d4573b55, transparent); pointer-events: none; }
@keyframes k3-shake { 0%, 100% { transform: rotate(var(--r)); } 20% { transform: rotate(var(--r)) translateX(-.35em); } 45% { transform: rotate(var(--r)) translateX(.3em); } 70% { transform: rotate(var(--r)) translateX(-.18em); } }
/* Not found yet: a blank scrap with only the shape of the clue. */
.k3-card.is-missing { cursor: default; filter: drop-shadow(0 .25em .35em #000a) brightness(.62) sepia(.25); }
.k3-card.is-missing img { filter: brightness(0) opacity(.3); }
.k3-card.is-missing b { font-family: var(--f-head); letter-spacing: .3em; color: #4a3626; }
.k3-card.is-missing span { font-style: italic; color: #3f2f22; }
.k3-card.is-used.is-focus { filter: drop-shadow(0 0 1.5px var(--gold-hi)) drop-shadow(0 0 1.5px var(--gold-hi)) drop-shadow(0 0 .7em #f3d68acc) saturate(.8) brightness(.93); }
.k3-card.is-missing.is-focus { filter: drop-shadow(0 0 1.5px var(--gold-hi)) drop-shadow(0 0 .6em #f3d68a99) brightness(.62) sepia(.25); }
.k3-grid .k3-card.is-pick.is-pick { filter: drop-shadow(0 .9em 1em #000d) drop-shadow(0 0 .9em #ffc76acc); }
.k3-out { position: relative; z-index: 1; margin: .8em auto 0; width: min(46em, 100%); padding: .75em 1.3em; border-radius: .35em; min-height: 3em;
  font-family: var(--f-body); font-style: italic; font-size: 1.12em; line-height: 1.35; text-align: center; box-shadow: 0 .4em 1em #000a, inset 0 0 2em rgba(120,78,30,.32); }
.k3-out b { font-family: var(--f-head); font-style: normal; color: #6b2a10; letter-spacing: .05em; }
.k3-out.is-bad { color: #7a2e1f; animation: k3-shake .38s ease-out; --r: 0deg; }
.k3-out.is-final { font-size: 1.22em; box-shadow: 0 0 2em #ffc76a88, 0 .4em 1em #000a, inset 0 0 2em rgba(120,78,30,.32); }
.k3-done { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 0 1.6em; width: min(60em, 100%); margin: .45em auto 0; padding: .35em 2em; font-family: var(--f-body); font-size: .86em; line-height: 1.25; color: var(--parch);
  background: linear-gradient(90deg, transparent, #0d121bd9 12%, #0d121be6 50%, #0d121bd9 88%, transparent); text-shadow: 0 1px 2px #000; }
.k3-done:empty { display: none; }
.k3-done div { padding: .1em 0; }
.k3-done div:only-child { grid-column: 1 / -1; text-align: center; }
.k3-done div::before { content: '❖ '; color: var(--gold); }
.k3-done .is-final { grid-column: 1 / -1; color: var(--gold-hi); font-weight: 700; font-size: 1.06em; }
.k3-keys { position: relative; z-index: 1; margin-top: .55em; text-align: center; font-family: var(--f-label); font-size: 1em; letter-spacing: .05em; color: var(--parch); text-shadow: 0 1px 3px #000; }
.k3-keys .ch-key { margin: 0 .12em; }
.is-small .k3-veil { padding: .5em; }
.is-small .k3-head { margin-bottom: .45em; padding: .3em .4em .3em .8em; }
.is-small .k3-head .ch-title { font-size: 1.15em; }
.is-small .k3-help { display: none; }
.is-small .k3-grid { gap: .6em .7em; }
.is-small .k3-card { min-height: 0; grid-template-columns: 3.4em minmax(0, 1fr); padding: .8em 1em .8em .7em; }
.is-small .k3-card img { max-height: 3.6em; }
.is-small .k3-card b { align-self: center; font-size: .92em; }
.is-small .k3-card span { display: none; }
.is-small .k3-card.is-missing span { display: block; font-size: .78em; }
.is-small .k3-out { margin-top: .6em; padding: .5em .9em; min-height: 0; font-size: 1em; }
.is-small .k3-done { font-size: .86em; margin-top: .4em; padding: .3em 1em; }
.is-small .k3-keys { margin-top: .4em; }
.is-portrait .k3-veil { align-items: flex-start; background-position: 70% center; }
.is-portrait .k3-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.is-portrait .k3-done { grid-template-columns: 1fr; }
.is-portrait .k3-card { grid-template-columns: 1fr; grid-template-rows: auto auto; justify-items: center; text-align: center; padding: 1em .8em .9em; }
.is-portrait .k3-card img { grid-row: auto; max-height: 4.6em; }
.is-portrait .k3-card b { align-self: center; }
@media (max-height: 480px) and (orientation: landscape) { .k3-card { padding: .55em .9em .55em .6em; } .k3-card img { max-height: 2.8em; } .k3-head .ch-title { font-size: 1em; } }

/* ---------------------------------------------------------------- painted scenes (blow, stake) */
.k3-scene { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 1em; touch-action: manipulation;
  background: radial-gradient(ellipse at 50% 45%, #05080e99 25%, #030509f0 100%); --k3-foot: 8.6em; }
.k3-frame { position: relative; display: flex; flex-direction: column; width: min(100%, 1060px, calc((100dvh - 2em - var(--k3-foot) - var(--k3-extra, 0em)) * 16 / 9));
  max-height: 100%; padding: 0; overflow: hidden; animation: k3-rise .35s var(--ease-out, ease-out); box-shadow: 0 1.2em 3em #000c, 0 0 0 1px #000; }
.k3-frame::before, .k3-frame::after { z-index: 4; }
@keyframes k3-rise { from { transform: translateY(1em); opacity: 0 } to { transform: none; opacity: 1 } }
.k3-illustration { position: relative; flex: none; width: 100%; aspect-ratio: 16 / 9; background: #0b0f17; border-bottom: 1px solid var(--gold-line); overflow: hidden; }
.k3-illustration .mini-illustration { position: absolute; inset: 0; width: 100%; height: 100%; display: block; image-rendering: auto; }
.k3-illustration::after { content: ''; position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 4em #000a; }
.k3-illustration .ch-title { position: absolute; z-index: 3; top: .7em; left: 0; margin: 0; padding: .3em 2.6em .36em 1.1em; font-size: clamp(1.05em, 2.8vmin, 1.65em);
  white-space: nowrap; pointer-events: none; text-shadow: 0 2px 6px #000; background: linear-gradient(90deg, #0d121bf0, #0d121be0 60%, transparent); }
.k3-illustration .ch-title::after { content: ''; position: absolute; left: .9em; right: 25%; bottom: 0; height: 1px; background: linear-gradient(90deg, var(--gold), transparent); }
.k3-sub, .k3-lyric { position: absolute; z-index: 3; left: 50%; bottom: .9em; transform: translateX(-50%); max-width: 86%; margin: 0; padding: .35em 1.8em .4em;
  font-family: var(--f-body); font-style: italic; font-size: clamp(1em, 2.5vmin, 1.32em); line-height: 1.25; text-align: center; white-space: nowrap; color: var(--parch);
  text-shadow: 0 1px 3px #000; pointer-events: none; background: linear-gradient(90deg, transparent, #0d121be0 14%, #0d121bf0 50%, #0d121be0 86%, transparent);
  border-top: 1px solid #d8b25a44; border-bottom: 1px solid #d8b25a44; transition: color .2s; }
.k3-sub:empty, .k3-lyric:empty { display: none; }
.k3-is-puff .k3-sub, .k3-sub.is-bad { color: #ffb19e; }
.k3-sub.is-good { color: #ffe2a6; }
.k3-sub.is-win { color: var(--gold-hi); font-family: var(--f-head); font-style: normal; letter-spacing: .06em; font-size: clamp(1.2em, 3.2vmin, 1.7em); }
.k3-lyric { color: #f1d48a; }
.k3-illustration.is-puff .mini-illustration { animation: k3-ash .6s ease-out; }
@keyframes k3-ash { 0% { filter: grayscale(.9) brightness(.7); } 100% { filter: none; } }
.k3-foot { position: relative; flex: none; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .55em 1.1em;
  padding: .9em 1.4em 1em; background: linear-gradient(180deg, #151c2b, #0c1019); }
.k3-hint { min-width: 0; text-align: center; font-family: var(--f-label); letter-spacing: .05em; font-size: 1.02em; line-height: 1.6; color: var(--parch); }
.k3-hint .ch-key { margin: 0 .15em; font-size: .95em; }
.k3-hint b { color: #ffcf7a; font-weight: 700; }
.k3-gauge { display: flex; align-items: center; gap: .55em; min-width: 0; width: 11em; }
.k3-gauge .ch-label { color: var(--gold); font-size: .95em; white-space: nowrap; }
.k3-bar { position: relative; flex: 1; min-width: 4em; height: .9em; border-radius: .45em; background: #070a10; border: 1px solid var(--gold-line); overflow: hidden; box-shadow: inset 0 1px 3px #000; }
.k3-bar > i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: .45em; transition: width .12s linear; background: linear-gradient(90deg, #4a1606, #9b3410 35%, #e2701f 70%, #ffd27a); box-shadow: 0 0 .8em #ff8a3488; }
.k3-bar.is-loose > i { background: linear-gradient(90deg, #5b4220, #b8913c 55%, #f3d68a); box-shadow: 0 0 .8em #f3d68a66; }
.k3-bar.is-noise > i { background: linear-gradient(90deg, #5a170c, #a3402a 55%, #ff8466); box-shadow: 0 0 .8em #d4573b88; }
.k3-bar.is-noise.is-hot { border-color: var(--danger, #d4573b); animation: k3-pulse .5s ease-in-out infinite; }
@keyframes k3-pulse { 50% { box-shadow: 0 0 .9em #d4573bcc, inset 0 1px 3px #000; } }
/* Breath meter: the glow field to hold, the needle = breath strength; the range input lies invisibly on top. */
.k3-meter { grid-column: 1 / -1; position: relative; height: 2.4em; border-radius: 1.2em; overflow: hidden;
  background: repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), #d8b25a1f calc(10% - 1px) 10%), linear-gradient(90deg, #0b1020, #182030 55%, #2a1410);
  border: 1px solid var(--gold-line); box-shadow: inset 0 .2em .5em #000c, 0 0 0 3px #0b0f17, 0 0 0 4px #d8b25a33; }
.k3-meter-rail { position: absolute; top: 0; bottom: 0; left: .7em; right: .7em; pointer-events: none; }
.k3-zone { position: absolute; top: .24em; bottom: .24em; border-radius: 1em; background: radial-gradient(ellipse at 50% 55%, #fff1c2 0%, #ffc45a 30%, #e2701f 62%, #8a2c0e00 100%);
  box-shadow: 0 0 1em #ff9a3c88; opacity: .8; }
.k3-blow.is-in .k3-zone { opacity: 1; box-shadow: 0 0 1.6em #ffbe5ccc, 0 0 .3em #fff1c2; }
.k3-blow.is-over .k3-meter { border-color: var(--danger, #d4573b); }
.k3-needle { position: absolute; top: -.1em; bottom: -.1em; width: .5em; margin-left: -.25em; }
.k3-needle::before { content: ''; position: absolute; left: 50%; top: .15em; bottom: .15em; width: .24em; margin-left: -.12em; border-radius: .12em;
  background: linear-gradient(#fff6dc, var(--parch) 50%, #c9b993); box-shadow: 0 0 .5em #fff3d0dd, 0 0 0 1px #0009; }
.k3-needle::after { content: ''; position: absolute; left: 50%; top: 50%; width: .8em; height: .8em; margin: -.4em 0 0 -.4em; transform: rotate(45deg);
  background: radial-gradient(circle at 35% 35%, #fff6dc, var(--gold) 60%, var(--gold-lo)); box-shadow: 0 0 0 1px #0008, 0 0 .5em #f3d68a; }
.k3-meter-ends { position: absolute; inset: 0 1em; display: flex; justify-content: space-between; align-items: center; pointer-events: none; font-family: var(--f-label); font-size: .8em; color: var(--parch-dim); letter-spacing: .06em; }
.k3-airflow { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: ew-resize; touch-action: none; }
.k3-airflow:focus-visible + .k3-meter-ends { color: var(--gold-hi); }
/* The drum: an approach ring closes in on the drumhead; hit = gold, miss = red. */
.k3-drum { position: relative; width: 4.6em; height: 4.6em; display: grid; place-items: center; }
.k3-ring { position: relative; z-index: 1; width: 3.6em; height: 3.6em; border-radius: 50%; display: grid; place-items: center; font-family: var(--f-head); font-size: 1em; color: #3b2414;
  background: radial-gradient(circle at 42% 38%, #f6e6c4, #d9bb86 55%, #9b7444 100%); border: .3em solid #6b4a26; box-shadow: 0 0 0 2px var(--gold-lo), 0 .3em .6em #000a, inset 0 0 .6em #6b4a2688;
  transition: transform .08s, box-shadow .15s, filter .15s; }
.k3-approach { position: absolute; inset: .5em; border-radius: 50%; border: 2px solid var(--gold-hi); box-shadow: 0 0 .6em #f3d68a99; transform: scale(var(--a, 1.6)); opacity: var(--ao, .9); pointer-events: none; }
.k3-ring.is-beat { transform: scale(1.12); box-shadow: 0 0 0 2px var(--gold-hi), 0 0 1.4em #ffc76acc, inset 0 0 .6em #6b4a2688; }
.k3-ring.is-rest { filter: grayscale(.8) brightness(.55); }
.k3-ring.is-hit { box-shadow: 0 0 0 3px #ffe08a, 0 0 1.8em #ffc76a, inset 0 0 .6em #6b4a2688; }
.k3-ring.is-miss { box-shadow: 0 0 0 3px var(--danger, #d4573b), 0 0 1.6em #d4573bcc, inset 0 0 .6em #6b4a2688; animation: k3-shake-x .25s; }
@keyframes k3-shake-x { 25% { transform: translateX(-.2em); } 75% { transform: translateX(.2em); } }
.k3-stake-meters { display: grid; grid-template-columns: 1fr 1fr; gap: .45em 1.1em; min-width: 0; }
.k3-stake-meters .k3-gauge { width: auto; }
.k3-stake .k3-hint { grid-column: 1 / -1; }
.k3-watch { position: absolute; z-index: 3; top: .8em; right: .8em; max-width: 60%; padding: .35em 1em; font-family: var(--f-label); letter-spacing: .06em; font-size: clamp(.95em, 2.3vmin, 1.2em);
  color: #fff4ec; text-shadow: 0 1px 2px #000; background: linear-gradient(90deg, #4a1208f5, #7a2414f8); border: 1px solid #ff8466; border-radius: .3em; box-shadow: 0 0 1.2em #d4573b88, 0 .3em .8em #000a; pointer-events: none; }
.k3-watch:empty { display: none; }
.k3-watch.is-on { animation: k3-alarm .5s ease-in-out infinite; }
.k3-watch.is-free { color: #2b1d12; background: linear-gradient(90deg, #f3d68a, #ffe9b0); border-color: var(--gold-hi); box-shadow: 0 0 1.4em #f3d68aaa; animation: none; }
@keyframes k3-alarm { 50% { border-color: #ffc2b0; box-shadow: 0 0 2em #ff6a4acc, 0 .3em .8em #000a; } }
.interaction-preview-nav ~ .k3-blow .k3-scene, .interaction-preview-nav ~ .k3-stake .k3-scene { padding-top: 4em; --k3-extra: 3em; }
/* Phone portrait: a tall window onto the scene, the controls stacked below it. */
.is-portrait .k3-scene { padding: .5em; --k3-foot: 10.5em; }
.is-portrait .k3-frame { width: 100%; }
.is-portrait .k3-illustration { aspect-ratio: 3 / 4; max-height: calc(100dvh - var(--k3-foot) - 2em - var(--k3-extra, 0em)); }
.is-portrait .k3-foot { grid-template-columns: 1fr auto; padding: .8em .9em .9em; gap: .7em .8em; }
.is-portrait .k3-hint { grid-column: 1 / -1; font-size: 1.08em; }
.is-portrait .k3-sub, .is-portrait .k3-lyric { white-space: normal; width: 92%; padding: .35em .8em .4em; }
.is-portrait .k3-meter { height: 2.8em; border-radius: 1.4em; }
.is-portrait .k3-gauge { width: auto; }
.is-portrait .k3-watch { left: .6em; right: .6em; top: 3.2em; max-width: none; text-align: center; }
.is-portrait .k3-stake .k3-foot { grid-template-columns: auto minmax(0, 1fr); }
.is-portrait .k3-stake-meters { grid-template-columns: 1fr; }
@media (max-height: 480px) and (orientation: landscape) {
  .k3-scene { padding: .3em; --k3-foot: 5.6em; }
  .k3-frame { width: min(100%, calc((100dvh - .6em - var(--k3-foot) - var(--k3-extra, 0em)) * 2)); }
  .k3-illustration { aspect-ratio: 2 / 1; }
  .interaction-preview-nav ~ .k3-blow .k3-scene, .interaction-preview-nav ~ .k3-stake .k3-scene { padding-top: 3.4em; --k3-extra: 3.1em; }
  .k3-foot { padding: .45em .9em .5em; gap: .35em .8em; }
  .k3-meter { height: 1.9em; }
  .k3-illustration .ch-title { top: .3em; font-size: 1em; }
  .k3-sub, .k3-lyric { bottom: .4em; font-size: .95em; }
  .k3-hint { font-size: .98em; line-height: 1.4; }
  .k3-hint-long { display: none; }
  .k3-drum { width: 3.4em; height: 3.4em; } .k3-ring { width: 2.8em; height: 2.8em; }
  .k3-watch { top: .4em; font-size: .9em; }
  .k3-stake-meters { grid-template-columns: 1fr; gap: .2em; }
  .k3-stake .k3-hint { grid-column: 3; max-width: 12em; }
}
.k3-hint-short { display: none; }
@media (max-height: 480px) and (orientation: landscape) { .k3-hint-short { display: inline; } }
.reduced-motion .k3-veil, .reduced-motion .k3-veil::after, .reduced-motion .k3-frame, .reduced-motion .k3-card, .reduced-motion .k3-card::after, .reduced-motion .k3-out,
.reduced-motion .k3-threads path, .reduced-motion .k3-watch, .reduced-motion .k3-ring, .reduced-motion .k3-bar.is-noise, .reduced-motion .k3-illustration .mini-illustration { animation: none !important; }
@media (prefers-reduced-motion: reduce) {
  .k3-veil, .k3-veil::after, .k3-frame, .k3-card, .k3-card::after, .k3-out, .k3-threads path, .k3-watch, .k3-ring, .k3-bar.is-noise, .k3-illustration .mini-illustration { animation: none !important; }
}
`;

function injectStyle(): void {
  if (document.getElementById('k3-style')) return;
  const s = document.createElement('style');
  s.id = 'k3-style';
  s.textContent = STYLE;
  document.head.appendChild(s);
}

function keyHint(desktop: string, mobile: string): string { return touch() ? mobile : desktop; }

// ------------------------------------------------------------------------------------------------ painted stage

interface Fit { s: number; ox: number; oy: number; w: number; h: number }

/**
 * A canvas on a painted backdrop: loads the images, keeps the canvas at device resolution and maps image
 * coordinates (0..1 of the backdrop) to the canvas. Sets `has-mini-art` / `data-art` on the host (test hook).
 */
function paintedStage(host: HTMLElement, label: string, files: Record<string, string>) {
  const canvas = document.createElement('canvas');
  canvas.className = 'mini-illustration is-painted';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  host.prepend(canvas);
  host.classList.add('has-mini-art');
  host.dataset.art = 'loading';
  const g = canvas.getContext('2d')!;
  const pics = new Map<string, HTMLImageElement>();
  const ready = Promise.all(Object.entries(files).map(async ([id, file]) => { const im = await loadImage(file); if (im) pics.set(id, im); })).then(() => {
    const ok = pics.size === Object.keys(files).length;
    host.dataset.art = ok ? 'ready' : 'failed';
    return ok;
  });
  /** Resizes the canvas to its box; returns false while hidden. */
  const size = (): boolean => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    return true;
  };
  /** Cover-fit of an image into the canvas, keeping `focus` (fractions) as central as the edges allow. */
  const cover = (im: HTMLImageElement, fx: number, fy: number, zoom = 1): Fit => {
    const W = canvas.width, H = canvas.height;
    const s = Math.max(W / im.width, H / im.height) * zoom;
    const w = im.width * s, h = im.height * s;
    const ox = Math.min(0, Math.max(W - w, W / 2 - fx * w));
    const oy = Math.min(0, Math.max(H - h, H / 2 - fy * h));
    return { s, ox, oy, w, h };
  };
  return { canvas, g, pics, ready, size, cover };
}

/** Soft additive light. */
function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number, inner: string, outer: string): void {
  if (alpha <= 0.002 || r <= 0) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, inner); grad.addColorStop(0.35, outer); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, alpha); g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}

/** A soft round puff (smoke, breath, dust): a cached radial sprite, so particles have no hard edge. */
const puffs = new Map<string, HTMLCanvasElement>();
function puff(color: string): HTMLCanvasElement {
  let c = puffs.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color); grad.addColorStop(0.45, color.replace(/[\d.]+\)$/, '0.55)')); grad.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
    puffs.set(color, c);
  }
  return c;
}

// ------------------------------------------------------------------------------------------------ clue board

/** Hints for clues not found yet (where to look). */
const MISSING_HINT: Record<string, string> = {
  'k3-seilfasern': 'Der Pfeiler in der Mitte … genau hinsehen?',
  'k3-zwerg': 'Der Zwerg in der Ecke weicht jedem Blick aus.',
  'k3-kette': 'Hinter der Schenke liegt der Stall.',
  'k3-haarband': 'Im Stroh des Stalls. Ganz genau hinsehen.',
  'k3-schminke': 'Die Schankmaid ist auffallend schlecht gelaunt.',
  'k3-wette': 'Die Spielleute haben gestern etwas gehört.',
};

/**
 * „Lias Notizen“: pick two clues that belong together. Resolves when closed. Returns the number of new deductions.
 * Lia's scraps of paper lie on the table of the Golden Boar; pairs she has worked out are joined by a charcoal line.
 */
export function openClueBoard(): Promise<number> {
  injectStyle();
  reconcileConclusion(G.state);
  const root = ui().panel('k3-notes');
  const veil = document.createElement('div');
  veil.className = 'k3-veil';
  veil.style.setProperty('--k3-table', `url("${art('k3-notes-table', 'jpg')}")`);
  veil.style.setProperty('--k3-paper', `url("${art('k3-notes-paper')}")`);
  const box = document.createElement('div');
  box.className = 'k3-box';
  box.innerHTML = `<div class="k3-head"><span class="ch-title">Lias Notizen</span>
      <p class="k3-help">Wähle zwei Hinweise, die zusammengehören. Was passt, schreibe ich als Schluss auf.</p>
      <button class="ch-btn k3-close" type="button">Schließen</button></div>
    <div class="k3-board"><svg class="k3-threads is-under" aria-hidden="true"></svg><div class="k3-grid"></div><svg class="k3-threads is-over" aria-hidden="true"></svg></div>
    <div class="k3-out ch-parch" aria-live="polite"></div><div class="k3-done"></div>
    <div class="k3-keys">${keyHint('<span class="ch-key">←</span><span class="ch-key">→</span><span class="ch-key">↑</span><span class="ch-key">↓</span> wählen · <span class="ch-key">E</span> / <span class="ch-key">Enter</span> markieren · <span class="ch-key">Esc</span> schließen', 'Zwei Zettel antippen, die zusammengehören')}</div>`;
  veil.appendChild(box);
  root.appendChild(veil);
  const grid = box.querySelector('.k3-grid') as HTMLElement;
  const threads = box.querySelector('.k3-threads.is-over') as SVGSVGElement;
  const under = box.querySelector('.k3-threads.is-under') as SVGSVGElement;
  const out = box.querySelector('.k3-out') as HTMLElement;
  const done = box.querySelector('.k3-done') as HTMLElement;
  out.textContent = 'Was weiß ich schon?';
  let picked: string | null = null;
  let focus = 0;
  let made = 0;
  let fresh: string | null = null;
  const flash = new Map<string, string>();
  const cards: HTMLButtonElement[] = [];

  const used = (id: string) => G.state.data.clues.some(c => c.startsWith('k3-schluss') && combineParts(c).includes(id));
  const drawThreads = () => {
    const base = threads.getBoundingClientRect();
    if (!base.width) return;
    let paths = '', below = '';
    for (const d of DEDUCTIONS) {
      if (!G.state.hasClue(d.id)) continue;
      const [a, b] = d.pair.map(id => cards.find(c => c.dataset.clue === id)?.getBoundingClientRect());
      if (!a || !b) continue;
      // A pin in the middle of each facing edge (just inside the paper); the red thread runs between them.
      const pins = (r: DOMRect) => {
        const ix = Math.min(14, r.width * 0.06), iy = Math.min(12, r.height * 0.1);
        const cx = r.left + r.width / 2 - base.left, cy = r.top + r.height / 2 - base.top;
        return [[r.left - base.left + ix, cy], [r.right - base.left - ix, cy], [cx, r.top - base.top + iy], [cx, r.bottom - base.top - iy]];
      };
      let best = [0, 0, 0, 0], dist = Infinity;
      for (const [ax, ay] of pins(a)) for (const [bx, by] of pins(b)) { const dd = Math.hypot(bx - ax, by - ay); if (dd < dist) { dist = dd; best = [ax, ay, bx, by]; } }
      const [ax, ay, bx, by] = best;
      const sag = Math.min(14, dist * 0.08);
      // Neighbours: the thread spans the gap on top. Farther apart it runs under the paper (only the pins show on top).
      const far = dist > Math.min(a.width, b.width) * 0.45;
      const line = `<path pathLength="1" class="${fresh === d.id ? 'is-new' : ''}" d="M${ax.toFixed(1)},${ay.toFixed(1)} Q${((ax + bx) / 2).toFixed(1)},${((ay + by) / 2 + sag).toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}"/>`;
      if (far) below += line; else paths += line;
      paths += `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="5.5"/><circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="5.5"/>`;
    }
    under.innerHTML = below;
    threads.innerHTML = `<defs><radialGradient id="k3-pin" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#fff2c4"/><stop offset=".45" stop-color="#d4a548"/><stop offset="1" stop-color="#6b4a1c"/></radialGradient></defs>${paths}`;
  };
  const render = () => {
    grid.textContent = '';
    cards.length = 0;
    BOARD_CLUES.forEach((id, index) => {
      const found = G.state.hasClue(id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'k3-card';
      b.dataset.clue = id;
      const icon = `<img src="${art(`k3-clue-${id.slice(3)}`)}" alt="" draggable="false">`;
      if (!found) {
        b.classList.add('is-missing');
        b.innerHTML = `${icon}<b>? ? ?</b><span>${MISSING_HINT[id]}</span>`;
        b.disabled = true;
        b.setAttribute('aria-label', `Noch nicht gefunden: ${MISSING_HINT[id]}`);
      } else {
        const def = clueCatalog.get(id);
        b.innerHTML = `${icon}<b>${def?.title ?? id}</b><span>${def?.text ?? ''}</span>`;
        b.title = def?.text ?? '';
        if (used(id)) {
          b.classList.add('is-used');
          const n = DEDUCTIONS.findIndex(d => d.pair.includes(id as never) && G.state.hasClue(d.id));
          if (n >= 0) b.insertAdjacentHTML('beforeend', `<i class="k3-pair" aria-hidden="true">${['I', 'II', 'III'][n]}</i>`);
        }
        if (picked === id) b.classList.add('is-pick');
        b.setAttribute('aria-pressed', String(picked === id));
        b.addEventListener('click', () => { focus = index; pick(id); });
      }
      const fx = flash.get(id);
      if (fx) b.classList.add(fx);
      grid.appendChild(b);
      cards.push(b);
    });
    flash.clear();
    cards.forEach((c, i) => c.classList.toggle('is-focus', i === focus && !touch()));
    done.textContent = '';
    for (const id of [...G.state.data.clues.filter(c => c.startsWith('k3-schluss') && c !== FINAL), ...(G.state.hasClue(FINAL) ? [FINAL] : [])]) {
      const d = document.createElement('div');
      d.textContent = clueCatalog.get(id)?.text ?? id;
      if (id === FINAL) d.className = 'is-final';
      done.appendChild(d);
    }
    veil.classList.toggle('is-solved', G.state.hasClue(FINAL));
    requestAnimationFrame(() => { if (root.isConnected) drawThreads(); fresh = null; });
  };

  const pick = (id: string) => {
    if (!G.state.hasClue(id)) return;
    sfx('page', { volume: 0.6 });
    out.classList.remove('is-bad', 'is-final');
    if (!picked || picked === id) {
      picked = picked === id ? null : id;
      // On small screens the cards only show titles: the picked note is read out below.
      if (picked && ctx.root?.classList.contains('is-small')) out.textContent = clueCatalog.get(id)?.text ?? '';
      render();
      return;
    }
    const first = picked;
    const d = combine(first, id);
    picked = null;
    if (!d) {
      void out.offsetWidth;
      out.classList.add('is-bad');
      out.textContent = 'Nein … das gehört nicht zusammen.';
      flash.set(first, 'is-wrong'); flash.set(id, 'is-wrong');
      sfx('ui-cancel');
    } else if (G.state.hasClue(d.id)) {
      out.textContent = 'Das habe ich schon aufgeschrieben.';
    } else {
      out.textContent = d.line;
      sfx('write');
      const recorded = recordDeduction(G.state, d);
      fresh = d.id;
      flash.set(first, 'is-match'); flash.set(id, 'is-match');
      if (recorded.added) made++;
      if (recorded.concluded) {
        setTimeout(() => {
          if (!root.isConnected) return;
          sfx('discover', { volume: 0.7 });
          out.classList.add('is-final');
          out.innerHTML = '<b>Kyra lebt.</b> Sie war letzte Nacht hier – in derselben Nacht, in der ich Crios sah.';
          render();
          // Short screens scroll the board: bring the conclusion into view.
          requestAnimationFrame(() => out.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }));
        }, 900);
      }
    }
    render();
  };

  return new Promise<number>(resolve => {
    let closeModal = () => {};
    const offLayout = ctx.onLayout(() => requestAnimationFrame(() => { if (root.isConnected) drawThreads(); }));
    const close = () => {
      closeModal();
      offLayout();
      root.remove();
      sfx('ui-close');
      resolve(made);
    };
    closeModal = ctx.open({
      id: 'k3-notes',
      onKey: e => {
        if (e.key === 'Escape' || e.key === 'i' || e.key === 'I') { close(); return true; }
        const cols = ctx.root?.classList.contains('is-portrait') ? 2 : 3;
        const move = (d: number) => { focus = (focus + d + cards.length) % cards.length; render(); };
        if (e.key === 'ArrowRight' || e.key === 'd') { move(1); return true; }
        if (e.key === 'ArrowLeft' || e.key === 'a') { move(-1); return true; }
        if (e.key === 'ArrowDown' || e.key === 's') { move(cols); return true; }
        if (e.key === 'ArrowUp' || e.key === 'w') { move(-cols); return true; }
        if (isConfirm(e)) { if (!e.repeat) pick(BOARD_CLUES[focus]); return true; }
        return true;
      },
    });
    box.querySelector('.k3-close')!.addEventListener('click', close);
    sfx('ui-open');
    render();
  });
}

function combineParts(deduction: string): string[] {
  for (const a of BOARD_CLUES) for (const b of BOARD_CLUES) { const d = combine(a, b); if (d?.id === deduction) return [a, b]; }
  return [];
}

// ------------------------------------------------------------------------------------------------ Sanft pusten

/** Where things sit in the painted blow scene (fractions of the 16:9 image). */
const NEST = { x: 0.44, y: 0.535 };

interface Mote { x: number; y: number; vx: number; vy: number; life: number; max: number; kind: 'breath' | 'smoke' | 'spark' | 'ash' | 'straw'; size: number }

/** Lia blows on Azar's glowing tinder. Resolves when the flame catches. */
export function blowGame(withTinder: boolean): Promise<void> {
  injectStyle();
  const cfg = blowConfig(withTinder);
  const root = ui().panel('k3-blow');
  const keys = '<span class="ch-key">←</span><span class="ch-key">→</span> oder <span class="ch-key">A</span><span class="ch-key">D</span>';
  root.innerHTML = `<div class="k3-scene"><div class="k3-frame ch-panel">
    <div class="k3-illustration"><div class="ch-title">Sanft pusten</div><div class="k3-sub" aria-live="polite">${withTinder ? 'Mein Zunder ist trocken. Ganz vorsichtig …' : 'Nicht zu fest, sonst ist die Glut wieder aus.'}</div></div>
    <div class="k3-foot">
      <div class="k3-meter"><div class="k3-meter-rail"><div class="k3-zone"></div><div class="k3-needle"></div></div>
        <input class="k3-airflow" type="range" min="0" max="100" value="0" aria-label="Atemstärke"><div class="k3-meter-ends"><span>sacht</span><span>kräftig</span></div></div>
      <div class="k3-gauge"><span class="ch-label">Glut</span><div class="k3-bar"><i class="k3-ember-fill"></i></div></div>
      <div class="k3-hint">${keyHint(`${keys}: <b>Atem</b> im <b>Glutfeld</b> halten<span class="k3-hint-long"> · Regler ziehen</span>`, 'Regler ziehen: <b>Atem</b> im <b>Glutfeld</b> halten')}</div>
      <div></div>
    </div>
  </div></div>`;
  const pause = document.createElement('button');
  pause.className = 'ch-btn k3-pause'; pause.type = 'button'; pause.textContent = 'Pause';
  pause.addEventListener('click', () => ui().openMenu()); root.appendChild(pause);
  const stageEl = root.querySelector('.k3-illustration') as HTMLElement;
  const zone = root.querySelector('.k3-zone') as HTMLElement;
  const needle = root.querySelector('.k3-needle') as HTMLElement;
  const sub = root.querySelector('.k3-sub') as HTMLElement;
  const fill = root.querySelector('.k3-ember-fill') as HTMLElement;
  const airflow = root.querySelector<HTMLInputElement>('.k3-airflow')!;
  const stage = paintedStage(stageEl, 'Lia hält das Zundernest mit der Glut in den Händen und pustet sanft hinein. Azar kniet daneben.', {
    scene: art('k3-blow-scene', 'jpg'), flame: art('feuer-flame'),
  });
  const motes: Mote[] = [];
  let time = 0, flare = 0, catchAt = -1;
  const nest = { x: 0, y: 0, u: 1 };
  const spawn = (m: Omit<Mote, 'life'>) => { if (motes.length < 260) motes.push({ ...m, life: 0 }); };

  const paint = (ember: number, breath: number, inZone: boolean, over: boolean, dt: number) => {
    if (!stage.size()) return;
    const { g, canvas, pics } = stage;
    const W = canvas.width, H = canvas.height;
    const scene = pics.get('scene');
    g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
    if (!scene) return;
    const portrait = H > W;
    const fit = stage.cover(scene, portrait ? 0.47 : 0.5, 0.5, portrait ? 1.05 : 1);
    const px = (fx: number) => fit.ox + fx * fit.w, py = (fy: number) => fit.oy + fy * fit.h;
    const u = fit.h / 720; // 1 px of the 1280×720 scene
    const calm = reduced();
    time += dt;
    const nx = px(NEST.x), ny = py(NEST.y);
    nest.x = nx; nest.y = ny; nest.u = u;
    // Breath shakes the nest a little; blowing too hard makes it shiver.
    const shake = calm ? 0 : (over ? Math.sin(time * 70) * 2.2 : Math.sin(time * 23) * breath * 0.8) * u;
    g.drawImage(scene, fit.ox + shake * 0.15, fit.oy, fit.w, fit.h);
    // Night: the scene darkens around the nest, the glow warms it.
    const dark = g.createRadialGradient(nx, ny, 40 * u, nx, ny, Math.max(W, H) * 0.95);
    dark.addColorStop(0, 'rgba(6,8,18,0)'); dark.addColorStop(1, `rgba(6,8,18,${0.55 - ember * 0.25})`);
    g.fillStyle = dark; g.fillRect(0, 0, W, H);
    const flicker = calm ? 1 : 0.88 + Math.sin(time * 11) * 0.06 + Math.sin(time * 17.3) * 0.06;
    const heat = clamp01(0.12 + ember * 0.88 + (inZone ? 0.12 : 0) + flare);
    glow(g, nx, ny, (140 + 420 * ember) * u * (0.9 + flicker * 0.1), (0.18 + ember * 0.5) * flicker, 'rgba(255,190,110,0.55)', 'rgba(220,90,30,0.25)');
    glow(g, nx, ny, (22 + 60 * heat) * u, heat * flicker, 'rgba(255,246,200,1)', 'rgba(255,140,40,0.75)');
    // Embers inside the nest.
    g.save(); g.globalCompositeOperation = 'lighter';
    const coals = Math.round(4 + ember * 20);
    for (let i = 0; i < coals; i++) {
      const a = hash(i) * Math.PI * 2, r = (6 + hash(i + 9) * 34 * (0.4 + ember)) * u;
      const tw = calm ? 0.8 : 0.5 + 0.5 * Math.sin(time * (4 + hash(i + 3) * 6) + i);
      g.globalAlpha = clamp01((0.25 + ember * 0.75) * tw);
      g.fillStyle = hash(i + 5) > 0.5 ? '#ffd27a' : '#ff8a3c';
      const s = Math.max(1.5, (2 + hash(i + 2) * 3) * u);
      g.fillRect(nx + Math.cos(a) * r - s / 2, ny + Math.sin(a) * r * 0.45 - s / 2, s, s);
    }
    g.restore();
    // Particles: breath from the upper left, smoke and sparks rising.
    const n = calm ? 0.35 : 1;
    for (let b = 0; b < 2; b++) if (breath > 0.05 && Math.random() < breath * 1.6 * n) {
      const sx = px(0.13) + (Math.random() - 0.5) * 60 * u, sy = py(0.1) + (Math.random() - 0.5) * 50 * u;
      const k = (0.55 + breath * 1.1) / 1.2;
      spawn({ kind: 'breath', x: sx, y: sy, vx: (nx - sx) * k + (Math.random() - 0.5) * 40 * u, vy: (ny - 30 * u - sy) * k + (Math.random() - 0.5) * 40 * u, max: 1.2, size: (14 + Math.random() * 18) * u });
    }
    if (ember > 0.18 && Math.random() < (0.15 + ember * 0.7) * n) spawn({ kind: 'smoke', x: nx + (Math.random() - 0.5) * 30 * u, y: ny - 10 * u, vx: (Math.random() - 0.3) * 14 * u, vy: -(30 + Math.random() * 30) * u, max: 2.6, size: (10 + Math.random() * 12) * u });
    if (ember > 0.45 && inZone && Math.random() < ember * 0.5 * n) spawn({ kind: 'spark', x: nx + (Math.random() - 0.5) * 40 * u, y: ny - 8 * u, vx: (Math.random() - 0.5) * 60 * u, vy: -(80 + Math.random() * 120) * u, max: 0.9, size: (2 + Math.random() * 2.5) * u });
    if (over && Math.random() < 0.6 * n) spawn({ kind: 'straw', x: nx + (Math.random() - 0.5) * 50 * u, y: ny - 10 * u, vx: (60 + Math.random() * 120) * u, vy: -(20 + Math.random() * 60) * u, max: 0.9, size: (5 + Math.random() * 5) * u });
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      m.life += dt;
      if (m.life >= m.max) { motes.splice(i, 1); continue; }
      const t = m.life / m.max;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.kind === 'smoke' || m.kind === 'ash') { m.vx += Math.sin(time * 1.3 + i) * 6 * u * dt; m.size += 14 * u * dt; }
      if (m.kind === 'spark') m.vy += 40 * u * dt;
      if (m.kind === 'straw') m.vy += 160 * u * dt;
      g.save();
      if (m.kind === 'breath') {
        g.globalAlpha = Math.sin(t * Math.PI) * 0.055 * (0.4 + breath) * (0.35 + t);
        const r = m.size * 1.5 * (1 + t);
        g.translate(m.x, m.y); g.rotate(Math.atan2(m.vy, m.vx)); g.scale(1, 0.45);
        g.drawImage(puff('rgba(233,230,220,1)'), -r, -r, r * 2, r * 2);
      } else if (m.kind === 'smoke' || m.kind === 'ash') {
        g.globalAlpha = Math.sin(t * Math.PI) * (m.kind === 'ash' ? 0.3 : 0.24);
        const r = m.size * 1.7;
        g.drawImage(puff(m.kind === 'ash' ? 'rgba(139,139,134,1)' : 'rgba(169,164,154,1)'), m.x - r, m.y - r, r * 2, r * 2);
      } else if (m.kind === 'spark') {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 1 - t;
        g.fillStyle = t < 0.4 ? '#fff0b0' : '#ff9a3c';
        g.fillRect(m.x, m.y, m.size, m.size);
      } else {
        g.globalAlpha = 1 - t;
        g.fillStyle = '#d9b45a';
        g.translate(m.x, m.y); g.rotate(time * 8 + i); g.fillRect(-m.size / 2, -0.8 * u, m.size, 1.6 * u);
      }
      g.restore();
    }
    // The flame catches.
    const flame = pics.get('flame');
    const f = catchAt >= 0 ? clamp01((time - catchAt) / 0.45) : smooth(0.86, 1, ember) * 0.35;
    if (flame && f > 0) {
      const fh = (90 + 150 * f) * u * (calm ? 1 : 0.95 + Math.sin(time * 13) * 0.05);
      const fw = fh * flame.width / flame.height;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 + f * 0.65;
      g.drawImage(flame, nx - fw / 2, ny + 6 * u - fh, fw, fh); g.restore();
      glow(g, nx, ny - fh * 0.4, fh * 2.2, f * 0.45, 'rgba(255,210,120,0.7)', 'rgba(255,120,40,0.25)');
    }
    flare = Math.max(0, flare - dt * 1.6);
  };

  let state = blowStart();
  return new Promise<void>(resolve => {
    let last = performance.now();
    let finished = false;
    let finishing = 0;
    let puffUntil = 0;
    const epoch = ctx.epoch;
    const alive = () => root.isConnected && epoch === ctx.epoch && !ctx.stale();
    const setBreath = (value: number) => { state = { ...state, breath: Math.max(0, Math.min(1, value)) }; };
    airflow.addEventListener('input', () => setBreath(Number(airflow.value) / 100));
    let breathLoop: { stop(ms?: number): void; set(o: { volume?: number }): void } | null = null;
    const closeModal = ctx.open({
      id: 'k3-blow',
      allowMenu: true,
      releaseKeys: ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'],
      onKey: e => {
        if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) {
          setBreath(state.breath + (['ArrowLeft', 'KeyA'].includes(e.code) ? -0.13 : 0.13));
          return true;
        }
        return e.key !== 'Escape';
      },
    });
    const frame = (now: number) => {
      if (finished) return;
      if (!alive()) { closeModal(); breathLoop?.stop(); return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden || !document.hasFocus() || ctx.top()?.id !== 'k3-blow') { breathLoop?.stop(100); breathLoop = null; requestAnimationFrame(frame); return; }
      if (finishing) {
        paint(1, 0, true, false, dt);
        finishing = Math.max(0, finishing - dt);
        if (!finishing) { finished = true; closeModal(); root.remove(); resolve(); return; }
        requestAnimationFrame(frame);
        return;
      }
      const r = blowStep(state, dt, 0, cfg);
      state = r.state;
      if (state.breath > 0.08 && !breathLoop) { try { breathLoop = G.audio.loop('whoosh', { interval: 0.42, volume: 0.25 }); } catch { breathLoop = null; } }
      if (state.breath <= 0.08 && breathLoop) { breathLoop.stop(150); breathLoop = null; }
      breathLoop?.set({ volume: 0.15 + state.breath * 0.35 });
      const lo = cfg.lo + state.drift, hi = cfg.hi + state.drift;
      const inZone = state.breath >= lo && state.breath <= hi, over = state.breath > hi;
      airflow.value = String(state.breath * 100);
      zone.style.left = `${lo * 100}%`;
      zone.style.width = `${(cfg.hi - cfg.lo) * 100}%`;
      needle.style.left = `${state.breath * 100}%`;
      fill.style.width = `${state.ember * 100}%`;
      root.classList.toggle('is-in', inZone);
      root.classList.toggle('is-over', over);
      paint(state.ember, state.breath, inZone, over, dt);
      stageEl.classList.toggle('is-puff', now < puffUntil);
      root.dataset.ember = state.ember.toFixed(3);
      root.dataset.breath = state.breath.toFixed(3);
      root.dataset.lo = lo.toFixed(3);
      root.dataset.hi = hi.toFixed(3);
      if (r.event === 'puff') {
        sfx('whoosh', { volume: 0.6, pitch: 0.7 });
        puffUntil = now + 600;
        sub.className = 'k3-sub is-bad';
        sub.textContent = 'Zu fest! Die Glut wäre fast ausgegangen.';
        const u = nest.u;
        for (let i = 0; i < (reduced() ? 5 : 14); i++) motes.push({ kind: 'ash', x: nest.x, y: nest.y - 10 * u, vx: (Math.random() - 0.5) * 90 * u, vy: -(20 + Math.random() * 70) * u, life: 0, max: 1.4, size: (8 + Math.random() * 10) * u });
      } else if (now >= puffUntil && state.ember > 0.55) { sub.className = 'k3-sub is-good'; sub.textContent = 'Es qualmt … weiter so!'; }
      else if (now >= puffUntil && over) { sub.className = 'k3-sub is-bad'; sub.textContent = 'Zu fest …'; }
      else if (now >= puffUntil && inZone && state.ember > 0.08) { sub.className = 'k3-sub is-good'; sub.textContent = 'Die Glut wird heller …'; }
      if (r.event === 'catch') {
        finishing = 0.65;
        breathLoop?.stop(100);
        sfx('fire-ignite');
        sub.className = 'k3-sub is-win';
        sub.textContent = 'Eine Flamme!';
        catchAt = time; flare = 0.8;
        requestAnimationFrame(frame);
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

// ------------------------------------------------------------------------------------------------ Der Pflock

/** Positions in the painted camp (fractions of the 16:9 image). */
const CAMP = { fire: { x: 0.493, y: 0.425 }, guard: { x: 0.7, y: 0.515, h: 0.235 } };

/**
 * Kyra rocks the stake loose in time with the soldiers' drum. A soldier turns round at full noise; tugging while he
 * looks costs progress. `onLook` lets the world show it (a bark over the soldier). Resolves when the stake is out.
 */
export function stakeGame(song: Song, onLook?: (on: boolean) => void): Promise<void> {
  injectStyle();
  const root = ui().panel('k3-stake');
  root.innerHTML = `<div class="k3-scene"><div class="k3-frame ch-panel">
    <div class="k3-illustration"><div class="ch-title">Der Pflock</div><div class="k3-watch" aria-live="assertive"></div><div class="k3-lyric">Die Trommel setzt ein …</div></div>
    <div class="k3-foot">
      <div class="k3-drum"><div class="k3-approach"></div><button class="k3-ring" type="button" aria-label="Im Takt am Pflock rütteln">♪</button></div>
      <div class="k3-stake-meters">
        <div class="k3-gauge"><span class="ch-label">Pflock locker</span><div class="k3-bar is-loose"><i class="k3-loose"></i></div></div>
        <div class="k3-gauge"><span class="ch-label">Lärm</span><div class="k3-bar is-noise"><i class="k3-noise"></i></div></div>
      </div>
      <div class="k3-hint">${keyHint('<span class="ch-key">E</span> · <span class="ch-key">Leertaste</span> · Klick <b>im Takt der Trommel</b><span class="k3-hint-long">. In den Pausen: stillhalten!</span>', 'Tippen <b>im Takt der Trommel</b><span class="k3-hint-long">. In den Pausen: stillhalten!</span>')}</div>
    </div>
  </div></div>`;
  const pause = document.createElement('button');
  pause.className = 'ch-btn k3-pause'; pause.type = 'button'; pause.textContent = 'Pause';
  pause.addEventListener('click', () => ui().openMenu()); root.appendChild(pause);
  const stageEl = root.querySelector('.k3-illustration') as HTMLElement;
  const lyric = root.querySelector('.k3-lyric') as HTMLElement;
  const ring = root.querySelector('.k3-ring') as HTMLElement;
  const approach = root.querySelector('.k3-approach') as HTMLElement;
  const loose = root.querySelector('.k3-loose') as HTMLElement;
  const noise = root.querySelector('.k3-noise') as HTMLElement;
  const noiseBar = noise.parentElement as HTMLElement;
  const watch = root.querySelector('.k3-watch') as HTMLElement;
  const stage = paintedStage(stageEl, 'Kyra rüttelt an dem Pflock, an den sie gekettet ist. Am Lagerfeuer singen die Dunkelschatten, Algard trinkt am Fass.', {
    scene: art('k3-stake-scene', 'jpg'), post: art('k3-stake-post'), mound: art('k3-stake-mound'),
    back: art('k3-stake-algard-back'), look: art('k3-stake-algard-look'),
  });
  const layer = document.createElement('canvas');
  const lg = layer.getContext('2d')!;
  const crumbs: Mote[] = [];
  let time = 0, wobble = 0, wobbleDir = 1, rattle = 0, freed = -1, beatFlash = 0;

  const paint = (s: StakeState, watching: boolean, dt: number) => {
    if (!stage.size()) return;
    const { g, canvas, pics } = stage;
    const W = canvas.width, H = canvas.height;
    const scene = pics.get('scene'), post = pics.get('post'), mound = pics.get('mound');
    g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
    if (!scene || !post || !mound) return;
    const calm = reduced();
    time += dt;
    const portrait = H > W;
    const fit = stage.cover(scene, portrait ? 0.55 : 0.5, portrait ? 0.46 : 0.5);
    const px = (fx: number) => fit.ox + fx * fit.w, py = (fy: number) => fit.oy + fy * fit.h;
    g.drawImage(scene, fit.ox, fit.oy, fit.w, fit.h);
    // Fire light flickers over the camp; the drum beat flares it.
    const fx = px(CAMP.fire.x), fy = py(CAMP.fire.y), u = fit.h / 720;
    const fl = calm ? 1 : 0.85 + Math.sin(time * 9.7) * 0.08 + Math.sin(time * 15.1) * 0.07;
    glow(g, fx, fy, 260 * u * fl, 0.32 + beatFlash * 0.25, 'rgba(255,190,110,0.6)', 'rgba(230,100,30,0.22)');
    // Algard by the keg: drinking with his back to her, or turned round and staring.
    const guard = pics.get(watching ? 'look' : 'back');
    if (guard) {
      const gh = CAMP.guard.h * fit.h, gw = gh * guard.width / guard.height;
      const sway = watching || calm ? 0 : Math.sin(time * 1.1) * 0.025;
      // Contact shadow on the grass, then the figure. Mirrored: the painted rim light then falls from the fire
      // (left of him), and when he turns round he looks over towards the stake.
      g.save(); g.translate(px(CAMP.guard.x), py(CAMP.guard.y));
      const sh = g.createRadialGradient(0, 0, 0, 0, 0, gw * 0.42);
      sh.addColorStop(0, 'rgba(6,8,12,0.55)'); sh.addColorStop(1, 'rgba(6,8,12,0)');
      g.fillStyle = sh; g.scale(1, 0.22); g.beginPath(); g.arc(0, 0, gw * 0.42, 0, Math.PI * 2); g.fill();
      g.restore();
      g.save(); g.translate(px(CAMP.guard.x), py(CAMP.guard.y)); g.rotate(sway); g.scale(-1, 1);
      g.drawImage(guard, -gw / 2, -gh, gw, gh);
      g.restore();
      const hx = px(CAMP.guard.x), hy = py(CAMP.guard.y) - gh;
      if (watching) {
        glow(g, hx, hy + gh * 0.4, gh * 0.9, 0.4 + (calm ? 0 : Math.sin(time * 14) * 0.15), 'rgba(255,110,80,0.6)', 'rgba(212,87,59,0.3)');
        mark(g, hx, hy - 8 * u, 56 * u, '!', '#ff7a5c');
      } else if (s.noise > 0.55) mark(g, hx, hy - 8 * u, 42 * u, '?', '#f3d68a', clamp01((s.noise - 0.55) / 0.3));
    }
    // Night over everything but the fire; danger tints the edges red.
    const night = g.createRadialGradient(fx, fy, 60 * u, fx, fy, Math.max(W, H));
    night.addColorStop(0, 'rgba(8,10,24,0)'); night.addColorStop(1, 'rgba(8,10,24,0.45)');
    g.fillStyle = night; g.fillRect(0, 0, W, H);
    const danger = watching ? 0.55 : s.noise * 0.3 + rattle * 0.4;
    if (danger > 0.02) {
      const red = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      red.addColorStop(0, 'rgba(160,30,15,0)'); red.addColorStop(1, `rgba(160,30,15,${danger})`);
      g.fillStyle = red; g.fillRect(0, 0, W, H);
    }
    // The stake with Kyra's hands, anchored to the left edge (the arms leave the picture there).
    const ph = (portrait ? 0.5 : 0.92) * H, pw = ph * post.width / post.height;
    const baseX = pw * 0.511, baseY = H;  // stake centre at its foot
    const shiftX = -0.05 * ph;            // the cut arms reach past the left edge, so wobbling never shows their ends
    const p = s.loose;
    const freeT = freed >= 0 ? clamp01((time - freed) / 0.6) : 0;
    const lift = (p * p * 0.035 + freeT * 0.12) * ph; // the stained foot below the clay line is 0.165·ph long
    const angle = (calm ? 0 : Math.sin(time * 38) * wobble * (0.015 + p * 0.04)) * wobbleDir + p * 0.025 + freeT * 0.05;
    if (layer.width !== Math.ceil(pw) || layer.height !== Math.ceil(ph)) { layer.width = Math.ceil(pw); layer.height = Math.ceil(ph); }
    lg.clearRect(0, 0, layer.width, layer.height);
    lg.save();
    lg.translate(baseX, ph - 0.12 * ph - lift); lg.rotate(angle); lg.translate(-baseX, -(ph - 0.12 * ph));
    lg.drawImage(post, 0, 0, pw, ph);
    lg.restore();
    lg.drawImage(mound, 0, 0, pw, ph);
    // Moonlit night on the painted cut-out, warm fire light from the right.
    lg.save(); lg.globalCompositeOperation = 'source-atop';
    lg.fillStyle = 'rgba(14,18,40,0.42)'; lg.fillRect(0, 0, layer.width, layer.height);
    const warm = lg.createLinearGradient(0, 0, layer.width, 0);
    warm.addColorStop(0.45, 'rgba(255,150,70,0)'); warm.addColorStop(1, `rgba(255,150,70,${0.16 * fl + beatFlash * 0.08})`);
    lg.fillStyle = warm; lg.fillRect(0, 0, layer.width, layer.height);
    lg.restore();
    g.drawImage(layer, shiftX, baseY - ph);
    // Clay crumbs and dust at the foot of the stake.
    for (let i = crumbs.length - 1; i >= 0; i--) {
      const m = crumbs[i];
      m.life += dt;
      if (m.life >= m.max) { crumbs.splice(i, 1); continue; }
      m.x += m.vx * dt; m.y += m.vy * dt; m.vy += (m.kind === 'smoke' ? -10 : 900) * u * dt;
      const t = m.life / m.max;
      g.save();
      g.globalAlpha = (1 - t) * (m.kind === 'smoke' ? 0.45 : 1);
      g.fillStyle = '#5a3a20';
      if (m.kind === 'smoke') { const r = m.size * 1.8 * (1 + t * 2); g.drawImage(puff('rgba(111,90,68,1)'), m.x - r, m.y - r, r * 2, r * 2); }
      else g.fillRect(m.x, m.y, m.size, m.size);
      g.restore();
    }
    // Chain rattle: a few bright glints along the chain when she tugs off the beat.
    if (rattle > 0.05 && !calm) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const t = i / 5, cx = pw * (0.02 + t * 0.36), cy = H - ph + ph * (0.38 - t * 0.2);
        g.globalAlpha = rattle * (0.4 + 0.6 * hash(i + Math.floor(time * 30)));
        g.fillStyle = '#ffe9c0'; g.fillRect(cx - 2 * u, cy - 2 * u, 4 * u, 4 * u);
      }
      g.restore();
    }
    wobble = Math.max(0, wobble - dt * 3.2);
    rattle = Math.max(0, rattle - dt * 2.5);
    beatFlash = Math.max(0, beatFlash - dt * 4);
    // Where the clay breaks (for burst positions).
    footX = baseX + shiftX; footY = H - ph * 0.12; unit = u;
  };
  let footX = 0, footY = 0, unit = 1;
  const burst = (n: number, strength: number) => {
    if (reduced()) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const smoke = i % 3 === 0;
      crumbs.push({ kind: smoke ? 'smoke' : 'ash', x: footX + (Math.random() - 0.5) * 60 * unit, y: footY - Math.random() * 10 * unit,
        vx: (Math.random() - 0.5) * 220 * unit * strength, vy: -(smoke ? 20 : 120 + Math.random() * 240) * unit * strength, life: 0, max: smoke ? 1.1 : 0.7, size: (smoke ? 10 : 3 + Math.random() * 4) * unit });
    }
  };

  let state: StakeState = stakeStart();
  let rest = false;
  let lastBeatAt = performance.now();
  return new Promise<void>(resolve => {
    let finished = false;
    let finishing = 0;
    const epoch = ctx.epoch;
    const alive = () => root.isConnected && epoch === ctx.epoch && !ctx.stale();
    const active = () => !document.hidden && document.hasFocus() && ctx.top()?.id === 'k3-stake';
    const offs: (() => void)[] = [];
    offs.push(song.onBeat(b => {
      rest = b.rest;
      lastBeatAt = b.at;
      root.dataset.rest = rest ? '1' : '0';
      ring.classList.toggle('is-rest', rest);
      ring.textContent = rest ? '…' : '♪';
      if (rest) lyric.textContent = 'Sie trinken. Still jetzt!';
      if (!rest) { beatFlash = 1; ring.classList.add('is-beat'); setTimeout(() => ring.classList.remove('is-beat'), 110); }
    }));
    offs.push(song.onLine(text => { lyric.textContent = `„${text}“`; }));
    const tug = () => {
      if (finished || finishing || !active()) return;
      const now = performance.now();
      const r = stakeTug(state, now, lastBeatAt, song.nextBeatAt, rest);
      state = r.state;
      ring.classList.remove('is-hit', 'is-miss');
      void ring.offsetWidth;
      if (r.result === 'hit') {
        ring.classList.add('is-hit');
        wobble = 1; wobbleDir = -wobbleDir;
        burst(5, 0.6 + state.loose * 0.6);
        sfx('thud', { volume: 0.25, pitch: 1.6, key: 'k3-stake' });
      } else {
        ring.classList.add('is-miss');
        rattle = 1; wobble = 0.5;
        sfx('chain', { volume: r.result === 'caught' ? 0.9 : 0.55 });
        if (r.result === 'caught') { watch.textContent = 'Er hat etwas gehört! Kyra erstarrt.'; onLook?.(false); }
      }
      root.dataset.loose = state.loose.toFixed(3);
      if (state.loose >= 1) finish();
    };
    const closeModal = ctx.open({
      id: 'k3-stake',
      allowMenu: true,
      onKey: e => { if (isConfirm(e)) { if (!e.repeat) tug(); return true; } return e.key !== 'Escape'; },
    });
    ring.addEventListener('click', tug);
    let last = performance.now();
    const frame = (now: number) => {
      if (!alive()) { if (!finished) { closeModal(); offs.forEach(o => o()); } return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!active()) { requestAnimationFrame(frame); return; }
      if (finishing) {
        paint(state, false, dt);
        finishing = Math.max(0, finishing - dt);
        if (!finishing) { finished = true; closeModal(); root.remove(); resolve(); return; }
        requestAnimationFrame(frame); return;
      }
      if (!finished) {
        const r = stakeStep(state, dt);
        state = r.state;
        if (r.event === 'look') { watch.textContent = 'Ein Kerl dreht sich um! Stillhalten!'; watch.classList.add('is-on'); sfx('suspicious'); onLook?.(true); }
        if (r.event === 'away') { watch.textContent = ''; watch.classList.remove('is-on'); onLook?.(false); }
        if (state.watch <= 0 && watch.classList.contains('is-on')) watch.classList.remove('is-on');
        // The approach ring closes in on the drumhead until the next beat.
        const span = Math.max(1, song.nextBeatAt - lastBeatAt) || BEAT_MS;
        const t = clamp01((now - lastBeatAt) / span);
        approach.style.setProperty('--a', String(1 + (1 - t) * 0.75));
        approach.style.setProperty('--ao', rest || state.watch > 0 ? '0' : String(0.25 + t * 0.75));
        loose.style.width = `${state.loose * 100}%`;
        noise.style.width = `${state.noise * 100}%`;
        noiseBar.classList.toggle('is-hot', state.noise > 0.7 || state.watch > 0);
        root.dataset.next = String(song.nextBeatAt);
        root.dataset.last = String(lastBeatAt);
        root.dataset.watch = state.watch > 0 ? '1' : '0';
      }
      paint(state, !finished && state.watch > 0, dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const finish = () => {
      finishing = 0.7;
      offs.forEach(o => o());
      freed = time;
      burst(18, 1.4);
      loose.style.width = '100%';
      sfx('thud', { volume: 0.8, pitch: 0.6 });
      sfx('chain', { volume: 0.4 });
      watch.classList.remove('is-on');
      watch.classList.add('is-free');
      watch.textContent = 'Der Pflock gibt nach!';
    };
  });
}

/** A hand-drawn alarm or question mark over a head (marking, not an object). */
function mark(g: CanvasRenderingContext2D, x: number, y: number, size: number, text: string, color: string, alpha = 1): void {
  if (alpha <= 0.01) return;
  g.save();
  g.globalAlpha = alpha;
  g.font = `700 ${Math.round(size)}px Cinzel, Georgia, serif`;
  g.textAlign = 'center'; g.textBaseline = 'bottom';
  g.lineWidth = Math.max(2, size * 0.16); g.strokeStyle = '#1a0d08';
  g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y);
  g.restore();
}

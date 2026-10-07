// The packing puzzle as a painted close-up (Chronik frame, G.ui.panel). Rules: ./packing.ts.
// Art (Codex, prompts in docs/rebuild/art/minigames.json, build: output/packen-build.py): the kitchen table at dawn
// (minigames/packen-table), the open leather bag (packen-bag) and one cut-out per extra (packen-<item>).
// The code only adds light, dust, glow, the room gauge and the flight of an item into the bag.
import { manifest } from '../../art/manifest';
import { items } from '../../core/catalog';
import { G } from '../../core/G';
import { settings } from '../../core/settings';
import { add, CAPACITY, EXTRAS, FIXED, remove, used, verdict, type Owned, type Selection } from './packing';
import { sfx } from './shared';

const CSS = `
.k1-pack { overflow: hidden; background: #0b0a0c; font-family: var(--f-body); color: var(--parch); animation: k1-fade 0.4s ease-out; --k1-item: 8.6em; }
@keyframes k1-fade { from { opacity: 0; } to { opacity: 1; } }
.k1-pack-bg { position: absolute; inset: 0; background-size: cover; background-position: center 62%; transform: scale(1.03); animation: k1-pan 26s ease-in-out infinite alternate; }
@keyframes k1-pan { from { transform: scale(1.03) translate(0, 0); } to { transform: scale(1.06) translate(-0.8%, -0.6%); } }
.k1-pack-shade { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(120% 90% at 55% 58%, transparent 45%, rgba(8, 6, 10, 0.62) 100%), linear-gradient(180deg, rgba(10, 9, 14, 0.55), transparent 22%, transparent 74%, rgba(8, 7, 10, 0.7)); }
.k1-pack-beam { position: absolute; inset: -10% -20%; pointer-events: none; mix-blend-mode: screen; opacity: 0.55;
  background: linear-gradient(118deg, transparent 38%, rgba(255, 214, 140, 0.16) 46%, rgba(255, 224, 160, 0.24) 52%, rgba(255, 214, 140, 0.1) 58%, transparent 66%);
  animation: k1-beam 7s ease-in-out infinite alternate; }
@keyframes k1-beam { from { opacity: 0.4; } to { opacity: 0.7; } }
.k1-pack-mote { position: absolute; width: 0.28em; height: 0.28em; border-radius: 50%; pointer-events: none; background: rgba(255, 230, 180, 0.85); box-shadow: 0 0 0.5em rgba(255, 210, 140, 0.7);
  opacity: 0; animation: k1-mote var(--d, 11s) linear var(--w, 0s) infinite; }
@keyframes k1-mote { 0% { opacity: 0; transform: translate(0, 0); } 15% { opacity: 0.8; } 85% { opacity: 0.6; } 100% { opacity: 0; transform: translate(var(--dx, -3em), var(--dy, 6em)); } }

.k1-pack-card { position: relative; height: 100%; display: grid; gap: 0.4em 2em; padding: 0.9em 2.2em 1em;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; grid-template-areas: "head head" "table bag" "foot foot"; }
.k1-pack-head { grid-area: head; justify-self: center; text-align: center; }
.k1-pack-card h2 { margin: 0; font-size: 1.7em; text-shadow: 0 0.08em 0.4em rgba(0, 0, 0, 0.9), 0 0 1.2em rgba(216, 178, 90, 0.25); }
.k1-pack-card h2::before, .k1-pack-card h2::after { content: '❦'; display: inline-block; margin: 0 0.6em; font-size: 0.55em; vertical-align: 0.3em; color: var(--gold); opacity: 0.8; }
.k1-pack-card h2::before { transform: scaleX(-1); }
.k1-pack-hint { margin-top: 0.1em; font-family: var(--f-label); letter-spacing: 0.06em; font-size: 0.95em; color: var(--parch); text-shadow: 0 0.06em 0.3em #000, 0 0 0.6em #000; }
.k1-pack-hint .ch-key, .k1-pack-key { display: inline-grid; place-items: center; min-width: 1.5em; height: 1.5em; padding: 0 0.3em; margin: 0 0.15em; border-radius: 0.3em;
  font-family: var(--f-label); font-size: 0.85em; color: var(--ink); background: linear-gradient(180deg, var(--parch), var(--parch-2)); border: 1px solid var(--gold-lo); box-shadow: 0 0.12em 0 var(--gold-lo); }

/* ---- the table: painted objects lying on the oak planks */
.k1-pack-table { grid-area: table; align-self: end; justify-self: center; display: grid; grid-template-columns: repeat(3, var(--k1-item)); justify-content: center; align-content: end; gap: 0.6em 1.4em; padding-bottom: 0.4em; }
.k1-pack-item { position: relative; display: grid; justify-items: center; width: var(--k1-item); padding: 0.3em 0.2em 0.2em; border-radius: 0.8em; color: var(--parch);
  text-align: center; cursor: pointer; touch-action: manipulation; transition: transform 0.2s var(--ease-out); }
.k1-pack-obj { position: relative; display: grid; place-items: end center; width: 100%; height: calc(var(--k1-item) * 0.82); }
.k1-pack-obj::before { content: ''; position: absolute; left: 50%; bottom: 0.1em; width: 74%; height: 22%; transform: translateX(-50%); border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255, 210, 120, 0.55), rgba(255, 190, 90, 0.18) 60%, transparent); opacity: 0; transition: opacity 0.2s; }
.k1-pack-obj img { position: relative; max-width: 100%; max-height: 100%; height: var(--k1-h, 100%); width: auto; object-fit: contain; image-rendering: auto;
  filter: drop-shadow(0.1em 0.35em 0.25em rgba(20, 10, 4, 0.75)); transition: transform 0.22s var(--ease-back), filter 0.2s, opacity 0.25s; }
.k1-pack-item:hover:not(:disabled) .k1-pack-obj img, .k1-pack-item.is-focus .k1-pack-obj img { transform: translateY(-0.35em) rotate(-2deg); filter: drop-shadow(0.15em 0.7em 0.35em rgba(20, 10, 4, 0.6)) brightness(1.08); }
.k1-pack-item:hover:not(:disabled) .k1-pack-obj::before, .k1-pack-item.is-focus .k1-pack-obj::before { opacity: 1; }
.k1-pack-item.is-focus .k1-pack-tag { box-shadow: inset 0 0 0 2px rgba(255, 248, 228, 0.45), 0 0 0 2px var(--gold-hi), 0 0 1em rgba(243, 214, 138, 0.55), 0 0.2em 0.5em rgba(0, 0, 0, 0.6); }
.k1-pack-tag { position: relative; margin-top: 0.35em; max-width: 100%; min-width: min(100%, 6.6em); padding: 0.2em 0.6em 0.25em; border-radius: 0.2em 0.5em 0.25em 0.45em; color: var(--ink); line-height: 1.15;
  rotate: var(--k1-tilt, 0deg); background: radial-gradient(120% 90% at 30% 20%, #f7eed8, transparent 70%), linear-gradient(180deg, #efe2c2, #dcc79a);
  border: 1px solid rgba(120, 88, 34, 0.85); box-shadow: inset 0 0 0 2px rgba(255, 248, 228, 0.45), inset 0 0 0 3px rgba(138, 106, 44, 0.3), 0 0.2em 0.5em rgba(0, 0, 0, 0.6);
  transition: box-shadow 0.2s, background 0.2s; }
.k1-pack-name { display: block; font-weight: 700; font-size: 0.86em; }
.k1-pack-size { display: inline-flex; gap: 0.22em; align-items: center; font-family: var(--f-label); font-size: 0.72em; color: var(--ink-soft); letter-spacing: 0.05em; }
.k1-pack-size i { width: 0.62em; height: 0.62em; border-radius: 50%; display: inline-block; background: radial-gradient(circle at 35% 35%, var(--gold-hi), var(--gold) 55%, var(--gold-lo)); box-shadow: 0 0 0 1px rgba(90, 60, 20, 0.6); }
.k1-pack-tag .k1-pack-key { position: absolute; top: -0.75em; left: -0.6em; z-index: 2; font-size: 0.8em; }
.k1-pack-note { display: block; font-size: 0.72em; font-style: italic; color: var(--ink-soft); }
.k1-pack-check { position: absolute; top: -1.15em; right: -0.75em; z-index: 2; display: grid; place-items: center; width: 1.9em; height: 1.9em; border-radius: 50%;
  font-family: var(--f-label); font-size: 0.8em; color: #fff3d6; background: radial-gradient(circle at 38% 32%, #c4553c, #8e2a1c 70%); box-shadow: 0 0 0 2px rgba(110, 30, 18, 0.7), 0 0.15em 0.35em rgba(0, 0, 0, 0.6);
  opacity: 0; transform: scale(0.3) rotate(-30deg); transition: opacity 0.15s, transform 0.25s var(--ease-back); }
/* Packed: the object has left the table, only its outline in the dust remains. */
.k1-pack .k1-pack-item.is-in:not(:disabled) .k1-pack-obj img { opacity: 0.34; mix-blend-mode: multiply; filter: brightness(0.15) sepia(1) blur(0.06em); transform: none; }
.k1-pack .k1-pack-item.is-in:not(:disabled):hover .k1-pack-obj img, .k1-pack .k1-pack-item.is-in.is-focus .k1-pack-obj img { opacity: 0.42; }
.k1-pack-item.is-in .k1-pack-check { opacity: 1; transform: scale(1) rotate(-8deg); }
.k1-pack-item.is-in .k1-pack-tag { background: linear-gradient(180deg, #f6dfa2, #d8b25a); }
.k1-pack-item:disabled { cursor: default; }
.k1-pack-item:disabled .k1-pack-obj img { opacity: 0.6; filter: brightness(0) drop-shadow(0 0 0.08em rgba(255, 228, 176, 0.85)); }
.k1-pack-item:disabled .k1-pack-tag { background: rgba(30, 24, 20, 0.82); color: var(--parch-dim); border-color: rgba(216, 178, 90, 0.35); box-shadow: 0 0.2em 0.5em rgba(0, 0, 0, 0.6); }
.k1-pack-gone { display: none; font-family: var(--f-label); font-size: 0.72em; letter-spacing: 0.08em; color: #e6a28c; }
.k1-pack-item:disabled .k1-pack-note { color: var(--parch-dim); }
.k1-pack-item.shake { animation: k1-shake 0.36s; }
@keyframes k1-shake { 20% { transform: translateX(-0.4em) rotate(-2deg); } 50% { transform: translateX(0.35em) rotate(2deg); } 80% { transform: translateX(-0.15em); } }
.k1-pack-item.shake:not(:disabled) .k1-pack-tag { background: linear-gradient(180deg, #f3c9b6, #dc9a80); }
.k1-pack-item.shake:disabled .k1-pack-tag { border-color: var(--danger); box-shadow: 0 0 0.8em rgba(212, 87, 59, 0.6), 0 0.2em 0.5em rgba(0, 0, 0, 0.6); }

/* ---- the bag */
.k1-pack-bagzone { grid-area: bag; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5em; }
.k1-pack-bag { position: relative; width: min(100%, 29em, calc((100dvh - 15em) * 1.396 * 0.62)); aspect-ratio: 726 / 520; flex: none; }
.k1-pack-bag::before { content: ''; position: absolute; left: 6%; right: 6%; bottom: -3%; height: 12%; border-radius: 50%; background: radial-gradient(closest-side, rgba(10, 6, 2, 0.7), transparent); }
.k1-pack-bag > img { position: absolute; inset: 0; width: 100%; height: 100%; }
.k1-pack-bag.bump { animation: k1-bump 0.42s var(--ease-out); }
@keyframes k1-bump { 30% { transform: scale(1.035, 0.965) translateY(1.5%); } 65% { transform: scale(0.99, 1.01); } }
.k1-pack-bag.nope { animation: k1-nope 0.42s; }
@keyframes k1-nope { 20% { transform: rotate(-2.2deg); } 45% { transform: rotate(2deg); } 70% { transform: rotate(-1deg); } }
.k1-pack-peek { position: absolute; left: 28%; width: 36%; top: 0; height: 33%; overflow: hidden; pointer-events: none; }
.k1-pack-peek img { position: absolute; bottom: -24%; height: 62%; width: auto; transform: translateX(-50%) rotate(var(--r, 0deg)); transform-origin: 50% 100%;
  filter: drop-shadow(0 -0.1em 0.2em rgba(0, 0, 0, 0.5)) brightness(0.96); }
.k1-pack-peek img.tall { height: 96%; bottom: -30%; }
.k1-pack-peek img.drop { animation: k1-drop 0.4s var(--ease-back); }
@keyframes k1-drop { from { translate: 0 -40%; } }
.k1-pack-fly { position: fixed; z-index: 5; pointer-events: none; filter: drop-shadow(0.2em 0.8em 0.4em rgba(0, 0, 0, 0.55)); }
.k1-pack.is-closing .k1-pack-peek img { transition: transform 0.4s ease-in, opacity 0.4s; transform: translate(-50%, 70%); opacity: 0; }
.k1-pack.is-closing .k1-pack-bag { animation: k1-cinch 0.5s var(--ease-out) forwards; }
@keyframes k1-cinch { 40% { transform: scale(1.04, 0.95); } 100% { transform: scale(0.98, 1.0); filter: brightness(1.15) drop-shadow(0 0 1.2em rgba(255, 214, 140, 0.7)); } }
.k1-pack.is-closing .k1-pack-table, .k1-pack.is-closing .k1-pack-fixed { transition: opacity 0.4s; opacity: 0.35; }
.k1-pack-room.full { border-color: var(--gold-hi); box-shadow: 0 0 1em rgba(243, 214, 138, 0.4), 0 0.2em 0.8em rgba(0, 0, 0, 0.5); }

.k1-pack-room { display: flex; align-items: center; gap: 0.55em; padding: 0.3em 0.9em 0.35em; border-radius: 2em; font-family: var(--f-label); letter-spacing: 0.06em;
  color: var(--parch); background: rgba(14, 12, 16, 0.78); border: 1px solid var(--gold-line); box-shadow: 0 0.2em 0.8em rgba(0, 0, 0, 0.5); }
.k1-pack-room b { font-weight: 700; color: var(--gold-hi); font-size: 1.1em; }
.k1-pack-dots { display: inline-flex; gap: 0.3em; }
.k1-pack-dot { width: 1.3em; height: 1.3em; border-radius: 0.3em; border: 1px dashed rgba(216, 178, 90, 0.75); background: rgba(0, 0, 0, 0.35); transition: background 0.25s, transform 0.25s var(--ease-back), box-shadow 0.25s; }
.k1-pack-dot.on { border-style: solid; border-color: var(--gold-hi); background: radial-gradient(circle at 40% 35%, var(--gold-hi), var(--gold) 55%, var(--gold-lo)); box-shadow: 0 0 0.6em rgba(243, 214, 138, 0.55); }
.k1-pack-dot.pop { transform: scale(1.25); }
.k1-pack-dot.over { border-color: var(--danger); background: rgba(212, 87, 59, 0.55); box-shadow: 0 0 0.7em rgba(212, 87, 59, 0.8); transform: scale(1.15); }

.k1-pack-fixed { max-width: min(100%, 26em); padding: 0.35em 0.75em 0.4em; border-radius: var(--radius); font-size: 0.8em; box-shadow: 0 0.25em 0.8em rgba(0, 0, 0, 0.55); }
.k1-pack-fixed h3 { margin: 0 0 0.2em; font-family: var(--f-label); font-size: 0.95em; letter-spacing: 0.08em; font-weight: 400; color: var(--ink-soft); text-align: center; }
.k1-pack-fixed ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 0.1em 0.65em; }
.k1-pack-fixed li { display: flex; align-items: center; gap: 0.2em; white-space: nowrap; }
.k1-pack-fixed img { width: 1.7em; height: 1.7em; image-rendering: pixelated; flex: none; }

/* ---- Lia's thought and the buttons */
.k1-pack-foot { grid-area: foot; display: flex; align-items: center; justify-content: center; gap: 1.2em; }
.k1-pack-say { display: flex; align-items: center; gap: 0.7em; min-width: 0; max-width: 46em; flex: 1 1 auto; padding: 0.35em 1em 0.35em 0.4em; border-radius: 0.6em;
  background: linear-gradient(180deg, rgba(20, 24, 36, 0.9), rgba(13, 16, 24, 0.92)); border: 1px solid var(--gold-line); box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.55); }
.k1-pack-face { width: 3.3em; height: 3.3em; flex: none; border-radius: 50%; object-fit: cover; image-rendering: pixelated; border: 2px solid var(--gold); background: #1b2131; }
.k1-pack-thought { flex: 1; min-width: 0; min-height: 2.6em; display: flex; align-items: center; font-style: italic; color: var(--parch); font-size: 1em; line-height: 1.3; }
.k1-pack-thought.flash { animation: k1-flash 0.5s; }
@keyframes k1-flash { from { color: var(--gold-hi); } }
.k1-pack-actions { display: flex; flex: none; gap: 0.7em; }
.k1-pack-actions .ch-btn { font-size: 1.05em; padding: 0.55em 1.2em; min-height: 2.75em; background-color: rgba(14, 16, 24, 0.85); }
.k1-pack-done { color: var(--gold-hi); border-color: var(--gold) !important; }
.k1-pack-done.is-sel { background-color: rgba(70, 52, 22, 0.92) !important; box-shadow: 0 0 0 2px var(--gold-hi), 0 0 1.2em rgba(243, 214, 138, 0.6); }
.k1-pack-done::before { content: ''; width: 0.9em; height: 0.9em; flex: none; border-radius: 50%; background: radial-gradient(circle at 38% 32%, #c4553c, #8e2a1c 70%); box-shadow: 0 0 0 1px rgba(255, 220, 160, 0.4); }

/* ---- narrow landscape (phone on its side) */
@media (max-height: 520px) {
  .k1-pack { --k1-item: 6.2em; }
  .k1-pack-card { padding: 0.4em 1em 0.5em; gap: 0.25em 1em; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); }
  .k1-pack-card h2 { font-size: 1.15em; display: inline; }
  .k1-pack-hint { display: inline; margin-left: 0.6em; font-size: 0.9em; }
  .k1-pack-gone { display: block; }
  .k1-pack-table { gap: 0.15em 0.35em; }
  .k1-pack-note, .k1-pack-fixed h3 { display: none; }
  .k1-pack-tag { padding: 0.1em 0.4em 0.15em; margin-top: 0.15em; }
  .k1-pack-name { font-size: 0.78em; }
  .k1-pack-bag { width: min(100%, calc((100dvh - 8.5em) * 1.396 * 0.62)); }
  .k1-pack-bagzone { gap: 0.3em; }
  .k1-pack-room { padding: 0.15em 0.6em; font-size: 0.85em; }
  .k1-pack-room > span:first-child { display: none; }
  .k1-pack-fixed { padding: 0.2em 0.5em; }
  .k1-pack-fixed li span { display: none; }
  .k1-pack-fixed img { width: 1.45em; height: 1.45em; }
  .k1-pack-say { padding: 0.2em 0.7em 0.2em 0.25em; }
  .k1-pack-face { width: 2.3em; height: 2.3em; }
  .k1-pack-thought { min-height: 0; font-size: 0.86em; }
  .k1-pack-actions .ch-btn { font-size: 0.92em; padding: 0.35em 0.9em; min-height: 2.4em; }
}

/* ---- portrait phone */
.is-portrait .k1-pack, .k1-pack.narrow { --k1-item: 6em; }
.is-portrait .k1-pack-card, .k1-pack.narrow .k1-pack-card { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr) auto; grid-template-areas: "head" "bag" "table" "foot";
  padding: max(0.7em, env(safe-area-inset-top)) 0.8em max(0.8em, env(safe-area-inset-bottom)); gap: 0.5em; }
.is-portrait .k1-pack-bg, .k1-pack.narrow .k1-pack-bg { background-position: 42% 60%; }
.is-portrait .k1-pack-card h2, .k1-pack.narrow .k1-pack-card h2 { font-size: 1.4em; }
.is-portrait .k1-pack-hint, .k1-pack.narrow .k1-pack-hint { font-size: 0.9em; }
.is-portrait .k1-pack-bag, .k1-pack.narrow .k1-pack-bag { width: min(72%, 18em, calc(21dvh * 1.396)); }
.is-portrait .k1-pack-bagzone, .k1-pack.narrow .k1-pack-bagzone { gap: 0.4em; }
.is-portrait .k1-pack-table, .k1-pack.narrow .k1-pack-table { align-self: center; justify-self: stretch; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.9em 0.5em; padding: 0.4em 0.3em 0; }
.is-portrait .k1-pack-item, .k1-pack.narrow .k1-pack-item { width: 100%; }
.is-portrait .k1-pack-note, .k1-pack.narrow .k1-pack-note { display: none; }
.is-portrait .k1-pack-gone, .k1-pack.narrow .k1-pack-gone { display: block; }
.is-portrait .k1-pack-name, .k1-pack.narrow .k1-pack-name { font-size: 0.8em; }
.is-portrait .k1-pack-obj, .k1-pack.narrow .k1-pack-obj { height: min(5.4em, 9dvh); }
.is-portrait .k1-pack-tag .k1-pack-key, .k1-pack.narrow .k1-pack-tag .k1-pack-key { display: none; }
.is-portrait .k1-pack-tag, .k1-pack.narrow .k1-pack-tag { padding: 0.15em 0.35em 0.2em; }
.is-portrait .k1-pack-hint, .k1-pack.narrow .k1-pack-hint { line-height: 1.2; }
.is-portrait .k1-pack-actions .ch-btn, .k1-pack.narrow .k1-pack-actions .ch-btn { white-space: nowrap; font-size: 0.95em; padding: 0.45em 0.6em; min-height: 2.9em; }
.is-portrait .k1-pack-fixed li span, .k1-pack.narrow .k1-pack-fixed li span { display: none; }
.is-portrait .k1-pack-fixed h3, .k1-pack.narrow .k1-pack-fixed h3 { display: inline; margin-right: 0.4em; }
.is-portrait .k1-pack-fixed, .k1-pack.narrow .k1-pack-fixed { display: flex; align-items: center; flex-wrap: wrap; justify-content: center; }
.is-portrait .k1-pack-foot, .k1-pack.narrow .k1-pack-foot { flex-direction: column; align-items: stretch; gap: 0.5em; }
.is-portrait .k1-pack-actions, .k1-pack.narrow .k1-pack-actions { justify-content: center; }
.is-portrait .k1-pack-actions .ch-btn, .k1-pack.narrow .k1-pack-actions .ch-btn { flex: 1; justify-content: center; }
.is-portrait .k1-pack-thought, .k1-pack.narrow .k1-pack-thought { font-size: 0.92em; min-height: 3.6em; }
.is-portrait .k1-pack-face, .k1-pack.narrow .k1-pack-face { width: 2.8em; height: 2.8em; }

.reduced-motion .k1-pack, .reduced-motion .k1-pack-bg, .reduced-motion .k1-pack-beam, .reduced-motion .k1-pack-mote, .reduced-motion .k1-pack-bag,
.reduced-motion .k1-pack-item, .reduced-motion .k1-pack-peek img, .reduced-motion .k1-pack-thought { animation: none !important; transition: none !important; }
.reduced-motion .k1-pack-mote { display: none; }
@media (prefers-reduced-motion: reduce) {
  .k1-pack, .k1-pack-bg, .k1-pack-beam, .k1-pack-bag, .k1-pack-item, .k1-pack-peek img, .k1-pack-thought { animation: none !important; transition: none !important; }
  .k1-pack-mote { display: none; }
}
`;

let styled = false;
function style(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  s.id = 'k1-pack-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

function icon(id: string): string {
  try { return G.art.iconDataUrl(items.get(id)?.icon ?? id); } catch { return ''; }
}
const nameOf = (id: string) => items.get(id)?.name ?? id;
/** Painted cut-out of an extra (falls back to the item icon). */
function art(key: string, ext = 'png'): string {
  try { return manifest().images?.[`minigames/${key}`]?.file ?? `assets/minigames/${key}.${ext}`; } catch { return `assets/minigames/${key}.${ext}`; }
}
/** Relative height of each object on the table (the source sheet draws an apple as big as a book). */
const ITEM_H: Record<string, number> = { 'book-herbs': 1, 'book-alana': 1, tinder: 0.74, 'honey-cake': 0.74, apple: 0.6 };
/** Rotation of each object sticking out of the bag. */
const PEEK_R = [-12, 9, -5, 13];
/** Slight tilt of each parchment label, so the table does not read as a form. */
const TILT = [-1.6, 1.1, -0.6, 1.4, -1.2, 0.7, -0.9, 1.5, -1.4];
const reduced = () => settings.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
function portrait(mood: string): string {
  try { return G.art.portrait('lia-cloak', mood); } catch { return ''; }
}

/**
 * Opens the bag panel. Resolves with the chosen extras, or null if Lia closes it without packing.
 * `owned(id)` = how many of an extra are within reach (inventory or on the shelf), `start` = previous selection.
 */
export function openPacking(owned: Owned, start: Selection): Promise<Selection | null> {
  style();
  const root = G.ui.panel('k1-pack');
  if (root.clientWidth && root.clientWidth < 640 && root.clientHeight > root.clientWidth) root.classList.add('narrow');
  root.dataset.art = 'loading';
  let sel: Selection = { ...start };
  let thought = 'Erst das Nötigste: Brot, Käse, Speck. Was passt noch hinein?';
  let mood = 'thinking';
  let closing = false;

  // One object per unit (apples can be several).
  const units: { id: string; idx: number }[] = [];
  for (const e of EXTRAS) {
    const n = Math.max(1, owned(e.id));
    for (let i = 0; i < n; i++) units.push({ id: e.id, idx: i });
  }

  // ---- scenery (painted table, dawn light, dust)
  const bg = document.createElement('div');
  bg.className = 'k1-pack-bg';
  bg.style.backgroundImage = `url("${art('packen-table', 'jpg')}")`;
  const shade = document.createElement('div');
  shade.className = 'k1-pack-shade';
  const beam = document.createElement('div');
  beam.className = 'k1-pack-beam';
  root.append(bg, beam, shade);
  for (let i = 0; i < 16; i++) {
    const m = document.createElement('i');
    m.className = 'k1-pack-mote';
    const r = (k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
    m.style.cssText = `left:${38 + r(1) * 55}%;top:${4 + r(2) * 60}%;--d:${9 + r(3) * 9}s;--w:${-r(4) * 14}s;--dx:${-2 - r(5) * 5}em;--dy:${4 + r(6) * 7}em;transform:scale(${0.6 + r(7)})`;
    root.appendChild(m);
  }
  {
    const probe = new Image();
    probe.onload = () => { root.dataset.art = 'ready'; };
    probe.onerror = () => { root.dataset.art = 'failed'; };
    probe.src = art('packen-table', 'jpg');
  }

  const card = document.createElement('div');
  card.className = 'k1-pack-card';
  root.appendChild(card);

  // Header
  const head = document.createElement('div');
  head.className = 'k1-pack-head';
  const h = document.createElement('h2');
  h.className = 'ch-title';
  h.textContent = 'Der Lederbeutel';
  const hint = document.createElement('div');
  hint.className = 'k1-pack-hint';
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  hint.innerHTML = touch
    ? 'Tippe auf ein Ding, um es einzupacken oder wieder herauszunehmen.'
    : `Anklicken oder <span class="ch-key">1</span>–<span class="ch-key">${Math.min(9, units.length)}</span> zum Einpacken · <span class="ch-key">Enter</span> schnüren`;
  head.append(h, hint);

  // Table with the extras
  const table = document.createElement('div');
  table.className = 'k1-pack-table';
  table.setAttribute('role', 'group');
  table.setAttribute('aria-label', 'Was nehme ich noch mit?');
  const buttons: HTMLButtonElement[] = units.map((unit, i) => {
    const e = EXTRAS.find(x => x.id === unit.id)!;
    const avail = owned(unit.id) > unit.idx;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'k1-pack-item';
    b.dataset.item = unit.id;
    b.disabled = !avail;
    b.style.setProperty('--k1-h', `${(ITEM_H[unit.id] ?? 0.8) * 100}%`);
    b.style.setProperty('--k1-tilt', `${TILT[i % TILT.length]}deg`);
    const size = Array.from({ length: e.size }, () => '<i></i>').join('');
    const fallback = icon(unit.id);
    const key = i < 9 ? `<span class="k1-pack-key" aria-hidden="true">${i + 1}</span>` : '';
    const check = '<span class="k1-pack-check" aria-hidden="true">✓</span>';
    b.innerHTML = ''
      + `<span class="k1-pack-obj"><img alt="" draggable="false" src="${art(`packen-${unit.id}`)}"></span>`
      + `<span class="k1-pack-tag">${key}${check}<span class="k1-pack-name">${nameOf(unit.id)}</span>`
      + (avail ? `<span class="k1-pack-size" title="Platz">Platz ${size}</span>` : `<span class="k1-pack-note">${e.missing ?? ''}</span><span class="k1-pack-gone">fehlt</span>`) + '</span>';
    const img = b.querySelector('img')!;
    img.addEventListener('error', () => { if (fallback && img.src !== fallback) { img.src = fallback; img.style.imageRendering = 'pixelated'; } }, { once: true });
    b.addEventListener('click', () => { if (closing) return; focus = i; toggle(unit, b); });
    table.appendChild(b);
    return b;
  });

  // Bag, room gauge, fixed provisions
  const bagzone = document.createElement('div');
  bagzone.className = 'k1-pack-bagzone';
  const bag = document.createElement('div');
  bag.className = 'k1-pack-bag';
  bag.setAttribute('role', 'img');
  bag.setAttribute('aria-label', 'Lias offener Lederbeutel mit Brot, Käse, Mantel und Wasserschlauch, die Wolldecke unten angeschnallt.');
  const bagImg = document.createElement('img');
  bagImg.alt = '';
  bagImg.draggable = false;
  bagImg.src = art('packen-bag');
  const peek = document.createElement('div');
  peek.className = 'k1-pack-peek';
  bag.append(bagImg, peek);
  const room = document.createElement('div');
  room.className = 'k1-pack-room';
  room.setAttribute('aria-live', 'polite');
  const dots: HTMLElement[] = [];
  const roomLabel = document.createElement('span');
  roomLabel.textContent = 'Platz im Beutel';
  const dotBox = document.createElement('span');
  dotBox.className = 'k1-pack-dots';
  for (let i = 0; i < CAPACITY; i++) {
    const d = document.createElement('i');
    d.className = 'k1-pack-dot';
    dotBox.appendChild(d);
    dots.push(d);
  }
  const roomCount = document.createElement('b');
  room.append(roomLabel, dotBox, roomCount);
  const fixed = document.createElement('div');
  fixed.className = 'k1-pack-fixed ch-parch';
  fixed.innerHTML = '<h3>Schon im Beutel</h3>';
  const ul = document.createElement('ul');
  for (const f of FIXED) {
    const li = document.createElement('li');
    const label = `${nameOf(f.id)}${f.n > 1 ? ` ×${f.n}` : ''}`;
    li.title = label;
    li.innerHTML = `<img alt="${label}" src="${icon(f.id)}"><span>${label}</span>`;
    ul.appendChild(li);
  }
  fixed.appendChild(ul);
  bagzone.append(bag, room, fixed);

  // Foot: Lia's thought and the buttons
  const foot = document.createElement('div');
  foot.className = 'k1-pack-foot';
  const say = document.createElement('div');
  say.className = 'k1-pack-say';
  const face = document.createElement('img');
  face.className = 'k1-pack-face';
  face.alt = '';
  const t = document.createElement('div');
  t.className = 'k1-pack-thought';
  t.setAttribute('aria-live', 'polite');
  say.append(face, t);
  const actions = document.createElement('div');
  actions.className = 'k1-pack-actions';
  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'ch-btn';
  later.textContent = 'Später';
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'ch-btn k1-pack-done';
  ok.textContent = 'Beutel schnüren';
  actions.append(later, ok);
  foot.append(say, actions);

  card.append(head, table, bagzone, foot);

  let focus = 0;
  let lastFace = '';
  const restart = (el: HTMLElement, cls: string) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  /** Packed units in packing order (for the objects sticking out of the bag). */
  const order: string[] = [];
  const keyOf = (u: { id: string; idx: number }) => `${u.id}#${u.idx}`;
  for (const u of units) if (u.idx < (sel[u.id] ?? 0)) order.push(keyOf(u));

  function renderPeek(fresh?: string): HTMLImageElement | null {
    peek.textContent = '';
    let made: HTMLImageElement | null = null;
    order.forEach((k, i) => {
      const id = k.split('#')[0];
      const img = document.createElement('img');
      img.alt = '';
      img.src = art(`packen-${id}`);
      img.dataset.key = k;
      const tall = id.startsWith('book');
      if (tall) img.classList.add('tall');
      img.style.left = `${((i + 0.5) / order.length) * 100}%`;
      img.style.setProperty('--r', `${PEEK_R[i % PEEK_R.length] + (tall ? 0 : 4)}deg`);
      img.style.zIndex = String(tall ? 1 : 2);
      if (k === fresh) made = img;
      peek.appendChild(img);
    });
    return made;
  }

  /** An object flies in an arc from `a` to `b` (both elements already laid out). */
  function fly(src: string, a: Element, b: Element, rot: number): Promise<void> {
    if (reduced() || typeof (a as HTMLElement).animate !== 'function') return Promise.resolve();
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    if (!ra.width || !rb.width) return Promise.resolve();
    const host = root.getBoundingClientRect();
    const img = document.createElement('img');
    img.className = 'k1-pack-fly';
    img.src = src;
    img.style.cssText = `left:${ra.left}px;top:${ra.top}px;width:${ra.width}px;height:${ra.height}px;`;
    root.appendChild(img);
    const dx = rb.left + rb.width / 2 - (ra.left + ra.width / 2);
    const dy = rb.top + rb.height / 2 - (ra.top + ra.height / 2);
    const s = Math.max(0.2, rb.height / ra.height);
    const lift = Math.min(ra.top, rb.top) - host.top > 60 ? -Math.max(60, Math.abs(dx) * 0.25) : -20;
    const anim = img.animate([
      { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + lift}px) scale(${(1 + s) / 2 * 1.1}) rotate(${rot / 2}deg)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(${rot}deg)` },
    ], { duration: 430, easing: 'cubic-bezier(0.45, 0, 0.3, 1)' });
    return anim.finished.then(() => undefined, () => undefined).finally(() => img.remove());
  }

  const toggle = (u: { id: string; idx: number }, btn?: HTMLElement) => {
    const count = sel[u.id] ?? 0;
    const objImg = btn?.querySelector<HTMLImageElement>('.k1-pack-obj img');
    if (u.idx < count) {
      // Take the last packed unit of this kind out again.
      const k = keyOf({ id: u.id, idx: count - 1 });
      const inBag = peek.querySelector<HTMLImageElement>(`img[data-key="${k}"]`);
      const target = buttons[units.findIndex(x => keyOf(x) === k)]?.querySelector('.k1-pack-obj img');
      if (inBag && target) void fly(inBag.src, inBag, target, 0);
      sel = remove(sel, u.id);
      const at = order.indexOf(k);
      if (at >= 0) order.splice(at, 1);
      sfx('ui-cancel', { volume: 0.6 });
      thought = 'Wieder raus damit.';
      mood = 'thinking';
      renderPeek();
      restart(bag, 'bump');
    } else {
      const next = add(sel, u.id, owned);
      if (next === sel) {
        sfx('ui-cancel');
        if (btn) { restart(btn, 'shake'); window.setTimeout(() => btn.classList.remove('shake'), 900); }
        const full = owned(u.id) > count;
        thought = full ? 'Das passt nicht mehr hinein. Dann muss etwas anderes raus.' : (EXTRAS.find(e => e.id === u.id)?.missing ?? 'Hab ich nicht.');
        mood = full ? 'surprised' : 'sad';
        if (full) {
          restart(bag, 'nope');
          const e = EXTRAS.find(x => x.id === u.id)!;
          const free = CAPACITY - used(sel);
          dots.forEach((d, i) => d.classList.toggle('over', i >= CAPACITY - Math.max(1, e.size - free) && i < CAPACITY));
          window.setTimeout(() => dots.forEach(d => d.classList.remove('over')), 650);
        }
      } else {
        sel = next;
        const k = keyOf({ id: u.id, idx: count });
        order.push(k);
        sfx('pickup', { volume: 0.5 });
        window.setTimeout(() => sfx('rustle', { volume: 0.35 }), 300);
        thought = EXTRAS.find(e => e.id === u.id)?.note ?? '';
        mood = u.id === 'honey-cake' ? 'sad' : 'thinking';
        const made = renderPeek(k);
        if (made) {
          made.style.visibility = 'hidden';
          const show = () => { made.style.visibility = ''; made.classList.add('drop'); restart(bag, 'bump'); };
          // The first unpacked unit of this kind is the one that leaves the table (apples can be several).
          const from = buttons[units.findIndex(x => keyOf(x) === k)]?.querySelector('.k1-pack-obj img') ?? objImg;
          if (from) void fly(made.src, from, made, PEEK_R[(order.length - 1) % PEEK_R.length]).then(show); else show();
        }
      }
    }
    update();
  };

  function update(): void {
    const u = used(sel);
    dots.forEach((d, i) => {
      const was = d.classList.contains('on');
      d.classList.toggle('on', i < u);
      if (!was && i < u) { restart(d, 'pop'); window.setTimeout(() => d.classList.remove('pop'), 260); }
    });
    roomCount.textContent = `${u} / ${CAPACITY}`;
    room.classList.toggle('full', u >= CAPACITY);
    units.forEach((unit, i) => {
      const b = buttons[i];
      const isIn = unit.idx < (sel[unit.id] ?? 0);
      b.classList.toggle('is-in', isIn);
      b.classList.toggle('is-focus', focus === i);
      const e = EXTRAS.find(x => x.id === unit.id)!;
      b.setAttribute('aria-pressed', String(isIn));
      b.setAttribute('aria-label', b.disabled ? `${nameOf(unit.id)}: ${e.missing ?? 'nicht da'}` : `${nameOf(unit.id)}, braucht ${e.size} Platz, ${isIn ? 'im Beutel' : 'auf dem Tisch'}`);
    });
    ok.classList.toggle('is-sel', focus >= units.length);
    const text = `„${thought}“`;
    if (t.textContent !== text) { t.textContent = text; restart(t, 'flash'); }
    const src = portrait(mood);
    if (src && src !== lastFace) { face.src = src; lastFace = src; }
  }

  renderPeek();
  update();

  return new Promise(resolve => {
    const done = (value: Selection | null) => {
      window.removeEventListener('keydown', onKey, true);
      root.remove();
      resolve(value);
    };
    const openedAt = performance.now();
    const onKey = (e: KeyboardEvent) => {
      if (!root.isConnected) { window.removeEventListener('keydown', onKey, true); return; }
      const k = e.key;
      // The key that opened the bag (E) must not also pick the first item.
      if (closing || performance.now() - openedAt < 300 || e.repeat) { e.preventDefault(); e.stopPropagation(); return; }
      let used_ = true;
      if (/^[1-9]$/.test(k)) { const u = units[Number(k) - 1]; if (u) { focus = Number(k) - 1; toggle(u, buttons[focus]); } }
      else if (k === 'ArrowDown' || k === 'ArrowRight' || k === 's' || k === 'S') { focus = (focus + 1) % (units.length + 1); update(); }
      else if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'w' || k === 'W') { focus = (focus + units.length) % (units.length + 1); update(); }
      else if (k === 'Enter' || k === ' ' || k === 'e' || k === 'E') {
        if (focus >= units.length) finish(); else toggle(units[focus], buttons[focus]);
      } else if (k === 'Escape' || k === 'Backspace') { sfx('ui-close'); done(null); }
      else used_ = false;
      if (used_) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('keydown', onKey, true);

    const finish = () => {
      if (closing) return;
      closing = true;
      sfx('ui-confirm');
      sfx('rustle', { volume: 0.5 });
      thought = 'Fest zugeschnürt.';
      mood = 'determined';
      update();
      if (reduced()) { done(sel); return; }
      root.classList.add('is-closing');
      window.setTimeout(() => done(sel), 520);
    };
    later.addEventListener('click', () => { if (closing) return; sfx('ui-close'); done(null); });
    ok.addEventListener('click', finish);
  });
}

/** Lia's thoughts after closing the bag. */
export function packingVerdict(sel: Selection): string[] { return verdict(sel); }

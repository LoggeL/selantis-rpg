// Kapitel V: CSS for the chapter's own DOM panels (dodge prompt, closing credits). Uses the Chronik variables.
let injected = false;

export function ensureStyles(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.id = 'k5-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}

const CSS = `
/* ---------------- dodge prompt: painted combat cut-in ---------------- */
.k5-qte { --k5-close: 1100ms; --k5-good: #f3d68a; --k5-bad: #e0644a; overflow: hidden; cursor: pointer; touch-action: none;
  background: #05070c; opacity: 0; transition: opacity 0.3s ease-out; }
.k5-qte.is-in { opacity: 1; }
.k5-qte.is-out { opacity: 0; transition-duration: 0.36s; }
.k5-qte-scene { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.k5-qte-bg { position: absolute; inset: -2%; background: #0b1018 center 62% / cover no-repeat; transform: scale(1.06);
  filter: saturate(0.92) brightness(0.88); transition: transform 1.6s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.6s; }
.k5-qte.is-in .k5-qte-bg { transform: scale(1); }
.k5-qte.is-won .k5-qte-bg { filter: saturate(1) brightness(1); }
/* drifting ground mist */
.k5-qte-mist { position: absolute; inset: 0; mix-blend-mode: screen; opacity: 0.55;
  background: radial-gradient(42% 16% at 30% 82%, rgba(150, 170, 210, 0.22), transparent 70%),
    radial-gradient(38% 13% at 78% 76%, rgba(150, 170, 210, 0.18), transparent 70%),
    radial-gradient(60% 30% at 70% 18%, rgba(120, 140, 200, 0.12), transparent 70%);
  animation: k5-mist 14s ease-in-out infinite alternate; }
@keyframes k5-mist { from { transform: translateX(-3%); } to { transform: translateX(3%); } }
/* the two painted figures (bottom-anchored; every pose keeps the common scale via its height ratio) */
.k5-qte-fig { position: absolute; translate: 0 0; transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s, translate 0.5s cubic-bezier(0.3, 0.6, 0.3, 1); }
.k5-qte-fig img { position: absolute; bottom: 0; left: 50%; width: auto; height: 100%; transform: translateX(-50%); opacity: 0;
  user-select: none; -webkit-user-drag: none; filter: brightness(0.92) contrast(1.04) drop-shadow(0 0 0.5em rgba(150, 178, 235, 0.22));
  transition: opacity 0.08s linear, transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1); }
.k5-qte-shadow { position: absolute; left: 4%; right: 4%; bottom: -3%; height: 7%;
  background: radial-gradient(50% 50% at 50% 50%, rgba(0, 0, 0, 0.6), transparent 72%); }
.k5-qte-ghoul { right: 9%; bottom: 7%; height: 86%; aspect-ratio: 545 / 895; transform: translateX(14%); opacity: 0; }
.k5-qte-lia { left: 6%; bottom: 1%; height: 70%; aspect-ratio: 464 / 781; transform: translateX(-16%); opacity: 0; z-index: 1; }
.k5-qte.is-in .k5-qte-ghoul, .k5-qte.is-in .k5-qte-lia { transform: none; opacity: 1; }
.k5-qte-ghoul .pose-strike { height: 87.7%; }
.k5-qte-lia .pose-dodge { height: 90.4%; }
.k5-qte-lia .pose-hurt { height: 107.8%; }
.k5-qte-ghoul .pose-windup, .k5-qte-lia .pose-ready { opacity: 1; }
.k5-qte.is-good .pose-windup, .k5-qte.is-bad .pose-windup, .k5-qte.is-good .pose-ready, .k5-qte.is-bad .pose-ready { opacity: 0; }
.k5-qte.is-good .pose-strike, .k5-qte.is-bad .pose-strike { opacity: 1; transform: translateX(-62%); }
.k5-qte.is-good .pose-dodge { opacity: 1; transform: translateX(-62%); }
.k5-qte.is-bad .pose-hurt { opacity: 1; transform: translateX(-44%) rotate(-2deg); }
/* the strike: the ghoul lunges at Lia, so the axe lands on her (hit) or bites through her afterimage (dodge) */
.k5-qte { --k5-lunge-hit: -27vw; --k5-lunge-dodge: -15vw; }
.k5-qte.is-bad .k5-qte-ghoul, .k5-qte.is-bad .k5-qte-slash { translate: var(--k5-lunge-hit) 0; }
.k5-qte.is-good .k5-qte-ghoul, .k5-qte.is-good .k5-qte-slash { translate: var(--k5-lunge-dodge) 0; }
.k5-qte.is-bad .k5-qte-ghoul, .k5-qte.is-good .k5-qte-ghoul { transition: transform 0.45s, opacity 0.35s, translate 0.13s cubic-bezier(0.5, 0, 0.2, 1); }
/* telegraph: the ghoul hauls the axe back while the ring closes */
.k5-qte-ghoul .pose-windup { transform-origin: 50% 100%; }
.k5-qte.is-run .k5-qte-ghoul .pose-windup { animation: k5-windup var(--k5-close) cubic-bezier(0.5, 0, 0.9, 0.6) forwards; }
@keyframes k5-windup { from { transform: translateX(-50%) rotate(0deg); } to { transform: translateX(-47%) translateY(-1.5%) rotate(-3.5deg) scale(1.025); } }
.k5-qte-glint { position: absolute; left: 48%; top: 4.5%; width: 4.2em; height: 4.2em; transform: translate(-50%, -50%) scale(0.3); opacity: 0;
  background: radial-gradient(circle, #fffbea 0 6%, rgba(255, 242, 200, 0.55) 12%, transparent 46%),
    linear-gradient(90deg, transparent 47%, rgba(255, 246, 214, 0.85) 50%, transparent 53%),
    linear-gradient(0deg, transparent 47%, rgba(255, 246, 214, 0.85) 50%, transparent 53%);
  transition: opacity 0.12s, transform 0.18s; }
.k5-qte.is-window .k5-qte-glint { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(12deg); }
/* the axe stroke: a crescent swoosh down in front of the ghoul; a burst where it grazes Lia */
.k5-qte-slash { position: absolute; left: 53%; top: 7%; width: 20%; height: 70%; opacity: 0; z-index: 2; overflow: visible;
  clip-path: inset(0 0 100% 0); filter: drop-shadow(0 0 0.45em rgba(255, 236, 190, 0.65)); --k5-slash: #f3d68a; }
.k5-qte-slash .tint { stop-color: var(--k5-slash); }
.k5-qte.fx-dodge .k5-qte-slash, .k5-qte.fx-hurt .k5-qte-slash { animation: k5-slash 0.42s cubic-bezier(0.2, 0.7, 0.3, 1) forwards; }
.k5-qte.fx-hurt .k5-qte-slash { --k5-slash: #e0644a; filter: drop-shadow(0 0 0.5em rgba(224, 100, 74, 0.8)); }
@keyframes k5-slash { 0% { opacity: 1; clip-path: inset(0 0 100% 0); } 45% { opacity: 1; clip-path: inset(0 0 0 0); }
  100% { opacity: 0; clip-path: inset(0 0 0 0); transform: translateY(2%); } }
.k5-qte-impact { position: absolute; left: 25%; top: 40%; width: 9em; height: 9em; z-index: 2; opacity: 0; transform: translate(-50%, -50%) scale(0.3);
  background: radial-gradient(circle, #fff4ea 0 7%, rgba(255, 170, 140, 0.8) 14%, rgba(224, 100, 74, 0.35) 30%, transparent 58%),
    conic-gradient(from 10deg, transparent 0 8%, rgba(255, 220, 200, 0.7) 9% 10%, transparent 11% 33%, rgba(255, 220, 200, 0.6) 34% 35%, transparent 36% 58%,
      rgba(255, 220, 200, 0.7) 59% 60%, transparent 61% 83%, rgba(255, 220, 200, 0.6) 84% 85%, transparent 86%);
  -webkit-mask: radial-gradient(circle, #000 30%, transparent 62%); mask: radial-gradient(circle, #000 30%, transparent 62%); }
.k5-qte.fx-hurt .k5-qte-impact { animation: k5-impact 0.45s ease-out 0.1s forwards; }
@keyframes k5-impact { 0% { opacity: 1; transform: translate(-50%, -50%) scale(0.3) rotate(0deg); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.4) rotate(20deg); } }
/* dodge afterimage: the ready pose lingers as a fading ghost where Lia stood */
.k5-qte.fx-dodge .pose-ready { animation: k5-ghost 0.38s ease-out forwards; }
@keyframes k5-ghost { from { opacity: 0.5; filter: brightness(1.6) saturate(0.3) blur(1px); } to { opacity: 0; filter: brightness(1.6) saturate(0.3) blur(3px); transform: translateX(-56%); } }
.k5-qte-rain { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 3; }
.k5-qte-vignette { position: absolute; inset: 0; z-index: 3;
  background: radial-gradient(85% 75% at 50% 52%, transparent 45%, rgba(3, 5, 10, 0.75) 100%),
    linear-gradient(180deg, rgba(4, 6, 12, 0.72) 0%, transparent 22%, transparent 76%, rgba(4, 6, 12, 0.78) 100%); }
.k5-qte-flash { position: absolute; inset: 0; z-index: 4; opacity: 0; background: rgba(214, 226, 255, 0.85); }
.k5-qte.is-in .k5-qte-flash { animation: k5-lightning 0.9s ease-out 0.05s; }
.k5-qte.fx-hurt .k5-qte-flash { background: radial-gradient(60% 70% at 26% 58%, rgba(224, 100, 74, 0.28), rgba(110, 16, 8, 0.42) 100%); animation: k5-flash 0.42s ease-out forwards; }
.k5-qte.fx-dodge .k5-qte-flash { background: radial-gradient(50% 50% at 50% 45%, rgba(255, 236, 180, 0.32), transparent 70%); animation: k5-flash 0.45s ease-out; }
@keyframes k5-lightning { 0% { opacity: 0; } 8% { opacity: 0.9; } 16% { opacity: 0.1; } 24% { opacity: 0.6; } 100% { opacity: 0; } }
@keyframes k5-flash { 0% { opacity: 1; } 100% { opacity: 0; } }
.k5-qte.fx-hurt .k5-qte-vignette { box-shadow: inset 0 0 6em rgba(150, 24, 12, 0.55); transition: box-shadow 0.2s; }
.k5-qte.fx-hurt .k5-qte-scene { animation: k5-shake 0.34s linear; }
@keyframes k5-shake { 0%, 100% { transform: none; } 20% { transform: translate(-1.2%, 0.6%); } 40% { transform: translate(1%, -0.5%); }
  60% { transform: translate(-0.6%, 0.3%); } 80% { transform: translate(0.4%, 0); } }

/* HUD: title band with the dodge seals, the timing ring, the control hint */
.k5-qte-box { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.k5-qte-head { position: absolute; left: 50%; top: max(3.5%, env(safe-area-inset-top)); transform: translate(-50%, -0.6em); opacity: 0;
  display: flex; flex-direction: column; align-items: center; gap: 0.35em; padding: 0.45em 2.6em 0.55em; white-space: nowrap;
  background: linear-gradient(90deg, transparent, rgba(13, 18, 27, 0.88) 18%, rgba(13, 18, 27, 0.88) 82%, transparent);
  transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) 0.15s, opacity 0.45s 0.15s; }
.k5-qte-head::before, .k5-qte-head::after { content: ''; position: absolute; left: 8%; right: 8%; height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold-line, rgba(216, 178, 90, 0.55)) 20%, var(--gold-line, rgba(216, 178, 90, 0.55)) 80%, transparent); }
.k5-qte-head::before { top: 0; } .k5-qte-head::after { bottom: 0; }
.k5-qte.is-in .k5-qte-head { transform: translate(-50%, 0); opacity: 1; }
.k5-qte-label { font-size: 2.1em; line-height: 1.05; letter-spacing: 0.08em; text-shadow: 0 0.06em 0 #2a1d0c, 0 0.1em 0.5em #000; transition: color 0.15s; }
.k5-qte.is-good .k5-qte-label, .k5-qte.is-won .k5-qte-label { color: var(--k5-good); text-shadow: 0 0.06em 0 #2a1d0c, 0 0 0.6em rgba(243, 214, 138, 0.6); animation: k5-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.k5-qte.is-bad .k5-qte-label { color: var(--k5-bad); animation: k5-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes k5-pop { from { transform: scale(1.25); } to { transform: none; } }
.k5-qte-pips { display: flex; gap: 0.95em; padding: 0.15em 0; }
.k5-qte-pips span { width: 1em; height: 1em; transform: rotate(45deg); border: 0.12em solid var(--gold, #d8b25a);
  background: rgba(8, 12, 20, 0.8); box-shadow: 0 0 0.3em #000; transition: background 0.2s, box-shadow 0.2s; }
.k5-qte-pips span.on { background: radial-gradient(circle at 35% 35%, #fff6d6, var(--k5-good) 45%, #b8862e); box-shadow: 0 0 0.7em rgba(243, 214, 138, 0.85);
  animation: k5-seal 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes k5-seal { from { transform: rotate(45deg) scale(1.9); } to { transform: rotate(45deg) scale(1); } }

.k5-qte-ring { --r: 7em; position: absolute; left: 50%; top: 45%; width: var(--r); height: var(--r); transform: translate(-50%, -50%) scale(0.6); opacity: 0;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s, opacity 0.3s 0.2s; }
.k5-qte.is-in .k5-qte-ring { transform: translate(-50%, -50%); opacity: 1; }
/* after the verdict the ring steps back, so the strike itself stays readable */
.k5-qte.is-in.is-good:not(.is-won) .k5-qte-ring, .k5-qte.is-in.is-bad .k5-qte-ring { opacity: 0.5; transform: translate(-50%, -50%) scale(0.86); transition-delay: 0.18s; }
.k5-qte.is-won .k5-qte-ring { opacity: 0; transform: translate(-50%, -50%) scale(1.3); transition-delay: 0s; }
.k5-qte-target { position: absolute; inset: 0; border-radius: 50%;
  border: 0.24em solid rgba(216, 178, 90, 0.9); outline: 1px solid rgba(216, 178, 90, 0.35); outline-offset: 0.3em;
  background: radial-gradient(circle, rgba(10, 14, 24, 0.55) 40%, rgba(10, 14, 24, 0.82) 100%);
  box-shadow: 0 0 1em rgba(0, 0, 0, 0.7), inset 0 0 1em rgba(216, 178, 90, 0.2); transition: border-color 0.1s, box-shadow 0.1s, transform 0.1s; }
.k5-qte-closing { position: absolute; left: 50%; top: 50%; width: var(--r); height: var(--r); border-radius: 50%;
  border: 0.2em solid rgba(239, 227, 200, 0.92); box-shadow: 0 0 0.6em rgba(239, 227, 200, 0.4), inset 0 0 0.6em rgba(239, 227, 200, 0.25);
  transform: translate(-50%, -50%) scale(3.2); }
.k5-qte.is-window .k5-qte-target { border-color: var(--k5-good); outline-color: rgba(243, 214, 138, 0.8); transform: scale(1.06);
  box-shadow: 0 0 2em rgba(243, 214, 138, 0.85), inset 0 0 1.4em rgba(243, 214, 138, 0.5); }
.k5-qte.is-window .k5-qte-closing { border-color: #fff4d0; box-shadow: 0 0 1.2em rgba(243, 214, 138, 0.9); }
.k5-qte.is-good .k5-qte-target { border-color: var(--k5-good); box-shadow: 0 0 2.2em rgba(243, 214, 138, 0.9); }
.k5-qte.is-good .k5-qte-closing, .k5-qte.is-bad .k5-qte-closing { opacity: 0 !important; }
.k5-qte.is-bad .k5-qte-target { border-color: var(--k5-bad); outline-color: rgba(224, 100, 74, 0.6); box-shadow: 0 0 2em rgba(224, 100, 74, 0.8); }
.k5-qte-key { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 1.7em; min-width: 1.9em; height: 1.9em; }
.k5-qte-key svg { width: 1.25em; height: 1.25em; }
.k5-qte.is-window .k5-qte-key { animation: k5-press 0.32s ease-in-out infinite alternate; }
@keyframes k5-press { to { transform: translate(-50%, -42%); box-shadow: 0 0.05em 0 #7d6034, 0 0.15em 0.3em rgba(0, 0, 0, 0.5); } }

.k5-qte-sub { position: absolute; left: 50%; bottom: max(4.5%, env(safe-area-inset-bottom)); transform: translate(-50%, 0.6em); opacity: 0;
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.45em 0.55em; width: max-content; max-width: 92%;
  padding: 0.55em 1.3em; font-size: 1.05em; color: var(--parch, #efe3c8); text-align: center;
  background: linear-gradient(180deg, rgba(27, 35, 51, 0.92), rgba(13, 18, 27, 0.92)); border: 1px solid var(--gold-line, rgba(216, 178, 90, 0.55));
  border-radius: 0.45em; box-shadow: 0 0.5em 1.6em rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 236, 190, 0.08);
  transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) 0.3s, opacity 0.45s 0.3s; }
.k5-qte.is-in .k5-qte-sub { transform: translate(-50%, 0); opacity: 1; }
.k5-qte.is-won .k5-qte-sub { opacity: 0; transition-delay: 0s; }
.k5-qte-sub .ch-key { font-size: 0.9em; flex: none; }
.k5-qte-hand svg { width: 1.2em; height: 1.2em; }

/* phone portrait: figures fill the lower half, ring above them, hint at the bottom */
.is-portrait .k5-qte-bg { background-position: 46% 60%; }
.is-portrait .k5-qte-ghoul { right: -10%; bottom: 21%; height: 48%; }
.is-portrait .k5-qte-lia { left: 1%; bottom: 14%; height: 39%; }
.is-portrait .k5-qte.is-good .pose-dodge { transform: translateX(-44%); }
/* portrait: the figures stand close, so on a dodge the axe falls short and passes in front of her flying cloak */
.is-portrait .k5-qte { --k5-lunge-hit: -7vw; --k5-lunge-dodge: 5vw; }
.is-portrait .k5-qte.is-good .k5-qte-ghoul { z-index: 2; }
.is-portrait .k5-qte.is-good .pose-strike, .is-portrait .k5-qte.is-bad .pose-strike { transform: translateX(-56%); }
.is-portrait .k5-qte-sub { flex-wrap: nowrap; text-align: left; gap: 0.8em; padding: 0.7em 1.1em; }
.is-portrait .k5-qte-ring { top: 26%; --r: 6.4em; }
.is-portrait .k5-qte-head { top: max(4%, env(safe-area-inset-top)); padding-inline: 1.6em; }
.is-portrait .k5-qte-label { font-size: 2em; }
.is-portrait .k5-qte-slash { left: 42%; top: 34%; width: 32%; height: 38%; }
.is-portrait .k5-qte-impact { left: 26%; top: 62%; }
.is-portrait .k5-qte-sub { font-size: 1em; max-width: 90%; }
.is-portrait .k5-qte-vignette { background: radial-gradient(110% 70% at 50% 55%, transparent 45%, rgba(3, 5, 10, 0.7) 100%),
  linear-gradient(180deg, rgba(4, 6, 12, 0.7) 0%, transparent 16%, transparent 80%, rgba(4, 6, 12, 0.85) 100%); }
/* small landscape (phone held sideways): tighter HUD */
.is-small:not(.is-portrait) .k5-qte { --k5-lunge-hit: -33vw; --k5-lunge-dodge: -24vw; }
.is-small:not(.is-portrait) .k5-qte-label { font-size: 1.6em; }
.is-small:not(.is-portrait) .k5-qte-head { top: 2%; padding-block: 0.3em 0.4em; }
.is-small:not(.is-portrait) .k5-qte-ring { --r: 5.4em; top: 47%; }
.is-small:not(.is-portrait) .k5-qte-sub { bottom: 3%; font-size: 0.92em; padding: 0.4em 1em; }
.is-small:not(.is-portrait) .k5-qte-ghoul { height: 80%; bottom: 6%; }
.is-small:not(.is-portrait) .k5-qte-lia { height: 66%; }
.is-small:not(.is-portrait) .k5-qte-slash { left: 58%; top: 12%; width: 18%; height: 64%; }
.is-small:not(.is-portrait) .k5-qte-impact { left: 21%; top: 44%; }

/* reduced motion: no drifting mist, no shake or lightning, quicker swaps */
#ui.reduced-motion .k5-qte-mist, .k5-qte.is-reduced .k5-qte-mist { animation: none; }
#ui.reduced-motion .k5-qte *, .k5-qte.is-reduced * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
#ui.reduced-motion .k5-qte-bg, .k5-qte.is-reduced .k5-qte-bg { transform: none; transition: none; }
#ui.reduced-motion .k5-qte.is-in .k5-qte-flash, .k5-qte.is-reduced.is-in .k5-qte-flash { animation: none; }
#ui.reduced-motion .k5-qte-closing { transition: none; }

/* ---------------- closing credits ---------------- */
.k5-credits { display: flex; align-items: center; justify-content: center; background: #07090f; opacity: 0; transition: opacity 1.2s; cursor: pointer; }
.k5-credits.is-in { opacity: 1; }
.k5-credits.is-out { opacity: 0; }
.k5-credits-page { position: relative; width: min(34em, 88vw); max-height: 86%; overflow: hidden; padding: 2.2em 2.4em 2em;
  text-align: center; border-radius: 0.5em; box-shadow: 0 1em 3em rgba(0, 0, 0, 0.6); }
.k5-credits-roll { display: flex; flex-direction: column; gap: 0.9em; transition: transform linear; }
.k5-credits h1 { font-family: var(--f-head); font-weight: 700; font-size: 1.9em; margin: 0.2em 0 0; color: var(--ink, #2b2119); letter-spacing: 0.06em; }
.k5-credits h2 { font-family: var(--f-head); font-size: 1.05em; margin: 0.8em 0 0; color: #6b4a2a; letter-spacing: 0.08em; }
.k5-credits p { font-family: var(--f-body); font-size: 1.02em; margin: 0; color: var(--ink, #2b2119); line-height: 1.45; }
.k5-credits p.k5-small { font-size: 0.86em; opacity: 0.8; }
.k5-credits .k5-turq { color: #1f8f80; font-style: italic; }
.k5-credits .flourish { width: 60%; margin: 0.3em auto; color: #8a6a3a; }
.k5-credits-hint { position: absolute; bottom: 4%; left: 0; right: 0; text-align: center; color: rgba(239, 227, 200, 0.55); font-family: var(--f-label); font-size: 0.8em; letter-spacing: 0.08em; }
`;

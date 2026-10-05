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
/* ---------------- dodge prompt ---------------- */
.k5-qte { display: flex; align-items: flex-end; justify-content: center; padding-bottom: 7%; cursor: pointer;
  background: radial-gradient(60% 50% at 50% 60%, transparent 40%, rgba(5, 8, 16, 0.45) 100%); opacity: 0; transition: opacity 0.25s; }
.k5-qte.is-in { opacity: 1; }
.k5-qte.is-out { opacity: 0; }
.k5-qte-box { display: flex; flex-direction: column; align-items: center; gap: 0.35em; pointer-events: none; }
.k5-qte-ring { position: relative; width: 5.2em; height: 5.2em; }
.k5-qte-target { position: absolute; inset: 0; border-radius: 50%; border: 0.22em solid rgba(216, 178, 90, 0.85);
  box-shadow: 0 0 0.8em rgba(216, 178, 90, 0.35), inset 0 0 0.6em rgba(216, 178, 90, 0.25); background: rgba(20, 26, 38, 0.55); }
.k5-qte-closing { position: absolute; left: 50%; top: 50%; width: 5.2em; height: 5.2em; border-radius: 50%;
  border: 0.16em solid rgba(239, 227, 200, 0.85); transform: translate(-50%, -50%) scale(3.2); }
.k5-qte.is-window .k5-qte-target { border-color: var(--gold-hi, #f0d58a); box-shadow: 0 0 1.4em rgba(240, 213, 138, 0.8), inset 0 0 1em rgba(240, 213, 138, 0.45); }
.k5-qte.is-window .k5-qte-closing { border-color: var(--gold-hi, #f0d58a); }
.k5-qte.is-good .k5-qte-target { border-color: var(--turq, #49e0c8); box-shadow: 0 0 1.4em rgba(73, 224, 200, 0.7); }
.k5-qte.is-bad .k5-qte-target { border-color: var(--danger, #d4573b); box-shadow: 0 0 1.4em rgba(212, 87, 59, 0.7); }
.k5-qte-key { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 1.25em; }
.k5-qte-label { font-size: 1.5em; text-shadow: 0 0.08em 0.3em #000; }
.k5-qte.is-bad .k5-qte-label { color: var(--danger, #d4573b); }
.k5-qte.is-good .k5-qte-label { color: var(--turq, #49e0c8); }
.k5-qte-sub { color: var(--parch, #efe3c8); font-size: 0.8em; opacity: 0.85; text-shadow: 0 0.08em 0.25em #000; }
.k5-qte-pips { display: flex; gap: 0.4em; margin-top: 0.2em; }
.k5-qte-pips span { width: 0.7em; height: 0.7em; border-radius: 50%; border: 0.1em solid var(--gold, #d8b25a); background: rgba(20, 26, 38, 0.6); }
.k5-qte-pips span.on { background: var(--turq, #49e0c8); box-shadow: 0 0 0.5em rgba(73, 224, 200, 0.8); }
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

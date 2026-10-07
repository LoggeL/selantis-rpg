// Lia's nightmare in e2-ignatius: a framed, clearly marked dream (DOM panel over black). Violet haze, voices of Kyra
// and Flick that drift in, waver and fade. Nothing here is a fact: the scene labels every voice „im Traum“ and
// Ignatius later calls it uncertain. Recorded voices reveal the words; first continue reveals, second advances.
import { voiceover, type VoicePlayback } from '../../audio/voiceover';
import { G } from '../../core/G';
import { ctx, isConfirm } from '../../ui/context';
import { revealSpeech, Typewriter, type TextReveal } from '../../ui/typewriter';
import { ui } from './shared';

/** A shared caption may have two voices, played consecutively rather than over each other. */
export interface DreamLine { who: string; text: string; speaker: string | readonly [string, ...string[]] }

let styled = false;
function ensureStyles(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const style = document.createElement('style');
  style.id = 'e2-traum-styles';
  style.textContent = `
.e2-traum { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.1em; cursor: pointer;
  background: radial-gradient(70% 60% at 50% 50%, rgba(80, 44, 130, 0.55) 0%, rgba(26, 12, 44, 0.92) 60%, #07040c 100%);
  opacity: 0; transition: opacity 1.4s; }
.e2-traum.is-in { opacity: 1; }
.e2-traum.is-out { opacity: 0; transition-duration: 0.9s; }
.e2-traum-tag { position: absolute; top: 7%; left: 0; right: 0; text-align: center; font-family: var(--f-label);
  letter-spacing: 0.3em; font-size: 0.78em; color: rgba(210, 190, 255, 0.55); text-transform: uppercase; }
.e2-traum-line { max-width: 30em; text-align: center; opacity: 0; filter: blur(0.25em); transform: translateY(0.6em) scale(0.98);
  transition: opacity 1.1s, filter 1.4s, transform 1.4s; }
.e2-traum-line.is-in { opacity: 1; filter: blur(0); transform: none; animation: e2-traum-wave 3.8s ease-in-out infinite; }
.e2-traum-line.is-gone { opacity: 0.18; filter: blur(0.12em); }
.e2-traum-who { display: block; font-family: var(--f-label); font-size: 0.72em; letter-spacing: 0.16em; color: rgba(190, 160, 255, 0.75); }
.e2-traum-text { font-family: var(--f-body); font-style: italic; font-size: 1.25em; color: #e8dcff; text-shadow: 0 0 0.6em rgba(154, 108, 255, 0.7); }
@keyframes e2-traum-wave { 0%, 100% { transform: translateX(0) skewX(0deg); } 33% { transform: translateX(0.25em) skewX(-1.5deg); } 66% { transform: translateX(-0.2em) skewX(1.2deg); } }
#ui.reduced-motion .e2-traum-line.is-in { animation: none; }
`;
  document.head.appendChild(style);
}

/** Plays the dream; resolves when it faded out. Never resolves for a scene the player already left. */
export async function playDream(lines: DreamLine[]): Promise<void> {
  ensureStyles();
  if (ctx.stale()) return ctx.never();
  const token = ctx.epoch;
  await voiceover.preload();
  if (ctx.stale() || token !== ctx.epoch) return ctx.never();
  voiceover.stop();
  const root = ui().panel('e2-traum');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Ein Traum');
  root.innerHTML = '<div class="e2-traum-tag">Ein Traum</div>';
  let advance: (() => void) | null = null;
  let recording: VoicePlayback | null = null;
  let reveal: TextReveal | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watchFrame = 0;
  let disposed = false;
  const alive = () => !disposed && token === ctx.epoch && !ctx.stale() && root.isConnected;
  const skip = () => { if (alive()) advance?.(); };
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); skip();
  };
  root.addEventListener('pointerdown', onPointer);
  const close = ctx.open({ id: 'e2-traum', allowMenu: false, onKey: e => { if (!e.repeat && isConfirm(e)) skip(); return true; } });
  let off = () => {};
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    advance = null;
    clearTimeout(timer);
    cancelAnimationFrame(watchFrame);
    reveal?.cancel?.();
    recording?.stop();
    off();
    close();
    root.removeEventListener('pointerdown', onPointer);
    root.remove();
  };
  off = G.events.on('scene:goto', dispose);
  const watch = () => {
    if (!alive()) { dispose(); return; }
    watchFrame = requestAnimationFrame(watch);
  };
  watchFrame = requestAnimationFrame(watch);
  const beat = (ms: number) => new Promise<void>(resolve => {
    advance = () => { clearTimeout(timer); advance = null; resolve(); };
    timer = setTimeout(() => { if (alive()) advance?.(); else dispose(); }, ms);
  });
  try {
    requestAnimationFrame(() => { if (alive()) root.classList.add('is-in'); });
    try { G.audio.sfx('magic', { volume: 0.25, pitch: 0.55 }); } catch { /* audio optional */ }
    await beat(1200);
    let prev: HTMLElement | null = null;
    for (const l of lines) {
      const el = document.createElement('div');
      el.className = 'e2-traum-line';
      const who = document.createElement('span');
      who.className = 'e2-traum-who';
      who.textContent = l.who;
      const text = document.createElement('span');
      text.className = 'e2-traum-text';
      el.append(who, text);
      root.appendChild(el);
      prev?.classList.add('is-gone');
      prev = el;
      requestAnimationFrame(() => { if (alive()) el.classList.add('is-in'); });
      try { G.audio.sfx('heartbeat', { volume: 0.35 }); } catch { /* audio optional */ }
      await new Promise<void>(resolve => {
        const startedAt = performance.now();
        let completedAt = 0;
        let revealed = false;
        let voicesDone = false;
        let finished = false;
        const finish = () => {
          if (finished || !alive()) return;
          finished = true;
          advance = null;
          clearTimeout(timer);
          reveal?.cancel?.();
          recording?.stop();
          recording = null;
          resolve();
        };
        const autoAdvance = () => {
          if (finished || !revealed || !voicesDone || !alive()) return;
          clearTimeout(timer);
          // Keep the dream's quiet beat, but never cut a still-speaking voice to meet a text timer.
          timer = setTimeout(finish, Math.max(600, startedAt + 1600 + l.text.length * 35 - performance.now()));
        };
        const onDone = () => {
          revealed = true;
          completedAt = performance.now();
          autoAdvance();
        };
        advance = () => {
          if (!revealed) { reveal?.complete(); return; }
          if (performance.now() - completedAt >= 140) finish();
        };
        const voices = typeof l.speaker === 'string' ? [l.speaker] : l.speaker;
        const play = async () => {
          for (const speaker of voices) {
            if (finished || !alive()) return;
            recording = voiceover.play('say', speaker, l.text);
            if (!reveal || !revealed) {
              reveal?.cancel?.();
              reveal = revealSpeech(text, l.text, recording,
                () => new Typewriter(text, l.text, { onDone }), onDone, alive);
            }
            if (recording) await recording.done;
          }
          if (finished || !alive()) return;
          voicesDone = true;
          autoAdvance();
        };
        reveal = null;
        void play();
      });
    }
    root.classList.add('is-out');
    await beat(900);
  } finally {
    dispose();
  }
}

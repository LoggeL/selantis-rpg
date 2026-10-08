// Scene pick: a small decision game over a painted scene. Each round shows a prompt (someone pushes, asks or
// swings) and a handful of word cards; the player picks what Lia (or Flick, Kyra …) does, thinks or answers. The
// caller judges every pick and answers with a reply line. Wrong cards are struck through, so every round ends.
// Used for „Woran hältst du dich?“, „Falsche Fährten“, „Was du gesehen hast“ and Kapitel V's ghoul.
//
// Input: 1–9 picks a card, ←/→/↑/↓ move the focus, E/Enter/Space picks the focused card or continues a reply;
// mouse and touch tap the cards. No timer unless a round sets `timeoutMs` (a slowly emptying breath bar).
import { assetUrl, manifest } from '../art/manifest';
import { speakers } from '../core/catalog';
import { ctx, isConfirm } from './context';
import { el, sfx } from './dom';
import './scenePick.css';

export interface PickCard {
  id: string;
  text: string;
  /** Small tag after the text (the clue or item that makes it possible). */
  tag?: string;
  /** Shown but not choosable (greyed out, `reason` as tooltip). */
  disabled?: boolean;
  reason?: string;
}
export interface PickLine { speaker?: string; text: string }
export interface PickVerdict {
  ok: boolean;
  /** Lines shown after the pick; the player continues with E/Enter or a tap. */
  reply?: PickLine | PickLine[];
  /** Visual accent on the stage: calm (settles), shake (jolt), flash (bright), hurt (red), good (gold). */
  mood?: 'calm' | 'shake' | 'flash' | 'hurt' | 'good';
  /** Wrong picks are struck through by default; `retry` keeps the card choosable. */
  retry?: boolean;
  /** Ends the round even though the pick was wrong (a beat that is lost, not repeated). */
  endRound?: boolean;
}
export interface PickRound {
  /** Who pushes, asks or swings – shown above the cards. */
  prompt?: PickLine;
  /** Free tag for decorations (`data-cue` on the panel), e.g. the direction of a swing. */
  cue?: string;
  cards: PickCard[];
  /** Ok picks needed to finish the round (default 1). Ok cards are marked as held. */
  need?: number;
  judge(id: string): PickVerdict | Promise<PickVerdict>;
  /** Optional breath bar: when it runs out, `timeoutPick` is judged as if picked (e.g. 'erstarrt'). */
  timeoutMs?: number;
  timeoutPick?: string;
}
export interface ScenePickOptions {
  label: string;
  help: string;
  /** Plate id, background id or `minigames/<key>` image. Without it the panel shows a dark Chronik stage. */
  backdrop?: string;
  /** Blur and darken the backdrop (memories, dreams, figure-less places). */
  dim?: boolean;
  /** 'drift': cards float loosely over the scene (thoughts, memories); 'row': a steady row at the bottom. */
  layout?: 'drift' | 'row';
  rounds: PickRound[];
  /** Extra class on the panel (scene-specific styling). */
  className?: string;
  /** Adds custom layers to the stage (figures, rain …). Runs once before the first round. */
  decorate?(stage: HTMLElement, root: HTMLElement): void;
  /** A round starts (telegraph: turn a figure, play a sound). Awaited. */
  onRound?(index: number, round: PickRound): void | Promise<void>;
  /** After each judged pick, before the reply is shown. Awaited. */
  onVerdict?(verdict: PickVerdict, index: number, id: string): void | Promise<void>;
}
export interface PickResult {
  picks: { round: number; id: string; ok: boolean }[];
  mistakes: number;
}

/** Resolves a backdrop id to a URL: plate, background, minigame image, else the plate convention path. */
export function pickBackdropUrl(id: string, art = manifest()): string {
  const file = art.plates[id]?.file ?? art.backgrounds[id]?.file ?? art.images[id]?.file
    ?? (id.startsWith('minigames/') ? `assets/${id}.jpg` : `assets/cut/${id}.jpg`);
  return assetUrl(file);
}

/** Loose, deterministic positions for drifting cards (fractions of the stage): a jittered grid, so they never overlap. */
export function driftSpots(n: number): { x: number; y: number }[] {
  const rows = n <= 3 ? 1 : n <= 6 ? 2 : 3;
  const cols = Math.ceil(n / rows);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const r = i % rows, c = Math.floor(i / rows);
    const inRow = Math.ceil((n - r) / rows);
    const jx = Math.sin(i * 12.9898) * 0.03, jy = Math.cos(i * 78.233) * 0.035;
    const x = (c + 0.5 + (r % 2 ? 0.18 : -0.18) * (cols > 1 ? 1 : 0)) / Math.max(cols, inRow);
    out.push({ x: Math.max(0.14, Math.min(0.86, x + jx)), y: rows === 1 ? 0.5 + jy : 0.2 + (r / (rows - 1)) * 0.6 + jy });
  }
  return out;
}

const lines = (r?: PickLine | PickLine[]): PickLine[] => (r ? (Array.isArray(r) ? r : [r]) : []);
const nameOf = (id?: string) => (id ? speakers.get(id)?.name ?? id : '');

export function scenePick(opts: ScenePickOptions): Promise<PickResult> {
  if (ctx.stale()) return ctx.never();
  const epoch = ctx.epoch;
  const layout = opts.layout ?? 'row';
  const root = el('div', `ui-panel scene-pick is-${layout}${opts.className ? ` ${opts.className}` : ''}`);
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', opts.label);
  const stage = el('div', 'pick-stage');
  root.classList.toggle('has-bg', Boolean(opts.backdrop));
  if (opts.backdrop) {
    const bg = el('div', `pick-bg${opts.dim ? ' is-dim' : ''}`);
    bg.style.backgroundImage = `url('${pickBackdropUrl(opts.backdrop)}')`;
    stage.append(bg);
  }
  stage.append(el('div', 'pick-vignette'), el('div', 'pick-flash'));
  const box = el('div', 'pick-box ch-panel');
  const head = el('div', 'pick-head');
  const title = el('div', 'ch-title', opts.label);
  const pips = el('div', 'pick-pips');
  pips.setAttribute('aria-hidden', 'true');
  head.append(title, pips);
  const help = el('p', 'pick-help', opts.help);
  const prompt = el('div', 'pick-prompt');
  prompt.setAttribute('aria-live', 'polite');
  const breath = el('div', 'pick-breath');
  breath.append(el('i'));
  const cardsEl = el('div', 'pick-cards');
  cardsEl.setAttribute('role', 'group');
  const reply = el('div', 'pick-reply');
  reply.setAttribute('aria-live', 'polite');
  const touch = ctx.root?.classList.contains('is-touch') ?? false;
  const keys = el('div', 'pick-keys', touch ? 'Tippe eine Karte an' : '1–9 oder ← → und E / Enter · Klick');
  box.append(head, help, prompt, breath, reply, keys);
  stage.append(cardsEl);
  root.append(stage, box);
  for (let i = 0; i < opts.rounds.length; i++) pips.append(el('i'));
  ctx.layers.overlay.append(root);
  // The HUD (objective card, buttons) would shine through the veil and cover cards.
  const hud = ctx.layers.hud, hudVisibility = hud.style.visibility;
  hud.style.visibility = 'hidden';
  const restoreHud = () => { hud.style.visibility = hudVisibility; };
  opts.decorate?.(stage, root);
  requestAnimationFrame(() => root.classList.add('is-in'));

  const alive = () => epoch === ctx.epoch && root.isConnected && !ctx.stale();
  const result: PickResult = { picks: [], mistakes: 0 };
  let buttons: HTMLButtonElement[] = [];
  let focus = 0;
  let mode: 'pick' | 'reply' | 'busy' = 'busy';
  let onPick: (id: string) => void = () => {};
  let onContinue: () => void = () => {};

  const enabled = () => buttons.filter(b => !b.disabled);
  const setFocus = (i: number) => {
    const list = enabled();
    if (!list.length) return;
    focus = (i + list.length) % list.length;
    buttons.forEach(b => b.classList.remove('is-focus'));
    list[focus].classList.add('is-focus');
    if (!touch) list[focus].focus({ preventScroll: true });
  };
  const close = ctx.open({
    id: 'scene-pick', allowMenu: false,
    onKey(e) {
      if (e.repeat) return true;
      if (mode === 'reply') { if (isConfirm(e)) onContinue(); return true; }
      if (mode !== 'pick') return true;
      const n = Number(e.key);
      if (n >= 1 && n <= 9) { const b = buttons[n - 1]; if (b && !b.disabled) onPick(b.dataset.id!); return true; }
      if (e.code === 'ArrowRight' || e.code === 'ArrowDown' || e.code === 'KeyD' || e.code === 'KeyS') { setFocus(focus + 1); return true; }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowUp' || e.code === 'KeyA' || e.code === 'KeyW') { setFocus(focus - 1); return true; }
      if (isConfirm(e)) { const b = enabled()[focus]; if (b) onPick(b.dataset.id!); return true; }
      return true;
    },
    onKeyUp: () => true,
  });
  reply.addEventListener('pointerdown', e => { if (mode === 'reply') { e.preventDefault(); onContinue(); } });

  const accent = (mood?: PickVerdict['mood']) => {
    if (!mood) return;
    root.classList.remove('fx-calm', 'fx-shake', 'fx-flash', 'fx-hurt', 'fx-good');
    void root.offsetWidth;
    root.classList.add(`fx-${mood}`);
  };
  const showLines = async (list: PickLine[]) => {
    for (const line of list) {
      if (!alive()) return;
      reply.replaceChildren();
      if (line.speaker) reply.append(el('b', 'pick-speaker', nameOf(line.speaker)));
      reply.append(el('span', 'pick-text', line.text), el('span', 'pick-next', touch ? '▸' : '⏎'));
      reply.classList.add('is-shown');
      mode = 'reply';
      await new Promise<void>(resolve => { onContinue = () => { onContinue = () => {}; resolve(); }; });
      if (alive()) sfx('ui-move', { volume: 0.3 });
    }
    reply.classList.remove('is-shown');
  };

  const playRound = async (index: number, round: PickRound): Promise<void> => {
    root.dataset.round = String(index);
    root.dataset.cue = round.cue ?? '';
    prompt.replaceChildren();
    if (round.prompt) {
      if (round.prompt.speaker) prompt.append(el('b', 'pick-speaker', nameOf(round.prompt.speaker)));
      prompt.append(el('span', 'pick-text', round.prompt.text));
    }
    cardsEl.replaceChildren();
    const spots = driftSpots(round.cards.length);
    buttons = round.cards.map((c, i) => {
      const b = el('button', 'pick-card');
      b.type = 'button';
      b.dataset.id = c.id;
      b.disabled = Boolean(c.disabled);
      if (c.disabled && c.reason) b.title = c.reason;
      b.append(el('span', 'pick-num', String(i + 1)), el('span', 'pick-label', c.text));
      if (c.tag) b.append(el('span', 'pick-tag', c.tag));
      if (layout === 'drift') {
        b.style.left = `${spots[i].x * 100}%`;
        b.style.top = `${spots[i].y * 100}%`;
        b.style.setProperty('--drift-delay', `${-(i * 1.7) % 6}s`);
      }
      b.addEventListener('click', () => { if (mode === 'pick' && !b.disabled) onPick(c.id); });
      cardsEl.append(b);
      return b;
    });
    await opts.onRound?.(index, round);
    if (!alive()) return;
    const need = round.need ?? 1;
    let held = 0;
    while (held < need && alive()) {
      mode = 'pick';
      root.classList.add('is-picking');
      setFocus(0);
      let timer = 0;
      const picked = await new Promise<string>(resolve => {
        onPick = id => { onPick = () => {}; resolve(id); };
        if (round.timeoutMs && round.timeoutPick) {
          breath.classList.remove('is-running');
          void breath.offsetWidth;
          breath.style.setProperty('--breath', `${round.timeoutMs}ms`);
          breath.classList.add('is-running');
          timer = window.setTimeout(() => onPick(round.timeoutPick!), round.timeoutMs);
        }
      });
      clearTimeout(timer);
      breath.classList.remove('is-running');
      root.classList.remove('is-picking');
      mode = 'busy';
      if (!alive()) return;
      const card = buttons.find(b => b.dataset.id === picked);
      const verdict = await round.judge(picked);
      if (!alive()) return;
      result.picks.push({ round: index, id: picked, ok: verdict.ok });
      if (verdict.ok) { held++; card?.classList.add('is-held'); if (card) card.disabled = true; sfx('ui-confirm', { volume: 0.5 }); }
      else {
        result.mistakes++;
        if (card && !verdict.retry) { card.classList.add('is-wrong'); card.disabled = true; }
        sfx('ui-cancel', { volume: 0.5 });
      }
      accent(verdict.mood ?? (verdict.ok ? 'good' : 'shake'));
      await opts.onVerdict?.(verdict, index, picked);
      if (!alive()) return;
      await showLines(lines(verdict.reply));
      if (verdict.endRound) break;
      if (!enabled().length) break;
    }
    pips.children[index]?.classList.add('is-done');
  };

  return new Promise<PickResult>(resolve => {
    void (async () => {
      for (let i = 0; i < opts.rounds.length; i++) {
        await playRound(i, opts.rounds[i]);
        if (!alive()) { close(); restoreHud(); root.remove(); return; }
      }
      close();
      restoreHud();
      root.classList.add('is-out');
      setTimeout(() => root.remove(), ctx.reducedMotion ? 60 : 360);
      resolve(result);
    })().catch(err => { console.error(err); close(); restoreHud(); root.remove(); resolve(result); });
  });
}

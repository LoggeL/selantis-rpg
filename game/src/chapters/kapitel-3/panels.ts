// DOM minigame panels of Kapitel III (Chronik style): the clue board („Lias Notizen“), „Sanft pusten“ and
// „Der Pflock“. Panels claim the keyboard through the UI modal stack (input lock, no key reaches the world).
import { G } from '../../core/G';
import { clues as clueCatalog } from '../../core/catalog';
import type { UiApiExt } from '../../ui';
import { ctx, isConfirm } from '../../ui/context';
import { BOARD_CLUES, combine, complete, FINAL } from './deduce';
import { blowConfig, blowStart, blowStep, stakeStart, stakeStep, stakeTug, type StakeState } from './games';
import type { Song } from './song';
import { createMiniIllustration } from '../../ui/miniIllustration';

const ui = () => G.ui as UiApiExt;
const sfx = (name: Parameters<typeof G.audio.sfx>[0], opts?: Parameters<typeof G.audio.sfx>[1]) => { try { G.audio.sfx(name, opts); } catch { /* audio optional */ } };
const touch = () => ctx.root?.classList.contains('is-touch') ?? false;

const STYLE = `
.k3-veil { position: absolute; inset: 0; display: grid; place-items: center; background: radial-gradient(120% 100% at 50% 60%, rgba(8,10,16,.35), rgba(8,10,16,.82)); animation: k3-in .35s ease-out; }
.k3-bottom { place-items: end center; padding-bottom: 4%; background: linear-gradient(180deg, transparent 35%, rgba(8,10,16,.72)); }
@keyframes k3-in { from { opacity: 0; } to { opacity: 1; } }
.k3-box { width: min(46em, 92%); max-height: 92%; overflow: auto; padding: 1.1em 1.4em 1.2em; border-radius: var(--radius, .6em); }
.k3-head { display: flex; align-items: center; justify-content: space-between; gap: 1em; margin-bottom: .4em; }
.k3-head .ch-title { font-size: 1.35em; }
.k3-help { margin: 0 0 .7em; font-family: var(--f-body); font-style: italic; opacity: .85; font-size: .95em; }
.k3-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .55em; }
.k3-card { text-align: left; font: inherit; color: var(--ink); cursor: pointer; padding: .55em .7em; border-radius: .45em; border: 2px solid rgba(43,33,25,.25);
  background: radial-gradient(140% 120% at 50% 35%, #f6ecd5 0%, #eddcb7 60%, #d8bf90 100%); box-shadow: inset 0 0 1em rgba(120,78,30,.25); transition: transform .12s, border-color .12s, box-shadow .12s; min-height: 5.2em; }
.k3-card b { display: block; font-family: var(--f-label); letter-spacing: .04em; font-size: .9em; margin-bottom: .2em; }
.k3-card span { font-family: var(--f-body); font-size: .82em; line-height: 1.25; display: block; }
.k3-card.is-focus { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(216,178,90,.45), inset 0 0 1em rgba(120,78,30,.25); }
.k3-card.is-pick { transform: translateY(-3px) rotate(-1deg); border-color: var(--turq, #49e0c8); box-shadow: 0 0 .8em rgba(73,224,200,.45), inset 0 0 1em rgba(120,78,30,.25); }
.k3-card.is-missing { cursor: default; opacity: .55; background: rgba(239,227,200,.12); color: var(--parch); border-style: dashed; border-color: rgba(216,178,90,.35); box-shadow: none; }
.k3-card.is-used { opacity: .72; }
.k3-card.is-used b::after { content: ' ✓'; color: #3f7a4a; }
.k3-out { margin-top: .8em; padding: .6em .9em; border-radius: .45em; min-height: 2.6em; font-family: var(--f-body); font-style: italic; }
.k3-out.is-bad { color: #7a2e1f; }
.k3-done { margin-top: .6em; font-family: var(--f-body); font-size: .9em; }
.k3-done div { padding: .15em 0; }
.k3-done div::before { content: '❖ '; color: var(--gold); }
.k3-done .is-final { color: var(--gold-hi, #f1d48a); font-weight: 700; }
.k3-keys { margin-top: .6em; font-family: var(--f-label); font-size: .8em; opacity: .75; letter-spacing: .05em; }
.k3-play { width: min(34em, 90%); padding: .9em 1.3em 1em; text-align: center; border-radius: var(--radius, .6em); }
.k3-illustration { position: relative; height: 8em; margin: .4em 0 .7em; border-radius: .5em; border: 1px solid var(--gold-line); background: linear-gradient(#0b0f17, #1b2231); overflow: hidden; box-shadow: inset 0 .15em .4em rgba(0,0,0,.6); }
.k3-illustration.is-puff { filter: saturate(.45); }
.k3-play .ch-title { font-size: 1.25em; }
.k3-sub { font-family: var(--f-body); font-style: italic; opacity: .9; margin: .25em 0 .7em; min-height: 1.3em; }
.k3-ember { width: 5.5em; height: 5.5em; margin: .2em auto .6em; border-radius: 50%; background: radial-gradient(circle, #fff3c4 0%, #ffb24a 28%, #e0562a 55%, rgba(120,30,10,0) 72%);
  filter: drop-shadow(0 0 .6em rgba(255,140,50,.55)); transform: scale(var(--s, .35)); opacity: var(--o, .5); transition: transform .08s linear, opacity .08s linear; }
.k3-ember.is-puff { animation: k3-puff .5s ease-out; }
@keyframes k3-puff { 0% { filter: grayscale(1) blur(2px); } 100% { filter: drop-shadow(0 0 .6em rgba(255,140,50,.55)); } }
.k3-meter { position: relative; height: 1.1em; border-radius: .55em; background: rgba(0,0,0,.45); border: 1px solid rgba(216,178,90,.35); overflow: hidden; margin: 0 .4em; }
.k3-zone { position: absolute; top: 0; bottom: 0; background: linear-gradient(90deg, rgba(255,176,74,.25), rgba(255,176,74,.6), rgba(255,176,74,.25)); border-left: 1px solid #ffcf80; border-right: 1px solid #ffcf80; }
.k3-needle { position: absolute; top: -2px; bottom: -2px; width: 4px; margin-left: -2px; background: var(--parch); box-shadow: 0 0 .4em #fff; border-radius: 2px; }
.k3-airflow { display: block; width: calc(100% - .8em); margin: .7em .4em .2em; min-height: 2em; accent-color: #f1d48a; cursor: ew-resize; }
.k3-bar { height: .7em; border-radius: .35em; background: rgba(0,0,0,.45); border: 1px solid rgba(216,178,90,.3); overflow: hidden; margin: .25em .4em .45em; }
.k3-bar > i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #b8913c, #f1d48a); transition: width .12s; }
.k3-bar.is-noise > i { background: linear-gradient(90deg, #8a3a32, #d4573b); }
.k3-barlabel { display: flex; justify-content: space-between; font-family: var(--f-label); font-size: .78em; letter-spacing: .06em; opacity: .85; margin: 0 .5em; }
.k3-ring { width: 4.4em; height: 4.4em; margin: .1em auto .5em; border-radius: 50%; border: 3px solid var(--gold); display: grid; place-items: center; font-family: var(--f-label); font-size: 1em; color: var(--parch); transition: transform .08s, background .15s, border-color .15s; }
.k3-ring.is-beat { transform: scale(1.18); background: rgba(216,178,90,.25); }
.k3-ring.is-rest { border-color: rgba(200,200,200,.3); color: rgba(239,227,200,.5); }
.k3-ring.is-hit { background: rgba(73,224,200,.25); border-color: var(--turq, #49e0c8); }
.k3-ring.is-miss { background: rgba(212,87,59,.35); border-color: #d4573b; }
.k3-watch { min-height: 1.4em; font-family: var(--f-label); letter-spacing: .06em; color: #f0a08a; }
.k3-watch.is-on { animation: k3-blink .45s steps(2) infinite; color: #ff7a5c; }
@keyframes k3-blink { 50% { opacity: .45; } }
.k3-lyric { font-family: var(--f-body); font-style: italic; color: #f1d48a; min-height: 1.4em; }
.is-small .k3-box { padding: .7em .9em .8em; max-height: 96%; }
.is-small .k3-help { display: none; }
.is-small .k3-card { min-height: 0; padding: .4em .55em; }
.is-small .k3-card span { display: none; }
.is-small .k3-card.is-missing span { display: block; }
.is-small .k3-out { margin-top: .5em; min-height: 0; }
.is-small .k3-play { padding: .6em 1em .7em; }
.is-small .k3-ring { width: 3.4em; height: 3.4em; margin-bottom: .3em; }
.is-small .k3-ember { width: 4em; height: 4em; }
.is-small .k3-illustration { height: 6em; }
`;

function injectStyle(): void {
  if (document.getElementById('k3-style')) return;
  const s = document.createElement('style');
  s.id = 'k3-style';
  s.textContent = STYLE;
  document.head.appendChild(s);
}

function keyHint(desktop: string, mobile: string): string { return touch() ? mobile : desktop; }

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
 */
export function openClueBoard(): Promise<number> {
  injectStyle();
  const root = ui().panel('k3-notes');
  const veil = document.createElement('div');
  veil.className = 'k3-veil';
  const box = document.createElement('div');
  box.className = 'k3-box ch-panel';
  box.innerHTML = `<div class="k3-head"><span class="ch-title">Lias Notizen</span><button class="ch-btn k3-close" type="button">Schließen</button></div>
    <p class="k3-help">Wähle zwei Hinweise, die zusammengehören. Was passt, schreibe ich als Schluss auf.</p>
    <div class="k3-grid"></div><div class="k3-out ch-parch"></div><div class="k3-done"></div>
    <div class="k3-keys">${keyHint('Pfeile wählen · E/Enter markieren · Esc schließen', 'Tippen zum Markieren')}</div>`;
  veil.appendChild(box);
  root.appendChild(veil);
  const grid = box.querySelector('.k3-grid') as HTMLElement;
  const out = box.querySelector('.k3-out') as HTMLElement;
  const done = box.querySelector('.k3-done') as HTMLElement;
  out.textContent = 'Was weiß ich schon?';
  let picked: string | null = null;
  let focus = 0;
  let made = 0;
  const cards: HTMLButtonElement[] = [];

  const used = (id: string) => G.state.data.clues.some(c => c.startsWith('k3-schluss') && combineParts(c).includes(id));
  const render = () => {
    grid.textContent = '';
    cards.length = 0;
    for (const id of BOARD_CLUES) {
      const found = G.state.hasClue(id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'k3-card';
      b.dataset.clue = id;
      if (!found) {
        b.classList.add('is-missing');
        b.innerHTML = `<b>? ? ?</b><span>${MISSING_HINT[id]}</span>`;
        b.disabled = true;
      } else {
        const def = clueCatalog.get(id);
        b.innerHTML = `<b>${def?.title ?? id}</b><span>${def?.text ?? ''}</span>`;
        if (used(id)) b.classList.add('is-used');
        if (picked === id) b.classList.add('is-pick');
        b.addEventListener('click', () => pick(id));
      }
      grid.appendChild(b);
      cards.push(b);
    }
    cards.forEach((c, i) => c.classList.toggle('is-focus', i === focus && !touch()));
    done.textContent = '';
    for (const id of [...G.state.data.clues.filter(c => c.startsWith('k3-schluss') && c !== FINAL), ...(G.state.hasClue(FINAL) ? [FINAL] : [])]) {
      const d = document.createElement('div');
      d.textContent = clueCatalog.get(id)?.text ?? id;
      if (id === FINAL) d.className = 'is-final';
      done.appendChild(d);
    }
  };

  const pick = (id: string) => {
    if (!G.state.hasClue(id)) return;
    sfx('page', { volume: 0.6 });
    if (!picked || picked === id) { picked = picked === id ? null : id; render(); return; }
    const d = combine(picked, id);
    picked = null;
    if (!d) {
      out.classList.add('is-bad');
      out.textContent = 'Nein … das gehört nicht zusammen.';
      sfx('ui-cancel');
    } else if (G.state.hasClue(d.id)) {
      out.classList.remove('is-bad');
      out.textContent = 'Das habe ich schon aufgeschrieben.';
    } else {
      out.classList.remove('is-bad');
      out.textContent = d.line;
      sfx('write');
      G.state.addClue(d.id);
      made++;
      if (complete(G.state.data.clues) && !G.state.hasClue(FINAL)) {
        setTimeout(() => {
          if (!root.isConnected) return;
          G.state.addClue(FINAL);
          out.innerHTML = '<b>Kyra lebt.</b> Sie war letzte Nacht hier – in derselben Nacht, in der ich Crios sah.';
          render();
        }, 900);
      }
    }
    render();
  };

  return new Promise<number>(resolve => {
    let closeModal = () => {};
    const close = () => {
      closeModal();
      root.remove();
      sfx('ui-close');
      resolve(made);
    };
    closeModal = ctx.open({
      id: 'k3-notes',
      onKey: e => {
        if (e.key === 'Escape' || e.key === 'i' || e.key === 'I') { close(); return true; }
        const cols = 3;
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

/** Lia blows on Azar's glowing tinder. Resolves when the flame catches. */
export function blowGame(withTinder: boolean): Promise<void> {
  injectStyle();
  const cfg = blowConfig(withTinder);
  const root = ui().panel('k3-blow');
  root.innerHTML = `<div class="k3-veil k3-bottom"><div class="k3-play ch-panel">
    <div class="ch-title">Sanft pusten</div>
    <div class="k3-sub">${withTinder ? 'Mein Zunder ist trocken. Ganz vorsichtig …' : 'Nicht zu fest, sonst ist die Glut wieder aus.'}</div>
    <div class="k3-illustration"></div>
    <div class="k3-meter"><div class="k3-zone"></div><div class="k3-needle"></div></div>
    <input class="k3-airflow" type="range" min="0" max="100" value="0" aria-label="Atemstärke">
    <div class="k3-keys">${keyHint('← / → oder A / D: Atemstärke ändern · Regler ziehen', 'Regler ziehen: Atemstärke im hellen Feld halten')}</div>
  </div></div>`;
  const ember = root.querySelector('.k3-illustration') as HTMLElement;
  const illustration = createMiniIllustration(ember, 'blow');
  const zone = root.querySelector('.k3-zone') as HTMLElement;
  const needle = root.querySelector('.k3-needle') as HTMLElement;
  const sub = root.querySelector('.k3-sub') as HTMLElement;
  const airflow = root.querySelector<HTMLInputElement>('.k3-airflow')!;
  let state = blowStart();
  return new Promise<void>(resolve => {
    let last = performance.now();
    let finished = false;
    let puffUntil = 0;
    const epoch = ctx.epoch;
    const alive = () => root.isConnected && epoch === ctx.epoch && !ctx.stale();
    const setBreath = (value: number) => { state = { ...state, breath: Math.max(0, Math.min(1, value)) }; };
    airflow.addEventListener('input', () => setBreath(Number(airflow.value) / 100));
    let breathLoop: { stop(ms?: number): void; set(o: { volume?: number }): void } | null = null;
    const closeModal = ctx.open({
      id: 'k3-blow',
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
      const r = blowStep(state, dt, 0, cfg);
      state = r.state;
      if (state.breath > 0.08 && !breathLoop) { try { breathLoop = G.audio.loop('whoosh', { interval: 0.42, volume: 0.25 }); } catch { breathLoop = null; } }
      if (state.breath <= 0.08 && breathLoop) { breathLoop.stop(150); breathLoop = null; }
      breathLoop?.set({ volume: 0.15 + state.breath * 0.35 });
      airflow.value = String(state.breath * 100);
      zone.style.left = `${(cfg.lo + state.drift) * 100}%`;
      zone.style.width = `${(cfg.hi - cfg.lo) * 100}%`;
      needle.style.left = `${state.breath * 100}%`;
      illustration.render({ progress: state.ember, breath: state.breath, puff: now < puffUntil }, dt);
      ember.classList.toggle('is-puff', now < puffUntil);
      root.dataset.ember = state.ember.toFixed(3);
      root.dataset.breath = state.breath.toFixed(3);
      root.dataset.lo = (cfg.lo + state.drift).toFixed(3);
      root.dataset.hi = (cfg.hi + state.drift).toFixed(3);
      if (r.event === 'puff') {
        sfx('whoosh', { volume: 0.6, pitch: 0.7 });
        puffUntil = now + 600;
        sub.textContent = 'Zu fest! Die Glut wäre fast ausgegangen.';
      } else if (state.ember > 0.55) sub.textContent = 'Es qualmt … weiter so!';
      if (r.event === 'catch') {
        finished = true;
        breathLoop?.stop(100);
        sfx('fire-ignite');
        sub.textContent = 'Eine Flamme!';
        setTimeout(() => { const current = alive(); closeModal(); root.remove(); if (current) resolve(); }, 650);
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

// ------------------------------------------------------------------------------------------------ Der Pflock

/**
 * Kyra rocks the stake loose in time with the soldiers' drum. A soldier turns round at full noise; tugging while he
 * looks costs progress. `onLook` lets the world show it (a bark over the soldier). Resolves when the stake is out.
 */
export function stakeGame(song: Song, onLook?: (on: boolean) => void): Promise<void> {
  injectStyle();
  const root = ui().panel('k3-stake');
  root.innerHTML = `<div class="k3-veil k3-bottom"><div class="k3-play ch-panel">
    <div class="ch-title">Der Pflock</div>
    <div class="k3-lyric">…</div>
    <div class="k3-illustration"></div>
    <div class="k3-ring">♪</div>
    <div class="k3-barlabel"><span>Pflock locker</span><span>Lärm</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4em"><div class="k3-bar"><i class="k3-loose"></i></div><div class="k3-bar is-noise"><i class="k3-noise"></i></div></div>
    <div class="k3-watch"></div>
    <div class="k3-keys">${keyHint('E · Leertaste · Klick im Takt der Trommel. In den Pausen: stillhalten!', 'Im Takt der Trommel tippen. In den Pausen: stillhalten!')}</div>
  </div></div>`;
  const lyric = root.querySelector('.k3-lyric') as HTMLElement;
  const ring = root.querySelector('.k3-ring') as HTMLElement;
  const loose = root.querySelector('.k3-loose') as HTMLElement;
  const noise = root.querySelector('.k3-noise') as HTMLElement;
  const watch = root.querySelector('.k3-watch') as HTMLElement;
  const illustration = createMiniIllustration(root.querySelector<HTMLElement>('.k3-illustration')!, 'stake');
  let state: StakeState = stakeStart();
  let rest = false;
  let lastBeatAt = performance.now();
  return new Promise<void>(resolve => {
    let finished = false;
    const offs: (() => void)[] = [];
    offs.push(song.onBeat(b => {
      rest = b.rest;
      lastBeatAt = b.at;
      root.dataset.rest = rest ? '1' : '0';
      ring.classList.toggle('is-rest', rest);
      ring.textContent = rest ? '…' : '♪';
      if (rest) lyric.textContent = 'Sie trinken. Still jetzt!';
      if (!rest) { ring.classList.add('is-beat'); setTimeout(() => ring.classList.remove('is-beat'), 110); }
    }));
    offs.push(song.onLine(text => { lyric.textContent = `„${text}“`; }));
    const tug = () => {
      if (finished) return;
      const now = performance.now();
      const r = stakeTug(state, now, lastBeatAt, song.nextBeatAt, rest);
      state = r.state;
      ring.classList.remove('is-hit', 'is-miss');
      void ring.offsetWidth;
      if (r.result === 'hit') { ring.classList.add('is-hit'); sfx('thud', { volume: 0.25, pitch: 1.6, key: 'k3-stake' }); }
      else {
        ring.classList.add('is-miss');
        sfx('chain', { volume: r.result === 'caught' ? 0.9 : 0.55 });
        if (r.result === 'caught') { watch.textContent = 'Er hat etwas gehört! Kyra erstarrt.'; onLook?.(false); }
      }
      root.dataset.loose = state.loose.toFixed(3);
      if (state.loose >= 1) finish();
    };
    const closeModal = ctx.open({
      id: 'k3-stake',
      onKey: e => { if (isConfirm(e)) { if (!e.repeat) tug(); return true; } return e.key !== 'Escape'; },
    });
    root.addEventListener('pointerdown', e => { e.preventDefault(); tug(); });
    let last = performance.now();
    const frame = (now: number) => {
      if (finished) return;
      if (!root.isConnected) { closeModal(); offs.forEach(o => o()); return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const r = stakeStep(state, dt);
      state = r.state;
      if (r.event === 'look') { watch.textContent = 'Ein Kerl dreht sich um! Stillhalten!'; watch.classList.add('is-on'); sfx('suspicious'); onLook?.(true); }
      if (r.event === 'away') { watch.textContent = ''; watch.classList.remove('is-on'); onLook?.(false); }
      if (state.watch <= 0 && watch.classList.contains('is-on')) watch.classList.remove('is-on');
      illustration.render({ progress: state.loose, noise: state.noise, watch: state.watch > 0, beat: !rest && now - lastBeatAt < 150 }, dt);
      loose.style.width = `${state.loose * 100}%`;
      noise.style.width = `${state.noise * 100}%`;
      root.dataset.next = String(song.nextBeatAt);
      root.dataset.last = String(lastBeatAt);
      root.dataset.watch = state.watch > 0 ? '1' : '0';
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const finish = () => {
      finished = true;
      offs.forEach(o => o());
      sfx('thud', { volume: 0.8, pitch: 0.6 });
      sfx('chain', { volume: 0.4 });
      watch.classList.remove('is-on');
      watch.textContent = 'Der Pflock gibt nach!';
      setTimeout(() => { closeModal(); root.remove(); resolve(); }, 700);
    };
  });
}

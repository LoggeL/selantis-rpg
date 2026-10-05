// Training at the palisade (bruderschaft, DESIGN.md §7.4 Adaption): Foltan teaches Ausweichen with a wooden sword
// (timing drill: a strike is telegraphed left, right or high; dodge AWAY from it, feints punish early guesses),
// then Gundrik and Jorin turn Ablenken into a little puzzle (make the guard look away from your friend).
import Phaser from 'phaser';
import { G } from '../../core/G';
import type { UiApiExt } from '../../ui';
import type { CharAnim } from '../../art/api';
import type { WorldCtx } from '../../world';
import { bg, lia, sfx } from './shared';

import { dodgeFor, judge, strikePlan, type Dodge, type StrikeSide } from './drillLogic';

const STYLE_ID = 'k4-drill-style';
const CSS = `
.k4-drill{pointer-events:none}
.k4-drill .k4-bar{position:absolute;left:50%;bottom:4%;transform:translateX(-50%);display:flex;gap:.6em;align-items:center;padding:.5em .8em;pointer-events:auto}
.k4-drill .k4-btn{min-width:5.6em;padding:.45em .7em;display:flex;flex-direction:column;align-items:center;gap:.15em;font-size:1em;cursor:pointer;touch-action:manipulation}
.k4-drill .k4-btn .k4-arrow{font-size:1.5em;line-height:1}
.k4-drill .k4-btn small{font-family:var(--f-label);font-size:.7em;opacity:.85}
.k4-drill .k4-btn.is-hit{background:rgba(212,87,59,.35)}
.k4-drill .k4-btn.is-ok{background:rgba(216,178,90,.35)}
.k4-drill .k4-cue{position:absolute;left:50%;bottom:20%;transform:translateX(-50%);font-family:var(--f-head);font-size:1.5em;color:var(--gold-hi,#f3d48a);text-shadow:0 0 .4em #000,0 0 .15em #000;letter-spacing:.04em;pointer-events:none}
.k4-drill .k4-cue.is-late{color:#ff7a5c}
.k4-drill .k4-score{font-family:var(--f-label);color:var(--gold);min-width:6.5em;text-align:center;font-size:.95em}
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

/**
 * The dodge drill. Foltan stands right of Lia. Needs `need` successful dodges; never fails for good (after many
 * strikes Foltan calls it a day). Returns the number of hits Lia took.
 */
export async function ausweichDrill(w: WorldCtx, need = 5): Promise<number> {
  const ui = G.ui as UiApiExt;
  ensureStyle();
  const foltan = w.actor('foltan');
  const scene = w.scene;
  const gfx = scene.add.graphics().setDepth(5000);
  const panel = G.ui.panel('k4-drill');
  panel.innerHTML = `
    <div class="k4-cue"></div>
    <div class="k4-bar ch-panel">
      <button class="k4-btn ch-btn" data-d="left"><span class="k4-arrow">◀</span><small>A / ←</small></button>
      <button class="k4-btn ch-btn" data-d="duck"><span class="k4-arrow">▼</span><small>S / ↓ Ducken</small></button>
      <div class="k4-score">Ausgewichen 0/${need}</div>
      <button class="k4-btn ch-btn" data-d="right"><span class="k4-arrow">▶</span><small>D / →</small></button>
    </div>`;
  const score = panel.querySelector('.k4-score') as HTMLElement;
  let answer: Dodge | null = null;
  let armed = false;
  const commit = (d: Dodge) => {
    if (!armed || answer) return;
    answer = d;
    const btn = panel.querySelector(`[data-d="${d}"]`);
    btn?.classList.add('is-ok');
    setTimeout(() => btn?.classList.remove('is-ok'), 260);
  };
  const onKey = (e: KeyboardEvent) => {
    const d = KEYMAP[e.code];
    if (!d || e.repeat) return;
    e.preventDefault();
    commit(d);
  };
  window.addEventListener('keydown', onKey, true);
  for (const b of panel.querySelectorAll<HTMLButtonElement>('.k4-btn')) {
    b.addEventListener('pointerdown', ev => { ev.preventDefault(); commit(b.dataset.d as Dodge); });
  }
  const cleanup = () => {
    window.removeEventListener('keydown', onKey, true);
    panel.remove();
    if (gfx.active) gfx.destroy();
  };
  scene.events.once('shutdown', cleanup);

  const cue = panel.querySelector('.k4-cue') as HTMLElement;
  const CUE: Record<StrikeSide, string> = { left: 'Hieb von links!', right: 'Hieb von rechts!', high: 'Hoher Hieb!' };
  const drawArc = (side: StrikeSide, k: number, flash = false) => {
    gfx.clear();
    const p = w.player;
    const color = flash ? 0xffffff : k > 0.7 ? 0xff5a3c : 0xf0c060;
    const alpha = 0.55 + 0.45 * k;
    const cx = p.x, cy = p.y - 22;
    const width = 3 + k * 4;
    gfx.lineStyle(width + 3, 0x1a0e08, alpha * 0.6);
    const arc = (dx: number) => {
      gfx.beginPath();
      if (side === 'high') gfx.arc(cx, cy - 8, 30 - k * 10, Phaser.Math.DegToRad(205), Phaser.Math.DegToRad(335));
      else gfx.arc(cx + dx * (34 - k * 14), cy, 22, Phaser.Math.DegToRad(dx < 0 ? 125 : -55), Phaser.Math.DegToRad(dx < 0 ? 235 : 55));
      gfx.strokePath();
    };
    const dx = side === 'left' ? -1 : 1;
    arc(dx);
    gfx.lineStyle(width, color, alpha);
    arc(dx);
    // the blade tip
    const tx = side === 'high' ? cx : cx + dx * (36 - k * 14), ty = side === 'high' ? cy - 34 + k * 10 : cy;
    gfx.fillStyle(color, alpha);
    gfx.fillCircle(tx, ty, 3 + k * 3);
    cue.textContent = CUE[side];
    cue.classList.toggle('is-late', k > 0.7);
  };

  // Read-only probe for automated playtests (e2e/kapitel-4.pw.ts): what the telegraph currently shows.
  const probe = { armed: false, side: 'left' as StrikeSide, k: 0, ok: 0 };
  (window as unknown as { __k4drill?: typeof probe }).__k4drill = probe;
  let ok = 0, hits = 0, streakMiss = 0, feintMiss = 0;
  const plan = strikePlan(16);
  const home = { x: w.player.x, y: w.player.y };
  for (let i = 0; i < plan.length && ok < need; i++) {
    if (!w.alive) break;
    const s = plan[i];
    answer = null;
    await ui.wait(i === 0 ? 400 : 650);
    foltan.face('player');
    w.player.face('foltan');
    armed = true;
    sfx('swing', { volume: 0.25, pitch: 0.7 });
    const t0 = performance.now();
    let side = s.side;
    let flipped = false;
    probe.armed = true;
    while (performance.now() - t0 < s.windup) {
      const k = (performance.now() - t0) / s.windup;
      probe.side = side; probe.k = k;
      if (s.feint && !flipped && k > 0.5) { flipped = true; side = s.feint; sfx('whoosh', { volume: 0.35, pitch: 1.3 }); drawArc(side, k, true); await ui.wait(60); continue; }
      drawArc(side, k);
      await ui.wait(16);
    }
    armed = false;
    probe.armed = false;
    gfx.clear();
    cue.textContent = '';
    bg(foltan.play('attack', { once: true }));
    sfx('swing', { volume: 0.9 });
    const success = judge(s, answer);
    if (success) {
      ok++; streakMiss = 0;
      sfx('dodge', { volume: 0.9 });
      const d: Dodge = answer!;
      if (d === 'duck') {
        bg(w.player.play('crouch' as CharAnim, { ms: 420 }));
      } else {
        const off = d === 'left' ? -12 : 12;
        w.player.teleport([home.x + off, home.y]);
        await ui.wait(260);
        w.player.teleport([home.x, home.y]);
      }
      w.fx.burst([w.player.x, w.player.y - 4], 'dust', 4);
      if (s.feint) w.bark('foltan', 'Gut gewartet!', 1100);
      else if (ok === need - 1) w.bark('foltan', 'Einer noch!', 1000);
    } else {
      hits++; streakMiss++;
      sfx('thud', { volume: 0.8 });
      w.camera.shake(160, 0.004);
      bg(w.player.play('hit', { ms: 380 }));
      const btn = panel.querySelector(answer ? `[data-d="${answer}"]` : '.k4-score');
      btn?.classList.add('is-hit');
      setTimeout(() => btn?.classList.remove('is-hit'), 360);
      if (s.feint && answer === dodgeFor(s.side)) { feintMiss++; w.bark('foltan', feintMiss === 1 ? 'Angetäuscht! Warte bis zuletzt.' : 'Zu früh. Wieder.', 1500); }
      else if (!answer) w.bark('player', 'Zu langsam … au.', 1200);
      else if (streakMiss >= 2) w.bark('foltan', 'Weg von der Klinge, nicht hin!', 1600);
      else w.bark('player', 'Au!', 900);
    }
    score.textContent = `Ausgewichen ${ok}/${need}`;
    probe.ok = ok;
  }
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
      await jorin.say('Hab sie! Das Banner ist unser!');
      gundrik.face('k4-jorin');
      bg(gundrik.emote('anger'));
      await gundrik.say('Bei meinem Bart! Hinterhältig. Gut gemacht, Kleine.');
      G.state.set('k4-ablenken-stein-ok');
    } else {
      bg(gundrik.emote('!'));
      gundrik.face('k4-jorin');
      await gundrik.say('Und wen sehe ich da? Jorin, du Hasenfuß! Zurück an den Start!');
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
    await jorin.say('Hab sie!');
    gundrik.face('k4-jorin');
    bg(gundrik.emote('…'));
    await gundrik.say('… Ach, verflucht. Mit Worten, ja? Das merk ich mir.');
    G.state.set('k4-ablenken-ok');
  });
}

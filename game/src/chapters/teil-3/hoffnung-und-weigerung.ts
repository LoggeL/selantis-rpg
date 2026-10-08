// Scene „e3-hoffnung-und-weigerung“ – Hoffnung (docs/teil-3/umsetzung.md §3, F3 34:58–38:17). Three checkpointed parts
// (G.goto with { part }, a reload restarts the current part):
//  1. default, e3-innenwelt-riss: Lia's inner meadow again (look e3-lia-innen; the fog of the first visit has lifted,
//     the screen edges still breathe). A white, translucent figure stands in the grass: „ein Teil von dir“, unnamed.
//     Conversation with choices: what the meadow is, what they want outside; Lia lists who is left (Kyra, Flick,
//     Ignatius, free order); the figure senses help coming (plate e3-gestalt). Heart: violet rifts tear the meadow –
//     Lia walks to each and holds still until it closes (three times; muffled voices from outside in between). The
//     fourth tears everywhere: Vamir wakes her.
//  2. 'halle' (only with e3-hw-innen): Vamir's hall. Lia kneels bound at the floor ring (e3-lia-gefesselt, kneel,
//     held in place). She opens her eyes (storyAction); Vamir demands the power and threatens pain; Lia refuses
//     (choice, every option refuses). Baris announces the man from Trapas. Sets e3-geweigert.
//  3. 'kontakt' (only with e3-geweigert): framed „Kurz darauf …“, player knowledge. The contact man is the Doktor: the
//     old copy describes how the first ten took the power from Xenovia (the bearer and ten relics of the first ten
//     humans in a circle, all pointed at her; the page about what happens to her is missing). Vamir: shrines from the
//     raids (plate e3-relikte). Sets e3-relikte-plan. → e3-ritual.
import type { SfxLoop } from '../../audio/api';
import { G } from '../../core/G';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import { HALLE_SPAWNS, HALLE_SPOT, halleBase, halleBrazierLights, pinPlayer } from '../teil-2/gewoelbe';
import { calmRing, drawRift, tearMeadow } from './hoffnung-riss';
import {
  CONTACT, FIGURE_HOPE, FIGURE_TALK, HALL_AFTER, HALL_WAKE, type InnerLine, type Line, MEADOW_OPENING, MEADOW_SPOT,
  OUTSIDE_BETWEEN, REFUSALS, RIFT_HOLD_MS, RIFT_LINES, RIFTS, riftClosed, riftObjective, riftStep, TOPIC_TALK, TOPICS, type Topic,
} from './hoffnung-und-weigerung-texte';
import { innerFog, outsideVoices } from './innere-zuflucht-nebel';
import { INNER_BLOCKS, INNER_OCCLUDERS, INNER_SPOT, INNER_WALK } from './innere-zuflucht-welt';
import { bg, e3Scene, interlude, lia, liaLook, nextScene, sfx, ui, VIOLET } from './shared';

/** Checkpoint flags between the parts, the topics said in this visit, the contract flags. */
const F = { inner: 'e3-hw-innen', topic: (t: Topic) => `e3-hw-thema-${t}`, refused: 'e3-geweigert', plan: 'e3-relikte-plan' } as const;

/** Lia inside herself: the plain portrait (no travel cloak). */
const liaInner = (w: WorldCtx, text: string, mood?: string) => w.say('e3-lia', text, { portrait: 'lia', mood });

async function sayInner(w: WorldCtx, l: InnerLine): Promise<void> {
  if (l.who === 'think') return w.think(l.text);
  if (l.who === 'lia') return liaInner(w, l.text, l.mood);
  return w.say('e3-gestalt', l.text, l.mood ? { mood: l.mood } : undefined);
}

async function sayLine(w: WorldCtx, l: Line): Promise<void> {
  if (l.who === 'think') return w.think(l.text);
  if (l.who === 'lia') return lia(w, l.text, l.mood);
  return w.say(l.who, l.text, l.mood ? { mood: l.mood } : undefined);
}

// ---------------------------------------------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------------------------------------------

/** The inner meadow, second visit (same picture as e3-innere-zuflucht, its own map id). */
export const innenRiss: MapDef = defineMap({
  id: 'e3-innenwelt-riss',
  background: 'e3-innenwelt',
  walk: INNER_WALK,
  block: INNER_BLOCKS,
  occluders: INNER_OCCLUDERS,
  surface: 'grass',
  spawns: { eiche: { at: INNER_SPOT.oakSeat, dir: 'down' } },
  time: 'day',
  ambience: ['wind'],
  ambienceVolume: { wind: 0.2 },
  music: null,
  lookMode: false,
  sneak: false,
  critters: false,
  resetOnEnter: true,
});

/** Vamir's hall at night: Lia kneels at the floor ring. */
export const halleWeigerung: MapDef = defineMap({
  ...halleBase,
  id: 'e3-halle-weigerung',
  name: 'Weit entfernt',
  spawns: { ...HALLE_SPAWNS, thron: { at: HALLE_SPOT.dais, dir: 'down' } },
  lights: halleBrazierLights(0.75),
  time: 'night',
  ambience: ['room'],
  ambienceVolume: { room: 0.6 },
  music: 'dread',
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Part 1: the figure and the rifts
// ---------------------------------------------------------------------------------------------------------------

/** The figure is translucent and very pale (restyled every frame; the engine sets actor alpha itself). */
function translucent(w: WorldCtx, a: ActorHandle): { fadeIn(ms?: number): Promise<void>; fadeOut(ms?: number): Promise<void> } {
  const scene = w.scene;
  let cur = 0, to = 0, rate = 1;
  const onPost = (_time: number, delta: number) => {
    const s = a.exists ? a.sprite : undefined;
    if (!s) return;
    const dt = Math.min(0.1, delta / 1000);
    cur += Math.sign(to - cur) * Math.min(Math.abs(to - cur), dt * rate);
    s.setAlpha(cur * (0.88 + 0.12 * Math.sin(scene.time.now / 500)));
  };
  scene.events.on('postupdate', onPost);
  scene.events.once('shutdown', () => scene.events.off('postupdate', onPost));
  const fade = (target: number, ms: number) => { to = target; rate = Math.max(0.05, Math.abs(target - cur) / (ms / 1000)); return w.wait(ms + 80); };
  return { fadeIn: (ms = 1600) => fade(0.72, ms), fadeOut: (ms = 1400) => fade(0, ms) };
}

let heart: SfxLoop | null = null;

function startHeartbeat(w: WorldCtx): void {
  try { heart = G.audio.loop('heartbeat', { interval: 1.3, volume: 0.24, distance: 0.6 }); } catch { heart = null; }
  w.scene.events.once('shutdown', () => { heart?.stop(600); heart = null; });
}

/** One rift: it tears at `at`; Lia has to stand next to it and hold still until it closes. */
async function holdRift(w: WorldCtx, at: readonly [number, number], seed: number, ring: ReturnType<typeof calmRing>): Promise<void> {
  const rift = drawRift(w, at, seed);
  sfx('shockwave', { volume: 0.3 });
  w.camera.shake(200, 0.002);
  let hold = 0, lx = w.player.x, ly = w.player.y;
  while (w.alive) {
    await w.wait(100);
    const speed = Math.hypot(w.player.x - lx, w.player.y - ly) / 0.1;
    lx = w.player.x; ly = w.player.y;
    if (G.ui.busy()) continue;
    hold = riftStep(hold, 100, Math.hypot(w.player.x - at[0], w.player.y - at[1]), speed);
    ring.set(hold / RIFT_HOLD_MS);
    rift.setOpen(1 - 0.75 * (hold / RIFT_HOLD_MS));
    heart?.set({ interval: hold > 0 ? 1.6 : 0.9, volume: 0.3 });
    if (riftClosed(hold)) break;
  }
  ring.set(0);
  sfx('heal', { volume: 0.35 });
  await rift.close(600);
}

async function innenScript(w: WorldCtx): Promise<void> {
  for (const t of TOPICS) G.state.set(F.topic(t), false);
  w.lockPlayer();
  w.player.setSpeed(40);
  w.player.setIdle('sit');
  const fog = innerFog(w, [], {});
  startHeartbeat(w);
  const figure = w.spawn({ id: 'gestalt', preset: 'e3-gestalt', speaker: 'e3-gestalt', at: MEADOW_SPOT.figure, dir: 'up', solid: false, facePlayer: true, verb: 'Ansprechen', talk: () => {} });
  figure.hold(true);
  const look = translucent(w, figure);
  await ui().fade('in', 2000);
  await w.cutscene(async () => {
    await w.wait(500);
    await sayInner(w, MEADOW_OPENING[0]);
    await look.fadeIn(1800);
    await sayInner(w, MEADOW_OPENING[1]);
    w.player.setIdle('idle');
  });
  w.setObjective('e3-hw-gestalt', 'Wer steht da im Gras? Geh zu ihr.', null);
  w.unlockPlayer();
  await w.waitForInteract('gestalt');
  w.completeObjective('e3-hw-gestalt');

  await w.cutscene(async () => {
    figure.face('player');
    for (const l of FIGURE_TALK) await sayInner(w, l);
    // Lia lists who is left, in any order; all three are said.
    while (TOPICS.some(t => !G.state.is(F.topic(t)))) {
      const open = TOPICS.filter(t => !G.state.is(F.topic(t)));
      const pick = await w.choose(open.map(t => TOPIC_TALK[t].option), { prompt: 'Lia zählt auf …', speaker: 'e3-lia' });
      const t = open[pick];
      for (const l of TOPIC_TALK[t].lines) await sayInner(w, l);
      G.state.set(F.topic(t));
    }
    try { G.audio.music('refuge', { fadeMs: 3000 }); } catch { /* audio optional */ }
    await ui().plate('e3-gestalt', { caption: 'Ein Teil von dir', pan: 'in', durationMs: 10000 });
    for (const l of FIGURE_HOPE) await sayInner(w, l);
    await ui().closePlate();
  });
  // From here on she only watches (no more talking): the same figure without the talk prompt.
  w.despawn('gestalt');
  const still = w.spawn({ id: 'gestalt-still', preset: 'e3-gestalt', at: MEADOW_SPOT.figure, dir: 'down', solid: false, facePlayer: false });
  still.hold(true);
  const stillLook = translucent(w, still);
  await stillLook.fadeIn(0);

  // Heart: the rifts.
  const ring = calmRing(w);
  try { G.audio.music(null, { fadeMs: 1500 }); } catch { /* audio optional */ }
  for (const [i, at] of RIFTS.entries()) {
    if (i === 0) {
      fog.press(true);
      await w.cutscene(async () => {
        const preview = drawRift(w, at, 99);
        await w.wait(700);
        for (const l of RIFT_LINES.first) await sayInner(w, l);
        preview.remove();
      });
      fog.press(false);
    }
    w.setObjective('e3-hw-riss', riftObjective(i), null);
    w.unlockPlayer();
    await holdRift(w, at, i + 1, ring);
    w.lockPlayer();
    for (const l of RIFT_LINES.closed[i]) await sayInner(w, l);
    if (i < OUTSIDE_BETWEEN.length) {
      fog.press(true);
      heart?.set({ interval: 0.8, volume: 0.4 });
      await outsideVoices(OUTSIDE_BETWEEN[i]);
      fog.press(false);
      heart?.set({ interval: 1.3, volume: 0.24 });
    }
  }
  w.completeObjective('e3-hw-riss');

  // The fourth one does not close.
  await w.cutscene(async () => {
    fog.press(true);
    const last = drawRift(w, MEADOW_SPOT.lastRift, 7, 30);
    heart?.set({ interval: 0.55, volume: 0.5 });
    await w.wait(600);
    await sayInner(w, RIFT_LINES.last[0]);
    await sayInner(w, RIFT_LINES.last[1]);
    bg(stillLook.fadeOut(900));
    last.remove();
    await tearMeadow(w, MEADOW_SPOT.lastRift);
  });
  heart?.stop(300);
  G.state.set(F.inner);
  await ui().fade('out', 300);
  await nextScene('e3-hoffnung-und-weigerung', { part: 'halle' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: the refusal
// ---------------------------------------------------------------------------------------------------------------

async function halleScript(w: WorldCtx): Promise<void> {
  w.lockPlayer();
  w.player.teleport(HALLE_SPOT.chained, 'down');
  const release = pinPlayer(w, 'kneel', 'down');
  // Vamir stands in front of her, south of the ring (the interrogation chair is on her other side).
  const vamir = w.spawn({ id: 'vamir', preset: 'vamir', speaker: 'e2-vamir', at: [HALLE_SPOT.chained[0] - 4, HALLE_SPOT.chained[1] + 46], dir: 'up', solid: false, facePlayer: false });
  vamir.hold(true);
  const baris = w.spawn({ id: 'baris', preset: 'baris-scarred', speaker: 'e2-baris', at: HALLE_SPOT.doorSouth, dir: 'up', solid: false, facePlayer: false, speed: 50, hidden: true });
  baris.hold(true);
  await w.camera.zoom(1.4, 0);
  await w.camera.pan([HALLE_SPOT.chained[0] - 30, HALLE_SPOT.chained[1] + 44], 0);
  // Coming to: violet light fades from the edges, then the hall.
  w.lighting.flash(VIOLET, 700);
  await ui().fade('in', 1400);
  await G.ui.storyAction('open-eyes', 'Die Augen öffnen', { help: 'Weg von der Wiese, zurück in den kalten Körper. Mach die Augen auf.' });
  await w.cutscene(async () => {
    for (const l of HALL_WAKE.slice(0, 2)) await sayLine(w, l);
    bg(vamir.play('cast', { ms: 1400 }));
    sfx('magic', { volume: 0.3 });
    for (const l of HALL_WAKE.slice(2)) await sayLine(w, l);
    const pick = await w.choose(REFUSALS.map(r => r.option), { prompt: 'Was antwortet Lia?', speaker: 'e3-lia' });
    const r = REFUSALS[pick];
    G.state.set('e3-weigerung-wort', pick);
    await lia(w, r.lia, r.mood);
    await w.say('e2-vamir', r.vamir);
    // He steps closer; cold violet at his fingers. She does not look away.
    await vamir.walkTo(HALLE_SPOT.chained[0] - 4, HALLE_SPOT.chained[1] + 26, { face: 'up' });
    w.lighting.flash(VIOLET, 300);
    w.camera.shake(220, 0.003);
    await sayLine(w, HALL_AFTER[0]);
    await sayLine(w, HALL_AFTER[1]);
    baris.show();
    await baris.walkTo(HALLE_SPOT.centre[0] + 60, HALLE_SPOT.centre[1] + 34, { face: 'right' });
    await sayLine(w, HALL_AFTER[2]);
    vamir.face('left');
    await sayLine(w, HALL_AFTER[3]);
    await w.think('Wasser. Er will mich wach. Für was auch immer er jetzt vorhat.');
  });
  release();
  G.state.set(F.refused);
  await ui().fade('out', 1200);
  await nextScene('e3-hoffnung-und-weigerung', { part: 'kontakt' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 3: the contact man (framed)
// ---------------------------------------------------------------------------------------------------------------

async function kontaktScript(w: WorldCtx): Promise<void> {
  w.lockPlayer();
  const release = pinPlayer(w, 'idle', 'down');
  const doctor = w.spawn({ id: 'doktor', preset: 'e3-doktor', speaker: 'e3-doktor', at: HALLE_SPOT.doorSouth, dir: 'up', solid: false, facePlayer: false, speed: 42 });
  doctor.hold(true);
  const baris = w.spawn({ id: 'baris', preset: 'baris-scarred', speaker: 'e2-baris', at: [HALLE_SPOT.doorSouth[0] + 20, HALLE_SPOT.doorSouth[1] + 6], dir: 'up', solid: false, facePlayer: false, speed: 42 });
  baris.hold(true);
  await w.camera.zoom(1.3, 0);
  await w.camera.pan([HALLE_SPOT.daisFoot[0], HALLE_SPOT.daisFoot[1] + 40], 0);
  await ui().fade('in', 900);
  await w.cutscene(async () => {
    await Promise.all([
      doctor.walkTo(HALLE_SPOT.daisFoot[0] - 12, HALLE_SPOT.daisFoot[1] + 26, { face: 'up' }),
      baris.walkTo(HALLE_SPOT.daisFoot[0] + 46, HALLE_SPOT.daisFoot[1] + 34, { face: 'up' }),
    ]);
    for (const l of CONTACT.arrive) await sayLine(w, l);
    bg(doctor.play('read', { ms: 3000 }));
    await ui().plate('e3-relikte', { caption: 'Zehn Relikte', pan: 'in', durationMs: 11000 });
    for (const l of CONTACT.book) await sayLine(w, l);
    await ui().closePlate();
    for (const l of CONTACT.plan.slice(0, 4)) await sayLine(w, l);
    bg(baris.walkTo(HALLE_SPOT.doorSouth[0] + 10, HALLE_SPOT.doorSouth[1] + 8));
    for (const l of CONTACT.plan.slice(4)) await sayLine(w, l);
    doctor.face('down');
    await w.wait(900);
  });
  release();
  G.state.set(F.plan);
  await ui().fade('out', 1100);
  await nextScene('e3-ritual');
}

export const scene = e3Scene('e3-hoffnung-und-weigerung', 'Hoffnung', async params => {
  await ui().fade('out', 0);
  if (params?.part === 'kontakt' && G.state.is(F.refused)) {
    await interlude('Kurz darauf, in derselben Halle …');
    await startWorld({ map: halleWeigerung, spawn: 'thron', player: 'vamir', companions: [], fadeIn: false, script: kontaktScript });
    return;
  }
  if (params?.part === 'halle' && G.state.is(F.inner)) {
    await startWorld({ map: halleWeigerung, spawn: 'chained', player: liaLook({ bound: true }), companions: [], fadeIn: false, script: halleScript });
    return;
  }
  await startWorld({ map: innenRiss, spawn: 'eiche', player: 'e3-lia-innen', companions: [], fadeIn: false, script: innenScript });
});

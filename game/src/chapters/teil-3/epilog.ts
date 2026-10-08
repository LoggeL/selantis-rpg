// Scene „e3-epilog“ – Zu dritt (docs/teil-3/umsetzung.md §3, F3 45:44–46:59). The last scene of Teil III, built like
// the very first scene of Teil I (wiese.ts, user request 2026-10-09) on the same painted meadow behind the farm, now in
// autumn. Lia reads under the old oak (plate e3-epilog-wiese), Kyra comes out of the wood with firewood and sneaks up –
// this time Lia hears her (her senses are sharper) and gets tickled anyway –, the same three kinds of answer as in the
// summer, the parents would be proud (choice). Then Flick comes along the path in her new outfit as Lia's guard
// (flick-beschuetzerin), very proud of it (choice how Lia reacts), and her job. Kyra tells Lia about Elnon (choice,
// journal e3-elnon-wahrheit). Free time on the meadow like in the summer: pick up the dropped book (required), the
// empty nest in the birch (Spurenblick), the last cornflowers for Mother's grave, windfalls for Flick. Leaving along the
// path to the east, the three walk off; under the oak Valentus (turquoise) and Ignatius (amber) appear and watch them
// go (only the player sees it). Plate e3-epilog-geister, narrator, then e3-finished, checkpoint save, credits „Ende des
// dritten Buches“ (BOOK3_CREDITS via kapitel-5 showCredits), back to the title. Continuing a finished save offers a
// short closing choice (credits again / title), like teil-2/aufbruch.ts.
import type { CharAnim } from '../../art/api';
import { G } from '../../core/G';
import { registerClues } from '../../core/catalog';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import { showCredits } from '../kapitel-5/credits';
import { carry } from '../kapitel-1/shared';
import { wieseMap } from '../kapitel-1/wiese';
import { BOOK3 } from '../common/bookContract';
import { AMBER_GHOST, apparition } from './erscheinung';
import { BOOK3_CREDITS } from './epilog-credits';
import {
  APPLE_LINES, APPLES, BANTER_ANSWERS, BANTER_CHOICES, BANTER_OPEN, BOOK_PICKUP, CORNFLOWERS, ELNON, ELNON_CHOICES, ELNON_CLUE,
  ELNON_END, elnonAnswer, ENDING, EP, FINISHED_LINE, FLICK_ANSWERS, FLICK_CHOICES, FLICK_IN, FLOWER_LINE, LEAVE_EARLY, LEAVE_ZONE,
  NEST_LINES, OPENING, OPENING_NARRATION, resetEpilog, SCHUTZ, SNEAK, SOMMER, SOMMER_ANSWERS, SOMMER_CHOICES, SOMMER_END,
  WIESE_SPOT as SPOT, type Line,
} from './epilog-weg';
import { bg, e3Scene, lia, liaLook, sfx, ui, until } from './shared';

registerClues([
  {
    id: ELNON_CLUE, title: 'Was mit Elnon geschah',
    text: 'Kyra hat es mir unter der Eiche gesagt: Elnon ist tot. Vamir hat ihre Hand geführt. Was sie mir im Wald erzählt hat, war seine Lüge, nicht ihre.',
  },
]);

const F = { finished: BOOK3.finished } as const;
const KYRA = 'kyra', FLICK = 'flick', VAL = 'valentus', IGN = 'ignatius-geist';

/** Flick's new look as Lia's guard (falls back to her usual look while the painted one is missing). */
const flickLook = (): string => (G.art.hasAsset('character', 'flick-beschuetzerin') ? 'flick-beschuetzerin' : 'flick');
/** The closing plate with both apparitions (falls back to the older plate). */
const endPlate = (): string => (G.art.hasAsset('plate', 'e3-epilog-geister') ? 'e3-epilog-geister' : 'e3-epilog');

const speakerOf: Record<Line['who'], string> = { lia: 'e3-lia', 'lia-think': '', kyra: 'e3-kyra', flick: 'e2-flick', narrator: 'narrator' };

async function play(w: WorldCtx, lines: readonly Line[]): Promise<void> {
  for (const l of lines) {
    if (l.who === 'lia-think') await w.think(l.text);
    else if (l.who === 'lia') await lia(w, l.text, l.mood);
    else await w.say(speakerOf[l.who], l.text, l.mood ? { mood: l.mood } : undefined);
  }
}

/** The first scene's meadow in autumn: its ground and trees, but the epilogue's own things to do. */
export const wieseEpilog: MapDef = defineMap({
  ...wieseMap,
  id: 'e3-wiese-epilog',
  name: 'Die Wiese hinter dem Hof',
  props: [
    { id: 'nest', prop: 'bird-nest', at: [449, 100], collide: false },
    { id: 'preload-a', prop: 'alana-book', at: [-50, -50], collide: false, alpha: 0 },
    { id: 'preload-b', prop: 'twigs', at: [-50, -50], collide: false, alpha: 0 },
  ],
  npcs: [],
  interactables: [
    {
      id: 'buch', verb: 'Aufheben', at: SPOT.book, radius: 22, sparkle: true, once: false,
      when: () => G.state.is(EP.opening) && !G.state.is(EP.book), onInteract: pickUpBook,
    },
    {
      id: 'kornblumen', verb: 'Pflücken', sparkle: true, poly: CORNFLOWERS, once: false,
      when: () => G.state.is(EP.opening) && !G.state.is(EP.flowers),
      onInteract: async w => { G.state.set(EP.flowers); G.state.give('flowers'); await w.think(FLOWER_LINE); },
    },
    {
      id: 'aepfel', verb: 'Aufsammeln', sparkle: true, poly: APPLES, once: false,
      when: () => G.state.is(EP.opening) && !G.state.is(EP.apples),
      onInteract: async w => { G.state.set(EP.apples); await play(w, APPLE_LINES); },
    },
  ],
  clues: [
    { id: 'feder-1', at: [414, 158], kind: 'mark', angle: 200, thought: 'Eine alte Daunenfeder, grau vom Regen.' },
    { id: 'nest-leer', at: [430, 150], kind: 'mark', verb: 'Hinaufsehen', onInteract: emptyNest },
  ],
  triggers: [
    { id: 'aufbruch', once: false, poly: LEAVE_ZONE, when: () => G.state.is(EP.opening) && !G.state.is(EP.end), onEnter: leave },
  ],
  spawns: { eiche: { at: SPOT.oakSeat, dir: 'right' } },
  weather: 'leaves',
  ambience: ['wind', 'birds'],
  ambienceVolume: { wind: 0.5, birds: 0.35 },
  music: 'refuge',
  lookMode: true,
  onEnter: undefined,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// The opening: like the very first scene, with Flick at the end
// ---------------------------------------------------------------------------------------------------------------

async function kyraArrives(w: WorldCtx): Promise<ActorHandle> {
  const kyra = w.spawn({ id: KYRA, preset: 'kyra', speaker: 'e3-kyra', at: SPOT.kyraIn, dir: 'down', solid: false, facePlayer: false });
  kyra.hold(true);
  await w.camera.pan([300, 200], 900);
  const dropWood = await carry(w, KYRA, 'twigs', -18);
  await kyra.walkTo(SPOT.kyraWood[0], SPOT.kyraWood[1]);
  kyra.bark('Na warte, du Leseratte …', 2200);
  await w.wait(1000);
  dropWood();
  w.addProp({ id: 'reisig', prop: 'twigs', at: SPOT.woodProp, collide: false });
  sfx('thud', { volume: 0.5 });
  await w.wait(300);
  // She sneaks round the oak as in the summer – but this time Lia hears her.
  bg(kyra.walkPath(SPOT.kyraSneak, { speed: 34 }));
  await w.camera.pan(SPOT.oakSeat, 900);
  await play(w, SNEAK);
  await until(w, () => Math.hypot(kyra.x - SPOT.kyraSneak[1][0], kyra.y - SPOT.kyraSneak[1][1]) < 6, 100);
  kyra.face('right');
  sfx('rustle');
  await w.player.hop();
  w.player.setIdle('idle');
  bg(w.player.emote('!', 900));
  w.player.bark('Hihi – Kyra! Nicht! Ich hab doch gesagt, ich hör dich!', 2000);
  await w.player.walkTo(SPOT.liaUp[0], SPOT.liaUp[1], { speed: 60 });
  w.player.face('left');
  await kyra.walkTo(SPOT.kyraAtLia[0], SPOT.kyraAtLia[1], { speed: 50 });
  kyra.face('player');
  w.addProp({ id: 'buch-prop', prop: 'alana-book', at: SPOT.book, collide: false });
  await w.wait(500);
  return kyra;
}

async function flickArrives(w: WorldCtx, kyra: ActorHandle): Promise<ActorHandle> {
  const flick = w.spawn({ id: FLICK, preset: flickLook(), speaker: 'e2-flick', at: SPOT.flickIn, dir: 'left', solid: false, facePlayer: false, speed: 46 });
  flick.hold(true);
  await w.camera.pan([900, 560], 1000);
  const walk = flick.walkTo(SPOT.flickStop[0], SPOT.flickStop[1], { face: 'left' });
  kyra.face(FLICK);
  w.player.face('right');
  await play(w, FLICK_IN.slice(0, 1));
  await walk;
  await w.camera.pan([540, 476], 700);
  bg(flick.emote('note', 1400));
  await play(w, FLICK_IN.slice(1));
  const pick = await w.choose([...FLICK_CHOICES]);
  G.state.set('e3-ep-flick-antwort', pick);
  await play(w, FLICK_ANSWERS[pick]);
  await play(w, SCHUTZ);
  return flick;
}

async function opening(w: WorldCtx): Promise<void> {
  w.player.setIdle('sit-read' as CharAnim);
  w.player.face('right');
  const plate = G.art.hasAsset('plate', 'e3-epilog-wiese');
  await w.cutscene(async () => {
    if (plate) await G.ui.plate('e3-epilog-wiese', { caption: 'Zu dritt', pan: 'in', durationMs: 20000 });
    await ui().fade('in', 1100);
    await w.narrate([...OPENING_NARRATION]);
    await play(w, OPENING);
    if (plate) await G.ui.closePlate();
    const kyra = await kyraArrives(w);
    await play(w, BANTER_OPEN);
    const a = await w.choose([...BANTER_CHOICES]);
    G.state.set('e3-ep-ton', a);
    await play(w, BANTER_ANSWERS[a]);
    await play(w, SOMMER);
    const b = await w.choose([...SOMMER_CHOICES]);
    G.state.set('e3-ep-eltern', b);
    await play(w, SOMMER_ANSWERS[b]);
    await play(w, SOMMER_END);
    const flick = await flickArrives(w, kyra);
    // Kyra sits down in the grass; the joke is over.
    kyra.setIdle('sit' as CharAnim);
    w.player.face(KYRA);
    await play(w, ELNON);
    const c = await w.choose([...ELNON_CHOICES], { prompt: 'Was tut Lia?', speaker: 'e3-lia' });
    G.state.set('e3-ep-elnon-antwort', c);
    if (c === 1) {
      await w.player.walkTo(kyra.x + 14, kyra.y + 2);
      bg(w.player.emote('heart'));
    }
    await play(w, elnonAnswer(c, G.state.flag<number>('e3-ra-kyra-antwort')));
    flick.face('player');
    await play(w, ELNON_END);
    kyra.setIdle('idle');
    // From now on the two follow her over the meadow.
    for (const [id, preset, speaker] of [[KYRA, 'kyra', 'e3-kyra'], [FLICK, flickLook(), 'e2-flick']] as const) {
      w.despawn(id);
      w.companions.add(id, preset, speaker);
    }
    w.camera.follow();
  });
  G.state.set('e3-elnon-erfahren');
  G.state.addClue(ELNON_CLUE);
  G.state.set(EP.opening);
  w.setObjective('e3-ep-buch', 'Heb dein Buch auf.', 'buch');
}

// ---------------------------------------------------------------------------------------------------------------
// Free time on the meadow
// ---------------------------------------------------------------------------------------------------------------

async function pickUpBook(w: WorldCtx): Promise<void> {
  if (G.state.is(EP.book)) return;
  await w.player.play('kneel', { ms: 600 });
  w.prop('buch-prop').remove();
  G.state.set(EP.book);
  w.completeObjective('e3-ep-buch');
  await w.think(BOOK_PICKUP);
  w.setObjective('e3-ep-aufbruch', 'Sammelt Holz und Äpfel fürs Feuer, sieh dich noch einmal um. Dann geht den Weg nach Osten.', 'aufbruch');
}

async function emptyNest(w: WorldCtx): Promise<void> {
  if (G.state.is(EP.nest)) return;
  G.state.set(EP.nest);
  w.player.face('up');
  await play(w, NEST_LINES);
}

async function leave(w: WorldCtx): Promise<void> {
  if (!G.state.is(EP.book)) { w.bark('player', LEAVE_EARLY, 2400); return; }
  if (G.state.is(EP.end)) return;
  G.state.set(EP.end);
  w.completeObjective('e3-ep-aufbruch');
  ui().prefetchPlate(endPlate());
  await w.cutscene(async () => {
    // The three walk off along the path; the camera goes back to the oak.
    const [ax, ay] = SPOT.away;
    for (const id of [KYRA, FLICK]) w.companions.remove(id);
    const kyra = w.spawn({ id: `${KYRA}-weg`, preset: 'kyra', at: [w.player.x - 20, w.player.y - 8], dir: 'right', solid: false, facePlayer: false });
    const flick = w.spawn({ id: `${FLICK}-weg`, preset: flickLook(), at: [w.player.x - 34, w.player.y + 6], dir: 'right', solid: false, facePlayer: false });
    bg(w.player.walkTo(ax, ay, { straight: true, speed: 30 }));
    bg(kyra.walkTo(ax - 18, ay - 6, { straight: true, speed: 30 }));
    bg(flick.walkTo(ax - 30, ay + 6, { straight: true, speed: 30 }));
    await w.camera.pan(SPOT.endCamera, 1600);
    // Under the oak: Valentus and Ignatius. Only the player sees them; nobody turns round.
    const val = w.spawn({ id: VAL, preset: 'valentus', speaker: 'e3-valentus', at: SPOT.valentus, dir: 'right', solid: false, facePlayer: false });
    const ign = w.spawn({ id: IGN, preset: 'e2-ignatius', speaker: 'e2-ignatius', at: SPOT.ignatius, dir: 'right', solid: false, facePlayer: false });
    val.hold(true);
    ign.hold(true);
    const vGhost = apparition(w, VAL, 0);
    const iGhost = apparition(w, IGN, 0, AMBER_GHOST);
    await vGhost.fadeTo(0.6, 2200);
    await iGhost.fadeTo(0.6, 1800);
    await w.wait(900);
    ign.face(VAL);
    await w.wait(700);
    val.face(IGN);
    await w.wait(1400);
    ign.face('right');
    val.face('right');
    await w.wait(1600);
    await Promise.all([vGhost.dissolve(1600), iGhost.dissolve(1600)]);
    await ui().fade('out', 1200);
  });
  await G.ui.plate(endPlate(), { caption: 'Zu dritt', pan: 'in', durationMs: 40000 });
  await ui().fade('in', 900);
  for (const l of ENDING) await G.ui.say('narrator', l.text);
  await ui().fade('out', 1400);
  await G.ui.closePlate();
  await finishBook();
}

/** End of Teil III: the finished flag, a checkpoint at this scene, the credits, back to the title. */
async function finishBook(): Promise<void> {
  G.state.set(F.finished);
  G.state.setParty(['kyra', 'flick']);
  G.state.save(BOOK3.chapter, BOOK3.last, { book3Finished: true });
  await showCredits(BOOK3_CREDITS);
  const { showTitle } = await import('../../scenes/BootScene');
  await showTitle();
}

async function epilogScript(w: WorldCtx): Promise<void> {
  resetEpilog();
  w.lockPlayer();
  await opening(w);
  w.unlockPlayer();
  await until(w, () => G.state.is(EP.end));
}

// ---------------------------------------------------------------------------------------------------------------
// After the end: Continue offers a short closing choice instead of replaying everything
// ---------------------------------------------------------------------------------------------------------------

async function closingChoice(): Promise<void> {
  G.stopGameplayScenes();
  await ui().fade('out', 0);
  await G.ui.plate(endPlate(), { caption: 'Zu dritt', pan: 'none' });
  await ui().fade('in', 900);
  await G.ui.say('narrator', FINISHED_LINE);
  for (;;) {
    const pick = await G.ui.choose(['Den Abspann noch einmal ansehen.', 'Zurück zum Titel.']);
    if (pick === 0) {
      await G.ui.closePlate();
      await showCredits(BOOK3_CREDITS);
      await G.ui.plate(endPlate(), { caption: 'Zu dritt', pan: 'none' });
      continue;
    }
    await ui().fade('out', 700);
    await G.ui.closePlate();
    const { showTitle } = await import('../../scenes/BootScene');
    await showTitle();
    return;
  }
}

export const scene = e3Scene('e3-epilog', 'Zu dritt', async () => {
  if (G.state.is(F.finished)) { await closingChoice(); return; }
  await G.ui.fade('out', 0);
  await G.ui.narrate(['Ein paar Wochen nach der Zeremonie. Der Weg nach Süden führte an einem Hof vorbei, den es nicht mehr gab.'], { style: 'card' });
  await startWorld({ map: wieseEpilog, spawn: 'eiche', player: liaLook(), companions: [], fadeIn: false, script: epilogScript });
});

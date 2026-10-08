// Scene „e3-kyras-fluchtweg“ – Durch den Schacht (docs/teil-3/umsetzung.md §3, F3 20:07–23:24). Two checkpointed parts
// (G.goto with { part }, a reload restarts the current part):
//  1. default, e3-gastzimmer-flucht: Lia lies awake after the night at the study door. Kyra suddenly sits on the
//     stool in the moonlight. The reunion; Kyra throws her dark clothes and puts every question off. While Lia turns
//     to the window to change, Kyra pockets a narrow glass vial from the doctor's things on the table – only the
//     player sees it (camera, plate e3-phiole, Lia's back). Lia wants to fetch her staff from the armoury; Kyra says no,
//     every answer gives in (e3-stab-zurueckgelassen, the staff stays where it is). Lia leaves Ignatius behind.
//  2. 'keller' (only with e3-kf-raus): the shared escape. Cellar (e3-keller-gewoelbe): Kyra leads from shadow to
//     shadow, a paladin with a lantern walks the east side (view cone, crates/barrels/well rim as hiding places,
//     spotted = back to the last shadow). The well: storyAction('reach', 'Die Steigeisen hinunter'). Channel
//     (e3-keller-kanal): knee-deep water (shallow, slow), Lia freezes (barks), Kyra wades ahead with a lantern. At the
//     mouth the grate is already loose – Kyra came in this way. On the bank, resting in the leaves: Kyra's report in
//     any order (escape, Flick, Elnon – the Elnon answer is the smooth lie the player recognises), the rebels' camp
//     nearby, Lia without her staff. Kyra asks nothing back. Clue e3-kyras-bericht, e3-geflohen. → e3-waldgegner.
import type Phaser from 'phaser';
import { G } from '../../core/G';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import { pointInPoly } from '../../world/poly';
import {
  COLD_BARKS, LAST_THOUGHT, type Line, openQuestions, REPORT_END, type ReportKey, STAFF_ANSWERS, staffTalkNeeded,
} from './kyras-fluchtweg-bericht';
import {
  CELLAR_BLOCKS, CELLAR_GUARD, CELLAR_LIGHTS, CELLAR_OCCLUDERS, CELLAR_SHADOWS, CELLAR_SPAWNS, CELLAR_SPOT, CELLAR_WALK,
  GRATE_HOTSPOT, KANAL_BLOCKS, KANAL_LIGHTS, KANAL_ROUTE, KANAL_SPAWNS, KANAL_SPOT, KANAL_SURFACES, KANAL_WALK, KYRA_STEPS,
  REST_HOTSPOT, SHADOW_CHECKPOINT, WELL_HOTSPOT,
} from './kyras-fluchtweg-keller';
import { GZ_DOOR_AT, GZ_SPOT, gastzimmerBase } from './ordenshaus';
import { type GesturePicture, restageGesture } from '../teil-2/gewoelbe-geste';
import { bg, e3Scene, hasOwnStaff, lia, liaLook, nextScene, sfx, staffPlace, ui, until } from './shared';
import { KANAL_CLUES, NO_LOOK } from './spuersinn';

/** Flags of this visit (reset when a part starts), the checkpoint of part 2 and the kept results. */
const F = {
  clothes: 'e3-kf-kleider',
  changed: 'e3-kf-umgezogen',
  out: 'e3-kf-raus',
  /** Spawn name of the current cellar checkpoint. */
  cp: 'e3-kf-checkpoint',
  well: 'e3-kf-brunnen',
  down: 'e3-kf-unten',
  grate: 'e3-kf-gitter',
  rest: 'e3-kf-rast',
} as const;
export const KF_RESULT = { staffTone: 'e3-kf-stab-ton', firstQuestion: 'e3-kf-erste-frage' } as const;

const KYRA = 'kyra';
const GUARD = CELLAR_GUARD.id;
/** The stool at the table: Kyra sits there in the moonlight when Lia notices her. */
const STOOL: readonly [number, number] = [383, 126];

const say = (w: WorldCtx, l: Line): Promise<void> => {
  if (l.who === 'lia') return lia(w, l.text, l.mood);
  if (l.who === 'kyra-cold') return w.say('e3-kyra', l.text, { portrait: 'e2-kyra-gebannt', mood: l.mood ?? 'cold' });
  return w.say('e3-kyra', l.text, l.mood ? { mood: l.mood } : undefined);
};
const kyraSays = (w: WorldCtx, text: string, mood?: string) => say(w, { who: 'kyra', text, mood });

// ---------------------------------------------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------------------------------------------

export const zimmerFlucht: MapDef = defineMap({
  ...gastzimmerBase(true),
  id: 'e3-gastzimmer-flucht',
  name: 'Lias Zimmer im Ordenshaus',
  interactables: [
    {
      id: 'kleider', verb: 'Umziehen', poly: [[60, 130], [150, 130], [150, 196], [60, 196]], radius: 36, once: false, sparkle: true,
      standAt: GZ_SPOT.bedSide, face: 'left', when: () => G.state.is(F.clothes) && !G.state.is(F.changed), onInteract: changeClothes,
    },
    {
      id: 'tuer', verb: 'Hinaus', poly: [[560, 110], [608, 110], [608, 250], [560, 250]], radius: 30, once: false, standAt: GZ_DOOR_AT, face: 'right',
      when: () => G.state.is(F.changed), onInteract: async () => { G.state.set(F.out); },
    },
    {
      id: 'fenster', verb: 'Hinaussehen', poly: [[272, 4], [338, 4], [338, 72], [272, 72]], radius: 46, once: false, standAt: GZ_SPOT.window, face: 'up',
      thought: 'Die Dächer von Trapas, silbern im Mond. Von hier oben sieht die Stadt so friedlich aus. Von hier oben.',
    },
  ],
  music: 'dread',
  resetOnEnter: true,
  lookBlocked: NO_LOOK.keller,
});

export const gewoelbe: MapDef = defineMap({
  id: 'e3-keller-gewoelbe',
  name: 'Keller des Ordenshauses',
  background: 'e3-keller',
  baked: 'night',
  walk: CELLAR_WALK,
  block: CELLAR_BLOCKS,
  occluders: CELLAR_OCCLUDERS,
  surface: 'stone',
  guards: [CELLAR_GUARD],
  hidingSpots: CELLAR_SHADOWS,
  lights: CELLAR_LIGHTS,
  interactables: [
    { id: 'brunnen', verb: 'Hinunterklettern', poly: WELL_HOTSPOT, radius: 26, once: false, standAt: CELLAR_SPOT.wellRim, face: 'down', when: () => G.state.is(F.well), onInteract: climbDown },
  ],
  triggers: CELLAR_SHADOWS.map(s => ({
    id: `cp-${s.id}`, poly: s.poly, once: false, onEnter: () => { G.state.set(F.cp, SHADOW_CHECKPOINT[s.id]); },
  })),
  spawns: CELLAR_SPAWNS,
  camera: { bounds: { x: 0, y: 0, w: 700, h: 720 } },
  time: 'night',
  ambience: ['room', 'night'],
  ambienceVolume: { room: 0.5, night: 0.2 },
  music: 'dread',
  playerLight: 22,
  lookMode: false,
  critters: false,
  sneak: true,
  resetOnEnter: true,
  lookBlocked: NO_LOOK.keller,
});

export const kanal: MapDef = defineMap({
  id: 'e3-keller-kanal',
  name: 'Der Wassergang',
  background: 'e3-keller',
  baked: 'night',
  walk: KANAL_WALK,
  block: KANAL_BLOCKS,
  surfaces: KANAL_SURFACES,
  surface: 'stone',
  lights: KANAL_LIGHTS,
  interactables: [
    { id: 'gitter', verb: 'Untersuchen', poly: GRATE_HOTSPOT, radius: 28, once: false, standAt: KANAL_SPOT.grate, face: 'right', when: () => !G.state.is(F.grate), onInteract: looseGrate },
    { id: 'laub', verb: 'Hinsetzen', poly: REST_HOTSPOT, radius: 24, once: false, sparkle: true, standAt: KANAL_SPOT.rest, face: 'right', when: () => G.state.is(F.grate) && !G.state.is(F.rest), onInteract: async () => { G.state.set(F.rest); } },
  ],
  spawns: KANAL_SPAWNS,
  camera: { bounds: { x: 380, y: 0, w: 900, h: 720 } },
  time: 'night',
  ambience: ['stream', 'night'],
  ambienceVolume: { stream: 0.7, night: 0.35 },
  music: 'flight',
  playerLight: 20,
  critters: false,
  sneak: false,
  resetOnEnter: true,
  lookMode: true,
  clues: KANAL_CLUES,
});

// ---------------------------------------------------------------------------------------------------------------
// Part 1: Kyra in the room
// ---------------------------------------------------------------------------------------------------------------

async function kyraAppears(w: WorldCtx): Promise<ActorHandle> {
  w.player.teleport(GZ_SPOT.bedSit, 'right');
  w.player.setIdle('sit');
  const k = w.spawn({ id: KYRA, preset: 'kyra', speaker: 'e3-kyra', at: STOOL, dir: 'left', idle: 'sit', solid: false, facePlayer: false, talk: talkKyra, verb: 'Fragen' });
  k.hold(true);
  k.hide();
  await ui().fade('in', 1400);
  await w.cutscene(async () => {
    await w.think('Schlafen? Keine Chance. Sobald ich die Augen zumache, höre ich es wieder: Danach gehört das Mädchen Euch.');
    await w.think('Er hätte mich weggegeben. Wie einen Sack Mehl gegen einen Sack Salz.');
    sfx('thud', { volume: 0.18, pitch: 1.6 });
    await w.wait(700);
    k.show();
    w.player.face('right');
    await w.wait(500);
    await w.think('Da sitzt jemand. Auf dem Hocker, im Mondlicht. Ganz still.');
    await kyraSays(w, 'Psst. Nicht schreien. Ich bin’s.');
    await lia(w, 'Kyra?!', 'surprised');
    w.player.setIdle('idle');
    w.player.teleport(GZ_SPOT.bedSide, 'right');
    k.setIdle('idle');
    k.teleport(GZ_SPOT.tableFront, 'left');
    await w.player.walkTo(GZ_SPOT.tableFront[0] - 26, GZ_SPOT.tableFront[1] + 6, { run: true, face: 'right' });
    k.face('player');
    bg(w.player.emote('heart', 1600));
    await lia(w, 'Du bist es wirklich. Mit Händen und Füßen und allem. Ich hab jede Nacht gedacht … ich hab gedacht …', 'happy');
    await kyraSays(w, 'Ich weiß. Nicht so fest, du zerdrückst mich.');
    await lia(w, 'Wie bist du hier reingekommen? Das ist ein Haus voller Paladine, mit Gittern und Laternen!', 'surprised');
    await kyraSays(w, 'Erzähl ich dir draußen.');
    sfx('rustle', { volume: 0.6 });
    w.fx.burst([104, 168], 'dust', 6);
    await kyraSays(w, 'Hier, Stiefel und Umhang. Zieh die Kapuze tief, dein rotes Haar sieht man im Mondlicht drei Gassen weit. Schnell.');
  });
  G.state.set(F.clothes);
  return k;
}

let talkTurn = 0;
async function talkKyra(w: WorldCtx): Promise<void> {
  const lines: [string, string][] = [
    ['Woher wusstest du, welches Zimmer meins ist?', 'Ich hatte Zeit, mich umzusehen. Zieh dich an.'],
    ['Wo warst du die ganze Zeit? Was haben sie mit dir gemacht?', 'Draußen. Alles draußen. Hier haben die Wände Ohren.'],
    ['Du bist so ernst. Früher hättest du jetzt einen Witz über mein Haar gemacht.', 'Dein Haar ist auch ohne Witz schlimm genug. Zieh dich an.'],
  ];
  const [q, a] = lines[talkTurn++ % lines.length];
  await lia(w, q);
  await kyraSays(w, a);
}

/** Lia turns to the window to change; behind her back Kyra pockets the doctor's vial (player view only). */
async function changeClothes(w: WorldCtx): Promise<void> {
  if (G.state.is(F.changed)) return;
  const k = w.actor(KYRA);
  ui().prefetchPlate('e3-phiole');
  await w.cutscene(async () => {
    await lia(w, 'Dreh dich um.');
    await kyraSays(w, 'Wir sind Zwillinge, Lia.');
    await lia(w, 'Trotzdem.');
    await w.player.walkTo(GZ_SPOT.window[0] - 30, GZ_SPOT.window[1] + 8, { face: 'up' });
    sfx('rustle', { volume: 0.5 });
    // The camera turns away from Lia: Kyra at the table, where the doctor left his things.
    await w.camera.pan([GZ_SPOT.tableFront[0], GZ_SPOT.tableFront[1] - 30], 900);
    await k.walkTo(GZ_SPOT.tableFront[0], GZ_SPOT.tableFront[1] - 2, { face: 'up' });
    await w.wait(600);
    bg(k.play('interact', { ms: 900 }));
    w.fx.burst([GZ_SPOT.crystal[0] + 6, GZ_SPOT.crystal[1] + 6], 'sparkle', 3);
    await w.wait(700);
    await G.ui.plate('e3-phiole', { caption: 'Hinter Lias Rücken', pan: 'in', durationMs: 7000 });
    await w.wait(2600);
    await G.ui.closePlate();
    k.face('left');
    await k.walkTo(GZ_SPOT.doorGuard[0] - 10, GZ_SPOT.doorGuard[1] - 30, { face: 'left' });
    await w.camera.pan([w.player.x, w.player.y], 600);
    w.camera.follow();
    w.player.face('right');
    await lia(w, 'So. Kapuze auf. Jetzt bin ich nur noch ein Umhang mit Sommersprossen.');
    await kyraSays(w, 'Gut genug. Gehen wir.');
  });
  G.state.set(F.changed);
}

async function staffTalk(w: WorldCtx): Promise<void> {
  if (!staffTalkNeeded(staffPlace(), hasOwnStaff())) return;
  await w.cutscene(async () => {
    w.player.face(KYRA);
    await lia(w, 'Warte. Mein Stab. Er hängt oben in der Waffenkammer hinter einem Gitter. Ohne ihn gehe ich nicht.', 'determined');
    await kyraSays(w, 'Doch. Oben laufen zwei Wachen mit Laternen herum, und dein Gitter hat ein Schloss. Willst du anklopfen?');
    await lia(w, 'Ich könnte … ich weiß nicht. Irgendwas.', 'thinking');
    await kyraSays(w, 'Bis dir dein Irgendwas einfällt, ist es Morgen. Dann sitzen wir beide hier fest.');
    const pick = await w.choose(STAFF_ANSWERS.map(a => a.pick));
    const a = STAFF_ANSWERS[pick];
    G.state.set(KF_RESULT.staffTone, a.tone);
    G.state.set('e3-stab-zurueckgelassen');
    await say(w, a.lia);
    await say(w, a.kyra);
  });
}

async function zimmerScript(w: WorldCtx): Promise<void> {
  for (const f of [F.clothes, F.changed, F.out]) G.state.set(f, false);
  talkTurn = 0;
  w.lockPlayer();
  await kyraAppears(w);
  w.unlockPlayer();
  w.setObjective('e3-kf-umziehen', 'Zieh die dunklen Sachen an, die Kyra dir aufs Bett geworfen hat.', 'kleider');
  await until(w, () => G.state.is(F.changed) && !G.ui.busy());
  w.completeObjective('e3-kf-umziehen');
  await staffTalk(w);
  await w.cutscene(async () => {
    await w.think('Und Ignatius, gleich nebenan? Ihn wecken, ihm sagen, dass ich gehe?');
    await w.think('Nein. Wer mich gegen jemand anderen eintauschen will, muss nicht wissen, wohin ich gehe.');
  });
  w.setObjective('e3-kf-tuer', 'Geh mit Kyra hinaus. Leise.', 'tuer');
  await until(w, () => G.state.is(F.out) && !G.ui.busy());
  w.completeObjective('e3-kf-tuer');
  w.lockPlayer();
  sfx('door', { volume: 0.25, pitch: 1.2 });
  await ui().fade('out', 900);
  await nextScene('e3-kyras-fluchtweg', { part: 'keller' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2a: the cellar – Kyra leads from shadow to shadow
// ---------------------------------------------------------------------------------------------------------------

const near = (a: { x: number; y: number }, at: readonly [number, number], r: number) => Math.hypot(a.x - at[0], a.y - at[1]) <= r;

function onCaught(w: WorldCtx): void {
  const lines = ['Nicht ins Licht!', 'Runter! Bleib im Dunkeln.', 'Warte, bis er wegsieht.'];
  let n = 0;
  w.stealth.onSpotted(async g => {
    w.lockPlayer();
    w.bark(g.id, ['Halt! Wer da?', 'Stehen bleiben!'][n % 2], 1300);
    await w.wait(700);
    await ui().fade('out', 450);
    w.stealth.resetGuards();
    const sp = CELLAR_SPAWNS[G.state.flag<string>(F.cp) ?? 'treppe'] ?? CELLAR_SPAWNS.treppe;
    w.player.teleport(sp.at, sp.dir);
    await w.camera.pan(sp.at, 0);
    w.camera.follow();
    await w.wait(200);
    await ui().fade('in', 450);
    w.unlockPlayer();
    w.bark(KYRA, lines[n++ % lines.length], 1800);
  });
}

async function cellar(w: WorldCtx): Promise<void> {
  const k = w.spawn({ id: KYRA, preset: 'kyra', speaker: 'e3-kyra', at: KYRA_STEPS[0], dir: 'up', solid: false, facePlayer: false });
  k.hold(true);
  w.stealth.enable(false);
  await ui().fade('in', 900);
  await w.cutscene(async () => {
    await w.think('Die Treppe runter, an der Küche vorbei, durch eine Tür, die ich nicht mal gesehen hätte. Kyra zögert kein einziges Mal.');
    w.player.face(KYRA);
    k.face('player');
    await lia(w, 'Woher kennst du dich hier so gut aus?', 'thinking');
    await kyraSays(w, 'Ich war heute schon mal hier unten. Leise jetzt. Da vorn macht einer seine Runde.');
    await w.camera.pan(CELLAR_SPOT.guardNorth, 800);
    await w.wait(900);
    await w.camera.pan([w.player.x, w.player.y], 600);
    w.camera.follow();
    await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt, um zu schleichen. Geduckt im Schatten der Fässer und Kisten sieht dich die Wache nicht.`);
  });
  k.setIdle('crouch' as never);
  w.stealth.enable(true);
  w.unlockPlayer();
  onCaught(w);
  const hints = ['Erst zu den Kisten. Duck dich.', 'Jetzt zu den Fässern. Wenn er wegsieht.', 'Zum Brunnen. Leise.'];
  const objectives = [
    'Folge Kyra. Duck dich hinter die Kisten, bevor die Laterne herüberschwenkt.',
    'Schleich zu den Fässern an der Westwand, wenn die Wache wegsieht.',
    'Schleich zum Brunnenrand. Kyra wartet dort.',
  ];
  for (let step = 0; step < CELLAR_SHADOWS.length; step++) {
    const shadow = CELLAR_SHADOWS[step];
    w.bark(KYRA, hints[step], 2200);
    w.setObjective('e3-kf-keller', objectives[step], shadow.id === 'schatten-brunnen' ? CELLAR_SPOT.wellRim : centreOf(shadow.poly));
    await until(w, () => !G.ui.busy() && pointInPoly(w.player.x, w.player.y, shadow.poly), 150);
    if (step + 1 < KYRA_STEPS.length) {
      const next = KYRA_STEPS[step + 1];
      bg(k.walkTo(next[0], next[1], { face: 'right' }));
    }
  }
  w.completeObjective('e3-kf-keller');
  G.state.set(F.well);
  w.bark(KYRA, 'Hier runter. An den Eisen.', 2000);
  w.setObjective('e3-kf-schacht', 'Klettere an den Steigeisen in den Brunnenschacht hinunter.', 'brunnen');
  await until(w, () => G.state.is(F.down), 200);
}

function centreOf(poly: readonly (readonly [number, number])[]): [number, number] {
  return [Math.round(poly.reduce((s, p) => s + p[0], 0) / poly.length), Math.round(poly.reduce((s, p) => s + p[1], 0) / poly.length)];
}

/** Close-up for the rungs: Lia on the north rim of the well, the ladder glinting in the shaft below her. */
const SHAFT_PICTURE = (): GesturePicture => ({
  background: 'e3-keller',
  focus: [205, 250],
  zoom: 2,
  figures: [{ id: liaLook(), pose: 'crouch', at: CELLAR_SPOT.wellRim, facing: 'down' }],
  glint: [204, 318],
});

/** Kyra climbs first, then Lia feels her way down the rungs; the channel below. */
async function climbDown(w: WorldCtx): Promise<void> {
  if (!G.state.is(F.well) || w.map.id !== gewoelbe.id) return;
  w.completeObjective('e3-kf-schacht');
  w.stealth.enable(false);
  const k = w.actor(KYRA);
  await w.cutscene(async () => {
    k.face('player');
    await kyraSays(w, 'Unten ist Wasser. Kalt. Nicht schreien, egal wie kalt.');
    await k.walkTo(CELLAR_SPOT.wellRim[0] + 2, CELLAR_SPOT.wellRim[1] + 14, { straight: true });
    k.hide();
    sfx('splash', { volume: 0.35, pitch: 0.8 });
    await w.wait(600);
    await w.think('Natürlich. Natürlich muss es ein Brunnen sein.');
  });
  w.lockPlayer();
  const gesture = G.ui.storyAction('reach', 'Die Steigeisen hinunter');
  restageGesture('reach', 'Tast dich nach der nächsten Sprosse. Und nach der nächsten. Nicht nach unten sehen.', SHAFT_PICTURE());
  await gesture;
  w.stealth.enable(false);
  sfx('splash', { volume: 0.6 });
  await w.changeMap(kanal, 'schacht');
  G.state.set(F.down);
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2b: the channel – knee-deep, cold, Kyra ahead with a lantern
// ---------------------------------------------------------------------------------------------------------------

/** A small lantern light that follows Kyra while she wades ahead. */
function kyraLantern(w: WorldCtx, k: ActorHandle): void {
  const light = w.lighting.add({ id: 'e3-kyra-laterne', at: [k.x + 6, k.y - 22], kind: 'lantern', radius: 80, intensity: 1, always: true });
  const scene = w.scene as Phaser.Scene;
  const tick = () => { if (k.exists) light.set({ at: [k.x + 6, k.y - 22] }); };
  scene.events.on('postupdate', tick);
  scene.events.once('shutdown', () => scene.events.off('postupdate', tick));
}

/** Kyra wades from point to point; she only goes on when Lia is close behind. Lia's cold barks meanwhile. */
async function wadeAfterKyra(w: WorldCtx, k: ActorHandle): Promise<void> {
  let bark = 0, lastBark = Date.now();
  const coldBark = () => {
    if (G.ui.busy() || Date.now() - lastBark < 4800) return;
    lastBark = Date.now();
    w.bark('player', COLD_BARKS[bark++ % COLD_BARKS.length], 1800);
  };
  for (const p of KANAL_ROUTE) {
    while (w.alive && Math.hypot(w.player.x - k.x, w.player.y - k.y) > 90) { coldBark(); await w.wait(200); }
    let arrived = false;
    void k.walkTo(p[0], p[1], { face: 'right' }).then(() => { arrived = true; });
    while (w.alive && !arrived) { coldBark(); await w.wait(200); }
  }
}

async function looseGrate(w: WorldCtx): Promise<void> {
  if (G.state.is(F.grate)) return;
  const k = w.actor(KYRA);
  await w.cutscene(async () => {
    await k.walkTo(1018, 366, { face: 'right' });
    sfx('chain', { volume: 0.4, pitch: 0.7 });
    w.fx.burst([1020, 360], 'splash', 8);
    await w.wait(500);
    await w.say('narrator', 'Kyra drückt gegen das Gitter in der Öffnung. Es schwingt auf, als hinge es nur noch an einem Faden.');
    await lia(w, 'Die Bolzen sind blank geschabt. Ganz frisch. Wer macht denn so was?', 'thinking');
    k.face('player');
    await kyraSays(w, 'Ich. Irgendwie musste ich ja reinkommen.');
    await lia(w, 'Durchs Wasser? Du hast schon als Kind geschrien, wenn der Bach im Frühjahr kalt war.', 'surprised');
    await kyraSays(w, 'Ich schreie nicht mehr.');
    await k.walkTo(KANAL_SPOT.restKyra[0], KANAL_SPOT.restKyra[1], { face: 'left' });
    k.setIdle('sit');
  });
  G.state.set(F.grate);
}

async function report(w: WorldCtx): Promise<void> {
  const k = w.actor(KYRA);
  await w.cutscene(async () => {
    w.player.setIdle('sit');
    w.player.face(KYRA);
    await w.think('Luft. Bäume. Ich hätte nie gedacht, dass ich mich mal so über nassen Farn freue.');
    await kyraSays(w, 'Hier sucht uns vor dem Morgen keiner.');
    await lia(w, 'Jetzt erzähl schon. Ich platze gleich.', 'happy');
    const asked = new Set<ReportKey>();
    for (let open = openQuestions(asked); open.length; open = openQuestions(asked)) {
      const q = open[await w.choose(open.map(o => o.pick), { prompt: asked.size ? 'Und weiter?' : 'Was frage ich zuerst?' })];
      if (!asked.size) G.state.set(KF_RESULT.firstQuestion, q.key);
      asked.add(q.key);
      for (const l of q.lines) await say(w, l);
    }
    for (const l of REPORT_END) await say(w, l);
    k.setIdle('sit');
    await w.think(LAST_THOUGHT);
  });
  G.state.addClue('e3-kyras-bericht');
}

async function kellerScript(w: WorldCtx): Promise<void> {
  for (const f of [F.well, F.down, F.grate, F.rest]) G.state.set(f, false);
  G.state.set(F.cp, 'treppe');
  w.lockPlayer();
  await cellar(w);
  // Below: the channel.
  const k = w.spawn({ id: KYRA, preset: 'kyra', speaker: 'e3-kyra', at: [KANAL_SPOT.shaft[0] + 40, KANAL_SPOT.shaft[1] - 4], dir: 'right', solid: false, facePlayer: false });
  k.hold(true);
  kyraLantern(w, k);
  ui().prefetchPlate('e3-schacht');
  await w.cutscene(async () => {
    await G.ui.plate('e3-schacht', { caption: 'Unter dem Ordenshaus', pan: 'in', durationMs: 9000 });
    await lia(w, 'Kalt! Kyra, das ist so kalt, mir fällt nicht mal ein Vergleich ein. Und mir fällt immer ein Vergleich ein.', 'scared');
    await kyraSays(w, 'Weiter. Vom Stehen wird’s nicht wärmer.');
    await G.ui.closePlate();
  });
  w.unlockPlayer();
  w.setObjective('e3-kf-kanal', 'Wate Kyra hinterher durch den Kanal.', KYRA);
  await wadeAfterKyra(w, k);
  w.setObjective('e3-kf-kanal', 'Sieh nach, was Kyra an der Öffnung macht.', 'gitter');
  await until(w, () => G.state.is(F.grate) && !G.ui.busy());
  w.completeObjective('e3-kf-kanal');
  w.setObjective('e3-kf-rast', 'Setz dich zu Kyra ins Laub am Ufer.', 'laub');
  await until(w, () => G.state.is(F.rest) && !G.ui.busy());
  w.completeObjective('e3-kf-rast');
  await report(w);
  w.lockPlayer();
  await ui().fade('out', 1600);
  G.state.set('e3-geflohen');
  await nextScene('e3-waldgegner');
}

export const scene = e3Scene('e3-kyras-fluchtweg', 'Durch den Schacht', async params => {
  await ui().fade('out', 0);
  if (params?.part === 'keller' && G.state.is(F.out)) {
    await startWorld({ map: gewoelbe, spawn: 'treppe', player: liaLook(), companions: [], fadeIn: false, script: kellerScript });
    return;
  }
  await startWorld({ map: zimmerFlucht, spawn: 'bett', player: liaLook(), companions: [], fadeIn: false, script: zimmerScript });
});

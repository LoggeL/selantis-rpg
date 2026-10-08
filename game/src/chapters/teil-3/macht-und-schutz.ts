// Scene „e3-macht-und-schutz“ – Untersuchung und Verhandlung (docs/teil-3/umsetzung.md §3, F3 10:54–13:57). Two
// checkpointed parts (G.goto with { part }, a reload restarts the current part):
//  1. default, e3-gastzimmer-pruefung: Lia opens her eyes (storyAction 'open-eyes') on a bed under the roof, still
//     bound. The doctor of the order examines her, and she has to take part herself: both hands on his reading crystal
//     (storyAction 'reach' with a close-up of the room) – nothing at all; leaning over the water bowl and holding still
//     (crouch in the hotspot, every fidget costs progress) – the water leaps into his face; following his candle around
//     the room – the flame shoots up and leans towards her. Verdict: strong magic, the Urmacht cannot be proven, there
//     is nothing to compare. The Großmeister comes: „a few lives against thousands“; Lia answers in her own tone
//     (e3-verhandlung-ton: kalt / bittend / klug), always with the same claim (no power without her consent, and he
//     has seen what forcing her looks like). Same outcome: bonds off, the staffs stay in the armoury, she stays. A
//     paladin lets slip that Ignatius sleeps next door and that they are to be kept apart.
//  2. 'haus', a small hub by day (e3-gastzimmer-tag, e3-ordenshaus-tag): optional – the armoury grate with her staff
//     among the weapons (clue e3-stab-gesehen, only while it really hangs there), the library chronicle (lore
//     e3-lore-aros), the chapel, a novice at the water jug (who mentions the doctor's lamp and the Großmeister's late
//     hours), Ignatius' door (the guard refuses), the study door. Mandatory: back to bed, sleep. → e3-falscher-glaube.
import type Phaser from 'phaser';
import { G } from '../../core/G';
import { registerClues } from '../../core/catalog';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import { figureScale } from '../../world/presentation';
import { restageGesture, type GesturePicture } from '../teil-2/gewoelbe-geste';
import {
  FOLLOW, IGNATIUS_ASKS, stepFollow, stepStill, VERHANDLUNG_ANSWERS, VERHANDLUNG_TONES, followVerdict,
} from './macht-und-schutz-regeln';
import {
  ARMOURY_GRATE, GZ_CANDLE_LOOP, GZ_DOOR_AT, GZ_SPOT, gastzimmerBase, OH_DOOR, OH_HOTSPOT, OH_SPOT, ordenshausBase,
  lookIntoArmouryCam, showStaffInArmoury,
} from './ordenshaus';
import { bg, e3Scene, lia, liaLook, nextScene, sfx, staffPlace, TURQUOISE, ui, until } from './shared';

registerClues([
  {
    id: 'e3-stab-gesehen', title: 'Mein Stab in der Waffenkammer',
    text: 'Er hängt im Ordenshaus hinter dem Eisengitter der Waffenkammer, zwischen Speeren und Schilden. Das Schloss ist groß. Aber ich weiß jetzt, wo er ist.',
  },
]);

const DOCTOR = 'doktor';
const GM = 'grossmeister';
const GUARD = 'pal-tuer';
const NOVICE = 'novize';
const IGN_GUARD = 'pal-ignatius';
const EAST_GUARD = 'pal-ost';

/** Flags of this visit (reset when a part starts) and the checkpoint flag of part 2. */
const F = {
  stage: 'e3-ms-stufe',
  freed: 'e3-ms-frei',
  sleep: 'e3-ms-schlafen',
  chronicle: 'e3-ms-chronik',
  noviceMet: 'e3-ms-novize',
  ignGuard: 'e3-ms-wache-ignatius',
} as const;
type Stage = 'kristall' | 'schale' | 'kerze' | 'fertig';
const stage = () => G.state.flag<Stage>(F.stage);

const doctor = (w: WorldCtx, text: string, mood?: string) => w.say('e3-doktor', text, mood ? { mood } : undefined);
const gm = (w: WorldCtx, text: string, mood?: string) => w.say('e3-grossmeister', text, mood ? { mood } : undefined);
const paladin = (w: WorldCtx, text: string) => w.say('e3-paladin', text);
const novice = (w: WorldCtx, text: string) => w.say('e3-novize', text);

// ---------------------------------------------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------------------------------------------

/** Leaning over the bowl: a crouching Lia in front of the washstand counts as „leaning over“. */
const BOWL_LEAN = [
  [GZ_SPOT.washFront[0] - 18, GZ_SPOT.washFront[1] - 12],
  [GZ_SPOT.washFront[0] + 18, GZ_SPOT.washFront[1] - 12],
  [GZ_SPOT.washFront[0] + 18, GZ_SPOT.washFront[1] + 18],
  [GZ_SPOT.washFront[0] - 18, GZ_SPOT.washFront[1] + 18],
] as [number, number][];

export const pruefungMap: MapDef = defineMap({
  ...gastzimmerBase(false),
  id: 'e3-gastzimmer-pruefung',
  name: 'Ein Zimmer unter dem Dach',
  interactables: [
    {
      id: 'kristall', verb: 'Hände auflegen', poly: [[372, 72], [416, 72], [416, 106], [372, 106]], radius: 34, once: false, sparkle: true,
      standAt: GZ_SPOT.tableFront, face: 'up', when: () => stage() === 'kristall',
    },
    {
      id: 'schale', verb: 'Über die Schale beugen', poly: [[444, 72], [498, 72], [498, 106], [444, 106]], radius: 55, once: false, sparkle: true,
      standAt: GZ_SPOT.washFront, face: 'up', when: () => stage() === 'schale',
    },
  ],
  hidingSpots: [{ id: 'schale-beugen', kind: 'crate', poly: BOWL_LEAN }],
  music: null,
  sneak: true,
  resetOnEnter: true,
});

export const zimmerTag: MapDef = defineMap({
  ...gastzimmerBase(false),
  id: 'e3-gastzimmer-tag',
  name: 'Lias Zimmer im Ordenshaus',
  interactables: [
    { id: 'bett', verb: 'Schlafen', poly: [[52, 92], [156, 92], [156, 210], [52, 210]], radius: 30, once: false, standAt: GZ_SPOT.bedSide, face: 'left', onInteract: offerSleep },
    {
      id: 'fenster', verb: 'Hinaussehen', poly: [[272, 4], [338, 4], [338, 72], [272, 72]], radius: 46, once: false, standAt: GZ_SPOT.window, face: 'up',
      thought: 'Dächer, Banner, ein Streifen Himmel. Irgendwo dahinter sind Kyra, Flick und Elnon. Und ich habe ein Kissen.',
    },
    {
      id: 'waschtisch', verb: 'Ansehen', poly: [[444, 72], [498, 72], [498, 140], [444, 140]], radius: 30, once: false, standAt: GZ_SPOT.washFront, face: 'up',
      thought: 'Auf den Dielen glänzt noch die Pfütze vom Doktor. Ich habe wirklich nur geatmet.',
    },
  ],
  exits: [{ id: 'flur', to: 'e3-ordenshaus-tag', spawn: 'lia-tuer', door: { at: GZ_DOOR_AT, verb: 'Hinausgehen' } }],
  music: 'refuge',
  sneak: false,
  resetOnEnter: true,
});

export const hausTag: MapDef = defineMap({
  ...ordenshausBase(false),
  id: 'e3-ordenshaus-tag',
  name: 'Das Ordenshaus',
  npcs: [
    { id: NOVICE, preset: 'paladin', speaker: 'e3-novize', at: OH_SPOT.novice, dir: 'down', verb: 'Ansprechen', talk: talkNovice },
    { id: IGN_GUARD, preset: 'paladin', speaker: 'e3-paladin', at: OH_SPOT.ignatiusGuard, dir: 'left', verb: 'Ansprechen', talk: talkIgnatiusGuard },
    {
      id: EAST_GUARD, preset: 'paladin', speaker: 'e3-paladin', at: OH_SPOT.eastDoor, dir: 'left', verb: 'Ansprechen',
      talk: async w => { await paladin(w, 'Hier geht es hinunter in den Saal. Ohne Befehl kommt keiner durch. Auch nicht mit großen Augen.'); },
    },
  ],
  interactables: [
    { id: 'gitter', verb: 'Hineinsehen', poly: ARMOURY_GRATE, radius: 30, once: false, standAt: OH_SPOT.armoury, face: 'up', onInteract: lookIntoArmoury },
    { id: 'pult', verb: 'Lesen', poly: OH_HOTSPOT.lectern, radius: 30, once: false, sparkle: true, standAt: OH_SPOT.lectern, face: 'up', onInteract: readChronicle },
    {
      id: 'regale', verb: 'Stöbern', poly: OH_HOTSPOT.shelves, radius: 40, once: false, standAt: [290, 170], face: 'up',
      thought: 'Gebete, Ordensregeln, Steuerlisten. Und ein Buch über Pferdekrankheiten. Wenigstens einer hier denkt praktisch.',
    },
    { id: 'kapelle', verb: 'Betrachten', poly: [[1076, 40], [1172, 40], [1172, 236], [1076, 236]], radius: 30, once: false, standAt: OH_SPOT.altar, face: 'up', onInteract: lookAtChapel },
    {
      id: 'arbeitszimmer', verb: 'Lauschen', poly: OH_DOOR.study.poly, radius: 30, once: false, standAt: OH_SPOT.studyDoor, face: 'up',
      thought: 'Die schwerste Tür im ganzen Haus. Dahinter kratzt eine Feder über Papier. Ich klopfe lieber nicht.',
    },
    { id: 'tuer-ignatius', verb: 'Klopfen', poly: OH_DOOR.ignatius.poly, radius: 30, once: false, standAt: OH_SPOT.ignatiusDoor, face: 'up', onInteract: knockIgnatius },
  ],
  exits: [{ id: 'zimmer', to: 'e3-gastzimmer-tag', spawn: 'tuer', door: { at: OH_SPOT.liaDoor, verb: 'Ins Zimmer' } }],
  onEnter: showStaffInArmoury,
  music: 'refuge',
  sneak: false,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Part 1: waking up
// ---------------------------------------------------------------------------------------------------------------

async function wakeUp(w: WorldCtx): Promise<void> {
  w.player.teleport(GZ_SPOT.bedSit, 'right');
  w.player.setIdle('sit');
  const doc = w.spawn({ id: DOCTOR, preset: 'e3-doktor', speaker: 'e3-doktor', at: GZ_SPOT.tableSide, dir: 'right', solid: false, facePlayer: false });
  doc.hold(true);
  bg(doc.play('interact', { ms: 4000 }));
  const wake = G.ui.storyAction('open-eyes', 'Die Augen öffnen');
  restageGesture('open-eyes', 'Schieb die schweren Lider nach oben. Langsam.');
  await wake;
  await ui().fade('in', 1400);
  await w.cutscene(async () => {
    await w.think('Ein Bett. Ein echtes, mit Kissen. Entweder bin ich tot, oder jemand hier meint es ausnahmsweise gut mit mir.');
    await w.think('Meine Hände sind immer noch gebunden. Also eher Letzteres. Mit Einschränkungen.');
    doc.face('player');
    await doctor(w, 'Ah, sie ist wach. Wunderbar. An Schlafenden herumzumessen verfälscht alles.', 'smirk');
    await lia(w, 'Wer seid Ihr? Und warum bin ich immer noch gefesselt?', 'scared');
    await doctor(w, 'Ich bin der Doktor des Ordens. Die Fesseln waren die Idee des Hauptmanns. Seine Leute sind im Saal recht weit geflogen.');
    await lia(w, 'Das war ich nicht. Also … nicht mit Absicht.');
    await doctor(w, 'Genau das will ich herausfinden. Komm an den Tisch. Ich beiße nicht, und meine Instrumente meistens auch nicht.', 'smirk');
    w.player.setIdle('idle');
    w.player.teleport(GZ_SPOT.bedSide, 'right');
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Heart 1: the three instruments
// ---------------------------------------------------------------------------------------------------------------

export const crystalPicture = (): GesturePicture => ({
  background: 'e3-gastzimmer', focus: [380, 100], zoom: 1.4, glint: GZ_SPOT.crystal,
  figureScale: figureScale('e3-gastzimmer'),
  figures: [
    { id: 'e3-doktor', pose: 'interact', at: [342, 130], facing: 'right' },
    { id: liaLook({ bound: true }), pose: 'idle', at: [392, 150], facing: 'up' },
  ],
});

async function crystalTest(w: WorldCtx): Promise<void> {
  const doc = w.actor(DOCTOR);
  G.state.set(F.stage, 'kristall');
  w.setObjective('e3-ms-kristall', 'Leg die Hände auf den Kristall des Doktors.', 'kristall');
  w.unlockPlayer();
  await w.waitForInteract('kristall');
  w.lockPlayer();
  await w.cutscene(async () => {
    doc.face('player');
    await doctor(w, 'Ein Lesekristall. Er zeigt jede Magie an, auch die kleinste. Beide Hände drauf. Keine Angst, er ist nur kalt.');
  });
  const gesture = G.ui.storyAction('reach', 'Die Hände auf den Kristall legen', { help: 'Schieb die gebundenen Hände zum Kristall.' });
  restageGesture('reach', 'Schieb die gebundenen Hände auf den Kristall. Ganz ruhig.', crystalPicture());
  await gesture;
  w.completeObjective('e3-ms-kristall');
  await w.cutscene(async () => {
    sfx('magic', { volume: 0.25, pitch: 0.6 });
    await w.wait(1100);
    await w.say('narrator', 'Der Kristall bleibt, was er ist: ein kaltes Stück Glas. Nicht einmal ein Funke.');
    bg(doc.play('interact', { ms: 1800 }));
    await doctor(w, 'Nichts? Bei der Köchin hat er geglüht, und die bespricht nur Warzen.', 'surprised');
    sfx('thud', { volume: 0.4, pitch: 1.4 });
    await doctor(w, 'Er ist nicht kaputt. Er war gestern nicht kaputt. Er ist nie kaputt.', 'thinking');
    await lia(w, 'Vielleicht ist er schüchtern.');
    await doctor(w, 'Instrumente sind nicht schüchtern. Instrumente sind ehrlich. Ganz im Gegensatz zu Patienten.', 'thinking');
  });
}

async function bowlTest(w: WorldCtx): Promise<void> {
  const doc = w.actor(DOCTOR);
  G.state.set(F.stage, 'schale');
  await w.cutscene(async () => {
    await doc.walkTo(GZ_SPOT.washSide[0], GZ_SPOT.washSide[1], { face: 'left' });
    await doctor(w, 'Dann die Schale. Wasser lügt nicht, Wasser hat keine Launen.', 'smirk');
  });
  w.setObjective('e3-ms-schale', 'Tritt an den Waschtisch zur Wasserschale.', 'schale');
  w.unlockPlayer();
  await w.waitForInteract('schale');
  await doctor(w, 'Tief darüberbeugen und ganz langsam ausatmen. Nicht pusten, nicht reden, nicht zappeln.');
  await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt, um dich über die Schale zu beugen, und rühr dich nicht.`);
  w.setObjective('e3-ms-schale', 'Beug dich über die Schale und halte still.', GZ_SPOT.washFront);
  let p = 0, lastX = w.player.x, lastY = w.player.y, nagAt = -99, t = 0;
  const said = new Set<number>();
  while (w.alive && p < 1) {
    await w.wait(100);
    if (G.ui.busy()) continue;
    t += 0.1;
    const moved = Math.hypot(w.player.x - lastX, w.player.y - lastY);
    lastX = w.player.x; lastY = w.player.y;
    const before = p;
    p = stepStill(p, 0.1, w.stealth.hidden, moved);
    if (before > 0.2 && p < before * 0.5 && t - nagAt > 3) { nagAt = t; w.bark(DOCTOR, 'Nicht bewegen! Von vorn.', 1600); }
    if (p >= 0.35 && !said.has(1)) { said.add(1); w.bark(DOCTOR, 'Gut … ganz ruhig …', 1600); }
    if (p >= 0.7 && !said.has(2)) { said.add(2); w.bark(DOCTOR, 'Es kräuselt sich. Weiter …', 1600); sfx('splash', { volume: 0.15, pitch: 1.6 }); }
  }
  w.completeObjective('e3-ms-schale');
  await w.cutscene(async () => {
    sfx('splash', { volume: 0.9 });
    w.fx.burst(GZ_SPOT.bowl, 'splash', 26);
    w.fx.burst([GZ_SPOT.washSide[0], GZ_SPOT.washSide[1] - 34], 'splash', 12);
    w.camera.shake(160, 0.003);
    bg(doc.hop());
    await w.say('narrator', 'Das Wasser springt. Nicht ein bisschen: Es steigt in einer Säule aus der Schale und klatscht dem Doktor ins Gesicht.');
    await doctor(w, 'Meine Augen! Das ist Brunnenwasser, das tut so etwas nicht!', 'surprised');
    w.player.face(DOCTOR);
    await lia(w, 'Ich habe nur geatmet. Ganz langsam, wie Ihr gesagt habt.');
    await doctor(w, 'Erst gar nichts, dann viel zu viel. Großartig. So schreibe ich das bestimmt nicht auf.', 'thinking');
  });
}

async function candleTest(w: WorldCtx): Promise<void> {
  const doc = w.actor(DOCTOR);
  G.state.set(F.stage, 'kerze');
  const flame = w.lighting.add({ id: 'e3-doktorkerze', at: [GZ_SPOT.candle[0], GZ_SPOT.candle[1] + 10], kind: 'candle', radius: 36, intensity: 1, always: true });
  const hand = handFlame(w);
  const follow = () => {
    const { at, depth } = doctorCandleAnchor(doc);
    flame.set({ at }); hand.at(at[0], at[1], depth);
  };
  await w.cutscene(async () => {
    await doc.walkTo(GZ_SPOT.tableSide[0], GZ_SPOT.tableSide[1] + 10, { face: 'right' });
    void w.lighting.get('gz-kerze').fadeTo(0, 300);
    follow();
    await doctor(w, 'Letzter Versuch. Die Kerze. Sieh in die Flamme und bleib dicht bei mir, ganz gleich, wohin ich gehe.');
  });
  w.setObjective('e3-ms-kerze', 'Folge dem Doktor und seiner Kerze. Bleib nah an der Flamme.', DOCTOR);
  w.unlockPlayer();
  let done = false;
  doc.setSpeed(34);
  const walking = (async () => {
    while (w.alive && !done) for (const at of GZ_CANDLE_LOOP) { if (done) break; await doc.walkTo(at[0], at[1]); }
  })();
  bg(walking);
  let p = 0, nagAt = -99, t = 0, nag = 0;
  const said = new Set<number>();
  const nags = ['Näher! Die Flamme, nicht die Wand.', 'Hier vorne spielt die Musik.', 'Bleib dran, Mädchen.'];
  while (w.alive && p < 1) {
    await w.wait(60);
    follow();
    if (G.ui.busy()) continue;
    t += 0.06;
    const dist = Math.hypot(w.player.x - doc.x, w.player.y - doc.y);
    p = stepFollow(p, 0.06, dist);
    if (followVerdict(dist) === 'far' && t - nagAt > 4) { nagAt = t; w.bark(DOCTOR, nags[nag++ % nags.length], 1800); }
    if (p >= 0.4 && !said.has(1)) { said.add(1); w.bark(DOCTOR, 'Gut so. Nicht blinzeln.', 1600); }
    if (p >= 0.75 && !said.has(2)) { said.add(2); w.bark(DOCTOR, 'Sie flackert … warum flackert sie?', 1800); }
  }
  done = true;
  w.completeObjective('e3-ms-kerze');
  w.lockPlayer();
  let walked = false;
  void walking.catch(() => {}).then(() => { walked = true; });
  while (w.alive && !walked) { follow(); await w.wait(50); }
  await w.cutscene(async () => {
    doc.face('player');
    w.player.face(DOCTOR);
    const { at, depth } = doctorCandleAnchor(doc);
    flame.set({ at, color: TURQUOISE, radius: 130, intensity: 1.5 });
    hand.at(at[0], at[1], depth);
    hand.flare(true);
    sfx('fire-ignite', { volume: 0.8 });
    sfx('spark', { volume: 0.6 });
    w.fx.burst(at, 'urmacht', 14);
    w.camera.shake(220, 0.004);
    bg(doc.hop());
    await w.wait(500);
    flame.set({ color: 0xffc46b, radius: 36, intensity: 1 });
    hand.flare(false);
    await w.say('narrator', 'Die Flamme schießt eine Elle hoch, ~türkis~ für einen Herzschlag, und neigt sich zu Lia hin wie eine Blume zum Fenster.');
    await doctor(w, 'Meine Augenbrauen! Sind die noch dran?', 'surprised');
    await lia(w, 'Die linke auf jeden Fall.');
    const back = doc.walkTo(GZ_SPOT.tableSide[0], GZ_SPOT.tableSide[1], { face: 'right' });
    while (Math.hypot(doc.x - GZ_SPOT.tableSide[0], doc.y - GZ_SPOT.tableSide[1]) > 2) { follow(); await w.wait(50); }
    await back;
    flame.remove();
    hand.remove();
    void w.lighting.get('gz-kerze').fadeTo(0.8, 300);
    bg(doc.play('read', { ms: 3000 }));
    await doctor(w, 'Nichts beim Kristall, viel zu viel bei der Schale, und die Kerze … Ich bräuchte etwas zum Vergleichen. Es gibt nichts.', 'thinking');
  });
  G.state.set(F.stage, 'fertig');
}

// ---------------------------------------------------------------------------------------------------------------
// The Großmeister: verdict and negotiation
// ---------------------------------------------------------------------------------------------------------------

async function verdict(w: WorldCtx): Promise<void> {
  const doc = w.actor(DOCTOR);
  await w.cutscene(async () => {
    sfx('door', { volume: 0.6 });
    const g = w.spawn({ id: GM, preset: 'e3-grossmeister', speaker: 'e3-grossmeister', at: GZ_SPOT.door, dir: 'left', solid: false, facePlayer: false });
    const guard = w.spawn({ id: GUARD, preset: 'paladin', speaker: 'e3-paladin', at: GZ_SPOT.door, dir: 'left', solid: false, facePlayer: false });
    g.hold(true); guard.hold(true);
    bg(guard.walkTo(GZ_SPOT.doorGuard[0], GZ_SPOT.doorGuard[1], { face: 'left' }));
    await g.walkTo(430, 236, { face: 'left' });
    doc.face(GM);
    await gm(w, 'Ihr seht aus, als hättet Ihr mit einem Brunnen gerungen, Doktor. Was habt Ihr herausgefunden?', 'thinking');
    await doctor(w, 'Großmeister. In ihr steckt Magie, so stark, wie ich noch keine gemessen habe. Meine Instrumente kommen nicht mit.');
    await gm(w, 'Ist es die Urmacht? Ja oder nein.', 'grim');
    await doctor(w, 'Das kann ich nicht sagen. Über die Urmacht ist kaum etwas aufgeschrieben, und ich habe nichts, womit ich vergleichen könnte.');
    await doctor(w, 'Noch nicht.', 'smirk');
    await gm(w, 'Dann sucht weiter. Und jetzt lasst uns allein.', 'determined');
    await doc.walkTo(GZ_SPOT.door[0], GZ_SPOT.door[1]);
    sfx('door', { volume: 0.5 });
    w.despawn(DOCTOR);
  });
}

async function negotiation(w: WorldCtx): Promise<void> {
  const g = w.actor(GM);
  await w.cutscene(async () => {
    await w.player.walkTo(GZ_SPOT.centre[0] + 40, GZ_SPOT.centre[1] - 10, { face: 'right' });
    g.face('player');
    await gm(w, 'Drei meiner Leute lagen im Saal auf dem Rücken, und du hast keinen Finger gerührt. Wie fühlst du dich?');
    await lia(w, 'Gefesselt. Und ich will wissen, wann ich gehen darf.', 'determined');
    await gm(w, 'Gehen? Wohin denn? Draußen suchen dich Leute, denen du nicht begegnen willst.', 'surprised');
    await gm(w, 'Hier stehen zweihundert Paladine zwischen dir und den Dunkelschatten. Mehr Schutz findest du in ganz Selantis nicht.');
    await lia(w, 'Meine Schwester und zwei Freunde sitzen bei den Dunkelschatten fest. Ich muss zu ihnen, nicht hinter Eure Mauern.', 'angry');
    await gm(w, 'Drei Menschen. Ich verstehe das. Aber mit dem, was in dir steckt, könnte man Tausende schützen. Rechne selbst.', 'grim');
    const tone = VERHANDLUNG_TONES[await w.choose(VERHANDLUNG_TONES.map(t => VERHANDLUNG_ANSWERS[t]))];
    G.state.set('e3-verhandlung-ton', tone);
    if (tone === 'kalt') {
      await gm(w, 'Du drohst mir. In meinem eigenen Haus.', 'angry');
      await gm(w, 'Nein. Du sagst mir nur, wie es steht. Das ist mir lieber als jede Schmeichelei.', 'thinking');
    } else if (tone === 'bittend') {
      await gm(w, 'Du bittest gut. Und du hast recht: Was im Saal geschah, möchte ich auch nicht noch einmal erleben.', 'thinking');
    } else {
      await gm(w, 'Du rechnest schneller als mein Schatzmeister. Und unbequemer.', 'thinking');
    }
    await gm(w, 'Also gut. Ich sehe, was der Orden für deine Leute tun kann. Bis dahin bleibst du hier, unter meinem Schutz.', 'determined');
    g.face(GUARD);
    await gm(w, 'Nehmt ihr die Fesseln ab. Die Stäbe bleiben in der Waffenkammer. Und dann lasst sie schlafen.');
    await lia(w, 'Und Ignatius? Wo ist er?');
    g.face('player');
    await gm(w, 'Versorgt. Ruh dich aus, Mädchen.');
    await g.walkTo(GZ_SPOT.door[0], GZ_SPOT.door[1]);
    sfx('door', { volume: 0.5 });
    w.despawn(GM);
  });
}

async function bondsOff(w: WorldCtx): Promise<void> {
  const guard = w.actor(GUARD);
  await w.cutscene(async () => {
    await guard.walkTo(w.player.x + 22, w.player.y + 4, { face: 'left' });
    w.player.face(GUARD);
    sfx('rope-cut', { volume: 0.7 });
    bg(guard.play('interact', { ms: 700 }));
    await w.wait(600);
    w.player.setLook(liaLook());
    await w.think('Meine Hände. Sie kribbeln, als wären sie eingeschlafen und wollten mir jetzt alles auf einmal erzählen.');
    await lia(w, 'Wo ist Ignatius? Der alte Mann, mit dem ich gekommen bin.');
    await paladin(w, 'Darüber soll ich eigentlich nicht reden.');
    await w.choose([...IGNATIUS_ASKS]);
    await paladin(w, '… Eine Tür weiter. Die mit dem Riegel außen, so wie deine.');
    await paladin(w, 'Befehl von oben: Ihr redet erst miteinander, wenn jeder für sich ausgesagt hat. Wegen der Geschichten, verstehst du.');
    await w.think('Gleich nebenan. Und trotzdem weiter weg als Portas.');
    await guard.walkTo(GZ_SPOT.door[0], GZ_SPOT.door[1]);
    sfx('door', { volume: 0.4 });
    w.despawn(GUARD);
  });
}

/** The doctor's reading crystal on the table: a cold, pulsing glint and a faint light (code-drawn effect, no prop). */
function crystalShine(w: WorldCtx): void {
  const scene = w.scene as Phaser.Scene & { addWorld?: (o: Phaser.GameObjects.GameObject) => unknown };
  const [x, y] = GZ_SPOT.crystal;
  const halo = scene.add.image(x, y - 6, 'w-glow').setTint(0xcfdcff).setBlendMode(1).setScale(0.22).setAlpha(0.55).setDepth(100);
  const spark = scene.add.image(x, y - 6, 'fx-spark').setTint(0xf0f4ff).setBlendMode(1).setScale(1.6).setAlpha(0.9).setDepth(101);
  scene.addWorld?.(halo);
  scene.addWorld?.(spark);
  scene.tweens.add({ targets: [spark, halo], alpha: 0.3, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  w.lighting.add({ id: 'e3-kristall', at: [x, y - 6], kind: 'plain', color: 0xdde6ff, radius: 22, intensity: 0.6, always: true });
  scene.events.once('shutdown', () => { scene.tweens.killTweensOf([spark, halo]); spark.destroy(); halo.destroy(); });
}

// Visible hand pixels in e3-doktor-walk's idle frames (3/5/9/15), relative to the [32,60] feet anchor.
const CANDLE_HAND: Record<ActorHandle['dir'], readonly [number, number]> = {
  down: [-8, -18], left: [-4, -20], right: [3, -21], up: [6, -20],
};

/** Sprite-local hand position; sorting stays at the doctor's ground depth, independent of hand height. */
export function doctorCandleAnchor(doc: Pick<ActorHandle, 'x' | 'y' | 'dir' | 'sprite'>): { at: [number, number]; depth: number } {
  const sprite = doc.sprite;
  const [dx, dy] = CANDLE_HAND[doc.dir];
  return {
    at: [
      (sprite?.x ?? doc.x) + dx * (sprite?.scaleX ?? 1) * (sprite?.flipX ? -1 : 1),
      (sprite?.y ?? doc.y) + dy * (sprite?.scaleY ?? 1),
    ],
    depth: sprite?.depth ?? doc.y,
  };
}

/** The doctor's candle flame in his hand (a warm glow that follows him; the light alone is too faint by day). */
function handFlame(w: WorldCtx): { at(x: number, y: number, groundDepth: number): void; flare(on: boolean): void; remove(): void } {
  const scene = w.scene as Phaser.Scene & { addWorld?: (o: Phaser.GameObjects.GameObject) => unknown };
  const glow = scene.add.image(0, 0, 'w-glow').setTint(0xffc46b).setBlendMode(1).setScale(0.2).setAlpha(0.8);
  const core = scene.add.image(0, 0, 'fx-ember').setTint(0xffe2a0).setBlendMode(1).setScale(1.4);
  scene.addWorld?.(glow);
  scene.addWorld?.(core);
  scene.tweens.add({ targets: core, scaleY: 1.8, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  let gone = false;
  const remove = () => { if (gone) return; gone = true; scene.tweens.killTweensOf(core); glow.destroy(); core.destroy(); };
  scene.events.once('shutdown', remove);
  return {
    at(x, y, groundDepth) { if (!gone) { glow.setPosition(x, y).setDepth(groundDepth + 0.4); core.setPosition(x, y).setDepth(groundDepth + 0.5); } },
    flare(on) { if (!gone) { glow.setTint(on ? TURQUOISE : 0xffc46b).setScale(on ? 0.7 : 0.2); core.setTint(on ? 0xc8fff6 : 0xffe2a0).setScale(on ? 3 : 1.4); } },
    remove,
  };
}

async function pruefungScript(w: WorldCtx): Promise<void> {
  for (const f of [F.stage, F.freed, F.sleep]) G.state.set(f, false);
  w.lockPlayer();
  crystalShine(w);
  await wakeUp(w);
  await crystalTest(w);
  await bowlTest(w);
  await candleTest(w);
  await verdict(w);
  await negotiation(w);
  await bondsOff(w);
  G.state.set(F.freed);
  await ui().fade('out', 1000);
  await nextScene('e3-macht-und-schutz', { part: 'haus' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: the house by day
// ---------------------------------------------------------------------------------------------------------------

async function offerSleep(w: WorldCtx): Promise<void> {
  await w.think('Das Bett. Die Decke riecht nach Lavendel und fremden Leuten.');
  const pick = await w.choose(['Schlafen gehen.', 'Noch nicht. Erst will ich mich umsehen.']);
  if (pick === 0) G.state.set(F.sleep);
}

async function lookIntoArmoury(w: WorldCtx): Promise<void> {
  await lookIntoArmouryCam(w, async () => {
    if (staffPlace() === 'waffenkammer') {
      await w.think('Zwischen Speeren und Schilden, ganz hinten an der Wand: mein Stab. Zwischen all dem Eisen sieht er aus wie ein verirrter Ast.');
      G.state.addClue('e3-stab-gesehen');
      await w.think('Das Gitter ist abgeschlossen, das Schloss größer als meine Faust. Ich merke mir nur, wo er hängt.');
    } else {
      await w.think('Speere, Schilde, Schwerter. Mein Stab ist nicht dabei.');
    }
  });
}

async function readChronicle(w: WorldCtx): Promise<void> {
  if (G.state.is(F.chronicle)) { await w.think('Aros, Aros, Aros. Der Schreiber hatte offenbar nur ein Lieblingswort.'); return; }
  G.state.set(F.chronicle);
  sfx('page', { volume: 0.6 });
  bg(w.player.play('read', { ms: 2600 }));
  await w.think('Eine Chronik des Ordens, sauber abgeschrieben, die Anfangsbuchstaben in Gold.');
  await w.say('narrator', '„Aros, der Erste der Zehn, erhob sich gegen die Hexe Xenovia und brachte den Menschen das Licht.“');
  await w.think('Bei Mutter hieß sie nie Hexe. Bei Mutter war sie die, die alles gemacht hat und die man dann nicht mehr wollte.');
  G.state.addLore('e3-lore-aros');
}

async function lookAtChapel(w: WorldCtx): Promise<void> {
  await w.think('Blaues und goldenes Glas, Raute an Raute, kein Bild darin. Vielleicht soll man sich das Licht selbst dazudenken.');
  await w.think('Auf dem Altar eine Schale Wasser und vier Kerzen. Mutter hat nie gebetet. Kerzen hat sie trotzdem jeden Abend angezündet.');
}

async function knockIgnatius(w: WorldCtx): Promise<void> {
  sfx('door', { volume: 0.25, pitch: 1.6 });
  w.bark(IGN_GUARD, 'Hände weg von der Tür.', 1800);
  await w.think('Drinnen knarrt eine Diele. Er ist da. Er antwortet nur nicht. Oder er darf nicht.');
}

async function talkIgnatiusGuard(w: WorldCtx): Promise<void> {
  if (G.state.is(F.ignGuard)) { await paladin(w, 'Immer noch keine Besuche. Ich bin geduldiger als du, glaub mir.'); return; }
  G.state.set(F.ignGuard);
  await lia(w, 'Ist Ignatius da drin? Ich will nur kurz mit ihm reden.');
  await paladin(w, 'Befehl vom Großmeister: keine Besuche. Auch keine kurzen.');
}

const NOVICE_TOPICS = [
  { key: 'haus', ask: '„Was ist das hier eigentlich für ein Haus?“' },
  { key: 'aros', ask: '„Wer ist dieser Aros, von dem hier alle reden?“' },
  { key: 'doktor', ask: '„Und der Doktor? Wo steckt der, wenn er keine Mädchen nass macht?“' },
  { key: 'grossmeister', ask: '„Schläft der Großmeister eigentlich auch mal?“' },
] as const;

async function talkNovice(w: WorldCtx): Promise<void> {
  if (!G.state.is(F.noviceMet)) {
    G.state.set(F.noviceMet);
    await novice(w, 'Oh! Du bist das Mädchen aus dem Saal. Ich soll hier den Wasserkrug bewachen. Sagt der Hauptmann.');
    await lia(w, 'Ist er denn in Gefahr?');
    await novice(w, 'Ehrlich gesagt bewache ich eher mich. Vor dem Hauptmann.');
  } else {
    await novice(w, 'Noch eine Frage? Der Krug läuft nicht weg.');
  }
  const asked = new Set<string>();
  for (;;) {
    const open = NOVICE_TOPICS.filter(t => !asked.has(t.key));
    const pick = await w.choose([...open.map(t => t.ask), '„Danke. Ich lass dich weiter Wasser bewachen.“']);
    if (pick >= open.length) { await novice(w, 'Gute Nacht schon mal. Hier oben wird es früh dunkel.'); return; }
    const topic = open[pick].key;
    asked.add(topic);
    if (topic === 'haus') {
      await novice(w, 'Das Ordenshaus. Oben schlafen und lesen wir, unten wird gebetet, gegessen und geübt. Meistens in dieser Reihenfolge.');
    } else if (topic === 'aros') {
      await novice(w, 'Aros war der Erste der Zehn. Er hat die Hexe gestürzt und uns das Licht gebracht. Steht alles in der Bibliothek.');
      await novice(w, 'Falls du lesen kannst.');
      await lia(w, 'Kann ich.');
      await novice(w, 'Oh. Dann bist du schon weiter als ich. Ich kenne nur die Bilder.');
    } else if (topic === 'doktor') {
      await novice(w, 'Der wohnt praktisch in der Bibliothek. Nachts brennt dort noch seine Lampe. Er vergisst sie ständig.');
    } else {
      await novice(w, 'Kaum. Bis tief in die Nacht sitzt er im Arbeitszimmer und rechnet. Höfe, Männer, Gebete. Alles hat bei ihm eine Zahl.');
    }
  }
}

async function hubScript(w: WorldCtx): Promise<void> {
  for (const f of [F.sleep, F.chronicle, F.noviceMet, F.ignGuard]) G.state.set(f, false);
  await ui().fade('in', 1000);
  await w.think('Frei. Ungefähr so frei wie ein Huhn im Hof: herumlaufen ja, über den Zaun nein.');
  w.setObjective('e3-ms-umsehen', 'Sieh dich im Ordenshaus um. Wenn du müde bist: zurück ins Bett.', null);
  await until(w, () => G.state.is(F.sleep) && !G.ui.busy());
  w.completeObjective('e3-ms-umsehen');
  await w.cutscene(async () => {
    w.player.teleport(GZ_SPOT.bedSit, 'right');
    w.player.setIdle('sit');
    await w.think('Ich zähle die Balken unter dem Dach. Bei vierzehn bin ich weg.');
  });
  w.lockPlayer();
  await ui().fade('out', 1400);
  G.state.set('e3-untersucht');
  G.state.set('e3-verhandelt');
  if (!G.state.flag('e3-verhandlung-ton')) G.state.set('e3-verhandlung-ton', 'klug');
  await nextScene('e3-falscher-glaube');
}

export const scene = e3Scene('e3-macht-und-schutz', 'Untersuchung und Verhandlung', async params => {
  await ui().fade('out', 0);
  if (params?.part === 'haus' && G.state.is(F.freed)) {
    await startWorld({ map: zimmerTag, spawn: 'bett', player: liaLook(), fadeIn: false, script: hubScript });
    return;
  }
  await startWorld({ map: pruefungMap, spawn: 'bett', player: liaLook({ bound: true }), fadeIn: false, script: pruefungScript });
});

/** Exported for tests: the candle loop must stay on free floor, the thresholds must make sense. */
export const MS_TEST = { FOLLOW, BOWL_LEAN };

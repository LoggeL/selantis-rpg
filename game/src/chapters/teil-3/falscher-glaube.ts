// Scene „e3-falscher-glaube“ – Falscher Glaube (docs/teil-3/umsetzung.md §3, F3 14:00–20:01). Two checkpointed parts
// (G.goto with { part }, a reload restarts the current part):
//  1. default, framed „Weit entfernt …“ (player knowledge only): plate e2-sehkugel, a spark in Vamir's crystal – he
//     has found her again. In his hall (e3-halle-kugel) the bound Kyra steps forward; he sends her to fetch her
//     sister, „sweetly, the way a sister is“. No technique is named.
//  2. 'nacht': Lia wakes in her room (e3-gastzimmer-nacht); a violet afterglow at the window fades, unexplained. She
//     sneaks out to see Ignatius (e3-ordenshaus-nacht): two paladins with lanterns walk the house (view cones,
//     shadows as hiding places, spotted = back to the last checkpoint, never game over). Ignatius' room is empty. Goal
//     1: the doctor's book under his forgotten lamp in the library – no title; Lia reads three places (the making of
//     the world, „what belonged to the first“, a page cut out with a fresh „Freiwillig?“ in the margin), no list of
//     objects. Goal 2: listening at the study door in three sections (falscher-glaube-gespraech.ts); between them the
//     corridor guard walks past and Lia must duck into the shadow beside the door. She hears the Großmeister's plan
//     for the faith in Aros, the price (she might die), the old charge of desertion, and Ignatius offering her for
//     Gwynn (clue e3-hinweis-gwynn, lore e3-lore-glaube). Ignatius leaves; Lia slips back to her room unseen.
//     → e3-kyras-fluchtweg.
import type Phaser from 'phaser';
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { pointInPoly } from '../../world/poly';
import { HALLE_SPAWNS, HALLE_SPOT, halleBase, halleBrazierLights } from '../teil-2/gewoelbe';
import { BOOK_PLATE, registerBookPlate } from './falscher-glaube-buch';
import {
  AFTER_BARGAIN, BACK_IN_BED, canListen, STUDY_SECTIONS, unreadPassages, type Line,
} from './falscher-glaube-gespraech';
import {
  ARMOURY_GRATE, GZ_DOOR_AT, GZ_SPOT, gastzimmerBase, NIGHT_GUARD, NIGHT_GUARDS, OH_DOOR, OH_HOTSPOT, OH_SHADOWS, OH_SPAWNS, OH_SPOT,
  lookIntoArmouryCam, ordenshausBase, ordenshausNightLights, showStaffInArmoury, STUDY_LISTEN,
} from './ordenshaus';
import { bg, e3Scene, interlude, liaLook, nextScene, sfx, staffPlace, ui, until, VIOLET } from './shared';
import { NO_LOOK } from './spuersinn';

/** Flags of this visit (reset when a part starts) and the checkpoint flag of part 2. */
const F = {
  seen: 'e3-fg-kugel',
  door: 'e3-fg-tuer',
  book: 'e3-fg-buch',
  heard: 'e3-fg-gehoert',
  home: 'e3-fg-zurueck',
  /** Spawn name of the current stealth checkpoint upstairs. */
  cp: 'e3-fg-checkpoint',
} as const;

const MENTOR = 'ignatius';
const KYRA = 'kyra';
const GUARD = NIGHT_GUARD.corridor;

// ---------------------------------------------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------------------------------------------

/** Vamir's hall, the crystal on the heavy table (a cold violet glow, code-drawn). */
export const halleKugel: MapDef = defineMap({
  ...halleBase,
  id: 'e3-halle-kugel',
  name: 'Weit entfernt',
  spawns: { ...HALLE_SPAWNS, kugel: { at: HALLE_SPOT.tableHead, dir: 'left' } },
  lights: [
    ...halleBrazierLights(0.7),
    { id: 'e3-kugel', at: [HALLE_SPOT.tableTop[0] + 20, HALLE_SPOT.tableTop[1] - 18], kind: 'plain', color: VIOLET, radius: 46, intensity: 0.9, always: true },
  ],
  time: 'night',
  ambience: ['room'],
  ambienceVolume: { room: 0.6 },
  music: 'dread',
  resetOnEnter: true,
  lookBlocked: NO_LOOK.halle,
});

export const zimmerNacht: MapDef = defineMap({
  ...gastzimmerBase(true),
  id: 'e3-gastzimmer-nacht',
  name: 'Lias Zimmer im Ordenshaus',
  interactables: [
    { id: 'tuer', verb: 'Leise öffnen', poly: [[560, 110], [608, 110], [608, 250], [560, 250]], radius: 30, once: false, standAt: GZ_DOOR_AT, face: 'right' },
    {
      id: 'fenster', verb: 'Hinaussehen', poly: [[272, 4], [338, 4], [338, 72], [272, 72]], radius: 46, once: false, standAt: GZ_SPOT.window, face: 'up',
      thought: 'Mond über den Dächern. Kein violettes Licht mehr. Vielleicht war da nie eins.',
    },
  ],
  music: 'dread',
  sneak: true,
  resetOnEnter: true,
  lookBlocked: NO_LOOK.nacht,
});

const setCheckpoint = (spawn: string) => () => { G.state.set(F.cp, spawn); };

export const hausNacht: MapDef = defineMap({
  ...ordenshausBase(true),
  id: 'e3-ordenshaus-nacht',
  name: 'Das Ordenshaus bei Nacht',
  spawns: { ...OH_SPAWNS, 'treppe-unten': { at: OH_SPOT.stairFoot, dir: 'up' } },
  guards: NIGHT_GUARDS,
  hidingSpots: OH_SHADOWS,
  lights: ordenshausNightLights({ studyLit: true, libraryLamp: true }),
  interactables: [
    { id: 'tuer-ignatius', verb: 'Leise klopfen', poly: OH_DOOR.ignatius.poly, radius: 30, once: false, standAt: OH_SPOT.ignatiusDoor, face: 'up', onInteract: knockAtNight },
    { id: 'buch', verb: 'Lesen', poly: OH_HOTSPOT.lectern, radius: 30, once: false, sparkle: true, standAt: OH_SPOT.lectern, face: 'up', onInteract: readBook },
    { id: 'gitter', verb: 'Hineinsehen', poly: ARMOURY_GRATE, radius: 30, once: false, standAt: OH_SPOT.armoury, face: 'up', onInteract: lookAtStaff },
    { id: 'zimmertuer', verb: 'Ins Zimmer', poly: OH_DOOR.lia.poly, radius: 30, once: false, standAt: OH_SPOT.liaDoor, face: 'up', onInteract: backToRoom },
  ],
  triggers: [
    { id: 'cp-bibliothek', poly: [[60, 152], [368, 152], [368, 256], [60, 256]], once: false, onEnter: setCheckpoint('bibliothek') },
    { id: 'cp-alkoven', poly: [[824, 300], [966, 300], [966, 340], [824, 340]], once: false, onEnter: setCheckpoint('alkoven') },
    { id: 'cp-treppe', poly: [[850, 650], [1016, 650], [1016, 706], [850, 706]], once: false, onEnter: setCheckpoint('treppe-unten') },
  ],
  onEnter: showStaffInArmoury,
  music: 'dread',
  sneak: true,
  resetOnEnter: true,
  lookBlocked: NO_LOOK.nacht,
});

// ---------------------------------------------------------------------------------------------------------------
// Part 1: far away – the crystal and Kyra
// ---------------------------------------------------------------------------------------------------------------

const vamir = (w: WorldCtx, text: string) => w.say('e2-vamir', text);
const kyra = (w: WorldCtx, text: string, mood: string) => w.say('e2-kyra-gebannt', text, { mood });

async function kugelScript(w: WorldCtx): Promise<void> {
  G.state.set(F.seen, false);
  w.lockPlayer();
  ui().prefetchPlate('e2-sehkugel');
  await interlude('Weit entfernt …');
  await G.ui.plate('e2-sehkugel', { caption: 'Weit entfernt', pan: 'in', durationMs: 16000 });
  await ui().fade('in', 700);
  await G.ui.say('narrator', 'Tief in der Kugel aus Kristall glomm ein winziger ~Funke~. Tagelang war er fort gewesen. Jetzt flackerte er wieder.');
  await vamir(w, 'Ein Ausbruch, mitten in einer Stadt voller Paladine. Nicht sehr klug, Kind.');
  await vamir(w, 'Aber laut. Laut genug, dass man es bis hierher hört.');
  await vamir(w, 'Gefunden.');
  await ui().fade('out', 600);
  await G.ui.closePlate();

  const k = w.spawn({ id: KYRA, preset: 'e2-kyra-gebannt', speaker: 'e2-kyra-gebannt', at: HALLE_SPOT.doorSouth, dir: 'up', solid: false, facePlayer: false });
  k.hold(true);
  await w.camera.zoom(1.4, 0);
  await w.camera.pan([250, 190], 0);
  await ui().fade('in', 900);
  await w.cutscene(async () => {
    await w.wait(500);
    await vamir(w, 'Kyra. Komm her.');
    await k.walkTo(262, 196, { face: 'left' });
    w.player.face(KYRA);
    k.face('player');
    await kyra(w, 'Ihr habt gerufen, Meister.', 'devoted');
    await vamir(w, 'Deine Schwester schläft in Trapas. Bei den Paladinen, in einem weichen Bett. Sie vermisst dich sicher.');
    await kyra(w, 'Dann gehe ich zu ihr.', 'cold');
    await vamir(w, 'Bring sie mir. Und sei lieb zu ihr. So, wie eine Schwester eben ist.');
    await kyra(w, 'So, wie eine Schwester ist.', 'cold');
    await k.walkTo(HALLE_SPOT.doorSouth[0], HALLE_SPOT.doorSouth[1] + 8);
    w.despawn(KYRA);
    w.player.face('left');
    await w.wait(900);
  });
  await ui().fade('out', 1100);
  G.state.set(F.seen);
  await nextScene('e3-falscher-glaube', { part: 'nacht' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: the night – waking, Ignatius' empty room, the book
// ---------------------------------------------------------------------------------------------------------------

async function wakeAtNight(w: WorldCtx): Promise<void> {
  w.player.teleport(GZ_SPOT.bedSit, 'right');
  w.player.setIdle('sit');
  const glow = w.lighting.add({ id: 'e3-nachschein', at: GZ_SPOT.windowLight, kind: 'plain', color: VIOLET, radius: 80, intensity: 0.9, always: true });
  // The painted window is warm and bright: a cold violet bloom over it makes the afterglow readable.
  const scene = w.scene as Phaser.Scene & { addWorld?: (o: Phaser.GameObjects.GameObject) => unknown };
  const bloom = scene.add.image(GZ_SPOT.windowLight[0], GZ_SPOT.windowLight[1] + 4, 'w-glow').setTint(VIOLET).setBlendMode(1).setScale(1.1, 0.9).setAlpha(0.95).setDepth(60);
  scene.addWorld?.(bloom);
  scene.events.once('shutdown', () => bloom.destroy());
  await ui().fade('in', 1400);
  await w.cutscene(async () => {
    await w.think('Ich bin wach. Warum bin ich wach?');
    w.player.face('up');
    sfx('whoosh', { volume: 0.2, pitch: 0.5 });
    await w.wait(500);
    await w.think('Am Fenster … Licht. Violett. Und kalt, obwohl Licht doch nicht kalt sein kann.');
    scene.tweens.add({ targets: bloom, alpha: 0, duration: 1800 });
    await glow.fadeTo(0, 1800);
    glow.remove();
    bloom.destroy();
    await w.think('Weg. Nur Mond und Dächer. Ich habe geträumt. Bestimmt habe ich nur geträumt.');
    w.player.setIdle('idle');
    w.player.teleport(GZ_SPOT.bedSide, 'right');
    await w.think('Schlafen kann ich jetzt jedenfalls nicht mehr. Ignatius ist gleich nebenan. Ich will wenigstens wissen, wie es ihm geht.');
  });
}

async function knockAtNight(w: WorldCtx): Promise<void> {
  if (G.state.is(F.door)) { await w.think('Leer. Das Bett ist immer noch glatt gezogen.'); return; }
  sfx('door', { volume: 0.15, pitch: 1.8 });
  await w.think('Ich klopfe. Ganz leise, mit einem Knöchel. Nichts.');
  await w.think('Die Tür ist nicht verschlossen. Das Bett ist leer, die Decke glatt gezogen. Er war die ganze Nacht nicht hier.');
  await w.think('Wo steckt ein alter Mann mitten in der Nacht, in einem Haus, in dem er Gefangener ist?');
  G.state.set(F.door);
}

async function readBook(w: WorldCtx): Promise<void> {
  if (G.state.is(F.book)) { await w.think('Das Buch habe ich gelesen. Mehr davon, als mir lieb ist.'); return; }
  registerBookPlate();
  ui().prefetchPlate(BOOK_PLATE);
  await w.think('Die Lampe brennt noch. Darunter ein Buch, so alt, dass der Einband nach Keller riecht. Kein Titel, nur ein heller Fleck.');
  sfx('page', { volume: 0.6 });
  await G.ui.plate(BOOK_PLATE, { caption: 'Das Buch auf dem Pult', pan: 'in', durationMs: 90000 });
  const read = new Set<string>();
  for (let open = unreadPassages(read); open.length; open = unreadPassages(read)) {
    const p = open[await w.choose(open.map(o => o.pick), { prompt: 'Wo lese ich?' })];
    sfx('page', { volume: 0.5 });
    await w.say('narrator', p.book);
    await w.think(p.thought);
    read.add(p.key);
  }
  await G.ui.closePlate();
  await w.think('Das ist das Buch des Doktors. Er sucht darin nach einem Weg. Ich habe das Gefühl, der Weg führt zu mir.');
  G.state.set(F.book);
}

async function lookAtStaff(w: WorldCtx): Promise<void> {
  await lookIntoArmouryCam(w, async () => {
    if (staffPlace() !== 'waffenkammer') { await w.think('Speere und Schilde. Mehr nicht.'); return; }
    await w.think('Da hängt er, hell zwischen dem Eisen. Ich könnte das Gitter anstarren, bis es schmilzt. Es schmilzt aber nicht.');
    G.state.addClue('e3-stab-gesehen');
  });
}

async function backToRoom(w: WorldCtx): Promise<void> {
  if (!G.state.is(F.heard)) { await w.think('Noch nicht. Erst will ich wissen, wo Ignatius steckt.'); return; }
  G.state.set(F.home);
}

// ---------------------------------------------------------------------------------------------------------------
// Stealth: spotted means back to the last checkpoint
// ---------------------------------------------------------------------------------------------------------------

interface PassState { seen: boolean; passed: boolean; active: boolean }

/** The alcove in front of the study door: while the lantern shines into it, only its two shadows are safe. */
const ALCOVE = [[824, 238], [966, 238], [966, 300], [824, 300]] as [number, number][];

/**
 * Being caught: the guard calls out, fade, back to the last checkpoint (never game over). Used as the stealth
 * reaction and by the guard pass when the lantern finds Lia in the alcove outside the shadows.
 */
function caughtHandler(w: WorldCtx, pass: PassState): (guardId: string) => Promise<void> {
  const lines = ['Das war knapp. Noch einmal, leiser.', 'Zu nah am Licht. Noch einmal, im Schatten.', 'Nicht stehen bleiben, wo die Laterne hinsieht.'];
  let n = 0;
  return async guardId => {
    w.lockPlayer();
    w.bark(guardId, ['Halt! Wer da?', 'He! Stehen bleiben!'][n % 2], 1400);
    await w.wait(800);
    await ui().fade('out', 450);
    w.stealth.resetGuards();
    const sp = hausNacht.spawns[G.state.flag<string>(F.cp) ?? 'lia-tuer'] ?? hausNacht.spawns['lia-tuer'];
    w.player.teleport(sp.at, sp.dir);
    await w.camera.pan(sp.at, 0);
    w.camera.follow();
    if (pass.active) { pass.seen = false; pass.passed = false; }
    await w.wait(200);
    await ui().fade('in', 450);
    w.unlockPlayer();
    await w.think(lines[n++ % lines.length]);
  };
}

function onSpottedBack(w: WorldCtx, pass: PassState): (guardId: string) => Promise<void> {
  const caught = caughtHandler(w, pass);
  w.stealth.onSpotted(g => caught(g.id));
  return caught;
}

// ---------------------------------------------------------------------------------------------------------------
// Heart: listening at the study door
// ---------------------------------------------------------------------------------------------------------------

const atDoor = (w: WorldCtx) => pointInPoly(w.player.x, w.player.y, STUDY_LISTEN);
const guardFar = (w: WorldCtx) => Math.abs(w.actor(GUARD).x - OH_SPOT.alcoveFront[0]) > 220;

async function playSection(w: WorldCtx, lines: readonly Line[]): Promise<void> {
  await w.cutscene(async () => {
    w.player.face('up');
    for (const l of lines) {
      if (l.who === 'think') await w.think(l.text);
      else await w.say(l.who, l.text, l.mood ? { mood: l.mood } : undefined);
    }
  });
}

/** The corridor guard comes in through the east door, looks into the alcove and walks on west. */
async function guardPass(w: WorldCtx, pass: PassState, caught: (guardId: string) => Promise<void>): Promise<void> {
  const g = w.actor(GUARD);
  pass.active = true; pass.seen = false; pass.passed = false;
  w.stealth.resetGuards();
  sfx('door', { volume: 0.4, pitch: 0.9 });
  w.bark('player', 'Schritte! Da kommt wer.', 1600);
  w.setObjective('e3-fg-deckung', `Duck dich in den Schatten neben der Tür (${w.controlHint('sneak')}), bis die Wache vorbei ist.`, OH_SPOT.shadowLeft);
  let t = 0;
  while (w.alive && !pass.passed) {
    await w.wait(120);
    if (G.ui.busy()) continue;
    t += 0.12;
    if (Math.hypot(g.x - OH_SPOT.alcoveFront[0], g.y - OH_SPOT.alcoveFront[1]) < 14) {
      pass.seen = true;
      // The lantern shines straight into the alcove: only the shadows beside the door hide her.
      if (pointInPoly(w.player.x, w.player.y, ALCOVE) && !w.stealth.hidden) { await caught(GUARD); t = 0; continue; }
    }
    if ((pass.seen && g.x < 760) || t > 40) pass.passed = true;
  }
  pass.active = false;
  w.completeObjective('e3-fg-deckung');
}

async function listening(w: WorldCtx): Promise<void> {
  const pass: PassState = { seen: false, passed: false, active: false };
  const caught = onSpottedBack(w, pass);
  w.setObjective('e3-fg-lauschen', 'Lausche an der Tür des Arbeitszimmers. Bleib im Schatten, wenn die Wache kommt.', OH_SPOT.studyDoor);
  let waitBark = 0;
  for (let section = 0; section < STUDY_SECTIONS.length; section++) {
    let barked = false;
    await until(w, () => {
      if (G.ui.busy()) return false;
      const ok = canListen({ atDoor: atDoor(w), guardFar: guardFar(w), passedSinceLast: true, section });
      if (!ok && atDoor(w) && !barked && Date.now() - waitBark > 6000) {
        barked = true; waitBark = Date.now();
        w.bark('player', 'Erst muss die Laterne weg …', 1800);
      }
      return ok;
    }, 120);
    if (section === 0) {
      await w.cutscene(async () => {
        w.player.face('up');
        await w.think('Stimmen hinter der Tür. Ignatius. Und der Großmeister. Keiner von beiden klingt müde.');
      });
    }
    await playSection(w, STUDY_SECTIONS[section]);
    if (section < STUDY_SECTIONS.length - 1) {
      await guardPass(w, pass, caught);
      w.setObjective('e3-fg-lauschen', 'Zurück an die Tür. Lausche weiter.', OH_SPOT.studyDoor);
    }
  }
  w.completeObjective('e3-fg-lauschen');
  G.state.set(F.heard);
  G.state.addClue('e3-hinweis-gwynn');
  G.state.addLore('e3-lore-glaube');
  await w.cutscene(async () => {
    for (const t of AFTER_BARGAIN) await w.think(t);
  });
}

/** Ignatius comes out; Lia ducks into the shadow; he walks off through the east door past the guard. */
async function ignatiusLeaves(w: WorldCtx): Promise<void> {
  w.stealth.resetGuards();
  await w.cutscene(async () => {
    sfx('thud', { volume: 0.3, pitch: 0.8 });
    await w.think('Ein Stuhl scharrt. Er kommt raus!');
    await w.player.walkTo(OH_SPOT.shadowLeft[0], OH_SPOT.shadowLeft[1], { run: true, face: 'right' });
    bg(w.player.play('crouch' as never, { ms: 6000 }));
    sfx('door', { volume: 0.6 });
    const m = w.spawn({ id: MENTOR, preset: 'e2-ignatius', speaker: 'e2-ignatius', at: [OH_SPOT.studyDoor[0], OH_SPOT.studyDoor[1] - 14], dir: 'down', solid: false, facePlayer: false });
    m.hold(true);
    void w.lighting.get('oh-tuerspalt').fadeTo(0, 900);
    await m.walkTo(OH_SPOT.studyDoor[0] + 4, 318, { face: 'down' });
    await w.wait(700);
    w.bark(MENTOR, '… Gwynn.', 1600);
    await w.wait(1400);
    await w.think('Nicht atmen. Nicht atmen. Nicht …');
    await m.walkTo(1120, 420, { face: 'right' });
    w.bark(GUARD, 'Gute Nacht, Herr.', 1400);
    await m.walkTo(1180, 420);
    sfx('door', { volume: 0.4, pitch: 0.9 });
    w.despawn(MENTOR);
    await w.wait(500);
    w.player.setIdle('idle');
  });
  G.state.set(F.cp, 'alkoven');
  w.bark('player', 'Die Laterne kommt zurück. Ducken!', 2000);
}

async function returnToRoom(w: WorldCtx): Promise<void> {
  w.setObjective('e3-fg-zurueck', 'Zurück in dein Zimmer. Ungesehen.', 'zimmertuer');
  await until(w, () => G.state.is(F.home) && !G.ui.busy());
  w.completeObjective('e3-fg-zurueck');
  w.lockPlayer();
  w.stealth.enable(false);
  await w.changeMap(zimmerNacht, 'tuer');
  await w.cutscene(async () => {
    await w.player.walkTo(GZ_SPOT.bedSide[0], GZ_SPOT.bedSide[1], { face: 'left' });
    w.player.teleport(GZ_SPOT.bedSit, 'right');
    w.player.setIdle('sit');
    for (const t of BACK_IN_BED) await w.think(t);
  });
  w.lockPlayer();
  await ui().fade('out', 1600);
}

async function nachtScript(w: WorldCtx): Promise<void> {
  for (const f of [F.door, F.book, F.heard, F.home]) G.state.set(f, false);
  G.state.set(F.cp, 'lia-tuer');
  w.lockPlayer();
  await wakeAtNight(w);
  w.setObjective('e3-fg-raus', 'Geh leise hinaus auf den Gang.', 'tuer');
  w.unlockPlayer();
  await w.waitForInteract('tuer');
  w.completeObjective('e3-fg-raus');
  sfx('door', { volume: 0.3, pitch: 1.2 });
  await w.changeMap(hausNacht, 'lia-tuer');
  onSpottedBack(w, { seen: false, passed: false, active: false });
  await w.cutscene(async () => {
    await w.think('Der Gang ist dunkel. Nur ein paar Leuchter und irgendwo eine Laterne, die wandert.');
    await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt, um zu schleichen. Geduckt im Schatten sieht dich keine Wache.`);
  });
  w.setObjective('e3-fg-ignatius', 'Schleich zu Ignatius’ Tür gleich nebenan.', 'tuer-ignatius');
  await until(w, () => G.state.is(F.door) && !G.ui.busy());
  w.completeObjective('e3-fg-ignatius');
  if (!G.state.is(F.book)) {
    w.setObjective('e3-fg-buch', 'Oben in der Bibliothek brennt noch Licht. Sieh nach, ungesehen.', 'buch');
    await until(w, () => G.state.is(F.book) && !G.ui.busy());
    w.completeObjective('e3-fg-buch');
  }
  sfx('thud', { volume: 0.25, pitch: 0.7 });
  w.bark('player', 'Stimmen. Den Gang hinunter.', 1800);
  await w.think('Das ist Ignatius. Aus dem Arbeitszimmer. Und er klingt nicht, als ginge es um Faden und Nadeln.');
  await listening(w);
  await ignatiusLeaves(w);
  await returnToRoom(w);
  G.state.set('e3-gelauscht');
  await nextScene('e3-kyras-fluchtweg');
}

export const scene = e3Scene('e3-falscher-glaube', 'Falscher Glaube', async params => {
  await ui().fade('out', 0);
  if (params?.part === 'nacht' && G.state.is(F.seen)) {
    await startWorld({ map: zimmerNacht, spawn: 'bett', player: liaLook(), fadeIn: false, script: nachtScript });
    return;
  }
  await startWorld({ map: halleKugel, spawn: 'kugel', player: 'vamir', fadeIn: false, script: kugelScript });
});

// Scene „e2-zellengespraeche“ – Durch die Gitter (docs/teil-2/umsetzung.md §3, F2 30:17–32:10). Captivity interlude,
// framed „Unterdessen …“: the player is Flick, locked in the westernmost cell of the dungeon (e2-kerker). Elnon is
// beaten in the next cell while he provokes the wardens – shown through the bars (blows, blood, a lost tooth). A first whisper through the
// wall (both hurt, Kyra is with the Master). Heart: inside the cell Flick watches the wardens' routine through the
// bars (who carries the key bunch, when the other one dozes, that they only ever go up together) and, while nobody
// looks, opens her left shackle with the nail from the interrogation chair and leaves it on so that it still looks
// locked (tend gesture + a choice how to hide it). Then Elnon apologises for how he treated her origin; Flick decides
// how much she explains (no romance). Kyra is brought back hallucinating; Flick reaches through the wall with a few
// words. → e2-stabtraining.
import type { CharAnim } from '../../art/api';
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { bloodHit, bloodPool, preloadBlood } from '../common/blood';
import { KERKER_CELLS, KERKER_SPOT, kerkerBase, kerkerLights } from './gewoelbe';
import { restageGesture, type GesturePicture } from './gewoelbe-geste';
import { bg, e2Scene, interlude, sfx, ui, until, nextScene } from './shared';
import { OBSERVATIONS, observationAt, roundPhases, SHACKLE_OPTIONS, unwatched, type Observation, type RoutinePhase } from './zellengespraeche-routine';

const FLICK_CELL = KERKER_CELLS[0];
const ELNON_CELL = KERKER_CELLS[1];

/** Flags of this visit (reset when the scene starts; a reload restarts it from the beginning). */
const F = {
  free: 'e2-zg-frei',
  phase: 'e2-zg-phase',
  stop: 'e2-zg-routine-aus',
  shackle: 'e2-zg-schelle-offen',
  talked: 'e2-zg-versoehnt',
} as const;
const SEEN: Record<Observation, string> = {
  schluessel: 'e2-zg-sah-schluessel',
  doesen: 'e2-zg-sah-doesen',
  'zu-zweit': 'e2-zg-sah-zu-zweit',
};
/** Results other scenes may read (kept, not reset): how the shackle was hidden, how much Flick told Elnon. */
export const ZG_RESULT = { shackle: 'e2-zelle-schelle', told: 'e2-zelle-ehrlich', kyra: 'e2-zelle-kyra' } as const;

const KEY = 'waerter-schluessel';
const CLUB = 'waerter-knueppel';
const STAIRS_FOOT: [number, number] = [566, 176];
const STAIRS_TOP: [number, number] = [596, 150];
const CORNER: [number, number] = [78, 106];
/** Where Flick whispers through the wall, and the camera's close-up centre on both cells. */
const WHISPER: [number, number] = [162, 114];
const WALL_VIEW: [number, number] = [206, 104];

/** Close-up for the tend gesture: Flick in the dark corner of her cell, the nail glinting at the shackle. */
const PICK_PICTURE: GesturePicture = {
  background: 'e2-kerker', focus: [112, 100], zoom: 3, glint: [84, 96],
  figures: [
    { id: 'e2-flick-gefangen', pose: 'sit', at: [84, 110], facing: 'down' },
    { id: 'shadow-club', pose: 'idle', at: [140, 168], facing: 'left', dim: true },
  ],
};

export const zellenMap: MapDef = defineMap({
  ...kerkerBase({ corridor: false, cells: [0] }),
  id: 'e2-kerker-zellen',
  name: 'Die Kerker',
  interactables: [
    { id: 'gitter', verb: 'Durchs Gitter spähen', at: [FLICK_CELL.doorway[0], 130], radius: 22, once: false, when: () => G.state.is(F.free), onInteract: lookThroughBars },
    { id: 'ecke', verb: 'In die dunkle Ecke setzen', at: CORNER, radius: 18, once: false, when: () => G.state.is(F.free), onInteract: workShackle },
    { id: 'wand', verb: 'An die Wand klopfen', at: [166, 112], radius: 16, once: false, when: () => G.state.is(F.free), onInteract: knockWall },
  ],
  lights: [...kerkerLights(1), { id: 'zelle-elnon', at: [ELNON_CELL.inLeft[0] + 20, 96], kind: 'plain', color: 0xffb070, radius: 46, intensity: 0.35, always: true },
    { id: 'zelle-flick', at: [FLICK_CELL.inRight[0] - 30, 96], kind: 'plain', color: 0xffb070, radius: 50, intensity: 0.3, always: true }],
  time: 'night',
  ambience: ['room'],
  ambienceVolume: { room: 0.8 },
  music: 'dread',
  playerLight: 34,
  sneak: false,
  lookMode: false,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Objective
// ---------------------------------------------------------------------------------------------------------------

const seenCount = () => OBSERVATIONS.filter(o => G.state.is(SEEN[o])).length;
const phaseNow = (): RoutinePhase => {
  const p = G.state.flag<string>(F.phase);
  return p === 'treppe' || p === 'zu-zweit' ? p : 'runde';
};
const heartDone = () => seenCount() >= 3 && G.state.is(F.shackle);

/** Last objective text shown (runtime only, reset with the script): repeated phase changes only move the target. */
let shownObjective = '';

function updateObjective(w: WorldCtx): void {
  if (!G.state.is(F.free) || G.state.is(F.stop)) return;
  if (heartDone()) {
    if (shownObjective === 'elnon') return;
    shownObjective = 'elnon';
    w.completeObjective('e2-zg-wache');
    w.setObjective('e2-zg-elnon', 'Klopf an die Wand. Elnon ist noch wach.', 'wand');
    return;
  }
  const shackle = G.state.is(F.shackle);
  const text = `Beobachte die Wärter durchs Gitter (${seenCount()}/3)`
    + (shackle ? ' · Schelle gelöst' : ' · Lös die Schelle mit dem Nagel, wenn keiner herschaut') + '.';
  const target = !shackle && unwatched(phaseNow()) ? 'ecke' : seenCount() < 3 ? 'gitter' : 'ecke';
  if (text === shownObjective) { w.setObjectiveTarget(target); return; }
  shownObjective = text;
  w.setObjective('e2-zg-wache', text, target);
}

function setPhase(w: WorldCtx, phase: RoutinePhase): void {
  G.state.set(F.phase, phase);
  updateObjective(w);
}

// ---------------------------------------------------------------------------------------------------------------
// The wardens' routine
// ---------------------------------------------------------------------------------------------------------------

async function routine(w: WorldCtx): Promise<void> {
  const key = w.actor(KEY), club = w.actor(CLUB);
  const stopped = () => !w.alive || G.state.is(F.stop);
  for (let round = 0; !stopped(); round++) {
    for (const phase of roundPhases(round)) {
      if (stopped()) return;
      setPhase(w, phase);
      if (phase === 'runde') {
        club.setIdle('sit');
        for (const cell of KERKER_CELLS) {
          await key.walkTo(cell.front[0], cell.front[1] + 6, { straight: true });
          key.face('up');
          await w.wait(cell === FLICK_CELL ? 2200 : 900);
          if (stopped()) return;
        }
        await key.walkTo(STAIRS_FOOT[0], STAIRS_FOOT[1], { straight: true });
      } else if (phase === 'treppe') {
        key.face('up');
        await w.wait(700);
        if (w.alive) { club.bark('Chrrr …', 2200); bg(club.emote('…', 1600)); }
        await w.wait(5200);
      } else {
        for (let i = 0; i < 3; i++) { sfx('thud', { volume: 0.35 }); await w.wait(260); }
        key.bark('Essen! Komm, hilf tragen.', 1800);
        club.setIdle('idle');
        await club.walkTo(STAIRS_FOOT[0] - 18, STAIRS_FOOT[1] + 10, { straight: true });
        await Promise.all([
          key.walkTo(STAIRS_TOP[0], STAIRS_TOP[1], { straight: true }),
          club.walkTo(STAIRS_TOP[0] - 6, STAIRS_TOP[1] + 4, { straight: true }),
        ]);
        key.hide(); club.hide();
        await w.wait(6500);
        if (!w.alive) return;
        key.show(); club.show();
        sfx('door', { volume: 0.35 });
        await Promise.all([
          key.walkTo(STAIRS_FOOT[0], STAIRS_FOOT[1], { straight: true }),
          club.walkTo(KERKER_SPOT.guardSeat[0], KERKER_SPOT.guardSeat[1], { straight: true }).then(() => { club.face('right'); club.setIdle('sit'); }),
        ]);
      }
    }
    if (stopped()) return;
    setPhase(w, 'runde');
    await key.walkTo(KERKER_SPOT.guardTable[0], KERKER_SPOT.guardTable[1], { straight: true });
    key.face('right');
    await w.wait(1800);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Heart: watching through the bars, the nail, the shackle
// ---------------------------------------------------------------------------------------------------------------

const OBS_LINES: Record<Observation, string[]> = {
  schluessel: [
    'Der Bund hängt an seinem Gürtel, links, an einem Haken. Der mit dem Knüppel hat keinen. Nie.',
    'Sieben Bärte. Der blanke ist für die Zellen. Den hat er eben an Elnons Tür genommen.',
  ],
  doesen: [
    'Steht der mit dem Bund an der Treppe, sackt dem am Tisch das Kinn auf die Brust. Mund offen. Schnarcht wie ein Blasebalg.',
    'Dann schaut keiner in die Zellen. Gut zu wissen.',
  ],
  'zu-zweit': [
    'Klopfen von oben, und beide springen. Keiner bleibt unten. Allein traut sich hier keiner die Treppe hoch.',
    'Holen sie einen, kommen sie also zu zweit. Der mit dem Bund geht vorn und schließt. Der andere hält fest.',
  ],
};

async function lookThroughBars(w: WorldCtx): Promise<void> {
  const key = w.actor(KEY);
  const dist = key.exists ? Math.hypot(key.x - w.player.x, key.y - w.player.y) : 999;
  const obs = observationAt(phaseNow(), dist);
  w.player.face('down');
  if (!obs) {
    await w.think('Der mit dem Bund dreht seine Runde. Kommt er an meinem Gitter vorbei, seh ich genauer hin.');
    return;
  }
  if (G.state.is(SEEN[obs])) {
    await w.think(seenCount() < 3 ? 'Das hab ich schon. Was fehlt mir noch?' : 'Ich kenn ihre Runde jetzt besser als sie selbst.');
    return;
  }
  for (const line of OBS_LINES[obs]) await w.think(line);
  G.state.set(SEEN[obs]);
  updateObjective(w);
}

async function workShackle(w: WorldCtx): Promise<void> {
  if (G.state.is(F.shackle)) {
    await w.think('Die Schelle sitzt, wo sie hingehört. Nur nicht mehr fest. Das wissen bloß ich und das Stroh.');
    return;
  }
  if (!unwatched(phaseNow())) {
    const key = w.actor(KEY);
    if (key.exists) bg(key.emote('?', 900));
    await w.think('Nicht jetzt. Der mit dem Bund späht in jede Zelle, an der er vorbeikommt.');
    return;
  }
  w.player.teleport(CORNER, 'down');
  w.player.setIdle('sit');
  await w.think('Der Nagel aus dem Ärmelsaum, zwischen Daumen und Ringfinger der Rechten. Die zwei anderen Finger schreien bei jeder Bewegung.');
  await w.think('Die Spitze ins Schlüsselloch der linken Schelle. Ganz langsam. Und nicht auf den Verband bluten.');
  const gesture = G.ui.storyAction('tend', 'Das Schloss mit dem Nagel öffnen');
  restageGesture('tend', 'Schieb den Nagel ins Schloss und dreh ihn vor und zurück, bis der Riegel nachgibt. Leise.', PICK_PICTURE);
  await gesture;
  sfx('chain', { volume: 0.25, pitch: 1.3 });
  await w.think('Klack. Leiser als ein Fingerschnipsen. Die Schelle ist offen.');
  await w.think('Und jetzt muss sie zu aussehen. Sonst ist der ganze Nagel nichts wert.');
  const tried = new Set<number>();
  for (;;) {
    const pick = await w.choose(SHACKLE_OPTIONS.map((o, i) => ({ text: o.text, disabled: tried.has(i), reason: 'Lieber nicht.' })));
    const opt = SHACKLE_OPTIONS[pick];
    if (!opt.ok) {
      tried.add(pick);
      await w.think('Klick heißt zu. Dann sitz ich wieder da, wo ich angefangen hab. Nein, danke.');
      continue;
    }
    G.state.set(ZG_RESULT.shackle, opt.id);
    await w.think(opt.id === 'stroh'
      ? 'Bügel eingehängt, ein Halm in den Spalt. Von außen: zu. Von innen: ein Ruck, und die Hand ist frei.'
      : 'Ärmel drüber, Handgelenk still. Wer nicht anfasst, sieht nichts. Und anfassen mag mich hier keiner.');
    break;
  }
  sfx('rustle', { volume: 0.25 });
  w.player.setIdle('idle');
  G.state.set(F.shackle);
  updateObjective(w);
}

async function knockWall(w: WorldCtx): Promise<void> {
  if (!heartDone()) {
    await w.think(seenCount() < 3 || !G.state.is(F.shackle)
      ? 'Elnon atmet schwer da drüben. Gleich. Erst will ich wissen, wie die zwei hier unten ticken.'
      : 'Gleich.');
    return;
  }
  if (G.state.is(F.talked)) { await w.think('Er schläft. Oder tut so. Beides ist gut.'); return; }
  await reconcile(w);
}

// ---------------------------------------------------------------------------------------------------------------
// Story beats
// ---------------------------------------------------------------------------------------------------------------

/** One blow of the club warden on Elnon (in the picture): swing, impact, blood, Elnon reels. */
async function blow(w: WorldCtx, strength: number): Promise<void> {
  const club = w.actor(CLUB), elnon = w.actor('elnon');
  sfx('swing', { volume: 0.5 });
  bg(club.play('attack', { ms: 450 }));
  await w.wait(160);
  sfx(strength > 1 ? 'hit-heavy' : 'hit', { volume: 0.7 });
  bloodHit(w, [elnon.x, elnon.y - 22], strength);
  bg(elnon.play('hurt' as CharAnim, { ms: 700 }));
  sfx('chain', { volume: 0.5 });
  await w.wait(700);
}

async function beating(w: WorldCtx): Promise<void> {
  const key = w.actor(KEY), club = w.actor(CLUB), elnon = w.actor('elnon');
  await w.cutscene(async () => {
    await Promise.all([w.camera.zoom(1.6, 0), w.camera.pan([ELNON_CELL.inLeft[0] + 16, 100], 0)]);
    await ui().fade('in', 700);
    await club.walkTo(ELNON_CELL.inLeft[0] + 20, ELNON_CELL.inLeft[1] + 4, { straight: true });
    club.face('elnon');
    await blow(w, 0.8);
    await w.say('e2-waerterin', 'Na, Anführer? Immer noch so gesprächig?');
    await w.say('e2-elnon', 'Gesprächiger als ihr. Ihr zwei kennt zusammen ein Wort, und das ist aus Holz.', { mood: 'pained' });
    await blow(w, 1);
    w.player.bark('Hört auf!', 1400);
    elnon.setIdle('sit');
    w.fx.burst([elnon.x - 6, elnon.y - 10], 'blood', 5);
    await w.say('narrator', 'Elnon spuckt Blut auf das Stroh. Und einen Zahn.');
    await w.say('e2-waerter', 'Der hatte noch alle Zähne. Jetzt zähl ich einen weniger.');
    await w.say('e2-elnon', 'Du und zählen? Ich warte. Wie weit kommst du, bis drei?', { mood: 'pained' });
    await blow(w, 1.4);
    elnon.setIdle('lie');
    bloodPool(w, [elnon.x - 4, elnon.y - 2], { scale: 0.5, ms: 2500 });
    w.player.bark('Ihr Feiglinge! Zu zweit gegen einen in Ketten!', 2200);
    await w.say('e2-waerterin', 'Lass gut sein. Der Meister will morgen noch was von ihm, das reden kann.');
    await w.wait(500);
    elnon.setIdle('kneel');
    await Promise.all([
      key.walkTo(ELNON_CELL.doorway[0], ELNON_CELL.doorway[1], { straight: true }),
      club.walkTo(ELNON_CELL.doorway[0] + 16, ELNON_CELL.doorway[1] - 4, { straight: true }),
    ]);
    await Promise.all([
      key.walkTo(ELNON_CELL.front[0], ELNON_CELL.front[1] + 6, { straight: true }),
      club.walkTo(ELNON_CELL.front[0] + 26, ELNON_CELL.front[1] + 14, { straight: true }),
    ]);
    key.face('up');
    elnon.face('down');
    await w.say('e2-elnon', 'Kommt morgen wieder. Bringt einen Dritten mit. Vielleicht reicht’s dann.', { mood: 'hurt' });
    club.face('up');
    bg(club.emote('anger', 900));
    await w.say('e2-waerter', 'Lass mich noch mal rein. Nur ganz kurz.');
    await w.say('e2-waerterin', 'Morgen. Der läuft uns nicht weg. Der kann ja kaum knien.');
    sfx('door', { volume: 0.6 });
    await w.wait(200);
    sfx('chain', { volume: 0.4 });
    await Promise.all([
      club.walkTo(KERKER_SPOT.guardSeat[0], KERKER_SPOT.guardSeat[1], { straight: true }).then(() => { club.face('right'); club.setIdle('sit'); }),
      key.walkTo(KERKER_SPOT.guardTable[0], KERKER_SPOT.guardTable[1], { straight: true }).then(() => key.face('right')),
    ]);
    await w.camera.zoom(1, 500);
    w.camera.follow();
  });
}

/** Close-up on the wall between the two cells (the figures stand behind bars and are small at full view). */
async function closeUp(w: WorldCtx, on: boolean): Promise<void> {
  if (on) {
    await Promise.all([w.camera.zoom(1.8, 700), w.camera.pan(WALL_VIEW, 700)]);
  } else {
    await w.camera.zoom(1, 600);
    w.camera.follow();
  }
}

async function firstWhisper(w: WorldCtx): Promise<void> {
  const elnon = w.actor('elnon');
  await w.cutscene(async () => {
    await w.player.walkTo(WHISPER[0], WHISPER[1]);
    w.player.face('right');
    await closeUp(w, true);
    sfx('thud', { volume: 0.2 });
    await w.say('e2-flick', 'Elnon? Sag was Unfreundliches. Dann weiß ich, dass du’s noch bist.', { mood: 'scared' });
    elnon.face('left');
    await w.say('e2-elnon', 'Du flüsterst zu laut.', { mood: 'hurt' });
    await w.say('e2-flick', 'Da ist er ja.', { mood: 'smirk' });
    await w.say('e2-flick', 'Wie schlimm?', { mood: 'scared' });
    await w.say('e2-elnon', 'Rippen. Lippe. Ein Zahn weniger. Nichts, was mich umbringt. Und deine Hände?', { mood: 'pained' });
    await w.say('e2-flick', 'Rechts fehlen zwei Fingernägel. Baris hat sie mit einer Zange geholt. Ausgerechnet die Bogenfinger.', { mood: 'pained' });
    await w.say('e2-elnon', 'Die wachsen nach. Halt die Hand hoch, damit sie weniger pocht. Und wickel sie nicht auf.', { mood: 'grim' });
    await w.say('e2-flick', 'Spiel ich eben eine Weile keine Laute. Konnte ich vorher auch nicht.', { mood: 'smirk' });
    await w.say('e2-flick', 'Und Kyra? Sie war nicht da, als die mich runtergebracht haben.', { mood: 'scared' });
    await w.say('e2-elnon', 'Oben. Bei ihm. Seit dem Abend. Ich hab gehört, wie sie die Treppe hoch geschimpft hat.', { mood: 'grim' });
    await w.say('e2-flick', 'Wenn er ihr was tut, dann …', { mood: 'angry' });
    await w.say('e2-elnon', 'Dann merken wir’s uns. Mehr können wir gerade nicht.', { mood: 'grim' });
    await w.think('Merken reicht mir nicht. Ich will hier raus. Und dafür muss ich erst wissen, wie die zwei Kerle ticken.');
    await closeUp(w, false);
  });
}

async function reconcile(w: WorldCtx): Promise<void> {
  const elnon = w.actor('elnon');
  G.state.set(F.stop);
  w.completeObjective('e2-zg-elnon');
  await w.cutscene(async () => {
    await w.player.walkTo(WHISPER[0], WHISPER[1]);
    w.player.face('right');
    await closeUp(w, true);
    sfx('thud', { volume: 0.2 });
    await w.wait(300);
    elnon.face('left');
    await w.say('e2-elnon', 'Flick. Bevor morgen wieder einer die Tür aufschließt.', { mood: 'grim' });
    await w.say('e2-elnon', 'Ich hab dich vor allen eine Lügnerin genannt. Und dabei mehr über deine Ohren geredet als über die Lüge.', { mood: 'ashamed' });
    await w.say('e2-elnon', 'Das war unrecht. Es tut mir leid.', { mood: 'ashamed' });
    await w.think('Elnon. Entschuldigt sich. In einem Kerker. Hätt ich gewusst, dass es dafür nur Ketten braucht …');
    const pick = await w.choose([
      '„Schon gut. Ich hab gelogen, du hast gebrüllt. Quitt.“',
      '„Ich hatte Angst, dass ihr mich wegschickt. Wie alle vorher.“',
      '„Ich wollte einmal irgendwo ganz dazugehören. Nicht nur zur Hälfte.“',
    ]);
    G.state.set(ZG_RESULT.told, ['wenig', 'angst', 'ganz'][pick]);
    if (pick === 0) {
      await w.say('e2-flick', 'Schon gut. Ich hab gelogen, du hast gebrüllt. Quitt.', { mood: 'smirk' });
      await w.say('e2-elnon', 'Nicht ganz. Du hast eine Hälfte verschwiegen. Ich hab dir die andere nicht mehr geglaubt.', { mood: 'grim' });
      await w.say('e2-flick', 'Na gut. Dann eben fast quitt.', { mood: 'sad' });
    } else if (pick === 1) {
      await w.say('e2-flick', 'In Trapas haben sie mich wegen der Ohren weggeschickt. Bei den Elfen wegen der anderen Hälfte.', { mood: 'sad' });
      await w.say('e2-flick', 'Bei euch wollte ich’s einmal anders. Also hab ich die Hälfte erzählt, die keiner wegschickt.', { mood: 'sad' });
      await w.say('e2-elnon', 'Und wir haben dich trotzdem weggeschickt. Nur ein bisschen später.', { mood: 'ashamed' });
    } else {
      await w.say('e2-flick', 'Beim Eid hab ich die Hälfte gesagt, die ihr hören wolltet. Die andere hab ich runtergeschluckt.', { mood: 'sad' });
      await w.say('e2-flick', 'Liegt mir heute noch im Magen. Wie ein Stein, den man aus Versehen mitgegessen hat.', { mood: 'sad' });
      await w.say('e2-elnon', 'Dann spuck ihn aus, wenn wir hier raus sind. Ich hör zu. Diesmal ganz.', { mood: 'determined' });
    }
    await w.say('e2-elnon', 'Wenn wir hier rauskommen, schwörst du noch mal. Vor allen. Ganz.', { mood: 'determined' });
    await w.say('e2-flick', 'Abgemacht. Aber das Wort von damals, das lässt du hier unten. Bei den Ratten.', { mood: 'determined' });
    await w.say('e2-elnon', 'Die können’s behalten.');
    await w.think('Komisch. Mir ist leichter. Und das in einem Loch, in dem man nicht mal aufrecht sitzen will.');
    await closeUp(w, false);
  });
  G.state.set(F.talked);
}

async function kyraReturns(w: WorldCtx, loop: Promise<void>): Promise<void> {
  const key = w.actor(KEY), club = w.actor(CLUB), elnon = w.actor('elnon');
  await w.cutscene(async () => {
    await loop;
    key.hide(); club.hide();
    key.teleport(STAIRS_TOP, 'down'); club.teleport([STAIRS_TOP[0] - 8, STAIRS_TOP[1] + 4], 'down');
    club.setIdle('idle');
    const kyra = w.spawn({ id: 'kyra', preset: 'kyra-bound', speaker: 'e2-kyra-bound', at: [STAIRS_TOP[0] - 4, STAIRS_TOP[1] + 2], dir: 'down', solid: false, hidden: true, speed: 26 });
    kyra.hold(true);
    await w.wait(600);
    sfx('door', { volume: 0.6 });
    await w.think('Die Tür oben. Schritte. Drei Paar. Eins davon schleift.');
    key.show(); club.show(); kyra.show();
    await Promise.all([
      key.walkTo(ELNON_CELL.front[0] - 4, ELNON_CELL.front[1] + 6, { straight: true }),
      kyra.walkTo(ELNON_CELL.front[0] + 18, ELNON_CELL.front[1] + 16, { straight: true }),
      club.walkTo(ELNON_CELL.front[0] + 40, ELNON_CELL.front[1] + 20, { straight: true }),
    ]);
    key.face('up');
    sfx('door', { volume: 0.5 });
    await w.say('e2-waerterin', 'Hier, Anführer. Pass auf dein Mädchen auf. Sie redet mit den Wänden.');
    await kyra.walkTo(ELNON_CELL.doorway[0], ELNON_CELL.doorway[1], { straight: true });
    await kyra.walkTo(ELNON_CELL.inRight[0], ELNON_CELL.inRight[1], { straight: true });
    kyra.setIdle('kneel');
    sfx('door', { volume: 0.6 });
    sfx('chain', { volume: 0.4 });
    await Promise.all([
      key.walkTo(KERKER_SPOT.guardTable[0], KERKER_SPOT.guardTable[1], { straight: true }).then(() => key.face('right')),
      club.walkTo(KERKER_SPOT.guardSeat[0], KERKER_SPOT.guardSeat[1], { straight: true }).then(() => { club.face('right'); club.setIdle('sit'); }),
    ]);
    elnon.setIdle('idle');
    await elnon.walkTo(ELNON_CELL.inRight[0] - 22, ELNON_CELL.inRight[1], { straight: true });
    elnon.face('right');
    elnon.setIdle('kneel');
    await Promise.all([w.camera.zoom(1.7, 900), w.camera.pan([ELNON_CELL.inRight[0] - 40, 104], 900)]);
    await w.say('e2-kyra-bound', 'Nicht so hell. Mach, dass es nicht so lila ist. Bitte.', { mood: 'scared' });
    await w.say('e2-elnon', 'Kyra. Es ist dunkel hier. Nur eine Fackel.', { mood: 'grim' });
    await w.say('e2-kyra-bound', 'Da sitzt einer in der Wand. Der redet mit meiner Stimme. Hörst du den nicht?', { mood: 'scared' });
    await w.say('e2-kyra-bound', 'Mutter? Ich hab die Hühner zugemacht. Ehrlich. Alle.', { mood: 'sad' });
    await w.say('e2-elnon', 'Sie sieht Dinge, die nicht hier sind. Er war lange in ihrem Kopf.', { mood: 'pained' });
    await w.say('e2-flick', 'Dieser … Der soll mal in meinen Kopf kommen. Da stolpert er über jede Wurzel.', { mood: 'angry' });
    const pick = await w.choose([
      '„Kyra, hier ist Flick. Weißt du noch, wie Lia den Riesen ins Kornfeld gepustet hat?“',
      '(Leise summen. Irgendwas, das nach Lagerfeuer klingt.)',
      '„Kyra. Wehr dich weiter. Noch fester. Ich halt dir den Platz an der Tür frei.“',
    ]);
    G.state.set(ZG_RESULT.kyra, ['kornfeld', 'summen', 'wehren'][pick]);
    if (pick === 0) {
      await w.say('e2-flick', 'Kyra, hier ist Flick. Weißt du noch, wie Lia den Riesen ins Kornfeld gepustet hat? Mit Rüstung und allem?', { mood: 'smirk' });
      await w.say('e2-kyra-bound', 'Der Riese … ist geflogen. Wie ein Sack Rüben. Das war schön.', { mood: 'sad' });
    } else if (pick === 1) {
      await w.say('narrator', 'Flick summt. Schief, leise, ohne Worte. Drüben wird Kyras Atem langsamer.');
      await w.say('e2-kyra-bound', 'Das klingt … wie Feuer. Warm.', { mood: 'sad' });
    } else {
      await w.say('e2-flick', 'Kyra. Wehr dich weiter. Noch fester. Ich halt dir den Platz an der Tür frei.', { mood: 'determined' });
      await w.say('e2-kyra-bound', 'Fester. Ja. Mach ich. Gleich morgen.', { mood: 'determined' });
    }
    kyra.setIdle('lie');
    await w.wait(600);
    await w.say('e2-elnon', 'Sie schläft. Mehr können wir für sie nicht tun. Nur da sein.', { mood: 'grim' });
    await w.say('e2-flick', 'Doch. Eins noch.', { mood: 'determined' });
    await closeUp(w, false);
    w.player.face('down');
    await w.think('Holen sie mich, kommen sie zu zweit. Der mit dem Bund geht vorn. Und meine linke Hand ist nicht mehr da, wo sie glauben.');
    await ui().fade('out', 1400);
  });
}

// ---------------------------------------------------------------------------------------------------------------

async function zellenScript(w: WorldCtx): Promise<void> {
  for (const f of [...Object.values(F), ...Object.values(SEEN)]) G.state.set(f, false);
  for (const f of Object.values(ZG_RESULT)) G.state.set(f, false);
  shownObjective = '';
  preloadBlood(w);
  const elnon = w.spawn({ id: 'elnon', preset: 'e2-elnon-gefangen', speaker: 'e2-elnon', at: ELNON_CELL.inLeft, dir: 'down', idle: 'kneel', solid: false, facePlayer: false, speed: 24 });
  const key = w.spawn({ id: KEY, preset: 'shadow-sword', speaker: 'e2-waerterin', at: [ELNON_CELL.inLeft[0] + 30, ELNON_CELL.inLeft[1] + 2], dir: 'left', solid: false, speed: 36 });
  const club = w.spawn({ id: CLUB, preset: 'shadow-club', speaker: 'e2-waerter', at: [ELNON_CELL.inRight[0], ELNON_CELL.inRight[1]], dir: 'left', solid: false, speed: 36 });
  for (const a of [elnon, key, club]) a.hold(true);
  w.player.face('right');
  await beating(w);
  await firstWhisper(w);
  G.state.set(F.free);
  G.state.set(F.phase, 'runde');
  const loop = routine(w).catch(() => { /* scene ended */ });
  updateObjective(w);
  await until(w, () => G.state.is(F.talked));
  await kyraReturns(w, loop);
  G.state.set('e2-versoehnt');
  await nextScene('e2-stabtraining');
}

export const scene = e2Scene('e2-zellengespraeche', 'Durch die Gitter', async () => {
  await interlude('Unterdessen, in den Kerkern unter der Halle des Meisters …');
  await startWorld({ map: zellenMap, spawn: 'zelle-1', player: 'e2-flick-gefangen', companions: [], fadeIn: false, script: zellenScript });
});

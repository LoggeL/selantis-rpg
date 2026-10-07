// Scene „e2-flicks-verhoer“ – Standhaft (docs/teil-2/umsetzung.md §3, F2 19:07–20:41). Captivity interlude: Flick
// tied to the interrogation chair (pose sit-chair) in the Master's hall. Heart: while the Master talks she secretly
// works a loose nail out of the armrest – but only while nobody looks. The Master and Baris turn away in short
// windows (a report at the arch, the high chair, the tool box on the table); trying while watched only earns a
// suspicious look and a retry. Two windows: wiggle, then the reach gesture pulls it out (flag e2-flick-nagel, later
// used to open a shackle). Answers are defiant choices; the threat against her ears stays a threat. The fingers are
// shown (no cut away, no minigame): close on the chair, Baris kneels with the pliers from the box and tears out the
// nails of her right index and middle finger (her bow fingers) while the Master asks; screams, blood on the armrest and
// the floor. Her left fist with the nail stays closed. Later Flick scenes keep the bandaged hand. → e2-konzentration.
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { bloodHit, bloodPool, preloadBlood } from '../common/blood';
import { HALLE_SPOT, HALLE_TABLE, halleBase, halleBrazierLights, pinArea, pinPlayer } from './gewoelbe';
import { restageGesture, type GesturePicture } from './gewoelbe-geste';
import { bg, e2Scene, interlude, master, sfx, ui, until, VIOLET, nextScene } from './shared';

/** Flags of this visit (reset when the scene starts; a reload restarts the interrogation). */
const F = { unwatched: 'e2-verhoer-unbeobachtet', stage: 'e2-verhoer-nagel-stufe', busy: 'e2-verhoer-nagel-busy', near: 'e2-verhoer-beinahe' } as const;

const NAIL: [number, number] = [464, 170];

/** Close-up for the reach gesture: Flick on the chair, the Master turned away at the edge, the nail head glinting. */
const NAIL_PICTURE: GesturePicture = {
  background: 'e2-halle', focus: [452, 160], zoom: 3, glint: [458, 158],
  figures: [
    { id: 'e2-flick-gefangen', pose: 'sit-chair', at: HALLE_SPOT.chair, facing: 'left' },
    { id: 'vamir', pose: 'idle', at: [366, 176], facing: 'left', dim: true },
  ],
};

export const verhoerMap: MapDef = defineMap({
  ...halleBase,
  id: 'e2-halle-verhoer',
  name: 'Die Halle des Meisters',
  walk: [pinArea(HALLE_SPOT.chair)],
  block: [{ id: 'tisch', poly: HALLE_TABLE }],
  spawns: { stuhl: { at: HALLE_SPOT.chair, dir: 'left' } },
  interactables: [
    { id: 'nagel', verb: 'Den Nagel lockern', at: NAIL, radius: 26, once: false, sparkle: true, onInteract: workNail },
  ],
  lights: halleBrazierLights(0.85),
  time: 'night',
  ambience: ['room', 'fire'],
  ambienceVolume: { room: 0.7, fire: 0.45 },
  music: 'dread',
  playerLight: 30,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// The nail: only while nobody watches
// ---------------------------------------------------------------------------------------------------------------

async function workNail(w: WorldCtx): Promise<void> {
  const stage = Number(G.state.flag(F.stage) ?? 0);
  if (stage >= 2) { await w.think('Der Nagel steckt im Saum meines Ärmels. Faust zu. Nicht hinsehen.'); return; }
  if (!G.state.is(F.unwatched)) {
    const baris = w.actor('baris');
    const n = G.state.inc(F.near);
    bg(baris.emote('?', 900));
    baris.face('player');
    await w.say('e2-baris', n > 1 ? 'Ich hab gesagt: Hände auf die Lehne. Ich sag’s nicht dreimal.' : 'Was zappelst du da?', { mood: 'pained' });
    await w.think(n > 1 ? 'Er sieht her. Warten. Er kann nicht ewig herstarren.' : 'Zu früh. Solange einer herschaut, bin ich ein braves Mädchen auf einem Stuhl.');
    return;
  }
  G.state.set(F.busy, true);
  try {
    if (stage === 0) {
      sfx('rustle', { volume: 0.4 });
      await w.wait(300);
      sfx('chain', { volume: 0.25 });
      await w.think('Fingerspitzen unter die Lehne. Da. Ein Nagelkopf, rostig, das Holz drumherum weich vom Alter.');
      await w.think('Hin und her. Hin und her. Er gibt nach, ein Haar breit. Beim nächsten Mal krieg ich ihn.');
      G.state.set(F.stage, 1);
      w.setObjective('e2-verhoer-nagel', 'Lockere den Nagel, sobald wieder keiner hinsieht (1/2).', 'nagel');
      return;
    }
    const gesture = G.ui.storyAction('reach', 'Den losen Nagel lockern');
    restageGesture('reach', 'Tast unter der Armlehne nach dem Nagelkopf und biege ihn hin und her, bis er nachgibt.', NAIL_PICTURE);
    await gesture;
    sfx('chain', { volume: 0.3 });
    await w.think('Raus. Fingerlang, krumm, rostig. Das Schönste, was ich seit Tagen in der Hand hatte.');
    await w.think('Ab in den Saum vom Ärmel. Faust zu. Und Gesicht wie beim Kartenspiel.');
    G.state.set(F.stage, 2);
    w.completeObjective('e2-verhoer-nagel');
  } finally {
    G.state.set(F.busy, false);
  }
}

/**
 * One window in which nobody watches Flick. `away` turns the watchers (with their own lines); afterwards they turn
 * back. Resolves when the window closed; the caller repeats until the stage advanced.
 */
async function window(w: WorldCtx, away: () => Promise<void>, back: () => Promise<void>, ms = 8000): Promise<void> {
  const before = Number(G.state.flag(F.stage) ?? 0);
  await away();
  G.state.set(F.unwatched, true);
  w.player.bark('Jetzt …', 1400);
  sfx('heartbeat', { volume: 0.35 });
  const t0 = performance.now();
  await until(w, () => Number(G.state.flag(F.stage) ?? 0) !== before || (performance.now() - t0 > ms && !G.state.is(F.busy)), 150);
  G.state.set(F.unwatched, false);
  await back();
}

// ---------------------------------------------------------------------------------------------------------------
// The interrogation
// ---------------------------------------------------------------------------------------------------------------

async function opening(w: WorldCtx): Promise<void> {
  const vamir = w.actor('meister');
  await w.cutscene(async () => {
    await w.wait(600);
    await w.think('Stricke um die Handgelenke, festgezurrt an den Armlehnen. Wer den Stuhl gebaut hat, hat an alles gedacht. Fast.');
    vamir.face('player');
    await w.say(master(), 'Sitzt du bequem? Der Stuhl hat schon Grafen getragen. Und einen Zwerg, der am Ende sehr gesprächig war.');
    await w.say('e2-flick', 'Der Zwerg tut mir leid. Der Stuhl nicht.', { mood: 'smirk' });
    await w.say(master(), 'Ich will nur eines wissen. Wohin läuft dein Mädchen mit dem Licht?');
    const pick = await w.choose([
      '„Nach Süden. Oder Norden. Links und rechts hab ich ihr nie beigebracht.“',
      '„Wenn ich das wüsste, säß ich bei ihr. Und nicht bei dir.“',
      '(In seine Kapuze starren.) „Hast du da drin überhaupt ein Gesicht?“',
    ]);
    if (pick === 0) {
      await w.say('e2-flick', 'Nach Süden. Oder Norden. Links und rechts hab ich ihr nie beigebracht.', { mood: 'smirk' });
      await w.say(master(), 'Witzig. Witz hält bei mir ungefähr bis zum Abend.');
    } else if (pick === 1) {
      await w.say('e2-flick', 'Wenn ich das wüsste, säß ich bei ihr. Und nicht bei dir.', { mood: 'determined' });
      await w.say(master(), 'Vielleicht sogar ehrlich. Das ändert nichts. Du weißt mehr, als du glaubst. Alle wissen mehr.');
    } else {
      await w.say('e2-flick', 'Hast du da drin überhaupt ein Gesicht? Oder nur Rauch und schlechte Laune?', { mood: 'smirk' });
      await w.say(master(), 'Eins, das du nicht sehen wirst. Noch nicht. Sei der Kapuze dankbar.');
    }
    await w.say('e2-baris', 'Soll ich ihr die Zunge lockern, Meister?', { mood: 'pained' });
    await w.say(master(), 'Geduld, Baris. Ich mag es, wenn sie noch ein Weilchen hoffen. Das macht das Ende so deutlich.');
  });
}

async function middle(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    await w.say(master(), 'Dein Anführer unten war auch sehr tapfer. Eine ganze Stunde lang.');
    await w.say('e2-flick', 'Elnon ist stur wie ein Ochse. Das ist keine Tapferkeit, das ist Veranlagung.', { mood: 'angry' });
    await w.say(master(), 'Bei dir reicht vermutlich weniger. Wie viel Elfe steckt wohl in so einem halben Ohr?');
    await w.say(master(), 'Baris könnte es herausfinden. Er hat ein Messer und sehr viel Zeit.');
    await w.think('Er droht. Drohen ist Reden. Solange er redet, schneidet keiner.');
    const pick = await w.choose([
      '„Dann hör ich dich nur noch halb so gut. Klingt nach einem guten Geschäft.“',
      '„Die Elfen wollten mich nicht, die Menschen auch nicht. Stell dich hinten an.“',
      '(Schweigen. Bloß nicht auf die Armlehne sehen.)',
    ]);
    if (pick === 0) {
      await w.say('e2-flick', 'Dann hör ich dich nur noch halb so gut. Klingt nach einem guten Geschäft.', { mood: 'smirk' });
      await w.say(master(), 'Sie lacht noch. Baris, merk dir, wo sie lacht. Da fangen wir später an.');
    } else if (pick === 1) {
      await w.say('e2-flick', 'Die Elfen wollten mich nicht, die Menschen auch nicht. Stell dich hinten an. Die Schlange ist lang.', { mood: 'angry' });
      await w.say(master(), 'Dann will dich ja niemand zurück. Wie praktisch für mich.');
    } else {
      await w.wait(1000);
      await w.say(master(), 'Schweigen. Das Lieblingsspiel der Gefangenen. Ich habe es öfter gewonnen als jeder von ihnen.');
    }
  });
}

/** Flick's right hand on the armrest (map px, chest height of the seated figure). */
const HAND: [number, number] = [HALLE_SPOT.chair[0] - 6, HALLE_SPOT.chair[1] - 14];

/** One nail torn out with the pliers: the grip, the pull, the scream, the blood. */
async function tear(w: WorldCtx, strength: number, scream: string): Promise<void> {
  sfx('block', { volume: 0.45, pitch: 1.5 });
  w.player.bark('Nein …', 900);
  await w.wait(900);
  sfx('hit-heavy', { volume: 0.6, pitch: 1.4 });
  sfx('chain', { volume: 0.8, pitch: 1.2 });
  bloodHit(w, HAND, strength);
  w.camera.punch(0.06 * strength);
  w.player.bark(scream, 1800);
  await w.wait(1400);
}

async function fingers(w: WorldCtx): Promise<void> {
  const vamir = w.actor('meister'), baris = w.actor('baris');
  await w.cutscene(async () => {
    vamir.face('player');
    await w.say(master(), 'Baris. Ist das die Schützin, die dir den halben Trupp durch den Wald gejagt hat?');
    await w.say('e2-baris', 'Sie hatte einen Bogen, Meister. Jetzt hat sie keinen.', { mood: 'pained' });
    await w.say(master(), 'Dann fang bei den Fingern an, mit denen sie die Sehne zieht. Die rechte Hand. Langsam, damit sie zwischendurch nachdenken kann.');
    const pick = await w.choose([
      '„Ich hab schon Wölfen ins Maul geguckt, Kapuze. Die hatten bessere Zähne als dein verbrannter Hund.“',
      '„Zähl gut mit, Baris. Bis zehn kommst du doch noch, oder?“',
    ]);
    if (pick === 0) await w.say('e2-flick', 'Ich hab schon Wölfen ins Maul geguckt, Kapuze. Die hatten bessere Zähne als dein verbrannter Hund.', { mood: 'angry' });
    else await w.say('e2-flick', 'Zähl gut mit, Baris. Bis zehn kommst du doch noch, oder? Notfalls nimm die Zehen dazu.', { mood: 'smirk' });
    await w.say('e2-baris', 'Gleich lachst du anders, Spitzohr.', { mood: 'pained' });
    await w.think('Faust zu. Die linke. Was in meinem Ärmel steckt, gehört mir. Das kriegen sie nicht. Das und Lia nicht.');

    // Staging: close on the chair. Baris kneels beside it with the pliers from the box, the Master watches.
    G.audio.duck(-10, 30000);
    await Promise.all([w.camera.pan([HALLE_SPOT.chair[0] - 14, HALLE_SPOT.chair[1] - 10], 900), w.camera.zoom(2, 900)]);
    await baris.walkTo(HALLE_SPOT.chair[0] - 22, HALLE_SPOT.chair[1] + 6, { straight: true });
    baris.face('player');
    baris.setIdle('kneel');
    sfx('chain', { volume: 0.6 });
    await w.think('Er drückt meine rechte Hand flach auf die Lehne. Die Zange ist klein und schwarz. Kleiner, als ich dachte.');
    await w.say(master(), 'Eine Frage, eine Antwort. Wohin läuft das Mädchen mit dem Licht?');
    const first = await w.choose([
      '„Zu ihren Schweinen. Die sind netter als du.“',
      '(Schweigen. Auf die Zange starren.)',
      '„Fahr zur Hölle. Nimm Baris mit.“',
    ]);
    if (first === 0) await w.say('e2-flick', 'Zu ihren Schweinen. Die sind netter als du. Und riechen besser.', { mood: 'angry' });
    else if (first === 1) await w.wait(1200);
    else await w.say('e2-flick', 'Fahr zur Hölle. Und nimm Baris mit, der kennt da sicher jemanden.', { mood: 'angry' });
    await w.say(master(), 'Baris.');
    await tear(w, 1, 'AAAAH!');
    await w.say('e2-flick', 'AAH – du … du dreckiger … verbrannter …', { mood: 'pained' });
    await w.think('Der Fingernagel vom Zeigefinger. Einfach weg. Wo er war, ist nur noch rot. Und heiß. So heiß.');
    await w.say('e2-baris', 'Einer. Du wolltest doch, dass ich zähle.', { mood: 'pained' });
    await w.say(master(), 'Wohin, Flick?');
    await w.say('e2-flick', 'Nach … Süden. Oder Norden. Hab ich … doch gesagt.', { mood: 'pained' });
    await w.say(master(), 'Den nächsten.');
    await tear(w, 1.3, 'NEIN – AAAAAH!');
    bloodPool(w, [HAND[0] + 2, HALLE_SPOT.chair[1] + 4], { id: 'verhoer-blut', scale: 0.45, ms: 4000 });
    await w.say('narrator', 'Blut läuft über die Armlehne und tropft auf den Stein. Flick zerrt an den Stricken, bis der Stuhl knarrt. Er gibt nicht nach.');
    await w.think('Nicht die linke aufmachen. Egal was. Die linke bleibt zu.');
    await w.say('e2-flick', 'Nimm … ruhig alle zehn. Ich hab … noch Zehen.', { mood: 'pained' });
    await w.say(master(), 'Genug für heute. Morgen fangen wir mit der anderen Hand an. Dann hat sie die ganze Nacht, darüber nachzudenken.');
    baris.setIdle('idle');
    sfx('rustle', { volume: 0.4 });
    await w.say('narrator', 'Baris wischt die Zange an seiner Hose ab und wirft zwei blutige Fingernägel in die Glut des Beckens.');
    sfx('fire-ignite', { volume: 0.3, pitch: 1.4 });
    await w.wait(600);
    await G.ui.fade('out', 900);
    await w.wait(500);
  });
  await G.ui.narrate(['Flick sagte an diesem Abend viele Dinge. Keines davon war ein Ort.', 'Und ihre linke Faust blieb die ganze Zeit geschlossen.'], { style: 'card' });
}

async function verhoerScript(w: WorldCtx): Promise<void> {
  for (const f of [F.unwatched, F.busy]) G.state.set(f, false);
  G.state.set(F.stage, 0);
  G.state.set(F.near, 0);
  preloadBlood(w);
  const vamir = w.spawn({ id: 'meister', preset: 'vamir', speaker: master(), at: HALLE_SPOT.chairFront, dir: 'right', solid: false, speed: 30 });
  const baris = w.spawn({ id: 'baris', preset: 'baris-scarred', speaker: 'e2-baris', at: HALLE_SPOT.chairGuard, dir: 'up', solid: false, speed: 40 });
  const door = w.spawn({
    id: 'waerter', preset: 'shadow-club', speaker: 'e2-waerter', at: HALLE_SPOT.guardCells, dir: 'up', solid: false,
    barks: ['(gähnt)', 'Wie lang noch …', 'Mir ist kalt.'], barkEvery: 11000,
  });
  const runner = w.spawn({ id: 'bote', preset: 'shadow-spear', speaker: 'e2-waerter', at: [320, 304], dir: 'up', solid: false, hidden: true, speed: 50 });
  for (const a of [vamir, baris, door, runner]) a.hold(true);
  const glow = w.lighting.add({ id: 'e2-meister', at: [HALLE_SPOT.chairFront[0], HALLE_SPOT.chairFront[1] - 30], kind: 'plain', color: VIOLET, radius: 50, intensity: 0.45, always: true });
  pinPlayer(w, 'sit-chair', 'left');
  baris.face('player');
  await ui().fade('in', 900);

  await opening(w);

  // Window 1: a runner calls Baris to the arch; the Master climbs to the high chair and turns his back.
  w.setObjective('e2-verhoer-nagel', 'Lockere den Nagel in der Armlehne, aber nur, wenn keiner hinsieht (0/2).', 'nagel');
  const toArch = async () => {
    runner.show();
    await runner.walkTo(320, 250, { straight: true });
    runner.bark('Hauptmann! Die Pferde, Ihr wolltet sie sehen.', 2600);
    await w.wait(300);
    bg(baris.walkTo(330, 236, { straight: true }).then(() => baris.face('down')));
    glow.set({ intensity: 0 });
    bg(vamir.walkPath([[392, 150], [320, 110], [320, 84]], { straight: true }).then(() => vamir.face('up')));
    await w.wait(1500);
  };
  const fromArch = async () => {
    bg(runner.walkTo(320, 304, { straight: true }).then(() => runner.hide()));
    bg(baris.walkTo(HALLE_SPOT.chairGuard[0], HALLE_SPOT.chairGuard[1], { straight: true }).then(() => baris.face('player')));
    await vamir.walkPath([[320, 110], [392, 150], [HALLE_SPOT.chairFront[0], HALLE_SPOT.chairFront[1]]], { straight: true });
    vamir.face('player');
    glow.set({ intensity: 0.45 });
  };
  for (let tries = 0; Number(G.state.flag(F.stage) ?? 0) < 1; tries++) {
    if (tries > 0) await w.say(master(), tries > 1 ? 'Baris, deine Pferde haben wohl mehr Fragen als ich.' : 'Wo waren wir? Ach ja. Bei deinem Schweigen.');
    await window(w, toArch, fromArch);
  }

  await middle(w);

  // Window 2: the Master sends Baris to the table for the box and watches him do it.
  w.setObjective('e2-verhoer-nagel', 'Zieh den Nagel heraus, sobald wieder keiner hinsieht (1/2).', 'nagel');
  const toTable = async () => {
    await w.say(master(), 'Baris, das Kästchen vom Tisch. Das mit den kleinen Zangen. Nein, das andere.');
    bg(baris.walkTo(HALLE_SPOT.tableHead[0], HALLE_SPOT.tableHead[1], { straight: true }).then(() => baris.face('left')));
    await vamir.walkTo(360, 176, { straight: true });
    vamir.face('left');
    glow.set({ intensity: 0 });
    await w.wait(600);
    vamir.bark('Sechzehn Jahre. Nie das Richtige.', 2600);
  };
  const fromTable = async () => {
    bg(baris.walkTo(HALLE_SPOT.chairGuard[0], HALLE_SPOT.chairGuard[1], { straight: true }).then(() => baris.face('player')));
    await vamir.walkTo(HALLE_SPOT.chairFront[0], HALLE_SPOT.chairFront[1], { straight: true });
    vamir.face('player');
    glow.set({ intensity: 0.45 });
  };
  for (let tries = 0; Number(G.state.flag(F.stage) ?? 0) < 2; tries++) {
    if (tries > 0) await w.say(master(), 'Falsches Kästchen. Noch einmal, Baris. Ich warte gern. Sie auch.');
    await window(w, toTable, fromTable, 9000);
  }
  await until(w, () => !G.state.is(F.busy));

  await fingers(w);
  G.state.set('e2-verhoer-done');
  G.state.set('e2-flick-nagel');
  await nextScene('e2-konzentration');
}

export const scene = e2Scene('e2-flicks-verhoer', 'Standhaft', async () => {
  await interlude('Unterdessen, in der Halle des Meisters …');
  await startWorld({ map: verhoerMap, spawn: 'stuhl', player: 'e2-flick-gefangen', companions: [], script: verhoerScript });
});

// Scene „e2-flick-entkommt“ – Ein Nagel und ein Schlüsselbund (docs/teil-2/umsetzung.md §3, F2 33:44–35:16;
// quellenpruefung.md §6: a scuffle and a key bunch on the floor, no magic). Captivity interlude, the player is Flick.
// Two checkpointed parts (G.goto with params, a reload restarts the current part):
//  1. World `e2-kerker-flucht`: Kyra suffers visions, Flick and Elnon whisper that nobody of them knows where Lia is
//     and that every night down here buys her time. Two wardens fetch Flick; in the corridor she slips the shackle she
//     loosened with the nail the night before and strikes („Was du gesehen hast“, flick-entkommt-moment.ts: what she
//     observed works, a guess only repeats the beat), the key warden goes down, the key bunch lies on the stones. She runs to the cell of Elnon and Kyra; Elnon decides to
//     stay with Kyra and sends her for help. Plate `e2-flucht`.
//  2. World `e2-kerker-alarm`: the alarm. A stealth route past the searching warden and the stair guard (view
//     cones, dark cells and a niche as hiding spots, each a checkpoint; spotted = soft reset, never game over) up the
//     stairs. Sets e2-flick-escaped. → e2-kontrolle.
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { bloodHit, bloodPool, preloadBlood } from '../common/blood';
import { kerkerBase, kerkerLights } from './gewoelbe';
import { scuffleBeats } from './flick-entkommt-moment';
import {
  ALARM_FROM, ESCAPE_CHECKPOINTS, ESCAPE_EXIT, ESCAPE_GUARDS, ESCAPE_HIDING, ESCAPE_SPAWNS, FLICK_CELL, KEYS_AT, PRISON_CELL, SCUFFLE,
  STAIRS_TOP,
} from './flick-entkommt-weg';
import { bg, e2Scene, interlude, sfx, ui, until, nextScene } from './shared';

/** Flags of this visit (reset when a part starts). */
const F = { keysDown: 'e2-fe-schluessel-boden', hasKeys: 'e2-fe-schluessel', parted: 'e2-fe-abschied', out: 'e2-fe-draussen' } as const;
/** Kept results: how Flick comforted Kyra, what she said when Elnon stayed. */
export const FE_RESULT = { comfort: 'e2-flucht-trost', parting: 'e2-flucht-abschied' } as const;

const KEY = 'waerter-schluessel';
const CLUB = 'waerter-knueppel';

export const fluchtMap: MapDef = defineMap({
  ...kerkerBase({ cells: [0], open: [0] }),
  id: 'e2-kerker-flucht',
  name: 'Die Kerker',
  spawns: { zelle: { at: FLICK_CELL.inRight, dir: 'right' } },
  interactables: [
    { id: 'schluessel', verb: 'Aufheben', at: KEYS_AT, radius: 20, sparkle: true, once: false, when: () => G.state.is(F.keysDown) && !G.state.is(F.hasKeys), onInteract: takeKeys },
    { id: 'zelle-2', verb: 'Aufschließen', at: PRISON_CELL.front, radius: 24, once: false, when: () => G.state.is(F.hasKeys) && !G.state.is(F.parted), onInteract: parting },
  ],
  lights: kerkerLights(0.85),
  time: 'night',
  ambience: ['room'],
  ambienceVolume: { room: 0.8 },
  music: 'dread',
  playerLight: 24,
  sneak: false,
  lookMode: false,
  resetOnEnter: true,
});

export const alarmMap: MapDef = defineMap({
  ...kerkerBase({ cells: [0, 2], open: [0, 2] }),
  id: 'e2-kerker-alarm',
  name: 'Die Kerker',
  spawns: ESCAPE_SPAWNS,
  hidingSpots: ESCAPE_HIDING,
  guards: ESCAPE_GUARDS,
  triggers: [
    ...ESCAPE_CHECKPOINTS.map(c => ({ id: c.spawn, poly: c.area, once: false, onEnter: (w: WorldCtx) => w.stealth.checkpoint(c.spawn) })),
    { id: 'treppe', poly: ESCAPE_EXIT },
  ],
  stealth: { checkpoint: 'flucht' },
  lights: [...kerkerLights(0.7), { id: 'alarm-glut', at: ALARM_FROM, kind: 'fire', radius: 70, intensity: 0.6, always: true }],
  time: 'night',
  ambience: ['room'],
  ambienceVolume: { room: 0.6 },
  music: 'flight',
  playerLight: 20,
  sneak: true,
  lookMode: false,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Part 1: visions, the fetch, the scuffle, the parting
// ---------------------------------------------------------------------------------------------------------------

function spawnPrisoners(w: WorldCtx): void {
  const elnon = w.spawn({ id: 'elnon', preset: 'e2-elnon-gefangen', speaker: 'e2-elnon', at: [PRISON_CELL.inRight[0] - 24, PRISON_CELL.inRight[1]], dir: 'right', idle: 'sit', solid: false, facePlayer: false });
  const kyra = w.spawn({ id: 'kyra', preset: 'kyra-bound', speaker: 'e2-kyra-bound', at: PRISON_CELL.inRight, dir: 'left', idle: 'kneel', solid: false, facePlayer: false });
  elnon.hold(true); kyra.hold(true);
}

async function visions(w: WorldCtx): Promise<void> {
  const kyra = w.actor('kyra');
  await w.cutscene(async () => {
    await w.camera.zoom(1.3, 0);
    await w.camera.pan([220, 130], 0);
    await ui().fade('in', 1000);
    sfx('chain', { volume: 0.3 });
    await w.say('e2-kyra-bound', 'Es war wieder da. In meinem Kopf. Es hat mit meiner Stimme gesprochen und ich konnte nicht weghören.', { mood: 'scared' });
    await w.say('e2-elnon', 'Du hast nichts verraten. Ich war wach, als sie dich zurückgebracht haben. Kein Wort.', { mood: 'grim' });
    await w.say('e2-kyra-bound', 'Woher willst du das wissen? Ich weiß es ja selbst nicht mehr.', { mood: 'sad' });
    w.player.face('right');
    await w.say('e2-flick', 'Weil keiner von uns weiß, wo Lia ist. Keiner. Was nicht drin ist, kann er auch nicht rausholen.', { mood: 'determined' });
    await w.say('e2-elnon', 'Und solange er hier unten bohrt, sucht er nicht da draußen. Jede Nacht hier ist eine Nacht für sie.', { mood: 'determined' });
    await w.say('e2-kyra-bound', 'Dann sitzen wir also für Lia im Stroh.', { mood: 'sad' });
    await w.say('e2-flick', 'Genau. Klingt fast nach Heldenlied, oder?', { mood: 'smirk' });
    await w.say('e2-kyra-bound', 'Riecht aber nicht danach.', { mood: 'sad' });
    await w.say('e2-kyra-bound', 'Er findet sie trotzdem. Er findet alles. Er war in jeder Ecke von meinem Kopf.', { mood: 'scared' });
    const pick = await w.choose([
      '„Lia hat den Riesen schon mal ins Kornfeld gepustet. Die findet keiner, der sie nicht finden soll.“',
      '„Vielleicht findet er sie. Aber nicht heute. Und heute ist alles, was zählt.“',
      '„Wenn er sie findet, findet er auch ihre Wut. Dann viel Spaß.“',
    ]);
    G.state.set(FE_RESULT.comfort, ['kornfeld', 'heute', 'wut'][pick]);
    if (pick === 0) await w.say('e2-flick', 'Lia hat den Riesen schon mal ins Kornfeld gepustet. Die findet keiner, der sie nicht finden soll.', { mood: 'smirk' });
    else if (pick === 1) await w.say('e2-flick', 'Vielleicht findet er sie. Aber nicht heute. Und heute ist alles, was zählt.', { mood: 'determined' });
    else await w.say('e2-flick', 'Wenn er sie findet, findet er auch ihre Wut. Dann viel Spaß. Ich hab sie gesehen.', { mood: 'smirk' });
    bg(kyra.emote('…', 1200));
    await w.say('e2-kyra-bound', '… Ich will, dass es still wird in meinem Kopf. Nur ein bisschen.', { mood: 'sad' });
    await w.say('e2-elnon', 'Schlaf. Ich pass auf, dass keiner reinkommt. Auch keiner in deinen Kopf.', { mood: 'grim' });
    kyra.setIdle('lie');
    await w.wait(500);
    w.player.face('down');
    const hidden = G.state.flag<string>('e2-zelle-schelle');
    await w.think(hidden === 'aermel'
      ? 'Meine linke Schelle. Unterm Ärmel, nur eingehängt. Ein Ruck, und die Hand ist frei.'
      : 'Meine linke Schelle. Nur eingehängt, ein Halm im Spalt. Ein Ruck, und die Hand ist frei.');
    await w.camera.zoom(1, 600);
    w.camera.follow();
  });
}

async function fetch(w: WorldCtx): Promise<void> {
  const key = w.spawn({ id: KEY, preset: 'shadow-sword', speaker: 'e2-waerterin', at: STAIRS_TOP, dir: 'down', solid: false, speed: 40 });
  const club = w.spawn({ id: CLUB, preset: 'shadow-club', speaker: 'e2-waerter', at: [STAIRS_TOP[0] - 8, STAIRS_TOP[1] + 4], dir: 'down', solid: false, speed: 40 });
  key.hold(true); club.hold(true);
  await w.cutscene(async () => {
    sfx('door', { volume: 0.6 });
    await w.think('Die Tür oben. Zwei Paar Stiefel. Natürlich zwei. Allein kommen die nie.');
    await Promise.all([
      key.walkTo(FLICK_CELL.front[0] + 4, FLICK_CELL.front[1] + 6, { straight: true }),
      club.walkTo(FLICK_CELL.front[0] + 34, FLICK_CELL.front[1] + 18, { straight: true }),
    ]);
    key.face('up');
    await w.say('e2-waerterin', 'Aufstehen, Spitzohr. Der Meister will dich sehen. Er hat heute gute Laune. Schlecht für dich.');
    await w.say('e2-waerter', 'Und du, Anführer, mach’s dir bequem. Du bist morgen dran.');
    sfx('door', { volume: 0.6 });
    sfx('chain', { volume: 0.4 });
    await key.walkTo(FLICK_CELL.front[0] + 30, FLICK_CELL.front[1] + 26, { straight: true });
    await w.player.walkTo(FLICK_CELL.doorway[0], FLICK_CELL.doorway[1]);
    await w.player.walkTo(FLICK_CELL.front[0], FLICK_CELL.front[1] + 4);
    club.face('player');
    await club.walkTo(FLICK_CELL.front[0] - 18, FLICK_CELL.front[1] + 4, { straight: true });
    await w.say('e2-waerter', 'Na komm. Schön vor mir her. Ich halt die Kette, du hältst die Klappe.');
    await w.think('Der mit dem Bund vorn, der mit dem Knüppel hinten, an meiner Kette. Genau wie jede Nacht.');
    await Promise.all([
      key.walkTo(SCUFFLE[0] + 34, SCUFFLE[1] + 10, { straight: true }),
      w.player.walkTo(SCUFFLE[0], SCUFFLE[1]),
      club.walkTo(SCUFFLE[0] - 24, SCUFFLE[1] - 8, { straight: true }),
    ]);
    key.face('down');
    w.player.face('right');
    club.face('right');
    await w.say('e2-waerterin', 'Warte. Erst die Hände nach vorn, damit ich sehe, was du da …');
    await w.think('Jetzt. Bevor er hinsieht.');
  });
}

async function scuffle(w: WorldCtx): Promise<void> {
  const key = w.actor(KEY), club = w.actor(CLUB);
  w.setObjective('e2-fe-moment', 'Nutz, was du in zwei Nächten gesehen hast: frei kommen, dann zuschlagen.');
  w.lockPlayer();
  const beats = scuffleBeats(G.state.flag<string>('e2-zelle-schelle'));
  await G.ui.scenePick({
    label: 'Was du gesehen hast',
    help: 'Flick hat die Wärter zwei Nächte lang beobachtet. Was sie weiß, funktioniert. Was sie nur hofft, tut weh.',
    layout: 'row',
    className: 'e2-gerangel',
    rounds: beats.map(beat => ({
      cue: beat.id,
      prompt: { speaker: 'e2-flick', text: beat.prompt },
      cards: beat.ideas.map(({ id, text, tag }) => ({ id, text, tag })),
      judge: (id: string) => {
        const idea = beat.ideas.find(x => x.id === id)!;
        return { ok: idea.ok, mood: idea.ok ? 'flash' : 'hurt', reply: { speaker: 'e2-flick', text: idea.reply } };
      },
    })),
    onRound: round => {
      if (round === 0) { club.face('player'); bg(club.emote('?', 700)); }
      else { key.face('player'); bg(key.play('attack', { ms: 500 })); }
    },
    onVerdict: async (v, round) => {
      if (round === 0) {
        if (v.ok) {
          sfx('chain', { volume: 0.7, pitch: 1.2 });
          sfx('hit', { volume: 0.6 });
          bg(club.play('hit', { ms: 500 }));
          w.camera.shake(140, 0.003);
          await club.walkTo(SCUFFLE[0] - 46, SCUFFLE[1] - 10, { straight: true, speed: 120 });
        } else {
          sfx('chain', { volume: 0.5, pitch: 0.8 });
          w.bark(CLUB, 'He! Stillhalten!', 1200);
          await w.wait(500);
        }
      } else if (v.ok) {
        sfx('swing', { volume: 0.6 });
        await w.wait(120);
        sfx('hit-heavy', { volume: 0.7 });
        w.camera.punch(0.08);
        bloodHit(w, [key.x, key.y - 30], 0.8);
        bg(key.play('fall'));
        key.setIdle('fall');
        sfx('chain', { volume: 0.6, pitch: 0.7 });
        await w.wait(500);
      } else {
        sfx('block', { volume: 0.5 });
        w.bark(KEY, 'Na warte!', 1200);
        await w.wait(500);
      }
    },
  });
  w.unlockPlayer();
  w.completeObjective('e2-fe-moment');
  await w.cutscene(async () => {
    bloodPool(w, [key.x - 10, key.y - 2], { scale: 0.55, ms: 2500 });
    await w.say('narrator', 'Die Schelle hat den Wärter an der Schläfe erwischt. Er liegt auf den Steinen, Blut läuft ihm übers Ohr. Sein Gürtelhaken ist leer.');
    await w.say('e2-waerterin', 'Mein Schädel … Halt sie … HALT SIE!', { mood: 'pained' });
    club.face('player');
    bg(club.emote('!', 900));
    await w.say('e2-waerter', 'Die … die ist frei! Alarm! ALARM!');
    sfx('alert', { volume: 0.6 });
    await club.walkPath([[SCUFFLE[0] + 40, 262], [306, 300], [306, 360]], { straight: true, run: true, speed: 110 });
    w.despawn(CLUB);
    await w.think('Er rennt. Richtung Halle. Gleich ist hier mehr los als auf dem Markt in Trapas.');
    await w.think('Meine rechte Hand pocht wie ein zweites Herz. Der Verband ist rot. Später. Alles später.');
  });
  G.state.set(F.keysDown);
  w.setObjective('e2-fe-bund', 'Schnapp dir den Schlüsselbund.', 'schluessel');
}

async function takeKeys(w: WorldCtx): Promise<void> {
  if (G.state.is(F.hasKeys)) return;
  sfx('pickup', { volume: 0.6 });
  sfx('chain', { volume: 0.4, pitch: 1.4 });
  await w.think('Sieben Bärte. Der blanke für die Zellen. Danke auch, Schädel.');
  G.state.set(F.hasKeys);
  w.completeObjective('e2-fe-bund');
  w.setObjective('e2-fe-zelle', 'Lauf zu Elnon und Kyra und schließ ihre Zelle auf.', 'zelle-2');
}

async function parting(w: WorldCtx): Promise<void> {
  if (G.state.is(F.parted)) return;
  G.state.set(F.parted);
  const elnon = w.actor('elnon'), kyra = w.actor('kyra');
  w.completeObjective('e2-fe-zelle');
  ui().prefetchPlate('e2-flucht');
  await w.cutscene(async () => {
    w.player.face('up');
    sfx('chain', { volume: 0.4, pitch: 1.3 });
    await w.wait(400);
    sfx('chain', { volume: 0.4, pitch: 1.1 });
    await w.think('Der nicht. Der auch nicht. Der blanke …');
    sfx('door', { volume: 0.7 });
    elnon.setIdle('idle');
    elnon.face('down');
    await w.say('e2-elnon', 'Flick?! Was …');
    await w.say('e2-flick', 'Später. Ein Nagel, ein Halm, schlechte Laune. Komm, schnell!', { mood: 'determined' });
    elnon.face('kyra');
    await w.wait(500);
    await w.say('e2-elnon', 'Sieh sie dir an. Sie kommt keine zehn Stufen weit. Und ich trag sie keine zwanzig.', { mood: 'pained' });
    await w.say('e2-elnon', 'Ich bleib bei ihr.', { mood: 'determined' });
    const pick = await w.choose([
      '„Dann trag ich sie eben. Komm schon!“',
      '„Dann bleib ich auch.“',
      '„Du bist kein Held, Elnon. Du bist ein Klotz.“',
    ]);
    G.state.set(FE_RESULT.parting, ['tragen', 'bleiben', 'klotz'][pick]);
    if (pick === 0) {
      await w.say('e2-flick', 'Dann trag ich sie eben. Komm schon!', { mood: 'angry' });
      await w.say('e2-elnon', 'Zwei Treppen weit. Dann haben sie uns alle drei. Allein bist du schneller als jeder von denen.', { mood: 'grim' });
    } else if (pick === 1) {
      await w.say('e2-flick', 'Dann bleib ich auch.', { mood: 'determined' });
      await w.say('e2-elnon', 'Und wer holt Hilfe? Die Ratten? Die sind auf seiner Seite, glaub mir.', { mood: 'grim' });
    } else {
      await w.say('e2-flick', 'Du bist kein Held, Elnon. Du bist ein Klotz. Ein sturer, verprügelter Klotz.', { mood: 'angry' });
      await w.say('e2-elnon', 'Ein Klotz, der bei ihr bleibt. Wacht sie auf und keiner ist da, dann hat er sie ganz.', { mood: 'determined' });
    }
    await w.say('e2-elnon', 'Lauf. Finde Lia, finde Foltan, finde irgendwen. Und bring sie her.', { mood: 'determined' });
    w.player.face('down');
    sfx('chain', { volume: 0.6 });
    await w.wait(300);
    sfx('chain', { volume: 0.5, pitch: 0.8 });
    await w.think('Der kleine Schlüssel passt auch in meine Schellen. Klack, klack. Liegen lassen. Sollen sie sich die ansehen.');
    w.player.face('up');
    await G.ui.plate('e2-flucht', { caption: 'Die offene Tür', pan: 'in', durationMs: 18000 });
    await w.say('e2-flick', 'Halt sie warm, Klotz. Ich komm wieder. Mit Verstärkung.', { mood: 'determined' });
    await w.say('e2-elnon', 'Schließ hinter dir ab. Steht die Tür offen, suchen sie zuerst hier drin.', { mood: 'grim' });
    await w.say('e2-elnon', 'Und Flick: Diesmal glaub ich dir jedes Wort.', { mood: 'determined' });
    await G.ui.closePlate();
    sfx('door', { volume: 0.6 });
    sfx('chain', { volume: 0.4 });
    bg(kyra.emote('…', 900));
    await w.wait(300);
    sfx('alert', { volume: 0.5 });
    await w.say('narrator', 'Von unten, aus dem Gang zur Halle: Rufe, Stiefel, ein Licht, das näher schwankt.');
    await ui().fade('out', 500);
  });
}

async function fluchtScript(w: WorldCtx): Promise<void> {
  for (const f of Object.values(F)) G.state.set(f, false);
  for (const f of Object.values(FE_RESULT)) G.state.set(f, false);
  preloadBlood(w);
  spawnPrisoners(w);
  w.player.face('right');
  await visions(w);
  await fetch(w);
  await scuffle(w);
  await until(w, () => G.state.is(F.parted));
  await until(w, () => !G.ui.busy());
  await nextScene('e2-flick-entkommt', { part: 'alarm' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: the stealth route up the stairs
// ---------------------------------------------------------------------------------------------------------------

async function alarmScript(w: WorldCtx): Promise<void> {
  G.state.set(F.out, false);
  const elnon = w.spawn({ id: 'elnon', preset: 'e2-elnon-gefangen', speaker: 'e2-elnon', at: [PRISON_CELL.inRight[0] - 24, PRISON_CELL.inRight[1]], dir: 'right', idle: 'sit', solid: false, facePlayer: false });
  const kyra = w.spawn({ id: 'kyra', preset: 'kyra-bound', speaker: 'e2-kyra-bound', at: PRISON_CELL.inRight, dir: 'left', idle: 'lie', solid: false, facePlayer: false });
  elnon.hold(true); kyra.hold(true);
  w.player.setIdle('crouch' as never);
  await w.cutscene(async () => {
    await ui().fade('in', 700);
    await w.think('Zurück in meine eigene Zelle. Da sucht mich bestimmt keiner. Hoffentlich.');
    await w.camera.pan(ALARM_FROM, 900);
    w.bark('waerter-alarm', 'Ausschwärmen! Die Spitzohrige ist los!', 2200);
    await w.wait(1200);
    await w.camera.pan([566, 180], 900);
    w.bark('posten-treppe', 'Hier oben kommt keiner vorbei.', 2200);
    await w.think('Die Treppe. Der einzige Weg raus. Und davor einer mit Laterne und Spieß.');
    await w.camera.pan('player', 700);
    w.camera.follow();
    w.player.setIdle('idle');
  });
  await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt, um zu schleichen. Geduckt in den dunklen Zellen und in der Nische an den Kisten sehen dich die Wärter nicht.`);
  w.setObjective('e2-fe-treppe', 'Schleich zur Treppe im Nordosten. Bleib aus den Lichtkegeln.', ESCAPE_EXIT[0] as [number, number]);
  const unsub = w.onMap('spotted', '*', () => { bg(w.think('Mist. Noch mal. Leiser.')); });
  await w.waitForTrigger('treppe');
  unsub();
  G.state.set(F.out);
  w.completeObjective('e2-fe-treppe');
  await w.cutscene(async () => {
    w.stealth.enable(false);
    w.player.face('up');
    await w.player.walkTo(STAIRS_TOP[0], STAIRS_TOP[1] - 4);
    await w.think('Stufen. Dann noch mehr Stufen. Und oben riecht die Luft nach Regen statt nach Stroh.');
    await w.think('Ich komm wieder, Klotz. Halt durch, Kyra.');
    await ui().fade('out', 900);
  });
  await G.ui.narrate(['Als die Wärter die leeren Schellen im Gang fanden, war Flick schon zwischen den Bäumen.', 'Hinter ihr blieb ein Kerker zurück, in dem zwei auf sie warteten.'], { style: 'card' });
  G.state.set('e2-flick-escaped');
  await nextScene('e2-kontrolle');
}

export const scene = e2Scene('e2-flick-entkommt', 'Ein Nagel und ein Schlüsselbund', async params => {
  await ui().fade('out', 0);
  if (params?.part === 'alarm') {
    await startWorld({ map: alarmMap, spawn: 'flucht', player: 'e2-flick-gefangen', companions: [], fadeIn: false, script: alarmScript });
    return;
  }
  await interlude('Unterdessen, in den Kerkern unter der Halle des Meisters …');
  await startWorld({ map: fluchtMap, spawn: 'zelle', player: 'e2-flick-gefangen', companions: [], fadeIn: false, script: fluchtScript });
});

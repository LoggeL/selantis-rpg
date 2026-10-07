// Scene „e2-aufbruch“ – Letzte Hoffnung (docs/teil-2/umsetzung.md §3, F2 38:15–40:15; quellenpruefung §7). Three
// checkpointed parts (G.goto with { part }, a reload restarts the current part):
//  1. default: plate e2-vamir-anhoehe (violet lightning, purpose unexplained), plate e2-stadtwache (a lone guard on a
//     stone parapet over wooded hills sees the violet column: no city, no place name). Framed interlude: a horn,
//     Flick hides in the ferns while four pursuers search right beside her (world stealth beat on the night forest
//     of the prologue, map e2-flick-versteck; being seen only repeats the moment). She stays unseen.
//  2. 'morgen': the morning talk at the hermit's fire (Lia wants to go, Ignatius thinks she is not ready), Lia packs
//     her bundle and says goodbye her way: to his face at the brook, or as a note on birch bark (Lia can write).
//  3. 'hang': the playable walk up the autumn slope e2-herbsthang. Spurenblick on the path (Flick? no – only game and
//     old ways), the white linen in the red bush, a rest; something pale with a blue-violet rim passes close behind
//     her, she turns, nothing is there (perception only, unnamed). Plate e2-aufbruch, the narrator: the group is
//     still apart. e2-finished, setParty([]), checkpoint save, credits „Ende des zweiten Buches“, finishBook2().
// Continuing a save after the end (e2-finished) only offers a short closing choice.
import type Phaser from 'phaser';
import { G } from '../../core/G';
import { registerSpeakers } from '../../core/catalog';
import { findScene } from '../../core/registry';
import { defineMap, startWorld, type GuardDef, type MapDef, type WorldCtx } from '../../world';
import { pointInPoly } from '../../world/poly';
import { BOOK3, finishBook2 } from '../common/bookContract';
import { showCredits } from '../kapitel-5/credits';
import { halt } from '../kapitel-4/shared';
import { fluchtMap } from '../prolog/flucht';
import { BOOK2_CREDITS } from './aufbruch-credits';
import { HANG_CLUES, HANG_LINEN, HANG_OCCLUDERS, HANG_SPOT, HANG_TOP, HANG_WALK } from './aufbruch-hang';
import { IG_EDGE, IG_SPOT, igFireLight, ignatiusBase } from './ignatius-lager';
import { ambience, bg, e2Scene, interlude, lia, liaLook, mentor, sfx, ui, until, nextScene } from './shared';

registerSpeakers([
  // The film shows a lone guard on a parapet, no city (quellenpruefung §7): a neutral name instead of „Stadtwache“.
  { id: 'e2-wache-bruestung', name: 'Wache auf der Brüstung', portrait: 'villager-m', voice: { pitch: 160, wave: 'square' }, color: '#8c8c96' },
]);

const MENTOR = 'ignatius';
const BARK_AT: [number, number] = [664, 414];
/**
 * The south path out of the clearing, from where it leaves the fire down to just above the map edge. The departure
 * trigger covers all of it, and the objective marker stands inside it: walking to the marker always starts the leave.
 */
const PATH_SOUTH: [number, number][] = [[700, 536], [812, 524], [836, 704], [738, 704]];
const PATH_SOUTH_MARK: [number, number] = [762, 560];
const FERN_AT: [number, number] = [414, 372];
const HIDE_SECONDS = 15;
const PURSUERS = ['verfolger-1', 'verfolger-2', 'verfolger-3', 'verfolger-4'];

// ---------------------------------------------------------------------------------------------------------------
// Part 1: lightning, the parapet, Flick in the ferns
// ---------------------------------------------------------------------------------------------------------------

const pursuer = (id: string, preset: string, path: GuardDef['path'], lantern = false): GuardDef => ({
  id, preset, speaker: 'dunkelschatten', mode: 'pingpong', range: 104, fov: 74, lantern, path,
  suspiciousBarks: ['Da! Hat sich da was bewegt?', 'Im Farn?'],
  calmBarks: ['Nur ein Vogel.', 'Nichts. Weiter.'],
});

export const flickVersteck: MapDef = defineMap({
  ...fluchtMap,
  id: 'e2-flick-versteck',
  name: 'Irgendwo im Wald',
  guards: [
    pursuer('verfolger-1', 'shadow-club', [{ at: [24, 412], wait: 400 }, { at: [300, 352], wait: 2600, face: 'right' }, { at: [318, 430], wait: 2200, face: 'right' }]),
    pursuer('verfolger-2', 'shadow-sword', [{ at: [262, 150], wait: 400 }, { at: [420, 262], wait: 2600, face: 'down' }, { at: [500, 290], wait: 2000, face: 'down' }], true),
    pursuer('verfolger-3', 'shadow-spear', [{ at: [760, 180], wait: 400 }, { at: [560, 320], wait: 2400, face: 'left' }, { at: [530, 382], wait: 2400, face: 'left' }]),
    pursuer('verfolger-4', 'shadow-crossbow', [{ at: [700, 580], wait: 400 }, { at: [520, 470], wait: 2600, face: 'up' }, { at: [474, 452], wait: 2000, face: 'left' }], true),
  ],
  triggers: [],
  interactables: [],
  spawns: { west: { at: [30, 404], dir: 'right' }, farn: { at: FERN_AT, dir: 'down' } },
  stealth: { checkpoint: 'farn' },
  music: 'flight',
  resetOnEnter: true,
});

async function farOff(): Promise<void> {
  G.stopGameplayScenes();
  await ui().fade('out', 0);
  ui().prefetchPlate('e2-vamir-anhoehe');
  ui().prefetchPlate('e2-stadtwache');
  try { G.audio.music('dread', { fadeMs: 1500 }); } catch { /* audio optional */ }
  ambience(['wind'], { wind: 0.6 });
  await G.ui.narrate(['Weit entfernt, auf einer Anhöhe über dem Land …'], { style: 'card' });
  await G.ui.plate('e2-vamir-anhoehe', { caption: 'Vamir', pan: 'in', durationMs: 16000 });
  await ui().fade('in', 900);
  await G.ui.say('narrator', 'Vamir breitete die Arme aus. Aus seinen Händen fuhren Blitze in den klaren Himmel, kalt und violett.');
  sfx('thunder', { volume: 0.7 });
  await G.ui.say('narrator', 'Wem dieses Zeichen galt, sagte er niemandem.');
  await ui().fade('out', 700);
  await G.ui.closePlate();
  await G.ui.plate('e2-stadtwache', { caption: 'Viele Hügel weiter, auf einer steinernen Brüstung', pan: 'right', durationMs: 16000 });
  await ui().fade('in', 900);
  sfx('thunder', { volume: 0.35, distance: 0.8 });
  await G.ui.say('e2-wache-bruestung', 'Blitze. Bei klarem Himmel. Und violett.');
  await G.ui.say('e2-wache-bruestung', 'Das melde ich. Und ich hoffe sehr, dass mich jemand auslacht.');
  await ui().fade('out', 700);
  await G.ui.closePlate();
}

async function flickScript(w: WorldCtx): Promise<void> {
  const guards = PURSUERS.map(id => w.actor(id));
  const stash = () => { for (const g of guards) { g.hold(true); g.hide(); } };
  stash();
  w.stealth.enable(false);
  await ui().fade('in', 900);
  let spotted = false;
  w.stealth.onSpotted(async g => {
    spotted = true;
    w.lockPlayer();
    w.bark(g.id, 'Da! Im Farn!', 1400);
    await w.wait(700);
    await ui().fade('out', 500);
    stash();
    w.stealth.resetGuards();
    w.stealth.enable(false);
    w.player.teleport(FERN_AT, 'down');
    await w.wait(200);
    await ui().fade('in', 500);
    w.unlockPlayer();
    await w.say('e2-flick', 'Nein. So nicht. Noch mal, Flick. Flach wie ein Blatt.', { mood: 'scared' });
  });

  await w.cutscene(async () => {
    await w.wait(400);
    sfx('alert', { volume: 0.5, pitch: 0.45, distance: 0.6 });
    await w.wait(900);
    sfx('alert', { volume: 0.45, pitch: 0.42, distance: 0.6 });
    await w.say('e2-flick', 'Ein Horn. Die haben die leeren Schellen gefunden. Schneller, als mir lieb ist.', { mood: 'scared' });
    await w.say('e2-flick', 'Laufen bringt nichts mehr. Meine Beine sind seit Tagen nur noch zur Hälfte meine.', { mood: 'pained' });
    await w.say('e2-flick', 'Und die rechte Hand kann keinen Bogen halten. Zwei Finger ohne Nägel, der Verband klebt. Also: verstecken.', { mood: 'pained' });
  });
  w.setObjective('e2-auf-farn', 'Versteck dich im Farn, bevor die Verfolger da sind.', FERN_AT);
  await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt: Geduckt im Farn sieht dich keiner.`);

  for (let tries = 0; w.alive; tries++) {
    await until(w, () => w.stealth.hidden, 120);
    w.completeObjective('e2-auf-farn');
    spotted = false;
    w.stealth.resetGuards();
    for (const g of guards) { g.show(); g.hold(false); }
    w.stealth.enable(true);
    sfx('alert', { volume: 0.35, pitch: 0.5, distance: 0.4 });
    w.setObjective('e2-auf-still', 'Bleib geduckt im Farn. Rühr dich nicht, bis sie abziehen.', null);
    if (tries === 0) w.bark('player', 'Leise. Wie auf der Jagd. Nur andersrum.', 2600);
    const barks: [number, string, string][] = [
      [3, 'verfolger-1', 'Die kann nicht weit sein.'],
      [6, 'verfolger-3', 'Durchsucht das Unterholz!'],
      [9, 'verfolger-2', 'Hier riecht’s nach Fuchs.'],
      [12, 'verfolger-4', 'Ohne die braucht keiner heimzukommen.'],
    ];
    let t = 0;
    while (w.alive && !spotted && t < HIDE_SECONDS * 1000) {
      await w.wait(250);
      t += 250;
      for (const [s, id, line] of barks) if (t === s * 1000) w.bark(id, line, 2000);
    }
    if (!spotted) break;
    await until(w, () => !G.ui.busy(), 150);
    w.setObjective('e2-auf-farn', 'Zurück in den Farn, ducken.', FERN_AT);
  }

  w.stealth.enable(false);
  w.lockPlayer();
  sfx('alert', { volume: 0.4, pitch: 0.4, distance: 0.8 });
  w.bark('verfolger-1', 'Das Horn! Sammeln, am Bach!', 1800);
  await w.wait(600);
  await Promise.all(guards.map(async (g, i) => {
    g.hold(true);
    const away: [number, number][] = [[20, 412], [262, 150], [760, 180], [700, 580]];
    await g.walkTo(away[i][0], away[i][1], { run: true }).catch(() => {});
    g.hide();
  }));
  w.completeObjective('e2-auf-still');
  await w.say('e2-flick', 'Weg. Alle vier. Und keiner hat nach unten geguckt.', { mood: 'smirk' });
  await w.say('e2-flick', 'Hilfe holen, hat Elnon gesagt. Als ob die irgendwo rumsitzt und auf mich wartet.', { mood: 'sad' });
  await w.say('e2-flick', 'Na schön. Dann such ich sie eben. Haltet durch, ihr zwei.', { mood: 'determined' });
  await ui().fade('out', 1200);
  halt(w, PURSUERS);
  await nextScene('e2-aufbruch', { part: 'morgen' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: the morning at the hermit's fire
// ---------------------------------------------------------------------------------------------------------------

export const aufbruchLager: MapDef = defineMap({
  ...ignatiusBase,
  id: 'e2-aufbruch-lager',
  name: 'Die Lichtung im ersten Licht',
  npcs: [{
    id: MENTOR, preset: 'e2-ignatius', speaker: 'e2-ignatius', at: IG_SPOT.mentorSeat, dir: 'left', idle: 'sit',
    verb: 'Reden', talk: talkMentor,
  }],
  props: [{ id: 'buecher', prop: 'bookstack', at: [702, 252], collide: false }],
  interactables: [
    { id: 'buendel', verb: 'Bündel packen', at: IG_SPOT.shelter, radius: 26, sparkle: true, when: () => G.state.is('e2-auf-gesprochen') && !G.state.is('e2-auf-gepackt'), onInteract: pack },
    { id: 'rinde', verb: 'Nachricht schreiben', at: BARK_AT, radius: 24, sparkle: true, when: () => G.state.is('e2-auf-gepackt') && !G.state.flag('e2-abschied'), onInteract: writeNote },
  ],
  triggers: [
    { id: 'pfad-sued', poly: PATH_SOUTH, once: false, when: () => Boolean(G.state.flag('e2-abschied')), onEnter: () => { G.state.set('e2-auf-los'); } },
  ],
  exits: [
    { id: 'weg-sued', poly: IG_EDGE.south, to: 'e2-aufbruch-lager', spawn: 'bed', when: () => false, blocked: 'Nicht ohne Abschied. Und nicht ohne Bündel.' },
    { id: 'weg-ost', poly: IG_EDGE.east, to: 'e2-aufbruch-lager', spawn: 'bed', when: () => false, blocked: 'Nach Süden. Dort fängt der Weg an.' },
  ],
  lights: [igFireLight(0.5, 0.5)],
  time: 'dawn',
  weather: 'leaves',
  ambience: ['birds', 'stream', 'fire'],
  ambienceVolume: { birds: 0.5, stream: 0.45, fire: 0.35 },
  music: 'refuge',
  resetOnEnter: true,
});

const say = (w: WorldCtx, text: string, mood?: string) => w.say(mentor(), text, mood ? { mood } : undefined);

async function talkMentor(w: WorldCtx): Promise<void> {
  if (!G.state.is('e2-auf-gesprochen')) { G.state.set('e2-auf-reden'); return; }
  if (G.state.is('e2-auf-gepackt') && !G.state.flag('e2-abschied')) { await farewell(w); return; }
  if (G.state.flag<string>('e2-abschied') === 'gesicht') { await say(w, 'Geh, bevor ich es mir anders überlege und dich festbinde.', 'sad'); return; }
}

async function morningTalk(w: WorldCtx): Promise<void> {
  const m = w.actor(MENTOR);
  m.hold(true);
  m.face('player');
  await lia(w, 'Ich gehe. Heute. Ich hole Kyra und Flick.', 'determined');
  await say(w, 'Ich weiß. Du schläfst seit drei Nächten mit dem Stab im Arm.', 'sad');
  await say(w, 'Und ich sage es trotzdem: Du bist noch nicht so weit.', 'worried');
  await lia(w, 'Dann werde ich es unterwegs.');
  await say(w, 'Unterwegs lernt man vor allem, wie weit unterwegs ist.', 'thinking');
  const pick = await w.choose([
    '„Ihr wisst, wo sie sind. Oder ahnt es wenigstens.“',
    '„Ihr habt selbst gesagt, ich lerne schnell.“',
    '„Jede Nacht, die ich hier schlafe, schlafen sie dort.“',
  ]);
  G.state.set('e2-auf-argument', ['ahnung', 'schnell', 'nacht'][pick]);
  if (pick === 0) await say(w, 'Ich ahne. Ahnen ist kein Weg, auf dem man laufen kann.', 'grim');
  else if (pick === 1) await say(w, 'Schnell, ja. Fertig, nein. Das sind zwei verschiedene Wörter, weißt du noch?', 'thinking');
  else await say(w, 'Und jede Nacht, die du unvorbereitet läufst, kann deine letzte sein. Dann schlafen sie dort für immer.', 'worried');
  await say(w, 'Bleib noch einen halben Mond. Bitte.', 'sad');
  await w.think('Ein halber Mond. Für Kyra ist jede Nacht ein halber Mond.');
  await say(w, 'Ich hole Wasser. Denk darüber nach, solange ich am Bach bin.');
  m.setIdle('idle');
  await m.walkTo(IG_SPOT.stream[0], IG_SPOT.stream[1], { face: 'right' });
  m.setIdle('kneel');
  m.hold(false);
}

async function pack(w: WorldCtx): Promise<void> {
  await w.player.play('kneel', { ms: 900 });
  sfx('rustle', { volume: 0.5 });
  await w.think('Die Decke, ein Kanten Brot, der Wasserschlauch. Und Schattentöter. Geliehen, hat er gesagt.');
  G.state.set('e2-auf-gepackt');
  w.completeObjective('e2-auf-packen');
  w.setObjective('e2-auf-abschied', 'Abschied: Sag es Ignatius am Bach ins Gesicht – oder schreib ihm eine Nachricht auf Birkenrinde (am Feuer).', MENTOR);
}

async function farewell(w: WorldCtx): Promise<void> {
  const pick = await w.choose(['„Ich gehe jetzt. Ich wollte nicht einfach verschwinden.“', '(Doch lieber eine Nachricht schreiben.)']);
  if (pick === 1) { w.setObjectiveTarget('rinde'); return; }
  G.state.set('e2-abschied', 'gesicht');
  await w.cutscene(async () => {
    const m = w.actor(MENTOR);
    m.hold(true);
    m.setIdle('idle');
    m.face('player');
    await say(w, 'Das ehrt dich. Ruhiger macht es mich nicht.', 'sad');
    await say(w, 'Dann hör mir ein letztes Mal zu. Wenn in dir alles brennt: Zähl bis drei. Erst dann der Stab.', 'determined');
    await lia(w, 'Bis drei. Das schaff ich. Meistens.');
    await say(w, 'Und bring ihn mir zurück. Mit dir dran.', 'happy');
    await lia(w, 'Versprochen.', 'happy');
    m.hold(false);
  });
  leaveObjective(w);
}

async function writeNote(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    w.player.face('up');
    await w.player.play('kneel', { ms: 600 });
    w.player.setIdle('kneel');
    await w.think('Ein Stück Birkenrinde, ein Rest Kohle vom Feuer. Mutter hat mir das Schreiben beigebracht. Für Einkaufslisten.');
    const pick = await w.choose([
      '„Bin los. Danke für alles. Ich bringe den Stab zurück. Lia“',
      '„Ein halber Mond ist zu lang. Verzeiht mir. Lia“',
      '„Holz liegt am Stapel. Für die Füße. Lia“',
    ]);
    G.state.set('e2-abschied', 'brief');
    G.state.set('e2-abschied-brief', pick);
    sfx('write', { volume: 0.6 });
    await w.wait(900);
    await w.think('Kyra könnte das nicht lesen. Er schon. Hoffentlich auch meine Schrift.');
    await w.think('Ich lege die Rinde auf seinen Platz und einen Stein darauf, damit der Wind sie nicht mitnimmt.');
    w.player.setIdle('idle');
  });
  leaveObjective(w);
}

function leaveObjective(w: WorldCtx): void {
  w.completeObjective('e2-auf-abschied');
  w.setObjective('e2-auf-los', 'Brich auf: der Pfad nach Süden.', PATH_SOUTH_MARK);
}

async function morgenScript(w: WorldCtx): Promise<void> {
  for (const f of ['e2-auf-reden', 'e2-auf-gesprochen', 'e2-auf-gepackt', 'e2-auf-los']) G.state.set(f, false);
  G.state.set('e2-abschied', false);
  w.player.setIdle('lie');
  w.lockPlayer();
  await G.ui.narrate(['Am Morgen stand Lias Entschluss fest. Sie hatte ihn die halbe Nacht gewendet, bis er sich nicht mehr bewegte.'], { style: 'card' });
  await ui().fade('in', 1000);
  w.player.setIdle('idle');
  w.unlockPlayer();
  w.setObjective('e2-auf-reden', 'Sag Ignatius am Feuer, dass du heute aufbrichst.', MENTOR);
  await until(w, () => G.state.is('e2-auf-reden'));
  w.completeObjective('e2-auf-reden');
  await w.cutscene(() => morningTalk(w));
  G.state.set('e2-auf-gesprochen');
  w.setObjective('e2-auf-packen', 'Pack dein Bündel im Unterstand.', 'buendel');
  // The trigger fires on entering the path. A player who was already on it when the farewell ended (or crossed it
  // during a cutscene, where triggers stay silent) leaves as soon as the farewell is done and they stand on it.
  await until(w, () => G.state.is('e2-auf-los')
    || (Boolean(G.state.flag('e2-abschied')) && !G.ui.busy() && pointInPoly(w.player.x, w.player.y, PATH_SOUTH)));
  G.state.set('e2-auf-los');
  w.completeObjective('e2-auf-los');
  w.lockPlayer();
  if (G.state.flag<string>('e2-abschied') === 'brief') await w.think('Er kniet noch am Bach und dreht sich nicht um. Vielleicht ist das besser so.');
  else w.bark(MENTOR, 'Bis drei, Lia!', 2200);
  await w.wait(600);
  await ui().fade('out', 1200);
  halt(w, [MENTOR]);
  await nextScene('e2-aufbruch', { part: 'hang' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 3: the autumn slope
// ---------------------------------------------------------------------------------------------------------------

const HANG_TRAIL = ['stiefel', 'reh', 'kerbe'] as const;
const trailDone = () => HANG_TRAIL.every(id => G.state.is(`e2-hang-${id}`));
const nextHangTarget = (): string => HANG_TRAIL.find(id => !G.state.is(`e2-hang-${id}`)) ?? 'leinen';

export const herbsthang: MapDef = defineMap({
  id: 'e2-herbsthang',
  name: 'Ein Hang im Herbst',
  background: 'e2-herbsthang',
  walk: HANG_WALK,
  occluders: HANG_OCCLUDERS,
  surfaces: [{ id: 'pfad', kind: 'path', poly: HANG_WALK[0] }],
  surface: 'grass',
  depthScale: { y0: 0, s0: 0.92, y1: 720, s1: 1.04 },
  lookMode: true,
  interactables: [
    { id: 'leinen', verb: 'Ansehen', poly: HANG_LINEN, radius: 56, once: false, onInteract: linen },
    { id: 'rast', verb: 'Rasten', at: HANG_SPOT.rest, radius: 26, sparkle: true, when: () => G.state.is('e2-hang-leinen') && !G.state.is('e2-hang-gerastet'), onInteract: rest },
  ],
  clues: [
    { id: 'stiefel', at: HANG_CLUES.stiefel, kind: 'footprint', angle: -30, onInteract: w => readHang(w, 'stiefel') },
    { id: 'reh', at: HANG_CLUES.reh, kind: 'hoof', angle: 70, onInteract: w => readHang(w, 'reh') },
    { id: 'kerbe', at: HANG_CLUES.kerbe, kind: 'mark', angle: 0, onInteract: w => readHang(w, 'kerbe') },
  ],
  triggers: [
    { id: 'oben', poly: HANG_TOP, once: false, onEnter: w => void leaveTop(w) },
  ],
  spawns: { unten: { at: HANG_SPOT.start, dir: 'up' } },
  time: 'day',
  weather: 'leaves',
  ambience: ['wind', 'birds'],
  ambienceVolume: { wind: 0.6, birds: 0.5 },
  music: 'exploration',
  resetOnEnter: true,
});

async function readHang(w: WorldCtx, id: typeof HANG_TRAIL[number]): Promise<void> {
  const first = !G.state.is(`e2-hang-${id}`);
  G.state.set(`e2-hang-${id}`);
  if (id === 'stiefel') {
    await w.think('Ein Stiefelabdruck! Flick? … Nein. Zu groß, zu breit, und der Regen hat ihn schon weichgewaschen. Alt.');
  } else if (id === 'reh') {
    await w.think('Rehspuren, quer über den Weg. Flick würde sagen: eine Ricke mit Kitz, heute früh. Ich sage: Reh.');
  } else {
    await w.think('Eine Kerbe im Stein, voller Moos. Hier sind Leute gegangen, lange bevor irgendwer Dunkelhain gesagt hat.');
  }
  if (!first) return;
  if (trailDone()) {
    await w.think('Niemand von uns war hier. Nur Wild und alte Wege. Dann bin ich eben die Erste.');
    w.setObjective('e2-hang-weg', 'Folge dem Pfad den Hang hinauf.', 'leinen');
  } else w.setObjectiveTarget(nextHangTarget());
}

async function linen(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-hang-leinen')) { await w.think('Das Leinen flattert, als winke es. Mir? Wohl kaum.'); return; }
  G.state.set('e2-hang-leinen');
  await w.think('Ein Streifen weißes Leinen, im Busch verfangen. Sauber. Nicht vom Wetter zerfressen.');
  await w.think('Wer verliert hier oben Leinen? Hier ist doch niemand.');
  await w.think('Meine Beine sagen: Pause. Nur ganz kurz.');
  w.setObjective('e2-hang-weg', 'Ruh dich am Busch einen Moment aus.', 'rast');
}

async function rest(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-hang-gerastet')) return;
  G.state.set('e2-hang-gerastet');
  await w.cutscene(async () => {
    await w.player.walkTo(HANG_SPOT.rest[0], HANG_SPOT.rest[1], { face: 'down' });
    w.player.setIdle('sit');
    await w.camera.zoom(1.3, 900);
    await w.wait(500);
    await w.think(G.state.flag<string>('e2-abschied') === 'gesicht' ? 'Bis drei, hat er gesagt. Eins. Zwei. Drei. Gut. Nichts brennt.' : 'Ob er die Rinde schon gefunden hat? Ob er schimpft? Ob er lacht?');
    await w.think('Unten im Tal liegt Nebel wie Milch in einer Schüssel. Irgendwo dahinter sind sie.');
    await w.wait(700);
    await passBehind(w);
    await w.think('Da war … etwas. Dicht hinter mir. Kühl, wie ein Atemzug im Nacken.');
    const pick = await w.choose(['Umdrehen.', 'Ganz still sitzen bleiben.']);
    G.state.set('e2-hang-reaktion', pick === 0 ? 'umgedreht' : 'still');
    if (pick === 1) {
      await w.think('Nicht bewegen. Wie damals in der Böschung am Hof, als die Reiter vorbeikamen. Wie ein Hase im Feld.');
      await w.wait(900);
      await w.think('Ich halte das nicht aus.');
    }
    w.player.setIdle('idle');
    w.player.face('up');
    sfx('rustle', { volume: 0.5 });
    w.fx.burst([930, 360], 'leaves', 8);
    await w.wait(700);
    await w.think('Nichts. Nur der Busch und das Leinen im Wind.');
    await w.think('Zu wenig Schlaf, würde Ignatius sagen. Oder er würde gar nichts sagen und nur so gucken.');
    await w.camera.zoom(1, 900);
  });
  w.setObjective('e2-hang-weg', 'Weiter, den Pfad hinauf.', HANG_SPOT.top);
}

/** Something pale with a blue-violet rim glides past close behind the resting Lia. Perception only, unnamed. */
async function passBehind(w: WorldCtx): Promise<void> {
  const scene = w.scene as Phaser.Scene & { addWorld?<T extends Phaser.GameObjects.GameObject>(o: T): T };
  const g = scene.add.graphics();
  scene.addWorld?.(g);
  const [x0, y0] = HANG_SPOT.passFrom, [x1] = HANG_SPOT.passTo;
  g.setDepth(y0).setBlendMode(1).setAlpha(0);
  const robe = (gfx: Phaser.GameObjects.Graphics) => {
    gfx.clear();
    gfx.fillStyle(0x9a8cff, 0.18);
    gfx.fillEllipse(0, -22, 30, 54);
    gfx.fillStyle(0xf2f4ff, 0.55);
    gfx.fillPoints([{ x: -5, y: -44 }, { x: 5, y: -44 }, { x: 9, y: -6 }, { x: 13, y: 0 }, { x: -13, y: 0 }, { x: -9, y: -6 }] as Phaser.Types.Math.Vector2Like[], true);
    gfx.lineStyle(1.5, 0x8fa6ff, 0.9);
    gfx.strokePoints([{ x: -5, y: -44 }, { x: 5, y: -44 }, { x: 9, y: -6 }, { x: 13, y: 0 }, { x: -13, y: 0 }, { x: -9, y: -6 }] as Phaser.Types.Math.Vector2Like[], true);
  };
  robe(g);
  g.setPosition(x0, y0);
  const glow = w.lighting.add({ id: 'e2-schimmer', at: [x0, y0 - 18], kind: 'plain', color: 0xa8b4ff, radius: 34, intensity: 0, always: true });
  sfx('whoosh', { volume: 0.25, pitch: 0.6 });
  bg(glow.fadeTo(0.7, 300));
  await new Promise<void>(resolve => {
    scene.tweens.add({
      targets: g, x: x1, duration: 1100, ease: 'Sine.easeInOut',
      onUpdate: tw => { g.setAlpha(Math.sin(tw.progress * Math.PI) * 0.85); glow.set({ at: [g.x, y0 - 18] }); },
      onComplete: () => resolve(),
    });
  });
  await glow.fadeTo(0, 250);
  glow.remove();
  g.destroy();
}

async function leaveTop(w: WorldCtx): Promise<void> {
  if (!G.state.is('e2-hang-gerastet')) {
    await w.think('Gleich. Erst eine kurze Pause am Busch. Meine Beine bestehen darauf.');
    await w.player.walkTo(w.player.x - 10, w.player.y + 30);
    return;
  }
  if (G.state.is('e2-hang-ende')) return;
  G.state.set('e2-hang-ende');
  w.lockPlayer();
  w.completeObjective('e2-hang-weg');
  ui().prefetchPlate('e2-aufbruch');
  await ui().fade('out', 900);
  await G.ui.plate('e2-aufbruch', { caption: 'Letzte Hoffnung', pan: 'right', durationMs: 30000 });
  try { G.audio.music('refuge', { fadeMs: 2000 }); } catch { /* audio optional */ }
  await ui().fade('in', 900);
  await G.ui.say('narrator', 'So zog Lia los, allein, mit einem geliehenen Stab und einem Bündel, das nach Rauch roch.');
  await G.ui.say('narrator', 'Irgendwo hinter den Hügeln waren Kyra und Flick. Dass Elnon tot war, gestorben durch Kyras Hand, ahnte Lia nicht.');
  await G.ui.say('narrator', 'Wohin der Weg führte, wusste Lia nicht. Nur, dass sie ihn nicht mehr zurückgehen würde.');
  await G.ui.say('narrator', 'Und tief in ihr wartete das ~Licht~ darauf, dass sie es rief.');
  await ui().fade('out', 1200);
  await G.ui.closePlate();
  await finishBook();
}

async function finishBook(): Promise<void> {
  G.state.set('e2-finished');
  G.state.setParty([]);
  G.state.save('teil-2', 'e2-aufbruch', { book2Finished: true });
  await showCredits(BOOK2_CREDITS);
  await finishBook2();
}

async function hangScript(w: WorldCtx): Promise<void> {
  for (const f of ['e2-hang-leinen', 'e2-hang-gerastet', 'e2-hang-ende', ...HANG_TRAIL.map(id => `e2-hang-${id}`)]) G.state.set(f, false);
  w.lockPlayer();
  await G.ui.narrate(['Der Pfad führte aus dem Wald und einen Hang hinauf, an dem der Herbst schon alles angezündet hatte.'], { style: 'card' });
  await ui().fade('in', 1000);
  w.unlockPlayer();
  await w.think(G.state.flag<string>('e2-abschied') === 'brief' ? 'Hoffentlich findet er die Rinde, bevor der Wind es tut.' : 'Er hat mich nicht aufgehalten. Das war fast schlimmer, als wenn er es versucht hätte.');
  await w.think('Kyra, Flick … ich weiß nicht mal, in welche Richtung. Also lese ich. Den Boden, wie Flick es mir gezeigt hat.');
  w.setObjective('e2-hang-spuren', `Lies den Pfad im Spurenblick (${w.controlHint('look')} halten): Wer ist hier vor dir gegangen?`, nextHangTarget());
  await until(w, () => trailDone() || G.state.is('e2-hang-leinen'));
  w.completeObjective('e2-hang-spuren');
  if (!G.state.is('e2-hang-leinen')) w.setObjective('e2-hang-weg', 'Folge dem Pfad den Hang hinauf.', 'leinen');
}

// ---------------------------------------------------------------------------------------------------------------
// After the end: Continue offers a short closing choice instead of replaying everything
// ---------------------------------------------------------------------------------------------------------------

async function closingChoice(): Promise<void> {
  G.stopGameplayScenes();
  await ui().fade('out', 0);
  await G.ui.plate('e2-aufbruch', { caption: 'Letzte Hoffnung', pan: 'none' });
  await ui().fade('in', 900);
  await G.ui.say('narrator', 'Das zweite Buch ist zu Ende erzählt. Lia ist irgendwo hinter den Hügeln, mit einem geliehenen Stab.');
  const book3 = Boolean(findScene(BOOK3.entry));
  for (;;) {
    const pick = await G.ui.choose(['Den Abspann noch einmal ansehen.', 'Zurück zum Titel.', ...(book3 ? ['Weiter: das dritte Buch.'] : [])]);
    if (pick === 0) {
      await G.ui.closePlate();
      await showCredits(BOOK2_CREDITS);
      await G.ui.plate('e2-aufbruch', { caption: 'Letzte Hoffnung', pan: 'none' });
      continue;
    }
    await ui().fade('out', 700);
    await G.ui.closePlate();
    if (pick === 2) { await finishBook2(); return; }
    const { showTitle } = await import('../../scenes/BootScene');
    await showTitle();
    return;
  }
}

export const scene = e2Scene('e2-aufbruch', 'Letzte Hoffnung', async params => {
  if (G.state.is('e2-finished')) { await closingChoice(); return; }
  const part = params?.part;
  if (part === 'morgen') {
    await ui().fade('out', 0);
    await startWorld({ map: aufbruchLager, spawn: 'bed', player: liaLook(), companions: [], fadeIn: false, script: morgenScript });
    return;
  }
  if (part === 'hang') {
    await ui().fade('out', 0);
    await startWorld({ map: herbsthang, spawn: 'unten', player: liaLook(), companions: [], fadeIn: false, script: hangScript });
    return;
  }
  await farOff();
  await interlude('Unterdessen, irgendwo in den Wäldern, noch vor Tagesanbruch …');
  await startWorld({ map: flickVersteck, spawn: 'west', player: 'e2-flick-gefangen', companions: [], fadeIn: false, script: flickScript });
});

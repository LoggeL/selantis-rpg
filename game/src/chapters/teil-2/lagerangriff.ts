// Scene „e2-lagerangriff“ – Überfall im Morgengrauen (docs/teil-2/umsetzung.md §3, F2 10:58–12:14; quellenpruefung
// §4: no fire, no massacre). Three checkpointed parts (G.goto with params, so a reload restarts the current part):
//  1. World `e2-lager-alarm` (camp before dawn, torches, alarm at the gate): Kyra wakes Lia, Elnon and the gate guards
//     run to the gate. Optional, with consequences in the battle: find Azar's sabre for him, tell Foltan the way out.
//     Mandatory: Flick at the fire sends the sisters to the rear water gate and takes up bow and knife.
//  2. Tactics `e2-ueberfall` (lagerangriff-battle.ts): Lia and Kyra reach the water gate while the others hold.
//  3. World `e2-bach-flucht` / `e2-bach-lauf` (the brook clearing of Kapitel IV, at night): Kyra stumbles, Lia wants
//     to stay (choice), Kyra insists and draws the pursuers; Lia slips past the lanterns to the stones. Framed cut to
//     the camp (plate e2-trennung): Kyra brought in – the wrong one again –, Baris recognises Flick, bound beside
//     Elnon. Lia collapses by the brook; steps, a warm hand, black. setParty([]), e2-getrennt → e2-der-fremde.
import { G } from '../../core/G';
import type { TacticsStartData } from '../../tactics/api';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { bach } from '../kapitel-4/augenbinde';
import { campBase } from '../kapitel-4/lager';
import { halt } from '../kapitel-4/shared';
import { raidBattle } from './lagerangriff-battle';
import { ambience, bg, e2Scene, grantOnce, interlude, lia, liaLook, sfx, ui, until, nextScene } from './shared';

const TENT: [number, number] = [190, 462];
const FLICK_AT: [number, number] = [612, 382];

// ---------------------------------------------------------------------------------------------------------------
// Part 1: the alarm (camp before dawn)
// ---------------------------------------------------------------------------------------------------------------

export const lagerAlarm: MapDef = defineMap({
  ...campBase,
  id: 'e2-lager-alarm',
  name: 'Das Lager vor Tagesanbruch',
  npcs: [
    { id: 'kyra', preset: 'kyra', at: [150, 476], dir: 'right' },
    { id: 'elnon', preset: 'elnon', at: [636, 236], dir: 'down', speed: 70 },
    { id: 'flick', preset: 'flick', at: FLICK_AT, dir: 'up', verb: 'Reden', talk: talkFlick },
    { id: 'foltan', preset: 'foltan', at: [598, 520], dir: 'down', verb: 'Reden', talk: talkFoltan },
    { id: 'azar', preset: 'azar', at: [1030, 324], dir: 'left', verb: 'Reden', talk: talkAzar, barks: ['Mein Säbel! Wo ist mein Säbel?'], barkEvery: 7000 },
    { id: 'e2-torwache-1', preset: 'guard-brotherhood', at: [470, 300], dir: 'down', speed: 70 },
    { id: 'e2-torwache-2', preset: 'elf-m', at: [792, 300], dir: 'down', speed: 70 },
    { id: 'e2-schwarzrock-1', preset: 'shadow-sword', at: [618, 690], dir: 'up', hidden: true },
    { id: 'e2-schwarzrock-2', preset: 'shadow-club', at: [656, 698], dir: 'up', hidden: true },
  ],
  props: [
    { prop: 'torch', at: [546, 486], collide: false },
    { prop: 'torch', at: [714, 486], collide: false },
    { prop: 'torch', at: [462, 262], collide: false },
    { prop: 'torch', at: [820, 262], collide: false },
  ],
  interactables: [
    {
      id: 'saebel', verb: 'Säbel nehmen', poly: [[1048, 270], [1100, 270], [1104, 300], [1050, 300]], standAt: [1076, 314], face: 'up',
      sparkle: true, once: false, when: () => G.state.is('e2-azar-sucht') && !G.state.is('e2-saebel'), onInteract: takeSabre,
    },
  ],
  lights: [
    { id: 'glut', at: [636, 330], kind: 'fire', radius: 90, intensity: 0.5 },
    { id: 'esse', at: [1024, 236], kind: 'fire', radius: 50, intensity: 0.4 },
    { id: 'mond', at: [200, 0], kind: 'moon', radius: 420, intensity: 0.25 },
  ],
  exits: [{
    id: 'tor', poly: [[588, 706], [680, 706], [680, 720], [588, 720]], to: 'e2-lager-alarm', spawn: 'zelt',
    when: () => false, blocked: 'Da raus? Mitten in die Schwarzröcke? Nein.',
  }],
  spawns: { zelt: { at: TENT, dir: 'down' } },
  time: 'night',
  ambience: ['night', 'camp', 'battle-far'],
  ambienceVolume: { 'battle-far': 0.7, camp: 0.5, night: 0.6 },
  music: 'dread',
  playerLight: 50,
  resetOnEnter: true,
});

async function gateFight(w: WorldCtx): Promise<void> {
  const pairs: [string, string][] = [['e2-torwache-1', 'e2-schwarzrock-1'], ['e2-torwache-2', 'e2-schwarzrock-2']];
  for (let i = 0; w.alive && !G.state.is('e2-alarm-fertig'); i++) {
    const [a, b] = pairs[i % 2];
    const hitter = i % 3 === 0 ? b : a;
    bg(w.actor(hitter).play('attack', { once: true }));
    sfx(i % 2 ? 'block' : 'hit', { volume: 0.4, distance: 0.5, key: 'tor' });
    await w.wait(900 + (i % 3) * 350);
  }
}

async function alarmIntro(w: WorldCtx): Promise<void> {
  const kyra = w.actor('kyra'), elnon = w.actor('elnon');
  const g1 = w.actor('e2-torwache-1'), g2 = w.actor('e2-torwache-2');
  w.player.setIdle('lie');
  kyra.setIdle('kneel');
  kyra.face('player');
  await G.ui.narrate(['Kurz vor dem Morgengrauen, als selbst die Wachen gähnten, riss ein Horn das Lager aus dem Schlaf.'], { style: 'card' });
  sfx('alert', { volume: 0.8 });
  void ui().fade('in', 900);
  await w.cutscene(async () => {
    await w.say('kyra', 'Lia! Hoch! Am Tor schreien sie!', { mood: 'scared' });
    w.player.setIdle('kneel');
    await w.wait(400);
    w.player.setIdle('idle');
    kyra.setIdle('idle');
    await w.say('e2-posten', 'Schwarzröcke! Am Tor! Alle Mann zum Tor!');
    w.actor('e2-schwarzrock-1').show();
    w.actor('e2-schwarzrock-2').show();
    for (const a of [elnon, g1, g2]) a.hold(true);
    bg(g1.walkTo(604, 612, { run: true, face: 'down' }));
    bg(g2.walkTo(662, 612, { run: true, face: 'down' }));
    await w.camera.pan([636, 520], 900);
    sfx('sword-draw', { volume: 0.6 });
    await elnon.walkTo(632, 560, { run: true, face: 'down' });
    bg(gateFight(w));
    w.camera.shake(260, 0.004);
    await w.say('elnon', 'Bogen auf die Palisade! Wer keine Waffe hat, bleibt in Deckung!', { mood: 'angry' });
    await w.camera.pan(TENT, 800);
    await w.say('kyra', 'Flick ist am Feuer. Sie hat ihren Bogen schon in der Hand. Komm!', { mood: 'determined' });
    await w.think('Keine Urmacht. Kein Kribbeln in den Fingern. Seit der Prüfung bin ich innen hohl wie ein leeres Fass.');
  });
  w.camera.follow();
  w.despawn('kyra');
  w.companions.add('kyra');
}

async function talkFoltan(w: WorldCtx): Promise<void> {
  const foltan = w.actor('foltan');
  if (G.state.flag('e2-alarm-foltan')) {
    await foltan.say(G.state.flag<string>('e2-alarm-foltan') === 'weg' ? 'Lauft, wenn ich’s sage. Nicht vorher, nicht nachher.' : 'Geh. Und wenn du dich umdrehst, dann nur, um schneller zu laufen.');
    return;
  }
  foltan.face('player');
  await foltan.say('Lia! Was machst du hier vorn? Zurück, sofort!', { mood: 'angry' });
  if (G.state.flag<string>('e2-foltan-haltung') === 'kalt') await w.think('Gestern konnte ich ihn kaum ansehen. Jetzt sieht er nur das Tor. Und mich, für einen Atemzug.');
  const pick = await w.choose(['„Flick schickt uns hinten raus, zum Bach.“', '„Komm mit uns. Bitte.“']);
  if (pick === 0) {
    G.state.set('e2-alarm-foltan', 'weg');
    await foltan.say('Gut. Dann halte ich euch den Pfad dorthin frei. Lauft, wenn ich’s sage.', { mood: 'determined' });
  } else {
    G.state.set('e2-alarm-foltan', 'abschied');
    await foltan.say('Ich hab einmal zu oft geschwiegen, als ich hätte handeln sollen. Heute halte ich das Tor.', { mood: 'ashamed' });
    await foltan.say('Geh. Und wenn du dich umdrehst, dann nur, um schneller zu laufen.');
  }
}

async function talkAzar(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar');
  azar.face('player');
  if (G.state.is('e2-alarm-azar')) { await azar.say('Lauf, Kleine! Ich mach hier vorne Lärm für zwei.', { mood: 'determined' }); return; }
  if (G.state.is('e2-saebel')) {
    G.state.set('e2-alarm-azar');
    await lia(w, 'Lag auf der Werkbank. Zwischen Zangen und Hufnägeln.');
    await azar.say('Mein Säbel! Ein Freund in der Not ist mehr wert als zehn beim Brot.', { mood: 'happy' });
    await azar.say('Und jetzt lauf, Kleine. Ich mach hier vorne Lärm für zwei.', { mood: 'determined' });
    return;
  }
  await azar.say('Mein Säbel! Ich hab ihn gestern auf die Werkbank gelegt. Oder in den Kessel? Nein, das war der Löffel.', { mood: 'scared' });
  if (!G.state.is('e2-azar-sucht')) {
    G.state.set('e2-azar-sucht');
    await lia(w, 'Ich schau nach. Bleib, wo du bist.');
  }
}

async function takeSabre(w: WorldCtx): Promise<void> {
  G.state.set('e2-saebel');
  sfx('sword-draw', { volume: 0.4 });
  await w.think('Da liegt er, zwischen Zangen und Hufnägeln. Schwerer, als er aussieht. Wie fast alles hier.');
  w.setObjectiveTarget('azar');
}

async function talkFlick(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-alarm-fertig')) return;
  const flick = w.actor('flick');
  await w.cutscene(async () => {
    flick.face('player');
    await w.say('flick', 'Da seid ihr. Gut. Hört zu, ich sag’s nur einmal.', { mood: 'determined' });
    await w.say('flick', 'Hinter dem Turm läuft der Bach unter der Palisade durch. Da passt ihr zwei durch, wenn ihr nass werden wollt.');
    await w.say('flick', 'Ihr verschwindet. Ich sorge dafür, dass euch keiner nachläuft.');
    const pick = await w.choose([
      '„Komm mit uns!“',
      '„Ich lass dich nicht allein.“',
      '„Die wollen mich, nicht euch. Wenn ich zu ihnen gehe …“',
    ]);
    G.state.set('e2-alarm-flick', pick);
    if (pick === 0) await w.say('flick', 'Und wer schießt dann? Du? Du triffst ja nicht mal den Kessel.', { mood: 'smirk' });
    else if (pick === 1) await w.say('flick', 'Allein bin ich nie. Ich hab zwanzig Pfeile. Die reden sogar weniger als du.', { mood: 'smirk' });
    else await w.say('flick', 'Dich ausliefern? Dann hätte ich dich ja umsonst bis hierher geschleppt. Vergiss es.', { mood: 'angry' });
    await lia(w, 'Versprich mir, dass du nachkommst.', 'sad');
    await w.say('flick', 'Versprechen sind was für Leute mit Zeit. Aber ich bin schwer zu fangen. Frag Baris.', { mood: 'smirk' });
    await w.say('flick', 'Kyra. Pass auf sie auf.');
    await w.say('kyra', 'Mach ich schon mein ganzes Leben.', { mood: 'determined' });
    bg(flick.play('interact', { once: true }));
    sfx('sword-draw', { volume: 0.5 });
    await w.wait(500);
  });
  G.state.set('e2-alarm-fertig');
}

async function alarmScript(w: WorldCtx): Promise<void> {
  bg(w.lighting.set('dawn', 60000));
  await alarmIntro(w);
  w.setObjective('e2-alarm-flick', 'Lauf zu Flick ans Feuer.', 'flick');
  bg((async () => {
    const lines = ['Lia! Flick wartet!', 'Später gucken, jetzt rennen!', 'Die kommen gleich über den Zaun!'];
    for (let i = 0; w.alive && !G.state.is('e2-alarm-fertig'); i++) {
      await w.wait(9000);
      if (!G.state.is('e2-alarm-fertig') && !G.ui.busy()) w.bark('kyra', lines[i % lines.length], 2200);
    }
  })());
  await until(w, () => G.state.is('e2-alarm-fertig'));
  w.completeObjective('e2-alarm-flick');
  w.lockPlayer();
  await ui().fade('out', 800);
  halt(w, ['elnon', 'e2-torwache-1', 'e2-torwache-2', 'kyra']);
  await nextScene('e2-lagerangriff', { part: 'kampf' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: the battle
// ---------------------------------------------------------------------------------------------------------------

function startRaid(): void {
  G.stopGameplayScenes();
  ui().prefetchPlate('e2-trennung');
  void G.ui.fade('in', 900);
  G.game.scene.start('Tactics', {
    battle: raidBattle(),
    onEnd: async result => {
      if (result.outcome !== 'win') return;
      grantOnce('e2-ueberfall-gewonnen', () => G.state.set('e2-ueberfall-runden', result.rounds));
      // Only the attempt that counted: a fall in a lost try leaves nothing behind.
      G.state.set('e2-kyra-gestuerzt', result.flags.includes('e2-kyra-gestuerzt'));
      await G.ui.fade('out', 900);
      await nextScene('e2-lagerangriff', { part: 'flucht' });
    },
  } satisfies TacticsStartData);
}

// ---------------------------------------------------------------------------------------------------------------
// Part 3: the brook at night
// ---------------------------------------------------------------------------------------------------------------

const STUMBLE: [number, number] = [470, 196];
const KYRA_HIDE: [number, number] = [584, 226];
const LEDGE: [number, number] = [160, 134];

const bachNight: Partial<MapDef> = {
  interactables: [],
  props: [],
  clues: [],
  time: 'night',
  weather: 'fog',
  ambience: ['stream', 'night', 'wind'],
  ambienceVolume: { stream: 0.8, wind: 0.4, night: 0.7 },
  lights: [{ id: 'mond', at: [600, 0], kind: 'moon', radius: 300, intensity: 0.28 }],
  playerLight: 40,
  resetOnEnter: true,
};

/** The flight arrives at the brook clearing (cutscene map: no pursuers yet). */
export const bachFlucht: MapDef = defineMap({
  ...bach,
  ...bachNight,
  id: 'e2-bach-flucht',
  name: 'Am Bach, bei Nacht',
  npcs: [{ id: 'kyra', preset: 'kyra', at: [548, 8], dir: 'down', speed: 80 }],
  exits: [],
  spawns: { pfad: { at: [538, 22], dir: 'down' } },
  music: 'flight',
});

/** The same clearing while the pursuers search it: lanterns, ferns to duck into, the stones as the way out. */
export const bachLauf: MapDef = defineMap({
  ...bach,
  ...bachNight,
  id: 'e2-bach-lauf',
  name: 'Am Bach, bei Nacht',
  npcs: [{ id: 'kyra', preset: 'kyra', at: KYRA_HIDE, dir: 'left', idle: 'kneel', solid: false }],
  hidingSpots: [
    { id: 'farn-mitte', kind: 'bush', poly: [[392, 268], [470, 266], [470, 288], [392, 292]] },
    { id: 'farn-west', kind: 'bush', poly: [[236, 262], [330, 268], [330, 290], [238, 282]] },
  ],
  occluders: [
    { id: 'farn-vorn', baseline: 330, fade: 0.6, poly: [[220, 280], [360, 294], [470, 288], [540, 280], [600, 300], [600, 360], [200, 360]] },
  ],
  guards: [
    {
      id: 'verfolger-1', preset: 'shadow-sword', lantern: true, mode: 'loop', range: 80, fov: 70, reaction: 1.6,
      suspiciousBarks: ['Da war was …'], calmBarks: ['Nur ein Reh.'],
      path: [{ at: [540, 14], wait: 1600, face: 'down' }, { at: [522, 150], wait: 1400, face: 'down' }, { at: [556, 212], wait: 2600, face: 'right' }, { at: [520, 178], wait: 1200, face: 'left' }],
    },
    {
      id: 'verfolger-2', preset: 'shadow-club', lantern: true, mode: 'pingpong', range: 80, fov: 70, reaction: 1.6,
      suspiciousBarks: ['Wer da?'], calmBarks: ['Nichts. Weiter.'],
      path: [{ at: [528, 40], wait: 3200, face: 'down' }, { at: [430, 192], wait: 2000, face: 'down' }, { at: [330, 204], wait: 2600, face: 'left' }, { at: [252, 236], wait: 2000, face: 'down' }],
    },
  ],
  triggers: [{ id: 'steine', poly: [[134, 124], [200, 116], [208, 148], [152, 154]] }],
  exits: [{
    id: 'pfad', poly: [[516, 0], [562, 0], [562, 8], [516, 8]], to: 'e2-bach-lauf', spawn: 'flucht',
    when: () => false, blocked: 'Da oben sind die Fackeln. Zurück geht nicht.',
  }],
  spawns: { flucht: { at: [468, 214], dir: 'left' } },
  sneak: true,
  music: 'flight',
});

async function kyraStaysBack(w: WorldCtx): Promise<void> {
  const kyra = w.actor('kyra');
  kyra.hold(true);
  void ui().fade('in', 700);
  await w.cutscene(async () => {
    await Promise.all([
      w.player.walkTo(STUMBLE[0], STUMBLE[1], { run: true }),
      kyra.walkTo(STUMBLE[0] + 34, STUMBLE[1] - 8, { run: true }),
    ]);
    sfx('fall', { volume: 0.7 });
    await kyra.play('hit', { ms: 400 });
    kyra.setIdle('kneel');
    w.player.face('kyra');
    await w.say('kyra', 'Mist! Mist, Mist, Mist!', { mood: 'pained' });
    await w.say('kyra', G.state.is('e2-kyra-gestuerzt')
      ? 'Der Knöchel. Hat schon am Zaun geknackt. Jetzt will er nicht mehr.'
      : 'Eine Wurzel. Natürlich eine Wurzel. Der ganze Wald besteht aus Wurzeln.', { mood: 'pained' });
    w.player.setIdle('kneel');
    await lia(w, 'Komm, stütz dich auf mich. Wir schaffen das zusammen.', 'determined');
    bg(kyra.hop());
    await w.wait(300);
    await w.say('kyra', 'Geht nicht. Lauf du.', { mood: 'sad' });
    const pick = await w.choose(['„Ich bleib bei dir.“', '„Dann trag ich dich eben.“', '„Ich hol Hilfe und komm zurück.“']);
    G.state.set('e2-flucht-wahl', pick);
    if (pick === 0) await w.say('kyra', 'Und dann? Sitzen wir zu zweit im Gras und warten, bis sie uns aufsammeln?', { mood: 'angry' });
    else if (pick === 1) await w.say('kyra', 'Du? Du schnaufst schon beim Holzholen. Mich trägst du keine zehn Schritte.', { mood: 'smirk' });
    else await w.say('kyra', 'Genau. Hol Hilfe. Aber dafür musst du auch wirklich weglaufen, nicht nur ein bisschen.', { mood: 'determined' });
    sfx('branch-snap', { distance: 0.6 });
    await w.wait(500);
    await w.say('narrator', 'Oben am Pfad tanzen Lichter zwischen den Stämmen. Stimmen. Stiefel im Laub.');
    await w.say('kyra', 'Die wollen dich, Lia. Nicht mich. Mich haben sie schon mal verwechselt. Das klappt bestimmt wieder.', { mood: 'smirk' });
    await lia(w, 'Kyra …', 'sad');
    await w.say('kyra', 'Lauf! Zu den Steinen und den Bach hinunter. Ich mach Lärm. Lärm kann ich.', { mood: 'determined' });
    w.player.setIdle('idle');
    await lia(w, 'Ich hol dich da raus. Hörst du? Ich hol dich.', 'determined');
    await w.say('kyra', 'Weiß ich doch. Und jetzt weg!', { mood: 'happy' });
  });
  await w.changeMap(bachLauf, 'flucht', { fadeMs: 500 });
}

async function slipAway(w: WorldCtx): Promise<void> {
  w.lockPlayer();
  await w.say('narrator', `Duck dich im Farn (${w.controlHint('sneak')} halten) und lauf erst, wenn die Laternen wegsehen.`);
  w.unlockPlayer();
  w.setObjective('e2-flucht-steine', 'Zu den Steinen am Bach. Bleib aus dem Laternenlicht.', LEDGE);
  const unsub = w.onMap('spotted', '*', () => { w.bark('kyra', 'He! Hier drüben, ihr Blindfische!', 2000); });
  bg((async () => {
    const lines = ['Hier bin ich, ihr Kohlköpfe!', 'Kommt doch! Oder seid ihr festgewachsen?', 'Was ist, traut ihr euch nicht?'];
    for (let i = 0; w.alive && !G.state.is('e2-flucht-entkommen'); i++) {
      await w.wait(5200);
      if (!G.state.is('e2-flucht-entkommen') && !G.ui.busy()) w.bark('kyra', lines[i % lines.length], 2000);
    }
  })());
  await w.waitForTrigger('steine');
  G.state.set('e2-flucht-entkommen');
  unsub();
  w.completeObjective('e2-flucht-steine');
}

async function separation(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    w.stealth.enable(false);
    w.player.face('right');
    await w.think('Hinter mir: Laternen. Kyras Stimme, frech wie immer. Dann ein Ruf. Dann nichts mehr.');
    await lia(w, 'Kyra …', 'sad');
    await w.player.walkTo(LEDGE[0] - 20, LEDGE[1] - 4);
  });
  w.lockPlayer();
  await interlude('Unterdessen, im Lager der Bruderschaft …');
  await G.ui.plate('e2-trennung', { caption: 'Das Lager im Morgengrauen', pan: 'in', durationMs: 26000 });
  await ui().fade('in', 600);
  await G.ui.say('narrator', 'Das Tor ist gefallen. Flick und Elnon knien gefesselt vor der Palisade, daneben ein junger Rebell, der auf seine Stiefel starrt.');
  await G.ui.say('e2-flick', 'Sag mir, dass die zwei durch sind.', { mood: 'worried' });
  await G.ui.say('e2-elnon', 'Ich hab den Bach gehört und keine Schreie von dort. Mehr weiß ich nicht.', { mood: 'grim' });
  await G.ui.say('narrator', 'Baris tritt durch das Tor. Das Fackellicht liegt auf seiner verbrannten Gesichtshälfte.');
  await G.ui.say('e2-baris', 'Wen habt ihr mir da angeschleppt? Ich will die vom Feuer sehen.', { mood: 'angry' });
  await G.ui.say('dunkelschatten', 'Hauptmann! Die hier hat sich am Bach verkrochen. Und gebissen hat sie auch!');
  await G.ui.say('kyra', 'Und ich bin noch lang nicht fertig mit euch!', { mood: 'angry' });
  await G.ui.say('e2-baris', 'Dasselbe Gesicht. Zweimal in der Hand, zweimal die Falsche. Der Meister wird lachen. Ich nicht.', { mood: 'angry' });
  await G.ui.say('e2-baris', 'Und das Spitzohr von der Eiche über den Feldern. Wir zwei haben noch was offen.');
  await G.ui.say('e2-flick', 'Na, Hauptmann? Diesmal ohne Flug ins Kornfeld?', { mood: 'smirk' });
  await G.ui.say('e2-baris', 'Bindet sie zu den anderen. Der Meister wird Verwendung für sie finden.');
  await G.ui.closePlate();
  await ui().fade('out', 500);
}

async function collapse(w: WorldCtx): Promise<void> {
  w.player.teleport([LEDGE[0] - 10, LEDGE[1] - 2], 'left');
  w.player.setIdle('idle');
  ambience(['stream', 'night'], { stream: 0.9, night: 0.5 });
  G.audio.music(null, { fadeMs: 1500 });
  bg(w.lighting.set('night', 0));
  await ui().fade('in', 1200);
  await w.cutscene(async () => {
    await w.player.walkTo(LEDGE[0] - 30, LEDGE[1] - 10, { speed: 18 });
    await w.think('Dem Bach nach. Immer dem Bach nach. Nur kurz ausruhen. Nur ganz kurz.');
    sfx('fall', { volume: 0.6 });
    bg(w.player.play('fall'));
    w.player.setIdle('lie');
    await w.wait(900);
  });
  await ui().fade('out', 2200);
  for (const d of [0.8, 0.6, 0.45, 0.3, 0.2]) { sfx('step-dirt', { distance: d, volume: 0.8 }); await w.wait(480); }
  await w.wait(500);
  await G.ui.narrate(['Schritte im Laub. Jemand kniet sich neben sie. Eine warme Hand, ein Geruch nach Rauch und Minze. Dann nichts mehr.'], { style: 'card' });
}

async function fluchtScript(w: WorldCtx): Promise<void> {
  await kyraStaysBack(w);
  await slipAway(w);
  await separation(w);
  await collapse(w);
  G.state.setParty([]);
  G.state.set('e2-getrennt');
  halt(w, ['kyra']);
  await nextScene('e2-der-fremde');
}

// ---------------------------------------------------------------------------------------------------------------

export const scene = e2Scene('e2-lagerangriff', 'Überfall im Morgengrauen', async params => {
  const part = params?.part;
  if (part === 'kampf') { startRaid(); return; }
  await ui().fade('out', 0);
  if (part === 'flucht') {
    await startWorld({ map: bachFlucht, spawn: 'pfad', player: liaLook(), companions: [], fadeIn: false, script: fluchtScript });
    return;
  }
  await startWorld({ map: lagerAlarm, spawn: 'zelt', player: liaLook(), companions: [], fadeIn: false, script: alarmScript });
});

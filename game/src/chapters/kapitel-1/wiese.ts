// Scene `wiese` (DESIGN.md §7.4, Kapitel I/1): Lia reads under the old oak, Kyra comes back angry from gathering
// firewood, banter with choices, the promise to feed the pigs. Then free exploration: the fledgling (Spurenblick),
// cornflowers for Mother, apples. Map: 1280×720 painted meadow (assets/bg/k1-wiese.png).
import type { CharAnim } from '../../art/api';
import { G } from '../../core/G';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { ambience, carry, sfx, ui } from './shared';

const OAK_SEAT: [number, number] = [500, 470];

export const wieseMap: MapDef = defineMap({
  id: 'k1-wiese',
  name: 'Die Wiese',
  background: 'k1-wiese',
  walk: [[
    [0, 154], [120, 150], [244, 142], [256, 100], [298, 100], [308, 140], [420, 138], [520, 130], [640, 122], [700, 74],
    [800, 96], [880, 128], [960, 164], [1040, 198], [1120, 228], [1200, 252], [1280, 266], [1280, 720], [0, 720],
  ]],
  block: [
    { id: 'eiche', poly: [[452, 420], [478, 400], [540, 398], [566, 420], [554, 448], [478, 452]] },
    { id: 'birke', poly: [[438, 116], [454, 116], [454, 128], [438, 128]] },
    { id: 'apfel-a', poly: [[1034, 346], [1060, 346], [1062, 364], [1032, 364]] },
    { id: 'apfel-b', poly: [[1174, 428], [1200, 428], [1202, 446], [1172, 446]] },
    { id: 'busch-west', poly: [[0, 468], [80, 466], [100, 508], [60, 522], [0, 522]] },
    { id: 'busch-sw', poly: [[146, 568], [300, 562], [322, 590], [300, 602], [146, 604]] },
  ],
  occluders: [
    { id: 'eiche', baseline: 448, fade: 0.4, poly: [[326, 300], [342, 232], [400, 182], [480, 160], [580, 164], [660, 200], [716, 280], [702, 350], [642, 386], [576, 382], [566, 440], [476, 452], [440, 440], [440, 386], [380, 376], [332, 346]] },
    { id: 'apfel-a', baseline: 362, fade: 0.5, poly: [[964, 290], [990, 240], [1046, 224], [1106, 240], [1126, 300], [1092, 344], [1062, 352], [1060, 364], [1034, 364], [1030, 348], [986, 340]] },
    { id: 'apfel-b', baseline: 444, fade: 0.5, poly: [[1100, 370], [1122, 320], [1180, 300], [1250, 318], [1272, 370], [1240, 414], [1202, 420], [1200, 446], [1174, 446], [1170, 420], [1122, 410]] },
    { id: 'wald', baseline: 146, fade: 0.6, poly: [[0, 0], [690, 0], [690, 60], [600, 108], [480, 118], [420, 128], [310, 134], [300, 98], [252, 98], [240, 138], [120, 148], [0, 156]] },
    { id: 'birke', baseline: 127, poly: [[420, 60], [445, 48], [472, 70], [466, 110], [456, 128], [434, 128], [424, 100]] },
    { id: 'busch-sw', baseline: 600, fade: 0.6, poly: [[130, 560], [150, 524], [210, 518], [300, 528], [326, 568], [320, 602], [140, 604]] },
    { id: 'busch-west', baseline: 520, fade: 0.6, poly: [[0, 430], [50, 418], [96, 440], [104, 500], [60, 524], [0, 524]] },
  ],
  surfaces: [
    { id: 'pfad', kind: 'path', poly: [[600, 412], [700, 430], [800, 470], [900, 520], [1040, 560], [1160, 600], [1240, 640], [1280, 650], [1280, 690], [1220, 670], [1140, 630], [1020, 590], [880, 548], [780, 500], [680, 456], [600, 440]] },
    { id: 'waldpfad', kind: 'path', poly: [[256, 100], [298, 100], [300, 150], [256, 150]] },
  ],
  props: [
    { id: 'nest', prop: 'bird-nest', at: [449, 100], collide: false },
    // Preloaded here, placed by the script (the dropped book, Kyra's firewood, the full nest, the fledgling).
    { id: 'preload-a', prop: 'alana-book', at: [-50, -50], collide: false, alpha: 0 },
    { id: 'preload-b', prop: 'twigs', at: [-50, -50], collide: false, alpha: 0 },
    { id: 'preload-c', prop: 'bird-nest-fledgling', at: [-50, -50], collide: false, alpha: 0 },
    { id: 'preload-d', prop: 'bird-nest-chick', at: [-50, -50], collide: false, alpha: 0 },
  ],
  npcs: [
    { id: 'kyra', preset: 'kyra', at: [276, 112], dir: 'down', hidden: true, facePlayer: true },
  ],
  interactables: [
    {
      id: 'buch', verb: 'Aufheben', at: [540, 486], radius: 22, sparkle: true, once: true,
      when: () => G.state.is('k1-versprochen') && !G.state.is('k1-buch-aufgehoben'), onInteract: pickUpBook,
    },
    {
      id: 'kornblumen', verb: 'Pflücken', sparkle: true, item: { id: 'flowers' },
      poly: [[880, 140], [960, 170], [1010, 192], [1004, 210], [950, 192], [874, 160]],
      thought: 'Kornblumen. Mutters Lieblingsblumen – die stelle ich ihr heute Abend auf den Tisch.',
    },
    {
      id: 'aepfel-a', verb: 'Aufsammeln', sparkle: true, item: { id: 'apple', n: 2 },
      poly: [[996, 366], [1070, 366], [1074, 386], [992, 386]], thought: 'Fallobst. Zwei sind noch ganz – der Rest ist für die Wespen.',
    },
    {
      id: 'aepfel-b', verb: 'Aufsammeln', sparkle: true, item: { id: 'apple', n: 1 },
      poly: [[1150, 454], [1214, 454], [1216, 474], [1148, 474]], thought: 'Noch einer. Rotbackig und warm von der Sonne.',
    },
    {
      id: 'nest-ziel', verb: 'Zurücksetzen', at: [449, 132], radius: 26, standAt: [449, 140], face: 'up', once: true,
      when: () => G.state.is('k1-kueken') && !G.state.is('k1-nest'), onInteract: returnChick,
    },
    {
      id: 'eiche', verb: 'Ansehen', at: [506, 452], radius: 18, once: false,
      when: () => G.state.is('k1-buch-aufgehoben'),
      thought: 'Mein Lesebaum. Kyra findet mich hier jedes Mal. Ich sollte mir einen neuen suchen.',
    },
  ],
  clues: [
    { id: 'feder-1', at: [414, 158], kind: 'mark', angle: 200, thought: 'Eine winzige Daunenfeder …' },
    { id: 'feder-2', at: [360, 172], kind: 'mark', angle: 210, thought: 'Noch eine. Sie führen vom Baum weg.' },
    { id: 'kueken', at: [304, 194], kind: 'mark', verb: 'Aufheben', onInteract: pickUpChick },
  ],
  triggers: [
    { id: 'piepen', poly: [[270, 140], [560, 140], [560, 280], [270, 280]], when: () => G.state.is('k1-buch-aufgehoben'), onEnter: chirp },
    { id: 'heimgehen', once: false, poly: [[1236, 600], [1280, 600], [1280, 712], [1236, 712]], onEnter: goHome },
  ],
  spawns: {
    start: { at: OAK_SEAT, dir: 'down' },
    ost: { at: [1210, 640], dir: 'left' },
  },
  depthScale: { y0: 120, s0: 0.94, y1: 720, s1: 1.04 },
  time: 'day',
  weather: 'pollen',
  ambience: ['wind', 'birds', 'crickets'],
  ambienceVolume: { crickets: 0.4 },
  music: 'exploration',
  lookMode: false,
  onEnter: async w => {
    if (G.state.is('k1-kueken')) w.prop('kueken-prop').remove();
    if (G.state.is('k1-nest') && w.prop('nest').exists) { w.prop('nest').remove(); w.addProp({ id: 'nest-voll', prop: 'bird-nest-fledgling', at: [449, 100], collide: false }); }
    if (G.state.knows('spurenblick')) w.lookMode.enable(true);
  },
});

/** The fledgling sits in the grass; only Spurenblick (or sharp eyes) finds it. */
const CHICK_AT: [number, number] = [304, 196];

export async function wieseScript(w: WorldCtx): Promise<void> {
  if (!w.prop('kueken-prop').exists && !G.state.is('k1-kueken')) w.addProp({ id: 'kueken-prop', prop: 'bird-nest-chick', at: CHICK_AT, collide: false });
  if (G.state.is('k1-versprochen')) {
    // Resumed (save/continue): the opening already happened.
    w.player.setIdle('idle');
    if (!G.state.is('k1-buch-aufgehoben')) {
      w.addProp({ id: 'buch-prop', prop: 'alana-book', at: [540, 486], collide: false });
      w.setObjective('k1-buch', 'Heb dein Buch auf.', 'buch');
    }
    else w.setObjective('k1-heim', 'Geh nach Hause und füttere die Schweine.', 'heimgehen');
    return;
  }
  await opening(w);
}

async function opening(w: WorldCtx): Promise<void> {
  const kyra = w.actor('kyra');
  w.player.setIdle('sit-read' as CharAnim);
  w.player.face('right');
  ui().prefetchPlate('wiese-lia-liest');
  await w.cutscene(async () => {
    await G.ui.plate('wiese-lia-liest', { caption: 'Der letzte Sommertag', pan: 'in', durationMs: 18000 });
    await G.ui.fade('in', 1100);
    await w.narrate([
      'Sechzehn Sommer waren vergangen. Der letzte davon war heiß und trocken; seit Tagen war kein Regen gefallen.',
      'Lia saß barfuß unter der alten Eiche und las. Die Welt in ihren Büchern war immer größer gewesen als die echte.',
    ]);
    await w.say('lia', '„… und Alana hob die Hand, und das Licht gehorchte ihr.“', { mood: 'happy' });
    await w.think('Ach, wenn es so etwas doch wirklich gäbe. Hier passiert nie etwas.');
    await G.ui.closePlate();

    // Kyra comes out of the wood with an armful of firewood.
    await w.camera.pan([300, 200], 900);
    kyra.show();
    const dropWood = await carry(w, 'kyra', 'twigs', -18);
    await kyra.walkTo(290, 190);
    void kyra.emote('anger', 1200);
    kyra.bark('Na warte, wenn ich dich erwische …', 2600);
    await w.wait(1200);
    dropWood();
    w.addProp({ id: 'reisig', prop: 'twigs', at: [306, 196], collide: false });
    sfx('thud', { volume: 0.5 });
    await w.wait(300);
    // She sneaks around the oak and tickles her sister.
    await kyra.walkPath([[360, 300], [430, 470]], { speed: 34 });
    await w.camera.pan(OAK_SEAT, 700);
    kyra.face('right');
    await w.wait(500);
    sfx('rustle');
    await w.player.hop();
    w.player.setIdle('idle');
    void w.player.emote('!', 900);
    w.player.bark('Hihi – Kyra! Hör auf!', 1800);
    await w.player.walkTo(520, 478, { speed: 60 });
    w.player.face('left');
    await kyra.walkTo(474, 476, { speed: 50 });
    kyra.face('player');
    w.addProp({ id: 'buch-prop', prop: 'alana-book', at: [540, 486], collide: false });
    await w.wait(600);

    await w.say('lia', 'Was sollte das denn?', { mood: 'surprised' });
    await kyra.say('Wer faulenzt, hat es nicht anders verdient.', { mood: 'happy' });
    await kyra.say('Weißt du, was ich interessant finde? Dass ich das ganze Feuerholz gesammelt habe, während du hier rumgesessen und gelesen hast.', { mood: 'angry' });
    const a = await w.choose([
      '„Ich wollte gleich nachkommen. Ehrlich.“',
      '„Es war gerade so spannend! Alana wollte nämlich …“',
      '„Holz sammeln kannst du eben besser. Jeder hat seine Talente.“',
    ]);
    if (a === 0) {
      G.state.set('k1-wiese-ton', 'reuig');
      await kyra.say('Ja. Vor zwei Stunden. Schau mal, wo die Sonne steht.', { mood: 'angry' });
      await w.say('lia', 'Herrje … Tut mir leid. Ich hab die Zeit völlig vergessen.', { mood: 'sad' });
      await kyra.say('So wie immer.');
    } else if (a === 1) {
      G.state.set('k1-wiese-ton', 'schwaermerisch');
      await kyra.say('Verschon mich mit deinen Geschichten. Komm mal im echten Leben an.', { mood: 'angry' });
    } else {
      G.state.set('k1-wiese-ton', 'frech');
      void kyra.emote('anger');
      await kyra.say('Und deins ist Rumsitzen? Pass auf, sonst kitzle ich dich gleich noch mal.', { mood: 'angry' });
      await w.say('lia', 'Bloß nicht! Ich ergebe mich!', { mood: 'happy' });
    }
    await kyra.say('Sieh dich mal um. Das hier ist das wahre Leben. Nicht das da.');
    await w.say('lia', 'Aber hier ist es so öde. Da drin gibt es mutige Helden, Magierinnen und fahrende Ritter.', { mood: 'thinking' });
    await kyra.say('Sei froh, dass es hier so öde ist. Seit Dunkelhain ist man nirgends mehr sicher.', { mood: 'sad' });
    await kyra.say('Die Fürsten schützen nur noch ihre Städte. Ein Wunder, dass Räuber und Dunkelschatten uns bisher verschont haben.');
    G.state.addLore('lore-nach-dunkelhain');
    const b = await w.choose([
      '„Siehst du? Selbst denen ist es hier zu langweilig.“',
      '„Du klingst wie Vater.“',
    ]);
    if (b === 0) {
      await kyra.say('Lia!', { mood: 'angry' });
      await w.say('lia', 'Ja, ja. Hast ja recht.');
    } else {
      await kyra.say('Einer von uns muss ja vernünftig sein. Und du bist es nicht.', { mood: 'happy' });
    }
    await kyra.say('Du schuldest mir übrigens was. Für das ganze Holz.');
    const c = await w.choose([
      '„Na gut. Ich füttere heute Abend die Schweine. Versprochen.“',
      '„Ich füttere die Schweine. Und miste vielleicht sogar aus.“',
    ]);
    if (c === 1) {
      G.state.set('k1-ausmisten');
      void kyra.emote('heart');
      await kyra.say('Ausmisten? Du? Das will ich sehen!', { mood: 'happy' });
    }
    await kyra.say('Gut. Das hoffe ich für dich. Sonst werde ich wirklich böse.');
    G.state.set('k1-versprochen');
    await kyra.say('Kommst du mit? Mutter macht sich Sorgen, wenn wir nicht pünktlich zum Abendbrot sind.');
    await w.say('lia', 'Geh schon vor. Ich bleibe noch kurz hier und …');
    await kyra.say('… lese. Hätte ich mir denken können.', { mood: 'happy' });
    await kyra.say('Aber denk an die Schweine! Du hast es versprochen.');
    await w.say('lia', 'Darauf kannst du dich verlassen. Ehrenwort.', { mood: 'happy' });

    // Kyra fetches her firewood and walks home along the path.
    w.camera.follow('kyra');
    await kyra.walkTo(306, 206);
    w.prop('reisig').remove();
    const wood = await carry(w, 'kyra', 'twigs', -18);
    w.camera.follow();
    void kyra.walkPath([[620, 430], [900, 530], [1250, 660]]).then(() => { wood(); if (w.actor('kyra').exists) w.despawn('kyra'); }).catch(() => wood());
    await w.wait(1400);
    await w.think('Nur diese eine Seite noch …');
    await w.wait(500);
    await w.think('Die Sonne blendet. Na gut, ich gebe mich geschlagen. Die Schweine warten.');
  });
  w.setObjective('k1-buch', 'Heb dein Buch auf.', 'buch');
}

async function goHome(w: WorldCtx): Promise<void> {
  if (!G.state.is('k1-versprochen')) return;
  if (!G.state.is('k1-buch-aufgehoben')) { w.bark('player', 'Mein Buch! Das lasse ich doch nicht im Gras liegen.', 2600); return; }
  w.setEnabled('heimgehen', false);
  w.lockPlayer();
  await G.ui.fade('out', 600);
  await G.goto('heimweg');
}

async function pickUpBook(w: WorldCtx): Promise<void> {
  await w.player.play('kneel', { ms: 600 });
  w.prop('buch-prop').remove();
  G.state.give('book-alana');
  G.state.set('k1-buch-aufgehoben');
  G.state.addLore('lore-alana');
  w.completeObjective('k1-buch');
  await w.think('Schnell in die Holzschuhe – und das Buch nicht vergessen. Beinahe hätte ich es liegen lassen.');
  w.setObjective('k1-heim', 'Geh nach Hause und füttere die Schweine.', 'heimgehen');
  await w.wait(900);
  await w.think('Mutter mag Kornblumen. Und unter den Apfelbäumen liegt bestimmt Fallobst.');
}

async function chirp(w: WorldCtx): Promise<void> {
  if (G.state.is('k1-kueken')) return;
  w.prop('nest').shake();
  w.bark('player', 'Piep? Da piept doch was …', 2200);
  await w.wait(900);
  await w.cutscene(async () => {
    await w.camera.pan([430, 150], 700);
    await w.think('Das Nest in der Birke. Zwei Küken sperren die Schnäbel auf – und da fehlt doch eins.');
    if (!G.state.knows('spurenblick')) {
      await w.think('Wenn ich ganz genau hinsehe, so wie die Fährtenleser in meinen Büchern …');
      G.state.learn('spurenblick');
      w.lookMode.enable(true);
      await w.say('narrator', `Halte ${w.controlHint('look')} gedrückt: Im Spurenblick verblasst die Welt, und Spuren leuchten auf.`);
    }
    w.camera.follow();
  });
  w.setObjectiveTarget('feder-1');
  w.onMap('clue', '*', id => {
    if (id === 'feder-1') w.setObjectiveTarget('feder-2');
    if (id === 'feder-2') w.setObjectiveTarget('kueken');
  });
}

async function pickUpChick(w: WorldCtx): Promise<void> {
  if (G.state.is('k1-kueken')) return;
  await w.player.play('kneel', { ms: 700 });
  w.prop('kueken-prop').remove();
  G.state.set('k1-kueken');
  await w.think('Da bist du ja, du kleiner Ausreißer. Ganz warm und zittrig. Keine Angst, ich bring dich heim.');
  w.setObjectiveTarget('nest-ziel');
}

async function returnChick(w: WorldCtx): Promise<void> {
  w.player.face('up');
  await w.player.play('interact', { ms: 900 });
  sfx('rustle');
  w.prop('nest').remove();
  w.addProp({ id: 'nest-voll', prop: 'bird-nest-fledgling', at: [449, 100], collide: false });
  w.fx.burst([449, 96], 'leaves', 6);
  G.state.set('k1-nest');
  G.state.addMemory('k1-mem-nest');
  await w.think('So. Alle drei wieder beisammen. Geschwister gehören zusammen.');
  w.setObjectiveTarget('heimgehen');
}

/** Ambient for direct warps and resumes: birds and wind already set by the map. */
export function wieseAmbience(): void { ambience(['wind', 'birds', 'crickets']); }

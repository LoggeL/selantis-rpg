// Painted demo maps of the world engine (geometry in map pixels, authored with the F1 overlay and
// `node scripts/map_tool.mjs dev-meadow`). Backgrounds: game/public/assets/bg/dev-meadow.png / dev-clearing.png.
import { G } from '../../core/G';
import { registerClues, registerItems } from '../../core/catalog';
import type { MapDef, WorldCtx } from '../../world/api';
import { defineMap } from '../../world/maps';

registerItems([
  { id: 'dev-kornblumen', name: 'Kornblumen', icon: 'flowers', description: 'Ein kleiner Strauß, blau wie Mutters Schürze.', comment: 'Die stelle ich ihr auf den Tisch.' },
  { id: 'dev-muenze', name: 'Alte Münze', icon: 'coins', description: 'Eine angelaufene Kupfermünze mit einer eingeritzten Feder.', comment: 'Wer verliert denn so etwas auf der Wiese?' },
]);
registerClues([
  { id: 'dev-spuren', title: 'Kleine Fußspuren', text: 'Barfußspuren führen vom Weiher quer über die Wiese. Jemand war in Eile.' },
]);

// ---------------------------------------------------------------------------------------------------------------
// Map 1: late-summer meadow (1280×720, scrolling)
// ---------------------------------------------------------------------------------------------------------------

export const meadow: MapDef = defineMap({
  id: 'dev-meadow',
  name: 'Die Wiese am Hof',
  background: 'dev-meadow',
  walk: [[
    [0, 246], [40, 229], [100, 200], [160, 174], [230, 142], [300, 112], [360, 90], [420, 72], [500, 54], [560, 40],
    [620, 26], [690, 10], [840, 10], [968, 10], [968, 92], [1072, 104], [1112, 104], [1118, 124], [1176, 124],
    [1240, 132], [1280, 134], [1280, 720], [0, 720],
  ]],
  block: [
    { id: 'eiche', poly: [[424, 346], [448, 334], [496, 334], [522, 348], [516, 372], [470, 380], [426, 370]] },
    { id: 'weiher', sight: false, poly: [[0, 418], [50, 410], [110, 405], [170, 410], [215, 425], [228, 446], [256, 478], [278, 492], [278, 524], [250, 550], [190, 560], [120, 556], [60, 552], [0, 548]] },
    { id: 'hecke-west', poly: [[744, 200], [760, 184], [1076, 184], [1078, 250], [762, 252], [744, 240]] },
    { id: 'hecke-ost', poly: [[1130, 204], [1280, 200], [1280, 262], [1130, 258]] },
    { id: 'baum-hof', poly: [[852, 10], [962, 10], [956, 58], [906, 72], [862, 58]] },
    { id: 'bluehbusch', poly: [[708, 166], [784, 164], [792, 182], [714, 186]] },
    { id: 'baumstamm', sight: false, poly: [[1086, 562], [1110, 550], [1226, 596], [1232, 626], [1210, 634], [1088, 582]] },
    { id: 'gebuesch-sw', poly: [[0, 604], [66, 594], [118, 622], [112, 680], [70, 720], [0, 720]] },
  ],
  occluders: [
    // The old oak: crown and trunk. Lia walks behind the trunk; the crown turns see-through over her.
    { id: 'eiche', baseline: 368, fade: 0.38, poly: [[272, 262], [282, 206], [300, 156], [332, 116], [382, 78], [452, 54], [532, 58], [600, 96], [662, 140], [694, 200], [700, 252], [680, 292], [636, 314], [588, 304], [540, 300], [524, 340], [530, 372], [470, 384], [416, 372], [408, 336], [404, 300], [350, 314], [300, 300]] },
    { id: 'hecke-west', baseline: 248, poly: [[742, 190], [760, 172], [800, 166], [880, 165], [960, 166], [1040, 168], [1078, 174], [1080, 252], [760, 254], [742, 240]] },
    { id: 'hecke-ost', baseline: 260, poly: [[1128, 196], [1150, 186], [1220, 182], [1280, 180], [1280, 264], [1128, 260]] },
    { id: 'bluehbusch', baseline: 184, poly: [[694, 150], [718, 124], [782, 126], [802, 158], [790, 186], [704, 186]] },
    { id: 'baumstamm', baseline: 630, poly: [[1080, 560], [1108, 540], [1170, 556], [1232, 590], [1240, 626], [1212, 638], [1084, 586]] },
    { id: 'busch-ost', baseline: 482, fade: 0.6, poly: [[1132, 424], [1166, 394], [1232, 394], [1272, 410], [1278, 470], [1232, 486], [1150, 482], [1128, 456]] },
    { id: 'busch-mitte', baseline: 600, fade: 0.6, poly: [[1004, 542], [1040, 510], [1092, 514], [1112, 546], [1102, 592], [1040, 602], [1004, 582]] },
    { id: 'busch-pfad', baseline: 614, fade: 0.6, poly: [[846, 592], [870, 568], [912, 570], [924, 600], [900, 618], [854, 614]] },
    { id: 'busch-west', baseline: 562, fade: 0.6, poly: [[758, 536], [786, 510], [822, 513], [838, 540], [816, 564], [770, 562]] },
    { id: 'vorne-sw', baseline: 720, poly: [[0, 560], [60, 556], [110, 590], [150, 640], [172, 690], [180, 720], [0, 720]] },
    { id: 'vorne-mitte', baseline: 720, fade: 0.6, poly: [[918, 690], [940, 664], [990, 660], [1016, 690], [1020, 720], [916, 720]] },
    { id: 'vorne-so', baseline: 720, fade: 0.6, poly: [[1108, 690], [1150, 656], [1220, 646], [1280, 640], [1280, 720], [1104, 720]] },
  ],
  surfaces: [
    { id: 'pfad', kind: 'path', poly: [[530, 720], [548, 640], [600, 560], [620, 470], [650, 410], [700, 360], [760, 330], [900, 310], [1060, 286], [1090, 250], [1086, 160], [1040, 130], [1120, 126], [1150, 150], [1130, 200], [1126, 260], [1200, 286], [1280, 280], [1280, 340], [1180, 320], [1060, 318], [900, 340], [770, 360], [700, 400], [660, 470], [640, 560], [606, 640], [590, 720]] },
    { id: 'hof', kind: 'dirt', poly: [[968, 92], [1072, 104], [1112, 104], [1118, 124], [1176, 124], [1240, 132], [1280, 134], [1280, 150], [1150, 150], [1040, 132], [968, 120]] },
    { id: 'schilf', kind: 'wheat', poly: [[0, 342], [70, 340], [140, 352], [205, 374], [270, 384], [332, 410], [376, 452], [386, 520], [362, 576], [300, 600], [220, 596], [150, 588], [80, 592], [0, 600]] },
  ],
  hidingSpots: [
    { id: 'busch-ost', kind: 'bush', poly: [[1140, 426], [1170, 400], [1230, 400], [1268, 414], [1272, 466], [1230, 480], [1152, 476], [1136, 454]] },
    { id: 'busch-mitte', kind: 'bush', poly: [[1010, 544], [1042, 516], [1090, 520], [1106, 548], [1098, 588], [1042, 596], [1010, 578]] },
    { id: 'busch-pfad', kind: 'bush', poly: [[852, 594], [872, 574], [908, 576], [918, 600], [898, 612], [858, 610]] },
    { id: 'busch-west', kind: 'bush', poly: [[764, 538], [788, 516], [820, 519], [832, 540], [814, 558], [772, 556]] },
  ],
  npcs: [
    {
      id: 'kyra', preset: 'kyra', at: [600, 452], dir: 'left', wander: 34,
      barks: ['Die Schweine haben Hunger …', 'Wo Vater nur bleibt?', 'Hörst du die Grillen?'], barkEvery: 6500,
      talk: talkKyra,
    },
  ],
  interactables: [
    { id: 'kornblumen', verb: 'Pflücken', item: { id: 'dev-kornblumen' }, sparkle: true, poly: [[326, 622], [352, 614], [384, 624], [386, 648], [352, 656], [324, 646]], thought: 'Für Mutter. Sie liebt dieses Blau.' },
    { id: 'wetterstein', verb: 'Berühren', once: false, radius: 40, poly: [[218, 450], [240, 440], [262, 452], [260, 474], [226, 476]], onInteract: toggleRain },
    {
      id: 'haustuer', verb: 'Klopfen', poly: [[1078, 52], [1108, 52], [1110, 98], [1078, 98]], radius: 24,
      standAt: [1094, 116], face: 'up', thought: 'Niemand da. Mutter ist sicher im Garten.',
    },
  ],
  clues: [
    { id: 'spur-1', at: [316, 592], kind: 'footprint', angle: 95 },
    { id: 'spur-2', at: [452, 618], kind: 'footprint', angle: 100 },
    { id: 'spur-3', at: [700, 640], kind: 'footprint', angle: 90, clue: 'dev-spuren', thought: 'Barfußspuren. Klein und schnell … jemand ist hier gerannt.' },
    { id: 'spur-4', at: [880, 652], kind: 'footprint', angle: 80 },
    { id: 'spur-5', at: [1062, 640], kind: 'glint', verb: 'Aufheben', onInteract: findCoin },
  ],
  guards: [
    {
      id: 'wache', preset: 'shadow-sword', speaker: 'wache', mode: 'pingpong', lantern: true,
      path: [{ at: [900, 320], wait: 1500, face: 'left' }, { at: [1030, 302], wait: 1600, face: 'down' }, { at: [1150, 298], wait: 2000, face: 'down' }],
      suspiciousBarks: ['Was war das?', 'Ist da wer?'], calmBarks: ['Nur der Wind.', 'Verfluchte Hasen.'],
    },
  ],
  lights: [{ id: 'fenster', at: [1034, 62], kind: 'window', radius: 40 }],
  exits: [{ id: 'nach-osten', poly: [[1262, 268], [1280, 268], [1280, 340], [1262, 340]], to: 'dev-clearing', spawn: 'sued' }],
  spawns: {
    start: { at: [566, 690], dir: 'up' },
    ost: { at: [1250, 304], dir: 'left' },
    'wiese-ost': { at: [930, 470], dir: 'up' },
  },
  stealth: { checkpoint: 'wiese-ost' },
  depthScale: { y0: 100, s0: 0.92, y1: 720, s1: 1.04 },
  time: 'day',
  weather: 'none',
  ambience: ['wind', 'birds', 'crickets'],
  ambienceVolume: { birds: 0.6 },
  music: 'exploration',
});

async function talkKyra(w: WorldCtx): Promise<void> {
  const kyra = w.actor('kyra');
  if (G.state.is('dev-kyra-talked')) {
    await kyra.say('Pass auf dich auf, hörst du? Und halte dich von dem Kerl am Hof fern.');
    return;
  }
  void kyra.emote('!', 900);
  await kyra.say('Da bist du ja! Hast du etwa schon wieder gelesen?');
  const pick = await w.choose(['„Nur ein Kapitel, ehrlich.“', '„Ich habe nachgedacht. Das ist etwas anderes.“']);
  if (pick === 0) {
    void kyra.emote('…');
    await kyra.say('Ein Kapitel. Natürlich. So wie gestern und vorgestern.');
  } else {
    void kyra.emote('anger');
    await kyra.say('Nachdenken mit einem Buch vor der Nase. Sehr überzeugend.');
  }
  await kyra.say('Am Hof steht ein Fremder mit Schwert. Wenn du vorbeimusst: duck dich und bleib in den Büschen.');
  await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt, um zu schleichen. Geduckt im Gebüsch oder im Schilf sieht dich niemand.`);
  G.state.set('dev-kyra-talked');
  w.completeObjective('dev-kyra');
  w.setObjective('dev-blumen', 'Pflücke Kornblumen für Mutter.', 'kornblumen');
  void w.lighting.set('dusk', 5000);
}

async function toggleRain(w: WorldCtx): Promise<void> {
  const raining = w.weather.kind === 'rain';
  w.weather.set(raining ? 'none' : 'rain', { ms: 2200 });
  w.fx.burst('wetterstein', 'sparkle', 6);
  w.bark('player', raining ? 'Der Regen hört auf.' : 'Regen! Endlich.');
}

async function findCoin(w: WorldCtx): Promise<void> {
  G.state.give('dev-muenze');
  await w.think('Eine Münze, halb im Gras. Die Spuren enden genau hier.');
  w.completeObjective('dev-spur');
  w.setObjective('dev-osten', 'Schleiche an der Wache vorbei nach Osten.', 'nach-osten');
  void w.lighting.set('night', 7000);
}

export async function meadowScript(w: WorldCtx): Promise<void> {
  G.state.setParty(['lia', 'flick']);
  if (!G.state.is('dev-kyra-talked')) w.setObjective('dev-kyra', 'Sprich mit Kyra unter der Eiche.', 'kyra');
  await w.wait(1200);
  w.bark('flick', 'Hübscher Hof. Ruhig hier.');
  await w.waitForInteract('kornblumen');
  w.completeObjective('dev-blumen');
  w.lookMode.enable(true);
  await w.wait(400);
  await w.say('narrator', `Halte ${w.controlHint('look')} gedrückt: Im Spurenblick leuchten Hinweise türkis auf.`);
  w.setObjective('dev-spur', 'Folge der Spur über die Wiese (Spurenblick).', 'spur-1');
  w.on('clue', '*', id => {
    const next: Record<string, string> = { 'spur-1': 'spur-2', 'spur-2': 'spur-3', 'spur-3': 'spur-4', 'spur-4': 'spur-5' };
    if (next[id]) w.setObjectiveTarget(next[id]);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Map 2: forest clearing at night (640×360, one screen, night painted in)
// ---------------------------------------------------------------------------------------------------------------

export const clearing: MapDef = defineMap({
  id: 'dev-clearing',
  name: 'Lichtung im Wald',
  background: 'dev-clearing',
  baked: 'night',
  walk: [[
    [150, 96], [205, 84], [330, 80], [420, 84], [500, 90], [560, 96], [600, 100], [640, 100], [640, 138], [590, 142],
    [560, 152], [545, 175], [548, 215], [520, 236], [470, 246], [420, 252], [398, 266], [388, 300], [392, 360],
    [318, 360], [316, 300], [304, 264], [270, 252], [220, 242], [172, 228], [152, 205], [150, 165], [158, 125],
  ]],
  block: [
    { id: 'feuerstelle', sight: false, poly: [[224, 148], [230, 136], [246, 130], [266, 130], [282, 136], [288, 148], [282, 162], [266, 168], [246, 168], [230, 162]] },
    { id: 'baumstamm', sight: false, poly: [[206, 106], [290, 102], [292, 122], [208, 124]] },
    { id: 'findling', poly: [[428, 182], [455, 168], [510, 162], [540, 176], [545, 206], [520, 222], [450, 222], [425, 206]] },
  ],
  occluders: [
    { id: 'findling', baseline: 218, fade: 0.6, poly: [[418, 186], [440, 160], [490, 150], [530, 156], [548, 176], [552, 210], [526, 226], [446, 226], [420, 210]] },
    { id: 'baumstamm', baseline: 112, poly: [[202, 98], [212, 88], [292, 88], [296, 112], [292, 124], [206, 126]] },
    { id: 'baum-ost', baseline: 196, poly: [[598, 0], [640, 0], [640, 204], [588, 200], [596, 160]] },
    { id: 'gebuesch-sw', baseline: 360, poly: [[0, 226], [120, 232], [180, 238], [240, 254], [300, 270], [314, 300], [310, 360], [0, 360]] },
    { id: 'gebuesch-so', baseline: 360, poly: [[396, 266], [430, 252], [500, 242], [560, 226], [640, 214], [640, 360], [398, 360], [392, 300]] },
  ],
  surfaces: [
    { id: 'erde', kind: 'dirt', poly: [[200, 130], [320, 120], [440, 130], [540, 120], [640, 104], [640, 136], [560, 150], [420, 200], [390, 260], [392, 360], [318, 360], [300, 250], [220, 200]] },
  ],
  surface: 'darkgrass',
  interactables: [
    {
      id: 'feuer', verb: 'Feuer entfachen', once: true, radius: 34, poly: [[224, 148], [230, 134], [256, 126], [282, 134], [288, 150], [266, 170], [242, 170]],
      standAt: [256, 196], face: 'up', onInteract: lightFire,
    },
    {
      id: 'sitzen', verb: 'Hinsetzen', once: false, poly: [[206, 98], [292, 94], [294, 122], [206, 126]],
      standAt: [250, 117], face: 'down', when: () => G.state.is('dev-feuer'), onInteract: sitDown,
    },
    { id: 'findling', verb: 'Untersuchen', poly: [[430, 176], [470, 160], [530, 162], [544, 200], [520, 220], [440, 218]], thought: 'Moos, weich wie ein Kissen. Hier hat schon lange niemand gerastet.' },
  ],
  lights: [
    { id: 'mond', at: [120, 30], kind: 'moon', radius: 220, intensity: 0.32 },
    { id: 'glut', at: [256, 150], kind: 'fire', radius: 26, intensity: 0.55 },
  ],
  exits: [
    { id: 'zur-wiese', poly: [[318, 346], [392, 346], [392, 360], [318, 360]], to: 'dev-meadow', spawn: 'ost' },
    { id: 'pfad-ost', poly: [[620, 100], [640, 100], [640, 138], [620, 138]], to: 'dev-meadow', when: () => false, blocked: 'Zu dunkel. Ohne Laterne verlaufe ich mich.' },
  ],
  spawns: { sued: { at: [354, 328], dir: 'up' } },
  time: 'night',
  weather: 'fireflies',
  ambience: ['night', 'crickets', 'wind'],
  ambienceVolume: { wind: 0.4 },
  playerLight: 70,
  onEnter: async w => {
    clearingRestore(w);
    if (!G.state.is('dev-feuer')) w.setObjective('dev-feuer', 'Entfache das Lagerfeuer.', 'feuer');
    if (G.state.is('dev-clearing-seen')) return;
    G.state.set('dev-clearing-seen');
    await w.wait(700);
    await w.think('So viele Glühwürmchen … als würden sie auf jemanden warten.');
  },
});

/** Lia kneels at the fire pit; a fire with light and flames appears (and stays: the map remembers the light flag). */
async function lightFire(w: WorldCtx): Promise<void> {
  await w.player.play('kneel', { ms: 1100 });
  w.fx.burst([256, 146], 'urmacht', 8);
  addCampfire(w, 0);
  await w.lighting.get('lagerfeuer').fadeTo(1.1, 900);
  try { G.audio.ambience([...G.audio.currentAmbience().filter(l => l !== 'fire'), 'fire'], { fadeMs: 1200 }); } catch { /* audio optional */ }
  G.state.set('dev-feuer');
  w.completeObjective('dev-feuer');
  w.setObjective('dev-sitzen', 'Setz dich ans Feuer.', 'sitzen');
  await w.think('Na also. Ganz ohne Zunder. Fast, als hätte das Feuer gewartet.');
}

function addCampfire(w: WorldCtx, intensity: number): void {
  w.lighting.add({ id: 'lagerfeuer', at: [256, 150], kind: 'fire', radius: 120, intensity, flame: 1, always: true });
}

async function sitDown(w: WorldCtx): Promise<void> {
  w.player.setIdle('sit');
  await w.wait(600);
  await w.think('Hier könnte man stundenlang lesen. Wenn Kyra nur nicht so laut schnarchen würde.');
  w.completeObjective('dev-sitzen');
  await w.wait(300);
  w.player.setIdle('idle');
}

/** Restores the burning fire on re-entry (runtime lights are not part of the map memory). */
function clearingRestore(w: WorldCtx): void {
  if (G.state.is('dev-feuer')) addCampfire(w, 1.1);
}

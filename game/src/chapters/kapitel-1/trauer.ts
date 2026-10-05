// Scene `trauer` (DESIGN.md §7.4, Kapitel I/4): night at the farm. Grief cards, carrying stones for two cairns (one
// memory per stone), the cornflowers for Mother, the dropped Alana book in the embankment, the morning tableau of the
// graves, packing the leather bag (limited room, consequences), Father's secret compartment, Mother's tincture, the
// three pigs set free, and the way east along the hoofprints – from here on Lia travels as `lia-cloak`.
import { G } from '../../core/G';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { AT, HOF_BLOCK, HOF_HIDING, HOF_OCCLUDERS, HOF_SURFACES, HOF_WALK, PEN_WALK } from './hofGeo';
import { EXTRAS, settle, type Selection } from './packing';
import { openPacking, packingVerdict } from './packingPanel';
import { ambience, carry, gotoOrTitle, music, sfx, ui } from './shared';

const STONES_NEEDED = 4;
const GRAVE_FATHER: [number, number] = [556, 230];
const GRAVE_MOTHER: [number, number] = [618, 232];

const STONE_TEXT: { lift: string; place: string; memory?: string }[] = [
  { lift: 'Schwer. Meine Hände sind schon ganz aufgeschürft.', place: 'Vater. Immer rau, immer warm. „Was bringst du uns mit?“ – „Wartet’s ab.“', memory: 'k1-mem-markt' },
  { lift: 'Ich hätte zu Hause sein sollen. Ich hätte die Schweine füttern sollen.', place: 'Dann läge ich jetzt neben euch. Und niemand würde Kyra suchen.' },
  { lift: 'Die Grillen zirpen, als wäre nichts geschehen.', place: 'Mutter hat die Stadt für ihn aufgegeben. „Ich würde es wieder genauso machen.“', memory: 'k1-mem-trapas' },
  { lift: 'Der letzte.', place: '„Nächstes Jahr nehme ich euch mit zum Fest.“ Es gibt kein nächstes Jahr mehr.', memory: 'k1-mem-fest' },
];

const stones = () => Number(G.state.flag<number>('k1-steine') ?? 0);
const gravesDone = () => stones() >= STONES_NEEDED;
const morning = () => G.state.is('k1-morgen');
let dropStone: (() => void) | null = null;

// ---------------------------------------------------------------------------------------------------------------
// The farm at night / in the morning
// ---------------------------------------------------------------------------------------------------------------

export const trauerMap: MapDef = defineMap({
  id: 'k1-hof-trauer',
  name: 'Der Hof',
  background: 'k1-hof',
  walk: [HOF_WALK, PEN_WALK],
  block: HOF_BLOCK,
  occluders: HOF_OCCLUDERS,
  surfaces: HOF_SURFACES,
  hidingSpots: HOF_HIDING,
  props: [
    { id: 'laken-vater', prop: 'blanket', at: [560, 226], collide: false },
    { id: 'laken-mutter', prop: 'blanket', at: [612, 228], collide: false, flipX: true },
    { id: 'preload-a', prop: 'stones-pile', at: [-40, -40], collide: false, alpha: 0 },
    { id: 'preload-b', prop: 'grave-cairn', at: [-40, -40], collide: false, alpha: 0 },
    { id: 'preload-c', prop: 'grave-cairn-v2', at: [-40, -40], collide: false, alpha: 0 },
  ],
  npcs: [
    { id: 'schwein-1', preset: 'pig', at: [250, 140], dir: 'right', wander: 14, solid: false, facePlayer: false },
    { id: 'schwein-2', preset: 'pig', at: [318, 128], dir: 'left', wander: 14, solid: false, facePlayer: false },
    { id: 'schwein-3', preset: 'pig', at: [366, 152], dir: 'left', wander: 10, solid: false, facePlayer: false },
  ],
  interactables: [
    {
      id: 'eltern', verb: 'Hinknien', radius: 26, poly: [[536, 206], [636, 206], [636, 236], [536, 236]], standAt: [586, 252], face: 'up', once: true,
      when: () => !G.state.is('k1-eltern'), onInteract: kneelAtParents,
    },
    {
      id: 'steinhaufen', verb: 'Stein aufheben', radius: 30, once: false, poly: [[940, 450], [1000, 444], [1070, 450], [1100, 480], [1080, 506], [960, 506], [930, 482]],
      standAt: [1010, 432], face: 'down', when: () => G.state.is('k1-eltern') && !G.state.is('k1-traegt') && !gravesDone(), onInteract: liftStone,
    },
    {
      id: 'grab', verb: 'Stein ablegen', radius: 30, once: false, poly: [[530, 208], [646, 208], [646, 250], [530, 250]], standAt: [586, 256], face: 'up',
      when: () => G.state.is('k1-traegt'), onInteract: placeStone,
    },
    {
      id: 'blumen-grab', verb: 'Kornblumen hinlegen', radius: 30, once: true, poly: [[596, 212], [640, 212], [640, 248], [596, 248]], standAt: [618, 258], face: 'up',
      when: () => gravesDone() && G.state.has('flowers') && !G.state.is('k1-blumen-grab'), onInteract: layFlowers,
    },
    {
      id: 'buch', verb: 'Aufheben', at: [522, 300], radius: 24, sparkle: true, once: true,
      when: () => G.state.is('k1-buch-verloren') && !G.state.is('k1-buch-gefunden'), onInteract: findBook,
    },
    {
      id: 'gatter', verb: 'Schweine füttern', radius: 26, once: false, poly: [[396, 150], [424, 150], [424, 206], [396, 206]], standAt: [420, 214], face: 'up',
      when: () => G.state.is('k1-gepackt') && !G.state.is('k1-schweine-frei'), onInteract: freePigs,
    },
  ],
  clues: [
    { id: 'osten-1', at: [560, 380], kind: 'hoof', angle: 225 },
    { id: 'osten-2', at: [420, 490], kind: 'hoof', angle: 220 },
    { id: 'osten-3', at: [262, 576], kind: 'hoof', angle: 215, clue: 'k1-spur-osten', thought: 'Sechs Pferde, den Hohlweg hinunter zur Hauptstraße. Eins trägt schwerer. Kyra.' },
  ],
  exits: [
    {
      id: 'haus', to: 'k1-stube', spawn: 'tuer', poly: [[562, 150], [604, 150], [604, 192], [562, 192]], door: { at: AT.door, verb: 'Eintreten' },
      when: () => morning(), blocked: 'Nicht jetzt. Erst die Gräber.',
    },
  ],
  triggers: [
    { id: 'aufbruch', once: false, poly: [[0, 650], [96, 650], [96, 720], [0, 720]], onEnter: leave },
  ],
  spawns: {
    start: { at: [430, 474], dir: 'up' },
    tuer: { at: [583, 200], dir: 'down' },
  },
  time: 'night',
  weather: 'fireflies',
  ambience: ['night', 'crickets', 'wind'],
  ambienceVolume: { wind: 0.35 },
  music: 'grief',
  lookMode: true,
  playerLight: 64,
  onEnter: restoreFarm,
});

/** Runtime props/state the map memory does not keep: cairns, freed pigs, the outfit. */
function restoreFarm(w: WorldCtx): void {
  const n = stones();
  if (n >= 1) w.prop('laken-vater').setVisible(n < 2);
  if (n >= 3) w.prop('laken-mutter').setVisible(n < 4);
  if (n === 1) w.addProp({ id: 'steine-vater', prop: 'stones-pile', at: [GRAVE_FATHER[0], GRAVE_FATHER[1] - 2], collide: false });
  if (n >= 2) w.addProp({ id: 'grab-vater', prop: 'grave-cairn', at: GRAVE_FATHER });
  if (n === 3) w.addProp({ id: 'steine-mutter', prop: 'stones-pile', at: [GRAVE_MOTHER[0], GRAVE_MOTHER[1] - 2], collide: false });
  if (n >= 4) w.addProp({ id: 'grab-mutter', prop: 'grave-cairn-v2', at: GRAVE_MOTHER });
  if (G.state.is('k1-schweine-frei')) for (const id of ['schwein-1', 'schwein-2', 'schwein-3']) if (w.actor(id).exists) w.despawn(id);
  if (G.state.is('k1-reisekleidung')) {
    void G.art.preload(w.scene, { characters: ['lia-cloak'] }).then(() => { if (w.alive) w.player.setLook('lia-cloak'); });
  }
  if (morning()) {
    void w.lighting.set('day', 0);
    w.weather.set('none', { ms: 0 });
    ambience(['wind', 'birds'], 600);
    w.setEnabled('haus', true);
  }
}

export async function trauerScript(w: WorldCtx): Promise<void> {
  if (morning()) { morningObjective(w); return; }
  if (!G.state.is('k1-eltern')) {
    await w.cutscene(async () => {
      await w.narrate([
        'Lia wusste nicht, wie lange sie im Gras gelegen hatte.',
        'Irgendwann wurde es still. Nur die Grillen zirpten, als wäre nichts geschehen.',
      ], { style: 'card' });
      await G.ui.fade('in', 1400);
      await w.wait(400);
      await w.think('Ich muss … ich muss zu ihnen.');
    });
    w.setObjective('k1-eltern', 'Geh zu deinen Eltern.', 'eltern');
  } else stoneObjective(w);
}

async function kneelAtParents(w: WorldCtx): Promise<void> {
  G.state.set('k1-eltern');
  w.completeObjective('k1-eltern');
  await w.cutscene(async () => {
    w.player.setIdle('kneel');
    await w.wait(900);
    await w.narrate([
      'Da lagen sie. Eng beieinander, als hätten sie sich noch im Fallen gesucht. Lia hatte zwei Laken über sie gebreitet.',
      'Warum? Warum ihr? Warum Kyra? Was hattet ihr denn getan, dass ihr das verdient habt?',
      'Sie weinte, bis keine Tränen mehr kamen. Danach war da nur noch Leere.',
      'Und in der Leere ein einziger Gedanke: Kyra lebt. Und ich hole sie zurück.',
    ]);
    await w.say('lia', 'Ich lasse euch nicht so liegen. Nicht für die Leichenfresser.', { mood: 'determined' });
    await w.think('Steine. Am Feldrand liegt ein ganzer Haufen davon.');
    w.player.setIdle('idle');
  });
  stoneObjective(w);
}

function stoneObjective(w: WorldCtx): void {
  if (gravesDone()) { afterGraves(w); return; }
  const n = stones();
  w.setObjective('k1-steine', `Trag Steine für zwei Gräber zusammen (${n}/${STONES_NEEDED}).`, G.state.is('k1-traegt') ? 'grab' : 'steinhaufen');
}

async function liftStone(w: WorldCtx): Promise<void> {
  const t = STONE_TEXT[stones()] ?? STONE_TEXT[0];
  await w.player.play('kneel', { ms: 800 });
  sfx('stone-place', { volume: 0.5, pitch: 1.2 });
  G.state.set('k1-traegt');
  dropStone?.();
  dropStone = await carry(w, 'player', 'stones-pile', -30, 0.7);
  w.player.setSpeed(40);
  w.setObjectiveTarget('grab');
  w.bark('player', t.lift, 3200);
}

async function placeStone(w: WorldCtx): Promise<void> {
  const i = stones();
  const t = STONE_TEXT[i] ?? STONE_TEXT[0];
  await w.player.play('kneel', { ms: 900 });
  dropStone?.();
  dropStone = null;
  w.player.setSpeed(56);
  sfx('stone-place');
  G.state.set('k1-traegt', false);
  const n = G.state.inc('k1-steine');
  w.fx.burst(n <= 2 ? GRAVE_FATHER : GRAVE_MOTHER, 'dust', 8);
  if (n === 1) w.addProp({ id: 'steine-vater', prop: 'stones-pile', at: [GRAVE_FATHER[0], GRAVE_FATHER[1] - 2], collide: false });
  if (n === 2) { w.prop('steine-vater').remove(); w.prop('laken-vater').setVisible(false); w.addProp({ id: 'grab-vater', prop: 'grave-cairn', at: GRAVE_FATHER }); }
  if (n === 3) w.addProp({ id: 'steine-mutter', prop: 'stones-pile', at: [GRAVE_MOTHER[0], GRAVE_MOTHER[1] - 2], collide: false });
  if (n === 4) { w.prop('steine-mutter').remove(); w.prop('laken-mutter').setVisible(false); w.addProp({ id: 'grab-mutter', prop: 'grave-cairn-v2', at: GRAVE_MOTHER }); }
  if (t.memory) G.state.addMemory(t.memory);
  await w.think(t.place);
  if (n === STONES_NEEDED) {
    // The fireflies have gathered around her all night. Nobody sees it but the player.
    w.fx.burst('player', 'urmacht', 5);
    w.completeObjective('k1-steine');
  }
  stoneObjective(w);
}

function afterGraves(w: WorldCtx): void {
  if (G.state.has('flowers') && !G.state.is('k1-blumen-grab')) {
    w.setObjective('k1-blumen', 'Leg Mutter die Kornblumen aufs Grab.', 'blumen-grab');
    return;
  }
  void dawn(w);
}

async function layFlowers(w: WorldCtx): Promise<void> {
  await w.player.play('kneel', { ms: 900 });
  G.state.set('k1-blumen-grab');
  w.completeObjective('k1-blumen');
  w.fx.burst(GRAVE_MOTHER, 'sparkle', 6);
  await w.think('Kornblumen. Ich wollte sie dir heute Abend auf den Tisch stellen.');
  await w.think('Die meisten bekommst du. Ein paar nehme ich mit – ich presse sie in ein Buch.');
  void dawn(w);
}

async function findBook(w: WorldCtx): Promise<void> {
  await w.player.play('kneel', { ms: 700 });
  G.state.give('book-alana');
  G.state.set('k1-buch-gefunden');
  await w.think('Mein Buch. Ich habe es fallen lassen, als … Der Einband ist feucht vom Tau.');
  await w.think('Alana und Riccard. Gestern war das noch das Wichtigste auf der Welt.');
}

async function dawn(w: WorldCtx): Promise<void> {
  if (G.state.is('k1-morgen')) return;
  G.state.set('k1-morgen');
  const plate = G.state.is('k1-blumen-grab') ? 'k1-graeber-blumen' : 'k1-graeber';
  ui().prefetchPlate(plate);
  await w.cutscene(async () => {
    w.player.setIdle('kneel');
    await w.wait(800);
    await G.ui.fade('out', 1600);
    await G.ui.caption('Morgengrauen', 2200);
    void w.lighting.set('dawn', 0);
    w.weather.set('none', { ms: 0 });
    ambience(['wind', 'birds'], 2500);
    await G.ui.plate(plate, { caption: 'Zwei Steinhügel vor dem Haus', pan: 'out', durationMs: 20000 });
    await G.ui.fade('in', 1600);
    await w.narrate([
      'Die Sonne ging auf und tauchte den Himmel in rötliches Licht. Die ganze Nacht hatte Lia Steine getragen.',
      'Ihre Hände waren blutig, die Füße in den Holzschuhen wundgescheuert. Es war ihr gleich.',
    ]);
    await w.think('Danke. Für alles.');
    await w.think('Ich werde alles tun, um Kyra zu finden. Das verspreche ich euch.');
    await G.ui.closePlate();
    w.player.setIdle('idle');
    music('refuge');
    void w.lighting.set('day', 6000);
  });
  morningObjective(w);
}

function morningObjective(w: WorldCtx): void {
  if (!G.state.is('k1-gepackt')) {
    w.setObjective('k1-packen', 'Mach dich im Haus reisefertig.', 'haus');
    if (G.state.is('k1-buch-verloren') && !G.state.is('k1-buch-gefunden') && !G.state.is('k1-buch-hinweis')) {
      G.state.set('k1-buch-hinweis');
      w.bark('player', 'Mein Buch … liegt es noch in der Böschung?', 3200);
    }
  } else if (!G.state.is('k1-schweine-frei')) {
    w.setObjective('k1-schweine', 'Lass die Schweine frei.', 'gatter');
  } else {
    w.setObjective('k1-osten', 'Folge den Hufspuren den Hohlweg hinunter.', 'osten-1');
  }
}

async function freePigs(w: WorldCtx): Promise<void> {
  if (!G.state.is('k1-schweine-gefuettert')) {
    G.state.set('k1-schweine-gefuettert');
    await w.player.play('interact', { ms: 900 });
    sfx('pig');
    await w.think('Erst bekommt ihr euer Futter. Ich habe es Kyra versprochen. Ehrenwort.');
    G.state.addMemory('k1-mem-versprechen');
    if (G.state.is('k1-ausmisten')) await w.think('Und ausmisten wollte ich auch. Puh. Das … verschieben wir.');
  }
  await openGate(w);
}

async function openGate(w: WorldCtx): Promise<void> {
  G.state.set('k1-schweine-frei');
  w.completeObjective('k1-schweine');
  sfx('door', { volume: 0.6 });
  await w.cutscene(async () => {
    await w.say('lia', 'Macht’s gut, ihr drei. Ihr seid jetzt auf euch gestellt. Ich hoffe, ihr kommt ohne mich klar.', { mood: 'sad' });
    const exits: [number, number][][] = [
      [[412, 196], [700, 300], [1300, 300]],
      [[412, 196], [600, 360], [1000, 420], [1300, 380]],
      [[412, 196], [520, 420], [300, 600], [-60, 740]],
    ];
    ['schwein-1', 'schwein-2', 'schwein-3'].forEach((id, i) => {
      const p = w.actor(id);
      if (!p.exists) return;
      p.hold(true);
      sfx('pig', { volume: 0.7, pitch: 0.9 + i * 0.1 });
      void (async () => { await w.wait(i * 350); await p.walkPath(exits[i], { speed: 70, run: true, straight: true }); w.despawn(id); })().catch(() => {});
    });
    await w.wait(1600);
    await w.think('Ich rede mit Schweinen. Wenn Kyra das sähe …');
  });
  morningObjective(w);
}

async function leave(w: WorldCtx): Promise<void> {
  if (!morning()) return;
  const missing = !G.state.is('k1-gepackt') ? 'Ohne Proviant und ohne Beutel komme ich keinen Tag weit.' : !G.state.is('k1-schweine-frei') ? 'Die Schweine! Ich kann sie nicht eingesperrt zurücklassen.' : '';
  if (missing) { w.bark('player', missing, 2800); return; }
  w.setEnabled('aufbruch', false);
  w.completeObjective('k1-osten');
  await w.cutscene(async () => {
    w.player.face('up');
    await w.camera.pan([586, 240], 1400);
    await w.think('Unser Hof. Er fühlt sich fremd an. Unheimlich.');
    await w.think('Noch nie war ich länger als einen Tag von zu Hause fort.');
    await w.think('Aber die Helden in meinen Büchern kommen auch immer mit wenig aus. So schwer kann es ja nicht sein.');
    w.camera.follow();
    await G.ui.fade('out', 1600);
    await w.narrate(['Lia zog die Tür hinter sich zu und folgte den Hufspuren nach Osten. Das war der Morgen, an dem ihr Abenteuer begann.'], { style: 'card' });
  });
  await gotoOrTitle('strasse');
}

// ---------------------------------------------------------------------------------------------------------------
// Inside the house: packing, the secret compartment, the tincture, the cloak
// ---------------------------------------------------------------------------------------------------------------

const readyToPack = () => G.state.is('k1-geheimfach') && G.state.is('k1-tinktur') && G.state.is('k1-reisekleidung');

export const stubeMap: MapDef = defineMap({
  id: 'k1-stube',
  name: 'Die Stube',
  background: 'k1-stube',
  walk: [
    [[150, 120], [214, 120], [296, 120], [364, 120], [404, 120], [406, 272], [322, 272], [318, 344], [216, 344], [212, 272], [30, 272], [28, 212], [80, 206], [84, 182], [172, 178], [172, 124]],
  ],
  block: [
    { id: 'tisch', poly: [[186, 152], [320, 152], [322, 228], [300, 232], [204, 232], [186, 226]] },
    { id: 'schemel', poly: [[126, 154], [160, 154], [160, 178], [126, 178]] },
    { id: 'fass', poly: [[322, 98], [348, 98], [348, 118], [322, 118]] },
  ],
  occluders: [
    { id: 'tisch', baseline: 230, poly: [[184, 142], [322, 142], [324, 232], [184, 232]] },
    { id: 'wand-vorne', baseline: 360, poly: [[0, 276], [214, 276], [214, 360], [0, 360]] },
    { id: 'wand-vorne-r', baseline: 360, poly: [[322, 276], [640, 276], [640, 360], [322, 360]] },
  ],
  surface: 'wood',
  interactables: [
    { id: 'beutel', verb: 'Packen', radius: 26, at: [52, 218], size: { w: 64, h: 112 }, standAt: [60, 220], face: 'left', once: false, onInteract: packBag },
    { id: 'schrank', verb: 'Durchsuchen', radius: 36, poly: [[216, 24], [292, 24], [292, 118], [216, 118]], standAt: [254, 134], face: 'up', once: false, when: () => !G.state.is('k1-geheimfach'), onInteract: secretCompartment },
    { id: 'medizin', verb: 'Öffnen', radius: 34, poly: [[310, 26], [360, 26], [360, 116], [310, 116]], standAt: [336, 132], face: 'up', once: false, when: () => !G.state.is('k1-tinktur'), onInteract: tincture },
    { id: 'mantel', verb: 'Anziehen', radius: 30, poly: [[398, 106], [424, 106], [424, 184], [398, 184]], standAt: [392, 196], face: 'right', once: false, when: () => !G.state.is('k1-reisekleidung'), onInteract: dressForTravel },
    { id: 'buecher', verb: 'Ansehen', radius: 36, poly: [[366, 36], [406, 36], [406, 118], [366, 118]], standAt: [386, 132], face: 'up', once: false, onInteract: books },
    { id: 'korb', verb: 'Nachsehen', radius: 40, poly: [[128, 82], [164, 82], [164, 114], [128, 114]], standAt: [180, 128], face: 'left', once: true, onInteract: honeyCake },
    { id: 'tisch', verb: 'Erinnern', radius: 26, poly: [[188, 144], [320, 144], [320, 200], [188, 200]], standAt: [254, 244], face: 'up', once: true, onInteract: async w => { G.state.addMemory('k1-mem-lesen'); await w.think('Hier hat Mutter mir das Lesen beigebracht. Kyra ist immer nach dem dritten Wort weggelaufen.'); } },
    { id: 'ofen', verb: 'Erinnern', radius: 40, poly: [[60, 60], [140, 60], [150, 172], [60, 172]], standAt: [110, 196], face: 'up', once: true, onInteract: async w => { G.state.addMemory('k1-mem-ofen'); await w.think('Der Ofen ist kalt. An Winterabenden saßen wir hier alle zusammen, und ich las vor, bis die Kerze herunterbrannte.'); } },
    { id: 'betten', verb: 'Erinnern', radius: 50, poly: [[440, 64], [602, 64], [602, 150], [440, 150]], standAt: [394, 176], face: 'right', once: true, onInteract: beds },
  ],
  exits: [
    { id: 'raus', poly: [[218, 330], [318, 330], [318, 356], [218, 356]], to: 'k1-hof-trauer', spawn: 'tuer', dir: 'down' },
  ],
  spawns: { tuer: { at: [268, 304], dir: 'up' } },
  time: 'dawn',
  baked: 'dawn',
  ambience: ['room', 'birds'],
  ambienceVolume: { birds: 0.3 },
  onEnter: async w => {
    if (G.state.is('k1-reisekleidung')) {
      await G.art.preload(w.scene, { characters: ['lia-cloak'] });
      if (w.alive) w.player.setLook('lia-cloak');
    }
    stubeObjective(w);
    if (!G.state.is('k1-stube-gesehen')) {
      G.state.set('k1-stube-gesehen');
      await w.think('Sie haben alles durchwühlt. Aber nicht alles mitgenommen.');
    }
  },
});

function stubeObjective(w: WorldCtx): void {
  if (G.state.is('k1-gepackt')) { w.setObjective('k1-schweine', 'Lass die Schweine frei.', 'raus'); return; }
  const todo = [
    !G.state.is('k1-geheimfach') && 'Vaters Geheimfach',
    !G.state.is('k1-tinktur') && 'Mutters Tinktur',
    !G.state.is('k1-reisekleidung') && 'Mantel und Schuhe',
  ].filter(Boolean) as string[];
  if (todo.length) {
    const target = !G.state.is('k1-geheimfach') ? 'schrank' : !G.state.is('k1-tinktur') ? 'medizin' : 'mantel';
    w.setObjective('k1-packen', `Mach dich reisefertig: ${todo.join(', ')}.`, target);
  } else w.setObjective('k1-packen', 'Pack den Lederbeutel neben dem Ofen.', 'beutel');
}

async function secretCompartment(w: WorldCtx): Promise<void> {
  await w.think('Die Gläser sind alle umgeworfen. Aber Vater hat einen doppelten Boden eingebaut …');
  const c = await w.choose(['Die Kräutergläser beiseiteschieben', 'Lieber nicht. Später.']);
  if (c === 1) return;
  sfx('chest', { volume: 0.6 });
  await w.player.play('interact', { ms: 800 });
  await w.think('Da ist die Kerbe. Man kann sie als Griff benutzen.');
  const d = await w.choose(['Den Boden anheben']);
  void d;
  sfx('door', { volume: 0.4, pitch: 1.4 });
  await w.wait(400);
  G.state.give('coins');
  await w.think('Zweiundzwanzig Kupfer- und sieben Silbermünzen. Das haben sie nicht gefunden.');
  G.state.give('dagger');
  await w.think('Und Vaters Dolch in der Lederscheide. Den hat er auf jeder Marktfahrt getragen.');
  G.state.set('k1-geheimfach');
  stubeObjective(w);
}

async function tincture(w: WorldCtx): Promise<void> {
  sfx('chest', { volume: 0.4, pitch: 1.3 });
  await w.player.play('interact', { ms: 700 });
  G.state.give('tincture');
  await w.think('Mutters Wundtinktur. Meine Ferse ist ganz wundgescheuert von den Holzschuhen.');
  w.player.setIdle('sit');
  await w.wait(700);
  await w.say('lia', 'Au! Au, au, au … Es brennt. Aber es hilft. Hat Mutter immer gesagt.', { mood: 'hurt' });
  await w.think('Ein Verband aus einem alten Laken. Und die leichten Lederschuhe statt der Holzschuhe.');
  w.player.setIdle('idle');
  G.state.set('k1-tinktur');
  stubeObjective(w);
}

async function dressForTravel(w: WorldCtx): Promise<void> {
  await w.player.play('interact', { ms: 700 });
  await G.art.preload(w.scene, { characters: ['lia-cloak'] });
  if (!w.alive) return;
  await G.ui.fade('out', 300);
  w.player.setLook('lia-cloak');
  G.state.give('cloak');
  G.state.set('k1-reisekleidung');
  await G.ui.fade('in', 400);
  await w.say('lia', 'Mein grüner Regenmantel. Und ein Haarband, damit mir die Locken nicht ins Gesicht fallen.', { mood: 'determined', portrait: 'lia-cloak' });
  stubeObjective(w);
}

async function books(w: WorldCtx): Promise<void> {
  if (!G.state.is('k1-buecher')) {
    G.state.set('k1-buecher');
    await w.think('Cronibus großes Kräuterlexikon. Mutters Handschrift steht neben dem Speikraut.');
    await w.think('Eigentlich brauche ich euch nicht. Aber … vielleicht doch. Es kommt in den Beutel, wenn Platz ist.');
    return;
  }
  await w.think('Mutters Bücher. Die meisten kenne ich auswendig.');
}

async function honeyCake(w: WorldCtx): Promise<void> {
  G.state.give('honey-cake');
  G.state.addMemory('k1-mem-kuchen');
  await w.think('Honig-Apfelkuchen. Vater hat ihn gestern vom Markt mitgebracht. Den letzten haben sie übersehen.');
}

async function beds(w: WorldCtx): Promise<void> {
  G.state.addMemory('k1-mem-betten');
  await w.think('Kyras Bett: glatt gezogen. Meins: ein Schlachtfeld. Ich hätte es heute Morgen machen sollen.');
  await w.think('Meine Wolldecke rolle ich ein und schnalle sie an den Beutel.');
  if (!G.state.has('blanket')) G.state.give('blanket');
}

/** Extras Lia left behind on an earlier packing (she may change her mind until she leaves). */
function leftBehind(): Record<string, number> {
  try { return JSON.parse(G.state.flag<string>('k1-liegen') ?? '{}') as Record<string, number>; } catch { return {}; }
}

/** How many of an extra are in reach: shelf items (book-herbs, tinder) are always there, plus inventory and left-behind. */
function owned(id: string): number {
  if (id === 'book-herbs' || id === 'tinder') return 1;
  return G.state.count(id) + (leftBehind()[id] ?? 0);
}

async function packBag(w: WorldCtx): Promise<void> {
  if (!readyToPack()) {
    await w.think('Erst brauche ich alles zusammen: Vaters Geheimfach, Mutters Tinktur, Mantel und Schuhe.');
    return;
  }
  w.lockPlayer();
  let sel: Selection | null;
  try {
    const start = (G.state.flag<string>('k1-auswahl') ? JSON.parse(G.state.flag<string>('k1-auswahl')!) : {}) as Selection;
    sel = await openPacking(owned, start);
  } finally { w.unlockPlayer(); }
  if (!sel || !w.alive) return;
  const reach: Record<string, number> = {};
  for (const e of EXTRAS) reach[e.id] = owned(e.id);
  const { give } = settle(sel, owned, id => G.state.count(id));
  for (const [id, n] of Object.entries(give)) G.state.give(id, n);
  // Extras: exactly the chosen ones end up in the inventory, the rest stays behind (and can still be repacked).
  const behind: Record<string, number> = {};
  for (const e of EXTRAS) {
    const want = Math.min(sel[e.id] ?? 0, reach[e.id]);
    const have = G.state.count(e.id);
    if (have > want) G.state.take(e.id, have - want);
    else if (want > have) G.state.give(e.id, want - have);
    if (e.id !== 'book-herbs' && e.id !== 'tinder' && reach[e.id] > want) behind[e.id] = reach[e.id] - want;
  }
  G.state.set('k1-liegen', JSON.stringify(behind));
  G.state.set('k1-auswahl', JSON.stringify(sel));
  const first = !G.state.is('k1-gepackt');
  G.state.set('k1-gepackt');
  if (first) w.completeObjective('k1-packen');
  for (const line of packingVerdict(sel)) await w.think(line);
  stubeObjective(w);
}


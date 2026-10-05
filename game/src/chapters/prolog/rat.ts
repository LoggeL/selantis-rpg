// prolog-rat: the book opens, then the council hall, playable as Valentus. The conflict over the Urmacht,
// the vote, the Four leave with a threat, the secret-alliance tableau.
// Map: assets/bg/prolog-rat.png (1280×720, Codex). Geometry in map pixels (F1 overlay, scripts/map_tool.mjs).
import { G } from '../../core/G';
import type { Dir } from '../../core/types';
import { defineMap, startWorld, type ActorHandle, type NpcDef, type WorldCtx } from '../../world';
import { registerBookPlates } from './book';
import { ambience, music, sfx, sleep, ui } from './util';

const HEARD = ['ignatius', 'aelteste', 'hagere', 'wortfuehrer'] as const;
const heardCount = () => HEARD.filter(id => G.state.is(`prolog-gehoert-${id}`)).length;

/** The ten seats: where each member stands (in front of the seat) and how they look. R1 is Valentus' own seat. */
interface Seat { id: string; preset: string; at: [number, number]; speaker: string; renegade?: boolean }
const SEATS: Seat[] = [
  { id: 'rat-l1', preset: 'burm', at: [210, 304], speaker: 'burm' },
  { id: 'ignatius', preset: 'ignatius', at: [270, 284], speaker: 'ignatius' },
  { id: 'aelteste', preset: 'gira', at: [334, 264], speaker: 'gira' },
  { id: 'hagere', preset: 'tholoss', at: [406, 248], speaker: 'tholoss', renegade: true },
  { id: 'wortfuehrer', preset: 'ulfbert', at: [482, 238], speaker: 'ulfbert', renegade: true },
  { id: 'abtr-r2', preset: 'loyla', at: [872, 248], speaker: 'loyla', renegade: true },
  { id: 'rat-r3', preset: 'gwynn', at: [942, 264], speaker: 'gwynn' },
  { id: 'abtr-r4', preset: 'rikkon', at: [1010, 284], speaker: 'rikkon', renegade: true },
  { id: 'rat-r5', preset: 'samira', at: [1074, 306], speaker: 'samira' },
];
const VALENTUS_SEAT: [number, number] = [806, 238];
const MOSAIC: [number, number] = [640, 352];

const BARKS: Record<string, string[]> = {
  'rat-l1': ['Das Siegel hält seit Jahrhunderten.', 'Ruhe, bitte!'],
  'abtr-r2': ['Endlich spricht es jemand aus.', 'Wächter … Türsteher, mehr nicht.'],
  'rat-r3': ['Das ist Wahnsinn.', 'Großmeister, sagt etwas.'],
  'abtr-r4': ['Die Zeit der Wächter ist vorbei.', 'Schwarz und weiß … wir werden sehen.'],
  'rat-r5': ['Die Zehn haben geschworen.', 'Was würde Aros sagen?'],
};

function seatNpc(s: Seat): NpcDef {
  const def: NpcDef = { id: s.id, preset: s.preset, at: s.at, dir: 'down', speaker: s.speaker, verb: 'Anhören' };
  if (s.id === 'wortfuehrer') def.at = [640, 300];
  if (BARKS[s.id]) { def.barks = BARKS[s.id]; def.barkEvery = 7000; }
  if (s.id === 'ignatius') def.talk = talkIgnatius;
  else if (s.id === 'aelteste') def.talk = talkAelteste;
  else if (s.id === 'hagere') def.talk = talkHagere;
  else if (s.id === 'wortfuehrer') def.talk = talkWortfuehrer;
  else def.talk = talkMinor;
  return def;
}

export const ratMap = defineMap({
  id: 'prolog-rat',
  name: 'Der Ratssaal',
  background: 'prolog-rat',
  walk: [[
    [60, 332], [140, 322], [186, 298], [250, 278], [312, 258], [382, 242], [456, 232], [540, 232], [552, 200],
    [732, 200], [744, 232], [830, 232], [898, 242], [966, 258], [1030, 278], [1094, 298], [1140, 322], [1220, 332],
    [1220, 598], [1150, 612], [1150, 720], [940, 720], [940, 578], [850, 578], [850, 720], [440, 720], [440, 578],
    [345, 578], [345, 720], [130, 720], [130, 612], [60, 600],
  ]],
  occluders: [
    { id: 'saeule-links', baseline: 720, poly: [[343, 524], [442, 524], [442, 720], [343, 720]] },
    { id: 'saeule-rechts', baseline: 720, poly: [[848, 524], [942, 524], [942, 720], [848, 720]] },
    { id: 'pfeiler-sw', baseline: 720, poly: [[0, 540], [130, 560], [160, 610], [130, 720], [0, 720]] },
    { id: 'pfeiler-so', baseline: 720, poly: [[1150, 600], [1200, 520], [1280, 520], [1280, 720], [1150, 720]] },
  ],
  surfaces: [
    { id: 'boden', kind: 'stone', poly: [[0, 180], [1280, 180], [1280, 720], [0, 720]] },
    { id: 'teppich', kind: 'carpet', poly: [[586, 400], [694, 400], [700, 720], [580, 720]] },
  ],
  surface: 'stone',
  npcs: SEATS.map(seatNpc),
  interactables: [
    {
      id: 'siegel', verb: 'Berühren', once: false, poly: [[566, 34], [716, 34], [720, 150], [716, 192], [566, 192], [562, 150]],
      standAt: [642, 212], face: 'up', onInteract: touchSeal,
    },
    {
      id: 'mosaik', verb: 'Betrachten', once: true, removeOnUse: false, radius: 30,
      poly: [[600, 400], [680, 400], [690, 414], [680, 428], [600, 428], [590, 414]],
      when: () => !G.state.is('prolog-abstimmung'), onInteract: lookMosaic,
    },
    {
      id: 'sitz', verb: 'Platz nehmen', once: false, poly: [[780, 168], [832, 168], [832, 224], [780, 224]],
      standAt: VALENTUS_SEAT, face: 'down', onInteract: ownSeat,
    },
    {
      id: 'fenster', verb: 'Hinaussehen', once: true, removeOnUse: false, poly: [[1120, 0], [1170, 0], [1170, 120], [1120, 120]], radius: 220,
      standAt: [1150, 340], face: 'up', thought: 'Rauch über den Hügeln im Osten. Die Fürsten sagen, es seien nur Räuber.',
    },
  ],
  triggers: [{ id: 'treppe', once: false, poly: [[460, 680], [830, 680], [830, 720], [460, 720]], onEnter: w => { void w.think('Ich gehe nicht, bevor der Rat entschieden hat.'); } }],
  lights: [
    { id: 'siegel-glimmen', at: [641, 150], kind: 'urmacht', radius: 110, intensity: 0.6, always: true },
    { id: 'kohle-1', at: [393, 552], kind: 'fire', radius: 70, always: true },
    { id: 'kohle-2', at: [886, 552], kind: 'fire', radius: 70, always: true },
    { id: 'kohle-3', at: [30, 228], kind: 'fire', radius: 60, always: true },
    { id: 'kohle-4', at: [1250, 228], kind: 'fire', radius: 60, always: true },
    { id: 'kohle-5', at: [523, 104], kind: 'fire', radius: 50, always: true },
    { id: 'kohle-6', at: [758, 104], kind: 'fire', radius: 50, always: true },
  ],
  spawns: {
    start: { at: VALENTUS_SEAT, dir: 'down' },
    mitte: { at: [700, 420], dir: 'up' },
  },
  time: 'dusk',
  baked: 'dusk',
  ambience: ['room'],
  music: 'dread',
  sneak: false,
  critters: false,
  resetOnEnter: true,
});

function heardObjective(w: WorldCtx): void {
  const n = heardCount();
  if (n < HEARD.length) w.setObjective('prolog-anhoeren', `Höre die Ratsmitglieder an (${n}/${HEARD.length}).`, nextUnheard());
  else {
    w.completeObjective('prolog-anhoeren');
    w.setObjective('prolog-abstimmen', 'Rufe den Rat zur Abstimmung – sprich mit Ulfbert.', 'wortfuehrer');
  }
}
function nextUnheard(): string | null {
  return HEARD.find(id => !G.state.is(`prolog-gehoert-${id}`)) ?? null;
}
function heard(w: WorldCtx, id: string): void {
  if (G.state.is(`prolog-gehoert-${id}`)) return;
  G.state.set(`prolog-gehoert-${id}`);
  heardObjective(w);
}

// ------------------------------------------------------------------------------------------------- conversations
async function talkIgnatius(w: WorldCtx): Promise<void> {
  if (G.state.is('prolog-gehoert-ignatius')) { await w.say('ignatius', 'Bleibt standhaft, Valentus. Wenn Ihr wankt, wanken sie alle.', { mood: 'worried' }); return; }
  await w.say('ignatius', 'Valentus. Ich sitze seit dreißig Jahren in diesem Saal. So laut war es hier noch nie.', { mood: 'worried' });
  const i = await w.choose(['„Was haltet Ihr von ihrem Vorschlag?“', '„Habt Ihr Angst, Ignatius?“']);
  if (i === 0) {
    await w.say('ignatius', 'Was man einmal öffnet, schließt man nicht wieder. Die Zehn wussten das. Darum haben sie gesiegelt, nicht geherrscht.');
  } else {
    await w.say('ignatius', 'Angst? Ja. Nicht vor der Urmacht. Vor denen, die glauben, sie könnten sie zähmen.', { mood: 'worried' });
  }
  await w.say('ignatius', 'In Ignis sagen wir: Feuer wärmt nur, solange es im Herd bleibt.');
  heard(w, 'ignatius');
}

async function talkAelteste(w: WorldCtx): Promise<void> {
  if (G.state.is('prolog-gehoert-aelteste')) { await w.say('gira', 'Ich habe meine Stimme schon vergeben. An das Siegel.'); return; }
  await w.say('gira', 'Großmeister. Sie reden von Hunger und Räubern, als hätten nur sie Augen im Kopf.', { mood: 'angry' });
  await w.say('gira', 'Aber ich habe gesehen, was die Urmacht anrichtet, wenn nur ein Funke entweicht. Ein ganzes Tal – verdorrt.');
  const i = await w.choose(['„Also stimmt Ihr mit mir?“', '„Und wenn sie recht haben? Das Land leidet.“']);
  if (i === 0) await w.say('gira', 'Ich stimme mit dem Eid. Dass Ihr derselben Meinung seid, ist ein Glück für Euch.');
  else await w.say('gira', 'Das Land leidet unter Menschen, nicht unter einem Siegel. Gebt Menschen mehr Macht, und es leidet mehr.', { mood: 'angry' });
  heard(w, 'aelteste');
}

async function talkHagere(w: WorldCtx): Promise<void> {
  if (G.state.is('prolog-gehoert-hagere')) { await w.say('tholoss', 'Wir haben uns nichts mehr zu sagen, Großmeister.'); return; }
  await w.say('tholoss', 'Ihr kommt, um mich umzustimmen? Spart Euch den Atem.');
  await w.say('tholoss', 'Hinter dieser Tür liegt die Kraft, mit der eine Göttin eine Welt erschuf. Und wir … bewachen sie. Wie Hunde einen Knochen.');
  const i = await w.choose(['„Sie wurde Xenovia genommen, weil sie zerstört.“', '„Wem würdet Ihr sie geben? Euch selbst?“', '„Sprecht weiter. Ich höre zu.“']);
  if (i === 0) {
    await w.say('tholoss', 'Sie zerstört in den falschen Händen. Die Zehn waren keine Götter – und doch haben sie gesiegt.');
  } else if (i === 1) {
    void w.actor('hagere').emote('anger');
    await w.say('tholoss', 'Dem Rat. Uns allen. Oder fürchtet Ihr, dass Ihr dann nicht mehr der Größte unter uns seid?', { mood: 'angry' });
  } else {
    await w.say('tholoss', 'Die Fürsten verlachen uns. Räuber brennen Dörfer nieder, und der Rat … hütet eine Tür.');
  }
  heard(w, 'hagere');
}

async function talkWortfuehrer(w: WorldCtx): Promise<void> {
  const wf = w.actor('wortfuehrer');
  if (!G.state.is('prolog-gehoert-wortfuehrer')) {
    await w.say('ulfbert', 'Großmeister. Ihr habt mich gehört. Wer die Macht hütet, soll sie auch führen.');
    await w.say('ulfbert', 'Die Urmacht könnte die Ernten retten, die Räuber vertreiben, die Fürsten zur Ordnung zwingen. Und wir lassen sie schlafen.');
    const i = await w.choose(['„Wir sind Wächter. Keine Herrscher.“', '„Wer entscheidet, wofür sie benutzt wird? Ihr?“']);
    if (i === 0) {
      await w.say('ulfbert', 'Wächter. Ein hübsches Wort für Feiglinge, die sich hinter einem Eid verstecken.', { mood: 'angry' });
    } else {
      void wf.emote('…');
      await w.say('ulfbert', 'Der Rat. Mit klarem Kopf und fester Hand. Habt Ihr Angst vor Euren eigenen Brüdern?');
    }
    await w.say('ulfbert', 'Hört Euch nur um. Und dann ruft zur Abstimmung, wenn Ihr den Mut habt.');
    heard(w, 'wortfuehrer');
    return;
  }
  if (heardCount() < HEARD.length) {
    await w.say('ulfbert', 'Hört erst die anderen an. Dann sprechen wir von Mut.');
    return;
  }
  await vote(w);
}

async function talkMinor(w: WorldCtx, npc: ActorHandle): Promise<void> {
  const seat = SEATS.find(s => s.id === npc.id);
  if (seat?.renegade) {
    await w.say(seat!.speaker, npc.id === 'abtr-r4'
      ? 'Ihr seid alt geworden, Valentus. Die Welt dreht sich weiter, ob die Tür offen ist oder nicht.'
      : 'Der Wortführer spricht für uns vier. Mehr habe ich Euch nicht zu sagen.');
  } else {
    await w.say(seat!.speaker, npc.id === 'rat-l1'
      ? 'Meine Stimme gehört dem Siegel, Großmeister. Wie die meines Vaters vor mir.'
      : npc.id === 'rat-r3'
        ? 'Vier gegen sechs. Noch. Wenn einer von uns wankt, ist das Siegel verloren.'
        : 'Sie reden, als gehöre ihnen die Urmacht schon. Seht nur, wie der Wortführer auf die Tür starrt.');
  }
}

// ------------------------------------------------------------------------------------------------- hotspots
async function touchSeal(w: WorldCtx): Promise<void> {
  w.player.face('up');
  await w.player.play('cast', { ms: 900 });
  w.fx.burst([641, 150], 'urmacht', 14);
  sfx('magic', { volume: 0.6 });
  await w.lighting.get('siegel-glimmen').fadeTo(1.3, 400);
  if (!G.state.is('prolog-siegel')) {
    G.state.set('prolog-siegel');
    G.state.addLore('lore-urmacht');
    await w.think('Warm. Wie ein Herzschlag hinter dem Stein. Sie schläft nicht. Sie wartet.');
  } else {
    await w.think('Ruhig. Bleib ruhig, du Alte. Noch hält das Siegel.');
  }
  void w.lighting.get('siegel-glimmen').fadeTo(0.6, 900);
}

async function lookMosaic(w: WorldCtx): Promise<void> {
  G.state.addLore('lore-xenovia');
  await w.think('Der zehnzackige Stern. Zehn Menschen gegen eine Göttin. Wir feiern es jeden Sommer – und vergessen, was es gekostet hat.');
}

async function ownSeat(w: WorldCtx): Promise<void> {
  if (!G.state.is('prolog-sitz')) { G.state.set('prolog-sitz'); G.state.addLore('lore-rat-der-zehn'); }
  await w.think(heardCount() < HEARD.length ? 'Sitzen kann ich später. Erst muss ich wissen, wer noch zu mir steht.' : 'Genug gehört. Zeit, dass der Rat entscheidet.');
}

// ------------------------------------------------------------------------------------------------- the vote
async function vote(w: WorldCtx): Promise<void> {
  G.state.set('prolog-abstimmung');
  w.completeObjective('prolog-abstimmen');
  const wf = w.actor('wortfuehrer');
  await w.cutscene(async () => {
    void w.camera.zoom(1.15, 900);
    await w.player.walkTo(MOSAIC[0] + 30, MOSAIC[1] + 30, { face: 'up' });
    await wf.walkTo(482, 238, { face: 'down' });
    wf.face('down');
    await w.player.walkTo(MOSAIC[0], MOSAIC[1], { face: 'up' });
    await w.camera.pan([640, 300], 900);
    await w.say('valentus', 'Brüder und Schwestern des Rates. Ihr habt beide Seiten gehört. Ich bitte um eure Stimmen.', { mood: 'determined' });
    const i = await w.choose([
      '„Die Zehn haben die Urmacht versiegelt, weil Macht ohne Maß zerstört.“',
      '„Wir sind Wächter. Wer das vergisst, vergisst, wofür dieser Rat steht.“',
      '„Wer diese Tür öffnet, öffnet sie für immer.“',
    ]);
    await w.say('valentus', ['Kein Mensch ist weise genug, sie zu führen. Nicht ihr, nicht ich.', 'Unser Eid ist keine Schwäche. Er ist der Grund, warum es Selantis noch gibt.', 'Sie kehrt nicht zurück in den Stein, nur weil wir es uns wünschen.'][i], { mood: 'determined' });
    await w.say('narrator', 'Wer für das Wächteramt stimmt, hebe die Hand.');
    // Loyal members raise their hands one by one: soft blue light. The Four stay dark.
    for (const s of SEATS) {
      if (s.renegade) continue;
      const a = w.actor(s.id);
      a.face('down');
      void a.play('cast', { ms: 1400 });
      w.fx.burst([s.at[0], s.at[1] - 30], 'sparkle', 8);
      sfx('magic', { volume: 0.35, pitch: 1.2 });
      await sleep(420);
    }
    w.player.face('up');
    void w.player.play('cast', { ms: 1400 });
    w.fx.burst([MOSAIC[0], MOSAIC[1] - 34], 'sparkle', 10);
    await sleep(700);
    await w.say('ignatius', 'Sechs Stimmen für das Siegel.');
    await w.say('narrator', 'Wer dafür stimmt, die Urmacht zu nutzen …');
    for (const s of SEATS) {
      if (!s.renegade) continue;
      const a = w.actor(s.id);
      void a.play('cast', { ms: 1400 });
      w.fx.burst([s.at[0], s.at[1] - 30], 'smoke', 6);
      await sleep(360);
    }
    await w.say('ignatius', 'Vier. Das Siegel bleibt geschlossen. So hat der Rat entschieden.');
    await sleep(500);
    // The break.
    void wf.emote('anger');
    sfx('thud', { volume: 0.8 });
    w.camera.shake(220, 0.004);
    await w.say('ulfbert', 'Entschieden. Von sechs alten Leuten, die lieber eine Tür anbeten, als die Welt zu retten.', { mood: 'angry' });
    await wf.walkTo(MOSAIC[0] - 40, MOSAIC[1] - 10);
    wf.face(dirTowards(wf, w.player));
    await w.say('ulfbert', 'Behaltet Euer Siegel, Valentus. Aber merkt Euch eins:', { mood: 'angry' });
    await w.say('ulfbert', 'Was man uns verweigert, nehmen wir uns. Und dann wird niemand mehr fragen, wer die Hand gehoben hat.', { mood: 'angry' });
    music(null, 2000);
    // The Four leave down the stairs.
    const four = SEATS.filter(s => s.renegade).map(s => w.actor(s.id));
    for (const a of four) a.hold(true);
    const walks = four.map((a, k) => sleep(k * 380).then(() => a.walkPath([[600 + k * 26, 470], [610 + k * 24, 700]], { speed: 52 })));
    await w.camera.pan([640, 520], 1600);
    await w.say('tholoss', 'Ihr werdet uns wiedersehen. Früher, als Euch lieb ist.');
    await Promise.all(walks);
    for (const a of four) a.hide();
    await sleep(500);
    await w.camera.pan([640, 330], 1200);
    await w.say('ignatius', 'Valentus … das war eine Drohung.', { mood: 'worried' });
    const j = await w.choose(['„Sie drohen, weil sie verloren haben.“', '„Verdoppelt die Wachen am Siegel. Heute noch.“']);
    if (j === 0) await w.say('ignatius', 'Ich hoffe, Ihr habt recht. Bei allen Zehn, ich hoffe es.', { mood: 'worried' });
    else await w.say('ignatius', 'Sofort. Und ich schreibe nach Ignis. Wenn sie Freunde haben, haben wir auch welche.');
    G.state.set('prolog-wachen', j === 1);
    await w.think('Vier Stimmen. Vier von zehn. Wann sind Freunde zu Fremden geworden?');
    await w.camera.pan([641, 160], 1400);
    void w.lighting.get('siegel-glimmen').fadeTo(1.4, 1200);
    w.fx.burst([641, 150], 'urmacht', 16);
    sfx('urmacht', { volume: 0.5 });
    await sleep(1400);
  });
  G.state.complete('prolog-abstimmen');
  await allianceTableau();
}

function dirTowards(a: ActorHandle, b: ActorHandle): Dir {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}

async function allianceTableau(): Promise<void> {
  await G.ui.fade('out', 1400);
  G.ui.letterbox(true);
  music('dread', 1200);
  ambience(['wind'], 1200, { wind: 0.5 });
  ui().prefetchPlate('prolog-buch-dunkelhain');
  await G.ui.plate('prolog-buendnis', { caption: 'Das geheime Bündnis', pan: 'in', durationMs: 24000 });
  await G.ui.fade('in', 1200);
  await G.ui.say('narrator', 'In derselben Nacht trafen sich vier Gestalten unter dem Ratssaal, wo kein Siegel und kein Eid sie hörte.');
  await G.ui.say('verschwoerer', 'Sechs Narren und ein Schloss. Schlösser kann man brechen.');
  await G.ui.say('verschwoerer', 'Ruft die Räuber, die Söldner, die hungrigen Bauern. Gebt ihnen Schwarz und Weiß – und ein Ziel.');
  await G.ui.say('narrator', 'So entstand das Heer, das man später die Dunkelschatten nannte. Und der Rat der Zehn zerbrach, lange bevor er fiel.');
  await G.ui.fade('out', 1000);
  await G.ui.closePlate();
  await G.ui.plate('prolog-buch-dunkelhain', { caption: 'Dunkelhain', pan: 'right', durationMs: 20000 });
  await G.ui.fade('in', 900);
  await G.ui.say('narrator', 'Ein Jahr später marschierte ein schwarzes Heer auf den Ratssaal. Die Fürsten standen auf der Seite der Sechs.');
  await G.ui.say('narrator', 'Auf dem Hügel von Dunkelhain, vor den Toren des Saals, sollte es aufgehalten werden.');
  G.state.addLore('lore-dunkelhain');
  await G.ui.fade('out', 1000);
  await G.ui.closePlate();
  G.ui.letterbox(false);
  await G.goto('prolog-schlacht');
}

// ------------------------------------------------------------------------------------------------- scene
export function prepareRat(): void {
  G.state.setParty(['valentus']);
}

/** Illustrated chronicle opening, then the playable hall. */
export async function startRat(): Promise<void> {
  registerBookPlates();
  await G.ui.fade('out', 0);
  G.stopGameplayScenes();
  ui().setHud('cinematic');
  music('dread', 2500);
  ambience(['room'], 2000, { room: 0.5 });
  await G.ui.chapterCard('Prolog', 'Die Urmacht', 'Vor sechzehn Jahren');
  ui().prefetchPlate('prolog-buch-rat');
  ui().prefetchPlate('prolog-buendnis');
  await G.ui.plate('prolog-buch-urmacht', { caption: 'Die Chroniken von Selantis', pan: 'in', durationMs: 26000 });
  await G.ui.fade('in', 1200);
  sfx('page');
  await G.ui.say('narrator', 'Am Anfang war die ~Urmacht~. Mit ihr schuf die Göttin Xenovia das Land Selantis – und die ersten Menschen.');
  await G.ui.say('narrator', 'Doch die ersten zehn Menschen stürzten ihre Schöpferin. Sie nahmen ihr die Urmacht und verbannten sie auf den Grund des Meeres.');
  await G.ui.say('narrator', 'Die Urmacht sperrten sie in eine Höhle und versiegelten sie. Denn was eine Welt erschaffen kann, kann sie auch vernichten.');
  sfx('page');
  await G.ui.closePlate();
  await G.ui.plate('prolog-buch-rat', { caption: 'Der Rat der Zehn Geweihten', pan: 'left', durationMs: 22000 });
  await G.ui.say('narrator', 'Ihre Erben bildeten den Rat der Zehn Geweihten. Sie kamen aus den großen Städten, und alle wachten über das Siegel.');
  await G.ui.say('narrator', 'Generationen lang. Bis vier der Zehn eine Frage stellten, die niemand stellen durfte: *Wozu?*');
  await G.ui.fade('out', 900);
  await G.ui.closePlate();
  await startWorld({ map: ratMap, spawn: 'start', player: 'valentus', script: ratScript });
}

async function ratScript(w: WorldCtx): Promise<void> {
  void G.ui.fade('in', 900);
  const wf = w.actor('wortfuehrer');
  if (!G.state.is('prolog-rat-intro')) {
    await w.cutscene(async () => {
      wf.face('up');
      await w.camera.pan([640, 330], 10);
      await sleep(600);
      await w.say('narrator', 'Der Ratssaal. Ein Abend im Spätsommer, ein Jahr vor Dunkelhain.');
      void wf.play('cast', { ms: 1600 });
      await w.say('ulfbert', 'Seit tausend Jahren sitzen wir vor dieser Tür und tun – nichts!', { mood: 'angry' });
      wf.face('right');
      await w.say('ulfbert', 'Draußen brennen die Dörfer, und wir bewachen einen Schatz, den niemand anrühren darf.');
      await w.say('ulfbert', 'Ich sage: Wer die Macht hütet, soll sie auch führen!', { mood: 'angry' });
      w.bark('abtr-r2', 'So ist es!', 1600);
      w.bark('rat-r3', 'Unerhört!', 1600);
      sfx('suspicious', { volume: 0.4 });
      await sleep(900);
      await w.camera.pan(VALENTUS_SEAT, 900);
      await w.say('valentus', 'Genug. Bevor dieser Rat entscheidet, höre ich jeden an. Auch Euch.', { mood: 'determined' });
      await w.camera.zoom(1, 300);
      w.camera.follow();
    });
    G.state.set('prolog-rat-intro');
  }
  wf.face('down');
  heardObjective(w);
  await sleep(600);
  await w.say('narrator', `Du spielst Valentus, den Großmeister. Geh zu den Ratsmitgliedern und sprich sie an (${w.controlHint('interact')}).`);
}

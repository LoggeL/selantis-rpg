// Kapitel II, Szene 1 `strasse`: die gepflasterte Hauptstraße am Abend (1280×720, assets/bg/k2-strasse.png).
// Herzstück: Hufspuren lesen, Wegweiser lesen und Lias Überlegung (wohin sind die Reiter geritten?).
// Danach optional: Gaukler auf dem Weg zum Verbannungsfest (Xenovia, Kettengebäck) und starrende Händler.
import type { CharAnim } from '../../art/api';
import { G } from '../../core/G';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { bg, gotoNext, sfx, sleep, ui } from './shared';

const ROAD_Y = 340;

export const strasse: MapDef = defineMap({
  id: 'k2-strasse',
  name: 'Die Hauptstraße',
  background: 'k2-strasse',
  walk: [
    // Cobbled road with its verges, full width.
    [[0, 290], [1280, 288], [1280, 392], [0, 392]],
    // Roadside meadow (signpost, linden, jugglers' camp).
    [[330, 292], [352, 258], [400, 240], [440, 210], [600, 192], [640, 150], [680, 104], [760, 88], [880, 86], [948, 102], [972, 150], [984, 208], [1020, 238], [1076, 262], [1090, 292]],
    // Farm lane from the south (where Lia comes from).
    [[150, 390], [302, 390], [264, 412], [252, 462], [246, 560], [228, 650], [214, 720], [136, 720], [160, 640], [190, 560], [200, 470], [194, 420]],
    // South verge and the lay-by, above the fence.
    [[292, 390], [1180, 390], [1192, 420], [1172, 468], [1132, 506], [1000, 518], [882, 518], [828, 548], [700, 516], [560, 488], [480, 470], [334, 450], [304, 436]],
  ],
  block: [
    { id: 'wegweiser', poly: [[254, 284], [271, 284], [271, 297], [254, 297]] },
    { id: 'linde', poly: [[482, 224], [530, 224], [538, 242], [476, 244]] },
    { id: 'stein-linde-1', poly: [[428, 222], [446, 222], [448, 236], [426, 236]] },
    { id: 'stein-linde-2', poly: [[514, 240], [536, 240], [538, 252], [512, 252]] },
    { id: 'meilenstein', poly: [[1022, 384], [1050, 384], [1052, 399], [1020, 399]] },
  ],
  occluders: [
    { id: 'linde', baseline: 242, fade: 0.5, poly: [[366, 150], [380, 80], [430, 30], [500, 8], [580, 14], [626, 60], [630, 140], [604, 196], [544, 220], [538, 244], [476, 246], [468, 222], [420, 212], [372, 192]] },
    { id: 'wegweiser', baseline: 296, poly: [[230, 236], [298, 236], [298, 264], [272, 264], [272, 298], [252, 298], [252, 264], [230, 264]] },
    { id: 'meilenstein', baseline: 398, poly: [[1020, 356], [1052, 356], [1054, 399], [1018, 399]] },
  ],
  surfaces: [
    { id: 'pflaster', kind: 'cobble', poly: [[0, 298], [1280, 296], [1280, 380], [0, 380]] },
    { id: 'feldweg', kind: 'path', poly: [[150, 380], [302, 380], [264, 412], [252, 462], [246, 560], [228, 650], [214, 720], [136, 720], [160, 640], [190, 560], [200, 470], [194, 420]] },
    { id: 'rastplatz', kind: 'dirt', poly: [[640, 392], [1180, 392], [1172, 468], [1132, 506], [1000, 518], [882, 518], [700, 470], [650, 430]] },
  ],
  npcs: [
    {
      id: 'gaukler', preset: 'juggler', speaker: 'gaukler', at: [724, 206], dir: 'down', wander: 20, verb: 'Reden',
      barks: ['Hopp! Und hopp!', 'Drei Bälle, zwei Hände …', 'Noch drei Tage bis zum Fest!'], barkEvery: 7000,
      talk: talkGaukler,
    },
    {
      id: 'barde', preset: 'bard', speaker: 'k2-barde', at: [812, 186], dir: 'left', verb: 'Zuhören',
      barks: ['♪ Die Göttin sank ins tiefe Meer …', '♪ Zerbrecht die Kette, Glied um Glied …'], barkEvery: 8000,
      talk: talkBarde,
    },
    {
      id: 'gauklerin', preset: 'villager-f', speaker: 'k2-gauklerin', at: [790, 238], dir: 'up', wander: 14, verb: 'Reden',
      barks: ['Ruben, stimm die Laute!', 'Das Feuer will Holz.'], barkEvery: 9000,
      talk: talkGauklerin,
    },
    {
      id: 'haendler', preset: 'merchant', speaker: 'haendler', at: [846, 446], dir: 'left', verb: 'Reden',
      barks: ['…', 'Ganz allein, die Kleine?', 'Wohin des Wegs, so spät?'], barkEvery: 6500,
      talk: talkHaendler,
    },
    {
      id: 'knecht', preset: 'villager-m', speaker: 'k2-knecht', at: [948, 430], dir: 'left', verb: 'Reden',
      barks: ['Glotz nicht so.', 'Der Gaul lahmt schon wieder.'], barkEvery: 8000,
      talk: async w => {
        await w.actor('knecht').say('Red mit dem Herrn. Ich lad nur ab.');
      },
    },
    { id: 'pferd', preset: 'horse', at: [1072, 470], dir: 'left', idle: 'graze' as CharAnim, solid: true },
  ],
  props: [
    { prop: 'k2-gauklerwagen', id: 'gauklerwagen', at: [876, 150] },
    { prop: 'campfire', id: 'gauklerfeuer', at: [760, 226] },
    { prop: 'k2-haendlerkarren', id: 'haendlerkarren', at: [994, 476] },
  ],
  interactables: [
    {
      id: 'wegweiser', verb: 'Lesen', once: false, radius: 30,
      poly: [[232, 238], [296, 238], [296, 262], [270, 262], [270, 296], [254, 296], [254, 262], [232, 262]],
      standAt: [262, 318], face: 'up', onInteract: onSignpost,
    },
    {
      id: 'meilenstein', verb: 'Lesen', once: false, radius: 26,
      poly: [[1022, 360], [1050, 360], [1052, 398], [1020, 398]], standAt: [1036, 410], face: 'up',
      onInteract: async w => {
        await w.think('„Portas, 212 Meilen.“ Zwei Wochen zu Fuß. Mindestens.');
        await w.think('Hoffentlich muss ich nicht so weit. Meine Füße sind jetzt schon wund.');
      },
    },
    {
      id: 'linde', verb: 'Ausruhen', once: true, radius: 22, at: [508, 262], standAt: [508, 262], face: 'down',
      when: () => G.state.is('k2-entschieden'),
      onInteract: async w => {
        w.player.setIdle('sit');
        await sleep(500);
        await w.think('Nur kurz die Füße ausruhen. Die Ferse brennt, als hätte ich in Brennnesseln getreten.');
        await w.think('Mutters Tinktur hilft. Aber Mutter fehlt.');
        G.state.addMemory('k2-mem-tinktur');
        w.player.setIdle('idle');
      },
    },
  ],
  clues: [
    { id: 'huf-1', at: [186, 652], kind: 'hoof', angle: -8, thought: 'Hufspuren. Mindestens fünf Pferde.' },
    { id: 'huf-2', at: [198, 592], kind: 'hoof', angle: -6 },
    { id: 'huf-3', at: [214, 532], kind: 'hoof', angle: -4, thought: 'Tief eingedrückt. Sie hatten es eilig. Oder trugen etwas Schweres.' },
    { id: 'huf-4', at: [226, 470], kind: 'hoof', angle: 0 },
    { id: 'huf-5', at: [238, 404], kind: 'hoof', angle: 4, clue: 'k2-hufspuren', onInteract: onTracksLost },
  ],
  triggers: [
    { id: 'heimweg', once: false, poly: [[136, 696], [216, 696], [214, 720], [136, 720]], onEnter: onHomeward },
    { id: 'westen', once: false, poly: [[0, 290], [26, 290], [26, 392], [0, 392]], onEnter: onWest },
    { id: 'zu-frueh', once: false, poly: [[560, 80], [590, 80], [590, 560], [560, 560]], when: () => !G.state.is('k2-entschieden'), onEnter: onTooEarly },
    { id: 'stille', once: true, poly: [[700, 296], [740, 296], [740, 392], [700, 392]], when: () => G.state.is('k2-entschieden'), onEnter: onEmptyRoad },
    { id: 'osten', once: false, poly: [[1252, 290], [1280, 290], [1280, 392], [1252, 392]], onEnter: onEast },
  ],
  spawns: {
    start: { at: [182, 694], dir: 'up' },
    kreuzung: { at: [262, 336], dir: 'right' },
  },
  depthScale: { y0: 80, s0: 0.94, y1: 720, s1: 1.04 },
  time: 'day',
  weather: 'none',
  ambience: ['wind', 'birds', 'crickets'],
  ambienceVolume: { birds: 0.45, crickets: 0.5 },
  music: 'exploration',
  lookMode: true,
  critters: true,
  onEnter: async w => {
    // The merchants stare at the girl walking alone (DESIGN §7.4).
    stareLoop(w);
  },
});

/** The merchant and his farmhand keep turning their heads after Lia while she is near. */
function stareLoop(w: WorldCtx): void {
  const tick = async () => {
    while (w.alive) {
      await w.wait(450);
      for (const id of ['haendler', 'knecht']) {
        const a = w.actor(id);
        if (!a.exists) continue;
        const d = Math.hypot(a.x - w.player.x, a.y - w.player.y);
        if (d < 230) a.face('player');
      }
    }
  };
  void tick().catch(() => { /* world stopped */ });
}

// ---------------------------------------------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------------------------------------------

const TRACKS = ['huf-1', 'huf-2', 'huf-3', 'huf-4', 'huf-5'];

export async function strasseSkript(w: WorldCtx): Promise<void> {
  w.lookMode.enable(true);
  w.on('clue', '*', id => {
    const i = TRACKS.indexOf(id);
    if (i >= 0 && i < TRACKS.length - 1 && !G.state.is('k2-spuren-ende')) w.setObjectiveTarget(TRACKS[i + 1]);
  });
  if (G.state.is('k2-entschieden')) {
    w.setObjective('k2-osten', 'Folge der Straße nach Osten.', [1270, ROAD_Y]);
    return;
  }
  await sleep(700);
  if (!G.state.is('k2-spuren-ende')) {
    await w.think('Die Spuren führen den Feldweg hinauf. Zur Hauptstraße.');
    w.setObjective('k2-spur', 'Folge den Hufspuren zur Straße.', 'huf-1');
    await w.say('narrator', `Halte ${w.controlHint('look')} gedrückt: Im Spurenblick leuchten die Hufabdrücke auf.`);
  }
}

async function onTracksLost(w: WorldCtx): Promise<void> {
  if (G.state.is('k2-spuren-ende')) return;
  G.state.set('k2-spuren-ende');
  await w.think('Pflaster. Hier verlieren sich die Spuren.');
  await w.think('Auf den Steinen sieht man nichts. Nicht einmal Kyras Spuren.');
  w.completeObjective('k2-spur');
  nextReasoningStep(w);
}

function nextReasoningStep(w: WorldCtx): void {
  if (G.state.is('k2-entschieden')) return;
  if (!G.state.is('k2-schild-gelesen')) {
    w.setObjective('k2-wegweiser', 'Lies den Wegweiser an der Kreuzung.', 'wegweiser');
  } else if (!G.state.is('k2-spuren-ende')) {
    w.setObjective('k2-spur', 'Folge den Hufspuren zur Straße.', 'huf-1');
  } else {
    w.setObjective('k2-ueberlegen', 'Überlege am Wegweiser: Wohin sind die Reiter geritten?', 'wegweiser');
  }
}

async function onSignpost(w: WorldCtx): Promise<void> {
  if (G.state.is('k2-entschieden')) {
    await w.think('Trapas im Westen, Portas im Osten. Ich habe mich entschieden.');
    return;
  }
  if (!G.state.is('k2-schild-gelesen')) {
    G.state.set('k2-schild-gelesen');
    await w.think('„Trapas – ein halber Tag.“ Und in die andere Richtung: „Portas.“');
    await w.think('Darunter, kleiner: „über Hagenfurt, Birkenau, Wolfsmühle“ … und noch mehr Dörfer, als aufs Brett passen.');
    G.state.addClue('k2-wegweiser');
    await w.think('Gut, dass Mutter darauf bestanden hat, dass wir lesen lernen. Kyra wäre jetzt aufgeschmissen.');
    await w.think('Trapas … dorthin fuhr Vater jede Woche zum Markt.');
    G.state.addMemory('k2-mem-markt');
    w.completeObjective('k2-wegweiser');
    nextReasoningStep(w);
    if (!G.state.is('k2-spuren-ende')) return;
  }
  if (!G.state.is('k2-spuren-ende')) {
    await w.think('Erst will ich wissen, wohin die Spuren führen.');
    return;
  }
  await reason(w);
}

/**
 * Lia's deduction (DESIGN §7.4): the player picks her arguments; wrong ones get her own dry rebuttal and the
 * question stays open. Ends always with east, but mistakes are remembered (k2-denkfehler).
 */
async function reason(w: WorldCtx): Promise<void> {
  ui().prefetchPlate('k2-wegweiser');
  await w.cutscene(async () => {
    await w.camera.pan([640, 330], 1400);
    await w.think('Westen oder Osten. Denk nach, Lia. So wie Alana es tun würde.');
    await w.camera.pan([262, 330], 900);

    let mistakes = 0;
    // Question 1: why not Trapas?
    for (const tried = new Set<number>(); ;) {
      const pick = await w.choose([
        { text: '„Trapas ist zu weit weg.“', disabled: tried.has(0), reason: 'Schon verworfen.' },
        { text: '„Die Spuren biegen nach Osten ab.“', disabled: tried.has(1), reason: 'Schon verworfen.' },
        { text: '„In Trapas stehen eine Garnison und der Lichterorden.“', tag: 'Wissen' },
      ], { speaker: 'k2-lia', prompt: 'Was spricht gegen Trapas?' });
      if (pick === 2) {
        await w.say('k2-lia', 'Starke Mauern, eine Garnison, der Lichterorden. Freiwillig reiten Dunkelschatten nicht vor die Tore einer Festung.', { mood: 'thinking' });
        G.state.addLore('k2-lore-trapas');
        break;
      }
      tried.add(pick); mistakes++;
      if (pick === 0) await w.say('k2-lia', 'Unsinn. Vater fuhr mit dem Karren an einem Tag hin und zurück. Steht sogar auf dem Schild.', { mood: 'thinking' });
      else await w.say('k2-lia', 'Welche Spuren? Auf dem Pflaster sieht man rein gar nichts.', { mood: 'sad' });
    }
    // Question 2: why Portas?
    for (const tried = new Set<number>(); ;) {
      const pick = await w.choose([
        { text: '„Auf der Straße nach Osten ist mehr los.“', disabled: tried.has(0), reason: 'Schon verworfen.' },
        { text: '„Der Weg nach Portas führt an vielen Dörfern vorbei.“', tag: 'Wegweiser' },
        { text: '„Kyra wollte immer nach Portas.“', disabled: tried.has(2), reason: 'Schon verworfen.' },
      ], { speaker: 'k2-lia', prompt: 'Und was spricht für Portas?' });
      if (pick === 1) {
        await w.say('k2-lia', 'Wochenlang Straße, Dorf an Dorf, und keine Mauern. Dort können sie ungestört Halt machen.', { mood: 'determined' });
        break;
      }
      tried.add(pick); mistakes++;
      if (pick === 0) await w.say('k2-lia', 'Mehr los? Seit einer Stunde ist hier kein einziger Wagen vorbeigekommen.', { mood: 'thinking' });
      else await w.say('k2-lia', 'Als ob die Kyra gefragt hätten, wohin sie will.', { mood: 'sad' });
    }
    const dir = await w.choose(['Nach Osten. Nach Portas.', 'Nach Westen. Nach Trapas.'], { speaker: 'k2-lia', prompt: 'Also: wohin?' });
    if (dir === 1) {
      mistakes++;
      await w.say('k2-lia', 'Nein. Alles spricht dagegen. Ich höre auf meinen Kopf, nicht auf meine Füße.', { mood: 'determined' });
    }
    G.state.set('k2-denkfehler', mistakes);
    G.state.set('k2-entschieden', 'osten');
    w.completeObjective('k2-ueberlegen');
    sfx('page');
    await G.ui.plate('k2-wegweiser', { caption: 'Nach Osten', pan: 'right', durationMs: 14000 });
    await w.say('k2-lia', 'Halte durch, Kyra. Ich komme.', { mood: 'determined' });
    if (mistakes === 0) await w.think('Mutter hätte gesagt: „Erst denken, dann laufen.“ Diesmal habe ich auf sie gehört.');
    await G.ui.closePlate();
    w.camera.follow();
  });
  bg(w.lighting.set('dusk', 45000));
  w.setObjective('k2-osten', 'Folge der Straße nach Osten.', [1270, ROAD_Y]);
}

// ---------------------------------------------------------------------------------------------------------------
// Soft borders
// ---------------------------------------------------------------------------------------------------------------

async function pushBack(w: WorldCtx, dx: number, dy = 0): Promise<void> {
  await w.cutscene(async () => {
    await w.player.walkTo([w.player.x + dx, w.player.y + dy], { straight: true });
  });
}

async function onHomeward(w: WorldCtx): Promise<void> {
  await w.think('Zurück? Dort wartet nur noch ein leeres Haus. Und zwei Gräber.');
  await pushBack(w, 0, -34);
}

async function onWest(w: WorldCtx): Promise<void> {
  if (G.state.is('k2-entschieden')) await w.think('Nicht nach Trapas. Die Reiter sind nach Osten.');
  else await w.think('Einfach drauflos? Erst überlege ich, wohin sie geritten sind.');
  await pushBack(w, 40);
}

async function onTooEarly(w: WorldCtx): Promise<void> {
  if (G.state.is('k2-entschieden')) return;
  await w.think('Halt. Erst muss ich wissen, in welche Richtung sie geritten sind.');
  await pushBack(w, -40);
  nextReasoningStep(w);
}

async function onEmptyRoad(w: WorldCtx): Promise<void> {
  await w.think('So still. Vater sagte, früher zogen hier jeden Tag Händler und Pilger entlang.');
}

async function onEast(w: WorldCtx): Promise<void> {
  if (!G.state.is('k2-entschieden')) { await pushBack(w, -40); return; }
  await w.cutscene(async () => {
    await w.player.walkTo([1270, w.player.y], { straight: true });
    await w.think('Bald ist es dunkel. Und weit und breit kein Gasthaus.');
    await w.think('Direkt an der Straße schlafen? Lieber nicht. Ich will nicht gefunden werden.');
  });
  w.completeObjective('k2-osten');
  await G.ui.fade('out', 900);
  await G.ui.narrate([
    'Die Straße mündete in einen großen Wald. Aus einzelnen Bäumen wurde ein Dickicht, durch das kaum noch Abendsonne drang.',
    'Lia schlug sich seitwärts ins Gebüsch, bis sie etwa hundert Schritte von der Straße entfernt war. Dort würde niemand ihr Lager sehen.',
  ], { style: 'card' });
  await gotoNext('erstes-lager');
}

// ---------------------------------------------------------------------------------------------------------------
// Jugglers (on their way to the Verbannungsfest in Trapas)
// ---------------------------------------------------------------------------------------------------------------

async function needsDecision(w: WorldCtx): Promise<boolean> {
  if (G.state.is('k2-entschieden')) return false;
  await w.think('Erst muss ich wissen, wohin ich gehe.');
  return true;
}

async function talkGaukler(w: WorldCtx): Promise<void> {
  if (await needsDecision(w)) return;
  const g = w.actor('gaukler');
  if (G.state.is('k2-gaukler-geredet')) {
    await askRiders(w);
    return;
  }
  bg(g.emote('!', 800));
  await g.say('Holla! Ein Wandersmädchen! Hast du dich verlaufen, oder willst du auch zum Fest?');
  const p = await w.choose(['„Zum Fest?“', '„Ich suche jemanden.“']);
  if (p === 1) await g.say('Das tun wir alle, Mädchen. Ich suche seit Jahren ein Publikum, das nicht mit Rüben wirft.');
  await g.say('Zum Verbannungsfest in Trapas! In drei Tagen. Ich jongliere, Ruben singt, Mara tanzt auf dem Seil.');
  await w.say('k2-lia', 'Ich durfte nie mit. Vater sagte jedes Jahr, ich sei noch zu jung.', { mood: 'sad' });
  G.state.addMemory('k2-mem-fest');
  await g.say('Zu jung für ein Fest? Dann kennst du nicht mal die Geschichte! Also, pass auf …');
  await g.say('Vor langer Zeit stürzten die *zwölf* ersten Menschen die Göttin Xenovia und warfen sie ins Meer!');
  const p2 = await w.choose([{ text: '„Zehn. Es waren zehn.“', tag: 'Bücherwissen' }, 'Höflich weiter zuhören.']);
  if (p2 === 0) {
    bg(g.emote('?', 900));
    await g.say('Zehn? … Zehn! Mara! Sie hat recht! Seit Jahren erzähle ich das falsch.');
    await w.say('k2-gauklerin', 'Seit Jahren sage ich es dir.');
    await g.say('Dann erzähl du weiter, Gelehrte. Ich höre.');
    await w.say('k2-lia', 'Die Zehn nahmen ihr die Urmacht, sperrten sie weg und verbannten Xenovia auf den Meeresgrund.', { mood: 'happy' });
    await w.say('k2-lia', 'Das Kettengebäck steht für die Knechtschaft, die zerbrochen wurde.');
    await g.say('Besser hätte es kein Ratsherr sagen können. Hier, für die Gelehrte. Frisch vom Bäcker in Hagenfurt.');
    G.state.give('chain-pastry');
    G.state.set('k2-gaukler-freund');
  } else {
    await g.say('… und Crios, der Adler, riss ihr mit einem Schrei die Krone vom Haupt! Seitdem feiern wir mit Kettengebäck!');
    await w.think('So steht das in keinem Buch. Aber er erzählt es schön.');
  }
  G.state.addLore('k2-lore-xenovia');
  G.state.set('k2-gaukler-geredet');
  await askRiders(w);
}

async function askRiders(w: WorldCtx): Promise<void> {
  const g = w.actor('gaukler');
  if (G.state.hasClue('k2-gaukler-reiter')) {
    await g.say('Pass auf dich auf, Gelehrte. Und wenn du je nach Trapas kommst: Wir spielen am Brunnenplatz!');
    return;
  }
  const p = await w.choose(['„Seid ihr unterwegs Reitern begegnet?“', '„Gute Reise.“']);
  if (p === 1) { await g.say('Dir auch, Mädchen. Und lauf nicht im Dunkeln!'); return; }
  if (G.state.is('k2-gaukler-freund')) {
    await tellRiders(w, 'gaukler');
    return;
  }
  bg(g.emote('…', 900));
  await g.say('Reiter? Wir … wir haben nichts gesehen. Gar nichts.');
  const p2 = await w.choose(['„Bitte. Sie haben meine Schwester.“', '„Schon gut.“']);
  if (p2 === 1) return;
  await w.say('k2-gauklerin', 'Lass gut sein, Jaro. Sieh sie dir an. Erzähl es ihr.');
  await tellRiders(w, 'gaukler');
}

async function tellRiders(w: WorldCtx, who: string): Promise<void> {
  const g = w.actor(who);
  await g.say('Heute früh, kurz nach Hagenfurt. Fünf Reiter in schwarz-weißen Röcken. Wir sind in den Graben gesprungen.');
  await g.say('Einer hatte ein Mädchen quer über dem Sattel. Die hat gestrampelt und gebissen wie eine Wildkatze.');
  await w.say('k2-lia', 'Kyra.', { mood: 'surprised' });
  await w.say('k2-lia', 'Sie lebt. Und sie wehrt sich. Natürlich wehrt sie sich.', { mood: 'determined' });
  G.state.addClue('k2-gaukler-reiter');
  await g.say('Sie ritten nach Osten. Und, Mädchen … lauf denen nicht allein hinterher. Bitte.');
}

async function talkBarde(w: WorldCtx): Promise<void> {
  if (await needsDecision(w)) return;
  const b = w.actor('barde');
  bg(b.emote('note', 1200));
  await b.say('♪ Die Göttin sank ins tiefe Meer, die Kette brach, sie kam nicht mehr … ♪');
  await b.say('Das neue Lied für das Fest. Zu düster? Mara sagt, zu düster.');
  const p = await w.choose(['„Ein bisschen düster.“', '„Es ist wunderschön.“']);
  if (p === 0) await b.say('Ich wusste es. Ich schreibe eine Strophe mit einem Hund dazu. Leute mögen Hunde.');
  else { bg(b.emote('heart', 1000)); await b.say('Endlich jemand mit Geschmack! Mara, hast du das gehört?'); }
}

async function talkGauklerin(w: WorldCtx): Promise<void> {
  if (await needsDecision(w)) return;
  const m = w.actor('gauklerin');
  if (G.state.hasClue('k2-gaukler-reiter')) {
    await m.say('Bleib nicht auf der Straße, wenn es dunkel wird. Versprich mir das.');
    return;
  }
  await m.say('Ganz allein unterwegs? In deinem Alter bin ich auch weggelaufen. Mit einem Jongleur. Großer Fehler.');
  await m.say('Red mit Jaro, dem Bunten. Er redet zwar zu viel, aber er hat ein gutes Herz.');
}

// ---------------------------------------------------------------------------------------------------------------
// Merchants (they stare; they sell tinder; they warn about the night)
// ---------------------------------------------------------------------------------------------------------------

async function talkHaendler(w: WorldCtx): Promise<void> {
  if (await needsDecision(w)) return;
  const h = w.actor('haendler');
  if (!G.state.is('k2-haendler-geredet')) {
    G.state.set('k2-haendler-geredet');
    await h.say('Sieh an. Ein Mädchen. Allein. Zu Fuß. Bei Dämmerung.');
  } else {
    await h.say('Noch etwas, Kleine?');
  }
  for (;;) {
    const opts = [
      { text: '„Und ihr starrt. Mit offenem Mund. Bei Dämmerung.“', disabled: G.state.is('k2-haendler-frech'), reason: 'Schon gesagt.' },
      { text: '„Habt ihr Reiter gesehen?“', disabled: G.state.is('k2-haendler-reiter'), reason: 'Schon gefragt.' },
      '„Was verkauft ihr?“',
      'Weitergehen.',
    ];
    const p = await w.choose(opts);
    if (p === 0) {
      G.state.set('k2-haendler-frech');
      await w.say('k2-knecht', 'Ha! Die hat Haare auf den Zähnen, Herr!');
      await h.say('Freches Ding. Gefällt mir. Aber Frechheit macht nicht satt und hält keine Räuber ab.');
    } else if (p === 1) {
      G.state.set('k2-haendler-reiter');
      await h.say('Wir kommen aus Trapas. Nach Westen ist alles still. Und still heißt hier draußen nichts Gutes.');
      await h.say('Seit Dunkelhain schützt die Straßen keiner mehr. Die Fürsten hocken hinter ihren Mauern und zählen Steuern.');
      G.state.addLore('k2-lore-strassen');
    } else if (p === 2) {
      await shop(w);
    } else {
      break;
    }
  }
  await h.say('Ein Rat umsonst: Schlaf nicht an der Straße. Nachts gehört sie den Schatten.');
}

async function shop(w: WorldCtx): Promise<void> {
  const h = w.actor('haendler');
  if (!G.state.has('tinder')) {
    await h.say('Zunderschwamm. Trocken wie die Witze meiner Großmutter. Ein Silberling.');
    const p = await w.choose(['„Ein Silberling? Für einen Pilz?“', '„Nein danke.“']);
    if (p === 1) return;
    await w.say('k2-lia', 'Für einen Silberling bekommt man in Trapas einen ganzen Sack davon. Vater hat dort jede Woche verkauft.', { mood: 'thinking' });
    bg(h.emote('…', 900));
    await h.say('… Drei Kupfer. Weil du so frech bist. Und weil mein Knecht lacht.');
    const p2 = await w.choose(['Drei Kupfer zahlen.', '„Doch nicht.“']);
    if (p2 === 1) return;
    sfx('pickup', { volume: 0.4 });
    G.state.give('tinder');
    G.state.inc('k2-kupfer-ausgegeben', 3);
    await w.think('Zunder. Daran hätte ich zu Hause denken sollen.');
    return;
  }
  if (!G.state.has('apple')) {
    await h.say('Äpfel aus dem Alten Land. Einer kostet ein Kupfer, für dich auch zwei.');
    const p = await w.choose(['Ein Kupfer zahlen.', '„Nein danke.“']);
    if (p === 1) return;
    G.state.give('apple');
    G.state.inc('k2-kupfer-ausgegeben', 1);
    return;
  }
  await h.say('Mehr hab ich nicht für kleine Leute mit kleinen Beuteln.');
}

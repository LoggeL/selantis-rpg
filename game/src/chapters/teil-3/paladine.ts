// Scene „e3-paladine“ – Händler und Tochter (docs/teil-3/umsetzung.md §3, F3 06:01–09:30). Two checkpointed parts
// (G.goto with { part }, a reload restarts the current part):
//  1. default, e3-landstrasse, afternoon: Lia walks the road to Trapas with Ignatius as her companion; he rehearses
//     the cover story once (merchant, goods stored with a merchant in Trapas, on foot from Portas because the land
//     route is plundered). Optional: read the milestone. A patrol of three paladins stops them. Heart: holding the
//     cover story – Lia has to answer twice herself (paladine-regeln.ts); fitting answers keep the leader calm, slips
//     (farm, sister, the Urmacht, a summer festival in autumn) make the young one sharper. e3-tarnung = 0–2. The
//     leader takes Ignatius along; Lia stops him with „Er ist mein Vater“ (choice of words, all lead there). Both are
//     bound (plate e3-paladine), the leader takes her staff and Ignatius' Schattentöter for the armoury
//     (confiscateStaffs → e3-stab-ort = 'waffenkammer', − e3-lia-staff). Parting remark by e3-tarnung.
//  2. 'trapas', e3-trapas: plate e3-trapas, then the escort through the gate (Lia bound, e3-lia-gefesselt; Ignatius
//     e3-ignatius-gefesselt). Lia follows the leader; falling behind or wandering off gets a warning, then she is
//     fetched back. Stop at the smithy: free time on a leash – the order's notice (only Lia can read it; Ignatius did
//     not know she could, e3-lore-lichterorden), the smith, the fountain from Mother's stories (Mother came from
//     Trapas). Then on to the order house → e3-schutzreaktion.
import { G } from '../../core/G';
import { registerSpeakers } from '../../core/catalog';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import {
  MILESTONE, PATROL_ZONE, ROAD_OCCLUDERS, ROAD_SPOT, ROAD_SURFACES, ROAD_WALK, SMITH_LEASH, TRAPAS_BLOCKS,
  TRAPAS_OCCLUDERS, TRAPAS_SPOT, TRAPAS_SURFACES, TRAPAS_WALK,
} from './paladine-orte';
import {
  confiscateStaffs, coverScore, escortVerdict, GOODS_ANSWERS, insideLeash, leaderVerdict, ROAD_ANSWERS, type Slip,
} from './paladine-regeln';
import { bg, e3Scene, lia, liaLook, nextScene, sfx, ui, until } from './shared';

registerSpeakers([
  { id: 'e3-paladin-jung', name: 'Junger Paladin', portrait: 'paladin', voice: { pitch: 175, wave: 'square' }, color: '#c8d4e8' },
  { id: 'e3-schmied', name: 'Schmied', portrait: 'villager-m', voice: { pitch: 115, wave: 'triangle' }, color: '#a8794a' },
  { id: 'e3-buergerin', name: 'Bürgerin', portrait: 'villager-f', voice: { pitch: 250, wave: 'sine' }, color: '#b8a080' },
  { id: 'e3-buerger', name: 'Bürger', portrait: 'villager-m', voice: { pitch: 140, wave: 'triangle' }, color: '#b8a080' },
]);

const MENTOR = 'ignatius';
const LEADER = 'pal-fuehrer';
const YOUNG = 'pal-jung';
const GUARD = 'pal-wache';
const THIRD = 'pal-dritter';
/** Set right before the checkpoint into Trapas: both are bound and the staffs are gone. */
const BOUND = 'e3-pal-gefesselt';
const WAITING = 'e3-pal-warten';
const SEEN = { notice: 'e3-pal-aushang', smith: 'e3-pal-schmied', fountain: 'e3-pal-brunnen' } as const;
const MENTOR_TALKED = 'e3-pal-ignatius-gesprochen';

const mentor = (w: WorldCtx, text: string, mood?: string) => w.say('e2-ignatius', text, mood ? { mood } : undefined);
const leader = (w: WorldCtx, text: string) => w.say('e3-paladin', text);
const young = (w: WorldCtx, text: string) => w.say('e3-paladin-jung', text);
const smith = (w: WorldCtx, text: string) => w.say('e3-schmied', text);
const dist = (a: ActorHandle, b: ActorHandle) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------------------------------------------------------------------------------------------------------
// Part 1: the road
// ---------------------------------------------------------------------------------------------------------------

export const landstrasse: MapDef = defineMap({
  id: 'e3-landstrasse',
  name: 'Die Landstraße nach Trapas',
  background: 'e3-landstrasse',
  walk: ROAD_WALK,
  block: [{ id: 'meilenstein', poly: MILESTONE }],
  occluders: ROAD_OCCLUDERS,
  surfaces: ROAD_SURFACES,
  surface: 'grass',
  interactables: [
    {
      id: 'meilenstein', verb: 'Lesen', poly: [[364, 302], [391, 302], [391, 342], [364, 342]], radius: 26, once: false,
      standAt: ROAD_SPOT.milestone, face: 'up', onInteract: readMilestone,
    },
  ],
  triggers: [{ id: 'patrouille', poly: PATROL_ZONE }],
  exits: [
    { id: 'zurueck', poly: [[0, 330], [14, 330], [14, 444], [0, 444]], to: 'e3-landstrasse', spawn: 'start', when: () => false, blocked: 'Zurück in den Wald? Ignatius’ Knie würden mir das nie verzeihen.' },
    { id: 'weiter', poly: [[1266, 330], [1280, 330], [1280, 404], [1266, 404]], to: 'e3-landstrasse', spawn: 'start', when: () => false, blocked: 'Trapas liegt da vorn. Aber erst einmal bis zur Brücke.' },
  ],
  spawns: { start: { at: ROAD_SPOT.start, dir: 'right' } },
  time: 'day',
  weather: 'leaves',
  ambience: ['wind', 'birds'],
  ambienceVolume: { wind: 0.55, birds: 0.4 },
  music: 'exploration',
  resetOnEnter: true,
});

async function readMilestone(w: WorldCtx): Promise<void> {
  if (G.state.is('e3-pal-meilenstein')) { await w.think('„Trapas, zwei Stunden.“ Und eine Gans, die ein Vogel sein will.'); return; }
  G.state.set('e3-pal-meilenstein');
  await w.think('Ein Meilenstein. Die Kerben sind verwittert, aber ich kann sie lesen: „Trapas, zwei Stunden.“');
  await w.think('Darunter hat jemand mit dem Messer einen Vogel eingeritzt. Er sieht aus wie eine Gans mit Ehrgeiz.');
}

const WALK_BARKS = ['Meine Knie sagen, Trapas ist weiter.', 'Händler. Nadeln. Faden. Ganz einfach.', 'Schöne Hecken. Gute Verstecke.'];

async function briefing(w: WorldCtx): Promise<void> {
  const m = w.actor(MENTOR);
  await w.cutscene(async () => {
    await w.player.walkTo(120, 384, { face: 'right' });
    m.face('player');
    w.player.face(MENTOR);
    await mentor(w, 'Noch einmal, bevor uns jemand begegnet. Ich bin Händler. Kein Magier, kein Einsiedler, kein alter Mann mit Geschichten.', 'thinking');
    await lia(w, 'Ihr seid alles drei. Gleichzeitig.');
    await mentor(w, 'Heute nur eins. Unsere Ware lagert bei einem Händler in Trapas. Wir kommen von Portas, zu Fuß, ohne Wagen.', 'happy');
    await lia(w, 'Ohne Wagen. Das fragt doch jeder als Erstes.', 'thinking');
    await mentor(w, 'Und jeder versteht die Antwort: Zwischen Portas und hier räumen Dunkelschatten jeden vollen Wagen aus. Wir haben nichts, was sich lohnt.');
    await lia(w, 'Und wer bin ich in dieser Geschichte?');
    await mentor(w, 'Eine Begleitung. Eine schweigsame, wenn es geht. Und wenn nicht, dann sagst du nur, was ich eben gesagt habe.', 'happy');
    await w.think('Händler. Ware in Trapas. Zu Fuß von Portas. Klingt wie das langweiligste Buch der Welt. Vermutlich ist das der Sinn.');
  });
}

/** Ignatius mutters now and then while they walk (until the patrol comes). */
async function walkBarks(w: WorldCtx): Promise<void> {
  let i = 0;
  while (w.alive && !G.state.is('e3-pal-angehalten')) {
    await w.wait(9000);
    if (G.state.is('e3-pal-angehalten') || G.ui.busy()) continue;
    w.bark(MENTOR, WALK_BARKS[i++ % WALK_BARKS.length], 2600);
  }
}

async function patrolArrives(w: WorldCtx): Promise<void> {
  G.state.set('e3-pal-angehalten');
  await w.cutscene(async () => {
    const lead = w.spawn({ id: LEADER, preset: 'paladin', speaker: 'e3-paladin', at: ROAD_SPOT.patrolIn, dir: 'left', solid: false });
    const jung = w.spawn({ id: YOUNG, preset: 'paladin', speaker: 'e3-paladin-jung', at: [ROAD_SPOT.patrolIn[0], ROAD_SPOT.patrolIn[1] - 18], dir: 'left', solid: false });
    const third = w.spawn({ id: THIRD, preset: 'paladin', speaker: 'e3-paladin', at: [ROAD_SPOT.patrolIn[0], ROAD_SPOT.patrolIn[1] + 18], dir: 'left', solid: false });
    for (const a of [lead, jung, third]) a.hold(true);
    sfx('sword-draw', { volume: 0.5, distance: 0.5 });
    w.bark(YOUNG, 'Halt! Stehen bleiben!', 2200);
    await w.camera.pan([860, 370], 900);
    bg(jung.walkTo(ROAD_SPOT.young[0], ROAD_SPOT.young[1], { face: 'left' }));
    bg(third.walkTo(ROAD_SPOT.third[0], ROAD_SPOT.third[1], { face: 'left' }));
    bg(w.player.walkTo(ROAD_SPOT.stopLia[0], ROAD_SPOT.stopLia[1], { face: 'right' }));
    bg(w.actor(MENTOR).walkTo(ROAD_SPOT.stopMentor[0], ROAD_SPOT.stopMentor[1], { face: 'right' }));
    await lead.walkTo(ROAD_SPOT.leader[0], ROAD_SPOT.leader[1], { face: 'left' });
    await w.camera.pan([640, 376], 700);
    await w.think('Weiß und Silber, und auf der Brust der weiße Vogel. Paladine. Ganz echte, aus keinem Buch.');
    await leader(w, 'Paladine des Lichterordens. Woher, wohin, und was tragt ihr bei euch?');
    await mentor(w, 'Von Portas nach Trapas, Herr. Ich handle mit Nadeln und Faden. Das Mädchen begleitet mich.');
    await leader(w, 'Nadeln und Faden. Ich sehe weder das eine noch das andere. Nur einen Stock und noch einen Stock.');
    await mentor(w, 'Die Ware wartet in Trapas auf mich, bei einem Kollegen am Markt. Trocken, gezählt und gut bewacht.');
  });
}

/** One of Lia's two answers. Returns what slipped out. */
async function coverAnswer(w: WorldCtx, answers: typeof GOODS_ANSWERS): Promise<Slip> {
  const pick = await w.choose(answers.map(a => a.text));
  return answers[pick].slip;
}

async function holdCover(w: WorldCtx): Promise<Slip[]> {
  const jung = w.actor(YOUNG), m = w.actor(MENTOR);
  return w.cutscene(async () => {
    jung.face('player');
    await young(w, 'Und du? Wo liegt eure Ware, Mädchen? Schnell, und ohne ihn anzusehen.');
    const first = await coverAnswer(w, GOODS_ANSWERS);
    if (first === 'none') {
      await young(w, 'Hm. Das hat er auch gesagt.');
      await leader(w, 'Was dafür spricht, dass es stimmt. Oder dass sie es geübt haben.');
    } else if (first === 'hof') {
      await young(w, 'Auf dem Hof? Eben lag sie noch in Trapas.');
      m.face(YOUNG);
      await mentor(w, 'Sie meint den Hof hinter dem Laden. Sie ist müde, Herr. Wir laufen seit Tagen.', 'worried');
      await leader(w, 'Müde Leute lügen schlecht. Das merke ich mir.');
    } else {
      await young(w, 'Welche Schwester? Von einer Schwester war keine Rede.');
      m.face(YOUNG);
      await mentor(w, 'Ihre Schwester führt die Bücher. Eine Familiensache, Ihr versteht.', 'worried');
      await leader(w, 'Ein großer Laden für zwei Leute ohne Wagen.');
      await w.think('Kyra und Bücher führen. Wenn sie das hört, lacht sie sich krank.');
    }
    await leader(w, 'Und warum zu Fuß? Den Landweg nimmt im Herbst keiner, der bei Verstand ist.');
    m.face('right');
    await mentor(w, 'Gerade deshalb, Herr, weil …');
    w.actor(LEADER).face('player');
    await leader(w, 'Lass ihn. Du antwortest, Mädchen. Warum zu Fuß?');
    const second = await coverAnswer(w, ROAD_ANSWERS);
    if (second === 'none') {
      await leader(w, 'Klug. Oder gut auswendig gelernt.');
      await w.think('Beides.');
    } else if (second === 'urmacht') {
      await leader(w, 'Etwas folgt euch?');
      await young(w, 'Genau so reden Späher, Herr. Damit man Mitleid kriegt und nicht nachfragt.');
      await mentor(w, 'Wölfe. Sie meint Wölfe. Wir haben sie zwei Nächte lang gehört.', 'worried');
    } else {
      await leader(w, 'Das Verbannungsfest war im Sommer, Mädchen. Ihr seid ein paar Monate zu spät dran.');
      await lia(w, 'Wir … gehen langsam.', 'scared');
    }
    return [first, second];
  });
}

async function father(w: WorldCtx): Promise<void> {
  const m = w.actor(MENTOR), lead = w.actor(LEADER);
  await w.cutscene(async () => {
    await young(w, 'Herr, die lügen. Alle beide. Lasst mich ihnen die Taschen umdrehen.');
    await leader(w, 'Ruhig. Ob sie lügen, entscheidet der Großmeister, nicht du.');
    lead.face(MENTOR);
    await leader(w, 'Du kommst mit, Händler. Kennt dich dein Kollege am Markt, bist du heute Abend wieder frei.');
    await mentor(w, 'Herr, ich verkaufe Faden. Davor muss niemand eine Stadt beschützen.', 'worried');
    await leader(w, 'Letzte Woche hat einer, der auch nur Faden verkaufte, einem Trupp Dunkelschatten unsere Wege verraten.');
    await leader(w, 'Das Mädchen kann gehen. Die Straße ist bis zum Tor bewacht.');
    bg(w.actor(THIRD).walkTo(m.x + 18, m.y + 4, { face: 'left' }));
    await w.wait(500);
    await w.think('Sie nehmen ihn mit. Und ich stehe allein auf einer Straße, mit einem Stab, den jeder anstarrt.');
    const pick = await w.choose([
      '„Halt! Er ist mein Vater. Ihr könnt mich doch nicht allein auf einer Straße stehen lassen.“',
      '„Er ist mein Vater. Ich habe hier draußen sonst niemanden mehr.“',
      '„Das ist mein Vater! Ich lasse ihn nicht mit drei Paladinen allein, die Faden für gefährlich halten.“',
    ]);
    G.state.set('e3-vater-wahl', ['halt', 'allein', 'frech'][pick]);
    void m.emote('!');
    await w.think('Ignatius sieht mich an, als hätte ich ihm eben einen Zahn gezogen. Einen gesunden.');
    lead.face('player');
    await leader(w, 'Dein Vater. So.');
    await leader(w, 'Dann marschiert ihr zu zweit. Zwei, die man bewacht, machen weniger Ärger als einer und eine, die hinterherschleicht.');
    await lia(w, 'Das ist nicht, was ich …', 'angry');
    m.face('player');
    await mentor(w, 'Lass gut sein. Wir gehen mit. In Trapas wird sich alles aufklären.', 'worried');
    await leader(w, 'Fesseln. Beiden. Und dann los.');
  });
}

async function bound(w: WorldCtx, score: number): Promise<void> {
  const m = w.actor(MENTOR);
  ui().prefetchPlate('e3-paladine');
  await w.cutscene(async () => {
    if (leaderVerdict(score) === 'familiensinn') await leader(w, 'So viel Familiensinn auf offener Straße. Beinahe schade, dass ich euch kein Wort glaube.');
    else await leader(w, 'Vernünftig. Wer nicht zappelt, dem schneidet der Strick nicht ein.');
    bg(w.actor(YOUNG).walkTo(w.player.x + 16, w.player.y - 4, { face: 'left' }));
    sfx('rope-cut', { volume: 0.4, pitch: 0.6 });
    await G.ui.plate('e3-paladine', { caption: 'Händler und Tochter', pan: 'in', durationMs: 26000 });
    await w.say('narrator', 'Ein Strick um Ignatius’ Handgelenke, ein zweiter um Lias. Der junge Paladin zog die Knoten fester, als es nötig gewesen wäre.');
    await leader(w, 'Und das Holz gibst du mir. Händlertöchter tragen keine Stäbe, die so hell sind.');
    await lia(w, 'Das ist ein Wanderstab. Für … steile Wanderungen.', 'scared');
    await leader(w, 'Dann wandert er ab jetzt mit mir.');
    await young(w, 'Der Alte hat auch einen, Herr. Knorrig, mit Lederband.');
    await leader(w, 'Beide in die Waffenkammer. Der Großmeister soll sich ansehen, womit Händler heute so handeln.');
    await G.ui.closePlate();
    confiscateStaffs();
    w.player.setLook(liaLook({ bound: true }));
    m.setLook('e3-ignatius-gefesselt');
    await w.think('Heute früh unter der Weide gewachsen, am Nachmittag in fremden Händen. Ich hatte ihn keinen einzigen Tag.');
  });
}

async function strasseScript(w: WorldCtx): Promise<void> {
  for (const f of ['e3-pal-angehalten', 'e3-pal-meilenstein']) G.state.set(f, false);
  w.lockPlayer();
  await ui().fade('in', 1000);
  await briefing(w);
  w.unlockPlayer();
  w.setObjective('e3-pal-weg', 'Folge der Landstraße nach Trapas.', [820, 362]);
  bg(walkBarks(w));
  await w.waitForTrigger('patrouille');
  await until(w, () => !G.ui.busy(), 120);
  w.completeObjective('e3-pal-weg');
  await patrolArrives(w);
  const slips = await holdCover(w);
  const score = coverScore(slips);
  G.state.set('e3-tarnung', score);
  await father(w);
  await bound(w, score);
  w.lockPlayer();
  await ui().fade('out', 1200);
  await G.ui.narrate(['Bis Trapas waren es noch zwei Stunden. Mit gebundenen Händen fühlten sie sich an wie zwei Tage.'], { style: 'card' });
  G.state.set(BOUND);
  await nextScene('e3-paladine', { part: 'trapas' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: through Trapas
// ---------------------------------------------------------------------------------------------------------------

export const trapasEskorte: MapDef = defineMap({
  id: 'e3-trapas-eskorte',
  name: 'Trapas',
  background: 'e3-trapas',
  walk: TRAPAS_WALK,
  block: TRAPAS_BLOCKS,
  occluders: TRAPAS_OCCLUDERS,
  surfaces: TRAPAS_SURFACES,
  surface: 'stone',
  npcs: [
    { id: 'schmied', preset: 'villager-m', speaker: 'e3-schmied', at: TRAPAS_SPOT.smith, dir: 'right', verb: 'Reden', talk: talkSmith },
    { id: 'buergerin', preset: 'villager-f', speaker: 'e3-buergerin', at: [764, 440], dir: 'left', barks: ['Schon wieder zwei vom Waldweg.', 'Die Kleine sieht nicht nach Späher aus.', 'Halt die Tasche fest.'], barkEvery: 6500 },
    { id: 'buerger', preset: 'villager-m', speaker: 'e3-buerger', at: [800, 236], dir: 'left', barks: ['Jeden Tag mehr Paladine.', 'Gefesselt? Was hat die denn angestellt?'], barkEvery: 8000 },
  ],
  interactables: [
    {
      id: 'aushang', verb: 'Lesen', at: [456, 282], radius: 30, once: false, sparkle: true, standAt: TRAPAS_SPOT.notice, face: 'up',
      when: () => G.state.is(WAITING), onInteract: readNotice,
    },
    {
      id: 'brunnen', verb: 'Ansehen', at: [578, 352], radius: 30, once: false, sparkle: true, standAt: TRAPAS_SPOT.fountain, face: 'up',
      when: () => G.state.is(WAITING), onInteract: lookFountain,
    },
  ],
  lights: [{ id: 'esse', at: [196, 336], kind: 'fire', radius: 46, intensity: 0.7, always: true }],
  spawns: {
    tor: { at: TRAPAS_SPOT.gate, dir: 'up' },
    platz: { at: TRAPAS_SPOT.liaWait, dir: 'left' },
  },
  time: 'day',
  ambience: ['wind', 'forge', 'birds'],
  ambienceVolume: { wind: 0.3, forge: 0.45, birds: 0.25 },
  music: 'exploration',
  resetOnEnter: true,
});

const seenCount = () => Object.values(SEEN).filter(f => G.state.is(f)).length;

function nextLook(): string | null {
  if (!G.state.is(SEEN.notice)) return 'aushang';
  if (!G.state.is(SEEN.smith)) return 'schmied';
  if (!G.state.is(SEEN.fountain)) return 'brunnen';
  return null;
}

function updateWaitObjective(w: WorldCtx): void {
  w.setObjective('e3-pal-umsehen', `Sieh dich um, solange der Paladin beim Schmied ist: Aushang, Schmied, Brunnen (${seenCount()}/3).`, nextLook());
}

/** The paladin behind Lia tells her off, then fetches her back to `to`. */
async function fetchBack(w: WorldCtx, to: readonly [number, number], line: string): Promise<void> {
  await w.cutscene(async () => {
    w.bark(YOUNG, line, 2200);
    sfx('suspicious', { volume: 0.4 });
    await w.player.walkTo(to[0], to[1]);
  });
}

/**
 * The leader walks the route point by point; he waits until Lia is close behind before each step. Falling far behind
 * or running off earns a warning, and past that she is fetched back behind him.
 */
async function escortWalk(w: WorldCtx, points: readonly (readonly [number, number])[]): Promise<void> {
  const lead = w.actor(LEADER);
  let lastWarn = -9999, t = 0;
  const check = async (): Promise<void> => {
    if (G.ui.busy()) return;
    const v = escortVerdict(dist(w.player, lead));
    if (v === 'warn' && t - lastWarn > 3500) {
      lastWarn = t;
      w.bark(YOUNG, ['Abstand halten!', 'Hier lang, Händlertochter.', 'Nicht trödeln.'][Math.floor(t / 1000) % 3], 2000);
    } else if (v === 'pull') {
      await fetchBack(w, [lead.x + 26, lead.y + 22], 'Das war weit genug!');
    }
  };
  for (const p of points) {
    while (w.alive && escortVerdict(dist(w.player, lead)) !== 'near') { await check(); await w.wait(200); t += 200; }
    let arrived = false;
    void lead.walkTo(p[0], p[1]).then(() => { arrived = true; });
    while (w.alive && !arrived) { await check(); await w.wait(200); t += 200; }
  }
}

async function enterCity(w: WorldCtx): Promise<void> {
  const lead = w.spawn({ id: LEADER, preset: 'paladin', speaker: 'e3-paladin', at: [640, 640], dir: 'up', solid: false, speed: 40 });
  lead.hold(true);
  ui().prefetchPlate('e3-trapas');
  // The plate goes up first, then the black lifts (as in Teil II): the city is seen from outside before the gate.
  await G.ui.plate('e3-trapas', { caption: 'Trapas', pan: 'in', durationMs: 24000 });
  await ui().fade('in', 900);
  await G.ui.say('narrator', 'Trapas. Mauern, dicker als ein Bauernhaus breit ist, und auf jedem Banner über dem Tor ein weißer Vogel.');
  await G.ui.say('e3-lia', 'Mutter hat gesagt, die Mauern seien so hoch, dass die Tauben auf halber Strecke Rast machen.', { mood: 'sad' });
  await G.ui.closePlate();
  await w.cutscene(async () => {
    await lead.walkTo(TRAPAS_SPOT.street[0], TRAPAS_SPOT.street[1] - 30, { face: 'down' });
    await w.player.walkTo(TRAPAS_SPOT.street[0], TRAPAS_SPOT.street[1] + 10, { face: 'up' });
    await w.think('Stimmen, Hammerschläge, Pferdemist und frisches Brot. So viele Menschen auf einmal habe ich noch nie gesehen.');
    await leader(w, 'Hinter mir bleiben. Wer trödelt, wird gezogen. Wer rennt, auch.');
  });
}

async function walkToSmith(w: WorldCtx): Promise<void> {
  w.setObjective('e3-pal-folgen', 'Folge dem Paladin durch die Stadt. Nicht zurückfallen, nicht davonlaufen.', LEADER);
  await escortWalk(w, [...TRAPAS_SPOT.route, TRAPAS_SPOT.leaderSmith]);
  w.completeObjective('e3-pal-folgen');
}

/** At the smithy: Ignatius and his guard step aside (Lia can talk to him), the young paladin stays at her heels. */
async function stopAtSmith(w: WorldCtx): Promise<void> {
  const lead = w.actor(LEADER);
  await w.cutscene(async () => {
    lead.face('left');
    await leader(w, 'Hier bleibt ihr stehen. Der Schmied schuldet dem Orden noch eine Antwort, und die will ich heute.');
    lead.face('player');
    await leader(w, 'Junge, lass sie nicht weiter als bis zum Brunnen. Und den Alten nicht aus den Augen.');
    await young(w, 'Jawohl, Herr.');
    const mx = w.actor(MENTOR).x, my = w.actor(MENTOR).y;
    const gx = w.actor(GUARD).x, gy = w.actor(GUARD).y;
    w.companions.remove(MENTOR);
    w.companions.remove(GUARD);
    const m = w.spawn({ id: MENTOR, preset: 'e3-ignatius-gefesselt', speaker: 'e2-ignatius', at: [mx, my], dir: 'left', solid: false, verb: 'Reden', talk: talkMentor });
    const g = w.spawn({ id: GUARD, preset: 'paladin', speaker: 'e3-paladin', at: [gx, gy], dir: 'left', solid: false });
    bg(m.walkTo(TRAPAS_SPOT.mentorWait[0], TRAPAS_SPOT.mentorWait[1], { face: 'left' }));
    bg(g.walkTo(TRAPAS_SPOT.mentorGuard[0], TRAPAS_SPOT.mentorGuard[1], { face: 'left' }));
    await w.player.walkTo(TRAPAS_SPOT.liaWait[0], TRAPAS_SPOT.liaWait[1], { face: 'up' });
    await w.think('Warten. Gefesselt, mitten in Mutters Stadt. Dann sehe ich mich wenigstens um.');
  });
}

const SMITH_TALK: [string, string][] = [
  [LEADER, 'Zweihundert Speerspitzen, Meister. Bis Neumond.'],
  ['schmied', 'Zweihundert? Aus welchem Eisen?'],
  [LEADER, 'Der Großmeister zahlt in Silber.'],
  ['schmied', 'Silber schmilzt man nicht zu Speeren.'],
];

/** The leader and the smith haggle in barks while Lia looks around. */
async function smithBanter(w: WorldCtx): Promise<void> {
  let i = 0;
  while (w.alive && G.state.is(WAITING)) {
    await w.wait(4200);
    if (!G.state.is(WAITING) || G.ui.busy()) continue;
    const [who, line] = SMITH_TALK[i++ % SMITH_TALK.length];
    w.bark(who, line, 2600);
  }
}

/** Keeps Lia within the leash (the square's west half) while she waits. */
async function leash(w: WorldCtx): Promise<void> {
  while (w.alive && G.state.is(WAITING)) {
    await w.wait(200);
    if (G.ui.busy() || insideLeash(w.player.x, w.player.y, SMITH_LEASH)) continue;
    await fetchBack(w, TRAPAS_SPOT.liaWait, 'Hiergeblieben! Bis zum Brunnen, nicht weiter.');
  }
}

async function readNotice(w: WorldCtx): Promise<void> {
  if (G.state.is(SEEN.notice)) { await w.think('Zwei Silberstücke für einen Dunkelschatten. Und nichts für einen Hof, der schon gebrannt hat.'); return; }
  await w.think('Am Mast ist ein Aushang festgenagelt. Dieselbe saubere Schrift wie auf allen anderen Masten.');
  await lia(w, '„Bekanntmachung des Lichterordens. Wer Dunkelschatten Unterschlupf gewährt, verliert sein Haus …“');
  await lia(w, '„… wer sie meldet, erhält zwei Silberstücke. Die Tore schließen bei Sonnenuntergang. Gezeichnet: der Großmeister.“');
  await lia(w, 'Zwei Silberstücke. Dafür hätte uns der Junge vermutlich auch ohne Grund gemeldet.', 'thinking');
  const m = w.actor(MENTOR);
  m.face('player');
  if (G.state.flag<string>('e2-abschied') === 'brief') {
    // He has read her note on birch bark (Teil II): what surprises him is the order's script, not that she reads.
    await mentor(w, 'Deine Rinde konnte ich lesen. Aber das da ist Ordensschrift, voller Schnörkel. Die liest hier nicht mal jeder Paladin.', 'thinking');
    await lia(w, 'Mutter hat genau so geschrieben. Ein Schnörkel an jedem großen Buchstaben. Ich dachte immer, das macht man so.');
  } else {
    await mentor(w, 'Du … liest das? Einfach so, im Vorbeigehen?', 'thinking');
    await lia(w, 'Jedes Wort. Mutter hat es uns beigebracht, abends am Küchentisch. Kyra hat sich mit Händen und Füßen gewehrt. Ich nicht.');
    await mentor(w, 'Sechzehn Jahre bin ich an Höfen vorbeigekommen, auf denen keiner seinen eigenen Namen lesen konnte.', 'thinking');
  }
  await lia(w, 'Mutter war von hier. Aus Trapas. Sie ist für Vater aufs Land gezogen und hat ihre Bücher mitgenommen.', 'sad');
  await mentor(w, 'Dann bist du hier halb zu Hause. Und ich lerne dich offenbar gerade erst kennen.', 'happy');
  G.state.addLore('e3-lore-lichterorden');
  G.state.set(SEEN.notice);
  updateWaitObjective(w);
}

async function talkSmith(w: WorldCtx): Promise<void> {
  if (!G.state.is(WAITING)) { await w.think('Der Schmied hat zu tun. Und ich habe einen Paladin im Nacken.'); return; }
  if (G.state.is(SEEN.smith)) { await smith(w, 'Kopf runter, Mädchen. Mehr kann ich dir nicht raten.'); return; }
  const lead = w.actor(LEADER);
  await smith(w, 'Gefesselt und trotzdem neugierig. Gehörst du zu dem Alten da drüben?');
  await lia(w, 'Sieht man das nicht?');
  await smith(w, 'Nein. Aber hier sieht keiner mehr genau hin. Seit draußen die Höfe brennen, ist jeder Fremde ein Späher.');
  lead.face('left');
  await leader(w, 'Zweihundert Speerspitzen bis Neumond, Meister. Der Großmeister zahlt in Silber, wie immer.');
  await smith(w, 'Zweihundert. Und danach? Spitzt Ihr die Bauern gleich mit an?');
  await leader(w, 'Der Großmeister weiß, was er tut.');
  lead.face('up');
  await smith(w, 'Das sagen sie alle. Kopf runter, Mädchen. Hier oben drehen sie sich gerade alle ein bisschen zu schnell.');
  await w.think('Zweihundert Speere. Für einen Orden, der angeblich nur beschützt.');
  G.state.set(SEEN.smith);
  updateWaitObjective(w);
}

async function lookFountain(w: WorldCtx): Promise<void> {
  if (G.state.is(SEEN.fountain)) { await w.think('Drei Schalen, und das Wasser läuft von oben nach unten. Wie in Mutters Geschichte.'); return; }
  await w.think('Der Brunnen mit den drei Schalen. Mutter hat von ihm erzählt wie von einer alten Freundin.');
  await w.think('Wer am ersten Herbsttag eine Münze hineinwirft, kommt nach Trapas zurück. Ob sie je eine geworfen hat, hat sie nie gesagt.');
  await w.think('Zurückgekommen ist sie jedenfalls nicht. Jetzt stehe ich an ihrer Stelle hier. Gefesselt und ohne Münze.');
  await w.think('Sie hätte eine Augenbraue hochgezogen. Und dann die Knoten aufgemacht, als wäre es nichts.');
  G.state.set(SEEN.fountain);
  updateWaitObjective(w);
}

async function talkMentor(w: WorldCtx): Promise<void> {
  if (G.state.is(MENTOR_TALKED)) { await mentor(w, 'Sieh dich ruhig um. Aber der Junge hinter dir zählt jeden Schritt, den du machst.'); return; }
  G.state.set(MENTOR_TALKED);
  await mentor(w, 'Vorhin auf der Straße. „Mein Vater.“', 'thinking');
  await lia(w, 'Sie wollten Euch allein mitnehmen. Mir ist nichts Besseres eingefallen.');
  await mentor(w, 'Es war das Beste, was dir einfallen konnte. Es ist mir trotzdem in die Knochen gefahren.', 'sad');
  await lia(w, 'Es war doch nur gelogen.');
  await mentor(w, '… Ja. Natürlich.', 'sad');
}

async function onToOrderHouse(w: WorldCtx): Promise<void> {
  const lead = w.actor(LEADER);
  G.state.set(WAITING, false);
  w.completeObjective('e3-pal-umsehen');
  await w.cutscene(async () => {
    await lead.walkTo(TRAPAS_SPOT.leaderSmith[0] + 40, TRAPAS_SPOT.leaderSmith[1] - 10, { face: 'right' });
    await leader(w, 'Genug geplaudert. Zum Ordenshaus. Der Großmeister wartet nicht gern, und ich lasse ihn nicht gern warten.');
    w.companions.add(MENTOR, 'e3-ignatius-gefesselt', 'e2-ignatius');
    w.companions.add(GUARD, 'paladin', 'e3-paladin');
  });
  w.setObjective('e3-pal-ordenshaus', 'Folge dem Paladin zum Ordenshaus.', LEADER);
  await escortWalk(w, [[470, 330], [560, 236], TRAPAS_SPOT.stairs]);
  w.completeObjective('e3-pal-ordenshaus');
  await w.cutscene(async () => {
    await w.camera.pan([640, 170], 800);
    await lead.walkTo(TRAPAS_SPOT.portal[0], TRAPAS_SPOT.portal[1], { face: 'up' });
    await w.player.walkTo(TRAPAS_SPOT.portal[0], TRAPAS_SPOT.portal[1] + 36, { face: 'up' });
    await w.think('Ein Portal so hoch wie drei Männer. Ich frage mich, für wen sie es so groß gebaut haben.');
  });
}

async function trapasScript(w: WorldCtx): Promise<void> {
  for (const f of [...Object.values(SEEN), WAITING, MENTOR_TALKED]) G.state.set(f, false);
  w.lockPlayer();
  await enterCity(w);
  w.unlockPlayer();
  await walkToSmith(w);
  await stopAtSmith(w);
  G.state.set(WAITING);
  updateWaitObjective(w);
  bg(smithBanter(w));
  bg(leash(w));
  await until(w, () => seenCount() === 3 && !G.ui.busy());
  await onToOrderHouse(w);
  w.lockPlayer();
  await ui().fade('out', 1100);
  G.state.set('e3-gefangen-genommen');
  G.state.addLore('e3-lore-lichterorden');
  await nextScene('e3-schutzreaktion');
}

export const scene = e3Scene('e3-paladine', 'Händler und Tochter', async params => {
  await ui().fade('out', 0);
  if (params?.part === 'trapas' && G.state.is(BOUND)) {
    await startWorld({
      map: trapasEskorte, spawn: 'tor', player: liaLook({ bound: true }), fadeIn: false, script: trapasScript,
      companions: [
        { id: YOUNG, preset: 'paladin', speaker: 'e3-paladin-jung' },
        { id: MENTOR, preset: 'e3-ignatius-gefesselt', speaker: 'e2-ignatius' },
        { id: GUARD, preset: 'paladin', speaker: 'e3-paladin' },
      ],
    });
    return;
  }
  await G.ui.narrate(['Am Nachmittag lag der Wald hinter ihnen. Vor ihnen Stoppelfelder, Hecken und eine Straße, die es eilig hatte, nach Trapas zu kommen.'], { style: 'card' });
  await startWorld({
    map: landstrasse, spawn: 'start', player: liaLook(), fadeIn: false, script: strasseScript,
    companions: [{ id: MENTOR, preset: 'e2-ignatius', speaker: 'e2-ignatius' }],
  });
});

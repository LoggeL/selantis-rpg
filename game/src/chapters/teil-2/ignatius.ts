// Scene „e2-ignatius“ – Ignatius von Ignis (docs/teil-2/umsetzung.md §3, F2 25:49–29:58). Night → morning → night
// at the hermit's clearing, in three checkpointed parts (G.goto with { part }, so a reload restarts the current part):
//  1. 'nacht' (default): a framed nightmare (violet, labelled „Ein Traum“, voices of Kyra and Flick; ignatius-traum.ts),
//     Lia opens her eyes (story gesture) and joins the stranger at the fire. He gives his name – from here
//     e2-ignatius-vorgestellt, mentor()/master() say Ignatius/Vamir – and answers a question tree: the council of the
//     Ten Consecrated and Ignis, Dunkelhain (Gwynn only as his report and belief), his retreat and how the test made
//     him feel the Urmacht again after sixteen years, the Master's self-given name, and the dream (he does not know).
//  2. 'morgen': plate e2-schattentoeter, story gesture „Den Stab nehmen“, the borrowed staff once (grantOnce); Lia's
//     look switches to e2-lia-stab.
//  3. 'nachtweg' (heart): Lia cannot sleep, Ignatius is gone. Spurenblick: his footprints, a dropped log, broken twigs
//     towards the brook (her own old tracks as a false lead). She finds him gathering wood across the stepping stones,
//     carries half of it back and feeds the fire. → e2-zellengespraeche.
import { G } from '../../core/G';
import { registerItems } from '../../core/catalog';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { halt } from '../kapitel-4/shared';
import { restageGesture, type GesturePicture } from './gewoelbe-geste';
import { IG_EDGE, IG_SPOT, igFireLight, igLanternLight, ignatiusBase } from './ignatius-lager';
import { playDream } from './ignatius-traum';
import { bg, e2Scene, grantOnce, lia, liaLook, mentor, sfx, ui, until, nextScene } from './shared';

registerItems([
  {
    id: 'e2-feuerholz', name: 'Ein Arm voll Buchenholz', icon: 'twig',
    description: 'Die Hälfte von dem, was Ignatius nachts am Bach gesammelt hat. Trocken, schwer, voller Spinnweben.',
    comment: 'Wer mitliest, trägt mit, sagt er. Ich glaube, das hat er sich gerade ausgedacht.',
  },
]);

const MENTOR = 'ignatius';
/** Lia's place south of the fire, facing the east log. */
const SEAT: [number, number] = [620, 418];
const MORNING_AT: [number, number] = [702, 292];
/** Where Ignatius gathers wood at night: on the east path behind the stepping stones. */
const WOOD_AT: [number, number] = [1206, 452];
const TRAIL = ['ig-spur', 'ig-scheit', 'ig-zweige'] as const;

const STAFF_PICTURE: GesturePicture = {
  background: 'e2-ignatius-lager', focus: [684, 262], zoom: 3, glint: [684, 250],
  figures: [
    { id: 'e2-ignatius', pose: 'talk', at: [702, 284], facing: 'left' },
    { id: 'lia-cloak', pose: 'idle', at: [664, 288], facing: 'right' },
  ],
};

// ---------------------------------------------------------------------------------------------------------------
// Maps (one per time of day, all on the painted clearing)
// ---------------------------------------------------------------------------------------------------------------

const closedPaths = (to: string, line: string) => [
  { id: 'weg-sued', poly: IG_EDGE.south, to, spawn: 'fire', when: () => false, blocked: line },
  { id: 'weg-ost', poly: IG_EDGE.east, to, spawn: 'fire', when: () => false, blocked: line },
];

export const ignatiusNacht: MapDef = defineMap({
  ...ignatiusBase,
  id: 'e2-ignatius-nacht',
  name: 'Die Lichtung bei Nacht',
  npcs: [{
    id: MENTOR, preset: 'e2-ignatius', speaker: 'e2-fremder', at: IG_SPOT.mentorSeat, dir: 'left', idle: 'sit',
    verb: 'Reden', talk: () => { G.state.set('e2-ig-ans-feuer'); },
  }],
  props: [{ id: 'buecher', prop: 'bookstack', at: [702, 252], collide: false }],
  exits: closedPaths('e2-ignatius-nacht', 'Mitten in der Nacht, allein, mit einem Traum als Karte? Nein.'),
  lights: [igFireLight(0.9, 0.9), igLanternLight(0.5), { id: 'mond', at: [300, 0], kind: 'moon', radius: 420, intensity: 0.25 }],
  time: 'night',
  weather: 'fireflies',
  ambience: ['night', 'crickets', 'fire', 'stream'],
  ambienceVolume: { fire: 0.55, stream: 0.4, crickets: 0.5 },
  music: 'refuge',
  playerLight: 34,
  resetOnEnter: true,
});

export const ignatiusMorgen: MapDef = defineMap({
  ...ignatiusBase,
  id: 'e2-ignatius-morgen',
  name: 'Die Lichtung am Morgen',
  npcs: [{
    id: MENTOR, preset: 'e2-ignatius', speaker: 'e2-ignatius', at: MORNING_AT, dir: 'left',
    verb: 'Reden', talk: () => { G.state.set('e2-ig-morgen-bereit'); },
    barks: ['Komm, komm. Der Tag wartet nicht.'], barkEvery: 12000,
  }],
  props: [{ id: 'buecher', prop: 'bookstack', at: [702, 252], collide: false }],
  exits: closedPaths('e2-ignatius-morgen', 'Er wartet doch. Und ich will wissen, worauf.'),
  lights: [igFireLight(0.35, 0.35)],
  time: 'dawn',
  ambience: ['birds', 'stream', 'wind'],
  ambienceVolume: { birds: 0.6, stream: 0.4, wind: 0.3 },
  music: 'refuge',
  resetOnEnter: true,
});

export const ignatiusNachtweg: MapDef = defineMap({
  ...ignatiusBase,
  id: 'e2-ignatius-nachtweg',
  name: 'Die Lichtung bei Nacht',
  lookMode: true,
  npcs: [{
    id: MENTOR, preset: 'e2-ignatius', speaker: 'e2-ignatius', at: WOOD_AT, dir: 'right', idle: 'kneel', hidden: true,
    verb: 'Reden', talk: () => { G.state.set('e2-ig-gefunden'); },
  }],
  props: [{ id: 'buecher', prop: 'bookstack', at: [702, 252], collide: false }],
  interactables: [
    { id: 'laterne', verb: 'Laterne nehmen', at: IG_SPOT.shelter, radius: 26, when: () => !G.state.is('e2-ig-laterne'), onInteract: takeLantern },
    { id: 'sitz', verb: 'Ansehen', at: [722, 404], radius: 22, once: false, onInteract: emptySeat },
    {
      id: 'feuer', verb: 'Holz nachlegen', at: IG_SPOT.fireSouth, radius: 30, once: false, sparkle: true,
      when: () => G.state.has('e2-feuerholz'), onInteract: feedFire,
    },
  ],
  clues: [
    { id: 'ig-spur', at: [748, 412], kind: 'footprint', angle: -20, onInteract: w => readTrail(w, 'ig-spur') },
    { id: 'ig-falsch', at: [770, 548], kind: 'footprint', angle: 100, onInteract: falseLead },
    { id: 'ig-scheit', at: [944, 318], kind: 'branch', angle: 15, onInteract: w => readTrail(w, 'ig-scheit') },
    { id: 'ig-zweige', at: [996, 404], kind: 'branch', angle: -10, onInteract: w => readTrail(w, 'ig-zweige') },
  ],
  triggers: [
    { id: 'ufer', poly: [[1010, 396], [1040, 398], [1040, 448], [1010, 444]], once: false, when: () => !trailRead(), onEnter: notYet },
  ],
  exits: closedPaths('e2-ignatius-nachtweg', 'Nicht da lang. Er ist nicht nach Süden gegangen.'),
  lights: [igFireLight(0.3, 0.25), igLanternLight(0.6), { id: 'mond', at: [300, 0], kind: 'moon', radius: 420, intensity: 0.22 }],
  time: 'night',
  ambience: ['night', 'crickets', 'stream', 'wind'],
  ambienceVolume: { stream: 0.55, crickets: 0.55, wind: 0.35 },
  music: null,
  playerLight: 30,
  resetOnEnter: true,
});

const say = (w: WorldCtx, text: string, mood?: string) => w.say(mentor(), text, mood ? { mood } : undefined);

// ---------------------------------------------------------------------------------------------------------------
// Part 1: the nightmare and the name
// ---------------------------------------------------------------------------------------------------------------

async function nightmare(w: WorldCtx): Promise<void> {
  const m = w.actor(MENTOR);
  m.hold(true);
  m.setIdle('sit');
  w.player.setIdle('lie');
  w.lockPlayer();
  await w.camera.pan(IG_SPOT.bed, 0);
  await w.camera.zoom(1.35, 0);
  await G.ui.narrate(['In dieser Nacht träumte Lia.'], { style: 'card' });
  await playDream([
    { who: 'Kyra, im Traum', speaker: 'e2-kyra', text: 'Lia? Lia, wo bist du? Hier ist alles lila.' },
    { who: 'Flick, im Traum', speaker: 'e2-flick', text: 'Bleib weg, Leseratte. Hörst du? Lauf weiter.' },
    { who: 'Kyra, im Traum', speaker: 'e2-kyra', text: 'Es tut nicht weh. Ehrlich. Nur ein bisschen.' },
    { who: 'Kyra und Flick, im Traum', speaker: ['e2-kyra', 'e2-flick'], text: 'Lia …!' },
  ]);
  const gesture = G.ui.storyAction('open-eyes', 'Aufwachen');
  restageGesture('open-eyes', 'Schieb die Lider auf. Raus aus dem Violett. Es ist nur ein Traum. Oder?');
  await gesture;
  sfx('heartbeat', { volume: 0.5 });
  await ui().fade('in', 900);
  await w.cutscene(async () => {
    w.player.setIdle('kneel');
    await w.think('Das Dach aus Ästen. Die Felle. Der Bach. Kein Violett, nirgends.');
    await w.think('Nur ein Traum. Kyras Stimme klang trotzdem so, als stünde sie neben mir.');
    await w.camera.zoom(1, 900);
    await w.camera.pan(MENTOR, 800);
    await say(w, 'Du hast im Schlaf gesprochen. Komm ans Feuer, wenn du magst. Es ist wärmer als jeder Albtraum.');
    await w.camera.pan(IG_SPOT.bed, 600);
    w.player.setIdle('idle');
  });
  w.camera.follow();
  w.unlockPlayer();
  m.hold(false);
}

async function theName(w: WorldCtx): Promise<void> {
  const m = w.actor(MENTOR);
  m.hold(true);
  await w.player.walkTo(SEAT[0], SEAT[1], { face: 'up' });
  w.player.setIdle('sit');
  m.face('player');
  await w.camera.pan([660, 392], 700);
  await w.camera.zoom(1.25, 700);
  await lia(w, 'Ich hab sie gesehen. Kyra und Flick. Alles war violett, und sie haben nach mir gerufen.', 'scared');
  await say(w, 'Erzähl es mir, solange es noch frisch ist. Träume trocknen schnell, wie Tinte.');
  await lia(w, 'Kyra hat gesagt, es tut nicht weh. So sagt sie das immer, wenn es wehtut.', 'sad');
  const pick = await w.choose([
    '„Wer seid Ihr? Und diesmal will ich kein ‚später‘ hören.“',
    '„Ich gehe zurück. Heute Nacht noch.“',
    '(Schweigen und ins Feuer starren.)',
  ]);
  G.state.set('e2-ig-auftakt', ['frage', 'trotz', 'schweigen'][pick]);
  if (pick === 0) {
    await say(w, 'Fair. Du hast mir deinen Namen im Fieber geschenkt. Ich schulde dir meinen.', 'happy');
  } else if (pick === 1) {
    await say(w, 'Im Dunkeln, mit einem Traum als Karte? Setz dich zu mir. Erst sage ich dir, wer ich bin. Dann entscheidest du.', 'worried');
  } else {
    await say(w, 'Gut. Dann rede ich. Ich schulde dir ohnehin einen Namen.', 'sad');
  }
  m.setIdle('idle');
  m.face('player');
  await w.wait(300);
  G.state.set('e2-ignatius-vorgestellt');
  await say(w, 'Ignatius. Aus Ignis. Einst saß ich im Rat der Zehn Geweihten.');
  m.setIdle('sit');
  await lia(w, 'Ignatius? Der, von dem der Druide gesprochen hat? Ihr sitzt die ganze Zeit hier, kocht Tee und erzählt von den Zehn, als wären es Fremde!', 'surprised');
  await say(w, 'Alte Gewohnheit. Wer sich versteckt, erzählt von sich am liebsten wie von einem Nachbarn.', 'happy');
}

type Topic = 'rat' | 'dunkelhain' | 'spueren' | 'meister' | 'traum' | 'ignis' | 'ende';
const REQUIRED: Topic[] = ['rat', 'dunkelhain', 'spueren', 'meister', 'traum'];

async function questions(w: WorldCtx): Promise<void> {
  const asked = new Set<Topic>();
  for (let guard = 0; guard < 12; guard++) {
    const opts: { id: Topic; text: string }[] = ([
      { id: 'rat', text: '„Was hat dieser Rat eigentlich getan?“' },
      { id: 'dunkelhain', text: '„Was ist in Dunkelhain geschehen?“' },
      { id: 'spueren', text: '„Wo wart Ihr all die Jahre? Und wie habt Ihr mich gefunden?“' },
      { id: 'meister', text: '„Und dieser Meister? Kyra hat Baris’ Leute von ihm reden hören.“' },
      { id: 'traum', text: '„Mein Traum. War das echt?“' },
      { id: 'ignis', text: '„Ignis? Azar kommt aus Ignis!“' },
    ] as { id: Topic; text: string }[]).filter(o => !asked.has(o.id));
    if (REQUIRED.every(t => asked.has(t))) opts.push({ id: 'ende', text: '„Danke. Ich glaube, jetzt kann ich schlafen.“' });
    const pick = opts[await w.choose(opts.map(o => o.text))];
    if (pick.id === 'ende') break;
    asked.add(pick.id);
    await answer(w, pick.id);
    if (asked.has('rat') && asked.has('dunkelhain') && asked.has('spueren')) G.state.addLore('e2-lore-rat');
  }
  G.state.set('e2-ig-fragen', [...asked].join(','));
}

async function answer(w: WorldCtx, id: Topic): Promise<void> {
  switch (id) {
    case 'rat':
      await say(w, 'Gesetze für ganz Selantis. Wir haben gestritten, was gerecht ist, oft bis in die Nacht. Manchmal sogar mit Ergebnis.', 'happy');
      await say(w, 'Ich saß dort für Ignis. Und wie alle anderen auch für die Höhle. Das Wachen war wichtiger als jedes Gesetz.');
      await lia(w, 'Und das Licht aus dieser Höhle ist jetzt in mir.', 'thinking');
      await say(w, 'Ja. Ein alter Wächter sitzt dir gegenüber und weiß nicht, ob er dich bewachen oder beschützen soll.', 'sad');
      return;
    case 'dunkelhain':
      await say(w, 'Vier aus dem Rat wollten die Urmacht für sich. Es kam zur Schlacht. Danach war der Rat nur noch ein Wort.', 'grim');
      await say(w, 'Von den Treuen haben, soweit ich weiß, nur Valentus und ich überlebt. Und Gwynn. Sie haben sie mitgenommen.', 'sad');
      await lia(w, 'Gwynn? Wo ist sie jetzt?');
      await say(w, 'Ich weiß es nicht. Ich glaube, dass sie lebt, irgendwo gefangen. Glauben, Lia. Nicht wissen. Das sind zwei Wörter.', 'worried');
      return;
    case 'spueren':
      await say(w, 'Nach Dunkelhain gab es keinen Rat mehr, dem ich hätte dienen können. Also bin ich in die Wälder gegangen.', 'sad');
      await say(w, 'Sechzehn Jahre lang war die Urmacht stumm. Ich hielt sie für verloren. Zusammen mit Valentus.');
      await say(w, 'Vor ein paar Tagen ein Flackern, zu kurz, um ihm zu folgen. Dann deine Prüfung: wie eine Glocke über die Hügel.', 'thinking');
      await lia(w, 'Und dann seid Ihr losgelaufen.');
      await say(w, 'So schnell ein alter Mann eben läuft. Fürs Lager kam ich zu spät. Für dich am Bach gerade noch rechtzeitig.');
      return;
    case 'meister':
      await say(w, 'Er war einer der vier. Seine Mitverschwörer sind einer nach dem anderen verschwunden. Übrig blieb nur er.', 'grim');
      await say(w, 'Heute nennt er sich Vamir. In der alten Sprache heißt das „der Allmächtige“.');
      await lia(w, 'Und? Ist er das?', 'scared');
      await say(w, 'Ein großer Name für einen, der im Schatten wohnt. Die Urmacht hat er nicht. Er braucht die, die sie trägt.', 'determined');
      await lia(w, 'Mich.', 'scared');
      await say(w, 'Dich. Deshalb sitzt du an meinem Feuer und nicht an seinem.');
      G.state.addLore('e2-lore-vamir');
      return;
    case 'traum':
      await say(w, 'Ich weiß es nicht. Und ich werde dir nichts anderes erzählen, nur damit du ruhiger schläfst.', 'thinking');
      await say(w, 'Ein Traum kann Erinnerung sein, Angst oder Wunsch. Und manche setzen sich gern in fremde Träume. Vamir gehört dazu.', 'worried');
      await lia(w, 'Dann war er in meinem Kopf?', 'scared');
      await say(w, 'Vielleicht. Vielleicht warst es nur du, mit zu viel Angst und zu wenig Schlaf. Behalt es als Frage, nicht als Antwort.');
      return;
    case 'ignis':
      await say(w, 'Ein Schmied aus Ignis bei den Rebellen? Dann gibt es dort wenigstens anständige Klingen.', 'happy');
      await lia(w, 'Er kocht besser, als er schmiedet. Sagt er. Und er erzählt Sprichwörter, bis man einschläft.', 'happy');
      await say(w, 'Dann ist er wirklich aus Ignis. Grüß ihn von mir, wenn ihr euch wiederseht.', 'happy');
      return;
    case 'ende':
      return;
  }
}

async function nachtScript(w: WorldCtx): Promise<void> {
  G.state.set('e2-ig-ans-feuer', false);
  await nightmare(w);
  w.setObjective('e2-ig-feuer', 'Geh zum Fremden ans Feuer.', MENTOR);
  await until(w, () => G.state.is('e2-ig-ans-feuer'));
  w.completeObjective('e2-ig-feuer');
  await w.cutscene(async () => {
    await theName(w);
    await questions(w);
    G.state.addLore('e2-lore-rat');
    G.state.addLore('e2-lore-vamir');
    await say(w, 'Dann schlaf. Morgen gebe ich dir etwas, das deinem Licht eine Richtung gibt.');
    await lia(w, 'Was denn?');
    await say(w, 'Morgen.', 'happy');
    await lia(w, 'Ihr und Euer „morgen“.', 'angry');
  });
  halt(w, [MENTOR]);
  w.lockPlayer();
  await ui().fade('out', 1400);
  await nextScene('e2-ignatius', { part: 'morgen' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: Schattentöter
// ---------------------------------------------------------------------------------------------------------------

async function morgenScript(w: WorldCtx): Promise<void> {
  G.state.set('e2-ig-morgen-bereit', false);
  w.player.setIdle('lie');
  w.lockPlayer();
  await G.ui.narrate(['Am Morgen roch die Lichtung nach Tau und kaltem Rauch. Und Ignatius summte wieder, falsch und sehr zufrieden.'], { style: 'card' });
  await ui().fade('in', 1000);
  w.player.setIdle('idle');
  w.unlockPlayer();
  w.setObjective('e2-ig-morgen', 'Ignatius wartet vor dem Unterstand.', MENTOR);
  await until(w, () => G.state.is('e2-ig-morgen-bereit'));
  w.completeObjective('e2-ig-morgen');
  const m = w.actor(MENTOR);
  ui().prefetchPlate('e2-schattentoeter');
  await w.cutscene(async () => {
    m.hold(true);
    m.face('player');
    await say(w, 'Gut geschlafen?');
    await lia(w, 'Nein. Aber ohne Träume.', 'thinking');
    await say(w, 'Das ist schon mal die bessere Hälfte. Warte hier.', 'happy');
    await w.say('narrator', 'Er verschwindet hinter der alten Buche und kommt mit einem langen, hellen Stock zurück.');
    await G.ui.plate('e2-schattentoeter', { caption: 'Schattentöter', pan: 'in', durationMs: 26000 });
    await say(w, 'Das ist Schattentöter. Sein Name ist älter als ich und deutlich dramatischer.', 'happy');
    await lia(w, 'Hat er schon mal einen Schatten getötet?');
    await say(w, 'Ein paar Spinnweben. Und einmal eine Kerze, aus Versehen.', 'happy');
    await say(w, 'Er macht dich nicht stärker. Er gibt deinem Licht eine Richtung. Wie ein Finger, der auf etwas zeigt.');
    await say(w, 'Geliehen, nicht geschenkt. Ich hätte ihn gern irgendwann zurück. Mit dir dran.', 'thinking');
    const gesture = G.ui.storyAction('reach', 'Den Stab nehmen');
    restageGesture('reach', 'Greif nach dem Stab. Er beißt nicht. Er summt nur ein bisschen.', STAFF_PICTURE);
    await gesture;
    sfx('urmacht', { volume: 0.35, pitch: 1.3 });
    await lia(w, 'Er ist warm. Als hätte gerade noch jemand die Hand drumgehabt.', 'surprised');
    await say(w, 'Hatte ich ja auch.', 'happy');
    await G.ui.closePlate();
    // Granted once the plate is closed, so the item toast does not sit on the plate frame.
    grantOnce('e2-staff-received', () => G.state.give('e2-schattentoeter'));
    w.player.setLook(liaLook());
    w.fx.burst([w.player.x + 8, w.player.y - 40], 'urmacht', 4);
    await lia(w, 'Und jetzt? Zaubern?', 'happy');
    await say(w, 'Jetzt trägst du ihn. Überallhin. Damit deine Hand weiß, wo er ist, bevor dein Kopf fragt.');
    m.hold(false);
  });
  w.lockPlayer();
  await ui().fade('out', 1000);
  await G.ui.narrate(['Den ganzen Tag trug Lia den Stab mit sich herum. Zum Eimer, zum Holzstapel, sogar zum Essen. Ignatius sagte nichts dazu. Er lächelte nur.'], { style: 'card' });
  await nextScene('e2-ignatius', { part: 'nachtweg' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 3: the night walk
// ---------------------------------------------------------------------------------------------------------------

const trailRead = () => TRAIL.every(id => G.state.is(`e2-ig-${id}`));

function nextTrailTarget(): string {
  return TRAIL.find(id => !G.state.is(`e2-ig-${id}`)) ?? MENTOR;
}

async function readTrail(w: WorldCtx, id: typeof TRAIL[number]): Promise<void> {
  const first = !G.state.is(`e2-ig-${id}`);
  G.state.set(`e2-ig-${id}`);
  if (id === 'ig-spur') {
    await w.think('Große Füße, weiche Sohlen, ein bisschen schlurfend. Seine. Sie führen vom Feuer weg, zum Holzstapel.');
  } else if (id === 'ig-scheit') {
    await w.think('Ein Holzscheit, mitten im Weg. Wer eins verliert, hat schon ziemlich viele auf dem Arm.');
  } else {
    await w.think('Geknickte Zweige am Ufer, innen noch hell. Frisch. Er ist über die Steine.');
  }
  if (!first) return;
  if (trailRead()) await trailComplete(w);
  else w.setObjectiveTarget(nextTrailTarget());
}

async function falseLead(w: WorldCtx): Promise<void> {
  G.state.set('e2-ig-falsch');
  await w.think('Kleine Abdrücke, die nach Süden stolpern. Meine. Von dem Abend, als meine Knie nicht wollten.');
  await w.think('Die nützen mir nichts. Er ist nicht weggelaufen. Er ist kein Mädchen vom Hof.');
}

async function emptySeat(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-ig-ig-spur')) { await w.think('Die Decke ist kalt. Er ist schon eine Weile fort.'); return; }
  await w.think(`Seine Decke liegt noch da, zusammengefaltet. Er ist nicht entführt worden. Er ist gegangen. Wohin? (${w.controlHint('look')} halten)`);
}

async function takeLantern(w: WorldCtx): Promise<void> {
  G.state.set('e2-ig-laterne');
  bg(w.lighting.get('laterne').fadeTo(0, 300));
  const light = w.lighting.add({ id: 'e2-handlaterne', at: [w.player.x, w.player.y - 14], kind: 'lantern', radius: 70, intensity: 0.9, always: true });
  const follow = () => { if (w.alive) light.set({ at: [w.player.x + 6, w.player.y - 16] }); };
  w.scene.events.on('update', follow);
  w.scene.events.once('shutdown', () => w.scene.events.off('update', follow));
  sfx('pickup', { volume: 0.5 });
  await w.think('Seine Laterne. Im Licht sieht der Wald kleiner aus. Nur ein bisschen.');
}

async function notYet(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    await w.think('Dunkel. Wasser. Und kein Zeichen von ihm. Ich muss genauer hinsehen.');
    await w.player.walkTo(986, 392);
  });
  w.setObjectiveTarget(nextTrailTarget());
}

async function trailComplete(w: WorldCtx): Promise<void> {
  const m = w.actor(MENTOR);
  m.show();
  m.hold(true);
  m.setIdle('kneel');
  sfx('thud', { volume: 0.4, distance: 0.6 });
  await w.wait(300);
  sfx('branch-snap', { volume: 0.5, distance: 0.5, pan: 0.6 });
  await w.think('Da drüben, hinter den Steinen. Holz klappert. Und jemand flucht leise in einer Sprache, die ich nicht kenne.');
  w.setObjective('e2-ig-suche', 'Folge den Zweigen über die Trittsteine zu Ignatius.', MENTOR);
}

async function foundHim(w: WorldCtx): Promise<void> {
  const m = w.actor(MENTOR);
  await w.cutscene(async () => {
    m.hold(true);
    await say(w, 'Wer nachts Spuren liest, sollte vorher Bescheid sagen. Ich hätte dich fast für einen Dachs gehalten.', 'happy');
    m.setIdle('idle');
    m.face('player');
    await lia(w, 'Ich hab Euch gesucht. Euer Platz war leer, und ich dachte …', 'worried');
    await say(w, 'Dass mich ein Schatten geholt hat? Nur der Holzstapel. Der wird jede Nacht kleiner, ganz ohne Zauberei.', 'happy');
    await lia(w, 'Ihr könntet doch einfach … zaubern. Feuer aus der Hand oder so.');
    await say(w, 'Könnte ich. Aber Zauberei wärmt keine Füße. Dafür nimmt man Buchenholz.', 'happy');
    await lia(w, 'Ihr habt am Stapel einen Scheit verloren.');
    await say(w, 'Den habe ich dir hingelegt. Wie hättest du die Fährte sonst lesen sollen?', 'happy');
    const pick = await w.choose(['„Das glaub ich Euch kein Wort.“', '„Dann hab ich die Prüfung bestanden?“', '„Nächstes Mal sagt Ihr Bescheid.“']);
    G.state.set('e2-ig-nachtweg-ton', ['zweifel', 'pruefung', 'bescheid'][pick]);
    if (pick === 0) await say(w, 'Musst du auch nicht. Aber du hast ihn gefunden. Das zählt.', 'happy');
    else if (pick === 1) await say(w, 'Es war keine Prüfung. Aber wenn es eine gewesen wäre: ja.', 'thinking');
    else await say(w, 'Abgemacht. Wenn du mir auch Bescheid sagst, wenn du gehst.', 'thinking');
    await say(w, 'Hier. Nimm die Hälfte. Wer mitliest, trägt mit.');
    G.state.give('e2-feuerholz');
    m.setIdle('idle');
  });
  w.despawn(MENTOR);
  w.companions.add(MENTOR, 'e2-ignatius', 'e2-ignatius');
  w.setObjective('e2-ig-holz', 'Trag das Holz zurück und leg es ins Feuer.', 'feuer');
}

async function feedFire(w: WorldCtx): Promise<void> {
  if (!G.state.take('e2-feuerholz')) return;
  await w.cutscene(async () => {
    await w.player.play('kneel', { ms: 700 });
    sfx('fire-ignite', { volume: 0.8 });
    w.fx.burst(IG_SPOT.fire, 'smoke', 8);
    bg(w.lighting.get('feuer').fadeTo(1.1, 1200));
    await w.wait(900);
    w.completeObjective('e2-ig-holz');
    w.companions.remove(MENTOR);
    const m = w.spawn({ id: MENTOR, preset: 'e2-ignatius', speaker: 'e2-ignatius', at: [w.player.x + 40, w.player.y - 10], dir: 'left' });
    m.hold(true);
    await Promise.all([
      m.walkTo(IG_SPOT.mentorSeat[0], IG_SPOT.mentorSeat[1], { face: 'left' }),
      w.player.walkTo(SEAT[0], SEAT[1], { face: 'up' }),
    ]);
    m.setIdle('sit');
    w.player.setIdle('sit');
    await w.camera.pan([660, 392], 700);
    await say(w, 'Weißt du, was du heute Nacht getan hast? Du hattest Angst und hast trotzdem hingesehen.');
    await lia(w, 'Ich hab nur auf den Boden geguckt.');
    await say(w, 'Genau das. Die meisten starren ins Dunkel. Da steht nie etwas Nützliches.', 'happy');
    await lia(w, 'Zeigt Ihr mir morgen, was der Stab kann?', 'happy');
    await say(w, 'Morgen zeigt der Stab dir, was du kannst. Schlaf jetzt. Diesmal hoffentlich ohne Violett.');
  });
  G.state.set('e2-ig-holz-gelegt');
}

async function nachtwegScript(w: WorldCtx): Promise<void> {
  w.player.setIdle('kneel');
  await G.ui.narrate(['In der Nacht fand Lia keinen Schlaf. Und als sie sich aufsetzte, war der Platz am Feuer leer.'], { style: 'card' });
  await ui().fade('in', 900);
  w.player.setIdle('idle');
  if (!trailRead()) {
    await w.think('Ignatius? … Weg. Das Feuer ist fast heruntergebrannt.');
    w.setObjective('e2-ig-suche', `Ignatius ist fort. Lies seine Spuren im Spurenblick (${w.controlHint('look')} halten).`, nextTrailTarget());
  } else await trailComplete(w);
  const near = () => {
    const m = w.actor(MENTOR);
    return m.exists && trailRead() && Math.hypot(m.x - w.player.x, m.y - w.player.y) < 46;
  };
  await until(w, () => G.state.is('e2-ig-gefunden') || near());
  w.completeObjective('e2-ig-suche');
  await foundHim(w);
  await until(w, () => !G.state.has('e2-feuerholz') && G.state.is('e2-ig-holz-gelegt'));
}

// ---------------------------------------------------------------------------------------------------------------

export const scene = e2Scene('e2-ignatius', 'Ignatius von Ignis', async params => {
  const part = params?.part;
  await ui().fade('out', 0);
  if (part === 'morgen') {
    await startWorld({ map: ignatiusMorgen, spawn: 'bed', player: liaLook(), companions: [], fadeIn: false, script: morgenScript });
    return;
  }
  if (part === 'nachtweg') {
    await startWorld({
      map: ignatiusNachtweg, spawn: 'bed', player: liaLook(), companions: [], fadeIn: false,
      script: async w => {
        for (const id of TRAIL) G.state.set(`e2-ig-${id}`, false);
        G.state.set('e2-ig-gefunden', false);
        G.state.set('e2-ig-holz-gelegt', false);
        G.state.set('e2-ig-laterne', false);
        G.state.take('e2-feuerholz', G.state.count('e2-feuerholz'));
        await nachtwegScript(w);
        halt(w, [MENTOR]);
        w.lockPlayer();
        await ui().fade('out', 1400);
        await nextScene('e2-zellengespraeche');
      },
    });
    return;
  }
  await startWorld({ map: ignatiusNacht, spawn: 'bed', player: liaLook(), companions: [], fadeIn: false, script: nachtScript });
});

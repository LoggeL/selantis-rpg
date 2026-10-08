// Kapitel V, Szene 3 „schattenlager“: Baris' troop rests at a lone oak above open fields. Lia scouts three vantage
// points while Flick waits at the forest edge (stealth: patrols with view cones, bushes and tall grass). From the
// closest bush she watches Kyra provoke a guard and Baris stop him („Die ist mehr wert als ihr drei zusammen.“), then
// listens to his orders („Wortfetzen“, wortfetzen.ts). Back with Flick she puts the scraps together; then the plan.
// Then Lia walks into the camp and bluffs; the choices decide how long the distraction holds.
import { G } from '../../core/G';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { runBluff } from './bluffScene';
import { judgeSpot, LISTENED_FLAG, MOMENTS, QUESTIONS, SPOTS } from './wortfetzen';
import { ambience, CROUCH, lia, sfx } from './common';
import { FIRE_AT, LAGER_BLOCK, LAGER_HIDING, LAGER_OCCLUDERS, LAGER_SURFACES, LAGER_WALK } from './lagerGeom';
import { completeScouting, updateScoutObjective } from './scoutObjective';

const HORSES: [number, number][] = [[1036, 300], [1066, 306], [1096, 312], [1050, 336], [1080, 342], [1110, 348]];

export const schattenlagerMap: MapDef = defineMap({
  id: 'k5-schattenlager',
  name: 'Der Baum über den Feldern',
  background: 'k5-schattenlager',
  walk: LAGER_WALK,
  block: LAGER_BLOCK,
  occluders: LAGER_OCCLUDERS,
  surfaces: LAGER_SURFACES,
  hidingSpots: LAGER_HIDING,
  npcs: [
    { id: 'kyra', preset: 'kyra-bound', speaker: 'k5-kyra-bound', at: [852, 328], dir: 'down', idle: 'sit', solid: true },
    { id: 'algard', preset: 'algard', at: [806, 366], dir: 'right', idle: 'sit' },
    { id: 'baris', preset: 'baris', at: [880, 352], dir: 'left' },
    { id: 'orwen', preset: 'orwen', at: [960, 346], dir: 'left' },
    ...HORSES.map((at, i) => ({ id: `pferd-${i}`, preset: 'horse', at, dir: (i % 2 ? 'left' : 'right') as 'left' | 'right', idle: 'graze' as never, solid: true })),
  ],
  guards: [
    {
      id: 'maedchen', preset: 'maedchen', speaker: 'maedchen', range: 96, fov: 70,
      path: [{ at: [776, 330], wait: 3200, face: 'left' }, { at: [742, 352], wait: 2600, face: 'down' }],
      mode: 'pingpong', suspiciousBarks: ['He. Was war’n das?', 'Kriecht da wer im Gras?'], calmBarks: ['Bloß’n Hase.', 'Elende Grillen.'],
    },
    {
      id: 'schuetze', preset: 'shadow-crossbow', speaker: 'k5-schuetze', range: 110, fov: 64, mode: 'pingpong',
      path: [{ at: [770, 420], wait: 1800, face: 'down' }, { at: [720, 520], wait: 1200 }, { at: [690, 640], wait: 2200, face: 'left' }],
      suspiciousBarks: ['Hm?', 'Wer da?'], calmBarks: ['Nichts.', 'Ich seh schon Gespenster.'],
    },
  ],
  props: [{ prop: 'campfire', at: [FIRE_AT[0], FIRE_AT[1] + 4], id: 'feuer', collide: false }],
  interactables: [
    { id: 'felsen', verb: 'Darüber spähen', radius: 48, poly: [[300, 60], [400, 40], [450, 70], [446, 118], [320, 124]], standAt: [420, 146], face: 'up', onInteract: scoutRocks },
    { id: 'stamm', verb: 'Darüber spähen', poly: [[300, 318], [470, 350], [480, 372], [292, 348]], standAt: [380, 368], face: 'right', onInteract: scoutLog },
  ],
  triggers: [
    { id: 'lauschposten', poly: [[858, 488], [880, 474], [912, 476], [920, 496], [904, 510], [866, 508]], once: false, when: () => !G.state.is('k5-lauschen'), onEnter: listenPost },
    { id: 'zurueck', area: { x: 280, y: 420, w: 80, h: 90 }, once: false, when: () => G.state.is('k5-lauschen') && !G.state.is('k5-plan'), onEnter: plan },
    { id: 'feuer-bluff', area: { x: 740, y: 360, w: 120, h: 70 }, when: () => G.state.is('k5-plan'), onEnter: bluff },
  ],
  lights: [{ id: 'lagerfeuer', at: [FIRE_AT[0], FIRE_AT[1]], kind: 'fire', radius: 120, intensity: 1, flame: 1, always: true }],
  spawns: {
    start: { at: [372, 500], dir: 'right' },
    flick: { at: [340, 476], dir: 'right' },
  },
  stealth: { checkpoint: 'start' },
  time: 'dusk',
  ambience: ['wind', 'crickets', 'fire'],
  ambienceVolume: { fire: 0.35, crickets: 0.7, wind: 0.5 },
  music: 'dread',
  lookMode: true,
  playerLight: 40,
  depthScale: { y0: 100, s0: 0.92, y1: 720, s1: 1.05 },
});

// ---------------------------------------------------------------------------------------------------------------

function scoutObjective(w: WorldCtx): void {
  updateScoutObjective(w, G.state);
}

async function scoutRocks(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-sp-felsen')) { await w.think('Sechs Pferde, drei Wachen, der Hüne, der Grauhaarige. Mehr gibt der Felsen nicht her.'); return; }
  await w.cutscene(async () => {
    w.player.face('up');
    await w.player.play('interact', { ms: 600 });
    w.player.setIdle(CROUCH);
    await w.camera.pan([880, 330], 1400);
    await w.think('Sechs Pferde an einer Stange. Gesattelt. Die wollen schnell wegkönnen.');
    await w.camera.pan([800, 360], 700);
    await w.think('Einer döst am Feuer, einer lehnt mit dem Spieß am Baum. Der mit der Armbrust läuft den Weg ab. Der döst nicht.');
    await w.camera.pan([900, 350], 700);
    await w.think('Und der Hüne in der schwarzen Rüstung. Wo er hingeht, machen ihm die anderen Platz. Daneben der Grauhaarige. Der vom Hof.');
    G.state.addClue('k5-lager-wachen');
    w.camera.follow();
    await w.wait(500);
    w.player.setIdle('idle');
  });
  G.state.set('k5-sp-felsen');
  scoutObjective(w);
}

async function scoutLog(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-sp-stamm')) { await w.think('Kyra sitzt immer noch da. Halt durch. Ich komme.'); return; }
  await w.cutscene(async () => {
    w.player.setIdle(CROUCH);
    await w.camera.pan([852, 330], 1200);
    await w.camera.zoom(1.4, 700);
    await w.think('Da, an der Eiche. Kyra. Die Hände hinter den Stamm gebunden … aber sie bewegt sich. Sie lebt.');
    w.bark('kyra', 'Mistkerle.', 1600);
    await w.think('Das Gras reicht fast bis ans Feuer. Wenn ich unten durchs Feld krieche, komme ich ganz nah ran.');
    G.state.addClue('k5-lager-kyra');
    G.state.addClue('k5-lager-weg');
    await w.camera.zoom(1, 600);
    w.camera.follow();
    w.player.setIdle('idle');
  });
  G.state.set('k5-sp-stamm');
  scoutObjective(w);
}

/** Closest vantage point (bush south of the fire): wait until Lia crouches hidden inside, then the tree scene. */
async function listenPost(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-lauschen')) return;
  const inBush = () => w.player.x > 856 && w.player.x < 922 && w.player.y > 472 && w.player.y < 512;
  let told = false;
  while (w.alive && inBush() && !w.stealth.hidden) {
    if (!told) { told = true; w.bark('player', 'Runter. Ganz flach machen …', 1800); }
    await w.wait(150);
  }
  if (!w.alive || !inBush() || G.state.is('k5-lauschen')) return;
  G.state.set('k5-lauschen');
  await treeScene(w);
}

async function treeScene(w: WorldCtx): Promise<void> {
  const algard = w.actor('algard'), maedchen = w.actor('maedchen'), baris = w.actor('baris'), orwen = w.actor('orwen'), kyra = w.actor('kyra');
  await w.cutscene(async () => {
    w.stealth.enable(false);
    maedchen.hold(true);
    w.player.setIdle(CROUCH);
    await w.camera.pan([830, 352], 1200);
    await w.camera.zoom(1.5, 800);
    await w.say('algard', 'Den dritten Abend Dörrfleisch. Bald kau ich auf meinem Gürtel rum.');
    await w.say('k5-kyra-bound', 'Da drüben hoppeln Hasen. Oder fängst du nur Sachen, die festgebunden sind?', { mood: 'angry' });
    await w.say('algard', 'Ich? Hasen hetzen wie ein Wilddieb? Ich bin Soldat, Kleine.', { mood: 'angry' });
    await w.say('k5-kyra-bound', 'Soldat. So nennt man das jetzt.', { mood: 'determined' });
    await maedchen.walkTo(818, 340);
    maedchen.face('kyra');
    await w.say('maedchen', 'Noch ein Wort, Gör.', { mood: 'angry' });
    await w.say('k5-kyra-bound', 'Gern. Was macht dein Schenkel, Mädchen? Heulst du nachts noch?', { mood: 'angry' });
    await w.say('maedchen', 'Das zweite Veilchen kriegst du umsonst!', { mood: 'angry' });
    void maedchen.play('attack', { ms: 900 });
    await w.wait(250);
    baris.face('maedchen');
    await w.say('baris', 'Wer sie anfasst, verliert die Hand.');
    await maedchen.emote('drop', 600);
    await w.say('maedchen', 'Hauptmann, die Kröte hat mich …', { mood: 'angry' });
    await w.say('baris', 'Ich hab’s gehört. Es war komisch.');
    await w.say('maedchen', 'Komisch?');
    await baris.walkTo(836, 330);
    await w.say('baris', 'Die ist mehr wert als ihr drei zusammen. Ein Kratzer an ihr, und ich hol ihn mir doppelt von dir.');
    await w.say('baris', 'Also. Wie viel ist sie wert?');
    await w.say('maedchen', 'Mehr als ich, Hauptmann.');
    baris.face('kyra');
    await w.say('baris', 'Und du. Wer zu laut bellt, kriegt einen Maulkorb.');
    await orwen.walkTo(868, 340);
    await w.say('narrator', 'Der Grauhaarige drückt Kyra einen schmutzigen Lappen zwischen die Zähne und knotet ihn im Nacken fest.');
    sfx('rustle', { volume: 0.4 });
    await w.say('orwen', 'Schon besser. Unser Geschenk soll ja in einem Stück ankommen, Mädel.', { mood: 'smirk' });
    void kyra.emote('anger', 1200);
    await w.player.emote('anger', 700);
    await w.camera.zoom(1, 700);
    await w.camera.pan('player', 600);
    await w.think('Mehr wert als drei Soldaten. Kyra. Ein Mädchen vom Hof, genau wie ich. Was wollen die von ihr?');
    await w.camera.pan([900, 340], 600);
    // „Wortfetzen“: Baris gives his orders; where Lia hides decides how much she hears.
    await G.ui.scenePick({
      label: 'Wortfetzen',
      help: 'Am Feuer hörst du ganze Sätze, aber die Fackel kommt dort vorbei. Im Busch bist du sicher und hörst nur Fetzen.',
      backdrop: 'minigames/stealth-listen',
      layout: 'row',
      className: 'k5-wortfetzen',
      rounds: MOMENTS.map(m => ({
        cue: m.cue,
        prompt: { text: m.prompt },
        cards: SPOTS.map(c => ({ ...c })),
        judge: (id: string) => {
          const v = judgeSpot(m, id);
          return { ok: v.ok, mood: v.ok ? 'calm' : 'shake', reply: v.line };
        },
      })),
      onVerdict: v => { if (!v.ok) { sfx('suspicious', { volume: 0.4 }); void w.player.emote('drop', 600); } },
    });
    await w.say('orwen', 'Sofort, Hauptmann. Und du, Algard: Finger weg vom Weinschlauch.');
    const barisGone = baris.walkPath([[1000, 380], [1270, 420]], { speed: 60 }).catch(() => {});
    await orwen.walkPath([[1010, 390], [1270, 430]], { speed: 60 });
    await barisGone;
    w.despawn('baris');
    w.despawn('orwen');
    w.camera.follow();
    w.player.setIdle('idle');
    maedchen.hold(false);
    w.stealth.resetGuards();
    w.stealth.enable(true);
  });
  completeScouting(w, G.state);
}

async function plan(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-plan')) return;
  G.state.set('k5-plan');
  const flick = w.actor('flick');
  await w.cutscene(async () => {
    w.stealth.enable(false);
    flick.face('player');
    w.player.face('flick');
    await w.say('flick', 'Und? Lebt sie?', { mood: 'determined' });
    await lia('Sie ist an die Eiche gebunden. Der Hüne sagt, sie ist mehr wert als drei von seinen Männern.', 'scared');
    await w.say('flick', 'Ein Bauernmädchen, auf das so einer aufpasst wie auf seinen Geldbeutel? Das riecht faul.', { mood: 'surprised' });
    await lia('Ich weiß es nicht. Daheim hat sie Feuerholz geschleppt und mich ausgelacht, weil ich lese. Mehr war da nie.', 'sad');
    // Lia puts together what she overheard.
    const pieced = await G.ui.scenePick({
      label: 'Was hast du gehört?',
      help: 'Setz zusammen, was am Feuer gesagt wurde. Auch Fetzen ergeben einen Satz.',
      layout: 'row',
      className: 'k5-zusammensetzen',
      rounds: QUESTIONS.map(q => ({
        cue: q.id,
        prompt: { speaker: 'flick', text: q.prompt },
        cards: q.answers.map(({ id, text }) => ({ id, text })),
        judge: (id: string) => {
          const a = q.answers.find(x => x.id === id)!;
          return { ok: a.ok, mood: a.ok ? 'good' : 'shake', reply: { speaker: 'flick', text: a.reply } };
        },
      })),
    });
    if (pieced.mistakes === 0) {
      G.state.set(LISTENED_FLAG);
      await w.say('flick', 'Drei Wachen und eine Grotte, von der keiner was weiß. Gut gelauscht, Leseratte. Wer so genau hinhört, lügt auch überzeugender.', { mood: 'smirk' });
      await lia('Lügen. Ich. Wunderbar.', 'sad');
    }
    await w.say('flick', 'Bleiben also drei Wachen. Günstiger wird’s nicht.', { mood: 'determined' });
    await w.say('flick', 'Ich würd’s ja allein machen. Aber drei Kerle, ein Seil, zwei Hände. Die Rechnung geht nicht auf.');
    await w.say('flick', 'Erst holen wir deine Schwester da raus. Solange die sie haben, haben die auch dich.');
    await w.say('flick', 'Ich kriech durchs Gras zum Baum und schneide sie los. Du sorgst dafür, dass keiner zum Baum schaut.');
    await lia('Ich? Such dir lieber jemand Mutigeren.', 'scared');
    await w.say('flick', 'Ich hab mich umgesehen. Hier sind du, ich und ein Hase. Der Hase hat abgelehnt.', { mood: 'smirk' });
    await lia('Na schön. Mir schlottern die Knie. Aber ich mach’s.');
    await lia('Warte. Ich geh da einfach hin und … und was dann?', 'surprised');
    await w.say('flick', 'Du hast hundert Bücher gelesen, Leseratte. Irgendwer darin hat bestimmt mal gelogen.', { mood: 'happy' });
    if (G.state.has('dagger')) {
      await w.say('flick', 'Hast du was Scharfes dabei? Außer deiner Zunge?');
      await lia('Vaters Dolch.');
      await w.say('flick', 'Gut. Ich seh, wie fest du den Griff hältst. Erst die Fesseln, zu zweit sind die schneller durch. Kommt dir einer zu nah: zustechen und weiterlaufen. Ich will dich heil zurück, Leseratte.', { mood: 'determined' });
      G.state.set('k5-dolch-plan');
    } else {
      await w.say('flick', 'Kein Messer? Dann säg ich allein an dem Seil, und das dauert. Halt sie lange genug bei Laune.', { mood: 'determined' });
    }
    flick.hold(true);
    flick.setIdle(CROUCH);
    await flick.walkPath([[420, 560], [520, 640], [600, 660]], { speed: 70 });
    w.despawn('flick');
  });
  w.setObjective('k5-ablenken', 'Geh offen zum Feuer und lenk die Wachen ab.', [800, 392]);
}

async function bluff(w: WorldCtx): Promise<void> {
  const points = await runBluff(w);
  G.state.set('k5-ablenkung', points);
  w.completeObjective('k5-ablenken');
  await G.ui.fade('out', 500);
  await G.goto('rettung');
}

export async function schattenlagerScript(w: WorldCtx): Promise<void> {
  w.companions.remove('flick');
  w.spawn({ id: 'flick', preset: 'flick', at: [340, 476], dir: 'right', idle: CROUCH });
  ambience(['wind', 'crickets', 'fire'], { fire: 0.35, crickets: 0.7, wind: 0.5 });
  if (G.state.is('k5-plan')) {
    w.despawn('flick');
    w.stealth.enable(false);
    w.setObjective('k5-ablenken', 'Geh offen zum Feuer und lenk die Wachen ab.', [800, 392]);
    return;
  }
  if (G.state.is('k5-lauschen')) {
    w.despawn('baris'); w.despawn('orwen');
    w.setObjective('k5-zurueck', 'Schleich zurück zu Flick an den Waldrand.', 'flick');
    return;
  }
  await w.wait(500);
  await w.narrate(['Am nächsten Abend sahen sie den Rauch. Unter einer einsamen Eiche über den Feldern rastete der Trupp.'], { style: 'card' });
  await w.cutscene(async () => {
    await w.say('flick', 'Da sind sie. Runter!', { mood: 'determined' });
    await w.say('flick', 'Mich sieht man in dem Gras meilenweit, ich bin zu lang. Du bist kleiner. Schau dir das Lager an, ich warte hier.', { mood: 'smirk' });
    await lia('Nicht klein. Unfertig. Das ist ein Unterschied.');
    await w.say('flick', 'Dann sei heute ausnahmsweise klein. Steht dir.', { mood: 'smirk' });
  });
  await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt, um zu schleichen. Geduckt in Büschen und hohem Gras sehen dich die Wachen nicht. Achte auf ihre Sichtkegel.`);
  scoutObjective(w);
}

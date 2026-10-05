// Kapitel V, Szene 3 „schattenlager“: Baris' troop rests at a lone oak above open fields. Lia scouts three vantage
// points while Flick waits at the forest edge (stealth: patrols with view cones, bushes and tall grass). From the
// closest bush she watches Kyra provoke a guard and Baris stop him („Ihr verdammtes Leben ist mehr wert …“). Back
// with Flick: the plan. Then Lia walks into the camp and bluffs; the choices decide how long the distraction holds.
import { G } from '../../core/G';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { runBluff } from './bluffScene';
import { ambience, CROUCH, lia, sfx } from './common';
import { FIRE_AT, LAGER_BLOCK, LAGER_HIDING, LAGER_OCCLUDERS, LAGER_SURFACES, LAGER_WALK } from './lagerGeom';

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
      mode: 'pingpong', suspiciousBarks: ['Was war das?', 'Ist da jemand im Gras?'], calmBarks: ['Nur ein Hase.', 'Verdammte Grillen.'],
    },
    {
      id: 'schuetze', preset: 'shadow-crossbow', speaker: 'k5-schuetze', range: 110, fov: 64, mode: 'pingpong',
      path: [{ at: [770, 420], wait: 1800, face: 'down' }, { at: [720, 520], wait: 1200 }, { at: [690, 640], wait: 2200, face: 'left' }],
      suspiciousBarks: ['Hm?', 'Wer da?'], calmBarks: ['Nichts.', 'Hab mich wohl verguckt.'],
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

const SCOUT = ['k5-sp-felsen', 'k5-sp-stamm', 'k5-lauschen'];
const scouted = () => SCOUT.filter(f => G.state.is(f)).length;

function scoutObjective(w: WorldCtx): void {
  const n = scouted();
  if (n >= 3) return;
  const next = !G.state.is('k5-sp-felsen') ? 'felsen' : !G.state.is('k5-sp-stamm') ? 'stamm' : [888, 492] as [number, number];
  w.setObjective('k5-auskundschaften', `Kundschafte das Lager aus, ohne gesehen zu werden (${n}/3).`, next);
}

async function scoutRocks(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-sp-felsen')) { await w.think('Sechs Pferde, drei Wachen, der Hüne und der Grauhaarige. Ich habe genug gesehen.'); return; }
  await w.cutscene(async () => {
    w.player.face('up');
    await w.player.play('interact', { ms: 600 });
    w.player.setIdle(CROUCH);
    await w.camera.pan([880, 330], 1400);
    await w.think('Von hier oben sehe ich alles. Sechs Pferde an einer Stange …');
    await w.camera.pan([800, 360], 700);
    await w.think('Einer am Feuer, einer mit Spieß am Baum, ein Armbrustschütze auf dem Weg.');
    await w.camera.pan([900, 350], 700);
    await w.think('Und der Riese in der schwarzen Rüstung. Das muss ihr Hauptmann sein. Neben ihm der Grauhaarige vom Hof.');
    G.state.addClue('k5-lager-wachen');
    w.camera.follow();
    await w.wait(500);
    w.player.setIdle('idle');
  });
  G.state.set('k5-sp-felsen');
  scoutObjective(w);
}

async function scoutLog(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-sp-stamm')) { await w.think('Kyra sitzt immer noch am Baum. Halte durch.'); return; }
  await w.cutscene(async () => {
    w.player.setIdle(CROUCH);
    await w.camera.pan([852, 330], 1200);
    await w.camera.zoom(1.4, 700);
    await w.think('Da! Am Stamm der Eiche … Kyra. Gefesselt, aber sie lebt.');
    w.bark('kyra', 'Pah.', 1600);
    await w.think('Hohes Gras und Büsche reichen fast bis ans Lager. Im Süden, im Feld, käme ich ganz nah heran.');
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
    if (!told) { told = true; w.bark('player', 'Ducken, sonst sehen sie mich …', 1800); }
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
    await w.say('algard', 'Was gäb ich jetzt für einen richtig schönen Braten.');
    await w.say('k5-kyra-bound', 'Dann fang dir halt was.', { mood: 'angry' });
    await w.say('algard', 'Pah! Seh ich etwa aus wie ein gewöhnlicher Strauchdieb?', { mood: 'angry' });
    await w.say('k5-kyra-bound', 'Wenn ihr mich fragt: schon.', { mood: 'determined' });
    await maedchen.walkTo(818, 340);
    maedchen.face('kyra');
    await w.say('maedchen', 'Was hast du gerade gesagt?', { mood: 'angry' });
    await w.say('k5-kyra-bound', 'Dass ihr ein verfluchter Bastard seid. Das hab ich gesagt.', { mood: 'angry' });
    await w.say('maedchen', 'Na warte. Dir werd ich Manieren beibringen!', { mood: 'angry' });
    void maedchen.play('attack', { ms: 900 });
    await w.wait(250);
    baris.face('maedchen');
    await w.say('baris', 'Fass sie nicht an.', { mood: 'angry' });
    await maedchen.emote('drop', 600);
    await w.say('maedchen', 'Aber dieses Rotzgör hat mich beleidigt!', { mood: 'angry' });
    await w.say('baris', 'Und dennoch wird ihr kein Haar gekrümmt.');
    await w.say('maedchen', 'Aber, Hauptmann …');
    await baris.walkTo(836, 330);
    await w.say('baris', 'Kein Aber. Ihr verdammtes Leben ist mehr wert als euer mickriges Dasein.', { mood: 'angry' });
    await w.say('baris', 'Wer ihr etwas antut, bereut es bei lebendigem Leib. Hab ich mich klar ausgedrückt?');
    await w.say('maedchen', 'Ja, Hauptmann.');
    baris.face('kyra');
    await w.say('baris', 'Und du: Hüte deine Zunge, oder ich helfe dir, sie im Zaum zu halten.');
    await orwen.walkTo(868, 340);
    await w.say('narrator', 'Der Grauhaarige stopft Kyra einen Knebel zwischen die Zähne.');
    sfx('rustle', { volume: 0.4 });
    await w.say('orwen', 'So ist es besser. Sonst schneidet sie dir noch einer meiner Männer heraus.', { mood: 'smirk' });
    void kyra.emote('anger', 1200);
    await w.player.emote('anger', 700);
    await w.camera.zoom(1, 700);
    await w.camera.pan('player', 600);
    await G.ui.hold('Halte still', 2600, { struggle: true, onRelease: () => sfx('branch-snap', { volume: 0.5 }) });
    await w.think('Ihr Leben ist mehr wert? Mehr wert als was? Was wollen die von Kyra?');
    await w.camera.pan([900, 340], 600);
    await w.say('baris', 'Orwen. Wir reiten voraus und sehen uns den Weg zur Grotte an. Ihr drei haltet Wache.');
    await w.say('orwen', 'Wie Ihr befehlt, Hauptmann.');
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
  w.completeObjective('k5-auskundschaften');
  w.setObjective('k5-zurueck', 'Schleich zurück zu Flick an den Waldrand.', 'flick');
}

async function plan(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-plan')) return;
  G.state.set('k5-plan');
  const flick = w.actor('flick');
  await w.cutscene(async () => {
    w.stealth.enable(false);
    flick.face('player');
    w.player.face('flick');
    await w.say('flick', 'Und?', { mood: 'determined' });
    await lia('Sie haben Kyra an den Baum gefesselt. Der Hauptmann sagt, ihr Leben sei mehr wert als das seiner Männer.', 'scared');
    await w.say('flick', 'Mehr wert? Seltsam. Wozu brauchen die ein Bauernmädchen so dringend?', { mood: 'surprised' });
    await lia('Ich weiß es nicht.', 'sad');
    await w.say('flick', 'Der Hauptmann und der Grauhaarige sind weg. Nur noch drei Wachen. Besser wird es nicht.', { mood: 'determined' });
    await w.say('flick', 'Okay. Allein schaff ich das nicht. Du musst mir helfen.');
    await w.say('flick', 'Wir müssen deine Schwester befreien. Dann haben sie wenigstens nichts gegen uns in der Hand.');
    await w.say('flick', 'Ich schleiche mich zum Baum und schneide sie los. Du lenkst die Wachen ab.');
    await lia('Kann es nicht bitte jemand anderes machen?', 'scared');
    await w.say('flick', 'Siehst du hier noch jemanden außer uns?', { mood: 'smirk' });
    await lia('Nein. Aber gut, dann los.');
    await lia('Moment. Was soll ich denn bitte sagen?', 'surprised');
    await w.say('flick', 'Ach, dir wird schon irgendwas einfallen.', { mood: 'happy' });
    if (G.state.has('dagger')) {
      await w.say('flick', 'Hast du ein Messer?');
      await lia('Vaters Dolch.');
      await w.say('flick', 'Gut. Wenn es eng wird: Seile schneiden, nicht Leute. Zu zweit sind die Fesseln schneller durch.', { mood: 'determined' });
      G.state.set('k5-dolch-plan');
    } else {
      await w.say('flick', 'Kein Messer? Dann muss ich die Fesseln allein durchschneiden. Das dauert. Halt sie lange genug hin.', { mood: 'determined' });
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
    await w.say('flick', 'Ich bin zu groß und zu grün für das Gras da draußen. Du bist kleiner. Sieh dir das Lager an. Ich warte hier.', { mood: 'smirk' });
    await lia('Ich bin nicht klein.');
    await w.say('flick', 'Heute schon. Und heute ist das gut so.', { mood: 'smirk' });
  });
  await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt, um zu schleichen. Geduckt in Büschen und hohem Gras sehen dich die Wachen nicht. Achte auf ihre Sichtkegel.`);
  scoutObjective(w);
}

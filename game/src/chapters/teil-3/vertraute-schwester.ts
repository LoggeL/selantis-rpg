// Scene „e3-vertraute-schwester“ – Ein Becher Tee (docs/teil-3/umsetzung.md §3, F3 25:51–28:18). Three checkpointed
// parts (G.goto with { part }, a reload restarts the current part):
//  1. default, e3-waldrast (the reused night thicket k3-leselager): the sisters make camp a day after the escape. Lia
//     gathers dry wood (three bundles), Kyra lights the fire. At the fire Lia finally tells her everything, topic by
//     topic (vertraute-schwester-abend.ts); Kyra listens with half an ear except for Trapas and the paladins. Kyra
//     brews tea and hands her the cup: storyAction('lift'), plate e3-gift, e3-vergiftet is set at the drink. Lia
//     notices how little Kyra talks; Kyra shuts it down. Lia feels heavy and sleeps.
//  2. 'halle' (only with e3-vergiftet): framed „Unterdessen …“ in Vamir's hall (e3-halle-plan, player knowledge): the
//     poison, the Urmacht that keeps her alive but not strong, Kyra leading her to a remote camp, Baris and the trap,
//     the spy in the order house. Sets e3-gift-plan.
//  3. 'morgen' (only with e3-gift-plan): Kyra wakes her harshly (storyAction 'open-eyes'). Lia walks slowly
//     (shared.liaGait: slow walk, no running), staggers now and then, the tincture does nothing. A short way out of the thicket after Kyra.
//     → e3-falle.
import { G } from '../../core/G';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import { HALLE_SPAWNS, HALLE_SPOT, halleBase, halleBrazierLights } from '../teil-2/gewoelbe';
import { type GesturePicture, restageGesture } from '../teil-2/gewoelbe-geste';
import {
  AFTER_TEA, BEFORE_TEA, TEA_DRINK, TEA_SIGNS, TEA_SIGNS_FLAG, eveningOptions, HALL_CUT, KYRA_WAIT_BARKS, type Line, MORNING, STAGGER_BARKS, STAGGER_EVERY_MS,
  TINCTURE_THOUGHT, type TopicKey,
} from './vertraute-schwester-abend';
import { FIRE_HOTSPOT, PATH_EXIT, RAST_SPOT, RAST_WALK, WOOD_AT } from './vertraute-schwester-rast';
import { bg, e3Scene, interlude, lia, liaGait, liaLook, nextScene, poisoned, sfx, ui, until } from './shared';
import { NO_LOOK, WALDRAST_CLUES } from './spuersinn';

/** Flags of this visit (reset when a part starts) and the checkpoint flags. */
const F = {
  wood: 'e3-vs-holz',
  fire: 'e3-vs-feuer',
  seated: 'e3-vs-sitzt',
  drank: 'e3-vs-getrunken',
  out: 'e3-vs-aufbruch',
} as const;
export const VS_RESULT = { topics: 'e3-vs-erzaehlt', closeHeard: 'e3-vs-trapas-erzaehlt' } as const;

const KYRA = 'kyra';
const WOOD_NEEDED = 3;

// ---------------------------------------------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------------------------------------------


export const waldrast: MapDef = defineMap({
  id: 'e3-waldrast',
  name: 'Rast im Wald',
  background: 'k3-leselager',
  baked: 'night',
  walk: RAST_WALK,
  block: [
    { id: 'baumstamm', sight: false, poly: [[266, 138], [404, 142], [404, 162], [266, 158]] },
    { id: 'fels', poly: [[412, 192], [474, 192], [474, 214], [412, 214]] },
    { id: 'feuerstelle', sight: false, poly: [[296, 200], [330, 200], [330, 216], [296, 216]] },
  ],
  occluders: [
    { id: 'baumstamm', baseline: 160, poly: [[262, 112], [408, 112], [408, 164], [262, 162]] },
    { id: 'fels', baseline: 214, poly: [[408, 172], [478, 172], [478, 216], [408, 216]] },
    { id: 'busch-sw', baseline: 360, poly: [[0, 236], [120, 226], [200, 262], [234, 290], [232, 360], [0, 360]] },
    { id: 'busch-so', baseline: 360, poly: [[306, 290], [320, 268], [470, 262], [560, 236], [640, 230], [640, 360], [300, 360]] },
  ],
  surfaces: [{ id: 'erde', kind: 'dirt', poly: [[262, 182], [362, 182], [370, 222], [262, 226]] }],
  surface: 'darkgrass',
  interactables: [
    ...WOOD_AT.map((at, i) => ({
      id: `holz-${i + 1}`, at, verb: 'Aufsammeln', radius: 22, sparkle: true, once: true, prop: 'twigs', removeOnUse: true,
      onInteract: (w: WorldCtx) => pickWood(w, i),
    })),
    {
      id: 'feuer', verb: 'Hinsetzen', poly: FIRE_HOTSPOT, radius: 30, once: false, standAt: RAST_SPOT.liaSeat, face: 'right',
      when: () => G.state.is(F.fire) && !G.state.is(F.seated), onInteract: async () => { G.state.set(F.seated); },
    },
  ],
  triggers: [{ id: 'aufbruch', poly: PATH_EXIT, once: false, when: () => G.state.is('e3-gift-plan'), onEnter: () => { G.state.set(F.out); } }],
  lights: [{ id: 'mond', at: [330, 20], kind: 'moon', radius: 240, intensity: 0.28 }],
  spawns: {
    start: { at: [266, 300], dir: 'up' },
    bett: { at: RAST_SPOT.bed, dir: 'right' },
  },
  time: 'night',
  weather: 'fireflies',
  ambience: ['night', 'crickets', 'wind'],
  ambienceVolume: { wind: 0.35 },
  music: null,
  playerLight: 60,
  critters: false,
  resetOnEnter: true,
  lookMode: true,
  clues: WALDRAST_CLUES,
});

/** Vamir's hall at night, braziers low (the plan). */
export const hallePlan: MapDef = defineMap({
  ...halleBase,
  id: 'e3-halle-plan',
  name: 'Weit entfernt',
  spawns: { ...HALLE_SPAWNS, thron: { at: HALLE_SPOT.dais, dir: 'down' } },
  lights: halleBrazierLights(0.6),
  time: 'night',
  ambience: ['room'],
  ambienceVolume: { room: 0.6 },
  music: 'dread',
  resetOnEnter: true,
  lookBlocked: NO_LOOK.halle,
});

// ---------------------------------------------------------------------------------------------------------------
// Part 1: the evening
// ---------------------------------------------------------------------------------------------------------------

const say = (w: WorldCtx, l: Line): Promise<void> => {
  if (l.who === 'lia') return lia(w, l.text, l.mood);
  if (l.who === 'think') return w.think(l.text);
  if (l.who === 'kyra-cold') return w.say('e3-kyra', l.text, { portrait: 'e2-kyra-gebannt', mood: l.mood ?? 'cold' });
  return w.say('e3-kyra', l.text, l.mood ? { mood: l.mood } : undefined);
};

function lightFire(w: WorldCtx): void {
  w.addProp({ prop: 'campfire', at: [RAST_SPOT.fire[0], RAST_SPOT.fire[1] + 6], id: 'lagerfeuer', collide: false });
  w.lighting.add({ id: 'feuer', at: [RAST_SPOT.fire[0], RAST_SPOT.fire[1] - 8], kind: 'fire', radius: 160, intensity: 1.3, always: true });
}

const woodFlag = (i: number) => `${F.wood}-${i + 1}`;

async function pickWood(w: WorldCtx, i: number): Promise<void> {
  await w.player.play('kneel', { ms: 500 });
  G.state.set(woodFlag(i));
  const n = G.state.inc(F.wood);
  w.setObjective('e3-vs-holz', `Sammle trockenes Holz für das Feuer (${n}/${WOOD_NEEDED}).`, nextWood());
  if (n === 1) w.bark('player', 'Trocken. Wenigstens etwas.', 1600);
}

/** The next bundle still lying in the thicket (objective target), or null when all are gathered. */
function nextWood(): string | null {
  const i = WOOD_AT.findIndex((_, k) => !G.state.is(woodFlag(k)));
  return i >= 0 ? `holz-${i + 1}` : null;
}

async function makeCamp(w: WorldCtx): Promise<void> {
  await ui().fade('in', 1100);
  await w.cutscene(async () => {
    await w.think('Einen ganzen Tag durch den Wald. Meine Füße sind noch nicht trocken, aber sie laufen.');
    await w.say('e3-kyra', 'Hier bleiben wir. Sammel Holz. Trockenes, nicht das grüne Zeug.');
    await lia(w, 'Jawohl, Frau Feldherrin. Soll ich auch noch salutieren?');
    await w.say('e3-kyra', 'Holz reicht.');
  });
  w.unlockPlayer();
  w.setObjective('e3-vs-holz', `Sammle trockenes Holz für das Feuer (0/${WOOD_NEEDED}).`, 'holz-1');
  await until(w, () => Number(G.state.flag(F.wood) ?? 0) >= WOOD_NEEDED && !G.ui.busy());
  w.completeObjective('e3-vs-holz');
  const k = w.actor(KYRA);
  w.companions.remove(KYRA);
  await w.cutscene(async () => {
    await k.walkTo(RAST_SPOT.kyraSeat[0], RAST_SPOT.kyraSeat[1], { face: 'left' });
    bg(k.play('kneel', { ms: 1400 }));
    sfx('fire-ignite', { volume: 0.7 });
    w.fx.burst(RAST_SPOT.fire, 'smoke', 6);
    await w.wait(700);
    lightFire(w);
    G.state.set(F.fire);
    k.setIdle('sit');
    await w.say('e3-kyra', 'Beim ersten Funken. Früher hast du dafür einen ganzen Abend gebraucht.');
    await lia(w, 'Früher hatte ich auch nur Bücher und keinen Feuerstein. Bücher brennen übrigens schlecht. Ich hab’s nie probiert.');
  });
  w.setObjective('e3-vs-feuer', 'Setz dich zu Kyra ans Feuer.', 'feuer');
  await until(w, () => G.state.is(F.seated) && !G.ui.busy());
  w.completeObjective('e3-vs-feuer');
}

async function tellEverything(w: WorldCtx): Promise<void> {
  const k = w.actor(KYRA);
  await w.cutscene(async () => {
    w.player.setIdle('sit');
    w.player.face('right');
    await lia(w, 'Gestern hast du gesagt: am Feuer. Jetzt sitzen wir am Feuer. Also hör zu, ich hab dir so viel zu erzählen.', 'happy');
    const told = new Set<TopicKey>();
    for (let opts = eveningOptions(told); opts.topics.length; opts = eveningOptions(told)) {
      const pick = await w.choose(opts.picks, { prompt: told.size ? 'Was erzähle ich noch?' : 'Womit fange ich an?' });
      if (pick >= opts.topics.length) break;
      const t = opts.topics[pick];
      told.add(t.key);
      if (t.close) {
        // She leans in: the only time she really listens.
        k.setIdle('idle');
        k.face('player');
        bg(k.emote('…', 1200));
        G.state.set(VS_RESULT.closeHeard);
      }
      for (const l of t.lines) await say(w, l);
      if (t.close) k.setIdle('sit');
    }
    G.state.set(VS_RESULT.topics, [...told].join(','));
  });
}

async function tea(w: WorldCtx): Promise<void> {
  const k = w.actor(KYRA);
  ui().prefetchPlate('e3-gift');
  await w.cutscene(async () => {
    for (const l of BEFORE_TEA) await say(w, l);
    k.setIdle('idle');
    bg(k.play('kneel', { ms: 1800 }));
    w.fx.burst([RAST_SPOT.fire[0] + 10, RAST_SPOT.fire[1] - 6], 'smoke', 4);
    await w.wait(1600);
    await k.walkTo(RAST_SPOT.liaSeat[0] + 22, RAST_SPOT.liaSeat[1] - 4, { face: 'left' });
    await w.say('e3-kyra', 'Hier. Vorsicht, heiß.');
  });
  w.lockPlayer();
  // Overlooked signs: before she drinks, the player may look closer. Lia talks every sign away; drinking is canon.
  const seen = new Set<number>();
  for (;;) {
    const opts = [
      ...TEA_SIGNS.map((s, i) => ({ text: s.option, disabled: seen.has(i), reason: seen.has(i) ? 'Schon gesehen.' : undefined })),
      { text: TEA_DRINK },
    ];
    const pick = await w.choose(opts, { prompt: 'Der Becher in Lias Händen …', speaker: 'e3-lia' });
    if (pick === TEA_SIGNS.length) break;
    seen.add(pick);
    for (const l of TEA_SIGNS[pick].lines) await say(w, l);
  }
  G.state.set(TEA_SIGNS_FLAG, seen.size);
  await w.player.play('interact', { ms: 900 });
  // Set at the drink (umsetzung.md §2 Gift): from here on Lia is poisoned.
  G.state.set('e3-vergiftet');
  G.state.set(F.drank);
  await w.cutscene(async () => {
    await G.ui.plate('e3-gift', { caption: 'Ein Becher Tee', pan: 'in', durationMs: 9000 });
    await w.wait(2800);
    await G.ui.closePlate();
    await k.walkTo(RAST_SPOT.kyraSeat[0], RAST_SPOT.kyraSeat[1], { face: 'left' });
    k.setIdle('sit');
    for (const l of AFTER_TEA) await say(w, l);
    w.addProp({ prop: 'blanket', at: [RAST_SPOT.bed[0], RAST_SPOT.bed[1] + 8], id: 'decke', collide: false });
    w.player.setIdle('idle');
    await w.player.walkTo(RAST_SPOT.bed[0], RAST_SPOT.bed[1], { face: 'right' });
    w.player.setIdle('lie');
    await w.wait(900);
    await w.think('Kyra sitzt am Feuer und schaut mich an. Sie ist da. Alles andere kann warten bis morgen.');
  });
  await ui().fade('out', 1800);
}

async function abendScript(w: WorldCtx): Promise<void> {
  for (const f of [F.fire, F.seated, F.drank, ...WOOD_AT.map((_, i) => woodFlag(i))]) G.state.set(f, false);
  G.state.set(F.wood, 0);
  w.lockPlayer();
  await makeCamp(w);
  await tellEverything(w);
  await tea(w);
  await nextScene('e3-vertraute-schwester', { part: 'halle' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: far away – the plan
// ---------------------------------------------------------------------------------------------------------------

async function halleScript(w: WorldCtx): Promise<void> {
  w.lockPlayer();
  const baris = w.spawn({ id: 'baris', preset: 'baris-scarred', speaker: 'e2-baris', at: HALLE_SPOT.doorSouth, dir: 'up', solid: false, facePlayer: false, speed: 40 });
  baris.hold(true);
  await w.camera.zoom(1.3, 0);
  await w.camera.pan([HALLE_SPOT.daisFoot[0], HALLE_SPOT.daisFoot[1] + 30], 0);
  await ui().fade('in', 900);
  await w.cutscene(async () => {
    await baris.walkTo(HALLE_SPOT.daisFoot[0], HALLE_SPOT.daisFoot[1] + 24, { face: 'up' });
    for (const l of HALL_CUT) await w.say(l.who, l.text, l.mood ? { mood: l.mood } : undefined);
    bg(baris.walkTo(HALLE_SPOT.doorSouth[0], HALLE_SPOT.doorSouth[1] + 8));
    await w.wait(1400);
  });
  G.state.set('e3-gift-plan');
  await ui().fade('out', 1100);
  await nextScene('e3-vertraute-schwester', { part: 'morgen' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 3: the morning – poisoned
// ---------------------------------------------------------------------------------------------------------------

/** While poisoned and walking, Lia staggers now and then: a short stop, the hurt pose, a bark. */
async function staggerLoop(w: WorldCtx): Promise<void> {
  let walked = 0, n = 0, lx = w.player.x, ly = w.player.y;
  while (w.alive && !G.state.is(F.out)) {
    await w.wait(200);
    if (G.ui.busy() || !poisoned()) { lx = w.player.x; ly = w.player.y; continue; }
    const moved = Math.hypot(w.player.x - lx, w.player.y - ly);
    lx = w.player.x; ly = w.player.y;
    if (moved > 1) walked += 200;
    if (walked < STAGGER_EVERY_MS) continue;
    walked = 0;
    w.lockPlayer();
    w.bark('player', STAGGER_BARKS[n++ % STAGGER_BARKS.length], 1600);
    await w.player.play('hurt' as never, { ms: 900 });
    w.unlockPlayer();
  }
}

/** Kyra walks ahead to the path and waits there, impatient. */
async function kyraAhead(w: WorldCtx, k: ActorHandle): Promise<void> {
  await k.walkTo(RAST_SPOT.pathOut[0], RAST_SPOT.pathOut[1], { face: 'up' });
  let n = 0;
  while (w.alive && !G.state.is(F.out)) {
    await w.wait(4200);
    if (!G.ui.busy() && Math.hypot(w.player.x - k.x, w.player.y - k.y) > 50) w.bark(KYRA, KYRA_WAIT_BARKS[n++ % KYRA_WAIT_BARKS.length], 1500);
  }
}

async function morgenScript(w: WorldCtx): Promise<void> {
  G.state.set(F.out, false);
  w.lockPlayer();
  w.player.teleport(RAST_SPOT.bed, 'right');
  w.player.setIdle('lie');
  w.addProp({ prop: 'blanket', at: [RAST_SPOT.bed[0], RAST_SPOT.bed[1] + 8], id: 'decke', collide: false });
  w.addProp({ prop: 'firering', at: [RAST_SPOT.fire[0], RAST_SPOT.fire[1] + 6], id: 'asche', collide: false });
  const k = w.spawn({ id: KYRA, preset: 'kyra', speaker: 'e3-kyra', at: RAST_SPOT.kyraMorning, dir: 'left', solid: false, facePlayer: false });
  k.hold(true);
  await ui().fade('in', 900);
  await w.cutscene(async () => {
    await w.say('e3-kyra', 'Hoch. Sofort.', { mood: 'angry' });
  });
  const wake = G.ui.storyAction('open-eyes', 'Die Augen öffnen', { backdrop: 'e3-vertraute-schwester-geweckt', fallback: 'k3-leselager', caption: 'Asche statt Feuer. Kyra steht über ihr und lächelt nicht.' });
  restageGesture('open-eyes', 'Die Lider sind schwer wie nasse Wolle. Schieb sie trotzdem hoch.');
  await wake;
  await w.cutscene(async () => {
    for (const l of MORNING) await say(w, l);
    w.player.setIdle('idle');
    w.player.teleport([RAST_SPOT.bed[0] + 6, RAST_SPOT.bed[1] - 6], 'right');
    await w.player.play('hurt' as never, { ms: 900 });
    await w.think('Was ist das? Ich hab geschlafen wie ein Stein und fühle mich, als hätte ich die Nacht Steine geschleppt.');
    if (G.state.has('tincture')) {
      const pick = await w.choose(['Mutters Tinktur versuchen', 'Keine Zeit, Kyra wartet']);
      if (pick === 0) await w.think(TINCTURE_THOUGHT);
    }
  });
  liaGait(w);
  bg(kyraAhead(w, k));
  bg(staggerLoop(w));
  w.setObjective('e3-vs-weg', 'Folge Kyra aus dem Dickicht. Langsam, es geht nicht schneller.', RAST_SPOT.pathOut);
  w.unlockPlayer();
  await until(w, () => G.state.is(F.out) && !G.ui.busy());
  w.completeObjective('e3-vs-weg');
  w.lockPlayer();
  await w.cutscene(async () => {
    k.face('player');
    await lia(w, 'Ich komm ja. Ich komm. Ein Bein vor das andere, das schaffe ich.', 'hurt');
    await w.say('e3-kyra', 'Zum Lager ist es nicht mehr weit.');
  });
  await ui().fade('out', 1400);
  await nextScene('e3-falle');
}

export const scene = e3Scene('e3-vertraute-schwester', 'Ein Becher Tee', async params => {
  await ui().fade('out', 0);
  if (params?.part === 'morgen' && G.state.is('e3-gift-plan')) {
    await startWorld({ map: waldrast, spawn: 'bett', player: liaLook(), companions: [], fadeIn: false, script: morgenScript });
    return;
  }
  if (params?.part === 'halle' && G.state.is('e3-vergiftet')) {
    await interlude('Unterdessen, in der Halle des Meisters …');
    await startWorld({ map: hallePlan, spawn: 'thron', player: 'vamir', companions: [], fadeIn: false, script: halleScript });
    return;
  }
  await G.ui.narrate(['Einen Tag später, tief im Wald'], { style: 'card' });
  await startWorld({
    map: waldrast, spawn: 'start', player: liaLook(), companions: [{ id: KYRA, preset: 'kyra', speaker: 'e3-kyra' }], fadeIn: false, script: abendScript,
  });
});

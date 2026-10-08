// Scene „e3-ritual“ – Das Ritual (docs/teil-3/umsetzung.md §3, F3 38:29–40:41). Two checkpointed parts (G.goto with
// { part }, a reload restarts the current part):
//  1. default, e3-ritualhuegel at dusk: Lia lies bound on the stone (look e3-lia-gefesselt, pose lie, held in place),
//     ten stands with veiled things in a ring round her. She opens her eyes; Baris gloats and she answers him (choice);
//     she stretches her bound hands towards Kyra (storyAction 'reach'), who looks straight through her; Vamir answers
//     for her. Vamir's speech to his men (the last free cities, a new count of years; own words). The cloths come off
//     ten nameless things, turquoise threads run from every stand to Lia, the sphere forms above her (plate e3-ritual).
//  2. 'flick' (only with e3-ri-lia-gesehen): „Unterdessen, am Waldrand …“. The player is Flick with her bow at the
//     bottom of the sunken path, Ignatius and two paladins behind her. Heart: in the Spurenblick the three outer guards
//     lift out of the dusk (only within sight range); each one is pointed out to the others („Posten zeigen“). Then she
//     picks the way up at one of three places (Hohlweg / Felsen / offen, e3-ritual-weg; the battle starts the allies
//     there). She draws (storyAction 'lift') and the first arrow drops the spearman; Baris shouts, Flick answers.
//     Sets e3-ritual-begonnen. → e3-ritualangriff.
// Knowledge stays apart: Flick's approach is framed; Lia learns of it only when Flick stands next to her.
import { G } from '../../core/G';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import { pinArea, pinPlayer } from '../teil-2/gewoelbe';
import { type GesturePicture, restageGesture } from '../teil-2/gewoelbe-geste';
import {
  ANSTIEG_WALK, APPROACH, ASCENTS, type AscentDef, BARIS_RETORTS, canSpot, HILL_BLOCKS, HILL_OCCLUDERS, HILL_SPOT, ON_THE_STONE,
  POST_IDS, type PostId, postObjective, POSTS, type RitualLine, STONE_LIE, TORCHES,
} from './ritual-huegel';
import { ritualCircle, type RitualCircle } from './ritual-kreis';
import { bg, e3Scene, interlude, lia, liaLook, nextScene, poisoned, sfx, ui, until } from './shared';

/** Flags of this visit (reset when a part starts) and the checkpoint flag between the parts. */
const F = {
  liaSeen: 'e3-ri-lia-gesehen',
  spotted: (id: PostId) => `e3-ri-erspaeht-${id}`,
  shown: (id: PostId) => `e3-ri-gezeigt-${id}`,
  chosen: 'e3-ri-weg-gewaehlt',
} as const;
/** Contract and battle flags. */
export const RITUAL_WAY_FLAG = 'e3-ritual-weg';
export const RITUAL_STARTED = 'e3-ritual-begonnen';

const shownCount = (): number => POST_IDS.filter(id => G.state.is(F.shown(id))).length;

async function sayLine(w: WorldCtx, l: RitualLine): Promise<void> {
  if (l.who === 'think') return w.think(l.text);
  if (l.who === 'lia') return lia(w, l.text, l.mood);
  return w.say(l.who, l.text, l.mood ? { mood: l.mood } : undefined);
}

const torchLights = (intensity: number) => TORCHES.map((t, i) => ({
  id: `fackel-${i + 1}`, at: t.light, kind: 'fire' as const, radius: 110, intensity, flame: 0.7, always: true,
}));

// ---------------------------------------------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------------------------------------------

/** Lia on the stone: she cannot move, the ground is only the spot she lies on. */
export const huegel: MapDef = defineMap({
  id: 'e3-ritualhuegel',
  name: 'Ein kahler Hügel',
  background: 'e3-ritualhuegel',
  walk: [pinArea(STONE_LIE, 10)],
  block: HILL_BLOCKS,
  occluders: HILL_OCCLUDERS,
  surface: 'dirt',
  lights: torchLights(1.1),
  spawns: { stein: { at: STONE_LIE, dir: 'down' } },
  camera: { zoom: 1.35 },
  time: 'dusk',
  ambience: ['wind', 'fire'],
  ambienceVolume: { wind: 0.5, fire: 0.4 },
  music: 'dread',
  lookMode: false,
  sneak: false,
  critters: false,
  resetOnEnter: true,
});

/** Below the hill: the sunken path and the forest edge (Flick). Zoomed out so the hilltop stays in view. */
export const anstieg: MapDef = defineMap({
  id: 'e3-ritualhuegel-anstieg',
  name: 'Am Waldrand unterhalb des Hügels',
  background: 'e3-ritualhuegel',
  walk: [ANSTIEG_WALK],
  block: HILL_BLOCKS,
  occluders: HILL_OCCLUDERS,
  surfaces: [{ id: 'hohlweg', kind: 'path', poly: [[40, 720], [200, 720], [250, 600], [330, 506], [210, 506], [130, 600]] }],
  surface: 'grass',
  interactables: [
    ...POST_IDS.map(id => ({
      id: `posten-${id}`, at: POSTS[id].at, verb: 'Posten zeigen', radius: 250, once: false, sparkle: true,
      when: () => G.state.is(F.spotted(id)) && !G.state.is(F.shown(id)), onInteract: (w: WorldCtx) => showPost(w, id),
    })),
    ...ASCENTS.map(a => ({
      id: `anstieg-${a.weg}`, at: a.at, verb: a.verb, radius: 22, standAt: a.at, face: 'up' as const, once: false, sparkle: true,
      when: () => shownCount() >= POST_IDS.length && !G.state.is(F.chosen), onInteract: (w: WorldCtx) => considerAscent(w, a),
    })),
  ],
  lights: torchLights(1.1),
  spawns: { waldrand: { at: HILL_SPOT.forestEdge, dir: 'up' } },
  camera: { zoom: 0.8 },
  time: 'dusk',
  ambience: ['wind', 'fire', 'night'],
  ambienceVolume: { wind: 0.45, fire: 0.25, night: 0.4 },
  music: 'dread',
  lookMode: true,
  sneak: true,
  critters: false,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Staging on the hilltop (both parts)
// ---------------------------------------------------------------------------------------------------------------

const MEN: { id: string; preset: string; at: [number, number] }[] = [
  { id: 'mann-1', preset: 'shadow-sword', at: [520, 458] }, { id: 'mann-2', preset: 'shadow-club', at: [598, 466] },
  { id: 'mann-3', preset: 'shadow-sword', at: [694, 466] }, { id: 'mann-4', preset: 'shadow-crossbow', at: [772, 458] },
];

interface Hill { vamir: ActorHandle; baris: ActorHandle; kyra: ActorHandle; circle: RitualCircle }

function stageHill(w: WorldCtx, opts: { veiled: boolean; men: boolean }): Hill {
  const still = (a: ActorHandle) => { a.hold(true); return a; };
  const vamir = still(w.spawn({ id: 'vamir', preset: 'vamir', speaker: 'e2-vamir', at: HILL_SPOT.vamir, dir: 'down', solid: false, facePlayer: false }));
  const baris = still(w.spawn({ id: 'baris', preset: 'baris-scarred', speaker: 'e2-baris', at: HILL_SPOT.baris, dir: 'right', solid: false, facePlayer: false, speed: 40 }));
  const kyra = still(w.spawn({ id: 'kyra', preset: 'e2-kyra-gebannt', speaker: 'e2-kyra-gebannt', at: HILL_SPOT.kyra, dir: 'left', solid: false, facePlayer: false }));
  if (opts.men) for (const m of MEN) still(w.spawn({ id: m.id, preset: m.preset, speaker: 'dunkelschatten', at: m.at, dir: 'up', solid: false, facePlayer: false }));
  return { vamir, baris, kyra, circle: ritualCircle(w, { veiled: opts.veiled }) };
}

// ---------------------------------------------------------------------------------------------------------------
// Part 1: on the stone (Lia)
// ---------------------------------------------------------------------------------------------------------------

/** Close-up for the reaching gesture: Lia on the stone, Kyra beside it. */
const REACH_PICTURE: GesturePicture = {
  background: 'e3-ritualhuegel',
  focus: [690, 318],
  zoom: 3,
  figures: [
    { id: 'e3-lia-gefesselt', pose: 'lie', at: STONE_LIE, facing: 'right' },
    { id: 'e2-kyra-gebannt', pose: 'idle', at: HILL_SPOT.kyra, facing: 'left' },
  ],
  glint: [704, 316],
};

async function steinScript(w: WorldCtx): Promise<void> {
  w.lockPlayer();
  const release = pinPlayer(w, 'lie', 'down');
  const { vamir, baris, kyra, circle } = stageHill(w, { veiled: true, men: true });
  await w.camera.pan([STONE_LIE[0], STONE_LIE[1] + 10], 0);
  await ui().fade('in', 1600);
  await G.ui.storyAction('open-eyes', 'Die Augen öffnen', { help: 'Die Lider kleben, der Kopf ist schwer. Schieb die Augen trotzdem auf.' });
  await w.cutscene(async () => {
    for (const l of ON_THE_STONE.wake) await sayLine(w, l);
    if (poisoned()) await w.think('Und unter allem dieses Gift, das mir die Knochen weich macht. Ich könnte nicht mal weglaufen, wenn die Stricke reißen.');
    // Baris comes over.
    await baris.walkTo(STONE_LIE[0] - 40, STONE_LIE[1] + 44, { face: 'up' });
    for (const l of ON_THE_STONE.baris) await sayLine(w, l);
    const pick = await w.choose(BARIS_RETORTS.map(r => r.text), { prompt: 'Was antwortet Lia?', speaker: 'e3-lia' });
    const r = BARIS_RETORTS[pick];
    if (r.lia) await lia(w, r.lia, r.mood);
    else await w.think('Ich seh an ihm vorbei in den Himmel. Der ist wenigstens schön, auch wenn er mir heute nichts nützt.');
    await w.say('e2-baris', r.baris, { mood: 'smirk' });
    bg(baris.walkTo(HILL_SPOT.baris[0], HILL_SPOT.baris[1], { face: 'right' }));
    await w.wait(500);
    await w.think('Kyra steht da, ein paar Schritte neben dem Stein. So nah. Wenn ich nur die Hände …');
  });

  // Heart: Lia reaches for her sister. Kyra does not move.
  const gesture = G.ui.storyAction('reach', 'Nach Kyra greifen');
  restageGesture('reach', 'Streck die gefesselten Hände nach Kyra aus. Nur ein bisschen weiter.', REACH_PICTURE);
  await gesture;
  await w.cutscene(async () => {
    kyra.face('down');
    await w.wait(600);
    for (const l of ON_THE_STONE.kyra) await sayLine(w, l);
    kyra.face('left');
    // Vamir's speech: the camera turns to the men in front of the stone.
    await w.camera.pan([648, 400], 1200);
    for (const l of ON_THE_STONE.speech.slice(0, 2)) await sayLine(w, l);
    for (const [i, m] of MEN.entries()) w.bark(m.id, ['Ha!', 'Endlich!', 'Für den Meister!', 'Hoch!'][i], 1400);
    sfx('sword-draw', { volume: 0.35 });
    await w.wait(1200);
    for (const l of ON_THE_STONE.speech.slice(2)) await sayLine(w, l);
    await w.camera.pan([STONE_LIE[0], STONE_LIE[1] - 10], 1000);
    // The cloths come off; threads run to Lia; the sphere forms. Vamir's violet beside it.
    await sayLine(w, ON_THE_STONE.ritual[0]);
    bg(vamir.play('cast', { ms: 2400 }));
    await circle.unveil(2200);
    for (const l of ON_THE_STONE.ritual.slice(1, 3)) await sayLine(w, l);
    circle.violet(true);
    circle.setCharge(0.55, 2400);
    sfx('urmacht', { volume: 0.5 });
    w.camera.shake(400, 0.003);
    await w.wait(1400);
    await ui().plate('e3-ritual', { caption: 'Das Ritual', pan: 'in', durationMs: 10000 });
    for (const l of ON_THE_STONE.ritual.slice(3)) await sayLine(w, l);
    await w.think('Ich hab sie nie gewollt, diese Macht. Aber ihm gebe ich sie nicht. Nicht so, nicht festgebunden auf einem Stein.');
    await ui().closePlate();
    circle.setCharge(0.75, 3000);
    await w.wait(1200);
  });
  release();
  G.state.set(F.liaSeen);
  await ui().fade('out', 1400);
  await nextScene('e3-ritual', { part: 'flick' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: below the hill (Flick)
// ---------------------------------------------------------------------------------------------------------------

/** Mutable handles of the current visit (progress itself lives in G.state). */
let posts: Partial<Record<PostId, ActorHandle>> = {};
let friends: ActorHandle[] = [];

/** A guard stays a dark shape in the dusk until Flick makes him out (restyled every frame until then). */
function silhouette(w: WorldCtx, id: PostId, a: ActorHandle): void {
  let restored = false;
  const onPost = () => {
    const s = a.exists ? a.sprite : undefined;
    if (!s) return;
    if (!G.state.is(F.spotted(id))) { s.setTint(0x151522); s.setAlpha(0.55); return; }
    if (!restored) { restored = true; s.clearTint(); s.setAlpha(1); w.scene.events.off('postupdate', onPost); }
  };
  w.scene.events.on('postupdate', onPost);
  w.scene.events.once('shutdown', () => w.scene.events.off('postupdate', onPost));
}

/** Spotting loop: while Flick holds the Spurenblick, every guard within sight range lifts out of the dusk. */
async function spotLoop(w: WorldCtx): Promise<void> {
  while (w.alive && shownCount() < POST_IDS.length) {
    await w.wait(150);
    if (G.ui.busy()) continue;
    for (const id of POST_IDS) {
      if (G.state.is(F.spotted(id))) continue;
      if (!canSpot([w.player.x, w.player.y], POSTS[id].at, w.lookMode.active)) continue;
      G.state.set(F.spotted(id));
      sfx('discover', { volume: 0.5 });
      w.fx.burst(POSTS[id].at, 'sparkle', 6);
      w.bark('player', ['Da. Einer.', 'Noch einer.', 'Und der Dritte.'][POST_IDS.filter(p => G.state.is(F.spotted(p))).length - 1] ?? 'Da.', 1500);
      w.setObjectiveTarget(POSTS[id].at);
    }
  }
}

async function showPost(w: WorldCtx, id: PostId): Promise<void> {
  if (G.state.is(F.shown(id))) return;
  const p = POSTS[id];
  await w.cutscene(async () => {
    w.player.face(p.at as [number, number]);
    bg(w.player.play('interact', { once: true }));
    await w.say('e2-flick', p.flick);
    await w.say(id === 'hang' ? 'e3-paladin' : 'e2-ignatius', p.answer);
  });
  G.state.set(F.shown(id));
  const n = shownCount();
  w.setObjective('e3-ri-posten', postObjective(n), POST_IDS.find(q => G.state.is(F.spotted(q)) && !G.state.is(F.shown(q))) ?? null);
}

async function considerAscent(w: WorldCtx, a: AscentDef): Promise<void> {
  if (G.state.is(F.chosen)) return;
  await w.cutscene(async () => {
    await w.say('e2-ignatius', a.judgement, { mood: 'thinking' });
  });
  const pick = await w.choose([`„${a.decision}“`, 'Noch einen anderen Weg ansehen'], { speaker: 'e2-flick' });
  if (pick !== 0) return;
  G.state.set(RITUAL_WAY_FLAG, a.weg);
  G.state.set(F.chosen);
}

async function anstiegScript(w: WorldCtx): Promise<void> {
  for (const id of POST_IDS) { G.state.set(F.spotted(id), false); G.state.set(F.shown(id), false); }
  G.state.set(F.chosen, false);
  w.lockPlayer();
  const hill = stageHill(w, { veiled: false, men: false });
  hill.circle.setCharge(0.75, 0);
  hill.circle.violet(true);
  hill.vamir.setIdle('cast');
  const bound = w.spawn({ id: 'lia', preset: liaLook({ bound: true }), at: STONE_LIE, dir: 'down', idle: 'lie', solid: false, facePlayer: false });
  bound.hold(true);
  posts = {};
  for (const id of POST_IDS) {
    const p = POSTS[id];
    const a = w.spawn({ id: `posten-${id}-figur`, preset: p.preset, speaker: 'dunkelschatten', at: p.at, dir: p.dir, solid: false, facePlayer: false });
    a.hold(true);
    if (id === 'fackel') a.setIdle('sit');
    silhouette(w, id, a);
    posts[id] = a;
  }
  friends = [
    w.spawn({ id: 'ignatius', preset: 'e2-ignatius', speaker: 'e2-ignatius', at: HILL_SPOT.ignatius, dir: 'up', solid: false, facePlayer: false, speed: 40 }),
    w.spawn({ id: 'paladin-1', preset: 'paladin', speaker: 'e3-paladin', at: HILL_SPOT.paladin1, dir: 'up', solid: false, facePlayer: false, speed: 40 }),
    w.spawn({ id: 'paladin-2', preset: 'paladin', speaker: 'e3-paladin', at: HILL_SPOT.paladin2, dir: 'up', solid: false, facePlayer: false, speed: 40 }),
  ];
  for (const f of friends) f.hold(true);
  await ui().fade('in', 1000);
  await w.cutscene(async () => {
    await w.camera.pan([560, 380], 1400);
    await w.wait(500);
    for (const l of APPROACH.arrive.slice(0, 2)) await sayLine(w, l);
    await w.camera.pan([w.player.x, w.player.y], 1000);
    for (const l of APPROACH.arrive.slice(2)) await sayLine(w, l);
    await w.say('narrator', `Halte ${w.controlHint('look')} gedrückt: Im Spurenblick heben sich Wachen in Sichtweite aus der Dämmerung.`);
  });
  w.camera.follow();
  w.setObjective('e3-ri-posten', postObjective(0), null);
  w.unlockPlayer();
  bg(spotLoop(w));
  await until(w, () => shownCount() >= POST_IDS.length && !G.ui.busy(), 150);
  w.completeObjective('e3-ri-posten');

  // The others come up behind her; then the way up.
  await w.cutscene(async () => {
    const spots: [number, number][] = [[178, 600], [222, 626], [140, 640]];
    await Promise.all(friends.map((f, i) => f.walkTo(spots[i][0], spots[i][1], { face: 'up' })));
    for (const l of APPROACH.allShown) await sayLine(w, l);
  });
  w.setObjective('e3-ri-weg', 'Such Flicks Weg hinauf: Hohlweg, Felsen oder offen über den Hang.', null);
  await until(w, () => G.state.is(F.chosen) && !G.ui.busy(), 150);
  w.completeObjective('e3-ri-weg');
  await firstArrow(w, hill);
}

/** Close-up for drawing the bow: Flick at the edge of the bushes, the hill above. */
const BOW_PICTURE = (at: readonly [number, number]): GesturePicture => ({
  background: 'e3-ritualhuegel',
  focus: [at[0] + 10, at[1] - 24],
  zoom: 3,
  figures: [{ id: 'flick', pose: 'shoot', at, facing: 'up' }],
  glint: [at[0] + 8, at[1] - 30],
});

async function firstArrow(w: WorldCtx, hill: Hill): Promise<void> {
  const weg = ASCENTS.find(a => a.weg === G.state.flag<string>(RITUAL_WAY_FLAG)) ?? ASCENTS[0];
  await w.cutscene(async () => {
    await w.say('e2-flick', weg.decision, { mood: 'determined' });
    await w.say('e2-ignatius', 'Dann los. Wir sind direkt hinter dir.', { mood: 'determined' });
    w.player.face(POSTS.hang.at as [number, number]);
  });
  const gesture = G.ui.storyAction('lift', 'Den Bogen spannen');
  restageGesture('lift', 'Zieh die Sehne bis ans Ohr. Ganz ruhig. Der mit dem Speer zuerst.', BOW_PICTURE(weg.at));
  await gesture;
  await w.cutscene(async () => {
    bg(w.player.play('shoot', { once: true }));
    sfx('bow', { volume: 0.7 });
    await w.wait(380);
    sfx('arrow-hit', { volume: 0.6 });
    const spear = posts.hang;
    if (spear) { bg(spear.play('fall')); spear.setIdle('fall'); }
    w.camera.punch(0.04);
    await w.camera.pan([600, 380], 900);
    hill.baris.face('down');
    for (const l of APPROACH.arrow) await sayLine(w, l);
    sfx('sword-draw', { volume: 0.6 });
    for (const f of friends) bg(f.walkTo(weg.at[0], weg.at[1] - 30, { run: true }));
    w.bark('paladin-1', 'Für Trapas!', 1400);
    await w.wait(1200);
  });
  G.state.set(RITUAL_STARTED);
  await ui().fade('out', 900);
  await nextScene('e3-ritualangriff');
}

export const scene = e3Scene('e3-ritual', 'Das Ritual', async params => {
  await ui().fade('out', 0);
  if (params?.part === 'flick' && G.state.is(F.liaSeen)) {
    await interlude('Unterdessen, am Waldrand unterhalb des Hügels …');
    await startWorld({ map: anstieg, spawn: 'waldrand', player: 'flick', companions: [], fadeIn: false, script: anstiegScript });
    return;
  }
  await G.ui.narrate(['Am Abend, auf einem kahlen Hügel.'], { style: 'card' });
  await startWorld({ map: huegel, spawn: 'stein', player: liaLook({ bound: true }), companions: [], fadeIn: false, script: steinScript });
});

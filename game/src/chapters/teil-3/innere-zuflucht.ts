// Scene „e3-innere-zuflucht“ – Die innere Zuflucht (docs/teil-3/umsetzung.md §3, F3 30:56–33:28). Two checkpointed
// parts (G.goto with { part }, a reload restarts the current part):
//  1. default, e3-innenwelt: Lia, caged and poisoned outside, wakes inside herself – a summer meadow with an oak, an
//     island in fog (look e3-lia-innen, barefoot in white). Framed as consciousness, not as a place: breathing fog at
//     the screen edges, dense fog over most of the meadow, no music but a slow muffled heartbeat, no place-name toast,
//     no objective marker (text only). Heart: three bright places in the fog are memories from book one (the Alana
//     book under the oak, Kyra with firewood, mother teaching her to read). Each one shows a pale remembered figure, then
//     the painted memory (plate e3-erinnerung-*, Lia's spirit watching at its edge) under a few lines; its fog lifts and
//     the meadow grows. After the first and the second memory, muffled voices of
//     Vamir's men at the cage drift in (outsideVoices, no picture). When the meadow is whole she sits under the oak.
//  2. 'lager' (only with e3-zf-erinnert): framed „Unterdessen …“ cut in the false camp at dusk, player knowledge only.
//     Vamir before his men (a great victory, praise for Kyra, who answers devoted). Flick, who tracked them, breaks out
//     of the bushes and runs for the cage; Vamir turns her to stone mid-run (plate e3-flick-versteinert). Baris wants to
//     smash the statue, Vamir: let her listen; the spell breaks at night, then the wolves may have her. Baris taunts
//     her (and lets slip that the paladins of Trapas are searching their guest room). „Spannt an.“
//     Sets e3-zuflucht-1. → e3-flicks-hilfe.
import type { SfxLoop } from '../../audio/api';
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { pinPlayer } from '../teil-2/gewoelbe';
import { CAMP_BLOCKS, CAMP_OCCLUDERS, CAMP_SPOT, CAMP_SURFACES, CAMP_WALK } from './falle-lager';
import {
  AFTER_VOICES, CAMP_CUT, type CampLine, INNER_BLOCKS, INNER_OCCLUDERS, INNER_SPOT, INNER_WALK, MEMORIES, MEMORY_IDS,
  type MemoryId, type MemoryLine, memoryObjective, OUTSIDE_VOICES, UNDER_THE_OAK,
} from './innere-zuflucht-welt';
import { innerFog, type InnerFog, outsideVoices, rememberedFigure } from './innere-zuflucht-nebel';
import { bg, e3Scene, interlude, nextScene, sfx, ui, until } from './shared';
import { petrify } from './versteinerung';

/** Flags of this visit (reset when a part starts) and the checkpoint flag between the parts. */
const F = { mem: (id: MemoryId) => `e3-zf-erinnerung-${id}`, seated: 'e3-zf-sitzt', remembered: 'e3-zf-erinnert' } as const;

const remembered = (): number => MEMORY_IDS.filter(id => G.state.is(F.mem(id))).length;

/** Lia inside herself: the plain portrait (no travel cloak). */
const liaInner = (w: WorldCtx, text: string, mood?: string) => w.say('e3-lia', text, { portrait: 'lia', mood });

async function sayLine(w: WorldCtx, l: MemoryLine): Promise<void> {
  if (l.who === 'think') return w.think(l.text);
  if (l.who === 'lia') return liaInner(w, l.text, l.mood);
  return w.say(l.who, l.text, l.mood ? { mood: l.mood } : undefined);
}

// ---------------------------------------------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------------------------------------------

export const innenwelt: MapDef = defineMap({
  id: 'e3-innenwelt',
  background: 'e3-innenwelt',
  walk: INNER_WALK,
  block: INNER_BLOCKS,
  occluders: INNER_OCCLUDERS,
  surface: 'grass',
  interactables: [
    ...MEMORY_IDS.map(id => ({
      id: `erinnerung-${id}`, at: MEMORIES[id].at, verb: MEMORIES[id].verb, radius: 26, standAt: MEMORIES[id].stand, once: false,
      sparkle: true, when: () => !G.state.is(F.mem(id)), onInteract: (w: WorldCtx) => remember(w, id),
    })),
    {
      id: 'eiche', at: INNER_SPOT.oakSeat, verb: 'Unter der Eiche hinsetzen', radius: 24, standAt: INNER_SPOT.oakSeat, face: 'down' as const,
      once: false, sparkle: true, when: () => remembered() >= MEMORY_IDS.length && !G.state.is(F.seated),
      onInteract: () => { G.state.set(F.seated); },
    },
  ],
  spawns: { start: { at: INNER_SPOT.start, dir: 'down' } },
  time: 'day',
  ambience: ['wind'],
  ambienceVolume: { wind: 0.22 },
  music: null,
  lookMode: false,
  sneak: false,
  critters: false,
  resetOnEnter: true,
});

/** The false camp at dusk, Vamir's men round the fire (the cut). */
export const lagerSieg: MapDef = defineMap({
  id: 'e3-falsches-lager-sieg',
  name: 'Das Lager am Abend',
  background: 'e3-falsches-lager',
  walk: CAMP_WALK,
  block: CAMP_BLOCKS,
  occluders: CAMP_OCCLUDERS,
  surfaces: CAMP_SURFACES,
  surface: 'dirt',
  lights: [{ id: 'lagerfeuer', at: [625, 350], kind: 'fire', radius: 190, intensity: 1.3, always: true, flame: true }],
  spawns: { feuer: { at: CAMP_SPOT.vamirFire, dir: 'up' } },
  time: 'dusk',
  ambience: ['fire', 'camp', 'wind'],
  ambienceVolume: { fire: 0.7, camp: 0.6, wind: 0.3 },
  music: 'dread',
  lookMode: false,
  sneak: false,
  critters: false,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Part 1: the meadow inside
// ---------------------------------------------------------------------------------------------------------------

/** Mutable effects of the current visit (progress itself lives in G.state). */
let fog: InnerFog | null = null;
let heart: SfxLoop | null = null;

function startHeartbeat(w: WorldCtx): void {
  try { heart = G.audio.loop('heartbeat', { interval: 1.25, volume: 0.28, distance: 0.6 }); } catch { heart = null; }
  w.scene.events.once('shutdown', () => { heart?.stop(600); heart = null; });
}

async function remember(w: WorldCtx, id: MemoryId): Promise<void> {
  if (G.state.is(F.mem(id))) return;
  const m = MEMORIES[id];
  fog?.glow(id, false);
  await w.cutscene(async () => {
    w.player.face(m.at as [number, number]);
    sfx('memory', { volume: 0.5 });
    // The fog over this part of the meadow lifts first; then the memory takes shape inside it.
    await (fog?.lift(id, 1600) ?? Promise.resolve());
    for (const [i, p] of m.props.entries()) w.addProp({ prop: p.prop, at: p.at, id: `e3-zf-${id}-${i}`, collide: false });
    let figure: { fadeOut(ms?: number): Promise<void> } | null = null;
    if (m.figure) {
      const a = w.spawn({ id: `e3-zf-${id}`, preset: m.figure.preset, at: m.figure.at, dir: m.figure.facing, solid: false, facePlayer: false });
      a.hold(true);
      if (m.figure.pose !== 'idle') a.setIdle(m.figure.pose as never);
      figure = rememberedFigure(w, a);
    }
    await w.wait(800);
    // The memory itself, painted: Lia's white spirit stands at its edge and watches.
    const plate = G.art.hasAsset('plate', m.plate.id);
    if (plate) await G.ui.plate(m.plate.id, { caption: m.plate.caption, pan: 'in', durationMs: 24000 });
    for (const l of m.lines) await sayLine(w, l);
    if (plate) await G.ui.closePlate();
    if (figure) await figure.fadeOut(1400);
  });
  G.state.set(F.mem(id));
  const n = remembered();
  w.setObjective('e3-zf-erinnern', memoryObjective(n), null);
  if (n > OUTSIDE_VOICES.length) return;
  // The world outside presses in for a moment: the edges close, the heart beats faster, voices without a picture.
  w.lockPlayer();
  fog?.press(true);
  heart?.set({ interval: 0.8, volume: 0.4 });
  await outsideVoices(OUTSIDE_VOICES[n - 1]);
  fog?.press(false);
  heart?.set({ interval: 1.25, volume: 0.28 });
  await w.think(AFTER_VOICES[n - 1]);
  w.unlockPlayer();
}

async function innenScript(w: WorldCtx): Promise<void> {
  for (const id of MEMORY_IDS) G.state.set(F.mem(id), false);
  G.state.set(F.seated, false);
  w.lockPlayer();
  w.player.setSpeed(40);
  fog = innerFog(w, MEMORY_IDS.map(id => ({ id, ...MEMORIES[id].fog })), Object.fromEntries(MEMORY_IDS.map(id => [id, MEMORIES[id].at])));
  startHeartbeat(w);
  await ui().fade('in', 2200);
  await w.cutscene(async () => {
    await w.wait(600);
    await w.think('Kein Käfig. Keine Stricke. Gras unter den Füßen, warm von der Sonne.');
    await w.think('Die Wiese hinter dem Hof. Nur dass sie hier mitten in den Wolken schwimmt, und das tut sie zu Hause nicht.');
    await liaInner(w, 'Bin ich tot? Nein. Dafür kitzelt das Gras zu sehr.', 'thinking');
    await w.think('Ich spüre das Gift nicht mehr. Und auch nicht, was draußen mit mir passiert. Das hier ist drinnen. In mir.');
    for (const id of MEMORY_IDS) fog?.glow(id, true);
    await w.wait(700);
    await w.think('Im Nebel leuchtet etwas. Drei Stellen, hell wie Kerzen hinter Papier.');
  });
  w.setObjective('e3-zf-erinnern', memoryObjective(0), null);
  w.unlockPlayer();
  await until(w, () => remembered() >= MEMORY_IDS.length && !G.ui.busy(), 150);
  w.setObjective('e3-zf-erinnern', memoryObjective(MEMORY_IDS.length), null);
  try { G.audio.music('refuge', { fadeMs: 4000 }); } catch { /* audio optional */ }
  await until(w, () => G.state.is(F.seated) && !G.ui.busy(), 150);
  w.completeObjective('e3-zf-erinnern');
  await w.cutscene(async () => {
    w.player.setIdle('sit');
    heart?.set({ interval: 1.6, volume: 0.18 });
    await w.wait(800);
    for (const l of UNDER_THE_OAK) await sayLine(w, l);
  });
  G.state.set(F.remembered);
  await ui().fade('out', 2200);
  heart?.stop(800);
  await nextScene('e3-innere-zuflucht', { part: 'lager' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: far away – the camp at dusk (player knowledge)
// ---------------------------------------------------------------------------------------------------------------

const MEN: { id: string; preset: string }[] = [
  { id: 'mann-1', preset: 'shadow-sword' }, { id: 'mann-2', preset: 'shadow-spear' },
  { id: 'mann-3', preset: 'shadow-club' }, { id: 'mann-4', preset: 'shadow-crossbow' },
];

const sayCamp = (w: WorldCtx, l: CampLine) => w.say(l.who, l.text, l.mood ? { mood: l.mood } : undefined);

async function lagerScript(w: WorldCtx): Promise<void> {
  w.lockPlayer();
  const men = MEN.map((m, i) => {
    const at = CAMP_SPOT.menFire[i];
    const a = w.spawn({ id: m.id, preset: m.preset, speaker: 'dunkelschatten', at, dir: at[0] < 625 ? 'right' : 'left', solid: false, facePlayer: false });
    a.hold(true);
    return a;
  });
  const kyra = w.spawn({ id: 'kyra', preset: 'e2-kyra-gebannt', speaker: 'e2-kyra-gebannt', at: CAMP_SPOT.kyraEvening, dir: 'left', solid: false, facePlayer: false });
  kyra.hold(true);
  const baris = w.spawn({ id: 'baris', preset: 'baris-scarred', speaker: 'e2-baris', at: CAMP_SPOT.barisEvening, dir: 'left', solid: false, facePlayer: false, speed: 40 });
  baris.hold(true);
  const flick = w.spawn({ id: 'flick', preset: 'e2-flick-gefangen', speaker: 'e2-flick', at: CAMP_SPOT.flickHide, dir: 'up', solid: false, facePlayer: false, speed: 110 });
  flick.hold(true);
  flick.hide();
  const release = pinPlayer(w, 'idle', 'up');
  await w.camera.zoom(1.25, 0);
  await w.camera.pan([626, 410], 0);
  await ui().fade('in', 1000);
  await w.cutscene(async () => {
    await w.say('narrator', 'Unter der Plane auf dem Wagen liegt Lia und rührt sich nicht. Am Feuer wird gefeiert.');
    for (const l of CAMP_CUT.speech.slice(0, 2)) await sayCamp(w, l);
    sfx('sword-draw', { volume: 0.3 });
    men.forEach((m, i) => w.bark(m.id, ['Für den Meister!', 'Hoch!', 'Endlich!', 'Ha!'][i], 1500));
    await w.wait(1400);
    w.player.face('right');
    kyra.face('player');
    for (const l of CAMP_CUT.speech.slice(2)) await sayCamp(w, l);
    // Flick breaks out of the bushes and runs for the cage; Vamir does not even stand up.
    sfx('rustle', { volume: 0.6 });
    flick.show();
    await w.camera.pan([900, 470], 700);
    const run = flick.walkTo(CAMP_SPOT.flickStone[0], CAMP_SPOT.flickStone[1], { run: true, straight: true });
    await sayCamp(w, CAMP_CUT.rescue[0]);
    await run;
    baris.face('flick');
    men.forEach(m => m.face('flick'));
    await sayCamp(w, CAMP_CUT.rescue[1]);
    w.player.face('right');
    await sayCamp(w, CAMP_CUT.rescue[2]);
    await w.player.play('cast' as never, { ms: 600 });
    await petrify(w, w.player, flick);
    const plate = G.art.hasAsset('plate', 'e3-flick-versteinert');
    if (plate) await G.ui.plate('e3-flick-versteinert', { caption: 'Stein', pan: 'in', durationMs: 16000 });
    for (const l of CAMP_CUT.stone.slice(0, 2)) await sayCamp(w, l);
    if (plate) await G.ui.closePlate();
    // Baris in front of the statue.
    await baris.walkTo(CAMP_SPOT.barisAtStone[0], CAMP_SPOT.barisAtStone[1], { face: 'right' });
    for (const l of CAMP_CUT.stone.slice(2)) await sayCamp(w, l);
    for (const l of CAMP_CUT.parting.slice(0, 2)) await sayCamp(w, l);
    await w.think('Flick kann nicht antworten. Aber hinter dem Stein, irgendwo, hört sie jedes Wort.');
    bg(baris.walkTo(CAMP_SPOT.barisEvening[0], CAMP_SPOT.barisEvening[1]));
    await w.camera.pan([700, 400], 900);
    await sayCamp(w, CAMP_CUT.parting[2]);
    for (const m of men) bg(m.walkTo(1000, 410, { straight: true }));
    await w.wait(1200);
  });
  release();
  await ui().fade('out', 1400);
  G.state.set('e3-zuflucht-1');
  await nextScene('e3-flicks-hilfe');
}

export const scene = e3Scene('e3-innere-zuflucht', 'Die innere Zuflucht', async params => {
  await ui().fade('out', 0);
  if (params?.part === 'lager' && G.state.is(F.remembered)) {
    await interlude('Unterdessen, im Lager …');
    await startWorld({ map: lagerSieg, spawn: 'feuer', player: 'vamir', companions: [], fadeIn: false, script: lagerScript });
    return;
  }
  await startWorld({ map: innenwelt, spawn: 'start', player: 'e3-lia-innen', companions: [], fadeIn: false, script: innenScript });
});

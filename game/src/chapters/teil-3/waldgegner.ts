// Scene „e3-waldgegner“ – Rohes Fleisch (docs/teil-3/umsetzung.md §3, F3 23:37–24:51; quellenpruefung §1.8). A framed
// interlude Lia never learns about: „Unterdessen, ein paar Täler weiter …“. The player is Flick (e2-flick-gefangen,
// hands tied, standing at a stake), at dusk in the Leichenfresser camp (map e3-ghulwald on the reused background
// k5-faehrte). Three Leichenfresser squabble at the fire over a hare and over when their prisoner is due.
// Heart 1: Flick rubs the rope on a sharp stone at her feet with her left hand – storyAction('tend', 'Den Strick
// am Stein reiben') – but only while nobody looks over (the watch cycle in waldgegner-lager.ts, Flick's barks say who
// is watching). Between the two rubs the leader sends „Ratze“ to tighten her knot; a quarrel over the hare leg calls
// him back and he forgets it. Heart 2: the rope parts; she sneaks away from the fire down the trail (view cones,
// ferns as hiding places and checkpoints, spotted = back to the last fern, never game over) while Ratze fetches
// firewood along the same trail. At the fork she is out of sight; behind her the leader finds the empty stake and
// sends Ratze after her (heard, not seen). Sets e3-flick-ghule. → e3-vertraute-schwester.
// Only one checkpointed part: a reload restarts the interlude from the card.
import { G } from '../../core/G';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import { pinPlayer } from '../teil-2/gewoelbe';
import { type GesturePicture, restageGesture } from '../teil-2/gewoelbe-geste';
import {
  canRub, ESCAPE_ZONE, FERNS, FIRE, GHUL_BLOCKS, GHUL_GUARDS, GHUL_OCCLUDERS, GHUL_SPAWNS, GHUL_SPOT, GHUL_SURFACES, GHUL_WALK,
  RUBS_NEEDED, STONE_HOTSPOT, type Watcher, watcherAt,
} from './waldgegner-lager';
import { bg, e3Scene, interlude, nextScene, sfx, ui, until } from './shared';

/** Flags of this visit (reset when the scene starts). */
const F = { rubs: 'e3-wg-reiben', freed: 'e3-wg-frei', out: 'e3-wg-draussen', cp: 'e3-wg-checkpoint' } as const;

const GHOULS: Watcher[] = ['ghul-anfuehrer', 'ghul-lang', 'ratze'];
/** Phase-1 stand-ins at the fire (plain figures); the guards of the map take over when Flick is free. */
const SITTER = (id: Watcher) => `${id}-feuer`;
const HOME: Record<Watcher, readonly [number, number]> = { 'ghul-anfuehrer': GHUL_SPOT.leader, 'ghul-lang': GHUL_SPOT.long, ratze: GHUL_SPOT.ratze };
/** Facing towards the fire for each of them (looking away from Flick). */
const TO_FIRE: Record<Watcher, 'up' | 'right' | 'left'> = { 'ghul-anfuehrer': 'right', 'ghul-lang': 'right', ratze: 'up' };

/** Close-up for the rope gesture: Flick at the stake, the fire and a Leichenfresser beyond, the glint on the stone. */
const ROPE_PICTURE: GesturePicture = {
  background: 'k5-faehrte',
  focus: [1110, 180],
  zoom: 3,
  figures: [
    { id: 'ghoul', pose: 'idle', at: GHUL_SPOT.ratze, facing: 'up', dim: true },
    { id: 'e2-flick-gefangen', pose: 'idle', at: GHUL_SPOT.stake, facing: 'left' },
  ],
  glint: GHUL_SPOT.stone,
};

const flick = (w: WorldCtx, text: string, mood?: string) => w.say('e2-flick', text, mood ? { mood } : undefined);
const ghul = (w: WorldCtx, id: Watcher, text: string) => w.say(id === 'ratze' ? 'e3-ratze' : 'e3-ghul', text);

export const ghulwald: MapDef = defineMap({
  id: 'e3-ghulwald',
  name: 'Ein paar Täler weiter',
  background: 'k5-faehrte',
  walk: GHUL_WALK,
  block: GHUL_BLOCKS,
  occluders: GHUL_OCCLUDERS,
  surfaces: GHUL_SURFACES,
  surface: 'forest',
  guards: GHUL_GUARDS,
  hidingSpots: FERNS,
  props: [
    { prop: 'campfire', at: [FIRE[0], FIRE[1] + 6], id: 'feuer', collide: false },
    { prop: 'iso-stake-0', at: GHUL_SPOT.stakeProp, id: 'pflock', collide: false },
    { prop: 'stones-pile', at: GHUL_SPOT.stone, id: 'stein', collide: false },
  ],
  lights: [{ id: 'lagerfeuer', at: [FIRE[0], FIRE[1] - 4], kind: 'fire', radius: 170, intensity: 1.25, always: true, flame: true }],
  interactables: [
    { id: 'strick', verb: 'Den Strick am Stein reiben', poly: STONE_HOTSPOT, radius: 34, once: false, when: () => !G.state.is(F.freed), onInteract: rub },
  ],
  triggers: [
    ...FERNS.map(f => ({ id: `cp-${f.id}`, poly: f.poly, once: false, onEnter: () => { G.state.set(F.cp, f.id); } })),
    { id: 'entkommen', poly: ESCAPE_ZONE, once: false, when: () => G.state.is(F.freed), onEnter: () => { G.state.set(F.out); } },
  ],
  spawns: GHUL_SPAWNS,
  camera: { bounds: { x: 640, y: 0, w: 640, h: 560 } },
  time: 'dusk',
  ambience: ['wind', 'fire', 'crickets'],
  ambienceVolume: { wind: 0.4, fire: 0.6, crickets: 0.4 },
  music: 'dread',
  playerLight: 26,
  lookMode: false,
  critters: false,
  sneak: true,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Heart 1: the rope and the stone
// ---------------------------------------------------------------------------------------------------------------

/** Mutable state of the watch loop (only the current visit; progress itself lives in G.state). */
interface Watch { t: number; watcher: Watcher | null; paused: boolean }
const watch: Watch = { t: 0, watcher: null, paused: false };

/** Turns the sitters: the watcher looks over at Flick, the others into the fire. Flick's barks say who looks. */
async function watchLoop(w: WorldCtx): Promise<void> {
  const flickBarks: Record<Watcher, string> = {
    'ghul-anfuehrer': 'Der Dicke dreht sich um. Still.',
    'ghul-lang': 'Der Lange starrt rüber.',
    ratze: 'Ratze glotzt. Nicht bewegen.',
  };
  const ghoulBarks: Record<Watcher, string> = {
    'ghul-anfuehrer': 'Sitz still, Vorrat.',
    'ghul-lang': 'Na, Spitzohr? Auch Hunger?',
    ratze: 'Was guckst du so?',
  };
  let last: Watcher | null | undefined;
  while (w.alive && !G.state.is(F.freed)) {
    await w.wait(150);
    if (watch.paused || G.ui.busy()) continue;
    watch.t += 150;
    const now = watcherAt(watch.t);
    watch.watcher = now;
    if (now === last) continue;
    last = now;
    for (const id of GHOULS) {
      const a = w.actor(SITTER(id));
      if (!a.exists) continue;
      if (id === now) a.face('player'); else a.face(TO_FIRE[id]);
    }
    if (now) {
      w.bark(SITTER(now), ghoulBarks[now], 1800);
      w.bark('player', flickBarks[now], 1800);
    } else if (watch.t > 6000) {
      w.bark('player', 'Jetzt gucken alle ins Feuer.', 1600);
    }
  }
}

async function rub(w: WorldCtx): Promise<void> {
  const rubs = Number(G.state.flag(F.rubs) ?? 0);
  if (!canRub(watch.watcher, rubs)) {
    if (rubs < RUBS_NEEDED) await flick(w, 'Nicht jetzt. Der guckt genau her.', 'scared');
    return;
  }
  watch.paused = true;
  try {
    const gesture = G.ui.storyAction('tend', 'Den Strick am Stein reiben');
    restageGesture('tend', 'Reib den Strick an der Kante, hin und her. Mit der linken Hand, die rechte taugt noch nichts.', ROPE_PICTURE);
    await gesture;
  } finally { watch.paused = false; }
  sfx('rustle', { volume: 0.25, pitch: 1.4 });
  G.state.set(F.rubs, rubs + 1);
  if (rubs + 1 === 1) await ratzeForgets(w);
}

/** Between the rubs: the leader sends Ratze over to tighten the knot; the hare leg wins. */
async function ratzeForgets(w: WorldCtx): Promise<void> {
  await flick(w, 'Ein paar Fasern. Mehr nicht. Aber Fasern sind ein Anfang.', 'determined');
  const r = w.actor(SITTER('ratze'));
  watch.paused = true;
  await w.cutscene(async () => {
    await ghul(w, 'ghul-anfuehrer', 'Ratze! Der Knoten an der Elfe sitzt locker. Zieh ihn nach.');
    await ghul(w, 'ratze', 'Warum immer ich? Ich hab den Hasen gefangen, ich hab das Feuer gemacht …');
    await ghul(w, 'ghul-anfuehrer', 'Weil du Ratze heißt. Los.');
    w.player.face('left');
    await r.walkTo(GHUL_SPOT.ratzeHalfway[0], GHUL_SPOT.ratzeHalfway[1], { face: 'right' });
    await w.wait(400);
    await w.think('Nicht hinsehen. Nicht auf den Stein sehen. Ich bin ein Sack. Ein trauriger, gefesselter Sack.');
    await ghul(w, 'ghul-lang', 'Dann ess ich so lange deine Keule, Ratze.');
    r.face('left');
    await ghul(w, 'ratze', 'Finger weg! Die ist meine!');
    await r.walkTo(HOME.ratze[0], HOME.ratze[1], { run: true, face: 'up' });
    w.bark(SITTER('ghul-lang'), 'Meins!', 1200);
    w.bark(SITTER('ratze'), 'Gib her!', 1200);
    await w.wait(1200);
    await flick(w, 'Und schon vergessen. Ratze, fast mag ich dich.', 'smirk');
  });
  watch.t = 0;
  watch.paused = false;
}

// ---------------------------------------------------------------------------------------------------------------
// Heart 2: away from the fire
// ---------------------------------------------------------------------------------------------------------------

function onCaught(w: WorldCtx): void {
  const lines = ['Zu hell. Noch mal, durch die Farne.', 'Flach wie ein Blatt, Flick. Noch mal.', 'Warten, bis Ratze vorbei ist. Dann.'];
  let n = 0;
  w.stealth.onSpotted(async g => {
    w.lockPlayer();
    w.bark(g.id, ['Da! Das Fleisch läuft weg!', 'Hey! Spitzohr!'][n % 2], 1300);
    await w.wait(700);
    await ui().fade('out', 450);
    w.stealth.resetGuards();
    const sp = GHUL_SPAWNS[G.state.flag<string>(F.cp) ?? 'pflock'] ?? GHUL_SPAWNS.pflock;
    w.player.teleport(sp.at, sp.dir);
    await w.camera.pan(sp.at, 0);
    w.camera.follow();
    await w.wait(200);
    await ui().fade('in', 450);
    w.unlockPlayer();
    await flick(w, lines[n++ % lines.length], 'scared');
  });
}

/** The sitters give way to the map's watchers at the same places. */
function startWatchers(w: WorldCtx): ActorHandle[] {
  for (const id of GHOULS) w.despawn(SITTER(id));
  const guards = GHOULS.map(id => w.actor(id));
  for (const g of guards) { g.show(); g.hold(false); }
  w.stealth.resetGuards();
  w.stealth.enable(true);
  return guards;
}

async function escape(w: WorldCtx): Promise<void> {
  w.setObjective('e3-wg-weg', 'Schleich dich vom Feuer weg, den Pfad hinunter. Duck dich in den Farn, wenn einer herschaut.', GHUL_SPOT.escape);
  await until(w, () => G.state.is(F.out) && !G.ui.busy(), 150);
  w.completeObjective('e3-wg-weg');
  w.stealth.enable(false);
  w.lockPlayer();
  await w.cutscene(async () => {
    // Behind her, at the fire (heard, the camera stays with Flick).
    sfx('suspicious', { volume: 0.4 });
    await ghul(w, 'ghul-anfuehrer', 'Wo ist … RATZE! Der Pflock ist leer!');
    await ghul(w, 'ratze', 'Ich wollt ja nachziehen! Ehrlich! Dann war da die Keule, und …');
    await ghul(w, 'ghul-anfuehrer', 'Lauf ihr nach. Und komm nicht ohne sie wieder, sonst steckst du morgen selbst am Spieß.');
    await ghul(w, 'ratze', 'Bin schon weg! Bin schon weg …');
    w.player.face('left');
    await flick(w, 'Lauf nur, Ratze. Im Weglaufen hab ich zwei Tage Vorsprung.', 'smirk');
    await flick(w, 'Und jetzt? Hilfe holen, hat Elnon gesagt. Oder die Leseratte finden. Irgendwer muss ja wissen, wo sie steckt.', 'determined');
  });
}

async function script(w: WorldCtx): Promise<void> {
  for (const f of [F.freed, F.out]) G.state.set(f, false);
  G.state.set(F.rubs, 0);
  G.state.set(F.cp, 'pflock');
  watch.t = 0; watch.watcher = null; watch.paused = false;
  w.stealth.enable(false);
  // The map's watchers wait out of sight; plain figures sit at the fire for the first part.
  for (const id of GHOULS) { const g = w.actor(id); g.hold(true); g.hide(); }
  for (const id of GHOULS) {
    const s = w.spawn({ id: SITTER(id), preset: 'ghoul', speaker: id === 'ratze' ? 'e3-ratze' : 'e3-ghul', at: HOME[id], dir: TO_FIRE[id], solid: false, facePlayer: false });
    s.hold(true);
  }
  const release = pinPlayer(w, 'idle', 'left');
  await w.camera.zoom(1.25, 0);
  await w.camera.pan([FIRE[0] + 20, FIRE[1] + 30], 0);
  await ui().fade('in', 1000);
  await w.cutscene(async () => {
    await ghul(w, 'ghul-lang', 'Die Keule ist meine. Ich hab den Hasen gerochen, also ist die Keule meine.');
    await ghul(w, 'ratze', 'Gerochen! Gefangen hab ich ihn. Mit bloßen Händen!');
    await ghul(w, 'ghul-anfuehrer', 'Ruhe. Wer noch einmal schmatzt, bevor ich satt bin, schläft heute im Bach.');
    await ghul(w, 'ghul-lang', 'Und die da am Pflock? Wann ist die dran?');
    await ghul(w, 'ghul-anfuehrer', 'Morgen. Die hält sich. Steht ja schön still.');
    await w.camera.pan([GHUL_SPOT.stake[0] - 30, GHUL_SPOT.stake[1]], 900);
    await flick(w, 'Wie schmeichelhaft. Ich bin ein Vorrat.', 'smirk');
    await flick(w, 'Zwei Tage frei. Zwei. Dann ein Netz zwischen zwei Buchen, und jetzt höre ich zu, wie die mich einteilen.', 'angry');
    await flick(w, 'Die rechte Hand taugt noch immer nichts. Aber vor meinen Füßen liegt ein Stein mit Kante. Für einen Strick reicht die linke.', 'determined');
    await w.camera.zoom(1, 600);
    w.camera.follow();
  });
  bg(watchLoop(w));
  w.setObjective('e3-wg-strick', 'Reib den Strick am Stein, aber nur, wenn keiner herschaut.', 'strick');
  await until(w, () => Number(G.state.flag(F.rubs) ?? 0) >= RUBS_NEEDED && !G.ui.busy(), 150);
  w.completeObjective('e3-wg-strick');
  G.state.set(F.freed);
  await w.cutscene(async () => {
    sfx('rope-cut', { volume: 0.35 });
    await flick(w, 'Ab. Ganz leise ab.', 'happy');
    release();
    w.player.setIdle('idle');
    await ghul(w, 'ghul-anfuehrer', 'Ratze, Holz! Das Feuer frisst schneller als du.');
    await ghul(w, 'ratze', 'Immer ich.');
    await flick(w, 'Raus hier. Weg vom Feuer, rein ins Dunkle. Und nicht über die eigenen Füße fallen.', 'determined');
    await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt: Geduckt im Farn sieht dich keiner.`);
  });
  startWatchers(w);
  onCaught(w);
  await escape(w);
  await ui().fade('out', 1400);
  G.state.set('e3-flick-ghule');
  await nextScene('e3-vertraute-schwester');
}

export const scene = e3Scene('e3-waldgegner', 'Rohes Fleisch', async () => {
  await interlude('Unterdessen, ein paar Täler weiter …');
  await startWorld({ map: ghulwald, spawn: 'pflock', player: 'e2-flick-gefangen', companions: [], fadeIn: false, script });
});

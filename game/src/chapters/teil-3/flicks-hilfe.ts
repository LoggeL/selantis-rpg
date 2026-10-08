// Scene „e3-flicks-hilfe“ – Flicks Nachricht (docs/teil-3/umsetzung.md §3, F3 32:16–34:49). Flick's interlude, two
// checkpointed parts (G.goto with { part }, a reload restarts the current part):
//  1. default, e3-falsches-lager-nacht: „Unterdessen, im verlassenen Lager …“. The player is Flick (e2-flick-gefangen),
//     tied to the post; the wagon with Lia is gone, the fire is down to embers, wolves howl. Heart: she twists her
//     hands in the rope – storyAction('tend') three times at the post – while eyes gather at the edge of the light
//     (only eyes and sounds, never a body). Free, she pulls a brand from the embers (a moving fire light; the eyes keep
//     their distance from it), reads the wagon's ruts with the Spurenblick (east), decides on Trapas (Baris let slip
//     that the paladins are looking for Lia) and backs down the path facing the dark, brand first, slowly.
//  2. 'saal' (only with e3-fh-frei): Trapas, the order's hall at night. Flick (look flick) is brought before the
//     Großmeister; Ignatius is there. Heart: two choices – how she answers his mistrust (spott / ehrlich / Ignatius
//     ansprechen, e3-flick-ton) and what she offers as proof (Striemen / Weg / Geduld, e3-flick-beweis). Ignatius vouches
//     for her; the order rides out. Ignatius fetches both staffs from the armoury and gives Lia's to Flick:
//     storyAction('reach', 'Den Stab nehmen'). e3-stab-ort = 'flick' (Lia's inventory is untouched – she does not have
//     it). Sets e3-flick-gemeldet and e3-orden-rueckt-aus. → e3-hoffnung-und-weigerung.
import type Phaser from 'phaser';
import { G } from '../../core/G';
import { defineMap, startWorld, type ActorHandle, type LightHandle, type MapDef, type WorldCtx } from '../../world';
import type { Dir } from '../../core/types';
import { pinPlayer } from '../teil-2/gewoelbe';
import { type GesturePicture, restageGesture } from '../teil-2/gewoelbe-geste';
import { CAMP_BLOCKS, CAMP_OCCLUDERS, CAMP_SURFACES, FIRE_RING } from './falle-lager';
import {
  FH_RESULT, type FlickTone, keepAway, NIGHT_CAMERA, NIGHT_SPOT, NIGHT_WALK, PATH_EXIT, PROOF_OPTIONS, ROPE_TURNS, type HallLine,
  TONE_OPTIONS, vouchLines, WOLF_LURK, WOLF_NEAR, WOLF_STAGES,
} from './flicks-hilfe-wege';
import { BEFORE_DAIS, HALL_BLOCKS, HALL_OCCLUDERS, HALL_SPOT, HALL_SURFACES, HALL_WALK, hallCandleLights } from './schutzreaktion-saal';
import { bg, e3Scene, interlude, nextScene, sfx, STAFF_PLACE_FLAG, ui, until } from './shared';

/** Flags of this visit (reset when a part starts) and the checkpoint flag between the parts. */
const F = {
  turns: 'e3-fh-drehungen', freed: 'e3-fh-haende-frei', brand: 'e3-fh-brand', ruts: 'e3-fh-spur', out: 'e3-fh-draussen',
  free: 'e3-fh-frei', atDais: 'e3-fh-podest',
} as const;

const flick = (w: WorldCtx, text: string, mood?: string) => w.say('e2-flick', text, mood ? { mood } : undefined);
const sayHall = (w: WorldCtx, l: HallLine) => w.say(l.who, l.text, l.mood ? { mood: l.mood } : undefined);

// ---------------------------------------------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------------------------------------------

export const lagerNacht: MapDef = defineMap({
  id: 'e3-falsches-lager-nacht',
  name: 'Das verlassene Lager',
  background: 'e3-falsches-lager',
  walk: NIGHT_WALK,
  block: CAMP_BLOCKS,
  occluders: CAMP_OCCLUDERS,
  surfaces: CAMP_SURFACES,
  surface: 'dirt',
  interactables: [
    {
      id: 'seil', at: NIGHT_SPOT.post, verb: 'Die Hände im Seil drehen', radius: 30, once: false,
      when: () => !G.state.is(F.freed), onInteract: twist,
    },
    {
      id: 'glut', verb: 'Einen Brand aus der Glut ziehen', poly: FIRE_RING, radius: 30, standAt: NIGHT_SPOT.brand, face: 'right', once: false,
      sparkle: true, when: () => G.state.is(F.freed) && !G.state.is(F.brand), onInteract: takeBrand,
    },
  ],
  clues: [{ id: 'spur-wagen', at: NIGHT_SPOT.ruts, kind: 'hoof', angle: 0, onInteract: readRuts }],
  triggers: [{ id: 'pfad', poly: PATH_EXIT, once: false, when: () => G.state.is(F.ruts), onEnter: () => { G.state.set(F.out); } }],
  lights: [
    { id: 'glut', at: [625, 356], kind: 'fire', radius: 70, intensity: 0.7, always: true, flame: 0.25 },
    { id: 'mond', at: [700, 120], kind: 'moon', radius: 300, intensity: 0.22 },
  ],
  spawns: { pfosten: { at: NIGHT_SPOT.post, dir: 'down' } },
  camera: { bounds: NIGHT_CAMERA },
  time: 'night',
  ambience: ['night', 'wind', 'crickets'],
  ambienceVolume: { wind: 0.5, crickets: 0.3 },
  music: null,
  playerLight: 34,
  lookMode: false,
  sneak: false,
  critters: false,
  resetOnEnter: true,
});

export const saalNacht: MapDef = defineMap({
  id: 'e3-ordenssaal-nacht',
  name: 'Der Saal des Lichterordens',
  background: 'e3-ordenssaal',
  walk: HALL_WALK,
  block: HALL_BLOCKS,
  occluders: HALL_OCCLUDERS,
  surfaces: HALL_SURFACES,
  surface: 'stone',
  triggers: [{ id: 'vor-podest', poly: BEFORE_DAIS }],
  lights: hallCandleLights(1),
  spawns: { tuer: { at: HALL_SPOT.door, dir: 'up' } },
  time: 'night',
  ambience: ['room'],
  ambienceVolume: { room: 0.7 },
  music: null,
  playerLight: 30,
  sneak: false,
  lookMode: false,
  critters: false,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Wolves: pairs of eyes at the edge of the light (overlay camera, so the night does not swallow them)
// ---------------------------------------------------------------------------------------------------------------

type WorldSceneLike = Phaser.Scene & { addOverlay?<T extends Phaser.GameObjects.GameObject>(o: T): T };

interface Wolves {
  readonly pos: [number, number][];
  /** Eyes 0..n-1 glide towards these targets (tied phase). */
  target: ([number, number] | null)[];
  /** After she is free: keep away from Flick, drift towards these spots. */
  follow: boolean;
  near: number;
  lurk: (i: number) => readonly [number, number];
}

const EYE = 0xffd27a;
const ADD = 1; // Phaser.BlendModes.ADD

function wolves(w: WorldCtx, n: number): Wolves {
  const scene = w.scene as WorldSceneLike;
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => (scene.addOverlay ? scene.addOverlay(o) : o);
  const eyes = Array.from({ length: n }, () => ({
    l: add(scene.add.image(0, 0, 'w-mote').setBlendMode(ADD).setTint(EYE).setDepth(4400).setScale(0.8).setAlpha(0)),
    r: add(scene.add.image(0, 0, 'w-mote').setBlendMode(ADD).setTint(EYE).setDepth(4400).setScale(0.8).setAlpha(0)),
    halo: add(scene.add.image(0, 0, 'w-glow').setBlendMode(ADD).setTint(EYE).setDepth(4399).setScale(0.22).setAlpha(0)),
    a: 0, blink: 0,
  }));
  const state: Wolves = {
    pos: WOLF_STAGES[WOLF_STAGES.length - 1].map(p => [p[0], p[1] + 80] as [number, number]).concat([[640, 700]]).slice(0, n),
    target: Array.from({ length: n }, () => null),
    follow: false,
    near: WOLF_NEAR.bare,
    lurk: i => WOLF_LURK[i % WOLF_LURK.length],
  };
  const onPost = (_t: number, delta: number) => {
    const dt = Math.min(0.1, delta / 1000);
    eyes.forEach((e, i) => {
      const p = state.pos[i];
      let show = 0;
      if (state.follow) {
        const np = keepAway(p, [w.player.x, w.player.y], state.lurk(i), state.near, 40 * dt);
        p[0] = np[0]; p[1] = np[1];
        show = 1;
      } else if (state.target[i]) {
        const t = state.target[i]!;
        p[0] += (t[0] - p[0]) * Math.min(1, dt * 0.8);
        p[1] += (t[1] - p[1]) * Math.min(1, dt * 0.8);
        show = 1;
      }
      e.blink -= dt;
      if (e.blink < -3 - i) e.blink = 0.18;
      const a = show * (e.blink > 0 ? 0.1 : 1);
      e.a += (a - e.a) * Math.min(1, dt * 5);
      e.l.setPosition(p[0] - 3, p[1] - 14).setAlpha(e.a);
      e.r.setPosition(p[0] + 3, p[1] - 14).setAlpha(e.a);
      e.halo.setPosition(p[0], p[1] - 14).setAlpha(0.35 * e.a);
    });
  };
  scene.events.on('postupdate', onPost);
  scene.events.once('shutdown', () => {
    scene.events.off('postupdate', onPost);
    for (const e of eyes) { e.l.destroy(); e.r.destroy(); e.halo.destroy(); }
  });
  return state;
}

function howl(volume = 0.5): void {
  sfx('bark-dog', { pitch: 0.5, distance: 0.9, volume });
}
function growl(): void {
  sfx('bark-dog', { pitch: 0.34, distance: 0.35, volume: 0.32 });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 1: the rope, the brand, the ruts, the path
// ---------------------------------------------------------------------------------------------------------------

/** Mutable state of the current visit (progress itself lives in G.state). */
let pack: Wolves | null = null;
let unpin: (() => void) | null = null;

const ROPE_PICTURE: GesturePicture = {
  background: 'e3-falsches-lager',
  focus: [915, 262],
  zoom: 3,
  figures: [{ id: 'e2-flick-gefangen', pose: 'idle', at: NIGHT_SPOT.post, facing: 'down' }],
  glint: [NIGHT_SPOT.post[0], NIGHT_SPOT.post[1] - 18],
};

const turns = (): number => Number(G.state.flag(F.turns) ?? 0);

async function twist(w: WorldCtx): Promise<void> {
  const n = turns();
  if (n >= ROPE_TURNS) return;
  const gesture = G.ui.storyAction('tend', 'Die Hände im Seil drehen');
  restageGesture('tend', 'Dreh die Handgelenke im Seil, hin und her. Die Fasern geben nach, ganz langsam.', ROPE_PICTURE);
  await gesture;
  sfx('rustle', { volume: 0.25, pitch: 1.3 });
  G.state.set(F.turns, n + 1);
  if (n + 1 >= ROPE_TURNS) return;
  // The eyes gather.
  const stage = WOLF_STAGES[n + 1];
  stage.forEach((p, i) => { if (pack) pack.target[i] = [p[0], p[1]]; });
  if (n + 1 === 1) {
    growl();
    await flick(w, 'Da. Unten am Pfad, im Gebüsch. Zwei Augen, gelb wie Butterblumen.', 'scared');
    await flick(w, 'Ganz ruhig, Flick. Wölfe fressen niemanden, der sie frech anstarrt. Glaub ich.', 'scared');
  } else {
    howl(0.6);
    await flick(w, 'Jetzt sind es mehr. Und sie kommen näher. Los, Seil. Du bist doch auch nur Gras.', 'angry');
  }
}

async function takeBrand(w: WorldCtx): Promise<void> {
  if (G.state.is(F.brand)) return;
  await w.player.play('crouch' as never, { ms: 700 });
  sfx('fire-ignite', { volume: 0.5 });
  G.state.set(F.brand);
  carryBrand(w);
  w.lighting.get('glut').set({ intensity: 0.3 });
  if (pack) pack.near = WOLF_NEAR.brand;
  w.bark('player', 'Kommt doch, ihr Flohsäcke.', 1600);
}

/** The brand: a small fire light with flames that goes where Flick goes. */
function carryBrand(w: WorldCtx): LightHandle {
  const light = w.lighting.add({ id: 'e3-fh-brand', at: [w.player.x + 8, w.player.y - 26], kind: 'fire', radius: 100, intensity: 1.15, always: true, flame: 0.45 });
  const tick = () => { if (w.alive) light.set({ at: [w.player.x + 8, w.player.y - 26] }); };
  w.scene.events.on('postupdate', tick);
  w.scene.events.once('shutdown', () => w.scene.events.off('postupdate', tick));
  return light;
}

async function readRuts(w: WorldCtx): Promise<void> {
  if (G.state.is(F.ruts)) return;
  await w.think('Rad an Rad, tief eingedrückt. Davor zwei Pferde, eins tritt hinten links kürzer. Ein schwerer Wagen. Nach Osten.');
  await flick(w, 'Nach Osten also. Und allein hol ich sie da nicht raus. Nicht gegen Vamir, nicht gegen zwanzig Mann.', 'determined');
  await flick(w, 'Trapas. Baris hat es selbst gesagt: Die Paladine suchen sie. Dann sollen sie auch was finden.', 'determined');
  G.state.set(F.ruts);
}

/**
 * The last stretch: Flick backs down the path with the brand held towards the dark – facing up, slower, no running.
 * Returns the release (also on shutdown).
 */
function backAway(w: WorldCtx, dir: Dir): () => void {
  const body = (w.scene as unknown as { player?: { walkSpeed: number; runSpeed: number } }).player;
  const saved = body ? { walk: body.walkSpeed, run: body.runSpeed } : null;
  if (body) { body.walkSpeed *= 0.55; body.runSpeed = body.walkSpeed; }
  const onUpdate = () => { if (w.alive && w.player.dir !== dir) w.player.face(dir); };
  w.scene.events.on('postupdate', onUpdate);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    w.scene.events.off('postupdate', onUpdate);
    if (body && saved) { body.walkSpeed = saved.walk; body.runSpeed = saved.run; }
  };
  w.scene.events.once('shutdown', release);
  return release;
}

async function nachtScript(w: WorldCtx): Promise<void> {
  for (const f of [F.freed, F.brand, F.ruts, F.out]) G.state.set(f, false);
  G.state.set(F.turns, 0);
  w.lockPlayer();
  w.lookMode.enable(false);
  pack = wolves(w, 3);
  unpin = pinPlayer(w, 'idle', 'down');
  await w.camera.zoom(1.2, 0);
  await w.camera.pan([NIGHT_SPOT.post[0] - 60, NIGHT_SPOT.post[1] + 20], 0);
  await ui().fade('in', 1200);
  await w.cutscene(async () => {
    howl(0.45);
    await w.wait(1200);
    await flick(w, 'Weg. Alle weg. Der Wagen, die Pferde, das Feuer bis auf die Glut. Und die Leseratte in ihrem Käfig.', 'sad');
    await flick(w, 'Und ich? Hänge an einem Pfosten, als Abendbrot für die Nachbarschaft.', 'smirk');
    howl(0.55);
    WOLF_STAGES[0].forEach((q, i) => { if (pack) pack.target[i] = [q[0], q[1]]; });
    await w.wait(900);
    await flick(w, 'Die Schelle sitzt fest. Aber das Seil darunter ist alt. Wenn ich die Hände drehe …', 'determined');
    await w.camera.zoom(1, 700);
    w.camera.follow();
  });
  w.setObjective('e3-fh-seil', 'Dreh die Hände im Seil, bis es nachgibt.', 'seil');
  w.unlockPlayer();
  await until(w, () => turns() >= ROPE_TURNS && !G.ui.busy(), 150);
  w.completeObjective('e3-fh-seil');
  G.state.set(F.freed);
  await w.cutscene(async () => {
    sfx('rope-cut', { volume: 0.35 });
    unpin?.(); unpin = null;
    w.player.setLook('flick');
    w.player.setIdle('idle');
    growl();
    await flick(w, 'Frei! Und jetzt Licht. Wölfe mögen kein Feuer, das weiß jedes Kind.', 'happy');
  });
  if (pack) { pack.follow = true; pack.near = WOLF_NEAR.bare; }
  w.setObjective('e3-fh-brand', 'Zieh einen brennenden Ast aus der Glut.', 'glut');
  await until(w, () => G.state.is(F.brand) && !G.ui.busy(), 150);
  w.completeObjective('e3-fh-brand');
  w.lookMode.enable(true);
  w.setObjective('e3-fh-spur', 'Wohin haben sie Lia gebracht? Lies die Spuren des Wagens.', null);
  await w.say('narrator', `Halte ${w.controlHint('look')} gedrückt: Flick liest Spuren, die andere nicht sehen.`);
  await until(w, () => G.state.is(F.ruts) && !G.ui.busy(), 150);
  w.completeObjective('e3-fh-spur');
  w.lookMode.enable(false);
  // Back down the path, the brand towards the dark; the eyes follow at the edge of the light.
  if (pack) {
    const p = pack;
    p.lurk = i => [w.player.x + (i - 1) * 70, w.player.y - 140];
  }
  howl(0.7);
  await flick(w, 'Und jetzt rückwärts. Das Feuer nach vorn, den Rücken zum Pfad. Wer rennt, ist Beute.', 'determined');
  const release = backAway(w, 'up');
  w.setObjective('e3-fh-pfad', 'Geh rückwärts den Pfad hinunter, den Brand vor dir.', NIGHT_SPOT.pathOut);
  bg((async () => {
    let n = 0;
    while (w.alive && !G.state.is(F.out)) {
      await w.wait(3400);
      if (G.state.is(F.out) || G.ui.busy()) continue;
      growl();
      if (n++ % 2 === 0) w.bark('player', ['Schön brav da oben.', 'Ich seh euch.', 'Noch ein Schritt …'][Math.floor(n / 2) % 3], 1500);
    }
  })());
  await until(w, () => G.state.is(F.out) && !G.ui.busy(), 150);
  w.completeObjective('e3-fh-pfad');
  release();
  await w.cutscene(async () => {
    await flick(w, 'Bleibt, wo ihr seid. Ich komme wieder, und dann bring ich mehr Feuer mit. Viel mehr.', 'determined');
    w.player.face('down');
    await w.player.walkTo(NIGHT_SPOT.pathOut[0], 718, { run: true });
  });
  G.state.set(F.free);
  await ui().fade('out', 1200);
  await nextScene('e3-flicks-hilfe', { part: 'saal' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: the hall at night
// ---------------------------------------------------------------------------------------------------------------

const GM = 'grossmeister';
const CAPTAIN = 'hauptmann';
const MENTOR = 'ignatius';

/** Close-up for the staff: Ignatius holds it out, Flick reaches for it. */
const STAFF_PICTURE: GesturePicture = {
  background: 'e3-ordenssaal',
  focus: [318, 200],
  zoom: 3,
  figures: [
    { id: 'e2-ignatius', pose: 'idle', at: [304, 214], facing: 'right' },
    { id: 'flick', pose: 'idle', at: [336, 212], facing: 'left' },
  ],
  glint: [320, 190],
};

function stageHall(w: WorldCtx): { gm: ActorHandle; captain: ActorHandle; mentor: ActorHandle } {
  const gm = w.spawn({ id: GM, preset: 'e3-grossmeister', speaker: 'e3-grossmeister', at: HALL_SPOT.chair, dir: 'down', idle: 'sit', solid: false, facePlayer: false });
  gm.hold(true);
  const captain = w.spawn({ id: CAPTAIN, preset: 'paladin', speaker: 'e3-hauptmann', at: [HALL_SPOT.door[0] + 26, HALL_SPOT.door[1] + 6], dir: 'up', solid: false, facePlayer: false });
  captain.hold(true);
  w.spawn({ id: 'pal-links', preset: 'paladin', speaker: 'e3-paladin', at: HALL_SPOT.sideLeft, dir: 'right', solid: false }).hold(true);
  w.spawn({ id: 'pal-rechts', preset: 'paladin', speaker: 'e3-paladin', at: HALL_SPOT.sideRight, dir: 'left', solid: false }).hold(true);
  const mentor = w.spawn({ id: MENTOR, preset: 'e2-ignatius', speaker: 'e2-ignatius', at: HALL_SPOT.table, dir: 'right', solid: false, facePlayer: false });
  mentor.hold(true);
  return { gm, captain, mentor };
}

async function saalScript(w: WorldCtx): Promise<void> {
  G.state.set(F.atDais, false);
  w.lockPlayer();
  const { gm, captain, mentor } = stageHall(w);
  await w.camera.pan([320, 250], 0);
  await ui().fade('in', 1000);
  await w.cutscene(async () => {
    await captain.walkTo(HALL_SPOT.captain[0], HALL_SPOT.captain[1] + 20, { face: 'up' });
    await w.say('e3-hauptmann', 'Großmeister. Am Tor stand eine Elfe und hat so lange gegen das Holz getreten, bis wir aufgemacht haben.');
    await w.say('e3-hauptmann', 'Sie sagt, es geht um das Mädchen. Das Mädchen, das uns vorletzte Nacht abhandengekommen ist.');
    await w.say('e3-grossmeister', 'Dann soll sie vortreten. Ignatius, Ihr bleibt. Ihr kennt die Gefährten des Mädchens besser als ich.', { mood: 'grim' });
    mentor.face('player');
  });
  w.setObjective('e3-fh-vortreten', 'Tritt vor den Großmeister.', [320, 196]);
  w.unlockPlayer();
  await w.waitForTrigger('vor-podest');
  G.state.set(F.atDais);
  await until(w, () => !G.ui.busy(), 120);
  w.completeObjective('e3-fh-vortreten');

  const tone = await w.cutscene(async (): Promise<FlickTone> => {
    await w.player.walkTo(HALL_SPOT.lia[0] + 10, HALL_SPOT.lia[1], { face: 'up' });
    bg(mentor.walkTo(HALL_SPOT.mentor[0] - 70, HALL_SPOT.mentor[1] - 10, { face: 'right' }));
    await w.camera.pan([320, 170], 700);
    await flick(w, 'Vamirs Leute haben Lia. In einem Lager im Wald, näher, als Ihr denkt. Kyra hat sie im Kreis geführt. Ich hab zugesehen.', 'determined');
    await flick(w, 'Mich hatten sie an einen Pfosten gebunden, damit ich auch alles gut sehe. Dann haben sie sie im Käfig weggefahren.', 'angry');
    mentor.face('player');
    await w.say('e2-ignatius', 'Im Käfig … Sie ist doch vor zwei Nächten fort, aus freien Stücken. Wie kam sie zu Vamirs Leuten?', { mood: 'worried' });
    await flick(w, 'Ihre Schwester hat sie hingebracht. Und sah dabei aus, als wäre sie gar nicht richtig da.', 'sad');
    await w.say('e2-ignatius', 'Kyra. Also hält er sie noch immer fest.', { mood: 'grim' });
    await w.say('e3-grossmeister', 'Und das soll ich einer Elfe glauben, die um Mitternacht an mein Tor tritt? Vielleicht schickt dich Vamir.', { mood: 'grim' });
    await w.say('e3-grossmeister', 'Damit meine Paladine in einen Wald reiten, in dem schon jemand auf sie wartet.', { mood: 'thinking' });
    const pick = await w.choose(TONE_OPTIONS.map(o => o.text), { prompt: 'Was sagt Flick?', speaker: 'e2-flick' });
    const t = TONE_OPTIONS[pick];
    for (const l of t.lines) await sayHall(w, l);
    G.state.set(FH_RESULT.tone, t.key);
    await w.say('e3-grossmeister', 'Meine Wachen standen vor einem leeren Zimmer, meine Reiter suchen seit zwei Tagen die falschen Wälder ab. Und jetzt dir folgen?', { mood: 'grim' });
    await w.say('e3-grossmeister', 'Hundert Mann in einen Wald, den mir eine Fremde zeigt. Gib mir einen Grund, der nicht nur aus Worten besteht.', { mood: 'thinking' });
    const proofPick = await w.choose(PROOF_OPTIONS.map(o => o.text), { prompt: 'Was zeigt Flick ihm?', speaker: 'e2-flick' });
    const p = PROOF_OPTIONS[proofPick];
    for (const l of p.lines) await sayHall(w, l);
    G.state.set(FH_RESULT.proof, p.key);
    return t.key;
  });

  await w.cutscene(async () => {
    await mentor.walkTo(HALL_SPOT.mentor[0] - 30, HALL_SPOT.mentor[1] - 6, { face: 'up' });
    for (const l of vouchLines(tone)) await sayHall(w, l);
    await w.wait(600);
    await w.say('e3-grossmeister', 'Ein Mädchen, das uns davongelaufen ist. Eine Elfe, die ich nicht kenne. Und ein Mann, dem ich nicht traue.', { mood: 'thinking' });
    await w.say('e3-grossmeister', 'Und trotzdem ist das mehr, als Vamir mir je gegeben hat.', { mood: 'determined' });
    gm.face('right');
    await w.say('e3-grossmeister', 'Hauptmann. Weckt die Männer. Pferde, Laternen, Schilde. Wir reiten, sobald der Letzte im Sattel sitzt.', { mood: 'determined' });
    await w.say('e3-hauptmann', 'Sofort, Großmeister.');
    bg(captain.walkTo(HALL_SPOT.door[0], HALL_SPOT.door[1] + 16));
    gm.face('down');
    await w.say('e3-grossmeister', 'Du reitest vorn, Elfe. Und wenn das eine Falle ist, bist du die Erste, die hineinläuft.', { mood: 'grim' });
    await flick(w, 'Damit kenn ich mich aus. Ich war heute schon in einer.', 'smirk');
    await w.say('e2-ignatius', 'Und die Stäbe, Großmeister. Sie hängen in Eurer Kammer und nützen dort niemandem.', { mood: 'determined' });
    await w.say('e3-grossmeister', 'Holt sie.', { mood: 'neutral' });
    await mentor.walkTo(HALL_SPOT.door[0] - 10, HALL_SPOT.door[1] + 10);
    mentor.hide();
    await w.wait(1500);
    sfx('door', { volume: 0.4 });
    mentor.show();
    await mentor.walkTo(HALL_SPOT.lia[0] - 6, HALL_SPOT.lia[1] + 8, { face: 'right' });
    w.player.face('left');
    await w.say('e2-ignatius', 'Meiner und ihrer. Den einen trage ich. Den anderen trägst du.', { mood: 'neutral' });
    await w.say('e2-ignatius', 'Zu Fuß bist du schneller als wir in Eisen. Bring ihn ihr. Von dir nimmt sie ihn lieber als von mir.', { mood: 'sad' });
  });

  // The handover: Flick takes Lia's staff.
  const gesture = G.ui.storyAction('reach', 'Den Stab nehmen');
  restageGesture('reach', 'Greif nach dem hellen Stab. Ignatius hält ihn dir hin.', STAFF_PICTURE);
  await gesture;
  // Where the staff is now (umsetzung.md §2): with Flick. Lia's inventory stays as it is; she does not have it.
  G.state.set(STAFF_PLACE_FLAG, 'flick');
  sfx('pickup', { volume: 0.4 });
  await w.cutscene(async () => {
    await flick(w, 'Leichter, als er aussieht. Und warm. Als hätte er die ganze Zeit auf sie gewartet.', 'surprised');
    await w.say('e2-ignatius', 'Das hat er. Sag ihr … nein. Sag ihr nichts von mir. Gib ihn ihr einfach.', { mood: 'sad' });
    await flick(w, 'Halt durch, Leseratte. Wir kommen. Diesmal mit Pferden.', 'determined');
    try { G.audio.music('flight', { fadeMs: 2000 }); } catch { /* audio optional */ }
    bg(w.player.walkTo(HALL_SPOT.door[0], HALL_SPOT.door[1] - 6, { run: true }));
    await w.wait(1400);
  });
  G.state.set('e3-flick-gemeldet');
  G.state.set('e3-orden-rueckt-aus');
  await ui().fade('out', 1300);
  await nextScene('e3-hoffnung-und-weigerung');
}

export const scene = e3Scene('e3-flicks-hilfe', 'Flicks Nachricht', async params => {
  await ui().fade('out', 0);
  if (params?.part === 'saal' && G.state.is(F.free)) {
    await interlude('Trapas, kurz vor Mitternacht …');
    await startWorld({ map: saalNacht, spawn: 'tuer', player: 'flick', companions: [], fadeIn: false, script: saalScript });
    return;
  }
  await interlude('Unterdessen, im verlassenen Lager …');
  await startWorld({ map: lagerNacht, spawn: 'pfosten', player: 'e2-flick-gefangen', companions: [], fadeIn: false, script: nachtScript });
});

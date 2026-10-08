// Scene „e3-falle“ – Die Falle (docs/teil-3/umsetzung.md §3, F3 29:09–30:20). The false rebel camp (map
// e3-falsches-lager), a grey morning: empty tents, a fire nobody tends, a wagon under a tarp. Lia is poisoned (slow walk,
// staggering, shared.liaGait); Kyra walks her up the path, goes to the fire and keeps calling her over.
// Heart: a short look round with the Spurenblick (Q): fresh boot prints with nailed soles, a black-and-white scrap on
// the palisade, and the cage wagon under the tarp (looked at directly). Each find makes Lia think it through a little
// further (falle-lager.ts FIND_THOUGHTS, any order), the count is kept in e3-falle-hinweise (0–3) and Kyra brushes
// every find aside. The third find, sitting down at the fire or talking to Kyra springs the trap: a short cut to the
// fire, Lia's last words depend on what she saw; Kyra calls the men; Baris and two henchmen seize her (plate e3-falle);
// Kyra answers flat and obedient (portrait e2-kyra-gebannt, the violet glint in her eyes); Vamir steps out of the
// smoke behind the fire. Lia refuses him. Lia reaches for Kyra's hand – Kyra steps back (and the signs she overlooked at the tea come back). Bound,
// dragged to the cage, black. Sets e3-gefangen. → e3-innere-zuflucht. A reload restarts at the bottom of the path.
import { G } from '../../core/G';
import { registerClues } from '../../core/catalog';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import {
  CAMP_BLOCKS, CAMP_HOTSPOT, CAMP_OCCLUDERS, CAMP_SPOT, CAMP_SURFACES, CAMP_WALK, FIND_THOUGHTS, FINDS, FINDS_FOR_TRAP,
  type FindId, findCount, KYRA_DEFLECT, KYRA_URGE, lastWords,
} from './falle-lager';
import { STAGGER_BARKS, STAGGER_EVERY_MS } from './vertraute-schwester-abend';
import { bloodHit, preloadBlood } from '../common/blood';
import { bg, e3Scene, lia, liaGait, liaLook, nextScene, poisoned, sfx, ui, until, VIOLET } from './shared';
import { TEA_REGRET, TEA_SIGNS_FLAG } from './vertraute-schwester-abend';

registerClues([
  {
    id: 'e3-falle-stiefel', title: 'Stiefel mit Nägeln',
    text: 'Im Lager der Rebellen: frische Abdrücke schwerer Stiefel, die Sohlen mit Nägeln beschlagen. Wer sich im Wald versteckt, läuft nicht so laut.',
  },
  {
    id: 'e3-falle-fetzen', title: 'Ein schwarz-weißer Fetzen',
    text: 'An der Palisade hing ein Stück Stoff, schwarz und weiß. Dieselben Farben wie an dem Abend, an dem sie zu unserem Hof kamen.',
  },
  {
    id: 'e3-falle-kaefig', title: 'Ein Käfig unter der Plane',
    text: 'Unter einer Plane stand ein Käfigwagen, das Schloss frisch gefettet. Wofür brauchen Rebellen einen Käfig?',
  },
]);

/** Result of this scene: how many of the three signs Lia found before the trap (0–3). */
export const FALLE_FINDS = 'e3-falle-hinweise';

/** Flags of this visit (reset when the scene starts). */
const F = { trap: 'e3-fa-zu', seen: (id: FindId) => `e3-fa-gesehen-${id}` } as const;

const KYRA = 'kyra';
const BARIS = 'baris';
const MAN_W = 'scherge-west';
const MAN_E = 'scherge-ost';
const VAMIR = 'vamir';

const kyra = (w: WorldCtx, text: string, mood?: string) => w.say('e3-kyra', text, mood ? { mood } : undefined);
/** Kyra under the spell, no longer hiding it: flat voice, violet portrait. */
const kyraCold = (w: WorldCtx, text: string, mood = 'cold') => w.say('e2-kyra-gebannt', text, { mood });
const baris = (w: WorldCtx, text: string) => w.say('e2-baris', text);
const vamir = (w: WorldCtx, text: string) => w.say('e2-vamir', text);

export const lager: MapDef = defineMap({
  id: 'e3-falsches-lager',
  name: 'Ein Lager im Wald',
  background: 'e3-falsches-lager',
  walk: CAMP_WALK,
  block: CAMP_BLOCKS,
  occluders: CAMP_OCCLUDERS,
  surfaces: CAMP_SURFACES,
  surface: 'dirt',
  clues: [
    { id: 'spur-stiefel', at: FINDS.stiefel.at, kind: 'footprint', angle: 200, clue: FINDS.stiefel.clue, onInteract: w => find(w, 'stiefel') },
    { id: 'spur-fetzen', at: FINDS.fetzen.at, kind: 'mark', clue: FINDS.fetzen.clue, onInteract: w => find(w, 'fetzen') },
  ],
  interactables: [
    {
      id: 'kaefig', verb: 'Unter die Plane sehen', poly: CAMP_HOTSPOT.wagon, radius: 30, standAt: CAMP_HOTSPOT.wagonStand, face: 'up',
      once: false, when: () => !G.state.is(F.seen('kaefig')) && !G.state.is(F.trap),
      onInteract: async w => { G.state.addClue(FINDS.kaefig.clue); await find(w, 'kaefig'); },
    },
    {
      id: 'zelt-nord', verb: 'Hineinsehen', poly: CAMP_HOTSPOT.tentNorth, radius: 26, standAt: CAMP_HOTSPOT.tentNorthStand, face: 'up', once: false,
      when: () => !G.state.is(F.trap),
      thought: 'Decken, ordentlich gefaltet, als hätte sie jemand gezählt. Keine einzige ist benutzt.',
    },
    {
      id: 'zelt-ost', verb: 'Hineinsehen', poly: CAMP_HOTSPOT.tentEast, radius: 26, standAt: CAMP_HOTSPOT.tentEastStand, face: 'up', once: false,
      when: () => !G.state.is(F.trap),
      thought: 'Leer. Kein Krümel, kein Löffel, kein Stiefel. Rebellen müssen doch auch irgendwann essen.',
    },
    {
      id: 'feuer', verb: 'Ans Feuer setzen', poly: CAMP_HOTSPOT.fire, radius: 30, standAt: CAMP_SPOT.liaFire, face: 'right', once: false,
      when: () => !G.state.is(F.trap), onInteract: () => { G.state.set(F.trap); },
    },
  ],
  lights: [{ id: 'lagerfeuer', at: [625, 352], kind: 'fire', radius: 120, intensity: 0.9, always: true, flame: 0.6 }],
  spawns: { pfad: { at: CAMP_SPOT.path, dir: 'up' } },
  time: 'day',
  ambience: ['wind', 'fire'],
  ambienceVolume: { wind: 0.5, fire: 0.35 },
  music: null,
  lookMode: true,
  critters: false,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Heart: looking round
// ---------------------------------------------------------------------------------------------------------------

async function find(w: WorldCtx, id: FindId): Promise<void> {
  if (G.state.is(F.seen(id)) || G.state.is(F.trap)) return;
  G.state.set(F.seen(id));
  const n = findCount(G.state.flag(FALLE_FINDS)) + 1;
  G.state.set(FALLE_FINDS, n);
  if (id === 'kaefig') sfx('rustle', { volume: 0.4, pitch: 0.8 });
  await w.think(FINDS[id].look);
  await w.think(FIND_THOUGHTS[n]);
  if (n >= FINDS_FOR_TRAP) { G.state.set(F.trap); return; }
  const k = w.actor(KYRA);
  k.face('player');
  await lia(w, n === 1 ? 'Kyra? Komm mal her und sieh dir das an.' : 'Kyra, das gefällt mir nicht. Gar nicht.', n === 1 ? 'thinking' : 'scared');
  await kyra(w, KYRA_DEFLECT[n - 1]);
}

/** Kyra stands at the fire and keeps calling Lia over while she looks round. */
async function kyraUrges(w: WorldCtx, k: ActorHandle): Promise<void> {
  let n = 0;
  while (w.alive && !G.state.is(F.trap)) {
    await w.wait(5600);
    if (G.state.is(F.trap) || G.ui.busy()) continue;
    if (Math.hypot(w.player.x - k.x, w.player.y - k.y) > 90) w.bark(KYRA, KYRA_URGE[n++ % KYRA_URGE.length], 1800);
  }
}

/** While poisoned and walking, Lia staggers now and then: a short stop, the hurt pose, a bark. */
async function staggerLoop(w: WorldCtx): Promise<void> {
  let walked = 0, n = 0, lx = w.player.x, ly = w.player.y;
  while (w.alive && !G.state.is(F.trap)) {
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

async function arrive(w: WorldCtx, k: ActorHandle): Promise<void> {
  await w.camera.pan([CAMP_SPOT.pathTop[0], CAMP_SPOT.pathTop[1] - 120], 0);
  await ui().fade('in', 1100);
  await w.cutscene(async () => {
    bg(k.walkTo(CAMP_SPOT.pathTop[0] + 26, CAMP_SPOT.pathTop[1] - 8, { face: 'up' }));
    await w.player.walkTo(CAMP_SPOT.pathTop[0], CAMP_SPOT.pathTop[1], { face: 'up' });
    await kyra(w, 'Da vorn. Das ist es.');
    await w.think('Drei Zelte, ein Feuer, ein Wagen unter einer Plane. Und kein einziger Mensch.');
    k.face('player');
    await lia(w, 'Wo sind denn alle? Ich dachte, hier wimmelt es von Rebellen.', 'thinking');
    await kyra(w, 'Auf Streife. Oder Holz holen. Die kommen bald. Setz dich ans Feuer, du bist ganz grau im Gesicht.');
    await lia(w, 'Danke. Genau so fühle ich mich auch.', 'hurt');
    await w.think('Ein Feuer, das keiner hütet. Mutter hätte jeden Einzelnen hier am Ohr gezogen.');
    w.camera.follow();
  });
}

// ---------------------------------------------------------------------------------------------------------------
// The trap
// ---------------------------------------------------------------------------------------------------------------

function hidden(w: WorldCtx, id: string, preset: string, speaker: string, at: readonly [number, number], dir: 'up' | 'down' | 'left' | 'right'): ActorHandle {
  const a = w.spawn({ id, preset, speaker, at, dir, solid: false, facePlayer: false, speed: 70 });
  a.hold(true);
  return a;
}

/** Vamir out of the smoke behind the fire: a puff, a cold violet glow, the figure fading in. */
async function vamirAppears(w: WorldCtx): Promise<ActorHandle> {
  const at = CAMP_SPOT.smoke;
  sfx('whoosh', { volume: 0.5, pitch: 0.6 });
  sfx('magic', { volume: 0.35, pitch: 0.5 });
  w.fx.burst([at[0], at[1] - 10], 'smoke', 14);
  w.fx.burst([at[0], at[1] - 24], 'smoke', 10);
  const glow = w.lighting.add({ id: 'e3-fa-vamir', at: [at[0], at[1] - 20], kind: 'plain', color: VIOLET, radius: 90, intensity: 0, always: true });
  bg(glow.fadeTo(1.1, 500));
  const v = w.spawn({ id: VAMIR, preset: 'vamir', speaker: 'e2-vamir', at, dir: 'down', solid: false, facePlayer: false });
  v.hold(true);
  if (v.sprite) { v.sprite.setAlpha(0); w.scene.tweens.add({ targets: v.sprite, alpha: 1, duration: 900 }); }
  await w.wait(1000);
  bg(glow.fadeTo(0.45, 1400));
  return v;
}

async function springTrap(w: WorldCtx, k: ActorHandle): Promise<void> {
  const finds = findCount(G.state.flag(FALLE_FINDS));
  w.lookMode.enable(false);
  w.completeObjective('e3-fa-lager');
  w.lockPlayer();
  ui().prefetchPlate('e3-falle');
  // A short cut: whatever Lia was doing, the next picture is the two of them at the fire.
  await ui().fade('out', 420);
  w.player.teleport(CAMP_SPOT.liaFire, 'right');
  k.teleport(CAMP_SPOT.kyraFire, 'left');
  await w.camera.pan([630, 392], 0);
  const b = hidden(w, BARIS, 'baris-scarred', 'e2-baris', CAMP_SPOT.barisHide, 'down');
  const mw = hidden(w, MAN_W, 'shadow-sword', 'dunkelschatten', CAMP_SPOT.manWestHide, 'up');
  const me = hidden(w, MAN_E, 'shadow-club', 'dunkelschatten', CAMP_SPOT.manEastHide, 'up');
  if (finds === 0) w.player.setIdle('sit');
  await ui().fade('in', 420);
  await w.cutscene(async () => {
    const last = lastWords(finds);
    await lia(w, last.text, last.mood);
    k.setIdle('idle');
    await kyra(w, 'Bleib, wo du bist.');
    await w.wait(300);
    // Kyra calls them. Her voice is someone else's now.
    k.face('down');
    await kyraCold(w, 'Sie ist da. Ihr könnt kommen.');
    sfx('rustle', { volume: 0.7 });
    sfx('sword-draw', { volume: 0.5 });
    w.player.setIdle('idle');
    bg(mw.walkTo(CAMP_SPOT.manWestTrap[0], CAMP_SPOT.manWestTrap[1], { run: true, straight: true, face: 'right' }));
    bg(me.walkTo(CAMP_SPOT.manEastTrap[0], CAMP_SPOT.manEastTrap[1], { run: true, straight: true, face: 'left' }));
    bg(b.walkPath([[792, 300], [748, 404], CAMP_SPOT.barisTrap], { straight: true }));
    await w.wait(900);
    w.player.face('left');
    // They seize her hard: a blow, not gore (umsetzung.md, Vorrang) – flash, shake, a few drops from a split lip.
    bloodHit(w, [w.player.x, w.player.y - 30], 0.4);
    sfx('hit-heavy', { volume: 0.7 });
    sfx('thud', { volume: 0.5 });
    await w.player.play('hurt' as never, { ms: 900 });
    await w.think('Ich will mich losreißen, aber meine Arme gehorchen nicht. Als wären sie aus nassem Brot.');
    await w.wait(500);
    b.face('player');
    await G.ui.plate('e3-falle', { caption: 'Die Falle', pan: 'in', durationMs: 16000 });
    await baris(w, 'Diesmal die Richtige. Ich hab zweimal hingesehen, mit dem Auge, das mir geblieben ist.');
    await lia(w, 'Kyra! Sag ihnen, sie sollen mich loslassen!', 'scared');
    await kyraCold(w, 'Nein.');
    await lia(w, 'Du hast mich hergebracht. Den ganzen Weg, Schritt für Schritt. Du hast es gewusst.', 'sad');
    await kyraCold(w, 'Der Meister wollte dich haben. Also habe ich dich gebracht.');
    await w.think('Ihre Augen. Darin glimmt etwas Violettes, wie Glut unter Asche. Das ist nicht Kyra. Nicht ganz.');
    await G.ui.closePlate();
    k.setLook('e2-kyra-gebannt');
    const v = await vamirAppears(w);
    await vamir(w, 'Sechzehn Jahre haben sie dich vor mir versteckt. Und am Ende bringt dich deine Schwester, zu Fuß und so schön müde.');
    w.player.face('up');
    await lia(w, 'Was immer du von mir willst: Du bekommst es nicht. Heute nicht und auch sonst nie.', 'angry');
    await vamir(w, 'Das sagen alle, solange sie noch stehen können. Und du stehst nicht mehr lange.');
    await vamir(w, 'Baris. In den Käfig mit ihr. Und lass die Plane drüber, ich will nicht, dass sie friert.');
    v.face('down');
    await baris(w, 'Wie Ihr wollt, Meister.');
    w.player.face('right');
  });
  // Her hand towards Kyra's. Kyra steps back, and what Lia overlooked at the fire comes back to her.
  await w.cutscene(async () => {
    await w.player.play('interact', { ms: 700 });
    await k.walkTo(CAMP_SPOT.kyraFire[0] + 30, CAMP_SPOT.kyraFire[1] + 6, { face: 'left' });
    await lia(w, 'Kyra …', 'sad');
    const regret = TEA_REGRET[Math.min(TEA_REGRET.length - 1, Number(G.state.flag(TEA_SIGNS_FLAG) ?? 0))];
    if (regret) await w.think(regret);
    k.face('down');
    await w.wait(600);
    w.player.setLook('e3-lia-gefesselt');
    sfx('rope-cut', { volume: 0.2, pitch: 0.6 });
    bg(mw.walkTo(CAMP_SPOT.cage[0] - 40, CAMP_SPOT.cage[1], { straight: true }));
    bg(me.walkTo(CAMP_SPOT.cage[0] - 10, CAMP_SPOT.cage[1] + 10, { straight: true }));
    bg(w.player.walkTo(CAMP_SPOT.cage[0] - 25, CAMP_SPOT.cage[1] + 4, { straight: true, speed: 30 }));
    await w.wait(1600);
    sfx('heartbeat', { volume: 0.5 });
  });
  await ui().fade('out', 1600);
  G.state.set('e3-gefangen');
  await nextScene('e3-innere-zuflucht');
}

async function script(w: WorldCtx): Promise<void> {
  preloadBlood(w);
  G.state.set(F.trap, false);
  for (const id of Object.keys(FINDS) as FindId[]) G.state.set(F.seen(id), false);
  G.state.set(FALLE_FINDS, 0);
  w.lockPlayer();
  w.lookMode.enable(false);
  liaGait(w);
  const k = w.spawn({
    id: KYRA, preset: 'kyra', speaker: 'e3-kyra', at: [CAMP_SPOT.path[0] + 24, CAMP_SPOT.path[1] + 10], dir: 'up', solid: false,
    facePlayer: true, verb: 'Ansprechen', talk: () => { G.state.set(F.trap); },
  });
  k.hold(true);
  await arrive(w, k);
  bg(k.walkTo(CAMP_SPOT.kyraFire[0], CAMP_SPOT.kyraFire[1], { face: 'left' }));
  w.lookMode.enable(true);
  w.setObjective('e3-fa-lager', 'Sieh dich im Lager um, oder setz dich zu Kyra ans Feuer.', 'feuer');
  await w.say('narrator', `Halte ${w.controlHint('look')} gedrückt: Der Spurenblick zeigt, was andere übersehen.`);
  bg(kyraUrges(w, k));
  bg(staggerLoop(w));
  w.unlockPlayer();
  await until(w, () => G.state.is(F.trap) && !G.ui.busy(), 150);
  await springTrap(w, k);
}

export const scene = e3Scene('e3-falle', 'Die Falle', async () => {
  await ui().fade('out', 0);
  await G.ui.narrate(['Am Vormittag, ein Lager im Wald'], { style: 'card' });
  await startWorld({ map: lager, spawn: 'pfad', player: liaLook(), companions: [], fadeIn: false, script });
});

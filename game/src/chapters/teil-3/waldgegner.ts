// Scene „e3-waldgegner“ – Kopfüber (docs/teil-3/umsetzung.md §3, F3 23:37–24:51; quellenpruefung §1.8). A framed
// interlude Lia never learns about: „Unterdessen, ein paar Täler weiter …“. The player is Flick (e2-flick-gefangen),
// caught in a net by three goblins – Ratz (the self-made „chief“), Hotze (the cook) and Fips (the smallest) – on the
// reused background k5-faehrte at dusk. Comic relief: they squabble about how to cook her while she hangs head down
// from the low oak branch (plate e3-flick-kopfueber, pose „hang“).
// Heart 1 (the intrigue): Flick cannot move, only talk. She plays the three against each other in four steps
// (waldgegner-lager.ts STEPS): make Hotze fear for the ears, make Ratz order her down, bribe Fips with a silver clasp
// to loosen the knot, then start a quarrel over who gets the ears. A wrong line gets a comic answer and is greyed out.
// Heart 2: while they brawl and then sulk, she sneaks away from the fire down the trail (view cones, ferns as hiding
// places and checkpoints, spotted = back to the last fern, never game over) while Fips fetches firewood along the same
// trail. At the fork she is out of sight; behind her Ratz finds the empty oak and sends Fips after her (heard, not
// seen). Sets e3-flick-ghule. → e3-vertraute-schwester.
// Only one checkpointed part: a reload restarts the interlude from the card.
import { G } from '../../core/G';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import { pinPlayer } from '../teil-2/gewoelbe';
import {
  ESCAPE_ZONE, FERNS, FIRE, GHUL_BLOCKS, GHUL_GUARDS, GHUL_OCCLUDERS, GHUL_SPAWNS, GHUL_SPOT, GHUL_SURFACES, GHUL_WALK,
  type Goblin, GOBLINS, type Ploy, ployOptions, type Step, STEPS,
} from './waldgegner-lager';
import { e3Scene, interlude, nextScene, sfx, ui, until } from './shared';

/** Flags of this visit (reset when the scene starts). */
const F = { freed: 'e3-wg-frei', out: 'e3-wg-draussen', cp: 'e3-wg-checkpoint' } as const;

/** Phase-1 figures at the fire (plain figures); the guards of the map take over when Flick sneaks off. */
const SITTER = (id: Goblin) => `${id}-feuer`;
const HOME: Record<Goblin, readonly [number, number]> = { ratz: GHUL_SPOT.ratz, hotze: GHUL_SPOT.hotze, fips: GHUL_SPOT.fips };
const TO_FIRE: Record<Goblin, 'up' | 'right' | 'left'> = { ratz: 'right', hotze: 'right', fips: 'up' };
const NAME: Record<Goblin, string> = { ratz: 'Ratz', hotze: 'Hotze', fips: 'Fips' };

const flick = (w: WorldCtx, text: string, mood?: string) => w.say('e2-flick', text, mood ? { mood } : undefined);
const gob = (w: WorldCtx, id: Goblin, text: string, mood?: string) => w.say(`e3-${id}`, text, mood ? { mood } : undefined);

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
  ],
  lights: [{ id: 'lagerfeuer', at: [FIRE[0], FIRE[1] - 4], kind: 'fire', radius: 170, intensity: 1.25, always: true, flame: true }],
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
// Heart 1: the intrigue
// ---------------------------------------------------------------------------------------------------------------

/** What each goblin answers to the lines that do not work (comic, never a penalty). */
const MISS: Record<string, (w: WorldCtx) => Promise<void>> = {
  rechte: async w => {
    await gob(w, 'ratz', 'Rechte! Hört ihr? Das Essen hat Rechte!', 'happy');
    await gob(w, 'hotze', 'Ich hab auch Rechte. Das Recht auf Abendbrot.', 'smirk');
    await flick(w, 'Gut. Recht ist hier offenbar das, was im Topf landet.', 'smirk');
  },
  netz: async w => {
    await gob(w, 'fips', 'Hab ich wohl! Ganz allein! Zwischen zwei Buchen, und dann ZACK!', 'angry');
    await gob(w, 'ratz', 'Fips. Keiner glaubt dir. Setz dich.');
    await flick(w, 'Der Kleine will gelobt werden. Merk ich mir.', 'thinking');
  },
  koch: async w => {
    await gob(w, 'ratz', 'Genau! Hier sagt der Häuptling, wann was runterkommt. Und der Häuptling sagt: Sie bleibt hängen!', 'angry');
    await gob(w, 'hotze', 'Aber die Ohren …', 'sad');
    await flick(w, 'Großartig, Flick. Du hast ihn gerade zum Helden gemacht. Andersrum.', 'pained');
  },
  'fips-sagt': async w => {
    await gob(w, 'ratz', 'Fips sagt viel. Fips sagt auch, er hat mal einen Bären gefangen.');
    await gob(w, 'fips', 'Einen kleinen Bären!', 'angry');
  },
  kraeuter: async w => {
    await gob(w, 'hotze', 'Bärlauch! Natürlich, Bärlauch!', 'surprised');
    await gob(w, 'ratz', 'Hotze. Es ist dunkel. Du findest nicht mal deine Füße. Hiergeblieben.');
    await gob(w, 'hotze', 'Dann schmeckt sie eben nach nix.', 'sad');
  },
  gnade: async w => {
    await gob(w, 'ratz', 'Ratz der Gnädige …', 'thinking');
    await gob(w, 'ratz', 'Nö. Ratz der Satte klingt besser.', 'smirk');
  },
  petzen: async w => {
    await gob(w, 'ratz', 'Fips! Zeig her!', 'angry');
    await gob(w, 'fips', 'Hab nix! Gar nix! Die lügt, die Elfe!', 'scared');
    await gob(w, 'ratz', 'Elfen lügen immer. Weiß doch jeder.', 'smirk');
    await flick(w, 'Halb-Elfe. Aber gut, für euch zählt das wohl doppelt.', 'smirk');
  },
  lied: async w => {
    await gob(w, 'fips', 'Lalala, die Elfe kommt in den Topf, mit Ohren und mit Kopf …', 'happy');
    await gob(w, 'hotze', 'Schön, Fips.', 'happy');
    await flick(w, 'Er singt wirklich. Und keiner zankt sich. Das Gegenteil von dem, was ich wollte.', 'pained');
  },
};

/** One step: Flick picks a line until the one that works. Wrong lines get their answer and are greyed out. */
async function ploy(w: WorldCtx, step: Step, prompt: string): Promise<Ploy> {
  const tried = new Set<string>();
  for (;;) {
    const opts = ployOptions(step, tried).map((o, i) => ({
      text: `${NAME[STEPS[step][i].to]}: „${o.text}“`, disabled: o.disabled, reason: o.disabled ? 'Hat nicht gezogen.' : undefined,
    }));
    const i = await w.choose(opts, { speaker: 'e2-flick', prompt });
    const p: Ploy = STEPS[step][i];
    await flick(w, p.text, 'smirk');
    if (p.works) return p;
    tried.add(p.id);
    await MISS[p.id](w);
  }
}

/** The three at the fire turn to whoever talks; the others go back to the pot. */
function lookAt(w: WorldCtx, who: Goblin | null): void {
  for (const id of GOBLINS) {
    const a = w.actor(SITTER(id));
    if (!a.exists) continue;
    if (who === null || id === who) a.face('player'); else a.face(TO_FIRE[id]);
  }
}

async function intrigue(w: WorldCtx): Promise<void> {
  // 1. Head down: make Hotze worry about the ears.
  w.setObjective('e3-wg-runter', 'Flick kann nur reden. Bring die drei dazu, dich runterzulassen.');
  lookAt(w, null);
  await ploy(w, 'runter', 'Wen bearbeitest du?');
  lookAt(w, 'hotze');
  await gob(w, 'hotze', 'Die … die Ohren? Die OHREN?! Das Beste am ganzen Elf!', 'scared');
  await gob(w, 'hotze', 'Runter mit ihr! Sofort! Wer hat die überhaupt kopfüber gehängt?', 'angry');
  await gob(w, 'fips', 'Ratz.');
  await gob(w, 'ratz', 'Weil man Wild abhängt! Steht in jedem Buch!', 'angry');
  await flick(w, 'In welchem Buch? Ihr könnt nicht mal eure Namen schreiben.', 'smirk');
  await gob(w, 'ratz', 'Ruhe! Keiner rührt den Strick an, bevor der Häuptling es sagt!', 'angry');
  // 2. Ratz has to say so.
  lookAt(w, 'ratz');
  await ploy(w, 'haeuptling', 'Ratz will gefragt werden. Was sagst du ihm?');
  await gob(w, 'ratz', '…', 'thinking');
  await gob(w, 'ratz', 'Das erste Stück. Das zarteste. Für den Häuptling.', 'happy');
  await gob(w, 'ratz', 'FIPS! Schneid sie runter! Befehl vom Häuptling!', 'determined');
  w.completeObjective('e3-wg-runter');
  const fips = w.actor(SITTER('fips'));
  await fips.walkTo(GHUL_SPOT.fipsAtOak[0], GHUL_SPOT.fipsAtOak[1], { face: 'right' });
  await gob(w, 'fips', 'Ich hab sie gefangen, ich darf sie auch runterschneiden. So ist das.', 'happy');
  sfx('rope-cut', { volume: 0.35 });
  await w.wait(200);
  sfx('thud', { volume: 0.5 });
  w.camera.shake(200, 0.004);
  w.player.setIdle('sit');
  await flick(w, 'Au. Kopf zuerst. Natürlich Kopf zuerst.', 'pained');
  await gob(w, 'ratz', 'Und bind sie an die Wurzel, Fips. Fest! Nicht so wie letztes Mal beim Hasen.');
  await gob(w, 'fips', 'Der Hase war schlau!', 'angry');
  sfx('rustle', { volume: 0.3 });
  await fips.walkTo(HOME.fips[0], HOME.fips[1], { face: 'up' });
  // 3. The knot: the little one wants something shiny.
  w.setObjective('e3-wg-knoten', 'Die Hände sind noch gebunden. Wer von den dreien lockert den Knoten?');
  lookAt(w, null);
  await flick(w, 'Ratz will das erste Stück, Hotze die Ohren, und Fips will, dass ihm einmal einer glaubt. Und er hat lauter glänzenden Kram an der Schleuder hängen.', 'thinking');
  await ploy(w, 'knoten', 'Wen bearbeitest du jetzt?');
  lookAt(w, 'fips');
  await gob(w, 'fips', 'Elbensilber? Echtes?', 'surprised');
  await fips.walkTo(GHUL_SPOT.fipsAtOak[0], GHUL_SPOT.fipsAtOak[1], { face: 'right' });
  await w.wait(500);
  sfx('pickup', { volume: 0.3 });
  await gob(w, 'fips', 'Oooh. Meins. Ganz meins.', 'happy');
  await flick(w, 'Und der Knoten?', 'smirk');
  await gob(w, 'fips', 'Der Knoten … sitzt jetzt lockerer. Ein bisschen. Sag keinem was!', 'scared');
  await fips.walkTo(HOME.fips[0], HOME.fips[1], { face: 'up' });
  w.completeObjective('e3-wg-knoten');
  // 4. The quarrel.
  w.setObjective('e3-wg-zank', 'Der Knoten ist locker. Jetzt müssen die drei woanders hingucken. Lange.');
  lookAt(w, null);
  await ploy(w, 'zank', 'Ein letzter Satz. An wen?');
  lookAt(w, 'hotze');
  await gob(w, 'hotze', 'Die Ohren? DEM HÄUPTLING? Die Ohren sind Kochrecht! Seit immer!', 'angry');
  await gob(w, 'ratz', 'Häuptlingsrecht! Ich hab den Topfhelm, also hab ich das Recht!', 'angry');
  await gob(w, 'fips', 'Und ich hab sie gefangen! Mir stehen mindestens die Zehen zu!', 'angry');
  w.completeObjective('e3-wg-zank');
}

/** The three roll into a heap of elbows next to the fire, then sulk back to their places. */
async function brawl(w: WorldCtx): Promise<void> {
  const [bx, by] = GHUL_SPOT.brawl;
  await Promise.all(GOBLINS.map((id, i) => w.actor(SITTER(id)).walkTo(bx + (i - 1) * 8, by + (i % 2) * 4, { run: true })));
  for (let n = 0; n < 5; n++) {
    sfx(n % 2 ? 'hit' : 'thud', { volume: 0.3, pitch: 1.3 });
    w.camera.shake(140, 0.003);
    w.bark(SITTER(GOBLINS[n % 3]), ['Meins!', 'Au! Mein Helm!', 'Nicht beißen, Fips!', 'Kochrecht!', 'Häuptling!'][n], 900);
    await w.wait(520);
  }
  sfx('rope-cut', { volume: 0.25 });
  await flick(w, 'Und raus aus der Schlinge. Sie merken nichts. Die Hände bleiben hinterm Rücken, als wär nichts.', 'happy');
  await gob(w, 'ratz', 'SCHLUSS! Der Häuptling entscheidet: Die Ohren werden … verlost! Morgen!', 'angry');
  await gob(w, 'hotze', 'Verlost. Pff.', 'sad');
  await gob(w, 'ratz', 'Fips, Holz holen. Hotze, Topf rühren. Und keiner guckt mich an!');
  await gob(w, 'fips', 'Immer Fips.', 'sad');
}

// ---------------------------------------------------------------------------------------------------------------
// Heart 2: away from the fire
// ---------------------------------------------------------------------------------------------------------------

function onCaught(w: WorldCtx): void {
  const lines = ['Zu hell. Noch mal, durch die Farne.', 'Flach wie ein Blatt, Flick. Noch mal.', 'Warten, bis Fips vorbei ist. Dann.'];
  let n = 0;
  w.stealth.onSpotted(async g => {
    w.lockPlayer();
    w.bark(g.id, ['Da! Das Abendbrot läuft weg!', 'Hey! Spitzohr!'][n % 2], 1300);
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
  for (const id of GOBLINS) w.despawn(SITTER(id));
  const guards = GOBLINS.map(id => w.actor(id));
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
    await gob(w, 'hotze', 'Ratz … die Wurzel ist leer. Die Ohren sind weg!', 'scared');
    await gob(w, 'ratz', 'FIPS! Wer hat den Knoten gemacht?', 'angry');
    await gob(w, 'fips', 'Ich! Also … der Knoten war gut! Bis eben!', 'scared');
    await gob(w, 'ratz', 'Lauf ihr nach. Und komm nicht ohne sie wieder, sonst kommst du morgen selbst in den Topf.', 'angry');
    await gob(w, 'hotze', 'Fips ist zu dünn. Der gibt keine Suppe.', 'sad');
    await gob(w, 'fips', 'Bin schon weg! Bin schon weg …', 'scared');
    w.player.face('left');
    await flick(w, 'Lauf nur, Fips. Und pass gut auf die Spange auf. Die war aus Zinn.', 'smirk');
    await flick(w, 'Und jetzt? Hilfe holen, hat Elnon gesagt. Oder die Leseratte finden. Irgendwer muss ja wissen, wo sie steckt.', 'determined');
  });
}

async function script(w: WorldCtx): Promise<void> {
  for (const f of [F.freed, F.out]) G.state.set(f, false);
  G.state.set(F.cp, 'pflock');
  w.stealth.enable(false);
  // The map's watchers wait out of sight; plain figures sit at the fire for the first part.
  for (const id of GOBLINS) { const g = w.actor(id); g.hold(true); g.hide(); }
  for (const id of GOBLINS) {
    const s = w.spawn({ id: SITTER(id), preset: `goblin-${id}`, speaker: `e3-${id}`, at: HOME[id], dir: TO_FIRE[id], solid: false, facePlayer: false });
    s.hold(true);
  }
  const release = pinPlayer(w, 'hang', 'left');
  await w.camera.zoom(1.25, 0);
  await w.camera.pan([FIRE[0] + 20, FIRE[1] + 30], 0);
  const plate = G.art.hasAsset('plate', 'e3-flick-kopfueber');
  if (plate) await G.ui.plate('e3-flick-kopfueber', { caption: 'Kopfüber', pan: 'in', durationMs: 22000 });
  await ui().fade('in', plate ? 0 : 1000);
  await w.cutscene(async () => {
    await gob(w, 'hotze', 'Ragout. Mit Pilzen. Elfenragout mit Pilzen.', 'happy');
    await gob(w, 'ratz', 'Am Spieß! Der Häuptling will sie am Spieß!', 'angry');
    await gob(w, 'fips', 'Ich hab sie gefangen. Ganz allein. Mit dem Netz. Da darf ich doch wohl sagen: Suppe.', 'determined');
    await gob(w, 'ratz', 'Du darfst gar nix sagen, Fips. Und sie hängt bis morgen. Wild muss abhängen.', 'smirk');
    await gob(w, 'hotze', 'Abgehangen ist zarter. Stimmt schon …', 'thinking');
    if (plate) await G.ui.closePlate();
    await w.camera.pan([GHUL_SPOT.stake[0] - 30, GHUL_SPOT.stake[1]], 900);
    await flick(w, 'Zwei Tage frei. Zwei. Dann ein Netz zwischen zwei Buchen, und jetzt hänge ich an einem Fuß und höre zu, wie drei Goblins mich würzen.', 'angry');
    await flick(w, 'Die rechte Hand taugt noch immer nichts, und das Messer liegt bei ihrem Kram. Bleibt das Mundwerk. Das hat noch nie versagt.', 'determined');
    await w.camera.zoom(1, 600);
    w.camera.follow();
  });
  await intrigue(w);
  await brawl(w);
  G.state.set(F.freed);
  release();
  w.player.setIdle('idle');
  await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt: Geduckt im Farn sieht dich keiner.`);
  startWatchers(w);
  onCaught(w);
  await escape(w);
  await ui().fade('out', 1400);
  G.state.set('e3-flick-ghule');
  await nextScene('e3-vertraute-schwester');
}

export const scene = e3Scene('e3-waldgegner', 'Kopfüber', async () => {
  await interlude('Unterdessen, ein paar Täler weiter …');
  await startWorld({ map: ghulwald, spawn: 'pflock', player: 'e2-flick-gefangen', companions: [], fadeIn: false, script });
});

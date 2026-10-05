// Scene `ueberfall` (DESIGN.md §7.4, Kapitel I/3): the Dunkelschatten are already at the farm when Lia arrives.
// She hides in the embankment, sneaks along it past the lookout, watches the interrogation (canon beats, violence
// only through camera, cuts and darkness), must hold still three times (no game over), the riders pass right by her
// hiding place, and Harro stays behind to bury the dead – Lia has to slip away from him through the old field gate.
import type { CharAnim } from '../../art/api';
import { G } from '../../core/G';
import type { SfxLoop } from '../../audio/api';
import { defineMap, type MapDef, type NpcDef, type WorldCtx } from '../../world';
import { AT, HOF_BLOCK, HOF_HIDING, HOF_OCCLUDERS, HOF_SURFACES, HOF_WALK } from './hofGeo';
import { dimmer, music, sfx, ui } from './shared';

const HORSES: [number, number][] = [[734, 242], [768, 256], [804, 244], [838, 258], [874, 244], [908, 258]];

function horseNpcs(ids: number[]): NpcDef[] {
  return ids.map(i => ({ id: `pferd-${i}`, preset: 'horse', at: HORSES[i], dir: i % 2 ? 'left' : 'right', idle: 'graze' as CharAnim, solid: true }));
}

const YARD_BARKS = {
  orwen: ['Wird’s bald?', 'Ich frage nicht noch einmal.', 'Ehrlichkeit währt am längsten.'],
  kahle: ['Soll ich ihm die Zunge lösen?', 'Langweilig hier.'],
  kapuze: ['Durchsucht die Scheune!', 'Hier ist nichts.'],
};

// ---------------------------------------------------------------------------------------------------------------
// Phase 1: arrival, sneaking along the embankment, the confrontation
// ---------------------------------------------------------------------------------------------------------------

export const hofMap: MapDef = defineMap({
  id: 'k1-hof',
  name: 'Der Hof',
  background: 'k1-hof',
  walk: [HOF_WALK],
  block: HOF_BLOCK,
  occluders: HOF_OCCLUDERS,
  surfaces: HOF_SURFACES,
  hidingSpots: HOF_HIDING,
  npcs: [
    { id: 'vater', preset: 'father', speaker: 'vater', at: AT.father, dir: 'right', idle: 'kneel', facePlayer: false },
    { id: 'mutter', preset: 'mother', speaker: 'mutter', at: AT.mother, dir: 'left', idle: 'kneel', facePlayer: false },
    { id: 'grauhaarige', preset: 'orwen', speaker: 'grauhaarige', at: AT.orwen, dir: 'up', barks: YARD_BARKS.orwen, barkEvery: 7000, facePlayer: false },
    { id: 'kahle', preset: 'maedchen', speaker: 'k1-kahle', at: AT.kahle, dir: 'right', barks: YARD_BARKS.kahle, barkEvery: 9000, facePlayer: false },
    { id: 'kapuze', preset: 'shadow-club', speaker: 'k1-kapuze', at: AT.kapuze, dir: 'left', barks: YARD_BARKS.kapuze, barkEvery: 11000, facePlayer: false },
    { id: 'harro', preset: 'harro', speaker: 'harro', at: AT.harro, dir: 'left', facePlayer: false },
    { id: 'narbige', preset: 'algard', speaker: 'k1-narbige', at: [584, 190], dir: 'down', hidden: true, facePlayer: false },
    { id: 'kyra', preset: 'kyra', at: [596, 190], dir: 'down', hidden: true, facePlayer: false },
    ...horseNpcs([0, 1, 2, 3, 4, 5]),
  ],
  guards: [
    {
      id: 'wache', preset: 'shadow-spear', speaker: 'k1-wache', mode: 'pingpong', range: 118, fov: 72, reaction: 1.1,
      path: [{ at: [616, 326], wait: 2600, face: 'down' }, { at: [548, 418], wait: 2400, face: 'left' }],
      suspiciousBarks: ['Was raschelt da?', 'Ist da wer?'], calmBarks: ['Nur ein Karnickel.', 'Verfluchte Mücken.'],
    },
  ],
  props: [{ id: 'preload-buch', prop: 'alana-book', at: [-40, -40], collide: false, alpha: 0 }],
  triggers: [
    { id: 'versteck', poly: [[466, 260], [528, 262], [560, 292], [546, 316], [492, 314], [462, 288]], onEnter: confrontation },
  ],
  spawns: {
    hohlweg: { at: [64, 688], dir: 'up' },
    boeschung: { at: [150, 600], dir: 'right' },
  },
  stealth: { checkpoint: 'boeschung', onSpotted: spottedByLookout },
  time: 'dusk',
  ambience: ['wind', 'crickets', 'farm'],
  ambienceVolume: { farm: 0.5, crickets: 0.5 },
  music: 'dread',
  lookMode: true,
  playerLight: 0,
});

async function spottedByLookout(w: WorldCtx): Promise<void> {
  w.bark('wache', 'He! Wer da?', 1800);
  void w.player.emote('drop', 900);
  await w.wait(700);
  await G.ui.fade('out', 380);
  w.player.teleport([150, 600], 'right');
  w.stealth.resetGuards();
  await w.wait(200);
  await G.ui.fade('in', 380);
  await w.think('Das war knapp. Ganz geduckt bleiben – und nur weiter, wenn er wegsieht.');
}

export async function ueberfallScript(w: WorldCtx): Promise<void> {
  dimmer(w, 0.38);
  ui().prefetchPlate('k1-verhoer');
  await w.cutscene(async () => {
    await w.player.walkTo(110, 660);
    w.player.face('up');
    await w.camera.pan([590, 250], 1600);
    await w.wait(500);
    await w.think('Die Haustür steht sperrangelweit offen. Vor ihr knien Mutter und Vater …');
    await w.think('Und um sie herum: Männer in Schwarz und Weiß. Bewaffnet.');
    w.bark('grauhaarige', 'Wo ist euer Balg?', 2400);
    await w.wait(1300);
    await w.camera.pan([420, 470], 900);
    w.bark('wache', 'Alles ruhig am Weg.', 2000);
    await w.wait(800);
    void w.player.emote('!', 900);
    w.camera.follow();
    await w.player.walkTo(150, 600, { run: true });
    await w.player.play('crouch' as CharAnim, { ms: 400 });
    await w.think('Runter! In die Böschung!');
    G.state.learn('schleichen');
    await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt, um geduckt zu schleichen. Im Gebüsch sieht dich niemand – auf freier Strecke schon.`);
  });
  w.setObjective('k1-naeher', 'Schleich dich in der Böschung näher an den Hof heran.', 'versteck');
}

/** Holds the hold-still prompt; every release snaps a twig and makes a Dunkelschatten look over. Returns the releases. */
async function holdStill(w: WorldCtx, label: string, ms: number, onSnap: (n: number) => void): Promise<number> {
  let snaps = 0;
  await G.ui.hold(label, ms, {
    struggle: true,
    onRelease: () => {
      snaps++;
      sfx('branch-snap', { volume: 1.1 });
      w.camera.shake(140, 0.003);
      onSnap(snaps);
    },
  });
  return snaps;
}

async function confrontation(w: WorldCtx): Promise<void> {
  w.completeObjective('k1-naeher');
  const gr = w.actor('grauhaarige');
  const vater = w.actor('vater');
  const mutter = w.actor('mutter');
  const kyra = w.actor('kyra');
  const narbige = w.actor('narbige');
  const kahle = w.actor('kahle');
  const kapuze = w.actor('kapuze');
  const harro = w.actor('harro');
  for (const a of [gr, kahle, kapuze, harro]) a.hold(true);

  await w.cutscene(async () => {
    w.player.face('right');
    w.player.setIdle('crouch' as CharAnim);
    await w.camera.pan([584, 236], 1000);
    await w.camera.zoom(1.25, 900);
    gr.face('up');

    await G.ui.plate('k1-verhoer', { caption: 'Der Hof am Ende des Hohlwegs', pan: 'in', durationMs: 20000 });
    await w.think('Schwarz-weiße Wappenröcke … Dunkelschatten. Ich habe über sie gelesen. Nie hätte ich gedacht, welche zu sehen.');
    G.state.addLore('lore-dunkelschatten');
    if (G.state.hasClue('k1-hufspuren')) await w.think('Sechs Pferde, sechs Männer. Die Spuren auf dem Weg … sie waren schon die ganze Zeit hier.');
    await w.say('grauhaarige', 'Na, wo ist euer Balg?', { mood: 'smirk' });
    await w.say('vater', 'Wir sind allein. Hier gibt es kein Kind.', { mood: 'scared' });
    await w.say('grauhaarige', 'Wollt wohl nicht reden, was? Selbst schuld.', { mood: 'angry' });
    await w.say('grauhaarige', 'Und nun zu dir, meine Liebe. Ist es dieses Balg wirklich wert?', { mood: 'smirk' });
    await w.say('mutter', 'Es gibt kein Balg. Nur uns zwei und ein paar Schweine.', { mood: 'determined' });
    await G.ui.closePlate();

    // Kyra is dragged out of the house.
    narbige.show();
    kyra.show();
    sfx('door');
    void kyra.play('hurt' as CharAnim, { ms: 500 });
    await Promise.all([narbige.walkTo(570, 232), kyra.walkTo(600, 238)]);
    kyra.setIdle('kneel');
    kyra.face('left');
    await w.say('k1-narbige', 'Seht mal, wen ich gefunden habe.', { mood: 'angry' });
    void w.player.emote('!', 900);
    await w.think('Kyra! Aus ihrer Augenbraue läuft Blut …');
    gr.face('vater');
    await w.say('grauhaarige', 'Ihr habt uns gesagt, ihr seid alleine. Und wer ist das?', { mood: 'angry' });
    await w.say('vater', 'Ich kenne sie nicht. Sie ist sicher nur ein neugieriges Kind. Lasst sie doch laufen.', { mood: 'scared' });
    await w.think('Vater … er verleugnet sie. Um sie zu schützen. Um *uns* zu schützen.');

    // Hold still (1)
    await w.think('Ich muss zu ihr! Ich muss –');
    const s1 = await holdStill(w, 'Halte still', 2600, n => {
      kapuze.face('player');
      void kapuze.emote('?', 900);
      if (n === 1) w.bark('kapuze', 'Was war das?', 1600);
      void w.player.emote('drop', 700);
    });
    if (s1) {
      await kapuze.walkTo(612, 268);
      await w.wait(500);
      await w.say('k1-kapuze', 'Nur ein Fuchs. Oder ein Karnickel.');
      await kapuze.walkTo(AT.kapuze);
      kapuze.face('left');
    }

    gr.face('kyra');
    await gr.walkTo(596, 252);
    await w.say('grauhaarige', 'Zeig deine Hände!', { mood: 'angry' });
    await w.wait(500);
    await w.say('grauhaarige', 'Hornhaut. Du bist es gewohnt, hart zu arbeiten. Wir haben noch Verwendung für dich.', { mood: 'smirk' });
    await w.say('grauhaarige', 'Der Hauptmann braucht eine neue Dienstmagd. Was für ein passender Zufall.', { mood: 'smirk' });
    w.bark('kahle', 'Ich wette, die hält keine Woche durch.', 2400);
    await w.wait(900);
    await w.say('vater', 'Lasst sie in Ruhe!', { mood: 'determined' });
    gr.face('vater');
    await w.say('grauhaarige', 'Dummer Bauer.', { mood: 'angry' });

    // The father: a cut to Lia, a dull sound, darkness.
    await w.camera.pan(AT.hide, 350);
    await w.camera.zoom(1.6, 350);
    sfx('hit-heavy', { volume: 0.55, distance: 0.6 });
    await G.ui.fade('out', 260, '#1a0606');
    vater.setIdle('lie');
    music('grief');
    w.addProp({ id: 'buch-boeschung', prop: 'alana-book', at: [522, 300], collide: false });
    G.state.take('book-alana');
    G.state.set('k1-buch-verloren');
    await w.wait(500);
    await G.ui.fade('in', 900);
    sfx('thud', { volume: 0.3 });
    await w.think('Mein Buch rutscht mir aus den Händen. Ins Gras. Ich merke es kaum.');
    await w.think('Nein. Nein, nein, nein …');
    await w.camera.zoom(1.25, 700);
    await w.camera.pan([590, 236], 800);
    mutter.face('vater');
    kyra.bark('Vater!', 1600);
    await Promise.all([kahle.walkTo(592, 244), narbige.walkTo(612, 244)]);
    await w.say('grauhaarige', 'Ups. Wie ungeschickt von mir.', { mood: 'smirk' });
    await w.say('grauhaarige', 'Weint nicht, meine Liebe. Wenn ihr euch so allein fühlt, dann folgt ihm doch.', { mood: 'smirk' });

    // The mother: darkness, her last word.
    await w.camera.pan(AT.hide, 350);
    await G.ui.fade('out', 300, '#1a0606');
    sfx('hit-heavy', { volume: 0.4, distance: 0.7 });
    mutter.setIdle('lie');
    await w.wait(600);
    await w.say('mutter', 'Kyra …', { mood: 'sad' });
    await w.wait(400);
    await G.ui.fade('in', 1100);
    await w.camera.pan([590, 236], 800);
    kyra.setIdle('idle');
    void kyra.play('hurt' as CharAnim, { ms: 700 });
    await w.say('kyra', 'Ich werde euch töten! Das schwöre ich bei allen Göttern!', { mood: 'angry' });
    await w.say('grauhaarige', 'Oh, das wollen viele Mädchen. Stell dich hinten an.', { mood: 'smirk' });

    // Hold still (2): longer, a Dunkelschatten comes closer when she gives in.
    await w.think('Ich halte das nicht aus. Ich renne einfach hin, ich –');
    const s2 = await holdStill(w, 'Halte still', 3400, n => {
      kahle.face('player');
      void kahle.emote(n > 1 ? '!' : '?', 900);
      w.bark('kahle', n > 1 ? 'Da ist doch was!' : 'Hm?', 1500);
    });
    if (s2) {
      await kahle.walkTo(560, 280);
      await w.wait(700);
      await w.say('grauhaarige', 'Lass das Gebüsch. Wir haben, was wir brauchen.', { mood: 'angry' });
      await kahle.walkTo(590, 244);
    }
    await w.say('grauhaarige', 'Fesselt sie und verwahrt sie gut. Der Hauptmann wird sich über unser Geschenk freuen.');
    await w.narrate('Kyra wehrte sich so heftig, dass es drei Männer brauchte, um sie auf ein Pferd zu hieven.', { style: 'card' });
    kyra.hide();
    narbige.hide();
    await w.say('grauhaarige', 'Harro! Du bleibst. Verscharr die beiden, bevor die Leichenfresser kommen.');
    await w.say('harro', 'Immer darf ich alles machen … Ich bin hier wohl der Depp vom Dienst.', { mood: 'angry' });
    await w.say('grauhaarige', 'Aufsitzen!');
    await G.ui.fade('out', 700);
  });
  await w.changeMap(harroMap, 'versteck', { fadeMs: 10 });
}

// ---------------------------------------------------------------------------------------------------------------
// Phase 2: the riders pass Lia's hiding place; Harro stays behind
// ---------------------------------------------------------------------------------------------------------------

const RIDERS = ['reiter-1', 'reiter-2', 'reiter-3', 'reiter-4', 'reiter-5'];

export const harroMap: MapDef = defineMap({
  id: 'k1-hof-harro',
  name: 'Der Hof',
  background: 'k1-hof',
  walk: [HOF_WALK],
  block: HOF_BLOCK,
  occluders: HOF_OCCLUDERS,
  surfaces: HOF_SURFACES,
  hidingSpots: HOF_HIDING,
  npcs: [
    { id: 'vater', preset: 'father', at: AT.father, dir: 'right', idle: 'lie', facePlayer: false, solid: false },
    { id: 'mutter', preset: 'mother', at: AT.mother, dir: 'left', idle: 'lie', facePlayer: false, solid: false },
    ...RIDERS.map((id, i) => ({ id, preset: 'shadow-rider', at: [640 + (i % 2) * 30, 262 - i * 6] as [number, number], dir: 'down' as const, facePlayer: false, solid: false })),
    ...horseNpcs([5]),
  ],
  guards: [
    {
      id: 'harro', preset: 'harro', speaker: 'harro', mode: 'loop', range: 104, fov: 70, reaction: 1.3, speed: 34,
      path: [
        { at: [640, 262], wait: 4200, face: 'up' },
        { at: [540, 380], wait: 600, face: 'down' },
        { at: [440, 480], wait: 1800, face: 'left' },
        { at: [540, 380], wait: 400, face: 'up' },
      ],
      suspiciousBarks: ['Hab ich da was gehört?', 'Wer da?'], calmBarks: ['Bloß ein Karnickel.', 'Leichenfresser … pah.'],
    },
  ],
  props: [{ id: 'buch-boeschung', prop: 'alana-book', at: [522, 300], collide: false }],
  triggers: [
    { id: 'gatter', poly: [[60, 568], [140, 568], [140, 620], [60, 620]], onEnter: escapeThroughGate },
  ],
  spawns: {
    versteck: { at: AT.hide, dir: 'right' },
  },
  stealth: { checkpoint: 'versteck', onSpotted: spottedByHarro },
  time: 'dusk',
  ambience: ['wind', 'crickets'],
  music: 'grief',
  lookMode: true,
  resetOnEnter: true,
  onEnter: harroPhase,
});

const HARRO_BARKS = [
  'Immer darf ich alles machen …',
  'Verscharr die beiden, Harro. Hol Wasser, Harro.',
  'Wo ist die verfluchte Schaufel?',
  'Die anderen saufen heut Abend, und ich?',
];

async function spottedByHarro(w: WorldCtx): Promise<void> {
  await w.say('harro', 'Hey, du! Du siehst aber nicht aus wie ein Leichenfresser …', { mood: 'angry' });
  await G.ui.fade('out', 420);
  w.player.teleport(AT.hide, 'right');
  w.stealth.resetGuards();
  await w.wait(250);
  await G.ui.fade('in', 420);
  await w.think('Nein. So nicht. Ich warte, bis er mir den Rücken zudreht.');
}

async function harroPhase(w: WorldCtx): Promise<void> {
  const harro = w.actor('harro');
  dimmer(w, 0.48);
  harro.hide();
  w.player.setIdle('crouch' as CharAnim);
  let hooves: SfxLoop | null = null;
  await w.cutscene(async () => {
    w.camera.follow();
    await w.camera.zoom(1.2, 10);
    await G.ui.fade('in', 600);
    await w.think('Sie kommen. Sie müssen durch den Hohlweg – direkt an mir vorbei!');
    try { hooves = G.audio.loop('horse', { interval: 0.32, volume: 0.9 }); } catch { hooves = null; }
    // The riders gallop down the lane one after another.
    const rides = RIDERS.map((id, i) => (async () => {
      await w.wait(i * 420);
      const r = w.actor(id);
      await r.walkPath([[620, 330], [500, 446], [300, 566], [60, 700], [-60, 760]], { speed: 150, run: true, straight: true });
      w.despawn(id);
    })().catch(() => {}));
    const held = holdStill(w, 'Tiefer ducken!', 2600, () => {
      void w.player.emote('drop', 600);
    });
    await Promise.all([held, ...rides]);
    hooves?.stop(1600);
    await w.wait(400);
    await G.ui.plate('k1-reiter', { caption: 'Der Hohlweg', pan: 'right', durationMs: 16000 });
    await w.think('Kyra. Gefesselt auf dem Pferd des Grauhaarigen. Durch die Zweige sieht sie genau hierher.');
    await w.think('Ihre Augen glänzen vor Trauer und Wut. Und ich sitze hier im Gebüsch und tue nichts.');
    await w.think('Ich hole dich zurück, Kyra. Ich weiß nicht wie. Aber ich schwöre es.');
    await G.ui.closePlate();
    await w.camera.zoom(1, 600);
    // Harro stays behind.
    harro.show();
    w.stealth.resetGuards();
    await w.camera.pan([640, 262], 700);
    await w.say('harro', 'Immer darf ich alles machen. Erst Reisig fürs Feuer, dann die Gräber. Und morgen hol ich euch nie wieder ein.', { mood: 'angry' });
    await w.camera.pan(AT.hide, 600);
    w.camera.follow();
  });
  w.player.setIdle('idle');
  await w.say('narrator', `Bleib geduckt (${w.controlHint('sneak')}) und husch von Busch zu Busch, wenn Harro dir den Rücken zukehrt.`);
  w.setObjective('k1-weg', 'Weg hier, bevor er dich findet: Schleich zum Feldgatter am Weg.', 'gatter');
  let i = 0;
  const barkLoop = async () => {
    while (w.alive && !G.state.is('k1-entkommen')) {
      await w.wait(6500);
      if (w.alive && !G.state.is('k1-entkommen')) w.bark('harro', HARRO_BARKS[i++ % HARRO_BARKS.length], 2600);
    }
  };
  void barkLoop().catch(() => {});
}

async function escapeThroughGate(w: WorldCtx): Promise<void> {
  if (G.state.is('k1-entkommen')) return;
  G.state.set('k1-entkommen');
  w.completeObjective('k1-weg');
  const harro = w.actor('harro');
  w.stealth.enable(false);
  await w.cutscene(async () => {
    sfx('rustle');
    await w.player.walkTo(76, 580);
    w.player.setIdle('crouch' as CharAnim);
    harro.hold(true);
    await w.camera.pan([560, 260], 1200);
    await harro.walkTo(560, 262);
    await harro.play('attack' as CharAnim, { ms: 700 });
    sfx('thud', { volume: 0.5 });
    await w.wait(500);
    await harro.play('attack' as CharAnim, { ms: 700 });
    sfx('thud', { volume: 0.5 });
    await w.say('harro', 'Hart wie Stein, der Boden. Seit Tagen kein Regen.', { mood: 'angry' });
    await w.say('harro', 'Ach, sollen die Leichenfresser sich doch satt fressen. Ich hol die anderen nie ein, wenn ich hier Löcher grab.', { mood: 'angry' });
    await harro.walkTo(HORSES[5][0] - 24, HORSES[5][1] + 4);
    harro.hide();
    w.despawn('pferd-5');
    const r = w.spawn({ id: 'harro-reiter', preset: 'shadow-rider', at: [HORSES[5][0], HORSES[5][1] + 20], dir: 'down', facePlayer: false, solid: false });
    sfx('horse', { volume: 0.8 });
    await w.camera.pan([330, 520], 1400);
    await r.walkPath([[620, 330], [500, 446], [300, 566], [60, 700], [-60, 760]], { speed: 130, run: true, straight: true });
    w.despawn('harro-reiter');
    await w.wait(700);
    await w.think('Weg. Er ist weg. Sie sind alle weg.');
    await G.ui.fade('out', 1400);
  });
  await G.goto('trauer');
}

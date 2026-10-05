// Scene `heimweg` (DESIGN.md §7.4, Kapitel I/2): in wooden clogs over the fields or through the sunken lane — the
// player chooses the way home. The light sinks into dusk as Lia gets closer; ominous signs on either route (silent
// birds, crows taking off without a sound, fresh hoofprints, trampled wheat, horses at the farm).
import { G } from '../../core/G';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { ambience, dimmer, music, sfx } from './shared';

type Route = 'felder' | 'hohlweg';

export const heimwegMap: MapDef = defineMap({
  id: 'k1-heimweg',
  name: 'Der Heimweg',
  background: 'k1-heimweg',
  walk: [
    // Start and fork (left edge).
    [[0, 296], [100, 296], [170, 300], [200, 330], [150, 372], [110, 386], [0, 372]],
    // Upper route: field path between the wheat, over the plank bridge, out at the right edge.
    [[96, 300], [160, 272], [280, 246], [400, 236], [560, 220], [700, 200], [840, 184], [960, 166], [1012, 152], [1120, 150], [1200, 132], [1280, 118],
      [1280, 176], [1180, 186], [1110, 198], [1040, 204], [960, 218], [820, 242], [700, 264], [560, 282], [420, 292], [300, 298], [210, 318], [150, 346]],
    // Lower route: the sunken lane.
    [[150, 350], [182, 380], [262, 424], [342, 470], [442, 506], [560, 528], [700, 546], [840, 560], [1000, 572], [1160, 584], [1280, 590],
      [1280, 646], [1160, 634], [1000, 624], [860, 612], [720, 598], [580, 582], [440, 562], [320, 532], [220, 484], [140, 424], [104, 384]],
  ],
  block: [
    { id: 'baum-west', poly: [[196, 222], [216, 222], [218, 238], [194, 238]] },
  ],
  occluders: [
    { id: 'baum-west', baseline: 236, fade: 0.55, poly: [[140, 140], [176, 104], [236, 100], [282, 140], [280, 200], [240, 230], [218, 238], [194, 238], [160, 216], [138, 184]] },
    { id: 'baum-mitte', baseline: 154, fade: 0.55, poly: [[800, 30], [850, 0], [910, 10], [930, 70], [910, 130], [866, 152], [846, 152], [812, 120], [796, 80]] },
    { id: 'hecke-sued', baseline: 720, poly: [[0, 600], [120, 560], [260, 600], [420, 600], [580, 612], [720, 622], [860, 636], [1000, 646], [1160, 656], [1280, 664], [1280, 720], [0, 720]] },
    { id: 'hecke-west', baseline: 720, poly: [[0, 420], [60, 400], [110, 420], [150, 470], [200, 520], [230, 580], [180, 600], [0, 600]] },
  ],
  surfaces: [
    { id: 'pfad-oben', kind: 'path', poly: [[100, 310], [200, 286], [400, 262], [640, 230], [880, 196], [1000, 176], [1280, 136], [1280, 158], [1010, 196], [880, 216], [640, 252], [400, 282], [200, 306], [120, 336]] },
    { id: 'bruecke', kind: 'wood', poly: [[1030, 156], [1112, 156], [1112, 194], [1030, 194]] },
    { id: 'hohlweg', kind: 'dirt', poly: [[120, 350], [182, 390], [262, 436], [342, 480], [442, 516], [560, 538], [700, 556], [840, 570], [1000, 582], [1160, 594], [1280, 600], [1280, 636], [1160, 624], [1000, 614], [860, 602], [720, 588], [580, 572], [440, 552], [320, 522], [220, 476], [140, 418], [110, 380]] },
    { id: 'start', kind: 'path', poly: [[0, 314], [140, 312], [160, 346], [0, 350]] },
  ],
  npcs: [
    { id: 'kraehe-1', preset: 'crow', at: [470, 252], dir: 'left', idle: 'peck' as never, solid: false },
    { id: 'kraehe-2', preset: 'crow', at: [508, 246], dir: 'right', idle: 'peck' as never, solid: false },
    { id: 'kraehe-3', preset: 'crow', at: [538, 256], dir: 'left', solid: false },
  ],
  clues: [
    // Upper route
    { id: 'korn-1', at: [720, 214], kind: 'hoof', angle: 160, clue: 'k1-zertrampelt', thought: 'Hufspuren quer übers Korn. Wer reitet denn mitten durchs Feld? Vater wird toben.' },
    { id: 'korn-2', at: [770, 208], kind: 'hoof', angle: 165 },
    { id: 'bruecke-1', at: [1160, 166], kind: 'hoof', angle: 170, clue: 'k1-hufspuren', thought: 'Beschlagene Hufe, ganz frisch. Fünf … nein, sechs Pferde. Sie wollen alle zu uns.' },
    { id: 'bruecke-2', at: [1214, 152], kind: 'hoof', angle: 172 },
    // Lower route
    { id: 'weg-1', at: [560, 546], kind: 'hoof', angle: 10 },
    { id: 'weg-2', at: [660, 558], kind: 'hoof', angle: 8, clue: 'k1-hufspuren', thought: 'Beschlagene Hufe, ganz frisch. Fünf … nein, sechs Pferde. Sie wollen alle zu uns.' },
    { id: 'weg-3', at: [760, 570], kind: 'hoof', angle: 6 },
    { id: 'zweig', at: [912, 584], kind: 'branch', angle: 20, thought: 'Abgebrochene Zweige, so hoch wie ein Reiter. Jemand hatte es eilig.' },
  ],
  triggers: [
    { id: 'gabelung', poly: [[60, 296], [170, 296], [170, 372], [60, 372]], onEnter: fork },
    { id: 'route-felder', poly: [[260, 236], [320, 236], [320, 300], [260, 300]], onEnter: w => chooseRoute(w, 'felder') },
    { id: 'route-hohlweg', poly: [[230, 420], [320, 420], [320, 540], [230, 540]], onEnter: w => chooseRoute(w, 'hohlweg') },
    { id: 'kraehen', poly: [[380, 220], [440, 220], [440, 300], [380, 300]], onEnter: crows },
    { id: 'stille-weg', poly: [[400, 480], [460, 480], [460, 580], [400, 580]], onEnter: silence },
    { id: 'abend-oben', poly: [[330, 224], [370, 224], [370, 300], [330, 300]], onEnter: dusk },
    { id: 'abend-unten', poly: [[340, 450], [380, 450], [380, 560], [340, 560]], onEnter: dusk },
    { id: 'ende-oben', poly: [[1250, 110], [1280, 110], [1280, 180], [1250, 180]], onEnter: arrive },
    { id: 'ende-unten', poly: [[1250, 584], [1280, 584], [1280, 650], [1250, 650]], onEnter: arrive },
    { id: 'pferde-oben', poly: [[1110, 120], [1150, 120], [1150, 200], [1110, 200]], onEnter: horses },
    { id: 'pferde-unten', poly: [[1080, 570], [1120, 570], [1120, 640], [1080, 640]], onEnter: horses },
  ],
  spawns: {
    west: { at: [26, 332], dir: 'right' },
  },
  time: 'day',
  ambience: ['wind', 'birds', 'crickets'],
  ambienceVolume: { birds: 0.9, crickets: 0.4 },
  music: 'exploration',
  lookMode: true,
});

export async function heimwegScript(w: WorldCtx): Promise<void> {
  w.setObjective('k1-heim', 'Geh nach Hause und füttere die Schweine.', null);
  if (!G.state.is('k1-heimweg-intro')) {
    G.state.set('k1-heimweg-intro');
    await w.wait(600);
    await w.think('Die Erde ist noch ganz warm von der Sonne. Man spürt es sogar durch die Holzschuhe.');
  }
}

async function fork(w: WorldCtx): Promise<void> {
  w.lockPlayer();
  try {
    await w.think('Über die Felder ist es schöner – vorbei an der Vogelscheuche. Durch den Hohlweg geht es schneller.');
  } finally { w.unlockPlayer(); }
  w.setObjective('k1-heim', 'Geh nach Hause: über die Felder oder durch den Hohlweg.', null);
}

async function chooseRoute(w: WorldCtx, route: Route): Promise<void> {
  if (G.state.flag('k1-heimweg-route')) return;
  G.state.set('k1-heimweg-route', route);
  w.setEnabled(route === 'felder' ? 'route-hohlweg' : 'route-felder', false);
  w.setObjectiveTarget(route === 'felder' ? 'ende-oben' : 'ende-unten');
  w.setObjective('k1-heim', route === 'felder' ? 'Geh über die Felder nach Hause.' : 'Geh durch den Hohlweg nach Hause.', route === 'felder' ? 'ende-oben' : 'ende-unten');
  w.bark('player', route === 'felder' ? 'Über die Felder, an der Vogelscheuche vorbei.' : 'Durch den Hohlweg. Schnell heim.', 2400);
}

/** First sign on either route: if Lia has not learnt to look closely yet (the fledgling), she learns it now. */
async function teachLook(w: WorldCtx): Promise<void> {
  if (G.state.knows('spurenblick')) return;
  await w.think('Irgendetwas stimmt nicht. Ich muss genauer hinsehen – so wie die Fährtenleser in meinen Büchern.');
  G.state.learn('spurenblick');
  w.lookMode.enable(true);
  await w.say('narrator', `Halte ${w.controlHint('look')} gedrückt: Im Spurenblick verblasst die Welt, und Spuren leuchten auf.`);
}

async function crows(w: WorldCtx): Promise<void> {
  w.lockPlayer();
  try {
    for (const [i, id] of ['kraehe-1', 'kraehe-2', 'kraehe-3'].entries()) {
      const c = w.actor(id);
      if (!c.exists) continue;
      void c.play('fly' as never);
      void c.walkTo([c.x + 60 + i * 30, -40], { straight: true, speed: 120 + i * 20 }).then(() => w.despawn(id)).catch(() => {});
    }
    sfx('whoosh', { volume: 0.4 });
    await w.wait(900);
    await silenceNow(w);
    await w.think('Die Krähen fliegen auf – ohne einen einzigen Laut. Und die Vögel … sie singen nicht mehr.');
    await teachLook(w);
  } finally { w.unlockPlayer(); }
}

async function silence(w: WorldCtx): Promise<void> {
  w.lockPlayer();
  try {
    await silenceNow(w);
    await w.think('Still. Kein Vogel singt mehr. Nur der Wind im Korn. Als hätte etwas sie verscheucht.');
    await teachLook(w);
  } finally { w.unlockPlayer(); }
}

async function silenceNow(w: WorldCtx): Promise<void> {
  ambience(['wind', 'crickets'], 2400);
  music(null);
  G.state.addClue('k1-stille');
  await w.wait(300);
}

async function dusk(w: WorldCtx): Promise<void> {
  if (G.state.is('k1-heimweg-dusk')) return;
  G.state.set('k1-heimweg-dusk');
  void w.lighting.set('dusk', 7000);
  dimmer(w, 0.18, 9000);
  w.weather.set('none', { ms: 2000 });
}

async function horses(w: WorldCtx): Promise<void> {
  if (G.state.is('k1-pferde-gehoert')) return;
  G.state.set('k1-pferde-gehoert');
  dimmer(w, 0.4, 3500);
  sfx('horse', { distance: 0.85, volume: 0.9 });
  w.lockPlayer();
  try {
    await w.wait(700);
    await w.think('Pferde? Ich höre Pferde am Hof. Wir haben doch gar keine Pferde.');
    G.state.addClue('k1-pferde');
  } finally { w.unlockPlayer(); }
}

async function arrive(w: WorldCtx): Promise<void> {
  w.lockPlayer();
  await w.wait(200);
  if (!G.state.hasClue('k1-pferde')) {
    sfx('horse', { distance: 0.7 });
    await w.think('Pferde … vor unserer Scheune?');
    G.state.addClue('k1-pferde');
  }
  w.completeObjective('k1-heim');
  await G.ui.fade('out', 900);
  await G.goto('ueberfall');
}

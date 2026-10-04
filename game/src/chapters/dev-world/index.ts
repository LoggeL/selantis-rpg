// Hidden dev chapter for the world engine: demo maps that exercise every feature (and a stress map).
import { G } from '../../core/G';
import { registerClues, registerItems } from '../../core/catalog';
import { defineChapter } from '../../core/registry';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';

registerItems([
  { id: 'dev-apfel', name: 'Apfel', icon: 'apple', description: 'Rotbackig und noch warm von der Sonne.', comment: 'Den hebe ich mir für später auf.' },
  { id: 'dev-ring', name: 'Alter Ring', icon: 'ring', description: 'Ein angelaufener Messingring mit einer eingeritzten Feder.', comment: 'Wer verliert denn so etwas am Weiher?' },
]);
registerClues([
  { id: 'dev-spuren', title: 'Kleine Fußspuren', text: 'Barfußspuren führen vom Feld zum Weiher. Jemand war in Eile.' },
]);

// ---------------------------------------------------------------------------------------------------------------
// Map 1: farm edge at dusk
// ---------------------------------------------------------------------------------------------------------------

export const farmEdge: MapDef = defineMap({
  id: 'world-demo',
  name: 'Am Feldrand',
  ground: [
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
    ';;;;;.....,,,,,.......;;;;;;;;;;;;;;;;;;;;;;;;',
    ';;;...,,,,,,,,,,.......,,,..xxxxxxxxxxxx.;;;;;',
    ';;....,,dddddddddd,....,,..wwwwwwwwwwwwww..;;;',
    ';;...,,ddddddddddddd,...,..wwwwwwwwwwwwww...;;',
    ';;..,,,ddddddddddddd,......wwwwwwwwwwwwww....;',
    ';...,,,dddddddddddddpp.....wwwwwwwwwwwwww.....',
    ';...,,,,dddddddddddd.pp....wwwwwwwwwwwwww.....',
    ';....,,,,,ddddd,,,,,..p....cccccccccccccc.....',
    ';.....,,,,,,,,,,,,,,..pp...cccccccccccccc.....',
    ';......,,,,,,,,,,,.....pp.....................',
    '..........,,,,,,........pppppppppppppppppppppp',
    '..........,,,,,.........p.....................',
    '.........,,,,,..........p.......,,,,..........',
    '........,,,,,,.........pp......,,,,,,.........',
    '......,,,,,,,..........p.......,,,,,,.........',
    '....,,,,,,,,..........pp........,,,,....dddd..',
    '...---,,,,,,.........pp.............ddddddddd.',
    '..-~~~--,,,,.........p.............dddddddddd.',
    '.-~~~~~~-,,,.........p............ddddddddddd.',
    '.-~~~~~~~-,,........pp............ddddddddddd.',
    '.-~~~~~~~-,,........p..............ddddddddd..',
    '..-~~~~~--,,,.......p...............ddddddd...',
    '...----,,,,,,.......p.........................',
    '....,,,,,,,,........p.........................',
    ';....,,,,,,.........p......................;;;',
    ';;.........,........p.....................;;;;',
    ';;;;;;.............pp...................;;;;;;',
    ';;;;;;;;;;;;;;;;;;;pp;;;;;;;;;;;;;;;;;;;;;;;;;',
  ],
  decor: {
    jitter: 3,
    legend: { T: 'tree-oak', P: 'tree-pine', b: 'bush', h: { prop: 'bush-hide', hide: 'bush' }, g: { prop: 'tall-grass', hide: 'grass' }, r: 'rock', f: { prop: 'flowers-mixed', collide: false } },
    rows: [
      'T P T  T P  T  T P T T  P T  T P  T  T P T  T',
      ' T  P T  T P  T     P T  T  P  T  P  T  T P  T',
      'P  T                  T  P  T  T  P  T  P  T',
      'T                                          P',
      ' P                                          T',
      'T                                            P',
      ' T',
      'P',
      ' T',
      'T    f',
      ' P               f',
      'T',
      '',
      '       f',
      '                             h     b',
      '                            g g',
      '               b',
      '',
      '      r                        h',
      '                              g g',
      '           r',
      '                            h              P',
      '                             g             T',
      '                                h          P',
      '                               g g         T',
      '                b                          P',
      'T  P                                   T  P T',
      ' T  T  P    T  P   T  T   P  T   P  T  T  P',
      'P T  T  T P  T  T     T P  T  T P  T  P  T  T',
      ' T P  T  T  P  T T   P  T  T  P  T  T  P  T',
    ],
  },
  props: [
    { prop: 'house-farm', at: [13, 5.2], id: 'haus' },
    { prop: 'fence-h', at: [8, 9] }, { prop: 'fence-h', at: [9, 9] }, { prop: 'fence-h', at: [10, 9] },
    { prop: 'well', at: [17, 7], id: 'brunnen' },
    { prop: 'tree-apple', at: [5, 12], id: 'apfelbaum',
      interact: { verb: 'Apfel pflücken', item: { id: 'dev-apfel' }, removeOnUse: false, sparkle: true, radius: 22 } },
    { prop: 'rock', at: [11, 18], id: 'wetterstein', variant: 2 },
    { prop: 'tent', at: [39, 18], id: 'zelt' },
    { prop: 'campfire', at: [38, 21], id: 'feuer', light: { kind: 'fire', radius: 74 } },
    { prop: 'crate', at: [41, 21] }, { prop: 'crate', at: [42, 21], variant: 1 }, { prop: 'barrel', at: [36, 19] },
    { prop: 'log', at: [36, 22] },
  ],
  npcs: [
    {
      id: 'kyra', preset: 'kyra', at: [16, 10], dir: 'left', wander: 1.5,
      barks: ['Die Schweine haben Hunger …', 'Wo Vater nur bleibt?', 'Hörst du die Grillen?'], barkEvery: 6500,
      talk: talkKyra,
    },
  ],
  guards: [
    {
      id: 'wache-1', preset: 'shadow-spear', speaker: 'wache',
      path: [{ at: [34, 17], wait: 1400, face: 'left' }, { at: [41.5, 16.6], wait: 900, face: 'up' }, { at: [41.5, 23.4], wait: 1200, face: 'left' }, { at: [34, 23.4], wait: 900, face: 'down' }],
      suspiciousBarks: ['Was war das?', 'Ist da wer?'], calmBarks: ['Nur der Wind.', 'Verfluchte Katzen.'],
    },
    {
      id: 'wache-2', preset: 'shadow-sword', speaker: 'wache', lantern: true, range: 4.5,
      path: [{ at: [41, 19.6], face: 'left' }],
      suspiciousBarks: ['Hm?'], calmBarks: ['…'],
    },
  ],
  clues: [
    { id: 'spur-1', at: [24.6, 10.4], kind: 'footprint', angle: 200 },
    { id: 'spur-2', at: [20.3, 13.6], kind: 'footprint', angle: 215 },
    { id: 'spur-3', at: [16.5, 16.2], kind: 'footprint', angle: 220, clue: 'dev-spuren', thought: 'Barfußspuren. Klein und schnell … jemand ist hier gerannt.' },
    { id: 'spur-4', at: [12.8, 19.4], kind: 'footprint', angle: 230 },
    { id: 'spur-5', at: [9.6, 23.6], kind: 'glint', verb: 'Aufheben', onInteract: findRing },
  ],
  triggers: [
    { id: 'nacht', area: { x: 27, y: 11, w: 2, h: 16 }, onEnter: async w => { await w.lighting.set('night', 5000); } },
    {
      id: 'regen', area: { x: 10, y: 17, w: 3, h: 3 }, once: false,
      onEnter: async w => {
        const raining = w.weather.kind === 'rain';
        w.weather.set(raining ? 'none' : 'rain', { ms: 1800 });
        w.prop('wetterstein').shake();
        w.fx.burst('wetterstein', 'sparkle', 6);
        w.bark('player', raining ? 'Der Regen hört auf.' : 'Regen! Endlich.');
      },
    },
  ],
  exits: [
    { id: 'exit-east', area: { x: 45, y: 11, w: 1, h: 3 }, to: 'world-demo-2', spawn: 'west' },
  ],
  spawns: {
    start: { at: [21, 22], dir: 'up' },
    east: { at: [43, 12], dir: 'left' },
    camp: { at: [27, 20], dir: 'right' },
  },
  stealth: { checkpoint: 'camp' },
  time: 'dusk',
  weather: 'none',
  ambience: ['wind', 'birds', 'crickets', 'fire'],
  ambienceVolume: { fire: 0.4, birds: 0.6 },
  music: 'exploration',
  sneak: true,
});

async function talkKyra(w: WorldCtx): Promise<void> {
  const kyra = w.actor('kyra');
  if (G.state.is('dev-kyra-talked')) {
    await kyra.say('Pass auf dich auf, hörst du? Und halte dich von dem Lager fern.');
    return;
  }
  void kyra.emote('!', 900);
  await kyra.say('Da bist du ja! Hast du etwa schon wieder gelesen?');
  const pick = await w.choose(['„Nur ein Kapitel, ehrlich.“', '„Ich habe nachgedacht. Das ist etwas anderes.“']);
  if (pick === 0) {
    void kyra.emote('…');
    await kyra.say('Ein Kapitel. Natürlich. So wie gestern und vorgestern.');
  } else {
    void kyra.emote('anger');
    await kyra.say('Nachdenken mit einem Buch vor der Nase. Sehr überzeugend.');
  }
  await kyra.say('Hinter dem Feld lagern Fremde. Wenn du dort vorbeimusst: duck dich und bleib in den Büschen.');
  await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt, um zu schleichen. Geduckt im Gebüsch oder im Weizen sieht dich niemand.`);
  G.state.set('dev-kyra-talked');
  w.completeObjective('dev-kyra');
  w.setObjective('dev-apfel', 'Pflücke einen Apfel für den Weg.', 'apfelbaum');
}

async function findRing(w: WorldCtx): Promise<void> {
  G.state.give('dev-ring');
  await w.think('Ein Ring, halb im Schlamm. Die Spuren enden genau hier.');
  w.completeObjective('dev-spur');
  w.setObjective('dev-osten', 'Schleiche am Lager vorbei nach Osten.', 'exit-east');
}

async function farmScript(w: WorldCtx): Promise<void> {
  G.state.setParty(['lia', 'flick']);
  w.setObjective('dev-kyra', 'Sprich mit Kyra am Hof.', 'kyra');
  await w.wait(1200);
  w.bark('flick', 'Hübscher Hof. Ruhig hier.');
  await w.waitForInteract('apfelbaum');
  w.completeObjective('dev-apfel');
  w.lookMode.enable(true);
  await w.wait(400);
  await w.say('narrator', `Halte ${w.controlHint('look')} gedrückt: Im Spurenblick leuchten Hinweise türkis auf.`);
  w.setObjective('dev-spur', 'Folge der Spur zum Weiher (Spurenblick).', 'spur-1');
  w.onMap('clue', '*', id => {
    const next: Record<string, string> = { 'spur-1': 'spur-2', 'spur-2': 'spur-3', 'spur-3': 'spur-4', 'spur-4': 'spur-5' };
    if (next[id]) w.setObjectiveTarget(next[id]);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Map 2: forest clearing at night with fireflies
// ---------------------------------------------------------------------------------------------------------------

export const clearing: MapDef = defineMap({
  id: 'world-demo-2',
  name: 'Lichtung im Wald',
  ground: [
    'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
    'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
    'FFFFFF;;;;;;;;;;;;;;;;;FFFFFFF',
    'FFFF;;;;;,,,,,,,,,,;;;;;;FFFFF',
    'FFF;;;;,,,,,,,,,,,,,,,;;;;FFFF',
    'FF;;;;,,,,,,,,,,,,,,,,,,;;;FFF',
    'F;;;;,,,,,,,,,,,,,,,,,,,,;;;FF',
    'pp;;,,,,,,,,,ddd,,,,,,,,,,;;FF',
    ';ppp,,,,,,,,ddddd,,,,,,,,,;;;F',
    ';;;ppp,,,,,,ddddd,,,,,,,,,,;;F',
    ';;;;,pppp,,,,ddd,,,,,,,,,,;;;F',
    'F;;;;,,,,pppp,,,,,,,,,,,,;;;FF',
    'F;;;;;,,,,,,,,,,,,,,,,,,;;;;FF',
    'FF;;;;;,,,,,,,,,,,,,,,,;;;;FFF',
    'FFF;;;;;;,,,,,,,,,,,;;;;;;FFFF',
    'FFFF;;;;;;;;;;;;;;;;;;;;;FFFFF',
    'FFFFFF;;;;;;;;;;;;;;;;;FFFFFFF',
    'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
    'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
    'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
  ],
  decor: {
    jitter: 4,
    legend: { T: 'tree-oak', P: 'tree-pine', D: 'tree-dead', b: 'bush', s: { prop: 'stump', collide: true }, f: { prop: 'flowers-mixed', collide: false } },
    rows: [
      'P T P T P P T P T P P T P T P ',
      ' P T  P P T  P  T P P T P  T P',
      'T P   P               P  T P  ',
      'P  T                     P  T ',
      'T P                       P P ',
      'P T                        T  ',
      ' P                         P T',
      '                            T ',
      '                            P ',
      '                        f   T ',
      'P                           P ',
      ' T         f                T ',
      'P T                        P  ',
      ' P T                     T P  ',
      'P  T P                 P T  P ',
      ' P  T  P  D        P  T  P T  ',
      'T P  T P  T P T P T  P T  P T ',
      ' T P  P T  P  T P  T P  T P  P',
      'P  T P  T P  T  P T  P T  P T ',
      ' P  T P  T  P  T P  T  P T  P ',
    ],
  },
  props: [
    { prop: 'stump', at: [17, 6], id: 'stumpf' },
    { prop: 'log', at: [11, 12] },
    { prop: 'rock', at: [21, 11], variant: 1 },
  ],
  interactables: [
    {
      id: 'stumpf-lesen', at: [17, 6.4], verb: 'Hinsetzen', radius: 20,
      // Lia walks onto the stump and sits there (companions step aside), then gets up again.
      standAt: { anchor: 'sit', prop: 'stumpf' }, face: 'down',
      onInteract: async w => {
        await w.player.play('sit', { ms: 1400 });
        await w.think('Hier könnte man stundenlang lesen. Wenn man nur ein Licht hätte.');
        w.lighting.add({ id: 'urmacht-funke', at: [17, 5.6], kind: 'urmacht', radius: 40, intensity: 0 });
        w.fx.burst([17, 5.6], 'urmacht', 14);
        await w.lighting.get('urmacht-funke').fadeTo(0.9, 900);
        await w.lighting.get('urmacht-funke').fadeTo(0, 1600);
        w.lighting.get('urmacht-funke').remove();
      },
    },
  ],
  lights: [{ at: [6, 2], kind: 'moon', radius: 170, intensity: 0.45 }],
  exits: [{ id: 'exit-west', area: { x: 0, y: 6, w: 1, h: 3 }, to: 'world-demo', spawn: 'east' }],
  spawns: { west: { at: [2, 8], dir: 'right' } },
  time: 'night',
  weather: 'fireflies',
  ambience: ['night', 'crickets', 'wind'],
  ambienceVolume: { wind: 0.4 },
  playerLight: 42,
  onEnter: async w => {
    if (G.state.is('dev-clearing-seen')) return;
    G.state.set('dev-clearing-seen');
    await w.wait(600);
    await w.think('So viele Glühwürmchen … als würden sie auf jemanden warten.');
  },
});

// ---------------------------------------------------------------------------------------------------------------
// Stress map: big, many trees, wandering NPCs, rain
// ---------------------------------------------------------------------------------------------------------------

function stressMap(): MapDef {
  const W = 120, H = 90;
  const ground: string[] = [];
  const decor: string[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < H; y++) {
    let g = '', d = '';
    for (let x = 0; x < W; x++) {
      const pond = Math.hypot(x - 80, y - 50) < 9;
      const shore = Math.hypot(x - 80, y - 50) < 10.5;
      const road = Math.abs(y - 45) < 1.5 || Math.abs(x - 60) < 1.2;
      g += pond ? '~' : shore ? '-' : road ? 'p' : (x * 7 + y * 3) % 11 < 3 ? ',' : (x + y) % 17 === 0 ? ';' : '.';
      d += !pond && !shore && !road && rnd() < 0.07 ? (rnd() < 0.6 ? 'T' : rnd() < 0.5 ? 'P' : 'b') : ' ';
    }
    ground.push(g); decor.push(d);
  }
  return defineMap({
    id: 'world-stress', ground,
    decor: { rows: decor, jitter: 4, legend: { T: 'tree-oak', P: 'tree-pine', b: { prop: 'bush-hide', hide: 'bush' } } },
    npcs: Array.from({ length: 24 }, (_, i) => ({
      id: `npc-${i}`, preset: ['villager-m', 'villager-f', 'merchant', 'bard'][i % 4], at: [20 + (i * 13) % 80, 10 + (i * 7) % 70] as [number, number], wander: 4,
    })),
    guards: [
      { id: 'g1', preset: 'shadow-axe', path: [{ at: [56, 40], wait: 500 }, { at: [66, 40], wait: 500 }, { at: [66, 50] }, { at: [56, 50] }] },
      { id: 'g2', preset: 'shadow-crossbow', lantern: true, path: [{ at: [62, 46], face: 'up' }] },
    ],
    lights: Array.from({ length: 12 }, (_, i) => ({ at: [10 + i * 9, 44] as [number, number], kind: 'lantern' as const })),
    spawns: { default: { at: [60, 47], dir: 'down' } },
    time: 'dusk', weather: 'rain', lookMode: true,
    clues: [{ id: 's-1', at: [58, 48] }, { id: 's-2', at: [57, 50], kind: 'hoof' }],
  });
}

defineChapter({
  id: 'dev-world',
  order: 910,
  numeral: 'Dev',
  title: 'Weltwerkstatt',
  subtitle: 'Erkundungs-Engine',
  hidden: true,
  scenes: [
    {
      id: 'world-demo', title: 'Am Feldrand (Demo)',
      prepare: () => { G.state.setParty(['lia', 'flick']); },
      start: () => startWorld({ map: farmEdge, spawn: 'start', companions: ['flick'], script: farmScript }),
    },
    {
      id: 'world-demo-2', title: 'Lichtung (Demo)',
      start: () => startWorld({ map: clearing, spawn: 'west', companions: ['flick'] }),
    },
    {
      id: 'world-stress', title: 'Belastungstest',
      start: () => startWorld({ map: stressMap(), companions: ['flick', 'kyra'] }),
    },
  ],
});

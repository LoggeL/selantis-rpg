// Hidden dev chapter for the world engine: painted demo maps that exercise every feature, plus a stress test.
// Maps: ./maps.ts (geometry in map pixels). Guide: docs/rebuild/world-guide.md.
import { G } from '../../core/G';
import { defineChapter } from '../../core/registry';
import { defineMap, startWorld, type MapDef } from '../../world';
import { clearing, meadow, meadowScript } from './maps';

// ---------------------------------------------------------------------------------------------------------------
// Stress map: the painted meadow with 24 wandering NPCs and animals, two guards, twelve lanterns, dusk and rain
// ---------------------------------------------------------------------------------------------------------------

const STRESS_CAST = ['villager-m', 'villager-f', 'merchant', 'bard', 'juggler', 'dwarf', 'elf-m', 'elf-f', 'barmaid', 'guard-brotherhood', 'dog', 'chicken'];
/** Rough obstacle boxes of the meadow (oak, pond, hedges, farm tree, log, south-west bush) plus a margin. */
const STRESS_AVOID = [[404, 314, 140, 90], [0, 380, 300, 200], [724, 160, 380, 110], [1110, 180, 170, 100], [830, 0, 150, 90], [1066, 530, 190, 120], [0, 580, 140, 140]];

const stress: MapDef = stressMap();

function stressMap(): MapDef {
  const spots: [number, number][] = [];
  for (let y = 290; y <= 690 && spots.length < 24; y += 46) {
    for (let x = 330 + (y % 92 ? 0 : 40); x <= 1230 && spots.length < 24; x += 118) {
      if (!STRESS_AVOID.some(([ax, ay, aw, ah]) => x > ax && x < ax + aw && y > ay && y < ay + ah)) spots.push([x, y]);
    }
  }
  return defineMap({
    ...meadow,
    id: 'world-stress',
    name: 'Belastungstest',
    npcs: spots.map((at, i) => ({ id: `npc-${i}`, preset: STRESS_CAST[i % STRESS_CAST.length], at, wander: 60 })),
    interactables: [],
    clues: [{ id: 's-1', at: [600, 520] }, { id: 's-2', at: [640, 560], kind: 'hoof' }],
    guards: [
      { id: 'g1', preset: 'shadow-sword', path: [{ at: [700, 420], wait: 500 }, { at: [900, 420], wait: 500 }, { at: [900, 600] }, { at: [700, 600] }] },
      { id: 'g2', preset: 'shadow-crossbow', lantern: true, path: [{ at: [1000, 330], face: 'left' }] },
    ],
    lights: Array.from({ length: 12 }, (_, i) => ({ id: `laterne-${i}`, at: [340 + i * 78, i % 2 ? 470 : 660] as [number, number], kind: 'lantern' as const })),
    exits: [],
    spawns: { default: { at: [600, 640], dir: 'up' } },
    stealth: undefined,
    time: 'dusk', weather: 'rain', lookMode: true,
    onEnter: undefined,
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
      id: 'world-demo', title: 'Die Wiese am Hof (Demo)',
      prepare: () => { G.state.setParty(['lia', 'flick']); },
      start: () => startWorld({ map: meadow, spawn: 'start', companions: ['flick'], script: meadowScript }),
    },
    {
      id: 'world-demo-2', title: 'Lichtung bei Nacht (Demo)',
      prepare: () => { G.state.setParty(['lia', 'flick']); },
      start: () => startWorld({ map: clearing, spawn: 'sued', companions: ['flick'] }),
    },
    {
      id: 'world-stress', title: 'Belastungstest (24 Figuren, Regen)',
      start: () => startWorld({ map: stress, companions: ['flick', 'kyra'] }),
    },
  ],
});

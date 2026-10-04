import type { TerrainId } from '../../art/api';

export const LEGEND: Record<string, TerrainId> = {
  '.': 'grass', ',': 'meadow', ';': 'darkgrass', 'f': 'forest',
  'd': 'dirt', 'p': 'path', 'r': 'road', 'm': 'mud', 's': 'sand',
  'w': 'wheat', 'c': 'crops', 't': 'stubble',
  '~': 'water', '-': 'shallow',
  'S': 'stone', 'C': 'cobble', 'W': 'wood', 'R': 'rug', 'K': 'carpet',
  '#': 'cliff', ' ': 'void',
};

export function parseMap(rows: string[]): TerrainId[][] {
  const w = Math.max(...rows.map(r => r.length));
  return rows.map(r => r.padEnd(w, '.').split('').map(ch => LEGEND[ch] ?? 'grass'));
}

/** 48 x 30: forest edge NW, meadow, path to the farm, pond with ford, wheat field, vegetable beds. */
export const LANDSCAPE = [
  'ffffffffffff;;;;;;.........,,,,,,,,,,,,.........',
  'ffffffffffff;;;;;.........,,,,,,,,,,,,,,........',
  'fffffffffff;;;;;.........,,,,,,wwwwwwwwwwwww....',
  'ffffffffff;;;;;..........,,,,,,wwwwwwwwwwwww....',
  'fffffffff;;;;;;.........,,,,,,,wwwwwwwwwwwww....',
  'ffffffff;;;;;;..........,,,,,,,wwwwwwwwwwwww....',
  'fffffff;;;;;;...........,,,,,,,wwwwwwwwwwwww....',
  'ffffff;;;;;;............,,,,,,,wwwwwwwwwwwww....',
  'fffff;;;;;;.............,,,,,,,,,,,,,,,,,,......',
  'ffff;;;;;;..............,,,,,,,,,,,,,,,,,,......',
  'fff;;;;;...............,,,,,,,,,,ddddddddddd....',
  'ff;;;;;...pppp.........,,,,,,,,,ddddddddddddd...',
  'f;;;;;...pp..ppp.......,,,,,,,,ddddddddddddddd..',
  ';;;;;...pp.....pppp....,,,,,,,pdddddddddddddddd.',
  ';;;;...pp.........pppppppppppppdddddddddddddddd.',
  ';;;...pp...............,,,,,,,pdddddddddddddddd.',
  ';;...pp.................,,,,,,,ddddddddddddddd..',
  ';...pp...................,,,,,,cccccc.ddddddd...',
  '...pp.....................,,,,,cccccc...........',
  '..pp.......................,,,,cccccc..ttttttt..',
  '.pp.....---.................,,,cccccc..ttttttt..',
  'pp....---~~~--..............,,,,,,,,...ttttttt..',
  'p....--~~~~~~~--.............,,,,,,,,,.ttttttt..',
  '....-~~~~~~~~~~~-.............,,,,,,,,,,,,,,,...',
  '...-~~~~~~~~~~~~~-............,,,,,,,,,,,,,,,,..',
  '...-~~~~~~~~~~~~~~-............,,,,,,,,,,,,,,,..',
  '....-~~~~~~~~~~~~-...............,,,,,,,,,,,,...',
  '.....--~~~~~~~~--..................,,,,,,,,,....',
  '.......--~~~~--.................................',
  '.........----...................................',
];

/** 26 x 16 tavern-ish interior: plank floor, rug, flagstone hearth, carpet runner. */
export const INTERIOR = [
  '##########################',
  '##########################',
  'WWWWWWWWWWWWWWWWSSSSSSWWWW',
  'WWWWWWWWWWWWWWWWSSSSSSWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWRRRRRRRWWWWWWWWWWWWWWW',
  'WWWWRRRRRRRWWWWWWWWWWWWWWW',
  'WWWWRRRRRRRWWWWWKKKKKKKKWW',
  'WWWWRRRRRRRWWWWWKKKKKKKKWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWW',
  'CCCCCCCCCCCCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCCCCCCCCCCCC',
  'mmmmmmssssssrrrrrrrrrrrrrr',
  'mmmmmmssssssrrrrrrrrrrrrrr',
];

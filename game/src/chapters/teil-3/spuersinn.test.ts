import { describe, expect, it } from 'vitest';
import type { ClueDef, Polygon } from '../../world';
import { pointInPoly } from '../../world/poly';
import { CLEARING_WALK } from './lichtwald';
import { OH_WALK } from './ordenshaus';
import { KANAL_WALK } from './kyras-fluchtweg-keller';
import { ROAD_WALK, TRAPAS_WALK } from './paladine-orte';
import { RAST_WALK } from './vertraute-schwester-rast';

import {
  KANAL_CLUES, LANDSTRASSE_CLUES, LICHTWALD_CLUES, NO_LOOK, ORDENSHAUS_CLUES, PLATZ_CLUES, TRAPAS_CLUES, WALDRAST_CLUES,
} from './spuersinn';

type Pt = readonly [number, number];
const PLACES: [string, ClueDef[], readonly Polygon[]][] = [
  ['e3-lichtwald', LICHTWALD_CLUES, CLEARING_WALK], ['e3-landstrasse', LANDSTRASSE_CLUES, ROAD_WALK],
  ['e3-trapas', TRAPAS_CLUES, TRAPAS_WALK], ['e3-ordenshaus', ORDENSHAUS_CLUES, OH_WALK], ['e3-keller-kanal', KANAL_CLUES, KANAL_WALK],
  ['e3-waldrast', WALDRAST_CLUES, RAST_WALK], ['e3-trapas-zeremonie', PLATZ_CLUES, TRAPAS_WALK],
];

describe('Lia’s Spürsinn in Teil III', () => {
  it('hides every clue on ground Lia can reach', () => {
    for (const [map, clues, walk] of PLACES) {
      for (const c of clues) {
        const [x, y] = c.at as Pt;
        expect(walk.some(p => pointInPoly(x, y, p)), `${map} ${c.id}`).toBe(true);
      }
    }
  });

  it('gives every clue a thought that fits one box, and every closed place a reason', () => {
    for (const [, clues] of PLACES) for (const c of clues) expect((c.thought ?? '').length, c.id).toBeGreaterThan(20);
    for (const [, clues] of PLACES) for (const c of clues) expect((c.thought ?? '').length, c.id).toBeLessThanOrEqual(140);
    for (const t of Object.values(NO_LOOK)) expect(t.length).toBeLessThanOrEqual(80);
  });
});

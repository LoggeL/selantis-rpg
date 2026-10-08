import { describe, expect, it } from 'vitest';
import { lightSplits, TWINS } from './wiege';

describe('Wem gebe ich sie?', () => {
  it('whichever child Valentus picks, the light splits into both', () => {
    expect(TWINS.map(t => t.id)).toEqual(['still', 'laut']);
    for (const t of TWINS) expect(lightSplits(t.id)).toContain('teilt sich');
  });
});

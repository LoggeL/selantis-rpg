import { describe, expect, it } from 'vitest';
import manifestJson from '../../public/assets/manifest.json';
import { DEFAULT_SPEAKERS } from './speakers';

const manifest = manifestJson as unknown as { portraits: Record<string, Record<string, string>> };

/** Speakers that intentionally show the hooded fallback (no face in book 1) or no portrait at all. */
const NO_PORTRAIT = new Set(['narrator', 'leichenfresser']);

describe('default speakers', () => {
  it('every speaker resolves to a painted portrait in the asset manifest', () => {
    const missing = DEFAULT_SPEAKERS
      .filter(s => !NO_PORTRAIT.has(s.id))
      .map(s => s.portrait ?? s.id)
      .filter(id => !manifest.portraits[id]);
    expect(missing).toEqual([]);
  });
});

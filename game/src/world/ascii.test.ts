import { describe, expect, it } from 'vitest';
import { parseGround, scanLayer, terrainSpeed, terrainStep } from './ascii';

describe('parseGround', () => {
  it('maps chars via the default legend', () => {
    const g = parseGround(['.,~', 'pd-']);
    expect(g.cols).toBe(3);
    expect(g.rows).toBe(2);
    expect(g.terrain[0]).toEqual(['grass', 'meadow', 'water']);
    expect(g.terrain[1]).toEqual(['path', 'dirt', 'shallow']);
    expect(g.warnings).toEqual([]);
  });
  it('lets the legend override defaults', () => {
    const g = parseGround(['.X'], { '.': 'forest', X: 'cobble' });
    expect(g.terrain[0]).toEqual(['forest', 'cobble']);
  });
  it('pads short rows and warns about unknown chars', () => {
    const g = parseGround(['...', '.'], {}, 'dirt');
    expect(g.terrain[1]).toEqual(['grass', 'dirt', 'dirt']);
    expect(g.warnings.some(w => w.includes('padded'))).toBe(true);
    const u = parseGround(['.?.']);
    expect(u.terrain[0][1]).toBe('grass');
    expect(u.warnings).toContain("unknown ground char '?'");
  });
  it('handles unicode chars as single tiles', () => {
    const g = parseGround(['äö'], { ä: 'sand', ö: 'mud' });
    expect(g.cols).toBe(2);
    expect(g.terrain[0]).toEqual(['sand', 'mud']);
  });
});

describe('scanLayer', () => {
  it('skips spaces and dots', () => {
    const found: string[] = [];
    scanLayer([' T.', 'b  '], (ch, x, y) => found.push(`${ch}${x}${y}`));
    expect(found).toEqual(['T10', 'b01']);
  });
});

describe('terrain helpers', () => {
  it('slows in shallow water and maps footstep sounds', () => {
    expect(terrainSpeed('shallow')).toBeLessThan(1);
    expect(terrainSpeed('grass')).toBe(1);
    expect(terrainStep('wood')).toBe('step-wood');
    expect(terrainStep('path')).toBe('step-dirt');
    expect(terrainStep('shallow')).toBe('step-water');
    expect(terrainStep('meadow')).toBe('step-grass');
  });
});

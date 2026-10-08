import { describe, expect, it } from 'vitest';
import { anchorThought, ANCHORS, ANCHORS_NEEDED } from './pruefung-anker';

describe('Woran hältst du dich?', () => {
  it('offers enough of Lia’s own anchors and as many hands from outside', () => {
    const own = ANCHORS.filter(a => a.self);
    expect(own.length).toBeGreaterThanOrEqual(ANCHORS_NEEDED);
    expect(ANCHORS.length - own.length).toBeGreaterThanOrEqual(3);
    expect(new Set(ANCHORS.map(a => a.id)).size).toBe(ANCHORS.length);
  });

  it('Lia’s thought afterwards follows how often she reached outside', () => {
    expect(anchorThought(0)).toContain('Nur an mir');
    expect(anchorThought(1)).toContain('Einmal');
    expect(anchorThought(3)).toContain('zurückgegriffen');
  });
});

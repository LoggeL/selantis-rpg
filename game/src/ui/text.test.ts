import { describe, expect, it } from 'vitest';
import { bubbleDuration, parseMarkup, revealSchedule, shouldBlip, stripMarkup, toRoman } from './text';

describe('parseMarkup', () => {
  it('splits emphasis and magic', () => {
    expect(parseMarkup('Die *alte* ~Urmacht~.')).toEqual([
      { text: 'Die ', style: 'plain' }, { text: 'alte', style: 'em' }, { text: ' ', style: 'plain' },
      { text: 'Urmacht', style: 'magic' }, { text: '.', style: 'plain' },
    ]);
  });
  it('keeps lone markers literal and supports escapes and line breaks', () => {
    expect(stripMarkup('5 * 3')).toBe('5 * 3');
    expect(stripMarkup('a \\*b\\* c')).toBe('a *b* c');
    expect(parseMarkup('a\nb').map(s => s.style)).toEqual(['plain', 'br', 'plain']);
  });
});

describe('revealSchedule', () => {
  it('is instant at speed 0', () => {
    expect(revealSchedule([...'Hallo.'], 0)).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it('is monotonic and pauses after sentence ends', () => {
    const chars = [...'Ja. Nein'];
    const t = revealSchedule(chars, 50);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    const gapAfterDot = t[3] - t[2];
    const normalGap = t[6] - t[5];
    expect(gapAfterDot).toBeGreaterThan(normalGap * 3);
  });
  it('only pauses at the end of an ellipsis made of dots', () => {
    const t = revealSchedule([...'a... b'], 40);
    expect(t[2] - t[1]).toBeLessThan(40);
    expect(t[4] - t[3]).toBeGreaterThan(100);
  });
  it('pauses after punctuation followed by a closing quote', () => {
    const t = revealSchedule([...'„Halt!“ rief'], 45);
    expect(t[6] - t[5]).toBeGreaterThan(100);
  });
});

describe('misc', () => {
  it('blips on every other letter only', () => {
    expect(shouldBlip('a', 0)).toBe(true);
    expect(shouldBlip('ä', 2)).toBe(true);
    expect(shouldBlip('a', 1)).toBe(false);
    expect(shouldBlip(' ', 0)).toBe(false);
    expect(shouldBlip('.', 0)).toBe(false);
  });
  it('converts roman numerals', () => {
    expect(toRoman(4)).toBe('IV');
    expect(toRoman('12')).toBe('XII');
    expect(toRoman('Prolog')).toBe('Prolog');
  });
  it('scales bubble duration with length', () => {
    expect(bubbleDuration('Hm.')).toBeLessThan(bubbleDuration('Das ist ein sehr viel längerer Satz für eine Sprechblase.'));
  });
});

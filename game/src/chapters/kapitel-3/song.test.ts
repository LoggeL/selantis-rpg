import { describe, expect, it } from 'vitest';
import { BEATS_PER_LINE, BEATS_PER_VERSE, beatPosition, REST_BEATS, VERSES } from './song';

describe('Waffenknechtlied beat clock', () => {
  it('walks through the lines of a verse', () => {
    expect(beatPosition(0)).toEqual({ verse: 0, line: 0, beatInLine: 0, rest: false });
    expect(beatPosition(BEATS_PER_LINE + 1)).toEqual({ verse: 0, line: 1, beatInLine: 1, rest: false });
  });

  it('rests between verses and then starts the next verse', () => {
    const restStart = BEATS_PER_VERSE - REST_BEATS;
    expect(beatPosition(restStart).rest).toBe(true);
    expect(beatPosition(BEATS_PER_VERSE)).toEqual({ verse: 1, line: 0, beatInLine: 0, rest: false });
  });

  it('loops back to the first verse', () => {
    expect(beatPosition(BEATS_PER_VERSE * VERSES.length).verse).toBe(0);
  });

  it('has eight sung lines per verse', () => {
    for (const v of VERSES) expect(v).toHaveLength(8);
  });
});

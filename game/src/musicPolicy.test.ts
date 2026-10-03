import { describe, expect, it } from 'vitest';
import { MUSIC_TRACKS, musicForScene } from './musicPolicy';

describe('music follows the story', () => {
  it('uses menace for the raid and grief after the loss, including the road east', () => {
    expect(musicForScene('battle')).toBe('battle');
    expect(musicForScene('raid')).toBe('dread');
    expect(musicForScene('aftermath')).toBe('grief');
    expect(musicForScene('journey')).toBe('grief');
    expect(MUSIC_TRACKS.battle).toContain('battle-dark');
  });

  it('keeps peaceful music for the meadow and actual refuge', () => {
    expect(musicForScene('lia')).toBe('exploration');
    expect(musicForScene('world')).toBe('exploration');
    expect(musicForScene('refuge')).toBe('refuge');
  });

  it('holds a story override across repeated frame syncs and resumes the default when cleared', () => {
    for (let frame = 0; frame < 120; frame++) {
      expect(musicForScene('world', 'dread')).toBe('dread');
      expect(musicForScene('raid', 'grief')).toBe('grief');
      expect(musicForScene('journey', 'refuge')).toBe('refuge');
    }
    expect(musicForScene('world', undefined)).toBe('exploration');
    expect(musicForScene('world', 'invalid')).toBe('exploration');
    expect(musicForScene('world', 'toString')).toBe('exploration');
  });

  it('lets settings and overlays keep the underlying scene music', () => {
    expect(musicForScene('settings', 'dread')).toBeUndefined();
    expect(musicForScene('title')).toBeUndefined();
    expect(musicForScene('toString')).toBeUndefined();
  });
});

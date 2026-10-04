import { describe, expect, it } from 'vitest';
import { MUSIC_TRACKS } from './tracks';
import {
  canStart, LOOP_TAIL_S, loopAt, loopFadeOutMs, LoopWatch, nextAction, RETRY_AFTER_MS, resumePosition,
} from './musicLogic';

describe('music requests', () => {
  it('defers everything until the audio context exists', () => {
    expect(nextAction({ attached: false, playing: null }, 'battle')).toBe('defer');
    expect(nextAction({ attached: false, playing: null }, null)).toBe('defer');
  });

  it('keeps the same mood playing, restarts only on request', () => {
    const view = { attached: true, playing: 'exploration' as const };
    expect(nextAction(view, 'exploration')).toBe('noop');
    expect(nextAction(view, 'exploration', true)).toBe('restart');
    expect(nextAction(view, 'battle')).toBe('crossfade');
    expect(nextAction(view, null)).toBe('fade-out');
  });

  it('starts a mood when nothing (or a failed track) is playing', () => {
    expect(nextAction({ attached: true, playing: null }, 'grief')).toBe('crossfade');
    expect(nextAction({ attached: true, playing: null }, null)).toBe('noop');
  });

  it('waits 30 s before retrying a track that failed to load', () => {
    expect(canStart(undefined, 0)).toBe(true);
    expect(canStart(1000, 1000 + RETRY_AFTER_MS - 1)).toBe(false);
    expect(canStart(1000, 1000 + RETRY_AFTER_MS)).toBe(true);
  });
});

describe('music loop', () => {
  it('has a loop tail for every authored track', () => {
    for (const mood of [...Object.keys(MUSIC_TRACKS), 'tavern'] as (keyof typeof LOOP_TAIL_S)[]) {
      expect(LOOP_TAIL_S[mood]).toBeGreaterThan(2);
      expect(loopFadeOutMs(mood)).toBeGreaterThan(LOOP_TAIL_S[mood] * 500);
    }
  });

  it('starts the loop crossfade before the fade-out tail', () => {
    const at = loopAt('exploration', 119.75)!;
    expect(at).toBeLessThan(119.75 - LOOP_TAIL_S.exploration);
    expect(at).toBeGreaterThan(110);
    expect(loopAt('dread', 115)).toBeLessThan(loopAt('battle', 115)!); // long dread tail
    expect(loopAt('battle', Number.NaN)).toBeNull();
    expect(loopAt('battle', 10)).toBeNull();
  });

  it('fires the loop exactly once per track (regression)', () => {
    const watch = new LoopWatch('tavern');
    const dur = 115.67;
    const at = loopAt('tavern', dur)!;
    const fired = [0, 50, at - 0.3, at + 0.01, at + 0.26, at + 0.5, dur - 1, dur].map(t => watch.update(t, dur));
    expect(fired.filter(Boolean).length).toBe(1);
    expect(fired[3]).toBe(true);
    expect(watch.ended()).toBe(false); // the 'ended' event afterwards must not loop again
  });

  it('loops on ended when no timeupdate reached the loop point', () => {
    const watch = new LoopWatch('battle');
    expect(watch.update(5, Number.NaN)).toBe(false);
    expect(watch.ended()).toBe(true);
    expect(watch.ended()).toBe(false);
  });

  it('resumes calm moods only well before the loop point', () => {
    expect(resumePosition('exploration', 40, 119.75)).toBe(40);
    expect(resumePosition('exploration', 113, 119.75)).toBeNull();
    expect(resumePosition('battle', 40, 131)).toBeNull(); // dramatic moods start fresh
    expect(resumePosition('refuge', undefined, 113)).toBeNull();
    expect(resumePosition('tavern', 0, 115)).toBeNull();
  });
});

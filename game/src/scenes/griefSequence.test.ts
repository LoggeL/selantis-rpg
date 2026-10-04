import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../audio', () => ({ sfx: { select: vi.fn() } }));

import { AftermathScene } from './AftermathScene';
import { AFTERMATH_GRIEF_BEATS, needsAftermathGrief } from '../story/grief';
import { updateSettings } from '../settings';
import type { WorldState } from '../world/quests';

function fixture(flags: Record<string, boolean> = {}, entry: { from?: string; at?: [number, number] } = {}) {
  const s: any = new AftermathScene();
  const st: WorldState = { flags: { ...flags }, inv: {}, picked: {} };
  const data = new Map<string, unknown>();
  const fades: Array<() => void> = [];
  const black: any = {};
  for (const method of ['setDepth', 'setScrollFactor', 'setAlpha', 'destroy']) black[method] = vi.fn(() => black);
  s.registry = { get: () => st };
  s.data = { set: (key: string | Record<string, unknown>, value: unknown) => {
    if (typeof key === 'string') data.set(key, value);
    else for (const [name, item] of Object.entries(key)) data.set(name, item);
  } };
  s.add = { rectangle: vi.fn(() => black) };
  s.inventory = { close: vi.fn() };
  s.tweens = { add: vi.fn((config: { onComplete: () => void }) => fades.push(config.onComplete)) };
  for (const method of ['begin', 'configure', 'say', 'setLocked', 'setCinematic', 'setLiaPose', 'showCloseup', 'hideCloseup', 'setCloseupText', 'setCloseupContinue', 'setSpots']) s[method] = vi.fn();
  const flush = () => { while (fades.length) fades.shift()!(); };
  const progress = () => data.get('story:grief') as { active: boolean; index: number; step: string; phase: string; ready: boolean };
  const next = () => {
    const callback = s.setCloseupContinue.mock.calls.at(-1)?.[0];
    expect(typeof callback).toBe('function');
    callback();
  };
  s.create(entry);
  return { s, st, black, progress, flush, next };
}

afterEach(() => updateSettings({ reducedMotion: false }));

describe('Lia has a full night and a quiet morning before packing', () => {
  it('holds each grief beat for input and fades from the night to the finished graves', () => {
    updateSettings({ reducedMotion: false });
    const { s, st, black, progress, flush, next } = fixture();
    expect(s.setLocked).toHaveBeenLastCalledWith(true);
    expect(s.setCinematic).toHaveBeenLastCalledWith(true);
    expect(s.setSpots).toHaveBeenLastCalledWith([]);
    for (const [index, beat] of AFTERMATH_GRIEF_BEATS.entries()) {
      expect(progress()).toMatchObject({ active: true, index, step: beat.id, phase: beat.phase });
      expect(s.setCloseupText).toHaveBeenLastCalledWith(beat.line);
      if (beat.id === 'dawn-graves') {
        expect(progress().ready).toBe(false);
        expect(s.setCloseupContinue).toHaveBeenLastCalledWith(null);
        expect(s.showCloseup).toHaveBeenLastCalledWith('cut-family-graves', { fit: 'contain' });
        expect(s.tweens.add).toHaveBeenCalledOnce();
      }
      flush();
      expect(progress().ready).toBe(true);
      expect(st.flags.aftermathGriefSeen).toBeUndefined();
      const stable = progress();
      flush();
      expect(progress()).toEqual(stable);
      next();
    }
    expect(progress()).toMatchObject({ active: false, step: 'complete', ready: false });
    expect(st.flags.aftermathGriefSeen).toBe(true);
    expect(st.picked).toEqual({});
    expect(st.inv).toEqual({});
    expect(s.configure).toHaveBeenCalledTimes(2);
    expect(s.setLocked).toHaveBeenLastCalledWith(false);
    expect(s.setCinematic).toHaveBeenLastCalledWith(false);
    expect(s.hideCloseup).toHaveBeenCalledOnce();
    expect(black.destroy).toHaveBeenCalledOnce();
  });

  it('ignores repeated callbacks for the same card and supports reduced motion without losing a beat', () => {
    updateSettings({ reducedMotion: true });
    const { s, st, black, progress, next } = fixture();
    const first = s.setCloseupContinue.mock.calls.at(-1)[0];
    first(); first();
    expect(progress()).toMatchObject({ index: 1, step: 'night-wounds' });
    let consumed: () => void = first;
    for (let index = 1; index < AFTERMATH_GRIEF_BEATS.length; index++) {
      consumed = s.setCloseupContinue.mock.calls.at(-1)[0];
      next();
    }
    expect(st.flags.aftermathGriefSeen).toBe(true);
    expect(s.tweens.add).not.toHaveBeenCalled();
    expect(black.setAlpha).toHaveBeenCalledExactlyOnceWith(0);
    consumed(); // The final consumed callback cannot replay the ending.
    expect(s.configure).toHaveBeenCalledTimes(2);
  });

  it('keeps return journeys, completed introductions and older farm saves in exploration', () => {
    for (const [flags, entry] of [
      [{ aftermathGriefSeen: true }, {}], [{ packedFood: true }, {}], [{ pigsReleased: true }, {}],
      [{}, { from: 'felder' }], [{}, { at: [273, 182] as [number, number] }],
    ] as [Record<string, boolean>, { from?: string; at?: [number, number] }][]) {
      const { s, progress } = fixture(flags, entry);
      expect(progress().active).toBe(false);
      expect(s.setCloseupText).not.toHaveBeenCalled();
      expect(s.add.rectangle).not.toHaveBeenCalled();
      expect(s.configure).toHaveBeenCalledOnce();
    }
    expect(needsAftermathGrief({ flags: {}, inv: {}, picked: { 'farewell-father': true } })).toBe(false);
  });
});

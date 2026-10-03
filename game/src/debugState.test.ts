import { describe, expect, it } from 'vitest';
import { prepareWarp, editFlag, editItem, DebugPause } from './debugState';

it('rejects unknown flags and invalid item amounts without mutating state', () => {
  const st = { inv: {}, picked: {}, flags: {} };
  expect(editFlag(st, '__proto__', true)).toBe(false);
  expect(editFlag(st, 'packedWater', true)).toBe(true);
  for (const value of [NaN, Infinity, -1, 1.5, 1000]) expect(editItem(st, 'proviant', value)).toBe(false);
  expect(editItem(st, '__proto__', 1)).toBe(false);
  expect(editItem(st, 'proviant', 3)).toBe(true);
  expect(st.inv).toEqual({ proviant: 3 });
});

it('pauses input and clears held keys, restoring only the original state', () => {
  let clears = 0;
  const scene = { input: { enabled: true, keyboard: { enabled: true, resetKeys: () => { clears++; } } } };
  const pause = new DebugPause();
  pause.hold(scene);
  expect(scene.input.enabled).toBe(false);
  expect(scene.input.keyboard.enabled).toBe(false);
  pause.hold(scene);
  pause.release(scene);
  expect(scene.input.enabled).toBe(true);
  expect(scene.input.keyboard.enabled).toBe(true);
  expect(clears).toBe(2);
});

describe('playtest checkpoints', () => {
  it('prepares a coherent camp and removes later progress without deleting optional finds', () => {
    const st = { inv: { feder: 2 }, picked: { feather: true as const }, flags: { criosObserved: true, metFoltanAzar: true, chickReturned: true } };
    expect(prepareWarp(st, 'camp')).toEqual({ scene: 'journey', data: {} });
    expect(st.flags).toMatchObject({ departureReady: true, journeyCampReached: true, metFoltanAzar: false, criosObserved: false, chickReturned: true });
    expect(st.inv).toMatchObject({ feder: 2, proviant: 1, wasserschlauch: 1 });
  });
});

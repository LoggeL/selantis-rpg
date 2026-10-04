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


it('clears completed camp construction and resources when replaying a checkpoint', () => {
  const st = { inv: { steine: 12, zunderholz: 3, feder: 2 }, picked: {}, flags: { journeyStonesGathered: true, journeyFirepitBuilt: true, journeyProviantPortionUsed: true } };
  prepareWarp(st, 'camp');
  expect(st.flags).toMatchObject({ journeyStonesGathered: false, journeyFirepitBuilt: false, journeyTwigsGathered: false, journeyProviantPortionUsed: false, campfireLit: false, firstCampRested: false });
  expect(st.inv).not.toHaveProperty('steine'); expect(st.inv).not.toHaveProperty('zunderholz');
  expect(st.inv).toMatchObject({ feder: 2, proviant: 1, reisezeug: 1 });
  prepareWarp(st, 'strangers');
  expect(st.flags).toMatchObject({ journeyStonesGathered: true, journeyFirepitBuilt: true, journeyTwigsGathered: true, journeyProviantPortionUsed: true, campfireLit: true, journeyAte: true, firstCampRested: true, metFoltanAzar: true, criosObserved: false });
  expect(st.inv).not.toHaveProperty('steine'); expect(st.inv).not.toHaveProperty('zunderholz');
  st.inv.steine = 6; st.inv.zunderholz = 1;
  prepareWarp(st, 'road');
  expect(st.inv).not.toHaveProperty('steine'); expect(st.inv).not.toHaveProperty('zunderholz');
  expect(st.flags).toMatchObject({ journeyCampReached: false, journeyStonesGathered: false, journeyFirepitBuilt: false, journeyProviantPortionUsed: false });
});

it('starts the next morning with the camp complete and clears it on an earlier warp', () => {
  const st = { inv: { feder: 2 }, picked: {}, flags: {} };
  expect(prepareWarp(st, 'companions-road')).toEqual({ scene: 'companions-road', data: {} });
  expect(st.flags).toMatchObject({ metFoltanAzar: true, criosObserved: true, companionRestTaken: false, companionDayComplete: false });
  expect(st.inv).toMatchObject({ reisezeug: 1, wasserschlauch: 1, feder: 2 });
  prepareWarp(st, 'camp');
  expect(st.flags).toMatchObject({ companionMorningStarted: false, companionRestTaken: false, companionDayComplete: false });
});

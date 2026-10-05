import { describe, expect, it } from 'vitest';
import { fireConfig, inZone, newFire, press, resetAttempt, tick, zoneWidth } from './feuerLogic';

describe('fire drilling rules', () => {
  it('is harder without tinder', () => {
    const easy = fireConfig(true), hard = fireConfig(false);
    expect(hard.zone).toBeLessThan(easy.zone);
    expect(hard.speed).toBeGreaterThan(easy.speed);
    expect(hard.cool).toBeGreaterThan(easy.cool);
    expect(Math.ceil(100 / hard.gain)).toBeGreaterThan(Math.ceil(100 / easy.gain));
  });

  it('needle bounces between 0 and 1', () => {
    const s = newFire(), c = fireConfig(true);
    for (let i = 0; i < 500; i++) {
      tick(s, c, 0.05);
      expect(s.pos).toBeGreaterThanOrEqual(0);
      expect(s.pos).toBeLessThanOrEqual(1);
    }
    s.pos = 0.95; s.dir = 1;
    tick(s, c, 0.2);
    expect(s.dir).toBe(-1);
  });

  it('good presses build heat to an ember', () => {
    const s = newFire(), c = fireConfig(true);
    let result = '';
    for (let i = 0; i < 10 && result !== 'ember'; i++) {
      s.pos = s.zoneAt;
      result = press(s, c, i / 10);
      expect(['hit', 'ember']).toContain(result);
    }
    expect(result).toBe('ember');
    expect(s.heat).toBe(100);
  });

  it('the next zone moves and stays on the track', () => {
    const s = newFire(), c = fireConfig(false);
    for (const r of [0, 0.5, 0.99, 0.2]) {
      const before = s.zoneAt;
      s.pos = s.zoneAt;
      press(s, c, r);
      const w = zoneWidth(s, c);
      expect(s.zoneAt - w / 2).toBeGreaterThanOrEqual(0);
      expect(s.zoneAt + w / 2).toBeLessThanOrEqual(1);
      expect(Math.abs(s.zoneAt - before)).toBeGreaterThan(0.05);
    }
  });

  it('three slips fail an attempt, the third failed attempt sparks', () => {
    const s = newFire(), c = fireConfig(false);
    const slipOnce = () => { s.pos = s.zoneAt > 0.5 ? 0 : 1; expect(inZone(s, c)).toBe(false); return press(s, c, 0.3); };
    expect(slipOnce()).toBe('slip');
    expect(slipOnce()).toBe('slip');
    expect(slipOnce()).toBe('failed');
    resetAttempt(s);
    slipOnce(); slipOnce();
    expect(slipOnce()).toBe('failed');
    resetAttempt(s);
    slipOnce(); slipOnce();
    expect(slipOnce()).toBe('spark');
    expect(s.failed).toBe(3);
  });

  it('heat cools down over time', () => {
    const s = newFire(), c = fireConfig(false);
    s.heat = 50;
    tick(s, c, 1);
    expect(s.heat).toBeCloseTo(50 - c.cool, 5);
    tick(s, c, 100);
    expect(s.heat).toBe(0);
  });
});

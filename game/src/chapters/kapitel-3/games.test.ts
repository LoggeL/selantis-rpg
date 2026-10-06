import { describe, expect, it } from 'vitest';
import { BEAT_WINDOW_MS, blowConfig, blowStart, blowStep, stakeStart, stakeStep, stakeTug } from './games';

describe('Sanft pusten', () => {
  it('catches when the breath is held inside the zone', () => {
    const cfg = blowConfig(false);
    let s = blowStart();
    let caught = false;
    for (let i = 0; i < 600 && !caught; i++) {
      const adjustment = Math.abs(s.breath - ((cfg.lo + cfg.hi) / 2 + s.drift)) < 0.025 ? 0 : s.breath < (cfg.lo + cfg.hi) / 2 + s.drift ? 1 : -1;
      const r = blowStep(s, 1 / 60, adjustment, cfg);
      s = r.state;
      caught = r.event === 'catch';
    }
    expect(caught).toBe(true);
  });

  it('blowing too hard puts the glow out', () => {
    const cfg = blowConfig(false);
    let s = { ...blowStart(), ember: 0.6 };
    let puffed = false;
    for (let i = 0; i < 240 && !puffed; i++) { const r = blowStep(s, 1 / 60, 1, cfg); s = r.state; puffed = r.event === 'puff'; }
    expect(puffed).toBe(true);
    expect(s.ember).toBeLessThan(0.6);
  });

  it('tinder widens the zone', () => {
    const a = blowConfig(false), b = blowConfig(true);
    expect(b.hi - b.lo).toBeGreaterThan(a.hi - a.lo);
    expect(b.needSec).toBeLessThan(a.needSec);
  });

  it('no adjustment does not produce fire, and lowering the airflow weakens it', () => {
    const cfg = blowConfig(false);
    expect(blowStep(blowStart(), 30, 0, cfg).state.ember).toBe(0);
    expect(blowStep({ ...blowStart(), breath: 0.8 }, 0.2, -1, cfg).state.breath).toBeLessThan(0.8);
  });
});

describe('Der Pflock', () => {
  it('tugs on the beat loosen the stake', () => {
    const r = stakeTug(stakeStart(), 1000 + BEAT_WINDOW_MS - 10, 1000, 1660, false);
    expect(r.result).toBe('hit');
    expect(r.state.loose).toBeGreaterThan(0);
  });

  it('off-beat and rest tugs make noise', () => {
    expect(stakeTug(stakeStart(), 1330, 1000, 1660, false).result).toBe('miss');
    const rest = stakeTug(stakeStart(), 1000, 1000, 1660, true);
    expect(rest.result).toBe('rest');
    expect(rest.state.noise).toBeGreaterThan(0.4);
  });

  it('a soldier looks over at full noise; tugging then is caught', () => {
    let s = { ...stakeStart(), noise: 1, loose: 0.5 };
    const look = stakeStep(s, 0.016);
    expect(look.event).toBe('look');
    s = look.state;
    const r = stakeTug(s, 1000, 1000, 1660, false);
    expect(r.result).toBe('caught');
    expect(r.state.loose).toBeLessThan(0.5);
  });

  it('the soldier turns away again', () => {
    let s = { ...stakeStart(), watch: 0.1 };
    const r = stakeStep(s, 0.2);
    s = r.state;
    expect(r.event).toBe('away');
    expect(s.watch).toBe(0);
  });

  it('about fifteen good tugs free Kyra', () => {
    let s = stakeStart();
    let n = 0;
    while (s.loose < 1 && n < 40) { s = stakeTug(s, 1000, 1000, 1660, false).state; n++; }
    expect(n).toBeGreaterThan(9);
    expect(n).toBeLessThan(18);
  });
});

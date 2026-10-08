import { describe, expect, it } from 'vitest';
import { BEAT_WINDOW_MS, stakeStart, stakeStep, stakeTug } from './games';

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

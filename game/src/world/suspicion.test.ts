import { describe, expect, it } from 'vitest';
import { DEFAULT_SUSPICION, newSuspicion, riseRate, stepSuspicion } from './suspicion';

function run(s: ReturnType<typeof newSuspicion>, seconds: number, input: { visible: boolean; closeness: number; sneaking?: boolean }) {
  const ev: string[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) ev.push(...stepSuspicion(s, { ...input, dt: 1 / 60 }));
  return ev;
}

describe('suspicion', () => {
  it('rises to suspicious then alert when exposed', () => {
    const s = newSuspicion();
    const ev = run(s, 3, { visible: true, closeness: 0.5 });
    expect(ev).toEqual(['suspicious', 'alert']);
    expect(s.level).toBe('alert');
  });
  it('takes roughly the reaction time at mid range', () => {
    const s = newSuspicion();
    run(s, DEFAULT_SUSPICION.reaction * 0.9, { visible: true, closeness: 0.5 });
    expect(s.level).not.toBe('alert');
    run(s, DEFAULT_SUSPICION.reaction * 0.3, { visible: true, closeness: 0.5 });
    expect(s.level).toBe('alert');
  });
  it('closer is faster, sneaking slower', () => {
    expect(riseRate(1, DEFAULT_SUSPICION)).toBeGreaterThan(riseRate(0.2, DEFAULT_SUSPICION));
    expect(riseRate(0.5, DEFAULT_SUSPICION, true)).toBeLessThan(riseRate(0.5, DEFAULT_SUSPICION));
  });
  it('decays after the memory time and calms down', () => {
    const s = newSuspicion();
    run(s, 0.6, { visible: true, closeness: 0.3 });
    expect(s.level).toBe('suspicious');
    const v = s.value;
    run(s, DEFAULT_SUSPICION.memory * 0.8, { visible: false, closeness: 0 });
    expect(s.value).toBe(v);
    const ev = run(s, 5, { visible: false, closeness: 0 });
    expect(ev).toContain('calm');
    expect(s.value).toBe(0);
  });
  it('stays alert once spotted', () => {
    const s = newSuspicion();
    run(s, 4, { visible: true, closeness: 1 });
    run(s, 10, { visible: false, closeness: 0 });
    expect(s.level).toBe('alert');
  });
});

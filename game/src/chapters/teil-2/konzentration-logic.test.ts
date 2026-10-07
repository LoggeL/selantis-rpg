import { describe, expect, it } from 'vitest';
import {
  breathAt, cycleLength, makeThought, pullAt, sammlungConfig, sammlungConfirm, sammlungGrab, sammlungStart, sammlungStep,
  thoughtPos, THOUGHT_WORDS, type SammlungConfig, type SammlungInput, type SammlungState,
} from './konzentration-logic';

const DT = 1 / 60;

function run(s: SammlungState, seconds: number, cfg: SammlungConfig, input: (s: SammlungState) => SammlungInput = () => ({})) {
  const events: string[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const r = sammlungStep(s, DT, input(s), cfg);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}

/** Keyboard player: steers straight back to the centre. */
const centre = (s: SammlungState): SammlungInput => {
  const d = Math.hypot(s.x, s.y);
  return d < 0.04 ? {} : { dx: -s.x / d, dy: -s.y / d };
};

/** Plays like a calm player: keeps the light centred and lets go once the breath is full. */
function playCalm(cfg: SammlungConfig, limit = 120) {
  let s = sammlungStart(cfg);
  for (let i = 0; i < limit / DT && !s.done; i++) {
    s = sammlungStep(s, DT, centre(s), cfg).state;
    if (breathAt(s.bt, cfg).phase === 'full' && Math.hypot(s.x, s.y) < cfg.calmRadius * 0.8) s = sammlungConfirm(s, cfg).state;
  }
  return s;
}

describe('Sammlung: breath', () => {
  const cfg = sammlungConfig();

  it('fills, stays full for the window and sinks again', () => {
    expect(breathAt(0, cfg)).toEqual({ phase: 'in', level: 0 });
    expect(breathAt(cfg.inhale / 2, cfg).level).toBeCloseTo(0.5, 5);
    expect(breathAt(cfg.inhale + 0.1, cfg)).toEqual({ phase: 'full', level: 1 });
    expect(breathAt(cfg.inhale + cfg.full + cfg.exhale / 2, cfg).phase).toBe('out');
    expect(breathAt(cycleLength(cfg) - 1e-6, cfg).level).toBeLessThan(0.01);
  });

  it('counts a calm breath only at full breath with the light in the centre', () => {
    let s = sammlungStart(cfg);
    s = { ...s, bt: cfg.inhale + 0.2 };
    const r = sammlungConfirm(s, cfg);
    expect(r.result).toBe('calm');
    expect(r.state.calm).toBe(1);
    expect(breathAt(r.state.bt, cfg).phase).toBe('out');
    expect(sammlungConfirm(r.state, cfg).result).toBe('ignored');
  });

  it('wastes the breath when confirming too early or restless, without losing earlier breaths', () => {
    let s = { ...sammlungStart(cfg), calm: 1 };
    const early = sammlungConfirm({ ...s, bt: 1 }, cfg);
    expect(early.result).toBe('early');
    expect(early.state.calm).toBe(1);
    expect(early.state.stats.early).toBe(1);
    s = { ...s, bt: cfg.inhale + 0.1, x: 0.5 };
    const restless = sammlungConfirm(s, cfg);
    expect(restless.result).toBe('restless');
    expect(restless.state.calm).toBe(1);
    expect(sammlungConfirm({ ...s, bt: cfg.inhale + cfg.full + 0.5 }, cfg).result).toBe('late');
  });

  it('reports a missed window and starts the next breath', () => {
    const { s, events } = run(sammlungStart(cfg), cycleLength(cfg) + 0.5, cfg, centre);
    expect(events).toContain('full');
    expect(events).toContain('missed');
    expect(s.stats.missed).toBe(1);
    expect(s.used).toBe(false);
    expect(breathAt(s.bt, cfg).phase).toBe('in');
  });

  it('finishes after three calm breaths', () => {
    let s = sammlungStart(cfg);
    for (let i = 0; i < 3; i++) s = sammlungConfirm({ ...s, bt: cfg.inhale + 0.1, used: false }, cfg).state;
    expect(s.done).toBe(true);
    expect(sammlungStep(s, 1, { dx: 1 }, cfg).state).toBe(s);
  });
});

describe('Sammlung: thoughts', () => {
  const cfg = sammlungConfig();

  it('follows a fixed schedule of the four thoughts', () => {
    expect([0, 1, 2, 3, 4].map(n => makeThought(n, 0, cfg).word)).toEqual([...THOUGHT_WORDS, 'Kyra']);
    expect(makeThought(5, 2, cfg)).toEqual(makeThought(5, 2, cfg));
    const th = makeThought(0, 0, cfg);
    expect(Math.hypot(thoughtPos(th, 0)!.x, thoughtPos(th, 0)!.y)).toBeGreaterThan(cfg.outerRadius);
    expect(thoughtPos(th, 100)).toBeNull();
  });

  it('pulls the light towards a passing thought', () => {
    const th = makeThought(1, 0, cfg);
    const t = (1.45 - 0.35) / th.speed; // the thought is close to the centre by now
    const s = { ...sammlungStart(cfg), t, thoughts: [th] };
    const p = thoughtPos(th, t)!;
    const pull = pullAt(s, cfg);
    expect(pull.x * p.x + pull.y * p.y).toBeGreaterThan(0);
  });

  it('a grabbed thought pulls much harder and is remembered', () => {
    const th = makeThought(0, 0, cfg);
    const t = (1.45 - 0.4) / th.speed;
    const s = { ...sammlungStart(cfg), t, thoughts: [th] };
    const grabbed = sammlungGrab(s, th.id, cfg);
    expect(grabbed.word).toBe('Kyra');
    expect(grabbed.state.stats.held).toBe(1);
    expect(grabbed.state.heldWords).toEqual(['Kyra']);
    const a = Math.hypot(pullAt(s, cfg).x, pullAt(s, cfg).y);
    const b = Math.hypot(pullAt(grabbed.state, cfg).x, pullAt(grabbed.state, cfg).y);
    expect(b).toBeCloseTo(a * cfg.gripFactor, 5);
    expect(sammlungGrab(s, 'missing', cfg).word).toBeNull();
  });

  it('left alone, the thoughts drag the light away; it returns to the centre and keeps the calm breaths', () => {
    const { s, events } = run({ ...sammlungStart(cfg), calm: 2 }, 60, cfg);
    expect(events).toContain('lost');
    expect(s.stats.lost).toBeGreaterThan(0);
    expect(s.calm).toBe(2);
  });

  it('eases the pull after the light slipped away a few times', () => {
    const th = makeThought(1, 0, cfg);
    const t = (1.45 - 0.35) / th.speed;
    const base = { ...sammlungStart(cfg), t, thoughts: [th] };
    const slipped = { ...base, stats: { ...base.stats, lost: 4 } };
    expect(Math.hypot(pullAt(slipped, cfg).x, pullAt(slipped, cfg).y)).toBeLessThan(Math.hypot(pullAt(base, cfg).x, pullAt(base, cfg).y));
  });
});

describe('Sammlung: playable', () => {
  it('a calm keyboard player finishes in both motion settings', () => {
    for (const reduced of [false, true]) {
      const cfg = sammlungConfig(reduced);
      const s = playCalm(cfg);
      expect(s.done).toBe(true);
      expect(s.t).toBeLessThan(40);
    }
  });

  it('dragging towards the centre steers like the keys', () => {
    const cfg = sammlungConfig();
    let s = { ...sammlungStart(cfg), x: 0.6, y: 0 };
    s = run(s, 1.5, cfg, () => ({ target: { x: 0, y: 0 } })).s;
    expect(Math.hypot(s.x, s.y)).toBeLessThan(cfg.calmRadius);
  });

  it('is deterministic for the same input', () => {
    const cfg = sammlungConfig();
    expect(playCalm(cfg)).toEqual(playCalm(cfg));
  });

  it('reduced motion slows the thoughts down', () => {
    expect(sammlungConfig(true).thoughtSpeed).toBeLessThan(sammlungConfig(false).thoughtSpeed);
  });
});

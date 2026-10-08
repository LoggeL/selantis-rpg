import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { pointInPoly } from '../../world/poly';
import { AFTER_TEA, eveningOptions, HALL_CUT, MIN_TOPICS, MORNING, type TopicKey, TOPICS } from './vertraute-schwester-abend';
import { ENGINE_WALK, POISON_RUN, liaGait, liaSpeed, liaSpeedFactor, poisoned, POISON_FACTOR, prepareE3 } from './shared';
import type { WorldCtx } from '../../world';

afterEach(() => G.state.reset());

describe('the camp evening', () => {
  it('needs at least two topics before Lia may stop, and ends by itself after all four', () => {
    const told = new Set<TopicKey>();
    expect(eveningOptions(told).canStop).toBe(false);
    told.add('ignatius');
    expect(eveningOptions(told).canStop).toBe(false);
    told.add('trapas');
    const o = eveningOptions(told);
    expect(told.size).toBe(MIN_TOPICS);
    expect(o.canStop).toBe(true);
    expect(o.picks.length).toBe(o.topics.length + 1);
    told.add('valentus'); told.add('gehoert');
    expect(eveningOptions(told).topics).toEqual([]);
  });

  it('lets Kyra listen closely only about Trapas and the paladins', () => {
    expect(TOPICS.filter(t => t.close).map(t => t.key)).toEqual(['trapas']);
    const trapas = TOPICS.find(t => t.key === 'trapas')!;
    expect(trapas.lines.filter(l => l.who === 'kyra' && l.text.includes('?')).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps every line short enough for one dialogue box', () => {
    for (const l of [...TOPICS.flatMap(t => t.lines), ...AFTER_TEA, ...HALL_CUT, ...MORNING]) expect(l.text.length, l.text).toBeLessThanOrEqual(140);
  });
});

describe('the poison', () => {
  it('is not active before the drink and active (slow, weakened) from the trap on', () => {
    prepareE3('e3-vertraute-schwester');
    expect(poisoned()).toBe(false);
    expect(liaSpeedFactor()).toBe(1);
    G.state.reset();
    prepareE3('e3-falle');
    expect(G.state.is('e3-vergiftet')).toBe(true);
    expect(G.state.is('e3-gift-plan')).toBe(true);
    expect(poisoned()).toBe(true);
    expect(liaSpeedFactor()).toBeLessThan(1);
    expect(POISON_FACTOR).toBeLessThan(1);
  });

  it('slows Lia relative to the engine speed of the map and caps her run while poisoned', () => {
    const set = { walk: 0 };
    const body = { walkSpeed: ENGINE_WALK * 2, runSpeed: 108 * 2 };
    const w = { map: { worldScale: 2 }, scene: { player: body }, player: { setSpeed: (px: number) => { set.walk = px; body.walkSpeed = px; } } } as unknown as WorldCtx;
    prepareE3('e3-vertraute-schwester');
    expect(liaSpeed(2)).toBe(ENGINE_WALK * 2);
    liaGait(w);
    expect(set.walk).toBe(ENGINE_WALK * 2);
    expect(body.runSpeed).toBe(108 * 2);
    G.state.reset();
    prepareE3('e3-falle');
    liaGait(w);
    expect(set.walk).toBe(Math.round(ENGINE_WALK * 2 * liaSpeedFactor()));
    expect(set.walk).toBeGreaterThan(45); // never the old absolute 30 px/s on a painted map
    expect(body.runSpeed).toBeLessThanOrEqual(set.walk * POISON_RUN);
  });

  it('ends only with the healer in e3-hueterin', () => {
    prepareE3('e3-epilog');
    expect(poisoned()).toBe(false);
  });
});

describe('the thicket geometry (e3-waldrast)', () => {
  it('keeps the wood, the seats, the bed and the path out on walkable ground', async () => {
    const { RAST_WALK, RAST_SPOT, WOOD_AT, PATH_EXIT } = await import('./vertraute-schwester-rast');
    const walk = (at: readonly [number, number]) => RAST_WALK.some(p => pointInPoly(at[0], at[1], p));
    for (const [id, at] of Object.entries(RAST_SPOT)) if (id !== 'fire') expect(walk(at), id).toBe(true);
    for (const at of WOOD_AT) expect(walk(at), String(at)).toBe(true);
    expect(pointInPoly(RAST_SPOT.pathOut[0], RAST_SPOT.pathOut[1], PATH_EXIT)).toBe(true);
  });
});

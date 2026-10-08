import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { pointInPoly } from '../../world/poly';
import {
  CONTACT, FIGURE_HOPE, FIGURE_TALK, HALL_AFTER, HALL_WAKE, MEADOW_OPENING, MEADOW_SPOT, OUTSIDE_BETWEEN, REFUSALS, RIFT_DOUBTS,
  RIFT_LINES, RIFT_MEMORIES, RIFT_MEMORY_OPTIONS, RIFT_MISS, RIFTS, riftObjective, TOPIC_TALK, TOPICS,
} from './hoffnung-und-weigerung-texte';
import { INNER_BLOCKS, INNER_WALK } from './innere-zuflucht-welt';
import { prepareE3 } from './shared';

afterEach(() => G.state.reset());

const walkable = (at: readonly [number, number]) =>
  INNER_WALK.some(p => pointInPoly(at[0], at[1], p)) && !INNER_BLOCKS.some(b => pointInPoly(at[0], at[1], b.poly));

describe('the rifts in the meadow', () => {
  it('tears every rift and the figure on the meadow, where Lia can stand', () => {
    for (const r of RIFTS) expect(walkable(r), String(r)).toBe(true);
    expect(walkable(MEADOW_SPOT.figure)).toBe(true);
    expect(walkable(MEADOW_SPOT.lastRift)).toBe(true);
    expect(RIFTS.length).toBe(3);
  });

  it('answers every whisper with exactly one of the three memories, each used once', () => {
    expect(RIFT_DOUBTS.length).toBe(RIFTS.length);
    expect(RIFT_DOUBTS.map(d => d.answer).sort()).toEqual([...RIFT_MEMORIES].sort());
    for (const m of RIFT_MEMORIES) expect(RIFT_MEMORY_OPTIONS[m].length).toBeLessThanOrEqual(80);
    for (const d of RIFT_DOUBTS) {
      expect(d.whisper.length).toBeLessThanOrEqual(140);
      expect(d.lia.text.length).toBeLessThanOrEqual(140);
    }
    for (const t of RIFT_MISS) expect(t.length).toBeLessThanOrEqual(140);
  });

  it('counts the rifts in the objective (text only, no marker)', () => {
    expect(riftObjective(0)).toMatch(/flüstert/);
    expect(riftObjective(1)).toMatch(/1 von 3/);
    expect(riftObjective(3)).toMatch(/hält/);
  });
});

describe('texts', () => {
  const inner = [
    ...MEADOW_OPENING, ...FIGURE_TALK, ...TOPICS.flatMap(t => TOPIC_TALK[t].lines), ...FIGURE_HOPE, ...RIFT_LINES.first,
    ...RIFT_LINES.closed.flat(), ...RIFT_LINES.last,
  ];
  const outer = [...HALL_WAKE, ...HALL_AFTER, ...CONTACT.arrive, ...CONTACT.book, ...CONTACT.plan];
  const all = [
    ...inner.map(l => l.text), ...outer.map(l => l.text), ...OUTSIDE_BETWEEN.flat().map(l => l.text),
    ...REFUSALS.flatMap(r => [r.option, r.lia, r.vamir]), ...TOPICS.map(t => TOPIC_TALK[t].option),
  ];

  it('keeps every line short enough for one box and uses only the established names', () => {
    for (const t of all) expect(t.length, t).toBeLessThanOrEqual(140);
    expect(all.join(' ')).not.toMatch(/Elbe|Vardis|Triss|Geweih/);
  });

  it('keeps the figure unnamed and no avatar of Xenovia', () => {
    const figure = inner.filter(l => l.who === 'gestalt').map(l => l.text).join(' ');
    expect(figure).toMatch(/Teil von dir/);
    expect(figure).not.toMatch(/Xenovia|Urmacht bin/);
  });

  it('lets Lia only refuse (no yielding option) and names the three she has lost', () => {
    expect(REFUSALS.length).toBe(3);
    for (const r of REFUSALS) expect(r.lia, r.option).toMatch(/nein|nichts/i);
    expect(TOPICS).toEqual(['kyra', 'flick', 'ignatius']);
    expect(TOPIC_TALK.ignatius.lines.map(l => l.text).join(' ')).toMatch(/Gwynn/);
  });

  it('has the Doktor bring the plan: the bearer and ten relics of the first ten humans, all pointed at her', () => {
    const book = CONTACT.book.map(l => l.text).join(' ');
    expect(CONTACT.book.every(l => l.who === 'e3-doktor')).toBe(true);
    expect(book).toMatch(/zehn/);
    expect(book).toMatch(/gerichtet/);
  });
});

describe('the direct entry', () => {
  it('starts with Flick’s message delivered and ends with the refusal and the relic plan', () => {
    prepareE3('e3-hoffnung-und-weigerung');
    expect(G.state.is('e3-flick-gemeldet')).toBe(true);
    expect(G.state.is('e3-geweigert')).toBe(false);
    G.state.reset();
    prepareE3('e3-ritual');
    expect(G.state.is('e3-geweigert')).toBe(true);
    expect(G.state.is('e3-relikte-plan')).toBe(true);
  });
});

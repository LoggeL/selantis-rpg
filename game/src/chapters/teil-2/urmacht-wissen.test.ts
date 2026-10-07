import { describe, expect, it } from 'vitest';
import { remembersFestival, XENOVIA_STEPS, xenoviaTag, xenoviaVerdict, type BookOneKnowledge } from './urmacht-wissen';

const NONE: BookOneKnowledge = { lore: [], memories: [], items: [] };
const correct = (id: string) => XENOVIA_STEPS.find(s => s.id === id)!.options.find(o => o.correct)!;

describe('e2-urmacht: Xenovia story', () => {
  it('has exactly one right answer per step, and every wrong answer has a reply', () => {
    expect(XENOVIA_STEPS.map(s => s.id)).toEqual(['meeresgrund', 'fest', 'gebaeck']);
    for (const step of XENOVIA_STEPS) {
      expect(step.options.filter(o => o.correct)).toHaveLength(1);
      for (const o of step.options.filter(x => !x.correct)) expect(o.wrong?.text.length).toBeGreaterThan(0);
      for (const o of step.options) expect(o.text.length).toBeLessThanOrEqual(80);
    }
    expect(correct('meeresgrund').text).toContain('Meeresgrund');
    expect(correct('fest').text).toContain('Verbannungsfest');
    expect(correct('gebaeck').text).toContain('Kettengebäck');
  });

  it('a direct entry without book-one knowledge shows no tags, but the answers stay choosable', () => {
    for (const step of XENOVIA_STEPS) for (const o of step.options) expect(xenoviaTag(step.id, o, NONE)).toBeUndefined();
  });

  it('tags the right answers from lore, memories and the pastry in the bag', () => {
    const k: BookOneKnowledge = { lore: ['k2-lore-xenovia'], memories: ['k1-mem-fest'], items: ['chain-pastry'] };
    expect(xenoviaTag('meeresgrund', correct('meeresgrund'), k)).toBe('Wissen: Xenovia');
    expect(xenoviaTag('fest', correct('fest'), k)).toBe('Erinnerung: das Fest');
    expect(xenoviaTag('gebaeck', correct('gebaeck'), k)).toBe('Kettengebäck');
    const festival: BookOneKnowledge = { lore: ['k3-lore-verbannungsfest'], memories: [], items: [] };
    expect(xenoviaTag('fest', correct('fest'), festival)).toBe('Wissen: Verbannungsfest');
    expect(xenoviaTag('gebaeck', correct('gebaeck'), festival)).toBe('Wissen: Verbannungsfest');
    const wrong = XENOVIA_STEPS[0].options.find(o => !o.correct)!;
    expect(xenoviaTag('meeresgrund', wrong, k)).toBeUndefined();
  });

  it('remembers the festival only with one of the festival memories', () => {
    expect(remembersFestival(NONE)).toBe(false);
    expect(remembersFestival({ ...NONE, memories: ['k3-mem-fest'] })).toBe(true);
  });

  it('gives a verdict for every score', () => {
    expect(new Set([0, 1, 2, 3].map(xenoviaVerdict)).size).toBe(3);
    for (const n of [0, 1, 2, 3]) expect(xenoviaVerdict(n).length).toBeLessThanOrEqual(140);
  });
});

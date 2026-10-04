import { describe, expect, it } from 'vitest';
import { createCampaignState } from '../campaign/state';
import { actionAvailable, actorVisible, chapterCompleteFlag, chapterExitAvailable, chapterObjective, completeChapter, completeChapterAction, requirementsMet, resetChapter } from './progression';
import type { ContinuationChapterDefinition } from './types';

const chapter: ContinuationChapterDefinition = {
  id: 'test', title: 'Rettung', source: ['test'], actors: [],
  area: { id: 'test', name: 'Test', bg: 'test', start: [10, 10], walk: [], block: [], targets: [] },
  actions: [
    { id: 'free', label: 'Fesseln lösen', at: [10, 10], radius: 20, completionFlag: 'freed', requires: ['arrived'], beats: [], flags: { kyraTaken: false }, items: [{ item: 'kupfer', delta: 1 }], repeatable: true },
    { id: 'recover', label: 'Kyra antworten', at: [20, 10], radius: 20, completionFlag: 'recovered', requires: ['freed'], beats: [] },
  ],
  exit: { label: 'Weitergehen', at: [30, 10], radius: 20, requires: ['recovered'], to: 'next', completionFlag: 'rescued' },
};

describe('continuation checkpoints', () => {
  it('requires explicit own true flags and keeps actions and exits gated', () => {
    expect(requirementsMet({}, ['constructor'])).toBe(false);
    expect(requirementsMet(Object.create({ arrived: true }), ['arrived'])).toBe(false);
    const st = createCampaignState();
    expect(actionAvailable(st.flags, chapter.actions[0])).toBe(false);
    expect(completeChapterAction(st, chapter.actions[1])).toBe(false);
    expect(completeChapter(st, chapter)).toBe(false);
    st.flags.arrived = true;
    expect(chapterObjective(st.flags, chapter)).toContain('Fesseln lösen');
    expect(completeChapterAction(st, chapter.actions[0])).toBe(true);
    expect(chapterExitAvailable(st.flags, chapter)).toBe(false);
    expect(chapterObjective(st.flags, chapter)).toContain('Kyra antworten');
    expect(completeChapterAction(st, chapter.actions[1])).toBe(true);
    expect(chapterObjective(st.flags, chapter)).toContain('Weitergehen');
    expect(completeChapter(st, chapter)).toBe(true);
    expect(st.flags).toMatchObject({ rescued: true, [chapterCompleteFlag('test')]: true });
    expect(completeChapter(st, chapter)).toBe(false);
  });
  it('commits once atomically, and preserves inventory and unrelated flags on replay', () => {
    const st = createCampaignState();
    st.flags.arrived = true; st.flags.kyraTaken = true; st.flags.previousChapter = true;
    st.inv.proviant = 3; st.picked.flower = true;
    expect(completeChapterAction(st, chapter.actions[0])).toBe(true);
    expect(completeChapterAction(st, chapter.actions[0])).toBe(false);
    expect(st.inv).toEqual({ proviant: 3, kupfer: 1 });
    expect(st.flags.kyraTaken).toBe(false);
    resetChapter(st, chapter);
    expect(st.flags).toMatchObject({ previousChapter: true, arrived: true, freed: false, recovered: false });
    expect(st.inv.proviant).toBe(3); expect(st.picked.flower).toBe(true);
  });
  it('rejects an invalid reward without claiming completion', () => {
    const st = createCampaignState(); st.flags.arrived = true;
    expect(completeChapterAction(st, { ...chapter.actions[0], items: [{ item: 'kupfer', delta: -1 }] })).toBe(false);
    expect(st.flags.freed).toBeUndefined(); expect(st.flags.kyraTaken).toBeUndefined();
  });
  it('restores actors from required and hidden campaign flags', () => {
    const actor = { id: 'kyra', name: 'Kyra', texture: 'kyra', at: [20, 10] as [number, number], requires: ['freed'], hideFlags: ['gone'] };
    expect(actorVisible({}, actor)).toBe(false);
    expect(actorVisible({ freed: true }, actor)).toBe(true);
    expect(actorVisible({ freed: true, gone: true }, actor)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { campaignCheckpoint, prepareCampaignCheckpoint } from './checkpoints';
import { createCampaignState } from './state';
import { isCampaignFlag } from './flags';
import { NOVEL_CONTINUATION_CHAPTERS } from '../../content/chapters/continuationNovel';
import { FILM_CONTINUATION_CHAPTERS } from '../../content/chapters/continuationFilm';
import { chapterExitAvailable, actionComplete } from '../continuation/progression';
import { availableParty } from '../party/model';
import { validatePartyState } from '../../app/characterRules';
import type { ContinuationChapterDefinition } from '../continuation/types';

const chapters: readonly ContinuationChapterDefinition[] = [...NOVEL_CONTINUATION_CHAPTERS, ...FILM_CONTINUATION_CHAPTERS];

describe('continuation checkpoints', () => {
  it('prepares previous required chapters, retains optional finds and leaves the requested chapter unfinished', () => {
    for (const [index, chapter] of chapters.entries()) {
      const original = createCampaignState();
      original.inv.feder = 2; original.picked.feather = true;
      original.flags['novel.trust-broken'] = true;
      original.flags['film.film-one-complete'] = true;
      original.flags['chapter:film-one-finale:complete'] = true;
      const { state, destination } = campaignCheckpoint(original, chapter.id);
      expect(destination).toEqual({ scene: chapter.id, data: {} });
      expect(state.inv).toMatchObject({ feder: 2, reisezeug: 1, 'buch-kraeuter': 1, 'buch-alana': 1 });
      expect(state.picked).toEqual({ feather: true });
      expect(state.flags.companionDayComplete).toBe(true);
      for (const previous of chapters.slice(0, index)) expect(chapterExitAvailable(state.flags, previous), previous.id).toBe(true);
      for (const action of chapter.actions) expect(actionComplete(state.flags, action), action.id).toBe(false);
      expect(state.flags['film.film-one-complete']).toBe(false);
      expect(state.flags[`chapter:${chapter.id}:complete`]).not.toBe(true);
      const once = structuredClone(state);
      prepareCampaignCheckpoint(state, chapter.id);
      expect(state).toEqual(once);
      expect(original.flags['film.film-one-complete']).toBe(true);
    }
  });
  it('registers authored continuation flags for playtest editing', () => {
    for (const chapter of chapters) for (const action of chapter.actions) {
      for (const flag of [action.completionFlag, ...Object.keys(action.flags ?? {})]) expect(isCampaignFlag(flag), flag).toBe(true);
    }
  });
  it('shows the present group and retains health records after separation', () => {
    expect(availableParty(campaignCheckpoint(createCampaignState(), 'golden-boar').state.flags)).toEqual(['lia', 'foltan', 'azar']);
    expect(availableParty(campaignCheckpoint(createCampaignState(), 'rain-forest').state.flags)).toEqual(['lia']);
    expect(availableParty(campaignCheckpoint(createCampaignState(), 'sisters-reunited').state.flags)).toEqual(['lia', 'flick']);
    const finale = campaignCheckpoint(createCampaignState(), 'film-one-finale').state;
    expect(finale.flags.kyraTaken).toBe(false);
    expect(availableParty(finale.flags)).toEqual(['lia', 'flick', 'kyra']);
    const before = validatePartyState(undefined, { metFoltanAzar: true });
    before.members.foltan!.hp = 17;
    const after = validatePartyState(before, finale.flags);
    expect(after.members.foltan!.hp).toBe(17);
    expect(after.members.flick).toBeDefined(); expect(after.members.kyra).toBeDefined();
  });
});

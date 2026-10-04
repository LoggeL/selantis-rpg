import { describe, expect, it } from 'vitest';
import { createCampaignState } from '../../../modules/campaign/state';
import { actionAvailable, chapterExitAvailable, completeChapter, completeChapterAction } from '../../../modules/continuation/progression';
import { isMapWalkable, NavigationContext } from '../../../modules/exploration/navigation';
import { FILM_CONTINUATION_CHAPTERS, FILM_CONTINUATION_PROVENANCE, SHADOW_CAMP, SISTERS_REUNITED, FILM_ONE_FINALE } from './index';

describe('continuous novel-to-first-film ending', () => {
  it('requires the rescue steps in order, preserves the broken trust, and stops before arrival at the rebels', () => {
    const state = createCampaignState();
    state.flags['novel.trust-broken'] = true;
    state.flags['novel.azar-searching'] = true;
    for (let index = 0; index < FILM_CONTINUATION_CHAPTERS.length; index++) {
      const chapter = FILM_CONTINUATION_CHAPTERS[index];
      expect(chapterExitAvailable(state.flags, chapter)).toBe(false);
      for (let next = 0; next < chapter.actions.length; next++) {
        const action = chapter.actions[next];
        expect(actionAvailable(state.flags, action)).toBe(true);
        for (const later of chapter.actions.slice(next + 1)) expect(actionAvailable(state.flags, later)).toBe(false);
        expect(completeChapterAction(state, action)).toBe(true);
        expect(completeChapterAction(state, action)).toBe(false);
      }
      expect(chapterExitAvailable(state.flags, chapter)).toBe(true);
      expect(completeChapter(state, chapter)).toBe(true);
      if (index < FILM_CONTINUATION_CHAPTERS.length - 1) expect(chapter.exit.to).toBe(FILM_CONTINUATION_CHAPTERS[index + 1].id);
    }
    expect(state.flags['film.flick-met']).toBe(true);
    expect(state.flags['film.sisters-reunited']).toBe(true);
    expect(state.flags['film.lia-collapsed']).toBe(false);
    expect(state.flags['novel.trust-broken']).toBe(true);
    expect(state.flags['novel.azar-searching']).toBe(true);
    expect(state.flags['film.film-one-complete']).toBe(true);
    expect(state.flags['film.rebels-arrived']).toBeUndefined();
    expect(FILM_CONTINUATION_PROVENANCE.endpoint).toMatchObject({ storyEndsAt: '20:17', excludedRepeatStartsAt: '24:58', rebelsArrived: false });
    expect(FILM_ONE_FINALE.end?.title).toBe('Ende des ersten Teils');
  });

  it('allows walking to every required action and exit on connected authored ground', () => {
    for (const chapter of FILM_CONTINUATION_CHAPTERS) {
      const walkable = (x: number, y: number) => isMapWalkable(chapter.area, x, y);
      const navigation = new NavigationContext(walkable);
      let from = chapter.area.start;
      expect(walkable(...from), chapter.id).toBe(true);
      for (const target of [...chapter.actions, chapter.exit]) {
        const path = navigation.findPath(from, target.at, target.radius);
        expect(path.length, `${chapter.id}:${target.label}`).toBeGreaterThan(0);
        from = path[path.length - 1];
        expect(Math.hypot(from[0] - target.at[0], from[1] - target.at[1])).toBeLessThanOrEqual(target.radius);
      }
    }
  });

  it('unbinds Kyra before the involuntary burst, then collapses Lia and has Kyra care for her', () => {
    const cues = SISTERS_REUNITED.actions.flatMap(action => action.beats.flatMap(beat => [...(beat.cue ? [beat.cue] : []), ...(beat.cues ?? [])]));
    const index = (type: string) => cues.findIndex(cue => cue.type === type);
    expect(index('unbind')).toBeLessThan(index('burst'));
    expect(index('burst')).toBeLessThan(index('collapse'));
    expect(index('collapse')).toBeLessThan(index('recover'));
    const burst = cues.find(cue => cue.type === 'burst');
    expect(burst).toMatchObject({ target: 'captain', color: 0x397fc1, to: [481, 216] });
    const care = cues.slice(index('collapse') + 1).find(cue => cue.type === 'move' && cue.actor === 'kyra');
    expect(care).toMatchObject({ to: [563, 195] });
    const protection = SISTERS_REUNITED.actions.find(action => action.id === 'protect-kyra')!;
    const recovery = SISTERS_REUNITED.actions.find(action => action.id === 'answer-kyra')!;
    // Collapse freezes walking: recovery must work from every in-range protection position.
    expect(Math.hypot(protection.at[0] - recovery.at[0], protection.at[1] - recovery.at[1]) + protection.radius).toBeLessThanOrEqual(recovery.radius);
    const flags = SISTERS_REUNITED.actions.flatMap(action => Object.keys(action.flags ?? {}));
    expect(flags.some(flag => /spell|caster|magic-unlocked/.test(flag))).toBe(false);
  });

  it('stages the captive and unbinding at the painted tree, with care beside collapsed Lia', () => {
    for (const chapter of [SHADOW_CAMP, SISTERS_REUNITED]) {
      expect(chapter.actors.find(actor => actor.id === 'kyra')?.at).toEqual([592, 140]);
      for (const actor of chapter.actors) expect(isMapWalkable(chapter.area, ...actor.at), `${chapter.id}:${actor.id}`).toBe(true);
      for (const beat of chapter.actions.flatMap(action => action.beats)) {
        for (const cue of [...(beat.cue ? [beat.cue] : []), ...(beat.cues ?? [])]) {
          if ((cue.type === 'move' || cue.type === 'burst') && cue.to) {
            expect(isMapWalkable(chapter.area, ...cue.to), beat.id).toBe(true);
          }
        }
      }
    }
    const freeing = SISTERS_REUNITED.actions[0].beats.find(beat => beat.cues?.some(cue => cue.type === 'unbind'))!;
    const approach = freeing.cues?.find(cue => cue.type === 'move' && cue.actor === 'flick');
    expect(approach).toMatchObject({ to: [585, 146] });
    const protection = SISTERS_REUNITED.actions.find(action => action.id === 'protect-kyra')!;
    const recovery = SISTERS_REUNITED.actions.find(action => action.id === 'answer-kyra')!;
    expect(recovery.at).toEqual(protection.at);
    expect(protection.beats.find(beat => beat.cue?.type === 'move' && beat.cue.actor === 'lia')?.cue).toMatchObject({ to: recovery.at });
  });

  it('keeps source identities and new bridges explicit without granting Lia private camp knowledge', () => {
    const bridge = SHADOW_CAMP.actions[0].beats.map(beat => beat.line).join(' ');
    expect(bridge).toContain('Baris');
    expect(bridge).toContain('Grotte');
    expect(bridge).toContain('Geweih');
    expect(bridge).toContain('Vardis');
    expect(SHADOW_CAMP.source.join(' ')).toContain('ADAPTION: baris-vardis-transfer');
    expect(FILM_CONTINUATION_PROVENANCE.adaptations.find(adaptation => adaptation.id === 'distant-camp-coda')?.detail).toContain('Lia hört dieses Gespräch nicht');
    const finale = FILM_ONE_FINALE.entry?.map(beat => beat.line).join(' ') ?? '';
    expect(finale).toContain('die Falsche');
    expect(finale).toContain('Beim nächsten Mal');
    expect(finale).not.toContain('Vamir');
    expect(FILM_ONE_FINALE.actions.at(-1)?.beats.find(beat => beat.id === 'film-one-finale.banter.kyra')?.line).toBe('Lia: Vielleicht nehmen die Rebellen dich diesmal auf.');
    expect(FILM_ONE_FINALE.actions.at(-1)?.beats.at(-1)?.line).toBe('Lia: Beruhig dich mal.');
  });
});

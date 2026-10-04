import { describe, expect, it } from 'vitest';
import type { ContinuationAction, ContinuationChapterDefinition } from '../../../modules/continuation/types';
import { isMapWalkable, NavigationContext, type Pt } from '../../../modules/exploration/navigation';
import { findInteractionPath, withinInteractionRange } from '../../../modules/exploration/route';
import { NOVEL_CONTINUATION_CHAPTERS } from './index';

const chapters: readonly ContinuationChapterDefinition[] = NOVEL_CONTINUATION_CHAPTERS;

/** Follow only the dependency closure of the exit, leaving optional conversations untouched. */
function requiredActions(chapter: ContinuationChapterDefinition): ContinuationAction[] {
  const result: ContinuationAction[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const byFlag = new Map(chapter.actions.map(action => [action.completionFlag, action]));
  const visit = (flag: string) => {
    if (visited.has(flag)) return;
    if (visiting.has(flag)) throw new Error(`Cyclic prerequisite ${flag}`);
    const action = byFlag.get(flag);
    if (!action) throw new Error(`Missing prerequisite ${chapter.id}: ${flag}`);
    visiting.add(flag);
    for (const prerequisite of action.requires ?? []) visit(prerequisite);
    visiting.delete(flag);
    visited.add(flag);
    result.push(action);
  };
  for (const flag of chapter.exit.requires) visit(flag);
  return result;
}

describe('novel continuation', () => {
  it('keeps chapter and beat identities unique and named throughout the novel path', () => {
    expect(chapters.map(chapter => chapter.id)).toEqual(['golden-boar', 'reading-camp', 'brotherhood', 'betrayal']);
    const beatIds = chapters.flatMap(chapter => [...(chapter.entry ?? []), ...chapter.actions.flatMap(action => action.beats)].map(beat => beat.id));
    expect(new Set(beatIds).size).toBe(beatIds.length);
    for (const id of beatIds) expect(id).toMatch(/^novel\.[a-z-]+\.[a-z][a-z-]+$/);
    const actionFlags = chapters.flatMap(chapter => chapter.actions.map(action => action.completionFlag));
    expect(new Set(actionFlags).size).toBe(actionFlags.length);
  });

  it('completes each chapter through two to four substantive actions without optional chores', () => {
    const requiredIds = chapters.map(chapter => requiredActions(chapter).map(action => action.id));
    expect(requiredIds).toEqual([
      ['sister-description', 'craupor-questioning', 'azar-desertion', 'foltan-report'],
      ['safe-fire', 'herb-lexicon', 'alana-story', 'parents-and-promise'],
      ['elnon-welcome', 'azar-shelter', 'seek-elnon'],
      ['overhear-report', 'leave-brotherhood'],
    ]);
    for (const chapter of chapters) {
      const flags = new Set<string>();
      for (const action of requiredActions(chapter)) {
        expect((action.requires ?? []).every(flag => flags.has(flag))).toBe(true);
        flags.add(action.completionFlag);
        for (const [flag, enabled] of Object.entries(action.flags ?? {})) if (enabled) flags.add(flag);
      }
      expect(chapter.exit.requires.every(flag => flags.has(flag))).toBe(true);
    }
    expect(requiredIds[2]).not.toContain('training-observation');
    expect(chapters.flatMap(chapter => chapter.actions).every(action => !action.items?.length)).toBe(true);
  });

  it('makes every action and exit approachable from the entry and along the required route', () => {
    for (const chapter of chapters) {
      const walkable = (x: number, y: number) => isMapWalkable(chapter.area, x, y);
      const navigation = new NavigationContext(walkable);
      expect(walkable(...chapter.area.start), `${chapter.id} entry`).toBe(true);
      const approach = (from: Pt, target: { at: Pt; radius: number; label: string }): Pt => {
        const path = findInteractionPath(navigation, from, target.at, target.radius);
        expect(path.length, `${chapter.id}: ${target.label}`).toBeGreaterThan(0);
        for (const point of path) expect(walkable(...point), `${chapter.id}: ${target.label} path`).toBe(true);
        expect(withinInteractionRange(path.at(-1)!, target.at, target.radius)).toBe(true);
        return path.at(-1)!;
      };
      for (const action of chapter.actions) approach(chapter.area.start, action);
      let position = chapter.area.start;
      for (const action of requiredActions(chapter)) position = approach(position, action);
      approach(position, chapter.exit);
    }
  });

  it('keeps the night clearing and brotherhood paths off painted shrubs and rocks', () => {
    const [, reading, brotherhood, betrayal] = chapters;
    expect(isMapWalkable(reading.area, 517, 285), 'old spawn inside the right shrubs').toBe(false);
    expect(isMapWalkable(reading.area, 230, 283), 'old reading position in the lower shrubs').toBe(false);
    expect(isMapWalkable(brotherhood.area, 94, 286), 'old spawn on the left rocks').toBe(false);
    expect(isMapWalkable(betrayal.area, 56, 287), 'old exit behind the stump').toBe(false);
    for (const chapter of [reading, brotherhood, betrayal]) {
      expect(isMapWalkable(chapter.area, ...chapter.area.start), `${chapter.id} spawn`).toBe(true);
      expect(isMapWalkable(chapter.area, ...chapter.exit.at), `${chapter.id} exit`).toBe(true);
    }
    const observation = chapters[0].actions.find(action => action.id === 'craupor-questioning')!;
    expect(observation.at[0]).toBeLessThan(350);
  });

  it('preserves the promise, late disclosure and rain-forest handoff in Lias perspective', () => {
    const [golden, reading, brotherhood, betrayal] = chapters;
    expect(golden.exit.to).toBe(reading.id);
    expect(reading.exit.to).toBe(brotherhood.id);
    expect(brotherhood.exit.to).toBe(betrayal.id);
    expect(betrayal.exit.to).toBe('rain-forest');
    const promised = reading.actions.find(action => action.id === 'parents-and-promise')!;
    expect(promised.flags).toEqual({ 'novel.azar-promised': true, 'novel.foltan-promised': true });
    const beforeDisclosure = [golden, reading, brotherhood].flatMap(chapter => chapter.actions.flatMap(action => action.beats.map(beat => beat.line))).join('\n');
    expect(beforeDisclosure).not.toContain('Geweih');
    expect(beforeDisclosure).not.toMatch(/Craupor.*(?:Gefangene|Kyra.*gesehen)/);
    const lie = golden.actions.find(action => action.id === 'foltan-report')!;
    expect(lie.beats.find(beat => beat.id.endsWith('foltan-denies-trace'))?.line).toContain('Nein. Leider nicht.');
    const leave = betrayal.actions.find(action => action.id === 'leave-brotherhood')!;
    expect(leave.requires).toEqual(['novel.foltan-lie-heard']);
    expect(leave.flags).toEqual({ 'novel.lia-leaves-brotherhood': true, 'novel.azar-searching': true });
    expect(betrayal.actors).toHaveLength(0);
    for (const chapter of chapters) {
      expect(chapter.source.some(source => source.includes('PDF S.'))).toBe(true);
      expect(chapter.source.some(source => source.startsWith('Adaption:'))).toBe(true);
      expect(chapter.actors.some(actor => actor.id === 'kyra')).toBe(false);
    }
  });
});

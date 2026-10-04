import { applyCampaignCommand, setCampaignFlag } from '../campaign/commands';
import type { CampaignState } from '../campaign/state';
import type { ContinuationAction, ContinuationActor, ContinuationChapterDefinition } from './types';

type Flags = Readonly<Record<string, boolean>>;
export const chapterEnteredFlag = (id: string) => `chapter:${id}:entered`;
export const chapterCompleteFlag = (id: string) => `chapter:${id}:complete`;
export const chapterEntryFlag = (id: string) => `chapter:${id}:entry`;
export const requirementsMet = (flags: Flags, requires: readonly string[] = []) => requires.every(key => Object.hasOwn(flags, key) && flags[key] === true);
export const actionComplete = (flags: Flags, action: ContinuationAction) => requirementsMet(flags, [action.completionFlag]);
export const actionAvailable = (flags: Flags, action: ContinuationAction) => requirementsMet(flags, action.requires) && (!actionComplete(flags, action) || action.repeatable === true);
export const actorVisible = (flags: Flags, actor: ContinuationActor) => requirementsMet(flags, actor.requires) && !(actor.hideFlags ?? []).some(key => Object.hasOwn(flags, key) && flags[key] === true);
export const chapterExitAvailable = (flags: Flags, chapter: ContinuationChapterDefinition) => requirementsMet(flags, chapter.exit.requires);

/** Dialogue replay does not grant a second item reward or repeat the flag transaction. */
export function completeChapterAction(st: CampaignState, action: ContinuationAction): boolean {
  if (!actionAvailable(st.flags, action) || actionComplete(st.flags, action)) return false;
  return applyCampaignCommand(st, { type: 'transaction', once: action.completionFlag,
    flags: { ...action.flags, [action.completionFlag]: true }, items: action.items });
}
export function completeChapter(st: CampaignState, chapter: ContinuationChapterDefinition): boolean {
  if (!chapterExitAvailable(st.flags, chapter)) return false;
  const once = chapterCompleteFlag(chapter.id);
  return applyCampaignCommand(st, { type: 'transaction', once, flags: { [once]: true, ...(chapter.exit.completionFlag ? { [chapter.exit.completionFlag]: true } : {}) } });
}
export function chapterObjective(flags: Flags, chapter: ContinuationChapterDefinition): string {
  if (chapterExitAvailable(flags, chapter)) return `${chapter.title} · ${chapter.exit.label}`;
  const next = chapter.actions.find(action => !actionComplete(flags, action) && requirementsMet(flags, action.requires));
  return `${chapter.title} · ${next?.label ?? (chapterExitAvailable(flags, chapter) ? chapter.exit.label : chapter.actions.find(action => !actionComplete(flags, action))?.disabledHint ?? 'Den Ort untersuchen.')}`;
}
/** Only chapter-local checkpoints are reset by the final chapter's replay control. */
export function resetChapter(st: CampaignState, chapter: ContinuationChapterDefinition): void {
  for (const flag of [chapterEnteredFlag(chapter.id), chapterEntryFlag(chapter.id), chapterCompleteFlag(chapter.id),
    ...chapter.actions.map(action => action.completionFlag), ...(chapter.exit.completionFlag ? [chapter.exit.completionFlag] : [])]) setCampaignFlag(st, flag, false);
}

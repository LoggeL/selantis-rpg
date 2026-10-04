import type { Pt, StoryArea } from '../narrative/types';
import type { ItemId } from '../inventory/catalog';
import type { AmbientKind } from '../audio/types';

/** Data authored from the novel/film; no renderer or storage dependency. */
export interface ContinuationActor {
  id: string;
  name: string;
  texture: string;
  frame?: number | string;
  at: Pt;
  displaySize?: Pt;
  follow?: boolean;
  requires?: readonly string[];
  hideFlags?: readonly string[];
}
export type ContinuationCue =
  | { type: 'move'; actor: string; to: Pt; duration?: number }
  | { type: 'show' | 'hide'; actor: string }
  | { type: 'pose'; actor: string; angle?: number; tint?: number; flipX?: boolean }
  | { type: 'burst'; target?: string; to?: Pt; color?: number; duration?: number }
  | { type: 'collapse'; actor?: string }
  | { type: 'recover'; actor?: string }
  | { type: 'unbind'; actor: string }
  | { type: 'crouch'; enabled: boolean };
export interface ContinuationBeat {
  id: string;
  line: string;
  shot?: string;
  cue?: ContinuationCue;
  cues?: readonly ContinuationCue[];
}
export interface ContinuationAction {
  id: string;
  label: string;
  at: Pt;
  radius: number;
  requires?: readonly string[];
  completionFlag: string;
  beats: readonly ContinuationBeat[];
  flags?: Readonly<Record<string, boolean>>;
  items?: readonly { item: ItemId; delta: number }[];
  repeatable?: boolean;
  disabledHint?: string;
}
export interface ContinuationChapterDefinition {
  id: string;
  title: string;
  source: readonly string[];
  area: StoryArea;
  actors: readonly ContinuationActor[];
  entry?: readonly ContinuationBeat[];
  actions: readonly ContinuationAction[];
  exit: { id?: string; label: string; at: Pt; radius: number; requires: readonly string[]; to: string; completionFlag?: string };
  atmosphere?: 'rain' | 'wind' | 'night' | 'warm';
  music?: AmbientKind;
  end?: { title: string; text: string; replayTo?: string; titleTo?: string };
}

export type ContinuationChapterId = 'golden-boar' | 'reading-camp' | 'brotherhood' | 'betrayal'
  | 'rain-forest' | 'flick-trail' | 'shadow-camp' | 'sisters-reunited' | 'film-one-finale';

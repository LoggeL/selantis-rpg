/** Authored geometry and targets have no renderer or campaign storage dependency. */
export type Pt = [number, number];
export interface StoryTarget<TargetId extends string = string> {
  id: TargetId;
  at: Pt;
  radius: number;
  label: string;
}
export interface StoryArea<TargetId extends string = string, AreaId extends string = string> {
  id: AreaId;
  name: string;
  bg: string;
  start: Pt;
  walk: Pt[][];
  block: Pt[][];
  targets: StoryTarget<TargetId>[];
}
export interface AuthoredBeat<Cue extends string = never> {
  narrativeId: string;
  line: string;
  label?: string;
  cue?: Cue;
}

import type { Pt } from '../world/maps';

export type { Pt } from '../world/maps';

export interface StoryTarget {
  id: string;
  at: Pt;
  radius: number;
  label: string;
}

export interface StoryArea {
  id: string;
  name: string;
  bg: string;
  start: Pt;
  walk: Pt[][];
  block: Pt[][];
  targets: StoryTarget[];
}

export interface StorySpot extends StoryTarget {
  enabled?: () => boolean;
  /** Repeatable places can remain usable after their one-time task marker ends. */
  markerVisible?: () => boolean;
  onUse: () => void;
}

import type { StoryTarget } from "../../modules/narrative/types";
export type { Pt, StoryArea, StoryTarget } from "../../modules/narrative/types";

export interface StorySpot extends StoryTarget {
  enabled?: () => boolean;
  /** Repeatable places can remain usable after their one-time task marker ends. */
  markerVisible?: () => boolean;
  /** Show a known place while an earlier preparation is still required. */
  markerWhenDisabled?: boolean;
  /** A visible preparation point explains its prerequisite when inspected. */
  disabledHint?: () => string;
  onUse: () => void;
}

import { describe, expect, it } from 'vitest';
import { PROLOGUE_CARDS } from "./prologue/cards";
import { HOME_PATH_ENTRY, SISTER_CONVERSATION, SISTER_CONVERSATION_SEQUENCE } from "./homecoming/dialogue";
import { CHAPTER_TRANSITION, KYRA_INTRO } from "./homecoming/kyraIntro";
import { AFTERMATH_GRIEF_BEATS, PARENTS_GRIEF_BEATS, RAID_GRIEF_BEATS } from "./aftermath/grief";
import { MIDDAY_REST_LINES, MIDDAY_REST_SEQUENCE } from "./companions/dialogue";

const sequences = [
  { prefix: 'prologue.cards', beats: PROLOGUE_CARDS },
  { prefix: 'homecoming.sisters', beats: SISTER_CONVERSATION_SEQUENCE },
  { prefix: 'homecoming.kyra-intro', beats: KYRA_INTRO },
  { prefix: 'aftermath.raid', beats: RAID_GRIEF_BEATS },
  { prefix: 'aftermath.parents', beats: PARENTS_GRIEF_BEATS },
  { prefix: 'aftermath.grief', beats: AFTERMATH_GRIEF_BEATS },
  { prefix: 'companions.midday-rest', beats: MIDDAY_REST_SEQUENCE },
];

describe('authored narrative sequence identity', () => {
  it('gives every reading beat a unique, named ID within its chapter and sequence', () => {
    const ids = [
      ...sequences.flatMap(sequence => sequence.beats.map(beat => beat.narrativeId)),
      HOME_PATH_ENTRY.narrativeId,
      CHAPTER_TRANSITION.narrativeId,
    ];
    expect(new Set(ids).size).toBe(ids.length);
    for (const { prefix, beats } of sequences) {
      expect(beats.length).toBeGreaterThan(0);
      for (const beat of beats) {
        expect(beat.narrativeId.startsWith(`${prefix}.`)).toBe(true);
        // Names survive inserting an earlier beat; positional IDs do not.
        expect(beat.narrativeId.slice(prefix.length + 1)).toMatch(/^[a-z][a-z0-9-]*$/);
      }
    }
  });

  it('retains the local IDs consumed by existing scene progress and save state', () => {
    for (const { prefix, beats } of sequences) {
      for (const beat of beats) {
        if ('id' in beat) expect(beat.narrativeId).toBe(`${prefix}.${beat.id}`);
      }
    }
  });

  it('presents the same authored lines in order through both dialogue interfaces', () => {
    expect(SISTER_CONVERSATION).toEqual(SISTER_CONVERSATION_SEQUENCE.map(beat => beat.line));
    expect(MIDDAY_REST_LINES).toEqual(MIDDAY_REST_SEQUENCE.map(beat => beat.line));
  });
});

import type { MapDef, Prop } from '../world/maps';
import type { WorldState } from '../world/quests';

/** The same field branch exists on the homeward walk and on the later journey. */
export const FIELD_RETURN = { map: 'felder', from: 'journey' } as const;
export const FIELD_DEPARTURE = { map: 'felder', from: 'hof' } as const;

export function eastwardTravelGate(st: WorldState): string | undefined {
  if (!st.flags.raidWitnessed) return 'Ich muss nach Hause. Bald gibt es Abendbrot, und Mutter wartet auf mich.';
  if (!st.flags.departureReady) return 'Bevor ich Kyra folge, muss ich im Haus packen und die Schweine freilassen.';
  return undefined;
}

export function travelObjective(st: WorldState, map: string): string | undefined {
  if (!st.flags.raidWitnessed) return undefined;
  if (!st.flags.departureReady) return 'Zum Hof zurückkehren und für den Aufbruch packen.';
  return map === 'felder' ? 'Den Hufspuren am Feldabzweig nach Osten folgen.'
    : 'Über die Felder den Hufspuren nach Osten folgen.';
}

const FIELD_TRACKS: Prop[] = [
  { id: 'hufspuren-feldweg', at: [500, 280], radius: 24, lines: ['Hufspuren vom Hof führen zum Abzweig nach Osten.\nKyra muss dort entlang gebracht worden sein.'] },
  { id: 'hufspuren-abzweig', at: [604, 283], radius: 24, lines: ['Dieselben Hufspuren ziehen zur Straße nach Osten.\nDie Reiter sind hier abgebogen. Ich folge ihnen.'] },
];

/** Tracks only appear after the riders have actually passed through the farm. */
export function mapForTravel(map: MapDef, st: WorldState): MapDef {
  if (map.id !== 'felder') return map;
  const branch: Prop = { id: 'feldabzweig', at: [574, 281], radius: 20, lines: [eastwardTravelGate(st) ?? 'Dieser Nebenweg führt zur Straße. Die Hufspuren zeigen nach Osten.'] };
  return { ...map, props: [...map.props, branch, ...(st.flags.raidWitnessed ? FIELD_TRACKS : [])] };
}

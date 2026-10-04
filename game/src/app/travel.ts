import type { MapDef, Prop } from "../modules/exploration/mapTypes";
import type { WorldState } from "../modules/campaign/state";

/** The same field branch exists on the homeward walk and on the later journey. */
export const FIELD_RETURN = { map: 'felder', from: 'journey' } as const;
export const FIELD_DEPARTURE = { map: 'felder', from: 'hof' } as const;

export { eastwardTravelGate, travelObjective } from '../modules/campaign/travel';
import { eastwardTravelGate } from "../modules/campaign/travel";

const FIELD_TRACKS: Prop[] = [
  { id: 'hufspuren-feldweg', at: [500, 278], radius: 24, lines: ['Hufspuren vom Hof. Sie führen zum Abzweig nach Osten.\nHier haben sie Kyra entlanggebracht.'] },
  { id: 'hufspuren-abzweig', at: [605, 305], radius: 24, lines: ['Hier biegen die Spuren zur Straße nach Osten ab.\nIch komme, Kyra.'] },
];

/** Tracks only appear after the riders have actually passed through the farm. */
export function mapForTravel(map: MapDef, st: WorldState): MapDef {
  if (map.id !== 'felder') return map;
  const branch: Prop = { id: 'feldabzweig', at: [565, 288], radius: 20, lines: [eastwardTravelGate(st) ?? 'Dieser Nebenweg führt zur Straße. Die Hufspuren zeigen nach Osten.'] };
  return { ...map, props: [...map.props, branch, ...(st.flags.raidWitnessed ? FIELD_TRACKS : [])] };
}

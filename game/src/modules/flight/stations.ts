export type FlightStation = {
  at: number;
  kind: 'stumble' | 'jump' | 'climb' | 'brace' | 'slip';
  hint?: string;
  holdMs?: number;
  to?: number;
};
export type AuthoredFlightStation = Omit<FlightStation, 'at' | 'to'> & { pointIndex: number; offset?: number; toPointIndex?: number };
export type FlightProgression = { distance: number; safeFloor: number; nextStation: number };

/** Animation/timer completion is the scene's responsibility; progression is deterministic. */
export function completeFlightStation(state: FlightProgression, station: FlightStation): FlightProgression {
  const crossed = station.kind === 'jump' || station.kind === 'climb';
  return {
    distance: crossed ? station.to! : state.distance,
    safeFloor: crossed ? station.to! : state.safeFloor,
    nextStation: state.nextStation + 1,
  };
}

/** Release freezes both grip and distance. Brace never leaves its support point. */
export function advanceStationHold(station: FlightStation, holding: number, held: boolean, deltaMs: number) {
  const nextHolding = held ? Math.min(station.holdMs!, holding + deltaMs) : holding;
  const progress = nextHolding / station.holdMs!;
  return {
    holding: nextHolding,
    progress,
    distance: station.kind === 'climb' ? station.at + (station.to! - station.at) * progress : station.at,
    complete: nextHolding >= station.holdMs!,
  };
}

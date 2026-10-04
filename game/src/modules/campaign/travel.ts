import type { CampaignState } from "./state";
export function eastwardTravelGate(st: CampaignState): string | undefined {
  if (!st.flags.raidWitnessed) return 'Ich muss nach Hause. Bald gibt es Abendbrot, und Mutter wartet auf mich.';
  if (!st.flags.departureReady) return 'Bevor ich Kyra folge, muss ich im Haus packen und die Schweine freilassen.';
  return undefined;
}
export function travelObjective(st: CampaignState, map: string): string | undefined {
  if (!st.flags.raidWitnessed) return undefined;
  if (!st.flags.departureReady) return 'Zum Hof zurückkehren und für den Aufbruch packen.';
  return map === 'felder' ? 'Den Hufspuren am Feldabzweig nach Osten folgen.' : 'Über die Felder den Hufspuren nach Osten folgen.';
}

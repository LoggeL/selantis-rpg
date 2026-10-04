import type { Inventory, ItemId } from "../inventory/catalog";
import { FLAGS, FLAG_GROUPS } from "./flags";
import { cloneCampaignState, type CampaignState } from "./state";
import { isCampaignState } from "./serialization";

export const CAMPAIGN_CHECKPOINTS = [
  ['battle', 'Valentus · Schlachtutorial'], ['break', 'Verwundung'], ['flight', 'Flucht'], ['refuge', 'Zuflucht'], ['lia', 'Lia · Gespräch mit Kyra'],
  ['world:wiese', 'Wiese'], ['world:felder', 'Felder'], ['world:waldrand', 'Waldrand'], ['world:hohlweg', 'Hohlweg'], ['world:hof', 'Hof · Heimkehr'],
  ['raid', 'Überfall'], ['aftermath', 'Hof · Reisevorbereitung'], ['road', 'Reise · Straße'], ['camp', 'Reise · Nachtlager'], ['strangers', 'Reise · Foltan und Azar'], ['companions-road', 'Reise · Aufbruch und Waldrast'],
] as const;
export type CampaignCheckpointId = typeof CAMPAIGN_CHECKPOINTS[number][0];
export interface CheckpointDestination { scene: string; data: { map?: string } }
const equipment: Inventory = { proviant: 1, wasserschlauch: 1, dolch: 1, kupfer: 22, silber: 7, reisezeug: 1, heilzeug: 1, 'buch-kraeuter': 1, 'buch-alana': 1 };
export const isCampaignCheckpoint = (id: string): id is CampaignCheckpointId => CAMPAIGN_CHECKPOINTS.some(([key]) => key === id);

/** Pure recipe retains optional finds and dynamic discoveries, resets chapter progress. */
export function campaignCheckpoint(st: CampaignState, id: string): { state: CampaignState; destination: CheckpointDestination } {
  if (!isCampaignCheckpoint(id)) throw new Error('Unbekannter Einstieg');
  const next = cloneCampaignState(st);
  for (const flag of FLAGS) if (flag !== 'chickReturned') next.flags[flag] = false;
  for (const item of [...Object.keys(equipment), 'steine', 'zunderholz'] as ItemId[]) delete next.inv[item];
  const travel = ['road', 'camp', 'strangers', 'companions-road'].includes(id);
  const farm = id === 'aftermath' || travel;
  if (id.startsWith('world:') || id === 'raid' || farm) next.flags.sisterPromise = true;
  if (id === 'raid' || farm) next.flags.homeArrived = true;
  if (farm) for (const flag of ['raidWitnessed', 'parentsLost', 'kyraTaken']) next.flags[flag] = true;
  if (travel) {
    Object.assign(next.inv, equipment);
    for (const flag of FLAG_GROUPS.Hof) next.flags[flag] = true;
  }
  if (id === 'camp' || id === 'strangers') for (const flag of ['streamVisited', 'journeyEastChosen', 'journeyCampReached']) next.flags[flag] = true;
  if (id === 'companions-road') for (const flag of FLAG_GROUPS.Reise) next.flags[flag] = true;
  if (id === 'strangers') for (const flag of FLAG_GROUPS.Reise) next.flags[flag] = flag !== 'criosObserved' && flag !== 'journeyCloakRecovered';
  if (!isCampaignState(next)) throw new Error('Ungültiger Kampagnenzustand');
  return { state: next, destination: { scene: id === 'companions-road' ? id : travel ? 'journey' : id.split(':')[0], data: id.startsWith('world:') ? { map: id.split(':')[1] } : {} } };
}

/** Explicit debug/startup operation; never adds equipment on repeated entry. */
export function prepareCampaignCheckpoint(st: CampaignState, id: string): CheckpointDestination {
  const recipe = campaignCheckpoint(st, id);
  for (const [target, source] of [[st.inv, recipe.state.inv], [st.picked, recipe.state.picked], [st.flags, recipe.state.flags]] as const) {
    for (const key of Object.keys(target)) delete (target as Record<string, unknown>)[key];
    Object.assign(target, source);
  }
  return recipe.destination;
}

import type { Inventory, ItemId } from "../inventory/catalog";
import { FLAGS, FLAG_GROUPS } from "./flags";
import { cloneCampaignState, type CampaignState } from "./state";
import { isCampaignState } from "./serialization";

export const CAMPAIGN_CHECKPOINTS = [
  ['battle', 'Valentus · Schlachtutorial'], ['break', 'Verwundung'], ['flight', 'Flucht'], ['refuge', 'Zuflucht'], ['lia', 'Lia · Gespräch mit Kyra'],
  ['world:wiese', 'Wiese'], ['world:felder', 'Felder'], ['world:waldrand', 'Waldrand'], ['world:hohlweg', 'Hohlweg'], ['world:hof', 'Hof · Heimkehr'],
  ['raid', 'Überfall'], ['aftermath', 'Hof · Reisevorbereitung'], ['road', 'Reise · Straße'], ['camp', 'Reise · Nachtlager'], ['strangers', 'Reise · Foltan und Azar'], ['companions-road', 'Reise · Aufbruch und Waldrast'],
  ['golden-boar', 'Zum Goldenen Eber'], ['reading-camp', 'Ein Versprechen am Feuer'], ['brotherhood', 'Die Freie Bruderschaft'], ['betrayal', 'Das verschwiegene Wissen'],
  ['rain-forest', 'Allein im Sommerregen'], ['flick-trail', 'Flicks Fährte'], ['shadow-camp', 'Das Gefangenenlager'], ['sisters-reunited', 'Kyra befreien'], ['film-one-finale', 'Ein gemeinsamer Weg'],
] as const;
export type CampaignCheckpointId = typeof CAMPAIGN_CHECKPOINTS[number][0];
export interface CheckpointDestination { scene: string; data: { map?: string } }
const equipment: Inventory = { proviant: 1, wasserschlauch: 1, dolch: 1, kupfer: 22, silber: 7, reisezeug: 1, heilzeug: 1, 'buch-kraeuter': 1, 'buch-alana': 1 };
export const isCampaignCheckpoint = (id: string): id is CampaignCheckpointId => CAMPAIGN_CHECKPOINTS.some(([key]) => key === id);

/** Authored required progress for debug entry. Optional observations remain unclaimed. */
export const CONTINUATION_CHECKPOINT_PROGRESS = [
  { id: 'golden-boar', flags: ['novel.kyra-described', 'novel.craupor-questioned', 'novel.desertion-known', 'novel.foltan-false-report'] },
  { id: 'reading-camp', flags: ['novel.reading-fire-ready', 'novel.herb-lexicon-read', 'novel.alana-read', 'novel.companions-promised', 'novel.azar-promised', 'novel.foltan-promised'] },
  { id: 'brotherhood', flags: ['novel.brotherhood-welcomed', 'novel.brotherhood-shelter-shown', 'novel.elnon-sought'] },
  { id: 'betrayal', flags: ['novel.foltan-lie-heard', 'novel.trust-broken', 'novel.lia-leaves-brotherhood', 'novel.azar-searching'] },
  { id: 'rain-forest', flags: ['film.rain-shelter', 'film.rain-tracks', 'film.flick-met', 'film.flick-helping'] },
  { id: 'flick-trail', flags: ['film.hoofprints', 'film.trail-direction', 'film.flick-rebels-known', 'film.dawn-trail'] },
  { id: 'shadow-camp', flags: ['film.transport-known', 'film.camp-route', 'film.rescue-plan', 'film.guards-distracted'] },
  { id: 'sisters-reunited', flags: ['film.kyra-unbound', 'film.magic-erupted', 'film.lia-recovered', 'film.sisters-reunited'] },
  { id: 'film-one-finale', flags: ['film.sisters-safe-path', 'film.rebels-proposed', 'film.final-banter', 'film.film-one-complete'] },
] as const;

/** Pure recipe retains optional finds and dynamic discoveries, resets chapter progress. */
export function campaignCheckpoint(st: CampaignState, id: string): { state: CampaignState; destination: CheckpointDestination } {
  if (!isCampaignCheckpoint(id)) throw new Error('Unbekannter Einstieg');
  const next = cloneCampaignState(st);
  for (const key of Object.keys(next.flags)) if (/^(novel\.|film\.|chapter:)/.test(key)) delete next.flags[key];
  const continuationIndex = CONTINUATION_CHECKPOINT_PROGRESS.findIndex(chapter => chapter.id === id);
  const continuation = continuationIndex >= 0;
  for (const flag of FLAGS) if (flag !== 'chickReturned') next.flags[flag] = false;
  for (const item of [...Object.keys(equipment), 'steine', 'zunderholz'] as ItemId[]) delete next.inv[item];
  const travel = continuation || ['road', 'camp', 'strangers', 'companions-road'].includes(id);
  const farm = id === 'aftermath' || travel;
  if (id.startsWith('world:') || id === 'raid' || farm) next.flags.sisterPromise = true;
  if (id === 'raid' || farm) next.flags.homeArrived = true;
  if (farm) for (const flag of ['raidWitnessed', 'parentsLost', 'kyraTaken']) next.flags[flag] = true;
  if (travel) {
    Object.assign(next.inv, equipment);
    for (const flag of FLAG_GROUPS.Hof) next.flags[flag] = true;
  }
  if (id === 'camp' || id === 'strangers') for (const flag of ['streamVisited', 'journeyEastChosen', 'journeyCampReached']) next.flags[flag] = true;
  if (continuation || id === 'companions-road') for (const flag of FLAG_GROUPS.Reise) next.flags[flag] = true;
  if (id === 'strangers') for (const flag of FLAG_GROUPS.Reise) next.flags[flag] = flag !== 'criosObserved' && flag !== 'journeyCloakRecovered';
  if (continuation) {
    for (const flag of FLAG_GROUPS.Gefährten) next.flags[flag] = true;
    if (id === 'film-one-finale') { next.flags.kyraTaken = false; next.flags['film.lia-collapsed'] = false; }
    for (const chapter of CONTINUATION_CHECKPOINT_PROGRESS.slice(0, continuationIndex)) {
      for (const flag of chapter.flags) next.flags[flag] = true;
      for (const status of ['entered', 'entry', 'complete']) next.flags[`chapter:${chapter.id}:${status}`] = true;
    }
  }
  if (!isCampaignState(next)) throw new Error('Ungültiger Kampagnenzustand');
  return { state: next, destination: { scene: continuation || id === 'companions-road' ? id : travel ? 'journey' : id.split(':')[0], data: id.startsWith('world:') ? { map: id.split(':')[1] } : {} } };
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

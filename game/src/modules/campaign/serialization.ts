import { isItemId } from "../inventory/catalog";
import { isItemCount } from "./commands";
import { isCampaignKey } from "./flags";
import { cloneCampaignState, type CampaignState } from "./state";

export const CAMPAIGN_SCHEMA_VERSION = 1 as const;
export interface CampaignSave { version: typeof CAMPAIGN_SCHEMA_VERSION; world: CampaignState }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
  && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
export function isCampaignState(value: unknown): value is CampaignState {
  if (!record(value) || !record(value.inv) || !record(value.picked) || !record(value.flags)) return false;
  if (Object.keys(value).some(key => !['inv', 'picked', 'flags'].includes(key))) return false;
  return Object.entries(value.inv).every(([item, count]) => isItemId(item) && isItemCount(count))
    && Object.entries(value.picked).every(([key, picked]) => isCampaignKey(key) && picked === true)
    && Object.entries(value.flags).every(([key, flag]) => isCampaignKey(key) && typeof flag === 'boolean');
}
const sortedRecord = <T>(value: Record<string, T>): Record<string, T> => Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));

/** Canonical key order makes equivalent states stable regardless of transition insertion order. */
export function serializeCampaign(st: CampaignState): string {
  if (!isCampaignState(st)) throw new Error('Ungültiger Kampagnenzustand');
  const world: CampaignState = { inv: sortedRecord(st.inv), picked: sortedRecord(st.picked), flags: sortedRecord(st.flags) };
  return JSON.stringify({ version: CAMPAIGN_SCHEMA_VERSION, world } satisfies CampaignSave);
}
export function deserializeCampaign(serialized: string): CampaignState | undefined {
  try {
    const save: unknown = JSON.parse(serialized);
    if (!record(save) || save.version !== CAMPAIGN_SCHEMA_VERSION || Object.keys(save).some(key => !['version', 'world'].includes(key)) || !isCampaignState(save.world)) return undefined;
    return cloneCampaignState(save.world);
  } catch { return undefined; }
}

import type { CampaignFlags } from '../campaign/flags';
import type { Inventory, ItemId } from './catalog';

export interface ItemComment {
  readonly line: string;
  readonly variants?: readonly { readonly flags: Readonly<Record<string, boolean>>; readonly line: string }[];
}
export type ItemComments = Readonly<Record<ItemId, ItemComment>>;
export interface ItemInspection { readonly item: ItemId; readonly comment: string }

/** Looking inside the bag never consumes an item or changes campaign progress. */
export function inspectInventoryItem(item: ItemId, inventory: Readonly<Inventory>, flags: Readonly<CampaignFlags>, comments: ItemComments): ItemInspection | undefined {
  const count = inventory[item];
  if (!Number.isSafeInteger(count) || (count ?? 0) <= 0) return undefined;
  const entry = comments[item];
  const variant = entry.variants?.find(candidate => Object.entries(candidate.flags).every(([key, expected]) => !!flags[key] === expected));
  return { item, comment: variant?.line ?? entry.line };
}

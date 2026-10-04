import { isItemId, type ItemId } from "../inventory/catalog";
import { isCampaignKey } from "./flags";
import type { CampaignState } from "./state";

export interface CampaignTransaction {
  type: 'transaction';
  items?: readonly { item: ItemId; delta: number }[];
  flags?: Readonly<Record<string, boolean>>;
  /** Requires an unset flag and sets it true as part of this transaction. */
  once?: string;
  /** Claims a pickup atomically with its reward. */
  pickup?: string;
}
export type CampaignCommand = CampaignTransaction
  | { type: 'add-item' | 'remove-item'; item: ItemId; count?: number }
  | { type: 'set-item'; item: ItemId; count: number }
  | { type: 'collect-pickup'; key: string; item: ItemId; count?: number }
  | { type: 'set-flag'; key: string; value: boolean }
  | { type: 'set-flags'; flags: Readonly<Record<string, boolean>> };
export const isItemCount = (count: unknown): count is number => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
const positiveCount = (count: unknown): count is number => isItemCount(count) && count > 0;

/** Validates the entire change before writing, preserving registry record identities. */
export function applyCampaignCommand(st: CampaignState, command: CampaignCommand): boolean {
  if (!st?.inv || !st.flags || !command) return false;
  switch (command.type) {
    case 'add-item': case 'remove-item': case 'collect-pickup': {
      const count = command.count ?? 1;
      if (!isItemId(command.item) || !positiveCount(count)) return false;
      return applyCampaignCommand(st, { type: 'transaction', items: [{ item: command.item, delta: command.type === 'remove-item' ? -count : count }],
        ...(command.type === 'collect-pickup' ? { pickup: command.key } : {}) });
    }
    case 'set-item':
      if (!isItemId(command.item) || !isItemCount(command.count)) return false;
      st.inv[command.item] = command.count;
      return true;
    case 'set-flag':
      if (!isCampaignKey(command.key) || typeof command.value !== 'boolean') return false;
      return applyCampaignCommand(st, { type: 'transaction', flags: { [command.key]: command.value } });
    case 'set-flags': return applyCampaignCommand(st, { type: 'transaction', flags: command.flags });
    case 'transaction': {
      if (command.once !== undefined && (!isCampaignKey(command.once)
        || (Object.hasOwn(st.flags, command.once) && st.flags[command.once] === true)
        || !command.flags || !Object.hasOwn(command.flags, command.once) || command.flags[command.once] !== true)) return false;
      if (command.pickup !== undefined && (!isCampaignKey(command.pickup) || !st.picked
        || (Object.hasOwn(st.picked, command.pickup) && st.picked[command.pickup] === true))) return false;
      if (command.items !== undefined && !Array.isArray(command.items)) return false;
      if (command.flags !== undefined && (!command.flags || typeof command.flags !== 'object' || Array.isArray(command.flags)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(command.flags)))) return false;
      const counts = new Map<ItemId, number>();
      for (const change of command.items ?? []) {
        const item: unknown = change?.item;
        if (!change || !isItemId(item) || !Number.isSafeInteger(change.delta)) return false;
        const current = counts.get(item) ?? st.inv[item] ?? 0;
        if (!isItemCount(current)) return false;
        const next = current + change.delta;
        if (!isItemCount(next)) return false;
        counts.set(item, next);
      }
      const flags = Object.entries(command.flags ?? {});
      if (flags.some(([key, value]) => !isCampaignKey(key) || typeof value !== 'boolean')) return false;
      for (const [item, count] of counts) {
        if (count) st.inv[item] = count;
        else delete st.inv[item];
      }
      for (const [key, value] of flags) st.flags[key] = value;
      if (command.pickup !== undefined) st.picked[command.pickup] = true;
      return true;
    }
    default: return false;
  }
}
export const addCampaignItem = (st: CampaignState, item: ItemId, count = 1) => applyCampaignCommand(st, { type: 'add-item', item, count });
export const removeCampaignItem = (st: CampaignState, item: ItemId, count = 1) => applyCampaignCommand(st, { type: 'remove-item', item, count });
export const collectCampaignPickup = (st: CampaignState, key: string, item: ItemId, count = 1) => applyCampaignCommand(st, { type: 'collect-pickup', key, item, count });
export const setCampaignFlag = (st: CampaignState, key: string, value = true) => applyCampaignCommand(st, { type: 'set-flag', key, value });
export const setCampaignFlags = (st: CampaignState, flags: Readonly<Record<string, boolean>>) => applyCampaignCommand(st, { type: 'set-flags', flags });

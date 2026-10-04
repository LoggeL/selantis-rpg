import { applyCampaignCommand } from "./commands";
import type { CampaignState } from "./state";
import type { ItemId } from "../inventory/catalog";

export interface WorldDrop { item: ItemId; from: { x: number; y: number }; to: { x: number; y: number }; id: string }
export type RandomInteger = (min: number, max: number) => number;
export function shakeCampaignTree(st: CampaignState, key: string, propId: string, at: readonly [number, number], random: RandomInteger): WorldDrop[] | undefined {
  const flag = `${key}:shaken`;
  if (st.flags[flag]) return undefined;
  const drops: WorldDrop[] = [];
  for (let i = 0; i < 2; i++) {
    const jitter = random(-4, 4), dy = random(6, 14);
    if (!Number.isInteger(jitter) || jitter < -4 || jitter > 4 || !Number.isInteger(dy) || dy < 6 || dy > 14) return undefined;
    const to = { x: at[0] + (i ? 16 : -14) + jitter, y: at[1] + dy };
    drops.push({ item: 'apfel', from: { x: to.x, y: at[1] - 60 }, to, id: `${propId}-apfel-${i}` });
  }
  return applyCampaignCommand(st, { type: 'transaction', once: flag, flags: { [flag]: true } }) ? drops : undefined;
}
export const canReturnCampaignChick = (st: CampaignState): boolean => !st.flags.chickReturned && (st.inv.kueken ?? 0) > 0;
export const completeCampaignChickReturn = (st: CampaignState): boolean => applyCampaignCommand(st, {
  type: 'transaction', once: 'chickReturned', items: [{ item: 'kueken', delta: -1 }], flags: { chickReturned: true },
});

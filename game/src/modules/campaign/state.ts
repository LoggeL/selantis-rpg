import type { Inventory } from "../inventory/catalog";
import type { CampaignFlags } from "./flags";

/** Registry-compatible state; metadata belongs to the serialization envelope. */
export interface CampaignState {
  inv: Inventory;
  picked: Record<string, true>;
  flags: CampaignFlags;
}
export type WorldState = CampaignState;
export const createCampaignState = (): CampaignState => ({ inv: {}, picked: {}, flags: {} });
export const cloneCampaignState = (st: CampaignState): CampaignState => ({ inv: { ...st.inv }, picked: { ...st.picked }, flags: { ...st.flags } });

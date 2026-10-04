import { applyCampaignCommand } from "./commands";
import type { CampaignState } from "./state";
const HOME_ROUTE: Record<string, { exit?: string; text: string }> = {
  wiese: { exit: 'hohlweg', text: 'Nach Hause · Den Hohlweg nach Süden nehmen.' },
  waldrand: { exit: 'wiese', text: 'Nach Hause · Nach Osten zur Wiese.' },
  felder: { exit: 'hof', text: 'Nach Hause · Dem Feldweg nach Süden folgen.' },
  hohlweg: { exit: 'hof', text: 'Nach Hause · Dem Weg nach Osten folgen.' },
  hof: { text: 'Nach Hause · Am Hof sofort in der Böschung verstecken.' },
};
export function homecomingObjective(st: CampaignState, map = 'wiese'): string {
  return st.flags.homeArrived ? 'Nach Hause · abgeschlossen' : HOME_ROUTE[map]?.text ?? 'Nach Hause';
}
export const homewardExit = (map: string) => HOME_ROUTE[map]?.exit;
export const completeHomecoming = (st: CampaignState): boolean => applyCampaignCommand(st, { type: 'transaction', once: 'homeArrived', flags: { homeArrived: true } });

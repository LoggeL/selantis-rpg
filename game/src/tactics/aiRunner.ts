import type { BattleController, Presenter } from './controller';
import { endTurnFacing, planTurn } from './rules/ai';
import { key } from './rules/grid';

/** Executes one AI unit's turn with readable pacing: focus, intent, move, ability plate, action. */
export async function executePlanSteps(c: BattleController, id: string, p: Presenter): Promise<void> {
  const b = c.battle;
  const plan = planTurn(b, id);
  // Like the player, every AI unit picks its facing at the end of its turn.
  const turnAtEnd = async () => { const f = endTurnFacing(b, plan); if (f && !c.isEnded) await c.apply(b.face(id, f)); };
  if (!plan.moveTo && !plan.action) { await turnAtEnd(); b.wait(id); return; }
  await p.focus(id, 260);
  const doMove = async () => {
    if (!plan.moveTo || !b.canMove(id) || b.unit(id).down) return;
    const reach = b.reach(id);
    if (!reach.has(key(plan.moveTo.x, plan.moveTo.y))) return;
    await p.showEnemyIntent(id, [...reach.values()].map(n => ({ x: n.x, y: n.y })));
    await c.apply(b.move(id, plan.moveTo));
  };
  const doAct = async () => {
    if (!plan.action || !b.canAct(id) || b.unit(id).down) return;
    if (!b.validTarget(id, plan.action.ability, plan.action.target)) return;
    await p.announce(id, plan.action.ability);
    await c.apply(b.act(id, plan.action.ability, plan.action.target));
  };
  if (plan.actFirst) { await doAct(); await doMove(); } else { await doMove(); await doAct(); }
  await turnAtEnd();
  if (!b.unit(id).down) b.wait(id);
}

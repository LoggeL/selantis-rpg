import { afterEach, describe, expect, it, vi } from 'vitest';
import { G } from '../../core/G';
import type { UiApi } from '../../ui/api';
import type { WorldCtx } from '../../world/api';

vi.mock('../../world', () => ({ defineMap: (map: unknown) => map }));
import { finaleScript, lagerNachtMap } from './finale';

const originalUi = G.ui;
const originalGoto = G.goto;
afterEach(() => { G.ui = originalUi; G.goto = originalGoto; G.state.reset(); });

function context(choice: number): WorldCtx {
  G.ui = { fade: vi.fn(async () => {}) } as unknown as UiApi;
  return {
    lockPlayer: vi.fn(), unlockPlayer: vi.fn(), choose: vi.fn(async () => choice),
    setObjective: vi.fn((id: string, text: string) => G.state.objective(id, text)),
    completeObjective: vi.fn((id: string) => G.state.complete(id)),
    despawn: vi.fn(), companions: { add: vi.fn() },
  } as unknown as WorldCtx;
}
const departure = lagerNachtMap.triggers!.find(t => t.id === 'aufbruch')!.onEnter as (w: WorldCtx) => Promise<void>;

describe('finale departure choices', () => {
  it.each([false, true])('keeps departure guidance when staying at the fire (old completed save: %s)', async completed => {
    G.state.set('k5-ende');
    G.state.objective('k5-aufbruch', 'Brich mit Kyra und Flick auf.');
    if (completed) G.state.complete('k5-aufbruch');
    const w = context(3);
    await departure(w);
    expect(G.state.activeObjective()?.id).toBe('k5-aufbruch');
    expect(w.setObjective).toHaveBeenCalledWith('k5-aufbruch', 'Brich mit Kyra und Flick auf.', [650, 704]);
    expect(w.unlockPlayer).toHaveBeenCalledOnce();
  });

  it('reopens departure when continuing an old finale save', async () => {
    G.state.set('k5-erwacht'); G.state.set('k5-weiter'); G.state.set('k5-ende');
    G.state.objective('k5-aufbruch', 'Brich mit Kyra und Flick auf.');
    G.state.complete('k5-aufbruch');
    await finaleScript(context(3));
    expect(G.state.activeObjective()?.id).toBe('k5-aufbruch');
  });

  it('completes departure when choosing onward travel', async () => {
    G.state.set('k5-ende');
    G.state.objective('k5-aufbruch', 'Brich mit Kyra und Flick auf.');
    G.goto = vi.fn(async () => {});
    await departure(context(1));
    expect(G.state.data.objectives.find(o => o.id === 'k5-aufbruch')?.done).toBe(true);
    expect(G.goto).toHaveBeenCalledWith('weiterreise');
  });
});

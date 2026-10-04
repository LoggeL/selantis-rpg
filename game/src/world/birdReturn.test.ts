import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: {} }));
vi.mock('../audio', () => ({ sfx: { bird: vi.fn() } }));
import { runAction, type WorldApi } from './quests';
import { waldrand } from './maps/waldrand';

describe('returning the rescued bird', () => {
  it('keeps the bird until the climb finishes and rewards completion exactly once', () => {
    let complete = () => {};
    const st = { inv: { kueken: 1 }, picked: {}, flags: {} };
    const api: WorldApi = {
      st, mapId: 'waldrand', thought: vi.fn(), give: vi.fn(),
      take: vi.fn(() => { st.inv.kueken--; }), dropPickup: vi.fn(), shakeAt: vi.fn(),
      showNest: vi.fn(), refreshObjective: vi.fn(), beginChickReturn: vi.fn((_prop, finish) => { complete = finish; }),
    };
    const tree = waldrand.props.find(prop => prop.action === 'returnChick')!;
    expect(runAction(tree, api)).toBe(true);
    expect(st.inv.kueken).toBe(1);
    expect(st.flags).not.toHaveProperty('chickReturned');
    expect(api.showNest).not.toHaveBeenCalled();
    complete(); complete(); runAction(tree, api);
    expect(st.inv.kueken).toBe(0);
    expect(st.flags).toHaveProperty('chickReturned', true);
    expect(api.take).toHaveBeenCalledOnce();
    expect(api.dropPickup).toHaveBeenCalledOnce();
    expect(api.showNest).toHaveBeenCalledOnce();
    expect(api.beginChickReturn).toHaveBeenCalledOnce();
  });

  it('does not start without a bird and does not reward a stale completion', () => {
    let complete = () => {};
    const st = { inv: { kueken: 0 }, picked: {}, flags: {} };
    const api = { st, mapId: 'waldrand', thought: vi.fn(), take: vi.fn(), showNest: vi.fn(), dropPickup: vi.fn(), refreshObjective: vi.fn(),
      beginChickReturn: vi.fn((_prop, finish) => { complete = finish; }) } as unknown as WorldApi;
    const tree = waldrand.props.find(prop => prop.action === 'returnChick')!;
    expect(runAction(tree, api)).toBe(false);
    expect(api.beginChickReturn).not.toHaveBeenCalled();
    st.inv.kueken = 1; runAction(tree, api); st.inv.kueken = 0; complete();
    expect(st.flags).not.toHaveProperty('chickReturned');
    expect(api.dropPickup).not.toHaveBeenCalled();
  });
});

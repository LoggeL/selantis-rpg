import { describe, expect, it } from 'vitest';
import { addCampaignItem, applyCampaignCommand, collectCampaignPickup, removeCampaignItem, setCampaignFlags } from "./commands";
import { cloneCampaignState, createCampaignState } from "./state";
import { completeCampaignChickReturn, shakeCampaignTree } from "./worldActions";
import { inventorySnapshot } from "../inventory/snapshot";

describe('campaign authority', () => {
  it('rejects invalid amounts, missing items and overflow without writing', () => {
    const st = createCampaignState();
    for (const count of [-1, 0, 0.5, NaN, Infinity]) {
      expect(addCampaignItem(st, 'proviant', count)).toBe(false);
      expect(removeCampaignItem(st, 'proviant', count)).toBe(false);
    }
    expect(removeCampaignItem(st, 'proviant')).toBe(false);
    expect(st.inv).toEqual({});
    expect(addCampaignItem(st, 'proviant', Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(addCampaignItem(st, 'proviant')).toBe(false);
    expect(st.inv.proviant).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('rejects the entire reward when a later item cannot be consumed', () => {
    const st = createCampaignState(); st.inv.proviant = 1;
    expect(applyCampaignCommand(st, { type: 'transaction', items: [{ item: 'feder', delta: 2 }, { item: 'proviant', delta: -2 }], flags: { journeyAte: true }, pickup: 'camp:reward' })).toBe(false);
    expect(st).toEqual({ inv: { proviant: 1 }, flags: {}, picked: {} });
  });
  it('claims pickup and item together and rejects replays', () => {
    const st = createCampaignState();
    expect(collectCampaignPickup(st, 'wiese:apple', 'apfel', 2)).toBe(true);
    expect(collectCampaignPickup(st, 'wiese:apple', 'apfel', 2)).toBe(false);
    expect(st.inv.apfel).toBe(2);
    expect(collectCampaignPickup(st, 'wiese:bad', 'apfel', -1)).toBe(false);
    expect(st.picked).toEqual({ 'wiese:apple': true });
  });
  it.each(['toString', 'valueOf'])('accepts the inherited key %s once and rejects repeat rewards without mutation', key => {
    const st = createCampaignState();
    const command = { type: 'transaction' as const, once: key, flags: { [key]: true }, items: [{ item: 'feder' as const, delta: 1 }] };
    expect(applyCampaignCommand(st, command)).toBe(true);
    expect(Object.hasOwn(st.flags, key)).toBe(true);
    expect(st.flags[key]).toBe(true);
    const completed = cloneCampaignState(st);
    expect(applyCampaignCommand(st, command)).toBe(false);
    expect(st).toEqual(completed);

    const pickup = createCampaignState();
    expect(collectCampaignPickup(pickup, key, 'feder')).toBe(true);
    expect(Object.hasOwn(pickup.picked, key)).toBe(true);
    expect(pickup.picked[key]).toBe(true);
    const collected = cloneCampaignState(pickup);
    expect(collectCampaignPickup(pickup, key, 'feder')).toBe(false);
    expect(pickup).toEqual(collected);
  });
  it('permits an explicit false completion flag to be reset and still rejects own true replays', () => {
    const st = createCampaignState();
    st.flags.homeArrived = false;
    const command = { type: 'transaction' as const, once: 'homeArrived', flags: { homeArrived: true }, items: [{ item: 'apfel' as const, delta: 1 }] };
    expect(applyCampaignCommand(st, command)).toBe(true);
    const completed = cloneCampaignState(st);
    expect(applyCampaignCommand(st, command)).toBe(false);
    expect(st).toEqual(completed);
  });
  it('commits consumption and completion once, retaining shared record identities', () => {
    const st = createCampaignState(); st.inv.kueken = 1;
    const { inv, flags, picked } = st;
    expect(completeCampaignChickReturn(st)).toBe(true);
    expect(completeCampaignChickReturn(st)).toBe(false);
    expect(st.inv).toBe(inv); expect(st.flags).toBe(flags); expect(st.picked).toBe(picked);
    expect(st.inv.kueken).toBeUndefined(); expect(st.flags.chickReturned).toBe(true);
  });
  it('rejects unsafe flag patches atomically but permits explicit debug contradictions', () => {
    const st = createCampaignState();
    expect(setCampaignFlags(st, JSON.parse('{"homeArrived":true,"__proto__":true}'))).toBe(false);
    expect(st.flags).toEqual({});
    expect(applyCampaignCommand(st, { type: 'transaction', once: 'homeArrived', flags: Object.create({ homeArrived: true }) })).toBe(false);
    expect(st.flags).toEqual({});
    expect(setCampaignFlags(st, { departureReady: true, packedFood: false })).toBe(true);
    expect(st.flags).toEqual({ departureReady: true, packedFood: false });
  });
  it('uses injected tree randomness and never repeats generated rewards', () => {
    const st = createCampaignState();
    const drops = shakeCampaignTree(st, 'wiese:tree', 'tree', [100, 100], min => min);
    expect(drops?.map(drop => drop.to)).toEqual([{ x: 82, y: 106 }, { x: 112, y: 106 }]);
    expect(shakeCampaignTree(st, 'wiese:tree', 'tree', [100, 100], min => min)).toBeUndefined();
    expect(shakeCampaignTree(st, 'wiese:other', 'other', [100, 100], () => 999)).toBeUndefined();
    expect(st.flags['wiese:other:shaken']).toBeUndefined();
  });
  it('detaches inventory views from later domain changes', () => {
    const st = createCampaignState(); addCampaignItem(st, 'feder', 2);
    const view = inventorySnapshot(st.inv); addCampaignItem(st, 'feder');
    expect(view).toEqual([{ id: 'feder', name: 'Feder', count: 2 }]);
    expect(Object.isFrozen(view)).toBe(true); expect(Object.isFrozen(view[0])).toBe(true);
  });
});

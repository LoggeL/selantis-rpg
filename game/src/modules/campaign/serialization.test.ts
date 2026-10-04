import { expect, it } from 'vitest';
import { deserializeCampaign, serializeCampaign } from "./serialization";
import { createCampaignState } from "./state";
import { campaignCheckpoint, prepareCampaignCheckpoint } from "./checkpoints";

it('roundtrips a versioned detached state including dynamic world keys', () => {
  const st = createCampaignState();
  st.inv.proviant = 2; st.flags['drop:wiese:apple:apfel:120:180'] = true; st.picked['wiese:feather'] = true;
  const loaded = deserializeCampaign(serializeCampaign(st));
  expect(loaded).toEqual(st); expect(loaded).not.toBe(st); expect(loaded?.inv).not.toBe(st.inv);
});
it('rejects malformed/future saves and invalid counters without creating defaults', () => {
  const save = { version: 1, world: createCampaignState() };
  for (const text of ['not json', JSON.stringify({ ...save, version: 2 }), JSON.stringify({ ...save, world: { ...save.world, inv: { apfel: -1 } } }), JSON.stringify({ ...save, world: { ...save.world, inv: { apfel: 1.5 } } }), JSON.stringify({ ...save, world: { ...save.world, inv: { unknown: 1 } } }), '{"version":1,"world":{"inv":{},"picked":{},"flags":{"__proto__":true}}}']) expect(deserializeCampaign(text)).toBeUndefined();
  expect(() => serializeCampaign({ ...save.world, inv: { apfel: Infinity } })).toThrow();
});
it('constructs checkpoints purely and repeats exact equipment rather than granting twice', () => {
  const st = createCampaignState(); st.inv.feder = 2; st.flags.chickReturned = true; st.picked.optional = true;
  const original = serializeCampaign(st);
  expect(campaignCheckpoint(st, 'camp').state.inv).toMatchObject({ feder: 2, proviant: 1 });
  expect(serializeCampaign(st)).toBe(original);
  prepareCampaignCheckpoint(st, 'camp'); const first = serializeCampaign(st);
  prepareCampaignCheckpoint(st, 'camp'); expect(serializeCampaign(st)).toBe(first);
  expect(() => prepareCampaignCheckpoint(st, 'unknown')).toThrow(); expect(serializeCampaign(st)).toBe(first);
  expect(st.flags.chickReturned).toBe(true); expect(st.picked.optional).toBe(true);
});

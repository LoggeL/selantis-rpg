import { describe, expect, it } from 'vitest';
import { ITEM_COMMENTS } from '../../content/inventory/comments';
import { ITEM_ORDER, type Inventory } from './catalog';
import { inspectInventoryItem } from './inspection';

describe('looking at carried items', () => {
  it.each(ITEM_ORDER)('gives Lia a comment for %s without changing the item or progress', item => {
    const inventory: Inventory = { [item]: 2 }, flags = { packedFood: true };
    const before = { inventory: { ...inventory }, flags: { ...flags } };
    expect(inspectInventoryItem(item, inventory, flags, ITEM_COMMENTS)).toMatchObject({ item, comment: expect.any(String) });
    expect(inspectInventoryItem(item, inventory, flags, ITEM_COMMENTS)?.comment.length).toBeGreaterThan(15);
    expect({ inventory, flags }).toEqual(before);
  });

  it.each([undefined, 0, -1, 0.5, NaN, Infinity])('does not inspect a missing or malformed stack (%s)', count => {
    expect(inspectInventoryItem('proviant', { proviant: count }, {}, ITEM_COMMENTS)).toBeUndefined();
  });

  it('reacts to the meal without consuming another portion', () => {
    const inventory: Inventory = { proviant: 2 };
    expect(inspectInventoryItem('proviant', inventory, {}, ITEM_COMMENTS)?.comment).toContain('haushalten');
    expect(inspectInventoryItem('proviant', inventory, { campfireLit: true }, ITEM_COMMENTS)?.comment).toContain('Brot und Käse essen');
    expect(inspectInventoryItem('proviant', inventory, { campfireLit: true, journeyAte: true }, ITEM_COMMENTS)?.comment).toContain('hebe ich');
    expect(inventory.proviant).toBe(2);
  });

  it('uses the bird, water and recovered cloak context', () => {
    expect(inspectInventoryItem('feder', { feder: 1 }, { chickReturned: true }, ITEM_COMMENTS)?.comment).toContain('wieder bei seiner Mutter');
    expect(inspectInventoryItem('wasserschlauch', { wasserschlauch: 1 }, { streamVisited: true }, ITEM_COMMENTS)?.comment).toContain('aufgefüllt');
    expect(inspectInventoryItem('reisezeug', { reisezeug: 1 }, { journeyCloakSpread: true }, ITEM_COMMENTS)?.comment).toContain('Schlafplatz');
    expect(inspectInventoryItem('reisezeug', { reisezeug: 1 }, { journeyCloakSpread: true, journeyCloakRecovered: true }, ITEM_COMMENTS)?.comment).not.toContain('Schlafplatz');
  });
});

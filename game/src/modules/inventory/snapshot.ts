import { ITEM_NAMES, ITEM_ORDER, type Inventory, type ItemId } from "./catalog";

export interface InventoryEntry { readonly id: ItemId; readonly name: string; readonly count: number }
/** Detached read model: a view never receives the mutable campaign record. */
export function inventorySnapshot(inv: Readonly<Inventory>): readonly InventoryEntry[] {
  return Object.freeze(ITEM_ORDER.filter(id => (inv[id] ?? 0) > 0)
    .map(id => Object.freeze({ id, name: ITEM_NAMES[id], count: inv[id]! })));
}

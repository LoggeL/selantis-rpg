/** Canonical identifiers, labels, ordering and sprite metadata for carried items. */
export const ITEM_CATALOG = {
  apfel: { name: 'Fallobst', debugName: 'Fallobst', group: 'find', texture: 'items', frame: 0 },
  kornblume: { name: 'Kornblume', debugName: 'Kornblume', group: 'find', texture: 'items', frame: 4 },
  kupfer: { name: 'Kupferstück', debugName: 'Kupfer', group: 'find', texture: 'items', frame: 3 },
  feder: { name: 'Feder', debugName: 'Feder', group: 'find', texture: 'items', frame: 2 },
  kueken: { name: 'Vogeljunges', debugName: 'Vogeljunges', group: 'find', texture: 'crt-fledgling', frame: -1 },
  proviant: { name: 'Reiseproviant', debugName: 'Proviant', group: 'travel', texture: 'story-items', frame: 0 },
  wasserschlauch: { name: 'Wasserschlauch', debugName: 'Wasserschlauch', group: 'travel', texture: 'story-items', frame: 1 },
  dolch: { name: 'Familientolch', debugName: 'Dolch', group: 'travel', texture: 'story-items', frame: 2 },
  silber: { name: 'Silbermünze', debugName: 'Silber', group: 'travel', texture: 'story-items', frame: 3 },
  reisezeug: { name: 'Mantel, Decke und Schuhe', debugName: 'Reisezeug', group: 'travel', texture: 'story-items', frame: 4 },
  heilzeug: { name: 'Tinktur und Leinen', debugName: 'Heilzeug', group: 'travel', texture: 'story-items', frame: 5 },
  'buch-kraeuter': { name: 'Cronibus Kräuterlexikon', debugName: 'Kräuterlexikon', group: 'travel', texture: 'story-items', frame: 6 },
  'buch-alana': { name: 'Alanas Geschichte', debugName: 'Alanas Geschichte', group: 'travel', texture: 'story-items', frame: 7 },
  steine: { name: 'Steine', debugName: 'Feuerstellensteine', group: 'travel', texture: 'camp-stones', frame: 0 },
  zunderholz: { name: 'Laub und Zweige', debugName: 'Zunderholz', group: 'travel', texture: 'camp-wood', frame: 0 },
} as const;

export type ItemId = keyof typeof ITEM_CATALOG;
export type Inventory = Partial<Record<ItemId, number>>;
export const ITEM_ORDER = Object.keys(ITEM_CATALOG) as ItemId[];
export const FIND_ITEM_ORDER = ITEM_ORDER.filter(item => ITEM_CATALOG[item].group === 'find');
export const TRAVEL_ITEM_ORDER = ITEM_ORDER.filter(item => ITEM_CATALOG[item].group === 'travel');
export const ITEM_NAMES = Object.fromEntries(ITEM_ORDER.map(item => [item, ITEM_CATALOG[item].name])) as Record<ItemId, string>;
export const ITEM_DEBUG_NAMES = Object.fromEntries(ITEM_ORDER.map(item => [item, ITEM_CATALOG[item].debugName])) as Record<ItemId, string>;
export const ITEM_FRAME = Object.fromEntries(ITEM_ORDER.map(item => [item, ITEM_CATALOG[item].frame])) as Record<ItemId, number>;
export const itemTexture = (item: ItemId) => ITEM_CATALOG[item].texture;
export const isItemId = (value: unknown): value is ItemId => typeof value === 'string' && Object.hasOwn(ITEM_CATALOG, value);

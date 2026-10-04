import type { ItemId } from "../../../modules/inventory/catalog";
import type { Pt } from "../../../modules/narrative/types";
import type { HouseTargetId } from "../../areas/aftermath";

export const PACK_FLAGS = ['packedFood', 'packedWater', 'foundCache', 'packedMedicine', 'packedClothes', 'packedBooks'] as const;
export type PackFlag = typeof PACK_FLAGS[number];
export const HOUSE_FLAGS: Partial<Record<HouseTargetId, PackFlag>> = {
  food: 'packedFood', water: 'packedWater', cupboard: 'foundCache', medicine: 'packedMedicine', clothing: 'packedClothes', books: 'packedBooks',
};
export const HOUSE_PROPS: { flag: PackFlag; texture: string; at: Pt; size: Pt; items: { item: ItemId; at: Pt; size?: number }[] }[] = [
  { flag: 'packedFood', texture: 'house-prop-food', at: [433, 126], size: [80, 28], items: [
    { item: 'proviant', at: [412, 127], size: 22 }, { item: 'proviant', at: [433, 127], size: 22 }, { item: 'proviant', at: [454, 127], size: 22 },
  ] },
  { flag: 'packedWater', texture: 'house-prop-water', at: [519, 128], size: [38, 34], items: [{ item: 'wasserschlauch', at: [518, 131], size: 28 }] },
  { flag: 'foundCache', texture: 'house-prop-cache', at: [551, 175], size: [44, 24], items: [
    { item: 'silber', at: [540, 174], size: 20 }, { item: 'dolch', at: [558, 173], size: 24 },
  ] },
  { flag: 'packedMedicine', texture: 'house-prop-medicine', at: [112, 141], size: [48, 24], items: [{ item: 'heilzeug', at: [112, 141], size: 28 }] },
  { flag: 'packedClothes', texture: 'house-prop-clothes', at: [110, 216], size: [45, 55], items: [{ item: 'reisezeug', at: [110, 209], size: 32 }] },
  { flag: 'packedBooks', texture: 'house-prop-books', at: [290, 155], size: [46, 24], items: [
    { item: 'buch-kraeuter', at: [279, 155], size: 20 }, { item: 'buch-alana', at: [300, 155], size: 20 },
  ] },
];


export const PACK_ACTIONS: Record<Exclude<HouseTargetId, 'exit-door'>, { flag: PackFlag; items: [ItemId, number][]; narrativeId: string; line: string }> = {
  food: { flag: 'packedFood', items: [['proviant', 1]], narrativeId: 'aftermath.pack.food', line: 'Speck, ein halber Laib Käse, zwei Brote. Alles in den Lederbeutel vom Ofen. Das muss fürs Erste reichen.' },
  water: { flag: 'packedWater', items: [['wasserschlauch', 1]], narrativeId: 'aftermath.pack.water', line: 'Den Wasserschlauch hänge ich mir um.' },
  cupboard: { flag: 'foundCache', items: [['kupfer', 22], ['silber', 7], ['dolch', 1]], narrativeId: 'aftermath.pack.cupboard', line: 'Vaters doppelter Boden. Den haben sie nicht gefunden: 22 Kupfer, 7 Silber. Und sein Dolch.' },
  medicine: { flag: 'packedMedicine', items: [['heilzeug', 1]], narrativeId: 'aftermath.pack.medicine', line: 'Mutters Kräutertinktur. Damit hat sie uns jede Schramme versorgt. Die nehme ich mit, und Leinen dazu.' },
  clothing: { flag: 'packedClothes', items: [['reisezeug', 1]], narrativeId: 'aftermath.pack.clothing', line: 'Ich binde die Haare zurück und ziehe die Lederschuhe an. Der grüne Regenmantel und die Wolldecke kommen in die Tasche.' },
  books: { flag: 'packedBooks', items: [['buch-kraeuter', 1], ['buch-alana', 1]], narrativeId: 'aftermath.pack.books', line: 'Alanas Geschichte und Cronibus Kräuterlexikon kommen in die Tasche.' },
};

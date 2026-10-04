import type { MapDef } from '../../modules/exploration/mapTypes';
export type { Pt, Dir, Exit, Entry, Prop, Pickup, CritterKind, CritterDef, Jump, Trigger, MapDef } from '../../modules/exploration/mapTypes';
export type { ItemId } from '../../modules/inventory/catalog';

import { wiese } from "./wiese";
import { waldrand } from "./waldrand";
import { felder } from "./felder";
import { hohlweg } from "./hohlweg";
import { hof } from "./hof";

export const MAPS: Record<string, MapDef> = { wiese, waldrand, felder, hohlweg, hof };

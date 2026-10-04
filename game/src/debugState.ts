import type { WorldState } from './world/quests';
import type { ItemId } from './world/maps';

export const FLAG_GROUPS = {
  Heimweg: ['sisterPromise', 'homeArrived', 'chickReturned'],
  Hof: ['raidWitnessed', 'parentsLost', 'kyraTaken', 'packedFood', 'packedWater', 'foundCache', 'packedMedicine', 'packedClothes', 'packedBooks', 'houseClosed', 'pigsReleased', 'departureReady', 'aftermathComplete'],
  Reise: ['streamVisited', 'journeyEastChosen', 'journeyCampReached', 'journeyCloakSpread', 'journeyTwigsGathered', 'campfireLit', 'journeyAte', 'journeyFeetChecked', 'firstCampRested', 'metFoltanAzar', 'journeyRopesReleased', 'criosObserved'],
} as const;
export const FLAGS: readonly string[] = Object.values(FLAG_GROUPS).flat();
export const ITEMS: Record<ItemId, string> = {
  apfel: 'Fallobst', feder: 'Feder', kupfer: 'Kupfer', kornblume: 'Kornblume', kueken: 'Vogeljunges',
  proviant: 'Proviant', wasserschlauch: 'Wasserschlauch', dolch: 'Dolch', silber: 'Silber', reisezeug: 'Reisezeug', heilzeug: 'Heilzeug', 'buch-kraeuter': 'Kräuterlexikon', 'buch-alana': 'Alanas Geschichte',
};
export const WARPS = [
  ['battle', 'Valentus · Schlachtutorial'], ['break', 'Verwundung'], ['flight', 'Flucht'], ['refuge', 'Zuflucht'], ['lia', 'Lia · Gespräch mit Kyra'],
  ['world:wiese', 'Wiese'], ['world:felder', 'Felder'], ['world:waldrand', 'Waldrand'], ['world:hohlweg', 'Hohlweg'], ['world:hof', 'Hof · Heimkehr'],
  ['raid', 'Überfall'], ['aftermath', 'Hof · Reisevorbereitung'], ['road', 'Reise · Straße'], ['camp', 'Reise · Nachtlager'], ['strangers', 'Reise · Foltan und Azar'],
] as const;
export function editFlag(st: WorldState, key: string, value: boolean): boolean {
  if (!FLAGS.includes(key) || typeof value !== 'boolean') return false;
  st.flags[key] = value;
  return true;
}
export function editItem(st: WorldState, key: string, value: number): boolean {
  if (!Object.hasOwn(ITEMS, key) || !Number.isInteger(value) || value < 0 || value > 999) return false;
  st.inv[key as ItemId] = value;
  return true;
}
type InputScene = { input: { enabled: boolean; keyboard?: { enabled: boolean; resetKeys(): unknown } | null } };
export class DebugPause {
  private held = new Map<InputScene, { input: boolean; keyboard?: boolean }>();
  hold(scene: InputScene) {
    if (this.held.has(scene)) return;
    this.held.set(scene, { input: scene.input.enabled, keyboard: scene.input.keyboard?.enabled });
    scene.input.keyboard?.resetKeys();
    scene.input.enabled = false;
    if (scene.input.keyboard) scene.input.keyboard.enabled = false;
  }
  release(scene: InputScene) {
    const saved = this.held.get(scene);
    if (!saved) return;
    this.held.delete(scene);
    scene.input.keyboard?.resetKeys();
    scene.input.enabled = saved.input;
    if (scene.input.keyboard && saved.keyboard !== undefined) scene.input.keyboard.enabled = saved.keyboard;
  }
  forget(scene: InputScene) { this.held.delete(scene); }
}
const equipment: Partial<Record<ItemId, number>> = { proviant: 1, wasserschlauch: 1, dolch: 1, kupfer: 22, silber: 7, reisezeug: 1, heilzeug: 1, 'buch-kraeuter': 1, 'buch-alana': 1 };

/** Explicit checkpoint recipes, never an arbitrary scene name or coordinates. */
export function prepareWarp(st: WorldState, id: string): { scene: string; data: { map?: string } } {
  if (!WARPS.some(([key]) => key === id)) throw new Error('Unbekannter Einstieg');
  for (const flag of FLAGS) if (flag !== 'chickReturned') st.flags[flag] = false;
  for (const item of Object.keys(equipment) as ItemId[]) delete st.inv[item];
  const travel = ['road', 'camp', 'strangers'].includes(id);
  const farm = id === 'aftermath' || travel;
  if (id.startsWith('world:') || id === 'raid' || farm) st.flags.sisterPromise = true;
  if (id === 'raid' || farm) st.flags.homeArrived = true;
  if (farm) for (const flag of ['raidWitnessed', 'parentsLost', 'kyraTaken']) st.flags[flag] = true;
  if (travel) {
    Object.assign(st.inv, equipment);
    for (const flag of FLAG_GROUPS.Hof) st.flags[flag] = true;
  }
  if (id === 'camp' || id === 'strangers') for (const flag of ['streamVisited', 'journeyEastChosen', 'journeyCampReached']) st.flags[flag] = true;
  if (id === 'strangers') for (const flag of FLAG_GROUPS.Reise) st.flags[flag] = flag !== 'criosObserved';
  return { scene: travel ? 'journey' : id.split(':')[0], data: id.startsWith('world:') ? { map: id.split(':')[1] } : {} };
}

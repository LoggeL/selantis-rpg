import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../audio', () => ({ sfx: { select: vi.fn() } }));
import { AftermathScene } from './AftermathScene';
import type { StorySpot } from '../story/types';
import type { WorldState } from '../world/quests';
import { changePartyHealth, partyState } from '../party';

function house(flags: Record<string, boolean> = {}) {
  const s: any = new AftermathScene();
  const images: any[] = [];
  const st: WorldState = { flags: { ...flags }, inv: {}, picked: {} };
  const stored = new Map<string, unknown>([['world', st]]);
  s.registry = { get: (key: string) => stored.get(key), set: (key: string, value: unknown) => stored.set(key, value) };
  s.st = st; s.inside = true;
  s.textures = { exists: () => false };
  s.add = { image: (x: number, y: number, texture: string, frame: number) => {
    const image: any = { x, y, texture, frame, active: true };
    image.setDisplaySize = vi.fn(() => image); image.setDepth = vi.fn(() => image);
    image.destroy = vi.fn(() => { image.active = false; }); images.push(image); return image;
  } };
  s.areaRoot = { add: vi.fn() };
  s.setSpots = vi.fn((spots: StorySpot[]) => { s.spots = spots; });
  s.setObjective = vi.fn(); s.inventory = { refresh: vi.fn() };
  s.say = vi.fn(); s.showDetail = vi.fn(); s.showCloseup = vi.fn(); s.setLiaPose = vi.fn(); s.setLocked = vi.fn();
  s.tweens = { killTweensOf: vi.fn() };
  s.changeArea = vi.fn(() => { images.filter(image => image.active).forEach(image => image.destroy()); });
  s.configure();
  const use = (id: string) => { const spot = (s.spots as StorySpot[]).find(spot => spot.id === id); expect(spot, `${id} is available`).toBeDefined(); spot!.onUse(); };
  return { s, st, images, use };
}

describe('house pickups remain part of exploration', () => {
  it('destroys the picked-up objects and action without a closeup or duplicate inventory', () => {
    const { s, st, use } = house();
    const previous = (s.spots as StorySpot[]).find(spot => spot.id === 'food')!;
    const objects = s.houseItems.get('packedFood');
    expect(objects).toHaveLength(3);
    use('food');
    expect(st.flags.packedFood).toBe(true); expect(st.inv.proviant).toBe(1);
    expect(objects.every((image: any) => !image.active)).toBe(true);
    expect(s.houseItems.has('packedFood')).toBe(false);
    expect(s.spots.some((spot: StorySpot) => spot.id === 'food')).toBe(false);
    expect(s.say).toHaveBeenLastCalledWith('Speck, ein halber Käse, zwei Brote. In den Lederbeutel neben dem Ofen.', 4500);
    previous.onUse();
    expect(st.inv.proviant).toBe(1); expect(objects.every((image: any) => image.destroy.mock.calls.length === 1)).toBe(true);
    expect(s.showDetail).not.toHaveBeenCalled(); expect(s.showCloseup).not.toHaveBeenCalled();
    expect(s.setLocked).not.toHaveBeenCalled(); expect(s.setLiaPose).not.toHaveBeenCalled();
  });
  it('allows taking clothes before medicine and packs medicine without healing Lia', () => {
    const { s, st, use } = house();
    changePartyHealth(s.registry, 'lia', -23);
    expect(partyState(s.registry).members.lia?.hp).toBe(77);
    const clothes = s.houseItems.get('packedClothes');
    use('clothing');
    expect(st.flags.packedClothes).toBe(true); expect(st.inv.reisezeug).toBe(1);
    expect(clothes.every((image: any) => !image.active)).toBe(true);
    expect(st.flags.packedMedicine).toBeUndefined();
    use('medicine');
    expect(partyState(s.registry).members.lia?.hp).toBe(77);
    expect(st.flags.packedMedicine).toBe(true); expect(st.inv.heilzeug).toBe(1);
    expect(s.say).toHaveBeenLastCalledWith('Mutters Tinktur und Leinenstreifen nehme ich für unterwegs mit.', 4500);
  });
  it('leaves every collected place empty when entering the room again', () => {
    const { s, st, images, use } = house();
    for (const id of ['medicine', 'clothing', 'food', 'water', 'cupboard', 'books']) use(id);
    expect(st.inv).toEqual({ heilzeug: 1, reisezeug: 1, proviant: 1, wasserschlauch: 1, kupfer: 22, silber: 7, dolch: 1, 'buch-kraeuter': 1, 'buch-alana': 1 });
    expect(s.houseItems.size).toBe(0); expect(images.every(image => !image.active)).toBe(true);
    expect(s.spots.map((spot: StorySpot) => spot.id)).toEqual(['exit-door']);
    const count = images.length; s.inside = false; s.enterHouse();
    expect(images).toHaveLength(count); expect(s.houseItems.size).toBe(0);
    expect(s.spots.map((spot: StorySpot) => spot.id)).toEqual(['exit-door']);
    expect(st.flags.houseClosed).toBe(false); expect(st.flags.departureReady).toBe(false);
  });
  it('rebuilds only uncollected props after partial progress and omits completed markers', () => {
    const { s, st, images, use } = house({ packedBooks: true });
    expect(s.houseItems.size).toBe(5); expect(s.houseItems.has('packedBooks')).toBe(false);
    expect(s.spots.some((spot: StorySpot) => spot.id === 'books')).toBe(false);
    use('water'); const inventory = { ...st.inv }; const old = [...images];
    s.inside = false; s.enterHouse();
    expect(s.houseItems.size).toBe(4); expect(old.every(image => !image.active)).toBe(true);
    expect(st.inv).toEqual(inventory);
    expect(s.spots.map((spot: StorySpot) => spot.id)).not.toContain('water');
    expect(s.spots.map((spot: StorySpot) => spot.id)).not.toContain('books');
  });
});

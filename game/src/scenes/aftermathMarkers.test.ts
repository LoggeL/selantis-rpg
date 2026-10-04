import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../audio', () => ({ sfx: { select: vi.fn() } }));
import { AftermathScene } from './AftermathScene';

function object() {
  const value: any = { visible: true, active: true };
  for (const method of ['setDepth', 'setStrokeStyle', 'setPosition', 'setDisplaySize', 'clear', 'fillStyle', 'fillRect', 'lineStyle', 'lineBetween']) value[method] = vi.fn(() => value);
  value.setVisible = vi.fn((visible: boolean) => { value.visible = visible; return value; });
  value.destroy = vi.fn(() => { value.active = false; });
  return value;
}

/** Keep the real spot creation, visibility refresh, range check and interaction. */
function farm(flags: Record<string, boolean> = {}, picked: Record<string, boolean> = {}) {
  const s: any = new AftermathScene();
  const st = { flags: { ...flags }, picked: { ...picked }, inv: {} };
  s.st = st; s.registry = { get: () => st };
  s.add = { graphics: vi.fn(object), ellipse: object, rectangle: object, container: object, image: object };
  s.areaRoot = { add: vi.fn(), getWorldTransformMatrix: () => ({ transformPoint: (x: number, y: number) => ({ x, y }) }) };
  s.lia = { x: 253, y: 273 };
  s.prompt = object(); s.hud = { hint: vi.fn() }; s.inventory = { refresh: vi.fn(), isOpen: false };
  s.textures = { exists: (texture: string) => texture === 'cut-family-graves' };
  s.tweens = { killTweensOf: vi.fn() };
  for (const method of ['setObjective', 'say', 'setLiaPose', 'idleLia', 'changeArea', 'setCloseupText', 'setCloseupContinue']) s[method] = vi.fn();
  s.showCloseup = vi.fn(() => { s.closeup = { visible: true, hasCaption: true }; });
  s.hideCloseup = vi.fn(() => { s.closeup.visible = false; s.closeup.hasCaption = false; });
  s.configure();
  const visible = (id: string) => { s.refreshPrompt(); return s.markers.find((marker: any) => marker.spot.id === id)?.object.visible; };
  const use = (id: string) => {
    const spot = s.spots.find((spot: any) => spot.id === id);
    s.lia.x = spot.at[0]; s.lia.y = spot.at[1];
    s.useSpot(s.nearestSpot());
  };
  return { s, st, visible, use };
}

const packed = { packedFood: true, packedWater: true, foundCache: true, packedMedicine: true, packedClothes: true, packedBooks: true };

describe('finished farm actions stop drawing task markers', () => {
  it('hides the released gate immediately while unfinished graves and door remain marked', () => {
    const { s, st, visible, use } = farm();
    expect(s.add.graphics).toHaveBeenCalledTimes(2); // Painted door and gate, no bag/check badges.
    expect(visible('pig-gate')).toBe(true);
    use('pig-gate');
    expect(st.flags.pigsReleased).toBe(true);
    expect(visible('pig-gate')).toBe(false);
    for (const id of ['door', 'grave-mother', 'grave-father', 'east-departure']) expect(visible(id)).toBe(true);
    use('pig-gate');
    expect(s.say).toHaveBeenLastCalledWith('Das Gatter bleibt offen.');
    expect(visible('pig-gate')).toBe(false);
  });

  it('completes each optional farewell only when its detail is closed and preserves the other marker', () => {
    const { s, st, visible, use } = farm();
    use('grave-mother');
    expect(st.picked['farewell-mother']).toBeUndefined();
    expect(visible('grave-mother')).toBe(false); // A closeup hides world markers temporarily.
    s.setCloseupContinue.mock.calls.at(-1)[0]();
    expect(st.picked['farewell-mother']).toBe(true);
    expect(visible('grave-mother')).toBe(false);
    expect(visible('grave-father')).toBe(true);
    use('grave-father');
    expect(st.picked['farewell-father']).toBeUndefined();
    s.setCloseupContinue.mock.calls.at(-1)[0]();
    expect(st.picked['farewell-father']).toBe(true);
    expect(visible('grave-father')).toBe(false);
    expect(visible('door')).toBe(true);
  });

  it('loads completed actions without markers while the closed house remains enterable and empty', () => {
    const { s, st, visible, use } = farm({ ...packed, pigsReleased: true, houseClosed: true }, { 'farewell-mother': true });
    for (const id of ['door', 'pig-gate', 'grave-mother']) expect(visible(id)).toBe(false);
    expect(visible('grave-father')).toBe(true);
    const inventory = { ...st.inv };
    use('door');
    expect(s.inside).toBe(true);
    expect(s.spots.map((spot: any) => spot.id)).toEqual(['exit-door']);
    expect(s.houseItems.size).toBe(0);
    expect(st.inv).toEqual(inventory);
    use('exit-door');
    expect(s.inside).toBe(false);
    expect(st.flags.houseClosed).toBe(true);
    expect(visible('door')).toBe(false);
    expect(st.inv).toEqual(inventory);
  });
});

import type Phaser from 'phaser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const layout = vi.hoisted(() => ({ mobile: false }));
vi.mock('phaser', () => ({ default: { Math: { Clamp: (n: number, min: number, max: number) => Math.max(min, Math.min(max, n)) } } }));
vi.mock('./mobileDialogs', () => ({ usesMobileInterface: () => layout.mobile }));
vi.mock('./settings', () => ({ getSettings: () => ({ reducedMotion: true }), motionDuration: () => 0, subscribeSettings: () => () => {}, toggleSettings: vi.fn() }));
vi.mock('./dialogue', () => ({ Dialogue: class {
  visible = false;
  constructor(_scene: unknown, private readonly options: { onVisibilityChange?: (visible: boolean) => void } = {}) {}
  setText = vi.fn(() => { this.visible = true; this.options.onVisibilityChange?.(true); });
  setContinue = vi.fn();
  hide = vi.fn(() => { this.visible = false; this.options.onVisibilityChange?.(false); });
  destroy = vi.fn();
  advance = vi.fn(() => true);
} }));
import { Hud } from './ui';

function fixture() {
  const objects: any[] = [];
  const add = (...args: any[]) => {
    const o: any = { visible: true, x: args[0], y: args[1], height: 14, text: typeof args[2] === 'string' ? args[2] : '', style: args[3], list: Array.isArray(args[2]) ? args[2] : [] };
    for (const method of ['setOrigin', 'setDepth', 'setScrollFactor', 'setStrokeStyle', 'setAlpha', 'setInteractive', 'setTint', 'setScale', 'setTexture', 'setSize', 'setY', 'lineStyle', 'strokeCircle', 'lineBetween', 'on']) o[method] = vi.fn(() => o);
    o.setText = vi.fn((text: string) => { o.text = text; return o; });
    o.setSize = vi.fn((width: number, height: number) => { o.width = width; o.height = height; return o; });
    o.setDisplaySize = vi.fn(() => o);
    o.setVisible = vi.fn((visible: boolean) => { o.visible = visible; return o; });
    objects.push(o); return o;
  };
  const data = new Map<string, unknown>();
  const scene = {
    add: { rectangle: add, image: add, text: add, container: add, graphics: add, zone: add },
    data: { set: (key: string | Record<string, unknown>, value?: unknown) => typeof key === 'string' ? data.set(key, value) : Object.entries(key).forEach(([k, v]) => data.set(k, v)) },
    tweens: { add: vi.fn(), killTweensOf: vi.fn() }, events: { once: vi.fn() },
    registry: { get: () => () => 0 }, time: { now: 0, delayedCall: vi.fn(() => ({ remove: vi.fn() })) },
  } as unknown as Phaser.Scene;
  const hud = new Hud(scene, 'portrait-lia', 'LIA');
  return { hud, scene, data, objects, root: objects[5], abilities: objects[6], hint: objects[7], thought: objects[8], gear: objects[9], gearZone: objects[10], portrait: objects[1] };
}

beforeEach(() => {
  layout.mobile = false;
  vi.stubGlobal('window', { matchMedia: () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  vi.stubGlobal('document', { documentElement: { dataset: {} } });
});
afterEach(() => vi.unstubAllGlobals());

describe('cinematic HUD suppression', () => {
  it('keeps the objective in a wrapping, opaque pixel panel and grows with measured multiline text', () => {
    const f = fixture();
    f.hud.setObjective('Über die Felder den Hufspuren nach Osten folgen.');
    const [frame, text, panel] = f.objects.slice(-3);
    expect(text.style).toMatchObject({ fontSize: '11px', color: '#fff4d8', wordWrap: { width: 244 }, lineSpacing: 2 });
    expect(frame.setSize).toHaveBeenLastCalledWith(264, 32);
    expect(panel.visible).toBe(true);
    expect(f.hud.objectiveBottom).toBe(40);
    text.height = 54;
    f.hud.setObjective('Reisebücher, Kleidung und Proviant einpacken. Dann über die Felder nach Osten aufbrechen.');
    expect(frame.setSize).toHaveBeenLastCalledWith(264, 70);
    expect(f.thought.setY).toHaveBeenLastCalledWith(90);
    expect(f.hud.objectiveBottom).toBe(78);
    expect(f.objects.slice(-3)).toEqual([frame, text, panel]);
    expect(f.data.get('mobile:objective')).toBe(text.text);
  });

  it('hides both objective text and frame for closeups and speech, and avoids a duplicate canvas quest on phones', () => {
    const f = fixture(); f.hud.setObjective('Nach Osten gehen.');
    const panel = f.objects.at(-1);
    f.hud.setCinematic(true); expect(panel.visible).toBe(false);
    f.hud.setCinematic(false); expect(panel.visible).toBe(true);
    f.hud.thought('Foltan: Wir halten Wache.'); expect(panel.visible).toBe(false);
    f.hud.setThoughtsVisible(false); expect(panel.visible).toBe(true);
    f.hud.setObjectiveVisible(false); expect(panel.visible).toBe(false);
    f.hud.setObjectiveVisible(true); expect(panel.visible).toBe(true);
    layout.mobile = true; f.hud.setCinematic(false); expect(panel.visible).toBe(false);
    expect(f.hud.objectiveBottom).toBe(0);
    expect(f.data.get('mobile:objective')).toBe('Nach Osten gehen.');
    layout.mobile = false; f.hud.setCinematic(false); expect(panel.visible).toBe(true);
    f.hud.setObjective(''); expect(panel.visible).toBe(false);
  });

  it('hides gameplay identity, abilities, hints, protector and settings, then restores them', () => {
    const f = fixture(); f.hud.showProtect('portrait-boy');
    const protector = f.objects.at(-1);
    f.hud.setCinematic(true);
    for (const object of [f.root, f.abilities, f.hint, f.thought, f.gear, f.gearZone, protector]) expect(object.visible).toBe(false);
    expect(f.data.get('mobile:hudVisible')).toBe(false);
    f.hud.setCinematic(false);
    for (const object of [f.root, f.abilities, f.hint, f.thought, f.gear, f.gearZone, protector]) expect(object.visible).toBe(true);
    expect(f.data.get('mobile:name')).toBe('LIA');
  });

  it('restores responsive ability and thought preferences after a cutscene', () => {
    const f = fixture(); f.hud.setThoughtsVisible(false); f.hud.setAbilitiesVisible(false);
    f.hud.setCinematic(true); f.hud.setCinematic(false);
    expect(f.abilities.visible).toBe(false); expect(f.thought.visible).toBe(false);
    layout.mobile = true; f.hud.setAbilitiesVisible(true); f.hud.setThoughtsVisible(true); f.hud.setCinematic(false);
    expect(f.abilities.visible).toBe(false); expect(f.thought.visible).toBe(false); expect(f.hint.visible).toBe(false);
  });

  it('keeps source-detail portraits inside the fixed gameplay frame', () => {
    const f = fixture();
    expect(f.portrait.setDisplaySize).toHaveBeenLastCalledWith(48, 48);
    f.hud.setPortrait('portrait-valentus');
    expect(f.portrait.setTexture).toHaveBeenCalledWith('portrait-valentus');
    expect(f.portrait.setDisplaySize).toHaveBeenLastCalledWith(48, 48);
  });

  it('routes named speech through Dialogue and clears its owner before another caption opens', () => {
    const f = fixture(); f.hud.thought('Foltan: Wir halten Wache.');
    expect(f.hud.dialogueVisible).toBe(true);
    expect(f.root.visible).toBe(false);
    expect(f.data.get('mobile:hudVisible')).toBe(false);
    expect(f.hud.advanceDialogue()).toBe(true);
    f.hud.setThoughtsVisible(false);
    expect(f.hud.dialogueVisible).toBe(false);
    expect(f.root.visible).toBe(true);
    f.hud.thought('Die Glut wärmt.');
    expect(f.hud.dialogueVisible).toBe(false);
    expect(f.data.get('mobile:thought')).toBe('Die Glut wärmt.');
  });
});

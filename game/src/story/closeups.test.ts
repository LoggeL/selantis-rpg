import type Phaser from 'phaser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const layout = vi.hoisted(() => ({ mobile: false }));
vi.mock('../mobileDialogs', () => ({ usesMobileInterface: () => layout.mobile }));
vi.mock('../ui', () => ({ FONT: 'test-font' }));
import { StoryCloseup } from './closeups';

function fixture() {
  const objects: any[] = [];
  const add = () => {
    const object: any = { visible: true, handlers: {} };
    for (const method of ['setOrigin', 'setInteractive', 'setDepth', 'setScrollFactor', 'setStrokeStyle', 'setPosition', 'setScale', 'setSize', 'setAlpha', 'setTexture', 'setText']) {
      object[method] = vi.fn(() => object);
    }
    object.setVisible = vi.fn((visible: boolean) => { object.visible = visible; return object; });
    object.setCrop = vi.fn(() => object);
    object.on = (event: string, callback: () => void) => { object.handlers[event] = callback; return object; };
    object.destroy = vi.fn();
    objects.push(object);
    return object;
  };
  const data = new Map<string, unknown>();
  const scene = {
    add: { rectangle: add, image: add, zone: add, container: add, text: add },
    textures: { exists: () => true, get: () => ({ getSourceImage: () => ({ width: 640, height: 360 }) }) },
    data: {
      get: (key: string) => data.get(key),
      set: (key: string | Record<string, unknown>, value?: unknown) => {
        if (typeof key === 'string') data.set(key, value);
        else Object.entries(key).forEach(([k, v]) => data.set(k, v));
      },
    },
  } as unknown as Phaser.Scene;
  return { shot: new StoryCloseup(scene), data, objects };
}

beforeEach(() => { layout.mobile = false; });

describe('manual story close-ups', () => {
  it('disables repeated advance while a cinematic action is running', () => {
    const { shot } = fixture();
    const callback = vi.fn();
    shot.setContinue(callback);
    shot.advance(); shot.advance();
    expect(callback).toHaveBeenCalledTimes(1);
    shot.setContinue(callback);
    shot.advance();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('restores exploration controls after several dialogue cards and repeated cleanup', () => {
    const { shot, data } = fixture();
    const exploration = { directions: ['W', 'A'], inventory: true };
    data.set('mobile:controls', exploration);
    shot.show('cut'); shot.setText('First card'); shot.setContinue(() => {});
    shot.setText('Second card'); shot.setContinue(null);
    expect(data.get('mobile:controls')).toMatchObject({ directions: [], inventory: false, disabled: true });
    shot.hide(); shot.hide();
    expect(data.get('mobile:controls')).toBe(exploration);
    expect(data.get('mobile:dialogue')).toBe('');
    expect(shot.hasCaption || shot.visible).toBe(false);
  });

  it('reframes an open shot on desktop to phone and back without stretching it', () => {
    const { shot, objects } = fixture();
    const image = objects[1];
    shot.show('cut'); shot.setText('Readable caption');
    expect(image.setCrop).toHaveBeenLastCalledWith(0, 0, 640, 264);
    layout.mobile = true; shot.update();
    expect(image.setCrop).toHaveBeenLastCalledWith(0, 0, 640, 360);
    expect(objects.at(-1).visible).toBe(false);
    layout.mobile = false; shot.update();
    expect(image.setCrop).toHaveBeenLastCalledWith(0, 0, 640, 264);
    expect(objects.at(-1).visible).toBe(true);
    expect(image.setScale).toHaveBeenLastCalledWith(1);
  });

  it('allows the next manual card to install its own action inside the previous callback', () => {
    const { shot } = fixture();
    const second = vi.fn();
    shot.setContinue(() => { shot.setText('Second card'); shot.setContinue(second); });
    shot.advance();
    expect(second).not.toHaveBeenCalled();
    shot.advance();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
const layout = vi.hoisted(() => ({ mobile: false }));
vi.mock('../mobileDialogs', () => ({ usesMobileInterface: () => layout.mobile }));
vi.mock('../audio', () => ({ sfx: { dialogue: vi.fn() } }));
vi.mock('../portraits', () => ({ parseDialogue: (text: string) => ({ text }), resolvePortrait: () => undefined }));
import { StoryCloseup } from './closeups';
import { dialogueSceneFixture } from '../dialogueTestFixture';
import { updateSettings } from '../settings';
function fixture() { const f = dialogueSceneFixture(); return { ...f, shot: new StoryCloseup(f.scene) }; }

beforeEach(() => { layout.mobile = false; updateSettings({ reducedMotion: false }); });
describe('manual story close-ups', () => {
  it('disables repeated advance while a cinematic action is running', () => {
    const { shot } = fixture(); const callback = vi.fn();
    shot.setText('First card'); shot.setContinue(callback);
    shot.advance(); expect(callback).not.toHaveBeenCalled();
    shot.advance(); shot.advance(); expect(callback).toHaveBeenCalledTimes(1);
    shot.setContinue(callback); shot.advance(); expect(callback).toHaveBeenCalledTimes(2); shot.destroy();
  });
  it('restores exploration controls after several dialogue cards and repeated cleanup', () => {
    const { shot, data } = fixture(); const exploration = { directions: ['W', 'A'], inventory: true }; data.set('mobile:controls', exploration);
    shot.show('cut'); shot.setText('First card'); shot.setContinue(() => {});
    shot.setText('Second card'); shot.setContinue(null); shot.advance();
    expect(data.get('mobile:controls')).toMatchObject({ directions: [], inventory: false, disabled: true });
    shot.hide(); shot.hide(); expect(data.get('mobile:controls')).toBe(exploration);
    expect(data.get('mobile:dialogue')).toBe(''); expect(shot.hasCaption || shot.visible).toBe(false); shot.destroy();
  });
  it('reframes an open shot on desktop to phone and back without stretching it', () => {
    const { shot, objects } = fixture(); const image = objects[1];
    shot.show('cut'); shot.setText('Readable caption'); expect(image.setCrop).toHaveBeenLastCalledWith(0, 0, 640, 264);
    layout.mobile = true; shot.update(); expect(image.setCrop).toHaveBeenLastCalledWith(0, 0, 640, 360);
    expect(objects.at(-2).visible).toBe(false);
    layout.mobile = false; shot.update(); expect(image.setCrop).toHaveBeenLastCalledWith(0, 0, 640, 264);
    expect(objects.at(-2).visible).toBe(true); expect(image.setScale).toHaveBeenLastCalledWith(1); shot.destroy();
  });
  it('allows the next card to install its own action while keeping first-press typing semantics', () => {
    const { shot } = fixture(); const second = vi.fn();
    shot.setText('First'); shot.setContinue(() => { shot.setText('Second card'); shot.setContinue(second); });
    shot.advance(); shot.advance(); expect(second).not.toHaveBeenCalled();
    shot.advance(); expect(second).not.toHaveBeenCalled(); shot.advance(); expect(second).toHaveBeenCalledTimes(1); shot.destroy();
  });
  it('contains the entire loss illustration inside its desktop region and clears any previous crop', () => {
    const { shot, objects } = fixture(); const image = objects[1];
    shot.show('cut'); expect(image.setCrop).toHaveBeenLastCalledWith(0, 0, 640, 264);
    shot.show('loss', { fit: 'contain', y: 12, height: 240 });
    const scale = image.setScale.mock.lastCall[0];
    const [x, y] = image.setPosition.mock.lastCall;
    expect(scale).toBeCloseTo(240 / 360);
    expect(x).toBeCloseTo((640 - 640 * scale) / 2);
    expect(y).toBe(12);
    expect(x + 640 * scale).toBeLessThanOrEqual(640);
    expect(y + 360 * scale).toBeCloseTo(252);
    expect(image.setCrop).toHaveBeenLastCalledWith();
    shot.show('cut'); expect(image.setCrop).toHaveBeenLastCalledWith(0, 0, 640, 264);
    shot.destroy();
  });
  it('keeps the whole contained illustration when changing to the mobile viewport', () => {
    const { shot, objects } = fixture(); const image = objects[1];
    shot.show('loss', { fit: 'contain' });
    expect(image.setScale).toHaveBeenLastCalledWith(264 / 360);
    layout.mobile = true; shot.update();
    expect(image.setScale).toHaveBeenLastCalledWith(1);
    expect(image.setPosition).toHaveBeenLastCalledWith(0, 0);
    expect(image.setCrop).toHaveBeenLastCalledWith();
    layout.mobile = false; shot.update();
    expect(image.setScale).toHaveBeenLastCalledWith(264 / 360);
    expect(image.setCrop).toHaveBeenLastCalledWith(); shot.destroy();
  });
});

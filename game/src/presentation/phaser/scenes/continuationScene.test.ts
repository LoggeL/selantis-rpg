import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../../../app/audio', () => ({ setSceneMusic: vi.fn(), sfx: {} }));
import { ContinuationScene } from './ContinuationScene';
import { StoryScene } from '../StoryScene';
import { Dialogue } from '../Dialogue';
import { dialogueSceneFixture } from '../../../tests/dialogueTestFixture';
import { updateSettings } from '../../../app/settings';
import { createCampaignState } from '../../../modules/campaign/state';
import type { ContinuationChapterDefinition } from '../../../modules/continuation/types';

const chapter: ContinuationChapterDefinition = {
  id: 'test', title: 'Test', source: ['test'], actors: [],
  area: { id: 'test', name: 'Test', bg: 'test', start: [10, 10], walk: [], block: [], targets: [] },
  actions: [{ id: 'free', label: 'Befreien', at: [10, 10], radius: 20, completionFlag: 'freed', beats: [
    { id: 'first', line: 'Flick nähert sich.', cue: { type: 'move', actor: 'flick', to: [20, 20] } },
    { id: 'second', line: 'Kyra ist frei.' },
  ] }],
  exit: { label: 'Weiter', at: [30, 10], radius: 20, requires: ['freed'], to: 'next' },
};
function fixture(definition: ContinuationChapterDefinition = chapter) {
  const scene: any = new ContinuationScene(definition);
  const st = createCampaignState(); st.inv.proviant = 2; st.picked.flower = true;
  scene.registry = { get: () => st }; scene.data = { set: vi.fn() };
  scene.textures = { exists: () => true };
  for (const name of ['setLocked', 'setCinematic', 'setCloseupText', 'hideCloseup', 'showCloseup', 'refreshSpots', 'refreshLiaAppearance', 'refreshActors', 'setCloseupContinue']) scene[name] = vi.fn();
  return { scene, st };
}
afterEach(() => vi.restoreAllMocks());

describe('continuation dialogue lifetime', () => {
  it('requires manual continuation and readiness, then claims completion once', () => {
    const { scene, st } = fixture();
    let ready = () => {};
    const cleanup = vi.fn();
    scene.playCue = vi.fn((_cue, done) => { ready = done; return cleanup; });
    scene.useAction(chapter.actions[0]);
    expect(scene.setCloseupContinue).toHaveBeenLastCalledWith(null);
    expect(scene.setCloseupText).toHaveBeenCalledTimes(1);
    expect(st.flags.freed).toBeUndefined();
    ready(); expect(scene.setCloseupText).toHaveBeenCalledTimes(1);
    const first = scene.setCloseupContinue.mock.lastCall[0]; first(); first();
    expect(scene.setCloseupText).toHaveBeenCalledTimes(2); expect(cleanup).toHaveBeenCalledOnce();
    expect(st.flags.freed).toBeUndefined();
    const last = scene.setCloseupContinue.mock.lastCall[0]; last(); last();
    expect(st.flags.freed).toBe(true);
    expect(scene.talking).toBe(false); expect(scene.currentAction).toBeUndefined();
    expect(st.inv.proviant).toBe(2); expect(st.picked.flower).toBe(true);
  });
  it('rearms the actual consumable Dialogue reader after early E during a pending cue', () => {
    updateSettings({ reducedMotion: false });
    const { scene, st } = fixture();
    const view = dialogueSceneFixture();
    const reader = new Dialogue(view.scene);
    scene.setCloseupText = vi.fn((line: string) => reader.setText(line));
    scene.setCloseupContinue = vi.fn((next: (() => void) | null) => reader.setContinue(next));
    scene.hideCloseup = vi.fn(() => reader.hide());
    let cueDone = () => {};
    scene.playCue = vi.fn((_cue, done) => { cueDone = done; return vi.fn(); });
    try {
      scene.useAction(chapter.actions[0]);
      expect(reader.isTyping).toBe(true);
      reader.advance(); // E reveals the line while the movement is unfinished.
      expect(reader.isTyping).toBe(false);
      reader.advance(); reader.advance(); // Repeated early E must leave the beat pending.
      expect(scene.conversation.snapshot).toMatchObject({ index: 0, ready: false });
      expect(view.data.get('mobile:controls')).toMatchObject({ disabled: true });
      expect(st.flags.freed).toBeUndefined();
      cueDone();
      expect(view.data.get('mobile:controls')).toMatchObject({ disabled: false });
      reader.advance();
      expect(scene.conversation.snapshot).toMatchObject({ index: 1, ready: true });
      expect(reader.isTyping).toBe(true);
      reader.advance(); // Reveal the next line.
      reader.advance(); reader.advance(); // Consume the real one-shot callback once.
      expect(st.flags.freed).toBe(true);
      expect(scene.talking).toBe(false);
    } finally { reader.destroy(); }
  });
  it('disposal makes delayed choreography and old buttons inert', () => {
    const { scene, st } = fixture(); let ready = () => {};
    const cleanup = vi.fn(); scene.playCue = vi.fn((_cue, done) => { ready = done; return cleanup; });
    scene.useAction(chapter.actions[0]);
    scene.conversation.dispose(); ++scene.activeLifetime; ready();
    expect(scene.setCloseupContinue).toHaveBeenCalledExactlyOnceWith(null);
    expect(st.flags.freed).toBeUndefined(); expect(cleanup).toHaveBeenCalledOnce();
    expect(scene.conversation.snapshot).toMatchObject({ status: 'disposed', ready: false });
  });
  it('keeps portrait shots in normal dialogue and clears landscape art on the next beat', () => {
    const { scene } = fixture();
    scene.runSequence([{ id: 'portrait', line: 'Azar: Weiter.', shot: 'portrait-dialogue-azar' }, { id: 'cut', line: 'Ein Lager.', shot: 'cinematic-camp' }, { id: 'map', line: 'Wieder im Wald.' }], vi.fn());
    expect(scene.showCloseup).not.toHaveBeenCalled();
    scene.setCloseupContinue.mock.lastCall[0](); expect(scene.showCloseup).toHaveBeenCalledWith('cinematic-camp');
    scene.setCloseupContinue.mock.lastCall[0](); expect(scene.hideCloseup).toHaveBeenCalledTimes(2);
  });
  it('restores freed Kyra, hidden guards and collapsed Lia without granting spell items', () => {
    const { scene, st } = fixture();
    const sprite = (texture: string) => ({ texture: { key: texture }, anims: { stop: vi.fn() }, setFrame: vi.fn().mockReturnThis(), clearTint: vi.fn().mockReturnThis(), setAngle: vi.fn().mockReturnThis(), setAlpha: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis() });
    const kyra = sprite('story-actors'), guard = sprite('warrior'); scene.lia = sprite('lia');
    scene.chapterActors.set('kyra', kyra); scene.chapterActors.set('guard', guard);
    const rope = { destroy: vi.fn() }; scene.boundActors.set('kyra', rope);
    scene.restoreCue({ type: 'unbind', actor: 'kyra' }); expect(kyra.setFrame).toHaveBeenCalledWith(0); expect(rope.destroy).toHaveBeenCalledOnce();
    scene.restoreCue({ type: 'hide', actor: 'guard' }); expect(scene.visibilityCues.get('guard')).toBe(false);
    scene.restoreCue({ type: 'collapse' }); expect(scene.collapsedActors.has('lia')).toBe(true);
    scene.restoreCue({ type: 'recover' }); expect(scene.collapsedActors.has('lia')).toBe(false);
    expect(st.inv).toEqual({ proviant: 2 });
  });
  it('reopens a collapsed checkpoint at its recovery anchor with native sprite dimensions', () => {
    const reentry: ContinuationChapterDefinition = { ...chapter,
      actors: [{ id: 'flick', name: 'Flick', texture: 'flick-walk', at: [40, 20] }],
      actions: [{ ...chapter.actions[0], at: [75, 30], completionFlag: 'collapsed', beats: [{ id: 'fall', line: 'Lia fällt.', cue: { type: 'collapse' } }] }],
    };
    const { scene, st } = fixture(reentry); st.flags.collapsed = true;
    scene.lia = { anims: { stop: vi.fn() }, setPosition: vi.fn().mockReturnThis(), setAngle: vi.fn().mockReturnThis(), setAlpha: vi.fn().mockReturnThis() };
    vi.spyOn(StoryScene.prototype as any, 'begin').mockImplementation(() => {});
    const flick = { setDisplaySize: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis() };
    scene.add = { sprite: vi.fn(() => flick) }; scene.areaRoot = { add: vi.fn() }; scene.events = { once: vi.fn() };
    scene.cache = { json: { get: () => ({ assets: [{ id: 'flick-walk', frameW: 256, frameH: 256, foot: [128, 240] }] }) } };
    scene.create();
    expect(flick.setDisplaySize).toHaveBeenCalledWith(64, 64);
    expect(flick.setOrigin).toHaveBeenCalledWith(0.5, 240 / 256);
    expect(scene.lia.setPosition).toHaveBeenCalledWith(75, 30);
    expect(scene.collapsedActors.has('lia')).toBe(true);
  });
  it('freezes collapsed movement while still running interaction updates', () => {
    const { scene } = fixture(); scene.lia = { active: false }; scene.collapsedActors.add('lia');
    const update = vi.spyOn(StoryScene.prototype, 'update').mockImplementation(() => {});
    scene.update(100, 50); expect(update).toHaveBeenCalledWith(100, 0);
  });
});

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
  for (const name of ['setLocked', 'setCinematic', 'setCloseupText', 'hideCloseup', 'showCloseup', 'refreshSpots', 'refreshLiaAppearance', 'refreshActors', 'setCloseupContinue', 'say']) scene[name] = vi.fn();
  scene.inventory = { close: vi.fn() };
  scene.scene = { sleep: vi.fn(), launch: vi.fn(), wake: vi.fn(), stop: vi.fn() };
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
    const flick = { texture: { key: 'flick-walk' }, frame: { name: 0 }, setDisplaySize: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis() };
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
  it('keeps rescue completion locked on cancellation and accepts a fresh win only once', () => {
    const action = { ...chapter.actions[0], challenge: { kind: 'rescue' as const, successPosition: [75, 30] as [number, number] } };
    const { scene, st } = fixture({ ...chapter, actors: [], actions: [action] });
    scene.lia = { setPosition: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis() };
    scene.restoreCue = vi.fn();
    scene.useAction(action);
    expect(scene.scene.sleep).toHaveBeenCalledOnce();
    expect(scene.scene.launch).toHaveBeenCalledWith('rescue-battle', expect.objectContaining({ onComplete: expect.any(Function) }));
    const cancelled = scene.scene.launch.mock.lastCall[1].onComplete;
    cancelled(false); cancelled(true);
    expect(st.flags.freed).toBeUndefined(); expect(scene.talking).toBe(false);
    scene.useAction(action);
    const won = scene.scene.launch.mock.lastCall[1].onComplete;
    won(true); won(true);
    expect(st.flags.freed).toBe(true); expect(scene.restoreCue).toHaveBeenCalledOnce();
    expect(scene.lia.setPosition).toHaveBeenCalledExactlyOnceWith(75, 30);
    expect(scene.scene.wake).toHaveBeenCalledTimes(2);
    expect(scene.setCloseupText).not.toHaveBeenCalled();
    expect(st.inv).toEqual({ proviant: 2 }); expect(st.picked.flower).toBe(true);
  });
  it('ignores an encounter callback after the parent chapter has been replaced', () => {
    const action = { ...chapter.actions[0], challenge: { kind: 'rescue' as const } };
    const { scene, st } = fixture({ ...chapter, actions: [action] });
    scene.useAction(action);
    const returned = scene.scene.launch.mock.lastCall[1].onComplete;
    ++scene.activeLifetime; returned(true);
    expect(st.flags.freed).toBeUndefined(); expect(scene.scene.wake).not.toHaveBeenCalled();
  });
  it('publishes the returned chapter state before waking its controls', () => {
    const action = { ...chapter.actions[0], challenge: { kind: 'rescue' as const } };
    const { scene, st } = fixture({ ...chapter, actions: [action] });
    scene.restoreCue = vi.fn();
    scene.scene.wake.mockImplementation(() => {
      const snapshot = scene.data.set.mock.calls.filter(([key]: [string]) => key === 'story:continuation').at(-1)[1];
      expect(snapshot).toMatchObject({ talking: false, currentAction: null, challenge: null });
      expect(st.flags.freed).toBe(true);
      expect(scene.setLocked).toHaveBeenLastCalledWith(false);
    });
    scene.useAction(action); scene.scene.launch.mock.lastCall[1].onComplete(true);
    expect(scene.scene.wake).toHaveBeenCalledOnce();
  });
  it('requires the tracking win and its manual dialogue before granting progress', () => {
    const action = { ...chapter.actions[0], challenge: { kind: 'tracking' as const }, beats: [{ id: 'answer', line: 'Die Spur führt weiter.' }] };
    const { scene, st } = fixture({ ...chapter, actions: [action] });
    scene.useAction(action);
    const returned = scene.scene.launch.mock.lastCall[1].onComplete;
    returned(true);
    expect(st.flags.freed).toBeUndefined(); expect(scene.setCloseupText).toHaveBeenCalledWith('Die Spur führt weiter.');
    scene.setCloseupContinue.mock.lastCall[0]();
    expect(st.flags.freed).toBe(true);
  });
  it('retains the last actor facing after a walking cue stops', () => {
    const actorDefinition = { id: 'flick', name: 'Flick', texture: 'flick-walk', at: [10, 10] as [number, number] };
    const { scene } = fixture({ ...chapter, actors: [actorDefinition] });
    scene.anims = { exists: () => true };
    const actor = { x: 10, y: 10, play: vi.fn() };
    scene.animateCueActor('flick', actor, [20, 10], true);
    actor.x = 20; scene.animateCueActor('flick', actor, [20, 10], false);
    expect(actor.play).toHaveBeenLastCalledWith('flick-idle-e', true);
  });
  it('shows restraints in an observation-only chapter and removes them on a freed checkpoint', () => {
    const definition = { ...chapter, actors: [{ id: 'kyra', name: 'Kyra', texture: 'story-actors', bound: true, at: [40, 20] as [number, number] }], actions: [] };
    const { scene } = fixture(definition);
    vi.spyOn(StoryScene.prototype as any, 'begin').mockImplementation(() => {});
    const sprite = { texture: { key: 'story-actors' }, frame: { name: 1 }, setDisplaySize: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setFrame: vi.fn().mockReturnThis(), clearTint: vi.fn().mockReturnThis(), setAngle: vi.fn().mockReturnThis() };
    const rope = { destroy: vi.fn() };
    scene.add = { sprite: () => sprite, graphics: () => rope }; scene.areaRoot = { add: vi.fn() }; scene.events = { once: vi.fn() };
    scene.cache = { json: { get: () => undefined } };
    scene.create();
    expect(scene.boundActors.has('kyra')).toBe(true); expect(scene.areaRoot.add).toHaveBeenCalledWith(rope);
    scene.restoreCue({ type: 'unbind', actor: 'kyra' });
    expect(scene.boundActors.has('kyra')).toBe(false); expect(rope.destroy).toHaveBeenCalledOnce();
  });
});

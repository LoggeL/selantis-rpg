import { afterEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { GameInputRouter, SceneInputScope, installGameInput, sceneInput } from "./router";
import type { InputIntent } from "./types";
import { dialogueSceneFixture } from "../../tests/dialogueTestFixture";

afterEach(() => vi.unstubAllGlobals());

const press = (action: InputIntent['action'], owner = 'finger:1', source: InputIntent['source'] = 'touch'): InputIntent => ({ action, owner, source, phase: 'begin' });
describe('semantic input ownership', () => {
  it('keeps one action held by two fingers and hardware until the last owner ends', () => {
    const scope = new SceneInputScope(), events: string[] = [];
    scope.on('interact', intent => { events.push(intent.phase); });
    scope.dispatch(press('interact')); scope.dispatch(press('interact', 'finger:2')); scope.dispatch(press('interact', 'keyboard:KeyE', 'keyboard'));
    scope.dispatch({ ...press('interact'), phase: 'end' });
    scope.dispatch({ ...press('interact', 'finger:2'), phase: 'end' });
    expect(scope.isHeld('interact')).toBe(true); expect(events).toEqual(['begin']);
    scope.dispatch({ ...press('interact', 'keyboard:KeyE', 'keyboard'), phase: 'end' });
    expect(scope.isHeld('interact')).toBe(false); expect(events).toEqual(['begin', 'end']);
  });
  it('routes desktop and touch to the same command and ignores repeated owners', () => {
    const scope = new SceneInputScope(), callback = vi.fn(); scope.on('beam', callback);
    const router = new GameInputRouter(); router.activate(scope);
    router.keyboard('KeyQ', 'begin'); router.keyboard('KeyQ', 'begin'); router.keyboard('KeyQ', 'end');
    router.dispatch(press('beam')); router.dispatch({ ...press('beam'), phase: 'end' });
    expect(callback.mock.calls.map(([intent]) => [intent.action, intent.phase])).toEqual([
      ['beam', 'begin'], ['beam', 'end'], ['beam', 'begin'], ['beam', 'end'],
    ]);
  });
  it('cancels simultaneous holds on modal entry, scene transition and dispose', () => {
    const scope = new SceneInputScope(), callback = vi.fn(); scope.on('move-left', callback);
    const router = new GameInputRouter(); router.activate(scope); router.keyboard('ArrowLeft', 'begin'); scope.dispatch(press('interact'));
    const release = scope.lock({ priority: 100 });
    expect(scope.isHeld('move-left') || scope.isHeld('interact')).toBe(false);
    expect(scope.dispatch(press('interact'))).toBe(false); release();
    router.keyboard('ArrowLeft', 'begin'); router.activate(new SceneInputScope()); expect(scope.isHeld('move-left')).toBe(false);
    scope.dispatch(press('move-left')); scope.dispose(); scope.dispose();
    expect(scope.dispatch(press('move-left'))).toBe(false); expect(callback.mock.calls.map(([intent]) => intent.phase)).toEqual(['begin', 'end', 'begin', 'end', 'begin', 'end']);
  });
  it('applies only the highest modal priority and restores lower owners without stale state', () => {
    const scope = new SceneInputScope(), callback = vi.fn(); scope.on('continue', callback);
    const gameplay = scope.lock({ priority: 10 });
    const reader = scope.lock({ priority: 100, allow: ['continue'] });
    expect(scope.dispatch({ action: 'continue', phase: 'activate', source: 'touch' })).toBe(true);
    const modal = scope.lock({ priority: 1000 });
    expect(scope.dispatch({ action: 'continue', phase: 'activate', source: 'touch' })).toBe(false);
    reader(); modal(); expect(scope.dispatch(press('continue'))).toBe(false);
    gameplay(); expect(scope.dispatch(press('continue'))).toBe(true);
  });
  it('releases a held remapped key by its original owner after profile replacement', () => {
    const scope = new SceneInputScope(), router = new GameInputRouter(); router.activate(scope);
    router.keyboard('KeyE', 'begin'); expect(scope.isHeld('interact')).toBe(true);
    const reader = scope.setControls({ directions: [], actions: { E: 'Weiter' }, bindings: { E: 'continue' } }, { priority: 100 });
    expect(scope.isHeld('interact')).toBe(false);
    router.keyboard('KeyE', 'begin'); expect(scope.isHeld('continue')).toBe(true);
    reader(); router.keyboard('KeyE', 'end'); expect(scope.isHeld('continue')).toBe(false);
  });
  it('removes only a profile token owner and keeps the active higher priority profile', () => {
    const scope = new SceneInputScope();
    const base = scope.setControls({ directions: ['up'], actions: { E: 'Gehen' } });
    const menu = scope.setControls({ directions: [], actions: { E: 'Auswählen' } }, { priority: 120 });
    const reader = scope.setControls({ directions: [], actions: { E: 'Weiter' } }, { priority: 100 });
    expect(scope.controls?.actions.E).toBe('Auswählen'); reader(); expect(scope.controls?.actions.E).toBe('Auswählen');
    menu(); expect(scope.controls?.actions.E).toBe('Gehen'); base(); expect(scope.controls).toBeUndefined();
  });
  it('allows a priority handler to consume or explicitly pass a command', () => {
    const scope = new SceneInputScope(), lower = vi.fn(), higher = vi.fn(() => false);
    scope.on('continue', lower); const unsubscribe = scope.on('continue', higher, { priority: 100 });
    scope.dispatch({ action: 'continue', phase: 'activate', source: 'pointer' }); expect(higher).toHaveBeenCalledOnce(); expect(lower).toHaveBeenCalledOnce();
    unsubscribe(); scope.dispatch({ action: 'continue', phase: 'activate', source: 'touch' }); expect(higher).toHaveBeenCalledOnce(); expect(lower).toHaveBeenCalledTimes(2);
  });
  it('cancels on scene pause and sleep, then tears subscriptions down on shutdown', () => {
    const fixture = dialogueSceneFixture(), scope = sceneInput(fixture.scene);
    scope.dispatch(press('move-left')); fixture.emit('pause'); expect(scope.isHeld('move-left')).toBe(false);
    scope.dispatch(press('interact')); fixture.emit('sleep'); expect(scope.isHeld('interact')).toBe(false);
    fixture.emit('shutdown'); expect(scope.dispatch(press('interact'))).toBe(false);
    expect(fixture.listeners.get('pause')?.size).toBe(0); expect(fixture.listeners.get('sleep')?.size).toBe(0);
  });
  it('routes physical letters despite stale button focus, releases in modals and disposes desktop listeners', () => {
    const listeners = new Map<string, Set<(event: any) => void>>();
    const target = {
      addEventListener(type: string, callback: (event: any) => void) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(callback); },
      removeEventListener(type: string, callback: (event: any) => void) { listeners.get(type)?.delete(callback); },
    };
    let dialogOpen = false;
    vi.stubGlobal('window', target); vi.stubGlobal('document', { ...target, hidden: false, querySelector: () => dialogOpen ? {} : null });
    class Element {
      constructor(private readonly modal = false) {}
      closest(selector: string) { return this.modal && selector.includes('dialog') ? this : selector === 'button' ? this : null; }
      getClientRects() { return []; }
    }
    vi.stubGlobal('HTMLElement', Element);
    const fixture = dialogueSceneFixture();
    const game = { events: { once: vi.fn(), off: vi.fn() }, scene: { getScenes: () => [fixture.scene] } } as unknown as Phaser.Game;
    Object.assign(fixture.scene, { game, input: { enabled: true, keyboard: { enabled: true } }, sys: { settings: { key: 'journey' }, isActive: () => true } });
    const scope = sceneInput(fixture.scene), callback = vi.fn(); scope.on('interact', callback);
    const dispose = installGameInput(game);
    const event = (element: Element) => ({ code: 'KeyE', target: element, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() });
    for (const listener of listeners.get('keydown') ?? []) listener(event(new Element()));
    expect(scope.isHeld('interact')).toBe(true); expect(callback.mock.calls[0][0].phase).toBe('begin');
    dialogOpen = true;
    for (const listener of listeners.get('keyup') ?? []) listener(event(new Element(true)));
    expect(scope.isHeld('interact')).toBe(false); expect(callback.mock.calls[1][0].phase).toBe('end');
    dispose(); dispose(); expect(listeners.get('keydown')?.size).toBe(0); expect(listeners.get('keyup')?.size).toBe(0);
    expect(listeners.get('blur')?.size).toBe(0); expect(listeners.get('visibilitychange')?.size).toBe(0);
  });
});

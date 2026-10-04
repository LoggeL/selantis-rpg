import type Phaser from 'phaser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sceneInput } from '../../platform/input/router';
import { scenePresentation } from '../../presentation/model';

const services = vi.hoisted(() => ({ openBag: vi.fn(() => true), openParty: vi.fn(), toggleSettings: vi.fn() }));
vi.mock('../../app/audio', () => ({ unlockAudio: vi.fn() }));
vi.mock('../../app/settings', () => ({ settingsAreOpen: () => false, toggleSettings: services.toggleSettings }));
vi.mock('../../presentation/dom/characterSheetControls', () => ({ openBag: services.openBag, openCharacterStats: services.openParty }));
import { installMobileControls } from '../../presentation/dom/mobileControls';

class Events {
  readonly handlers = new Map<string, Set<(...args: any[]) => void>>();
  on(type: string, callback: (...args: any[]) => void) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type)!.add(callback); }
  off(type: string, callback: (...args: any[]) => void) { this.handlers.get(type)?.delete(callback); }
  once(type: string, callback: (...args: any[]) => void) { const one = (...args: any[]) => { this.off(type, one); callback(...args); }; this.on(type, one); }
  emit(type: string, ...args: any[]) { for (const callback of [...(this.handlers.get(type) ?? [])]) callback(...args); }
  addEventListener = this.on;
  removeEventListener = this.off;
}

/** Renderer boundaries only: scopes, snapshots and scene events are real. */
class Element extends Events {
  dataset: Record<string, string> = {};
  style = { touchAction: '', setProperty: vi.fn() };
  classList = { add: vi.fn(), remove: vi.fn() };
  className = ''; id = ''; type = ''; textContent = ''; innerHTML = ''; hidden = false; disabled = false; isConnected = true;
  parentElement?: Element;
  children: Element[] = [];
  private selectors = new Map<string, Element>();
  private attributes = new Map<string, string>();
  private captures = new Set<number>();
  constructor(readonly tag = 'div') { super(); }
  querySelector(selector: string): Element { if (!this.selectors.has(selector)) this.selectors.set(selector, new Element()); return this.selectors.get(selector)!; }
  append(...children: Element[]) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  prepend(...children: Element[]) { this.append(...children); }
  replaceChildren(...children: Element[]) { this.children = []; this.append(...children); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  hasPointerCapture(id: number) { return this.captures.has(id); }
  setPointerCapture(id: number) { this.captures.add(id); }
  releasePointerCapture(id: number) { this.captures.delete(id); }
  remove() { this.isConnected = false; }
  focus() {}
  click() { this.emit('click', { detail: 0, preventDefault() {}, stopPropagation() {} }); }
}

function fixture() {
  const elements: Element[] = [], body = new Element('body'), html = new Element('html'); html.dataset.touchEnabled = 'true';
  let modal = false, active = true, paused = false;
  const documentEvents = new Events();
  vi.stubGlobal('document', Object.assign(documentEvents, {
    body, documentElement: html, hidden: false,
    createElement: (tag: string) => { const element = new Element(tag); elements.push(element); return element; },
    getElementById: () => undefined, querySelector: (selector: string) => selector === 'dialog[open]' && modal ? {} : null,
  }));
  const windowEvents = new Events(); vi.stubGlobal('window', windowEvents);
  vi.stubGlobal('matchMedia', () => Object.assign(new Events(), { matches: true }));
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('HTMLElement', Element); vi.stubGlobal('HTMLButtonElement', Element);
  const data = new Map<string, unknown>(), sceneEvents = new Events(), dataEvents = new Events(), gameEvents = new Events();
  const game = { events: gameEvents, registry: { get: () => undefined }, scene: { getScenes: () => active || paused ? [scene] : [] } } as unknown as Phaser.Game;
  const scene = {
    game, events: sceneEvents, sys: { settings: { key: 'world' }, isActive: () => active, isPaused: () => paused }, input: { enabled: true, keyboard: { enabled: true } },
    data: { events: dataEvents, get: (key: string) => data.get(key), set: (key: string | Record<string, unknown>, value?: unknown) => {
      for (const [name, next] of typeof key === 'string' ? [[key, value]] : Object.entries(key)) {
        const event = data.has(name as string) ? 'changedata' : 'setdata'; data.set(name as string, next); dataEvents.emit(event, scene.data, name, next);
      }
    } },
  } as unknown as Phaser.Scene;
  const start = () => { active = true; paused = false; scenePresentation(scene).publish({ name: 'Lia', inventory: { open: false, items: [] }, hudVisible: true }); };
  start(); const dispose = installMobileControls(game);
  return { game, scene, elements, data, sceneEvents, gameEvents,
    frame: () => gameEvents.emit('prestep'),
    restart: () => { active = false; sceneEvents.emit('shutdown'); data.clear(); start(); gameEvents.emit('prestep'); },
    pause: () => { active = false; paused = true; modal = true; sceneEvents.emit('pause'); gameEvents.emit('prestep'); },
    resume: (renderFrame = true) => { active = true; paused = false; modal = false; sceneEvents.emit('resume'); if (renderFrame) gameEvents.emit('prestep'); },
    key: (code: string, phase: 'down' | 'up' = 'down') => windowEvents.emit(`key${phase}`, { code, target: null, repeat: false, preventDefault() {}, stopImmediatePropagation() {} }),
    cleanup: () => { dispose(); active = false; sceneEvents.emit('shutdown'); gameEvents.emit('destroy'); },
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('DOM scene lifecycle', () => {
  it('rebinds inventory commands after repeated restarts of the same Phaser scene object', () => {
    const f = fixture(), bag = f.elements.find(element => element.className.includes('mobile-bag'))!;
    for (let entry = 0; entry < 4; entry++) {
      if (entry) f.restart(); bag.click(); expect(services.openBag).toHaveBeenCalledTimes(entry + 1);
    }
    expect(f.sceneEvents.handlers.get('pause')?.size).toBe(2);
    expect(f.sceneEvents.handlers.get('sleep')?.size).toBe(2);
    f.cleanup(); expect(f.gameEvents.handlers.get('prestep')?.size).toBe(0);
  });
  it('subscribes to the new dialogue snapshot and continue handler after same-object restart', () => {
    const f = fixture(), oldScope = sceneInput(f.scene), oldModel = scenePresentation(f.scene);
    f.restart(); const scope = sceneInput(f.scene), model = scenePresentation(f.scene), advance = vi.fn();
    expect(scope).not.toBe(oldScope); expect(model).not.toBe(oldModel);
    scope.on('continue', intent => { if (intent.phase !== 'end') advance(); });
    scope.setControls({ directions: [], actions: { E: 'Weiter' }, bindings: { E: 'continue' }, inventory: false });
    model.publish({ dialogueActive: true, dialogueText: 'Hallo.', dialogueFullText: 'Hallo.', hudVisible: false }); f.frame();
    const root = f.elements.find(element => element.id === 'mobile-controls')!, next = f.elements.find(element => element.dataset.key === 'E')!;
    expect(root.dataset.dialogue).toBe('true'); expect(next.hidden).toBe(false); expect(next.disabled).toBe(false);
    expect(next.dataset.intent).toBe('continue'); next.click(); expect(advance).toHaveBeenCalledOnce();
    expect(root.querySelector('[data-mobile-thought]').textContent).toBe('Hallo.'); f.cleanup();
  });
  it('retains paused scene subscriptions, releases modal locks and cancels touch holds on pause', () => {
    const f = fixture(), scope = sceneInput(f.scene), model = scenePresentation(f.scene), bag = f.elements.find(element => element.className.includes('mobile-bag'))!;
    scope.dispatch({ action: 'move-left', phase: 'begin', source: 'touch', owner: 'touch:1' }); f.pause();
    expect(scope.isHeld('move-left')).toBe(false); expect(bag.disabled).toBe(true);
    model.publish({ objective: 'Nach der Pause weitergehen.' }); f.resume();
    expect(sceneInput(f.scene)).toBe(scope); expect(scenePresentation(f.scene)).toBe(model);
    expect(bag.disabled).toBe(false); bag.click(); expect(services.openBag).toHaveBeenCalledOnce();
    f.pause(); f.restart(); f.resume(); bag.click(); expect(services.openBag).toHaveBeenCalledTimes(2); f.cleanup();
  });
  it('accepts the first physical movement and party key immediately after modal resume before another frame', () => {
    const f = fixture(), scope = sceneInput(f.scene);
    f.pause(); f.key('ArrowRight'); expect(scope.isHeld('move-right')).toBe(false);
    f.resume(false); f.key('ArrowRight'); expect(scope.isHeld('move-right')).toBe(true);
    f.key('ArrowRight', 'up'); expect(scope.isHeld('move-right')).toBe(false);
    f.pause(); f.resume(false); f.key('KeyC'); expect(services.openParty).toHaveBeenCalledOnce();
    f.key('KeyC', 'up'); f.cleanup();
    expect(f.sceneEvents.handlers.get('resume')?.size).toBe(0); expect(f.sceneEvents.handlers.get('wake')?.size).toBe(0);
  });
});

import type Phaser from 'phaser';
import { CODE_ACTIONS, CODE_KEYS, KEY_ACTIONS, type ActionKey, type ControlProfile, type InputAction, type InputIntent, type IntentHandler, type IntentHandlers } from "./types";
export type { ControlProfile, InputAction, InputIntent, IntentHandler, IntentHandlers } from './types';

/** One authority for held ownership, modal priority and scene actions. */
export class SceneInputScope {
  private handlers = new Map<InputAction, { callback: IntentHandler; priority: number; order: number }[]>();
  private owners = new Map<string, InputIntent>();
  private locks = new Set<{ priority: number; allow: readonly InputAction[] }>();
  private profiles = new Set<{ profile: ControlProfile; priority: number; order: number }>();
  private sequence = 0;
  private disposed = false;
  private profileListeners = new Set<() => void>();

  on(action: InputAction, callback: IntentHandler, options: { priority?: number } = {}) {
    const entry = { callback, priority: options.priority ?? 0, order: ++this.sequence };
    const list = this.handlers.get(action) ?? []; list.push(entry); this.handlers.set(action, list);
    return () => { const index = list.indexOf(entry); if (index >= 0) list.splice(index, 1); };
  }
  bind(handlers: IntentHandlers, priority = 0) {
    const remove = Object.entries(handlers).map(([action, callback]) => this.on(action as InputAction, callback!, { priority }));
    return () => remove.forEach(unsubscribe => unsubscribe());
  }
  lock(options: { priority?: number; allow?: readonly InputAction[] } = {}) {
    const entry = { priority: options.priority ?? 0, allow: options.allow ?? [] };
    this.cancel(); this.locks.add(entry);
    return () => this.locks.delete(entry);
  }
  setControls(profile: ControlProfile, options: { priority?: number } = {}) {
    const entry = { profile, priority: options.priority ?? 0, order: ++this.sequence };
    this.profiles.add(entry); this.controlsChanged();
    const release = () => { if (this.profiles.delete(entry)) this.controlsChanged(); };
    return Object.assign(release, { update: (next: ControlProfile) => { entry.profile = next; this.controlsChanged(); } });
  }
  get controls(): ControlProfile | undefined {
    return [...this.profiles].sort((a, b) => b.priority - a.priority || b.order - a.order)[0]?.profile;
  }
  subscribeControls(callback: () => void) { this.profileListeners.add(callback); return () => this.profileListeners.delete(callback); }
  actionForKey(key: ActionKey) { return this.controls?.bindings?.[key] ?? KEY_ACTIONS[key]; }
  isHeld(action: InputAction) { return [...this.owners.values()].some(intent => intent.action === action); }
  hasHandlers(action: InputAction) { return !!this.handlers.get(action)?.length; }
  dispatch(intent: InputIntent): boolean {
    if (this.disposed) return false;
    const owner = intent.owner ?? `${intent.source}:${intent.action}`;
    if (intent.phase === 'end') {
      const held = this.owners.get(owner); if (!held) return false;
      this.owners.delete(owner);
      return this.isHeld(held.action) ? true : this.deliver({ ...held, phase: 'end' }, true);
    }
    if (!this.allowed(intent.action)) return false;
    if (intent.phase === 'begin') {
      if (this.owners.has(owner)) return true;
      const alreadyHeld = this.isHeld(intent.action);
      this.owners.set(owner, intent);
      if (alreadyHeld) return true;
    }
    return this.deliver(intent);
  }
  cancel(source?: InputIntent['source']) {
    const held = [...this.owners.entries()].filter(([, intent]) => !source || intent.source === source);
    for (const [owner, intent] of held) this.dispatch({ ...intent, owner, phase: 'end' });
  }
  dispose() { if (this.disposed) return; this.cancel(); this.disposed = true; this.handlers.clear(); this.locks.clear(); this.profiles.clear(); this.controlsChanged(); this.profileListeners.clear(); }
  private allowed(action: InputAction) {
    if (action === 'inventory' && this.controls?.inventory === false) return false;
    if (this.controls?.disabled && !['settings', 'party', 'inventory'].includes(action)) return false;
    if (action.startsWith('move-') && this.controls && !this.controls.directions.includes(action.slice(5) as ControlProfile['directions'][number])) return false;
    const locks = [...this.locks]; if (!locks.length) return true;
    const priority = Math.max(...locks.map(lock => lock.priority));
    return locks.filter(lock => lock.priority === priority).every(lock => lock.allow.includes(action));
  }
  private deliver(intent: InputIntent, releasing = false) {
    if (!releasing && !this.allowed(intent.action)) return false;
    for (const handler of [...(this.handlers.get(intent.action) ?? [])].sort((a, b) => b.priority - a.priority || b.order - a.order)) {
      if (handler.callback(intent) !== false) return true;
    }
    return false;
  }
  private controlsChanged() { this.cancel(); for (const callback of this.profileListeners) callback(); }
}

const scenes = new WeakMap<object, SceneInputScope>();
const gameRouters = new WeakMap<object, GameInputRouter>();

/** Desktop and touch both address the active game scope; no Key events are fabricated. */
export class GameInputRouter {
  private current?: SceneInputScope;
  activate(scope?: SceneInputScope) { if (this.current === scope) return; this.current?.cancel(); this.current = scope; }
  dispatch(intent: InputIntent) { return this.current?.dispatch(intent) ?? false; }
  keyboard(code: string, phase: 'begin' | 'end') {
    const action = CODE_KEYS[code] ? this.current?.actionForKey(CODE_KEYS[code]!) : CODE_ACTIONS[code];
    return action ? this.dispatch({ action, phase, source: 'keyboard', owner: `keyboard:${code}` }) : false;
  }
  accepts(code: string) { const action = CODE_KEYS[code] ? this.current?.actionForKey(CODE_KEYS[code]!) : CODE_ACTIONS[code]; return !!action && (!!this.current?.hasHandlers(action) || action.startsWith('move-')); }
  cancel() { this.current?.cancel(); }
  dispose() { this.cancel(); this.current = undefined; }
}

export function gameInput(game: Phaser.Game): GameInputRouter {
  let router = gameRouters.get(game); if (router) return router;
  router = new GameInputRouter(); gameRouters.set(game, router);
  const keyboard = (event: KeyboardEvent, phase: 'begin' | 'end') => {
    // Always release the original owner, even when focus moved into a modal.
    if (phase === 'end') router!.keyboard(event.code, phase);
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (typeof HTMLElement !== 'undefined' && event.target instanceof HTMLElement) {
      if (event.target.closest('input, textarea, select, [contenteditable="true"], dialog[open]')) return;
      // Enter and Space retain native button activation; gameplay letters still
      // work after a debug/menu button kept focus when its dialog closed.
      if ((event.code === 'Enter' || event.code === 'Space') && event.target.closest('button') && event.target.getClientRects().length) return;
    }
    if (document.querySelector('dialog[open]')) { router!.cancel(); return; }
    const scene = game.scene.getScenes(false).find(candidate => candidate.sys.settings.key !== 'Settings' && candidate.sys.isActive());
    const scope = scene?.input.enabled !== false && scene?.input.keyboard?.enabled !== false ? scene && scenes.get(scene) : undefined; router!.activate(scope);
    if (!scope || !CODE_ACTIONS[event.code] || !router!.accepts(event.code)) return;
    if (phase === 'begin' && event.repeat) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    router!.keyboard(event.code, phase); event.preventDefault(); event.stopImmediatePropagation();
  };
  const down = (event: KeyboardEvent) => keyboard(event, 'begin');
  const up = (event: KeyboardEvent) => keyboard(event, 'end');
  const cancel = () => router!.cancel();
  const visibility = () => { if (document.hidden) cancel(); };
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true);
    window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', visibility);
  }
  let disposed = false;
  const dispose = () => {
    if (disposed) return; disposed = true;
    router!.dispose(); gameRouters.delete(game);
    gameDisposers.delete(game); game.events.off('destroy', dispose);
    if (typeof window !== 'undefined') { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', visibility); }
  };
  gameDisposers.set(game, dispose); game.events.once('destroy', dispose);
  return router;
}
const gameDisposers = new WeakMap<object, () => void>();
export function installGameInput(game: Phaser.Game): () => void { gameInput(game); return () => { gameDisposers.get(game)?.(); gameDisposers.delete(game); }; }

export function sceneInput(scene: Phaser.Scene): SceneInputScope {
  let scope = scenes.get(scene); if (scope) return scope;
  scope = new SceneInputScope(); scenes.set(scene, scope);
  let baseline = scene.data.get?.('mobile:controls'); let writing = false;
  const mirror = () => { writing = true; scene.data.set('mobile:controls', scope!.controls ?? baseline ?? null); writing = false; };
  const changed = (_data: unknown, key: string) => {
    if (key !== 'mobile:controls' || writing) return;
    baseline = scene.data.get('mobile:controls'); if (scope!.controls) mirror();
  };
  const removeMirror = scope.subscribeControls(mirror);
  scene.data.events?.on('changedata', changed); scene.data.events?.on('setdata', changed);
  const cancel = () => scope!.cancel();
  scene.events.on?.('pause', cancel); scene.events.on?.('sleep', cancel);
  const dispose = () => {
    scope!.dispose(); removeMirror(); scenes.delete(scene);
    scene.data.events?.off('changedata', changed); scene.data.events?.off('setdata', changed);
    scene.events.off?.('pause', cancel); scene.events.off?.('sleep', cancel);
  };
  scene.events.once('shutdown', dispose);
  if (scene.game?.events && scene.game?.scene) gameInput(scene.game);
  return scope;
}

export function bindSceneInput(scene: Phaser.Scene, handlers: IntentHandlers): SceneInputScope {
  const scope = sceneInput(scene); scope.bind(handlers); return scope;
}

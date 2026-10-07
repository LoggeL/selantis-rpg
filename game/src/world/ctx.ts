import type { CharAnim, CharacterSpec } from '../art/api';
import { G } from '../core/G';
import { isTouch } from '../core/input';
import { findScene } from '../core/registry';
import type { Dir } from '../core/types';
import type { ChoiceOption } from '../ui/api';
import type {
  ActorHandle, At, ControlName, EmoteKind, LightDef, LightHandle, MapDef, NpcDef, PropDef, PropHandle, TimeOfDay, WalkOptions, WeatherKind, WorldCtx, WorldEvent,
} from './api';
import type { Actor } from './actor';
import { isAt, pxToTile, toPx, unitPx, wk, type Vec } from './geom';
import { FOOT_HH, FOOT_HW } from './grid';
import { MapMemory } from './memory';
import { findPath } from './pathfind';
import type { WorldScene } from './WorldScene';

/** Thrown into pending script promises when the world scene ends; swallowed by the script runner. */
export class WorldStopped extends Error {
  constructor() { super('world stopped'); this.name = 'WorldStopped'; }
}

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];
const isDir = (v: unknown): v is Dir => typeof v === 'string' && (DIRS as string[]).includes(v);

/** Builds the script context for a world scene. Handles are thin facades that look actors up by id. */
export function createCtx(scene: WorldScene): WorldCtx {
  /** Wraps a promise so it rejects when the scene shuts down. */
  function guard<T>(p: Promise<T>): Promise<T> {
    if (!scene.alive) return Promise.reject(new WorldStopped());
    return new Promise<T>((resolve, reject) => {
      const rej = (e: Error) => reject(e);
      scene.pending.add(rej);
      p.then(v => { scene.pending.delete(rej); resolve(v); }, e => { scene.pending.delete(rej); reject(e); });
    });
  }

  /** Dialogue calls are tracked so a stopped world can close a box its dead script left open. */
  function dialog<T>(p: Promise<T>): Promise<T> {
    scene.openDialogs++;
    const done = () => { scene.openDialogs = Math.max(0, scene.openDialogs - 1); };
    p.then(done, done);
    return guard(p);
  }

  const wait = (ms: number) => guard(new Promise<void>(resolve => scene.time.delayedCall(ms, () => resolve())));

  // Existing banks use their established scene-player routes; Teil II changes players within a scene.
  function voicePlayer(): string | undefined {
    return findScene(G.currentScene)?.chapter.id === 'teil-2' ? scene.player?.speaker : undefined;
  }

  /** Resolves a target to px: actor id, interactable/prop id, or At. */
  function targetPx(target: At | string): Vec | null {
    if (typeof target === 'string') {
      const a = scene.actors.get(target);
      if (a) return { x: a.x, y: a.y };
      const it = scene.interactives.find(i => i.id === target);
      if (it) return it.pos();
      const p = scene.props.get(target);
      if (p) return { x: p.x, y: p.y };
      return scene.resolveTarget(target);
    }
    return toPx(target);
  }

  const handles = new Map<string, ActorHandle>();
  function actorHandle(id: string): ActorHandle {
    const cached = handles.get(id);
    if (cached) return cached;
    const get = (): Actor | undefined => scene.actors.get(id);
    const need = (): Actor => {
      const a = get();
      if (!a) throw new Error(`[world] actor '${id}' does not exist on map '${scene.map?.id}'`);
      return a;
    };
    async function walk(points: Vec[], opts: WalkOptions = {}): Promise<void> {
      const a = need();
      const speed = opts.speed ?? (opts.run ? a.runSpeed : a.walkSpeed);
      await guard(a.moveAlong(points, speed, opts.run, opts.face));
    }
    function route(a: Actor, to: Vec, straight?: boolean): Vec[] {
      if (straight) return [to];
      const path = findPath(scene.grid, { x: a.x, y: a.y }, to, { hw: FOOT_HW, hh: FOOT_HH });
      if (!path) return [to];
      // Anchors on props (seats) lie inside the footprint: finish with a short straight step.
      const last = path[path.length - 1];
      const gap = last ? Math.hypot(last.x - to.x, last.y - to.y) : 0;
      if (gap > 0.5 && gap < 18 * wk()) path.push(to);
      return path;
    }
    const h: ActorHandle = {
      id,
      get x() { return get()?.x ?? 0; },
      get y() { return get()?.y ?? 0; },
      get tile() { const a = get(); return a ? pxToTile(a.x, a.y) : { x: 0, y: 0 }; },
      get dir() { return get()?.dir ?? 'down'; },
      get exists() { return Boolean(get()); },
      get sprite() { return get()?.sprite; },
      walkTo(a: number | At | string, b?: number | WalkOptions, c?: WalkOptions): Promise<void> {
        const actor = need();
        let to: Vec | null;
        let opts: WalkOptions | undefined;
        if (typeof a === 'number') { to = toPx([a, b as number]); opts = c; } else { to = targetPx(a); opts = b as WalkOptions | undefined; }
        // walkTo('bank', { anchor: 'sit' }): a named anchor of a prop (or of an interactable's prop).
        if (opts?.anchor && typeof a === 'string') {
          const prop = scene.props.get(a) ?? scene.props.get(`${a}-prop`);
          if (prop) { const an = scene.anchorOf(prop, opts.anchor); to = { x: an.x, y: an.y }; }
        }
        if (!to) return Promise.reject(new Error(`[world] walkTo: unknown target ${String(a)}`));
        // Stop a bit before other actors instead of walking into them.
        if (typeof a === 'string' && scene.actors.has(a)) {
          const dx = actor.x - to.x, dy = actor.y - to.y, d = Math.hypot(dx, dy) || 1;
          to = { x: to.x + (dx / d) * 14 * wk(), y: to.y + (dy / d) * 6 * wk() };
        }
        return walk(route(actor, to, opts?.straight), opts);
      },
      async walkPath(points: At[], opts?: WalkOptions): Promise<void> {
        for (let i = 0; i < points.length; i++) {
          const actor = need();
          const to = toPx(points[i]);
          await walk(route(actor, to, opts?.straight), { ...opts, face: i === points.length - 1 ? opts?.face : undefined });
        }
      },
      teleport(at: At, dir?: Dir) {
        const p = toPx(at);
        need().teleport(p.x, p.y, dir);
        if (id === 'player') { scene.resetTrail(); scene.placeCompanionsBehind(); scene.snapCamera(); }
      },
      face(target: Dir | string | At) {
        const a = need();
        if (isDir(target)) { a.face(target); return; }
        const p = targetPx(target as At | string);
        if (p) a.faceTowards(p.x, p.y);
      },
      play(anim: CharAnim, opts?: { once?: boolean; ms?: number }) {
        const a = need();
        if (opts?.once || opts?.ms) return guard(a.playOnce(anim, opts.ms));
        if (anim === a.idleAnim || anim === 'idle') a.clearOverride(); else a.hold(anim);
        return Promise.resolve();
      },
      setIdle(anim: CharAnim) { const a = need(); a.idleAnim = anim; a.clearOverride(); },
      emote(kind: EmoteKind, ms?: number) { return guard(need().emote(kind, ms)); },
      say(text: string, opts?: { mood?: string; portrait?: string }) { return dialog(G.ui.say(need().speaker, text, opts)); },
      // (bark removers are tracked by the scene, so map changes clear them)
      bark(text: string, ms?: number) { return scene.barkActor(need(), text, ms); },
      show() { const a = need(); a.setVisible(true); },
      hide() { const a = need(); a.setVisible(false); },
      hop() { return guard(need().hop()); },
      hold(on = true) { const a = need(); a.held = on; if (on) a.stopPath(); },
      setSpeed(px: number) { need().walkSpeed = px; },
      setLook(preset: string | CharacterSpec) { need().setLook(preset); },
    };
    handles.set(id, h);
    return h;
  }

  function propHandle(id: string): PropHandle {
    return {
      id,
      get exists() { return scene.props.has(id); },
      get image() { return scene.props.get(id)?.image as Phaser.GameObjects.Image | undefined; },
      setVisible(on: boolean) { scene.props.get(id)?.setVisible(on); },
      shake() { scene.props.get(id)?.shake(1); },
      remove() { scene.removeProp(id); },
    };
  }

  function lightHandle(id: string): LightHandle {
    return {
      id,
      set(patch: Partial<Omit<LightDef, 'id'>>) {
        const l = scene.lighting.get(id);
        if (!l) return;
        if (patch.at) { const p = toPx(patch.at); l.x = p.x; l.y = p.y; }
        if (patch.radius !== undefined) l.radius = patch.radius;
        if (patch.color !== undefined) l.color = patch.color;
        if (patch.intensity !== undefined) l.intensity = patch.intensity;
        if (patch.flicker !== undefined) l.flicker = patch.flicker;
        if (patch.always !== undefined) l.always = patch.always;
        if (patch.kind !== undefined) l.kind = patch.kind;
      },
      fadeTo(intensity: number, ms = 600) {
        const l = scene.lighting.get(id);
        if (!l) return Promise.resolve();
        return guard(new Promise<void>(resolve => scene.tweens.add({ targets: l, intensity, duration: ms, onComplete: () => resolve() })));
      },
      remove() { scene.removeLight(id); },
    };
  }

  function once(event: WorldEvent, id: string): Promise<void> {
    return guard(new Promise<void>(resolve => {
      const off = scene.on(event, id, () => { off(); resolve(); });
    }));
  }

  const ctx: WorldCtx = {
    get scene() { return scene as Phaser.Scene; },
    get map(): MapDef { return scene.map; },
    get player() { return actorHandle('player'); },
    get alive() { return scene.alive; },

    actor: actorHandle,
    spawn(def: NpcDef) { scene.spawnNpc(def); return actorHandle(def.id); },
    despawn(id: string) { scene.despawn(id); },
    prop: propHandle,
    addProp(def: PropDef) { const p = scene.addProp(def); return propHandle(p.id); },

    say: (speaker: string, text: string, opts?: { mood?: string; portrait?: string }) => dialog(G.ui.say(speaker, text, opts)),
    choose: (options: (string | ChoiceOption)[], opts?: { speaker?: string; prompt?: string }) => {
      const speaker = voicePlayer();
      return dialog(G.ui.choose(options, speaker === undefined ? opts : { ...opts, speaker: opts?.speaker ?? speaker }));
    },
    narrate: (lines: string | string[], opts?: { style?: 'book' | 'card' | 'thought' }) => dialog(G.ui.narrate(lines, opts)),
    think: (text: string) => {
      const speaker = voicePlayer();
      return dialog(speaker === undefined ? G.ui.think(text) : G.ui.think(text, { speaker }));
    },
    bark(actorId: string, text: string, ms?: number) {
      const a = scene.actors.get(actorId);
      return a ? scene.barkActor(a, text, ms) : () => {};
    },

    wait,
    lockPlayer() { scene.scriptLock++; scene.player?.stopPath(); if (scene.player) { scene.player.vx = 0; scene.player.vy = 0; } },
    unlockPlayer() { scene.scriptLock = Math.max(0, scene.scriptLock - 1); },
    async cutscene<T>(fn: () => Promise<T>): Promise<T> {
      scene.scriptLock++;
      const prevStealth = scene.stealthOn;
      scene.stealthOn = false;
      try { G.ui.letterbox(true); G.ui.setHud('cinematic'); } catch { /* */ }
      try { return await fn(); } finally {
        scene.scriptLock = Math.max(0, scene.scriptLock - 1);
        scene.stealthOn = prevStealth;
        if (scene.alive) { try { G.ui.letterbox(false); G.ui.setHud('explore'); } catch { /* */ } scene.setCamMode({ kind: 'follow', id: 'player' }); }
      }
    },

    waitForInteract: (id: string) => once('interact', id),
    waitForTrigger: (id: string) => once('trigger', id),
    waitForNear(target: At | string, radius?: number) {
      return guard(new Promise<void>(resolve => {
        const check = () => {
          if (!scene.alive) return;
          const p = targetPx(target);
          const pl = scene.player;
          if (p && pl && Math.hypot(p.x - pl.x, p.y - pl.y) <= (radius !== undefined ? unitPx(radius) : 24 * wk())) { scene.events.off('update', check); resolve(); }
        };
        scene.events.on('update', check);
      }));
    },
    on(event: WorldEvent, id: string, handler: (id: string) => void | Promise<void>) { return scene.on(event, id, handler); },
    onMap(event: WorldEvent, id: string, handler: (id: string) => void | Promise<void>) { return scene.on(event, id, handler, true); },
    controlHint(control: ControlName) { return controlName(control); },
    resetMapMemory(mapId?: string) {
      const id = mapId ?? scene.map?.id;
      if (!id) return;
      if (id === scene.map?.id) scene.mem.clear();
      else MapMemory.load(id, { read: k => G.state.flag<string>(k) as string | undefined, write: (k, v) => G.state.set(k, v) }).clear();
    },

    setObjective(id: string, text: string, target?: At | string | null) {
      G.state.objective(id, text); // the HUD listens to 'objective:set'
      scene.objective = { id, text, target: target ?? null };
    },
    completeObjective(id: string) {
      G.state.complete(id);
      if (scene.objective?.id === id) scene.objective = null;
      // The HUD reacts to 'objective:done' (strike-through + toast + sound).
    },
    setObjectiveTarget(target: At | string | null) {
      if (scene.objective) scene.objective.target = target;
      else {
        const active = G.state.activeObjective();
        if (active) scene.objective = { id: active.id, text: active.text, target };
      }
    },

    interactable(id: string) {
      const find = () => scene.interactives.find(i => i.id === id);
      return {
        enable() { const it = find(); if (it) it.disabled = false; scene.mem.delete('off', id); },
        disable() { const it = find(); if (it) it.disabled = true; scene.mem.add('off', id); },
        remove() { const it = find(); if (it) { it.removed = true; scene.interactives = scene.interactives.filter(x => x !== it); } scene.mem.add('removed', id); },
        get used() { return Boolean(find()?.used); },
      };
    },
    setEnabled(id: string, on: boolean) {
      const anyScene = scene as unknown as { exits: { def: { id: string }; enabled: boolean }[]; triggers: { def: { id: string }; enabled: boolean }[] };
      for (const e of anyScene.exits) if (e.def.id === id) e.enabled = on;
      for (const t of anyScene.triggers) if (t.def.id === id) t.enabled = on;
      const it = scene.interactives.find(i => i.id === id);
      if (it) it.disabled = !on;
      if (on) scene.mem.delete('off', id); else scene.mem.add('off', id);
    },

    changeMap: (mapId: string | MapDef, spawn?: string, opts?: { fadeMs?: number }) => guard(scene.changeMap(mapId, spawn, opts)),

    camera: {
      follow(actorId = 'player') { scene.setCamMode({ kind: 'follow', id: actorId }); },
      pan(target: At | string, ms = 900) {
        const p = targetPx(target);
        if (!p) return Promise.resolve();
        return guard(scene.panTo(p.x, p.y - 8, ms));
      },
      shake(ms?: number, intensity?: number) { scene.shake(ms, intensity); },
      zoom(z: number, ms = 600) { return guard(scene.zoomTo(z, ms)); },
      punch(strength?: number) { scene.punch(strength); },
    },

    lighting: {
      set: (time: TimeOfDay, ms?: number) => { scene.mem.setTime(time); return guard(scene.lighting.set(time, ms)); },
      get time() { return scene.lighting.time; },
      add(def: LightDef) { const l = scene.addLight(def); return lightHandle(l.id); },
      get: lightHandle,
      flash(color?: number, ms?: number) { scene.lighting.flash(color, ms); },
    },

    weather: {
      set(kind: WeatherKind, opts?: { intensity?: number; ms?: number }) {
        scene.mem.setWeather(kind);
        scene.weather.set(kind, opts);
        try {
          const cur = G.audio.currentAmbience().filter(l => l !== 'rain' && l !== 'storm');
          if (kind === 'rain') G.audio.ambience([...cur, 'rain'], { fadeMs: 2000 });
          else if (kind === 'storm') G.audio.ambience([...cur, 'rain', 'storm'], { fadeMs: 2000 });
          else G.audio.ambience(cur, { fadeMs: 2000 });
        } catch { /* audio optional */ }
      },
      get kind() { return scene.weather.kind; },
    },

    stealth: {
      checkpoint(spawnOrAt: string | At, dir?: Dir) {
        if (typeof spawnOrAt === 'string') {
          const sp = scene.map.spawns[spawnOrAt];
          if (!sp) throw new Error(`[world] unknown spawn '${spawnOrAt}'`);
          scene.checkpoint = toPx(sp.at);
          scene.checkpointDir = dir ?? sp.dir ?? 'down';
        } else if (isAt(spawnOrAt)) {
          scene.checkpoint = toPx(spawnOrAt);
          if (dir) scene.checkpointDir = dir;
        }
      },
      onSpotted(handler) {
        scene.spottedHandler = handler ? (id: string) => handler(actorHandle(id)) : null;
      },
      enable(on: boolean) { scene.stealthOn = on; },
      resetGuards() { for (const g of scene.guards) g.reset(); },
      get hidden() { return scene.playerHidden; },
    },

    lookMode: {
      enable(on = true) { scene.look.enabled = on; scene.syncTouchExtras(); },
      get active() { return scene.look.amt > 0.5; },
      get enabled() { return scene.look.enabled; },
    },

    fx: {
      burst(at: At | string, kind = 'sparkle', count?: number) {
        const p = targetPx(at);
        if (p) scene.burst(p.x, typeof at === 'string' && scene.actors.has(at) ? p.y - 10 : p.y, kind, count);
      },
    },

    companions: {
      add(id: string, preset?: string | CharacterSpec, speaker?: string) { scene.addCompanion(id, preset, speaker); return actorHandle(id); },
      remove(id: string) { scene.removeCompanion(id); },
      get ids() { return scene.companionDefs.map(c => c.id); },
    },
  };
  return ctx;
}

const KEY_NAMES: Record<ControlName, string> = { sneak: 'C', look: 'Q', interact: 'E', run: 'Shift', move: 'WASD' };
const TOUCH_NAMES: Record<ControlName, string> = {
  sneak: 'den Schleichen-Knopf', look: 'den Spurenblick-Knopf', interact: 'den Aktionsknopf', run: 'den Renn-Knopf', move: 'den Stick',
};

/** Device-aware control name for tutorial text (keyboard key or touch button). */
export function controlName(control: ControlName, touch = isTouch): string {
  return (touch ? TOUCH_NAMES : KEY_NAMES)[control];
}

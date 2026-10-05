import type Phaser from 'phaser';
import { G } from '../core/G';
import type { Dir } from '../core/types';
import type { At, GuardDef, GuardWaypoint } from './api';
import type { Actor } from './actor';
import { dirAngle, dirFromVector, toPx, unitPx, wk, type Vec } from './geom';
import { FOOT_HH, FOOT_HW, type CollisionGrid } from './grid';
import { findPath } from './pathfind';
import { DEFAULT_SUSPICION, newSuspicion, stepSuspicion, type SuspicionState } from './suspicion';
import { canSee, rotateTowards } from './vision';

export type GuardState = 'walk' | 'wait' | 'suspicious' | 'investigate' | 'return' | 'alert';

interface Waypoint { x: number; y: number; wait: number; face?: Dir }

export interface GuardSense {
  grid: CollisionGrid;
  target: Actor | undefined;
  hidden: boolean;
  enabled: boolean;
  paused?: boolean;
  dt: number;
  t: number;
}

/** Patrol + perception for one guard. Rendering of the cone happens in the scene (overlay). */
export class Guard {
  readonly waypoints: Waypoint[];
  idx = 0;
  private stepDir = 1;
  state: GuardState = 'wait';
  facing: number;
  private waitT = 0;
  private waitFacing = 0;
  private scanT = 0;
  private stateT = 0;
  susp: SuspicionState = newSuspicion();
  lastSeen: Vec | null = null;
  readonly range: number;
  readonly half: number;
  private moving = false;
  private barkCooldown = 0;
  /** Speech bubble provider (set by the scene so it can clear all bubbles on map changes). */
  barker: ((a: Actor, text: string, ms: number) => () => void) | null = null;
  private removeBark: (() => void) | null = null;
  private barkTimer: Phaser.Time.TimerEvent | null = null;
  /** Seconds since the guard turned alert (drives the red cone pulse), Infinity when not alert. */
  alertAge = Infinity;

  constructor(readonly actor: Actor, readonly def: GuardDef) {
    this.waypoints = def.path.map(p => {
      const wp: GuardWaypoint = isWaypoint(p) ? p : { at: p as At };
      const px = toPx(wp.at);
      return { x: px.x, y: px.y, wait: wp.wait ?? (def.path.length === 1 ? Infinity : 600), face: wp.face };
    });
    this.range = def.range !== undefined ? unitPx(def.range) : 88 * wk();
    this.half = ((def.fov ?? 70) / 2) * (Math.PI / 180);
    this.facing = dirAngle(actor.dir);
    actor.walkSpeed = def.speed ?? 28 * wk();
    const first = this.waypoints[0];
    if (first?.face) this.facing = dirAngle(first.face);
    this.waitFacing = this.facing;
    this.waitT = 0.4;
  }

  /** Eye position used for vision (a bit above the feet). */
  get eye(): Vec { return { x: this.actor.x, y: this.actor.y - 3 * wk() }; }

  reset(): void {
    const first = this.waypoints[0];
    this.actor.stopPath();
    if (first) this.actor.teleport(first.x, first.y, first.face ?? this.actor.dir);
    this.facing = dirAngle(first?.face ?? this.actor.dir);
    this.waitFacing = this.facing; this.scanT = 0; this.stateT = 0;
    this.idx = 0; this.stepDir = 1;
    this.state = 'wait'; this.waitT = 0.6;
    this.susp = newSuspicion();
    this.lastSeen = null;
    this.moving = false;
    this.alertAge = Infinity;
    this.clearBark();
  }

  /** Removes a pending or visible speech bubble of this guard. */
  clearBark(): void {
    this.barkTimer?.remove(false);
    this.barkTimer = null;
    this.removeBark?.();
    this.removeBark = null;
  }

  /** Returns 'spotted' once when the meter fills. */
  update(s: GuardSense): 'spotted' | null {
    const a = this.actor;
    // Freeze patrol, perception and scan phase whenever the player cannot act.
    if (s.paused) {
      // Held guards belong to the chapter script, which may await their walk during a cutscene.
      if (a.held) a.update(s.dt);
      return null;
    }
    this.scanT += s.dt;
    this.stateT += s.dt;
    this.barkCooldown -= s.dt;
    if (this.alertAge !== Infinity) this.alertAge += s.dt;
    let result: 'spotted' | null = null;

    // ---- perception ----
    if (s.enabled && s.target && this.state !== 'alert' && !a.held) {
      const sight = canSee(s.grid, {
        origin: this.eye, facing: this.facing, halfAngle: this.half, range: this.range,
        target: { x: s.target.x, y: s.target.y }, sneaking: s.target.sneaking, running: s.target.running && s.target.moving,
        hidden: s.hidden, closeSense: 14 * wk(), chest: 8 * wk(),
      });
      if (sight.visible) this.lastSeen = { x: s.target.x, y: s.target.y };
      const evs = stepSuspicion(this.susp, { visible: sight.visible, closeness: sight.closeness, sneaking: s.target.sneaking, running: s.target.running, dt: s.dt },
        { ...DEFAULT_SUSPICION, reaction: this.def.reaction ?? DEFAULT_SUSPICION.reaction });
      for (const e of evs) {
        if (e === 'suspicious') {
          this.enter('suspicious');
          void a.emote('?', 1100);
          sfx('suspicious', 0.7);
          this.bark(this.def.suspiciousBarks);
        } else if (e === 'alert') {
          this.enter('alert');
          this.alertAge = 0;
          // The '!' must be readable: no old „Hm?“ bubble on top of it.
          this.clearBark();
          a.stopPath();
          void a.emote('!', 1600);
          void a.hop();
          sfx('alert', 1);
          result = 'spotted';
        } else if (e === 'calm') {
          this.clearBark();
          void a.emote('…', 1000);
          this.bark(this.def.calmBarks);
          this.returnToPatrol(s.grid);
        }
      }
    } else if (!s.enabled && this.susp.level !== 'alert' && this.susp.value > 0) {
      this.susp.value = Math.max(0, this.susp.value - s.dt);
      if (this.susp.value === 0 && this.susp.level === 'suspicious') { this.susp.level = 'calm'; this.returnToPatrol(s.grid); }
    }

    if (a.held) { a.update(s.dt); return result; }

    // ---- behaviour ----
    switch (this.state) {
      case 'wait': {
        const wp = this.waypoints[this.idx];
        const base = wp?.face ? dirAngle(wp.face) : this.waitFacing;
        // gentle look-around while standing
        const sweep = Math.sin(this.scanT * 0.55 + this.idx) * 0.30;
        this.turn(base + sweep, 1.1, s.dt);
        this.waitT -= s.dt;
        if (this.waitT <= 0 && this.waypoints.length > 1) this.goNext(s.grid);
        break;
      }
      case 'walk':
      case 'return': {
        if (a.moving) this.turn(Math.atan2(a.vy, a.vx), 1.8, s.dt);
        if (!a.path) {
          // arrived
          const wp = this.waypoints[this.idx];
          this.waitFacing = this.facing;
          this.state = 'wait';
          this.waitT = (wp?.wait ?? 600) / 1000;
        }
        break;
      }
      case 'suspicious': {
        if (a.path) a.stopPath();
        if (this.lastSeen) this.turn(Math.atan2(this.lastSeen.y - a.y, this.lastSeen.x - a.x), 1.8, s.dt);
        if (this.stateT > 0.9 && this.susp.value > 0.5 && this.lastSeen) {
          this.enter('investigate');
          const p = findPath(s.grid, { x: a.x, y: a.y }, this.lastSeen, { hw: FOOT_HW, hh: FOOT_HH });
          if (p) void a.moveAlong(p.slice(0, 6), a.walkSpeed * 0.8);
        }
        break;
      }
      case 'investigate': {
        if (a.moving) this.turn(Math.atan2(a.vy, a.vx), 2.0, s.dt);
        else if (this.lastSeen) this.turn(Math.atan2(this.lastSeen.y - a.y, this.lastSeen.x - a.x), 1.8, s.dt);
        break;
      }
      case 'alert': {
        if (s.target) this.turn(Math.atan2(s.target.y - a.y, s.target.x - a.x), 8, s.dt);
        break;
      }
    }
    if (this.pendingReturn && s.grid) { this.pendingReturn = false; this.returnToPatrol(s.grid); }

    // Face sprite towards the vision direction when not walking.
    if (!a.moving) a.face(dirFromVector(Math.cos(this.facing), Math.sin(this.facing), a.dir));
    a.update(s.dt);
    this.moving = Boolean(a.path);
    return result;
  }

  /** Called after the spotted reaction finished without a reset (custom handlers). */
  calmDown(): void {
    this.susp = newSuspicion();
    this.pendingReturn = true;
    this.alertAge = Infinity;
    this.clearBark();
  }
  private pendingReturn = false;

  private enter(state: GuardState): void { this.state = state; this.stateT = 0; }

  private turn(target: number, rate: number, dt: number): void { this.facing = rotateTowards(this.facing, target, rate * dt); }

  private goNext(grid: CollisionGrid): void {
    const n = this.waypoints.length;
    if (this.def.mode === 'pingpong') {
      if (this.idx + this.stepDir >= n || this.idx + this.stepDir < 0) this.stepDir *= -1;
      this.idx += this.stepDir;
    } else this.idx = (this.idx + 1) % n;
    this.walkToCurrent(grid, 'walk');
  }

  private returnToPatrol(grid: CollisionGrid): void { this.walkToCurrent(grid, 'return'); }

  private walkToCurrent(grid: CollisionGrid, state: GuardState): void {
    const wp = this.waypoints[this.idx];
    if (!wp) return;
    const a = this.actor;
    const p = findPath(grid, { x: a.x, y: a.y }, wp, { hw: FOOT_HW, hh: FOOT_HH });
    this.enter(state);
    if (!p || !p.length) { this.waitFacing = this.facing; this.state = 'wait'; this.waitT = wp.wait / 1000; return; }
    void a.moveAlong(p, a.walkSpeed);
    this.moving = true;
  }

  private bark(lines?: string[]): void {
    if (!lines?.length || this.barkCooldown > 0) return;
    this.barkCooldown = 4;
    const text = lines[Math.floor(Math.random() * lines.length)];
    const a = this.actor;
    // Speak after the emote popped, so bubble and emote do not overlap.
    this.clearBark();
    this.barkTimer = a.host.scene.time.delayedCall(950, () => {
      this.barkTimer = null;
      if (a.destroyed || this.state === 'alert') return;
      if (this.barker) { this.removeBark = this.barker(a, text, 1800); return; }
      try { this.removeBark = G.ui.bubble(text, () => (a.visible && !a.destroyed ? a.host.toScreen(a.x, a.headY - 2) : null), 1800); } catch { /* ui optional */ }
    });
  }
}

function isWaypoint(p: unknown): p is GuardWaypoint {
  return typeof p === 'object' && p !== null && !Array.isArray(p) && 'at' in p;
}

function sfx(name: 'suspicious' | 'alert', volume: number): void {
  try { G.audio.sfx(name, { volume }); } catch { /* audio optional */ }
}

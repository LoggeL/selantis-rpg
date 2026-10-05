import { STANDARD_ABILITIES } from './abilities';
import { DIRS, FACINGS, Grid, OPPOSITE, TERRAIN, directionTo, key, manhattan, stepFacing } from './grid';
import { pathTo, reachable, sameSide, type ReachMap } from './movement';
import { Rng } from './rng';
import { WEAPONS, awardProgress, characterLevel, skillAvailable, statsAtLevel } from './progression';
import type {
  AbilityDef, ActionPreview, AiOverride, BattleEvent, Facing, Phase, Point, PreviewMod, PushOutcome,
  StatusId, TargetPreview, Team, Unit, UnitSpec,
} from './types';

/** Damage when a pushed unit hits a wall/edge/cliff or another unit. */
export const COLLIDE_DAMAGE = 3;
/** Damage the unit that was bumped into takes. */
export const COLLIDE_OTHER_DAMAGE = 2;
/** Fall damage per level beyond the first. */
export const FALL_DAMAGE_PER_LEVEL = 4;
/** Hit chance bonus per height level (attacker above target), capped at ±3 levels. */
export const HEIGHT_HIT_PER_LEVEL = 5;
/** Damage factor per height level, capped at ±3 levels. */
export const HEIGHT_DMG_PER_LEVEL = 0.1;
export const FLANK_DAMAGE = { front: 1, side: 1.25, back: 1.5, none: 1 } as const;
export const FLANK_HIT = { front: 0, side: 10, back: 20, none: 0 } as const;
export const EVASIVE_PENALTY = 45;

export interface BattleSetup {
  grid: Grid;
  units: UnitSpec[];
  abilities?: Record<string, AbilityDef>;
  seed?: number;
  /** Phase order; teams without living units are skipped automatically. */
  phases?: Phase[];
  turnMode?: 'phases' | 'speed';
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function makeUnit(spec: UnitSpec): Unit {
  const weapons = [...(spec.weapons ?? (spec.weapon ? [spec.weapon] : []))];
  for (const id of weapons) if (!Object.hasOwn(WEAPONS, id)) throw new Error(`Unknown weapon ${id}`);
  if (spec.weapon && !weapons.includes(spec.weapon)) throw new Error(`Weapon ${spec.weapon} is not owned by ${spec.id}`);
  const weaponSkills = new Set(weapons.flatMap(id => WEAPONS[id].skills));
  const level = characterLevel(spec.level);
  const stats = spec.baseStats ? statsAtLevel(spec.baseStats, level) : {
    maxHp: spec.maxHp ?? spec.hp ?? 10, maxMp: spec.maxMp ?? spec.mp ?? 24,
    atk: spec.atk ?? 2, def: spec.def ?? 0, speed: spec.speed ?? 5,
  };
  return {
    id: spec.id, name: spec.name, team: spec.team, x: spec.x, y: spec.y, facing: spec.facing ?? 's',
    ...stats, hp: clamp(spec.hp ?? stats.maxHp, 0, stats.maxHp),
    move: spec.move ?? 4, jump: spec.jump ?? 2,
    mp: clamp(spec.mp ?? stats.maxMp, 0, stats.maxMp),
    level, exp: spec.exp ?? 0, weapon: spec.weapon ?? weapons[0] ?? null, weapons,
    innate: spec.abilities.filter(id => !weaponSkills.has(id)), mastered: [...(spec.mastered ?? [])], abilityAp: { ...(spec.abilityAp ?? {}) },
    abilities: [...new Set([...spec.abilities, ...weaponSkills, ...(spec.mastered ?? [])])], cooldowns: {}, statuses: { ...(spec.statuses ?? {}) },
    down: false, nonLethal: !!spec.nonLethal, ai: spec.ai ?? (spec.team === 'enemy' ? 'melee' : 'passive'),
    guardRadius: spec.guardRadius ?? 4, freedTeam: spec.freedTeam ?? 'player', tags: [...(spec.tags ?? [])],
    moved: false, acted: false, undo: null,
  };
}

/**
 * The deterministic battle state machine. All mutations return BattleEvents describing what happened
 * so the presentation layer can animate them. The engine never awaits anything.
 */
export class Battle {
  readonly grid: Grid;
  readonly units: Unit[];
  readonly abilities: Record<string, AbilityDef>;
  readonly rng: Rng;
  readonly phases: Phase[];
  readonly turnMode: 'phases' | 'speed';
  activeUnit: string | null = null;
  private turnQueue: string[] = [];
  round = 1;
  phase: Phase = 'player';
  /** Rounds fully completed (after the last phase of a round). */
  completedRounds = 0;
  flags = new Set<string>();
  aiOverrides = new Map<string, AiOverride>();

  constructor(setup: BattleSetup) {
    this.grid = setup.grid;
    this.abilities = { ...STANDARD_ABILITIES, ...(setup.abilities ?? {}) };
    this.units = setup.units.map(makeUnit);
    this.rng = new Rng(setup.seed ?? 7);
    this.phases = setup.phases ?? ['player', 'ally', 'enemy'];
    this.turnMode = setup.turnMode ?? 'phases';
    for (const u of this.units) {
      for (const a of u.abilities) if (!this.abilities[a]) throw new Error(`Unit ${u.id}: unknown ability ${a}`);
      if (!this.grid.standable(u.x, u.y)) throw new Error(`Unit ${u.id} placed on blocked tile ${u.x},${u.y}`);
    }
  }

  // ---------------------------------------------------------------- queries
  unit(id: string): Unit {
    const u = this.units.find(x => x.id === id);
    if (!u) throw new Error(`Unknown unit ${id}`);
    return u;
  }
  findUnit(id: string): Unit | undefined { return this.units.find(x => x.id === id); }
  /** Unit occupying a cell (alive or wounded; dead ones are gone). */
  unitAt(x: number, y: number): Unit | undefined {
    return this.units.find(u => u.x === x && u.y === y && u.down !== 'dead');
  }
  living(team?: Team): Unit[] { return this.units.filter(u => !u.down && (!team || u.team === team)); }
  ability(id: string): AbilityDef {
    const a = this.abilities[id];
    if (!a) throw new Error(`Unknown ability ${id}`);
    return a;
  }
  has(u: Unit, s: StatusId): boolean { return (u.statuses[s] ?? 0) > 0; }
  isEnemy(a: Unit, b: Unit): boolean { return !sameSide(a.team, b.team); }
  /** Units tagged 'spared' cannot be harmed by the enemy team (e.g. a prisoner they must keep alive). */
  spares(attacker: Unit, target: Unit): boolean { return attacker.team === 'enemy' && target.tags.includes('spared'); }

  canMove(id: string): boolean {
    const u = this.unit(id);
    return !u.down && !u.moved && this.isCurrent(u) && !this.has(u, 'bound') && !this.has(u, 'stunned');
  }
  canAct(id: string): boolean {
    const u = this.unit(id);
    return !u.down && !u.acted && this.isCurrent(u) && !this.has(u, 'bound') && !this.has(u, 'stunned');
  }
  isCurrent(u: Unit): boolean { return u.team === this.phase && (this.turnMode !== 'speed' || u.id === this.activeUnit); }
  canUndo(id: string): boolean { const u = this.unit(id); return this.isCurrent(u) && !u.down && u.moved && !u.acted && !!u.undo; }
  isDone(id: string): boolean { const u = this.unit(id); return !!u.down || (u.moved && u.acted) || this.has(u, 'bound'); }
  abilityReady(u: Unit, abilityId: string): boolean {
    return u.abilities.includes(abilityId) && skillAvailable(u, abilityId) &&
      (u.cooldowns[abilityId] ?? 0) <= 0 && u.mp >= (this.ability(abilityId).mpCost ?? 0);
  }

  equip(id: string, weapon: string): BattleEvent[] {
    const u = this.unit(id);
    if (!this.canAct(id) || u.moved || !u.weapons.includes(weapon)) throw new Error('Equipment can only change before moving or acting on your turn');
    u.weapon = weapon;
    return [{ type: 'equip', unit: id, weapon }];
  }

  /** Hidden in a bush: only visible to observers within 2 tiles. */
  visibleTo(target: Unit, observer: Unit): boolean {
    if (!TERRAIN[this.grid.tile(target.x, target.y)!.terrain].hides) return true;
    return manhattan(target, observer) <= 2;
  }

  reach(id: string): ReachMap {
    const u = this.unit(id);
    return reachable(this.grid, u, this.units);
  }

  // ---------------------------------------------------------------- targeting
  /** Cells a unit (optionally standing at `from`) may target with an ability. */
  targetCells(id: string, abilityId: string, from?: Point): Point[] {
    const u = this.unit(id);
    const a = this.ability(abilityId);
    const origin = from ?? u;
    const out: Point[] = [];
    if (a.shape.type === 'self' || a.target === 'self') return [{ x: origin.x, y: origin.y }];
    if (a.shape.type === 'ring') return [{ x: origin.x, y: origin.y }];
    if (a.shape.type === 'line' || a.shape.type === 'cone') {
      const len = a.shape.length;
      for (const f of FACINGS) for (let i = 1; i <= len; i++) {
        const x = origin.x + DIRS[f].x * i, y = origin.y + DIRS[f].y * i;
        if (this.grid.inBounds(x, y)) out.push({ x, y });
      }
      return out;
    }
    const oh = this.grid.height(origin.x, origin.y);
    for (const t of this.grid.all()) {
      const d = manhattan(origin, t);
      let max = a.range[1];
      if (a.heightRange) max += Math.floor(Math.max(0, oh - t.h) / 2);
      if (d < a.range[0] || d > max) continue;
      if (a.kind === 'melee' && Math.abs(oh - t.h) > (a.vertical ?? 2)) continue;
      if (a.needsLine && d > 1 && !this.grid.hasLineOfFire(origin, t)) continue;
      out.push({ x: t.x, y: t.y });
    }
    return out;
  }

  /** Whether a target cell is a meaningful choice (has a valid unit for unit-targeting abilities). */
  validTarget(id: string, abilityId: string, cell: Point, from?: Point): boolean {
    const u = this.unit(id);
    const a = this.ability(abilityId);
    if (!this.targetCells(id, abilityId, from).some(c => c.x === cell.x && c.y === cell.y)) return false;
    const other = this.unitAt(cell.x, cell.y);
    switch (a.target) {
      case 'enemy': return !!other && !other.down && this.isEnemy(u, other) && !this.has(other, 'bound') && !this.spares(u, other);
      case 'ally': return !!other && !other.down && !this.isEnemy(u, other) && !this.has(other, 'bound');
      case 'bound': return !!other && this.has(other, 'bound');
      case 'any': return !!other && !other.down;
      case 'self':
        // A ring (Druckwelle) without anyone around would be a wasted turn.
        if (a.shape.type === 'ring' && a.kind !== 'support') return this.affectedUnits(id, abilityId, cell, from).length > 0;
        return true;
      case 'tile': {
        // Offensive area/line shots need at least one enemy in the area (no wasted turns).
        if (a.kind === 'support' || a.kind === 'interact') return true;
        return this.affectedUnits(id, abilityId, cell, from).length > 0;
      }
    }
  }

  /** Cells affected when the ability is aimed at `cell`. */
  affectedCells(id: string, abilityId: string, cell: Point, from?: Point): Point[] {
    const u = this.unit(id);
    const a = this.ability(abilityId);
    const origin = from ?? { x: u.x, y: u.y };
    const s = a.shape;
    switch (s.type) {
      case 'single': return [{ x: cell.x, y: cell.y }];
      case 'self': return [{ x: origin.x, y: origin.y }];
      case 'ring': {
        const out: Point[] = [];
        for (const t of this.grid.all()) { const d = manhattan(origin, t); if (d >= 1 && d <= s.radius) out.push({ x: t.x, y: t.y }); }
        return out;
      }
      case 'area': {
        const out: Point[] = [];
        for (const t of this.grid.all()) if (manhattan(cell, t) <= s.radius) out.push({ x: t.x, y: t.y });
        return out;
      }
      case 'line': {
        const f = directionTo(origin, cell);
        const out: Point[] = [];
        const oh = this.grid.height(origin.x, origin.y);
        for (let i = 1; i <= s.length; i++) {
          const x = origin.x + DIRS[f].x * i, y = origin.y + DIRS[f].y * i;
          const t = this.grid.tile(x, y);
          if (!t) break;
          if (TERRAIN[t.terrain].blocksLine || t.h > oh + 2) break;
          out.push({ x, y });
        }
        return out;
      }
      case 'cone': {
        const f = directionTo(origin, cell);
        const d = DIRS[f];
        const side = { x: d.y, y: d.x };
        const out: Point[] = [];
        for (let i = 1; i <= s.length; i++) for (let w = -(i - 1); w <= i - 1; w++) {
          const x = origin.x + d.x * i + side.x * w, y = origin.y + d.y * i + side.y * w;
          if (this.grid.inBounds(x, y)) out.push({ x, y });
        }
        return out;
      }
    }
  }

  /** Units an ability would affect when aimed at `cell`. */
  affectedUnits(id: string, abilityId: string, cell: Point, from?: Point): Unit[] {
    const u = this.unit(id);
    const a = this.ability(abilityId);
    const cells = this.affectedCells(id, abilityId, cell, from);
    const out: Unit[] = [];
    for (const c of cells) {
      const o = this.unitAt(c.x, c.y);
      if (!o || o.down || o.id === u.id && a.shape.type !== 'self' && a.target !== 'self' && a.target !== 'ally') continue;
      if (a.target === 'bound') { if (this.has(o, 'bound')) out.push(o); continue; }
      if (this.has(o, 'bound') || this.spares(u, o)) continue; // prisoners are never hit
      if (a.target === 'ally' || (a.target === 'self' && a.shape.type === 'self')) { if (!this.isEnemy(u, o)) out.push(o); continue; }
      // Offensive shapes only hit enemies (no friendly fire) unless the ability targets 'any'.
      if (this.isEnemy(u, o) || a.target === 'any') out.push(o);
    }
    return out;
  }

  // ---------------------------------------------------------------- combat math
  /** Where the attacker stands relative to the defender's facing. */
  relation(attacker: Point, defender: Unit): 'front' | 'side' | 'back' {
    const dx = attacker.x - defender.x, dy = attacker.y - defender.y;
    const cands: Facing[] = [];
    if (dx !== 0) cands.push(dx > 0 ? 'e' : 'w');
    if (dy !== 0) cands.push(dy > 0 ? 's' : 'n');
    if (Math.abs(dx) !== Math.abs(dy) && cands.length === 2) cands.splice(Math.abs(dx) > Math.abs(dy) ? 1 : 0, 1);
    const rank = (f: Facing) => (f === defender.facing ? 0 : f === OPPOSITE[defender.facing] ? 2 : 1);
    const best = Math.max(...cands.map(rank), 0);
    return best === 2 ? 'back' : best === 1 ? 'side' : 'front';
  }

  /**
   * Full preview of an action: affected tiles and, per target, hit chance, damage per strike,
   * modifiers and the push outcome. Pure (no RNG).
   */
  preview(id: string, abilityId: string, cell: Point, from?: Point): ActionPreview {
    const u = this.unit(id);
    const a = this.ability(abilityId);
    const origin = from ?? { x: u.x, y: u.y };
    const tiles = this.affectedCells(id, abilityId, cell, origin);
    const targets = this.affectedUnits(id, abilityId, cell, origin).map(t => this.previewTarget(u, a, t, origin));
    return { ability: abilityId, tiles, targets };
  }

  previewTarget(u: Unit, a: AbilityDef, t: Unit, origin: Point = u): TargetPreview {
    const mods: PreviewMod[] = [];
    const offensive = a.kind !== 'support' && a.kind !== 'interact' && (this.isEnemy(u, t) || a.target === 'any');
    const oh = this.grid.height(origin.x, origin.y);
    const dh = oh - this.grid.height(t.x, t.y);
    let relation: TargetPreview['relation'] = 'none';
    let chance = 100, damage = 0;
    const hits = a.hits ?? 1;
    if (offensive) {
      relation = a.noFlank || (origin.x === t.x && origin.y === t.y) ? 'none' : this.relation(origin, t);
      chance = a.accuracy;
      const lv = clamp(dh, -3, 3);
      if (!a.noFlank && lv !== 0) chance += lv * HEIGHT_HIT_PER_LEVEL;
      chance += FLANK_HIT[relation];
      const cover = TERRAIN[this.grid.tile(t.x, t.y)!.terrain].cover;
      if (cover && !a.ignoresCover) { chance -= cover; mods.push({ label: 'Deckung', text: `−${cover} %`, kind: 'bad' }); }
      if (this.has(t, 'evasive')) { chance -= EVASIVE_PENALTY; mods.push({ label: 'Ausweichen', text: `−${EVASIVE_PENALTY} %`, kind: 'bad' }); }
      if (this.has(t, 'stunned')) chance += 25;
      chance = a.alwaysHits ? 100 : clamp(Math.round(chance), 5, 100);

      let mult = FLANK_DAMAGE[relation];
      if (relation === 'side') mods.unshift({ label: 'Seite', text: '×1,25', kind: 'good' });
      if (relation === 'back') mods.unshift({ label: 'Rücken', text: '×1,5', kind: 'good' });
      if (!a.noFlank && lv !== 0) {
        mult *= 1 + lv * HEIGHT_DMG_PER_LEVEL;
        const pct = Math.round(lv * HEIGHT_DMG_PER_LEVEL * 100);
        mods.push({ label: 'Höhe', text: `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`, kind: pct > 0 ? 'good' : 'bad' });
      }
      if (this.has(t, 'guarded')) { mult *= 0.5; mods.push({ label: 'Schutzwall', text: '×0,5', kind: 'bad' }); }
      const base = a.fixedDamage ?? Math.max(1, a.power + u.atk - t.def);
      damage = a.fixedDamage !== undefined ? a.fixedDamage : Math.max(1, Math.round(base * mult));
      if (a.fixedDamage !== undefined && this.has(t, 'guarded')) damage = Math.max(0, Math.floor(damage * 0.5));
    }
    let push: PushOutcome | null = null;
    if (a.push && offensive) {
      const dir = directionTo(origin, t);
      push = this.resolvePush(t, dir, a.push);
    }
    const statuses = (a.effects ?? []).filter(e => e.on === 'target').map(e => e.status);
    const extra = push ? (push.collide?.damage ?? 0) + push.fallDamage + (push.intoFire ? TERRAIN.fire.hazard : 0) : 0;
    const lethal = offensive && damage * hits + extra >= t.hp;
    return {
      unit: t.id, chance, damage, hits, relation, heightDiff: dh, mods, push,
      heal: a.heal ?? 0, statuses, lethal, frees: !!a.frees && this.has(t, 'bound'),
    };
  }

  /** Simulates pushing `t` in direction `dir` for `dist` cells. Pure. */
  resolvePush(t: Unit, dir: Facing, dist: number): PushOutcome {
    const out: PushOutcome = { path: [], collide: null, drop: 0, fallDamage: 0, intoWater: false, intoFire: false };
    if (this.has(t, 'guarded') || t.down) return out;
    let cx = t.x, cy = t.y;
    for (let i = 0; i < dist; i++) {
      const nx = cx + DIRS[dir].x, ny = cy + DIRS[dir].y;
      const ch = this.grid.height(cx, cy);
      const nt = this.grid.tile(nx, ny);
      if (!nt || nt.terrain === 'void') { out.collide = { kind: 'edge', damage: COLLIDE_DAMAGE, otherDamage: 0 }; break; }
      if (TERRAIN[nt.terrain].blocks) { out.collide = { kind: 'wall', damage: COLLIDE_DAMAGE, otherDamage: 0 }; break; }
      if (nt.h - ch > 1) { out.collide = { kind: 'cliff', damage: COLLIDE_DAMAGE, otherDamage: 0 }; break; }
      const other = this.unitAt(nx, ny);
      if (other && other.id !== t.id) {
        out.collide = { kind: 'unit', other: other.id, damage: COLLIDE_DAMAGE, otherDamage: this.has(other, 'guarded') ? 1 : COLLIDE_OTHER_DAMAGE };
        break;
      }
      const drop = ch - nt.h;
      out.path.push({ x: nx, y: ny });
      if (drop >= 2) {
        out.drop = Math.max(out.drop, drop);
        out.fallDamage += (drop - 1) * FALL_DAMAGE_PER_LEVEL;
      }
      cx = nx; cy = ny;
    }
    const last = out.path[out.path.length - 1];
    if (last) {
      const info = this.grid.info(last.x, last.y);
      if (info.soft && out.fallDamage) { out.fallDamage = 0; out.intoWater = true; }
      else if (info.soft) out.intoWater = true;
      if (info.hazard) out.intoFire = true;
    }
    return out;
  }

  // ---------------------------------------------------------------- mutations
  move(id: string, to: Point): BattleEvent[] {
    if (!this.canMove(id)) throw new Error(`${id} cannot move now`);
    const u = this.unit(id);
    const reach = this.reach(id);
    if (!reach.has(key(to.x, to.y))) throw new Error(`${id} cannot reach ${to.x},${to.y}`);
    const path = pathTo(reach, to);
    u.undo = { x: u.x, y: u.y, facing: u.facing };
    u.moved = true;
    if (!path.length) return [];
    const prev = path.length > 1 ? path[path.length - 2] : { x: u.x, y: u.y };
    u.facing = stepFacing(prev, to);
    u.x = to.x; u.y = to.y;
    const events: BattleEvent[] = [{ type: 'move', unit: id, path }];
    const hazard = this.grid.info(to.x, to.y).hazard;
    if (hazard) events.push(...this.applyDamage(u, hazard, 'fire'));
    return events;
  }

  undoMove(id: string): BattleEvent[] {
    if (!this.canUndo(id)) return [];
    const u = this.unit(id);
    const back = u.undo!;
    u.x = back.x; u.y = back.y; u.facing = back.facing;
    u.moved = false; u.undo = null;
    return [{ type: 'undo', unit: id, to: { x: back.x, y: back.y }, facing: back.facing }];
  }

  wait(id: string): BattleEvent[] {
    const u = this.unit(id);
    if (!this.isCurrent(u) || u.down || this.has(u, 'bound')) throw new Error(`${id} cannot wait now`);
    u.moved = true; u.acted = true; u.undo = null;
    return [{ type: 'wait', unit: id }];
  }

  /** Turns a unit to face a direction (only used by scripts; normal facing is automatic). */
  face(id: string, facing: Facing): BattleEvent[] {
    this.unit(id).facing = facing;
    return [{ type: 'face', unit: id, facing }];
  }

  act(id: string, abilityId: string, cell: Point): BattleEvent[] {
    if (!this.canAct(id)) throw new Error(`${id} cannot act now`);
    const u = this.unit(id);
    const a = this.ability(abilityId);
    if (!u.abilities.includes(abilityId)) throw new Error(`${id} does not know ${abilityId}`);
    if (!this.abilityReady(u, abilityId)) throw new Error(`${abilityId} is unavailable (weapon, MP or cooldown)`);
    if (!this.validTarget(id, abilityId, cell)) throw new Error(`invalid target ${cell.x},${cell.y} for ${abilityId}`);

    const events: BattleEvent[] = [];
    const tiles = this.affectedCells(id, abilityId, cell);
    const targets = this.affectedUnits(id, abilityId, cell);
    if (!(cell.x === u.x && cell.y === u.y)) {
      const f = directionTo(u, cell);
      if (f !== u.facing) { u.facing = f; events.push({ type: 'face', unit: id, facing: f }); }
    }
    events.push({ type: 'act', unit: id, ability: abilityId, target: { x: cell.x, y: cell.y }, tiles });
    u.acted = true;
    u.undo = null;
    if (a.cooldown) u.cooldowns[abilityId] = a.cooldown;
    if (a.mpCost) { u.mp -= a.mpCost; events.push({ type: 'mp', unit: id, amount: -a.mpCost, mp: u.mp }); }

    // Resolve far targets first so ring pushes do not chain into each other unexpectedly.
    for (const t of targets) {
      if (t.down) continue;
      const p = this.previewTarget(u, a, t);
      if (p.frees) {
        delete t.statuses.bound;
        t.team = t.freedTeam;
        t.moved = true; t.acted = true;
        events.push({ type: 'status', unit: t.id, status: 'bound', on: false });
        events.push({ type: 'free', unit: t.id, by: id, team: t.team });
        continue;
      }
      let anyHit = false;
      const offensive = p.relation !== 'none' || (p.damage > 0);
      if (offensive) {
        for (let i = 0; i < p.hits; i++) {
          if (t.down) break;
          const hit = p.chance >= 100 || this.rng.chance(p.chance);
          anyHit ||= hit;
          const dmg = hit ? p.damage : 0;
          if (hit) t.hp = Math.max(0, t.hp - dmg);
          events.push({ type: 'strike', unit: id, target: t.id, hit, damage: dmg, hp: t.hp, relation: p.relation, index: i, heightDiff: p.heightDiff });
          if (t.hp <= 0) events.push(...this.knockOut(t));
        }
      } else anyHit = true;
      if (!anyHit || t.down) continue;
      if (p.heal) {
        const amount = Math.min(p.heal, t.maxHp - t.hp);
        t.hp += amount;
        events.push({ type: 'heal', unit: t.id, amount, hp: t.hp });
      }
      for (const e of a.effects ?? []) if (e.on === 'target') events.push(...this.addStatus(t, e.status, e.turns));
      if (a.push) events.push(...this.applyPush(t, directionTo(u, t), a.push));
    }
    for (const e of a.effects ?? []) if (e.on === 'self') events.push(...this.addStatus(u, e.status, e.turns));
    const useful = a.kind === 'interact' || events.some(e => e.type === 'strike' && e.hit || e.type === 'heal' && e.amount > 0 || e.type === 'status' && e.on || e.type === 'free');
    const defeated = events.some(e => e.type === 'down' && this.isEnemy(u, this.unit(e.unit)));
    if (useful) events.push(...awardProgress(u, defeated ? 20 : 10, 10));
    return events;
  }

  /** Pushes a unit (also usable by scripts). */
  applyPush(t: Unit, dir: Facing, dist: number): BattleEvent[] {
    const events: BattleEvent[] = [];
    const out = this.resolvePush(t, dir, dist);
    if (!out.path.length && !out.collide) return events;
    const last = out.path[out.path.length - 1];
    if (last) { t.x = last.x; t.y = last.y; }
    events.push({ type: 'push', unit: t.id, path: out.path, drop: out.drop, collide: out.collide });
    if (out.collide) {
      events.push(...this.applyDamage(t, out.collide.damage, 'collision'));
      if (out.collide.other) {
        const o = this.unit(out.collide.other);
        events.push(...this.applyDamage(o, out.collide.otherDamage, 'collision'));
      }
    }
    if (out.fallDamage && !t.down) events.push(...this.applyDamage(t, out.fallDamage, 'fall'));
    if (out.intoFire && !t.down) events.push(...this.applyDamage(t, TERRAIN.fire.hazard, 'fire'));
    return events;
  }

  applyDamage(t: Unit, amount: number, cause: 'collision' | 'fall' | 'fire' | 'script'): BattleEvent[] {
    if (t.down || amount <= 0) return [];
    t.hp = Math.max(0, t.hp - amount);
    const events: BattleEvent[] = [{ type: 'damage', unit: t.id, amount, hp: t.hp, cause }];
    if (t.hp <= 0) events.push(...this.knockOut(t));
    return events;
  }

  heal(t: Unit, amount: number): BattleEvent[] {
    if (t.down) return [];
    const n = Math.min(amount, t.maxHp - t.hp);
    t.hp += n;
    return [{ type: 'heal', unit: t.id, amount: n, hp: t.hp }];
  }

  knockOut(t: Unit): BattleEvent[] {
    if (t.down) return [];
    t.down = t.nonLethal ? 'wounded' : 'dead';
    t.statuses = {};
    t.moved = true; t.acted = true;
    return [{ type: 'down', unit: t.id, kind: t.down }];
  }

  addStatus(t: Unit, s: StatusId, turns: number): BattleEvent[] {
    const had = this.has(t, s);
    t.statuses[s] = Math.max(t.statuses[s] ?? 0, turns);
    return had ? [] : [{ type: 'status', unit: t.id, status: s, on: true }];
  }
  removeStatus(t: Unit, s: StatusId): BattleEvent[] {
    if (!this.has(t, s)) return [];
    delete t.statuses[s];
    return [{ type: 'status', unit: t.id, status: s, on: false }];
  }

  /** Adds a unit mid-battle (reinforcements). If its cell is taken, the nearest free cell is used. */
  spawn(spec: UnitSpec): BattleEvent[] {
    if (this.units.some(u => u.id === spec.id && u.down !== 'dead')) throw new Error(`Unit ${spec.id} exists`);
    const old = this.units.findIndex(u => u.id === spec.id);
    if (old >= 0) this.units.splice(old, 1);
    for (const a of spec.abilities) if (!this.abilities[a]) throw new Error(`Unit ${spec.id}: unknown ability ${a}`);
    const cell = this.freeCellNear(spec);
    if (!cell) return [];
    const u = makeUnit({ ...spec, x: cell.x, y: cell.y });
    if (this.turnMode === 'speed' || u.team === this.phase) { u.moved = true; u.acted = true; } // arrives exhausted
    this.units.push(u);
    return [{ type: 'spawn', unit: u.id }];
  }

  /** Removes a unit from the field (e.g. a retreating wounded soldier leaves the map). */
  remove(id: string): BattleEvent[] {
    const u = this.unit(id);
    u.down = 'dead';
    u.x = -99; u.y = -99;
    return [{ type: 'remove', unit: id }];
  }

  freeCellNear(p: Point): Point | null {
    let best: Point | null = null, bd = Infinity;
    for (const t of this.grid.all()) {
      if (!this.grid.standable(t.x, t.y) || this.unitAt(t.x, t.y)) continue;
      const d = manhattan(p, t);
      if (d < bd) { bd = d; best = { x: t.x, y: t.y }; }
    }
    return best;
  }

  // ---------------------------------------------------------------- phases
  /** Teams in phase order that currently have units able to act. */
  private phaseActive(p: Phase): boolean {
    return this.units.some(u => u.team === p && !u.down && !this.has(u, 'bound'));
  }

  /** All teams share one speed-sorted round. Reinforcements and newly freed units join the next round. */
  private nextRoundOrder(): Unit[] {
    return this.units.filter(u => !u.down && !this.has(u, 'bound') && u.x > -50)
      .sort((a, b) => b.speed - a.speed || a.id.localeCompare(b.id));
  }

  startTurns(): BattleEvent[] {
    if (this.turnMode !== 'speed') return this.startPhase('player');
    this.turnQueue = this.nextRoundOrder().map(u => u.id);
    for (const u of this.units) { u.moved = true; u.acted = true; u.undo = null; }
    return this.beginNextUnit();
  }

  private beginNextUnit(): BattleEvent[] {
    while (this.turnQueue.length) {
      const u = this.findUnit(this.turnQueue.shift()!);
      if (!u || u.down || this.has(u, 'bound')) continue;
      this.activeUnit = u.id;
      return this.startPhase(u.team);
    }
    this.activeUnit = null;
    return [];
  }

  advanceTurn(): BattleEvent[] {
    if (this.turnMode !== 'speed') return this.endPhase();
    if (this.activeUnit) {
      const u = this.unit(this.activeUnit);
      u.moved = true; u.acted = true; u.undo = null;
    }
    const events = this.beginNextUnit();
    if (this.activeUnit) return events;
    this.round++; this.completedRounds++;
    return this.startTurns();
  }

  turnOrder(): Unit[] {
    const current = this.activeUnit ? this.findUnit(this.activeUnit) : undefined;
    const next = this.turnQueue.map(id => this.findUnit(id)).filter((u): u is Unit => !!u && !u.down && !this.has(u, 'bound'));
    return [...(current && !current.down ? [current] : []), ...next];
  }

  /** Begins a phase: resets turn flags, ticks cooldowns and statuses of that team. */
  startPhase(phase: Phase): BattleEvent[] {
    this.phase = phase;
    const events: BattleEvent[] = [{ type: 'phase', phase, round: this.round }];
    for (const u of this.units) {
      if (u.team !== phase || u.down || this.turnMode === 'speed' && u.id !== this.activeUnit) continue;
      u.moved = false; u.acted = false; u.undo = null;
      const restoredMp = Math.min(2, u.maxMp - u.mp);
      if (restoredMp > 0) { u.mp += restoredMp; events.push({ type: 'mp', unit: u.id, amount: restoredMp, mp: u.mp }); }
      for (const k of Object.keys(u.cooldowns)) u.cooldowns[k] = Math.max(0, u.cooldowns[k] - 1);
      for (const s of Object.keys(u.statuses) as StatusId[]) {
        if (s === 'bound' || s === 'stunned') continue;
        const left = (u.statuses[s] ?? 0) - 1;
        if (left <= 0) events.push(...this.removeStatus(u, s));
        else u.statuses[s] = left;
      }
      if (this.has(u, 'stunned')) {
        u.moved = true; u.acted = true;
        events.push(...this.removeStatus(u, 'stunned'));
      }
      const hazard = this.grid.info(u.x, u.y).hazard;
      if (hazard) events.push(...this.applyDamage(u, hazard, 'fire'));
    }
    return events;
  }

  /** Ends the current phase and starts the next one with living units (advancing the round). */
  endPhase(): BattleEvent[] {
    for (const u of this.units) if (u.team === this.phase) u.undo = null;
    let idx = this.phases.indexOf(this.phase);
    for (let guard = 0; guard < this.phases.length * 2; guard++) {
      idx++;
      if (idx >= this.phases.length) { idx = 0; this.round++; this.completedRounds++; }
      const next = this.phases[idx];
      if (next === 'player' || this.phaseActive(next)) return this.startPhase(next);
    }
    return this.startPhase('player');
  }

  /** Units of the current phase that still have something to do. */
  pending(): Unit[] {
    return this.units.filter(u => this.isCurrent(u) && !u.down && !this.has(u, 'bound') && !(u.moved && u.acted));
  }
}

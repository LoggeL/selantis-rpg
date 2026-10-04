import { beamCells, boltLine, DIRS, eq, freeCell, inside, isBlocked, key, manhattan, reachable, unitAt, waveArea, wavePushes, type Cell, type Push, type Unit } from "./grid";
import { attackAspect, dreamDamage, encounterBeatComplete, enemyOrder, facingFromVector, freshTurn, incomingDamage, spendTurn, type Facing, type TurnBudget } from "./tactics";
import type { CombatStats } from "../party/stats";
import type { AbilityDefinition, EncounterDefinition } from "./encounter";

export type BattlePhase = 'arrival' | 'plan' | 'beam' | 'wave' | 'facing' | 'busy' | 'enemy' | 'end';
export type EnemyIntent =
  | { kind: 'advance'; path: Cell[]; strike: boolean }
  | { kind: 'strike' | 'chop'; target: string }
  | { kind: 'bolt'; line: Cell[] }
  | { kind: 'reload' };
export type BattleState = {
  units: Unit[]; phase: BattlePhase; beat: number; turn: TurnBudget; guarding: boolean; facing: Facing;
  flags: Set<string>; maxHp: Map<string, number>;
};
export type BattleCommand =
  | { type: 'move'; to: Cell }
  | { type: 'cast'; ability: string; target: Cell }
  | { type: 'wait' }
  | { type: 'face'; facing: Facing }
  | { type: 'end-turn' }
  | { type: 'resolve-enemy'; id: string };
export type DamageResult = { target: string; amount: number; damage: number; hp: number; defeated: boolean; wounded: boolean; protected: boolean; source: string };
export type BattleEffect =
  | { id: number; kind: 'move'; unit: string; path: Cell[]; end: Cell }
  | { id: number; kind: 'damage'; unit: string; amount: number; source: string; incoming?: boolean }
  | { id: number; kind: 'push'; unit: string; path: Cell[]; end: Cell; collision?: string; hitWall: boolean; amount: number; collisionDamage: number; source: string }
  | { id: number; kind: 'rescue'; unit: string; actor: Unit; event: 'axe-rescue' | 'bolt-rescue'; amount: number }
  | { id: number; kind: 'bolt'; unit: string; line: Cell[]; target?: string; rescue?: Unit };
export type CommandResult = { ok: true; effects: BattleEffect[] } | { ok: false; reason: 'phase' | 'spent' | 'blocked' | 'range' | 'ally' | 'empty' | 'unknown' | 'pending' };
export type AbilityPreview = { ability: AbilityDefinition; cells: Cell[]; hits: Unit[]; pushes: Push[]; dir?: Cell; center?: Cell };

/** Authoritative rules. Effects are settled at animation impact, once, by the renderer. */
export class BattleModel {
  readonly state: BattleState;
  readonly intents = new Map<string, EnemyIntent>();
  private pending = new Map<number, BattleEffect>();
  private sequence = 0;
  private enemyQueue: string[] = [];
  get enemyTurns() { return [...this.enemyQueue]; }

  constructor(readonly encounter: EncounterDefinition, readonly stats: (unit: Unit) => CombatStats) {
    this.state = { units: [], phase: 'arrival', beat: 0, turn: freshTurn(), guarding: false, facing: 's', flags: new Set(), maxHp: new Map() };
  }

  get player() { return this.unit(this.encounter.player.id); }
  unit(id: string): Unit { const unit = this.state.units.find(u => u.id === id); if (!unit) throw new Error(`Unknown battle unit ${id}`); return unit; }
  spawn(definition: Unit): Unit {
    if (this.state.units.some(u => u.id === definition.id)) throw new Error(`Duplicate battle unit ${definition.id}`);
    const unit = { ...definition, cell: freeCell(this.state.units, definition.cell, this.encounter.board) };
    this.state.units.push(unit); this.state.maxHp.set(unit.id, unit.hp); return unit;
  }
  startBeat(id: number) { this.state.beat = id; return this.encounter.beats.find(b => b.id === id); }
  startPlayerTurn() {
    if (this.pending.size) throw new Error('Unsettled battle effects');
    if (!this.player.alive || this.player.wounded) { this.state.phase = 'end'; return; }
    this.enemyQueue = [];
    this.state.turn = freshTurn(); this.state.guarding = false; this.state.phase = 'plan'; this.computeIntents();
  }
  movementPaths() {
    const player = this.player;
    return this.state.turn.moved ? new Map([[key(player.cell), [player.cell]]])
      : reachable(this.state.units.filter(u => u.id !== player.id), player.cell, this.stats(player).move, this.encounter.board);
  }
  preview(abilityId: string, target: Cell): AbilityPreview | null {
    const ability = this.encounter.abilities.find(a => a.id === abilityId);
    if (!ability) return null;
    const player = this.player, board = this.encounter.board, stats = this.stats(player);
    const range = ability.rangeStat ? stats[ability.rangeStat] : ability.range;
    if (ability.targeting === 'line') {
      if (!DIRS.some(d => eq(d, target))) return null;
      const cells = beamCells(player.cell, target, range, board);
      return { ability, dir: target, cells, hits: cells.map(c => unitAt(this.state.units, c)).filter((u): u is Unit => !!u), pushes: [] };
    }
    if (!Number.isInteger(target.x) || !Number.isInteger(target.y) || !inside(target, board) || isBlocked(target, board) || manhattan(player.cell, target) > range) return null;
    const cells = waveArea(target, board, ability.radius ?? 1);
    return { ability, center: target, cells, hits: this.state.units.filter(u => u.alive && !u.wounded && cells.some(c => eq(c, u.cell))),
      pushes: wavePushes(this.state.units, target, player.cell, board, ability.push ?? 0, ability.radius ?? 1) };
  }
  dispatch(command: BattleCommand): CommandResult {
    const state = this.state;
    if (command.type === 'face') {
      if (state.phase !== 'facing') return { ok: false, reason: 'phase' };
      state.facing = command.facing; return { ok: true, effects: [] };
    }
    if (command.type === 'end-turn') {
      if (state.phase !== 'facing') return { ok: false, reason: 'phase' };
      if (this.pending.size) return { ok: false, reason: 'pending' };
      this.enemyQueue = enemyOrder(state.units, this.stats).map(unit => unit.id).filter(id => this.intents.has(id));
      state.phase = 'enemy'; return { ok: true, effects: [] };
    }
    if (command.type === 'resolve-enemy') return this.resolveEnemy(command.id);
    if (!['plan', 'beam', 'wave'].includes(state.phase)) return { ok: false, reason: 'phase' };
    if (this.pending.size) return { ok: false, reason: 'pending' };
    if (command.type === 'wait') {
      state.guarding = !state.turn.acted; state.turn = { moved: true, acted: true }; state.phase = 'facing';
      return { ok: true, effects: [] };
    }
    const turn = spendTurn(state.turn, command.type === 'move' ? 'move' : 'act');
    if (!turn) return { ok: false, reason: 'spent' };
    let effects: BattleEffect[];
    if (command.type === 'move') {
      const path = this.movementPaths().get(key(command.to));
      if (!path || path.length < 2) return { ok: false, reason: 'blocked' };
      effects = [{ id: ++this.sequence, kind: 'move', unit: this.player.id, path, end: path[path.length - 1] }];
    } else {
      const preview = this.preview(command.ability, command.target);
      if (!preview) return { ok: false, reason: 'range' };
      const { ability, hits, pushes } = preview;
      if (ability.targeting === 'line' && ability.protectsAllies && hits.some(u => u.side === 'ally')) return { ok: false, reason: 'ally' };
      if (!hits.some(u => u.side === 'enemy')) return { ok: false, reason: 'empty' };
      const stats = this.stats(this.player), amount = ability.damageStat ? stats[ability.damageStat] ?? ability.damage : ability.damage;
      state.facing = facingFromVector(command.target.x - (preview.center ? this.player.cell.x : 0), command.target.y - (preview.center ? this.player.cell.y : 0));
      effects = ability.targeting === 'line' ? hits.filter(u => u.side === 'enemy' || !ability.protectsAllies).map(u => ({ id: ++this.sequence, kind: 'damage' as const, unit: u.id, amount, source: ability.id }))
        : pushes.map(p => ({ id: ++this.sequence, kind: 'push' as const, unit: p.unit.id, path: p.path, end: p.end, collision: p.collidedWith?.id, hitWall: p.hitWall, amount, collisionDamage: ability.collisionDamage ?? 0, source: ability.id }));
    }
    state.turn = turn; state.phase = 'busy'; return this.queue(effects);
  }
  private queue(effects: BattleEffect[]): CommandResult { effects.forEach(effect => this.pending.set(effect.id, effect)); return { ok: true, effects }; }

  /** Commit each effect exactly once; no stale animation callback can damage twice. */
  settle(id: number): DamageResult[] {
    const effect = this.pending.get(id); if (!effect) return [];
    if (this.pending.keys().next().value !== id) throw new Error('Battle effects must settle in planned order');
    this.pending.delete(id);
    if (effect.kind === 'move') { this.unit(effect.unit).cell = { ...effect.end }; return []; }
    if (effect.kind === 'damage') return [this.damage(effect.unit, effect.amount, effect.source, effect.incoming)];
    if (effect.kind === 'push') {
      const unit = this.unit(effect.unit); unit.cell = { ...effect.end };
      const collided = effect.collision || effect.hitWall;
      const results = effect.collision && this.unit(effect.collision).side === 'enemy' ? [this.damage(effect.collision, effect.collisionDamage, effect.source)] : [];
      results.push(this.damage(unit.id, effect.amount + (collided ? effect.collisionDamage : 0), effect.source)); return results;
    }
    if (effect.kind === 'rescue') {
      if (!this.state.units.some(u => u.id === effect.actor.id)) this.spawn(effect.actor);
      return [this.damage(effect.unit, effect.amount, 'falke')];
    }
    this.state.flags.add('bolt-fired');
    this.state.flags.add(`bolt-fired:${effect.unit}`);
    if (effect.target === this.player.id) return [this.damage(this.player.id, this.attackDamage(this.unit(effect.unit)), 'bolt', true)];
    if (effect.rescue) {
      if (!this.state.units.some(u => u.id === effect.rescue!.id)) this.spawn(effect.rescue);
      const unit = this.unit(effect.rescue.id); unit.hp = 0; unit.alive = false;
    } else if (effect.target) return [this.damage(effect.target, this.stats(this.unit(effect.unit)).attack, 'bolt')];
    return [];
  }
  private damage(id: string, amount: number, source: string, incoming = false): DamageResult {
    const unit = this.unit(id), previous = unit.hp;
    if (!unit.alive || unit.wounded) return { target: id, amount, damage: 0, hp: unit.hp, defeated: !unit.alive, wounded: !!unit.wounded, protected: false, source };
    const protection = incoming && this.encounter.tutorialProtection && id === this.player.id;
    const hit = protection ? dreamDamage(previous, amount) : { hp: Math.max(this.encounter.nonlethal.includes(id) ? 1 : 0, previous - amount), protected: false };
    unit.hp = hit.hp;
    if (previous - amount <= 0 && this.encounter.nonlethal.includes(id)) unit.wounded = true;
    else if (unit.hp <= 0) unit.alive = false;
    if (!unit.alive || unit.wounded) this.intents.delete(id);
    if (!unit.alive && id === this.encounter.player.id) this.state.phase = 'end';
    return { target: id, amount, damage: previous - unit.hp, hp: unit.hp, defeated: !unit.alive, wounded: !!unit.wounded, protected: hit.protected, source };
  }
  attackDamage(attacker: Unit) { return incomingDamage(this.stats(attacker).attack, this.stats(this.player).defense, attackAspect(attacker.cell, this.player.cell, this.state.facing), this.state.guarding); }
  finishAction() {
    if (this.pending.size) throw new Error('Unsettled battle effects');
    this.computeIntents();
    this.state.phase = this.state.turn.acted && (this.state.turn.moved || this.beatComplete()) ? 'facing' : 'plan';
  }
  beatComplete(): boolean {
    return encounterBeatComplete(this.encounter.beats.find(beat => beat.id === this.state.beat)?.complete, this.state.units, this.state.flags);
  }

  computeIntents() {
    this.intents.clear();
    for (const unit of enemyOrder(this.state.units, this.stats)) {
      const rule = this.encounter.enemies[unit.id], target = rule && this.state.units.find(u => u.id === rule.target && u.alive && !u.wounded);
      if (!rule || !target) continue;
      if (rule.strategy === 'bolt') this.intents.set(unit.id, rule.once && this.state.flags.has(`bolt-fired:${unit.id}`) ? { kind: 'reload' } : { kind: 'bolt', line: boltLine(unit.cell, target.cell, this.encounter.board).slice(0, this.stats(unit).attackRange) });
      else this.intents.set(unit.id, manhattan(unit.cell, target.cell) <= this.stats(unit).attackRange
        ? { kind: rule.intent === 'chop' ? 'chop' : 'strike', target: target.id }
        : { kind: 'advance', path: this.approach(unit, target.cell), strike: false });
    }
    return this.intents;
  }
  private approach(unit: Unit, target: Cell): Cell[] {
    const path: Cell[] = []; let current = unit.cell;
    for (let i = 0; i < this.stats(unit).move; i++) {
      if (manhattan(current, target) <= this.stats(unit).attackRange) break;
      const options = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
        .map(d => ({ x: current.x + d.x, y: current.y + d.y }))
        .filter(cell => inside(cell, this.encounter.board) && !isBlocked(cell, this.encounter.board) && !unitAt(this.state.units, cell) && !path.some(p => eq(p, cell)))
        .sort((a, b) => manhattan(a, target) - manhattan(b, target));
      if (!options.length || manhattan(options[0], target) >= manhattan(current, target)) break;
      current = options[0]; path.push(current);
    }
    return path;
  }
  private resolveEnemy(id: string): CommandResult {
    if (this.state.phase !== 'enemy' && this.state.phase !== 'busy') return { ok: false, reason: 'phase' };
    if (this.pending.size) return { ok: false, reason: 'pending' };
    if (this.enemyQueue[0] !== id) return { ok: false, reason: 'phase' };
    this.enemyQueue.shift();
    const unit = this.state.units.find(u => u.id === id), intent = this.intents.get(id), rule = this.encounter.enemies[id];
    if (!unit || !unit.alive || unit.wounded || !intent || !rule) return { ok: false, reason: 'unknown' };
    let effects: BattleEffect[] = [];
    if (intent.kind === 'advance') {
      const path: Cell[] = [];
      for (const cell of intent.path) {
        if (!inside(cell, this.encounter.board) || isBlocked(cell, this.encounter.board) || unitAt(this.state.units, cell)) break;
        path.push(cell);
      }
      if (path.length) effects = [{ id: ++this.sequence, kind: 'move', unit: id, path, end: path[path.length - 1] }];
    } else if (intent.kind === 'strike' || intent.kind === 'chop') {
      effects = intent.kind === 'chop' && rule.rescue
        ? [{ id: ++this.sequence, kind: 'rescue', unit: id, actor: rule.rescue.actor, event: rule.rescue.event, amount: rule.rescue.damage }]
        : [{ id: ++this.sequence, kind: 'damage', unit: intent.target, amount: intent.target === this.player.id ? this.attackDamage(unit) : this.stats(unit).attack, source: 'strike', incoming: true }];
    } else if (intent.kind === 'bolt') {
      effects = [{ id: ++this.sequence, kind: 'bolt', unit: id, line: intent.line, target: intent.line.map(cell => unitAt(this.state.units, cell)).find(Boolean)?.id, rescue: rule.rescue?.actor }];
    }
    return this.queue(effects);
  }
}

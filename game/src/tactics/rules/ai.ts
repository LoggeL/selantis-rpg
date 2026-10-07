import { actionList, type Battle } from './battle';
import { FACINGS, TERRAIN, directionTo, key, manhattan } from './grid';
import { distanceField, pathTo } from './movement';
import type { AbilityDef, AiProfile, Facing, Point, Unit } from './types';

export interface AiPlan {
  unit: string;
  /** Cell to move to (null = stay). */
  moveTo: Point | null;
  action: { ability: string; target: Point } | null;
  /** Act before moving (archers shoot, then fall back). */
  actFirst: boolean;
  score: number;
  reason: string;
}

const offensive = (a: AbilityDef) => a.kind !== 'support' && a.kind !== 'interact';

/** Effective profile considering overrides and guard activation. */
export function effectiveProfile(b: Battle, u: Unit): AiProfile {
  const o = b.aiOverrides.get(u.id);
  const p = o?.profile ?? u.ai;
  if (p === 'guard') {
    const foes = b.units.filter(x => !x.down && b.isEnemy(u, x) && !b.has(x, 'bound'));
    return foes.some(f => manhattan(f, u) <= u.guardRadius) ? 'melee' : 'hold';
  }
  return p;
}

/** Targets this unit cares about: visible enemies, narrowed by taunt or a forced focus. */
export function candidateTargets(b: Battle, u: Unit): Unit[] {
  const o = b.aiOverrides.get(u.id);
  if (o?.target) {
    const t = b.findUnit(o.target);
    if (t && !t.down && !b.has(t, 'bound')) return [t];
  }
  const foes = b.units.filter(x => !x.down && b.isEnemy(u, x) && !b.has(x, 'bound') && !b.spares(u, x) && b.visibleTo(x, u));
  const taunters = foes.filter(f => b.has(f, 'taunt') && manhattan(f, u) <= u.move + 4);
  return taunters.length ? taunters : foes;
}

/** How exposed a cell is: number of foes that could plausibly reach melee next turn. */
function danger(b: Battle, u: Unit, c: Point): number {
  let n = 0;
  for (const f of b.units) {
    if (f.down || !b.isEnemy(u, f) || b.has(f, 'bound')) continue;
    const d = manhattan(f, c);
    if (d <= f.move + 1) n += 1;
    if (d <= 1) n += 0.5;
  }
  return n;
}

function cellScore(b: Battle, u: Unit, c: Point, profile: AiProfile): number {
  const t = b.grid.tile(c.x, c.y)!;
  const info = TERRAIN[t.terrain];
  let s = t.h * (profile === 'archer' ? 0.9 : 0.35);
  if (info.cover) s += 0.8;
  if (info.hazard) s -= 6;
  if (info.cost > 1) s -= 0.3;
  if (profile === 'archer') s -= danger(b, u, c) * 1.6;
  else s -= danger(b, u, c) * 0.15;
  return s;
}

function attackValue(b: Battle, u: Unit, a: AbilityDef, cell: Point, from: Point, focus: Set<string>): number {
  const pv = b.preview(u.id, a.id, cell, from);
  let v = 0;
  for (const t of pv.targets) {
    const target = b.unit(t.unit);
    if (!b.isEnemy(u, target)) { v -= 4; continue; }
    const p = t.chance / 100;
    const extra = t.push ? (t.push.collide?.damage ?? 0) + t.push.fallDamage : 0;
    const dmg = Math.min(target.hp, t.damage * t.hits + extra);
    v += p * dmg;
    if (t.lethal) v += 7 * p;
    v += (1 - target.hp / target.maxHp) * 2.5 * p;
    if (focus.has(target.id)) v += 5 * p;
    if (target.tags.includes('vip')) v += 3 * p;
    if (t.relation === 'back') v += 0.6;
    if (t.relation === 'side') v += 0.3;
  }
  return v;
}

/**
 * Plans one unit's turn: where to stand and what to do. Deterministic for a given battle state.
 */
export function planTurn(b: Battle, id: string): AiPlan {
  const u = b.unit(id);
  const none: AiPlan = { unit: id, moveTo: null, action: null, actFirst: false, score: 0, reason: 'idle' };
  const o = b.aiOverrides.get(id);
  if (o?.skip || u.down || b.has(u, 'bound')) return none;
  const profile = effectiveProfile(b, u);
  if (profile === 'passive') return none;

  const reach = b.canMove(id) && profile !== 'hold' ? b.reach(id) : new Map([[key(u.x, u.y), { x: u.x, y: u.y, cost: 0, prev: null }]]);
  const cells = [...reach.values()].map(n => ({ x: n.x, y: n.y }));

  // Body-block a unit (e.g. a prisoner that must not be harmed): crowd it, preferably toward its goal.
  const blocked = o?.block ? b.findUnit(o.block) : undefined;
  if (blocked && !blocked.down) return normalize(planBlock(b, u, blocked, cells, o?.goal), u);

  // Flee / forced goal: walk toward the goal, never attack.
  if (profile === 'flee' || (o?.goal && !o.target)) {
    const goal = o?.goal;
    if (!goal) return none;
    const field = distanceField(b.grid, [goal], u.jump);
    let best = { x: u.x, y: u.y }, bd = field.get(key(u.x, u.y)) ?? Infinity;
    for (const c of cells) { const d = field.get(key(c.x, c.y)) ?? Infinity; if (d < bd) { bd = d; best = c; } }
    return { ...none, moveTo: best.x === u.x && best.y === u.y ? null : best, reason: 'goal' };
  }

  const targets = candidateTargets(b, u);
  const focus = new Set<string>(o?.target ? [o.target] : targets.filter(t => b.has(t, 'taunt')).map(t => t.id));
  const abilities = actionList(u).map(a => b.ability(a)).filter(a => offensive(a) && b.abilityReady(u, a.id));
  const canAct = b.canAct(id);

  let best: AiPlan = { ...none, score: -Infinity };
  const consider = (p: AiPlan) => { if (p.score > best.score) best = p; };

  const startScore = cellScore(b, u, u, profile);
  // 1) Move, then act.
  for (const c of cells) {
    const pos = cellScore(b, u, c, profile);
    consider({ unit: id, moveTo: c, action: null, actFirst: false, score: pos - 0.01 * manhattan(u, c), reason: 'position' });
    if (!canAct) continue;
    for (const a of abilities) {
      for (const tc of b.targetCells(id, a.id, c)) {
        if (!b.validTarget(id, a.id, tc, c)) continue;
        const occupant = b.unitAt(tc.x, tc.y);
        if (a.target === 'enemy' && occupant && !targets.includes(occupant)) continue;
        const v = attackValue(b, u, a, tc, c, focus);
        if (v <= 0) continue;
        consider({ unit: id, moveTo: c, action: { ability: a.id, target: tc }, actFirst: false, score: v * 2 + pos, reason: 'attack' });
      }
    }
  }
  // 2) Act from here, then reposition (hit and run).
  if (canAct && b.canMove(id) && profile !== 'hold') {
    let bestAfter = startScore, bestCell: Point = { x: u.x, y: u.y };
    for (const c of cells) { const s = cellScore(b, u, c, profile); if (s > bestAfter) { bestAfter = s; bestCell = c; } }
    for (const a of abilities) {
      for (const tc of b.targetCells(id, a.id)) {
        if (!b.validTarget(id, a.id, tc)) continue;
        const occupant = b.unitAt(tc.x, tc.y);
        if (a.target === 'enemy' && occupant && !targets.includes(occupant)) continue;
        // Push abilities may change the board; only archers kite.
        if (profile !== 'archer') continue;
        const v = attackValue(b, u, a, tc, u, focus);
        if (v <= 0) continue;
        consider({ unit: id, moveTo: bestCell, action: { ability: a.id, target: tc }, actFirst: true, score: v * 2 + bestAfter + 0.05, reason: 'kite' });
      }
    }
  }

  if (best.action) return normalize(best, u);

  // 3) Nothing to hit this turn: approach the most attractive target.
  if (!targets.length || profile === 'hold') return normalize({ ...best, action: null }, u);
  const blockers = new Set(b.units.filter(x => !x.down && x.id !== u.id && b.isEnemy(u, x)).map(x => key(x.x, x.y)));
  let goals: Point[] = [];
  const pref = targets.slice().sort((p, q) => weight(b, u, q, focus) - weight(b, u, p, focus));
  const main = pref[0];
  const isArcher = profile === 'archer';
  for (const t of pref.slice(0, focus.size ? 1 : 2)) {
    for (const tile of b.grid.all()) {
      if (!b.grid.standable(tile.x, tile.y)) continue;
      const d = manhattan(tile, t);
      if (isArcher ? d >= 3 && d <= 4 : d === 1) goals.push({ x: tile.x, y: tile.y });
    }
  }
  if (!goals.length) goals = [{ x: main.x, y: main.y }];
  const field = distanceField(b.grid, goals, u.jump, blockers);
  let target = { x: u.x, y: u.y };
  let bestD = (field.get(key(u.x, u.y)) ?? 999) - startScore * 0.5;
  for (const c of cells) {
    const d = (field.get(key(c.x, c.y)) ?? 999) - cellScore(b, u, c, profile) * 0.5;
    if (d < bestD) { bestD = d; target = c; }
  }
  return normalize({ unit: id, moveTo: target, action: null, actFirst: false, score: 0, reason: 'approach' }, u);
}

function planBlock(b: Battle, u: Unit, blocked: Unit, cells: Point[], goal?: Point): AiPlan {
  const foes = candidateTargets(b, u).filter(t => t.id !== blocked.id);
  const abilities = actionList(u).map(a => b.ability(a)).filter(a => offensive(a) && b.abilityReady(u, a.id));
  let best: AiPlan = { unit: u.id, moveTo: null, action: null, actFirst: false, score: -Infinity, reason: 'block' };
  for (const c of cells) {
    const d = manhattan(c, blocked);
    let score = -Math.abs(d - 1) * 3 - (goal ? manhattan(c, goal) * 0.6 : 0) + cellScore(b, u, c, 'melee') * 0.2;
    let act: { ability: string; target: Point; v: number } | null = null;
    if (b.canAct(u.id)) {
      for (const a of abilities) for (const tc of b.targetCells(u.id, a.id, c)) {
        if (!b.validTarget(u.id, a.id, tc, c)) continue;
        const occ = b.unitAt(tc.x, tc.y);
        if (occ && !foes.includes(occ)) continue;
        const v = attackValue(b, u, a, tc, c, new Set());
        if (v > 0 && (!act || v > act.v)) act = { ability: a.id, target: tc, v };
      }
    }
    if (act) score += act.v * 0.8;
    if (score > best.score) best = { unit: u.id, moveTo: c, action: act ? { ability: act.ability, target: act.target } : null, actFirst: false, score, reason: 'block' };
  }
  return best;
}

function weight(b: Battle, u: Unit, t: Unit, focus: Set<string>): number {
  let w = -manhattan(u, t) * 1.2 + (1 - t.hp / t.maxHp) * 6;
  if (focus.has(t.id)) w += 50;
  if (t.tags.includes('vip')) w += 3;
  if (b.has(t, 'guarded')) w -= 2;
  return w;
}

function normalize(p: AiPlan, u: Unit): AiPlan {
  if (p.moveTo && p.moveTo.x === u.x && p.moveTo.y === u.y) p.moveTo = null;
  if (!isFinite(p.score)) p.score = 0;
  return p;
}

/**
 * End-of-turn facing: turn toward the threats so that no foe gets an easy back attack. Foes that could
 * reach the unit next turn count, nearer ones more; ties prefer facing the nearest foe.
 */
export function chooseFacing(b: Battle, u: Unit): Facing {
  const foes = b.units.filter(f => !f.down && f.x > -50 && b.isEnemy(u, f) && !b.has(f, 'bound'));
  if (!foes.length) return u.facing;
  const nearest = foes.reduce((p, q) => (manhattan(q, u) < manhattan(p, u) ? q : p));
  const threats = foes.filter(f => manhattan(f, u) <= f.move + 2);
  if (!threats.length) threats.push(nearest);
  const toward = directionTo(u, nearest);
  let best = toward, bestScore = Infinity;
  for (const facing of [toward, ...FACINGS.filter(f => f !== toward)]) {
    const probe = { ...u, facing };
    let score = 0;
    for (const t of threats) {
      const r = b.relation(t, probe);
      score += (r === 'back' ? 3 : r === 'side' ? 1 : 0) / Math.max(1, manhattan(t, u));
    }
    if (score < bestScore - 1e-9) { bestScore = score; best = facing; }
  }
  return best;
}

/** Facing an AI unit should take before it waits, or null to keep it (idle, scripted or downed units). */
export function endTurnFacing(b: Battle, plan: AiPlan): Facing | null {
  const u = b.unit(plan.unit);
  if (plan.reason === 'idle' || u.down || b.has(u, 'bound')) return null;
  const f = chooseFacing(b, u);
  return f === u.facing ? null : f;
}

/** Applies a plan to the battle and returns the events (used by tests and the controller). */
export function executePlan(b: Battle, plan: AiPlan) {
  const events = [] as ReturnType<Battle['move']>;
  const doMove = () => {
    if (plan.moveTo && b.canMove(plan.unit)) {
      const reach = b.reach(plan.unit);
      if (reach.has(key(plan.moveTo.x, plan.moveTo.y)) && pathTo(reach, plan.moveTo).length) events.push(...b.move(plan.unit, plan.moveTo));
    }
  };
  const doAct = () => {
    if (plan.action && b.canAct(plan.unit) && b.validTarget(plan.unit, plan.action.ability, plan.action.target)) {
      events.push(...b.act(plan.unit, plan.action.ability, plan.action.target));
    }
  };
  if (plan.actFirst) { doAct(); doMove(); } else { doMove(); doAct(); }
  const facing = endTurnFacing(b, plan);
  if (facing) events.push(...b.face(plan.unit, facing));
  if (!b.unit(plan.unit).down) events.push(...b.wait(plan.unit));
  return events;
}

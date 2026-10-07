import type { CharAnim } from '../art/api';
import type { UiApi } from '../ui/api';
import type {
  AiOverride, BattleActor, BattleCtx, BattleDef, BattleResult, BattleUnitDef, HintOptions,
} from './api';
import { executePlanSteps } from './aiRunner';
import { Battle } from './rules/battle';
import { Grid, manhattan } from './rules/grid';
import { evaluate, type Outcome } from './rules/objectives';
import type { BattleEvent, Facing, Phase, Point, StatusId, Unit } from './rules/types';
import { progressOf, restoreProgress, type CharacterProgress } from './rules/progression';

/** Everything the controller needs from the presentation (scene + DOM UI). */
export interface Presenter {
  play(events: BattleEvent[]): Promise<void>;
  startBanner(title: string, subtitle?: string): Promise<void>;
  phaseBanner(phase: Phase, round: number): Promise<void>;
  banner(text: string, sub?: string): Promise<void>;
  focus(target: Point | string, ms?: number): Promise<void>;
  /** Briefly shows an AI unit's move range before it walks. */
  showEnemyIntent(unit: string, cells: Point[]): Promise<void>;
  /** Ability name plate before an AI action. */
  announce(unit: string, ability: string): Promise<void>;
  /** Shows a hint card; resolves when its „Verstanden“ button is pressed (if shown). */
  showHint(text: string, opts: HintOptions, withButton: boolean): Promise<void>;
  clearHint(): void;
  bark(unit: string, text: string, ms?: number): void;
  pose(unit: string, anim: CharAnim): void;
  tableau(actors: BattleActor[], focus: string): Promise<void>;
  magicBurst(unit: string, thrown?: string): Promise<void>;
  shake(intensity: number): void;
  setObjective(text: string, detail?: string): void;
  /** Called whenever the state changed (UI refresh). */
  refresh(): void;
  /** Player phase begins: enable input. */
  beginPlayerPhase(): void;
  endPlayerPhase(): void;
  /** Victory/defeat presentation; for defeat with retry resolves 'retry' or 'continue'. */
  outcome(kind: 'win' | 'lose', canRetry: boolean): Promise<'retry' | 'continue'>;
  wait(ms: number): Promise<void>;
}

interface Deferred { promise: Promise<void>; resolve: () => void; }
const deferred = (): Deferred => { let resolve!: () => void; const promise = new Promise<void>(r => (resolve = r)); return { promise, resolve }; };

export type PlayerSignal = { type: 'select' | 'move' | 'act' | 'endTurn' | 'undo' | 'wait'; unit?: string; ability?: string };

/**
 * Async battle flow: phases, AI turns, hooks, waves, objectives. Owns the rules engine.
 * Player input arrives through perform() / endTurn() from the scene.
 */
export class BattleController {
  readonly battle: Battle;
  readonly def: BattleDef;
  private locks = 0;
  private ended: Outcome = null;
  private forced: Outcome = null;
  private turnDone: Deferred | null = null;
  private firedWaves = new Set<number>();
  private firedHp = new Set<number>();
  private firedTriggers = new Set<string>();
  private roundHooks = new Set<string>();
  private hintWaiters: { test: (e: PlayerSignal) => boolean; resolve: () => void }[] = [];
  private hookDepth = 0;
  readonly ctx: BattleCtx;
  objectiveText: string;
  objectiveDetail: string | undefined;
  /** Unit definitions by id (look, portrait, title). */
  readonly unitDefs = new Map<string, BattleUnitDef>();

  constructor(def: BattleDef, private presenter: Presenter, private ui: UiApi, private onFinish: (r: BattleResult | 'retry') => void, private retries = 0,
    private progress?: { get(id: string): CharacterProgress | undefined; set(id: string, value: CharacterProgress): void }) {
    this.def = def;
    const grid = Grid.parse(def.map.height, def.map.terrain, def.map.legend);
    for (const u of def.units) this.unitDefs.set(u.id, u);
    for (const w of def.waves ?? []) for (const u of w.units) this.unitDefs.set(u.id, u);
    const units = def.units.map(u => restoreProgress(u, u.team !== 'enemy' ? progress?.get(u.id) : undefined));
    this.battle = new Battle({ grid, units, abilities: def.abilities, seed: def.seed ?? 7, turnMode: 'speed', progression: def.progression });
    this.objectiveText = def.objective.text;
    this.objectiveDetail = def.objective.detail;
    this.ctx = this.makeCtx();
  }

  // ---------------------------------------------------------------- state for the scene
  get isEnded(): boolean { return this.ended !== null; }
  /** Player input allowed right now. */
  inputEnabled(): boolean { return !this.ended && !this.turnEnding && this.battle.phase === 'player' && this.locks === 0 && !!this.turnDone; }
  outcomeNow(): Outcome { return this.forced ?? evaluate(this.battle, this.def.objective.win, this.def.objective.lose); }

  // ---------------------------------------------------------------- main loop
  async run(): Promise<void> {
    this.lock();
    try {
      await this.presenter.startBanner(this.def.title, this.def.subtitle);
      await this.hook(() => this.def.hooks?.onStart?.(this.ctx));
    } finally { this.unlock(); }
    let events = this.battle.startTurns();
    while (!this.ended) {
      if (await this.checkOutcome()) return;
      const phase = this.battle.phase;
      this.lock();
      try {
        await this.presenter.phaseBanner(phase, this.battle.round);
        await this.presenter.play(events);
        await this.afterEvents(events);
        if (await this.checkOutcome()) return;
        if (phase === 'player') { this.turnDone = deferred(); this.turnEnding = false; }
        const hookKey = `${this.battle.round}:${phase}`;
        if (!this.roundHooks.has(hookKey)) {
          this.roundHooks.add(hookKey);
          await this.spawnWaves();
          await this.hook(() => this.def.hooks?.onRound?.(this.ctx, this.battle.round, phase));
        }
        await this.runTriggers();
        if (await this.checkOutcome()) return;
      } finally { this.unlock(); }

      if (phase === 'player') {
        if (!this.turnEnding) this.presenter.beginPlayerPhase();
        this.presenter.refresh();
        if (!this.battle.pending().length) this.endTurn();
        await this.turnDone!.promise;
        this.turnDone = null;
        this.presenter.endPlayerPhase();
      } else {
        await this.aiPhase();
      }
      if (this.ended) return;
      if (await this.checkOutcome()) return;
      events = this.battle.advanceTurn();
      this.presenter.refresh();
    }
  }

  /** Runs a player action (move, undo, act, wait) with animation and hooks. */
  async perform(fn: () => BattleEvent[]): Promise<boolean> {
    if (!this.inputEnabled()) return false;
    this.lock();
    try {
      const events = fn();
      await this.presenter.play(events);
      this.presenter.refresh();
      await this.afterEvents(events);
      await this.checkOutcome();
    } finally { this.unlock(); }
    // onFinish may already have stopped tactics and restored the exploration scene.
    if (!this.ended) this.presenter.refresh();
    return true;
  }

  /** Ends the player phase. Pending tutorial hints of this turn are resolved and later ones skipped. */
  endTurn(): void {
    if (!this.turnDone || this.ended || this.turnEnding) return;
    this.turnEnding = true;
    this.signal({ type: 'endTurn' });
    const waiters = this.hintWaiters;
    this.hintWaiters = [];
    waiters.forEach(w => w.resolve());
    this.presenter.clearHint();
    this.turnDone.resolve();
  }
  /** True between the player ending the turn and the next player phase. */
  private turnEnding = false;

  /** Player-side signals (for tutorial hints). */
  signal(e: PlayerSignal): void {
    const hit = this.hintWaiters.filter(w => w.test(e));
    this.hintWaiters = this.hintWaiters.filter(w => !hit.includes(w));
    for (const w of hit) w.resolve();
  }

  // ---------------------------------------------------------------- internals
  private lock(): void { this.locks++; }
  private unlock(): void { this.locks = Math.max(0, this.locks - 1); }

  private async hook(fn: () => void | Promise<void>): Promise<void> {
    if (this.hookDepth > 4) return;
    this.hookDepth++;
    try { await fn(); } catch (err) { console.error('[tactics] hook failed', err); } finally { this.hookDepth--; }
  }

  private async aiPhase(): Promise<void> {
    const phase = this.battle.phase;
    const order = this.battle.pending();
    for (const u of order) {
      if (this.ended) return;
      if (u.down || u.team !== phase || this.battle.isDone(u.id)) continue;
      this.lock();
      try {
        await executePlanSteps(this, u.id, this.presenter);
      } catch (err) { console.error('[tactics] ai failed', err); }
      finally { this.unlock(); }
      if (await this.checkOutcome()) return;
    }
    await this.presenter.wait(250);
  }

  /** Plays events and runs hooks (used by the AI runner too). */
  async apply(events: BattleEvent[]): Promise<void> {
    await this.presenter.play(events);
    this.presenter.refresh();
    await this.afterEvents(events);
  }

  private async afterEvents(events: BattleEvent[]): Promise<void> {
    const h = this.def.hooks;
    if (!events.length) return;
    for (const e of events) {
      if (e.type === 'down' && h?.onUnitDown) { const u = this.battle.unit(e.unit); await this.hook(() => h.onUnitDown!(this.ctx, u, e.kind)); }
      if (e.type === 'free' && h?.onFree) {
        const u = this.battle.unit(e.unit), by = this.battle.unit(e.by);
        await this.hook(() => h.onFree!(this.ctx, u, by));
      }
      if (e.type === 'move' && h?.onMove) { const u = this.battle.unit(e.unit); await this.hook(() => h.onMove!(this.ctx, u, e.path[e.path.length - 1])); }
    }
    const act = events.find(e => e.type === 'act') as Extract<BattleEvent, { type: 'act' }> | undefined;
    if (act && h?.onAction) await this.hook(() => h.onAction!(this.ctx, { unit: this.battle.unit(act.unit), ability: act.ability, events }));
    for (let i = 0; i < (h?.onHpBelow ?? []).length; i++) {
      const t = h!.onHpBelow![i];
      if (this.firedHp.has(i)) continue;
      const u = this.battle.findUnit(t.unit);
      if (!u) continue;
      const limit = t.below <= 1 ? t.below * u.maxHp : t.below;
      if (u.hp < limit) { this.firedHp.add(i); await this.hook(() => t.run(this.ctx, u)); }
    }
    await this.runTriggers();
  }

  private async runTriggers(): Promise<void> {
    for (const t of this.def.hooks?.triggers ?? []) {
      if (this.firedTriggers.has(t.id)) continue;
      let ok = false;
      try { ok = t.when(this.ctx); } catch (err) { console.error('[tactics] trigger check failed', err); }
      if (!ok) continue;
      if (t.once !== false) this.firedTriggers.add(t.id);
      await this.hook(() => t.run(this.ctx));
    }
  }

  private async spawnWaves(): Promise<void> {
    const waves = this.def.waves ?? [];
    for (let i = 0; i < waves.length; i++) {
      const w = waves[i];
      if (this.firedWaves.has(i) || w.round !== this.battle.round || (w.phase ?? 'player') !== this.battle.phase) continue;
      this.firedWaves.add(i);
      await this.ctx.spawn(w.units, { banner: w.text });
    }
  }

  private async checkOutcome(): Promise<boolean> {
    if (this.ended) return true;
    const o = this.outcomeNow();
    if (!o) return false;
    this.ended = o;
    this.turnDone?.resolve();
    this.presenter.endPlayerPhase();
    this.presenter.clearHint();
    await this.finish(o);
    return true;
  }

  private async finish(o: 'win' | 'lose'): Promise<void> {
    const b = this.battle;
    const result: BattleResult = {
      outcome: o, rounds: b.round, retries: this.retries,
      dead: b.units.filter(u => u.down === 'dead').map(u => u.id),
      wounded: b.units.filter(u => u.down === 'wounded').map(u => u.id),
      flags: [...b.flags],
    };
    if (o === 'win') {
      const rewards = b.units.filter(u => u.team !== 'enemy' && u.down !== 'dead')
        .flatMap(u => b.rewardVictory(u.id));
      await this.presenter.play(rewards);
      for (const u of b.units) if (u.team !== 'enemy' && u.down !== 'dead') this.progress?.set(u.id, progressOf(u));
      await this.presenter.outcome('win', false);
      await this.hook(() => this.def.onWin?.(this.ctx));
      this.onFinish(result);
      return;
    }
    const retry = (this.def.onDefeat ?? 'retry') === 'retry';
    const choice = await this.presenter.outcome('lose', retry);
    if (retry && choice === 'retry') { this.onFinish('retry'); return; }
    await this.hook(() => this.def.onLose?.(this.ctx));
    this.onFinish(result);
  }

  // ---------------------------------------------------------------- hook context
  private makeCtx(): BattleCtx {
    const c = this;
    const b = this.battle;
    const p = this.presenter;
    const ctx: BattleCtx = {
      ui: this.ui,
      battle: b,
      def: this.def,
      get round() { return b.round; },
      get phase() { return b.phase; },
      unit: id => b.findUnit(id),
      say: (speaker, text, opts) => c.ui.say(speaker, text, opts),
      async hint(text, opts = {}) {
        // A hint for a player turn that already ended is skipped.
        if (c.turnEnding && b.phase === 'player') return;
        const until = opts.until ?? 'click';
        let done: Promise<void>;
        if (until === 'click') done = p.showHint(text, opts, true);
        else {
          const test = typeof until === 'function' ? until : (e: PlayerSignal) => e.type === until;
          done = new Promise<void>(resolve => c.hintWaiters.push({ test, resolve }));
          void p.showHint(text, opts, false);
        }
        // Hints never freeze the battle: the input lock is released while the card is open
        // (during the player phase), so the player can act right away.
        const held = c.locks;
        c.locks = 0;
        try { await done; } finally { c.locks = held; }
        p.clearHint();
      },
      clearHint: () => p.clearHint(),
      focus: (target, ms) => p.focus(target, ms),
      wait: ms => p.wait(ms),
      banner: (text, sub) => p.banner(text, sub),
      bark: (unit, text, ms) => p.bark(unit, text, ms),
      async spawn(units, opts) {
        const list = Array.isArray(units) ? units : [units];
        if (opts?.banner) await p.banner(opts.banner);
        for (const u of list) {
          c.unitDefs.set(u.id, u);
          const ev = b.spawn(restoreProgress(u, u.team !== 'enemy' ? c.progress?.get(u.id) : undefined));
          if (ev.length) { await p.focus(u.id, 300); await c.apply(ev); }
        }
      },
      async remove(unit) { await c.apply(b.remove(unit)); },
      async move(unit, to) {
        const u = b.unit(unit);
        const saved = { move: u.move, moved: u.moved, team: u.team, phase: b.phase, active: b.activeUnit, undo: u.undo };
        u.move = 99; u.moved = false;
        b.phase = u.team;
        b.activeUnit = u.id;
        try { await c.apply(b.move(unit, to)); }
        catch (err) { console.warn('[tactics] scripted move failed', err); }
        finally { u.move = saved.move; u.moved = saved.moved; b.phase = saved.phase; b.activeUnit = saved.active; u.undo = saved.undo; }
      },
      face(unit, facing: Facing) { void p.play(b.face(unit, facing)); },
      pose: (unit, anim) => p.pose(unit, anim),
      tableau: (actors, focus) => p.tableau(actors, focus),
      magicBurst: (unit, thrown) => p.magicBurst(unit, thrown),
      async damage(unit, amount) { await c.apply(b.applyDamage(b.unit(unit), amount, 'script')); },
      async heal(unit, amount) { await c.apply(b.heal(b.unit(unit), amount)); },
      async setStatus(unit, status: StatusId, turns) {
        const u = b.unit(unit);
        await c.apply(turns > 0 ? b.addStatus(u, status, turns) : b.removeStatus(u, status));
      },
      setAi(unit, override: AiOverride | null) { if (override) b.aiOverrides.set(unit, override); else b.aiOverrides.delete(unit); },
      setObjective(text, detail) { c.objectiveText = text; c.objectiveDetail = detail; p.setObjective(text, detail); },
      flag(name) { b.flags.add(name); },
      hasFlag: name => b.flags.has(name),
      shake: (i = 1) => p.shake(i),
      win() { c.forced = 'win'; },
      lose() { c.forced = 'lose'; },
    };
    return ctx;
  }

  /** Units sorted for the turn-order strip: current phase first. */
  turnOrder(): Unit[] {
    return this.battle.turnOrder();
  }

  /** Nearest enemy distance (for UI hints). */
  nearestFoe(u: Unit): number {
    let d = Infinity;
    for (const o of this.battle.units) if (!o.down && this.battle.isEnemy(u, o)) d = Math.min(d, manhattan(u, o));
    return d;
  }
}

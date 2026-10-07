// „Sammlung“ (e2-konzentration): pure, deterministic rules of Lia's concentration exercise. No DOM, no clock: the
// panel (konzentration-game.ts) feeds elapsed time and input. Tested in konzentration-logic.test.ts.
//
// A light sits in the middle of Lia's mind (unit circle: calm radius in the centre, the light slips away beyond the
// outer ring). A breathing ring swells (inhale), stays full for a short window and sinks (exhale). Thoughts („Kyra“,
// „Flick“, „der Hof“, „Foltan“) drift across and pull the light towards them; Lia lets them pass (never grab them)
// and steers the light back with direction input. Confirming while the breath is full and the light is calm counts
// one calm breath; three calm breaths release the impulse. Every mistake only costs time: nothing is ever undone
// except the breath in progress.

export const THOUGHT_WORDS = ['Kyra', 'Flick', 'der Hof', 'Foltan'] as const;

export interface SammlungConfig {
  /** Seconds the ring needs to fill. */
  inhale: number;
  /** Seconds the breath stays full (the confirm window). */
  full: number;
  /** Seconds the ring needs to sink again. */
  exhale: number;
  /** The light counts as calm inside this radius. */
  calmRadius: number;
  /** Beyond this radius the light slips away (breath restarts, light back to the centre). */
  outerRadius: number;
  /** Steering speed (units per second). */
  steer: number;
  /** Distance at which a thought starts to pull. */
  pullRadius: number;
  /** Pull speed at contact (units per second) before difficulty and assist. */
  pull: number;
  /** Drift speed of thoughts (units per second). */
  thoughtSpeed: number;
  /** Seconds between two thoughts at the start (gets a little shorter with every calm breath). */
  spawnEvery: number;
  /** Seconds before the first thought appears. */
  firstThought: number;
  /** Calm breaths needed. */
  breaths: number;
  /** Seconds a grabbed thought keeps its stronger pull. */
  gripSeconds: number;
  /** Pull factor of a grabbed thought. */
  gripFactor: number;
}

/** Default rules; `reduced` (Reduzierte Bewegung) lets the thoughts drift more slowly and keeps the window a bit longer. */
export function sammlungConfig(reduced = false): SammlungConfig {
  return {
    inhale: 3,
    full: reduced ? 1.6 : 1.3,
    exhale: 2.2,
    calmRadius: 0.3,
    outerRadius: 1,
    steer: 0.95,
    pullRadius: 0.62,
    pull: 0.6,
    thoughtSpeed: reduced ? 0.24 : 0.32,
    spawnEvery: reduced ? 3.8 : 3.2,
    firstThought: 1.6,
    breaths: 3,
    gripSeconds: 2.4,
    gripFactor: 2.4,
  };
}

/** Radius at which thoughts appear and disappear (outside the outer ring). */
export const THOUGHT_START_RADIUS = 1.45;

export interface Thought {
  id: string;
  word: string;
  /** Time of appearance. */
  born: number;
  /** Direction it comes from (radians). */
  angle: number;
  /** Perpendicular offset of its path from the centre (how close it passes). */
  miss: number;
  speed: number;
}

export interface SammlungStats {
  /** The light slipped beyond the outer ring. */
  lost: number;
  /** Confirmed before the breath was full. */
  early: number;
  /** Confirmed at full breath, but the light was not calm. */
  restless: number;
  /** Let the full breath pass without confirming. */
  missed: number;
  /** Grabbed a thought. */
  held: number;
}

export interface SammlungState {
  /** Total time. */
  t: number;
  /** Breath clock (0 … inhale + full + exhale). */
  bt: number;
  /** Light position (unit circle, 0/0 = centre). */
  x: number;
  y: number;
  /** Calm breaths so far. */
  calm: number;
  /** The current breath was already confirmed (or wasted). */
  used: boolean;
  /** Number of thoughts spawned so far (drives the deterministic schedule). */
  spawned: number;
  nextSpawn: number;
  thoughts: Thought[];
  grip: { id: string; until: number } | null;
  stats: SammlungStats;
  /** Words of grabbed thoughts, in order. */
  heldWords: string[];
  done: boolean;
}

export type BreathPhase = 'in' | 'full' | 'out';

export type SammlungEvent = 'spawn' | 'full' | 'missed' | 'lost' | 'released';

export type ConfirmResult = 'calm' | 'done' | 'early' | 'restless' | 'late' | 'ignored';

export interface SammlungInput {
  /** Direction keys / on-screen arrows: -1 … 1 each. */
  dx?: number;
  dy?: number;
  /** Pointer drag target in unit coordinates (wins over dx/dy). */
  target?: { x: number; y: number } | null;
}

export function sammlungStart(cfg: SammlungConfig = sammlungConfig()): SammlungState {
  return {
    t: 0, bt: 0, x: 0, y: 0, calm: 0, used: false, spawned: 0, nextSpawn: cfg.firstThought, thoughts: [], grip: null,
    stats: { lost: 0, early: 0, restless: 0, missed: 0, held: 0 }, heldWords: [], done: false,
  };
}

export function cycleLength(cfg: SammlungConfig): number {
  return cfg.inhale + cfg.full + cfg.exhale;
}

/** Phase and fill level (0 … 1) of the breathing ring at breath clock `bt`. */
export function breathAt(bt: number, cfg: SammlungConfig): { phase: BreathPhase; level: number } {
  if (bt < cfg.inhale) {
    const p = Math.max(0, bt / cfg.inhale);
    return { phase: 'in', level: p * p * (3 - 2 * p) };
  }
  if (bt < cfg.inhale + cfg.full) return { phase: 'full', level: 1 };
  const p = Math.min(1, (bt - cfg.inhale - cfg.full) / cfg.exhale);
  return { phase: 'out', level: 1 - p * p * (3 - 2 * p) };
}

/** The n-th thought of the deterministic schedule (word cycle, golden-angle directions, varying closeness). */
export function makeThought(n: number, born: number, cfg: SammlungConfig): Thought {
  const angle = (n * 2.399963 + 0.7) % (Math.PI * 2);
  const miss = ((((n * 37) % 7) - 3) / 3) * 0.3;
  const speed = cfg.thoughtSpeed * (1 + 0.12 * ((n * 5) % 3));
  return { id: `g${n}`, word: THOUGHT_WORDS[n % THOUGHT_WORDS.length], born, angle, miss, speed };
}

/** Position of a thought at time t, or null once it has drifted out again. */
export function thoughtPos(th: Thought, t: number): { x: number; y: number } | null {
  const travelled = (t - th.born) * th.speed;
  if (travelled < 0 || travelled > THOUGHT_START_RADIUS * 2) return null;
  const cx = Math.cos(th.angle), cy = Math.sin(th.angle);
  // Start on the far circle, travel through the centre region (offset by `miss` along the perpendicular).
  const sx = cx * THOUGHT_START_RADIUS - cy * th.miss;
  const sy = cy * THOUGHT_START_RADIUS + cx * th.miss;
  return { x: sx - cx * travelled, y: sy - cy * travelled };
}

/** Difficulty grows a little with every calm breath; the assist eases it after the light slipped away a few times. */
export function pullScale(s: Pick<SammlungState, 'calm' | 'stats'>): number {
  return (1 + 0.25 * s.calm) * Math.pow(0.85, Math.min(s.stats.lost, 4));
}

/** Combined pull of all thoughts on the light (units per second). */
export function pullAt(s: SammlungState, cfg: SammlungConfig): { x: number; y: number } {
  let px = 0, py = 0;
  const scale = cfg.pull * pullScale(s);
  for (const th of s.thoughts) {
    const p = thoughtPos(th, s.t);
    if (!p) continue;
    const dx = p.x - s.x, dy = p.y - s.y;
    const d = Math.hypot(dx, dy);
    if (d >= cfg.pullRadius || d < 1e-6) continue;
    const grip = s.grip && s.grip.id === th.id && s.t < s.grip.until ? cfg.gripFactor : 1;
    const f = scale * grip * (1 - d / cfg.pullRadius);
    px += (dx / d) * f;
    py += (dy / d) * f;
  }
  return { x: px, y: py };
}

function steerVector(s: SammlungState, input: SammlungInput): { x: number; y: number } {
  if (input.target) {
    const dx = input.target.x - s.x, dy = input.target.y - s.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.02) return { x: 0, y: 0 };
    const k = Math.min(1, d / 0.18) / d;
    return { x: dx * k, y: dy * k };
  }
  const dx = Math.max(-1, Math.min(1, input.dx ?? 0)), dy = Math.max(-1, Math.min(1, input.dy ?? 0));
  const m = Math.hypot(dx, dy);
  return m > 1 ? { x: dx / m, y: dy / m } : { x: dx, y: dy };
}

/** Advances the exercise by dt seconds. Returns the new state and what happened (for sound and feedback). */
export function sammlungStep(s0: SammlungState, dt: number, input: SammlungInput, cfg: SammlungConfig): { state: SammlungState; events: SammlungEvent[] } {
  if (s0.done || dt <= 0) return { state: s0, events: [] };
  const events: SammlungEvent[] = [];
  const s: SammlungState = { ...s0, stats: { ...s0.stats }, thoughts: s0.thoughts.slice() };
  s.t += dt;

  // Breath clock.
  const before = breathAt(s.bt, cfg).phase;
  s.bt += dt;
  const cycle = cycleLength(cfg);
  if (s.bt >= cycle) { s.bt -= cycle; s.used = false; }
  const now = breathAt(s.bt, cfg).phase;
  if (before === 'in' && now === 'full' && !s.used) events.push('full');
  if (before === 'full' && now !== 'full' && !s.used) { s.stats.missed++; s.used = true; events.push('missed'); }

  // Thoughts: spawn on schedule, forget the ones that drifted out.
  while (s.t >= s.nextSpawn) {
    s.thoughts.push(makeThought(s.spawned, s.nextSpawn, cfg));
    s.spawned++;
    s.nextSpawn += cfg.spawnEvery * (1 - 0.15 * Math.min(s.calm, 2));
    events.push('spawn');
  }
  s.thoughts = s.thoughts.filter(th => thoughtPos(th, s.t) !== null);
  if (s.grip && (s.t >= s.grip.until || !s.thoughts.some(th => th.id === s.grip!.id))) { s.grip = null; events.push('released'); }

  // Light: steering plus the pull of nearby thoughts.
  const v = steerVector(s, input);
  const pull = pullAt(s, cfg);
  s.x += (v.x * cfg.steer + pull.x) * dt;
  s.y += (v.y * cfg.steer + pull.y) * dt;
  if (Math.hypot(s.x, s.y) > cfg.outerRadius) {
    // The light slipped away: gather anew. The calm breaths stay, only this breath and some time are lost.
    s.stats.lost++;
    s.x = 0; s.y = 0; s.bt = 0; s.used = false; s.grip = null;
    s.thoughts = [];
    s.nextSpawn = s.t + 1.2;
    events.push('lost');
  }
  return { state: s, events };
}

/** Lia lets the breath go (E / Space / Enter / tap / button). */
export function sammlungConfirm(s0: SammlungState, cfg: SammlungConfig): { state: SammlungState; result: ConfirmResult } {
  if (s0.done || s0.used) return { state: s0, result: 'ignored' };
  const { phase } = breathAt(s0.bt, cfg);
  const s: SammlungState = { ...s0, stats: { ...s0.stats } };
  if (phase === 'out') return { state: s0, result: 'late' };
  s.used = true;
  s.bt = cfg.inhale + cfg.full; // the ring sinks: exhale
  if (phase === 'in') { s.stats.early++; return { state: s, result: 'early' }; }
  if (Math.hypot(s.x, s.y) > cfg.calmRadius) { s.stats.restless++; return { state: s, result: 'restless' }; }
  s.calm++;
  if (s.calm >= cfg.breaths) { s.done = true; return { state: s, result: 'done' }; }
  return { state: s, result: 'calm' };
}

/** Lia grabs a thought instead of letting it pass: it pulls much harder for a while. */
export function sammlungGrab(s0: SammlungState, id: string, cfg: SammlungConfig): { state: SammlungState; word: string | null } {
  if (s0.done) return { state: s0, word: null };
  const th = s0.thoughts.find(x => x.id === id);
  if (!th || !thoughtPos(th, s0.t)) return { state: s0, word: null };
  return {
    state: { ...s0, grip: { id, until: s0.t + cfg.gripSeconds }, stats: { ...s0.stats, held: s0.stats.held + 1 }, heldWords: [...s0.heldWords, th.word] },
    word: th.word,
  };
}

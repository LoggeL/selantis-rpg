/** Small scene interactions. Story gestures have no timer or failure; stealth retries only the current beat. */
export type StoryActionKind = 'reach' | 'lift' | 'open-eyes' | 'tend' | 'bellows';
export type StealthKind = 'cover' | 'duck' | 'listen';

export interface StoryMotion { position: number; strokes: number }
export const storyTargets = (kind: StoryActionKind): readonly number[] => {
  switch (kind) {
    case 'lift': case 'open-eyes': return [0];
    case 'tend': return [1, 0, 1];
    case 'bellows': return [1, 0, 1, 0, 1, 0];
    default: return [1];
  }
};
export const storyStart = (kind: StoryActionKind): StoryMotion => ({ position: storyTargets(kind)[0] === 0 ? 1 : 0, strokes: 0 });
export function storyMove(s: StoryMotion, kind: StoryActionKind, position: number): StoryMotion {
  const targets = storyTargets(kind);
  if (s.strokes >= targets.length) return s;
  const target = targets[s.strokes];
  const p = Math.max(0, Math.min(1, position));
  return { position: p, strokes: s.strokes + (Math.abs(p - target) < 0.025 ? 1 : 0) };
}

export interface StealthState {
  position: number;
  round: number;
  time: number;
  mistakes: number;
  done: boolean;
}
export const stealthStart = (kind: StealthKind): StealthState => ({ position: kind === 'duck' ? 0.18 : 0.5, round: 0, time: 0, mistakes: 0, done: false });
export const stealthRounds = (kind: StealthKind): number => kind === 'duck' ? 3 : 2;
export const stealthTarget = (kind: StealthKind, round: number): number => kind === 'duck' ? (round === 1 ? 0.18 : 0.82) : (round % 2 === 0 ? 0.2 : 0.8);
export const stealthTiming = (kind: StealthKind) => kind === 'duck'
  ? { prepare: 1.35, danger: 0.6 }
  : kind === 'listen' ? { prepare: 2.1, danger: 1.15 } : { prepare: 2.1, danger: 0.85 };
export function stealthPhase(s: StealthState, kind: StealthKind): 'move' | 'danger' | 'retry' | 'done' {
  if (s.done) return 'done';
  if (s.time < 0) return 'retry';
  return s.time < stealthTiming(kind).prepare ? 'move' : 'danger';
}
export function stealthSafe(s: StealthState, kind: StealthKind): boolean {
  return Math.abs(s.position - stealthTarget(kind, s.round)) < (kind === 'duck' ? 0.19 : 0.13);
}

/** direction is -1/0/1. A pointer supplies a position instead. No input changes progress during a paused frame. */
export function stealthStep(s: StealthState, kind: StealthKind, dt: number, direction: number, pointer?: number): { state: StealthState; event: 'noise' | 'safe' | null } {
  if (s.done || dt <= 0) return { state: s, event: null };
  const position = Math.max(0.06, Math.min(0.94, pointer ?? s.position + direction * dt * 0.85));
  const time = s.time + dt;
  const next = { ...s, position, time };
  const phase = stealthPhase(next, kind);
  const moved = Math.abs(position - s.position) > 0.0001;
  if (phase === 'danger' && (!stealthSafe(next, kind) || (kind === 'cover' && moved))) {
    return { state: { ...next, time: -0.7, mistakes: s.mistakes + 1 }, event: 'noise' };
  }
  const timing = stealthTiming(kind);
  if (time >= timing.prepare + timing.danger) {
    const round = s.round + 1;
    return { state: { ...next, time: 0, round, done: round >= stealthRounds(kind) }, event: 'safe' };
  }
  return { state: next, event: null };
}

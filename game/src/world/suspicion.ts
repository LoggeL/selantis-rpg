export type SuspicionLevel = 'calm' | 'suspicious' | 'alert';

export interface SuspicionState {
  value: number;           // 0..1
  level: SuspicionLevel;
  /** Seconds since the target was last seen (decay starts after `memory`). */
  unseen: number;
}

export interface SuspicionInput { visible: boolean; closeness: number; sneaking?: boolean; running?: boolean; dt: number }

export interface SuspicionConfig {
  /** Seconds to fill the meter at mid range (closeness 0.5). */
  reaction: number;
  /** Units per second of decay once memory expired. */
  decay: number;
  /** Seconds the guard keeps the suspicion before it starts to decay. */
  memory: number;
  suspiciousAt: number;
  calmBelow: number;
}

export const DEFAULT_SUSPICION: SuspicionConfig = { reaction: 1.3, decay: 0.35, memory: 1.2, suspiciousAt: 0.2, calmBelow: 0.05 };

export function newSuspicion(): SuspicionState { return { value: 0, level: 'calm', unseen: 99 }; }

/** Rise rate per second for the given exposure. Closer = much faster; sneaking slower; running faster. */
export function riseRate(closeness: number, cfg: SuspicionConfig, sneaking?: boolean, running?: boolean): number {
  const base = 1 / cfg.reaction;
  const near = 0.35 + 1.3 * closeness * closeness + 0.6 * closeness; // 0.35 at edge, 1 at ~0.5, 2.25 at 1
  return base * near * (sneaking ? 0.6 : 1) * (running ? 1.4 : 1);
}

/**
 * Advances the suspicion meter one step. Returns events: 'suspicious' when crossing into ?, 'alert' when full,
 * 'calm' when it calmed down again. Once alert it stays alert (the caller resets after handling).
 */
export function stepSuspicion(s: SuspicionState, input: SuspicionInput, cfg: SuspicionConfig = DEFAULT_SUSPICION): ('suspicious' | 'alert' | 'calm')[] {
  const events: ('suspicious' | 'alert' | 'calm')[] = [];
  if (s.level === 'alert') return events;
  if (input.visible) {
    s.unseen = 0;
    s.value = Math.min(1, s.value + riseRate(input.closeness, cfg, input.sneaking, input.running) * input.dt);
  } else {
    s.unseen += input.dt;
    if (s.unseen > cfg.memory) s.value = Math.max(0, s.value - cfg.decay * input.dt);
  }
  if (s.value >= 1) { s.level = 'alert'; events.push('alert'); }
  else if (s.level === 'calm' && s.value >= cfg.suspiciousAt) { s.level = 'suspicious'; events.push('suspicious'); }
  else if (s.level === 'suspicious' && s.value <= cfg.calmBelow) { s.level = 'calm'; events.push('calm'); }
  return events;
}

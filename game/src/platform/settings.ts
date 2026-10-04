
export type GameSettings = Readonly<{
  musicVolume: number;
  effectsVolume: number;
  reducedMotion: boolean;
  particles: boolean;
}>;

const STORAGE_KEY = 'selantis.settings.v1';
const defaults: GameSettings = {
  musicVolume: 0.45,
  effectsVolume: 0.65,
  reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  particles: true,
};

function normalize(value: unknown, base: GameSettings): GameSettings {
  const result = { ...base };
  if (!value || typeof value !== 'object') return Object.freeze(result);
  const input = value as Record<string, unknown>;
  for (const key of ['musicVolume', 'effectsVolume'] as const) {
    const v = input[key];
    if (typeof v === 'number' && Number.isFinite(v)) result[key] = Math.max(0, Math.min(1, v));
  }
  for (const key of ['reducedMotion', 'particles'] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key];
  }
  return Object.freeze(result);
}

function load(): GameSettings {
  try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'), defaults); }
  catch { return Object.freeze({ ...defaults }); }
}

let current = load();
const listeners = new Set<(settings: GameSettings) => void>();
export const getSettings = (): GameSettings => current;
export function updateSettings(patch: Partial<GameSettings>): GameSettings {
  const next = normalize(patch, current);
  if (Object.keys(next).every((key) => next[key as keyof GameSettings] === current[key as keyof GameSettings])) return current;
  current = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* Private mode and full storage remain playable. */ }
  for (const listener of listeners) { try { listener(current); } catch { /* One stale scene must not interrupt other listeners. */ } }
  return current;
}
export function subscribeSettings(listener: (settings: GameSettings) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => { listeners.delete(listener); };
}
export const motionDuration = (ms: number): number => current.reducedMotion ? 0 : ms;
export const ambientPrefs = () => ({ reducedMotion: current.reducedMotion, particles: current.particles && !current.reducedMotion });

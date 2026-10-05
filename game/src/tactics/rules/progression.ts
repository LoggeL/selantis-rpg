import type { BattleEvent, CombatStats, Unit, UnitSpec } from './types';

export const EXP_PER_LEVEL = 100;
export const MAX_LEVEL = 50;
export const AP_TO_MASTER = 50;

export function characterLevel(level = 1): number {
  return Number.isFinite(level) ? Math.max(1, Math.min(MAX_LEVEL, Math.floor(level))) : 1;
}

function growthBetween(from: number, to: number): CombatStats {
  const a = characterLevel(from) - 1, b = characterLevel(to) - 1;
  return {
    maxHp: (b - a) * 3, maxMp: (b - a) * 2, atk: b - a,
    def: Math.floor(b / 2) - Math.floor(a / 2),
    speed: Math.floor(b / 5) - Math.floor(a / 5),
  };
}

/** The same curve supplies starting stats, restored saves and in-battle level growth. */
export function statsAtLevel(base: CombatStats, level: number): CombatStats {
  const gain = growthBetween(1, level);
  return {
    maxHp: base.maxHp + gain.maxHp, maxMp: base.maxMp + gain.maxMp,
    atk: base.atk + gain.atk, def: base.def + gain.def, speed: base.speed + gain.speed,
  };
}

export interface CharacterProgress {
  level: number;
  exp: number;
  weapon: string | null;
  mastered: string[];
  abilityAp: Record<string, number>;
}

export interface WeaponDef { id: string; name: string; skills: string[] }
export const WEAPONS: Record<string, WeaponDef> = {
  lichtfokus: { id: 'lichtfokus', name: 'Lichtfokus', skills: ['handstoss', 'strahl', 'druckwelle', 'schutzwall'] },
  kurzschwerter: { id: 'kurzschwerter', name: 'Zwei Kurzschwerter', skills: ['doppelhieb', 'tritt'] },
  schwert: { id: 'schwert', name: 'Schwert', skills: ['schwerthieb'] },
  speer: { id: 'speer', name: 'Speer', skills: ['speerstoss'] },
  armbrust: { id: 'armbrust', name: 'Armbrust', skills: ['bolzen'] },
  axt: { id: 'axt', name: 'Streitaxt', skills: ['axthieb', 'wuchtschlag'] },
  vatersdolch: { id: 'vatersdolch', name: 'Vaters Dolch', skills: ['dolch'] },
  jagdbogen: { id: 'jagdbogen', name: 'Jagdbogen', skills: ['bogen'] },
  jagdmesser: { id: 'jagdmesser', name: 'Jagdmesser', skills: ['messer'] },
};

/** Derive starting equipment from authored skills without giving characters weapons they do not own. */
export function withEquipment(spec: UnitSpec): UnitSpec {
  const weapons = spec.weapons ?? Object.values(WEAPONS)
    .filter(w => w.skills.some(id => spec.abilities.includes(id))).map(w => w.id);
  return { ...spec, weapons, weapon: spec.weapon ?? weapons[0] };
}

export function skillAvailable(u: Unit, id: string): boolean {
  const weaponSkill = Object.values(WEAPONS).some(w => w.skills.includes(id));
  return !weaponSkill || u.innate.includes(id) || u.mastered.includes(id) || !!u.weapon && WEAPONS[u.weapon]?.skills.includes(id);
}

/** Untrusted save data is clamped; malformed records cannot corrupt battle stats. */
export function normalizeProgress(raw: unknown): CharacterProgress {
  const p = raw && typeof raw === 'object' ? raw as Partial<CharacterProgress> : {};
  const integer = (n: unknown, fallback: number, min: number, max: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
  const level = integer(p.level, 1, 1, MAX_LEVEL);
  const abilityAp: Record<string, number> = {};
  if (p.abilityAp && typeof p.abilityAp === 'object') for (const [id, ap] of Object.entries(p.abilityAp)) {
    if (/^[a-z0-9-]+$/.test(id)) abilityAp[id] = integer(ap, 0, 0, AP_TO_MASTER);
  }
  return {
    level, exp: level === MAX_LEVEL ? 0 : integer(p.exp, 0, 0, EXP_PER_LEVEL - 1),
    weapon: typeof p.weapon === 'string' && Object.hasOwn(WEAPONS, p.weapon) ? p.weapon : null,
    mastered: Array.isArray(p.mastered) ? [...new Set(p.mastered.filter((id): id is string => typeof id === 'string' && Object.values(WEAPONS).some(w => w.skills.includes(id))))] : [],
    abilityAp,
  };
}

export function progressOf(u: Unit): CharacterProgress {
  return { level: u.level, exp: u.exp, weapon: u.weapon, mastered: [...u.mastered], abilityAp: { ...u.abilityAp } };
}

export function restoreProgress(spec: UnitSpec, saved?: CharacterProgress): UnitSpec {
  const equipped = withEquipment(spec);
  if (!saved) return equipped;
  const p = normalizeProgress(saved);
  const baseLevel = characterLevel(spec.level);
  const level = Math.max(baseLevel, p.level);
  const gain = growthBetween(baseLevel, level);
  const restored = {
    ...equipped, level, exp: level === MAX_LEVEL ? 0 : p.exp,
    weapon: p.weapon && equipped.weapons?.includes(p.weapon) ? p.weapon : equipped.weapon,
    mastered: p.mastered, abilityAp: p.abilityAp,
  };
  if (spec.baseStats) return {
    ...restored,
    hp: spec.hp === undefined ? undefined : spec.hp + gain.maxHp,
    mp: spec.mp === undefined ? undefined : spec.mp + gain.maxMp,
  };
  // Older custom encounters author absolute stats at their starting level.
  return {
    ...restored,
    hp: (spec.hp ?? spec.maxHp ?? 10) + gain.maxHp,
    maxHp: (spec.maxHp ?? spec.hp ?? 10) + gain.maxHp,
    mp: spec.mp === undefined ? undefined : spec.mp + gain.maxMp,
    maxMp: (spec.maxMp ?? spec.mp ?? 24) + gain.maxMp,
    atk: (spec.atk ?? 2) + gain.atk, def: (spec.def ?? 0) + gain.def,
    speed: (spec.speed ?? 5) + gain.speed,
  };
}

/** One award per action, regardless of its number of strikes or targets. */
export function awardProgress(u: Unit, exp: number, ap = 0): BattleEvent[] {
  if (u.team === 'enemy') return [];
  const events: BattleEvent[] = [];
  if (exp > 0 && u.level < MAX_LEVEL) {
    u.exp += exp;
    events.push({ type: 'exp', unit: u.id, amount: exp });
    while (u.exp >= EXP_PER_LEVEL && u.level < MAX_LEVEL) {
      u.exp -= EXP_PER_LEVEL;
      const gain = growthBetween(u.level, u.level + 1);
      u.level++;
      u.maxHp += gain.maxHp; u.maxMp += gain.maxMp; u.atk += gain.atk;
      // Increasing maxima preserves missing HP/MP and never revives a downed character.
      if (!u.down) { u.hp += gain.maxHp; u.mp += gain.maxMp; }
      u.def += gain.def; u.speed += gain.speed;
      events.push({ type: 'level', unit: u.id, level: u.level });
    }
    if (u.level === MAX_LEVEL) u.exp = 0;
  }
  if (ap > 0 && u.weapon) for (const id of WEAPONS[u.weapon].skills) {
    if (u.mastered.includes(id)) continue;
    u.abilityAp[id] = Math.min(AP_TO_MASTER, (u.abilityAp[id] ?? 0) + ap);
    if (u.abilityAp[id] === AP_TO_MASTER) {
      u.mastered.push(id);
      events.push({ type: 'master', unit: u.id, ability: id });
    }
  }
  return events;
}

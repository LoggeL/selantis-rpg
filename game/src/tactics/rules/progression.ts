import type { BattleEvent, Unit, UnitSpec } from './types';

export const EXP_PER_LEVEL = 100;
export const MAX_LEVEL = 50;
export const AP_TO_MASTER = 50;

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
  const baseLevel = spec.level ?? 1;
  const level = Math.max(baseLevel, p.level);
  const levels = level - baseLevel;
  return {
    ...equipped, level, exp: p.exp,
    hp: spec.hp + levels * 3, maxHp: (spec.maxHp ?? spec.hp) + levels * 3,
    maxMp: (spec.maxMp ?? spec.mp ?? 24) + levels * 2,
    atk: (spec.atk ?? 2) + levels,
    def: (spec.def ?? 0) + Math.floor((level - 1) / 2) - Math.floor((baseLevel - 1) / 2),
    speed: (spec.speed ?? 5) + Math.floor((level - 1) / 5) - Math.floor((baseLevel - 1) / 5),
    weapon: p.weapon && equipped.weapons?.includes(p.weapon) ? p.weapon : equipped.weapon,
    mastered: p.mastered, abilityAp: p.abilityAp,
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
      u.exp -= EXP_PER_LEVEL; u.level++;
      u.maxHp += 3; u.maxMp += 2; u.atk++;
      // Increasing maxima preserves missing HP/MP and never revives a downed character.
      if (!u.down) { u.hp += 3; u.mp += 2; }
      if (u.level % 2 === 1) u.def++;
      if (u.level % 5 === 1) u.speed++;
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

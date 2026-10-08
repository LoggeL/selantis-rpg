// Teil III: what both battles (e3-ritualangriff, e3-vamir-duell) share. Lia herself is built by common/liaKit (Vaters
// Dolch as her attack, Verzweiflung, specials from the campaign state); this file adds what Teil III changes about her:
// the own staff (Stabstrahl, appended only while she really carries it), Schattentöter only while she holds it, the
// poison on her pools, plus once-only progression and a few engine bridges. tactics/** is read-only for this chapter,
// so everything the BattleCtx cannot do (respawning a unit with a new look or team, coloured flares, blood, a stand
// prop falling over) is done here, defensively (docs/teil-3/adaption.md).
import { G } from '../../core/G';
import type { BattleCtx, BattleDef, BattleUnitDef } from '../../tactics/api';
import type { AbilityDef, Unit } from '../../tactics/rules/types';
import { STAFF } from '../common/bookContract';
import { settings } from '../../core/settings';
import type { LiaKitOptions } from '../common/liaKit';
import { BLOOD_RED } from '../common/blood';
import { POISON_FACTOR, hasOwnStaff, poisoned, sfx } from './shared';

/** The dark centre of a battle pool (the world scenes use the shared prop of common/blood.ts). */
const BLOOD_DARK = 0x4a0d12;

/**
 * Spiel-Design (docs/teil-3/adaption.md): Lia's narrow beam from the tip of her own staff. Fixed damage, so it pierces
 * armour and Vamir's violet shield alike. Only offered while Lia really carries the staff (inventory e3-lia-staff).
 */
export const STABSTRAHL: AbilityDef = {
  id: 'e3-stabstrahl', name: 'Stabstrahl', kind: 'magic', target: 'enemy', range: [1, 4], shape: { type: 'single' },
  power: 0, fixedDamage: 6, accuracy: 95, cooldown: 2, mpCost: 4, needsLine: true, ignoresCover: true, vfx: 'beam',
  description: 'Ein schmaler, heller Strahl aus der Spitze ihres eigenen Stabs. Ein Ziel, bis vier Felder weit. Dringt durch Rüstung und Schilde.',
};

/** What Lia can use in a Teil-III battle, read from the campaign state at the battle's start. */
export interface LiaKit {
  /** Lia carries her own staff (e3-lia-staff in the inventory). */
  ownStaff: boolean;
  /** Lia still carries Schattentöter (e2-schattentoeter) and knows the Stabimpuls. */
  schattentoeter: boolean;
  lichtstoss: boolean;
  poisoned: boolean;
}

export function liaKitFromState(): LiaKit {
  return {
    ownStaff: hasOwnStaff(),
    schattentoeter: G.state.has(STAFF.borrowed) && G.state.knows('e2-stabimpuls'),
    lichtstoss: G.state.knows('lichtstoss'),
    poisoned: poisoned(),
  };
}

/**
 * liaKit options for a Teil-III battle: Schattentöter and Lichtstoß from the kit, the Stabstrahl appended only with the
 * own staff (`ownStaff` overrides the kit, e.g. right after Flick hands it back), and the poison as starting HP share.
 * applyPoison() then caps her maxima in onStart, so no healing in the battle undoes the poison.
 */
export function liaOptions(kit: LiaKit, ownStaff = kit.ownStaff): LiaKitOptions {
  return {
    state: { lichtstoss: kit.lichtstoss, staff: kit.schattentoeter },
    extra: ownStaff ? [STABSTRAHL.id] : [],
    ...(kit.poisoned ? { hpFraction: POISON_FACTOR } : {}),
  };
}

/**
 * Pools after the poison: maximum and current HP/MP shrink to POISON_FACTOR, rounded down like the engine's hpFraction
 * (never below 1 HP).
 */
export function poisonedPools(u: Pick<Unit, 'maxHp' | 'maxMp' | 'hp' | 'mp'>, factor = POISON_FACTOR): Pick<Unit, 'maxHp' | 'maxMp' | 'hp' | 'mp'> {
  const maxHp = Math.max(1, Math.floor(u.maxHp * factor));
  const maxMp = Math.max(0, Math.floor(u.maxMp * factor));
  return { maxHp, maxMp, hp: Math.max(1, Math.min(u.hp, maxHp)), mp: Math.min(u.mp, maxMp) };
}

/**
 * Applies the poison to Lia's unit after the campaign level was restored (the spec cannot know the saved level).
 * Called once from onStart, before the first turn (respawn() later carries the pools over).
 */
export function applyPoison(u: Unit | undefined, isPoisoned: boolean): void {
  if (!u || !isPoisoned) return;
  Object.assign(u, poisonedPools(u));
}

/** Zero rewards once the battle was won before (reload, replay); `first` otherwise. */
export function onceProgression(won: boolean, ids: string[], first: NonNullable<BattleDef['progression']>): NonNullable<BattleDef['progression']> {
  if (!won) return first;
  return { actionExp: 0, defeatExp: 0, actionAp: 0, victoryExp: 0, victoryAp: 0, budgets: Object.fromEntries(ids.map(id => [id, { exp: 0, ap: 0 }])) };
}

/** A generated character sheet if the asset lane delivered it, else the fallback (never a placeholder figure). */
export function look(id: string, fallback: string): string {
  try { return G.art.hasAsset('character', id) ? id : fallback; } catch { return fallback; }
}

export function hasPlate(id: string): boolean {
  try { return G.art.hasAsset('plate', id); } catch { return false; }
}

// ---------------------------------------------------------------------------------------------------------------
// Engine bridges (BattleCtx has no API for these; see report in docs/teil-3/adaption.md)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Removes a unit and spawns it again from `def` on the same tile, keeping level, EXP, pools and cooldowns of the old
 * one. Used for a new look (Lia with her staff), a team change (Kyra's ban breaks) and Vamir's teleport (`at`).
 * `keepTurn` leaves the new unit able to act in the current phase (spawned units arrive exhausted otherwise).
 */
export async function respawn(ctx: BattleCtx, def: BattleUnitDef, opts: { at?: { x: number; y: number }; keepPools?: boolean; keepTurn?: boolean } = {}): Promise<Unit | undefined> {
  const old = ctx.unit(def.id);
  const at = opts.at ?? (old && old.x > -50 ? { x: old.x, y: old.y } : { x: def.x, y: def.y });
  if (old && old.x > -50) await ctx.remove(def.id);
  await ctx.spawn({ ...def, x: at.x, y: at.y, facing: old?.facing ?? def.facing });
  const u = ctx.unit(def.id);
  if (!u || u.down) return u;
  if (old && opts.keepPools !== false) {
    Object.assign(u, {
      level: old.level, exp: old.exp, maxHp: old.maxHp, maxMp: old.maxMp, hp: old.hp, mp: old.mp, atk: old.atk, def: old.def,
      speed: old.speed, mastered: [...old.mastered], abilityAp: { ...old.abilityAp }, cooldowns: { ...old.cooldowns },
    });
  }
  if (opts.keepTurn && old && !old.acted) { u.acted = false; u.moved = old.moved; }
  return u;
}

interface TacticsUnitView {
  feet: { x: number; y: number };
  chest: { x: number; y: number };
  shadow: { x: number; y: number; depth: number };
  sprite: { active: boolean };
}

interface TacticsSceneView {
  fx?: {
    ring(x: number, y: number, color: number, radius: number, ms: number): Promise<void>;
    burst(x: number, y: number, opts: { color: number | number[]; count?: number; speed?: number; life?: number; gravity?: number; texture?: string; scale?: number }): void;
  };
  views?: Map<string, TacticsUnitView>;
  props?: { img: { angle: number; setTint(c: number): unknown }; x: number; y: number; rules: boolean }[];
  tweens?: { add(cfg: Record<string, unknown>): unknown };
  add?: { graphics(): { fillStyle(c: number, a: number): unknown; fillEllipse(x: number, y: number, w: number, h: number): unknown; setPosition(x: number, y: number): unknown; setDepth(d: number): unknown; setScale(sx: number, sy?: number): unknown; setAlpha(a: number): unknown; destroy(): void; active: boolean } };
  events?: { on(e: string, fn: () => void): unknown; off(e: string, fn: () => void): unknown };
  cameras?: { main: { flash(ms: number, r: number, g: number, b: number, force?: boolean): unknown } };
}

function tacticsScene(): TacticsSceneView | null {
  try { return G.game.scene.getScene('Tactics') as unknown as TacticsSceneView; } catch { return null; }
}

/**
 * Coloured ring and sparks at a unit (Vamir's cold violet, the Urmacht's turquoise). The engine's magic effects are
 * all turquoise, so violet is only possible through this best-effort bridge; it silently does nothing if the scene
 * internals change.
 */
export function flare(unit: string, color: number, radius = 30): void {
  try {
    const s = tacticsScene();
    const v = s?.views?.get(unit);
    if (!s?.fx || !v) return;
    void s.fx.ring(v.feet.x, v.feet.y, color, radius, 460);
    s.fx.burst(v.chest.x, v.chest.y, { color: [color, 0xffffff], count: 12, speed: 46, life: 520, gravity: -20 });
  } catch { /* visual only */ }
}

/** Tips the decorative stand prop on a tile over (all its images; best effort, the rules never depend on it). */
export function tipProp(x: number, y: number): void {
  try {
    const s = tacticsScene();
    const parts = s?.props?.filter(q => q.x === x && q.y === y && !q.rules) ?? [];
    if (!parts.length || !s?.tweens) return;
    for (const p of parts) {
      p.img.setTint(0x8a7a6a);
      s.tweens.add({ targets: p.img, angle: x % 2 ? 78 : -78, duration: 420, ease: 'Quad.easeIn' });
    }
  } catch { /* visual only */ }
}

/**
 * Blood in the battle where the story looks at a fall (docs/teil-3/umsetzung.md, Vorrang (1)): a short dark red
 * camera flash, the hit sound and droplets from the chest; with `pool` a dark stain spreads under the figure and follows
 * its view (camera rotation, small hops) until the view is gone. `hit: false` only lets the pool spread (someone who
 * was struck before the battle). Best effort through the scene internals, like flare().
 */
export function battleBlood(unit: string, opts: { pool?: boolean; strength?: number; hit?: boolean } = {}): void {
  const strength = opts.strength ?? 1;
  const hit = opts.hit !== false;
  if (hit) sfx('hit-heavy', { volume: 0.5 + 0.3 * strength });
  try {
    const s = tacticsScene();
    const v = s?.views?.get(unit);
    if (!s || !v) return;
    if (hit && !settings.reducedMotion) s.cameras?.main.flash(150, (BLOOD_RED >> 16) & 255, (BLOOD_RED >> 8) & 255, BLOOD_RED & 255, true);
    if (hit) s.fx?.burst(v.chest.x, v.chest.y, { color: [BLOOD_RED, BLOOD_DARK], count: Math.round(6 + 8 * strength), speed: 52, life: 560, gravity: 240, texture: 'tac-dot', scale: 0.9 });
    if (!opts.pool || !s.add || !s.events || !s.tweens) return;
    const g = s.add.graphics();
    g.fillStyle(BLOOD_DARK, 0.85);
    g.fillEllipse(0, 0, 30, 11);
    g.fillEllipse(-9, 2, 15, 7);
    g.fillEllipse(10, -1, 14, 6);
    g.fillStyle(BLOOD_RED, 0.5);
    g.fillEllipse(-2, -1, 16, 5);
    g.setScale(0.15 * strength);
    const events = s.events;
    const follow = () => {
      if (!v.sprite.active || !g.active) { events.off('postupdate', follow); if (g.active) g.destroy(); return; }
      g.setPosition(v.shadow.x, v.shadow.y + 1);
      g.setDepth(v.shadow.depth + 0.5);
    };
    follow();
    events.on('postupdate', follow);
    s.tweens.add({ targets: g, scaleX: strength, scaleY: strength, duration: 1800, ease: 'Sine.easeOut' });
  } catch { /* visual only */ }
}

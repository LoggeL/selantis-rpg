// Lia's battle unit, built from the campaign state in one place (all her battles use it).
// Her basic attack is always Vaters Dolch. Specials follow what she has learned and carries: Stein werfen always,
// Versorgen with Mutters Wundtinktur, Ausweichen/Ablenken after Foltan's lesson (K4), Lichtstoß once known, the
// Stabimpuls only while she holds Schattentöter. Every battle she fights comes after the attack on the farm, so her
// passive „Verzweiflung“ is always there: badly hurt, she strikes harder and more precisely.
import { G } from '../../core/G';
import type { BattleCtx, BattleHooks, BattleUnitDef, CustomTrigger } from '../../tactics/api';
import { traitActive } from '../../tactics/rules/battle';
import type { TraitDef } from '../../tactics/rules/types';
import { characterStatsAt } from './battleCharacters';

/** Grief, fear and the wish for revenge: at or below half her HP, the dagger hits harder and more often. */
export const VERZWEIFLUNG: TraitDef = {
  id: 'verzweiflung', name: 'Verzweiflung', hpAtOrBelow: 0.5, abilities: ['dolch'], power: 2, hitMod: 10,
  description: 'Seit dem Überfall auf den Hof tragen Wut und Angst Lia weiter, wenn sie fallen müsste. Ist sie schwer verletzt, sticht sie mit Vaters Dolch härter und genauer zu.',
};

/**
 * Per-battle level floor and growth limit. Saved progress above the floor is kept; the floor makes direct entries and
 * skipped optional fights consistent. EXP budgets and level caps keep the growth slow and stop farming.
 */
export const LIA_STAGES = {
  'k2-wegelagerer': { level: 1, maxLevel: 2, exp: 100, ap: 12 },
  'k3-begleitung': { level: 2, maxLevel: 3, exp: 100, ap: 12 },
  'k5-rettung': { level: 3, maxLevel: 4, exp: 100, ap: 12 },
  weiterreise: { level: 4, maxLevel: 6, exp: 70, ap: 16 },
  'e2-ueberfall': { level: 5, maxLevel: 6, exp: 40, ap: 10 },
  'e2-uebungskampf': { level: 6, maxLevel: 7, exp: 60, ap: 10 },
} as const satisfies Record<string, { level: number; maxLevel: number; exp: number; ap: number }>;
export type LiaStage = keyof typeof LIA_STAGES;

/** EXP/AP budget entry for Lia in a battle's progression. */
export function liaBudget(stage: LiaStage): { exp: number; ap: number; maxLevel: number } {
  const { exp, ap, maxLevel } = LIA_STAGES[stage];
  return { exp, ap, maxLevel };
}

/** What Lia knows and carries; read from G.state unless a battle or test passes it. */
export interface LiaKitState {
  tincture: boolean;
  ausweichen: boolean;
  ablenken: boolean;
  lichtstoss: boolean;
  /** Holds the borrowed staff Schattentöter (Teil II). */
  staff: boolean;
}

export function liaKitState(): LiaKitState {
  const s = G.state;
  return {
    tincture: s.has('tincture'), ausweichen: s.knows('ausweichen'), ablenken: s.knows('ablenken'),
    lichtstoss: s.knows('lichtstoss'), staff: s.has('e2-schattentoeter'),
  };
}

export interface LiaKitOptions {
  /** Starting HP as a fraction of her max HP after saved progress, rounded down (the raid: exhausted, half HP). */
  hpFraction?: number;
  /** false: the Urmacht is silent (no Lichtstoß, no Stabimpuls). */
  light?: boolean;
  /** Forces Schattentöter on (the training battle hands it to her) or off. */
  staff?: boolean;
  /** Battle-only actions appended at the end (e.g. cutting Kyra's rope). */
  extra?: string[];
  /** Overrides of the state read from G.state. */
  state?: Partial<LiaKitState>;
}

/**
 * Lia's specials (her basic attack, the dagger, comes from the weapon and is not listed here). The order keeps the
 * digit hotkeys stable: magic first, then Ausweichen (1 in the rescue), Ablenken, Stein, Versorgen, battle extras.
 */
export function liaAbilities(opts: LiaKitOptions = {}): string[] {
  const s = { ...liaKitState(), ...opts.state };
  const light = opts.light !== false;
  const staff = light && (opts.staff ?? s.staff);
  return [
    ...(staff ? ['e2-stabimpuls'] : []),
    ...(light && s.lichtstoss ? ['lichtstoss'] : []),
    ...(s.ausweichen ? ['ausweichen'] : []),
    ...(s.ablenken ? ['ablenken'] : []),
    'steinwurf',
    ...(s.tincture ? ['versorgen'] : []),
    ...(opts.extra ?? []),
  ];
}

/** Lia's unit for a battle stage; `unit` sets position and per-battle looks (title, preset, tags …). */
export function liaUnit(stage: LiaStage, unit: Partial<BattleUnitDef> & Pick<BattleUnitDef, 'x' | 'y'>, opts: LiaKitOptions = {}): BattleUnitDef {
  return {
    id: 'lia', name: 'Lia', team: 'player', facing: 'e', move: 4, jump: 2,
    ...characterStatsAt('lia', LIA_STAGES[stage].level),
    // Resolved by the engine against her final max HP, so saved levels above the floor still start at half.
    ...(opts.hpFraction === undefined ? {} : { hpFraction: opts.hpFraction }),
    weapons: ['vatersdolch'], weapon: 'vatersdolch',
    abilities: liaAbilities(opts), traits: [VERZWEIFLUNG],
    preset: 'lia-cloak', portrait: 'lia-cloak',
    ...unit,
  };
}

/** Unvoiced barks the first time despair carries her in a battle; they look back at her parents. */
export const DESPAIR_BARKS = [
  'Für Mutter. Für Vater. Ich stehe wieder auf.',
  'Ihr nehmt mir nicht noch jemanden!',
  'Damals hab ich nur zugesehen. Heute nicht.',
] as const;

/** Fixed line per battle, so a retry repeats it. The first fight looks back at the farm. */
const DESPAIR_LINE: Record<string, number> = { 'k2-wegelagerer': 2, 'k3-begleitung': 0, 'k5-rettung': 1, 'e2-ueberfall': 1, 'e2-uebungskampf': 0 };

export function despairBark(battleId: string): string {
  const fixed = DESPAIR_LINE[battleId];
  if (fixed !== undefined) return DESPAIR_BARKS[fixed];
  const visit = /-(\d+)$/.exec(battleId);
  let n = visit ? Number(visit[1]) : 0;
  if (!visit) for (const ch of battleId) n += ch.charCodeAt(0);
  return DESPAIR_BARKS[n % DESPAIR_BARKS.length];
}

/** Battle flag set once Lia's despair has woken in this battle (lines meant for before it can check it). */
export const DESPAIR_FLAG = 'lia-verzweiflung';

/** True while Lia's Verzweiflung carries her (player team, at or below half HP). */
export function liaDespairs(ctx: BattleCtx): boolean {
  const u = ctx.unit('lia');
  return !!u && u.team === 'player' && u.traits.some(t => t.id === VERZWEIFLUNG.id && traitActive(u, t));
}

/** Fires once per battle when Lia's Verzweiflung becomes active. */
export function despairTrigger(): CustomTrigger {
  return {
    id: 'lia-verzweiflung',
    when: liaDespairs,
    run: ctx => {
      ctx.flag(DESPAIR_FLAG);
      ctx.bark('lia', despairBark(ctx.def.id), 2200);
    },
  };
}

/**
 * Adds Lia's despair bark to a battle's hooks. A battle with its own Lia line at half HP can pass `bark: false`, so two
 * bubbles never collide.
 */
export function withLiaHooks(hooks: BattleHooks = {}, opts: { bark?: boolean } = {}): BattleHooks {
  if (opts.bark === false) return hooks;
  return { ...hooks, triggers: [...(hooks.triggers ?? []), despairTrigger()] };
}

const TUTORIAL_FLAG = 'lia-kampf-hinweis';
export const LIA_COMBAT_HINT = 'Lias <em>Angriff</em> ist Vaters Dolch. Sie führt ihn noch unsicher: Von vorn geht mancher Stich daneben, von der Seite und von hinten trifft sie viel sicherer. '
  + 'Sinkt sie auf die Hälfte ihrer Lebenspunkte oder tiefer, packt sie die <em>Verzweiflung</em>: Dann sticht sie härter und genauer zu.';

/** The one-time tutorial for Lia's dagger and her Verzweiflung, in whichever of her battles comes first. */
export async function liaCombatHint(ctx: BattleCtx): Promise<void> {
  if (G.state.is(TUTORIAL_FLAG)) return;
  G.state.set(TUTORIAL_FLAG);
  await ctx.hint(LIA_COMBAT_HINT, { title: 'Vaters Dolch', unit: 'lia' });
}

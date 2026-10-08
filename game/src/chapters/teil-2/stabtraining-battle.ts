// Battle „e2-uebungskampf“ (docs/teil-2/umsetzung.md §3 e2-stabtraining): two ghouls (Leichenfresser) sniff along
// the hermit's brook after Lia's target practice. Lia fights with Schattentöter (Stabimpuls, plus Lichtstoß when she
// knows it) and keeps Vaters Dolch as her basic attack, plus Ausweichen, Ablenken, Stein werfen and Versorgen (kit from
// common/liaKit); Ignatius stays at her side as a non-lethal ally who only guards: he
// body-blocks for her and covers her (scripted „guarded“ status), he never strikes. Lose only when Lia falls
// („Erneut versuchen“). The progression reward is paid once: after the first win (flag e2-uebungskampf-gewonnen)
// every budget is zero, so a reload or replay cannot farm EXP.
import type { BattleCtx, BattleDef, BattleUnitDef, Point } from '../../tactics/api';
import type { AbilityDef, CombatStats } from '../../tactics/rules/types';
import { liaAbilities, liaBudget, liaCombatHint, liaUnit, withLiaHooks } from '../common/liaKit';
import { TRAVEL_ABILITIES } from '../common/travelBattles';

export const UEBUNGSKAMPF_WON = 'e2-uebungskampf-gewonnen';

/** Spiel-Design (docs/teil-2/adaption.md): Lia's small aimed impulse through the staff tip. Only with Schattentöter. */
export const STABIMPULS: AbilityDef = {
  id: 'e2-stabimpuls', name: 'Stabimpuls', kind: 'magic', target: 'enemy', range: [1, 3], shape: { type: 'single' },
  power: 5, accuracy: 90, cooldown: 2, mpCost: 4, vfx: 'palm',
  description: 'Ein kleiner, gezielter Lichtimpuls aus der Spitze von Schattentöter. Einzelziel, ein bis drei Felder weit.',
};

/** The ghouls' rusty hatchets: clumsy, but two of them add up. */
const GHULHIEB: AbilityDef = {
  id: 'e2-ghulhieb', name: 'Schartiger Hieb', kind: 'melee', target: 'enemy', range: [1, 1], shape: { type: 'single' },
  power: 2, accuracy: 90, hitMod: 5, vfx: 'slash',
  description: 'Ein ungelenker, aber wuchtiger Hieb mit einem rostigen Beil.',
};

/** Ignatius has no campaign profile (BATTLE_CHARACTERS): an old council mage who only covers his pupil here. */
const IGNATIUS: { level: number; baseStats: CombatStats } = { level: 12, baseStats: { maxHp: 20, maxMp: 12, atk: 1, def: 2, speed: 5 } };
/** Sized for Lia at level 6–7 (Teil II): she needs about three staff impulses per ghoul. */
const GHOUL: { level: number; baseStats: CombatStats } = { level: 5, baseStats: { maxHp: 12, maxMp: 0, atk: 2, def: 0, speed: 4 } };

export const UEBUNG_MAP: BattleDef['map'] = {
  ground: 'forest',
  trees: 'oak',
  height: [
    '1 1 1 1 1 0 1 1',
    '1 1 1 1 1 0 1 1',
    '1 1 1 1 1 0 1 1',
    '1 1 1 1 1 0 1 1',
    '1 1 1 1 1 0 1 1',
    '1 1 1 1 1 0 1 1',
    '1 1 1 1 1 0 1 1',
    '1 1 1 1 1 0 1 1',
  ],
  terrain: [
    'T . . . b ~ . T',
    '. . . . . ~ . .',
    '. b . . . ~ b .',
    '. . . . . : . .',
    '. . r . . : . .',
    '. . . . . ~ . r',
    'T . . b . ~ . .',
    'T T . . . ~ . T',
  ],
  paint: [
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    'd d d d d . d d',
    '. . . . d . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
  ],
  props: [
    { x: 2, y: 0, prop: 'stump' },
    { x: 3, y: 4, prop: 'stump', variant: 1 },
    { x: 7, y: 5, prop: 'rock' },
  ],
};

export const LIA_START: Point = { x: 1, y: 4 };
export const IGNATIUS_START: Point = { x: 1, y: 3 };
export const GHOUL_STARTS: Point[] = [{ x: 7, y: 2 }, { x: 6, y: 6 }];

export interface UebungSetup {
  /** Lia knows Lichtstoß (from e2-konzentration or the optional travel of book one). */
  lichtstoss: boolean;
  /** The once-only reward was already paid. */
  won: boolean;
}

/** Ignatius hands her Schattentöter for this fight, whatever the inventory says. */
const staffKit = (lichtstoss: boolean) => ({ staff: true, state: { lichtstoss } });

/** Lia's specials in the practice fight: the staff impulse first, then her own small means (the dagger stays her Angriff). */
export function liaStaffAbilities(lichtstoss: boolean): string[] {
  return liaAbilities(staffKit(lichtstoss));
}

/** EXP/AP for the first win only. */
export function uebungProgression(won: boolean): NonNullable<BattleDef['progression']> {
  if (won) return { actionExp: 0, defeatExp: 0, actionAp: 0, victoryExp: 0, victoryAp: 0, budgets: { lia: { exp: 0, ap: 0 }, ignatius: { exp: 0, ap: 0 } } };
  return { actionExp: 4, defeatExp: 8, actionAp: 1, victoryExp: 20, victoryAp: 4, budgets: { lia: liaBudget('e2-uebungskampf'), ignatius: { exp: 0, ap: 0 } } };
}

const ghoul = (id: string, at: Point): BattleUnitDef => ({
  id, name: 'Leichenfresser', team: 'enemy', ...GHOUL, x: at.x, y: at.y, facing: 'w', move: 3, jump: 2,
  abilities: ['e2-ghulhieb'], preset: 'ghoul', ai: 'melee', nonLethal: true,
  title: 'Knochenmaske, rostiges Beil. Das Licht hat ihn angelockt.',
});

export function uebungskampf(setup: UebungSetup): BattleDef {
  return {
    id: 'e2-uebungskampf',
    title: 'Am Bach des Einsiedlers',
    subtitle: 'Schattentöter',
    victoryText: 'Die Leichenfresser hinken ins Unterholz zurück. Lia steht. Der Stab auch.',
    defeatText: 'Lia ist gestürzt. Der Stabimpuls trifft auf ein bis drei Felder: Halte Abstand, weiche aus und lass Ignatius dich decken.',
    backdrop: 'forest',
    ambience: ['stream', 'birds'],
    music: 'battle',
    seed: 6215,
    map: UEBUNG_MAP,
    units: [
      liaUnit('e2-uebungskampf', { x: LIA_START.x, y: LIA_START.y, preset: 'e2-lia-stab', nonLethal: true,
        title: 'Mit einem geliehenen Stab, Vaters Dolch am Gürtel und sehr viel Herzklopfen' }, staffKit(setup.lichtstoss)),
      { id: 'ignatius', name: 'Ignatius', ...IGNATIUS, team: 'ally', x: IGNATIUS_START.x, y: IGNATIUS_START.y, facing: 'e', move: 3, jump: 1,
        abilities: ['decken'], attack: false, preset: 'e2-ignatius', portrait: 'e2-ignatius', ai: 'guard', guardRadius: 1, nonLethal: true,
        title: 'Deckt seine Schülerin. Kämpfen muss sie selbst.' },
      ...GHOUL_STARTS.map((p, i) => ghoul(`ghul-${i + 1}`, p)),
    ],
    abilities: { ...TRAVEL_ABILITIES, 'e2-stabimpuls': STABIMPULS, 'e2-ghulhieb': GHULHIEB },
    progression: uebungProgression(setup.won),
    objective: {
      text: 'Vertreib die Leichenfresser',
      detail: 'Beide Leichenfresser müssen fliehen. Fällt Lia, beginnt der Kampf von vorn.',
      win: [{ type: 'defeatAll' }],
      lose: [{ type: 'unitDown', units: ['lia'] }],
    },
    hooks: withLiaHooks({
      onStart: opening,
      onRound: async (ctx, round, phase) => {
        if (phase === 'player' && round === 1) {
          await liaCombatHint(ctx);
          await ctx.hint('<em>Stabimpuls</em>: ein kleiner, gezielter Lichtstoß aus der Stabspitze, ein bis drei Felder weit. Kostet 4 MP, dann zwei Züge Pause.', { title: 'Schattentöter', unit: 'lia' });
          await ctx.hint('Ignatius bleibt neben dir und deckt dich. Angreifen wird er nicht. Halte die beiden auf Abstand.', { title: 'Lehrer', unit: 'ignatius' });
        }
        if (phase === 'enemy') cover(ctx);
      },
      onAction: async (ctx, info) => {
        if (info.unit.id === 'lia' && info.ability === 'e2-stabimpuls' && !ctx.hasFlag('e2-erster-impuls')) {
          ctx.flag('e2-erster-impuls');
          ctx.bark('ignatius', 'Gut. Und jetzt atmen.', 1800);
        }
      },
      onUnitDown: async (ctx, unit) => {
        if (unit.team === 'enemy') ctx.bark(unit.id, 'Grrhh …', 1400);
        if (unit.id === 'lia') ctx.bark('ignatius', 'Lia!', 1400);
      },
      onHpBelow: [{ unit: 'lia', below: 0.4, run: c => c.bark('ignatius', 'Zurück! Abstand ist auch eine Waffe.', 2200) }],
    }),
    onWin: async ctx => {
      await ctx.focus('lia', 300);
      await ctx.say('e2-ignatius', 'Siehst du? Sie laufen. Und du stehst noch.', { mood: 'happy' });
    },
  };
}

/** Ignatius covers Lia before the ghouls act, as long as he stands next to her. */
function cover(ctx: BattleCtx): void {
  const lia = ctx.unit('lia'), ig = ctx.unit('ignatius');
  if (!lia || !ig || lia.down || ig.down) return;
  if (Math.abs(lia.x - ig.x) + Math.abs(lia.y - ig.y) > 1) return;
  void ctx.setStatus('lia', 'guarded', 1);
  if (!ctx.hasFlag('e2-gedeckt')) { ctx.flag('e2-gedeckt'); ctx.bark('ignatius', 'Ich hab dich. Ziel du.', 1800); }
}

async function opening(ctx: BattleCtx): Promise<void> {
  ctx.setAi('ignatius', { block: 'lia' });
  await ctx.focus('ghul-1', 400);
  await ctx.say('e2-ignatius', 'Zwei. Sie riechen das Licht wie Hunde den Braten. Bleib ruhig, ich bin direkt neben dir.', { mood: 'determined' });
  await ctx.focus('lia', 300);
  await ctx.say('e2-lia', 'Neben mir ist gut. Vor mir wäre besser.', { mood: 'scared' });
}

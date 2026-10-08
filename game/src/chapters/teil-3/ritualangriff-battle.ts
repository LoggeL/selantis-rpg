// Battle „e3-ritualangriff“ (docs/teil-3/umsetzung.md §3 e3-ritualangriff): the order storms the hill. Lia lies bound
// on the stone in a ring of ten relic stands; Flick (player), Ignatius and two paladins (allies) attack Baris, four
// Dunkelschatten and the controlled Kyra. Vamir is no unit: he leaves in smoke the moment Lia is free, and Ignatius
// goes after him.
//
// Spiel-Design (docs/teil-3/adaption.md):
// - Ritual charge: +1 at every enemy turn of a round while Lia is bound and a stand still stands; at 8 the battle is
//   lost. A player unit next to a standing stand gets „Ständer umstoßen“ (charge −1, at most ten times); the fallen
//   stand no longer blocks its tile, so toppling also opens a way into the ring.
// - Lia is freed by Flick („Fesseln lösen“) or by the first paladin, who makes his way to the stone on his own.
// - As soon as Flick stands next to the freed Lia she hands over the staff
//   (e3-stab-zurueck, + e3-lia-staff, Stabstrahl). Lia is poisoned: 60 % HP/MP. Vamir's men never harm her.
// - When Baris goes down, Kyra's ban breaks (same moment as in the film; the cause stays open). She becomes an ally.
//   Banned Kyra cannot be beaten for good: she staggers up again.
// - When Lia is free, Vamir leaves, Ignatius follows him and two Dunkelschatten desert.
// - Win: Baris kampfunfähig and Lia free. Lose: Flick falls or the charge reaches 8 („Erneut versuchen“).
// - EXP/AP only on the first win (e3-ritual-gewonnen).
// - FFTA rules: Lia comes from common/liaKit (stage e3-ritualangriff: Vaters Dolch, Verzweiflung); Ignatius and the
//   freed Kyra never strike (attack: false). Baris' fall and fallen paladins show blood (battle-shared.battleBlood).
import { G } from '../../core/G';
import type { BattleCtx, BattleDef, BattleUnitDef, Point } from '../../tactics/api';
import { STANDARD_ABILITIES } from '../../tactics/rules/abilities';
import type { AbilityDef, CombatStats, Unit } from '../../tactics/rules/types';
import { characterStats, shadowStats } from '../common/battleCharacters';
import { liaBudget, liaCombatHint, liaUnit, withLiaHooks } from '../common/liaKit';
import { TRAVEL_ABILITIES } from '../common/travelBattles';
import { STABIMPULS } from '../teil-2/stabtraining-battle';
import {
  STABSTRAHL, applyPoison, battleBlood, flare, hasPlate, liaKitFromState, liaOptions, look, onceProgression, respawn, tipProp, type LiaKit,
} from './battle-shared';
import { AMBER, TURQUOISE, VIOLET, grantOnce, staffBack } from './shared';

export const RITUAL_WON = 'e3-ritual-gewonnen';
/** Campaign flag set when Flick hands Lia her staff (also the staff's inventory return, shared.staffBack). */
export const STAFF_RETURNED = 'e3-stab-zurueck';
/** Battle flags (BattleResult.flags) the world scene may read. */
export const RITUAL_FLAGS = {
  win: 'e3-ritual-sieg', lose: 'e3-ritual-vollendet', liaFree: 'e3-lia-frei', kyraFree: 'e3-kyra-frei',
  staff: 'e3-stab-uebergeben', vamirGone: 'e3-vamir-fort',
} as const;
/** Dunkelschatten who run when their master vanishes (Lia's release). */
export const DESERTERS = ['ds-3', 'ds-1'];
/** Units that leave the field by script (BattleResult.dead lists them, but nobody died). */
export const RITUAL_LEAVERS = ['ignatius', ...DESERTERS];

/** Charge at which the ritual has drained Lia (defeat). */
export const CHARGE_LIMIT = 8;
/** The stone with Lia on it, in the middle of the hilltop. */
export const STONE: Point = { x: 6, y: 5 };
/** Ten relic stands in a ring around the stone, gaps on every side. */
export const STANDS: Point[] = [
  { x: 4, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 }, { x: 8, y: 3 }, { x: 4, y: 5 },
  { x: 8, y: 5 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 8, y: 7 },
];

export type RitualWeg = 'hohlweg' | 'felsen' | 'offen';
const WEGE: RitualWeg[] = ['hohlweg', 'felsen', 'offen'];

export interface RitualSetup extends LiaKit {
  /** Flick's ascent chosen in e3-ritual (e3-ritual-weg): changes the start positions. */
  weg: RitualWeg;
  /** The once-only reward was already paid. */
  won: boolean;
}

export function ritualSetupFromState(): RitualSetup {
  const weg = G.state.flag<string>('e3-ritual-weg');
  return { ...liaKitFromState(), weg: WEGE.includes(weg as RitualWeg) ? weg as RitualWeg : 'hohlweg', won: G.state.is(RITUAL_WON) };
}

// ---------------------------------------------------------------------------------------------------------------
// Pure rules of the ritual (tested)
// ---------------------------------------------------------------------------------------------------------------

/** The charge after one step: a new enemy round adds one (only while the ritual runs), a toppled stand takes one. */
export function nextCharge(charge: number, step: 'round' | 'topple', running = true): number {
  if (step === 'round') return running ? Math.min(CHARGE_LIMIT, charge + 1) : charge;
  return Math.max(0, charge - 1);
}

/** The ritual draws on Lia while she is bound and at least one stand still points at her. */
export function ritualRunning(liaBound: boolean, standing: number): boolean {
  return liaBound && standing > 0;
}

const near = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

/** The stand a unit at `at` (looking `facing`) knocks over: the one it faces, else the first adjacent one. */
export function standToTopple(at: Point, facing: 'n' | 'e' | 's' | 'w', standing: Point[]): Point | undefined {
  const d = { n: { x: 0, y: -1 }, e: { x: 1, y: 0 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 } }[facing];
  return standing.find(s => s.x === at.x + d.x && s.y === at.y + d.y) ?? standing.find(s => near(s, at));
}

export function ritualProgression(won: boolean): NonNullable<BattleDef['progression']> {
  return onceProgression(won, ['lia', 'flick', 'kyra', 'ignatius', 'paladin-1', 'paladin-2'], {
    actionExp: 4, defeatExp: 8, actionAp: 1, victoryExp: 24, victoryAp: 5,
    budgets: {
      lia: liaBudget('e3-ritualangriff'), flick: { exp: 45, ap: 10 }, kyra: { exp: 0, ap: 0 },
      ignatius: { exp: 0, ap: 0 }, 'paladin-1': { exp: 0, ap: 0 }, 'paladin-2': { exp: 0, ap: 0 },
    },
  });
}

/** Objective detail with the live numbers. */
export function ritualDetail(r: Pick<RitualRun, 'charge' | 'toppled' | 'liaFree' | 'barisDown'>): string {
  const goals = [r.liaFree ? 'Lia ist frei' : 'Flick löst neben dem Stein die Fesseln', r.barisDown ? 'Baris ist gefallen' : 'Baris muss fallen'];
  const ritual = r.liaFree ? 'Das Ritual ist unterbrochen.' : `Ritual ${r.charge}/${CHARGE_LIMIT} · Ständer ${STANDS.length - r.toppled.length}/${STANDS.length}.`;
  return `${goals.join(', ')}. ${ritual} Fällt Flick, ist alles verloren.`;
}

// ---------------------------------------------------------------------------------------------------------------
// Abilities, units, map
// ---------------------------------------------------------------------------------------------------------------

/** Freeing Lia from the stone (the standard „befreien“ under its story name). */
export const FESSELN_LOESEN: AbilityDef = {
  ...STANDARD_ABILITIES.befreien, id: 'e3-fesseln-loesen', name: 'Fesseln lösen',
  description: 'Die Stricke einer Gefangenen auf dem angrenzenden Feld durchschneiden.',
};

/** Spiel-Design: knocking over a relic stand next to the unit. Only offered while one stands adjacent. */
export const UMSTOSSEN: AbilityDef = {
  id: 'e3-umstossen', name: 'Ständer umstoßen', kind: 'interact', target: 'self', range: [0, 0], shape: { type: 'self' },
  power: 0, accuracy: 100, alwaysHits: true, vfx: 'free',
  description: 'Den Holzständer daneben umwerfen. Das Ding darauf zeigt dann nicht mehr auf Lia (Ritual −1), und der Weg dort ist frei.',
};

/** Ignatius' warm amber ward (Decken under his colour; the engine draws its status icon in its own colour). */
export const BERNSTEINWALL: AbilityDef = {
  ...TRAVEL_ABILITIES.decken, id: 'e3-bernsteinwall', name: 'Bernsteinwall', vfx: 'free',
  description: 'Ein warmer, bernsteinfarbener Schimmer um einen Gefährten: halber Schaden bis zu dessen nächstem Zug.',
};

/** Banned Kyra fights with the sword Vamir gave her (stronger than her own level; nonLethal). */
const KYRA_BANNED: { level: number; baseStats: CombatStats } = { level: 4, baseStats: { maxHp: 12, maxMp: 4, atk: 2, def: 0, speed: 6 } };
/** Baris after Teil II: one eye under the band, still dangerous, but within reach of an arrow and two paladins. */
const BARIS: { level: number; baseStats: CombatStats } = { level: 8, baseStats: { maxHp: 12, maxMp: 2, atk: 0, def: 1, speed: 5 } };
const IGNATIUS: { level: number; baseStats: CombatStats } = { level: 12, baseStats: { maxHp: 20, maxMp: 12, atk: 1, def: 2, speed: 5 } };
/** Kyra gets up again with this share of her HP when beaten while banned. */
export const KYRA_RECOVER = 0.4;

const START: Record<RitualWeg, Record<'flick' | 'ignatius' | 'paladin-1' | 'paladin-2', Point>> = {
  // Sunken path from the lower left: close and hidden in the bushes.
  hohlweg: { flick: { x: 2, y: 9 }, ignatius: { x: 1, y: 11 }, 'paladin-1': { x: 3, y: 10 }, 'paladin-2': { x: 0, y: 10 } },
  // Over the rocks on the left: higher ground for the bow, the paladins below.
  felsen: { flick: { x: 1, y: 5 }, ignatius: { x: 0, y: 6 }, 'paladin-1': { x: 1, y: 4 }, 'paladin-2': { x: 0, y: 3 } },
  // Straight up the open slope: farther, the paladins in front.
  offen: { flick: { x: 6, y: 11 }, ignatius: { x: 7, y: 11 }, 'paladin-1': { x: 5, y: 10 }, 'paladin-2': { x: 7, y: 10 } },
};

export const RITUAL_MAP: BattleDef['map'] = {
  ground: 'dry',
  trees: 'mixed',
  height: [
    '0 0 1 1 1 1 1 1 1 1 1 1 0',
    '0 1 1 1 1 1 1 1 1 1 1 1 1',
    '0 1 1 2 2 2 2 2 2 2 1 1 1',
    '0 1 1 2 2 2 2 2 2 2 1 1 0',
    '0 1 1 2 2 2 2 2 2 2 1 1 0',
    '1 1 1 2 2 2 3 2 2 2 1 1 0',
    '0 1 1 2 2 2 2 2 2 2 1 1 0',
    '0 0 1 2 2 2 2 2 2 2 1 1 0',
    '0 0 1 2 2 2 2 2 2 2 1 0 0',
    '0 0 0 1 1 1 1 1 1 1 0 0 0',
    '0 0 0 0 1 1 1 0 0 0 0 0 0',
    '0 0 0 0 0 0 0 0 0 0 0 0 0',
  ],
  terrain: [
    'T T . . . . . T . . T T T',
    'T . . . . . . . . . . T T',
    'T . . r . . . . . . . . T',
    '. . . . r . r r r . . . T',
    '. . . . . . . . . . . . T',
    '. . r . r . : . r . . . .',
    '. r . . . . . . . . . b T',
    '. . . . r r r . r . . . T',
    'b . . . . . . . . r . . T',
    'b b . . . . . . . . . T T',
    '. b . . . . . . . . T T T',
    '. . . . . . . . . T T T T',
  ],
  paint: [
    '. . . . . . . . . . . . .',
    '. . . . . . . . . . . . .',
    '. . . . . . . . . . . . .',
    '. . . . . . . . . . . . .',
    '. . . . . d d d . . . . .',
    '. . . . . d s d . . . . .',
    '. . . . . d d d . . . . .',
    '. . . . . . . d . . . . .',
    '. . d . . . . d . . . . .',
    '. . . d d . . d . . . . .',
    '. . . . d d d d . . . . .',
    '. . . . . d d . . . . . .',
  ],
  props: [
    ...STANDS.map((p, i) => ({ x: p.x, y: p.y, prop: 'ritual-stand', variant: i })),
    // Fire bowls on the two rock tiles (decorative, the rock still blocks). The world 'torch' prop is too narrow for
    // tactics/view/props.sharedProp (< 20 px) and would show as a grey placeholder block.
    { x: 3, y: 2, prop: 'campfire' },
    { x: 9, y: 8, prop: 'campfire' },
    { x: 10, y: 2, prop: 'banner-dark' },
  ],
};

const shadow = (o: Partial<BattleUnitDef> & Pick<BattleUnitDef, 'id' | 'x' | 'y'>): BattleUnitDef => {
  const preset = o.preset ?? 'shadow-sword';
  return {
    name: 'Dunkelschatten', team: 'enemy', ...shadowStats(preset), move: 4, jump: 2,
    abilities: [preset === 'shadow-spear' ? 'speerstoss' : preset === 'shadow-crossbow' ? 'bolzen' : preset === 'shadow-club' ? 'wuchtschlag' : 'schwerthieb'],
    preset, ai: preset === 'shadow-crossbow' ? 'archer' : 'melee', facing: 's', nonLethal: true,
    title: 'Wache am Ritualkreis', ...o,
  };
};

/**
 * Lia's unit (common/liaKit, stage e3-ritualangriff): bound on the stone, later free and with her staff (`staff`).
 * Vaters Dolch is her attack; Stabstrahl only with her own staff, Stabimpuls only with Schattentöter.
 */
export function ritualLia(setup: RitualSetup, opts: { staff?: boolean } = {}): BattleUnitDef {
  const staff = opts.staff ?? setup.ownStaff;
  return liaUnit('e3-ritualangriff', {
    team: 'ally', freedTeam: 'player', x: STONE.x, y: STONE.y, facing: 's',
    statuses: { bound: Infinity }, nonLethal: true, tags: ['spared'],
    preset: staff ? look('e3-lia-eigenstab', 'lia-cloak') : 'lia-cloak', boundPreset: 'e3-lia-gefesselt', portrait: 'lia-cloak',
    title: setup.poisoned ? 'Vergiftet. Das Ritual zieht an ihr.' : 'Gefesselt auf dem Stein',
  }, liaOptions(setup, staff));
}

/** Kyra under the ban (enemy) or herself again (ally). */
export function kyraUnit(free: boolean, at: Point = { x: 5, y: 4 }, hpFraction?: number): BattleUnitDef {
  if (free) {
    return {
      id: 'kyra', name: 'Kyra', ...characterStats('kyra', hpFraction ?? 0.5), team: 'ally', x: at.x, y: at.y, facing: 's', move: 4, jump: 2,
      abilities: ['schubsen'], attack: false, preset: 'kyra', portrait: 'kyra', ai: 'hold', nonLethal: true,
      title: 'Wieder sie selbst. Erschöpft und verwirrt.',
    };
  }
  const stats = { level: KYRA_BANNED.level, baseStats: { ...KYRA_BANNED.baseStats } };
  const hp = hpFraction === undefined ? undefined : Math.max(1, Math.round((stats.baseStats.maxHp + (stats.level - 1) * 3) * hpFraction));
  return {
    id: 'kyra', name: 'Kyra', ...stats, ...(hp === undefined ? {} : { hp }), team: 'enemy', x: at.x, y: at.y, facing: 's', move: 4, jump: 2,
    abilities: ['schwerthieb'], preset: 'e2-kyra-gebannt', portrait: 'e2-kyra-gebannt', ai: 'melee', nonLethal: true,
    title: 'Leerer Blick. Sie gehorcht nicht sich selbst.',
  };
}

export function ritualBattle(setup: RitualSetup = ritualSetupFromState()): BattleDef {
  const s = START[setup.weg];
  const units: BattleUnitDef[] = [
    ritualLia(setup),
    { id: 'flick', name: 'Flick', ...characterStats('flick'), team: 'player', x: s.flick.x, y: s.flick.y, facing: 'n', move: 5, jump: 3,
      abilities: ['bogen', 'messer', FESSELN_LOESEN.id], preset: 'flick', portrait: 'flick', nonLethal: true,
      title: 'Hat den Weg gefunden. Und Lias Stab am Gürtel.' },
    { id: 'ignatius', name: 'Ignatius', ...IGNATIUS, team: 'ally', x: s.ignatius.x, y: s.ignatius.y, facing: 'n', move: 3, jump: 1,
      abilities: [BERNSTEINWALL.id], attack: false, preset: 'e2-ignatius', portrait: 'e2-ignatius', ai: 'guard', guardRadius: 2, nonLethal: true,
      title: 'Bernsteinfarbenes Licht. Deckt, wer neben ihm steht.' },
    { id: 'paladin-1', name: 'Paladin', ...characterStats('paladin'), team: 'ally', x: s['paladin-1'].x, y: s['paladin-1'].y, facing: 'n',
      move: 3, jump: 1, abilities: ['schwerthieb'], preset: 'paladin-anfuehrer', portrait: 'paladin-anfuehrer', ai: 'melee', nonLethal: true,
      title: 'Lichterorden von Trapas' },
    { id: 'paladin-2', name: 'Paladin', ...characterStats('paladin'), team: 'ally', x: s['paladin-2'].x, y: s['paladin-2'].y, facing: 'n',
      move: 3, jump: 1, abilities: ['schwerthieb'], preset: 'paladin-jung', portrait: 'paladin-jung', ai: 'melee', nonLethal: true,
      title: 'Lichterorden von Trapas' },
    { id: 'baris', name: 'Baris', ...BARIS, team: 'enemy', x: 7, y: 4, facing: 's', move: 3, jump: 2,
      abilities: ['axthieb', 'wuchtschlag'], preset: 'baris-scarred', portrait: 'baris-scarred', ai: 'guard', guardRadius: 2, nonLethal: true,
      title: 'Hauptmann der Dunkelschatten. Ein Band über dem verbrannten Auge.' },
    kyraUnit(false),
    shadow({ id: 'ds-1', x: 3, y: 8, facing: 'w', ai: 'guard', guardRadius: 3 }),
    shadow({ id: 'ds-2', x: 9, y: 6, preset: 'shadow-spear', ai: 'guard', guardRadius: 3 }),
    shadow({ id: 'ds-3', x: 6, y: 1, preset: 'shadow-crossbow', move: 3 }),
    shadow({ id: 'ds-4', x: 7, y: 6, preset: 'shadow-club', ai: 'guard', guardRadius: 3 }),
  ];
  return {
    id: 'e3-ritualangriff',
    title: 'Am Stein',
    subtitle: 'Das Ritual brechen',
    victoryText: 'Die Dunkelschatten fliehen den Hang hinunter. Am Stein wird es mit einem Mal still.',
    defeatText: DEFEAT_FLICK,
    backdrop: 'dusk',
    ambience: ['wind', 'fire', 'battle-far'],
    music: 'battle',
    seed: 7314,
    map: RITUAL_MAP,
    units,
    goalTiles: [STONE],
    abilities: {
      ...TRAVEL_ABILITIES, [STABSTRAHL.id]: STABSTRAHL, [STABIMPULS.id]: STABIMPULS,
      [FESSELN_LOESEN.id]: FESSELN_LOESEN, [UMSTOSSEN.id]: UMSTOSSEN, [BERNSTEINWALL.id]: BERNSTEINWALL,
    },
    progression: ritualProgression(setup.won),
    objective: {
      text: 'Holt Lia vom Stein',
      detail: ritualDetail({ charge: 0, toppled: [], liaFree: false, barisDown: false }),
      win: [{ type: 'flag', flag: RITUAL_FLAGS.win }],
      lose: [{ type: 'unitDown', units: ['flick'] }, { type: 'flag', flag: RITUAL_FLAGS.lose }],
    },
    hooks: withLiaHooks({
      onStart: ctx => opening(ctx, setup),
      onRound: (ctx, round, phase) => onRound(ctx, round, phase),
      onMove: async (ctx, unit) => {
        syncStands(ctx);
        standHint(ctx);
        if (unit.id === MARCHER && !run(ctx).liaFree && near(unit, STONE)) await scriptFree(ctx, setup, unit);
      },
      onAction: (ctx, info) => onAction(ctx, info.unit, info.ability),
      onFree: (ctx, unit, by) => unit.id === 'lia' ? liaFreed(ctx, setup, by) : undefined,
      onUnitDown: (ctx, unit) => onDown(ctx, unit),
      onHpBelow: [{ unit: 'flick', below: 0.35, run: c => c.bark('flick', 'Das war knapp. Weiter!', 1800) }],
      triggers: [
        // Keeps „Ständer umstoßen“ exactly on the player units standing next to a stand (side effect, never fires).
        { id: 'e3-staender-sync', once: false, when: ctx => { syncStands(ctx); return false; }, run: () => {} },
        { id: 'e3-stabrueckgabe', when: ctx => staffDue(ctx), run: ctx => returnStaff(ctx, setup) },
        { id: 'e3-ritual-sieg', when: ctx => { const r = run(ctx); return r.liaFree && r.barisDown; }, run: victory },
      ],
    }),
    onWin: async ctx => {
      grantOnce(RITUAL_WON, () => {});
      // Flick hands the staff over at the latest now (normally already during the fight).
      if (!ctx.hasFlag(RITUAL_FLAGS.staff)) staffBack(STAFF_RETURNED);
    },
  };
}

const DEFEAT_FLICK = 'Flick ist gefallen. Halte sie aus Baris’ Reichweite und lass die Paladine vorangehen.';
const DEFEAT_RITUAL = 'Das Ritual hat Lia fast leer gezogen. Stoßt Ständer um, das kostet Zeit, und holt sie schneller vom Stein.';

// ---------------------------------------------------------------------------------------------------------------
// Per-attempt state (a retry builds a new Battle; the def object is reused)
// ---------------------------------------------------------------------------------------------------------------

export interface RitualRun {
  charge: number;
  toppled: Point[];
  liaFree: boolean;
  barisDown: boolean;
  staffReturned: boolean;
  standHinted: boolean;
}

const runs = new WeakMap<object, RitualRun>();

/** Live ritual state of one attempt (keyed by the rules engine instance). */
export function run(ctx: Pick<BattleCtx, 'battle'>): RitualRun {
  let r = runs.get(ctx.battle);
  if (!r) { r = { charge: 0, toppled: [], liaFree: false, barisDown: false, staffReturned: false, standHinted: false }; runs.set(ctx.battle, r); }
  return r;
}

export function standingStands(r: Pick<RitualRun, 'toppled'>): Point[] {
  return STANDS.filter(p => !r.toppled.some(t => t.x === p.x && t.y === p.y));
}

function updateObjective(ctx: BattleCtx): void {
  ctx.setObjective(run(ctx).liaFree ? 'Brecht den Widerstand' : 'Holt Lia vom Stein', ritualDetail(run(ctx)));
}

/** Gives „Ständer umstoßen“ to every player unit next to a standing stand and takes it from all others. */
export function syncStands(ctx: Pick<BattleCtx, 'battle'>): void {
  const standing = standingStands(run(ctx));
  for (const u of ctx.battle.units) {
    if (u.team !== 'player' && u.abilities.includes(UMSTOSSEN.id)) { u.abilities = u.abilities.filter(a => a !== UMSTOSSEN.id); continue; }
    if (u.team !== 'player') continue;
    const can = !u.down && standing.some(p => near(p, u));
    const has = u.abilities.includes(UMSTOSSEN.id);
    if (can && !has) u.abilities = [...u.abilities, UMSTOSSEN.id];
    if (!can && has) u.abilities = u.abilities.filter(a => a !== UMSTOSSEN.id);
  }
}

/**
 * First time a player unit stands next to a stand: a short bark (never a waiting hint card here: onMove runs inside
 * the player's move, and a hint that waits would keep the move command open).
 */
function standHint(ctx: BattleCtx): void {
  const r = run(ctx);
  if (r.standHinted) return;
  const u = ctx.battle.units.find(x => x.team === 'player' && x.abilities.includes(UMSTOSSEN.id));
  if (!u) return;
  r.standHinted = true;
  ctx.bark(u.id, u.id === 'lia' ? 'Den Ständer kann ich umwerfen.' : 'Den Ständer werf ich um.', 2200);
}

/** The paladin who marches to the stone (umsetzung.md: „Flick oder ein Paladin neben dem Stein“). */
export const MARCHER = 'paladin-1';
const STONE_SIDES: Point[] = [{ x: STONE.x - 1, y: STONE.y }, { x: STONE.x + 1, y: STONE.y }, { x: STONE.x, y: STONE.y - 1 }, { x: STONE.x, y: STONE.y + 1 }];

/** The side of the stone closest to `p`, preferring sides nobody else stands on. */
export function nearestSide(p: Point, taken: (q: Point) => boolean = () => false): Point {
  const order = STONE_SIDES.slice().sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)));
  return order.find(q => !taken(q)) ?? order[0];
}

/** Points the marching paladin at the nearest free side (Kyra and the guards crowd the stone, so this changes). */
function aimMarcher(ctx: BattleCtx): void {
  const m = ctx.unit(MARCHER);
  if (!m || m.down || run(ctx).liaFree) return;
  ctx.setAi(MARCHER, { goal: nearestSide(m, q => { const o = ctx.battle.unitAt(q.x, q.y); return !!o && o.id !== MARCHER; }) });
}

/**
 * The AI paladin reached the stone: he cuts the ropes. The engine only frees through a player action, so the
 * release is scripted: Lia comes back unbound on the same tile (new view without the bound look), then the same
 * story beat as Flick's release runs.
 */
export async function scriptFree(ctx: BattleCtx, setup: RitualSetup, by: Unit): Promise<void> {
  const lia = ctx.unit('lia');
  if (!lia || !ctx.battle.has(lia, 'bound')) return;
  ctx.bark(by.id, 'Haltet still, ich schneide Euch los.', 1800);
  const def = ritualLia(setup);
  const u = await respawn(ctx, { ...def, team: 'player', statuses: {} });
  if (u) { u.moved = true; u.acted = true; }
  await liaFreed(ctx, setup, by);
}

// ---------------------------------------------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------------------------------------------

async function opening(ctx: BattleCtx, setup: RitualSetup): Promise<void> {
  runs.delete(ctx.battle);
  (ctx.def as BattleDef).defeatText = DEFEAT_FLICK;
  applyPoison(ctx.unit('lia'), setup.poisoned);
  if (setup.ownStaff) { run(ctx).staffReturned = true; ctx.flag(RITUAL_FLAGS.staff); }
  ctx.setAi('ignatius', { block: 'flick' });
  // The first paladin makes his way to the stone; next to it he cuts the ropes (scriptFree).
  aimMarcher(ctx);
  await ctx.focus('lia', 500);
  flare('lia', TURQUOISE, 26);
  await ctx.say('e2-vamir', 'Haltet sie mir vom Leib. Es dauert nicht mehr lange.');
  await ctx.focus('baris', 400);
  await ctx.say('e2-baris', 'Das Spitzohr! Ich hab gehofft, dass du dich noch mal blicken lässt.', { mood: 'angry' });
  await ctx.focus('flick', 400);
  await ctx.say('flick', 'Ignatius, halt mir den Rücken frei. Ich hol die Leseratte vom Stein.', { mood: 'determined' });
  await ctx.say('e2-ignatius', 'Geh. Und achte auf die Ständer: Jedes Ding darauf zieht an ihr.', { mood: 'determined' });
}

async function onRound(ctx: BattleCtx, round: number, phase: string): Promise<void> {
  if (phase === 'player' && round === 1) {
    await ctx.hint(`Jede Gegnerrunde wächst die <em>Ladung</em> des Rituals um eins. Bei ${CHARGE_LIMIT} ist Lia leer. Wer neben einem <em>Ständer</em> steht, kann ihn umstoßen: Ladung −1.`, { title: 'Das Ritual', tile: STONE });
    await ctx.hint('Steht Flick neben dem Stein, löst <em>Fesseln lösen</em> Lias Stricke. Der vordere Paladin kämpft sich auch dorthin. Und Baris muss fallen, sonst halten seine Leute den Hügel.', { title: 'Ziel', unit: 'flick' });
  }
  if (phase === 'ally') aimMarcher(ctx);
  if (phase === 'enemy') {
    cover(ctx);
    await chargeUp(ctx);
  }
}

/** One enemy round: the ritual draws on Lia. */
async function chargeUp(ctx: BattleCtx): Promise<void> {
  const r = run(ctx);
  const lia = ctx.unit('lia');
  const bound = !!lia && ctx.battle.has(lia, 'bound');
  if (!ritualRunning(bound, standingStands(r).length)) return;
  r.charge = nextCharge(r.charge, 'round');
  updateObjective(ctx);
  flare('lia', TURQUOISE, 22 + r.charge * 3);
  flare('lia', VIOLET, 14 + r.charge * 2);
  if (r.charge === 3) ctx.bark('lia', 'Es zieht … wie ein Faden aus der Brust.', 2200);
  if (r.charge === 5) ctx.bark('lia', 'Kyra … hörst du mich?', 2000);
  if (r.charge === CHARGE_LIMIT - 1) { ctx.shake(1); ctx.bark('lia', 'Lange halt ich das nicht mehr …', 2200); }
  if (r.charge >= CHARGE_LIMIT) {
    ctx.shake(2);
    (ctx.def as BattleDef).defeatText = DEFEAT_RITUAL;
    ctx.flag(RITUAL_FLAGS.lose);
  }
}

/** Ignatius covers whoever stands next to him before the enemy acts (amber). */
function cover(ctx: BattleCtx): void {
  const ig = ctx.unit('ignatius');
  if (!ig || ig.down || ig.x < -50) return;
  const friend = ['flick', 'lia', 'paladin-1', 'paladin-2']
    .map(id => ctx.unit(id)).find(u => !!u && !u.down && !ctx.battle.has(u, 'bound') && near(u, ig));
  if (!friend) return;
  void ctx.setStatus(friend.id, 'guarded', 1);
  flare(friend.id, AMBER, 20);
  if (!ctx.hasFlag('e3-gedeckt')) { ctx.flag('e3-gedeckt'); ctx.bark('ignatius', 'Ich halte. Du schießt.', 1800); }
}

async function onAction(ctx: BattleCtx, unit: Unit, ability: string): Promise<void> {
  if (ability !== UMSTOSSEN.id) return;
  const r = run(ctx);
  const stand = standToTopple(unit, unit.facing, standingStands(r));
  if (!stand) return;
  r.toppled.push(stand);
  r.charge = nextCharge(r.charge, 'topple');
  // The fallen stand no longer blocks: toppling also opens the ring (rules tile; the prop only tips over).
  const tile = ctx.battle.grid.tile(stand.x, stand.y);
  if (tile) tile.terrain = 'dirt';
  tipProp(stand.x, stand.y);
  ctx.shake(1);
  syncStands(ctx);
  updateObjective(ctx);
  const left = STANDS.length - r.toppled.length;
  if (left === 0) {
    await ctx.banner('Der Kreis ist gebrochen', 'Kein Ständer zeigt mehr auf Lia.');
  } else if (r.toppled.length === 1) {
    ctx.bark('lia', 'Es … zieht weniger.', 1800);
  }
}

async function liaFreed(ctx: BattleCtx, setup: RitualSetup, by: Unit): Promise<void> {
  const r = run(ctx);
  r.liaFree = true;
  ctx.flag(RITUAL_FLAGS.liaFree);
  await ctx.focus('lia', 400);
  if (by.id === 'flick') await ctx.say('flick', 'Halt still, Leseratte. Gleich hast du deine Hände wieder.');
  await ctx.say('e3-lia', by.id === 'flick' ? 'Flick? Du bist wirklich hier?' : 'Paladine? Hier? Dann … dann ist Flick auch nicht weit.', { mood: 'surprised' });
  if (setup.poisoned) await ctx.say('e3-lia', 'Meine Beine sind wie Watte. Irgendwas war in dem Tee.', { mood: 'scared' });
  // Vamir leaves in smoke; Ignatius goes after him.
  ctx.flag(RITUAL_FLAGS.vamirGone);
  ctx.shake(1);
  await ctx.say('e2-vamir', 'Wie lästig. Dann eben ein andermal.');
  const ig = ctx.unit('ignatius');
  if (ig && !ig.down) {
    flare('ignatius', AMBER, 28);
    ctx.bark('ignatius', 'Diesmal läufst du mir nicht davon!', 1800);
    await ctx.wait(900);
    await ctx.remove('ignatius');
    ctx.bark('lia', 'Ignatius, nicht allein!', 1600);
    await ctx.wait(1000);
  }
  // Without their master, two of his men lose heart.
  const gone = DESERTERS.filter(id => { const d = ctx.unit(id); return !!d && !d.down && d.x > -50; });
  if (gone.length) {
    await ctx.focus(gone[0], 300);
    ctx.bark(gone[0], 'Der Meister ist weg! Ich bleib hier nicht!', 1600);
    await ctx.wait(900);
    for (const id of gone) await ctx.remove(id);
  }
  ctx.setAi(MARCHER, null);
  const baris = ctx.unit('baris');
  if (baris && !baris.down) {
    ctx.setAi('baris', { profile: 'melee', target: 'flick' });
    await ctx.focus('baris', 300);
    ctx.bark('baris', 'Das Spitzohr gehört mir!', 1600);
    await ctx.wait(700);
  }
  updateObjective(ctx);
  // First battle of a direct entry: the one-time note on Vaters Dolch, now that Lia can use it.
  await liaCombatHint(ctx);
}

/** Staff handover: Lia is free, Flick stands next to her, it has not happened yet. */
function staffDue(ctx: BattleCtx): boolean {
  const r = run(ctx);
  const lia = ctx.unit('lia'), flick = ctx.unit('flick');
  return r.liaFree && !r.staffReturned && !!lia && !!flick && !lia.down && !flick.down && near(lia, flick);
}

async function returnStaff(ctx: BattleCtx, setup: RitualSetup): Promise<void> {
  const r = run(ctx);
  r.staffReturned = true;
  ctx.flag(RITUAL_FLAGS.staff);
  await ctx.focus('lia', 300);
  const plate = hasPlate('e3-stabrueckgabe');
  if (plate) await ctx.ui.plate('e3-stabrueckgabe', { caption: 'Lias Stab', pan: 'in', durationMs: 9000 });
  await ctx.say('flick', 'Hier. Ignatius hat ihn mir in die Hand gedrückt. Er meinte, du weißt, was du damit tust.');
  await ctx.say('e3-lia', 'Mein Stab! Den hast du den ganzen Weg getragen?', { mood: 'surprised' });
  await ctx.say('flick', 'Am Gürtel. Er hat mir bei jedem Schritt in die Kniekehle geschlagen.');
  if (plate) await ctx.ui.closePlate();
  // Inventory is the truth: the staff is back with Lia now (shared.staffBack is idempotent).
  staffBack(STAFF_RETURNED);
  const def = ritualLia({ ...setup, ownStaff: true }, { staff: true });
  await respawn(ctx, { ...def, team: 'player', statuses: {} }, { keepTurn: true });
  flare('lia', TURQUOISE, 30);
  syncStands(ctx);
  await ctx.hint('Lia hat ihren Stab wieder: <em>Stabstrahl</em> trifft ein Ziel bis vier Felder weit, auch durch Rüstung.', { title: 'Eigener Stab', unit: 'lia' });
}

async function onDown(ctx: BattleCtx, unit: Unit): Promise<void> {
  if (unit.id === 'baris') {
    run(ctx).barisDown = true;
    // The fall the whole hill turns to: hard, with blood (umsetzung.md, Vorrang).
    battleBlood('baris', { pool: true });
    ctx.shake(2);
    ctx.bark('baris', 'Nicht … schon wieder du …', 2000);
    await breakBan(ctx);
    updateObjective(ctx);
    return;
  }
  if (unit.id === 'kyra' && unit.team === 'enemy') {
    // Banned Kyra never stays down: she staggers up again, emptier than before.
    ctx.bark('kyra', '…', 900);
    await ctx.wait(500);
    await respawn(ctx, kyraUnit(false, unit, KYRA_RECOVER), { keepPools: false });
    return;
  }
  if (unit.id === 'kyra') {
    // Freed Kyra cannot be knocked out either (umsetzung.md §3): she sinks down and gets up again, still exhausted.
    ctx.bark('kyra', 'Ich … brauch nur einen Moment.', 1800);
    await ctx.wait(500);
    await respawn(ctx, kyraUnit(true, unit, KYRA_RECOVER), { keepPools: false });
    return;
  }
  if (unit.id === 'flick') { ctx.bark('lia', 'Flick!', 1400); return; }
  if (unit.id.startsWith('paladin')) {
    battleBlood(unit.id, { pool: true, strength: 0.7 });
    ctx.bark(unit.id, 'Weiter … ohne mich …', 1600);
    return;
  }
  if (unit.team === 'enemy') ctx.bark(unit.id, 'Das ist mir der Sold nicht wert.', 1500);
}

/** Baris is down: in the same moment Kyra comes back to herself (cause unexplained, as in the film). */
export async function breakBan(ctx: BattleCtx): Promise<void> {
  const k = ctx.unit('kyra');
  if (!k || (k.team !== 'enemy' && !k.down) || ctx.hasFlag(RITUAL_FLAGS.kyraFree)) return;
  ctx.flag(RITUAL_FLAGS.kyraFree);
  const at = k.x > -50 ? { x: k.x, y: k.y } : { x: 5, y: 4 };
  await ctx.focus('kyra', 400);
  flare('kyra', VIOLET, 34);
  ctx.setAi('kyra', null);
  await respawn(ctx, kyraUnit(true, at), { keepPools: false });
  ctx.pose('kyra', 'kneel');
  await ctx.say('e3-kyra', 'Was … was hab ich da in der Hand?', { mood: 'scared' });
  await ctx.say('e3-kyra', 'Lia? Warum ist es hier oben so kalt?', { mood: 'sad' });
  ctx.bark('flick', 'Kyra ist wieder da!', 1800);
}

async function victory(ctx: BattleCtx): Promise<void> {
  await ctx.banner('Die Dunkelschatten fliehen!', 'Baris ist gefallen, Lia ist frei.');
  ctx.flag(RITUAL_FLAGS.win);
}

// Battle „e3-vamir-duell“ (docs/teil-3/umsetzung.md §3 e3-vamir): on the forest path Lia faces Vamir alone. Ignatius
// lies at the edge of the path (ally, kampfunfähig, never controllable). Lia is poisoned (60 % HP/MP) and fights with
// her own staff (Stabstrahl), Lichtstoß if she knows it, and Ausweichen.
//
// Spiel-Design (docs/teil-3/adaption.md):
// - Vamir wears a cold violet shield: while it stands his armour is so high that everything except the Stabstrahl
//   (fixed damage) only scratches him. A Stabstrahl hit breaks it.
// - Every second round Vamir vanishes at the start of his turn and reappears elsewhere, the shield raised again; the
//   jump replaces his move, and he still strikes from the new spot.
// - After the third broken shield, or when Vamir drops below 30 % HP, the Urmacht answers through Lia: scripted
//   finisher (turquoise burst, plate e3-vamir-fall when delivered), Vamir dissolves in violet. He never dies by an
//   ordinary hit before that (HP margin; onUnitDown falls back to the finisher).
// - Lose: Lia falls („Erneut versuchen“). EXP/AP only on the first win (e3-duell-gewonnen).
import { G } from '../../core/G';
import type { BattleCtx, BattleDef, BattleUnitDef, Facing, Point } from '../../tactics/api';
import type { AbilityDef, BattleEvent, CombatStats, Unit } from '../../tactics/rules/types';
import { liaAbilities, liaBudget, liaCombatHint, liaUnit, withLiaHooks } from '../common/liaKit';
import { TRAVEL_ABILITIES } from '../common/travelBattles';
import { STABIMPULS } from '../teil-2/stabtraining-battle';
import { STABSTRAHL, applyPoison, battleBlood, flare, hasPlate, liaKitFromState, liaOptions, look, onceProgression, respawn, type LiaKit } from './battle-shared';
import { AMBER, TURQUOISE, VIOLET, grantOnce } from './shared';

export const DUEL_WON = 'e3-duell-gewonnen';
export const DUEL_FLAGS = { win: 'e3-vamir-gefallen', finisher: 'e3-urmacht-antwortet' } as const;

/** Shield breaks after which the Urmacht answers. */
export const BREAKS_TO_FINISH = 3;
/** HP share below which the Urmacht answers. */
export const FINISH_BELOW = 0.3;
/** Vamir's armour without and with the violet shield. */
export const VAMIR_DEF = 4;
export const SHIELD_DEF = 40;
/** Vamir vanishes and reappears every this many rounds. */
export const TELEPORT_EVERY = 2;

export const LIA_START: Point = { x: 2, y: 6 };
export const IGNATIUS_AT: Point = { x: 1, y: 7 };
export const VAMIR_START: Point = { x: 5, y: 3 };
/** Where Vamir may reappear (all standable, checked in the test). */
export const TELEPORT_SPOTS: Point[] = [
  { x: 6, y: 1 }, { x: 7, y: 5 }, { x: 1, y: 2 }, { x: 6, y: 4 }, { x: 4, y: 3 }, { x: 6, y: 6 }, { x: 1, y: 4 }, { x: 4, y: 8 },
];

export interface DuelSetup extends LiaKit {
  won: boolean;
}

export function duelSetupFromState(): DuelSetup {
  return { ...liaKitFromState(), won: G.state.is(DUEL_WON) };
}

// ---------------------------------------------------------------------------------------------------------------
// Pure rules (tested)
// ---------------------------------------------------------------------------------------------------------------

/** Lia's specials (common/liaKit): Stabimpuls only with Schattentöter, Lichtstoß if known, her own small means, and the
 * Stabstrahl appended while she carries her own staff. Her attack is Vaters Dolch. */
export function duelAbilities(kit: LiaKit): string[] {
  return liaAbilities(liaOptions(kit));
}

/** The Urmacht answers after three broken shields or below 30 % HP. */
export function finisherDue(v: Pick<Unit, 'hp' | 'maxHp'>, breaks: number): boolean {
  return breaks >= BREAKS_TO_FINISH || v.hp < v.maxHp * FINISH_BELOW;
}

/** Vamir teleports at his turn in every second round. */
export function teleportRound(round: number): boolean {
  return round > 0 && round % TELEPORT_EVERY === 0;
}

const dist = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * Where Vamir reappears: a free spot other than his own, preferably three or four tiles from Lia (inside the reach of
 * his Kalter Stoß and of her Stabstrahl), rotating with the round so it is not always the same one.
 */
export function teleportSpot(round: number, lia: Point, current: Point, spots: Point[], blocked: (p: Point) => boolean): Point | undefined {
  const free = spots.filter(p => !(p.x === current.x && p.y === current.y) && !blocked(p) && dist(p, lia) >= 2);
  const good = free.filter(p => dist(p, lia) >= 3 && dist(p, lia) <= 4);
  // Otherwise the free spot closest to that band (never one he could not strike from if any other exists).
  const pool = good.length ? good : free.slice().sort((a, b) => Math.abs(dist(a, lia) - 4) - Math.abs(dist(b, lia) - 4)).slice(0, 1);
  return pool.length ? pool[Math.floor(round / TELEPORT_EVERY) % pool.length] : undefined;
}

/** True when a Stabstrahl in `events` hit Vamir. */
export function stabstrahlHitVamir(ability: string, events: BattleEvent[]): boolean {
  return ability === STABSTRAHL.id && events.some(e => e.type === 'strike' && e.target === 'vamir' && e.hit);
}

export function duelProgression(won: boolean): NonNullable<BattleDef['progression']> {
  return onceProgression(won, ['lia', 'ignatius'], {
    actionExp: 5, defeatExp: 0, actionAp: 2, victoryExp: 30, victoryAp: 6,
    budgets: { lia: liaBudget('e3-vamir-duell'), ignatius: { exp: 0, ap: 0 } },
  });
}

export function duelDetail(shieldUsed: boolean, shield: boolean, breaks: number): string {
  if (!shieldUsed) return 'Halte Abstand und triff ihn, wo du kannst. Fällt Lia, beginnt der Kampf von vorn.';
  const state = shield ? 'Der violette Schild steht: Nur der Stabstrahl bricht ihn.' : 'Der Schild ist gebrochen: Jetzt trifft alles.';
  return `${state} Gebrochen ${breaks}/${BREAKS_TO_FINISH}. Fällt Lia, beginnt der Kampf von vorn.`;
}

// ---------------------------------------------------------------------------------------------------------------
// Abilities, units, map
// ---------------------------------------------------------------------------------------------------------------

/**
 * Vamir's basic attack: a cold push of force from the open hand. Kind 'ranged' because the engine's magic effects are
 * turquoise (his violet comes from flare); `noFlank` makes it work like magic under the FFTA rules: the hit chance is
 * its accuracy, not the facing. Fixed damage, so the duel stays equally dangerous whatever level Lia reached.
 */
export const KALTER_STOSS: AbilityDef = {
  id: 'e3-kalter-stoss', name: 'Kalter Stoß', kind: 'ranged', target: 'enemy', range: [1, 4], shape: { type: 'single' },
  power: 0, fixedDamage: 5, accuracy: 80, noFlank: true, vfx: 'thrust',
  description: 'Ein Stoß kalter, violetter Kraft aus der offenen Hand. Bis vier Felder weit.',
};

export const SCHATTENRANKEN: AbilityDef = {
  id: 'e3-schattenranken', name: 'Schattenranken', kind: 'ranged', target: 'tile', range: [2, 4], shape: { type: 'area', radius: 1 },
  power: 0, fixedDamage: 3, accuracy: 85, noFlank: true, cooldown: 3, mpCost: 6, vfx: 'thrust',
  description: 'Violette Ranken brechen aus dem Boden und schlagen nach allem rund um das Ziel.',
};

const IGNATIUS: { level: number; baseStats: CombatStats } = { level: 12, baseStats: { maxHp: 20, maxMp: 12, atk: 1, def: 2, speed: 5 } };

export const DUEL_MAP: BattleDef['map'] = {
  ground: 'forest',
  trees: 'mixed',
  height: [
    '1 1 1 1 1 1 2 2 2',
    '1 1 1 1 1 1 1 2 2',
    '1 1 1 1 1 1 1 1 2',
    '0 1 1 1 1 1 1 1 1',
    '0 0 1 1 1 1 1 1 1',
    '0 0 0 1 1 1 1 1 1',
    '1 0 0 0 1 1 1 1 1',
    '1 1 0 0 0 1 1 1 1',
    '1 1 1 0 0 0 1 1 1',
  ],
  terrain: [
    'T T . . b . . T T',
    'T . . . . . . . T',
    '. . r . . . . . .',
    '. . . . . . . r .',
    'b . . . . . . . .',
    '. . . b . . b . .',
    '. . . . . . . . T',
    '. . . . . r . . T',
    'T . . . . . . T T',
  ],
  paint: [
    '. . . . . . . . .',
    '. . . . . . d d .',
    '. . . . . . d . .',
    '. . . . . d d . .',
    '. . . . d d . . .',
    '. . . d d . . . .',
    '. . d d . . . . .',
    '. d d . . . . . .',
    '. d . . . . . . .',
  ],
  props: [
    { x: 5, y: 7, prop: 'stump' },
    { x: 7, y: 3, prop: 'rock', variant: 1 },
    { x: 2, y: 2, prop: 'rock', variant: 2 },
  ],
};

export function vamirUnit(at: Point = VAMIR_START): BattleUnitDef {
  return {
    id: 'vamir', name: 'Vamir', team: 'enemy', x: at.x, y: at.y, facing: 'w', level: 24,
    hp: 48, maxHp: 48, mp: 30, maxMp: 30, atk: 1, def: VAMIR_DEF, speed: 5, move: 3, jump: 2,
    attack: KALTER_STOSS.id, abilities: [SCHATTENRANKEN.id], preset: 'vamir', portrait: 'vamir', ai: 'archer', nonLethal: false,
    title: 'Die Kapuze tief im Gesicht. Kalt, leise, geduldig.',
  };
}

export function duelBattle(setup: DuelSetup = duelSetupFromState()): BattleDef {
  return {
    id: 'e3-vamir-duell',
    title: 'Vamir',
    subtitle: 'Auf dem Waldweg',
    victoryText: 'Vamir ist fort. Zwischen den Bäumen hängt nur noch ein violetter Schimmer.',
    defeatText: 'Lia ist gestürzt. Solange der violette Schild steht, hilft nur der Stabstrahl. Weiche aus, wenn er die Hand hebt.',
    backdrop: 'forest',
    ambience: ['wind', 'birds'],
    music: 'battle',
    seed: 7415,
    map: DUEL_MAP,
    units: [
      liaUnit('e3-vamir-duell', {
        x: LIA_START.x, y: LIA_START.y, facing: 'e', nonLethal: true,
        preset: setup.ownStaff ? look('e3-lia-eigenstab', 'lia-cloak') : 'lia-cloak', portrait: 'lia-cloak',
        title: setup.poisoned ? 'Vergiftet, zitternd. Und sie bleibt stehen.' : 'Zwischen Vamir und Ignatius',
      }, liaOptions(setup)),
      { id: 'ignatius', name: 'Ignatius', ...IGNATIUS, team: 'ally', x: IGNATIUS_AT.x, y: IGNATIUS_AT.y, facing: 'e', move: 0, jump: 0,
        abilities: [], attack: false, preset: 'e2-ignatius', portrait: 'e2-ignatius', ai: 'passive', nonLethal: true, tags: ['spared'],
        title: 'Liegt im Laub. Er atmet noch.' },
      vamirUnit(),
    ],
    abilities: {
      ...TRAVEL_ABILITIES, [STABSTRAHL.id]: STABSTRAHL, [STABIMPULS.id]: STABIMPULS,
      [KALTER_STOSS.id]: KALTER_STOSS, [SCHATTENRANKEN.id]: SCHATTENRANKEN,
    },
    progression: duelProgression(setup.won),
    objective: {
      text: 'Stell dich Vamir',
      detail: duelDetail(setup.ownStaff, setup.ownStaff, 0),
      win: [{ type: 'flag', flag: DUEL_FLAGS.win }],
      lose: [{ type: 'unitDown', units: ['lia'] }],
    },
    hooks: withLiaHooks({
      onStart: ctx => opening(ctx, setup),
      onRound: (ctx, round, phase) => onRound(ctx, round, phase),
      onAction: (ctx, info) => onAction(ctx, info.unit, info.ability, info.events),
      onUnitDown: async (ctx, unit) => {
        if (unit.id === 'vamir' && !duel(ctx).done) await finisher(ctx);
      },
      // Below her despair (half HP, liaKit's bark), so the two lines never collide.
      onHpBelow: [{ unit: 'lia', below: 0.25, run: c => c.bark('lia', 'Nicht umfallen. Nicht jetzt.', 1800) }],
      triggers: [{
        id: 'e3-urmacht', when: ctx => { const v = ctx.unit('vamir'); return !duel(ctx).done && !!v && !v.down && finisherDue(v, duel(ctx).breaks); },
        run: finisher,
      }],
    }),
    onWin: async () => { grantOnce(DUEL_WON, () => {}); },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Per-attempt state and hooks
// ---------------------------------------------------------------------------------------------------------------

export interface DuelRun {
  /** The shield mechanic is on (Lia has her staff; without it nothing could break the shield). */
  shieldUsed: boolean;
  shield: boolean;
  breaks: number;
  done: boolean;
  bounced: boolean;
}

const runs = new WeakMap<object, DuelRun>();

export function duel(ctx: Pick<BattleCtx, 'battle'>): DuelRun {
  let r = runs.get(ctx.battle);
  if (!r) { r = { shieldUsed: false, shield: false, breaks: 0, done: false, bounced: false }; runs.set(ctx.battle, r); }
  return r;
}

const toward = (a: Point, b: Point): Facing =>
  Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? (b.x >= a.x ? 'e' : 'w') : (b.y >= a.y ? 's' : 'n');

function updateObjective(ctx: BattleCtx): void {
  const r = duel(ctx);
  ctx.setObjective('Stell dich Vamir', duelDetail(r.shieldUsed, r.shield, r.breaks));
}

/** Raises (or drops) the violet shield: Vamir's armour is the rule, the flare only shows it. */
export function setShield(ctx: Pick<BattleCtx, 'battle' | 'unit'>, on: boolean): void {
  const r = duel(ctx);
  const v = ctx.unit('vamir');
  if (!v || !r.shieldUsed) return;
  r.shield = on;
  v.def = on ? SHIELD_DEF : VAMIR_DEF;
  flare('vamir', VIOLET, on ? 32 : 44);
}

async function opening(ctx: BattleCtx, setup: DuelSetup): Promise<void> {
  runs.delete(ctx.battle);
  const r = duel(ctx);
  r.shieldUsed = setup.ownStaff;
  applyPoison(ctx.unit('lia'), setup.poisoned);
  // Ignatius took Vamir's blow just before (world tableau); here he sinks into the leaves.
  await ctx.focus('ignatius', 400);
  const ig = ctx.unit('ignatius');
  if (ig && !ig.down) {
    flare('ignatius', VIOLET, 26);
    await ctx.damage('ignatius', ig.hp);
    // He was struck just before (world tableau): only the dark stain spreads under him now.
    battleBlood('ignatius', { pool: true, strength: 0.8, hit: false });
  }
  await ctx.focus('vamir', 500);
  setShield(ctx, true);
  await ctx.say('e2-vamir', 'Da ist sie ja. Ohne Paladine, ohne Spitzohr.');
  await ctx.focus('lia', 400);
  await ctx.say('e3-lia', 'Geh weg von ihm.', { mood: 'angry' });
  await ctx.say('e2-vamir', 'Du hast mir heute einen Kreis aus zehn Ständern verdorben. Ich hätte gern etwas dafür.');
  if (setup.poisoned) await ctx.say('e3-lia', 'Meine Knie zittern. Egal. An ihn kommst du nicht mehr heran.', { mood: 'determined' });
  updateObjective(ctx);
}

async function onRound(ctx: BattleCtx, round: number, phase: string): Promise<void> {
  const r = duel(ctx);
  if (phase === 'player' && round === 1) {
    await liaCombatHint(ctx);
    if (r.shieldUsed) {
      await ctx.hint('Vamir hüllt sich in einen <em>violetten Schild</em>. Fast alles prallt daran ab. Nur der <em>Stabstrahl</em> aus deinem eigenen Stab bricht ihn.', { title: 'Violetter Schild', unit: 'vamir' });
      await ctx.hint('Jede zweite Runde verschwindet Vamir und taucht anderswo wieder auf, den Schild neu erhoben. Danach trifft alles, bis er wieder springt.', { title: 'Er springt', unit: 'lia' });
    } else {
      await ctx.hint('Ohne deinen Stab bleibt dir nur, was du hast. Halte Abstand und weich aus.', { title: 'Vamir', unit: 'lia' });
    }
  }
  if (phase === 'enemy' && teleportRound(round) && !r.done) await teleport(ctx, round);
}

const JUMP_LINES = ['Hier drüben.', 'Zu langsam.', 'Du zielst auf Schatten.'];

async function teleport(ctx: BattleCtx, round: number): Promise<void> {
  const v = ctx.unit('vamir'), lia = ctx.unit('lia');
  if (!v || v.down || !lia) return;
  const spot = teleportSpot(round, lia, v, TELEPORT_SPOTS, p => !ctx.battle.grid.standable(p.x, p.y) || !!ctx.battle.unitAt(p.x, p.y));
  if (!spot) return;
  flare('vamir', VIOLET, 38);
  ctx.shake(1);
  // The jump replaces his move; he still strikes from the new spot this turn.
  const u = await respawn(ctx, { ...vamirUnit(spot), facing: toward(spot, lia) }, { at: spot, keepTurn: true });
  if (u) u.moved = true;
  setShield(ctx, true);
  ctx.bark('vamir', JUMP_LINES[(round / TELEPORT_EVERY - 1) % JUMP_LINES.length], 1600);
  updateObjective(ctx);
}

async function onAction(ctx: BattleCtx, unit: Unit, ability: string, events: BattleEvent[]): Promise<void> {
  const r = duel(ctx);
  if (unit.id === 'vamir') {
    for (const e of events) if (e.type === 'strike' && e.hit) flare(e.target, VIOLET, 22);
    return;
  }
  if (unit.id !== 'lia' || r.done) return;
  if (r.shield && stabstrahlHitVamir(ability, events)) {
    setShield(ctx, false);
    r.breaks++;
    ctx.shake(2);
    flare('lia', TURQUOISE, 26);
    if (r.breaks === 1) ctx.bark('vamir', 'Hm. Das war neu.', 1800);
    if (r.breaks === 2) ctx.bark('vamir', 'Lass das.', 1600);
    updateObjective(ctx);
    return;
  }
  const bounced = r.shield && events.some(e => e.type === 'strike' && e.target === 'vamir' && e.hit);
  if (bounced && !r.bounced) {
    r.bounced = true;
    ctx.bark('lia', 'Es prallt einfach ab!', 1800);
  }
}

/** The Urmacht answers through Lia: turquoise burst, Vamir dissolves in violet. */
export async function finisher(ctx: BattleCtx): Promise<void> {
  const r = duel(ctx);
  if (r.done) return;
  r.done = true;
  ctx.flag(DUEL_FLAGS.finisher);
  const lia = ctx.unit('lia'), v = ctx.unit('vamir'), ig = ctx.unit('ignatius');
  if (lia && v && !v.down) {
    await ctx.tableau([
      { unit: 'lia', at: { x: lia.x, y: lia.y }, facing: toward(lia, v), pose: 'cast' },
      { unit: 'vamir', at: { x: v.x, y: v.y }, facing: toward(v, lia) },
      ...(ig ? [{ unit: 'ignatius', at: { x: ig.x, y: ig.y }, facing: toward(ig, lia), pose: 'kneel' as const }] : []),
    ], 'lia');
  }
  await ctx.say('e3-lia', 'Nein. Du rührst ihn nicht noch einmal an.', { mood: 'angry' });
  flare('lia', TURQUOISE, 40);
  await ctx.magicBurst('lia', v && !v.down ? 'vamir' : undefined);
  if (hasPlate('e3-vamir-fall')) {
    await ctx.ui.plate('e3-vamir-fall', { caption: 'Das Licht antwortet', pan: 'in', durationMs: 6000 });
    await ctx.wait(2600);
    await ctx.ui.closePlate();
  }
  if (ctx.unit('vamir') && (ctx.unit('vamir')!.x > -50)) {
    flare('vamir', VIOLET, 50);
    await ctx.wait(300);
    await ctx.remove('vamir');
  }
  if (ig) flare('ignatius', AMBER, 18);
  ctx.flag(DUEL_FLAGS.win);
}

// Battle „e2-ueberfall“ (docs/teil-2/umsetzung.md §3 e2-lagerangriff; quellenpruefung §4): dawn raid on the camp of
// the Free Brotherhood. Lia (exhausted after the test: half HP, the light silent, only Vaters Dolch and her own
// small means; at half HP her Verzweiflung is already awake) and Kyra must get from the tents to the
// rear water gate where the brook leaves the palisade; Flick, Elnon, Foltan and Azar hold the attackers (allies, all
// nonLethal). Dunkelschatten come in waves – over the gate, over the fence on the woodpile side, a crossbowman at the
// brook – and the scarred Baris arrives at the gate. Lose only when Lia is down; „Erneut versuchen“ on defeat.
// Winning gets Lia out of the camp; it never prevents the separation that follows in the world.
import { G } from '../../core/G';
import type { BattleCtx, BattleDef, BattleUnitDef, Point } from '../../tactics/api';
import type { CombatStats } from '../../tactics/rules/types';
import { characterStats, shadowStats } from '../common/battleCharacters';
import { liaAbilities, liaBudget, liaCombatHint, liaUnit, withLiaHooks, type LiaKitState } from '../common/liaKit';
import { TRAVEL_ABILITIES } from '../common/travelBattles';

/** The rear water gate: the brook tiles where it slips under the palisade. */
export const WATER_GATE: Point[] = [{ x: 0, y: 10 }, { x: 0, y: 11 }, { x: 1, y: 11 }];
const nearGate = (p: Point, d: number) => WATER_GATE.some(t => Math.abs(t.x - p.x) + Math.abs(t.y - p.y) <= d);

/** Elnon has no campaign profile in BATTLE_CHARACTERS: the elf captain of Ebaril, axe, steady. */
const ELNON: { level: number; baseStats: CombatStats } = { level: 9, baseStats: { maxHp: 22, maxMp: 6, atk: 3, def: 2, speed: 6 } };

/** What the alarm in the world decided (e2-lager-alarm). Lia's kit itself comes from common/liaKit. */
export interface RaidSetup {
  /** Lia brought Azar his sabre: he fights instead of only shoving. */
  azarSabre: boolean;
  /** Lia told Foltan the way to the brook: he holds the path instead of the gate. */
  foltanCovers: boolean;
}

export function raidSetupFromState(): RaidSetup {
  return {
    azarSabre: G.state.is('e2-alarm-azar'),
    foltanCovers: G.state.flag<string>('e2-alarm-foltan') === 'weg',
  };
}

/** „Das Licht schweigt“: in the raid Lia has her dagger and her own small means, never the Urmacht (not even Lichtstoß). */
export const RAID_LIA = { hpFraction: 0.5, light: false } as const;

/** Lia's specials in this battle (the dagger is her basic attack). */
export function liaRaidAbilities(state?: Partial<LiaKitState>): string[] {
  return liaAbilities({ ...RAID_LIA, state });
}

const shadow = (o: Partial<BattleUnitDef> & Pick<BattleUnitDef, 'id' | 'x' | 'y'>): BattleUnitDef => {
  const preset = o.preset ?? 'shadow-sword';
  return {
    name: 'Dunkelschatten', team: 'enemy', ...shadowStats(preset), move: 4, jump: 2,
    abilities: [preset === 'shadow-spear' ? 'speerstoss' : preset === 'shadow-crossbow' ? 'bolzen' : preset === 'shadow-club' ? 'wuchtschlag' : 'schwerthieb'],
    preset, ai: preset === 'shadow-crossbow' ? 'archer' : 'melee', facing: 'w', nonLethal: true,
    title: 'Schwarz-weißer Wappenrock, im Morgengrauen über den Zaun', ...o,
  };
};

const ally = (o: Omit<BattleUnitDef, 'team'>): BattleUnitDef => ({ ai: 'guard', guardRadius: 3, nonLethal: true, ...o, team: 'ally' });

export function raidBattle(setup: RaidSetup = raidSetupFromState()): BattleDef {
  const units: BattleUnitDef[] = [
    liaUnit('e2-ueberfall', { x: 4, y: 2, facing: 's',
      title: 'Seit der Prüfung zittern ihr die Knie. Das Licht schweigt, der Dolch nicht.' }, RAID_LIA),
    { id: 'kyra', name: 'Kyra', ...characterStats('kyra'), team: 'player', x: 3, y: 2, facing: 's', move: 4, jump: 2,
      abilities: ['schubsen', 'ausweichen', 'steinwurf'], preset: 'kyra', portrait: 'kyra', nonLethal: true,
      title: 'Wer an ihre Schwester will, muss erst an ihr vorbei' },
    ally({ id: 'flick', name: 'Flick', ...characterStats('flick'), x: 5, y: 1, facing: 'e', move: 5, jump: 3,
      abilities: ['bogen', 'messer'], preset: 'flick', portrait: 'flick', guardRadius: 4, title: 'Bleibt zurück. Natürlich.' }),
    ally({ id: 'elnon', name: 'Elnon', ...ELNON, x: 9, y: 1, facing: 'n', move: 4, jump: 2,
      abilities: ['axthieb', 'decken'], preset: 'elnon', portrait: 'elnon', title: 'Anführer der Freien Bruderschaft' }),
    ally(setup.foltanCovers
      ? { id: 'foltan', name: 'Foltan', ...characterStats('foltan'), x: 4, y: 6, facing: 'e', move: 4, jump: 2,
        abilities: ['schwerthieb', 'bolzen'], preset: 'foltan', portrait: 'foltan', guardRadius: 2, title: 'Hält euch den Weg zum Bach frei' }
      : { id: 'foltan', name: 'Foltan', ...characterStats('foltan'), x: 10, y: 2, facing: 'n', move: 4, jump: 2,
        abilities: ['schwerthieb', 'bolzen'], preset: 'foltan', portrait: 'foltan', title: 'Früher Stadtgarde. Heute Tor.' }),
    ally({ id: 'azar', name: 'Azar', ...characterStats('azar'), x: 8, y: 3, facing: 'e', move: 3, jump: 1,
      abilities: setup.azarSabre ? ['schwerthieb', 'decken', 'versorgen'] : ['schubsen', 'decken', 'versorgen'],
      preset: 'azar', portrait: 'azar', title: setup.azarSabre ? 'Mit seinem Säbel. Lia hat ihn gefunden.' : 'Ohne Säbel. Dafür mit Schöpfkelle.' }),
    shadow({ id: 'ds-1', x: 10, y: 0, facing: 's' }),
    shadow({ id: 'ds-2', x: 11, y: 1, preset: 'shadow-spear', facing: 'w' }),
    shadow({ id: 'ds-3', x: 11, y: 0, preset: 'shadow-club', facing: 'w' }),
  ];
  return {
    id: 'e2-ueberfall',
    title: 'Überfall im Morgengrauen',
    subtitle: 'Zum hinteren Bachdurchlass',
    victoryText: 'Lia und Kyra schlüpfen unter der Palisade hindurch in den dunklen Wald.',
    defeatText: 'Lia ist gestürzt. Ausweichen und Ablenken halten sie auf den Beinen, der Dolch hält Verfolger nur kurz auf. Kyra kann sie wegschubsen, die anderen halten euch den Rücken frei.',
    backdrop: 'night',
    ambience: ['battle-far', 'night', 'stream'],
    music: 'battle',
    seed: 6206,
    map: {
      trees: 'mixed',
      ground: 'forest',
      height: [
        '2 2 2 1 1 1 1 1 1 1 1 1',
        '2 2 1 1 1 1 1 1 1 1 1 1',
        '2 1 1 1 1 1 1 1 1 1 1 1',
        '1 1 1 1 1 1 1 1 1 1 1 1',
        '1 1 1 1 1 1 1 1 1 1 1 1',
        '1 1 1 1 1 1 1 1 1 1 1 1',
        '1 1 1 1 1 1 1 1 1 1 1 1',
        '1 1 1 1 1 1 1 1 1 1 1 1',
        '0 1 1 1 1 1 1 1 1 1 1 1',
        '0 0 1 1 1 1 1 1 1 1 1 1',
        '0 0 0 1 1 1 1 1 1 1 1 1',
        '0 0 0 0 1 1 1 1 1 1 1 1',
      ],
      terrain: [
        'T T r . . T . . r , , ,',
        'T . . . . . . . . , , ,',
        'r . . . . r . . , , . .',
        '. . b . . . . , , . . r',
        '. . . . r , r , . . . .',
        '. r . . , r , . . b . .',
        '. . . , , , . . . . . T',
        '. . b , . . . r . . . .',
        '~ . . , . b . . . . b .',
        '~ ~ . , . . . . T . . .',
        '~ ~ ~ . b . . . . . . T',
        '~ ~ ~ ~ . . T . . r . T',
      ],
      paint: [
        '. . . . . . . . . d d d',
        '. . . . . . . . d d d .',
        '. . . . . . . d d . . .',
        '. . . . . . d d . . . .',
        '. . . . . d . . . . . .',
        '. . . . d . . . . . . .',
        '. . . d d d . . . . . .',
        '. . . d . . . . . . . .',
        '. . . d . . . . . . . .',
        '. . d d . . . . . . . .',
        '. . . . . . . . . . . .',
        '. . . . . . . . . . . .',
      ],
      props: [
        { x: 5, y: 5, prop: 'firering' },
        { x: 2, y: 0, prop: 'crate' },
        { x: 8, y: 0, prop: 'crate', variant: 1 },
        { x: 0, y: 2, prop: 'rock' },
        { x: 5, y: 2, prop: 'barrel' },
        { x: 4, y: 4, prop: 'crate' },
        { x: 6, y: 4, prop: 'barrel' },
        { x: 1, y: 5, prop: 'barrel' },
        { x: 7, y: 7, prop: 'crate', variant: 1 },
        { x: 11, y: 3, prop: 'crate' },
        { x: 9, y: 11, prop: 'rock', variant: 2 },
        { x: 9, y: 2, prop: 'banner-light' },
        { x: 3, y: 10, prop: 'stake' },
        { x: 0, y: 7, prop: 'stake', variant: 1 },
      ],
    },
    units,
    goalTiles: WATER_GATE,
    abilities: TRAVEL_ABILITIES,
    progression: {
      actionExp: 4, defeatExp: 6, actionAp: 1, victoryExp: 20, victoryAp: 4,
      budgets: {
        lia: liaBudget('e2-ueberfall'), kyra: { exp: 30, ap: 8 },
        flick: { exp: 0, ap: 0 }, elnon: { exp: 0, ap: 0 }, foltan: { exp: 0, ap: 0 }, azar: { exp: 0, ap: 0 },
      },
    },
    waves: [
      { round: 2, text: 'Über den Zaun am Holzstapel!', units: [
        shadow({ id: 'ds-4', x: 11, y: 7, facing: 'w' }),
        shadow({ id: 'ds-5', x: 11, y: 8, preset: 'shadow-club', facing: 'w' }),
      ] },
      { round: 3, text: 'Am Bach! Einer mit Armbrust!', units: [
        shadow({ id: 'ds-6', x: 8, y: 11, preset: 'shadow-crossbow', facing: 'n', move: 3 }),
        shadow({ id: 'ds-7', x: 11, y: 5, preset: 'shadow-spear', facing: 'w' }),
      ] },
    ],
    objective: {
      text: 'Zum hinteren Bachdurchlass',
      detail: 'Lia muss die goldenen Fahnen am Bach erreichen. Fällt Lia, ist alles verloren. Die anderen halten den Rest auf.',
      win: [{ type: 'reach', tiles: WATER_GATE, unit: 'lia' }],
      lose: [{ type: 'unitDown', units: ['lia'] }],
    },
    hooks: withLiaHooks({
      onStart: opening,
      onRound: async (ctx, round, phase) => {
        if (phase !== 'player') return;
        if (round === 1) {
          await liaCombatHint(ctx);
          await ctx.hint('Lia ist erschöpft: halbe Lebenspunkte, und das Licht in ihr schweigt. Bring sie zu den <em>goldenen Fahnen</em> am Bach.', { title: 'Flucht', unit: 'lia' });
          await ctx.hint('Die <em>Verzweiflung</em> ist schon wach: Ihr Dolch trifft jetzt härter. Trotzdem gilt: laufen, nicht siegen. <em>Ausweichen</em> lässt Hiebe ins Leere gehen, ein <em>Stein</em> stößt Verfolger zurück, Kyra kann <em>schubsen</em>. Flick, Elnon, Foltan und Azar kämpfen von selbst.', { title: 'Nur raus hier', unit: 'kyra' });
        }
        if (round === 2) ctx.bark('elnon', 'Das Tor hält! Noch!', 1800);
        if (round === 4 && !ctx.hasFlag('e2-baris')) await barisArrives(ctx);
        if (round === 6 && ctx.hasFlag('e2-baris') && !ctx.hasFlag('e2-baris-jagd')) {
          ctx.flag('e2-baris-jagd');
          const b = ctx.unit('baris');
          if (b && !b.down) {
            ctx.setAi('baris', { target: 'lia' });
            ctx.bark('baris', 'Genug mit den Spitzohren. Das Mädchen!', 2200);
            ctx.setObjective('Zum hinteren Bachdurchlass', 'Baris hat Lia entdeckt. Lauf!');
          }
        }
      },
      onMove: async (ctx, unit) => {
        if (unit.id === 'lia' && !ctx.hasFlag('e2-nah') && nearGate(unit, 3)) {
          ctx.flag('e2-nah');
          ctx.bark('kyra', 'Da vorn, wo das Wasser rauscht!', 2000);
        }
      },
      onUnitDown: async (ctx, unit, kind) => {
        if (unit.id === 'kyra') {
          ctx.flag('e2-kyra-gestuerzt'); // battle flag: only the won attempt counts (startRaid copies it)
          ctx.bark('kyra', 'Lauf weiter, Lia! Ich komm nach!', 2400);
          return;
        }
        if (unit.id === 'flick') { ctx.bark('flick', 'Nicht umdrehen, Leseratte!', 2000); return; }
        if (unit.id === 'elnon') { ctx.bark('elnon', 'Haltet … das Tor …', 2000); return; }
        if (unit.id === 'foltan') { ctx.bark('foltan', 'Bin gleich wieder oben. Gleich.', 2000); return; }
        if (unit.id === 'azar') { ctx.bark('azar', 'Wer liegt, kann nicht fallen!', 2000); return; }
        if (unit.id === 'baris') { ctx.bark('baris', 'Das … zahl ich euch heim.', 2200); return; }
        if (kind === 'wounded' && unit.team === 'enemy') ctx.bark(unit.id, 'Für den Sold? Nicht mit mir.', 1500);
      },
      onHpBelow: [
        { unit: 'lia', below: 0.35, run: c => c.bark('lia', 'Nur noch … ein paar Schritte …', 2000) },
        { unit: 'kyra', below: 0.5, run: c => c.bark('kyra', 'Mein Knöchel! Egal. Weiter!', 1800) },
      ],
    }),
    onWin: async ctx => {
      await ctx.focus('lia', 300);
      await ctx.say('kyra', 'Rein ins Wasser, Kopf runter! Unter dem Zaun durch!', { mood: 'determined' });
    },
  };
}

async function opening(ctx: BattleCtx): Promise<void> {
  await ctx.focus('ds-1', 400);
  await ctx.say('elnon', 'Schilde ans Tor! Keiner kommt hier rein, solange ich stehe!', { mood: 'angry' });
  await ctx.focus('flick', 400);
  await ctx.say('flick', 'Lia, Kyra: hinten raus, am Bach entlang. Um die Schwarzröcke kümmere ich mich.', { mood: 'determined' });
  await ctx.focus('lia', 300);
  await ctx.say('e2-lia', 'Meine Beine sind aus Pudding. Und in mir ist es still. Ganz still.', { mood: 'scared' });
  await ctx.say('kyra', 'Dann trag ich dich eben. Notfalls auf dem Rücken. Los!', { mood: 'determined' });
}

async function barisArrives(ctx: BattleCtx): Promise<void> {
  ctx.flag('e2-baris');
  await ctx.spawn([
    { id: 'baris', name: 'Baris', ...characterStats('baris'), team: 'enemy', x: 11, y: 1, facing: 'w', move: 3, jump: 1,
      abilities: ['axthieb', 'wuchtschlag'], nonLethal: true, preset: 'baris-scarred', portrait: 'baris-scarred', ai: 'melee',
      title: 'Hauptmann der Dunkelschatten. Eine Gesichtshälfte verbrannt.' },
    shadow({ id: 'ds-8', x: 10, y: 0, facing: 's' }),
  ], { banner: 'Baris kommt durchs Tor!' });
  await ctx.focus('baris', 400);
  await ctx.say('e2-baris', 'Die vom Feuer ist hier irgendwo. Lebend, ihr Hunde! Der Meister will sie ganz.', { mood: 'angry' });
  await ctx.say('elnon', 'Der Hauptmann selbst. Dann bleibt er eben an mir hängen.', { mood: 'grim' });
  ctx.setAi('baris', { target: 'elnon' });
  ctx.setObjective('Zum hinteren Bachdurchlass', 'Baris ist am Tor. Elnon hält ihn auf. Noch.');
}

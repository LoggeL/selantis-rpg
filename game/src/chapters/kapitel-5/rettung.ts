// Kapitel V, Szene 4 „rettung“: FFTA tactics at the lone oak. Lia (Vaters Dolch, Ausweichen, Ablenken, Stein werfen) and
// Flick (bow, knife) against Baris' men. The wet rope needs two cuts (with Vaters Dolch Lia can cut too: faster).
// Kyra must reach the forest edge; then Orwen and Baris return. Climax: Flick is down, Baris raises the axe
// („Halt still, Spitzohr. Dann geht’s schneller.“), Lia screams, her eyes glow blue, the turquoise Urmacht throws Baris away, the
// Dunkelschatten flee, Lia collapses. The bluff points (flag 'k5-ablenkung') shape the opening.
import { G } from '../../core/G';
import { characterStats, shadowStats } from '../common/battleCharacters';
import { DESPAIR_FLAG, liaBudget, liaCombatHint, liaDespairs, liaUnit, withLiaHooks } from '../common/liaKit';
import { TRAVEL_ABILITIES } from '../common/travelBattles';
import type { AbilityDef, BattleCtx, BattleDef, BattleUnitDef, TacticsStartData } from '../../tactics/api';
import { rescueSetup } from './bluff';
import { ui } from './common';

export const GOAL = [{ x: 0, y: 4 }, { x: 0, y: 5 }, { x: 0, y: 6 }, { x: 0, y: 8 }];
const onGoal = (p: { x: number; y: number }) => GOAL.some(t => t.x === p.x && t.y === p.y);

const CUT_BASE = {
  kind: 'interact', target: 'bound', range: [1, 1], shape: { type: 'single' }, power: 0, accuracy: 100, alwaysHits: true, vfx: 'free',
} as const;

export const RESCUE_ABILITIES: Record<string, AbilityDef> = {
  'k5-schneiden': { ...CUT_BASE, id: 'k5-schneiden', name: 'Fesseln schneiden', description: 'Das nasse Hanfseil ist dick: Der erste Schnitt reicht nicht. Danach ist nur noch ein Strang übrig.', range: [1, 1] },
  'k5-losschneiden': { ...CUT_BASE, id: 'k5-losschneiden', name: 'Losschneiden', frees: true, description: 'Den letzten Strang durchtrennen. Kyra ist frei.', range: [1, 1] },
};

const shadow = (o: Partial<BattleUnitDef> & Pick<BattleUnitDef, 'id' | 'x' | 'y'>): BattleUnitDef => ({
  name: 'Dunkelschatten', team: 'enemy', ...shadowStats(o.preset), move: 4, jump: 2, abilities: ['schwerthieb'],
  preset: 'shadow-sword', ai: 'melee', facing: 'w', nonLethal: true, ...o,
});

/** Builds the battle for the current state (bluff points, dagger). */
export function rescueBattle(points = Number(G.state.flag('k5-ablenkung') ?? 1), hasDagger = G.state.has('dagger')): BattleDef {
  const setup = rescueSetup(points, hasDagger);
  const units: BattleUnitDef[] = [
    liaUnit('k5-rettung', { x: 5, y: 7, facing: 'e', tags: ['vip'], title: 'Ihre Eltern hat sie verloren. Kyra gibt sie nicht her.' }, { extra: setup.liaExtra }),
    { id: 'flick', ...characterStats('flick'), name: 'Flick', title: 'Fährtenleserin. Die beste, sagt sie.', team: 'player', x: setup.flick.x, y: setup.flick.y, facing: 'w', move: 5, jump: 3,
      abilities: setup.flickAbilities, nonLethal: true, preset: 'flick' },
    { id: 'kyra', ...characterStats('kyra'), name: 'Kyra', title: 'Gefesselt an die Eiche, geknebelt, wütend', team: 'ally', x: 7, y: 4, facing: 's', move: 4, jump: 2,
      abilities: ['schubsen', 'ausweichen'], statuses: { bound: Infinity }, freedTeam: 'player', preset: 'kyra', boundPreset: 'kyra-bound', tags: ['vip', 'spared'] },
    shadow({ id: 'algard', ...characterStats('algard'), name: 'Algard', title: 'Der Narbige, Spötter und Trinker', x: 4, y: 6, facing: 'e', preset: 'algard', portrait: 'algard' }),
    shadow({ id: 'maedchen', ...characterStats('maedchen'), name: '„Mädchen“', title: 'Kahlgeschoren, mit Spieß und verletztem Stolz', x: 6, y: 8, facing: 'n', abilities: ['speerstoss'], preset: 'maedchen', portrait: 'maedchen' }),
    shadow({ id: 'schuetze', name: 'Armbrustschütze', title: 'Dunkelschatten mit Armbrust', x: 10, y: 1, move: 3, abilities: ['bolzen'], ai: 'archer', preset: 'shadow-crossbow', facing: 's' }),
  ];
  return {
    id: 'k5-rettung',
    title: 'Am Baum über den Feldern',
    subtitle: 'Befreit Kyra',
    victoryText: 'Die Dunkelschatten fliehen in die Nacht.',
    defeatText: 'Lia ist gestürzt. Ausweichen und Ablenken halten sie am Leben, Vaters Dolch trifft von hinten am sichersten. Flick hält die Wachen auf Abstand.',
    backdrop: 'dusk',
    ambience: ['wind', 'fire', 'crickets'],
    music: 'battle',
    seed: 516,
    progression: { actionExp: 10, defeatExp: 25, actionAp: 2, victoryExp: 40, victoryAp: 4, budgets: { lia: liaBudget('k5-rettung') } },
    abilities: { ...TRAVEL_ABILITIES, ...RESCUE_ABILITIES },
    map: {
      trees: 'mixed',
      ground: 'dry',
      height: [
        '111122222110',
        '111223332210',
        '111223332210',
        '111122332210',
        '111122222110',
        '111112221100',
        '111111111000',
        '111111100000',
        '111100000000',
        '111000000000',
        '110000000000',
      ],
      terrain: [
        'TT.rr..b..bb',
        'T..........b',
        'T.b.........',
        'T......T..b.',
        '....b.,,....',
        '.....,,,,...',
        '....,,f,..bb',
        'T....,,..bbb',
        '..b.....bbbb',
        'T.......bbbb',
        'TT.....bbbbb',
      ],
      paint: [
        '............',
        '............',
        '............',
        '............',
        '......dd....',
        '.....dddd...',
        '....dddd....',
        '.....dd.....',
        '......d.....',
        '.......d....',
        '........d...',
      ],
      props: [
        { x: 7, y: 3, prop: 'tree-oak' },
        { x: 6, y: 6, prop: 'campfire' },
        { x: 9, y: 5, prop: 'crate' },
        { x: 3, y: 0, prop: 'rock' },
        { x: 4, y: 0, prop: 'rock', variant: 1 },
      ],
    },
    units,
    goalTiles: GOAL,
    objective: {
      text: 'Befreit Kyra',
      detail: setup.firstCutDone ? 'Flick hat schon einen Strang durch. Noch ein Schnitt! Lia darf nicht fallen.' : 'Das Seil braucht zwei Schnitte. Lia darf nicht fallen.',
      win: [{ type: 'flag', flag: 'k5-urmacht' }],
      lose: [{ type: 'unitDown', units: ['lia'] }],
    },
    hooks: withLiaHooks({
      onStart: ctx => opening(ctx, setup.guardsSkipFirst, setup.firstCutDone, hasDagger),
      onRound: async (ctx, round, phase) => {
        if (round === 1 && phase === 'player') {
          await liaCombatHint(ctx);
          await ctx.hint('Gegen die Dunkelschatten ist Lia noch die Schwächste. <em>Ablenken</em> zieht die Wachen auf sie und lässt sie besser ausweichen, <em>Ausweichen</em> lässt Hiebe ins Leere gehen, ein <em>Stein</em> stößt Feinde weg. Zustechen lohnt sich vor allem von hinten.', { title: 'Lia', unit: 'lia' });
          await ctx.hint(hasDagger
            ? 'Wer neben Kyra steht, kann die <em>Fesseln schneiden</em>. Zwei Schnitte sind nötig. Mit Vaters Dolch kann auch Lia schneiden, so geht es doppelt so schnell.'
            : 'Flick steht neben Kyra und kann die <em>Fesseln schneiden</em>. Das nasse Seil braucht zwei Schnitte, einen pro Runde.', { title: 'Kyra', unit: 'kyra' });
        }
        if (phase === 'enemy' && ctx.hasFlag('k5-skip') && round === 1) {
          ctx.bark('algard', 'Wo kam das denn her?', 1600);
        }
        if (phase === 'player' && round === 2) for (const id of ['algard', 'maedchen', 'schuetze']) ctx.setAi(id, null);
        if (phase === 'player' && !ctx.hasFlag('k5-baris') && round >= 5) await barisArrives(ctx);
        // Baris gets one or two enemy phases to reach Flick; then the climax happens no matter what.
        if (phase === 'player' && ctx.hasFlag('k5-baris') && !ctx.hasFlag('k5-urmacht')) {
          if (ctx.hasFlag('k5-baris-gewartet')) await climax(ctx);
          else ctx.flag('k5-baris-gewartet');
        }
      },
      onAction: async (ctx, info) => {
        if (info.ability === 'k5-schneiden') {
          G.audio.sfx('rope-cut');
          for (const id of ['flick', 'lia']) {
            const u = ctx.unit(id);
            if (u) u.abilities = u.abilities.map(a => (a === 'k5-schneiden' ? 'k5-losschneiden' : a));
          }
          ctx.bark(info.unit.id, info.unit.id === 'lia' ? 'Einer ist durch!' : 'Halb durch. Nasses Mistseil.', 1800);
          ctx.setObjective('Befreit Kyra', 'Noch ein Schnitt! Wer neben Kyra steht, kann sie losschneiden.');
        }
      },
      onFree: async (ctx, unit, by) => {
        if (unit.id !== 'kyra') return;
        G.audio.sfx('rope-cut');
        await ctx.say('kyra', by.id === 'lia' ? 'Mmpf! … Lia?! Ist das … Vaters Dolch?' : 'Mmpf! … Wer bist du? Und warum grinst du so?', { mood: 'surprised' });
        if (by.id === 'lia') await ctx.say('k5-lia', 'Später. Lauf zum Waldrand und dreh dich nicht um.', { mood: 'determined' });
        else await ctx.say('flick', 'Deine Schwester hat mich angeheuert. Umsonst, leider. Lauf! Zum Waldrand!', { mood: 'determined' });
        ctx.setObjective('Bringt Kyra zum Waldrand', 'Kyra muss die goldenen Felder im Westen erreichen. Wer ihr den Weg verstellt: Stein werfen oder Schubsen!');
        ctx.bark('maedchen', 'Sie haut ab! Fangen, nicht anfassen!', 2400);
        const m = ctx.unit('maedchen');
        if (m && !m.down) ctx.setAi('maedchen', { block: 'kyra', goal: { x: 0, y: 5 } });
        await ctx.hint('Die Wachen dürfen Kyra nichts tun, aber „Mädchen“ stellt sich ihr in den Weg. Ein <em>Stein</em> oder Kyras <em>Schubsen</em> stößt ihn beiseite.', { title: 'Zum Waldrand', unit: 'kyra' });
      },
      onMove: async (ctx, unit) => {
        if (unit.id === 'kyra' && onGoal(unit) && !ctx.hasFlag('k5-baris')) await barisArrives(ctx);
      },
      onUnitDown: async (ctx, unit, kind) => {
        if (unit.id === 'flick' && kind === 'wounded' && !ctx.hasFlag('k5-urmacht')) {
          if (!ctx.hasFlag('k5-baris')) await barisArrives(ctx);
          await climax(ctx);
          return;
        }
        if (kind === 'wounded' && ['algard', 'maedchen', 'schuetze'].includes(unit.id)) ctx.bark(unit.id, 'Für den Sold steh ich nicht auf.', 1600);
      },
      onHpBelow: [
        { unit: 'flick', below: 0.45, run: c => c.bark('flick', 'Wird eng hier. Gefällt mir nicht.', 1800) },
      ],
      triggers: [{
        // Her first real wound still draws a sore, bookish complaint. Once her Verzweiflung wakes (half HP or less),
        // the shared despair bark speaks for her instead: Kyra is the one person she has left.
        id: 'k5-lia-erste-wunde',
        when: c => {
          const u = c.unit('lia');
          return !!u && !u.down && u.hp < u.maxHp * 0.75 && !liaDespairs(c) && !c.hasFlag(DESPAIR_FLAG);
        },
        run: c => c.bark('lia', 'In Büchern tut das weniger weh.', 2200),
      }],
    }),
  };
}

async function opening(ctx: BattleCtx, skip: boolean, firstCut: boolean, hasDagger: boolean): Promise<void> {
  await ctx.focus('lia', 300);
  await ctx.say('algard', 'Pfeile aus dem Dunkeln. Und du weißt von nichts, was?', { mood: 'angry' });
  await ctx.focus('flick', 400);
  if (firstCut) await ctx.say('flick', 'Ein Strang ist durch. Erzähl ihnen noch was vom Markt, Leseratte!', { mood: 'determined' });
  else await ctx.say('flick', 'Jetzt, Leseratte! Mach Lärm. Viel Lärm.', { mood: 'determined' });
  if (skip) {
    ctx.flag('k5-skip');
    for (const id of ['algard', 'maedchen', 'schuetze']) ctx.setAi(id, { skip: true });
    await ctx.say('narrator', 'Die Wachen glotzen Lia noch an, als hätte sie ihnen ein Rätsel aufgegeben. Einen Atemzug lang gehört der Vorsprung dir.');
  } else {
    await ctx.say('maedchen', 'Hinterhalt! Hab ich’s nicht gesagt? Aber auf mich hört ja keiner.', { mood: 'angry' });
  }
  void hasDagger;
  await ctx.focus('kyra', 300);
}

async function barisArrives(ctx: BattleCtx): Promise<void> {
  if (ctx.hasFlag('k5-baris')) return;
  ctx.flag('k5-baris');
  await ctx.spawn([
    { id: 'baris', ...characterStats('baris'), name: 'Baris', title: 'Hauptmann der Dunkelschatten', team: 'enemy', x: 2, y: 1, facing: 's', move: 4, jump: 1,
      abilities: ['axthieb', 'wuchtschlag'], nonLethal: true, preset: 'baris', portrait: 'baris', ai: 'melee' },
    shadow({ id: 'orwen', ...characterStats('orwen'), name: 'Orwen', title: 'Baris’ rechte Hand, der Grauhaarige', x: 1, y: 2, facing: 's', move: 4, preset: 'orwen', portrait: 'orwen' }),
  ], { banner: 'Baris und Orwen kehren zurück!' });
  await ctx.say('baris', 'Kaum dreh ich mich um, und zwei Mädchen räumen mein Lager auf.', { mood: 'angry' });
  await ctx.say('orwen', 'Die Kleine vom Feuer. Ich hab doch gleich gerochen, dass die nach Ärger stinkt.', { mood: 'smirk' });
  await ctx.say('baris', 'Die Gefangene rührt keiner an. Das Spitzohr … das ist meins.', { mood: 'angry' });
  ctx.setAi('baris', { target: 'flick' });
  ctx.setAi('orwen', { target: 'lia' });
  ctx.setObjective('Haltet stand!', 'Baris will Flick. Lenk ihn ab, weich aus, haltet durch.');
}

/** Flick down, the axe raised, Lia screams: the Urmacht breaks free. */
async function climax(ctx: BattleCtx): Promise<void> {
  if (ctx.hasFlag('k5-urmacht-start')) return;
  ctx.flag('k5-urmacht-start');
  await ctx.tableau([
    { unit: 'lia', at: { x: 5, y: 6 }, facing: 's' },
    { unit: 'kyra', at: { x: 4, y: 6 }, facing: 'e' },
    { unit: 'flick', at: { x: 7, y: 6 }, facing: 'w' },
    { unit: 'baris', at: { x: 8, y: 6 }, facing: 'w' },
    { unit: 'orwen', at: { x: 5, y: 4 }, facing: 's' },
    { unit: 'algard', at: { x: 3, y: 6 }, facing: 'e' },
    { unit: 'maedchen', at: { x: 5, y: 9 }, facing: 'n' },
    { unit: 'schuetze', at: { x: 8, y: 4 }, facing: 'w' },
  ], 'lia');
  const flick = ctx.unit('flick')!;
  if (!flick.down) {
    await ctx.focus('baris', 300);
    ctx.pose('baris', 'attack');
    G.audio.sfx('hit-heavy');
    await ctx.damage('flick', flick.hp);
  }
  await ctx.focus('flick', 400);
  ctx.pose('flick', 'fall');
  // Baris is already beside Flick in the tableau. Keep combat positions intact.
  const b = ctx.unit('baris');
  if (b && !b.down) {
    ctx.pose('baris', 'attack');
  }
  await ctx.say('baris', 'Halt still, Spitzohr. Dann geht’s schneller.', { mood: 'smirk' });
  await ctx.focus('lia', 250);
  ctx.pose('lia', 'cast');
  await ctx.say('k5-lia', 'Nein – FLICK!', { mood: 'scared' });
  await ctx.magicBurst('lia', 'baris');
  ctx.flag('k5-urmacht-exploded');
  await ctx.ui.plate('k5-urmacht', { caption: 'Die Urmacht', pan: 'out', durationMs: 9000 });
  await ctx.say('narrator', 'Etwas in Lia bricht auf. Ihre Augen glühen blau, ~türkises Licht~ rollt von ihr fort, drückt das Gras flach und reißt der Eiche das Laub ab.');
  await ctx.say('narrator', 'Baris fliegt wie ein Strohsack durch die Luft und schlägt zehn Schritte weiter ins Feld. Seine Axt wirbelt davon in die Nacht.');
  await ctx.ui.closePlate();
  ctx.shake(2);
  for (const u of ctx.battle.living('enemy')) {
    if (u.id === 'baris') continue;
    await ctx.damage(u.id, 2);
  }
  await ctx.banner('Die Dunkelschatten fliehen!');
  for (const id of ['orwen', 'algard', 'maedchen', 'schuetze']) {
    const u = ctx.unit(id);
    if (u && u.x > -50) { ctx.bark(id, id === 'orwen' ? 'Weg hier! Alle weg!' : 'Hexerei!', 1200); await ctx.remove(id); }
  }
  if (ctx.unit('baris') && ctx.unit('baris')!.x > -50) await ctx.remove('baris');
  if (ctx.unit('kyra')?.statuses.bound) G.state.set('k5-kyra-spaet-befreit');
  ctx.pose('lia', 'fall');
  await ctx.say('narrator', 'Auf einmal zirpen wieder die Grillen. Lias Knie geben nach, und das Gras kommt ihr entgegen.');
  ctx.flag('k5-urmacht');
}

export function startRescue(): void {
  G.stopGameplayScenes();
  ui().prefetchPlate('k5-urmacht');
  G.game.scene.start('Tactics', {
    battle: rescueBattle(),
    onEnd: async result => {
      if (result.outcome !== 'win') return;
      G.state.learn('urmacht');
      G.state.set('k5-urmacht');
      G.state.setParty(['flick', 'kyra']);
      await G.ui.fade('out', 1200, '#000');
      await G.goto('finale');
    },
  } satisfies TacticsStartData);
}

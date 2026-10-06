// Kapitel V, Szene 4 „rettung“: FFTA tactics at the lone oak. Lia (Ausweichen, Ablenken, Stein werfen, Dolch) and
// Flick (bow, knife) against Baris' men. The wet rope needs two cuts (with Vaters Dolch Lia can cut too: faster).
// Kyra must reach the forest edge; then Orwen and Baris return. Climax: Flick is down, Baris raises the axe
// („Jetzt ist's aus, Spitzohr!“), Lia screams, her eyes glow blue, the turquoise Urmacht throws Baris away, the
// Dunkelschatten flee, Lia collapses. The bluff points (flag 'k5-ablenkung') shape the opening.
import { G } from '../../core/G';
import { characterStats, shadowStats } from '../common/battleCharacters';
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
    { id: 'lia', ...characterStats('lia'), name: 'Lia', title: 'Keine Kämpferin. Aber sie gibt nicht auf.', team: 'player', x: 5, y: 7, facing: 'e', move: 4, jump: 2,
      abilities: setup.lia, preset: 'lia-cloak', portrait: 'lia-cloak', tags: ['vip'] },
    { id: 'flick', ...characterStats('flick'), name: 'Flick', title: 'Die beste Fährtenleserin südlich von Trapas', team: 'player', x: setup.flick.x, y: setup.flick.y, facing: 'w', move: 5, jump: 3,
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
    defeatText: 'Lia ist gestürzt. Ausweichen und Ablenken halten sie am Leben. Lass Flick die harte Arbeit machen.',
    backdrop: 'dusk',
    ambience: ['wind', 'fire', 'crickets'],
    music: 'battle',
    seed: 516,
    progression: { budgets: { lia: { exp: 30, ap: 8, maxLevel: 3 } } },
    abilities: RESCUE_ABILITIES,
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
    hooks: {
      onStart: ctx => opening(ctx, setup.guardsSkipFirst, setup.firstCutDone, hasDagger),
      onRound: async (ctx, round, phase) => {
        if (round === 1 && phase === 'player') {
          await ctx.hint('Lia ist keine Kämpferin. <em>Ablenken</em> zieht die Wachen auf sie und lässt sie besser ausweichen, <em>Ausweichen</em> lässt Hiebe ins Leere gehen, ein <em>Stein</em> stößt Feinde weg.', { title: 'Lia', unit: 'lia' });
          await ctx.hint(hasDagger
            ? 'Wer neben Kyra steht, kann die <em>Fesseln schneiden</em>. Zwei Schnitte sind nötig. Mit Vaters Dolch kann auch Lia schneiden, so geht es doppelt so schnell.'
            : 'Flick steht neben Kyra und kann die <em>Fesseln schneiden</em>. Das nasse Seil braucht zwei Schnitte, einen pro Runde.', { title: 'Kyra', unit: 'kyra' });
        }
        if (phase === 'enemy' && ctx.hasFlag('k5-skip') && round === 1) {
          ctx.bark('algard', 'Was … was war das?', 1600);
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
          ctx.bark(info.unit.id, info.unit.id === 'lia' ? 'Ein Strang durch!' : 'Einer durch. Noch einer!', 1800);
          ctx.setObjective('Befreit Kyra', 'Noch ein Schnitt! Wer neben Kyra steht, kann sie losschneiden.');
        }
      },
      onFree: async (ctx, unit, by) => {
        if (unit.id !== 'kyra') return;
        G.audio.sfx('rope-cut');
        await ctx.say('kyra', by.id === 'lia' ? 'Mmmpf! … Lia?! Was machst du denn hier?' : 'Mmmpf! … Wer bist du denn?', { mood: 'surprised' });
        if (by.id === 'lia') await ctx.say('k5-lia', 'Dich retten! Lauf zum Waldrand!', { mood: 'determined' });
        else await ctx.say('flick', 'Eine Freundin deiner Schwester. Lauf zum Waldrand!', { mood: 'determined' });
        ctx.setObjective('Bringt Kyra zum Waldrand', 'Kyra muss die goldenen Felder im Westen erreichen. Wer ihr den Weg verstellt: Stein werfen oder Schubsen!');
        ctx.bark('maedchen', 'Die Gefangene! Lasst sie nicht entkommen! Und krümmt ihr kein Haar!', 2400);
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
        if (kind === 'wounded' && ['algard', 'maedchen', 'schuetze'].includes(unit.id)) ctx.bark(unit.id, 'Uff … ich bleib … liegen …', 1600);
      },
      onHpBelow: [
        { unit: 'lia', below: 0.5, run: c => c.bark('lia', 'Normalerweise lese ich so was nur …', 2200) },
        { unit: 'flick', below: 0.45, run: c => c.bark('flick', 'Das wird knapp …', 1800) },
      ],
    },
  };
}

async function opening(ctx: BattleCtx, skip: boolean, firstCut: boolean, hasDagger: boolean): Promise<void> {
  await ctx.focus('lia', 300);
  await ctx.say('algard', 'Los, raus mit der Sprache!', { mood: 'angry' });
  await ctx.focus('flick', 400);
  if (firstCut) await ctx.say('flick', 'Ein Strang ist schon durch! Halt sie noch einen Moment hin, Lia!', { mood: 'determined' });
  else await ctx.say('flick', 'Jetzt, Lia! Lenk sie ab!', { mood: 'determined' });
  if (skip) {
    ctx.flag('k5-skip');
    for (const id of ['algard', 'maedchen', 'schuetze']) ctx.setAi(id, { skip: true });
    await ctx.say('narrator', 'Die Wachen starren noch verdutzt auf Lia. Einen Augenblick lang hast du die Überraschung auf deiner Seite.');
  } else {
    await ctx.say('maedchen', 'Ein Hinterhalt! Ich wusste es!', { mood: 'angry' });
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
  await ctx.say('baris', 'Was ist hier los?! Ihr Narren lasst euch von zwei Mädchen vorführen?', { mood: 'angry' });
  await ctx.say('orwen', 'Die Kleine vom Feuer. Ich wusste, dass mit der etwas faul ist.', { mood: 'smirk' });
  await ctx.say('baris', 'Die Gefangene bleibt hier. Und die Spitzohrige … die gehört mir.', { mood: 'angry' });
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
  await ctx.say('baris', 'Jetzt ist’s aus, Spitzohr!', { mood: 'smirk' });
  await ctx.focus('lia', 250);
  ctx.pose('lia', 'cast');
  await ctx.say('k5-lia', 'FLICK!', { mood: 'scared' });
  await ctx.magicBurst('lia', 'baris');
  ctx.flag('k5-urmacht-exploded');
  await ctx.ui.plate('k5-urmacht', { caption: 'Die Urmacht', pan: 'out', durationMs: 9000 });
  await ctx.say('narrator', 'Lias Augen leuchten blau. Ein ~türkises Licht~ bricht aus ihr hervor, eine Welle, die das Gras flach drückt und die Blätter von der Eiche reißt.');
  await ctx.say('narrator', 'Baris wird davongeschleudert wie ein Kind. Seine Axt wirbelt in die Dunkelheit.');
  await ctx.ui.closePlate();
  ctx.shake(2);
  for (const u of ctx.battle.living('enemy')) {
    if (u.id === 'baris') continue;
    await ctx.damage(u.id, 2);
  }
  await ctx.banner('Die Dunkelschatten fliehen!');
  for (const id of ['orwen', 'algard', 'maedchen', 'schuetze']) {
    const u = ctx.unit(id);
    if (u && u.x > -50) { ctx.bark(id, id === 'orwen' ? 'Zurück! Zurück!' : 'Hexerei!', 1200); await ctx.remove(id); }
  }
  if (ctx.unit('baris') && ctx.unit('baris')!.x > -50) await ctx.remove('baris');
  if (ctx.unit('kyra')?.statuses.bound) G.state.set('k5-kyra-spaet-befreit');
  ctx.pose('lia', 'fall');
  await ctx.say('narrator', 'Dann wird es still. Lia spürt noch, wie ihre Knie nachgeben. Dann nichts mehr.');
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

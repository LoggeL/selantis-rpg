// prolog-schlacht: tactics tutorial on the hill of Dunkelhain. Valentus and a Falcon of Portas cover the retreat of
// the wounded. The axe warrior is the young Baris: wounded, never killed. Afterwards Valentus fetches the Urmacht
// from the cave (plate), an arrow hits him, the army of light flees, slow fade to black.
import { G } from '../../core/G';
import { characterStats, shadowStats } from '../common/battleCharacters';
import type { BattleCtx, BattleDef, BattleUnitDef, Point, TacticsStartData } from '../../tactics/api';
import { music, sfx, sleep, ui } from './util';

const shadow = (o: Partial<BattleUnitDef> & Pick<BattleUnitDef, 'id' | 'x' | 'y'>): BattleUnitDef => ({
  name: 'Dunkelschatten', team: 'enemy', ...shadowStats(o.preset), move: 4, jump: 2, abilities: ['schwerthieb'],
  preset: 'shadow-sword', title: 'Schwertträger', ai: 'melee', facing: 'n', ...o,
});

/** Routes of the two wounded paladins towards the ruined gate of the council precinct (top left). */
const ROUTES: Record<string, Point[]> = {
  'verwundeter-1': [{ x: 3, y: 5 }, { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 3 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }],
  'verwundeter-2': [{ x: 2, y: 6 }, { x: 1, y: 6 }, { x: 1, y: 5 }, { x: 1, y: 4 }, { x: 1, y: 3 }, { x: 0, y: 3 }, { x: 0, y: 2 }],
};
const SAFE_TILES: Point[] = [{ x: 1, y: 1 }, { x: 0, y: 2 }];

async function tutorialRound1(ctx: BattleCtx): Promise<void> {
  const active = ctx.battle.activeUnit ? ctx.unit(ctx.battle.activeUnit) : undefined;
  await ctx.hint(`Wähle <em>${active?.name ?? 'die aktive Einheit'}</em> mit einem Klick oder drücke <strong>Tab</strong>. Das <em>Tempo</em> bestimmt die Zugreihenfolge oben.`, { title: 'Zugreihenfolge', unit: active?.id, until: 'select' });
  await ctx.hint('<em>Blaue Felder</em> zeigen die Bewegung. Klicke ein blaues Feld. <strong>Rückgängig</strong> nimmt den Schritt zurück, solange du noch nicht gehandelt hast.', { title: 'Bewegung', until: 'move' });
  await ctx.hint('Wähle <em>Handeln</em> und eine Fähigkeit, dann ein Ziel. Die Vorschau stellt beide Figuren gegenüber und zeigt <em>Schaden und Trefferchance</em>. Ist niemand in Reichweite, wähle <strong>Warten</strong>.', { title: 'Handeln', until: e => e.type === 'act' || e.type === 'wait' });
  await ctx.hint('Ein Hieb von der Seite trifft <strong>×1,25</strong>, in den Rücken <strong>×1,5</strong>. Fähigkeiten kommen von der Waffe. Mit <em>AP</em> meisterst du sie dauerhaft; <em>Exp</em> erhöht dein Level.', { title: 'Flanken und Lernen' });
  await ctx.hint('<em>Zug beenden</em> (Leertaste) gibt an die nächste Figur weiter. Jede Figur darf pro Zug einmal bewegen und einmal handeln.', { title: 'Zug beenden', until: 'endTurn' });
}

function free(ctx: BattleCtx, p: Point): boolean {
  const t = ctx.battle.unitAt(p.x, p.y);
  return !t || Boolean(t.down);
}

/** Each ally phase the wounded limp three tiles further up the hill. */
async function moveWounded(ctx: BattleCtx): Promise<void> {
  for (const id of Object.keys(ROUTES)) {
    const u = ctx.unit(id);
    if (!u || u.down) continue;
    const route = ROUTES[id];
    let i = route.findIndex(p => p.x === u.x && p.y === u.y);
    let steps = 0;
    while (steps < 3 && i < route.length - 1 && free(ctx, route[i + 1])) { i++; steps++; }
    if (steps > 0) await ctx.move(id, route[i]);
    if (SAFE_TILES.some(p => p.x === route[i].x && p.y === route[i].y) && i === route.length - 1) {
      ctx.bark(id, 'Danke, Großmeister …', 1400);
      ctx.flag(`${id}-sicher`);
      await ctx.wait(500);
      await ctx.remove(id);
      const both = ctx.hasFlag('verwundeter-1-sicher') && ctx.hasFlag('verwundeter-2-sicher');
      await ctx.banner(both ? 'Alle Verwundeten sind in Sicherheit' : 'Ein Verwundeter ist in Sicherheit', both ? 'Haltet den Hügel, bis der Rückzug durch ist' : undefined);
      if (both) ctx.setObjective('Haltet den Hügel', 'Der Rückzug ist fast durch. Haltet die Dunkelschatten auf.');
    }
  }
}

let collapsing = false;
/** The line breaks: the princes sound the retreat, the black army floods the hill. Valentus runs for the cave. */
async function collapse(ctx: BattleCtx): Promise<void> {
  if (collapsing) return;
  collapsing = true;
  sfx('alert', { volume: 0.8, pitch: 0.6 });
  await ctx.banner('Die Fürsten blasen zum Rückzug', 'Das Heer des Lichts weicht');
  const spots: Point[] = [{ x: 4, y: 11 }, { x: 6, y: 11 }, { x: 8, y: 11 }, { x: 7, y: 10 }, { x: 5, y: 10 }, { x: 9, y: 9 }];
  const wave = spots.filter(p => free(ctx, p)).slice(0, 5).map((p, k) => shadow({
    id: `flut-${k}`, x: p.x, y: p.y, ai: 'hold', preset: ['shadow-sword', 'shadow-spear', 'shadow-club', 'shadow-sword', 'shadow-spear'][k],
  }));
  await ctx.spawn(wave, { banner: 'Das schwarze Heer überrennt den Hang!' });
  ctx.shake(1);
  await ctx.focus('falke', 400);
  await ctx.say('prolog-falke', 'Großmeister! Die Brigaden fliehen, die Fürsten ziehen ab. Wir sind allein!');
  await ctx.focus('valentus', 400);
  await ctx.say('valentus', 'Dann ist Dunkelhain verloren. Und hinter uns liegt der Ratssaal … und die Höhle.', { mood: 'determined' });
  await ctx.say('valentus', 'Sie dürfen die ~Urmacht~ nicht bekommen. Niemals.', { mood: 'determined' });
  await ctx.say('prolog-falke', 'Dann lauft! Ich halte sie auf, solange ich stehen kann. Für Portas!');
  ctx.face('valentus', 'n');
  ctx.flag('prolog-schlacht-ende');
  ctx.win();
}

export const dunkelhain: BattleDef = {
  id: 'prolog-dunkelhain',
  title: 'Der Hügel von Dunkelhain',
  subtitle: 'Deckt den Rückzug der Verwundeten',
  victoryText: 'Die Verwundeten sind in Sicherheit. Doch der Hügel ist verloren.',
  defeatText: 'Der Hügel ist gefallen. Nutze die Höhe, decke die Verwundeten – und stoße Feinde den Hang hinab.',
  backdrop: 'dusk',
  ambience: ['battle-far', 'wind'],
  music: 'battle',
  seed: 1604,
  map: {
    ground: 'dry',
    trees: 'mixed',
    height: [
      '555443221100',
      '554433211000',
      '544433211000',
      '444332210001',
      '443322110012',
      '333221100012',
      '322211000001',
      '221110000000',
      '111000000000',
      '100000000000',
      '000000000000',
      '000000000000',
    ],
    terrain: [
      '##::..b.T..T',
      '#:::......rT',
      ':::..b......',
      '::..r...b...',
      '.......b..rr',
      'b...b.......',
      '...b....,.b.',
      '.b.....,,...',
      '.....b.,..b.',
      'T.b....,....',
      '....b..,....',
      'TT.....,..TT',
    ],
    paint: [
      'sssss.......',
      'ssss........',
      'sss.........',
      'ss..........',
      '............',
      '............',
      '........d...',
      '.......dd...',
      '.......d....',
      '.......d....',
      '.......d....',
      '.......d....',
    ],
    props: [
      { x: 2, y: 0, prop: 'banner-light' },
      { x: 0, y: 3, prop: 'banner-light', variant: 1 },
      { x: 4, y: 2, prop: 'stake' },
      { x: 9, y: 11, prop: 'banner-dark' },
      { x: 6, y: 9, prop: 'ruin' },
    ],
  },
  units: [
    { id: 'valentus', ...characterStats('valentus'), name: 'Valentus', title: 'Großmeister des Rats der Zehn', team: 'player', x: 3, y: 3, facing: 's', move: 4, jump: 2,
      abilities: ['strahl', 'druckwelle', 'schutzwall', 'handstoss'], preset: 'valentus' },
    { id: 'falke', ...characterStats('falke'), name: 'Falke', title: 'Falke aus Portas, zwei Kurzschwerter', team: 'player', x: 5, y: 4, facing: 's', move: 5, jump: 3,
      abilities: ['doppelhieb', 'tritt'], preset: 'falke-soldier', portrait: 'falke-soldier', nonLethal: true },
    { id: 'verwundeter-1', ...characterStats('paladin', 13 / 22), name: 'Verwundeter Paladin', title: 'Kann kaum noch gehen', team: 'ally', x: 3, y: 5, facing: 'n', move: 2, jump: 1,
      abilities: [], ai: 'passive', preset: 'paladin', nonLethal: true },
    { id: 'verwundeter-2', ...characterStats('paladin', 12 / 22), name: 'Verwundeter Paladin', title: 'Stützt sich auf seinen Speer', team: 'ally', x: 2, y: 6, facing: 'n', move: 2, jump: 1,
      abilities: [], ai: 'passive', preset: 'paladin', nonLethal: true },
    shadow({ id: 'ds-1', x: 5, y: 9 }),
    shadow({ id: 'ds-2', x: 8, y: 10 }),
    shadow({ id: 'ds-3', x: 3, y: 11 }),
    shadow({ id: 'ds-xbow', name: 'Armbrustschütze', title: 'Dunkelschatten auf dem Fels', x: 11, y: 5, move: 3, abilities: ['bolzen'], ai: 'archer', preset: 'shadow-crossbow', facing: 'w' }),
  ],
  waves: [
    {
      round: 2, text: 'Ein Hüne mit Axt führt die nächste Welle an!',
      units: [
        { id: 'baris', ...characterStats('baris-young'), name: 'Axtkämpfer', title: 'Ein junger Hüne mit Axt', team: 'enemy', x: 6, y: 11, facing: 'n', move: 3, jump: 1,
          abilities: ['axthieb', 'wuchtschlag'], nonLethal: true, preset: 'baris-young', portrait: 'baris-young', ai: 'melee' },
        shadow({ id: 'ds-4', x: 9, y: 11 }),
      ],
    },
    {
      round: 3, text: 'Weitere Dunkelschatten stürmen den Hang!',
      units: [shadow({ id: 'ds-5', x: 2, y: 11, abilities: ['speerstoss'], preset: 'shadow-spear', name: 'Spießträger' }), shadow({ id: 'ds-6', x: 10, y: 10, preset: 'shadow-club', name: 'Keulenträger', abilities: ['wuchtschlag'] })],
    },
    {
      round: 4, text: 'Sie hören nicht auf zu kommen …',
      units: [shadow({ id: 'ds-7', x: 7, y: 11 }), shadow({ id: 'ds-8', x: 4, y: 11, abilities: ['speerstoss'], preset: 'shadow-spear', name: 'Spießträger' })],
    },
  ],
  objective: {
    text: 'Deckt den Rückzug',
    detail: 'Bringt die Verwundeten zum Tor oben links. Haltet bis Runde 6 durch. Valentus und die Verwundeten dürfen nicht fallen.',
    win: [{ type: 'flag', flag: 'prolog-schlacht-ende' }],
    lose: [{ type: 'unitDown', units: ['valentus'] }, { type: 'flag', flag: 'prolog-verwundeter-gefallen' }],
  },
  goalTiles: SAFE_TILES,
  hooks: {
    async onStart(ctx) {
      collapsing = false;
      await ctx.focus('valentus', 400);
      await ctx.say('valentus', 'Haltet den Hügel! Die Verwundeten brauchen jeden Augenblick.', { mood: 'determined' });
      await ctx.focus('verwundeter-1', 300);
      await ctx.say('prolog-falke', 'Zwei von uns schaffen den Hang nicht allein, Großmeister. Sie müssen zum Tor hinauf.');
      await ctx.focus('ds-1', 300);
      await ctx.say('prolog-falke', 'Und da kommen sie. Schwarz und weiß, wie die Krähen.');
    },
    async onRound(ctx, round, phase) {
      if (phase === 'ally') { await moveWounded(ctx); return; }
      if (phase !== 'player') {
        if (round === 2 && phase === 'enemy') ctx.bark('baris', 'Der Alte gehört mir!', 1800);
        return;
      }
      if (round === 1) await tutorialRound1(ctx);
      if (round === 2) {
        await ctx.hint('Die Verwundeten humpeln nach jeder deiner Runden ein Stück weiter, zum Tor oben links. Stellt euch <em>zwischen</em> sie und die Dunkelschatten. <em>Schutzwall</em> halbiert den Schaden eines Verbündeten.', { title: 'Deckung', unit: 'verwundeter-1' });
        await ctx.hint('<em>Höhe</em> zählt: Wer von oben angreift, trifft öfter und härter (bis zu ±30 %). Der Hang gehört euch – nutzt ihn.', { title: 'Höhe' });
      }
      if (round === 5) await ctx.hint('Noch diese Runde! Dann ist der Rückzug durch.', { title: 'Letzte Runde' });
      if (round >= 6) await collapse(ctx);
    },
    triggers: [
      {
        id: 'druckwelle-tip',
        when: c => c.phase === 'player' && c.battle.living('enemy').filter(e => Math.abs(e.x - c.battle.unit('valentus').x) + Math.abs(e.y - c.battle.unit('valentus').y) === 1).length >= 1,
        run: c => c.hint('Feinde stehen direkt neben Valentus. <em>Druckwelle</em> stößt alle Nachbarn weg – wer gegen Felsen prallt oder den Hang hinabstürzt, nimmt <strong>Zusatzschaden</strong>.', { title: 'Wegstoßen', unit: 'valentus' }),
      },
      {
        id: 'alle-besiegt',
        when: c => c.round >= 2 && c.battle.living('enemy').length === 0,
        run: c => collapse(c),
      },
    ],
    onHpBelow: [
      { unit: 'valentus', below: 0.4, run: c => c.say('valentus', 'Ich kann sie nicht ewig aufhalten …', { mood: 'pained' }) },
      { unit: 'verwundeter-1', below: 0.5, run: c => c.bark('verwundeter-1', 'Großmeister … Hilfe!', 1600) },
      { unit: 'verwundeter-2', below: 0.5, run: c => c.bark('verwundeter-2', 'Ich … kann nicht mehr …', 1600) },
    ],
    async onUnitDown(ctx, unit, kind) {
      if (unit.id.startsWith('verwundeter-') && !ctx.hasFlag(`${unit.id}-sicher`)) {
        ctx.flag('prolog-verwundeter-gefallen');
        return;
      }
      if (unit.id === 'baris') {
        await ctx.focus('baris', 300);
        ctx.pose('baris', 'kneel');
        await ctx.say('prolog-axtkaempfer', 'Das … ist noch nicht vorbei, alter Mann. Merk dir mein Gesicht.', { mood: 'angry' });
        await ctx.say('prolog-falke', 'Der Hüne lebt noch. Lasst ihn liegen – wir sind keine Schlächter.');
        G.state.set('prolog-baris-verwundet');
      } else if (unit.id === 'falke' && kind === 'wounded') {
        await ctx.say('valentus', 'Falke! … Bleib liegen. Ich mache allein weiter.', { mood: 'pained' });
      }
    },
  },
};

async function afterBattle(): Promise<void> {
  await G.ui.fade('out', 1400);
  G.stopGameplayScenes();
  ui().setHud('cinematic');
  G.ui.letterbox(true);
  music('dread', 1500);
  try { G.audio.ambience(['battle-far', 'wind'], { fadeMs: 1200, volume: { 'battle-far': 0.5 } }); } catch { /* audio optional */ }
  ui().prefetchPlate('prolog-pfeil');
  await G.ui.plate('prolog-hoehle', { caption: 'Die Höhle hinter dem Ratssaal', pan: 'in', durationMs: 26000 });
  await G.ui.fade('in', 1400);
  await G.ui.say('narrator', 'Valentus lief, so schnell ihn seine alten Beine trugen. Durch den Saal, durch das Siegel, hinab in die Höhle.');
  await G.ui.say('valentus', 'Verzeiht mir, ihr Zehn. Ich breche den Eid, um ihn zu halten.', { mood: 'determined' });
  await G.ui.hold('Die Hand ausstrecken', 2200);
  sfx('urmacht', { volume: 1 });
  await G.ui.fade('out', 500, '#c8fff4');
  await sleep(300);
  await G.ui.fade('in', 900, '#c8fff4');
  await G.ui.say('narrator', 'Das türkise Licht floss in seine Hand und verschwand. Als die ersten Dunkelschatten die Höhle erreichten, war sie leer.');
  await G.ui.fade('out', 900);
  await G.ui.closePlate();
  music('grief', 2500);
  await G.ui.plate('prolog-pfeil', { caption: 'Dunkelhain, bei Sonnenuntergang', pan: 'out', durationMs: 30000 });
  await G.ui.fade('in', 1600);
  sfx('arrow-hit', { volume: 1 });
  await sleep(400);
  await G.ui.say('valentus', 'Nein … nicht jetzt …', { mood: 'pained' });
  await G.ui.say('narrator', 'Ein Pfeil traf ihn unter den Rippen. Er ging in die Knie. Unten im Tal floh das Heer des Lichts, Banner um Banner fiel.');
  if (G.state.is('prolog-baris-verwundet')) await G.ui.say('narrator', 'Irgendwo auf dem Hang lag ein junger Hüne mit einer Axt. Er lebte. Selantis sollte noch von ihm hören.');
  await G.ui.say('narrator', 'So endete die Schlacht von Dunkelhain. Die Dunkelheit hatte gesiegt.');
  await G.ui.fade('out', 4200);
  await G.ui.closePlate();
  G.ui.letterbox(false);
  await G.goto('prolog-flucht');
}

export function prepareSchlacht(): void {
  G.state.setParty(['valentus']);
  G.state.addLore('lore-urmacht');
  G.state.addLore('lore-rat-der-zehn');
}

export async function startSchlacht(): Promise<void> {
  G.stopGameplayScenes();
  const data: TacticsStartData = {
    battle: dunkelhain,
    onEnd: async result => { if (result.outcome === 'win') await afterBattle(); },
  };
  G.game.scene.start('Tactics', data);
  void G.ui.fade('in', 900);
}

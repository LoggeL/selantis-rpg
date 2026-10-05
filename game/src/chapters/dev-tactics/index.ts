import { G } from '../../core/G';
import { defineChapter } from '../../core/registry';
import type { BattleCtx, BattleDef, BattleUnitDef, TacticsStartData } from '../../tactics/api';

// ---------------------------------------------------------------------------------------------
// Units use painted character presets from the asset manifest (G.art.characterIds()); all original designs
// (DESIGN.md §2/§3), never modelled on the film actors.
// ---------------------------------------------------------------------------------------------

const shadow = (o: Partial<BattleUnitDef> & Pick<BattleUnitDef, 'id' | 'x' | 'y'>): BattleUnitDef => ({
  name: 'Dunkelschatten', team: 'enemy', hp: 13, atk: 2, def: 1, move: 4, jump: 2, speed: 4, abilities: ['schwerthieb'],
  preset: 'shadow-sword', title: 'Schwertträger', ai: 'melee', facing: 'n', ...o,
});

// ---------------------------------------------------------------------------------------------
// Demo 1: Der Hügel von Dunkelhain
// ---------------------------------------------------------------------------------------------
async function tutorialRound1(ctx: BattleCtx): Promise<void> {
  await ctx.hint('Wähle <em>Valentus</em> mit einem Klick – oder drücke <strong>Tab</strong>.', { title: 'Bewegung', unit: 'valentus', until: 'select' });
  await ctx.hint('<em>Blaue Felder</em> zeigen, wohin er gehen kann. Höhe kostet Kraft: Valentus klettert höchstens <strong>2 Ebenen</strong>. Klicke ein blaues Feld – ein Fehler lässt sich mit <strong>Rückgängig</strong> zurücknehmen.', { title: 'Bewegung', until: 'move' });
  await ctx.hint('Jetzt <em>Handeln</em>: Fähigkeit wählen (Tasten <strong>1–4</strong>), dann ein Ziel. Die Vorschau rechts zeigt Trefferchance und Schaden. Ist kein Feind in Reichweite, wähle <strong>Warten</strong>.', {
    title: 'Handeln', until: e => e.type === 'act' || e.type === 'wait',
  });
  await ctx.hint('Die kleinen Pfeile unter den Figuren zeigen ihre <em>Blickrichtung</em>. Ein Hieb von der Seite trifft <strong>×1,25</strong>, in den Rücken <strong>×1,5</strong> – und wer höher steht, trifft öfter und härter.', { title: 'Flanken und Höhe' });
  await ctx.hint('Bewege auch den Falken. Wenn alle gehandelt haben, endet die Runde – oder klicke <em>Zug beenden</em> (Sanduhr, <strong>Leertaste</strong>).', { title: 'Runde beenden', unit: 'falke', until: 'endTurn' });
}

export const dunkelhainBattle: BattleDef = {
  id: 'dev-dunkelhain',
  title: 'Der Hügel von Dunkelhain',
  subtitle: 'Deckt den Rückzug der Verwundeten',
  victoryText: 'Der Rückzug ist gedeckt. Die Verwundeten sind in Sicherheit.',
  defeatText: 'Der Hügel ist gefallen. Nutze die Höhe – und greif von hinten an.',
  backdrop: 'dusk',
  ambience: ['battle-far', 'wind'],
  seed: 1604,
  map: {
    height: [
      '444332110000',
      '444432110011',
      '444433200012',
      '344332100001',
      '333322110000',
      '233221100000',
      '222211000011',
      '112110000033',
      '111100000033',
      '011000000002',
      '000000000001',
      '000000000000',
    ],
    terrain: [
      'T.::..b.~..T',
      '..::.b..~.rT',
      '...#....~...',
      '.....b..~...',
      '..r.....~,..',
      'b......,~,..',
      '.....b.,,~.b',
      '..b......~.r',
      '......b..~..',
      'T.........~b',
      '..b..,,...~.',
      'T...,,.b..~T',
    ],
    // Trodden path up the hill (visual only).
    paint: [
      '............',
      '............',
      '............',
      '....d.......',
      '....d.......',
      '....dd......',
      '.....d......',
      '.....dd.....',
      '......d.....',
      '......d.....',
      '......d.....',
      '......d.....',
    ],
    props: [
      { x: 1, y: 0, prop: 'banner-light' },
      { x: 0, y: 2, prop: 'banner-light', variant: 1 },
      { x: 6, y: 11, prop: 'banner-dark' },
      { x: 4, y: 0, prop: 'stake', dx: 4 },
    ],
  },
  units: [
    { id: 'valentus', name: 'Valentus', title: 'Großmeister des Rats der Zehn', team: 'player', x: 3, y: 3, facing: 's', hp: 30, atk: 3, def: 2, move: 4, jump: 2, speed: 6,
      abilities: ['handstoss', 'strahl', 'druckwelle', 'schutzwall'], preset: 'valentus' },
    { id: 'falke', name: 'Falke', title: 'Falke aus Portas, zwei Kurzschwerter', team: 'player', x: 4, y: 4, facing: 's', hp: 26, atk: 3, def: 2, move: 5, jump: 3, speed: 7,
      abilities: ['doppelhieb', 'tritt'], preset: 'falke-soldier' },
    shadow({ id: 'ds-1', x: 5, y: 7, facing: 'n' }),
    shadow({ id: 'ds-2', x: 7, y: 9, facing: 'n' }),
    shadow({ id: 'ds-spear', name: 'Spießträger', title: 'Dunkelschatten mit Spieß', x: 4, y: 10, abilities: ['speerstoss'], preset: 'shadow-spear' }),
    shadow({ id: 'ds-xbow', name: 'Armbrustschütze', title: 'Dunkelschatten auf dem Fels', x: 10, y: 7, hp: 10, atk: 3, def: 0, move: 3, abilities: ['bolzen'], ai: 'archer', preset: 'shadow-crossbow', facing: 'w' }),
    { id: 'baris-young', name: 'Axtkämpfer', title: 'Ein junger Hüne mit Axt', team: 'enemy', x: 7, y: 8, facing: 'n', hp: 24, atk: 4, def: 2, move: 3, jump: 1, speed: 3,
      abilities: ['axthieb', 'wuchtschlag'], nonLethal: true, preset: 'baris-young', ai: 'melee' },
  ],
  waves: [{
    round: 3, text: 'Weitere Dunkelschatten stürmen den Hang!',
    units: [shadow({ id: 'ds-3', x: 2, y: 11 }), shadow({ id: 'ds-4', name: 'Spießträger', x: 5, y: 11, abilities: ['speerstoss'], preset: 'shadow-spear' })],
  }],
  objective: {
    text: 'Deckt den Rückzug',
    detail: 'Halte 5 Runden durch oder besiege alle Dunkelschatten.',
    win: [{ type: 'survive', rounds: 5 }, { type: 'defeatAll' }],
    lose: [{ type: 'unitDown', units: ['valentus'] }],
  },
  hooks: {
    async onStart(ctx) {
      await ctx.focus('valentus', 400);
      await ctx.say('valentus', 'Haltet den Hügel! Die Verwundeten brauchen jeden Augenblick.');
      await ctx.say('falke', 'Für Portas, Großmeister. Sie kommen den Hang herauf.');
    },
    async onRound(ctx, round, phase) {
      if (round === 1 && phase === 'player') await tutorialRound1(ctx);
      if (round === 2 && phase === 'enemy') ctx.bark('baris-young', 'Der Alte gehört mir!', 1800);
      if (round === 5 && phase === 'player') await ctx.hint('Nur noch diese Runde! Danach sind die Verwundeten in Sicherheit.', { title: 'Letzte Runde' });
    },
    triggers: [{
      id: 'druckwelle-tip',
      when: c => c.phase === 'player' && c.battle.living('enemy').some(e => Math.abs(e.x - c.battle.unit('valentus').x) + Math.abs(e.y - c.battle.unit('valentus').y) === 1),
      run: c => c.hint('Feinde stehen direkt neben Valentus. <em>Druckwelle</em> stößt alle Nachbarn weg – wer gegen Felsen prallt oder über eine Kante stürzt, nimmt <strong>Zusatzschaden</strong>.', { title: 'Wegstoßen', unit: 'valentus' }),
    }],
    onHpBelow: [{ unit: 'valentus', below: 0.4, run: c => c.say('valentus', 'Ich kann sie nicht ewig aufhalten …') }],
    async onUnitDown(ctx, unit, kind) {
      if (unit.id === 'baris-young' && kind === 'wounded') {
        await ctx.focus('baris-young', 300);
        ctx.bark('baris-young', 'Das … ist noch nicht vorbei …', 2200);
        await ctx.wait(600);
        await ctx.say('falke', 'Der Hüne liegt am Boden. Er lebt noch – lasst ihn.');
      }
    },
  },
};

// ---------------------------------------------------------------------------------------------
// Demo 2: Rettung im Wald — protect/escort, a non-fighter hero, a bound prisoner
// ---------------------------------------------------------------------------------------------
export const rescueBattle: BattleDef = {
  id: 'dev-rescue',
  title: 'Am Baum über den Feldern',
  subtitle: 'Befreit Kyra',
  victoryText: 'Kyra ist frei! Die Schwestern verschwinden im Wald.',
  defeatText: 'Lia ist gestürzt. Lenk die Wachen ab, statt dich ihnen in den Weg zu stellen.',
  backdrop: 'night',
  ambience: ['night', 'fire', 'wind'],
  seed: 77,
  map: {
    trees: 'mixed',
    ground: 'dry',
    height: [
      '22211111000',
      '22111100000',
      '11110000001',
      '00000000011',
      '00000000011',
      '00000000001',
      '00000000000',
      '00000000000',
      '01100000000',
      '11110000000',
      '12210000000',
    ],
    terrain: [
      'TTb..T.bT.T',
      'T.r.......T',
      '.b........r',
      '.....:f....',
      '....:,,....',
      '.b..,T.,...',
      '...b..,.r.b',
      '.......b...',
      'b.b......T.',
      'T.b...b....',
      'TT..b..T..T',
    ],
    props: [
      { x: 6, y: 3, prop: 'campfire' },
      { x: 8, y: 6, prop: 'crate' },
      { x: 9, y: 3, prop: 'banner-dark' },
      { x: 2, y: 7, prop: 'stump' },
    ],
  },
  units: [
    { id: 'lia', name: 'Lia', title: 'Keine Kämpferin – aber sie gibt nicht auf', team: 'player', x: 2, y: 9, facing: 'n', hp: 14, atk: 1, def: 0, move: 4, jump: 2, speed: 6,
      abilities: ['ausweichen', 'ablenken', 'steinwurf', 'dolch', 'befreien'], preset: 'lia', tags: ['vip'] },
    { id: 'flick', name: 'Flick', title: 'Die beste Fährtenleserin südlich von Trapas', team: 'player', x: 1, y: 8, facing: 'n', hp: 18, atk: 3, def: 1, move: 5, jump: 3, speed: 8,
      abilities: ['bogen', 'messer', 'befreien'], nonLethal: true, preset: 'flick' },
    { id: 'kyra', name: 'Kyra', title: 'Gefesselt an den Baum', team: 'ally', x: 5, y: 6, facing: 's', hp: 12, atk: 2, def: 0, move: 4, jump: 2, speed: 6,
      abilities: ['schubsen', 'ausweichen'], statuses: { bound: Infinity }, freedTeam: 'player', preset: 'kyra', boundPreset: 'kyra-bound', tags: ['vip', 'spared'] },
    shadow({ id: 'w-1', name: 'Wache', x: 6, y: 5, facing: 'w', ai: 'guard', guardRadius: 4 }),
    shadow({ id: 'w-2', name: 'Spießträger', x: 7, y: 7, facing: 's', ai: 'guard', guardRadius: 4, abilities: ['speerstoss'], preset: 'shadow-spear' }),
    shadow({ id: 'w-3', name: 'Wache', x: 4, y: 3, facing: 'n', ai: 'guard', guardRadius: 3 }),
    shadow({ id: 'w-xbow', name: 'Armbrustschütze', x: 1, y: 1, hp: 10, def: 0, move: 3, abilities: ['bolzen'], ai: 'archer', preset: 'shadow-crossbow', facing: 's' }),
  ],
  goalTiles: [{ x: 0, y: 4 }, { x: 0, y: 5 }, { x: 0, y: 6 }, { x: 0, y: 7 }],
  objective: {
    text: 'Befreit Kyra',
    detail: 'Wer neben ihr steht, löst die Fesseln. Lia darf nicht fallen.',
    win: [{ type: 'escort', unit: 'kyra', tiles: [{ x: 0, y: 4 }, { x: 0, y: 5 }, { x: 0, y: 6 }, { x: 0, y: 7 }] }],
    lose: [{ type: 'unitDown', units: ['lia', 'kyra'] }],
  },
  hooks: {
    async onStart(ctx) {
      await ctx.focus('kyra', 400);
      await ctx.say('flick', 'Drei Wachen am Feuer, einer oben am Hang. Ich hol sie da raus – du lenkst ab.');
      await ctx.say('lia', 'Kann das nicht bitte jemand anderes machen?');
      await ctx.say('flick', 'Siehst du hier noch jemanden außer uns?');
    },
    async onRound(ctx, round, phase) {
      if (round === 1 && phase === 'player') {
        await ctx.hint('Lia ist keine Kämpferin. <em>Ablenken</em> lockt die Wachen zu ihr, <em>Ausweichen</em> lässt Hiebe ins Leere gehen, ein <em>Stein</em> stößt Feinde weg.', { title: 'Lia', unit: 'lia' });
        await ctx.hint('Wer neben Kyra steht, kann sie mit <em>Befreien</em> losbinden. Danach muss sie die <em>goldenen Felder</em> am Waldrand erreichen. Die Dunkelschatten dürfen ihr nichts antun – Baris will sie lebend.', { title: 'Ziel', unit: 'kyra' });
      }
    },
    async onFree(ctx, unit, by) {
      if (unit.id !== 'kyra') return;
      await ctx.say('kyra', by.id === 'lia' ? 'Lia?! Was machst du denn hier?' : 'Wer bist du denn?');
      await ctx.say(by.id === 'lia' ? 'lia' : 'flick', by.id === 'lia' ? 'Dich retten. Lauf zum Waldrand!' : 'Eine Freundin deiner Schwester. Lauf!');
      ctx.setObjective('Bringt Kyra zum Waldrand', 'Die Wachen dürfen ihr nichts tun – aber sie versperren ihr den Weg. Stoßt sie beiseite!');
      await ctx.spawn([
        shadow({ id: 'r-1', name: 'Dunkelschatten', x: 10, y: 4, facing: 'w' }),
        shadow({ id: 'r-2', name: 'Dunkelschatten', x: 10, y: 8, facing: 'w' }),
      ], { banner: 'Die Wachen schlagen Alarm!' });
      ctx.bark('w-1', 'Lasst sie nicht entkommen! Und krümmt ihr kein Haar!', 2400);
      const goal = { x: 0, y: 5 };
      for (const id of ['w-1', 'r-1']) ctx.setAi(id, { block: 'kyra', goal });
      for (const id of ['w-2', 'w-3', 'r-2']) ctx.setAi(id, { profile: 'melee' });
    },
    onHpBelow: [{ unit: 'lia', below: 0.5, run: c => c.bark('lia', 'Normalerweise lese ich nur Abenteuer …', 2200) }],
  },
};

// ---------------------------------------------------------------------------------------------
// Sandbox: push, fall and collision damage on a small cliff (visual QA, no story)
// ---------------------------------------------------------------------------------------------
export const sandboxBattle: BattleDef = {
  id: 'dev-sandbox',
  title: 'Übungsplatz',
  subtitle: 'Wegstoßen, Stürze und Aufprall',
  backdrop: 'day',
  seed: 5,
  map: {
    height: [
      '0000000',
      '0033300',
      '0033300',
      '0033300',
      '0000000',
      '0000000',
    ],
    terrain: [
      '..b..r.',
      '..:::..',
      '.r:::~~',
      '..:::~~',
      '...#...',
      'T.....T',
    ],
  },
  units: [
    { id: 'valentus', name: 'Valentus', team: 'player', x: 3, y: 2, facing: 's', hp: 30, atk: 3, def: 2, move: 4, jump: 2, abilities: ['druckwelle', 'handstoss', 'strahl', 'schutzwall'], preset: 'valentus' },
    { id: 'flick', name: 'Flick', team: 'player', x: 1, y: 5, facing: 'n', hp: 18, atk: 3, def: 1, move: 5, jump: 3, abilities: ['bogen', 'messer'], preset: 'flick' },
    shadow({ id: 's-north', x: 3, y: 1, facing: 's' }),
    shadow({ id: 's-east', x: 4, y: 2, facing: 'w' }),
    { id: 'baris-young', name: 'Axtkämpfer', team: 'enemy', x: 2, y: 2, facing: 'e', hp: 6, atk: 4, def: 2, move: 3, jump: 1, abilities: ['axthieb'], nonLethal: true, preset: 'baris-young' },
    shadow({ id: 's-south', x: 3, y: 3, facing: 'n', hp: 4 }),
  ],
  objective: { text: 'Übung', detail: 'Stoße die Feinde von der Klippe.', win: [{ type: 'defeatAll' }] },
};

// ---------------------------------------------------------------------------------------------
function startBattle(battle: BattleDef, again: string): void {
  G.stopGameplayScenes();
  const data: TacticsStartData = {
    battle,
    onEnd: async result => {
      await G.ui.narrate(result.outcome === 'win'
        ? [`„${battle.title}“ – gewonnen nach ${result.rounds} Runden.${result.wounded.length ? ` Kampfunfähig: ${result.wounded.length}.` : ''}`]
        : ['Der Kampf ist verloren.']);
      void G.goto(again);
    },
  };
  G.game.scene.start('Tactics', data);
}

defineChapter({
  id: 'dev-tactics',
  order: 902,
  numeral: 'Dev',
  title: 'Taktik-Labor',
  hidden: true,
  scenes: [
    { id: 'tactics-demo', title: 'Dunkelhain (Taktik-Demo)', start: () => startBattle(dunkelhainBattle, 'tactics-demo') },
    { id: 'tactics-rescue-demo', title: 'Rettung (Taktik-Demo)', start: () => startBattle(rescueBattle, 'tactics-rescue-demo') },
    { id: 'tactics-sandbox', title: 'Übungsplatz (Taktik)', start: () => startBattle(sandboxBattle, 'tactics-sandbox') },
  ],
});

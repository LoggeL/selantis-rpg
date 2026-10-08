import type { BattleCtx, BattleDef, BattleUnitDef, Phase } from '../../tactics/api';
import type { BattleProgression } from '../../tactics/rules/types';
import { characterStats } from './battleCharacters';
import { liaBudget, liaCombatHint, liaUnit, withLiaHooks, type LiaStage } from './liaKit';

/**
 * Early encounters: Lia may grow one level per fight (K2 1→2, K3 2→3); her companions only a little. The rates are
 * generous enough for a full level, the budgets and level caps stop prolonged fights from paying more.
 */
export function earlyProgress(stage: Extract<LiaStage, 'k2-wegelagerer' | 'k3-begleitung'>): BattleProgression {
  return {
    actionExp: 15, defeatExp: 30, actionAp: 2, victoryExp: 50, victoryAp: 4,
    budgets: {
      lia: liaBudget(stage),
      foltan: { exp: 30, ap: 8 }, azar: { exp: 30, ap: 8 },
      reisender: { exp: 0, ap: 0 },
    },
  };
}
export const EARLY_PROGRESS: BattleProgression = earlyProgress('k2-wegelagerer');

const guard = {
  id: 'decken', name: 'Deckung geben', kind: 'support', target: 'ally', range: [0, 1],
  shape: { type: 'single' }, power: 0, accuracy: 100, alwaysHits: true, cooldown: 2, vfx: 'ward',
  effects: [{ status: 'guarded', turns: 1, on: 'target' }],
  description: 'Bei einem Gefährten bleiben und ihn bis zu seinem nächsten Zug vor der Hälfte des Schadens schützen.',
} as const;

export const TRAVEL_ABILITIES = {
  decken: { ...guard, range: [0, 1] as [number, number], effects: [...guard.effects] },
  versorgen: {
    id: 'versorgen', name: 'Versorgen', kind: 'support', target: 'ally', range: [0, 1], shape: { type: 'single' },
    power: 0, accuracy: 100, alwaysHits: true, heal: 5, cooldown: 3, mpCost: 3, vfx: 'ward',
    description: 'Eine kleine Verletzung versorgen: 5 HP. Kostet 3 MP und braucht drei eigene Züge Pause.',
  },
  lichtstoss: {
    id: 'lichtstoss', name: 'Lichtstoß', kind: 'magic', target: 'enemy', range: [1, 3], shape: { type: 'single' },
    power: 4, accuracy: 92, push: 1, cooldown: 2, mpCost: 4, vfx: 'palm',
    description: 'Nach Kyras Rettung lernt Lia, einen kleinen Teil des Lichts zu lenken. Stößt das Ziel ein Feld zurück.',
  },
} satisfies NonNullable<BattleDef['abilities']>;

const FOREST: BattleDef['map'] = {
  ground: 'forest', trees: 'oak',
  height: ['00001111', '00001111', '00001111', '00000111', '00000011', '00000011', '00000000', '00000000'],
  terrain: ['T......T', '...b....', '........', '..b.....', '........', '....b...', '........', 'T......T'],
  paint: ['........', '........', 'dddddddd', '........', '........', '........', '........', '........'],
};

function travelParty(stage: LiaStage): BattleUnitDef[] {
  return [
    liaUnit(stage, { x: 1, y: 4, nonLethal: true, title: 'Unsicher mit dem Dolch, aber sie weicht nicht mehr zurück' }),
    { id: 'foltan', name: 'Foltan', ...characterStats('foltan'), team: 'player', x: 2, y: 3, facing: 'e', move: 4, jump: 2,
      abilities: ['schwerthieb', 'bolzen'], preset: 'foltan', nonLethal: true, title: 'Erfahrener Soldat, Schwert und Armbrust' },
    { id: 'azar', name: 'Azar', ...characterStats('azar'), team: 'player', x: 1, y: 5, facing: 'e', move: 3, jump: 1,
      abilities: ['schubsen', 'decken', 'versorgen'], preset: 'azar', nonLethal: true, title: 'Der Schmied hält seinen Freunden den Rücken frei' },
  ];
}

function bandit(id: string, x: number, y: number, level: number, ranged = false): BattleUnitDef {
  return {
    id, name: ranged ? 'Räuber mit Armbrust' : 'Wegelagerer', team: 'enemy', x, y, facing: 'w', level,
    baseStats: { maxHp: 10, maxMp: 2, atk: 1, def: 0, speed: 4 }, move: 3, jump: 2,
    abilities: [ranged ? 'bolzen' : 'schwerthieb'], ai: ranged ? 'archer' : 'melee', nonLethal: true,
    preset: ranged ? 'shadow-crossbow' : 'shadow-sword', title: 'Räuber in zusammengetragener Rüstung',
  };
}

export function forestEncounter(): BattleDef {
  return {
    id: 'k2-wegelagerer', title: 'Wegelagerer am Bach', subtitle: 'Zusammen bleiben', map: FOREST,
    units: [...travelParty('k2-wegelagerer'), bandit('raeuber-1', 5, 3, 1), bandit('raeuber-2', 6, 5, 1)],
    abilities: TRAVEL_ABILITIES, progression: earlyProgress('k2-wegelagerer'), seed: 2041, backdrop: 'forest',
    objective: { text: 'Macht den Weg frei', detail: 'Zwei schwache Wegelagerer. Foltan führt, Lia sticht mit Vaters Dolch zu, Azar hält ihr den Rücken frei.', win: [{ type: 'defeatAll' }], lose: [{ type: 'unitDown', units: ['lia'] }] },
    hooks: withLiaHooks({ onRound: travelHint }),
    victoryText: 'Die Räuber laufen davon. Lia hat ihren ersten Kampf mit der Gruppe bestanden. Ihre Hand zittert noch, aber sie hat zugestochen.',
    defeatText: 'Bleibt beieinander. Greif mit Vaters Dolch von der Seite oder von hinten an, während Foltan die Räuber bindet. Steine und Versorgen helfen dazwischen.',
  };
}

export function escortEncounter(): BattleDef {
  const exit = [{ x: 7, y: 2 }];
  return {
    id: 'k3-begleitung', title: 'Ein Stück sichere Straße', subtitle: 'Freiwilliger Auftrag des Händlers', map: { ...FOREST, ground: 'dry' },
    units: [
      ...travelParty('k3-begleitung'),
      { id: 'reisender', name: 'Reisender', team: 'player', x: 0, y: 2, hp: 18, atk: 0, def: 0, speed: 4, move: 3, jump: 1,
        abilities: [], attack: false, preset: 'merchant', nonLethal: true, title: 'Bringt ihn zum Wegzeichen im Osten' },
      bandit('raeuber-1', 5, 2, 2), bandit('raeuber-2', 6, 4, 2), bandit('raeuber-3', 6, 1, 2, true),
    ],
    abilities: TRAVEL_ABILITIES, progression: earlyProgress('k3-begleitung'), seed: 3042, backdrop: 'day', goalTiles: exit,
    hooks: withLiaHooks({ onRound: travelHint }),
    objective: { text: 'Begleitet den Reisenden', detail: 'Bringt ihn zum goldenen Feld rechts. Lia und der Reisende dürfen nicht fallen.', win: [{ type: 'escort', unit: 'reisender', tiles: exit }], lose: [{ type: 'unitDown', units: ['lia', 'reisender'] }] },
    victoryText: 'Am Wegzeichen wartet die Reisegruppe. Der Reisende ist sicher.',
    defeatText: 'Gebt dem Reisenden Deckung und versorgt ihn. Ihr könnt die Räuber aufhalten, während er weiterläuft.',
  };
}

/** A small repeatable continuation, unlocked only after Kyra's rescue. No full new story chapter. */
export function onwardEncounter(visit: number): BattleDef {
  const tier = Math.min(3, Math.floor(visit / 2));
  return {
    id: `weiterreise-${visit}`, title: ['Die Straße nach Süden', 'Am steinigen Waldrand', 'Ein versperrter Weg'][visit % 3],
    subtitle: 'Lia, Flick und Kyra', map: { ...FOREST, ground: visit % 2 ? 'dry' : 'forest' },
    units: [
      liaUnit('weiterreise', { x: 1, y: 4, nonLethal: true, title: 'Der Dolch liegt ruhiger in ihrer Hand. Und manchmal gehorcht ihr das Licht.' }),
      { id: 'flick', name: 'Flick', ...characterStats('flick'), team: 'player', x: 2, y: 3, facing: 'e', move: 5, jump: 3,
        abilities: ['bogen', 'messer'], preset: 'flick', nonLethal: true },
      { id: 'kyra', name: 'Kyra', ...characterStats('kyra'), team: 'player', x: 1, y: 5, facing: 'e', move: 4, jump: 2,
        abilities: ['schubsen', 'ausweichen', 'steinwurf', 'decken'], preset: 'kyra', nonLethal: true },
      bandit('raeuber-1', 5, 3, 3 + tier), bandit('raeuber-2', 6, 5, 3 + tier),
      bandit('raeuber-3', 6, 1, 3 + tier, true),
    ],
    abilities: TRAVEL_ABILITIES,
    progression: { actionExp: 8, defeatExp: 12, actionAp: 2, victoryExp: 35, victoryAp: 6,
      // Level caps: the repeatable road cannot be farmed endlessly (Lia 4–6).
      budgets: { lia: liaBudget('weiterreise'), flick: { exp: 70, ap: 16, maxLevel: 10 }, kyra: { exp: 70, ap: 16, maxLevel: 4 } } },
    seed: 6000 + visit, backdrop: 'day',
    hooks: withLiaHooks({ onRound: travelHint }),
    objective: { text: 'Sichert den Weg', detail: 'Vertreibt die Wegelagerer. Alle drei helfen einander.', win: [{ type: 'defeatAll' }] },
    victoryText: 'Der Weg ist frei. Gemeinsam werden die drei sicherer.',
    defeatText: 'Flick hält Abstand, Kyra schubst Gegner weg. Lia sticht zu, wenn sich ein Räuber umdreht, und versorgt die Gruppe.',
  };
}

/** Lia's one-time dagger tutorial in whichever travel fight comes first. */
async function travelHint(ctx: BattleCtx, round: number, phase: Phase): Promise<void> {
  if (round === 1 && phase === 'player') await liaCombatHint(ctx);
}

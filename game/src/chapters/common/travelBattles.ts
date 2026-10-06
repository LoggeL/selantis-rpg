import { G } from '../../core/G';
import type { BattleDef, BattleUnitDef } from '../../tactics/api';
import type { BattleProgression } from '../../tactics/rules/types';
import { characterStats } from './battleCharacters';

/** Lia gains at most a small amount per early encounter, even when a battle is prolonged. */
export const EARLY_PROGRESS: BattleProgression = {
  actionExp: 4, defeatExp: 6, actionAp: 1, victoryExp: 20, victoryAp: 4,
  budgets: {
    lia: { exp: 30, ap: 8, maxLevel: 3 },
    foltan: { exp: 30, ap: 8 }, azar: { exp: 30, ap: 8 },
    reisender: { exp: 0, ap: 0 },
  },
};

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

function liaUnit(late = false): BattleUnitDef {
  return {
    id: 'lia', name: 'Lia', ...characterStats('lia'), team: 'player', x: 1, y: 4, facing: 'e',
    move: 4, jump: 2, preset: 'lia-cloak', portrait: 'lia-cloak', nonLethal: true,
    title: late ? 'Schritt für Schritt lernt sie, dem Licht zu vertrauen' : 'Noch unsicher, aber sie hilft ihren Gefährten',
    abilities: late
      ? ['ausweichen', 'ablenken', 'steinwurf', 'versorgen', ...(G.state.has('dagger') ? ['dolch'] : []), ...(G.state.knows('lichtstoss') ? ['lichtstoss'] : [])]
      : ['steinwurf', 'decken', 'versorgen'],
  };
}

function travelParty(): BattleUnitDef[] {
  return [
    liaUnit(),
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
    units: [...travelParty(), bandit('raeuber-1', 5, 3, 1), bandit('raeuber-2', 6, 5, 1)],
    abilities: TRAVEL_ABILITIES, progression: EARLY_PROGRESS, seed: 2041, backdrop: 'forest',
    objective: { text: 'Macht den Weg frei', detail: 'Zwei schwache Wegelagerer. Foltan kämpft, Lia und Azar helfen.', win: [{ type: 'defeatAll' }], lose: [{ type: 'unitDown', units: ['lia'] }] },
    victoryText: 'Die Räuber laufen davon. Lia hat ihren ersten Kampf mit der Gruppe bestanden.',
    defeatText: 'Bleibt beieinander. Foltan kämpft; Lia kann Deckung geben, versorgen oder Steine werfen.',
  };
}

export function escortEncounter(): BattleDef {
  const exit = [{ x: 7, y: 2 }];
  return {
    id: 'k3-begleitung', title: 'Ein Stück sichere Straße', subtitle: 'Freiwilliger Auftrag des Händlers', map: { ...FOREST, ground: 'dry' },
    units: [
      ...travelParty(),
      { id: 'reisender', name: 'Reisender', team: 'player', x: 0, y: 2, hp: 18, atk: 0, def: 0, speed: 4, move: 3, jump: 1,
        abilities: [], preset: 'merchant', nonLethal: true, title: 'Bringt ihn zum Wegzeichen im Osten' },
      bandit('raeuber-1', 5, 2, 2), bandit('raeuber-2', 6, 4, 2), bandit('raeuber-3', 6, 1, 2, true),
    ],
    abilities: TRAVEL_ABILITIES, progression: EARLY_PROGRESS, seed: 3042, backdrop: 'day', goalTiles: exit,
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
      liaUnit(true),
      { id: 'flick', name: 'Flick', ...characterStats('flick'), team: 'player', x: 2, y: 3, facing: 'e', move: 5, jump: 3,
        abilities: ['bogen', 'messer'], preset: 'flick', nonLethal: true },
      { id: 'kyra', name: 'Kyra', ...characterStats('kyra'), team: 'player', x: 1, y: 5, facing: 'e', move: 4, jump: 2,
        abilities: ['schubsen', 'ausweichen', 'steinwurf', 'decken'], preset: 'kyra', nonLethal: true },
      bandit('raeuber-1', 5, 3, 3 + tier), bandit('raeuber-2', 6, 5, 3 + tier),
      bandit('raeuber-3', 6, 1, 3 + tier, true),
    ],
    abilities: TRAVEL_ABILITIES,
    progression: { actionExp: 8, defeatExp: 12, actionAp: 2, victoryExp: 35, victoryAp: 6,
      budgets: { lia: { exp: 70, ap: 16 }, flick: { exp: 70, ap: 16 }, kyra: { exp: 70, ap: 16 } } },
    seed: 6000 + visit, backdrop: 'day',
    objective: { text: 'Sichert den Weg', detail: 'Vertreibt die Wegelagerer. Alle drei helfen einander.', win: [{ type: 'defeatAll' }] },
    victoryText: 'Der Weg ist frei. Gemeinsam werden die drei sicherer.',
    defeatText: 'Flick hält Abstand, Kyra schubst Gegner weg. Lia kann die Gruppe versorgen.',
  };
}

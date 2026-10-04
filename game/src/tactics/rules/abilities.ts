import type { AbilityDef } from './types';

/**
 * Standard ability library. Battles may add or override entries via BattleDef.abilities.
 * Damage = power + user.atk − target.def, then multiplied by flank/height/guard.
 */
export const STANDARD_ABILITIES: Record<string, AbilityDef> = {
  // ---------------- Valentus ----------------
  handstoss: {
    id: 'handstoss', name: 'Handstoß', kind: 'melee', target: 'enemy', range: [1, 1], shape: { type: 'single' },
    power: 3, accuracy: 92, push: 1, vfx: 'palm',
    description: 'Ein Stoß mit der offenen Hand, getragen von Licht. Stößt das Ziel 1 Feld zurück.',
  },
  strahl: {
    id: 'strahl', name: 'Strahl', kind: 'magic', target: 'tile', range: [1, 1], shape: { type: 'line', length: 5 },
    power: 3, accuracy: 96, cooldown: 2, vfx: 'beam', ignoresCover: true,
    description: 'Ein türkiser Lichtstrahl aus der Hand. Trifft alle Feinde in einer Linie (5 Felder).',
  },
  druckwelle: {
    id: 'druckwelle', name: 'Druckwelle', kind: 'magic', target: 'self', range: [0, 0], shape: { type: 'ring', radius: 1 },
    power: 1, accuracy: 100, alwaysHits: true, push: 1, cooldown: 3, vfx: 'shockwave', noFlank: true,
    description: 'Stößt alle angrenzenden Einheiten 1 Feld weg. Aufprall und Sturz verursachen Zusatzschaden.',
  },
  schutzwall: {
    id: 'schutzwall', name: 'Schutzwall', kind: 'support', target: 'ally', range: [0, 3], shape: { type: 'single' },
    power: 0, accuracy: 100, alwaysHits: true, cooldown: 3, vfx: 'ward',
    effects: [{ status: 'guarded', turns: 1, on: 'target' }],
    description: 'Ein schimmernder Wall: Der Verbündete erleidet bis zu seinem nächsten Zug halben Schaden und kann nicht gestoßen werden.',
  },

  // ---------------- Falken ----------------
  doppelhieb: {
    id: 'doppelhieb', name: 'Doppelhieb', kind: 'melee', target: 'enemy', range: [1, 1], shape: { type: 'single' },
    power: 1, hits: 2, accuracy: 86, vfx: 'double',
    description: 'Zwei schnelle Schläge mit beiden Kurzschwertern. Jeder Schlag würfelt einzeln.',
  },
  tritt: {
    id: 'tritt', name: 'Tritt', kind: 'melee', target: 'enemy', range: [1, 1], shape: { type: 'single' },
    power: 0, accuracy: 90, push: 1, cooldown: 2, vfx: 'kick',
    description: 'Ein harter Tritt, der das Ziel 1 Feld zurückstößt – gut über Kanten.',
  },

  // ---------------- Dunkelschatten ----------------
  schwerthieb: {
    id: 'schwerthieb', name: 'Schwerthieb', kind: 'melee', target: 'enemy', range: [1, 1], shape: { type: 'single' },
    power: 2, accuracy: 84, vfx: 'slash',
    description: 'Ein grober Hieb mit dem Schwert.',
  },
  speerstoss: {
    id: 'speerstoss', name: 'Speerstoß', kind: 'melee', target: 'enemy', range: [1, 2], shape: { type: 'single' },
    power: 2, accuracy: 82, vfx: 'thrust', vertical: 2,
    description: 'Der Speer reicht zwei Felder weit.',
  },
  bolzen: {
    id: 'bolzen', name: 'Armbrustbolzen', kind: 'ranged', target: 'enemy', range: [2, 5], shape: { type: 'single' },
    power: 2, accuracy: 78, heightRange: true, needsLine: true, vfx: 'bolt',
    description: 'Ein Bolzen auf Entfernung. Von oben reicht er weiter.',
  },
  axthieb: {
    id: 'axthieb', name: 'Axthieb', kind: 'melee', target: 'enemy', range: [1, 1], shape: { type: 'single' },
    power: 3, accuracy: 80, vfx: 'heavy',
    description: 'Ein wuchtiger Hieb mit der Axt.',
  },
  wuchtschlag: {
    id: 'wuchtschlag', name: 'Wuchtschlag', kind: 'melee', target: 'enemy', range: [1, 1], shape: { type: 'single' },
    power: 2, accuracy: 76, push: 1, cooldown: 2, vfx: 'heavy',
    description: 'Die Axt mit voller Wucht: wirft das Ziel 1 Feld zurück.',
  },

  // ---------------- Lia ----------------
  ausweichen: {
    id: 'ausweichen', name: 'Ausweichen', kind: 'support', target: 'self', range: [0, 0], shape: { type: 'self' },
    power: 0, accuracy: 100, alwaysHits: true, cooldown: 2, vfx: 'dodge',
    effects: [{ status: 'evasive', turns: 1, on: 'self' }],
    description: 'Lia macht sich bereit, auszuweichen: −45 % Trefferchance gegen sie bis zu ihrem nächsten Zug.',
  },
  ablenken: {
    id: 'ablenken', name: 'Ablenken', kind: 'support', target: 'self', range: [0, 0], shape: { type: 'self' },
    power: 0, accuracy: 100, alwaysHits: true, cooldown: 3, vfx: 'taunt',
    effects: [{ status: 'taunt', turns: 1, on: 'self' }, { status: 'evasive', turns: 1, on: 'self' }],
    description: 'Lia ruft und winkt: Feinde in der Nähe gehen auf sie los. Sie weicht dabei besser aus.',
  },
  steinwurf: {
    id: 'steinwurf', name: 'Stein werfen', kind: 'ranged', target: 'enemy', range: [2, 4], shape: { type: 'single' },
    power: 0, fixedDamage: 1, accuracy: 85, push: 1, needsLine: true, vfx: 'stone',
    description: 'Ein Stein an den Kopf: 1 Schaden, stößt das Ziel 1 Feld zurück.',
  },
  dolch: {
    id: 'dolch', name: 'Dolch', kind: 'melee', target: 'enemy', range: [1, 1], shape: { type: 'single' },
    power: 1, accuracy: 80, vfx: 'dagger',
    description: 'Vaters Dolch. Lia ist keine Kämpferin, aber von hinten zählt jeder Stich.',
  },

  // ---------------- Flick ----------------
  bogen: {
    id: 'bogen', name: 'Bogenschuss', kind: 'ranged', target: 'enemy', range: [2, 5], shape: { type: 'single' },
    power: 2, accuracy: 86, heightRange: true, needsLine: true, vfx: 'arrow',
    description: 'Ein gezielter Pfeil. Von oben reicht der Bogen weiter.',
  },
  messer: {
    id: 'messer', name: 'Messer', kind: 'melee', target: 'enemy', range: [1, 1], shape: { type: 'single' },
    power: 1, accuracy: 90, vfx: 'dagger',
    description: 'Ein schneller Stich mit dem Jagdmesser.',
  },

  // ---------------- shared ----------------
  befreien: {
    id: 'befreien', name: 'Befreien', kind: 'interact', target: 'bound', range: [1, 1], shape: { type: 'single' },
    power: 0, accuracy: 100, alwaysHits: true, frees: true, vfx: 'free',
    description: 'Die Fesseln einer angrenzenden Gefangenen lösen.',
  },
  schubsen: {
    id: 'schubsen', name: 'Schubsen', kind: 'melee', target: 'enemy', range: [1, 1], shape: { type: 'single' },
    power: 0, accuracy: 88, push: 1, cooldown: 1, vfx: 'kick',
    description: 'Mit aller Kraft wegstoßen: 1 Feld zurück.',
  },
};

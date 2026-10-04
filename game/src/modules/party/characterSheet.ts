import { ITEM_NAMES, type ItemId } from "../inventory/catalog";
import { availableParty, type PartyFlags, type PartyState } from "./model";
import type { CombatKind, CombatStats, StatsRules } from "./stats";
import type { AbilityDefinition } from "../combat/encounter";

/** A read model accepts structural combat snapshots without depending on their scene or grid. */
export type CharacterUnit = { id: string; kind: CombatKind; side: string; alive: boolean; hp: number } & Partial<CombatStats>;
export type CharacterBattleSnapshot = {
  moved: boolean; acted: boolean; guarding: boolean; facing: 'n' | 'e' | 's' | 'w';
  units: Array<CharacterUnit & { maxHp: number } & CombatStats>;
};
export type CharacterStatInput = {
  scene: string; units?: readonly CharacterUnit[]; moved?: boolean;
  inventory?: Partial<Record<ItemId, number>>; battle?: CharacterBattleSnapshot;
  flags?: PartyFlags; party?: PartyState; selected?: string;
};
export type CarriedItem = { id: ItemId; name: string; count: number };
export type CharacterSnapshot = {
  id: string; name: string; portrait: string; profile: string;
  stats: { label: string; value: string }[]; hp?: number; maxHp?: number;
  abilities: { name: string; key: string; description: string }[]; items: CarriedItem[];
};
export const VALENTUS_SCENES = new Set(['battle', 'break', 'flight', 'refuge']);
export const EQUIPMENT = new Set<ItemId>(['dolch', 'reisezeug']);
export const PLAYABLE = new Set(['battle', 'break', 'flight', 'refuge', 'lia', 'world', 'raid', 'aftermath', 'journey', 'companions-road', 'golden-boar', 'reading-camp', 'brotherhood', 'betrayal', 'rain-forest', 'flick-trail', 'shadow-camp', 'sisters-reunited', 'film-one-finale']);
export type CharacterSheetCatalog = {
  identities: Record<string, { name: string; portrait: string }>;
  abilities: readonly AbilityDefinition[];
  fallbackMovement: number;
};
export function createCharacterSheetRules(catalog: CharacterSheetCatalog, { resolvePartyUnitStats }: Pick<StatsRules, 'resolvePartyUnitStats'>) {
  const CHARACTER_IDENTITIES = catalog.identities;
  function valentusAbilities(stats?: Partial<CombatStats>, flight = false): CharacterSnapshot['abilities'] {
    return catalog.abilities.map(ability => {
      const damage = ability.damageStat && stats?.[ability.damageStat] !== undefined ? stats[ability.damageStat] : ability.damage;
      const description = flight ? 'Blaue Magie auf der Flucht.' : ability.targeting === 'line'
        ? `${damage} Schaden · bis ${ability.range} Felder. Durchdringt Figuren, endet am Fels.`
        : `${damage} Schaden · Reichweite ${ability.range} Felder · Fläche ${(ability.radius ?? 0) * 2 + 1} × ${(ability.radius ?? 0) * 2 + 1}. Stößt Feinde bis zu ${ability.push ?? 0} Felder zurück.`;
      return { name: ability.display.name, key: ability.display.key, description };
    });
  }
  function carriedItems(inventory: CharacterStatInput['inventory'] = {}): CarriedItem[] {
    return (Object.keys(ITEM_NAMES) as ItemId[]).filter(id => Number.isFinite(inventory[id]) && (inventory[id] ?? 0) > 0)
      .map(id => ({ id, name: ITEM_NAMES[id], count: inventory[id]! }));
  }
  function appendCombatStats(sheet: CharacterSnapshot, stats: CombatStats) {
    const fields = (count: number) => count === 1 ? '1 Feld' : `${count} Felder`;
    sheet.stats.push({ label: 'Bewegung', value: fields(stats.move) }, { label: 'Angriff', value: `${stats.attack}` },
      { label: 'Verteidigung', value: `${stats.defense}` }, { label: 'Tempo', value: `${stats.speed}` },
      { label: 'Reichweite', value: fields(stats.attackRange) });
    if (typeof stats.magicAttack === 'number') sheet.stats.push({ label: 'Magie', value: `${stats.magicAttack}` });
  }
  function battleCharacter(input: CharacterStatInput, unit: CharacterUnit): CharacterSnapshot {
    const live = input.battle?.units.find(entry => entry.id === unit.id);
    const sheet: CharacterSnapshot = { id: unit.id, name: CHARACTER_IDENTITIES[unit.kind]?.name ?? unit.id,
      portrait: CHARACTER_IDENTITIES[unit.kind]?.portrait ?? 'valentus', profile: unit.side === 'valentus' ? 'Die Schlacht von Dunkelhain' : 'An deiner Seite',
      hp: Math.max(0, unit.hp), maxHp: live?.maxHp, stats: [], abilities: unit.kind === 'valentus' ? valentusAbilities(live) : [], items: [] };
    sheet.stats.push({ label: 'Lebenspunkte', value: live ? `${sheet.hp} / ${live.maxHp} HP` : `${sheet.hp} HP` });
    if (live) appendCombatStats(sheet, live);
    else if (unit.kind === 'valentus') sheet.stats.push({ label: 'Bewegung', value: `${catalog.fallbackMovement} Felder` });
    if (unit.kind === 'valentus') {
      const moved = input.battle?.moved ?? input.moved;
      if (typeof moved === 'boolean') sheet.stats.push({ label: 'Bewegung im Zug', value: moved ? 'Bereits bewegt' : 'Noch verfügbar' });
      if (input.battle) sheet.stats.push({ label: 'Aktion im Zug', value: input.battle.acted ? 'Bereits ausgeführt' : 'Noch verfügbar' },
        { label: 'Blickrichtung', value: ({ n: 'Norden', e: 'Osten', s: 'Süden', w: 'Westen' })[input.battle.facing] },
        { label: 'Deckung', value: input.battle.guarding ? 'Verstärkt' : 'Normal' });
    }
    return sheet;
  }
  /** Membership follows the actual encounter; friendly battle health always comes from live units. */
  function partyRoster(input: CharacterStatInput): CharacterSnapshot[] {
    if (input.scene === 'battle') return (input.battle?.units ?? input.units ?? [])
      .filter(unit => unit.alive && unit.side !== 'enemy').map(unit => battleCharacter(input, unit));
    if (VALENTUS_SCENES.has(input.scene)) return [{ id: 'valentus', name: 'Valentus',
      portrait: input.scene === 'flight' || input.scene === 'break' ? 'valentus-wounded' : 'valentus',
      profile: ({ break: 'Verwundet', flight: 'Auf der Flucht', refuge: 'In der Zuflucht' })[input.scene] ?? 'In Dunkelhain',
      stats: input.scene === 'break' || input.scene === 'flight' ? [{ label: 'Zustand', value: 'Verwundet' }] : [],
      abilities: input.scene === 'flight' ? valentusAbilities(undefined, true) : [], items: [] }];
    return availableParty(input.flags).map(id => {
      const member = input.party?.members[id];
      const sheet: CharacterSnapshot = { id, name: CHARACTER_IDENTITIES[id].name, portrait: CHARACTER_IDENTITIES[id].portrait, profile: id === 'lia'
        ? ({ lia: 'Mit Kyra am Bach', world: 'Auf dem Heimweg', raid: 'Am Hof', aftermath: 'Vorbereitung auf die Reise', journey: 'Auf der Reise', 'companions-road': 'Mit Foltan und Azar im Wald' })[input.scene] ?? 'Unterwegs'
        : 'Mit Lia unterwegs', stats: [], abilities: [], items: id === 'lia' ? carriedItems(input.inventory) : [] };
      if (member) {
        sheet.hp = member.hp; sheet.maxHp = member.maxHp; sheet.stats.push({ label: 'Lebenspunkte', value: `${member.hp} / ${member.maxHp} HP` });
        if (id === 'flick') sheet.stats.push({ label: 'Erfahrung', value: 'Bogenschützin und Fährtenleserin' });
        else if (id === 'kyra') sheet.stats.push({ label: 'Rolle', value: 'Lias Schwester' });
        else appendCombatStats(sheet, resolvePartyUnitStats(member));
      }
      if (id === 'lia' && input.scene === 'journey') sheet.stats.push({ label: 'Nachtlager', value: input.flags?.firstCampRested ? 'Ausgeruht' : 'Noch keine Nachtruhe' });
      return sheet;
    });
  }
  function characterSnapshot(input: CharacterStatInput): CharacterSnapshot {
    const roster = partyRoster(input);
    return roster.find(member => member.id === input.selected) ?? roster[0] ?? { id: 'valentus', name: 'Valentus', portrait: 'valentus', profile: 'Die Schlacht von Dunkelhain', stats: [], abilities: [], items: [] };
  }


  return { carriedItems, partyRoster, characterSnapshot };
}

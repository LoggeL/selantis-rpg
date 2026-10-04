import { describe, expect, it } from 'vitest';
import { createPartyMember, transitionPartyHealth, validatePartyState, characterSnapshot, partyRoster } from "../../app/characterRules";
import { createCharacterRules } from "./characterRules";
import { migratePartyState, partyState, changePartyHealth } from "../../app/party";

const flags = { metFoltanAzar: true };
describe('party domain validation and health transitions', () => {
  it('clamps health and repairs invalid attributes without healing wounds or mutating input', () => {
    const raw = { version: 1, members: {
      lia: { hp: 37.9, maxHp: 100, combat: { ...createPartyMember('lia').combat, defense: 17, attack: NaN } },
      foltan: { hp: 999, maxHp: 140, combat: {} },
      azar: { hp: -5, maxHp: Infinity, combat: { speed: -3 } },
      stranger: { hp: 90, maxHp: 90, combat: {} },
    } };
    const canonical = validatePartyState(raw, flags);
    expect(canonical.members.lia).toMatchObject({ hp: 37, maxHp: 100, combat: { defense: 17, attack: 14 } });
    expect(canonical.members.foltan?.hp).toBe(140);
    expect(canonical.members.azar).toMatchObject({ hp: 0, maxHp: 180, combat: { speed: 5 } });
    expect(Object.keys(canonical.members)).toEqual(['lia', 'foltan', 'azar']);
    expect(raw.members.lia.hp).toBe(37.9);
    expect(raw.members.azar.hp).toBe(-5);
  });
  it('never turns corrupt HP into a healthy present member', () => {
    for (const hp of [NaN, Infinity, undefined, '90']) {
      expect(validatePartyState({ version: 1, members: { lia: { hp, maxHp: 100 } } }).members.lia?.hp).toBe(0);
    }
    expect(validatePartyState(undefined).members.lia?.hp).toBe(100);
  });
  it('returns independent health transitions and rejects unavailable members and invalid deltas', () => {
    const before = validatePartyState(undefined, flags);
    before.members.foltan!.combat.defense = 17;
    const after = transitionPartyHealth(before, 'foltan', -37.9, flags)!;
    expect(before.members.foltan?.hp).toBe(140);
    expect(after.members.foltan).toMatchObject({ hp: 103, combat: { defense: 17 } });
    expect(after.members.foltan?.combat).not.toBe(before.members.foltan?.combat);
    expect(transitionPartyHealth(before, 'foltan', -1, {})).toBeUndefined();
    expect(transitionPartyHealth(before, 'lia', NaN, flags)).toBeUndefined();
  });
});

describe('registry migration and character read models', () => {
  it('limits prototype healing to health-only migration and preserves injured companions', () => {
    const legacy = { version: 1, members: { foltan: { hp: 83, maxHp: 100 }, azar: { hp: 100, maxHp: 100 } } };
    expect(migratePartyState(legacy, flags).members.foltan).toMatchObject({ hp: 83, maxHp: 140 });
    expect(migratePartyState(legacy, flags).members.azar).toMatchObject({ hp: 180, maxHp: 180 });
    expect(legacy.members.azar).toEqual({ hp: 100, maxHp: 100 });
    expect(migratePartyState({ version: 1, members: { lia: { hp: 37, maxHp: -1 } } }).members.lia?.hp).toBe(37);
    const canonical = migratePartyState(legacy, flags);
    canonical.members.azar!.hp = 67;
    expect(migratePartyState(canonical, flags).members.azar?.hp).toBe(67);
  });
  it('repairs registry state in place while sheet reads preserve health and member references', () => {
    const store = new Map<string, unknown>([['world', { flags }], ['party', { version: 1, members: { lia: { ...createPartyMember('lia'), hp: -2 } } }]]);
    const registry = { get: (key: string) => store.get(key), set: (key: string, value: unknown) => store.set(key, value) };
    const party = partyState(registry, flags), lia = party.members.lia;
    expect(lia?.hp).toBe(0);
    changePartyHealth(registry, 'lia', 20);
    expect(partyState(registry, flags)).toBe(party);
    expect(party.members.lia).toBe(lia);
    expect(partyRoster({ scene: 'journey', flags, party })[0].hp).toBe(20);
  });
  it('preserves party identities and equipment ownership and reads shared ability values with live overrides', () => {
    const party = validatePartyState(undefined, flags);
    const roster = partyRoster({ scene: 'journey', flags, party, inventory: { dolch: 1, reisezeug: 1 } });
    expect(roster.map(({ id, name, portrait, items }) => ({ id, name, portrait, items }))).toEqual([
      { id: 'lia', name: 'Lia', portrait: 'lia', items: [{ id: 'dolch', name: 'Familientolch', count: 1 }, { id: 'reisezeug', name: 'Mantel, Decke und Schuhe', count: 1 }] },
      { id: 'foltan', name: 'Foltan', portrait: 'foltan', items: [] },
      { id: 'azar', name: 'Azar', portrait: 'azar', items: [] },
    ]);
    const stats = { attack: 100, defense: 20, speed: 8, move: 4, attackRange: 7, magicAttack: 88 };
    const battle = { moved: false, acted: false, guarding: false, facing: 'e' as const,
      units: [{ id: 'valentus', kind: 'valentus' as const, side: 'valentus', alive: true, hp: 37, maxHp: 100, ...stats }] };
    expect(characterSnapshot({ scene: 'battle', battle }).abilities).toEqual([
      { name: 'Strahl', key: 'Q', description: '88 Schaden · bis 7 Felder. Durchdringt Figuren, endet am Fels.' },
      { name: 'Druckwelle', key: 'R', description: '80 Schaden · Reichweite 4 Felder · Fläche 3 × 3. Stößt Feinde bis zu 2 Felder zurück.' },
    ]);
    expect(characterSnapshot({ scene: 'flight' }).abilities.every(ability => ability.description === 'Blaue Magie auf der Flucht.')).toBe(true);
  });
});


describe('independent authored character catalogs', () => {
  it('binds different battle, health, identity and ability values once without prologue defaults', () => {
    const combat = { attack: 11, defense: 3, speed: 2, move: 2, attackRange: 3 };
    const rules = createCharacterRules({
      partyProfiles: { lia: { maxHp: 55, combat }, foltan: { maxHp: 66, combat }, azar: { maxHp: 77, combat }, flick: { maxHp: 88, combat }, kyra: { maxHp: 99, combat } },
      combatProfiles: { valentus: { ...combat, magicAttack: 12 }, guardian: { ...combat, defense: 9 } },
      identities: { valentus: { name: 'Wanderer', portrait: 'wanderer' }, lia: { name: 'Scout', portrait: 'scout' }, foltan: { name: 'Companion', portrait: 'companion' }, azar: { name: 'Guard', portrait: 'guard' } },
      fallbackMovement: 2,
      abilities: [{ id: 'ray', targeting: 'line', range: 3, damage: 12, cost: 'act', protectsAllies: true, display: { name: 'Licht', icon: 'ray', key: 'L', color: 0 } }],
    });
    expect(rules.resolveBattleUnitStats({ kind: 'guardian' })).toEqual({ ...combat, defense: 9 });
    expect(rules.createPartyMember('lia').maxHp).toBe(55);
    const party = rules.validatePartyState(undefined);
    expect(rules.partyRoster({ scene: 'journey', party })[0]).toMatchObject({ name: 'Scout', hp: 55 });
    const sheet = rules.characterSnapshot({ scene: 'battle', units: [{ id: 'wanderer', kind: 'valentus', side: 'valentus', alive: true, hp: 21 }] });
    expect(sheet).toMatchObject({ name: 'Wanderer', portrait: 'wanderer', abilities: [{ name: 'Licht', key: 'L', description: '12 Schaden · bis 3 Felder. Durchdringt Figuren, endet am Fels.' }] });
    expect(sheet.stats).toContainEqual({ label: 'Bewegung', value: '2 Felder' });
  });
});

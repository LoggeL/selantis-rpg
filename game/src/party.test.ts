import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: {} }));
vi.mock('./audio', () => ({ sfx: {} }));
import { availableParty, changePartyHealth, healPartyMember, partyState } from './party';
import { partyRoster } from './characterStats';
import { incomingDamage, TACTICAL_STATS, type BattleSnapshot } from './battle/tactics';
import { createPartyMember, PARTY_COMBAT_PROFILES, resolveBattleUnitStats, resolvePartyUnitStats } from './combatStats';

function registry(flags: Record<string, boolean> = {}) {
  const world = { flags, inv: {}, picked: {} }; const store = new Map<string, unknown>([['world', world]]);
  return { get: (key: string) => store.get(key), set: (key: string, value: unknown) => store.set(key, value) };
}

describe('persisted travel party', () => {
  it('requires the completed meeting and released ropes before companions join', () => {
    expect(availableParty({ metFoltanAzar: true })).toEqual(['lia']);
    expect(availableParty({ journeyRopesReleased: true })).toEqual(['lia']);
    expect(availableParty({ metFoltanAzar: true, journeyRopesReleased: true })).toEqual(['lia', 'foltan', 'azar']);
    const reg = registry(); const party = partyState(reg);
    expect(party.members).toEqual({ lia: createPartyMember('lia') });
    const flags = { metFoltanAzar: true, journeyRopesReleased: true };
    expect(partyState(reg, flags)).toBe(party);
    expect(partyRoster({ scene: 'journey', flags, party }).map(member => member.id)).toEqual(['lia', 'foltan', 'azar']);
    expect(partyRoster({ scene: 'journey', flags: {}, party }).map(member => member.id)).toEqual(['lia']);
  });
  it('persists health changes and the character sheet reflects them without overwriting state', () => {
    const reg = registry(); const party = partyState(reg); changePartyHealth(reg, 'lia', -31);
    const sheet = partyRoster({ scene: 'journey', party })[0];
    expect(sheet.hp).toBe(69); expect(sheet.maxHp).toBe(100);
    expect(partyState(reg).members.lia?.hp).toBe(69);
    healPartyMember(reg, 'lia'); expect(party.members.lia?.hp).toBe(100);
    changePartyHealth(reg, 'lia', -999); expect(party.members.lia?.hp).toBe(0);
    expect(changePartyHealth(reg, 'foltan', -5)).toBeUndefined();
    expect(changePartyHealth(reg, 'lia', NaN)).toBeUndefined();
  });
  it('keeps actual equipment with Lia and gives no companion invented equipment or controls as skills', () => {
    const flags = { metFoltanAzar: true, journeyRopesReleased: true }; const party = partyState(registry(flags), flags);
    const roster = partyRoster({ scene: 'journey', flags, party, inventory: { dolch: 1, reisezeug: 1 } });
    expect(roster[0].items.map(item => item.id)).toEqual(['dolch', 'reisezeug']);
    expect(roster[1].items).toEqual([]); expect(roster[2].items).toEqual([]);
    for (const member of roster) expect(member.abilities).toEqual([]);
  });
  it('persists character-specific combat baselines without resetting wounds or tuned stats on reread', () => {
    const flags = { metFoltanAzar: true, journeyRopesReleased: true }, reg = registry(flags);
    const party = partyState(reg, flags);
    expect(party.members.lia).toEqual(createPartyMember('lia'));
    expect(party.members.foltan).toEqual(createPartyMember('foltan'));
    expect(party.members.azar).toEqual(createPartyMember('azar'));
    changePartyHealth(reg, 'foltan', -37);
    party.members.foltan!.combat.defense = 17;
    expect(partyState(reg, flags)).toBe(party);
    expect(party.members.foltan).toMatchObject({ hp: 103, maxHp: 140, combat: { defense: 17 } });
    expect(resolvePartyUnitStats(party.members.foltan!).defense).toBe(17);
    healPartyMember(reg, 'foltan'); expect(party.members.foltan!.hp).toBe(140);
    expect(party.members.foltan!.combat.defense).toBe(17);
  });
  it('enriches the previous health-only state and preserves damaged HP exactly', () => {
    const flags = { metFoltanAzar: true, journeyRopesReleased: true }, reg = registry(flags);
    reg.set('party', { version: 1, members: { lia: { hp: 69, maxHp: 100 }, foltan: { hp: 83, maxHp: 100 }, azar: { hp: 100, maxHp: 100 } } });
    const party = partyState(reg, flags);
    expect(party.members.lia).toMatchObject({ hp: 69, maxHp: 100, combat: PARTY_COMBAT_PROFILES.lia.combat });
    expect(party.members.foltan).toMatchObject({ hp: 83, maxHp: 140, combat: PARTY_COMBAT_PROFILES.foltan.combat });
    expect(party.members.azar).toMatchObject({ hp: 180, maxHp: 180, combat: PARTY_COMBAT_PROFILES.azar.combat });
    partyState(reg, flags); expect(party.members.foltan!.hp).toBe(83);
  });
  it('shares the same party stat factory with fight unit resolution and keeps character identities distinct', () => {
    for (const id of ['lia', 'foltan', 'azar'] as const) {
      const member = createPartyMember(id), combat = resolvePartyUnitStats(member);
      expect(resolveBattleUnitStats({ kind: id })).toEqual(combat);
      expect(combat).not.toHaveProperty('magicAttack');
      const overridden = resolveBattleUnitStats({ kind: id, ...combat, defense: 22 });
      expect(overridden.defense).toBe(22);
      expect(member.combat.defense).toBe(PARTY_COMBAT_PROFILES[id].combat.defense);
    }
    const lia = createPartyMember('lia'), foltan = createPartyMember('foltan'), azar = createPartyMember('azar');
    expect(lia.combat.speed).toBeGreaterThan(foltan.combat.speed);
    expect(lia.combat.move).toBeGreaterThan(foltan.combat.move);
    expect(lia.combat.attack).toBeLessThan(foltan.combat.attack);
    expect(azar.hp).toBeGreaterThan(foltan.hp);
    expect(azar.combat.attack).toBeGreaterThan(foltan.combat.attack);
    expect(azar.combat.defense).toBeGreaterThan(foltan.combat.defense);
    expect(azar.combat.speed).toBeLessThan(foltan.combat.speed);
    const secondLia = createPartyMember('lia'); secondLia.combat.attack = 99;
    expect(lia.combat.attack).toBe(14);
  });
  it('reads the same persisted stats for character sheets and party damage calculations', () => {
    const flags = { metFoltanAzar: true, journeyRopesReleased: true }, reg = registry(flags), party = partyState(reg, flags);
    party.members.foltan!.combat.defense = 17;
    changePartyHealth(reg, 'foltan', -12);
    const roster = partyRoster({ scene: 'journey', flags, party });
    expect(roster[1].hp).toBe(128);
    expect(roster[1].maxHp).toBe(140);
    expect(roster[1].stats).toContainEqual({ label: 'Verteidigung', value: '17' });
    for (const [index, id] of ['lia', 'foltan', 'azar'].entries()) {
      const stats = resolvePartyUnitStats(party.members[id as 'lia' | 'foltan' | 'azar']!);
      expect(roster[index].stats).toEqual(expect.arrayContaining([
        { label: 'Angriff', value: `${stats.attack}` }, { label: 'Verteidigung', value: `${stats.defense}` },
        { label: 'Tempo', value: `${stats.speed}` }, { label: 'Bewegung', value: `${stats.move} Felder` },
        { label: 'Reichweite', value: `${stats.attackRange} ${stats.attackRange === 1 ? 'Feld' : 'Felder'}` },
      ]));
      expect(roster[index].stats.some(stat => /Magie|MP|Mana/.test(stat.label))).toBe(false);
    }
    const damage = incomingDamage(24, resolvePartyUnitStats(party.members.foltan!).defense, 'side');
    expect(damage).toBe(16);
    changePartyHealth(reg, 'foltan', -damage);
    expect(partyRoster({ scene: 'journey', flags, party })[1].hp).toBe(112);
  });
  it('preserves Valentus rules and gives live unit stats priority over defaults', () => {
    expect(resolveBattleUnitStats({ kind: 'valentus' })).toMatchObject({ attack: 100, magicAttack: 100, defense: 20, speed: 8, move: 4, attackRange: 7 });
    expect(resolveBattleUnitStats({ kind: 'warrior', speed: 7 })).toMatchObject({ speed: 7, attack: 24, attackRange: 1 });
    expect(resolveBattleUnitStats({ kind: 'valentus', attack: 88, defense: 17, move: 3, attackRange: 6 })).toMatchObject({ attack: 88, defense: 17, move: 3, attackRange: 6 });
    expect(resolveBattleUnitStats({ kind: 'boy' })).toMatchObject({ attack: 0, attackRange: 0 });
  });
});

describe('friendly combat roster', () => {
  it('uses living friendly units and their current combat values instead of exploration health', () => {
    const battle: BattleSnapshot = { beat: 2, phase: 'plan', moved: false, acted: false, guarding: false, facing: 'e', units: [
      { id: 'valentus', kind: 'valentus', side: 'valentus', alive: true, hp: 41, maxHp: 100, cell: { x: 3, y: 4 }, ...TACTICAL_STATS.valentus },
      { id: 'boy', kind: 'boy', side: 'ally', alive: true, hp: 12, maxHp: 20, cell: { x: 6, y: 3 }, ...TACTICAL_STATS.boy },
      { id: 'enemy', kind: 'warrior', side: 'enemy', alive: true, hp: 60, maxHp: 60, cell: { x: 8, y: 4 }, ...TACTICAL_STATS.warrior },
      { id: 'fallen', kind: 'falke', side: 'ally', alive: false, hp: 0, maxHp: 30, cell: { x: 9, y: 4 }, ...TACTICAL_STATS.falke },
    ] };
    const roster = partyRoster({ scene: 'battle', battle, party: partyState(registry()) });
    expect(roster.map(member => member.id)).toEqual(['valentus', 'boy']);
    expect(roster.map(member => member.hp)).toEqual([41, 12]);
    expect(roster[0].abilities.map(ability => ability.name)).toEqual(['Strahl', 'Druckwelle']);
    expect(roster[1].abilities).toEqual([]); expect(roster[1].stats).toContainEqual({ label: 'Tempo', value: `${TACTICAL_STATS.boy.speed}` });
  });
});

import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: {} }));
vi.mock('./audio', () => ({ sfx: {} }));
import { characterSnapshot, CharacterInputPause, partyRoster } from './characterStats';
import { BEAM_DAMAGE, BEAM_LENGTH, MOVE_RANGE, WAVE_DAMAGE, WAVE_RANGE, type Unit } from './battle/grid';
import { TACTICAL_STATS, type BattleSnapshot } from './battle/tactics';

const valentus = (): Unit => ({ id: 'valentus', kind: 'valentus', side: 'valentus', cell: { x: 3, y: 4 }, hp: 37, alive: true });

describe('character sheet uses the current game model', () => {
  it('reads the published combat snapshot including health, attributes and turn budget', () => {
    const battle: BattleSnapshot = { beat: 2, phase: 'plan', moved: true, acted: false, guarding: true, facing: 'w',
      units: [{ ...valentus(), maxHp: 100, ...TACTICAL_STATS.valentus }] };
    const sheet = characterSnapshot({ scene: 'battle', battle });
    expect(sheet).toMatchObject({ hp: 37, maxHp: 100 });
    expect(sheet.stats).toEqual(expect.arrayContaining([
      { label: 'Lebenspunkte', value: '37 / 100 HP' }, { label: 'Angriff', value: `${TACTICAL_STATS.valentus.attack}` },
      { label: 'Tempo', value: `${TACTICAL_STATS.valentus.speed}` }, { label: 'Verteidigung', value: `${TACTICAL_STATS.valentus.defense}` },
      { label: 'Bewegung im Zug', value: 'Bereits bewegt' }, { label: 'Aktion im Zug', value: 'Noch verfügbar' },
      { label: 'Blickrichtung', value: 'Westen' }, { label: 'Deckung', value: 'Verstärkt' },
    ]));
  });
  it('reads current battle HP and shared movement and spell rules', () => {
    const unit = valentus();
    const sheet = characterSnapshot({ scene: 'battle', units: [unit], moved: false });
    expect(sheet).toMatchObject({ id: 'valentus', hp: 37, stats: [
      { label: 'Lebenspunkte', value: '37 HP' }, { label: 'Bewegung', value: `${MOVE_RANGE} Felder` }, { label: 'Bewegung im Zug', value: 'Noch verfügbar' },
    ] });
    expect(sheet.abilities[0].description).toContain(`${BEAM_DAMAGE} Schaden · bis ${BEAM_LENGTH} Felder`);
    expect(sheet.abilities[1].description).toContain(`${WAVE_DAMAGE} Schaden · Reichweite ${WAVE_RANGE} Felder`);
    unit.hp = 14;
    expect(characterSnapshot({ scene: 'battle', units: [unit], moved: true }).hp).toBe(14);
    expect(characterSnapshot({ scene: 'battle', units: [unit], moved: true }).stats.at(-1)?.value).toBe('Bereits bewegt');
  });
  it('shows Lia inventory without inventing HP, job, mana or spell stats', () => {
    const inventory = { dolch: 1, feder: 2, proviant: 0 };
    const sheet = characterSnapshot({ scene: 'journey', inventory });
    expect(sheet.id).toBe('lia'); expect(sheet.hp).toBeUndefined(); expect(sheet.abilities).toEqual([]);
    expect(sheet.items).toEqual([{ id: 'feder', name: 'Feder', count: 2 }, { id: 'dolch', name: 'Familientolch', count: 1 }]);
    expect(sheet.stats).toEqual([{ label: 'Nachtlager', value: 'Noch keine Nachtruhe' }]);
    expect(inventory).toEqual({ dolch: 1, feder: 2, proviant: 0 });
  });
  it('does not give Valentus Lia inventory or reuse battle damage in a story scene', () => {
    const sheet = characterSnapshot({ scene: 'flight', inventory: { dolch: 1 }, units: [valentus()] });
    expect(sheet.items).toEqual([]); expect(sheet.hp).toBeUndefined(); expect(sheet.portrait).toBe('valentus-wounded');
    expect(sheet.abilities).toHaveLength(2); expect(sheet.abilities[0].description).not.toContain('Schaden');
  });
});

describe('character modal input lifecycle', () => {
  it('clears held keys and restores the original disabled state after repeated holds', () => {
    const resetKeys = vi.fn(); const scene = { input: { enabled: false, keyboard: { enabled: false, resetKeys } } };
    const pause = new CharacterInputPause(); pause.hold(scene); pause.hold(scene); pause.release(scene);
    expect(scene.input.enabled).toBe(false); expect(scene.input.keyboard.enabled).toBe(false); expect(resetKeys).toHaveBeenCalledTimes(2);
  });
  it('does not restore a scene that shut down while the dialog was open', () => {
    const resetKeys = vi.fn(); const scene = { input: { enabled: true, keyboard: { enabled: true, resetKeys } } };
    const pause = new CharacterInputPause(); pause.hold(scene); pause.forget(scene); pause.release(scene);
    expect(scene.input.enabled).toBe(false); expect(scene.input.keyboard.enabled).toBe(false); expect(resetKeys).toHaveBeenCalledOnce();
  });
});

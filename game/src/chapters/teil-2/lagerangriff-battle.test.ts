import { afterEach, describe, expect, it, vi } from 'vitest';
import { G } from '../../core/G';
import type { AudioApi } from '../../audio/api';
import type { UiApi } from '../../ui/api';
import { BattleController, type Presenter } from '../../tactics/controller';
import { distanceField } from '../../tactics/rules/movement';
import { key } from '../../tactics/rules/grid';
import { liaRaidAbilities, raidBattle, WATER_GATE, type RaidSetup } from './lagerangriff-battle';

const BASE: RaidSetup = { azarSabre: false, foltanCovers: false };
const originalAudio = G.audio;
afterEach(() => { G.audio = originalAudio; G.state.reset(); });

function controller(setup: RaidSetup = BASE) {
  G.audio = { sfx: vi.fn() } as unknown as AudioApi;
  const def = raidBattle(setup);
  const presenter = {
    tableau: vi.fn(async () => {}), magicBurst: vi.fn(async () => {}), play: vi.fn(async () => {}), refresh: vi.fn(), focus: vi.fn(async () => {}),
    pose: vi.fn(), bark: vi.fn(), shake: vi.fn(), banner: vi.fn(async () => {}), setObjective: vi.fn(),
  } as unknown as Presenter;
  const ui = { say: vi.fn(async () => {}), plate: vi.fn(async () => {}), closePlate: vi.fn(async () => {}) } as unknown as UiApi;
  return { def, ctrl: new BattleController(def, presenter, ui, () => {}) };
}

describe('e2-ueberfall (camp raid)', () => {
  it('places every unit and every wave on standable tiles and leaves Lia a way to the water gate', () => {
    const { def, ctrl } = controller();
    const grid = ctrl.battle.grid;
    for (const u of [...def.units, ...(def.waves ?? []).flatMap(w => w.units)]) expect(grid.standable(u.x, u.y), u.id).toBe(true);
    for (const t of WATER_GATE) expect(grid.standable(t.x, t.y)).toBe(true);
    const field = distanceField(grid, WATER_GATE, 2);
    expect(field.get(key(4, 2))).toBeDefined();
    expect(field.get(key(4, 2))!).toBeLessThan(20);
  });

  it('only Lia’s fall loses; the defenders and attackers never die', () => {
    const { def } = controller();
    expect(def.objective.lose).toEqual([{ type: 'unitDown', units: ['lia'] }]);
    expect(def.objective.win).toEqual([{ type: 'reach', tiles: WATER_GATE, unit: 'lia' }]);
    expect(def.onDefeat ?? 'retry').toBe('retry');
    const allies = def.units.filter(u => u.team === 'ally');
    expect(allies.map(u => u.id).sort()).toEqual(['azar', 'elnon', 'flick', 'foltan']);
    for (const u of [...def.units, ...(def.waves ?? []).flatMap(w => w.units)]) if (u.id !== 'lia') expect(u.nonLethal, u.id).toBe(true);
  });

  it('starts Lia exhausted without the Urmacht, with Vaters Dolch and her own small means', () => {
    G.state.learn('lichtstoss'); G.state.give('e2-schattentoeter');
    const { ctrl } = controller();
    const lia = ctrl.battle.unit('lia')!;
    expect(lia.hp).toBeLessThanOrEqual(Math.ceil(lia.maxHp / 2));
    expect(lia.attack).toBe('dolch');
    expect(lia.level).toBe(5);
    // „Das Licht schweigt“: no Lichtstoß and no staff even when she knows or holds them.
    expect(lia.abilities).not.toContain('lichtstoss');
    expect(lia.abilities).not.toContain('e2-stabimpuls');
    expect(lia.abilities).not.toContain('urmacht');
    const all = { ausweichen: true, ablenken: true, tincture: true, lichtstoss: true, staff: true };
    expect(liaRaidAbilities(all)).toEqual(['ausweichen', 'ablenken', 'steinwurf', 'versorgen']);
    expect(liaRaidAbilities({ ...all, tincture: false, ausweichen: false, ablenken: false })).toEqual(['steinwurf']);
    // Half HP: her Verzweiflung is awake from the first turn.
    const foe = ctrl.battle.unit('ds-1');
    const plain = ctrl.battle.previewTarget({ ...lia, traits: [] }, ctrl.battle.ability('dolch'), foe, { x: foe.x - 1, y: foe.y });
    const desperate = ctrl.battle.previewTarget(lia, ctrl.battle.ability('dolch'), foe, { x: foe.x - 1, y: foe.y });
    expect(desperate.damage).toBe(plain.damage + 2);
    expect(desperate.chance).toBe(Math.min(100, plain.chance + 10));
    expect(desperate.mods.map(m => m.label)).toContain('Verzweiflung');
  });

  it('turns the alarm choices into battle differences', () => {
    const plain = raidBattle(BASE).units;
    const helped = raidBattle({ ...BASE, azarSabre: true, foltanCovers: true }).units;
    expect(plain.find(u => u.id === 'azar')!.abilities).not.toContain('schwerthieb');
    expect(helped.find(u => u.id === 'azar')!.abilities).toContain('schwerthieb');
    const f0 = plain.find(u => u.id === 'foltan')!, f1 = helped.find(u => u.id === 'foltan')!;
    expect([f1.x, f1.y]).not.toEqual([f0.x, f0.y]);
  });

  it('brings the scarred Baris (nonLethal) through the gate in round four', async () => {
    const { def, ctrl } = controller();
    await def.hooks!.onRound!(ctrl.ctx, 4, 'player');
    const baris = ctrl.battle.unit('baris');
    expect(baris).toBeDefined();
    expect(baris!.nonLethal).toBe(true);
    expect(ctrl.ctx.hasFlag('e2-baris')).toBe(true);
  });
});

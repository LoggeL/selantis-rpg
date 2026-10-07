import { afterEach, describe, expect, it, vi } from 'vitest';
import { G } from '../../core/G';
import type { AudioApi } from '../../audio/api';
import type { UiApi } from '../../ui/api';
import { BattleController, type Presenter } from '../../tactics/controller';
import { distanceField } from '../../tactics/rules/movement';
import { key } from '../../tactics/rules/grid';
import { liaStaffAbilities, STABIMPULS, uebungProgression, uebungskampf, type UebungSetup } from './stabtraining-battle';
import { AIM_START, evaluateShot, nextInDirection, PRACTICE_CALLS, PRACTICE_OBJECTS, practiceVerdict } from './stabtraining-ziele';

const originalAudio = G.audio;
afterEach(() => { G.audio = originalAudio; G.state.reset(); });

function controller(setup: UebungSetup = { lichtstoss: true, won: false }) {
  G.audio = { sfx: vi.fn() } as unknown as AudioApi;
  const def = uebungskampf(setup);
  const presenter = {
    tableau: vi.fn(async () => {}), magicBurst: vi.fn(async () => {}), play: vi.fn(async () => {}), refresh: vi.fn(), focus: vi.fn(async () => {}),
    pose: vi.fn(), bark: vi.fn(), shake: vi.fn(), banner: vi.fn(async () => {}), setObjective: vi.fn(),
  } as unknown as Presenter;
  const ui = { say: vi.fn(async () => {}) } as unknown as UiApi;
  return { def, ctrl: new BattleController(def, presenter, ui, () => {}) };
}

describe('e2-stabtraining target practice', () => {
  it('calls only real targets, each once, and treats nest, lantern and bucket as forbidden', () => {
    const targets = new Set(PRACTICE_OBJECTS.filter(o => o.kind === 'target').map(o => o.id));
    expect(new Set(PRACTICE_CALLS.map(c => c.target)).size).toBe(PRACTICE_CALLS.length);
    for (const c of PRACTICE_CALLS) expect(targets.has(c.target), c.target).toBe(true);
    expect(PRACTICE_OBJECTS.filter(o => o.kind === 'forbidden').map(o => o.id).sort()).toEqual(['eimer', 'laterne', 'nest']);
  });

  it('scores a shot as hit, wrong target or forbidden; misses never advance', () => {
    expect(evaluateShot(0, PRACTICE_CALLS[0].target)).toBe('hit');
    expect(evaluateShot(0, PRACTICE_CALLS[1].target)).toBe('wrong-target');
    expect(evaluateShot(1, 'nest')).toBe('forbidden');
    expect(evaluateShot(PRACTICE_CALLS.length, 'nest')).toBe('done');
    expect(() => evaluateShot(0, 'kuh')).toThrow();
    expect(practiceVerdict(0)).toBe('flawless');
    expect(practiceVerdict(2)).toBe('good');
    expect(practiceVerdict(5)).toBe('hasty');
  });

  it('lets the spatial aim reach every object from the start', () => {
    const seen = new Set<string>([AIM_START]);
    let frontier = [AIM_START];
    for (let i = 0; i < 12 && frontier.length; i++) {
      const next: string[] = [];
      for (const id of frontier) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = nextInDirection(id, dx, dy);
        if (!seen.has(n)) { seen.add(n); next.push(n); }
      }
      frontier = next;
    }
    expect([...seen].sort()).toEqual(PRACTICE_OBJECTS.map(o => o.id).sort());
    // Pressing left from the far right stump moves left, never right.
    const left = PRACTICE_OBJECTS.find(o => o.id === nextInDirection('ziel-stumpf-hinten', -1, 0))!;
    expect(left.at[0]).toBeLessThan(337);
  });
});

describe('e2-uebungskampf', () => {
  it('places every unit on a standable tile and the ghouls can reach Lia across the stones', () => {
    const { def, ctrl } = controller();
    const grid = ctrl.battle.grid;
    for (const u of def.units) expect(grid.standable(u.x, u.y), u.id).toBe(true);
    const lia = def.units.find(u => u.id === 'lia')!;
    const field = distanceField(grid, [{ x: lia.x, y: lia.y }], 2);
    for (const g of def.units.filter(u => u.team === 'enemy')) expect(field.get(key(g.x, g.y)), g.id).toBeDefined();
  });

  it('loses only when Lia falls; Ignatius only guards and nobody dies', () => {
    const { def } = controller();
    expect(def.objective.lose).toEqual([{ type: 'unitDown', units: ['lia'] }]);
    expect(def.onDefeat ?? 'retry').toBe('retry');
    const ig = def.units.find(u => u.id === 'ignatius')!;
    expect(ig.team).toBe('ally');
    expect(ig.abilities).toEqual(['decken']);
    expect(ig.attack).toBe(false);
    expect(controller().ctrl.battle.unit('ignatius').attack).toBe(null);
    for (const u of def.units) if (u.id !== 'lia') expect(u.nonLethal, u.id).toBe(true);
    expect(def.units.filter(u => u.team === 'enemy').map(u => u.preset)).toEqual(['ghoul', 'ghoul']);
  });

  it('gives Lia the staff impulse (single target, 1–3, mp 4, cooldown 2) and Lichtstoß only when known', () => {
    expect(STABIMPULS).toMatchObject({ id: 'e2-stabimpuls', range: [1, 3], shape: { type: 'single' }, mpCost: 4, cooldown: 2, vfx: 'palm' });
    expect(liaStaffAbilities(false)).toEqual(['e2-stabimpuls', 'ausweichen', 'ablenken', 'versorgen']);
    expect(liaStaffAbilities(true)).toContain('lichtstoss');
    const { ctrl } = controller({ lichtstoss: false, won: false });
    expect(ctrl.battle.unit('lia')!.abilities).not.toContain('lichtstoss');
  });

  it('pays EXP and AP only for the first win', () => {
    expect(uebungProgression(false).budgets!.lia.exp).toBeGreaterThan(0);
    const again = uebungProgression(true);
    expect(again.budgets!.lia).toEqual({ exp: 0, ap: 0 });
    expect(again.victoryExp).toBe(0);
  });
});

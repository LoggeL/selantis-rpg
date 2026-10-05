import type { BattleDef } from './api';

export const hofKampf: BattleDef = {
  id: 'kapitel-x-hof',
  title: 'Der Hof im Morgengrauen',
  subtitle: 'Haltet die Scheune',
  backdrop: 'dusk',                       // 'dusk' | 'night' | 'day' | 'forest'
  music: 'battle',
  ambience: ['wind'],
  seed: 42,
  map: {
    height: [
      '2 2 1 0 0 0',
      '2 2 1 0 0 0',
      '1 1 1 0 0 0',
      '0 0 0 0 1 1',
      '0 0 0 0 1 1',
    ],
    terrain: [
      '. b . , , .',
      '. . . , ~ .',
      'r . . , ~ .',
      '. . b , . T',
      '. . . , . .',
    ],
    ground: 'dry',
    paint: [
      '. . . d . .',
      '. . . d . .',
      '. . . d . .',
      '. . . . . .',
      '. . . . . .',
    ],
    props: [{ x: 0, y: 0, prop: 'banner-light' }],
  },
  units: [
    { id: 'valentus', name: 'Valentus', team: 'player', x: 0, y: 0, facing: 's', hp: 30, atk: 3, def: 2,
      move: 4, jump: 2, abilities: ['handstoss', 'strahl', 'druckwelle', 'schutzwall'], preset: 'valentus' },
    { id: 'axt', name: 'Axtkämpfer', team: 'enemy', x: 4, y: 4, facing: 'n', hp: 20, atk: 4, def: 2,
      move: 3, jump: 1, abilities: ['axthieb'], nonLethal: true, preset: 'baris-young', ai: 'melee' },
    { id: 'armbrust', name: 'Armbrustschütze', team: 'enemy', x: 5, y: 4, hp: 10, atk: 3,
      abilities: ['bolzen'], preset: 'shadow-crossbow', ai: 'archer' },
  ],
  waves: [{ round: 3, text: 'Verstärkung!', units: [
    { id: 'ds-9', name: 'Dunkelschatten', team: 'enemy', x: 5, y: 0, hp: 13, atk: 2, def: 1,
      abilities: ['schwerthieb'], preset: 'shadow-sword' },
  ] }],
  objective: {
    text: 'Haltet die Scheune',
    detail: 'Überlebe 4 Runden oder besiege alle Feinde.',
    win: [{ type: 'survive', rounds: 4 }, { type: 'defeatAll' }],
    lose: [{ type: 'unitDown', units: ['valentus'] }],
  },
  victoryText: 'Die Scheune steht noch.',
  hooks: {
    async onStart(ctx) {
      await ctx.say('valentus', 'Bleibt oben am Hang!');
    },
    async onRound(ctx, round, phase) {
      if (round === 1 && phase === 'player') {
        await ctx.hint('Wähle <em>Valentus</em>.', { unit: 'valentus', until: 'select' });
        await ctx.hint('Blaue Felder zeigen seine Reichweite.', { until: 'move' });
      }
    },
    async onUnitDown(ctx, unit, kind) {
      if (unit.id === 'axt' && kind === 'wounded') ctx.bark('axt', 'Das … war noch nicht alles …');
    },
    onHpBelow: [{ unit: 'valentus', below: 0.3, run: ctx => ctx.say('valentus', 'Lange halte ich das nicht durch …') }],
  },
};

import { it, expect } from 'vitest';
import { Battle } from './rules/battle';
import { Grid } from './rules/grid';
it('guide example is valid', () => {
  const g = Grid.parse(hofKampf.map.height, hofKampf.map.terrain);
  expect(() => new Battle({ grid: g, units: hofKampf.units })).not.toThrow();
  for (const w of hofKampf.waves ?? []) for (const u of w.units) expect(g.standable(u.x, u.y)).toBe(true);
});

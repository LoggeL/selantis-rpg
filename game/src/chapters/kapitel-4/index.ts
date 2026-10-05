// Kapitel IV „Die Freie Bruderschaft“ (DESIGN.md §7.4): augenbinde → bruderschaft → verrat → Kapitel V „regenwald“.
import { G } from '../../core/G';
import { defineChapter } from '../../core/registry';
import { startWorld } from '../../world';
import './catalog';
import { bach, blindSkript, morgenSkript, waldpfad } from './augenbinde';
import { bruderschaftSkript, lager } from './bruderschaft';
import { LIA, prepareKapitel4 } from './shared';
import { lagerAbend, nachtwald, verratSkript } from './verrat';

// The night forest is only reached through the camp's gate exit; referencing it keeps the map registered.
void nachtwald;

defineChapter({
  id: 'kapitel-4', order: 4, numeral: 'IV', title: 'Die Freie Bruderschaft', subtitle: 'Das Lager im Wald',
  scenes: [
    {
      id: 'augenbinde', title: 'Die Augenbinde',
      prepare: () => prepareKapitel4('augenbinde'),
      start: async params => {
        if (params?.part === 'binde') {
          await G.ui.fade('out', 0);
          await startWorld({ map: waldpfad, spawn: 'binde', player: LIA, companions: ['foltan'], fadeIn: false, script: blindSkript });
          return;
        }
        await G.ui.chapterCard('IV', 'Die Freie Bruderschaft', 'Am Bach, im Morgenrot');
        await startWorld({ map: bach, spawn: 'start', player: LIA, script: morgenSkript });
      },
    },
    {
      id: 'bruderschaft', title: 'Die Bruderschaft',
      prepare: () => prepareKapitel4('bruderschaft'),
      start: () => startWorld({ map: lager, spawn: 'tor', player: LIA, fadeIn: false, script: bruderschaftSkript }),
    },
    {
      id: 'verrat', title: 'Verrat',
      prepare: () => prepareKapitel4('verrat'),
      start: () => startWorld({ map: lagerAbend, spawn: 'feuer', player: LIA, fadeIn: false, script: verratSkript }),
    },
  ],
});

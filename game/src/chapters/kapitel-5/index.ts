// Kapitel V „Regen“ (DESIGN.md §7.4): regenwald → faehrte → schattenlager → rettung → finale → credits → title.
import { G } from '../../core/G';
import { defineChapter } from '../../core/registry';
import { startWorld } from '../../world';
import './catalog';
import { prepareStage, ui } from './common';
import { faehrteMap, faehrteScript } from './faehrte';
import { finaleScript, lagerNachtMap } from './finale';
import { regenwaldMap, regenwaldScript } from './regenwald';
import { startRescue } from './rettung';
import { schattenlagerMap, schattenlagerScript } from './schattenlager';

defineChapter({
  id: 'kapitel-5',
  order: 5,
  numeral: 'V',
  title: 'Regen',
  subtitle: 'Allein im Wald',
  scenes: [
    {
      id: 'regenwald', title: 'Der Wald im Regen',
      prepare: () => prepareStage('regenwald'),
      start: async () => {
        await ui().fade('out', 0);
        await G.ui.chapterCard('V', 'Regen', 'Allein im Wald');
        void G.ui.fade('in', 900);
        await startWorld({ map: regenwaldMap, spawn: 'start', player: 'lia-cloak', script: regenwaldScript });
      },
    },
    {
      id: 'faehrte', title: 'Die Fährte',
      prepare: () => prepareStage('faehrte'),
      start: () => { void G.ui.fade('in', 900); return startWorld({ map: faehrteMap, spawn: 'start', player: 'lia-cloak', companions: ['flick'], script: faehrteScript }); },
    },
    {
      id: 'schattenlager', title: 'Der Baum über den Feldern',
      prepare: () => prepareStage('schattenlager'),
      start: () => { void G.ui.fade('in', 900); return startWorld({ map: schattenlagerMap, spawn: 'start', player: 'lia-cloak', script: schattenlagerScript }); },
    },
    {
      id: 'rettung', title: 'Die Rettung',
      prepare: () => prepareStage('rettung'),
      start: () => { void G.ui.fade('in', 900); startRescue(); },
    },
    {
      id: 'finale', title: 'Unter Crios',
      prepare: () => prepareStage('finale'),
      start: () => startWorld({ map: lagerNachtMap, spawn: 'erwachen', player: 'lia-cloak', script: finaleScript, fadeIn: false }),
    },
  ],
});

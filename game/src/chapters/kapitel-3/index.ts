// Kapitel III – „Der Goldene Eber“ (DESIGN.md §7.4): eber → leselager → kyra (interlude) → Kapitel IV 'augenbinde'.
import { G } from '../../core/G';
import { defineChapter } from '../../core/registry';
import type { UiApiExt } from '../../ui';
import { startWorld } from '../../world';
import './catalog';
import { eberMap, eberScript, stallMap } from './eber';
import { prepareKapitel3 } from './k3';
import { startKyra } from './kyra';
import { leselagerMap, leselagerScript } from './leselager';
import { openClueBoard } from './panels';
import { registerK3Plates } from './plates';
import { startEncounterWorld } from '../common/encounters';

void stallMap; // registered via defineMap (the taproom's back door leads there)

let actionsRegistered = false;
function registerActions(): void {
  if (actionsRegistered || !G.ui) return;
  actionsRegistered = true;
  (G.ui as UiApiExt).registerItemAction('k3-notizen', {
    label: 'Hinweise kombinieren',
    when: () => G.currentScene === 'eber',
    reason: 'Was ich im Goldenen Eber herausgefunden habe, steht schon fest.',
    run: async () => { await openClueBoard(); },
  });
  registerK3Plates();
}

defineChapter({
  id: 'kapitel-3',
  order: 3,
  numeral: 'III',
  title: 'Der Goldene Eber',
  subtitle: 'Eine Schenke an der Handelsstraße',
  scenes: [
    {
      id: 'eber', title: 'Der Goldene Eber',
      prepare: () => { prepareKapitel3(); },
      start: async () => { registerActions(); await (G.ui as UiApiExt).fade('out', 0); return startEncounterWorld({ map: eberMap, spawn: 'eingang', player: 'lia-cloak', companions: [], script: eberScript }); },
    },
    {
      id: 'leselager', title: 'Lagerfeuer im Dickicht',
      prepare: () => {
        prepareKapitel3();
        G.state.give('ribbon');
        G.state.set('k3-luege-bemerkt');
        G.state.set('k3-foltan-konfrontiert');
      },
      start: async () => { registerActions(); await (G.ui as UiApiExt).fade('out', 0); return startWorld({ map: leselagerMap, spawn: 'start', player: 'lia-cloak', companions: [], script: leselagerScript }); },
    },
    {
      id: 'kyra', title: 'Zwischenspiel: Kyra',
      prepare: () => {
        prepareKapitel3();
        G.state.give('ribbon');
        G.state.set('k3-luege-bemerkt');
        G.state.set('k3-versprechen');
      },
      start: () => { registerActions(); return startKyra(); },
    },
  ],
});

// Kapitel II – „Die Straße nach Osten“ (DESIGN.md §7.4): strasse → erstes-lager → foltan-azar → waldweg → (kapitel-3) eber.
import { G } from '../../core/G';
import { defineChapter } from '../../core/registry';
import { startWorld } from '../../world';
import './catalog';
import { foltanAzarSkript, lagerNacht } from './foltanAzar';
import { erstesLagerSkript, lager } from './lager';
import { prepareAfterFoltanAzar, prepareAfterLager, prepareAfterStrasse, prepareKapitel2Base, ui } from './shared';
import { strasse, strasseSkript } from './strasse';
import { lagerMorgen, waldwegSkript } from './waldweg';

defineChapter({
  id: 'kapitel-2',
  order: 2,
  numeral: 'II',
  title: 'Die Straße nach Osten',
  subtitle: 'Der erste Tag allein',
  scenes: [
    {
      id: 'strasse', title: 'Die Hauptstraße',
      prepare: prepareKapitel2Base,
      start: async () => {
        G.state.setParty([]);
        await ui().fade('out', 0);
        await G.ui.chapterCard('II', 'Die Straße nach Osten', 'Der erste Tag allein');
        await G.ui.narrate([
          'Den ganzen Tag war Lia den Hufspuren gefolgt, über Feldwege, an Bächen vorbei. Ihre Beine schmerzten.',
          'Am Nachmittag erreichte sie die gepflasterte Hauptstraße. Weiter war sie noch nie von zu Hause fort gewesen.',
        ], { style: 'card' });
        await startWorld({ map: strasse, spawn: 'start', player: 'lia-cloak', script: strasseSkript });
        await G.ui.fade('in', 900);
      },
    },
    {
      id: 'erstes-lager', title: 'Das erste Lager',
      prepare: prepareAfterStrasse,
      start: async () => {
        await startWorld({ map: lager, spawn: 'pfad', player: 'lia-cloak', script: erstesLagerSkript });
        await G.ui.fade('in', 900);
      },
    },
    {
      id: 'foltan-azar', title: 'Schritte in der Nacht',
      prepare: prepareAfterLager,
      start: async () => {
        await ui().fade('out', 0); // the scene opens on black: only footsteps and voices
        await startWorld({ map: lagerNacht, spawn: 'bett', player: 'lia-cloak', fadeIn: false, script: foltanAzarSkript });
      },
    },
    {
      id: 'waldweg', title: 'Der Waldweg',
      prepare: prepareAfterFoltanAzar,
      start: async () => {
        G.state.setParty(['foltan', 'azar']);
        await startWorld({ map: lagerMorgen, spawn: 'bett', player: 'lia-cloak', script: waldwegSkript });
        await G.ui.fade('in', 1400);
      },
    },
  ],
});

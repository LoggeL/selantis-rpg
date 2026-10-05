// KAPITEL I – „Der letzte Sommertag“ (DESIGN.md §7.4): wiese → heimweg → ueberfall → trauer → (Kapitel II) strasse.
import { G } from '../../core/G';
import { defineChapter } from '../../core/registry';
import { startWorld } from '../../world';
import './catalog';
import { heimwegMap, heimwegScript } from './heimweg';
import { stateHeimweg, stateTrauer, stateUeberfall, stateWiese, ui } from './shared';
import { trauerMap, trauerScript } from './trauer';
import { hofMap, ueberfallScript } from './ueberfall';
import { wieseMap, wieseScript } from './wiese';

defineChapter({
  id: 'kapitel-1',
  order: 1,
  numeral: 'I',
  title: 'Der letzte Sommertag',
  subtitle: 'Spätsommer am Hof',
  scenes: [
    {
      id: 'wiese', title: 'Die Wiese',
      prepare: stateWiese,
      start: async () => {
        G.state.setParty([]);
        if (!G.state.is('k1-versprochen')) {
          await G.ui.fade('out', 0);
          await G.ui.chapterCard('I', 'Der letzte Sommertag', 'Spätsommer am Hof');
          // The opening plate fades in from black inside the script (the plate sits below the fade layer).
          await startWorld({ map: wieseMap, spawn: 'start', script: wieseScript, fadeIn: false });
          return;
        }
        await startWorld({ map: wieseMap, spawn: 'start', script: wieseScript });
        void ui().fade('in', 600);
      },
    },
    {
      id: 'heimweg', title: 'Der Heimweg',
      prepare: stateHeimweg,
      start: async () => {
        await startWorld({ map: heimwegMap, spawn: 'west', script: heimwegScript });
        void ui().fade('in', 700);
      },
    },
    {
      id: 'ueberfall', title: 'Der Überfall',
      prepare: stateUeberfall,
      start: async () => {
        await startWorld({ map: hofMap, spawn: 'hohlweg', script: ueberfallScript });
        void ui().fade('in', 900);
      },
    },
    {
      id: 'trauer', title: 'Trauer',
      prepare: stateTrauer,
      start: async () => {
        // The night opens with grief cards over black; the script fades in itself.
        await G.ui.fade('out', 0);
        await startWorld({ map: trauerMap, spawn: G.state.is('k1-morgen') ? 'tuer' : 'start', script: trauerScript });
        if (G.state.is('k1-eltern')) void ui().fade('in', 900);
      },
    },
  ],
});

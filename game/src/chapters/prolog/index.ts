// PROLOG – „Die Urmacht“ (DESIGN.md §7.4): council, battle of Dunkelhain, flight, refuge. Ends with G.goto('wiese').
import { defineChapter } from '../../core/registry';
import '../common';
import './catalog';
import { startFlucht, prepareFlucht } from './flucht';
import { prepareRat, startRat } from './rat';
import { prepareSchlacht, startSchlacht } from './schlacht';
import { prepareZuflucht, startZuflucht } from './zuflucht';

defineChapter({
  id: 'prolog',
  order: 0,
  numeral: 'Prolog',
  title: 'Die Urmacht',
  subtitle: 'Vor sechzehn Jahren',
  scenes: [
    { id: 'prolog-rat', title: 'Der Rat der Zehn', prepare: prepareRat, start: startRat },
    { id: 'prolog-schlacht', title: 'Die Schlacht von Dunkelhain', prepare: prepareSchlacht, start: startSchlacht },
    { id: 'prolog-flucht', title: 'Die Flucht', prepare: prepareFlucht, start: startFlucht },
    { id: 'prolog-zuflucht', title: 'Die Zuflucht', prepare: prepareZuflucht, start: startZuflucht },
  ],
});

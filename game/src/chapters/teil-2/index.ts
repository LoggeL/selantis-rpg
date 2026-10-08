// Teil II „Letzte Hoffnung“ (second film after book one; docs/teil-2/umsetzung.md). Scenes in story order; each
// module exports its SceneEntry with the documented direct-entry state (shared.ts prepareE2).
import { defineChapter } from '../../core/registry';
import './catalog';
import { scene as taverne } from './taverne';
import { scene as bruderschaft } from './bruderschaft';
import { scene as pruefung } from './pruefung';
import { scene as flicksHerkunft } from './flicks-herkunft';
import { scene as lagerangriff } from './lagerangriff';
import { scene as derFremde } from './der-fremde';
import { scene as gefangene } from './gefangene';
import { scene as urmacht } from './urmacht';
import { scene as flicksVerhoer } from './flicks-verhoer';
import { scene as konzentration } from './konzentration';
import { scene as flicksErinnerungen } from './flicks-erinnerungen';
import { scene as kyrasWiderstand } from './kyras-widerstand';
import { scene as ignatius } from './ignatius';
import { scene as zellengespraeche } from './zellengespraeche';
import { scene as stabtraining } from './stabtraining';
import { scene as flickEntkommt } from './flick-entkommt';
import { scene as kontrolle } from './kontrolle';
import { scene as aufbruch } from './aufbruch';

defineChapter({
  id: 'teil-2',
  order: 6,
  numeral: 'Teil II',
  title: 'Letzte Hoffnung',
  subtitle: 'Zurück zu den Rebellen',
  book: 2,
  sections: [
    { numeral: '1', title: 'Zurück zu den Rebellen', subtitle: 'Der Goldene Eber, die Bruderschaft, die Prüfung',
      scenes: ['e2-taverne', 'e2-bruderschaft', 'e2-pruefung', 'e2-flicks-herkunft'] },
    { numeral: '2', title: 'Überfall im Morgengrauen', subtitle: 'Getrennt',
      scenes: ['e2-lagerangriff', 'e2-der-fremde', 'e2-gefangene'] },
    { numeral: '3', title: 'Der Fremde im Wald', subtitle: 'Was Valentus tat',
      scenes: ['e2-urmacht', 'e2-flicks-verhoer', 'e2-konzentration', 'e2-flicks-erinnerungen', 'e2-kyras-widerstand', 'e2-ignatius'] },
    { numeral: '4', title: 'Schattentöter', subtitle: 'Ein geliehener Stab',
      scenes: ['e2-zellengespraeche', 'e2-stabtraining', 'e2-flick-entkommt', 'e2-kontrolle', 'e2-aufbruch'] },
  ],
  scenes: [
    taverne, bruderschaft, pruefung, flicksHerkunft, lagerangriff, derFremde, gefangene, urmacht, flicksVerhoer, konzentration, flicksErinnerungen, kyrasWiderstand, ignatius, zellengespraeche, stabtraining, flickEntkommt, kontrolle, aufbruch,
  ],
});

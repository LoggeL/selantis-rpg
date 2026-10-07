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
  scenes: [
    taverne, bruderschaft, pruefung, flicksHerkunft, lagerangriff, derFremde, gefangene, urmacht, flicksVerhoer, konzentration, flicksErinnerungen, kyrasWiderstand, ignatius, zellengespraeche, stabtraining, flickEntkommt, kontrolle, aufbruch,
  ],
});

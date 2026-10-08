// Teil III „Falscher Glaube“ (third film after book one; docs/teil-3/umsetzung.md). Scenes in story order; each
// module exports its SceneEntry with the documented direct-entry state (shared.ts prepareE3). Scene modules are added
// here as they are built, always in the order of E3_SCENES.
import { defineChapter } from '../../core/registry';
import './catalog';
import { scene as valentus } from './valentus';
import { scene as eigenerStab } from './eigener-stab';
import { scene as paladine } from './paladine';
import { scene as schutzreaktion } from './schutzreaktion';
import { scene as machtUndSchutz } from './macht-und-schutz';
import { scene as falscherGlaube } from './falscher-glaube';
import { scene as kyrasFluchtweg } from './kyras-fluchtweg';
import { scene as waldgegner } from './waldgegner';
import { scene as vertrauteSchwester } from './vertraute-schwester';
import { scene as falle } from './falle';
import { scene as innereZuflucht } from './innere-zuflucht';
import { scene as flicksHilfe } from './flicks-hilfe';
import { scene as hoffnungUndWeigerung } from './hoffnung-und-weigerung';
import { scene as ritual } from './ritual';
import { scene as ritualangriff } from './ritualangriff';
import { scene as vamir } from './vamir';
import { scene as ignatiusAbschied } from './ignatius-abschied';
import { scene as hueterin } from './hueterin';
import { scene as epilog } from './epilog';

defineChapter({
  id: 'teil-3',
  order: 7,
  numeral: 'Teil III',
  title: 'Falscher Glaube',
  subtitle: 'Ein eigener Stab',
  book: 3,
  sections: [
    { numeral: '1', title: 'Ein eigener Stab', subtitle: 'Valentus im Wald', scenes: ['e3-valentus', 'e3-eigener-stab'] },
    { numeral: '2', title: 'Trapas', subtitle: 'Die Paladine des Lichterordens',
      scenes: ['e3-paladine', 'e3-schutzreaktion', 'e3-macht-und-schutz', 'e3-falscher-glaube'] },
    { numeral: '3', title: 'Die Schwester', subtitle: 'Eine Flucht und ein Becher Tee',
      scenes: ['e3-kyras-fluchtweg', 'e3-waldgegner', 'e3-vertraute-schwester', 'e3-falle'] },
    { numeral: '4', title: 'Gefangen', subtitle: 'Die innere Zuflucht',
      scenes: ['e3-innere-zuflucht', 'e3-flicks-hilfe', 'e3-hoffnung-und-weigerung'] },
    { numeral: '5', title: 'Das Ritual', subtitle: 'Zehn Relikte', scenes: ['e3-ritual', 'e3-ritualangriff', 'e3-vamir'] },
    { numeral: '6', title: 'Hüterin', subtitle: 'Abschied und Aufbruch', scenes: ['e3-ignatius-abschied', 'e3-hueterin', 'e3-epilog'] },
  ],
  scenes: [
    valentus,
    eigenerStab,
    paladine,
    schutzreaktion,
    machtUndSchutz,
    falscherGlaube,
    kyrasFluchtweg,
    waldgegner,
    vertrauteSchwester,
    falle,
    innereZuflucht,
    flicksHilfe,
    hoffnungUndWeigerung,
    ritual,
    ritualangriff,
    vamir,
    ignatiusAbschied,
    hueterin,
    epilog,
  ],
});

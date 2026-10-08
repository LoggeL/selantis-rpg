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

import type { CampStep } from "../../../modules/camp/progression";
export type { CampStep } from '../../../modules/camp/progression';
export type CampSpotId = 'bedroll' | 'stones' | 'fire' | 'twigs' | 'fire-seat' | 'star' | 'foltan' | 'azar' | 'road';
export type CampStepDefinition = { objective: string; requiredSpot?: CampSpotId; label?: string };

/** Authored first night, adapted from Roman pp. 22–32. Crios remains optional. */
export const FIRST_JOURNEY_CHAPTER = {
  id: 'first-journey',
  source: { work: 'Roman Selantis 2', pages: [22, 32], adaptation: 'Original game adaptation; dialogue is not presented as source quotations.' },
  camp: {
    cloak: { objective: 'Den grünen Regenmantel ausziehen und ausbreiten.', requiredSpot: 'bedroll', label: 'Mantel ausbreiten' },
    stones: { objective: 'Sechs Steine für die Feuerstelle sammeln.', requiredSpot: 'stones', label: 'Steine sammeln' },
    ring: { objective: 'Aus den Steinen in der Tasche eine Feuerstelle bauen.', requiredSpot: 'fire', label: 'Steine zu einer Feuerstelle legen' },
    twigs: { objective: 'Trockenes Laub und Zweige sammeln.', requiredSpot: 'twigs', label: 'Laub und Zweige sammeln' },
    fire: { objective: 'Mit Holzreibung ein Feuer entzünden.', requiredSpot: 'fire', label: 'Holz reiben' },
    meal: { objective: 'Öffne die Tasche (I), wähle Reiseproviant und Essen.', requiredSpot: 'fire', label: 'Tasche öffnen · Reiseproviant wählen' },
    sleep: { objective: 'Unter der Wolldecke schlafen.', requiredSpot: 'bedroll', label: 'Hinlegen und zudecken' },
    waking: { objective: '' },
    star: { objective: 'Im Lager zur Ruhe kommen oder bis zum Morgen schlafen.', requiredSpot: 'star', label: 'Crios ansehen' },
    complete: { objective: 'Im Lager zur Ruhe kommen oder bis zum Morgen schlafen.' },
  } satisfies Record<CampStep, CampStepDefinition>,
} as const;

export function campStepDefinition(step: CampStep): CampStepDefinition { return FIRST_JOURNEY_CHAPTER.camp[step]; }

/** Reasons remain useful even when Lia inspects a later preparation early. */
export function campSpotDisabledHint(id: string, step: CampStep): string {
  if (id === 'star') return 'Lia will erst ihr Nachtlager vorbereiten, bevor sie in den Himmel sieht.';
  if (id === 'fire-seat') return 'Zum Hinsetzen muss das Lagerfeuer brennen.';
  if (id === 'foltan' || id === 'azar') return 'Die Gefährten sind noch nicht im Lager.';
  const place = id === 'stones' ? 'Steine sammeln' : id === 'twigs' ? 'Laub und Zweige sammeln' : id === 'fire' ? 'Feuerstelle vorbereiten' : 'Schlafplatz vorbereiten';
  const objective = campStepDefinition(step).objective;
  return `${place}: zuerst ${objective.charAt(0).toLowerCase()}${objective.slice(1)}`;
}

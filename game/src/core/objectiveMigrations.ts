import type { SaveData } from './types';

const COUNCIL_MEMBERS = ['ignatius', 'aelteste', 'hagere', 'wortfuehrer'];
const ROAD_EAST_TEXT = 'Folge der Straße nach Osten.';
const FOREST_EAST_TEXT = 'Weiter nach Osten, über die Trittsteine.';

/** Repairs known story/objective mismatches in version-one saves without reopening completed goals. */
export function repairStoryObjectives(data: SaveData): void {
  const reached = (flag: string) => Boolean(data.flags[flag]);
  const objective = (id: string) => data.objectives.find(o => o.id === id);
  const complete = (id: string) => { const o = objective(id); if (o) o.done = true; };

  const council = objective('prolog-anhoeren');
  if (council && COUNCIL_MEMBERS.every(id => reached(`prolog-gehoert-${id}`))) {
    council.text = 'Höre die Ratsmitglieder an (4/4).';
    council.done = true;
  }
  if (reached('prolog-geschenk')) complete('prolog-geschenk');

  // The saved chapter also proves that the party already left the Kapitel-II forest.
  const chapterNumber = /^kapitel-(\d+)$/.exec(data.chapter)?.[1];
  const beyondForest = Number(chapterNumber) >= 3 || data.chapter === 'teil-2' || data.chapter === 'teil-3';
  const forestFinished = reached('k2-waldweg-fertig') || beyondForest;
  const restReached = reached('k2-rast-angesagt') || reached('k2-rast') || reached('k2-rast-fertig');
  if (reached('k2-waldweg-start') || restReached || forestFinished) complete('k2-aufbruch');
  if (restReached || forestFinished) complete('k2-waldweg');

  const oldEast = objective('k2-osten');
  const reusedEast = oldEast?.text === FOREST_EAST_TEXT;
  if (oldEast && (restReached || forestFinished)) {
    oldEast.done = true;
    if (reusedEast) oldEast.text = ROAD_EAST_TEXT;
  }

  let forestEast = objective('k2-trittsteine');
  // A finished rest on the forest map proves that its new eastward leg is still needed.
  // Later saves get a historical replacement only when the old ID actually held that leg.
  if (!forestEast && reached('k2-rast-fertig') && ((data.scene === 'waldweg' && !forestFinished) || reusedEast)) {
    forestEast = { id: 'k2-trittsteine', text: FOREST_EAST_TEXT, done: forestFinished };
    data.objectives.push(forestEast);
  }
  if (forestEast && forestFinished) forestEast.done = true;
}

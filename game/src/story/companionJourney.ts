import type { WorldState } from '../world/quests';
import type { StoryArea } from './types';
import { inPoly } from '../world/navigation';

export const COMPANION_ROAD_SCENE = 'companions-road';
export type CompanionPhase = 'morning' | 'afternoon' | 'evening';

/** Chapter 3, PDF pp. 40–44. Condensed; each line keeps its novel speaker. */
export const MIDDAY_REST_LINES = [
  'Azar: "Wann machen wir Mittagsrast? Wir müssen doch Rücksicht auf die Kleine nehmen."',
  'Lia: "Also, wegen mir müssen wir nicht … Doch. Eine Pause wäre schön."',
  'Azar: "Danke. Sonst würden wir jetzt noch durchs Unterholz stapfen. Wie heißt du eigentlich?"',
  'Lia: "Lia. Und was ist das für ein Lager, zu dem ihr mich bringt?"',
  'Foltan: "Wir gehören zu einer Gruppe Rebellen, die Dunkelschatten jagt. Unser Hauptlager liegt noch einen Tagesmarsch entfernt."',
  'Foltan: "Vielleicht weiß dort jemand etwas über deine Schwester. Mach dir aber keine großen Hoffnungen."',
  'Azar: "Muss das sein, Foltan? Die Kleine hat genug durchgemacht."',
  'Lia: "Redet nicht über mich, als wäre ich nicht da. Ich habe schon alles verloren. Besser wird es nur, wenn ich Kyra zurückhole."',
  'Azar: "Interessante Form von Optimismus. Wir werden sehen, was sich machen lässt."',
  'Foltan: "Also lasst uns keine Zeit verlieren. Reden können wir heute Abend am Lagerfeuer noch."',
];

export function companionPhase(st: WorldState): CompanionPhase {
  return st.flags.companionDayComplete ? 'evening' : st.flags.companionRestTaken ? 'afternoon' : 'morning';
}

export function companionObjective(phase: CompanionPhase, st: WorldState): string {
  if (phase === 'evening') return 'Am Abend: Der Goldene Eber · Fortsetzung folgt.';
  if (phase === 'afternoon' || st.flags.companionRestTaken) return 'Foltan und Azar weiter durch den Wald folgen.';
  return 'Mit Foltan und Azar zur Mittagsrast auf die Mooslichtung gehen.';
}

/** Same foot samples as StoryScene; companions stay on the authored path too. */
export function companionFeetWalkable(area: StoryArea, x: number, y: number): boolean {
  const ok = (px: number, py: number) => area.walk.some(poly => inPoly(px, py, poly)) && !area.block.some(poly => inPoly(px, py, poly));
  return ok(x, y) && ok(x - 5, y) && ok(x + 5, y) && ok(x, y - 3);
}

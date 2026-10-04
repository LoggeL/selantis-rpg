/** Chapter 3, PDF pp. 40–44. Condensed; each line keeps its novel speaker. */
export const MIDDAY_REST_SEQUENCE = [
  { narrativeId: 'companions.midday-rest.rest-request', line: 'Azar: "Wann machen wir Mittagsrast? Wir müssen doch Rücksicht auf die Kleine nehmen."' },
  { narrativeId: 'companions.midday-rest.rest-needed', line: 'Lia: "Also, wegen mir müssen wir nicht … Doch. Eine Pause wäre schön."' },
  { narrativeId: 'companions.midday-rest.name-question', line: 'Azar: "Danke. Sonst würden wir jetzt noch durchs Unterholz stapfen. Wie heißt du eigentlich?"' },
  { narrativeId: 'companions.midday-rest.camp-question', line: 'Lia: "Lia. Und was ist das für ein Lager, zu dem ihr mich bringt?"' },
  { narrativeId: 'companions.midday-rest.rebels', line: 'Foltan: "Wir gehören zu einer Gruppe Rebellen, die Dunkelschatten jagt. Unser Hauptlager liegt noch einen Tagesmarsch entfernt."' },
  { narrativeId: 'companions.midday-rest.uncertain-help', line: 'Foltan: "Vielleicht weiß dort jemand etwas über deine Schwester. Mach dir aber keine großen Hoffnungen."' },
  { narrativeId: 'companions.midday-rest.azar-protests', line: 'Azar: "Muss das sein, Foltan? Die Kleine hat genug durchgemacht."' },
  { narrativeId: 'companions.midday-rest.lia-resolves', line: 'Lia: "Redet nicht über mich, als wäre ich nicht da. Ich habe schon alles verloren. Besser wird es nur, wenn ich Kyra zurückhole."' },
  { narrativeId: 'companions.midday-rest.optimism', line: 'Azar: "Interessante Form von Optimismus. Wir werden sehen, was sich machen lässt."' },
  { narrativeId: 'companions.midday-rest.keep-moving', line: 'Foltan: "Also lasst uns keine Zeit verlieren. Reden können wir heute Abend am Lagerfeuer noch."' },
] as const;

/** String lines retained for the existing scene dialogue interface. */
export const MIDDAY_REST_LINES = MIDDAY_REST_SEQUENCE.map(beat => beat.line);

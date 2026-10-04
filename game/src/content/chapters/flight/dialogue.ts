import type { AuthoredBeat } from "../../../modules/narrative/types";

export const FLIGHT_BEATS = {
  pursuit: { narrativeId: 'prologue.flight.pursuit', line: 'Sie werden mich finden. Ich muss weiter.' },
  blood: { narrativeId: 'prologue.flight.blood', line: 'Blutrot.' },
  climb: { narrativeId: 'prologue.flight.climb', line: 'Es darf ihnen nicht in die Hände fallen.' },
  brace: { narrativeId: 'prologue.flight.brace', line: 'Wenn sie es bekommen, ist es aus.' },
  listen: { narrativeId: 'prologue.flight.listen', line: 'Die Hunde. Noch hinter mir.' },
  wound: { narrativeId: 'prologue.flight.wound', line: 'Fest drücken. Weiter.' },
  rescueArrival: { narrativeId: 'prologue.flight.rescue-arrival', line: 'Schritte im Unterholz. Jemand kommt näher. Dann wird alles schwarz.' },
  rescueHome: { narrativeId: 'prologue.flight.rescue-home', line: 'Ein Mann findet Valentus und bringt den Bewusstlosen in ein Bauernhaus. Dort versorgt ihn das Paar.' },
} satisfies Record<string, AuthoredBeat>;

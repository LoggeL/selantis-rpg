# Audit-To-do

Stand: geprüfter Commit d2e4868f474c1572d8e26d56f936911744ba1168.

## Bugs beheben

- [x] **P2: Doppelte Feldbelegung im Kampf verhindern.** Beim Erscheinen des Jungen ein freies Feld wählen und Bewegungen/Spawns auf belegte Felder verhindern. Fundstellen: `game/src/scenes/BattleScene.ts:191–198,271–305`, `game/src/battle/grid.ts:55`. Regressionstest: Valentus nach (6,3) bewegen, Druckwelle auf (9,4), beide Krieger besiegen; danach dürfen Valentus und Junge nicht dasselbe Feld belegen.
- [x] **P2: Weltinteraktionen bei offener Tasche sperren.** E-Eingaben dürfen bei geöffneter Inventaransicht weder Questzustand noch Inventar verändern oder Dialoge starten. Fundstellen: `game/src/scenes/WorldScene.ts:356–363`, `game/src/story/StoryScene.ts:350–355`. Regressionstests: I, dann E neben Apfelbaum und Wasserschlauch; keine Interaktion bis Tasche geschlossen.
- [x] **P2: Reduzierte Bewegung in der Zuflucht respektieren.** Kameraschütteln bei `reducedMotion:true` unterdrücken; weitere Kameraeffekte auf Verträglichkeit prüfen. Fundstellen: `game/src/scenes/RefugeScene.ts:178–198,211–212,239–241`. Regressionstest: automatische Echo-Sequenz mit reduzierter Bewegung ohne laufenden Shake-Effekt.

- [x] Rückwärtslaufende Reisegruppe nach dem Hof korrigiert, einschließlich reduzierter Bewegung; Journey-Regressionstests und Browserdurchlauf bis Crios bestätigt.

## Produktentscheidungen / verwirrende Features

Diese Punkte sind keine nachgewiesenen Bugs; zunächst gewünschtes Verhalten festlegen.

- [ ] **Spielstand-Persistenz entscheiden.** Fortschritt speichern und nach Reload wiederherstellen oder fehlende Speicherung klar kommunizieren und `docs/design-directions.md:17` korrigieren. Aktuell bleibt nur die Einstellungspersistenz erhalten; Weltzustand: `game/src/world/quests.ts:13–16`.
- [x] **Prologabschluss sichtbar machen.** Nach Crios bei `campStep:'complete'` ein eindeutiges Abschlussbild, einen Hinweis auf das Prototypende oder einen nächsten Übergang anbieten. Veraltetes Ziel „Morgen folgen wir dem Waldweg“ ersetzen. Fundstelle: `game/src/scenes/JourneyScene.ts:153,175–177`.
- [ ] **Kampfkonsequenzen klären.** Entscheiden, ob schadensfreie Krieger und automatische Falkenrettung absichtliches Traumtutorial sind. Falls ja, verständlich vermitteln; andernfalls tatsächlichen Schaden und Konsequenzen implementieren. Fundstelle: `game/src/scenes/BattleScene.ts:872–879,902–918,949–961`.
- [ ] **Lias Lesezeichen klären.** Kosmetische Funktion verständlich kennzeichnen oder echte Speicher-/Fortsetzungsfunktion implementieren. `liaBookmark` wird gesetzt, aber nicht gelesen: `game/src/scenes/LiaScene.ts:469`.

## Abnahme

- [x] Regressionstests für die drei reproduzierten Bugs ergänzen und ausführen.
- [x] Gesamte Testsuite und Build erfolgreich ausführen: 148 Tests bestanden, TypeScript/Vite-Build und `git diff --check` erfolgreich.
- [ ] Vollständigen Desktop- und Touch-Durchlauf prüfen; im Audit noch nicht vollständig abgedeckt.

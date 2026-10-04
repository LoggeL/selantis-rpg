# Dialogüberarbeitung (Opus-Review, 4. Oktober 2026)

Abgleich aller gesprochenen Zeilen und inneren Stimmen in `game/src` mit `sources/novel/roman-selantis-2.txt` (PDF-Seiten 1 bis 46). Bei Abweichungen hatte der Roman Vorrang. Die Filmtranskripte dienten nur zur Kontrolle der Figurennamen; Lia bleibt Lia, Foltan und Azar bleiben die Gefährten.

Unverändert geblieben sind:
- Beat-, Ziel- und Flag-IDs, Szenenwechsel, Cutscene-Timings und die Anzeigedauer jeder HUD-Zeile.
- Die Zuordnung von Sprecherlabels zu Porträts.
- Die Bedienhinweise, Tastenlabels und die Weiter-Steuerung.
- Überfall: Beat-Anzahl und Sprecherfolge.
- Lagergespräch mit Foltan und Azar: alle 20 Beats und ihre Sprecherfolge.

Zwei Dialogsequenzen wurden gezielt in ihrer Struktur angepasst. Beide werden Zeile für Zeile mit Weiter gelesen; Timer und Flags hängen nicht von der Zeilenzahl ab.

1. **Schwesterngespräch** (`story/homecoming.ts`): von 6 auf 12 Zeilen erweitert, nach Roman S. 9–10.
2. **Mittagsrast** (`story/companionJourney.ts`): von 9 auf 10 Zeilen. Die Sprecher folgen jetzt dem Roman S. 41–44:
   - Azar fragt nach Lias Namen und widerspricht Foltans Warnung.
   - „Interessante Form von Optimismus. Wir werden sehen, was sich machen lässt“ bleibt bei Azar (Roman Zeile 131).
   - Der Aufbruch „Also lasst uns keine Zeit verlieren …“ gehört Foltan statt wie zuvor Lia.
   - `e2e/companion-journey.pw.ts` liest deshalb 10 statt 9 Zeilen.

Außerdem hat die Feldbank eine zusätzliche Wiederholungszeile bekommen.

## Geprüfte Abdeckung

| Bereich | Datei | Ergebnis |
| --- | --- | --- |
| Prolog-Lesekarten | `scenes/StoryPrologueScene.ts` | geprüft, Erzähltext, unverändert |
| Schlacht | `scenes/BattleScene.ts` | Valentus' Gedanke zum Jungen (Roman S. 4) und Tod des Falken ohne flapsige Pointe; Steuerhinweise unverändert |
| Verwundung | `scenes/BreakScene.ts` | geprüft, nur Hinweise, unverändert |
| Flucht | `scenes/FlightScene.ts` | geprüft, Gedanken romantreu (S. 1–2), unverändert |
| Zuflucht | `scenes/RefugeScene.ts` | Gedanke in erster Person statt „Er ist eine Gefahr …“, Raumbeobachtungen als Valentus' Stimme |
| Lia und Kyra | `story/homecoming.ts`, `scenes/LiaScene.ts` | Gespräch von 6 auf 12 kurze Zeilen nach S. 9–10: Vorwurf, Necken, Dunkelschatten-Vorahnung, Versprechen |
| Freie Welt | `world/quests.ts`, `world/maps/*.ts`, `story/travel.ts` | Vogeljunges, Fallobst, Feder; Feldbank und Mohrrüben (S. 7, 11); Hufspuren knapper und persönlicher; Wiederholung „Sommer“ gekürzt |
| Überfall | `scenes/RaidScene.ts` | Lias Erkennen der Dunkelschatten, ihr Schluss „Sie verstecken sie“, Orwens Originalton (S. 14–16). Der Trauer- und Schwurteil danach kommt inzwischen aus `story/grief.ts` (siehe dort) |
| Morgen am Hof | `scenes/AftermathScene.ts` | Gräber, Proviant, Geheimfach, Tinktur, Schweine (S. 18–21). Kleidungs- und Bücherzeilen stammen aus paralleler Arbeit und blieben unangetastet |
| Trauerbeats (parallel neu angelegt) | `story/grief.ts` | Erzähltexte romantreu (S. 17–18), unverändert; „uncertainty“ natürlicher und mit Romanfakt (S. 21: nie länger als einen Tag fort); „questions“ und „vow“ romannah, unverändert (von paralleler Testarbeit wörtlich fixiert) |
| Kyras Einführung (parallel neu angelegt) | `story/kyraIntro.ts` | reiner Erzähltext nach S. 6–8, romantreu, unverändert |
| Reise und Lager | `scenes/JourneyScene.ts` | Straße, Weggabelung, Rock im Gestrüpp, Feuer, Crios (S. 22–25, 32) |
| Foltan und Azar | `scenes/JourneyScene.ts` | alle 20 Beats bei gleicher Sprecherfolge neu nach S. 25–31; erfundenes „jetzt Söldner“ entfernt |
| Gefährtenreise | `story/companionJourney.ts`, `scenes/CompanionJourneyScene.ts` | Mittagsrast nach S. 41–44 mit den Romansprechern (10 Zeilen), Azars Frühstücksstolz, Moos-Ausrede, Schenke (S. 46) |
| Schauplatztexte | `story/areas/*.ts`, `story/StoryScene.ts`, `scenes/WorldScene.ts` | nur Bedienlabels und Weiterleitung, unverändert |

## Bewusste Abweichungen vom Roman

- Die Begegnung im Lager bleibt freundlich, wie das Spiel sie anlegt: kein Fesseln, kein Spionageverdacht. Azars Kränkung und Foltans „Manchmal wünschte ich, du würdest schweigen“ sind aus dem späteren Wortwechsel vorgezogen.
- In der Mittagsrast fehlen Foltans Gang ins Gebüsch und Azars „Ein ganzer Satz“. Azars Einwand ist zu einer Zeile verdichtet.
- Orwens Spott beim Mord am Vater („Ups, wie ungeschickt …“) und der Vorschlag des Narbigen fehlen weiterhin, weil sie eigene Beats bräuchten.
- „Gefüttert habe ich die Schweine nicht mehr“ steht so nicht im Roman. Es folgt aber aus Lias Versprechen und dem Überfall und erfindet keine Handlung.

## Prüfung

Claude Code wurde mit der bestätigten Modellkennung `claude-opus-5-5` und `--effort high` ausgeführt. Zwei zusätzliche Subagenten prüften Quellenabgleich und technische Folgen. Die im Review gefundene falsche Sprecherzuordnung bei der Mittagsrast wurde anschließend von Opus korrigiert.

Der Produktionsbuild war erfolgreich. Sieben Browserchecks für `friendly-camp.pw.ts` und `companion-journey.pw.ts` bestanden in einem eingefrorenen Produktionsbuild: vier Lagerlayouts (Desktop, Smartphone hochkant, Smartphone quer, reduzierte Bewegung) und drei Gefährtenreisechecks. Die Smartphone-Screenshots wurden zusätzlich visuell geprüft; die neuen Dialogzeilen sind lesbar und liegen innerhalb der Anzeige.

Die vollständige Testsuite wurde während laufender paralleler Änderungen ausgeführt. Im letzten vollständigen Lauf bestanden 326 von 331 Tests. Die verbliebenen Fehler betrafen neue Bedienlabels in der Sprechererkennung, Fixtures des neuen Feuer-Minispiels und einen Navigationstimeout. Ein anschließender gezielter Lauf für Dialog, Schwestern, Überfall, Reise, Trauer, Abschied und Porträts bestand 47 von 50 Tests. Die drei Fehler in `journeyRegressions.test.ts` betreffen fehlende Graphics-/Inventar-Stubs für die inzwischen parallel ergänzte Crios-Sequenz. Damit ist der aktuelle Gesamtquellstand nicht vollständig als grün qualifiziert.

Ein früherer breiter Browserlauf bestand 14 von 23 Checks. Die verbleibenden Checks waren durch inzwischen geänderte Trauerabläufe, Aktionsleistenpositionen oder Lade-/Laufzeitprobleme betroffen; diese wurden nicht durch Abschwächung der Prüfungen freigegeben. Der gezielte erfolgreiche Browsernachweis oben bezieht sich auf den eingefrorenen Build und die von Opus überarbeiteten Lager-/Gefährtendialoge.

Textabhängige Erwartungen in `raidRegressions.test.ts`, `journeyRegressions.test.ts`, `aftermathPickups.test.ts` und `e2e/friendly-camp.pw.ts` wurden auf die neuen Zeilen umgestellt. `e2e/companion-journey.pw.ts` liest zehn statt neun Rastzeilen. Die technischen Subagenten fanden dabei keine entfernten oder abgeschwächten Assertions. Kein Commit, Push oder Deployment in diesem Auftrag.

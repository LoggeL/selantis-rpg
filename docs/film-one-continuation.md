# Fortsetzung bis zum Ende des ersten Films

Die Spielhandlung folgt dem Roman bis zu seiner letzten ausgearbeiteten Szene auf PDF-Seite 90. Danach führt eine neu geschriebene Verbindung zu Flicks Rettungsbogen aus dem ersten Film. Der Abschluss entspricht dem gemeinsamen Waldweg bei ungefähr 20:17 in "Dunkle Mächte". Die Ankunft bei den Rebellen und Ereignisse aus dem zweiten Film gehören nicht zu diesem Abschnitt.

## Spielbare Strecke

| Einstieg | Inhalt | Quelle |
| --- | --- | --- |
| `golden-boar` | Craupors Schenke, Kyras Beschreibung, Azars Bericht über Foltans Desertion und Foltans falsche Auskunft | Roman, PDF 46 bis 54 |
| `reading-camp` | Kräuterlexikon, Alanas Geschichte, Erinnerung an die Eltern und das Versprechen der Begleiter | Roman, PDF 60 bis 67 |
| `brotherhood` | Ankunft bei Elnon und Azar im Lager der Freien Bruderschaft; freiwillige Gespräche und Übung | Roman, PDF 75 bis 82 |
| `betrayal` | Lia hört von Foltans verschwiegenem Wissen und verlässt das Lager | Roman, PDF 82 bis 90 |
| `rain-forest` | Lias Flucht im Sommerregen und eine neue Begegnung mit Flick | Roman, PDF 89 bis 90; Begegnung als Übergangsadaption |
| `flick-trail` | Fährtenlesen, Flicks Ausgrenzung und die gemeinsame Suche | Film 1, 09:20 bis 14:21; zeitlich hinter das Romanende versetzt |
| `shadow-camp` | Gefangenenlager beobachten, Weg zum Baum prüfen und die Ablenkung planen | Film 1, 14:37 bis 17:00; Verbindung der Gegnertrupps als Adaption |
| `sisters-reunited` | Flick löst Kyras Fesseln; Lia schützt Kyra, löst unbewusst Magie aus und bricht zusammen | Film 1, 17:10 bis 18:37 |
| `film-one-finale` | Baris wird vom Meister bestraft; Lia, Kyra und Flick gehen zu den Rebellen | Film 1, 18:50 bis 20:17 |

Die Räume bleiben mit Maus, Tastatur und Touch begehbar. Markierte Gespräche und Handlungen führen die Geschichte weiter; kurze Inszenierungen warten auf einzelne Weiter-Eingaben. Zusätzliche Gespräche und die Übung im Lager sind optional. Zusätzliche spielbare Kyra-Parallelkapitel wurden nicht ergänzt.

Die bisherige Adaption bleibt erhalten: Lia hat keine Fußverletzung und wurde beim ersten Treffen mit Foltan und Azar freundlich aufgenommen.

## Verbindung der Quellen

Der Roman endet mit Lia allein im regennassen Wald. Azar sucht sie ohne Erfolg; Foltan bleibt beschämt im Lager. Kyra ist bei Baris' Trupp, der nach einer Grotte und einem Geweih sucht. Keine Einstellung des ersten Films setzt alle diese Zustände unmittelbar fort. Deshalb ist Flicks Begegnung im Regen eine neue Spielszene. Die entfernten Vorgänge bei Foltan und Azar erscheinen als Erzählertext, ohne Lia dieses Wissen zu geben.

Orwen, Baris und Baris bleiben verschiedene Figuren. Orwen ist der grauhaarige Täter am Hof und Baris' rechte Hand. Baris ist der Hauptmann aus dem Roman. Baris ist der Hauptmann des ersten Films. Für die Verbindung übernimmt Baris Kyras Weitertransport, während Baris der Grotte nachgeht. Diese Übergabe ist neu geschrieben und wird durch das Wachgespräch erklärt. Sie wird nicht als Roman- oder Filmbeleg ausgegeben.

Der Meister bleibt unbenannt. Seine Bestrafung bestätigt Baris' Tod nicht. Lias Kraft tritt einmal unkontrolliert auf und erschöpft sie; sie erhält dadurch keine frei verfügbare Zauberaktion. Die Schwestern sind wieder zusammen, aber Lias Vertrauen zu Foltan ist damit nicht wiederhergestellt. Flicks Aufnahme bei den Rebellen bleibt am Schluss eine Hoffnung.

Die Quellenbasis steht in [Romananalyse](novel-analysis.md), [Film 1](episode-01.md) und dem lokalen Transkript `sources/transcripts/01-3PNiiK653uQ.txt`. Das wiederholte ASR-Material ab 24:58 liegt auf dem schwarzen Nachlauf und gehört nicht zu einem zweiten Schlussereignis.

## Grafiken und Umsetzung

Neue Hintergründe, Figuren und Nahaufnahmen wurden mit dem eingebauten ImageGen erzeugt. Die fertigen PNGs liegen unter `game/public/assets/`; vorhandene Bilder und Sprites bleiben erhalten. Prompts, verwendete Referenzen, Überarbeitungen und Dateihashes stehen in:

- [Schauplätze](../design/assets/continuation-world-delivery.json)
- [Figuren](../design/assets/continuation-characters-delivery.json)
- [Craupor und Elnon im Spielraum](../design/assets/continuation-npc-delivery.json)
- [Nahaufnahmen](../design/assets/continuation-cuts-delivery.json)

Die Kapitel liegen unter `game/src/content/chapters/continuationNovel/` und `continuationFilm/`, ihre Flächen unter `content/areas/`. `modules/continuation/` prüft Voraussetzungen und einmalige Fortschritte. `ContinuationScene` stellt Bewegung, Dialog, Begleiter, Regen und die Rettungsinszenierung dar. Szenenwechsel erhalten Inventar und frühere Fortschritte; direkte URL-Einstiege und Debug-Warps bereiten denselben Kapitelzustand vor.

## Lokale Prüfung

Die Abschlussprüfung am 4. Oktober 2026 besteht: 591 Modultests, vier Architekturtests, Asset-Verträge, beide TypeScript-Prüfungen und der Produktionsbuild. Die 90 bestehenden Browserregressionen bestehen ebenfalls. Sie prüfen unter anderem Lagerbau, Inventar, Überfall, Reise, Szenenwiedereinstiege und Kämpfe auf Desktop sowie im Hoch- und Querformat.

Sieben neue Browserprüfungen bestehen zusätzlich: der reguläre Übergang vom Waldweg zur Schenke, alle neun Kapitel mit echten Maus-, Tastatur- und Touch-Eingaben, kritische Wiedereinstiege, Schluss, Wiederholung, Titelwechsel sowie die eigenen Dialogporträts von Craupor, Elnon, Flick und Baris. Frühe Eingaben während einer Animation überspringen keine Handlung und blockieren den Dialog nicht. Inventar und gesammelte Gegenstände bleiben erhalten. Nach Kyras Befreiung besteht die Gruppe aus Lia, Flick und Kyra; Lia erhält keine frei verfügbare Zauberaktion.

Die neue Strecke wurde auf 1280 × 800 mit normaler Bewegung und auf 390 × 844 mit reduzierter Bewegung vollständig durchgespielt. Der [lokale QA-Bericht](../output/qa/continuation-browser/continuation-qa.json) enthält die einzelnen Prüfungen und 33 Screenshots. Die Tests liegen in `game/e2e/continuation-story.pw.ts`. Die Prüfung erfolgte abschnittsweise; ein ununterbrochener Lauf vom vollständigen Prolog bis zum Schluss wurde nicht durchgeführt.

Der zusammengesetzte Build unter `output/site/` wurde geöffnet. Die neue Bruderschaftsszene zeigt die korrigierte Ankunft ohne Fußverletzung; die vier neuen Cutscenes sind im Asset-Viewer sichtbar und lassen sich öffnen und herunterladen. Alle 177 Dateien stimmen mit den SHA-256-Hashes im lokalen `release.json` überein. Die Vorschau läuft unter `http://127.0.0.1:5231/`. Dieser Prüfbericht beschreibt den lokalen Stand vor der Veröffentlichung.

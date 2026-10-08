# Materialien für Selantis Teil 3

Der Handoff für "Falscher Glaube" enthält die folgenden lokalen Arbeitsmaterialien. Das separate ZIP unter `output/bundles/` liefert zusätzlich den Quellstand des Spiels, fertige Spielassets, Grafikskripte, Tests und Fachleitfäden. Alle Pfade im Paket unter `project/` entsprechen den Repository-Pfaden.

| Material | Lokaler Einstieg | Verwendung |
| --- | --- | --- |
| Originalfilm | [Vollständiges MP4](../../../sources/videos/03-c9oV3Lh2Lyw.mp4) | Ablauf, Sprecher und unsichere Stellen nachprüfen. |
| Filmchronologie | [Episode 3](../../episode-03.md) | Gesicherte Ereignisse, Zeitbelege und Adaptionsgrenzen. |
| Transkript | [Volltext](../../../sources/transcripts/03-c9oV3Lh2Lyw.txt), [Zeitsegmente](../../../sources/transcripts/03-c9oV3Lh2Lyw.json) | Vollständig lesen; automatische Erkennung und Untertitel sind keine geprüften Dialogskripte. |
| Roman | [Volltext](../../../sources/novel/roman-selantis-2.txt), [Original PDF](../../../sources/novel/source.pdf), [Analyse](../../novel-analysis.md) | Bestehende Figuren, Beziehungen und Handlung bis zum Manuskriptende. |
| Mythologie | [Text](../../../sources/mythology/extracted.txt), [Original PDF](../../../sources/mythology/source.pdf), [Analyse](../../mythology-analysis.md) | Welt und Herkunft der Urmacht, mit der aktuellen Design-Bibel abgleichen. |
| Aktuelle Vorgaben | [Design](../../rebuild/DESIGN.md), [Kapitel schreiben](../../rebuild/chapter-authoring.md) | Verbindliche Figurengestaltung, Sprache, Engine und Arbeitsablauf. |
| Grafikgrundlage | [Art Pipeline](../../rebuild/art-pipeline.md), `docs/rebuild/art/refs/`, `scripts/art/cast.json` | Eigene Figurenentwürfe und gemalte Pixelgrafik; Filmframes dienen nur der Handlung. |
| Quellenzustand | [Medienprüfung](../source-status.json) | Wiederhergestellte Filme, Größen, Hashes, technische Lesbarkeit. |

Zusätzlich liegen die ursprünglichen deutschen und englischen VTT-Dateien unter `sources/videos/03-c9oV3Lh2Lyw.*.vtt` bei. Die Audiospur ist im vollständigen MP4 vorhanden; eine separate Teil-drei-WAV-Datei liegt nicht vor. Für Kontinuität enthält das Paket außerdem die Texte, Zeitsegmente und Bildreferenzen aus Teil zwei.

Kontaktbögen, dichte Bildfolgen und Schlüsselbilder liegen unter `sources/frames/`. Die Episodenanalysen verlinken die benötigten Momente. Gemeinsame Quellen aus Teil eins, Landschaftsreferenzen aus `output/imagegen/style-refs/` und die vorhandene FFTA-Referenz liegen ebenfalls bei. Rechercheframes dürfen nicht als Personenreferenz für neue Grafiken verwendet werden.

Die Filme wurden für diesen Handoff vollständig heruntergeladen. Dauer, Audio-/Videostreams und drei dekodierte Frames pro Film sind technisch geprüft; das ist keine neue vollständige Sichtung oder Sprecherprüfung. Unklare Stellen bleiben im Szenenplan als prüfbare Quellenfragen stehen.

Alte Dokumente nennen teils nicht mehr vorhandene Code- oder Designpfade. Arbeitsgrundlage sind `game/src/chapters/`, die aktuelle Design-Bibel und die technische Anleitung dieses Handoffs. Die ZIP-Datei enthält keine Zugangsdaten, Git-Historie, node_modules, laufenden Entwicklungsserver oder temporären Browserergebnisse. `FILES.json` ist die vollständige Dateiliste mit SHA-256-Werten; `SNAPSHOT.json` und `BASELINE.patch` dokumentieren den übernommenen Arbeitsstand.

Die ergänzende lokale Quellensammlung umfasst 490 Dateien und 758.1 MB. Der eigene vollständige Film hat 669.2 MB. Die gemeinsame Spiellaufzeit und ihre Assets sind darin noch nicht mitgezählt.

# Materialien für Selantis Teil 2

Der Handoff für "Letzte Hoffnung" enthält die folgenden lokalen Arbeitsmaterialien. Das separate ZIP unter `output/bundles/` liefert zusätzlich den Quellstand des Spiels, fertige Spielassets, Grafikskripte, Tests und Fachleitfäden. Alle Pfade im Paket unter `project/` entsprechen den Repository-Pfaden.

| Material | Lokaler Einstieg | Verwendung |
| --- | --- | --- |
| Originalfilm | [Vollständiges MP4](../../../sources/videos/02-XUZV9T7fEsE.mp4) | Ablauf, Sprecher und unsichere Stellen nachprüfen. |
| Filmchronologie | [Episode 2](../../episode-02.md) | Gesicherte Ereignisse, Zeitbelege und Adaptionsgrenzen. |
| Transkript | [Volltext](../../../sources/transcripts/02-XUZV9T7fEsE.txt), [Zeitsegmente](../../../sources/transcripts/02-XUZV9T7fEsE.json) | Vollständig lesen; automatische Erkennung und Untertitel sind keine geprüften Dialogskripte. |
| Roman | [Volltext](../../../sources/novel/roman-selantis-2.txt), [Original PDF](../../../sources/novel/source.pdf), [Analyse](../../novel-analysis.md) | Bestehende Figuren, Beziehungen und Handlung bis zum Manuskriptende. |
| Mythologie | [Text](../../../sources/mythology/extracted.txt), [Original PDF](../../../sources/mythology/source.pdf), [Analyse](../../mythology-analysis.md) | Welt und Herkunft der Urmacht, mit der aktuellen Design-Bibel abgleichen. |
| Aktuelle Vorgaben | [Design](../../rebuild/DESIGN.md), [Kapitel schreiben](../../rebuild/chapter-authoring.md) | Verbindliche Figurengestaltung, Sprache, Engine und Arbeitsablauf. |
| Grafikgrundlage | [Art Pipeline](../../rebuild/art-pipeline.md), `docs/rebuild/art/refs/`, `scripts/art/cast.json` | Eigene Figurenentwürfe und gemalte Pixelgrafik; Filmframes dienen nur der Handlung. |
| Quellenzustand | [Medienprüfung](../source-status.json) | Wiederhergestellte Filme, Größen, Hashes, technische Lesbarkeit. |

Zusätzlich enthält das Paket die [vollständige lokale WAV-Tonspur](../../../sources/audio/02-XUZV9T7fEsE.wav). Sie eignet sich zum Nachhören unsicherer Namen und Sprecher.

Kontaktbögen, dichte Bildfolgen und Schlüsselbilder liegen unter `sources/frames/`. Die Episodenanalysen verlinken die benötigten Momente. Gemeinsame Quellen aus Teil eins, Landschaftsreferenzen aus `output/imagegen/style-refs/` und die vorhandene FFTA-Referenz liegen ebenfalls bei. Rechercheframes dürfen nicht als Personenreferenz für neue Grafiken verwendet werden.

Die Filme wurden für diesen Handoff vollständig heruntergeladen. Dauer, Audio-/Videostreams und drei dekodierte Frames pro Film sind technisch geprüft; das ist keine neue vollständige Sichtung oder Sprecherprüfung. Unklare Stellen bleiben im Szenenplan als prüfbare Quellenfragen stehen.

Alte Dokumente nennen teils nicht mehr vorhandene Code- oder Designpfade. Arbeitsgrundlage sind `game/src/chapters/`, die aktuelle Design-Bibel und die technische Anleitung dieses Handoffs. Die ZIP-Datei enthält keine Zugangsdaten, Git-Historie, node_modules, laufenden Entwicklungsserver oder temporären Browserergebnisse. `FILES.json` ist die vollständige Dateiliste mit SHA-256-Werten; `SNAPSHOT.json` und `BASELINE.patch` dokumentieren den übernommenen Arbeitsstand.

Die ergänzende lokale Quellensammlung umfasst 354 Dateien und 737.8 MB. Der eigene vollständige Film hat 582.1 MB. Die gemeinsame Spiellaufzeit und ihre Assets sind darin noch nicht mitgezählt.

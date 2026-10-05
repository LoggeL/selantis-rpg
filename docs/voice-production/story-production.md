# Vertonung der Kapitel I bis V

Für die übrigen Kapitel ist `gemini-3.8-flash-tts` mit der Google Batch API vorgesehen. Das geprüfte Inventar enthält 1.557 Takes für 36 aktive Sprecherrollen: 867 Dialogzeilen, 323 Gedanken, 113 gewählte zitierte Antworten, 203 menschliche Rufe und 51 Erzählpassagen. Alle Verzweigungen sind erfasst. Menüs, Steuerungsanweisungen, nichtsprachliche Geräusche und musikalische Gesangspassagen sind im Inventar mit ihrer Quelle ausgeschlossen. Die 188 Prologaufnahmen bleiben erhalten.

Die Besetzung steht in [story-speakers.md](story-speakers.md), das an die Quellen gebundene Inventar in [story-lines.json](story-lines.json). Die Kapitelregie und ergänzende Rufe stehen unter [directions](directions). Jede Aufnahme besitzt eine geprüfte kurze Regie. Sorge, Trauer, Schmerz, Wut, Flüstern und Scherz werden aus dem Kontext der einzelnen Zeile abgeleitet. Die Stimme bleibt je Rolle konstant. Neue Besetzungen sind Castingentscheidungen und noch keine Hörabnahme.

Lia und Kyra sprechen ihre eigenen Gedanken und gewählten Antworten. Erwachsene und junge Baris-Aufnahmen werden durch getrennte Prolog- und Story-Banken zugeordnet. Reine Buchzitate, die Lia vorliest, verwenden ihre Stimme; Erzählrahmen bleiben beim Erzähler. Sichtbare Tastatur- und Touchhinweise sowie der Steinzähler bleiben im Text erhalten und werden nicht mitgesprochen. Szenen und explizite Stimmungen unterscheiden gleiche Wörter mit unterschiedlichen Takes.

## Kosten und Vorbereitung

Am 5. Oktober 2026 enthält das Paket 83.435 Zeichen und etwa 14.174 Wörter. Bei 100 bis 170 gesprochenen Wörtern pro Minute ergeben sich etwa 83 bis 142 Minuten Audio. Ein kompletter Take kostet geschätzt 0,59 bis 1,00 USD im Batch oder 1,18 bis 2,00 USD über die normale API. Sprechpausen, tatsächliche Tokenzahlen und Korrekturtakes können die Rechnung verändern. Prüfungen und Steuern sind nicht enthalten.

Die [Google-Preisliste](https://ai.google.dev/gemini-api/docs/pricing) nennt für dieses Modell bis zum 31. Dezember 2026 im Batch 0,25 USD pro Million Eingabetoken und 4,50 USD pro Million Audiotoken. Das [Batch-Bearbeitungsziel](https://ai.google.dev/gemini-api/docs/batch-api) beträgt 24 Stunden und ist keine garantierte Frist.

```sh
node scripts/story_voice_inventory.mjs --check
python3 scripts/story_voice_batch.py prepare \
  --run-dir output/audio/story-voice/<run>
```

Prepare friert Inventar, Sprecherprofile, Originalquellen, JSONL und Hashes unter dem ignorierten privaten Run-Verzeichnis ein. Das aktuelle Paket liegt unter `output/audio/story-voice/2026-10-05-all-chapters/`. Zugangsdaten gehören nicht in Dateien oder Befehlsargumente. `--key-stdin` nimmt den vorhandenen Schlüssel aus dem Prozessspeicher entgegen. Globale Reservierungen und ein Submit-Journal verhindern doppelte bezahlte Jobs. Bei unbekanntem Submit-Ergebnis wird `reconcile` verwendet, kein erneutes Submit.

## Prüfung und Einbindung

1. `story_voice_batch.py status` prüft den vorhandenen Job. `collect` bewahrt Providerantworten, normalisiert die Audiodateien und erstellt das private vorgeschlagene Laufzeitmanifest. Es veröffentlicht keine ungeprüften Clips.
2. `story_voice_qa.py` prüft Decodierung, Signal, Dauer, Stille, mögliche abgeschnittene Enden und die gesprochenen Wörter mit dem vorhandenen lokalen MLX-Modell. Die Transkription erhält keinen Solltext. Abweichungen benötigen eine konkrete Prüfung oder einen gezielten Korrekturtake.
3. `story_voice_word_cues.py` richtet die Originalwörter an den tatsächlichen MP3s aus. Auffällige Intervalle benötigen eine an Text, Quelle, Audio und Zeitmarken gebundene private Qualifikation.
4. Der Export nach `game/public/audio/story/` erfordert einen bestandenen Bericht für alle aktuellen Audiohashes und die Wortzeitmarken. `--require-alignment` ist für die Spielveröffentlichung zu setzen. Die Textanzeige folgt anschließend der tatsächlichen Audiozeit und unterstützt Weiter wie der Prolog.

Die lokale Python-Umgebung und das bereits vorhandene Modell können mit absoluten Pfaden verwendet werden:

```sh
<MLX-Python> scripts/story_voice_qa.py \
  --run-dir output/audio/story-voice/<run> \
  --model-dir <lokaler-Modellordner>
<MLX-Python> scripts/story_voice_word_cues.py \
  --run-dir output/audio/story-voice/<run> \
  --private-dir output/audio/story-voice/<run>/word-cues \
  --model-dir <lokaler-Modellordner>
```

Automatische Prüfungen belegen Worttreue und technische Funktion. Schauspiel und Sprecheridentität brauchen zusätzlich eine Hörprüfung. Rohdateien, verworfene Takes, Prüfberichte und Providerdaten bleiben privat. Öffentlich werden nur geprüfte MP3s und das Laufzeitmanifest. Eine Veröffentlichung erfolgt durch einen geprüften Push auf `main` und den anschließenden Abgleich von `/release.json`.

# Vertonung der Kapitel I bis V

Die übrigen Kapitel verwenden `gemini-3.8-flash-tts` mit der Google Batch API. Das geprüfte Inventar enthält 1.557 Takes für 36 aktive Sprecherrollen: 867 Dialogzeilen, 323 Gedanken, 113 gewählte zitierte Antworten, 203 menschliche Rufe und 51 Erzählpassagen. Alle Verzweigungen sind erfasst. Menüs, Steuerungsanweisungen, nichtsprachliche Geräusche und musikalische Gesangspassagen sind im Inventar mit ihrer Quelle ausgeschlossen. Die 188 Prologaufnahmen bleiben erhalten.

Die Besetzung steht in [story-speakers.md](story-speakers.md), das an die Quellen gebundene Inventar in [story-lines.json](story-lines.json). Die Kapitelregie und ergänzende Rufe stehen unter [directions](directions). Jede Aufnahme besitzt eine geprüfte kurze Regie. Sorge, Trauer, Schmerz, Wut, Flüstern und Scherz werden aus dem Kontext der einzelnen Zeile abgeleitet. Die Stimme bleibt je Rolle konstant. Neue Besetzungen sind Castingentscheidungen und noch keine Hörabnahme.

Lia und Kyra sprechen ihre eigenen Gedanken und gewählten Antworten. Erwachsene und junge Baris-Aufnahmen werden durch getrennte Prolog- und Story-Banken zugeordnet. Reine Buchzitate, die Lia vorliest, verwenden ihre Stimme; Erzählrahmen bleiben beim Erzähler. Sichtbare Tastatur- und Touchhinweise sowie der Steinzähler bleiben im Text erhalten und werden nicht mitgesprochen. Szenen und explizite Stimmungen unterscheiden gleiche Wörter mit unterschiedlichen Takes.

## Stand der Produktion

Der erste Batch hat alle 1.557 Takes erfolgreich erzeugt, insgesamt rund 125 Minuten Audio. Die gemeldeten 24.578 Eingabetoken und 187.779 Audiotoken entsprechen mit den unten genannten Batchpreisen etwa 0,85 USD. Das ist eine Berechnung aus den Antwortdaten, keine geprüfte Rechnung. Korrekturtakes und unabhängige Transkriptionsprüfungen kommen hinzu. Die Storybank wird erst nach vollständiger Prüfung der aktuellen Audiodateien und Wortzeitmarken veröffentlicht.

346 bezahlte Korrekturaktionen sind dokumentiert und in die private Gesamtbank übernommen. Mehrere Aktionen betreffen dieselbe Zeile; diese Zahl bezeichnet keine zusätzlichen Storyzeilen. 68 Aufnahmen verwenden kurze deutsche Sprechregie. Vier weitere Einzelkorrekturen betreffen DANN, Ugh, Ach und Uh; nicht freigegebene Kandidaten bleiben privat. Azars „Pfff“ verwendet zusätzlich eine offen dokumentierte Nachbearbeitung aus zwei Takes derselben Quelle und desselben Google-Presets: die vollständigen gesprochenen Wörter und einen isolierten Lippenlaut. Die ursprünglichen Dateien bleiben archiviert. Die unabhängige Prüfung des Ergebnisses beobachtet die vollständige Wortfolge und genau einen Pff-Laut. Die vollständige aktuelle Wort- und Zeitmarkenprüfung der Gesamtbank bleibt offen.

Der korrigierte Quellscanner erhält bei 83 Lia-Aufnahmen die tatsächlich übergebenen Stimmungen; bei der Veröffentlichung werden genau 85 entsprechende Laufzeitschlüssel neu gebunden. Der private Generierungsstand bleibt unverändert. Drei zusätzliche Ablenken-Rufe von Lia stehen in `TacticsScene` statt in den Kapitelskripten. Ihr eigenes eingefrorenes Inventar verwendet Zephyr und die tatsächliche Voice-Szene `rettung`. Ihre eigene Wort- und Zeitmarkenprüfung ist bestanden; sie werden mit der vollständig geprüften Kapitelbank zusammengeführt. Die ursprünglichen 1.557 IDs und der Prolog bleiben erhalten.

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
   `story_voice_asr_batch.py` transkribiert ausdrücklich ausgewählte auffällige MP3s unabhängig mit Gemini, ohne Solltext im Modellprompt. Individuelle Namensschreibweisen werden nur mit Audio-, Quelltext- und Rohantwortbindung akzeptiert. `story_voice_ctc_align.py` bietet eine weitere lokale Prüfung: Der freie CTC-Decoder liefert unabhängige Wörter; die erzwungene Ausrichtung liefert ausschließlich Zeitvorschläge. Freigaben sind explizit und bleiben privat.
   `story_voice_vocal_qc.py` untersucht ausgewählte Laute ebenfalls ohne Solltext oder Emotionsvorgabe im Prüfprompt. Lachen, Schreie, gedämpfte Laute und Schluckauf benötigen eine konkrete private Freigabe mit aktuellen Audio-, Quellen- und Rohantworthashes. Alle übrigen Wörter müssen vollständig erhalten bleiben. Diese Analyse liefert keine Wortzeitmarken. Ein ausdrücklich begrenzter Normalmodus kann kleine Prüfgruppen sofort untersuchen. Er schreibt vor jedem Request ein Journal und sendet unklare Aufträge nicht erneut. Widersprechende unabhängige Wortbelege können eine Aufnahme auch dann sperren, wenn ein anderer Decoder den Originaltext erkennt.
   `story_voice_specialist_asr.py` und `story_voice_pro_asr.py` liefern weitere ausdrücklich begrenzte Transkriptionen ohne Solltext. `story_voice_qa_finalize.py` ergänzt nur vollständig belegte aktuelle Wortfolgen. Es erhält die ursprünglichen Decoderbefunde und alle Signalfehler sowie konkrete Wortvetos. Freie CTC-Belege brauchen eine an Quelle, Audio, Modell und Rohframes gebundene Freigabe. Pro-Schreibvarianten benötigen ebenfalls eine eigene private Freigabe für jede aktuelle Aufnahme: Alle Wörter und Positionen müssen erhalten bleiben, jede Abweichung muss einer bereits erlaubten Namensschreibung oder grammatisch passenden optionalen Schwa entsprechen. Fehlende oder zusätzliche Wörter und geänderte Namensvokale bleiben offen. Für zwei ausdrücklich begrenzte Namensstellen kann `story_voice_complementary_names.py` die vollständigen übrigen Wörter aus zwei tatsächlichen unabhängigen Transkriptionen mit den freien CTC-Rohframes des Namens verbinden. Quelle, Audio, Modelle und ursprüngliche Prüfbelege bleiben gebunden; die Übernahme verlangt eine eigene private Root-Freigabe. Dieser Nachweis liefert keine Zeitmarken. Unvollständige Specialist-Intents mit vollständig vorhandener Rohantwort und validem Cache können mit `story_voice_specialist_recover.py` offline abgeschlossen werden. Dabei entsteht kein neuer API-Aufruf.
   `story_voice_expressive_events.py` bindet vier konkrete Brumm-, Lach- und Pff-Stellen an ihre tatsächlichen unabhängigen Beobachtungen. Die jeweils übrigen Wörter müssen vollständig mit der Quelle übereinstimmen. Jede Übernahme benötigt eine eigene private Root-Freigabe; die Belege liefern keine Zeitmarken.
3. `story_voice_word_cues.py` richtet die Originalwörter an den tatsächlichen MP3s aus. Auffällige Intervalle benötigen eine an Text, Quelle, Audio und Zeitmarken gebundene private Qualifikation.
   `story_voice_cue_review.py` vergleicht auffällige Marken mit freien Decoderwörtern und dem Audiosignal. Unterschiede über hörbarer Sprache bleiben zur Prüfung offen.
   `story_voice_ctc_review.py` übernimmt nur ausdrücklich ausgewählte aktuelle akustische Zeitvorschläge. Originale DTW-Befunde bleiben erhalten; spätere Alignment-Durchläufe verwenden gültige Freigaben weiter. Geänderte Aufnahmen, Modellbytes oder Quellen erfordern eine erneute Prüfung.
   `story_voice_vocal_cues.py` misst bei einem konkret freigegebenen einzelnen A-Schreckruf den Beginn und das Ende der tatsächlichen Wellenform. Die eine Marke gehört zum gesamten Laut, nicht zu erfundenen Phonemzeiten. Mehrdeutige getrennte Aktivität bleibt offen; ursprüngliche DTW-Befunde werden archiviert.
4. `story_voice_publish.py` prüft vor dem Export nach `game/public/audio/story/` alle aktuellen Audiohashes, vollständige Wortzeitmarken, den aktuellen Spielquellstand und die ausdrücklich geprüften Stimmungszuordnungen. Zusätzliche Kampfzeilen brauchen ihre eigenen vollständigen Berichte und aktuelle AST-Quellbezüge. `--dry-run` validiert das gesamte Paket, `--apply --root-reviewed-routing` veröffentlicht ausschließlich MP3s und das Laufzeitmanifest mit abgesicherter Dateiersetzung. Die Textanzeige folgt anschließend der tatsächlichen Audiozeit und unterstützt Weiter wie der Prolog.

Gezielte Retakes verwenden `story_voice_generate.py --retake --only-ids ... --delivery-overrides ...` oder `story_voice_retake_batch.py`. Die Overrides-Datei muss die ausgewählten IDs genau einmal enthalten. Alle Originalwörter und Google-Stimmen bleiben gebunden; frühere Takes werden gesichert. Für reine ausgeschriebene A-Schreie können ausdrücklich gebundene `vocal_events` Googles native `<scream>`, `<shriek>` oder `<shout>` einsetzen. Andere Wörter dürfen dabei nicht ersetzt werden; jede neue Aufnahme braucht eine tatsächliche Audioprüfung. Die Batchvariante friert die aktuelle Bank ein und übernimmt fertige Retakes erst mit einem ausdrücklichen privaten Import. Nach Änderungen sind aktuelle Prüfberichte und Wortzeitmarken erneut erforderlich. Ein unbekannter Netzwerkstatus erlaubt keinen zweiten Submit. Tageslimits der normalen API sind kein Grund, denselben Auftrag dort wiederholt anzustoßen.

`story_voice_vocal_variant.py` erlaubt ausschließlich die konkret belegte, tonhöhenerhaltende Ableitung des einen Azar-Schreckrufs. Plan, Quelltake, echte TTS-Anfrage, alte Zieldateien und Veränderung werden gebunden und privat archiviert. Das Receipt nennt die Ableitung ausdrücklich. Für eine Veröffentlichung sind eine neue Lautprüfung des Zieltakes sowie aktuelle Wort- und Zeitmarkenberichte erforderlich.

`story_voice_pff_edit.py` erlaubt ausschließlich die konkret belegte Nachbearbeitung der einen Azar-Pfff-Zeile. Zwei tatsächliche Takes derselben Quelle, desselben Modells und desselben Presets liefern die gesprochenen Wörter und den isolierten Lippenlaut. Das genaue Samplefenster, alle Ursprungsbelege, die tatsächliche Zielprüfung und die alte Gesamtbank bleiben gebunden. Der private Import archiviert die vorherigen Dateien und kennzeichnet das Receipt ausdrücklich als Ableitung. Die Veröffentlichung verlangt anschließend aktuelle Wort- und Zeitmarkenberichte.

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

Automatische Prüfungen vergleichen die gesprochenen Wörter und prüfen die technische Funktion. Schauspiel und Sprecheridentität brauchen zusätzlich eine Hörprüfung. Rohdateien, verworfene Takes, Prüfberichte und Providerdaten bleiben privat. Öffentlich werden nur geprüfte MP3s und das Laufzeitmanifest. Eine Veröffentlichung erfolgt durch einen geprüften Push auf `main` und den anschließenden Abgleich von `/release.json`.

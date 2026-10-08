# Vertonung von Teil II

Teil II hat eine eigene Bank unter `game/public/audio/teil-2/`. Die 18 registrierten Szenen laden diese Bank. Die vorhandenen 188 Prologaufnahmen und die mindestens 1.490 Storyaufnahmen bleiben erhalten. Fehlende Teil-II-Aufnahmen erscheinen in der Abdeckung als offen; die Laufzeit verwendet für diese Stellen die normale Textanzeige.

Das Modell ist `gemini-3.8-flash-tts`, die Sprache `de-DE`. `speakers.json` legt die Presets fest. Die Regie steht pro Aufnahme in `lines.json`; der API-Request enthält ausschließlich den unveränderten gesprochenen Text und diesen kurzen Stil. Rollenprofile werden nicht als zusätzliche gesprochene Wörter oder lange Persona-Prompts eingefügt.

## Quellen und Laufzeit

`part2_voice_inventory.mjs` zählt die tatsächlichen AST-Quellen und alle endlichen Varianten. Vorbereitung und Veröffentlichung prüfen die vollständige aktuelle Inventarliste, Quellhashes, Sprecherprofile und explizite Routen. Eine Änderung an Text, Regie, Besetzung oder Route verlangt eine neue konkrete Prüfung. Bereits bezahlte Jobs können nach einer Quelländerung weiterhin gelesen und privat gesammelt werden.

Für Gedanken und gewählte Antworten liefert der aktive Teil-II-Weltspieler seine Sprecheridentität. In `e2-aufbruch` sprechen deshalb Flick und Lia in ihren jeweiligen Abschnitten. Die Traumsequenz und das Stabtraining verwenden denselben Aufnahme- und Textsynchronisationsweg wie andere Gespräche. Eine gemeinsame Traumzeile spielt die beiden Stimmen nacheinander mit ihren unveränderten Worten ab. Es gibt höchstens eine aktive Sprachaufnahme.

## Vorbereitung und Batch

Die folgenden Befehle laufen aus der Produktionsarbeitskopie. Der Run bleibt unter dem ignorierten `output/audio/part2-voice/`. Nur Root führt Provideraufrufe oder Modellinferenz aus; Schlüssel werden ausschließlich im RAM gehalten und über stdin übergeben.

```sh
python3 scripts/part2_voice_batch.py prepare \
  --run-dir output/audio/part2-voice/2026-10-08-all \
  --manifest docs/voice-production/teil-2/lines.json \
  --profiles docs/voice-production/teil-2/speakers.json
```

Vor `submit` legt Root im privaten Run eine konkrete Freigabe an. Sie hat `status: approved_part2_batch_submission`, `reviewed_by: root`, `source_cast_and_regie_reviewed: true`, den tatsächlichen Hash von `prepared.json` unter `prepared_sha256` und die unveränderten Werte `model`, `input_sha256`, `profiles_sha256`, `manifest_sha256`, `request_count` aus dieser Datei.

```sh
python3 scripts/part2_voice_batch.py submit \
  --run-dir output/audio/part2-voice/2026-10-08-all \
  --approval output/audio/part2-voice/2026-10-08-all/root-submit.private.json \
  --key-stdin
python3 scripts/part2_voice_batch.py status \
  --run-dir output/audio/part2-voice/2026-10-08-all --key-stdin
python3 scripts/part2_voice_batch.py collect \
  --run-dir output/audio/part2-voice/2026-10-08-all --key-stdin
```

Diese Beispiele enthalten keinen Schlüssel. Root liefert ihn über einen sicheren Prozessaufruf mit stdin, nicht als Argument, Umgebungsvariable oder Datei. Der Adapter liest keine Keychain selbst.

Die globale Reservierung verhindert identische bereits bezahlte Requests. Ein Submit-Intent entsteht vor dem ersten Netzwerkaufruf. Bei unklarem Ergebnis dient `reconcile` ausschließlich zum lesenden Wiederfinden des ursprünglichen Jobs. Es erlaubt keinen zweiten Submit. Erfolgreiche und fehlerhafte HTTP-Antworten werden vor dem Parsen privat gespeichert. Redirects werden verweigert.

`collect` lädt die Antwort nur einmal. Wenn die anschließende lokale Verarbeitung unterbrochen wird, verwendet `resume-collection` ausschließlich die bereits gespeicherte ursprüngliche Antwort. Ein abgeschlossener Sammellauf kann nicht erneut gesammelt werden. Die Ausgabe normalisiert über den unveränderten Prolog-Transport auf -18 LUFS und -1,5 dB True Peak; WAV, Messwerte, MP3 und Providerantwort bleiben privat nachvollziehbar.

## Wort-, Signal- und Zeitprüfung

```sh
python3 scripts/part2_voice_qualify.py qa \
  --run-dir output/audio/part2-voice/2026-10-08-all \
  --model-dir /absolute/existing/whisper-large-v3-turbo
python3 scripts/part2_voice_qualify.py align \
  --run-dir output/audio/part2-voice/2026-10-08-all \
  --model-dir /absolute/existing/whisper-large-v3-turbo
```

Root führt diese beiden Modellläufe nacheinander aus. Der lokale Adapter prüft die tatsächliche Turbo-Konfiguration mit 32 Audio- und vier Textschichten sowie 128 Mel-Bändern, die Gewichtsdateien und die Dimensionen des geladenen Modells. Er speichert ganze quellenfreie ASR-Antworten, Signalwerte, tatsächliche Wortzeiten, Tokenbelege und alle ursprünglichen Fehler. Der Schutz besteht aus konkreten Datei-, Modell- und Audiohashes.

Diese erste Adapterversion führt jede Prüfung einmal aus leeren Ausgabeverzeichnissen aus. Sie übernimmt keine alten freien Cachewerte, überschreibt keine historischen Prüfungen und akzeptiert keine pauschalen Namens-, Laut- oder Vokalregeln. Unterbrochene Prüfungen, Aussprachekorrekturen oder alternative Zeitbelege brauchen einen weiteren konkret geprüften Adapter. Sie dürfen nicht durch einen fingierten Passbericht oder einen zweiten vollständigen TTS-Batch ersetzt werden.

ASR und erzwungene Wortausrichtung sind technische Belege. Sie bestätigen weder menschliches Hören noch Schauspielqualität. Sprecher- und Emotionsprofile bleiben Regieanforderungen, bis eine entsprechende Hörprüfung stattgefunden hat.

## Veröffentlichung

`part2_voice_publish.py dryrun` und `apply` lesen die echte Produktionsbank direkt. `--target-root` kann die von Root konkret gewählte Releasearbeitskopie nennen. Alle dortigen Quellen, Profile, Regiedateien und Adapter müssen der geprüften Produktion entsprechen. Rohaufnahmen werden dafür nicht dupliziert.

Der Publisher prüft zusätzlich die beiden privaten Scannerdateien `output/audio/part2-voice/2026-10-07/derived-source-current.private.json` und `source-snapshot.private.json`. Root kopiert ihre unveränderten Bytes in die Releasearbeitskopie. Die deklarierten Inventarhashes müssen in beiden Arbeitskopien stimmen und bleiben bis zum abgeschlossenen Export gebunden. Der Scanner liest den tatsächlichen Releasequelltext noch einmal und vergleicht die vollständigen Quellen, Sprecher und Routen. Diese Quellprüfung ändert die Herkunft der Produktions-QA nicht. Ein eigener kooperativer Lock im Releaseziel verhindert gleichzeitige Veröffentlichungen aus verschiedenen Produktionsarbeitskopien; er ist auch bei identischer Produktions- und Releasearbeitskopie vom Produktionslock getrennt.

Die private Auswahl hat `status: approved_part2_voice_selection`, `reviewed_by: root`, `actual_word_signal_and_timing_evidence_reviewed: true`, `human_listening_or_acting_approval: false`, `selected_ids`, `target_root` und `existing_manifest_sha256` (beim ersten Export `null`). Außerdem bindet sie die tatsächlichen Hashes `manifest_sha256`, `profiles_sha256`, `prepared_sha256`, `qa_sha256`, `alignment_sha256`, `qa_producer_sha256`, `alignment_producer_sha256`. `preserved_banks_sha256` ist der SHA-256 der kanonischen JSON-Ausgabe von `part2_voice_batch.preserved_banks(target_root)`.

```sh
python3 scripts/part2_voice_publish.py dryrun \
  --run-dir /absolute/production/output/audio/part2-voice/2026-10-08-all \
  --target-root /absolute/release/worktree \
  --selection /absolute/private/root-selection.private.json \
  --qa-report /absolute/private/qa.private.json \
  --alignment-report /absolute/private/word-cues/alignment.private.json \
  --qa-producer /absolute/private/qualification-qa-ID.producer.private.json \
  --alignment-producer /absolute/private/qualification-align-ID.producer.private.json \
  --coverage-report /absolute/production/output/audio/part2-voice/2026-10-08-all/dryrun.private.json
```

Für `apply` gelten dieselben Argumente und eine neue, noch nicht vorhandene Abdeckungsdatei. Die Prüfung bindet jeden ausgewählten Take an die ursprüngliche Providerantwort, die tatsächlichen WAV-Bytes, die Normalisierung, die vollständigen Wort- und Signalberichte sowie die aktuellen Einzelwortbelege. Offene Originalfehler bleiben vollständig erhalten. Die öffentliche Abdeckung nennt alle fehlenden Quellen.

Der Export tauscht ausschließlich `audio/teil-2` aus, schützt fremde Dateien, prüft die tatsächlichen Bytes erneut und erhält die alte Bank bis zur erfolgreichen Abdeckungsfinalisierung. Vorhandene aktuelle Takes dürfen nicht stillschweigend aus einer späteren Teilveröffentlichung verschwinden. Prolog und Story müssen vollständig vorhanden und unverändert sein; zusätzliche separat geprüfte Storyaufnahmen dürfen erhalten bleiben.

Veröffentlicht wird durch einen selektiven geprüften Push auf `main` in `LoggeL/selantis-rpg`. Dokploys Git-Integration übernimmt die Bereitstellung. Vor der Meldung als live werden Deploymentstatus, `/release.json` gegen den gepushten Commit, öffentliche Audiobytes und die tatsächliche Wiedergabe im Browser geprüft.

## Neufassung mit gezeigter Gewalt

Verhör, Schläge im Kerker, Elnons Tod und Flicks verletzte Hand sind in `flicks-verhoer`, `zellengespraeche`, `gefangene`, `kontrolle`, `flicks-erinnerungen`, `flick-entkommt` und `aufbruch` jetzt ausdrücklich gezeigt. Die gebannte Kyra spricht dabei mit den Stimmungen `cold`, `struggle` und `devoted`. Das Teil-II-Inventar umfasst damit 1.442 Zeilen mit 1.449 Laufzeitrouten. 60 Zeilen sind neu oder geändert und stehen mit Regie in `teil-2/directions` als offene Aufnahmen in `missing_sources`. 17 bisherige Aufnahmen sind entfernt, weil sich ihr Wortlaut oder ihre Stimmung geändert hat. Die Bank liefert 1.092 Aufnahmen, 350 sind offen. Die Neuaufnahmen stehen in `../retakes-gewalt.md`.

Für den Check wurde der private Root-Quellstand (`derived-source-current.private.json`) auf neun geänderte Teil-II-Dateien neu gepinnt (sieben aus dieser Neufassung, dazu `lagerangriff-battle.ts` und `stabtraining-battle.ts` aus Lias Kampfbogen); die Kontextbindungen in `teil-2/directions` zeigen auf den aktuellen Quelltext.

## Offline-Adaptertests

```sh
python3 -m unittest discover -s scripts -p 'part2_voice*_test.py'
cd game
npm test -- --run src/audio/voiceover.test.ts
npm run check
```

Die Adaptertests verwenden ausdrücklich synthetische Dateien und Testdoubles für Fehlerfälle. Sie bestätigen Schutzregeln und Transaktionen, keine tatsächliche Sprach- oder Modellqualität.

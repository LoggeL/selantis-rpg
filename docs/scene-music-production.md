# Szenenmusik für Selantis

Stand: 2026-10-03. Sechs verwendete instrumentale Szenenstücke von Google AI Studio, Modell `lyria-3.5`, über die bestehende Browser-Sitzung produziert. Drei neue Läufe ersetzen die heroische Schlachtfassung und ergänzen Bedrohung und Trauer. Flucht, echte Zuflucht und friedliche Erkundung behalten ihre bisherigen Stücke. Die alte Schlachtdatei gehört nicht mehr zum veröffentlichten Build.

## Stimmung im Spiel

| Handlung | Musik |
| --- | --- |
| Valentus auf dem Schlachtfeld | Düstere Schlachtfassung, tiefe Streicher und Warnsignal statt aufsteigender Dur-Fanfare |
| Verwundung und Nachtwaldflucht | Flucht |
| Valentus wird versorgt | Zuflucht |
| Lia und Kyra auf der Wiese, Heimweg | Erkundung |
| Offene Hoftür, Versteck, Überfall und Kyras Entführung | Bedrohung, bereits ab Lias Erschrecken am Hof |
| Verlassener Hof, Eltern, Gräber, Vorbereitungen und erster Weg nach Osten | Trauer |
| Nächtliche Fremde und Fesselung | Bedrohung |
| Fesseln gelöst, Foltan hält Wache | Zuflucht |

Die Musik wechselt auch innerhalb einer Szene. Das Szenenende entfernt den Override; Einstellungen und Pause behalten die Stimmung bei. Ein später fertig geladenes Stück darf die inzwischen aktive Musik nicht überschreiben. Wiedergabe und Schleifen verwenden 0,85 Sekunden Crossfade; höchstens zwei dekodierte Stücke bleiben im Cache. Musik und Effekte lassen sich getrennt regeln.

## Produktionsnachweis

Vorhandener Google-Zugang und vorhandenes bezahltes Projekt, keine neuen Schlüssel oder Abonnements. Je neuer Fassung ein erfolgreicher Generierungslauf. Download über die sichtbare Download-Schaltfläche und den Speicherdialog. Originaldownloads unverändert übernommen, ohne zusätzliche Umkodierung oder Lautheitsbearbeitung.

Alle ausgewählten Dateien sind MP3, Stereo, 44.100 Hz, 192 kbit/s, mit ffprobe geprüft und vollständig fehlerfrei dekodiert. Prüfsummen und Metadaten: `output/audio/scenes/manifest.json`. Für die drei neuen Dateien ergab die Pegelprüfung jeweils etwa -14,3 dB mittleren Pegel und -0,2 dB Spitze. Das bestätigt Dateiintegrität und Pegel, keine musikalische Hörabnahme. Gesangsfreiheit, genaue Instrumentierung und nahtlose Schleifen bleiben Hörprüfungen. Die düstere Stimmung ist das Promptziel.

Lokale Produktionsbilder und Laufzeitnachweise liegen unter `output/qa/music-dark/` und werden nicht veröffentlicht. Arrangement, Titel, Tempo und Tonart sind neue kreative Entscheidungen; das Räuberlied bleibt separat.

## Ausgewählte Dateien

| Stück | Datei unter `output/audio/scenes/` | Dauer | Byte |
| --- | --- | ---: | ---: |
| Schlacht bei Dunkelhain, düstere Fassung | `battle-dark-lyria-3-5.mp3` | 131.317 s | 3,157,698 |
| Flucht durch den Nachtwald | `flight-lyria-3-5.mp3` | 117.290 s | 2,821,032 |
| Zuflucht im Kerzenlicht | `refuge-lyria-3-5.mp3` | 113.058 s | 2,719,468 |
| Lias Weg | `exploration-lyria-3-5.mp3` | 119.745 s | 2,879,964 |
| Dunkelschatten am Hof | `dread-lyria-3-5.mp3` | 115.122 s | 2,768,996 |
| Nach der langen Nacht | `grief-lyria-3-5.mp3` | 111.229 s | 2,675,582 |

## Prompts

Maschinenlesbar: `output/audio/scenes/prompts.json`.

### battle

```text
Original instrumental medieval dark fantasy tactical RPG underscore, Selantis, Schlacht bei Dunkelhain. A powerful wizard stands on a doomed battlefield. Grim, oppressive, severe danger from the first second, controlled tension throughout. 88 BPM, D natural minor, dark low cello and bass ostinato, restrained bass drum and low timpani, sparse dry bowed violas and tremolo, dissonant suspended seconds and minor chords, distant low natural horn only as a warning. Heavy grounded acoustic chamber orchestra. No triumphant melody, no heroic adventure, no hopeful Dorian colours, no major chords, no bright flute, no upbeat dance rhythm. Minimal foreground melody, space for tactical decisions and dialogue. About 110 seconds. Begin immediately in the dark repeating texture with no cheerful opening, maintain the same restrained ominous mood until the last second, end on unresolved continuing texture suitable for a short loop crossfade. No victory fanfare, crescendo, trailer braams, final cadence, fade to silence, battle sound effects, modern beat. Strictly instrumental, no vocals, choir, humming or speech.
```

### flight

```text
Instrumental medieval fantasy RPG suspense underscore. Title: "Selantis - Flucht durch den Nachtwald". Original music for Selantis: an injured traveller escapes through a dark forest, frightened and exhausted, hearing danger close behind. Quiet urgent tension rather than an action spectacle. 92 BPM, 4/4, E minor. Muted low bowed strings and soft plucked cello supply a restrained heartbeat-like pulse; brushed frame-drum accents are sparse. Faint breathy wooden flute fragments and thin high string harmonics suggest moonlight among branches. Dark organic acoustic texture, restrained dynamics, vulnerability, watchful unease, no heroic brass. Very little foreground melody, plenty of sonic space for game text and environmental effects. Around 1 minute 45 seconds to 2 minutes, a stable short harmonic cycle with subtle timbral changes. Start with the pulse already running and end on the same continuing pulse and unresolved harmony to allow an unobtrusive crossfade back to the beginning. No long introduction, no risers, no sudden stingers, no major crescendo, no dramatic ending, no gap of silence. Strictly instrumental: no vocals, choir, humming, whispering or speech. No modern electronic drums or literal footsteps, pursuit sounds or screams.
```

### refuge

```text
Instrumental intimate medieval fantasy RPG ambient score. Title: "Selantis - Zuflucht im Kerzenlicht". Original music for Selantis: a humble candlelit room, a wounded stranger being tended, a child's cradle nearby. Temporary shelter after terror; warmth, exhaustion, care and fragile safety with a trace of unresolved uncertainty. Do not imply any hidden identity or grand destiny. About 64 BPM, gentle 3/4, A minor with warm suspended chords. Soft fingerpicked lute, a few felt-soft dulcimer notes, warm quiet bowed viola and cello, tiny breathy recorder phrases. Small wooden room acoustic, tender but understated, no sentimental grand orchestra. Sparse notes and a repeating lullaby-like harmonic texture, with almost no lead melody so it can sit beneath dialogue. Around 1 minute 45 seconds to 2 minutes. Keep a steady quiet dynamic level throughout; start in the established texture and finish on that same continuing suspended texture, suitable for crossfading back to the opening. No long intro, no emotional climax, no resolving song ending, no large fade to silence. Strictly instrumental: no singing, choir, humming, lullaby words, speech, baby sounds or fire sound effects. No electronic beat or modern pop instrumentation.
```

### exploration

```text
Instrumental acoustic medieval fantasy RPG exploration music. Title: "Selantis - Lias Weg". Original music for Selantis: Lia follows light woodland paths and open meadows, passes weathered ruins, and notices a world larger than the farm she knew. Warm curiosity and a gentle sense of adventure, with a small thread of longing. 84 BPM, lilting 6/8, G major with occasional E minor shades. Warm fingerpicked lute and soft wooden dulcimer, airy wooden flute with short phrases, mellow chamber strings and very light hand percussion. Natural intimate acoustic texture, sun through leaves, quietly hopeful without becoming childish or comic. Little foreground melody; a few simple flute notes separated by generous space, supporting exploration and reading. Around 1 minute 45 seconds to 2 minutes. Keep an even light energy and a repeating harmonic pattern with subtle variation. Start with the established repeating texture and end within the same still-moving pattern so it can crossfade back to the beginning. No long intro, no grand reveal, no dramatic build, no conclusive cadence, no silence gap. Strictly instrumental: no vocals, choir, humming or speech. No modern drums, electronic synths, electric guitars, bird recordings or footsteps.
```

### dread

```text
Original instrumental medieval dark fantasy suspense underscore for Selantis, Dunkelschatten am Hof. A young girl hides in roadside brush while armed intruders threaten her parents and abduct her sister. This is frightening, tragic intimidation, never adventure or comedy. From the first second use a cold low cello drone, muted bass pulses, tense sparse viola tremolo and small dissonant minor-second clusters, very occasional deep soft frame drum. 66 BPM, E Phrygian and unresolved minor harmony, stripped-down acoustic ensemble, low register, very little melody, restrained quiet dynamics beneath dialogue. No bright flutes, plucked cheerful lute, major chords, soothing lullaby, heroic brass, positive turn or triumphant ending. About 110 seconds. Begin already inside the tense texture; keep fear and unease continuously through the entire piece. End with unresolved ongoing texture for a short loop crossfade. No loud stingers, sudden jumps, screams, sound effects, electronic beat, crescendo, final resolution or fade to silence. Strictly instrumental: no singing, vocals, choir, humming or spoken words.
```

### grief

```text
Original instrumental medieval dark fantasy grief underscore for Selantis, Nach der langen Nacht. Lia is alone after her parents were killed and her sister was abducted. Bare, sombre, exhausted, quiet loss, never cosy or reassuring. 54 BPM, slow free-feeling 4/4, A natural minor, low soft bowed cello and viola, sparse descending minor fragments separated by long spaces, a few muted dulcimer notes in the lower register, unresolved suspended harmony. Intimate acoustic texture, very restrained steady volume so dialogue remains clear. No upbeat rhythm, major chords, cheerful flute, warm lullaby, romantic sweeping strings, optimism, heroic uplift or grand destiny. About 110 seconds. Dark and sorrowful from the first note to the last, no positive middle section. Start in the sparse ongoing texture and end unresolved in the same texture, suitable for a short crossfade loop. No big climax, conclusive cadence, long intro or fade to silence. Strictly instrumental, no vocals, choir, humming, speech, modern synths or literal crying sound effects.
```


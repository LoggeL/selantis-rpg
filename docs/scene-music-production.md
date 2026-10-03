# Szenenmusik für Selantis

Stand: 2026-10-03. Vier Originalstücke wurden über Google AI Studio im Browser mit `lyria-3.5` als instrumentale Szenenmusik erzeugt und heruntergeladen. Vorhandener Zugang und vorhandene Abrechnung werden genutzt, keine neuen Schlüssel, Projekte oder Abonnements eingerichtet.

Die Stücke sind als Hintergrundmusik für Schlacht, Flucht, Zuflucht und Erkundung gedacht. Gleichmäßige Dynamik, wenig Vordergrundmelodie und weiterlaufende Schlussabschnitte sollen Wiederholung im Spiel erleichtern. Diese Eigenschaften sind Promptziele, keine bereits bestätigte musikalische Abnahme. Eine technisch oder musikalisch nahtlose Schleife wird nicht behauptet. Im Spiel empfiehlt sich ein kurzer Crossfade beim Wiederholen.

Die musikalischen Entscheidungen wie Tempo, Tonart, Instrumentierung und Titel sind neue Arrangemententscheidungen. Es werden keine Liedtexte und keine bestehenden Fremdkompositionen übernommen. Das Räuberlied bleibt ein separates Stück.

## Generierungsnachweis

- Anbieter: Google AI Studio, Bedienung über Computer Browser Use.
- Modell: `lyria-3.5`, sichtbar in den Run settings.
- Genau ein erfolgreicher Lauf je Stück, insgesamt vier Läufe. Angezeigter Modellpreis zuvor: 0,08 USD je Lauf (rechnerisch 0,32 USD für diese vier Generierungen; keine Rechnungsprüfung).
- Audio und Promptdaten: `output/audio/scenes/`.
- Lokale Screenshots: `output/qa/music/`, bewusst nicht Teil der öffentlichen Produktionsdokumentation.
- Alle vier Dateien mit ffprobe geprüft und vollständig mit ffmpeg ohne Fehler dekodiert. Originaldownloads unverändert kopiert, keine zusätzliche Umkodierung oder Lautheitsbearbeitung.
- Keine vollständige Hörabnahme. Gesangsfreiheit, genaue Instrumentierung und Übergänge müssen noch durch Anhören beurteilt werden.

## Ergebnisse

Alle Dateien: MP3, Stereo, 44.100 Hz, 192 kbit/s. Maschinenlesbare Metadaten und SHA-256-Prüfsummen stehen in `output/audio/scenes/manifest.json`.

| Szene | Datei | Dauer | Größe |
| --- | --- | ---: | ---: |
| Schlacht bei Dunkelhain | `output/audio/scenes/battle-lyria-3-5.mp3` | 113.371 s | 2,726,991 Byte |
| Flucht durch den Nachtwald | `output/audio/scenes/flight-lyria-3-5.mp3` | 117.290 s | 2,821,032 Byte |
| Zuflucht im Kerzenlicht | `output/audio/scenes/refuge-lyria-3-5.mp3` | 113.058 s | 2,719,468 Byte |
| Lias Weg | `output/audio/scenes/exploration-lyria-3-5.mp3` | 119.745 s | 2,879,964 Byte |

Download über die sichtbare Download-Schaltfläche in AI Studio. Downloadtitel wurden nach der Generierung für eindeutige Dateinamen gesetzt. Der AI-Studio-Tab bleibt beim letzten Stück offen; das Räuberlied bleibt in seiner eigenen Sitzung erhalten.

## Prompts

### Schlacht: Valentus bei Dunkelhain

```text
Instrumental medieval fantasy strategy RPG background score. Title: "Selantis - Schlacht bei Dunkelhain". Original music for Selantis: Valentus is an extraordinarily powerful wizard fighting a tactical battle, with luminous blue magic, courage and terrible stakes. Steady controlled forward motion, heroic resolve, restrained awe, never frantic. 104 BPM, 4/4, D minor with occasional hopeful Dorian colour. Driving low bowed-string ostinato, broad warm violas, restrained natural horns, wooden frame drums and low timpani with space between hits, delicate shimmering high string harmonics for blue magical light. Acoustic orchestral chamber scale, textured and earthy. Sparse three-note motif with long gaps; the music must support reading and turn-based decisions without demanding attention. Around 1 minute 45 seconds to 2 minutes. Maintain one consistent medium energy and harmonic cycle, with small variations in orchestration. Begin already inside the repeating texture and end on the same unresolved repeating texture so the tail can crossfade back to the beginning. No long intro, no climactic build, no victory fanfare, no big ending, no final cymbal crash, no silence gap. Strictly instrumental: no singing, no choir, no humming, no spoken words. No modern electronic beat, electric guitar, trailer braams or battle sound effects.
```

### Flucht: Nachtwald

```text
Instrumental medieval fantasy RPG suspense underscore. Title: "Selantis - Flucht durch den Nachtwald". Original music for Selantis: an injured traveller escapes through a dark forest, frightened and exhausted, hearing danger close behind. Quiet urgent tension rather than an action spectacle. 92 BPM, 4/4, E minor. Muted low bowed strings and soft plucked cello supply a restrained heartbeat-like pulse; brushed frame-drum accents are sparse. Faint breathy wooden flute fragments and thin high string harmonics suggest moonlight among branches. Dark organic acoustic texture, restrained dynamics, vulnerability, watchful unease, no heroic brass. Very little foreground melody, plenty of sonic space for game text and environmental effects. Around 1 minute 45 seconds to 2 minutes, a stable short harmonic cycle with subtle timbral changes. Start with the pulse already running and end on the same continuing pulse and unresolved harmony to allow an unobtrusive crossfade back to the beginning. No long introduction, no risers, no sudden stingers, no major crescendo, no dramatic ending, no gap of silence. Strictly instrumental: no vocals, choir, humming, whispering or speech. No modern electronic drums or literal footsteps, pursuit sounds or screams.
```

### Zuflucht: Kerzenlicht

```text
Instrumental intimate medieval fantasy RPG ambient score. Title: "Selantis - Zuflucht im Kerzenlicht". Original music for Selantis: a humble candlelit room, a wounded stranger being tended, a child's cradle nearby. Temporary shelter after terror; warmth, exhaustion, care and fragile safety with a trace of unresolved uncertainty. Do not imply any hidden identity or grand destiny. About 64 BPM, gentle 3/4, A minor with warm suspended chords. Soft fingerpicked lute, a few felt-soft dulcimer notes, warm quiet bowed viola and cello, tiny breathy recorder phrases. Small wooden room acoustic, tender but understated, no sentimental grand orchestra. Sparse notes and a repeating lullaby-like harmonic texture, with almost no lead melody so it can sit beneath dialogue. Around 1 minute 45 seconds to 2 minutes. Keep a steady quiet dynamic level throughout; start in the established texture and finish on that same continuing suspended texture, suitable for crossfading back to the opening. No long intro, no emotional climax, no resolving song ending, no large fade to silence. Strictly instrumental: no singing, choir, humming, lullaby words, speech, baby sounds or fire sound effects. No electronic beat or modern pop instrumentation.
```

### Erkundung: Lias Weg

```text
Instrumental acoustic medieval fantasy RPG exploration music. Title: "Selantis - Lias Weg". Original music for Selantis: Lia follows light woodland paths and open meadows, passes weathered ruins, and notices a world larger than the farm she knew. Warm curiosity and a gentle sense of adventure, with a small thread of longing. 84 BPM, lilting 6/8, G major with occasional E minor shades. Warm fingerpicked lute and soft wooden dulcimer, airy wooden flute with short phrases, mellow chamber strings and very light hand percussion. Natural intimate acoustic texture, sun through leaves, quietly hopeful without becoming childish or comic. Little foreground melody; a few simple flute notes separated by generous space, supporting exploration and reading. Around 1 minute 45 seconds to 2 minutes. Keep an even light energy and a repeating harmonic pattern with subtle variation. Start with the established repeating texture and end within the same still-moving pattern so it can crossfade back to the beginning. No long intro, no grand reveal, no dramatic build, no conclusive cadence, no silence gap. Strictly instrumental: no vocals, choir, humming or speech. No modern drums, electronic synths, electric guitars, bird recordings or footsteps.
```


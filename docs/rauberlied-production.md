# Räuberlied: Das Leben als Waffenknecht

Stand: 2026-10-03. Produktion in Google AI Studio über den bestehenden Browser-Tab, Modell `lyria-3.5`. Ein Generierungslauf wurde erfolgreich abgeschlossen und das Audio lokal gesichert. Die Datei wurde technisch geprüft; eine vollständige menschliche Hörabnahme steht aus.

## Quelle und Einsatz

Der Text stammt aus `sources/novel/roman-selantis-2.txt`, PDF-Seiten 67 und 71 (Textzeilen 200 und 212). Die Dunkelschatten singen im Lager am Feuer, während Kyra abseits angekettet sitzt. Eine verstimmte Laute und eine auf einem Fass geschlagene Trommel begleiten die nach Metbier schief singenden Männer. Das Lied gehört zu den Dunkelschatten, nicht zur freien Bruderschaft und nicht zu Lia.

Die beiden Strophen bleiben inhaltlich und sprachlich erhalten. Apostrophe wurden für die Eingabe vereinheitlicht. Der letzte Refrain ist eine Wiederholung für den musikalischen Schluss. Laute und Fass stammen aus der Szenenbeschreibung; die Pfeife ist durch die zweite Strophe motiviert. Liedtitel, Arrangement und Dauerziel sind Produktionsentscheidungen.

## Gesendeter Prompt

```text
German medieval campfire drinking song, earthy acoustic folk, sung by a rough adult male baritone and a small rowdy group of mercenary voices. Title: "Das Leben als Waffenknecht". This is diegetic music for the fantasy world Selantis: the villainous Dunkelschatten soldiers sing beside their campfire after drinking stolen mead. Their merriment should feel coarse and a little unsettling. Use a slightly out-of-tune lute as the main instrument, hands drumming on a wooden barrel, foot stomps, and a simple wooden flute that enters during the second verse. Close, intimate outdoor campfire acoustics, a little fire crackle, clearly intelligible German vocals, natural uneven unison singing. Catchy traditional 6/8 melody at a moderate marching/drinking pace. Entirely acoustic. No modern drums, electric guitars, synths, orchestral trailer music or polished pop backing. Around two minutes, short lute intro, first verse, chorus, brief instrumental turn, second verse, chorus, chorus repeat, short natural ending. Sing ONLY the supplied German lyrics, preserving the words. Do not sing these production instructions. The chorus should be easy for a drunken group to join. Keep the mood jovial on the surface and morally grim underneath.

[Verse 1]
Auf dem blutgen Schlachtenfeld,
starb unser Kamerad als Held.
Erschlagen, zerteilt und durchbohrt,
trug ihn der Gevatter fort.
Der Sieg war hart erkämpft und teuer,
bezwung'n der Feind, das Ungeheuer.

[Chorus]
Ihr lieben Leut ihr höret recht,
das ist das Leben als Waffenknecht.

[Verse 2]
Die Weiber soll'n im Kreise springen,
dazu soll'n die Pfeifen klingen.
Den Roten wollen wir genießen,
zünftig unsren Sieg begießen.
Morgen schon könnten wir sterben,
drumm lass uns nicht den Spaß verderben.

[Chorus]
Ihr lieben Leut ihr höret recht,
das ist das Leben als Waffenknecht.

[Final chorus, group voices]
Ihr lieben Leut ihr höret recht,
das ist das Leben als Waffenknecht.
```

## Provenienz und Prüfung

- Anbieter: Google AI Studio.
- Modell: `lyria-3.5`, in der Modellauswahl und den Run settings geprüft.
- Angezeigter Preis: 0,08 USD je Generierung. Vorhandener Zugang und vorhandene Abrechnung verwendet; keine neuen Schlüssel, Projekte oder Abonnements eingerichtet.
- Ein Lauf erfolgreich abgeschlossen. AI Studio zeigt den Titel "Das Leben als Waffenknecht" und eine Spieldauer von 1:55.
- Download über die sichtbare Download-Schaltfläche von AI Studio. Originaler Downloadname: `Das Leben als Waffenknecht.mp3`. Projektkopie: `output/audio/rauberlied-lyria-3-5.mp3`.
- Formatprüfung mit ffprobe: MP3, 44.100 Hz, Stereo, 192 kbit/s, 115,670167 Sekunden, 2.782.162 Byte.
- Vollständige Dekodierung mit ffmpeg ohne Fehler, Audiosignal vorhanden. Mittlerer Pegel -14,3 dB, Spitzenpegel 0,0 dB. Keine zusätzliche Lautheitsbearbeitung oder Umkodierung der Projektdatei.
- Ergebnisnachweis: `output/audio/rauberlied-lyria-result.jpg`. Der AI-Studio-Tab bleibt mit dem Song offen.
- Keine vollständige Hörabnahme oder gesungene-Wort-für-Wort-Transkription. Prompt-Treue und Instrumentierung bleiben durch Anhören zu beurteilen.
- Keine Veröffentlichung oder Freigabe außerhalb der angeforderten Generierung.

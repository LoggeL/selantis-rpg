# Selantis – Neuaufbau: Design-Bibel

Dieses Dokument ist die verbindliche Grundlage für den kompletten Neuaufbau des Spiels (Branch `claude/rebuild`). Der alte Code ist weg und bleibt nur in der Git-Historie (Branch `codex/fft-3d-combat`, `main` vor dem Neuaufbau). **Orientiere dich nicht am alten Code.** Die Story bleibt grob gleich, wir nehmen uns aber Freiheiten für einen besseren Spannungsbogen, coolere Quests und ein starkes Spielgefühl.

## 1. Vision

**„Die Chroniken von Selantis – Das Buch der Schwestern“**

Ein kompaktes, sehr hochwertiges Story-RPG im Browser. Es spielt sich wie ein liebevoll gemachtes 16-Bit-Abenteuer mit modernem Game-Feel: weiche Bewegung, Licht, Partikel, Wetter, Sound zu jeder Aktion, klare Ziele, kurze Wege, jede Szene hat **ein spielerisches Herzstück** (keine reinen Lauf-und-Lies-Passagen).

Das erzählerische Leitmotiv ist ein **Buch**: Lia liest leidenschaftlich gern, und das Spiel präsentiert sich als illustrierte Chronik. Kapitel beginnen wie aufgeschlagene Buchseiten, Erzählertexte stehen in Buchtypografie, große Momente erscheinen als **Buchtafeln** (die vorhandenen gemalten Illustrationen). Lias Tagebuch ist das Questlog.

Das magische Leitmotiv ist **türkises Licht – die Urmacht**. Es taucht im Prolog auf (Valentus' Strahl, das Licht über der Wiege) und begleitet Lia unbemerkt durchs ganze Spiel. Glühwürmchen sammeln sich um sie, ein Funke springt beim Feuermachen über, Regen weicht kurz zurück. Der Spieler soll es ahnen, bevor Lia es weiß. Im Finale bricht die Urmacht aus ihr hervor.

### Spielgefühl-Säulen
1. **Juicy.** Jede Eingabe antwortet sofort mit Animation, Sound, Partikeln, Kameraimpuls. Beschleunigung und Abbremsen beim Laufen, Staubwölkchen, Hit-Stop im Kampf, Screen-Shake mit Maß (abschaltbar über „Reduzierte Bewegung“).
2. **Lebendige Welt.** Wind in Gras und Bäumen, Tiere, Vögel, Glühwürmchen, Laub, Regen mit Pfützenspritzern, Tageszeiten und Lichtquellen. NPCs reden in Sprechblasen miteinander.
3. **Klar geführt, frei erkundbar.** Immer ein klares Ziel (Tagebuch, Zielmarker am Bildschirmrand), daneben optionale Entdeckungen mit echter Belohnung (Erinnerungen, Wissen, Dialogoptionen, Vorteile später).
4. **Lia ist keine Kriegerin.** Ihre Verben sind **Beobachten** (Spurenblick), **Schleichen**, **Lesen/Wissen**, **Reden** und **Improvisieren**. Kampfkraft hat Valentus im Prolog. Lia hat am Ende die unkontrollierte Urmacht. Der Kontrast trägt die Geschichte.
5. **Konsequenzen.** Kleine Entscheidungen (was Lia einpackt, was sie liest, welche Hinweise sie findet) verändern spätere Optionen und Dialoge spürbar.

## 2. Technik und Struktur

- Phaser 3.90 + TypeScript + Vite (vorhanden). Interne Auflösung **480×270**, `pixelArt: true`, ganzzahlige Skalierung, wenn möglich. Die Leinwand füllt das Fenster im 16:9-Format (Letterbox).
- **Welt und Figuren werden komplett im Code als Pixel-Art erzeugt** (`src/art/`). Keine alten Sprite-Sheets aus `public/assets/sprites` verwenden. Die Animationen dort waren nicht gut.
- **Wiederverwendet werden nur** die gemalten Illustrationen (`public/assets/cut/*.png` als Buchtafeln), die Dialogporträts (`public/assets/portraits/dialogue-*.png`) und die Musik (`output/audio/scenes/*.mp3` + Räuberlied). Kuratiere: nur verwenden, was zur Szene passt. Große Bilder (1672×941, Porträts 1254²) werden mit einem Skript in `game/public/art/` verkleinert abgelegt (Tafeln 960×540 JPG/WebP, Porträts 256×256 PNG). Nur diese verkleinerten Kopien lädt das Spiel.
- **UI ist DOM/CSS** über der Leinwand (`#ui`), gestochen scharf und responsiv. Phaser zeichnet nur die Spielwelt.
- Textsprache: Deutsch, mit korrekten Umlauten (ä, ö, ü, ß) und Anführungszeichen „…“. Code-Bezeichner Englisch.
- Keine Bibliotheken außer Phaser (Fonts von Google Fonts sind erlaubt).

### Verzeichnisse (`game/src/`)
| Ordner | Inhalt | Besitzer (Phase 1) |
| --- | --- | --- |
| `core/` | Spielzustand, Speichern, Events, Registry, Einstellungen, Eingabe-Grundlagen, `G`-Fassade | Kern (vorgegeben) |
| `art/` | Palette, prozedurale Tiles, Requisiten, Figuren-Baukasten, Effekte, Galerie | Art-Agent |
| `ui/` | DOM-UI-Kit: Dialog, Erzähler, Tafeln, Kapitelkarte, HUD, Tagebuch, Tasche, Menüs, Titel, Touch-Steuerung | UI-Agent |
| `audio/` | Musik-Manager (Crossfade), prozedurale SFX und Ambience | UI-Agent (oder Audio) |
| `world/` | Erkundungs-Engine: Karten, Spieler, NPCs, Begleiter, Interaktion, Wachen/Schleichen, Licht, Wetter, Kamera, Trigger | Welt-Agent |
| `tactics/` | Taktischer Rundenkampf: Regeln (rein, getestet), KI, Darstellung, Kampf-UI | Taktik-Agent |
| `chapters/<id>/` | Inhalte: Karten, Skripte, Minispiele eines Kapitels | Kapitel-Agenten (Phase 2) |
| `scenes/` | Boot, Titel, Debug-Kapitelwahl | Kern/UI |

Kapitel registrieren sich selbst über `import.meta.glob('./chapters/*/index.ts', { eager: true })`. **Kein Agent bearbeitet die Dateien eines anderen Bereichs.** Wenn eine Schnittstelle fehlt, wird sie im eigenen Bereich ergänzt oder als Wunsch dokumentiert (`docs/rebuild/requests.md`).

## 3. Kunststil („Selantis-Pixel“)

**Ziel:** gemütlich-melancholische 16-Bit-Ästhetik, wie ein sehr gutes modernes Pixel-RPG (Richtung Stardew Valley/Eastward/Sea of Stars in Lesbarkeit und Wärme), aber **eine** konsistente Handschrift. Es soll nicht nach Platzhaltern aussehen. Jedes Element bekommt Schattierung, Lichtkante und Textur.

- **Tilegröße 16×16.** Figuren-Frames **16×24** (Kinder/Lia schlank, Baris breiter/größer bis 24×32).
- **Eine feste Palette** (`art/palette.ts`, ca. 40–56 Farben in Rampen): Erdtöne, 4 Grünrampen, Wasserblau, Nachtblau-Violett, Hauttöne (3), Haarfarben (rotblond Lia, nussbraun Kyra, grau Valentus/Orwen, schwarz, rötlich-braun Flick), Stoffe, Stahl, Gold. **Akzent Türkis (Urmacht)** nur für Magie. Dunkelschatten: Schwarz-Weiß mit kaltem Stahl.
- Licht von **oben links**. Dunkle, eingefärbte Konturen (keine reinen schwarzen Outlines außer bei Figuren-Silhouetten), weiche Schlagschatten als Ellipsen.
- Natur prozedural mit Seed-Zufall: Gras mit Halmvarianten und Blumen, Bäume (Laubbaum, Obstbaum, Kiefer, toter Baum) mit Blattclustern und Lichtkante, Büsche, Felsen, Getreidefelder, Gemüsebeete, Wasser mit animierten Glanzlichtern und Uferkanten, Wege mit Autotiling.
- Bauwerke: Bauernhaus (Fachwerk, Ziegeldach), Scheune, Zäune, Brunnen, Schweinegatter, Taverne innen (Holzboden, Theke, Tische, Pfosten, Kamin), Zelte, Palisade, Wachturm, Ruinen, Lagerfeuer, Wagen.
- **Figuren-Baukasten (Paper-Doll):** Alle Figuren entstehen aus *einem* Körpertemplate mit Schichten (Haut, Haar-Frisur + Farbe, Oberteil, Rock/Hose/Robe, Umhang/Mantel, Kopfbedeckung, Bart, Elfenohren, Waffe). Dadurch haben alle dieselben Proportionen und **saubere, flüssige Animationen**: 4 Richtungen × idle (atmen), walk (6 Frames), run, sneak (geduckt), interact/pick-up, kneel, sit, lie, cast, attack (je Waffe), hit, fall. Sekundärbewegung: Haare/Umhang schwingen nach.
- Effekte: Staub, Funken, Glut, Rauch, Regen, Spritzer, Blätter, Glühwürmchen, Urmacht-Partikel (türkis), Treffer, Schadenszahlen, Strahl, Druckwelle.

### Figuren-Referenz
| Figur | Aussehen und Wesen (Quellen: Roman = R, Film = F) |
| --- | --- |
| **Lia** | schlank, lange rotblonde Locken (hinten hochgesteckt, zur Reise mit Haarband), weiße Bluse, brauner Rock; barfuß beim Lesen, Holzschuhe auf dem Heimweg, zur Reise leichte Lederschuhe mit Bändern um die Knöchel, langer grüner Regenmantel, großer Lederbeutel (R). Verträumt, belesen, misstrauisch gegenüber Autoritäten, trocken-ironisch; keine Kämpferin, Abenteuer kennt sie nur aus Büchern („Normalerweise lese ich immer nur Abenteuer.“, F1) |
| **Kyra** | Zwilling, lange nussbraune Haare offen (ab dem Lager mit Kordel gebunden), braune Augen, beiges knöchellanges Kleid, kleines Halsband. Fleißig, zupackend, schlagfertig, abenteuerlustig; **kann nicht lesen** (hat Mutters Lektionen verweigert). Kann reiten (R) |
| **Valentus** | Großmeister des Rats der Zehn. Schulterlanges graues Haar, schmaler kurzer Kinnbart, blau-weiße Robe, **kein Stab**: Magie wirkt aus der Hand (Strahl, Druckwelle, türkiser Schimmer). Auf der Flucht dicker, zerschlissener Kapuzenmantel über der Robe, Wunde rechts unter den Rippen; in der Zuflucht ohne Mantel, Bauch verbunden (R S. 1–5) |
| **Mutter** | lange rötliche Locken, klare grüne Augen, feine Züge, langes braunes Kleid (Schürze als Ergänzung). Stammt aus einer wohlhabenden Händlerfamilie in Trapas, gab das Stadtleben aus Liebe auf, brachte den Zwillingen Lesen und Schreiben bei, hat Kräuter und eine Wundtinktur (R S. 2, 11–12) |
| **Vater** | kräftig, graumeliertes braunes Haar, braune Weste, helles Hemd. Fährt zum Markt nach Trapas, bringt Honig-Apfelkuchen oder Bücher mit, trägt auf Marktfahrten einen Dolch, hat ein Geheimfach im Küchenschrank (R) |
| **Foltan** | braunes Haar, Ziegenbart, ledernes Barett, blau-gelber Waffenrock, Armbrust und Schwert. Ehemaliger Leutnant der Stadtgarde von Portas, desertiert aus Gewissensgründen; pragmatisch, belehrend, verschweigt später Kyras Spur (R) |
| **Azar** | korpulent, kurzer schwarzer Bart, rote Haube, gelbes Gewand, Krummschwert; Schmied aus Ignis, verschuldet, gutmütig, redselig, schreckhaft, liebt Sprichwörter („Stille Wasser sind tief.“), kocht gern (R) |
| **Craupor** | dürr, glatzköpfig, Schürze; Wirt des Goldenen Ebers, schuldet Foltan Dank, weil Foltan ihn einst vor Banditen rettete (R) |
| **Elnon** | hochgewachsener, muskulöser Elf, lange schwarze Haare im Zopf, bestickte grüne Tunika, Axt am Gürtel; gewählter Anführer der Freien Bruderschaft, einst Hauptmann der Garde von Ebaril. Kühl, nüchtern, spricht zuerst nur mit Foltan. Leitsatz: „Damit es kein zweites Ebaril gibt.“ (R S. 78–85) |
| **Alastir** | Elf, langes Silberhaar, eine Gesichtshälfte mit großer Brandnarbe, braunes Cape, grüne Tunika; Elnons Begleiter (R) |
| **Flick** | **Halbelfe**, kurzes rötlich-braunes Haar, spitze Ohren, zweifarbige Tunika (creme/oliv), dunkel rotbrauner Kapuzenkragen, schwarze Armschienen, Bogen, Messer, burgunderroter Köcher mit rot-weißen Federn (F1). Spöttisch, mutig, „die beste Fährtenleserin südlich von Trapas“. Von den Rebellen abgewiesen (Hintergrund siehe §7) |
| **Orwen** („der Grauhaarige“) | Baris' rechte Hand und Anführer des Entführertrupps, **nie „Hauptmann“**. Deutlich älter als seine Männer, strähniges graues Haar, gelbe Zähne, langer dunkler Mantel mit Goldbrosche, schwarze Lederhandschuhe, Schwert in beschlagener Scheide, Dolch im Mantel. Kalt, höhnisch, trinkt nicht mit, fürchtet nur den Meister. Tötet die Eltern (R S. 13–16, 39, 45) |
| **Baris** | **Hauptmann** der Dunkelschatten, Vamirs Handlanger. Riesig, kurzgeschorenes schwarzes Haar, buschiger Vollbart, starrer blinzelloser Blick; im Feld schwarzes Gewand mit Rüstung und spiegelnden Schulter-/Halsplatten (F1), im Lager geschnürtes schwarzes Hemd, seine eiserne Rüstung (fast doppelt so groß wie Kyra) steht im Zelt. Berüchtigt: ließ seine letzte Magd enthaupten, weil die Stiefel nicht sauber waren (R S. 39, 59, 63–64). Waffe im Kampf: Axt (F1). Nach dem Finale: vernarbte Gesichtshälfte, ein Auge verloren |
| **Algard** | Dunkelschatten, „der Narbige“ (vernarbte rechte Wange, braune Zähne), Spötter und Trinker (R) |
| **„Mädchen“** | kahlgeschorener Dunkelschatten mit Spieß; bekommt den Spitznamen, nachdem Kyra ihn auf dem Ritt in den Schenkel beißt; wird schnell rot, eitel auf seine Wette (R) |
| **Harro** | einfacher Dunkelschatten aus Orwens Trupp, bleibt nach dem Überfall zurück, um die Toten zu verscharren („Immer darf ich alles machen …“, F1 08:22) |
| **Dunkelschatten** | gewöhnliche Menschen in schwarz-weißen Wappenröcken, uneinheitlich bewaffnet: Spieß, Axt, Knüppel, Schwert (R); teils Kettenhaube oder Metallhelm, Stangenwaffe, schwarz-weißer Rundschild (F). Banner: schwarz-weiß geviertelt |
| **Vamir** („der Meister“) | Hauptantagonist. In Buch 1 nur als schwarze Kapuzengestalt, die aus schwarzem Rauch tritt; Gesicht im Schatten, nur das blasse Kinn sichtbar. Kein Glimmen. Seine Magie ist **kalt violett** (nie Türkis, Türkis gehört allein der Urmacht). Straft mit unsichtbarem Schmerz (F1 19:10). Er *besitzt* die Urmacht nicht, er giert nach ihr und braucht dafür ihre Trägerin (F2 28:03) |
| **Heer des Lichts** | Paladine des Lichts, 8. und 11. Brigade aus Ebaril, Falken aus Portas (R S. 3–4). Banner blau-weiß mit weißem Raubvogel, weiße/blau-weiße Waffenröcke, Speere (F1-Prolog). Falken kämpfen mit zwei Kurzschwertern (R S. 4) |
| **Verschwörer im Prolog** | vier Kapuzengestalten mit glühend roten Augen um ein rotes Zeichen (F1 00:22) |

**Lesen ist ein Standesprivileg.** Lia kann es dank der Mutter. Kyra, Foltan und Azar können es nicht („nicht mal wir beide können lesen“, R S. 62). In Kyra-Szenen bleibt Schrift unlesbar. Lias Lesen ist im Spiel eine echte Fähigkeit (Schilder, Karten, Briefe, Bücher).

**Sprachregel:** immer „Elf/Elfe/Elfen“, nie „Elbe/Halbelfe“.

## 4. UI-Stil („Chronik“)

Ein **einziges** visuelles System für alles. Kein Stilmix.
- Paneele: tiefes Nachtblau (#141a26-ähnlich) mit feiner Pergament-/Goldlinie, leichte Körnung, abgerundete Ecken mit kleinen Zierwinkeln (CSS, kein Bildmaterial nötig). Lesetexte (Erzähler, Tagebuch, Tafel-Unterschriften) stehen auf **Pergament** mit dunkler Tinte.
- Schriften: Überschriften **„Cinzel“** (Kapitelkarten, Titel), Fließtext **„Alegreya“**, kleine Labels/Tasten **„Alegreya Sans SC“**. Keine Pixel-Schrift in der UI.
- Farben: Pergament #efe3c8, Tinte #2b2119, Gold #d8b25a, Türkis #49e0c8 (nur Magie/Urmacht/aktive Ziele), Gefahr #d4573b.
- **Dialogbox** unten: Porträt (gemalt, aus `public/art/portraits/`) mit Namensband, Schreibmaschinen-Text mit Stimmen-Blips je Sprecher (Tonhöhe), Weiter-Indikator, Klick/E/Space/Enter überspringt bzw. weiter. Auswahlantworten als Liste (Maus, Tasten 1–4, Pfeile). Erzählerzeilen ohne Porträt in kursiver Buchschrift.
- **Kapitelkarte:** Buchseite schlägt auf, römische Ziffer, Titel, Untertitel, Zierlinie.
- **Buchtafel:** Illustration im Rahmen mit langsamem Ken-Burns-Schwenk, Letterbox, Bildunterschrift, darüber laufen Dialogzeilen.
- **Interaktions-Hinweis:** großes, deutliches Tastensymbol („E“ bzw. Touch-Hand) mit Verb („Untersuchen“, „Reden“, „Aufheben“) über dem Objekt. Feedback aus dem Playtest: Das E muss groß und klar sein.
- **HUD:** oben links aktuelles Ziel (Tagebuch-Notiz, wechselt mit kleiner Animation), am Bildschirmrand ein dezenter Zielpfeil, wenn das Ziel außerhalb liegt. Oben rechts Symbole für Tagebuch, Tasche und Menü (auch klickbar). Toasts für Funde („Erinnerung gefunden“, „Neues Wissen“).
- **Tagebuch (Tab/J):** Ziele, erledigte Ziele, Erinnerungen (Sammelstücke), Wissen (Lore), Figuren. **Tasche (I):** Gegenstände mit Lias Kommentar, Benutzen.
- **Menü (Esc):** Fortsetzen, Einstellungen (Musik, Effekte, Textgeschwindigkeit, reduzierte Bewegung, Vollbild), Kapitelwahl, Zum Titel.
- **Titelbildschirm:** atmosphärisch, prozedurale Nachtlandschaft mit Crios-Stern und Glühwürmchen oder ein langsam gleitendes Panorama; „Neues Spiel“, „Fortsetzen“ (wenn Spielstand), „Kapitel“, „Einstellungen“.
- **Touch:** virtueller Stick (links, frei platzierbar) + Aktionsknopf (rechts) + kontextuelle Zusatzknöpfe; Tippen in die Welt setzt ein Laufziel. Desktop: Maus-Klick setzt Laufziel (mit Pfadfindung), Tastatur WASD/Pfeile.

## 5. Steuerung (überall gleich)
| Taste | Aktion |
| --- | --- |
| WASD / Pfeile | Bewegen (Menüs navigieren) |
| Shift (halten) | Rennen |
| E / Space / Enter | Interagieren, Dialog weiter, bestätigen |
| C (halten) oder Strg | Schleichen/Ducken (wo verfügbar) |
| Q (halten) | Spurenblick: Welt entsättigt, Hinweise leuchten (wo verfügbar) |
| Tab / J | Tagebuch |
| I | Tasche |
| Esc | Menü / zurück |
| F2 | Debug-Kapitelwahl (immer verfügbar), `?scene=<id>` als URL-Einstieg |

## 6. Systeme

### 6.1 Zustand und Speichern (`core/state.ts`)
`GameState`: `chapter`, `scene`, `flags: Record<string, boolean|number|string>`, `inventory: Record<itemId, count>`, `journal` (Ziele, Erinnerungen, Wissen), `party`. Autosave in `localStorage` bei jedem Szenenstart und an Checkpoints. Titel bietet „Fortsetzen“.

### 6.2 Welt-Engine (`world/`)
- Karten als **ASCII-Raster + Legende** (Boden-Tiles) plus Liste platzierter Objekte (Bäume, Häuser, Requisiten, NPCs, Interaktionen, Ausgänge, Trigger-Zonen, Wachen mit Patrouillen, Lichtquellen). Kollision wird aus Tiles und Objekt-Fußabdrücken abgeleitet. Y-Sortierung.
- Spieler: 8-Wege-Bewegung mit Beschleunigung, Rennen, Schleichen, Klick-zum-Laufen mit A*, Schrittgeräusche je Untergrund, Staub.
- Interaktion: nächstes Objekt in Reichweite wird hervorgehoben (Kontur), Hinweis „E + Verb“.
- NPCs: Idle-Animationen, wandern, schauen zum Spieler, Sprechblasen-„Barks“ (ambiente Gespräche).
- Begleiter folgen über Brotkrumenpfad und kommentieren (Barks).
- **Schleichen:** Wachen mit Patrouillenpfaden und sichtbaren, von Hindernissen verdeckten Sichtkegeln, Verdachtsanzeige (? → !), Verstecke (Büsche, hohes Gras, hinter Kisten). Entdeckt werden setzt sanft auf den letzten Checkpoint zurück.
- **Spurenblick (Q):** Welt entsättigt, Hinweise (Spuren, Objekte) leuchten türkis auf.
- Licht: Tageszeit-Farbgebung (`day`, `dusk`, `night`, `dawn`, `storm`) + Lichtquellen (Feuer flackernd, Laterne, Kerze, Urmacht). Wetter: Regen, Nebel, Glühwürmchen, Laub, Pollen, Gewitterblitze.
- Kamera: weiches Folgen mit Vorausschau, Shake, Zoom-Impuls, Skript-Schwenks. Kartenübergänge mit Blende.
- Skript-API für Kapitel (async/await): Figuren laufen lassen, Blickrichtung, Animationen, Emotes (!, ?, …, Herz, Tropfen), Kamera, Licht, Wetter, Spawnen/Entfernen.

### 6.3 Story-Regie (`ui/` + `core/`)
Skripte sind **async-Funktionen** mit einem Kontext: `await ui.say('lia', 'Text')`, `await ui.choose([...])`, `await ui.narrate([...])`, `await ui.plate('raid-confrontation', {...})`, `await ui.chapterCard(...)`, `await ui.fade('out')`. Der Welt-Kontext ergänzt Figurensteuerung. Alles ist eingabesicher (keine doppelten Auslöser, kein Überspringen von Handlungen durch frühe Eingaben).

### 6.4 Taktikkampf (`tactics/`)
Raster im selben Pixelstil wie die Welt (vgl Final Fantasy Tactics Advance).
- Gemeint ist: **isometrisches Raster mit Höhenstufen** wie in FFTA (Klötzchen-Gelände, Höhe beeinflusst Bewegung, Sprunghöhe, Reichweite und Flankenfaktor), drehbare Ansicht optional. Figuren sind dieselben Pixel-Sprites wie in der Welt.
- **Spielerphase / Gegnerphase.** Jede eigene Einheit: Bewegung + eine Aktion, in beliebiger Reihenfolge.
- **Flanken:** Treffer von der Seite +25 %, von hinten +50 %. Blickrichtung ergibt sich automatisch aus der letzten Bewegung oder Aktion; kein extra Richtungsmenü. Die Vorschau zeigt es klar an („Rücken! ×1,5“). Aus dem Playtest: Blickrichtung muss verständlich sein. Höhenunterschiede wirken sich auch auf den Faktor aus.
- **Wegstoßen:** Einheiten, die gegen Hindernisse oder andere Einheiten geschoben werden, nehmen Kollisionsschaden. Das erlaubt kreative Kombos (Druckwelle).
- Gelände: Gras, Büsche (Deckung −30 % Trefferchance, verbergen), Felsen/Mauern (blockieren), Wasser/Schlamm (verlangsamt), Feuer.
- Volle Steuerung mit Maus (Klick auf Feld = bewegen, Klick auf Fähigkeit/Ziel), Tastatur und Touch. **Knopf „Zug beenden“ (Sanduhr)** immer sichtbar. Rückgängig für Bewegung, solange keine Aktion ausgeführt wurde.
- Juice: Hit-Stop, Schadenszahlen, Treffer-Flash, Partikel, kurze Kamerazooms, Sieg-/Niederlage-Banner. Niederlage → „Erneut versuchen“ ohne Fortschrittsverlust.
- Kampf-UI: Einheitenkarte (Porträt, LP-Leiste, Aktionen), Reichweiten (blau Bewegung, gold Aktion, rot Gefahr), Zugreihenfolge-Leiste, Ziel des Kampfes immer sichtbar.
- Kämpfe sind datengetrieben (Karte, Einheiten, Ziele, Wellen, Skript-Hooks für Story-Momente).

### 6.5 Audio (`audio/`)
- Musik mit Crossfade und Szenen-Stimmungen: `battle`, `flight`, `refuge`, `exploration`, `dread`, `grief`, `tavern` (Räuberlied).
- **Prozedurale SFX (WebAudio):** Schritte (Gras, Erde, Holz, Stein, Pfütze), Dialog-Blips, UI-Klick/Bestätigen/Abbrechen, Fund-Glocke, Ziel-erledigt-Fanfare (kurz), Treffer, Schwung, Magie-Schimmer, Druckwelle, Herzschlag (Schleichen), Feuerknistern, Regen, Wind, Grillen, Vögel, Donner, Hufe.
- Ambience-Schichten pro Karte. Lautstärken in den Einstellungen. Start erst nach erster Nutzereingabe (Autoplay-Regeln).

## 7. Geschichte und Kapitel

Freiheiten sind ausdrücklich erlaubt, solange der Kern bleibt und spätere Filme nicht widersprochen werden. Wo die Bibel etwas erfindet, ist es als **(Adaption)** markiert. Quellenkürzel: R = Roman (PDF-Seite), F1/F2/F3 = Film 1/2/3 (Minute).

### 7.1 Hintergrund (Lore)

- **Xenovia und die Urmacht.** Die ersten zehn Menschen von Selantis stürzten ihre Schöpferin, die Göttin Xenovia, nahmen ihr die Urmacht, sperrten diese in eine Höhle und verbannten Xenovia auf den Meeresgrund (F2 27:00). Das Volk verehrt die Zehn Götter. Das **Verbannungsfest** jeden Sommer in Trapas feiert den Sieg mit kettenförmigem Hefegebäck, das für die gebrochene Knechtschaft steht (R S. 47–48). Crios ist der hellste Stern, steht immer im Westen und ist nach dem treuen Adler des Aros benannt, des ersten Menschen. Er half Aros, Xenovia zu stürzen (R S. 32, 40). Destar ist der Gott der Elfen, Rega sein Hirsch (R S. 86).
- **Der Rat der Zehn Geweihten.** Jedes Mitglied vertrat eine große Stadt (belegt: Ignis). Sie gaben Gesetze für ganz Selantis und wachten vor allem über die Urmacht, die in einer versiegelten Höhle hinter dem Ratssaal ruhte (F1 00:00; F2 16:57, 26:46).
- **Der Verrat der Vier.** Vier der Zehn strebten nach mehr Macht, schlossen ein geheimes Bündnis und scharten die „Kinder des Bösen“ um sich: Räuber, Söldner und bewaffnete Bauern, aus denen die Dunkelschatten wurden. Sie wollten sich die Urmacht aneignen (F1 00:18; R S. 51).
- **Dunkelhain, vor 16 Jahren.** Paladine des Lichts, die 8. und 11. Brigade aus Ebaril und die Falken aus Portas hielten einen Hügel gegen ein schwarz gekleidetes Heer. Die Fürsten standen auf der Seite der Sechs. **Die Dunkelheit siegte.** Foltan sagt: „Ordnung gegen Anarchie. Letztere siegte.“ (R S. 3–4, 51; F1 00:47). Großmeister **Valentus** holte die Urmacht aus der Höhle, bevor die Feinde sie erreichten, floh verwundet und brach im Wald zusammen. Ein Bauer fand ihn, er und seine Frau pflegten ihn. Als Valentus fühlte, dass seine Zeit gekommen war, übergab er die Urmacht „dem Unschuldigsten und Wehrlosesten, was er finden konnte“, einem Säugling: „Vorerst würde so kein Schaden angerichtet werden.“ (F1 01:03–02:02). Danach verschwand er in grellem Licht mit einem Knall (R S. 6). Der Film sagt, er sei gestorben. **Im Spiel bleibt sein Verbleib offen.** Keine Leiche, kein Grab (er erscheint in F3 als Lichtgestalt).
- **Nach Dunkelhain.** Der Rat ist zerbrochen, niemand steht mehr über den Fürsten. Aus Angst vor der Rache der Sieger haben sie sich in ihre großen Reichsstädte zurückgezogen und das Land den Dunkelschatten, Räubern und Marodeuren überlassen. Höfe und Dörfer sind schutzlos (R S. 30, 51–52). **Volksglaube in Buch 1:** Zwei der vier Abtrünnigen haben überlebt. **Wahrheit (erst später, F2 27:13–27:58):** Von den treuen Zehn überlebten nur Valentus und Ignatius von Ignis, der sich in die Wälder zurückzog. Einer der Abtrünnigen (ASR „Tolos“, unsicher, im Spiel nicht nennen) räumte alle Mitverschwörer aus dem Weg. Er ist von der Urmacht besessen und nennt sich **Vamir**, „was in der Sprache der Alten der Allmächtige heißt“. Dazu braucht er die Trägerin der Urmacht (F2 28:03). In Buch 1 sprechen NPCs nur von „den beiden Abtrünnigen“ und „dem Meister“.
- **Der Rat der Drei** (Gerücht, R S. 30): heutige, machtlose Obrigkeit. Sein Großmeister, ein anderer als Valentus, sei dem Wahnsinn verfallen und führe einen Feldzug gegen fremde Kulte, statt die Höfe zu schützen. Den Titel „Großmeister“ nie mit Valentus verwechseln.
- **Die Urmacht** (F3): Sie wählt ihre Trägerin selbst, zeigt sich vor allem in größter Gefahr und schützt sie. Vamir braucht die Trägerin lebend. Deshalb gilt Baris' Befehl „Ihr Leben ist mehr wert als euer mickriges Dasein.“ Ihre Farbe im Spiel ist Türkis. Lias Augen leuchten beim Ausbruch blau (F1).

### 7.2 Die tragende Linie

> Seit sechzehn Jahren suchen die Dunkelschatten im Auftrag ihres Meisters das Kind, in dem die Urmacht steckt. Orwens Trupp überfällt den Hof und verlangt das „Balg“ (F1 06:28). Die Eltern behaupten, sie seien allein (R S. 14). Als ein Dunkelschatten Kyra in ihrem Versteck im Haus findet, verleugnet der Vater sie, um beide Töchter zu schützen: „Ich kenne sie nicht. Sie ist sicher nur ein neugieriges Kind. Lasst sie doch laufen.“ Er und die Mutter werden getötet. Lia liegt in der Böschung und wird nicht entdeckt. Die Dunkelschatten nehmen Kyra mit. Vor Kyra und untereinander nennen sie einen schlichteren Grund: Hauptmann **Baris** braucht ein neues Dienstmädchen, und die Männer wetten, wie lange sie überlebt (R S. 38–39, 44–45). Ob der Meister dahintersteckt, bleibt bis zum Finale offen. **Sie haben die Falsche.** Der Spieler ahnt es durch das türkise Leitmotiv bei Lia.
>
> Baris sucht im Auftrag des Meisters außerdem das **Geweih Regas**. Seine Späher fanden die Grotte von der Karte des Meisters nicht. Baris wagt nicht, dem Meister einen Irrtum zu melden, und reitet selbst zwei Tagesritte weit, mit Orwen, drei Männern und Kyra (R S. 72–74). Diesem Trupp folgen später Lia und Flick.
>
> **Foltans Schweigen:** Im Goldenen Eber erfährt Foltan von Craupor, dass ein Trupp von fünf Dunkelschatten mit einer Gefangenen durchgezogen ist, auf die Lias Beschreibung passt, und dass die Dunkelschatten hinter dem Geweih her sind. Zu Lia sagt er: „Craupor weiß nichts.“ Er hält Kyra für so gut wie tot und eine Rettung für aussichtslos und will die Mission der Bruderschaft nicht gefährden: „Der Krieg fordert solche Opfer.“ Für Elnon ist Kyra eine von tausenden Kriegswaisen; wichtig ist nur die Nachricht vom Geweih, für die Elfen ein Sakrileg (R S. 83–87).
>
> **Flick** ist eine Halbelfe. Bei den Rebellen (der Freien Bruderschaft) verschwieg sie ihre Herkunft. Als es herauskam, galt sie als Lügnerin und wurde verstoßen. Elnon nennt sie abschätzig „Mischling“ (F2). Zu Lia sagt sie nur die halbe Wahrheit: „Die wollen keine wie mich.“ Seitdem ist sie ihre eigene Ein-Frau-Rebellengruppe, „die Elfen von Grunwald“ (F1 13:25, Name unsicher). Lia kommt gerade aus einem Lager voller Elfen und kann stutzig werden. **Am Ende führt der Weg zurück zur Bruderschaft.** Flick will die Schwestern „zu den Rebellen“ bringen, damit die Lias Kraft einordnen. Für Lia heißt das: zurück zu Foltan und Azar. Das bleibt der offene Konflikt für Buch 2.
>
> **Finale:** Vamir straft Baris und verwundet ihn schwer (eine Gesichtshälfte, ein Auge): „Du hast versagt, Baris. Du hattest von Anfang an die Falsche.“ – „Beim nächsten Mal bin ich nicht so nachsichtig.“ (F1 18:48; F2 13:43). Wo die Trägerin ist, weiß er nicht.

**Namen:** „Vardis“ gibt es nicht. Das war ein Erkennungsfehler im Transkript von Film 1, alte Notizen in `docs/episode-01.md` sind falsch. Der Hauptmann heißt **Baris**, der Meister **Vamir**. **Orwen** ist nie „Hauptmann“. Bis zum Kyra-Zwischenspiel heißt er im Namensband „Der Grauhaarige“, weil Lia seinen Namen nicht kennt. Die Heldin heißt in den Filmen Triss, im Spiel **Lia**.

Vorlagen: Roman (`docs/novel-analysis.md`, Volltext `sources/novel/roman-selantis-2.txt`) bis Kapitel 6, danach Film 1 (`sources/transcripts/01-*.txt`; `docs/episode-01.md` nur mit Vorsicht). Bekannte Namen: Lia, Kyra, Valentus, Foltan, Azar, Craupor, Elnon, Alastir, Flick, Orwen, Baris, Algard, „Mädchen“, Harro, Vamir („der Meister“), Ignatius von Ignis (nur erwähnbar). Bücher: „Cronibus großes Kräuterlexikon“, „Die Geschichten der Magierin Alana“ (Alana, Riccard, Balduin; Imandur mit seiner Magierakademie; Jaromir und Irina; „im Jahre 256 vor Dunkelhain“). Orte: Selantis, Trapas (Westen; Markt- und Festungsstadt, Heimat der Mutter, Verbannungsfest, Lichterorden; mit dem Karren an einem Tag hin und zurück), Portas (Osten; Handelsstadt, Foltans frühere Stadtgarde; Wochenreise), Ignis (Azars Heimat), Moneda (Zwergenstadt), Ebaril (Elfenstadt, von Dunkelschatten niedergebrannt), Dunkelhain, Goldener Eber.

**Familie** (R Kap. 1): Der Hof ist klein, einen Knecht können sich die Eltern nicht leisten, die Mädchen helfen mit. Seit Tagen kein Regen, der Vater sorgt sich um die Ernte. Mitbringsel vom Markt: honiggesüßte Apfelkuchen (Lias Lieblingsgebäck), einmal das Alana-Buch, zum Verbannungsfest Kettengebäck. Lia war noch nie länger als einen Tag von zu Hause fort.

### 7.3 Playtest-Feedback (Sebastian), gilt unbedingt
- Die Schlacht von Dunkelhain ist **real geschehen**, kein „Fiebertraum“. Chronologie: Rat → Schlacht → Flucht → Zuflucht.
- Der Ratskonflikt um die Urmacht muss klar werden.
- Der Axtkämpfer (**Baris**, der spätere Hauptmann) stirbt nicht. Er bleibt verwundet liegen. **(Vorgabe des Nutzers)**
- Kampfende: Pfeiltreffer, Valentus geht in die Knie, die Armee flieht im Hintergrund, langsames Abblenden. **Keine Verpixelungs-Übergänge.**
- Zusammenbruch im Wald → Schritte → Schwarz. Klar machen, dass ihn jemand mitnimmt. Kurze Erzählerpassagen zwischen den Szenen.
- Keine harten Kanten zwischen Kartenteilen.
- Maussteuerung im Kampf. Klickbarer „Zug beenden“-Knopf (Sanduhr).
- Interaktions-E groß und deutlich.
- Hofszene: Bei Lias Ankunft sind Eltern und Dunkelschatten **schon** da. Lia muss sich sofort verstecken. Kein freies Herumlaufen auf dem Hof vorher. Felder und die Wahl des Heimwegs bleiben.
- Musik unter den Prolog.

### 7.4 Szenenliste (Szenen-IDs = `?scene=`)

**PROLOG – „Die Urmacht“** (Kapitel-ID `prolog`)
1. `prolog-rat` – Das Buch öffnet sich, Erzähler mit Tafeln (Urmacht, Rat). Danach **spielbar im Ratssaal** als Valentus: zehn Sitze im Halbrund, Banner der Städte. Hinter dem Saal führt ein versiegelter Gang zur Höhle, durch das Siegel dringt das türkise Glimmen der Urmacht. Die Vier fordern, die Urmacht zu *nutzen* statt sie nur zu bewachen („Wer die Macht hütet, soll sie auch führen.“). Die Sechs halten am Wächteramt fest, darunter Ignatius von Ignis (Name fällt nur beiläufig). Der Spieler hört die Positionen (Gespräche an den Sitzen, Auswahlantworten). Bruch: Die Vier gehen mit einer Drohung. **(Adaption)** Kurze Erzähltafel „Das geheime Bündnis“: vier Kapuzengestalten mit roten Augen um ein rotes Zeichen (F1 00:22). Der Konflikt muss in 2–3 Minuten glasklar sein.
2. `prolog-schlacht` – **Taktik-Tutorial Dunkelhain.** Valentus (Strahl, Druckwelle, Schutzwall; Magie aus der Hand, kein Stab) und ein Falken-Soldat mit zwei Kurzschwertern (R S. 4) gegen Wellen von Dunkelschatten auf dem Hügel. Ziel: den Rückzug der Verwundeten decken. Lehrt Bewegung, Höhen, Flanken und Wegstoßen schrittweise. Der Axtkämpfer ist der junge **Baris**: Er wird kampfunfähig, nicht getötet, und bleibt verwundet liegen. Sechzehn Jahre später ist er Hauptmann der Dunkelschatten. Die Schlacht ist verloren. Valentus läuft zur Höhle und holt die Urmacht, bevor die Feinde sie erreichen (kurze Tafel oder Erzähler). Danach Pfeiltreffer, er geht in die Knie, im Hintergrund flieht das Heer des Lichts, langsam wird es schwarz.
3. `prolog-flucht` – Nacht, Mondlicht. Valentus flieht verwundet durch den Wald (Wunde rechts unter den Rippen). **Verfolgungssequenz:** Hunde und Fackelträger mit Sichtkegeln, Valentus wird langsamer (schwankende Kamera). Verstecken im Unterholz, durch einen Bach, um die Hunde abzuschütteln. Durchgehende Karte ohne harte Kanten. Am Ende rutscht er auf einem taunassen Stein aus (R), Schritte, eine Laterne, Schwarz. Erzähler: „Ein Bauer fand ihn und nahm ihn mit sich nach Hause.“
4. `prolog-zuflucht` – Kerzenlicht in einer Bauernstube. Valentus erwacht, das Paar hat ihn versorgt. Kurzes Gespräch, die Frau hat rötliche Locken und grüne Augen. Er kann nicht geheilt werden und fürchtet, dass die Verfolger auch seine Retter töten. Die Wiege mit **zwei schlafenden Säuglingen**. Der Spieler hält die Taste, Valentus hebt die Hand, blauer Schimmer, grelles Licht, Knall. Valentus ist verschwunden, die Kinder erwachen und schreien (R S. 5–6). Erzähler: „Er übergab sie dem Unschuldigsten und Wehrlosesten, was er finden konnte …“ Schwarz: „Sechzehn Jahre später.“ Welches Kind? Bleibt offen.

**KAPITEL I – „Der letzte Sommertag“** (`kapitel-1`)
1. `wiese` – Spätsommer, seit Tagen kein Regen. Lia liest barfuß unter einem Baum „Die Geschichten der Magierin Alana“ (Tafel lia-reading). Kyra kommt wütend vom Holzsammeln: „Weißt du, was ich interessant finde? Dass ich das ganze Feuerholz gesammelt habe, während du hier rumgesessen und gelesen hast.“ (F1 03:37). Geplänkel mit Auswahl. Lia verspricht, die Schweine zu füttern. Kyra geht voraus. Kurz frei erkunden (Wiese, Waldrand): optional einen Nestling zurück ins Nest setzen, Kornblumen für die Mutter pflücken (Auszahlung am Grab, **Adaption**), Äpfel. Einführung von Bewegung, Interaktion und Tagebuch.
2. `heimweg` – In Holzschuhen über Felder und den Hohlweg; der Spieler wählt den Heimweg. Es wird Abend, das Licht wird beim Näherkommen dramatisch dunkler. Unheilvolle Zeichen: verstummte Vögel, frische Hufspuren, Pferde am Hof (Text).
3. `ueberfall` – Der Hof liegt am Ende des Hohlwegs (Bauernhaus, rechts die größere Scheune, dahinter Schweinegatter und Wäldchen, R S. 13). **Die Dunkelschatten sind schon da.** Lia muss sofort in die Böschung links des Hohlwegs. **Schleichsequenz** entlang Böschung und Hecke, um näher heranzukommen, ohne von einem Wachposten entdeckt zu werden. Dann die Konfrontation (Raid-Tafeln + Dialog): Der Grauhaarige verhört die Eltern: „Na, wo ist euer Balg?“ – „Ist es dieses Balg wirklich wert?“ Die Eltern behaupten, allein zu sein. Kyra wird mit blutender Augenbraue aus ihrem Versteck im Haus gezerrt: „Seht mal, wen ich gefunden habe.“ – „Ihr habt uns gesagt, ihr seid alleine. Und wer ist das?“ – Vater: „Ich kenne sie nicht … Lasst sie doch laufen.“ – „Lasst sie in Ruhe!“, dann wird er erstochen. Die Mutter stirbt mit „Kyra …“ auf den Lippen. Kyra: „Ich werde euch töten! Das schwöre ich bei allen Göttern!“ – „Oh, das wollen viele Mädchen, stell dich hinten an.“ (R S. 14–16). Gewalt nicht explizit, über Tafeln und Abblenden. Lia lässt vor Schreck ihr Buch ins Gras fallen. **„Halte still“-Mechanik:** Lia will hinausstürmen; der Spieler muss die Taste halten (zitternder Balken, Herzschlag). Lässt er los, verrät ein knackender Ast fast das Versteck; der Moment wiederholt sich, kein Game Over. Drei Mann hieven Kyra aufs Pferd. Die Reiter passieren den Hohlweg direkt an Lias Versteck (tiefer ducken). **(Adaption nach F1)** Harro bleibt zurück, um die Toten zu verscharren, und mault vor sich hin. Lia muss ihm ausweichen, bis er abzieht.
4. `trauer` – Nacht. Lia bei den Eltern (Trauerkarten in Buchschrift). **Steine tragen** für zwei Steinhügel vor dem Haus (R S. 18): langsam, Grillen, Gedanken als Text. Jeder Stein bringt eine Erinnerung. Hat Lia Kornblumen, legt sie sie aufs Grab. Ihr Alana-Buch kann sie an der Böschung wiederfinden. Morgen: Tafel Gräber. Im Haus: **Packen** in den Lederbeutel vom Haken neben dem Ofen, mit begrenztem Platz. Die Wahl hat Folgen: „Cronibus großes Kräuterlexikon“ bringt später eine Heiloption und Wissen, Zunder erleichtert das Feuer (wird er vergessen, wie im Roman, ist es schwerer), das Alana-Buch ermöglicht das Vorlesen am Lagerfeuer. Fester Proviant: Speck, ein halber Laib Käse, zwei Brote, Wasserschlauch, Wolldecke, grüner Regenmantel. Geheimfach im doppelten Boden des Küchenschranks: 22 Kupfer- und 7 Silbermünzen und Vaters Dolch in Lederscheide (später zum Fesselnschneiden **und als Waffe im Kampf**). Mutters Tinktur für die wundgescheuerte Ferse, Wechsel auf Lederschuhe. Drei Schweine freilassen (sie rennen davon). Aufbruch nach Osten, den Hufspuren nach.

**KAPITEL II – „Die Straße nach Osten“** (`kapitel-2`)
1. `strasse` – Gepflasterte Hauptstraße, Wegweiser Trapas (Westen, nah) und Portas (Osten, wochenlang). Die Hufspuren verlieren sich auf dem Pflaster. Der Spieler entscheidet durch Überlegung, Lia begründet: Trapas ist stark garnisoniert, freiwillig ziehen Dunkelschatten nicht davor; die Straße nach Portas führt an vielen Dörfern vorbei. Die Straße ist auffallend leer. Optional: eine kleine Gauklertruppe auf dem Weg zum Verbannungsfest (Xenovia-Geschichte, Kettengebäck), fahrende Händler, die das allein wandernde Mädchen anstarren. Abenddämmerung.
2. `erstes-lager` – Etwa hundert Meter abseits der Straße im Wald: Steinkreis, Reisig, **Feuerbohren** (Timing-Minispiel; ohne Zunder schwerer; beim dritten Fehlversuch springt heimlich ein türkiser Funke über, **Adaption**). Essen, Mantel ausbreiten, schlafen.
3. `foltan-azar` – Nachts Schritte. **Lia wird geweckt** (nicht gefesselt, Vorgabe des Nutzers). Kurzes, für Lia bedrohliches Missverständnis, Dialog mit Auswahl, Lias trockener Humor. Foltan (ehemaliger Leutnant aus Portas) verdächtigt sie halb im Ernst, für den Lichterorden oder die Dunkelschatten zu spionieren. Azar ist ein Schmied aus Ignis. Beide sind Freischärler. Lia erzählt ihr Schicksal. Foltan nimmt sie mit, weil der Kodex es verbietet, sie zurückzulassen: „Aber versprechen können wir dir nichts.“ – „Alleine kannst du sie nicht retten.“ Er kündigt die Augenbinde fürs Lager an. Danach schläft Azar und schnarcht. Lia liegt wach und erkennt **Crios** im Westen (kleiner Sternbild-Moment): „Ein treuer Gefährte … so einen hätte ich jetzt auch gerne.“ – „Ob Kyra wohl die gleichen Sterne sieht?“ Kurzer Schnitt: Kyra angekettet im Stall des Goldenen Ebers, über ihr Crios durchs marode Dach (R S. 32, 40).
4. `waldweg` – Morgens mit Gefährten (folgen, Barks). Azar hat Wachteleier mit Speck gebraten und ist stolz darauf. Barks: schreckhaft, Sprichwörter, Spott über „den feinen Herrn Foltan“; beim Verschnaufen behauptet er, das Moos sei sein Kompass. Foltan: Das Hauptlager liegt etwa einen Tagesmarsch entfernt. Lia besteht darauf, nicht wie ein abwesendes Kind besprochen zu werden. Mittagsrast: Lia rettet Azars Stolz, indem sie sagt, sie brauche selbst eine Pause. Danach fragt er zum ersten Mal nach ihrem Namen, und sie nennt ihn: „Lia.“ Optional mit Kräuterlexikon Speikraut finden. Weiter zum Goldenen Eber.

**KAPITEL III – „Der Goldene Eber“** (`kapitel-3`)
1. `eber` – Taverne als Hub (rechts Theke, links Tische, Mittelpfeiler, Stall), Musik: das Räuberlied. Reisende und Spielleute vor dem Verbannungsfest. Craupor bewirtet Foltan umsonst. Foltan erzählt, wie er Craupor einst befreite, den Banditen kopfüber an einen Balken gehängt hatten; Azar nimmt die Pointe vorweg. **Zeitlinie:** Kyras Trupp war letzte Nacht hier, dieselbe Nacht, in der Lia Crios sah, und ist im Morgengrauen weitergezogen. **Hinweise sammeln und kombinieren** (Tagebuch): Seilfasern am Mittelpfeiler, im Stall eine Kette am Stützbalken neben einem zerwühlten Kornsack (**Adaption:** Kyras Haarband im Stroh); die Schankmaid, der die Dunkelschatten ein Schminktäschchen „geliehen“ haben; ein Zwerg, der Kyra die Hilfe verweigert hat („Geht mich nen Scheißdreck an“, im Spiel beschämt, **Adaption**); Gerede über „ein neues Dienstmädchen für den Hauptmann“ und eine Wette. Während Foltan an der Theke mit Craupor spricht, erzählt Azar heimlich Foltans Desertion: Strafexpedition gegen Bauern, die zu wenig Steuern zahlten, gefoltert, obwohl sie nichts besaßen; der Hauptmann ließ Frauen und Kinder hinrichten, Foltan weigerte sich und desertierte später. Azar: „Ich habe dir das natürlich nicht erzählt.“ Foltan kommt zurück: „Craupor weiß nichts.“ **Der Spieler weiß es besser.** Lia kann ihn darauf ansprechen, er weicht aus. Abschied: Übernachten in der Schenke sei zu unsicher.
2. `leselager` – Lagerfeuer im Dickicht. Azar bringt den Zunder erst im fünften Anlauf zum Brennen („Hoffnung kann Stürme beschwören.“ – Lia: „Glaube kann Berge versetzen.“). Dabei kommt heraus, dass Lia lesen kann. Sie liest vor, je nach eingepackten Büchern: aus dem Kräuterlexikon (Speikraut) oder das Ende der Alana-Geschichte (Imandur, Aufnahme in den Rat „im Jahre 256 vor Dunkelhain“). Foltan hält es für Mumpitz, Azar meint, die beiden säßen oben auf den Sternen. Lia: „Meint ihr, meine Eltern sind auch da oben?“ – Azar: „Vielleicht auf dem Stern direkt neben Alana und Riccard.“ Lia verlangt ein Versprechen: „Nehmt ihr mich ernst, oder bin ich nur das dumme kleine Mädchen?“ Azar verspricht es sofort. Foltan weicht aus, bis Azar ihn mit väterlicher Strenge anfährt: „Verspreche es!“ – „Schön, ich verspreche es dir auch.“ (R S. 60–67).
3. `kyra` – **Zwischenspiel: Kyra** (Vorgabe des Nutzers, Details aus R S. 33–75). Kurz spielbar als Kyra im Lager von Baris am Weiher. Erzählerbrücke: der Biss in den Schenkel des Kahlgeschorenen auf dem Ritt („Mädchen“), die Audienz bei Baris („Hast du Angst?“ – „Habe ich Grund dazu?“). Nachts ist Kyra an einem Pflock angekettet, die Dunkelschatten singen am Feuer das Waffenknechtlied. **Kyra befreit sich (Minispiel).** **Schleichend** lauscht sie Baris und Orwen am Hauptmannszelt: Die Späher fanden die Grotte nicht, der Meister besteht darauf, dass die Karte echt ist, sie suchen das **Geweih Regas**, Baris will selbst mit einem Fünfertrupp hinreiten. **Kyra wird ertappt und wieder gefesselt.** Kein ausgesprochenes „für den Meister“. Kyra schwört sich, „zu kämpfen und zu leben“. Die Szene zeigt Kyra als handelnde Figur.

**KAPITEL IV – „Die Freie Bruderschaft“** (`kapitel-4`)
1. `augenbinde` – Morgens wäscht sich Lia am Bach und versorgt die heilende Ferse. Danach geht es mit verbundenen Augen ins geheime Lager: dunkler Bildschirm, nur Geräusche und Azars Stimme (Stereo-Panning). Der Spieler folgt der Stimme. Kreativer Sinnesmoment.
2. `bruderschaft` – Lager als Hub: Palisade mit kleinen Wachtürmen, Zelte, Feuer, Schmiede. Menschen in den Farben von Trapas, Zwerge in denen von Moneda, Elfen in denen von Ebaril. Elnon spricht zuerst nur mit Foltan und sieht über Lia hinweg. Alastir. Azar in der Schmiede (repariert Kettenhemden: „Ein Schmied ist unentbehrlich“). **Training an der Palisade (Adaption):** Lia lernt *Ausweichen* und *Ablenken*, die im Rettungskampf zu Fähigkeiten werden. Optionale Geschichten (Ebaril, Destar).
3. `verrat` – Am frühen Abend, während alle beim Essen sitzen, schleicht sich Lia von Azar weg. Sie will Elnon selbst um Hilfe bitten. Schleichen: unbemerkt durchs belebte Lager, Azar nicht in die Arme laufen. Das Zelt ist unbewacht; drinnen beugt sich Elnon im Kerzenlicht über eine Karte, Alastir lehnt am Schrank. Durch die Plane hört sie Foltan: Er weiß von Craupor vom Fünfertrupp mit der Gefangenen und vom Geweih Regas und hat geschwiegen. Elnon kritisiert ihn, versteht aber das Abwägen. Alastir nennt die Jagd auf das Geweih „unverzeihlich“. Lia fühlt sich verraten und flieht in den Wald. Erzähler: Azar stellt Foltan zur Rede („Du hast es ihr versprochen!“) und sucht sie vergeblich; Foltan schämt sich.

**KAPITEL V – „Regen“** (`kapitel-5`)
1. `regenwald` – Allein in der Nacht: Wind kommt auf, Mond und Sterne verschwinden hinter Wolken, erst Nieselregen, dann rauschender Sommerregen (Blitze sparsam als Steigerung). Lia irrt umher und will Kyra allein finden. Urmacht-Andeutung: Der Regen weicht kurz um sie zurück. Begegnung mit **Flick** (Tafel flick-meeting): Flick neckt sie („So ein kleines Mädchen allein im Wald?“ – „Ich bin nicht klein.“), Lia weist sie ab, Flick zieht spöttisch weiter. Kurz darauf fällt eine maskierte Kreatur mit Axt Lia an (ein „Leichenfresser“, F1). Flick greift mit dem Bogen ein: „Nichts zu danken.“ (Ausweich-Moment). Erst dann erzählt Lia von Eltern und Schwester. Flick bietet erst an, sie in eine der großen Reichsstädte zu bringen, und hilft dann doch bei der Suche.
2. `faehrte` – **Fährtenlesen mit Spurenblick:** Hufabdrücke von sechs Pferden, abgebrochene Zweige, absichtlich fallen gelassene Perlen von Kyras Halsband (**Adaption**). An Weggabelungen muss der Spieler richtig deuten; ein falscher Weg endet in einer Sackgasse und führt zurück. Sonnenuntergang, Nachtgespräch am kleinen Feuer: Flick erzählt, dass die Rebellen sie abgewiesen haben („die wollen keine wie mich“), und von ihrer Ein-Frau-Rebellengruppe. Lia: „Aber im Lager waren doch Elfen?“ Flick weicht aus. Bindung entsteht.
3. `schattenlager` – Baris' Trupp rastet an einem Baum über offenen Feldern auf dem Weg zur Grotte. Auskundschaften: zu Aussichtspunkten schleichen. Kyra ist an den Baum gefesselt und provoziert einen Wächter („… dass ihr ein verfluchter Bastard seid“). Er will sie schlagen. Baris: „Fass sie nicht an. … Kein Aber. Ihr verdammtes Leben ist mehr wert als euer mickriges Dasein.“ Danach wird sie geknebelt. Plan: Flick will Kyra zuerst aus der Gewalt der Wachen holen, Lia soll ablenken („Kann es nicht bitte jemand anderes machen?“ – „Siehst du hier noch jemanden außer uns?“). **Bluff-Dialog** mit den Wachen: „Ich bin auf dem Weg nach Trapas und will auf dem Markt etwas verkaufen …“ – „Du bist aber noch viel zu jung.“ – „Du hast aber gar nichts zum Verkaufen dabei?“ Die Auswahl entscheidet, wie lange die Ablenkung hält (F1 16:00–17:00).
4. `rettung` – **Taktikkampf:** Lia (Ausweichen, Ablenken, Stein werfen) und Flick (Bogen, Messer) gegen Baris' Männer. Flick muss Kyra losschneiden (mit Vaters Dolch geht es schneller). Danach Kyra zum Waldrand bringen, Orwen und Baris greifen ein. Höhepunkt: Flick liegt wehrlos am Boden, Baris hebt die Axt: „Jetzt ist's aus, Spitzohr!“ Lia schreit „Flick!“, ihre Augen leuchten blau auf, und die **Urmacht bricht aus ihr hervor** (Tafel magic-awakening, türkise Druckwelle). Baris wird davongeschleudert, die Dunkelschatten fliehen. Lia bricht zusammen.
5. `finale` – Reihenfolge wie im Film. Lia erwacht bei Kyra und Flick (Tafel sisters-reunion): „Was ist passiert?“ – „Na, wie's aussieht, hast du sie in die Flucht geschlagen.“ – „Hab ich das? … Was genau hab ich denn gemacht?“ Schnitt: Baris schleppt sich zu den Ruinen. Vamir tritt aus schwarzem Rauch (Tafel master-rebuke) und zwingt ihn in die Knie: „Du hast versagt, Baris. Du hattest von Anfang an die Falsche.“ – „Ja, Meister.“ Zur Strafe **verwundet Vamir Baris schwer**: violette Magie brennt sich in eine Gesichtshälfte, Baris verliert ein Auge (Vorgabe des Nutzers, vgl. Film). – „Beim nächsten Mal bin ich nicht so nachsichtig.“ Ab jetzt trägt Baris die Narbe und eine Augenklappe bzw. ein vernarbtes, blindes Auge. Zurück zu den dreien: „Und was machen wir jetzt?“ – Flick: „Ich bringe euch zu den Rebellen. Die wissen bestimmt, was für eine Kraft in dir wohnt.“ Kyra ist begeistert („Das klingt nach Abenteuer!“), Lia seufzt („Oh nee, ich dachte, das war's.“). Lia weiß, wer diese Rebellen sind, und zögert: Foltan. Die drei gehen gemeinsam los. Crios am Himmel. Abspann im Buchstil: „Ende des ersten Buches“. Danach zurück zum Titel.

### 7.5 Sammelbares und Fortschritt
- **Erinnerungen** (ca. 12, versteckt): kleine Momente mit den Eltern und Kyra (Honig-Apfelkuchen, Lesestunden am Küchentisch, Vaters Marktfahrten, das Verbannungsfest, für das Lia „noch zu jung“ war), im Tagebuch als Buchseiten.
- **Wissen** (Lore): Urmacht, Xenovia und das Verbannungsfest, Rat der Zehn Geweihten, Dunkelhain, Nach Dunkelhain, Rat der Drei (Gerücht), Crios, Destar und Rega, Ebaril, Freie Bruderschaft und ihr Kodex, Lichterorden (Trapas), Dunkelschatten, Alana und Riccard.
- **Fähigkeiten** kommen aus der Geschichte: Spurenblick (Kapitel I, Lia beobachtet genau), Schleichen (Überfall), Ausweichen und Ablenken (Bruderschaft), Urmacht (Finale, unkontrolliert, nicht frei verfügbar).

## 8. Qualitätsmaßstab

- **Visuell prüfen:** Jeder Agent startet das Spiel (`npm run dev`) und kontrolliert seine Arbeit mit Playwright-Screenshots (Chromium ist installiert, `npx playwright` vorhanden). Er sieht sich die Bilder mit dem Read-Werkzeug an und verbessert, bis es wirklich gut aussieht. „Kompiliert“ ist kein Fertig-Kriterium.
- Keine Konsolenfehler. `npx tsc --noEmit` ohne Fehler im eigenen Bereich.
- Reine Logik (Regeln, Zustand, Pfadfindung, Kampfregeln) mit Vitest testen (`*.test.ts` neben dem Code).
- Text: kurz, lebendig, figurentypisch; keine Romanabsätze in Dialogboxen (max. ~140 Zeichen pro Box).
- Performance: 60 FPS auf einem normalen Laptop. Texturen werden einmal erzeugt und gecacht.

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
| Figur | Aussehen |
| --- | --- |
| **Lia** | schlank, lange rotblonde Locken (hinten hochgesteckt), weiße Bluse, brauner Rock; ab Kapitel 2 langer grüner Mantel, Lederbeutel, Holzschuhe → Lederschuhe |
| **Kyra** | Zwilling, lange nussbraune Haare offen, beiges knöchellanges Kleid, kleines Halsband |
| **Valentus** | grauhaarig, Bart, blau-weiße Robe, Stab; im Prolog Großmeister |
| **Mutter** | rötliche Locken, grüne Augen, rostfarbenes Kleid, Kopftuch/Schürze |
| **Vater** | kräftig, graumeliertes braunes Haar, braune Weste, helles Hemd |
| **Foltan** | braunes Haar, Ziegenbart, ledernes Barett, blau-gelber Waffenrock, Armbrust + Schwert |
| **Azar** | korpulent, kurzer schwarzer Bart, rote Haube, gelbes Gewand, Krummschwert; Schmied |
| **Craupor** | dürr, glatzköpfig, Schürze |
| **Elnon** | muskulöser Elf, lange schwarze Haare im Zopf, bestickte grüne Tunika, Axt |
| **Alastir** | Elf, langes Silberhaar, Brandnarbe halbseitig, braunes Cape, grüne Tunika |
| **Flick** | Elbin, kurzes rötlich-braunes Haar, spitze Ohren, cremefarbene Tunika, burgunderroter Schulterumhang, Bogen, Köcher mit rot-weißen Federn |
| **Orwen** | grauhaarig, dunkler Mantel, Goldbrosche, Schwert |
| **Baris** | riesig, kurzgeschorenes schwarzes Haar, Vollbart, schwere Rüstung |
| **Vardis** | kurzes dunkles Haar, schwarzes Gewand, spiegelnde Schulter-/Halsplatten |
| **Dunkelschatten** | schwarz-weiße Waffenröcke, Kettenhaube/Helm, Schwert, Speer, Armbrust, schwarz-weißer Rundschild |
| **Der Meister** | schwarze Kapuzengestalt, kein Gesicht, türkis-violettes Glimmen (verdorben) |
| **Falken aus Portas** | blau-gelb, Bögen; Paladine des Lichts: weiß-gold |

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
Draufsicht-Raster im selben Pixelstil wie die Welt (keine 3D-Pseudo-Iso).
- **Spielerphase / Gegnerphase.** Jede eigene Einheit: Bewegung + eine Aktion, in beliebiger Reihenfolge.
- **Telegrafierte Absichten (Kern-Idee):** Gegner zeigen *vor* ihrem Zug, was sie tun werden (rote Pfeile/markierte Zielfelder mit Schadenszahl). Der Spieler kann ausweichen, Gegner wegstoßen, blocken, ablenken. Dadurch werden Positionierung, Rücken und Wegstoßen sofort verständlich.
- **Flanken:** Treffer von der Seite +25 %, von hinten +50 %. Blickrichtung ergibt sich automatisch aus der letzten Bewegung oder Aktion; kein extra Richtungsmenü. Die Vorschau zeigt es klar an („Rücken! ×1,5“). Aus dem Playtest: Blickrichtung muss verständlich sein.
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

Freiheiten sind ausdrücklich erlaubt, solange der Kern bleibt. Die tragende **Verbindung** für einen schönen Bogen:

> Der Rat der Zehn zerbrach am Streit, **wer die Urmacht hüten darf**. Die Sechs wollten sie im Rat gebunden und geteilt bewahren. Die Vier wollten sie einem Einzelnen geben, „dem, der stark genug ist, sie zu führen“. Daraus folgte die Schlacht von Dunkelhain. Valentus, Hüter der Urmacht, rettet sie auf der Flucht in ein Kind auf einem Bauernhof. 14 Jahre später lässt der namenlose **Meister** (einer der beiden überlebenden Abtrünnigen) nach diesem Kind suchen. Orwens Trupp überfällt den Hof. Der Vater lügt, um Lia zu schützen, die nicht im Haus ist: „Wir haben nur eine Tochter.“ Die Dunkelschatten nehmen **Kyra** mit. **Sie haben die Falsche.** Der Spieler ahnt es durch das türkise Leitmotiv. Am Ende spricht es der Meister aus. Parallel sucht Baris im Auftrag des Meisters das **Geweih Regas** in einer Grotte. Deshalb ist Kyras Spur für die Freie Bruderschaft militärisch wichtig. Das erklärt Foltans Schweigen.

Vorlagen: Roman (`docs/novel-analysis.md`, Volltext `sources/novel/roman-selantis-2.txt`) bis Kapitel 6, danach Film 1 (`docs/episode-01.md`). Bekannte Namen: Lia, Kyra, Valentus, Foltan, Azar, Craupor, Elnon, Alastir, Flick, Orwen, Baris, Algard, „Mädchen“ (Spitzname), Vardis, der Meister; Orte: Selantis, Trapas (Westen), Portas (Osten), Ebaril, Dunkelhain, Goldener Eber; Mythen: Xenovia, die Zehn Götter, Aros, Crios (Stern/Adler), Destar, Rega (Hirsch), Alana und Riccard, Verbannungsfest.

Playtest-Feedback (Sebastian), das unbedingt gilt:
- Die Schlacht von Dunkelhain ist **real geschehen**, kein „Fiebertraum“. Chronologie: Rat → Schlacht → Flucht → Zuflucht.
- Der Ratskonflikt um die Urmacht muss klar werden.
- Der Axtkämpfer stirbt nicht. Er bleibt verwundet liegen.
- Kampfende: Pfeiltreffer, Valentus geht in die Knie, die Armee flieht im Hintergrund, langsames Abblenden. **Keine Verpixelungs-Übergänge.**
- Wald-Zusammenbruch → Schritte hörbar → Schwarz. Klar machen, dass ihn jemand mitnimmt. Kurze Erzählerpassagen zwischen Szenen.
- Keine harten Kanten zwischen Kartenteilen. Übergänge flüssig.
- Maussteuerung im Kampf muss funktionieren. Klickbarer „Zug beenden“-Knopf (Sanduhr).
- Interaktions-E groß und deutlich.
- Hofszene: Bei Lias Ankunft sind Eltern und Dunkelschatten **schon** da. Lia muss sich sofort verstecken. Kein freies Herumlaufen auf dem Hof vorher. Die Felder und die Wahl des Heimwegs gefallen.
- Musik unter den Prolog.

### Szenenliste (Szenen-IDs = `?scene=`)

**PROLOG – „Die Urmacht“** (Kapitel-ID `prolog`)
1. `prolog-rat` – Das Buch öffnet sich. Kurze Erzählung mit Tafeln (Urmacht, Rat). Danach **spielbar im Ratssaal** als Valentus: Zehn Sitze, die Meister streiten. Der Spieler hört die Positionen (Gespräche an den Sitzen, Auswahlantworten). Abstimmung, Bruch, ein Abtrünniger droht. Der Konflikt muss in 2–3 Minuten glasklar sein.
2. `prolog-schlacht` – **Taktik-Tutorial Dunkelhain.** Valentus (Strahl, Druckwelle, Schutzwall) + ein Falken-Bogenschütze gegen Dunkelschatten-Wellen. Ziel: den Rückzug der Verwundeten decken (Runden überstehen und/oder Feinde zurückschlagen). Lehrt Absichten, Flanken, Wegstoßen schrittweise. Der Axtkämpfer wird kampfunfähig, nicht getötet. Ende: Pfeil trifft Valentus, Knie, fliehende Armee, langsames Schwarz.
3. `prolog-flucht` – Nacht, Mondlicht, Regen setzt ein. Valentus flieht verwundet durch den Wald. **Verfolgungssequenz:** Hunde und Fackelträger mit Sichtkegeln, Valentus wird langsamer (Blutspur, schwankende Kamera). Verstecken im Unterholz, Bach durchqueren, um Hunde abzuschütteln. Durchgehend scrollende Karte ohne harte Kanten. Am Ende Zusammenbruch, Schritte, eine Laterne, Schwarz. Erzähler: „Jemand hob ihn auf.“
4. `prolog-zuflucht` – Kerzenlicht in einer Bauernstube. Valentus erwacht, ein Paar (die späteren Eltern) hat ihn versorgt. Kurzes Gespräch. Verfolger nahen (Hundegebell). Valentus schleppt sich zur Wiege mit **zwei Säuglingen**. Der Spieler hält die Taste, Valentus hebt die Hand, türkises Licht, Blitz. Valentus ist verschwunden. Schwarz: „Vierzehn Jahre später.“ Welches Kind? Bleibt offen (eine Spur Türkis bei einem der Kinder).

**KAPITEL I – „Der letzte Sommertag“** (`kapitel-1`)
1. `wiese` – Spätsommernachmittag. Lia liest unter einem Baum (Tafel). Kyra kommt wütend vom Holzsammeln, Geplänkel mit Auswahl. Lia verspricht, die Schweine zu füttern. Kurzes freies Erkunden (Wiese, Waldrand): optional einen **Vogel-Nestling zurück ins Nest** setzen (klettern), **Kornblumen für Mutter** pflücken (Auszahlung später am Grab), Äpfel. Lesbare Einführung in Bewegung, Interaktion und Tagebuch.
2. `heimweg` – Felder und Hohlweg. Der Spieler wählt den Heimweg. Es wird Abend, das Licht wird beim Näherkommen dramatisch dunkler. Unheilvolle Zeichen: verstummte Vögel, frische Hufspuren, ein umgestoßener Eimer, Rauchgeruch (Text).
3. `ueberfall` – Lia erreicht den Hofrand. **Die Dunkelschatten sind schon da.** Sofortiger Zwang zum Verstecken. **Schleichsequenz** entlang der Böschung und Hecke, um näher heranzukommen und zuzuhören, ohne von einem patrouillierenden Reiter entdeckt zu werden. Dann die Konfrontation (Tafeln der Raid-Serie + Dialog): Orwen verhört die Eltern, Vater: „Wir haben nur eine Tochter.“ Kyra wird aus dem Haus gezerrt, wehrt sich, beißt. Vater und Mutter werden getötet (nicht explizit, über Tafeln/Abblenden). **„Halte still“-Mechanik:** Lia will hinausstürmen; der Spieler muss die Taste halten, um sie zurückzuhalten (zitternder Balken, Herzschlag). Lässt er los, verrät ein Ast fast das Versteck. Der Beat wiederholt sich, kein Game Over. Die Reiter verschwinden mit Kyra nach Osten.
4. `trauer` – Nacht. Lia bei den Eltern (Trauerkarten in Buchschrift). **Steine tragen** für die Gräber, langsam, Grillen, Gedanken als Text. Jeder Stein bringt eine Erinnerung. Hat sie Kornblumen, legt sie sie aufs Grab. Morgen: Tafel Gräber. Im Haus: **Packen** (begrenzter Platz im Beutel; Wahl hat Folgen: Kräuterbuch → spätere Heiloption und Wissen; Zunder → Feuer leichter; Dolch → Fesseln schneiden; Alana-und-Riccard-Buch → Lesen am Lagerfeuer), Geheimfach des Vaters (Münzen, Familiendolch), Mutters Tinktur. Schweine freilassen (sie rennen davon). Aufbruch nach Osten den Hufspuren nach.

**KAPITEL II – „Die Straße nach Osten“** (`kapitel-2`)
1. `strasse` – Hauptstraße, Wegweiser Trapas/Portas. Der Spieler entscheidet mit Begründung (Osten, Hufspuren). Optionale Begegnungen: Gauklertruppe auf dem Weg zum Verbannungsfest (Geschichte von Xenovia, Kettengebäck), ein misstrauischer Händler. Abenddämmerung.
2. `erstes-lager` – Lagerplatz im Wald suchen, Steinkreis, Reisig, **Feuerbohren** (Timing-Minispiel; ohne Zunder schwerer; beim dritten Fehlversuch springt heimlich ein türkiser Funke über). Essen, Mantel ausbreiten, **Crios** am Himmel (kleiner Sternbild-Moment).
3. `foltan-azar` – Nachts Schritte. Missverständnis, Lia wird gefesselt. Dialog mit Auswahl (Lias trockener Humor). Foltan (Ex-Leutnant aus Portas) und Azar (Schmied aus Ignis), Freischärler. Lia erzählt. Sie nehmen sie mit.
4. `waldweg` – Morgens mit Gefährten (folgen, Barks). Lia besteht darauf, nicht wie ein Kind besprochen zu werden. Mittagsrast (Lia rettet Azars Stolz). Optional mit Kräuterbuch: Speikraut finden. Weiter zum Goldenen Eber.

**KAPITEL III – „Der Goldene Eber“** (`kapitel-3`)
1. `eber` – Taverne als Hub mit Räuberlied-Musik. Craupor, Spielleute, drei Zwerge (einer hat Kyra die Hilfe verweigert), Schankfrau, Reisende. **Hinweise sammeln und kombinieren** im Tagebuch: Kyras Haarband am Pfosten im Stall, Kratzspuren, die Aussage des beschämten Zwergs, das Gerede über „ein Mädchen für den Hauptmann“. Azar erzählt Foltans Desertion. Foltan kommt zurück: „Craupor weiß nichts.“ **Der Spieler weiß es besser.** Lia kann ihn darauf ansprechen, er weicht aus. Die Saat für den Verrat.
2. `leselager` – Lagerfeuer. Lia liest vor (Wahl je nach eingepackten Büchern: Kräuterlexikon oder Alana und Riccard). Gespräch über die Eltern. Lia verlangt ein Versprechen; Azar gibt es sofort, Foltan zögert und gibt es dann.
3. `kyra` – **Zwischenspiel: Kyra.** Kurz spielbar als Kyra im Lager von Baris am Weiher: angekettet, dann als „Dienstmädchen“ mit Tablett unterwegs. Schleichend lauscht sie Baris und Orwen: Karte, Grotte, **Geweih Regas**, der Meister, „das Mädchen ist für den Meister“. Kyra schwört, nicht aufzugeben. Zeigt Kyra als handelnde Figur.

**KAPITEL IV – „Die Freie Bruderschaft“** (`kapitel-4`)
1. `augenbinde` – Weg ins geheime Lager mit verbundenen Augen: dunkler Bildschirm, nur Geräusche und Azars Stimme (Stereo-Panning). Der Spieler folgt der Stimme. Kreativer Sinnesmoment.
2. `bruderschaft` – Lager als Hub (Palisade, Türme, Zelte, Schmiede): Elnon, Alastir, Menschen, Elfen, Zwerge. **Training an der Palisade:** Lia lernt *Ausweichen* und *Ablenken* (werden im Rettungskampf Fähigkeiten). Optionale Geschichten (Ebaril, Destar). Azar in der Schmiede.
3. `verrat` – Nachts schleicht Lia zu Elnons Zelt (Wachen, Schleichen) und belauscht: Foltan wusste vom Fünfertrupp mit der Gefangenen und dem Geweih und hat geschwiegen. Lia fühlt sich verraten und flieht in den Wald. Erzähler: Azar sucht sie vergeblich, Foltan schämt sich.

**KAPITEL V – „Regen“** (`kapitel-5`)
1. `regenwald` – Allein, Gewitterregen in der Nacht. Lia irrt. Urmacht-Andeutungen (der Regen weicht um sie zurück). Begegnung mit **Flick** (Tafel). Misstrauen, dann Hilfe. Flick ist Fährtenleserin und wurde von den Rebellen abgewiesen, weil sie eine Elbin ist.
2. `faehrte` – **Fährtenlesen mit Spurenblick:** Hufabdrücke, abgebrochene Zweige, Kyras absichtlich fallen gelassene Perlen vom Halsband. An Weggabelungen muss der Spieler richtig deuten; ein falscher Weg führt in eine Sackgasse und zurück. Sonnenuntergang, Nachtgespräch am kleinen Feuer (Bindung zu Flick).
3. `schattenlager` – Das Lager am Baum über den Feldern auskundschaften (Schleichen zu Aussichtspunkten). Kyra gefesselt am Baum. Vardis: „Ihr Leben ist mehr wert als eures.“ Plan: Lia lenkt ab, Flick befreit. **Bluff-Dialog** mit den Wachen („Ich will zum Markt …“, „Und was verkaufst du?“); Auswahl entscheidet, wie lange die Ablenkung hält.
4. `rettung` – **Taktikkampf:** Lia (Ausweichen, Ablenken, Stein werfen) + Flick (Bogen, Messer) gegen Wachen; Flick muss Kyra losschneiden. Danach Kyra zum Waldrand bringen. Vardis greift ein. Am Höhepunkt (Vardis bedroht Kyra/Lia) **Urmacht-Ausbruch** (Tafel magic-awakening, türkise Druckwelle, Vardis fliegt). Lia bricht zusammen.
5. `finale` – Ruinen: Vardis vor dem Meister (Tafel master-rebuke): **„Du hast die Falsche gebracht.“** Lia erwacht bei Kyra (Tafel sisters-reunion). Die drei gehen gemeinsam Richtung Rebellen. Crios am Himmel. Abspann im Buchstil: „Ende des ersten Buches“. Danach zurück zum Titel.

### Sammelbares und Fortschritt
- **Erinnerungen** (ca. 12, versteckt): kleine Momente mit den Eltern/Kyra, im Tagebuch als Buchseiten.
- **Wissen** (Lore): Urmacht, Rat der Zehn, Dunkelhain, Xenovia, Crios, Destar und Rega, Ebaril, Freie Bruderschaft, Dunkelschatten.
- **Fähigkeiten** kommen aus der Geschichte: Spurenblick (Kap. I, Lia beobachtet genau), Schleichen (Überfall), Ausweichen/Ablenken (Bruderschaft), Urmacht (Finale, unkontrolliert).

## 8. Qualitätsmaßstab

- **Visuell prüfen:** Jeder Agent startet das Spiel (`npm run dev`) und kontrolliert seine Arbeit mit Playwright-Screenshots (Chromium ist installiert, `npx playwright` vorhanden). Er sieht sich die Bilder mit dem Read-Werkzeug an und verbessert, bis es wirklich gut aussieht. „Kompiliert“ ist kein Fertig-Kriterium.
- Keine Konsolenfehler. `npx tsc --noEmit` ohne Fehler im eigenen Bereich.
- Reine Logik (Regeln, Zustand, Pfadfindung, Kampfregeln) mit Vitest testen (`*.test.ts` neben dem Code).
- Text: kurz, lebendig, figurentypisch; keine Romanabsätze in Dialogboxen (max. ~140 Zeichen pro Box).
- Performance: 60 FPS auf einem normalen Laptop. Texturen werden einmal erzeugt und gecacht.

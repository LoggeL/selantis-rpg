# Gewählte Pixelrichtung für das Selantis-RPG

Die gewählte Richtung C ist ein Pixel-Browserspiel mit freier Erkundung und rundenbasierten Rasterkämpfen. Der Nutzer hat die Pixel-Spielansicht ausgewählt und eine deutlich textärmere Oberfläche gewünscht. A und B bleiben historische Alternativen und ändern die festgelegte Pixelrichtung nicht.

Der Auftakt ist eine spielbare Schlacht mit dem übermächtigen Valentus. Danach folgen als Cutscene seine Verwundung, Flucht und Zuflucht sowie eine mehrdeutige Wiege. Ein Zeitsprung führt zu Lia und ihrem Anfang in der Romanreihenfolge. Anschließend kann der Spieler eine offene Welt erkunden, Lia entwickeln und einer festen Haupthandlung folgen. Optionale Begegnungen und Nebenquests geben der Welt eigene Geschichten und zusätzliche Möglichkeiten zur Entwicklung.

Die gemeinsame Grundstruktur bleibt bestehen. Der Roman "Roman Selantis 2.pdf" liefert die Grundlage für Lia und den Anfang ihrer Reise. Die drei Filme ergänzen die sichtbare Welt, den weiteren Handlungsbogen und die Darstellung einzelner Motive. Die Handlung folgt weiterhin dem Roman; für das Aussehen haben die geprüften Filmreferenzen ausdrücklich Vorrang. Spielsysteme, zusätzliche Wege und neue Nebenbegegnungen sind ausdrücklich Adaptionen.

## Browser als verbindliche Plattform

Das Ziel ist ein Browserspiel für den Desktop-PC. Tastatur und Maus sind die Arbeitsannahme für den ersten Prototyp. Eine mobile Steuerung, ein Gamepad und die Unterstützung konkreter Browsergeräte werden später separat geprüft. Es wird keine native Engine vorausgesetzt.

Für die gewählte Richtung C ist TypeScript oder JavaScript mit Phaser und Canvas2D vorgesehen. Die Alternative A verwendet ebenfalls Phaser mit 2D-Assets; für A kann der Browser einen WebGL-Renderer nutzen, während die Gestaltung aus 2D-Assets besteht. B verwendet leichtes Three.js mit WebGL, einfachen Materialien und wenig Shaderarbeit. Phaser bietet Canvas- und WebGL-Darstellung sowie Tilemaps einschließlich isometrischer Orientierung. Die offizielle Dokumentation beschreibt diese Grundlagen: [Phaser](https://docs.phaser.io/), [Tilemaps](https://docs.phaser.io/phaser-editor/scene-editor/game-objects/tilemap-object).

Die offene Welt wird in überschaubare Abschnitte aufgeteilt. Nur der aktuelle Abschnitt und benachbarte benötigte Assets liegen gleichzeitig bereit. Weiter entfernte NPCs bleiben als Weltzustand gespeichert, während nur nahe Figuren aktiv simuliert werden. So kann die Welt viele Begegnungen enthalten, ohne sie alle gleichzeitig auszuführen. Verbindungen, Rückwege, Weltzustand und Questflags bleiben erhalten, sodass das Laden eines Abschnitts keine lineare Missionsfolge vorgibt. Aufgaben, NPC-Dialoge und Folgen werden von Hand geschrieben und als strukturierte Daten hinterlegt.

Der Prototyp speichert Position, Level, Skillpunkte, Inventar und Questzustände lokal. Eine kleine serialisierte Sicherung kann in localStorage liegen; für mehrere strukturierte Spielstände ist IndexedDB vorgesehen. Versionierte Daten und eine Exportfunktion machen spätere Änderungen überprüfbar. Browser-Speicher ist keine geräteübergreifende Cloud-Sicherung. [MDN zu IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

Die folgende Budgettabelle ist eine Planung für einen kleinen ersten Ausschnitt, keine Messung und kein Leistungsversprechen. Ein Referenz-PC und konkrete Browser werden vor einem Build festgelegt. 60 FPS ist das Ziel für freie Erkundung; Auflösung und aktive Details müssen bei Bedarf sinken können. Die Bildentwürfe weisen keine erreichte Leistung nach.

| Planungsgröße | A: 2D-Isometrie | B: Low-Poly-3D | C: Pixel-2D |
| --- | --- | --- | --- |
| Interne Darstellung | Bis 1280 × 720, UI separat skalierbar | Zunächst 1280 × 720, Auflösung bei Bedarf reduzieren | 640 × 360, ganzzahlig auf größeren Bildschirmen skalieren |
| Erster benötigter Asset-Download | Ziel höchstens 20 MiB | Ziel höchstens 30 MiB | Ziel höchstens 10 MiB |
| Aktive Texturen | Ziel höchstens 64 MiB | Ziel höchstens 96 MiB | Ziel höchstens 32 MiB |
| Aktive Simulation | Lia und zunächst bis 12 nahe NPCs | Lia und zunächst bis 8 nahe NPCs | Lia und zunächst bis 12 nahe NPCs |
| Detailgrenze | Kleine Atlanten, vorgerenderte Lichtflächen | Ziel bis 50.000 sichtbare Dreiecke und 60 Draw Calls | 32-Pixel-Tiles, kleine Spriteatlanten |
| Licht und Effekte | In Assets eingemalt, einfache Farbüberlagerungen | Einfaches Umgebungs- und Richtungslicht, zunächst keine Echtzeitschatten | In Farbpalette und Tiles angelegt |

Texturziele beziehen sich nur auf den geplanten Texturspeicher, nicht auf die gesamte Browserbelegung. Downloadziele schließen später nachgeladene Weltregionen aus. Die Grenzwerte dienen dazu, den Umfang zu steuern; sie müssen im tatsächlichen Build gemessen werden. Für die 3D-Variante wird die Renderauflösung bewusst begrenzt, da mehr Pixel zusätzliche GPU-Arbeit verursachen. [Three.js zur Rendergröße](https://threejs.org/manual/pages/responsive.html).

## Wappen und Embleme

Alle Wappen, Bannerzeichen, Siegel und Embleme werden anhand der Filme geprüft. Originalform, Farben und Fraktionszuordnung bleiben erhalten. Ein glaubwürdig wirkendes neu erzeugtes Zeichen ist kein Quellenbeleg. Ohne sichtbaren Beleg verwendet das Design neutrale, unmarkierte Stoffe. Das gilt für Figurenkleidung, Banner, Schilde, Gebäude und UI-Symbole gleichermaßen.

Konkrete Filmframes und Zuordnungen werden in [Wappenreferenzen](heraldry-reference.md) festgehalten. Der goldene Baum auf Blau und rote Runen auf Schwarz aus dem Tutorialentwurf sind erfundene Bilddetails und werden nicht als kanonische Wappen übernommen. Vor der Verwendung eines Konzeptbilds werden solche Zeichen durch belegte Embleme oder unmarkierte Stoffe ersetzt.

## Gemeinsame Grundlage

Die Welt besteht aus frei verbundenen Regionen mit mehreren Wegen. In Roman und Filmen belegte Orte bilden die Anker. Weitere Verbindungspfade, optionale Begegnungen und Rückwege werden für das Spiel ergänzt und im Konzept als Ergänzungen geführt. Ein kompakter Prototyp zeigt nur einen Ausschnitt dieser Welt, aber bereits freie Bewegung und alternative Ziele.

Die Hauptstory hat feste Wendepunkte. Der Spieler entscheidet, wann er ihnen folgt, wie er einen Ort durchquert, welche Nebenfiguren er kennenlernt und worauf er Lia spezialisiert. Die Hauptquests allein müssen genug Erfahrung geben, um die Handlung zu bewältigen. Nebenquests bieten zusätzliche Erfahrung, Gegenstände, Beziehungen oder neue Wege. Sie sind keine versteckte Pflicht vor dem nächsten Storyschritt.

Die gemeinsame Spielschleife lautet: erkunden, eine Begegnung entdecken, eine Aufgabe oder einen Konflikt lösen, Erfahrung erhalten, bei einem Levelaufstieg einen Skillpunkt verteilen und neue Möglichkeiten in der Welt ausprobieren. Begegnungen können Gespräche, Rätsel, Gefahrensituationen oder Kämpfe sein.

### Lias Entwicklung

Ein vorgeschlagenes System verbindet normale RPG-Level mit verteilbaren Skillpunkten. Drei mögliche Bereiche sind Urmacht, Überleben und Begegnung. Die Namen und einzelnen Effekte sind Spielentwürfe. Fähigkeiten müssen mit dem belegten Verlauf ihrer Selbstentdeckung vereinbar sein; ein großes Arsenal zu Spielbeginn würde diesen Verlauf schwächen.

- Urmacht: ab ihrer belegten Entdeckung zunächst eine begrenzte, unkontrollierte oder vorsichtig eingesetzte Fähigkeit, später bessere Kontrolle und bewusst gewählte Wirkungen. Die konkrete Mechanik wird aus den belegten Szenen abgeleitet und erst im passenden Storyabschnitt zugänglich.
- Überleben: Bewegung, Ausdauer, Beobachtung und Umgang mit Gefahr. Verbesserungen geben mehr Handlungsmöglichkeiten auf Wegen und in Konflikten.
- Begegnung: zusätzliche Gesprächsmöglichkeiten, besseres Erkennen von Absichten und alternative Lösungen für einzelne Aufgaben.

Storyereignisse öffnen neue Skillbereiche. Der Spieler verteilt die Punkte innerhalb der geöffneten Bereiche selbst. Dadurch bleiben Lias Entdeckungen Teil der Handlung, während verschiedene Builds möglich sind. Die Entwicklung darf auch nach einer ungünstigen frühen Wahl funktionieren; eine erreichbare Möglichkeit zur Neuverteilung gehört ins Zielsystem.

Für den gemeinsamen technischen Entwurf und die konkrete Umsetzung siehe [RPG-Systeme](rpg-systems.md). Die stilabhängigen Vorschläge unten ändern die Grundanforderungen an Level, Skillpunkte und optionale Nebenquests nicht.

### Spielbarer Valentus-Auftakt, Romanbeginn und späterer Prototypausschnitt

Der neue Schlachtauftakt ist eine bewusste Spieladaption. Der Spieler steuert zunächst den übermächtigen Valentus und lernt auf dem taktischen Raster Bewegung, Aktion und eine starke Fähigkeit. Seine Prologfähigkeiten gehören nur zu diesem Abschnitt. Sie werden nicht auf Lia übertragen. Der Tutorialkampf soll mit wenigen aktiven Einheiten die Macht spürbar machen; eine größere Schlachtkulisse muss nicht vollständig simuliert werden.

Nach der spielbaren Schlacht übernimmt die Cutscene: Verwundung, Flucht, Zuflucht und die mehrdeutige Wiege. Kein Kind wird im Text oder durch Portrait, Namensschild oder Bildzuordnung als Lia identifiziert. Danach erfolgt ein klarer Zeitsprung. Der spielbare Lia-Abschnitt folgt dem Roman: Hof und Lesen, Kyra im Alltag, Heimweg, die ermordeten Eltern und Kyras Gefangennahme, Trauer und Vorbereitung, anschließend die Abreise nach Osten. Diese Folge ist ein eigener emotionaler Auftakt. Nach dem Elternmord wird der Hof nicht zu einem gemütlichen Nebenquest-Zentrum umgebaut.

Ein späterer Testausschnitt kann beim ersten Hub der Freien Bruderschaft ansetzen, der in der Romananalyse auf PDF-Seiten 77 bis 82 zugeordnet wird. Eine kurze Reisezusammenfassung stellt den Zusammenhang her. Die vorgeschlagenen 20 bis 30 Minuten sind der Umfang eines späteren Prototyps, nicht die Behauptung, den vollständigen Romananfang in diese Zeit zu pressen. Er soll freie Wege, eine Hauptaufgabe, optionale Begegnungen, Levelaufstieg, Skillwahl und Speichern zeigen. Noch ist die Aufgabe Konzeption; ein Build ist nicht hergestellt.

### Nebenfiguren und Aufgaben

Ein guter Neben-NPC hat ein eigenes Anliegen, eine erkennbare Eigenheit und eine Aufgabe, die zum Ort passt. Die Welt braucht unterschiedliche Begegnungen: kurze Gespräche ohne Quest, kleine Hilfen, mehrstufige Nebenstories und Personen, die nach einem späteren Storyereignis anders reagieren.

Neue NPCs erhalten eigene Namen und eine ausdrückliche Kennzeichnung als Spielergänzung in den Entwicklungsunterlagen. Keiner muss nur eine Erfahrungspunkt-Ausgabe sein. Ein entdeckter Weg, eine veränderte Beziehung oder eine kleine Ortsgeschichte kann ebenso eine Belohnung sein. Wo Gewalt keinen Sinn ergibt, wird eine Nebenquest über Beobachtung, Gespräch oder eine Handlung in der Welt gelöst.

### Verbindliche Stil- und Figurenbasis

Die unveränderte Stilbaseline ist [das vom Nutzer ausgewählte Pixelbild](/Users/logge/Documents/Projects/SelantisRPG/sources/reference/artstyle/user-pixel-baseline.png). Pixelgröße, Kanten, Farbklima, Vegetationsdarstellung und ruhige Oberfläche bleiben in diesem Stil. Filmnähe betrifft das Aussehen der Figuren; sie bedeutet keinen Wechsel zu Fotorealismus, einer anderen Pixeltechnik oder einer neuen Kamera.

Lia erhält den frühen Filmlook von Triss: hellbraunes bis dunkelblondes Haar mit seitlichen Flechtsträhnen, hinten gebunden; weiße bis cremeweiße geraffte Bluse mit weiten langen Ärmeln, langer beige- bis senfgelber Rock und dunkler geflochtener Gürtel. Keine roten Haare. Die frühe Referenz zeigt keine Rüstung und keinen Stab. Roman-Reisegepäck kann dezent als Verbindung beider Vorlagen ergänzt werden. Für einen Umhang ist der dunkle Filmlook eine Zusatzreferenz der passenden Reisephase, kein grüner Standardmantel. Belege und Storygrenzen: [Filmnahe Figurenreferenz](character-film-reference.md).

Valentus erhält im Tutorial den deutlich erkennbaren Folge-3-Look: lange dunkle Haare mit Mittelscheitel, schmales erwachsenes Gesicht, kleiner Kinnbart und nach der neuesten Nutzervorgabe eine satte blaue Robe mit breiten beziehungsweise schmaleren hellen Längspartien. Die ausdrücklich gewählte blaue Produktionsfarbe hat Vorrang vor der zuvor vorsichtig als dunkel beschriebenen Filmfarbe. Der lebende Valentus ist blickdicht; das dauerhafte türkisfarbene Geistleuchten wird nicht auf den Prolog zurückdatiert. Die Übernahme dieses späteren Filmlooks in die historische Tutorialschlacht ist eine visuelle Adaption. Belege: [Valentus-Filmlook](valentus-film-look.md).

Die ruhige Lia-Erkundungsansicht zeigt Waldweg, Wiese und kleine bewachsene Ruine aus rötlichem und grauem Stein. Die Anordnung der Wege ist ein Spielentwurf. Die Film-Kontaktbögen liefern die Landschaftsbasis, keine exakte Spielgeografie. Lia zeigt am Anfang ihres Romanabschnitts weiterhin keine beherrschte Magie.

Die neueste ausdrückliche Nutzerentscheidung "nimm das alte banner" hat Vorrang vor der zuvor festgelegten Prolog-Bannerauswahl. Im aktuellen Tutorialbild steht wieder das weiße Banner mit dem einfachen blauen Vogel-/Flügelmotiv aus Folge 3. Die Verwendung in der früheren Tutorialschlacht ist eine bewusste Adaption auf Nutzerwunsch. Die Prologbanner aus Folge 1 bleiben Quellenbelege, sind aber keine aktuelle verbindliche Bildvorgabe. Tierart, offizieller Wappenname und Stadtzuordnung bleiben offen. Die dunklen Truppen folgen weiterhin dem Prologlook bei 00:30 mit Stoff, Kapuzen, Kettenhauben oder Nasalhelmen, statt einer Gruppe von Magiern oder vollständiger Plattenrüstung. Andere unbelegte Stoffe bleiben unmarkiert. Belege: [Wappenreferenzen](heraldry-reference.md).

## Gewählte Richtung und dokumentierte Alternativen

| Richtung | Grafik und Kamera | Schwerpunkt beim Spielen | Größter Produktionsaufwand |
| --- | --- | --- | --- |
| A: Gemalte Isometrie | Illustrative 2D-Tilewelt, erhöhte schräge Kamera, klare Silhouetten | Frei erkunden, direkt handeln, Gespräche, flexibel eingesetzte Fähigkeiten | Zusammenhängende Umgebungen und Spriteanimationen |
| B: Stilisiertes Third Person | Leichte Low-Poly-3D-Welt, Kamera hinter Lia, einfache Materialien | Räume selbst erleben, Wege finden, Bewegung und direkte Kämpfe | Modelle, Animationen, Kamera und 3D-Weltbau |
| C: Pixelwelt mit Taktik, gewählt | Kompakte Pixelgrafik, feste Draufsicht, lesbare Wege | Erkunden, Ressourcen planen, rundenbasierte Konflikte | Pixelanimationen, Kartendesign und Begegnungsbalance |

## Historische Alternative A: Gemalte Isometrie

### Grafik, Kamera und UI

Eine erhöhte schräge Kamera gibt Orientierung und zeigt mehrere Wege zugleich. Zusammenhängende Landschaften werden aus wiederverwendbaren 2D-Bodentiles, illustrativen Objekt-Sprites und wenigen Tiefenebenen gebaut. Kleine Variationen verhindern sichtbare Wiederholungen, ohne jeden Meter als großes Einzelbild zu malen. Lia bleibt als bewegliche Figur gut sichtbar. Bäume oder Ruinenwände werden transparent, wenn sie die Spielfigur verdecken.

Die Farben übernehmen das Grün der Laubwälder, das Ocker der Wiesen und den roten Stein der Ruine. Licht und gemalte Texturen schaffen Atmosphäre, während Laufwege und relevante Gegenstände klare Konturen erhalten. Historische Roman-Kostümentwürfe in dieser Alternative sind durch den Filmlook der gewählten Richtung überholt. Die erste Ansicht zeigt Welt und Bewegung; die Kamera ist nicht auf ein einzelnes Gespräch beschränkt.

Die Oberfläche zeigt eine kleine Lebens- oder Zustandsanzeige, wenige aktive Fähigkeitsslots und ein unaufdringliches aktuelles Ziel. Karte, Journal und Skillbaum öffnen sich bei Bedarf. Gespräche erscheinen in einem ruhigen Panel. NPCs dürfen entdeckt werden, ohne dass jeder sofort ein großes Questzeichen trägt.

### Browserstack und Assetproduktion

Phaser verwaltet Szenen, Kamera, Eingaben, Tilemaps und Spriteanimationen. Eine logische Karte führt Wege und Kollisionen; die isometrische Darstellung projiziert diese Daten für das Bild. Tiefe wird durch Sortieren der Objekt-Sprites erzeugt. Ein eigener großer 3D-Unterbau ist dafür nicht nötig.

Die erste Assetliste besteht aus einem kleinen Bodentileset, modularen Bäumen und Ruinenstücken, Lia in vier Bewegungsrichtungen mit kurzen Gehzyklen, wenigen NPC-Sprites und einer einfachen UI. Größere Atlasbilder bleiben zunächst bei höchstens 2048 × 2048 Pixeln. Illustration und Schatten werden vorab in die Assets gezeichnet. Kein fotografisches Laub, dynamisches Gras oder volumetrisches Licht. Die Karte wird aus diesen Teilen gebaut und separat mit Kollision und Interaktionspunkten versehen.

### Spielstil

Lia bewegt sich direkt durch die Welt. Gespräche, Gegenstände und Umgebungsaktionen nutzen eine kontextbezogene Interaktion. In Konflikten zählen Abstand, Position, das Erkennen einer Gefahr und der passende Einsatz weniger Fähigkeiten. Kampf, Ausweichen oder ein alternativer Weg können je nach Begegnung möglich sein.

Der Spieler entwickelt einen kleinen Satz aktiver Fähigkeiten und passende passive Verbesserungen. Die Urmacht erhält nach ihrer Entdeckung eine erkennbare Grenze, damit sie nicht jeden Konflikt sofort beendet. Vorher arbeitet Lias Anfangsregion mit Bewegung, Beobachtung und Begegnungen. Valentus besitzt im getrennten Prolog eigene Fähigkeiten. Der genaue Kosten- und Erholungseffekt ist eine Spielentscheidung und wird aus der Quelle begründet.

### Stärken und Kosten

A verbindet offene Erkundung mit klarer Darstellung und eignet sich gut für einen ersten Browserprototyp. Gespräche und filmische Wendepunkte lassen sich in derselben Welt inszenieren. Die Umgebung braucht dennoch zusammenpassende Ansichten, gute Kollisionen und Animationen. Eine Konzeptgrafik ersetzt diese Assets nicht.

Der spätere Hub-Prototyp sollte eine frei begehbare Region mit mehreren Abzweigungen, zwei voneinander unabhängigen Nebenbegegnungen, einer Hauptquest, einem einfachen Konflikt und einem Levelaufstieg zeigen. Dieser kleine Ausschnitt prüft die Zielstruktur. Er ist noch keine Umsetzung der gesamten Trilogie oder einer vollständigen offenen Welt.

## Historische Alternative B: Stilisiertes Third Person

### Grafik, Kamera und UI

Die Kamera hinter Lia lässt den Spieler Orte aus ihrer Nähe erleben. Die 3D-Welt verwendet bewusst sichtbare Low-Poly-Formen, Farbflächen, wenige gemeinsame Materialien und einfache Beleuchtung. Bäume bestehen aus stilisierten Kronen und Stämmen; die Szene braucht keine realistische Darstellung einzelner Blätter, Haare oder Stofffasern. Die Grafik darf vereinfacht sein, ohne Figuren in Spielzeugproportionen umzuwandeln. Kostüm und Landschaft folgen denselben Referenzen wie A.

Waldwege, Lichtungen und Ruinen verbinden sich über sichtbare Landmarken. Eine gute Kamera zeigt genug vom Weg, reagiert auf Mauern und Bäume und wechselt für Gespräche in eine ruhigere Einstellung. Das HUD hält Ziele und wenige aktive Fähigkeiten sichtbar; häufige lange Informationsfelder würden die räumliche Orientierung stören.

### Browserstack und Assetproduktion

Three.js stellt die kleine WebGL-Szene dar. Die Kamera und einfache Kollisionskörper werden ausdrücklich für diesen Spielstil gebaut. glTF-Modelle tragen die wenigen nötigen Animationen; gemeinsame Texturen und wiederverwendbare Modelle halten die Assetmenge begrenzt. Die Welt lädt benachbarte Abschnitte statt eine vollständige Landschaft auf einmal.

Lia beginnt als einfaches Modell mit geplant höchstens etwa 3.000 Dreiecken und wenigen Animationen für Stehen, Gehen und Interaktion. Mantel und Haare sind modellierte Formen, keine laufende Stoff- oder Haarsimulation. Der erste Ort verwendet modulare Ruinenteile, vereinfachte Baumtypen, Boden und wenige Props. Schatten können in Texturen oder Bodenflächen vorab angelegt sein. Postprocessing, teure Mehrfachmaterialien und dichte Vegetation gehören nicht in den Einstieg.

### Spielstil

Der Spieler steuert Lia direkt, erkundet Abzweigungen und kann auf räumliche Hinweise reagieren. Begegnungen verbinden Position, Ausweichen und einen begrenzten Satz aktiver Fähigkeiten. Ein Fokus- oder Zielsystem erleichtert die Auswahl in Konflikten. Gespräche und Beobachtung bleiben alternative Wege, wenn die jeweilige Aufgabe sie erlaubt.

Die Skillverteilung verändert die Art des Spielens sichtbar: bessere Kontrolle der Urmacht, höhere Beweglichkeit oder mehr Lösungswege in Begegnungen. Ausrüstungswechsel sind nur dann zentral, wenn der Filmverlauf und die geplante Adaption dafür eine Grundlage geben. Eine generische Beuteflut würde Lias persönliche Entwicklung in den Hintergrund schieben.

### Stärken und Kosten

B gibt der offenen Welt die größte räumliche Präsenz. Spieler können Blickrichtung und Annäherung selbst wählen. Das verlangt bereits im ersten Ausschnitt funktionierende Modelle, Rigging, Animationen, Kamerakollisionen und Umgebungsgeometrie. Ein schönes Standbild sagt wenig darüber aus, ob sich die Bewegung gut anfühlt.

Der spätere Hub-Prototyp braucht eine begrenzte offene Region mit mehreren Wegen. Bewegung und Kamera müssen vor einer größeren Welt bestätigt werden. Erst dann folgen zusätzliche Regionen, komplexe Kämpfe und mehr Begegnungen.

## C: Gewählte Pixelwelt mit Taktik

### Grafik, Kamera und UI

Ein orthogonales Raster mit 32 × 32 Pixel großen Feldern zeigt Wege, Personen und Hindernisse. Die Pixelkunst wird schräg von oben gezeichnet; die Spiellogik bleibt auf quadratischen Feldern. Exploration und Kampf verwenden dieselbe Projektion. Die Figuren werden nach der Fußposition auf der Y-Achse sortiert. Der Assetplan schlägt Ebenen 0 bis 2 mit jeweils 8 Pixeln visueller Anhebung vor; Weg- und Kollisionsdaten werden separat geführt. Konsistente Pixelgröße, klare Farbgruppen und sparsame Details machen die Welt auch auf kleineren Bildschirmen lesbar. Lias helle Bluse, warmer beige-senfgelber Rock und seitlich geflochtenes, gebundenes Haar geben dem kleinen Sprite die filmnahe Silhouette. Gesprächsporträts können Mimik und Kleidung genauer zeigen.

Die Regionen bestehen aus verbundenen Karten mit mehreren Ausgängen. Übergänge dürfen die freie Welt nicht wie eine zwingende lineare Raumfolge wirken lassen. Die schräg von oben gezeichnete Pixelkunst macht Wege und kleine Geländestufen sichtbar, ohne eine isometrische Rautenprojektion einzuführen.

Das dauerhaft sichtbare HUD bleibt klein: das aktive Portrait mit "LIA" im Lia-Abschnitt beziehungsweise "VALENTUS" im Tutorial, Lebens- und Erfahrungsbalken, wenige Aktionssymbole mit den Tasten E/Q/R, drei Menüsymbole mit M/J/K und ein kleiner Kompass. Lange Aktionsnamen, Leveltexte, Zahlenzähler, Regionsschilder und große Questkästen entfallen in der normalen Erkundungsansicht. Die konkreten Tastenbelegungen werden bei einer Umsetzung festgelegt; die Buchstaben im Bild sind Platzhalter für eine sparsame Bedienung.

Questtexte, Skillbeschreibungen, Kosten und Folgen erscheinen erst beim Öffnen eines Menüs, in einem Gespräch oder als kurze Hilfe auf Nachfrage. Auch die Kampfoberfläche verwendet wenige Symbole. Eine Auswahl kann eine kurze Vorschau öffnen; die ganze Szene muss nicht ständig mit Beschriftungen gefüllt sein. Erreichbare Felder, gewähltes Ziel und aktuell aktive Figur bekommen klare visuelle Markierungen.

### Browserstack und Assetproduktion

Phaser mit Canvas2D stellt die Karte aus Tiles und Sprites dar. Eine feste logische Auflösung sorgt für konsistente Pixelgrößen; die Oberfläche wird lesbar skaliert. Kartenabschnitte nutzen einfache Kollisionsdaten. Die taktische Bewegung wird auf einem begrenzten Begegnungsraster berechnet, während die Welt außerhalb von Konflikten frei begehbar bleibt.

Das erste Tileset nutzt 32 × 32 Pixel. Lia kann zunächst mit etwa 32 × 48 Pixeln und vier Geh-Richtungen entstehen. Jeder Gehzyklus erhält nur die nötigen wenigen Frames. Bäume, Ruinen, Boden und Gegenstände werden als wiederverwendbare Pixelelemente produziert. Einheitliche Palette und klarer Schattenwurf sind wichtiger als hohe Detailzahl. Ein kleines Lia-Portrait gehört zum gewählten HUD. Größere Gesprächsportraits sind zusätzliche Assets und können später folgen.

### Spielstil

Außerhalb von Konflikten bewegt sich Lia in Echtzeit frei durch die offene Welt. Gespräche, Erkundung und optionale Aufgaben lösen keine Runden aus. Eine klar erkennbare Begegnung wechselt in einen örtlich begrenzten, rundenbasierten Kampf auf einem Raster. Nach dem Kampf setzt die freie Erkundung am selben Ort fort.

Der Nutzer nennt Final Fantasy Tactics Advance als Orientierung für das Gefühl der Kämpfe. Der Entwurf übernimmt daraus keine ungeprüften Detailregeln, Klassen oder Inhalte. Verbindlich für diesen Spielentwurf sind Planung auf Feldern, Höhen und Gelände sowie die Wahl von Bewegung, Aktion und Fähigkeiten.

Eine Einheit bekommt pro Zug eine begrenzte Bewegung und eine Aktion. Erreichbare Felder erscheinen nur beim Planen der Bewegung. Fähigkeiten zeigen Reichweite und gültige Ziele erst nach Auswahl. Höhenstufen, Engstellen, Deckung durch Gelände und klare Sichtlinien schaffen unterschiedliche Möglichkeiten. Ein kleiner Höhenunterschied soll verständlich sein; jede Ebene braucht einen lesbaren Übergang und darf nicht bloß Dekoration sein.

Der Tutorialkampf und die erste Lia-Begegnung bleiben technisch klein: geplant höchstens ein Raster von 12 × 12 Feldern und insgesamt sechs aktive Einheiten. Eine Gegnerentscheidung wird nur im jeweiligen Zug berechnet. Diese Größen sind Startbudgets für eine spätere Umsetzung, keine gemessenen Grenzen. Zugreihenfolge, Trefferregeln und genaue Bewegungskosten werden im Kampfsystem geprüft.

Lia bleibt die Hauptfigur. Ein kleines Team aus vorübergehenden, zur Szene passenden Verbündeten ist eine mögliche spätere Ergänzung. Es ist keine verpflichtende Entscheidung des Nutzers und kein Beleg für eine kanonische Gruppe. Der erste Test kann mit Lia allein oder einem begründeten Begleiter arbeiten. Ihre Skillverteilung öffnet neue Aktionen, passive Verbesserungen und alternative Begegnungslösungen. Gelände und Beobachtung sind ebenso wichtig wie höhere Werte. Ein unnötiger Konflikt kann je nach Aufgabe umgangen oder anders gelöst werden.

### Stärken und Kosten

C macht die offene Erkundung und normale RPG-Entwicklung übersichtlich. Neue Karten und NPC-Geschichten lassen sich mit einer konsistenten Assetbasis erweitern. Gute Pixelgrafik und Animationen bleiben eigene Arbeit. Taktische Begegnungen verlangen außerdem sorgfältige Regeln, damit ein Levelaufstieg die Entscheidungen erweitert und sie nicht überflüssig macht.

Der spätere Hub-Prototyp zeigt eine Karte mit mehreren Wegen, zwei optionalen Begegnungen, einer Hauptquest, einen Levelaufstieg und eine kurze taktische Situation. Die freie Erkundung muss auch ohne Kampf angenehm funktionieren.

## Aktuelle Entscheidung

C ist die gewählte Richtung: Pixelgrafik im Desktop-Browser, freie Erkundung in Echtzeit und rundenbasierte Rasterkämpfe mit Bewegung, Aktionen, Fähigkeiten und verständlichen Höhenstufen. Das normale Level- und Skillsystem, die feste Hauptstory und die freiwilligen Nebenquests bleiben Bestandteil des Konzepts.

Die nächste technische Planung richtet sich auf Phaser, kleine Tilemaps, Spriteanimationen, von Hand geschriebene Begegnungen und lokale Spielstände. A und B sind keine aktuelle Umsetzungsempfehlung. Das aktuelle Tutorial-Kampfkonzept zeigt Valentus im spielbaren Schlachtauftakt und ist als Spieladaption gekennzeichnet. Ein späteres Lia-Kampfkonzept bleibt optional. Lia besitzt in ihrem Romananfang noch keine kontrollierten Kräfte; die Wiege identifiziert kein Kind als Lia.

## Konzeptbilder und noch offene Produktion

Das aktuelle Stilziel bleibt [C: filmnahe Pixelwelt](/Users/logge/Documents/Projects/SelantisRPG/output/imagegen/lia-pixel-film-look.png). Der getrennte Tutorialkampf ist [filmnaher Valentus-Schlachtauftakt](/Users/logge/Documents/Projects/SelantisRPG/output/imagegen/tutorial-valentus-battle-film-look.png). [A: illustrative Isometrie](/Users/logge/Documents/Projects/SelantisRPG/output/imagegen/lia-isometric-v2.png) und [B: Low Poly](/Users/logge/Documents/Projects/SelantisRPG/output/imagegen/lia-third-person-v2.png) bleiben historische, nicht verbindliche Stilkonzepte.

Diese Bilder sind Stilkonzepte. Sie sind keine fertigen Tilesets, Spriteatlanten, 3D-Modelle oder Kamerasysteme. Für die Umsetzung fehlen weiterhin Produktionsassets, Animationen, Kollisionsdaten, echte UI, Audio, geschriebene Quests, Speicherung und ein gemessener Browserbuild. Die nächste Umsetzung beginnt mit diesen getrennten Bausteinen und dem kleinen Hub-Ausschnitt.

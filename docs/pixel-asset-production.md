# Produktionsplan für Pixelassets

Status: Produktionsvorschlag vom 3. Oktober 2026. Die genannten Atlanten, Animationen und Karten müssen noch hergestellt werden. Die feste, visuell geprüfte Artstylebaseline ist [user-pixel-baseline.png](../sources/reference/artstyle/user-pixel-baseline.png): ruhige Waldpalette, klare Pixelgruppen, lesbare Wege und kleine UI. Figurenlook und Wappen werden anhand der geprüften Filmreferenzen korrigiert; das goldene Baumzeichen der Baseline ist kein belegtes Filmwappen. Die Konzepte [Lia mit Filmlook](../output/imagegen/lia-pixel-film-look.png) und [Valentus-Tutorial mit Filmlook](../output/imagegen/tutorial-valentus-battle-film-look.png) sind Folgeentwürfe. Referenzbilder enthalten keine freigestellten, nahtlos wiederholbaren Tiles und keine Animationsframes. Die maschinenlesbare Bestellliste steht in [asset-manifest.json](../design/asset-manifest.json).

Die neue ausdrückliche Nutzervorgabe setzt filmnahe Gesichter, Haare und Kleidung als Bildpriorität über den früheren Romanlook. Der Roman behält bis zu seinem Manuskriptende Vorrang für Handlung, Fähigkeiten und Ereignisfolge. Fotobefunde und Zuordnungsgrenzen stehen in [character-film-reference.md](character-film-reference.md), [valentus-film-look.md](valentus-film-look.md) und [heraldry-reference.md](heraldry-reference.md).

## Format und Kamera

Arbeitsformat: 640 × 360 logische Pixel, 32 × 32 Pixel pro Bodenfeld, ganzzahlige Vergrößerung mit scharfen Pixelkanten. Für kleinere Fenster darf die Oberfläche neu angeordnet werden; Karten werden nicht dauerhaft zu einem unscharfen Vollbild gestreckt. Die dunklen Umrisse, gedämpften Waldgrüns, Erdbrauntöne und rötlich-grauen Steine des Referenzbildes bilden die Palette. Eine feste Palette wird erst mit einem kleinen handbereinigten Mustertileset beschlossen.

Erkundung und Kampf benutzen dieselbe orthogonale Karte und dieselbe feste, erhöhte Draufsicht. Objekte zeigen ihre Vorderseite, der Boden bleibt quadratisch. Freie Erkundung bewegt Figuren kontinuierlich; im Kampf liegt das taktische Raster über demselben Boden. Inspiriert von Final Fantasy Tactics Advance sind Zugfolge, Positionierung und getrennte Kampfzustände. Eine isometrische Kamera ist dafür nicht Voraussetzung. Eine zusätzliche isometrische Ansicht würde andere Bodentiles, Objektansichten und Bewegungsrichtungen erfordern. Sie wird für den ersten Produktionssatz nicht vorgesehen.

Ein Kartenpunkt `(u, v)` liegt bei `(32u, 32v)` Weltpixeln. Zellenzentren sind `(32u + 16, 32v + 16)`. Dieselbe Umrechnung gilt in beiden Spielzuständen. Geplante Geländeebenen `0..2` verschieben die gezeichnete Fußposition um `8 × Ebene` Pixel nach oben; Kollision, Wegkosten und Höhenwert bleiben eigene Kartendaten. Kameraschwenk und kleine Überblendung führen in den Kampf, anschließend erscheinen Raster und Zugleiste. Nach dem Kampf kommt die Figur an eine definierte freie Position zurück. Ein anderer Kamerawinkel oder ein zweiter Satz Figurensprites ist nicht nötig.

## Figuren und Animationen

Normale Figuren erhalten transparente 32 × 48 Pixel große Frames. Lias sichtbare Körperhöhe liegt als Arbeitsmaß bei 34 Pixeln, die erwachsenen Figuren bei etwa 38 bis 42. Das ist eine grafische Größenentscheidung, keine aus dem Roman abgeleitete Körpergröße. Größere Gesten dürfen eigene 48 × 64 Frames verwenden. In jedem Frame liegt der Fußanker an einer festgelegten Pixelposition: bei Standardframes `(16, 44)`. Exportierte trim-Daten müssen diesen Anker wiederherstellen.

Vier Richtungen werden ausdrücklich gezeichnet: `south`, `west`, `east`, `north`. Diagonales Gehen wählt die dominante Bewegungsachse für die Blickrichtung. Mantel, Scheide und Waffenhand bleiben konsistent; spiegelbare Frames werden erst nach Prüfung einzeln markiert. Ein komplettes Blatt wird nicht automatisch gespiegelt.

| Zustand | Geplanter Umfang | Einsatz |
| --- | --- | --- |
| `idle` | 2 Frames je Richtung, 2 FPS | Atmen, ruhige Haltung |
| `walk` | 4 Frames je Richtung, 8 FPS | Kontinuierliche Bewegung und Zugbewegung |
| `interact` | 2 Frames je Richtung, einmalig | Ansprechen, Aufnehmen, Zeigen |
| `hurt` | 2 Frames je Richtung, einmalig | Kurze sichtbare Reaktion |
| `cast` | Valentus: 4 Frames je Richtung, einmalig | Strahl und Druckwelle im Tutorial |
| `wounded_walk`, `collapse` | Valentus: 4 je Richtung beziehungsweise 4 in Szenenrichtung | Geskriptete Verwundung und Flucht |
| `read` | Lia: 3 Frames in einer festgelegten Ansicht | Romananfang am Hof |
| `attack`, `guard` | Nur benötigte Kampfrollen: 4 beziehungsweise 2 je Richtung | Drei Gegnerrollen; Foltan erst im Hubpaket |

Animationsnamen folgen `actor.<id>.<state>.<direction>`, Frames `actor/<id>/<state>/<direction>/<index>`. Ein `cast`-Zustand für Lia gehört nicht zum Anfang. Ein geübter Dolchangriff wird erst nach einem geschriebenen Lernschritt bestellt. Ein Zustand fehlt lieber sichtbar in der Produktionsliste, als dass eine Standpose als fertige Animation gilt.

Lias Gesicht wird zuerst aus [Folge 1, 12:22](../sources/frames/characters-film/lia-face-ep01-12m22s.jpg) abgeleitet. Hellbraunes bis dunkelblondes Haar mit seitlichen Flechtsträhnen führt nach hinten; dazu kommen weiße geraffte Bluse mit weiten Ärmeln, langer beige- bis senfgelber Rock und dunkler geflochtener Gürtel. Kleine Sprites bewahren die Silhouette, Porträts die feineren Gesichts- und Haarmerkmale. Der spätere dunkle Filmumhang kann als getrennte Wettervariante entstehen, wird nicht als zwangsläufige frühe Ausrüstung behauptet. Reisegepäck, Familientolch sowie Hof- und Reiseschuhe können aus dem Roman ergänzt werden; diese Verbindung der Vorlagen bleibt als Adaption kenntlich.

Valentus erhält den deutlich geprüften Folge-3-Look: langes dunkelbraunes bis fast schwarzes Haar mit Mittelscheitel, schmales erwachsenes Gesicht, kleiner Kinnbart, blaue weite Robe mit hellen Längspartien, Gürtel und hellem rundlichem Halsbesatz. Das Blau ist die ausdrückliche letzte Nutzervorgabe; die Filmaufnahme allein legt unter dem Türkislicht keinen sicheren dunklen Farbton fest. Gesicht: [00:58](../sources/frames/valentus-film/film03-valentus-0058.jpg), Gewand: [00:38](../sources/frames/valentus-film/film03-valentus-0038.jpg). Der lebende Tutorial-Valentus ist blickdicht, ohne dauerhaftes türkisfarbenes Geistleuchten. Die Übernahme dieses späteren Filmlooks in die Schlacht ist eine visuelle Adaption.

Für Foltan und Azar fehlt ein sicher zugeordneter Filmbeleg. Ihre Romanmerkmale bleiben daher die Arbeitsreferenz: Foltan mit braunem Haar, Ziegenbart, Lederbarett, blau-gelbem Waffenrock, Armbrust und Schwert; Azar korpulent, mit kurzem schwarzem Bart, roter Haube, gelbem Gewand und gekrümmtem Schwert. Filmnähe betrifft hier Stoffwirkung und zurückhaltende Farben. Azars handwerkliche Rolle braucht eine Arbeitsgeste, keine unbelegte Überlegenheit im Kampf. Die Handlung und Ergänzungen bleiben in der [Romananalyse](novel-analysis.md), PDF-Seiten 1 bis 6, 8 bis 12, 19 bis 20 und 25 bis 31 verankert.

## Zwei lieferbare Pakete

Das Eröffnungspaket beginnt mit einer kleinen spielbaren Schlacht mit Valentus. Das Tutorial lehrt Bewegung, Zielwahl, Strahl und Druckwelle. Danach folgen geskriptete Verwundung, kurze Flucht, Zuflucht mit Wiege und der Übergang zu Lia beim Lesen. Diese Spielreihenfolge ist die Adaption des Romanprologs, der die Schlacht als Fiebertraum zeigt. Ein Erfolg im Tutorial beseitigt die folgende Verwundung nicht; die Sequenz ist im Szenenablauf festgelegt. Eine vorgeschlagene Arena von 24 × 18 Feldern enthält ein taktisch begehbares Gebiet von höchstens 14 × 10 Feldern. Das große Heer bleibt im Hintergrund als wenige getrennte Silhouettengruppen. Es wird nicht mit Hunderten aktiven Figuren simuliert.

Benötigt werden Valentus, drei menschliche Dunkelschatten-Rollen (Nahkämpfer, Speerträger, Schildträger), wenige alliierte Soldaten, Wald-/Erdboden, Hangkante, Steine, Bäume, Banner und einfache Zufluchtmöbel. Die Rollen sind spielerische Varianten der belegten schwarzen Kämpfer, keine im Roman benannten Klassen. Für die Tutorialbanner gilt die letzte ausdrückliche Nutzerwahl: das frühere weiße Banner mit einfachem blauem Vogel-/Flügelzeichen aus Folge 3. Diese Wahl hat Vorrang vor den radialen beziehungsweise geviertelten Prologbannern aus Folge 1. Die Bildform folgt [heraldry-reference.md](heraldry-reference.md) und dem [Folge-3-Bannerdetail](../sources/frames/heraldry/film03-40-45-banner-detail.jpg). Die Übernahme in die frühere Tutorialschlacht ist eine bewusst gewählte visuelle Adaption; eine genaue Tierart, ein offizieller Wappenname oder eine Stadtzugehörigkeit wird nicht erfunden. Die dunklen Fronttruppen orientieren sich an [Folge 1, 00:30](../sources/frames/key-01-scan-opening-0030.jpg): Stoff, Kapuze, Kettenhaube und Nasalhelm, gewöhnliche bewaffnete Menschen. Vier anonyme Frontfiguren sind keine vier benannten Magier und erhalten keine geschlossene Vollplattenrüstung. Kein goldener Baum und keine erfundenen roten Runen. Strahl, Druckwelle, Wundreaktion und Wiegenlicht werden separat animiert. Die Wiege zeigt zwei Säuglinge. Das Licht verrät weder eine gesicherte Identität des gewählten Kindes noch eine präzise Kraftbezeichnung. Valentus verschwindet; die Quelle erlaubt keinen sicher gezeigten Tod. Ein 12 × 10 Felder großer Innenraum reicht für die Zuflucht. Die kurze Flucht und Lias Hofszene können aus dem gemeinsamen Umgebungsset gebaut werden.

Das Hubpaket liefert einen kleinen, frei begehbaren Abschnitt der Freien Bruderschaft mit 32 × 32 Feldern, Randweg, Lagerfeuer, Werkplatz und Zelten. Lia, Foltan, Azar sowie wenige neutrale Lagerfiguren sind Pflichtassets dieses Pakets. Es prüft freie Bewegung, Gespräche, einen alternativen Weg und optionale Begegnungen. Der Hub folgt erst nach Lias Romananfang und Reise. Er wird nicht direkt nach der Wiege als bereits voll erklärte Vorgeschichte eingesetzt. Eine Lagekarte und die Dialogdaten sind eigene Lieferungen; Ruinenmodule aus der Stilreferenz können am Rand eingesetzt werden, ihre genaue Lage ist eine Spielergänzung.

| Pflicht für Eröffnung oder Hub | Später separat bestellen |
| --- | --- |
| Valentus, Lia mit Hof-/Reisevariante, Kyra und einfache Hof-/Zufluchtfiguren | Flick, Ignatius, Vamir und spätere Filmkostüme |
| Foltan, Azar, drei Gegnerrollen, wenige Soldaten und Lagerfiguren | Vollständige Stadtbevölkerung und individuelle Gegnerbosse |
| Ein Arena-, ein Innenraum- und ein kleiner Hub-Kartensatz; kurze Flucht und Hofszene | Weitere Regionen, große Städte, variable Jahreszeiten |
| Gras, Erde, Pfadkanten, Wasser, Baumteile, Felsen, Ruinenmodule, Palisade, Zelt und Hofmodule | Große Gebäudevarianten, aufwendige Dachaufklappung, zerstörbare Umgebung |
| Kleine Porträts, UI-Icons, Raster, Zielmarker, Zustandsanzeigen | Vollständige Porträtbibliothek, Ausrüstungspapierpuppe |
| Valentus-Strahl, Druckwelle, Wiegenlicht, Treffer und Überblendung | Lias spätere Magie und große filmische Effektsequenzen |

## Atlas, Ebenen und Verantwortlichkeiten

Vorgeschlagene Atlanten: `terrain-common`, `props-common`, `actors-prologue`, `actors-hub`, `fx-prologue`, `ui-common`. Höchstens 1024 × 1024 Pixel pro Seite, neue Seite statt unbegrenzt größerer Textur. Die UI hat 16 × 16 Icons, 32 × 32 Ziel-/Feldmarkierungen und separate 64 × 64 Porträts. Der Atlasexport enthält Dateiname, Rechteck, ursprüngliche Framegröße, trim-Versatz und Fußanker. Produkttexte und Tastaturhilfen bleiben echte UI-Texte, keine in das Bild eingebrannten Beschriftungen.

Der Pixelartist besitzt Palette, Silhouetten, Frames und Exportdaten. Kartendesign besitzt Zellkoordinaten, Übergänge, Höhen und Interaktionspunkte. Gameplay besitzt Bewegung, Trefferflächen und Zustandswechsel. Narrative besitzt die Szenenfolge und Freischaltungen. Diese Verantwortlichkeiten sind Rollen im geplanten Workflow; keine tatsächlich beauftragten Personen werden behauptet.

Boden und niedrige Dekoration liegen unter Figuren. Stämme, Mauern und Figuren werden nach der Welt-Fußposition sortiert. Baumkronen und vordere Dachteile bilden eine getrennte Ebene, die bei Verdeckung ausblenden kann. Schatten sind eigene kleine Bodenbilder. Ein gemaltes Hindernis liefert nicht automatisch Kollision: Baumstamm blockiert, Krone nicht; Wasser und Hangkanten haben eigene Wegdaten. Figuren behalten eine kleine, separat definierte Fuß-Kollisionsform, unabhängig von Robe, Haar oder Effektgröße. Trefferziele hängen an Actor-IDs, nicht am Alpha-Umriss eines Frames.

## Herstellung und Abnahme

Zuerst werden ein Bodenmuster, zwei Bäume, ein Ruinenstück sowie Lia und Valentus in vier Standansichten hergestellt. Eine daraus gebaute kleine Karte prüft Größen, Fußanker, Lesbarkeit und Tileanschlüsse. Erst danach entstehen Gehzyklen und die restlichen Zustände. Generierte Referenzen können Entwürfe liefern; transparentes Freistellen, einheitliche Pixelgröße, Farbreduktion, Konturen, vier konsistente Ansichten und Animationsanschlüsse brauchen gezielte Nacharbeit. Das Szenenbild einfach in Kästchen zu schneiden liefert weder nahtlose Tiles noch vollständige Figurenansichten.

Zur Abnahme gehören: Übereinstimmung von Porträt und Sprite mit den zugeordneten Filmframes, dokumentierte Ausnahmen für Foltan/Azar, belegtreue Zeichen ohne erfundene Fraktionszuordnung, unveränderte Kleidungsmerkmale über alle Frames, ruhiger Fußanker, keine abgeschnittenen Gesten, kontrollierte transparente Ränder, passende benachbarte Tiles, eindeutige Kampfmarker und begehbare Wege hinter Objekten. Jeder Zustand wird in einer Vorschau einmal durchgespielt. Im Browser werden Bewegungsrichtungen, Kamerakanten, Verdeckung und der Wechsel zwischen Erkundung und Kampf überprüft. Diese Prüfungen sind vorgesehen, noch nicht abgeschlossen.

## Laden und Speicherplanung

Zielwerte: höchstens 10 MiB erster Assetdownload und 32 MiB gleichzeitig aktive RGBA-Texturen. Eine volle 1024 × 1024 RGBA-Seite benötigt rechnerisch 4 MiB, sechs solche Seiten 24 MiB ohne weitere Kopien oder Renderflächen. PNG-Dateigröße und Browserspeicher sind unterschiedliche Größen. Die Zahl ist eine Kapazitätsrechnung, keine Messung des Spiels; die gesamte Browserbelegung wird nicht auf 32 MiB begrenzt.

Gemeinsame UI und Terrain bleiben geladen. Prolog- und Hubfiguren werden szenenweise geladen, abgeschlossene Szenen geben ihre exklusiven Atlanten frei. Karten liegen als kleine Zell- und Objektdaten vor. Für die offene Region wird jeweils der aktuelle 32 × 32 Chunk und nur unmittelbar benötigte Nachbarn vorbereitet. Ferne NPCs behalten serialisierten Weltzustand; das Ziel ist höchstens zwölf nahe aktive NPCs. Alle Lieferungen nennen Downloadgröße und unkomprimierte Texturgröße. Ein späterer Build muss Ladezeit, Spitzenbelegung und Bildrate auf einem festgelegten Desktop-Browser messen, bevor eine Leistungsbehauptung möglich ist.
